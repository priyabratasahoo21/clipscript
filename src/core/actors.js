/**
 * Actors: glossy spheres, blocks, pills, and rings that live in the world
 * above the screens and move like characters. They pop in, hop and squash
 * when they land, bounce, roll along a surface, slide, float, and leave.
 * Confetti bursts live here too.
 *
 * Every motion runs on the playback timeline, so pause and pace apply. Each
 * actor has one current motion (a "take"): starting a new one makes any older
 * motion still running stop moving it, so overlapping steps never fight.
 */

import { STOP } from './constants.js';
import { resolveDuration } from './design.js';
import { h } from './dom.js';
import { EASES, easeOf } from './timeline.js';
import { clamp, seeded } from './util.js';

export const SHAPES = ['sphere', 'block', 'pill', 'ring'];
export const SPAWN_EFFECTS = ['pop', 'drop', 'rise', 'fade'];
export const LEAVE_EFFECTS = ['pop', 'fall', 'shrink', 'fade'];
export const PATHS = ['hop', 'bounce', 'roll', 'slide', 'float'];
export const FINISHES = ['gloss', 'matte', 'glass'];
export const ACTOR_KEYS = ['shape', 'color', 'colors', 'size', 'count', 'columns', 'gap', 'label', 'labels', 'at', 'squash', 'finish'];
export const MAX_BOUNCES = 4;
export const MAX_PIECES = 24;
export const CONFETTI_COLORS = ['#ff5f9e', '#ffc83d', '#34d399', '#3fa9ff', '#a66cff', '#ff7a45'];

const POP_MS = 520;
const DROP_MS = 460;
const LEAVE_MS = 360;
const SQUASH_MS = 90;
const SETTLE_MS = 320;
const BOUNCE_SETTLE_MS = 110;
const CONFETTI_MS = 2600;
const CONFETTI_WAIT_MS = 700;

const DROP_HEIGHT = 420;
const DEFAULT_BOUNCINESS = 0.36;

const heightOf = (shape, size) => (shape === 'pill' ? size * 0.46 : size);
const reboundCount = (value, fallback) => clamp(Math.round(typeof value === 'number' ? value : fallback), 0, MAX_BOUNCES);
const reboundShare = value => clamp(typeof value === 'number' ? value : DEFAULT_BOUNCINESS, 0.1, 0.8);

export class Actors {
    /**
     * @param {HTMLElement} world
     * @param {Record<string, object>} defs  actor id → definition (validated)
     */
    constructor(world, defs) {
        this.world = world;
        this.items = Object.create(null);
        this.bursts = 0;
        for (const [id, def] of Object.entries(defs ?? {})) this.items[id] = this.build(id, def);
    }

    build(id, def) {
        const shape = SHAPES.includes(def.shape) ? def.shape : 'sphere';
        const size = clamp(typeof def.size === 'number' ? def.size : 110, 16, 600);
        const count = clamp(Math.round(def.count ?? 1), 1, MAX_PIECES);
        const columns = clamp(Math.round(def.columns ?? count), 1, count);
        const rows = Math.ceil(count / columns);
        const gap = typeof def.gap === 'number' ? def.gap : size * 0.25;
        const height = heightOf(shape, size);
        const finish = FINISHES.includes(def.finish) ? def.finish : 'gloss';
        const pieces = Array.from({ length: count }, (_, i) => {
            const color = def.colors?.[i % def.colors.length] ?? def.color ?? '#a66cff';
            const label = def.labels?.[i] ?? (count === 1 ? def.label : undefined);
            // a sphere's surface turns as it rolls; its shine stays put, facing the light
            const spin = shape === 'sphere' ? h('span', { class: 'cf-actor-spin' }) : null;
            const el = h('div', {
                class: `cf-actor cf-actor-${shape} cf-finish-${finish}`,
                'aria-hidden': 'true',
                style: { '--actor': color, '--size': `${size}px`, width: `${size}px`, height: `${height}px` }
            }, [spin, label ? h('span', { class: 'cf-actor-label', text: label }) : null]);
            // a contact shadow that stays on the ground and shrinks as the piece rises
            const shadowW = size * 0.8;
            const shadowH = Math.max(8, size * 0.16);
            const shadow = h('div', {
                class: finish === 'glass' ? 'cf-actor-shadow cf-shadow-glass' : 'cf-actor-shadow',
                'aria-hidden': 'true',
                style: { '--actor': color, width: `${shadowW}px`, height: `${shadowH}px` }
            });
            this.world.append(shadow, el);
            return {
                el,
                spin,
                shadow,
                shadowW,
                shadowH,
                dx: ((i % columns) - (columns - 1) / 2) * (size + gap),
                dy: (Math.floor(i / columns) - (rows - 1) / 2) * (height + gap),
                lift: 0,
                sx: 1,
                sy: 1,
                opacity: 0
            };
        });
        // how much it squashes and stretches: spheres are soft, blocks stiff, 0 turns it off
        const squash = clamp(typeof def.squash === 'number' ? def.squash : shape === 'sphere' ? 1 : 0.4, 0, 2);
        const actor = { id, shape, size, height, pieces, squash, x: def.at?.x ?? 800, y: def.at?.y ?? 450, turn: 0, take: 0, visible: false };
        this.place(actor);
        return actor;
    }

