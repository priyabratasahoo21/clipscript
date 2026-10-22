/**
 * Validate a clip and report problems in a form an AI author can act on:
 * a JSON path, a plain-English message, and a hint (often "did you mean …?").
 * DOM-free, so the CLI can use it in Node.
 */

import { ACTOR_KEYS, FINISHES, LEAVE_EFFECTS, MAX_BOUNCES, MAX_PIECES, PATHS, SHAPES, SPAWN_EFFECTS } from './actors.js';
import { ASPECTS, LIMITS, MODES, resolveBackdrop } from './design.js';
import { getSurface, getTemplate, surfaceNames, templateNames } from './registry.js';
import { DIRECTIONS, GENERIC_ACTIONS, GENERIC_KEYS, SCREEN_ACTIONS, SURFACE_STEP_KEYS, actionOf, resolveStepScreen } from './steps.js';
import { EASE_NAMES } from './timeline.js';
import { LAYOUTS, SLOTS } from '../templates/layouts.js';
import { hasOwn, isHexColor, isObject, parseSelector, suggest } from './util.js';

export const FORMAT_VERSION = '1';
const MAX_CHAPTERS = 12;
const TOP_KEYS = ['$schema', 'cueflick', 'title', 'template', 'layout', 'disclaimer', 'story', 'design', 'screens', 'actors', 'chapters'];
const STORY_KEYS = ['overview', 'description', 'audience', 'workflow'];
const DESIGN_KEYS = ['mode', 'accent', 'font', 'radius', 'camera', 'pace', 'aspect', 'intro', 'subtitles', 'endcard', 'cursor', 'backdrop'];
const CHAPTER_KEYS = ['title', 'narration', 'focus', 'zoom', 'duration', 'ease', 'async', 'backdrop', 'steps'];
const CAMERA_KEYS = ['zoom', 'speed', 'ease', 'punch', 'follow'];
const APP_KEYS = ['name', 'color', 'icon'];
const SCREEN_COMMON_KEYS = ['surface', 'app', 'hidden', 'place', 'width', 'mode'];
const SCREEN_MODES = ['light', 'dark'];
const FONT_PATTERN = /^[\w\s,'"-]+$/;

class Report {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    error(path, message, hint) {
        this.errors.push(hint ? { path, message, hint } : { path, message });
    }

    warn(path, message, hint) {
        this.warnings.push(hint ? { path, message, hint } : { path, message });
    }
}

const requireString = (report, value, path) => {
    if (typeof value !== 'string' || !value.trim()) {
        report.error(path, 'must be a non-empty string.');
        return false;
    }
    return true;
};

const optionalString = (report, value, path) => {
    if (value !== undefined && typeof value !== 'string') report.error(path, 'must be a string.');
};

function checkRange(report, value, path, [min, max]) {
    if (value === undefined) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) report.error(path, 'must be a number.');
    else if (value < min || value > max) report.warn(path, `is outside ${min}–${max}; it will be clamped.`);
}

/** duration, ease, and async on a camera move or a screen effect. */
function checkMotion(report, owner, path) {
    if (owner.duration !== undefined) checkRange(report, owner.duration, `${path}.duration`, LIMITS.duration);
    if (owner.ease !== undefined && !EASE_NAMES.includes(owner.ease)) {
        report.error(`${path}.ease`, `must be one of ${EASE_NAMES.join(', ')}.`, suggest(owner.ease, EASE_NAMES));
    }
    if (owner.async !== undefined && typeof owner.async !== 'boolean') report.error(`${path}.async`, 'must be true or false.');
}

function checkPunch(report, value, path) {
    if (value === undefined || typeof value === 'boolean') return;
    if (typeof value === 'number') {
        checkRange(report, value, path, LIMITS.punchAmount);
        return;
    }
    if (!isObject(value)) {
        report.error(path, 'must be true, false, a zoom amount like 1.3, or { "amount": 1.3, "hold": 800 }.');
        return;
    }
    checkUnknownKeys(report, value, ['amount', 'hold'], path);
    checkRange(report, value.amount, `${path}.amount`, LIMITS.punchAmount);
    checkRange(report, value.hold, `${path}.hold`, LIMITS.punchHold);
}

/** Warn about keys a section doesn't use, usually typos. */
function checkUnknownKeys(report, object, allowed, path) {
    for (const key of Object.keys(object)) {
        if (allowed.includes(key)) continue;
        report.warn(path ? `${path}.${key}` : key, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, allowed));
    }
}

