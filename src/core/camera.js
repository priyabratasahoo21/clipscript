/**
 * The camera frames a target (a screen, a part of a screen, or everything)
 * by transforming the world. Every move runs on the playback timeline, so
 * pause and pace apply; a newer move always takes over from an older one.
 */

import { WORLD } from './constants.js';
import { clampZoom, resolveDuration } from './design.js';
import { easeOf } from './timeline.js';
import { clamp } from './util.js';

const PADDING = { screen: 28, part: 90, all: 24, follow: 170 };
const MOVE_MS = 900;
const FOLLOW_MS = 700;
const PUNCH_IN_MS = 260;
const PUNCH_OUT_MS = 480;
const PUNCH_STEP_MS = 40;
// tracking: pan once an element is this close to a side; a small one (under
// `small` of the stage width) goes `aim` of the way across; a box being typed
// in keeps `margin` of backdrop at most on either side
const TRACK = { edge: 0.1, aim: 0.4, small: 0.1, margin: 0.04 };

// Share of the stage kept clear around the target; the bottom band leaves
// room for subtitles so they never cover the action.
const FRAME = { top: 0.05, bottom: 0.18, side: 0.03 };
const CENTRE_Y = FRAME.top + (1 - FRAME.top - FRAME.bottom) / 2;

/**
 * The world transform (in pixels) that frames `rect` on a stage of the given size.
 * Pure, so it can be unit-tested.
 * @param {{x:number,y:number,w:number,h:number,kind?:string}} rect  world units
 * @param {{width:number,height:number}} stage  pixels
 * @param {{zoom?: number, maxZoom?: number}} [options]
 */
export function frameFor(rect, stage, { zoom = 1, maxZoom = 1.35 } = {}) {
    const k = stage.width / WORLD.width;
    const viewport = { w: WORLD.width, h: stage.height / k };
    const pad = PADDING[rect.kind] ?? PADDING.screen;
    const frameHeight = 1 - FRAME.top - FRAME.bottom;
    const fit = Math.min(
        (viewport.w * (1 - FRAME.side * 2)) / (rect.w + pad * 2),
        (viewport.h * frameHeight) / (rect.h + pad * 2)
    );
    const factor = clampZoom(zoom);
    const limit = (rect.kind === 'part' || rect.kind === 'follow' ? maxZoom * 1.6 : maxZoom) * factor;
    const scale = clamp(fit * factor, 0.15, limit) * k;
    return {
        x: stage.width / 2 - (rect.x + rect.w / 2) * scale,
        y: stage.height * CENTRE_Y - (rect.y + rect.h / 2) * scale,
        scale
    };
}

const lerp = (from, to, t) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    scale: from.scale + (to.scale - from.scale) * t
});

export class Camera {
    /**
     * @param {HTMLElement} stage  visible viewport
     * @param {HTMLElement} world  1600×900 layer that gets transformed
     * @param {(target: string) => object|null} resolve  target → world rect
     * @param {{maxZoom: number, speed: number, ease?: string}} options
     */
    constructor(stage, world, resolve, { maxZoom, speed, ease = 'smooth' }) {
        this.stage = stage;
        this.world = world;
        this.resolve = resolve;
        this.maxZoom = maxZoom;
        this.speed = speed;
        this.ease = ease;
        this.target = 'all';
        this.zoom = 1;
        this.current = null;
        this.moveId = 0;
        this.punchState = null;
        this.tracking = false;
        this.dived = null;
    }

    stageSize() {
        const width = this.stage.clientWidth;
        const height = this.stage.clientHeight;
        return width && height ? { width, height } : null;
    }

    /** Transform that frames a world rect. */
    frame(rect, zoom = this.zoom) {
        const size = this.stageSize();
        return rect && size ? frameFor(rect, size, { zoom, maxZoom: this.maxZoom }) : null;
    }

    goal() {
        const rect = this.resolve(this.target);
        return this.dived ? this.cover(rect, this.dived.round) : this.frame(rect);
    }

    /** The transform at which a rect fills the whole stage (a round one covers the corners too, so √2 further). */
    cover(rect, round) {
        const size = this.stageSize();
        if (!rect || !size) return null;
        const scale = Math.max(size.width / rect.w, size.height / rect.h) * (round ? Math.SQRT2 * 1.06 : 1.08);
        return { scale, x: size.width / 2 - (rect.x + rect.w / 2) * scale, y: size.height / 2 - (rect.y + rect.h / 2) * scale };
    }

