/**
 * Screen layouts. Rects are in world units (1600×900). A screen's own
 * "place" (a slot name or an explicit rect) always wins over the layout.
 * DOM-free, so the validator can use it.
 */

const TOP = 92;
const HEIGHT = 650;
const GAP = 46;

export const LAYOUTS = ['row', 'stage', 'desktop'];

/** Named positions a screen can take with "place". */
export const SLOTS = Object.freeze({
    left: { x: 60, y: TOP, w: 460, h: HEIGHT },
    center: { x: 570, y: TOP, w: 460, h: HEIGHT },
    right: { x: 1080, y: TOP, w: 460, h: HEIGHT },
    'wide-left': { x: 60, y: TOP, w: 900, h: HEIGHT },
    'wide-right': { x: 640, y: TOP, w: 900, h: HEIGHT },
    full: { x: 180, y: TOP, w: 1240, h: HEIGHT },
    pip: { x: 1060, y: 452, w: 480, h: 300 },
    'pip-left': { x: 60, y: 452, w: 480, h: 300 }
});

const widthOf = entry => entry.def.width ?? entry.surface.width;

/** Side by side, centred, in clip order. Hidden screens keep their place. */
function row(entries, world) {
    const widths = entries.map(widthOf);
    const total = widths.reduce((sum, width) => sum + width, 0) + GAP * (entries.length - 1);
    const scale = total > world.width - 80 ? (world.width - 80) / total : 1;
    let x = (world.width - total * scale) / 2;
    const layout = {};
    entries.forEach((entry, i) => {
        const w = Math.round(widths[i] * scale);
        layout[entry.key] = { x: Math.round(x), y: TOP, w, h: HEIGHT };
        x += w + GAP * scale;
    });
    return layout;
}

/** Every screen centre stage at a large size; show them one at a time with enter/exit. */
function stage(entries, world) {
    const layout = {};
    for (const entry of entries) {
        const w = Math.min(world.width - 120, entry.def.width ?? Math.round(widthOf(entry) * 2));
        layout[entry.key] = { x: Math.round((world.width - w) / 2), y: TOP, w, h: HEIGHT };
    }
    return layout;
}

/** Overlapping windows cascading down and to the right, like a desktop. */
function desktop(entries, world) {
    const layout = {};
    const step = { x: 120, y: 44 };
    const count = entries.length;
    const widths = entries.map(entry => Math.min(world.width - 160 - step.x * (count - 1), entry.def.width ?? Math.round(widthOf(entry) * 1.55)));
    const base = (world.width - (Math.max(...widths) + step.x * (count - 1))) / 2;
    const h = HEIGHT - step.y * (count - 1);
    entries.forEach((entry, i) => {
        layout[entry.key] = { x: Math.round(base + step.x * i), y: TOP + step.y * i, w: widths[i], h };
    });
    return layout;
}

const BUILDERS = { row, stage, desktop };

/**
 * Lay out screens.
 * @param {string} mode one of LAYOUTS
 * @param {Array<{key: string, def: object, surface: object}>} entries in clip order
 * @param {{width: number, height: number}} world
 */
export function layoutFor(mode, entries, world) {
    const layout = (BUILDERS[mode] ?? row)(entries, world);
    for (const entry of entries) {
        const { place } = entry.def;
        if (typeof place === 'string' && Object.prototype.hasOwnProperty.call(SLOTS, place)) layout[entry.key] = { ...SLOTS[place] };
        else if (place && typeof place === 'object') layout[entry.key] = { x: place.x, y: place.y, w: place.w, h: place.h };
    }
    return layout;
}