function checkStory(report, story) {
    if (!isObject(story)) {
        report.error('story', 'is required: an object with at least "overview".', 'Add "story": { "overview": "One sentence on what this film shows." }');
        return;
    }
    checkUnknownKeys(report, story, STORY_KEYS, 'story');
    if (requireString(report, story.overview, 'story.overview') && story.overview.length > 220) {
        report.warn('story.overview', 'is long; keep the overview to one or two sentences (under 220 characters).');
    }
    optionalString(report, story.description, 'story.description');
    optionalString(report, story.audience, 'story.audience');
    if (story.workflow !== undefined && (!Array.isArray(story.workflow) || story.workflow.some(item => typeof item !== 'string'))) {
        report.error('story.workflow', 'must be an array of strings, one per workflow step.');
    }
}

function checkDesign(report, design) {
    if (design === undefined) return;
    if (!isObject(design)) {
        report.error('design', 'must be an object.');
        return;
    }
    checkUnknownKeys(report, design, DESIGN_KEYS, 'design');
    if (design.mode !== undefined && !MODES.includes(design.mode)) {
        report.error('design.mode', `must be one of ${MODES.join(', ')}.`, suggest(design.mode, MODES));
    }
    if (design.aspect !== undefined && !ASPECTS.includes(design.aspect)) {
        report.error('design.aspect', `must be one of ${ASPECTS.join(', ')}.`, suggest(design.aspect, ASPECTS));
    }
    if (design.accent !== undefined && !isHexColor(design.accent)) report.error('design.accent', 'must be a hex colour like "#22d3ee".');
    if (design.font !== undefined) {
        if (!isObject(design.font)) report.error('design.font', 'must be an object like { "ui": "Inter", "mono": "JetBrains Mono" }.');
        else {
            checkUnknownKeys(report, design.font, ['ui', 'mono'], 'design.font');
            for (const key of ['ui', 'mono']) {
                const value = design.font[key];
                if (value !== undefined && (typeof value !== 'string' || !FONT_PATTERN.test(value))) {
                    report.error(`design.font.${key}`, 'must be a font-family list using letters, digits, spaces, commas, quotes, and hyphens.');
                }
            }
        }
    }
    checkRange(report, design.radius, 'design.radius', LIMITS.radius);
    checkRange(report, design.pace, 'design.pace', LIMITS.pace);
    if (design.camera !== undefined) {
        if (!isObject(design.camera)) report.error('design.camera', 'must be an object like { "zoom": 1.35, "speed": 1 }.');
        else {
            checkUnknownKeys(report, design.camera, CAMERA_KEYS, 'design.camera');
            checkRange(report, design.camera.zoom, 'design.camera.zoom', LIMITS.zoom);
            checkRange(report, design.camera.speed, 'design.camera.speed', LIMITS.speed);
            if (design.camera.ease !== undefined && !EASE_NAMES.includes(design.camera.ease)) {
                report.error('design.camera.ease', `must be one of ${EASE_NAMES.join(', ')}.`, suggest(design.camera.ease, EASE_NAMES));
            }
            checkPunch(report, design.camera.punch, 'design.camera.punch');
            if (design.camera.follow !== undefined && typeof design.camera.follow !== 'boolean') report.error('design.camera.follow', 'must be true or false.');
        }
    }
    for (const flag of ['intro', 'subtitles', 'endcard', 'cursor']) {
        if (design[flag] !== undefined && typeof design[flag] !== 'boolean') report.error(`design.${flag}`, 'must be true or false.');
    }
    if (design.backdrop !== undefined) checkBackdrop(report, design.backdrop, 'design.backdrop');
}

function checkBackdrop(report, value, path) {
    if (!resolveBackdrop(value)) report.error(path, 'must be a hex colour, or two for a gradient, e.g. ["#130046", "#2e0b85"].');
}

const isPoint = value => isObject(value) && ['x', 'y'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));

