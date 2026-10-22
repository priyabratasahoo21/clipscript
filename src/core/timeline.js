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
            const duration = Math.max(0, ms / pace);
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
