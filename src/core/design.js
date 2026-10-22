/**
 * Design settings for a clip: colour mode, accent, fonts, radius, camera,
 * pace, and aspect ratio. Tokens are applied with CSSOM (style.setProperty),
 * never string-built CSS.
 */

import { clamp, isHexColor, isObject } from './util.js';

export const MODES = ['dark', 'light', 'auto'];

/** "auto" is 16:9 on wide players and 4:5 on narrow ones (phones). */
export const ASPECTS = ['auto', '16:9', '4:5', '1:1'];

export const DEFAULT_DESIGN = Object.freeze({
    mode: 'dark',
    accent: '#22d3ee',
    font: Object.freeze({ ui: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', mono: '"JetBrains Mono", ui-monospace, Menlo, monospace' }),
    radius: 12,
    camera: Object.freeze({ zoom: 1.35, speed: 1 }),
    pace: 1,
    aspect: 'auto',
    intro: true,
    subtitles: true,
    endcard: true
});

export const LIMITS = Object.freeze({
    radius: [0, 24],
    zoom: [1, 2.5],
    speed: [0.25, 3],
    pace: [0.25, 3]
});

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
            speed: number(camera.speed, DEFAULT_DESIGN.camera.speed, LIMITS.speed)
        },
        pace: number(d.pace, DEFAULT_DESIGN.pace, LIMITS.pace),
        aspect: ASPECTS.includes(d.aspect) ? d.aspect : DEFAULT_DESIGN.aspect,
        intro: d.intro !== false,
        subtitles: d.subtitles !== false,
        endcard: d.endcard !== false
    };
}

/** Apply design tokens to the player root element ("auto" mode is resolved by the player). */
export function applyDesign(root, design) {
    root.dataset.mode = design.mode === 'auto' ? 'dark' : design.mode;
    root.dataset.aspect = design.aspect;
    const tokens = {
        '--cs-accent': design.accent,
        '--cs-font-ui': design.font.ui,
        '--cs-font-mono': design.font.mono,
        '--cs-radius': `${design.radius}px`
    };
    if (design.aspect !== 'auto') tokens['--cs-aspect'] = design.aspect.replace(':', ' / ');
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}