/** Actors: shapes that move like characters. Returns id → { count } for the valid ones. */
function checkActors(report, actors, screens) {
    const valid = Object.create(null);
    if (actors === undefined) return valid;
    if (!isObject(actors)) {
        report.error('actors', 'must be an object of actors keyed by id, e.g. { "sunny": { "shape": "sphere", "color": "#ffc83d" } }.');
        return valid;
    }
    for (const [id, def] of Object.entries(actors)) {
        const path = `actors.${id}`;
        if (!/^[A-Za-z_][\w-]*$/.test(id)) {
            report.error(path, 'actor ids may use letters, digits, "_" and "-" only.');
            continue;
        }
        if (hasOwn(screens, id)) {
            report.error(path, `"${id}" is also a screen id; give the actor its own name.`);
            continue;
        }
        if (!isObject(def)) {
            report.error(path, 'must be an object like { "shape": "sphere", "color": "#ffc83d", "size": 120 }.');
            continue;
        }
        checkUnknownKeys(report, def, ACTOR_KEYS, path);
        if (def.shape !== undefined && !SHAPES.includes(def.shape)) report.error(`${path}.shape`, `must be one of ${SHAPES.join(', ')}.`, suggest(def.shape, SHAPES));
        if (def.color !== undefined && !isHexColor(def.color)) report.error(`${path}.color`, 'must be a hex colour.');
        if (def.colors !== undefined && !(Array.isArray(def.colors) && def.colors.length > 0 && def.colors.every(isHexColor))) {
            report.error(`${path}.colors`, 'must be an array of hex colours, one per piece (they repeat).');
        }
        checkRange(report, def.size, `${path}.size`, [16, 600]);
        checkRange(report, def.squash, `${path}.squash`, [0, 2]);
        if (def.finish !== undefined && !FINISHES.includes(def.finish)) report.error(`${path}.finish`, `must be one of ${FINISHES.join(', ')}.`, suggest(def.finish, FINISHES));
        const count = def.count ?? 1;
        if (!Number.isInteger(count) || count < 1 || count > MAX_PIECES) report.error(`${path}.count`, `must be a whole number from 1 to ${MAX_PIECES}.`);
        if (def.columns !== undefined && (!Number.isInteger(def.columns) || def.columns < 1)) report.error(`${path}.columns`, 'must be a whole number of 1 or more.');
        if (def.gap !== undefined && (typeof def.gap !== 'number' || def.gap < 0)) report.error(`${path}.gap`, 'must be a distance in world units (0 or more).');
        optionalString(report, def.label, `${path}.label`);
        if (def.labels !== undefined && !(Array.isArray(def.labels) && def.labels.every(label => typeof label === 'string'))) {
            report.error(`${path}.labels`, 'must be an array of short labels, one per piece.');
        } else if (Array.isArray(def.labels) && def.labels.length > count) {
            report.warn(`${path}.labels`, `has more labels than pieces (${count}); raise "count" or drop some labels.`);
        }
        if (def.at !== undefined && !isPoint(def.at)) report.error(`${path}.at`, 'must be a world point { "x": 800, "y": 450 } (the world is 1600×900).');
        valid[id] = { count: Number.isInteger(count) ? count : 1 };
    }
    return valid;
}

/** An actor target: "sunny", or one piece of a group, "tiles.piece:2". */
function checkActorTarget(report, parsed, path, actors) {
    if (!parsed.part) return { ...parsed, actor: true };
    const { count } = actors[parsed.screen];
    if (parsed.part !== 'piece') {
        report.error(path, `actors only have "piece" parts, e.g. "${parsed.screen}.piece:0".`, suggest(parsed.part, ['piece']));
        return null;
    }
    const index = Number(parsed.name);
    if (!Number.isInteger(index) || index < 0 || index >= count) {
        report.error(path, `"${parsed.screen}" has pieces 0 to ${count - 1}.`);
        return null;
    }
    return { ...parsed, actor: true };
}

/** Actor ids named by a step: one id, or (unless `single`) an array of them. */
function checkActorIds(report, value, path, stage, { single = false } = {}) {
    const ids = single ? [value] : [value].flat();
    if (!ids.length || ids.some(id => typeof id !== 'string')) {
        report.error(path, single ? 'must be an actor id.' : 'must be an actor id or an array of actor ids.');
        return [];
    }
    const known = Object.keys(stage.actorDefs);
    return ids.filter(id => {
        if (hasOwn(stage.actorDefs, id)) return true;
        report.error(path, `"${id}" isn't an actor.`, suggest(id, known) ?? (known.length ? `Actors: ${known.join(', ')}.` : 'Define it under "actors" at the top of the clip.'));
        return false;
    });
}