    set(transform) {
        this.current = transform;
        this.world.style.setProperty('transform', `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`);
    }

    /** Re-frame the current target immediately (after a resize). */
    apply() {
        const goal = this.goal();
        if (goal) this.set(goal);
    }

    /**
     * Animate to a transform. Resolves when the move ends; a newer move takes over mid-flight.
     * @param {{x:number,y:number,scale:number}} goal
     * @param {{ctx?: object, instant?: boolean, duration?: number, ease?: string}} options
     */
    async moveTo(goal, { ctx, instant = false, duration, ease } = {}) {
        if (!goal) return;
        const id = ++this.moveId;
        const from = this.current;
        if (instant || !ctx || ctx.fast || !from) {
            this.set(goal);
            return;
        }
        const curve = easeOf(ease ?? this.ease);
        const ms = resolveDuration(duration) ?? MOVE_MS / this.speed;
        await ctx.animate(ms, progress => {
            if (id === this.moveId) this.set(lerp(from, goal, curve(progress)));
        });
    }

    /**
     * Frame a target ("all", a screen id, or "screen.part:name").
     * @param {string} target
     * @param {{zoom?: number, ctx?: object, instant?: boolean, duration?: number, ease?: string}} [options]
     */
    focus(target, { zoom, ...options } = {}) {
        this.target = target;
        this.zoom = clampZoom(zoom);
        this.dived = null;
        this.punchState = null;
        return this.moveTo(this.goal(), options);
    }

    /**
     * Slide at the current zoom: to a target's centre, or by an offset in world units.
     * @param {string|{x?: number, y?: number}} target
     */
    pan(target, options = {}) {
        const from = this.current;
        const size = this.stageSize();
        if (!from || !size) return Promise.resolve();
        let goal;
        if (typeof target === 'string') {
            const rect = this.resolve(target);
            if (!rect) return Promise.resolve();
            goal = {
                scale: from.scale,
                x: size.width / 2 - (rect.x + rect.w / 2) * from.scale,
                y: size.height * CENTRE_Y - (rect.y + rect.h / 2) * from.scale
            };
        } else {
            goal = { scale: from.scale, x: from.x - (target.x ?? 0) * from.scale, y: from.y - (target.y ?? 0) * from.scale };
        }
        this.punchState = null;
        this.dived = null;
        return this.moveTo(goal, options);
    }

    /**
     * Follow the action: ease toward an element's world rect, but only when it is
     * drifting out of a comfortable frame (so the camera doesn't jitter).
     */
    follow(rect, ctx) {
        const size = this.stageSize();
        const from = this.current;
        if (!rect || !size || !from || ctx.fast) return Promise.resolve();
        const screenX = from.x + (rect.x + rect.w / 2) * from.scale;
        const screenY = from.y + (rect.y + rect.h / 2) * from.scale;
        const comfortable = screenX > size.width * 0.22 && screenX < size.width * 0.78
            && screenY > size.height * 0.15 && screenY < size.height * 0.7;
        if (comfortable) return Promise.resolve();
        const goal = frameFor({ ...rect, kind: 'follow' }, size, { maxZoom: this.maxZoom });
        // never zoom further out than the current framing while following
        goal.scale = Math.max(goal.scale, Math.min(from.scale, goal.scale * 1.2));
        goal.x = size.width / 2 - (rect.x + rect.w / 2) * goal.scale;
        goal.y = size.height * CENTRE_Y - (rect.y + rect.h / 2) * goal.scale;
        return this.moveTo(goal, { ctx, duration: FOLLOW_MS, ease: 'smooth' });
    }

