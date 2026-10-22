/**
 * Window chrome shared by the built-in surfaces.
 */

import { h } from '../core/dom.js';
import { initials } from '../core/util.js';

/** Square monogram for an app (uses the window's --app colour unless given). */
export function appIcon(app, color) {
    return h('span', {
        class: 'cs-appicon',
        style: color ? { '--app': color } : undefined,
        text: app?.icon ?? initials(app?.name ?? '?')
    });
}

/**
 * An app window: brand bar (icon, app name, title, trailing content) and a body.
 * @returns {{el: HTMLElement, body: HTMLElement}}
 */
export function appWindow(app, { title, trailing, className }) {
    const body = h('div', { class: 'cs-body' });
    const el = h('div', { class: `cs-window ${className}` }, [
        h('div', { class: 'cs-appbar' }, [
            appIcon(app),
            h('span', { class: 'cs-appname', text: app.name }),
            title ? h('span', { class: 'cs-apptitle', text: title }) : null,
            trailing ? h('span', { class: 'cs-apptrail' }, trailing) : null
        ]),
        body
    ]);
    return { el, body };
}

/** Find a child whose data attribute equals a value (no CSS-escaping needed). */
export const byData = (root, attribute, value) => [...root.querySelectorAll(`[data-${attribute}]`)]
    .find(node => node.dataset[attribute] === value) ?? null;

/** Type text into an element one character at a time. */
export async function typeInto(el, text, ctx, msPerChar = 28) {
    if (ctx.fast) {
        el.textContent = text;
        return;
    }
    el.textContent = '';
    for (const char of text) {
        el.textContent += char;
        await ctx.wait(msPerChar);
    }
}