    place(actor) {
        for (const piece of actor.pieces) {
            const x = actor.x + piece.dx - actor.size / 2;
            const y = actor.y + piece.dy - actor.height / 2 - piece.lift;
            piece.el.style.setProperty('transform', `translate(${x}px, ${y}px) scale(${piece.sx}, ${piece.sy})`);
            piece.el.style.setProperty('opacity', String(piece.opacity));
            piece.spin?.style.setProperty('transform', `rotate(${actor.turn}rad)`);
            const near = clamp(1 - piece.lift / 520, 0.3, 1);
            const groundX = actor.x + piece.dx - piece.shadowW / 2;
            const groundY = actor.y + piece.dy + actor.height / 2 - piece.shadowH / 2;
            piece.shadow.style.setProperty('transform', `translate(${groundX}px, ${groundY}px) scale(${near * piece.sx}, ${near})`);
            piece.shadow.style.setProperty('opacity', String(piece.opacity * near));
        }
    }

    /** World rect of the whole formation, or of one piece. */
    rect(actor, index) {
        const pieces = index === undefined ? actor.pieces : [actor.pieces[index]].filter(Boolean);
        if (!pieces.length) return null;
        const left = Math.min(...pieces.map(p => actor.x + p.dx - actor.size / 2));
        const top = Math.min(...pieces.map(p => actor.y + p.dy - actor.height / 2));
        const right = Math.max(...pieces.map(p => actor.x + p.dx + actor.size / 2));
        const bottom = Math.max(...pieces.map(p => actor.y + p.dy + actor.height / 2));
        return { x: left, y: top, w: right - left, h: bottom - top };
    }

    /** Where an actor's centre goes to sit on top of a rect ("perch"), or at its centre. */
    spotFor(actor, rect, { perch = false, offset } = {}) {
        const formation = this.rect(actor);
        const halfHeight = formation ? formation.h / 2 : actor.height / 2;
        return {
            x: rect.x + rect.w / 2 + (offset?.x ?? 0),
            y: (perch ? rect.y - halfHeight : rect.y + rect.h / 2) + (offset?.y ?? 0)
        };
    }

    /** Start a new motion for an actor; any older motion still running stops moving it. */
    claim(actor) {
        actor.take += 1;
        return actor.take;
    }

    /** Animate one take; resolves false if a newer motion took over meanwhile. */
    async frame(actor, take, ctx, ms, draw) {
        await ctx.animate(ms, t => {
            if (actor.take !== take) return;
            draw(t);
            this.place(actor);
        });
        return actor.take === take;
    }

    /** Squash (landing, take-off), then spring back; a quick settle launches straight into a rebound. */
    async squash(actor, ctx, take, { amount = 1, settle = SETTLE_MS, pieces = actor.pieces } = {}) {
        const sx = 1 + 0.3 * amount * actor.squash;
        const sy = 1 - 0.28 * amount * actor.squash;
        const pressed = await this.frame(actor, take, ctx, SQUASH_MS, t => {
            for (const piece of pieces) Object.assign(piece, { sx: 1 + (sx - 1) * t, sy: 1 + (sy - 1) * t });
        });
        if (!pressed) return false;
        const curve = settle < SETTLE_MS ? EASES.snappy : EASES.spring;
        return this.frame(actor, take, ctx, settle, t => {
            const k = curve(t);
            for (const piece of pieces) Object.assign(piece, { sx: sx + (1 - sx) * k, sy: sy + (1 - sy) * k });
        });
    }

