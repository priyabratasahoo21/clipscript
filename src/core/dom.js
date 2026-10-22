/**
 * Safe DOM construction. Everything from a clip script is inserted as text,
 * never parsed as HTML, so a clip can't inject markup or script.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// URL attributes may only point at http(s), relative paths, or fragments
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);
const SAFE_URL = /^(?:https?:|\/|\.{0,2}\/|#|[^:]*$)/i;

function applyProps(el, props) {
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false) continue;
        if (/^on/i.test(key)) throw new TypeError(`h(): event-handler attribute "${key}" is not allowed; use addEventListener.`);
        if (URL_ATTRIBUTES.has(key.toLowerCase()) && !SAFE_URL.test(String(value).trim())) {
            throw new TypeError(`h(): unsafe URL in "${key}".`);
        }
        if (key === 'class') el.setAttribute('class', value);
        else if (key === 'text') el.textContent = String(value);
        else if (key === 'style') {
            for (const [property, styleValue] of Object.entries(value)) el.style.setProperty(property, String(styleValue));
        } else if (key === 'dataset') Object.assign(el.dataset, value);
        else el.setAttribute(key, value === true ? '' : String(value));
    }
}

function appendChildren(el, children) {
    for (const child of [children].flat(Infinity)) {
        if (child === undefined || child === null || child === false) continue;
        el.append(child instanceof Node ? child : String(child));
    }
}

/**
 * Create an HTML element.
 * @param {string} tag
 * @param {object} [props] class, text, style (CSSOM), dataset, or plain attributes
 * @param {Array|Node|string} [children]
 */
export function h(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    applyProps(el, props);
    appendChildren(el, children);
    return el;
}

/** Create an SVG element. */
export function s(tag, props = {}, children = []) {
    const el = document.createElementNS(SVG_NS, tag);
    applyProps(el, props);
    appendChildren(el, children);
    return el;
}

/** Light inline formatting as nodes: *bold*, `code`, and line breaks. */
export function richText(text) {
    const fragment = document.createDocumentFragment();
    for (const token of String(text ?? '').split(/(\*[^*\n]+\*|`[^`\n]+`|\n)/)) {
        if (!token) continue;
        if (token === '\n') fragment.append(h('br'));
        else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) fragment.append(h('b', { text: token.slice(1, -1) }));
        else if (token.startsWith('`') && token.endsWith('`') && token.length > 2) fragment.append(h('code', { text: token.slice(1, -1) }));
        else fragment.append(token);
    }
    return fragment;
}

/** Pretty-printed JSON with token classes, built from text nodes. */
export function jsonNodes(value) {
    const source = JSON.stringify(value, null, 2) ?? '';
    const fragment = document.createDocumentFragment();
    const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let last = 0;
    for (const match of source.matchAll(pattern)) {
        fragment.append(source.slice(last, match.index));
        const [whole, string, colon, literal, number] = match;
        if (string && colon) fragment.append(h('span', { class: 'j-key', text: string }), colon);
        else if (string) fragment.append(h('span', { class: 'j-str', text: string }));
        else if (literal) fragment.append(h('span', { class: 'j-lit', text: literal }));
        else if (number) fragment.append(h('span', { class: 'j-num', text: number }));
        last = match.index + whole.length;
    }
    fragment.append(source.slice(last));
    return fragment;
}

/**
 * Position of an element in the coordinates of `world` (unaffected by the
 * camera's CSS transform), corrected for scrolled containers.
 */
export function rectIn(world, el) {
    let x = 0;
    let y = 0;
    for (let node = el; node && node !== world; node = node.offsetParent) {
        x += node.offsetLeft;
        y += node.offsetTop;
    }
    for (let node = el.parentElement; node && node !== world; node = node.parentElement) {
        x -= node.scrollLeft;
        y -= node.scrollTop;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}