/** How many times a landing rebounds, and how high each rebound goes compared with the last. */
function checkBounce(report, step, path) {
    if (step.bounces !== undefined && (!Number.isInteger(step.bounces) || step.bounces < 0 || step.bounces > MAX_BOUNCES)) {
        report.error(`${path}.bounces`, `must be a whole number from 0 to ${MAX_BOUNCES}.`);
    }
    checkRange(report, step.bounciness, `${path}.bounciness`, [0.1, 0.8]);
}

/** Where an actor goes: a target (optionally perched on top) or a world point, nudged by "offset". */
function checkSpot(report, step, key, path, screens, stage) {
    const value = step[key];
    if (typeof value === 'string') checkSelector(report, value, `${path}.${key}`, screens, { actors: stage.actorDefs });
    else if (!isPoint(value)) report.error(`${path}.${key}`, 'must be a target like "phone.area:pool" or a world point { "x": 800, "y": 450 }.');
    if (step.perch !== undefined && typeof step.perch !== 'boolean') report.error(`${path}.perch`, 'must be true or false.');
    if (step.offset !== undefined && !isPoint(step.offset)) report.error(`${path}.offset`, 'must be { "x": 0, "y": -20 } in world units.');
}

function checkApp(report, app, path) {
    if (!isObject(app)) {
        report.error(path, 'is required: { "name": "...", "color": "#hex", "icon": "AB" }.');
        return;
    }
    checkUnknownKeys(report, app, APP_KEYS, path);
    requireString(report, app.name, `${path}.name`);
    if (app.color !== undefined && !isHexColor(app.color)) report.error(`${path}.color`, 'must be a hex colour like "#4f7cff".');
    if (app.icon !== undefined && (typeof app.icon !== 'string' || app.icon.length > 4)) {
        report.error(`${path}.icon`, 'must be 1–4 characters (a monogram such as "SA").');
    }
}

function checkPlacement(report, screen, path) {
    if (screen.hidden !== undefined && typeof screen.hidden !== 'boolean') report.error(`${path}.hidden`, 'must be true or false.');
    if (screen.mode !== undefined && !SCREEN_MODES.includes(screen.mode)) {
        report.error(`${path}.mode`, 'must be "light" or "dark" (overrides design.mode for this screen).', suggest(screen.mode, SCREEN_MODES));
    }
    if (screen.width !== undefined && (typeof screen.width !== 'number' || screen.width < 200 || screen.width > 1500)) {
        report.error(`${path}.width`, 'must be a width in world units between 200 and 1500.');
    }
    const { place } = screen;
    if (place === undefined) return;
    if (typeof place === 'string') {
        if (!hasOwn(SLOTS, place)) report.error(`${path}.place`, `"${place}" isn't a slot. Slots: ${Object.keys(SLOTS).join(', ')}.`, suggest(place, Object.keys(SLOTS)));
        return;
    }
    if (!isObject(place) || ['x', 'y', 'w', 'h'].some(key => typeof place[key] !== 'number' || !Number.isFinite(place[key]))) {
        report.error(`${path}.place`, 'must be a slot name or { "x", "y", "w", "h" } in world units (1600×900).');
    } else if (place.w < 120 || place.h < 120 || place.x + place.w < 0 || place.y + place.h < 0 || place.x > 1600 || place.y > 900) {
        report.warn(`${path}.place`, 'is mostly outside the 1600×900 world or very small.');
    }
}

function checkScreens(report, screens) {
    if (!isObject(screens) || Object.keys(screens).length === 0) {
        report.error('screens', 'is required: an object of screens keyed by a short id, e.g. { "crm": {...}, "flow": {...} }.');
        return {};
    }
    const resolved = {};
    for (const [key, screen] of Object.entries(screens)) {
        const path = `screens.${key}`;
        if (!/^[A-Za-z_][\w-]*$/.test(key)) report.error(path, 'screen ids may use letters, digits, "_" and "-" only.');
        if (!isObject(screen)) {
            report.error(path, 'must be an object.');
            continue;
        }
        const surface = getSurface(screen.surface);
        if (!surface) {
            report.error(`${path}.surface`, `"${screen.surface}" is not a known surface. Known: ${surfaceNames().join(', ')}.`, suggest(screen.surface, surfaceNames()));
            continue;
        }
        checkApp(report, screen.app, `${path}.app`);
        checkPlacement(report, screen, path);
        checkUnknownKeys(report, screen, [...SCREEN_COMMON_KEYS, ...(surface.keys ?? [])], path);
        surface.validate?.(screen, path, report, screens);
        resolved[key] = { def: screen, surface };
    }
    return resolved;
}