    /**
     * One parabolic flight, stretching tall in the air. Without `from`/`to` the actor rebounds on
     * the spot; `carry` is the height each piece already had (taking over mid-air), eased away.
     */
    arc(actor, ctx, take, { ms, arc, curve = EASES.smooth, from, to, pieces = actor.pieces, carry }) {
        const stretch = actor.squash;
        return this.frame(actor, take, ctx, ms, t => {
            if (from && to) {
                const k = curve(t);
                actor.x = from.x + (to.x - from.x) * k;
                actor.y = from.y + (to.y - from.y) * k;
            }
            const air = Math.sin(Math.PI * t);
            pieces.forEach((piece, i) => Object.assign(piece, {
                lift: arc * 4 * t * (1 - t) + (carry?.[i] ?? 0) * (1 - t),
                sx: 1 - 0.1 * air * stretch,
                sy: 1 + 0.16 * air * stretch
            }));
        });
    }

    /**
     * Rebound after landing: `count` times, each `share` as high as the last, squashing less each
     * time. Flight time goes with √height, measured against a reference flight. A flat landing
     * (no height) has nothing to rebound from, so it only squashes.
     */
    async rebound(actor, ctx, take, { count, share, height, reference, pieces = actor.pieces }) {
        let impact = 1;
        let rise = height;
        const times = height > 0 && reference.height > 0 ? count : 0;
        for (let i = 0; i < times; i++) {
            if (!await this.squash(actor, ctx, take, { amount: impact, settle: BOUNCE_SETTLE_MS, pieces })) return;
            rise *= share;
            if (!await this.arc(actor, ctx, take, { ms: reference.ms * Math.sqrt(rise / reference.height), arc: rise, pieces })) return;
            impact *= 0.6;
        }
        await this.squash(actor, ctx, take, { amount: times ? impact : 1, pieces });
    }

    async spawn(actor, ctx, { at, effect = 'pop', stagger = 90, bounces, bounciness } = {}) {
        const take = this.claim(actor);
        if (at) Object.assign(actor, at);
        actor.visible = true;
        if (ctx.fast) {
            for (const piece of actor.pieces) Object.assign(piece, { opacity: 1, sx: 1, sy: 1, lift: 0 });
            this.place(actor);
            return;
        }
        await Promise.all(actor.pieces.map(async (piece, i) => {
            await ctx.wait(i * stagger);
            if (actor.take === take) await this.appear(actor, piece, effect, ctx, take, { bounces, bounciness });
        }));
    }

    async appear(actor, piece, effect, ctx, take, { bounces, bounciness } = {}) {
        if (effect === 'drop') {
            Object.assign(piece, { opacity: 1, lift: DROP_HEIGHT });
            const landed = await this.frame(actor, take, ctx, DROP_MS, t => {
                piece.lift = DROP_HEIGHT * (1 - t * t);
            });
            // a fall from DROP_HEIGHT is half of a 2×DROP_MS flight
            if (landed) {
                await this.rebound(actor, ctx, take, {
                    count: reboundCount(bounces, 1),
                    share: reboundShare(bounciness),
                    height: DROP_HEIGHT,
                    reference: { height: DROP_HEIGHT, ms: DROP_MS * 2 },
                    pieces: [piece]
                });
            }
            return;
        }
        const curve = effect === 'pop' ? EASES.spring : EASES.snappy;
        await this.frame(actor, take, ctx, effect === 'fade' ? 420 : POP_MS, t => {
            const k = curve(t);
            piece.opacity = effect === 'fade' ? t : Math.min(1, t * 3);
            if (effect === 'pop') Object.assign(piece, { sx: k, sy: k });
            if (effect === 'rise') piece.lift = -90 * (1 - k);
        });
    }

