/**
 * Design settings for a clip: colour mode, accent, fonts, radius, camera,
 * pace, and aspect ratio. Tokens are applied with CSSOM (style.setProperty),
 * never string-built CSS.
 */

import { EASE_NAMES } from './timeline.js';
import { clamp, isHexColor, isObject } from './util.js';

export const MODES = ['dark', 'light', 'auto'];

/** "auto" is 16:9 on wide players and 4:5 on narrow ones (phones). */
export const ASPECTS = ['auto', '16:9', '4:5', '1:1'];

export const DEFAULT_DESIGN = Object.freeze({
    mode: 'dark',
    accent: '#22d3ee',
    font: Object.freeze({ ui: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', mono: '"JetBrains Mono", ui-monospace, Menlo, monospace' }),
    radius: 12,
    camera: Object.freeze({ zoom: 1.35, speed: 1, ease: 'smooth', punch: null, follow: false }),
    pace: 1,
    aspect: 'auto',
    intro: true,
    subtitles: true,
    endcard: true,
    cursor: true,
    backdrop: null
});

export const LIMITS = Object.freeze({
    radius: [0, 24],
    zoom: [1, 2.5],
    speed: [0.25, 3],
    pace: [0.25, 3],
    duration: [100, 6000],
    punchAmount: [1.05, 2],
    punchHold: [100, 3000]
});

export const DEFAULT_PUNCH = Object.freeze({ amount: 1.25, hold: 700 });

/** Punch-in settings: false/undefined → off; true → defaults; { amount, hold } → clamped; a number → that amount. */
export function resolvePunch(value) {
    if (value === undefined || value === null || value === false) return null;
    if (value === true) return { ...DEFAULT_PUNCH };
    if (typeof value === 'number') return { amount: number(value, DEFAULT_PUNCH.amount, LIMITS.punchAmount), hold: DEFAULT_PUNCH.hold };
    if (isObject(value)) {
        return {
            amount: number(value.amount, DEFAULT_PUNCH.amount, LIMITS.punchAmount),
            hold: number(value.hold, DEFAULT_PUNCH.hold, LIMITS.punchHold)
        };
    }
    return null;
}

/** A stage backdrop: a hex colour or one/two hex colours (a gradient) → [top, bottom], else null. */
export function resolveBackdrop(value) {
    const colors = Array.isArray(value) ? value : [value];
    if (colors.length < 1 || colors.length > 2 || !colors.every(isHexColor)) return null;
    return [colors[0], colors[1] ?? colors[0]];
}

/** A per-move duration, clamped, or undefined for the default. */
export const resolveDuration = value => (typeof value === 'number' && Number.isFinite(value) ? clamp(value, ...LIMITS.duration) : undefined);

// font-family lists only: letters, digits, spaces, commas, quotes, hyphens
const safeFont = (value, fallback) => (typeof value === 'string' && /^[\w\s,'"-]+$/.test(value) ? value : fallback);

const number = (value, fallback, [min, max]) => (typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback);

/** Clamp a zoom multiplier into range (anything invalid becomes 1). */
export const clampZoom = value => number(value, 1, LIMITS.zoom);

/** Merge a clip's design over the defaults, clamping numbers into range. */
export function resolveDesign(design = {}) {
    const d = isObject(design) ? design : {};
    const font = isObject(d.font) ? d.font : {};
    const camera = isObject(d.camera) ? d.camera : {};
    return {
        mode: MODES.includes(d.mode) ? d.mode : DEFAULT_DESIGN.mode,
        accent: isHexColor(d.accent) ? d.accent : DEFAULT_DESIGN.accent,
        font: {
            ui: safeFont(font.ui, DEFAULT_DESIGN.font.ui),
            mono: safeFont(font.mono, DEFAULT_DESIGN.font.mono)
        },
        radius: number(d.radius, DEFAULT_DESIGN.radius, LIMITS.radius),
        camera: {
            zoom: number(camera.zoom, DEFAULT_DESIGN.camera.zoom, LIMITS.zoom),
            speed: number(camera.speed, DEFAULT_DESIGN.camera.speed, LIMITS.speed),
            ease: EASE_NAMES.includes(camera.ease) ? camera.ease : DEFAULT_DESIGN.camera.ease,
            punch: resolvePunch(camera.punch),
            follow: camera.follow === true
        },
        pace: number(d.pace, DEFAULT_DESIGN.pace, LIMITS.pace),
        aspect: ASPECTS.includes(d.aspect) ? d.aspect : DEFAULT_DESIGN.aspect,
        intro: d.intro !== false,
        subtitles: d.subtitles !== false,
        endcard: d.endcard !== false,
        cursor: d.cursor !== false,
        backdrop: resolveBackdrop(d.backdrop)
    };
}

/** Apply design tokens to the player root element ("auto" mode is resolved by the player). */
export function applyDesign(root, design) {
    root.dataset.mode = design.mode === 'auto' ? 'dark' : design.mode;
    root.dataset.aspect = design.aspect;
    const tokens = {
        '--cf-accent': design.accent,
        '--cf-font-ui': design.font.ui,
        '--cf-font-mono': design.font.mono,
        '--cf-radius': `${design.radius}px`
    };
    if (design.aspect !== 'auto') tokens['--cf-aspect'] = design.aspect.replace(':', ' / ');
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}
