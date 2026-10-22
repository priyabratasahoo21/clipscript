/**
 * A simulated pointer that moves to and clicks on elements in the world.
 * Movement runs on the playback timeline, so pause and pace apply to it.
 */

import { h, rectIn, s } from './dom.js';
import { easeInOut } from './timeline.js';

const MOVE_MS = 650;
const CLICK_MS = 260;

export class Cursor {
    constructor(world) {
        this.world = world;
        this.el = h('div', { class: 'cs-cursor', 'aria-hidden': 'true' }, [
            s('svg', { viewBox: '0 0 24 24', width: '26', height: '26' }, [
                s('path', { d: 'M4 2l15 9.5-6.6 1.4L16 21l-3 1.5-3.7-8.2L4 18.6z' })
            ]),
            h('span', { class: 'cs-cursor-ring' })
        ]);
        this.x = 1200;
        this.y = 820;
        this.place();
        world.append(this.el);
    }

    place() {
        this.el.style.setProperty('transform', `translate(${this.x}px, ${this.y}px)`);
    }

    /** Move to the centre of an element (or an offset within it). */
    async moveTo(target, ctx, { dx = 0.5, dy = 0.5 } = {}) {
        const rect = rectIn(this.world, target);
        const goal = { x: rect.x + rect.w * dx, y: rect.y + rect.h * dy };
        this.el.classList.add('cs-visible');
        if (ctx.fast) {
            Object.assign(this, goal);
            this.place();
            return;
        }
        const from = { x: this.x, y: this.y };
        await ctx.animate(MOVE_MS, progress => {
            const t = easeInOut(progress);
            this.x = from.x + (goal.x - from.x) * t;
            this.y = from.y + (goal.y - from.y) * t;
            this.place();
        });
    }

    async click(ctx) {
        if (ctx.fast) return;
        this.el.classList.remove('cs-click');
        void this.el.offsetWidth;
        this.el.classList.add('cs-click');
        await ctx.wait(CLICK_MS);
    }

    hide() {
        this.el.classList.remove('cs-visible');
    }
}