/** Resolve a selector to a screen (and optional part), reporting problems. */
function checkSelector(report, selector, path, screens, { allowAll = false, part: requiredPart, actors } = {}) {
    if (allowAll && selector === 'all') return { all: true };
    const parsed = parseSelector(selector);
    if (!parsed) {
        report.error(path, `"${selector}" is not a valid target. Use "screen" or "screen.part:name", e.g. "crm.field:Stage".`);
        return null;
    }
    if (actors && !requiredPart && !hasOwn(screens, parsed.screen) && hasOwn(actors, parsed.screen)) return checkActorTarget(report, parsed, path, actors);
    const keys = Object.keys(screens);
    if (!hasOwn(screens, parsed.screen)) {
        const known = actors ? [...keys, ...Object.keys(actors)] : keys;
        const what = actors && Object.keys(actors).length ? 'a screen or an actor' : 'defined in "screens"';
        report.error(path, `"${parsed.screen}" is not ${what}.`, suggest(parsed.screen, known) ?? `Defined: ${known.join(', ')}.`);
        return null;
    }
    const screen = screens[parsed.screen];
    if (requiredPart && parsed.part !== requiredPart) {
        report.error(path, `needs a "${requiredPart}" target like "${parsed.screen}.${requiredPart}:<name>".`);
        return null;
    }
    if (parsed.part) {
        const parts = Object.keys(screen.surface.parts);
        if (!hasOwn(screen.surface.parts, parsed.part)) {
            report.error(path, `${screen.def.surface} screens have no "${parsed.part}" parts. Parts: ${parts.join(', ') || 'none'}.`, suggest(parsed.part, parts));
            return null;
        }
        const names = screen.surface.parts[parsed.part](screen.def);
        if (!names.includes(parsed.name)) {
            report.error(path, `${parsed.part} "${parsed.name}" isn't on screen "${parsed.screen}". Available: ${names.join(', ')}.`, suggest(parsed.name, names));
            return null;
        }
    }
    return parsed;
}

function checkScreenId(report, value, path, screens) {
    if (typeof value !== 'string' || !hasOwn(screens, value)) {
        report.error(path, `must be a screen id. Defined screens: ${Object.keys(screens).join(', ')}.`, typeof value === 'string' ? suggest(value, Object.keys(screens)) : undefined);
        return false;
    }
    return true;
}

/** Simulates which screens are on stage and what has happened, to catch steps in the wrong order. */
class StageState {
    constructor(screens, actorDefs = Object.create(null)) {
        this.actorDefs = actorDefs;
        this.actors = new Set();
        this.visible = new Set(Object.keys(screens).filter(key => screens[key].def.hidden !== true));
        this.facts = new Map();
        for (const [key, { def }] of Object.entries(screens)) {
            this.facts.set(key, { messages: Array.isArray(def.history) ? def.history.length : 0, opened: false });
        }
    }
}

