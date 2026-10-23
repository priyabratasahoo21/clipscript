/**
 * Pausable, cancellable timing for one playback run.
 * Every wait and animation goes through here, so pause, replay, and
 * jump-to-chapter behave consistently.
 */

import { STOP } from './constants.js';

export class Timeline {
    constructor() {
        this.runId = 0;
        this.paused = false;
    }

    /** Start a new run; anything still awaiting from the previous run is cancelled. */
    begin() {
        this.runId += 1;
        this.paused = false;
        return this.runId;
    }

    cancel() {
        this.runId += 1;
    }

    isCurrent(id) {
        return id === this.runId;
    }

    /**
     * A step context for one chapter of one run.
     * @param {number} id run id from begin()
     * @param {{fast: boolean, pace: number}} options fast = skip timing (jumping ahead)
     */
    context(id, { fast, pace }) {
        const timeline = this;
        const animate = (ms, onFrame) => new Promise((resolve, reject) => {
            if (!timeline.isCurrent(id)) {
                reject(STOP);
                return;
            }
            // a duration that isn't a number (NaN) would never finish; treat it as instant
            const duration = Number.isFinite(ms / pace) ? Math.max(0, ms / pace) : 0;
            if (fast || duration === 0) {
                onFrame?.(1);
                resolve();
                return;
            }
            let elapsed = 0;
            let last = performance.now();
            const frame = now => {
                if (!timeline.isCurrent(id)) {
                    reject(STOP);
                    return;
                }
                if (!timeline.paused) elapsed += now - last;
                last = now;
                const progress = Math.min(1, elapsed / duration);
                onFrame?.(progress);
                if (progress >= 1) resolve();
                else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        });
        return {
            fast,
            wait: ms => animate(ms),
            animate
        };
    }
}

export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Named easing curves for camera moves and screen effects (t and the result run 0 → 1). */
export const EASES = Object.freeze({
    smooth: easeInOut,
    snappy: t => 1 - (1 - t) ** 5,
    linear: t => t,
    gentle: t => -(Math.cos(Math.PI * t) - 1) / 2,
    spring: t => {
        const c = 1.7;
        return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
    },
    bounce: t => {
        const n = 7.5625;
        const d = 2.75;
        if (t < 1 / d) return n * t * t;
        if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
        if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
        return n * (t - 2.625 / d) ** 2 + 0.984375;
    }
});

/** Easing names authors can choose. */
export const EASE_NAMES = ['smooth', 'snappy', 'linear', 'gentle', 'spring'];

export const easeOf = name => EASES[name] ?? EASES.smooth;