    /**
     * Keep an element on screen at the current zoom: a caret while typing, or a
     * menu that just opened. Pans only once it nears an edge, one move at a time,
     * so typing doesn't shake the frame. A small element is put a little left of
     * centre (room to type into); a larger one is nudged just inside the edge.
     * With `bounds` (the box being typed in), the pan never shows more of the
     * backdrop than it has to.
     * @param {{x:number,y:number,w:number,h:number}} rect  world units
     * @param {object} ctx  step context
     * @param {{x:number,y:number,w:number,h:number}} [bounds]  world units
     */
    async track(rect, ctx, bounds) {
        const size = this.stageSize();
        const from = this.current;
        if (!rect || !size || !from || ctx.fast || this.tracking) return;
        const { scale } = from;
        const left = from.x + rect.x * scale;
        const right = left + rect.w * scale;
        const top = from.y + rect.y * scale;
        const bottom = top + rect.h * scale;
        const edge = { left: size.width * TRACK.edge, right: size.width * (1 - TRACK.edge), top: size.height * FRAME.top, bottom: size.height * (1 - FRAME.bottom) };
        const outX = left < edge.left || right > edge.right;
        const outY = top < edge.top || bottom > edge.bottom;
        if (!outX && !outY) return;
        let x = from.x;
        let y = from.y;
        if (outX) {
            x += right - left < size.width * TRACK.small
                ? size.width * TRACK.aim - (left + right) / 2
                : (left < edge.left ? edge.left - left : edge.right - right);
            if (bounds) {
                const margin = size.width * TRACK.margin;
                x = bounds.w * scale <= size.width - margin * 2
                    ? size.width / 2 - (bounds.x + bounds.w / 2) * scale
                    : clamp(x, size.width - margin - (bounds.x + bounds.w) * scale, margin - bounds.x * scale);
            }
        }
        if (outY) y += top < edge.top ? edge.top - top : edge.bottom - bottom;
        if (Math.abs(x - from.x) < 1 && Math.abs(y - from.y) < 1) return;
        const goal = { scale, x, y };
        this.tracking = true;
        try {
            await this.moveTo(goal, { ctx, duration: FOLLOW_MS, ease: 'smooth' });
        } finally {
            this.tracking = false;
        }
    }

    /** Frame a detail for a moment without changing the chapter's framing; `back()` returns to it. */
    look(rect, { zoom, ...options } = {}) {
        this.punchState = null;
        return this.moveTo(this.frame({ ...rect, kind: 'part' }, clampZoom(zoom)), options);
    }

    /**
     * Dive: move in until a target fills the whole stage, the way a scene cuts
     * "through" an object into the next one. It stays dived (through resizes)
     * until the next focus pulls back out.
     */
    dive(target, { round = false, ...options } = {}) {
        this.target = target;
        this.zoom = 1;
        this.dived = { round };
        this.punchState = null;
        return this.moveTo(this.goal(), options);
    }

    /** Return to the current target's framing (after a look). */
    back(options = {}) {
        this.punchState = null;
        return this.moveTo(this.goal(), options);
    }

    /**
     * Punch in toward a world point on a click, hold, then ease back out.
     * Clicks during an active punch extend its hold instead of starting another.
     * @param {{x:number,y:number}} point world units
     * @param {object} ctx step context
     * @param {{amount:number, hold:number}} punch
     */
    async punchAt(point, ctx, { amount, hold }) {
        if (ctx.fast || !this.current) return;
        if (this.punchState) {
            this.punchState.holdUntil = this.punchState.elapsed + hold;
            return;
        }
        const size = this.stageSize();
        if (!size) return;
        const base = this.current;
        const scale = base.scale * amount;
        // move the click point a third of the way toward the centre while zooming in
        const screen = { x: base.x + point.x * base.scale, y: base.y + point.y * base.scale };
        const aim = { x: screen.x + (size.width / 2 - screen.x) * 0.35, y: screen.y + (size.height * CENTRE_Y - screen.y) * 0.35 };
        const goal = { scale, x: aim.x - point.x * scale, y: aim.y - point.y * scale };
        const state = { elapsed: 0, holdUntil: hold };
        this.punchState = state;
        await this.moveTo(goal, { ctx, duration: PUNCH_IN_MS, ease: 'snappy' });
        const moveAfterIn = this.moveId;
        while (this.punchState === state && state.elapsed < state.holdUntil) {
            await ctx.wait(PUNCH_STEP_MS);
            state.elapsed += PUNCH_STEP_MS;
        }
        // only ease back if nothing else has moved the camera meanwhile
        if (this.punchState === state && this.moveId === moveAfterIn) {
            this.punchState = null;
            await this.moveTo(this.goal() ?? base, { ctx, duration: PUNCH_OUT_MS, ease: 'smooth' });
        }
    }
}