function checkGenericStep(report, step, action, path, screens, stage) {
    const value = step[action];
    if (action === 'focus') {
        const parsed = checkSelector(report, value, `${path}.focus`, screens, { allowAll: true, actors: stage.actorDefs });
        if (parsed?.screen && !parsed.actor && !stage.visible.has(parsed.screen)) report.warn(`${path}.focus`, `the camera points at "${parsed.screen}" while it's off stage; add an "enter" step first.`);
        checkRange(report, step.zoom, `${path}.zoom`, LIMITS.zoom);
        checkMotion(report, step, path);
    } else if (action === 'pan') {
        if (typeof value === 'string') checkSelector(report, value, `${path}.pan`, screens, { actors: stage.actorDefs });
        else if (!isObject(value) || ['x', 'y'].some(key => value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key])))) {
            report.error(`${path}.pan`, 'must be a target like "books.row:1042", or an offset { "x": 300, "y": 0 } in world units.');
        }
        checkMotion(report, step, path);
    } else if (action === 'dive') {
        checkSelector(report, value, `${path}.dive`, screens, { actors: stage.actorDefs });
        checkMotion(report, step, path);
        if (step.into !== undefined) checkBackdrop(report, step.into, `${path}.into`);
    } else if (action === 'blur') {
        if (value !== false) {
            const parsed = checkSelector(report, value, `${path}.blur`, screens, { actors: stage.actorDefs });
            if (parsed?.part) report.error(`${path}.blur`, 'keeps a whole screen or actor sharp; use "phone", not a part. Use false to clear the blur.');
        }
        checkRange(report, step.amount, `${path}.amount`, [1, 24]);
    } else if (action === 'caption') {
        if (requireString(report, value, `${path}.caption`) && value.length > 90) report.warn(`${path}.caption`, 'is long for a subtitle; keep it under 90 characters.');
    } else if (action === 'wait') {
        if (typeof value !== 'number' || value < 0 || value > 10000) report.error(`${path}.wait`, 'must be milliseconds between 0 and 10000.');
    } else if (action === 'packet') {
        if (!isObject(value)) report.error(`${path}.packet`, 'must be { "from": "<target>", "to": "<target>" }.');
        else {
            for (const end of ['from', 'to']) {
                const parsed = checkSelector(report, value[end], `${path}.packet.${end}`, screens);
                if (parsed && !stage.visible.has(parsed.screen)) report.warn(`${path}.packet.${end}`, `"${parsed.screen}" is off stage at this point.`);
            }
        }
    } else if (SCREEN_ACTIONS.includes(action)) {
        if (!checkScreenId(report, value, `${path}.${action}`, screens)) return;
        if (action !== 'front') checkMotion(report, step, path);
        if (action === 'enter') {
            if (step.from !== undefined && !DIRECTIONS.includes(step.from)) report.error(`${path}.from`, `must be one of ${DIRECTIONS.join(', ')}.`, suggest(step.from, DIRECTIONS));
            if (stage.visible.has(value)) report.warn(`${path}.enter`, `"${value}" is already on stage; give it "hidden": true or remove this step.`);
            stage.visible.add(value);
        } else if (action === 'exit') {
            if (step.to !== undefined && !DIRECTIONS.includes(step.to)) report.error(`${path}.to`, `must be one of ${DIRECTIONS.join(', ')}.`, suggest(step.to, DIRECTIONS));
            if (!stage.visible.has(value)) report.warn(`${path}.exit`, `"${value}" isn't on stage here.`);
            stage.visible.delete(value);
        } else {
            if (step.dim !== undefined && typeof step.dim !== 'boolean') report.error(`${path}.dim`, 'must be true or false.');
            if (!stage.visible.has(value)) report.warn(`${path}.front`, `"${value}" is off stage; "enter" it first.`);
        }
    } else if (action === 'spawn') {
        const ids = checkActorIds(report, value, `${path}.spawn`, stage);
        if (step.effect !== undefined && !SPAWN_EFFECTS.includes(step.effect)) report.error(`${path}.effect`, `must be one of ${SPAWN_EFFECTS.join(', ')}.`, suggest(step.effect, SPAWN_EFFECTS));
        if (step.stagger !== undefined && (typeof step.stagger !== 'number' || step.stagger < 0 || step.stagger > 2000)) report.error(`${path}.stagger`, 'must be milliseconds between 0 and 2000.');
        if (step.at !== undefined) checkSpot(report, step, 'at', path, screens, stage);
        checkBounce(report, step, path);
        for (const id of ids) {
            if (stage.actors.has(id)) report.warn(`${path}.spawn`, `"${id}" is already on stage; "leave" it first or remove this step.`);
            stage.actors.add(id);
        }
    } else if (action === 'leave') {
        const ids = checkActorIds(report, value, `${path}.leave`, stage);
        if (step.effect !== undefined && !LEAVE_EFFECTS.includes(step.effect)) report.error(`${path}.effect`, `must be one of ${LEAVE_EFFECTS.join(', ')}.`, suggest(step.effect, LEAVE_EFFECTS));
        for (const id of ids) {
            if (!stage.actors.has(id)) report.warn(`${path}.leave`, `"${id}" isn't on stage here; "spawn" it first.`);
            stage.actors.delete(id);
        }
    } else if (action === 'move') {
        const [id] = checkActorIds(report, value, `${path}.move`, stage, { single: true });
        if (step.to === undefined) report.error(`${path}.to`, 'is required: a target like "phone.area:pool" or a world point { "x": 800, "y": 450 }.');
        else checkSpot(report, step, 'to', path, screens, stage);
        if (step.path !== undefined && !PATHS.includes(step.path)) report.error(`${path}.path`, `must be one of ${PATHS.join(', ')}.`, suggest(step.path, PATHS));
        if (step.height !== undefined && (typeof step.height !== 'number' || step.height < 0)) report.error(`${path}.height`, 'must be the hop height in world units.');
        checkBounce(report, step, path);
        checkMotion(report, step, path);
        if (id && !stage.actors.has(id)) report.warn(`${path}.move`, `"${id}" isn't on stage yet; "spawn" it first.`);
    } else if (action === 'confetti') {
        if (typeof value === 'string') checkSelector(report, value, `${path}.confetti`, screens, { actors: stage.actorDefs });
        else if (!isPoint(value)) report.error(`${path}.confetti`, 'must be a target like "phone" or a world point { "x": 800, "y": 450 }.');
        checkRange(report, step.count, `${path}.count`, [10, 240]);
        checkRange(report, step.power, `${path}.power`, [0.3, 3]);
        if (step.colors !== undefined && !(Array.isArray(step.colors) && step.colors.length > 0 && step.colors.every(isHexColor))) report.error(`${path}.colors`, 'must be an array of hex colours.');
    } else if (action === 'backdrop') {
        checkBackdrop(report, value, `${path}.backdrop`);
    }
}

