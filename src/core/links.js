/**
 * Data "packets": a glowing path drawn between two targets with a dot
 * travelling along it, left behind as a trail that the recap lights up.
 * Trails remember their targets so they can be redrawn after a resize.
 */

import { WORLD } from './constants.js';
import { s } from './dom.js';
import { easeInOut } from './timeline.js';

const PACKET_MS = 1100;

export class Links {
    constructor(world) {
        this.trails = [];
        this.svg = s('svg', {
            class: 'cf-links',
            viewBox: `0 0 ${WORLD.width} ${WORLD.height}`,
            width: String(WORLD.width),
            height: String(WORLD.height),
            'aria-hidden': 'true'
        });
        world.append(this.svg);
    }

    static path(from, to) {
        const forward = to.x >= from.x + from.w / 2;
        const x1 = forward ? from.x + from.w : from.x;
        const y1 = from.y + from.h / 2;
        const x2 = forward ? to.x : to.x + to.w;
        const y2 = to.y + to.h / 2;
        const bend = Math.max(60, Math.abs(x2 - x1) * 0.45) * (forward ? 1 : -1);
        return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    }

    /**
     * Send a packet between two targets.
     * @param {string} from target
     * @param {string} to target
     * @param {(target: string) => object|null} resolve target → world rect
     */
    async packet(from, to, resolve, ctx) {
        const a = resolve(from);
        const b = resolve(to);
        if (!a || !b) return;
        const path = s('path', { class: 'cf-link', d: Links.path(a, b) });
        const dot = s('circle', { class: 'cf-packet', r: '7' });
        this.svg.append(path, dot);
        const length = path.getTotalLength();
        path.style.setProperty('stroke-dasharray', `${length}`);
        await ctx.animate(PACKET_MS, progress => {
            const t = easeInOut(progress);
            path.style.setProperty('stroke-dashoffset', `${length * (1 - t)}`);
            const point = path.getPointAtLength(length * t);
            dot.setAttribute('cx', String(point.x));
            dot.setAttribute('cy', String(point.y));
        });
        dot.remove();
        path.style.removeProperty('stroke-dasharray');
        path.style.removeProperty('stroke-dashoffset');
        path.classList.add('cf-trail');
        this.trails.push({ from, to, path });
    }

    /** Recompute trail geometry (after a resize or a hidden-container reveal). */
    redraw(resolve) {
        for (const trail of this.trails) {
            const a = resolve(trail.from);
            const b = resolve(trail.to);
            if (a && b) trail.path.setAttribute('d', Links.path(a, b));
        }
    }

    /** Light every trail (used by the recap). */
    lightAll() {
        for (const trail of this.trails) trail.path.classList.add('cf-lit');
    }
}