    /**
     * Move to a world point. "hop" arcs and squashes on landing; "bounce" lands and rebounds;
     * "roll" stays on the surface and turns as it goes (distance ÷ radius); "slide" glides;
     * "float" drifts with a bob.
     */
    async move(actor, ctx, { to, path = 'hop', duration, ease, height, bounces, bounciness }) {
        const take = this.claim(actor);
        const from = { x: actor.x, y: actor.y };
        // taking over mid-air: keep each piece's height and ease it away, rather than snapping down
        const carry = actor.pieces.map(piece => piece.lift);
        const airborne = carry.some(lift => lift > 1);
        for (const piece of actor.pieces) Object.assign(piece, { sx: 1, sy: 1 });
        if (ctx.fast) {
            for (const piece of actor.pieces) piece.lift = 0;
            Object.assign(actor, to);
            this.place(actor);
            return;
        }
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const curve = easeOf(ease ?? (path === 'float' ? 'gentle' : 'smooth'));
        if (path === 'hop' || path === 'bounce') {
            const ms = resolveDuration(duration) ?? clamp(380 + distance * 0.55, 450, 1400);
            if (!airborne && !await this.squash(actor, ctx, take, { amount: 0.5 })) return;
            const arc = typeof height === 'number' ? height : clamp(distance * 0.45, 90, 320);
            if (!await this.arc(actor, ctx, take, { ms, arc, curve, from, to, carry })) return;
            await this.rebound(actor, ctx, take, {
                count: reboundCount(bounces, path === 'bounce' ? 2 : 0),
                share: reboundShare(bounciness),
                height: arc,
                reference: { height: arc, ms }
            });
            return;
        }
        // rolling takes longer than flying the same distance
        const ms = resolveDuration(duration) ?? clamp(500 + distance * (path === 'roll' ? 2.4 : 0.55), 450, 4000);
        const turnFrom = actor.turn;
        const radius = actor.size / 2;
        await this.frame(actor, take, ctx, ms, t => {
            const k = curve(t);
            actor.x = from.x + (to.x - from.x) * k;
            actor.y = from.y + (to.y - from.y) * k;
            // rolling right turns clockwise; the turn follows the distance covered, overshoot included
            if (path === 'roll') actor.turn = turnFrom + ((to.x - from.x) * k) / radius;
            actor.pieces.forEach((piece, i) => {
                piece.lift = carry[i] * (1 - k) + (path === 'float' ? 14 * Math.sin(Math.PI * 2 * t) : 0);
            });
        });
    }

    async leave(actor, ctx, { effect = 'pop' } = {}) {
        const take = this.claim(actor);
        actor.visible = false;
        if (ctx.fast) {
            for (const piece of actor.pieces) piece.opacity = 0;
            this.place(actor);
            return;
        }
        const start = actor.pieces.map(piece => ({ ...piece }));
        const left = await this.frame(actor, take, ctx, effect === 'fall' ? 620 : LEAVE_MS, t => {
            actor.pieces.forEach((piece, i) => {
                if (effect === 'pop') {
                    const k = t < 0.3 ? 1 + 0.18 * (t / 0.3) : 1.18 * (1 - (t - 0.3) / 0.7);
                    Object.assign(piece, { sx: k, sy: k, opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3 });
                } else if (effect === 'fall') {
                    Object.assign(piece, { lift: start[i].lift - 700 * t * t, opacity: 1 - t * t });
                } else if (effect === 'shrink') {
                    const k = 1 - EASES.smooth(t);
                    Object.assign(piece, { sx: k, sy: k, opacity: Math.min(1, k * 3) });
                } else {
                    piece.opacity = 1 - t;
                }
            });
        });
        if (!left) return;
        for (const piece of actor.pieces) Object.assign(piece, { opacity: 0, lift: 0, sx: 1, sy: 1 });
        this.place(actor);
    }

    /**
     * A burst of confetti from a world point. Waits for the burst, and lets the
     * pieces finish falling while the film carries on.
     */
    async confetti(at, ctx, { count = 90, colors = CONFETTI_COLORS, power = 1 } = {}) {
        if (ctx.fast) return;
        const random = seeded(++this.bursts * 7919);
        const pieces = Array.from({ length: clamp(Math.round(count), 10, 240) }, (_, i) => {
            const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.95;
            const speed = (700 + random() * 900) * power;
            const el = h('i', {
                class: 'cf-confetti',
                style: { background: colors[i % colors.length], width: `${8 + random() * 9}px`, height: `${5 + random() * 11}px` }
            });
            return { el, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, spin: (random() - 0.5) * 1600, flip: random() * 6.3, rate: 4 + random() * 8 };
        });
        const layer = h('div', { class: 'cf-confetti-layer', 'aria-hidden': 'true' }, pieces.map(piece => piece.el));
        this.world.append(layer);
        const drag = 1.9;
        const gravity = 1700;
        const fall = ctx.animate(CONFETTI_MS, t => {
            const s = (t * CONFETTI_MS) / 1000;
            const slow = (1 - Math.exp(-drag * s)) / drag;
            for (const piece of pieces) {
                const x = at.x + piece.vx * slow;
                const y = at.y + piece.vy * slow + (gravity / drag) * (s - slow);
                piece.el.style.setProperty('transform', `translate(${x}px, ${y}px) rotate(${piece.spin * s}deg) scaleY(${Math.cos(piece.flip + piece.rate * s)})`);
                piece.el.style.setProperty('opacity', String(t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25));
            }
        }).finally(() => layer.remove());
        fall.catch(error => {
            if (error !== STOP) console.error(error);
        });
        await ctx.wait(CONFETTI_WAIT_MS);
    }
}