function checkSurfaceStep(report, step, action, path, screens, rawScreens, stage) {
    const target = resolveStepScreen(step, action, screens);
    if (target.error) {
        report.error(target.path ? `${path}.${target.path}` : path, target.error, target.candidates ? suggest(step.on, target.candidates) : undefined);
        return;
    }
    const { def, surface } = screens[target.key];
    const spec = surface.actions[action];
    if (spec.part) checkSelector(report, step[action], `${path}.${action}`, screens, { part: spec.part });
    spec.validate?.(step, def, path, report, rawScreens);
    checkUnknownKeys(report, step, [action, ...SURFACE_STEP_KEYS, ...(spec.keys ?? [])], path);
    checkPunch(report, step.punch, `${path}.punch`);
    if (!stage.visible.has(target.key)) report.warn(path, `"${action}" acts on "${target.key}" while it's off stage; add an "enter" step first.`);
    spec.order?.(stage.facts.get(target.key), step, path, report);
}

function actionNames(screens) {
    const names = new Set();
    for (const { surface } of Object.values(screens)) for (const name of Object.keys(surface.actions)) names.add(name);
    return names;
}

function checkStep(report, step, path, screens, rawScreens, names, stage) {
    if (!isObject(step)) {
        report.error(path, 'each step must be an object with one action, e.g. { "click": "crm.button:Save" }.');
        return;
    }
    const known = [...GENERIC_ACTIONS, ...names];
    const actions = Object.keys(step).filter(key => known.includes(key));
    if (actions.length === 0) {
        const first = Object.keys(step)[0];
        report.error(path, `step has no action. Use one of: ${known.join(', ')}.`, first ? suggest(first, known) : undefined);
        return;
    }
    if (actions.length > 1) {
        report.error(path, `step has more than one action (${actions.join(', ')}); split it into separate steps.`);
        return;
    }
    const action = actionOf(step, names);
    if (GENERIC_ACTIONS.includes(action)) {
        checkGenericStep(report, step, action, path, screens, stage);
        checkUnknownKeys(report, step, [action, ...GENERIC_KEYS[action]], path);
    } else {
        checkSurfaceStep(report, step, action, path, screens, rawScreens, stage);
    }
}

