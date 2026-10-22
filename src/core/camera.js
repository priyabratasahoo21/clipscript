/**
 * The camera frames a target (a screen, a part of a screen, or everything)
 * by transforming the world. Moves run on the playback timeline, so pause
 * and pace apply to them like any other step.
 */

import { WORLD } from './constants.js';
import { clampZoom } from './design.js';
import { easeInOut } from './timeline.js';
import { clamp } from './util.js';

const PADDING = { screen: 28, part: 90, all: 24 };
const MOVE_MS = 900;

// Share of the stage kept clear around the target; the bottom band leaves
// room for subtitles so they never cover the action.
const FRAME = { top: 0.05, bottom: 0.18, side: 0.03 };

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
    const limit = (rect.kind === 'part' ? maxZoom * 1.6 : maxZoom) * factor;
    const scale = clamp(fit * factor, 0.15, limit) * k;
    return {
        x: stage.width / 2 - (rect.x + rect.w / 2) * scale,
        y: stage.height * (FRAME.top + frameHeight / 2) - (rect.y + rect.h / 2) * scale,
        scale
    };
}

export class Camera {
    /**
     * @param {HTMLElement} stage  visible viewport
     * @param {HTMLElement} world  1600×900 layer that gets transformed
     * @param {(target: string) => object|null} resolve  target → world rect
     * @param {{maxZoom: number, speed: number}} options
     */
    constructor(stage, world, resolve, { maxZoom, speed }) {
        this.stage = stage;
        this.world = world;
        this.resolve = resolve;
        this.maxZoom = maxZoom;
        this.speed = speed;
        this.target = 'all';
        this.zoom = 1;
        this.current = null;
    }

    goal() {
        const rect = this.resolve(this.target);
        const width = this.stage.clientWidth;
        const height = this.stage.clientHeight;
        if (!rect || !width || !height) return null;
        return frameFor(rect, { width, height }, { zoom: this.zoom, maxZoom: this.maxZoom });
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
     * Move to a target. Animated on the timeline when a step context is given.
     * @param {string} target
     * @param {{zoom?: number, ctx?: object, instant?: boolean}} [options]
     */
    async focus(target, { zoom, ctx, instant = false } = {}) {
        this.target = target;
        this.zoom = clampZoom(zoom);
        const goal = this.goal();
        if (!goal) return;
        const from = this.current;
        if (instant || !ctx || ctx.fast || !from) {
            this.set(goal);
            return;
        }
        await ctx.animate(MOVE_MS / this.speed, progress => {
            const t = easeInOut(progress);
            this.set({
                x: from.x + (goal.x - from.x) * t,
                y: from.y + (goal.y - from.y) * t,
                scale: from.scale + (goal.scale - from.scale) * t
            });
        });
    }
}
