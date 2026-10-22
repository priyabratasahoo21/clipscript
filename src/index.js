/**
 * clipscript — product films for software, written as data.
 *
 * Browser: importing this module defines <clip-script>.
 * Node: safe to import for validation (no DOM is touched until a film plays).
 */

import { catalog, registerSurface, registerTemplate } from './core/registry.js';
import aiChat from './surfaces/ai-chat.js';
import browserApp from './surfaces/browser-app.js';
import crmRecord from './surfaces/crm-record.js';
import flowCanvas from './surfaces/flow-canvas.js';
import teamChat from './surfaces/team-chat.js';
import assistantConnector from './templates/assistant-connector.js';
import triggerAutomationNotify from './templates/trigger-automation-notify.js';
import { defineElement } from './core/element.js';

for (const surface of [crmRecord, flowCanvas, teamChat, aiChat, browserApp]) registerSurface(surface);
for (const template of [triggerAutomationNotify, assistantConnector]) registerTemplate(template);

export { VERSION as version, WORLD } from './core/constants.js';
export { ASPECTS, DEFAULT_DESIGN, MODES, resolveDesign } from './core/design.js';
export { FORMAT_VERSION, formatReport, validateClip as validate } from './core/validate.js';
export { GENERIC_ACTIONS, DIRECTIONS } from './core/steps.js';
export { LAYOUTS, SLOTS, layoutFor } from './templates/layouts.js';
export { frameFor } from './core/camera.js';
export { Player } from './core/player.js';
export { h, richText, s } from './core/dom.js';
export { catalog, defineElement, registerSurface, registerTemplate };

/**
 * Add a film to any container from JavaScript.
 * @param {Element} target  where to add the player
 * @param {object|string} clip  a clip object, or a URL to a .clip.json file
 * @param {{autoplay?: 'view'|'none', controls?: boolean, chapter?: number, mode?: 'dark'|'light'|'auto', endcard?: boolean, reducedMotion?: boolean, tagName?: string}} [options]
 * @returns {HTMLElement} the <clip-script> element (has play, pause, replay, goTo)
 */
export function mount(target, clip, options = {}) {
    const tagName = options.tagName ?? 'clip-script';
    defineElement(tagName);
    const element = document.createElement(tagName);
    if (options.autoplay === 'none') element.setAttribute('autoplay', 'none');
    if (options.controls === false) element.setAttribute('controls', 'none');
    if (options.endcard === false) element.setAttribute('endcard', 'none');
    if (options.reducedMotion) element.setAttribute('reduced-motion', '');
    if (Number.isInteger(options.chapter)) element.setAttribute('chapter', String(options.chapter));
    if (options.mode) element.setAttribute('mode', options.mode);
    if (typeof clip === 'string') element.setAttribute('src', clip);
    else element.clip = clip;
    target.append(element);
    return element;
}

if (typeof window !== 'undefined') defineElement();