function checkChapters(report, chapters, screens, rawScreens, actorDefs) {
    if (!Array.isArray(chapters) || chapters.length === 0) {
        report.error('chapters', 'is required: an array of chapters, each with a title, narration, focus, and steps.');
        return;
    }
    if (chapters.length > MAX_CHAPTERS) report.warn('chapters', `has ${chapters.length} chapters; films read best with 3–6.`);
    const names = actionNames(screens);
    const stage = new StageState(screens, actorDefs);
    chapters.forEach((chapter, i) => {
        const path = `chapters[${i}]`;
        if (!isObject(chapter)) {
            report.error(path, 'must be an object.');
            return;
        }
        checkUnknownKeys(report, chapter, CHAPTER_KEYS, path);
        requireString(report, chapter.title, `${path}.title`);
        if (chapter.narration === undefined) report.warn(`${path}.narration`, 'is missing; narration is the script line shown as the subtitle.');
        else if (typeof chapter.narration !== 'string') report.error(`${path}.narration`, 'must be a string.');
        else if (chapter.narration.length > 140) report.warn(`${path}.narration`, 'is long for a subtitle; aim for one sentence under 140 characters.');
        if (chapter.focus !== undefined) {
            const parsed = checkSelector(report, chapter.focus, `${path}.focus`, screens, { allowAll: true, actors: actorDefs });
            if (parsed?.screen && !parsed.actor && !stage.visible.has(parsed.screen) && !enters(chapter, parsed.screen)) {
                report.warn(`${path}.focus`, `"${parsed.screen}" is off stage when this chapter starts.`);
            }
        }
        checkRange(report, chapter.zoom, `${path}.zoom`, LIMITS.zoom);
        checkMotion(report, chapter, path);
        if (chapter.backdrop !== undefined) checkBackdrop(report, chapter.backdrop, `${path}.backdrop`);
        if (!Array.isArray(chapter.steps) || chapter.steps.length === 0) {
            report.error(`${path}.steps`, 'must be a non-empty array of steps.');
            return;
        }
        chapter.steps.forEach((step, j) => checkStep(report, step, `${path}.steps[${j}]`, screens, rawScreens, names, stage));
    });
}

/** True when the chapter's first step brings this screen on stage. */
const enters = (chapter, key) => Array.isArray(chapter.steps) && isObject(chapter.steps[0]) && chapter.steps[0].enter === key;

/**
 * Validate a clip.
 * @param {unknown} clip
 * @returns {{ok: boolean, errors: Array<{path: string, message: string, hint?: string}>, warnings: Array<{path: string, message: string, hint?: string}>}}
 */
export function validateClip(clip) {
    const report = new Report();
    if (!isObject(clip)) {
        report.error('', 'A clip must be a JSON object.');
        return { ok: false, errors: report.errors, warnings: report.warnings };
    }
    checkUnknownKeys(report, clip, TOP_KEYS, '');
    if (clip.cueflick === undefined) report.warn('cueflick', `is missing; add "cueflick": "${FORMAT_VERSION}" so future versions can read this file.`);
    else if (clip.cueflick !== FORMAT_VERSION) report.error('cueflick', `format "${clip.cueflick}" isn't supported; this version reads "${FORMAT_VERSION}".`);

    requireString(report, clip.title, 'title');
    optionalString(report, clip.disclaimer, 'disclaimer');
    if (clip.layout !== undefined && !LAYOUTS.includes(clip.layout)) {
        report.error('layout', `must be one of ${LAYOUTS.join(', ')}.`, suggest(clip.layout, LAYOUTS));
    }
    checkStory(report, clip.story);
    checkDesign(report, clip.design);

    const template = typeof clip.template === 'string' ? getTemplate(clip.template) : undefined;
    if (!template) {
        report.error('template', `"${clip.template}" is not a known template. Known: ${templateNames().join(', ')}.`, suggest(clip.template, templateNames()));
    }
    const screens = checkScreens(report, clip.screens);
    if (template) {
        const present = new Set(Object.values(screens).map(screen => screen.def.surface));
        for (const needed of template.requires) {
            if (!present.has(needed)) report.error('screens', `template "${template.name}" needs a "${needed}" screen.`);
        }
        template.validate?.(clip, report);
    }
    const actors = checkActors(report, clip.actors, screens);
    checkChapters(report, clip.chapters, screens, isObject(clip.screens) ? clip.screens : {}, actors);
    return { ok: report.errors.length === 0, errors: report.errors, warnings: report.warnings };
}

/** Human- and AI-readable report text. */
export function formatReport(result, file = 'clip') {
    const lines = [];
    const entry = (mark, item) => {
        lines.push(`${mark} ${item.path || '(root)'}: ${item.message}`);
        if (item.hint) lines.push(`    hint: ${item.hint}`);
    };
    result.errors.forEach(item => entry('✗', item));
    result.warnings.forEach(item => entry('!', item));
    const summary = result.ok
        ? `✓ ${file} is valid${result.warnings.length ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})` : ''}.`
        : `✗ ${file} has ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}.`;
    return [...lines, summary].join('\n');
}
