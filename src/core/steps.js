/**
 * Step vocabulary and target resolution, shared by the validator and the
 * player so they always agree on what a step does and which screen it acts on.
 */

import { hasOwn, parseSelector } from './util.js';

/** Actions every clip can use, whatever its screens. */
export const GENERIC_ACTIONS = ['focus', 'pan', 'dive', 'blur', 'caption', 'wait', 'packet', 'enter', 'exit', 'front', 'spawn', 'move', 'leave', 'confetti', 'backdrop'];

/** Extra keys each generic action reads. */
const MOTION_KEYS = ['duration', 'ease'];

export const GENERIC_KEYS = {
    focus: ['zoom', ...MOTION_KEYS, 'async'],
    pan: [...MOTION_KEYS, 'async'],
    dive: [...MOTION_KEYS, 'into'],
    blur: ['amount'],
    caption: [],
    wait: [],
    packet: [],
    enter: ['from', ...MOTION_KEYS],
    exit: ['to', ...MOTION_KEYS],
    front: ['dim'],
    spawn: ['at', 'perch', 'offset', 'effect', 'stagger', 'bounces', 'bounciness'],
    move: ['to', 'perch', 'offset', 'path', 'height', 'bounces', 'bounciness', ...MOTION_KEYS, 'async'],
    leave: ['effect'],
    confetti: ['count', 'colors', 'power'],
    backdrop: []
};

/** Keys any surface step may add: the screen it runs on, and a per-step punch-in override. */
export const SURFACE_STEP_KEYS = ['on', 'punch'];

/** How screens enter and exit. */
export const DIRECTIONS = ['left', 'right', 'top', 'bottom', 'fade', 'zoom', 'pop', 'drop', 'launch', 'minimize', 'flip'];

/** Generic actions whose value is a screen id. */
export const SCREEN_ACTIONS = ['enter', 'exit', 'front'];

/** The action name of a step: its first key that is a known action. */
export function actionOf(step, surfaceActions) {
    return Object.keys(step).find(key => GENERIC_ACTIONS.includes(key) || surfaceActions.has(key)) ?? null;
}

/**
 * Which screen a surface action runs on.
 * @param {object} step
 * @param {string} action
 * @param {Record<string, {surface: {actions: object}}>} screens  screen id → entry with its surface
 * @returns {{key: string} | {error: string, hint?: string, path?: string}}
 */
export function resolveStepScreen(step, action, screens) {
    const keys = Object.keys(screens);
    const owners = keys.filter(key => hasOwn(screens[key].surface.actions, action));
    const selector = typeof step[action] === 'string' ? parseSelector(step[action]) : null;
    const selected = selector && hasOwn(screens, selector.screen) && selector.part ? selector.screen : null;

    if (step.on !== undefined) {
        if (typeof step.on !== 'string') return { error: '"on" names the screen this step runs on, so it must be a screen id.', path: 'on' };
        if (!hasOwn(screens, step.on)) return { error: `screen "${step.on}" is not defined.`, path: 'on', candidates: keys };
        if (!hasOwn(screens[step.on].surface.actions, action)) return { error: `"${action}" can't run on "${step.on}".`, path: 'on' };
        if (selected && selected !== step.on) {
            return { error: `"on": "${step.on}" disagrees with the target's screen "${selected}"; remove "on" or fix the target.`, path: 'on' };
        }
        return { key: step.on };
    }
    if (selected) {
        if (!hasOwn(screens[selected].surface.actions, action)) return { error: `"${action}" doesn't work on "${selected}"; check the target.` };
        return { key: selected };
    }
    if (owners.length === 1) return { key: owners[0] };
    if (owners.length === 0) return { error: `"${action}" needs a screen that supports it, and this clip has none.` };
    return { error: `"${action}" could apply to ${owners.join(' or ')}; add "on": "<screen>".` };
}
