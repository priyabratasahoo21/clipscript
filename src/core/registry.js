/**
 * Registries for surfaces (app screens) and templates (story patterns).
 * Built-ins register themselves from src/index.js; apps can add their own.
 */

import { GENERIC_ACTIONS } from './steps.js';
import { LAYOUTS } from '../templates/layouts.js';

const surfaces = new Map();
const templates = new Map();

function assertName(kind, name) {
    if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)) {
        throw new TypeError(`${kind} name must be lowercase kebab-case, got ${JSON.stringify(name)}`);
    }
}

/**
 * Register a surface: an app screen that clips can place and act on.
 * @param {import('../../index').SurfaceDefinition} definition
 */
export function registerSurface(definition) {
    assertName('Surface', definition?.name);
    if (typeof definition.render !== 'function') throw new TypeError(`Surface "${definition.name}" needs a render() function`);
    // a step's built-in action wins, so an action with a built-in name could never run
    const clash = Object.keys(definition.actions ?? {}).find(action => GENERIC_ACTIONS.includes(action));
    if (clash) throw new TypeError(`Surface "${definition.name}": "${clash}" is a built-in step (${GENERIC_ACTIONS.join(', ')}); give the action another name`);
    surfaces.set(definition.name, { parts: {}, actions: {}, width: 460, ...definition });
}

/**
 * Register a template: a story pattern with a layout and rules.
 * @param {import('../../index').TemplateDefinition} definition
 */
export function registerTemplate(definition) {
    assertName('Template', definition?.name);
    if (definition.layout !== undefined && typeof definition.layout !== 'function' && !LAYOUTS.includes(definition.layout)) {
        throw new TypeError(`Template "${definition.name}" layout must be a function or one of ${LAYOUTS.join(', ')}`);
    }
    templates.set(definition.name, { requires: [], layout: 'row', ...definition });
}

/** CSS contributed by registered surfaces, appended to the player's stylesheet. */
export const surfaceStyles = () => [...surfaces.values()].map(surface => surface.styles ?? '').join('\n');

export const getSurface = name => surfaces.get(name);
export const getTemplate = name => templates.get(name);
export const surfaceNames = () => [...surfaces.keys()];
export const templateNames = () => [...templates.keys()];

/** Describe what's registered (used by the CLI and the AI guide). */
export function catalog() {
    return {
        templates: [...templates.values()].map(t => ({ name: t.name, title: t.title, summary: t.summary, requires: t.requires })),
        surfaces: [...surfaces.values()].map(sf => ({
            name: sf.name,
            summary: sf.summary,
            parts: Object.keys(sf.parts),
            actions: Object.entries(sf.actions).map(([name, action]) => ({ name, summary: action.summary, keys: action.keys ?? [] }))
        }))
    };
}
