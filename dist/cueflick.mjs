/*! cueflick v0.3.0 | MIT License | product films for software, written as data */

// src/templates/layouts.js
var TOP = 92;
var HEIGHT = 650;
var GAP = 46;
var LAYOUTS = ["row", "stage", "desktop"];
var SLOTS = Object.freeze({
  left: { x: 60, y: TOP, w: 460, h: HEIGHT },
  center: { x: 570, y: TOP, w: 460, h: HEIGHT },
  right: { x: 1080, y: TOP, w: 460, h: HEIGHT },
  "wide-left": { x: 60, y: TOP, w: 900, h: HEIGHT },
  "wide-right": { x: 640, y: TOP, w: 900, h: HEIGHT },
  full: { x: 180, y: TOP, w: 1240, h: HEIGHT },
  pip: { x: 1060, y: 452, w: 480, h: 300 },
  "pip-left": { x: 60, y: 452, w: 480, h: 300 }
});
var widthOf = (entry) => entry.def.width ?? entry.surface.width;
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
function stage(entries, world) {
  const layout = {};
  for (const entry of entries) {
    const w = Math.min(world.width - 120, entry.def.width ?? Math.round(widthOf(entry) * 2));
    layout[entry.key] = { x: Math.round((world.width - w) / 2), y: TOP, w, h: HEIGHT };
  }
  return layout;
}
function desktop(entries, world) {
  const layout = {};
  const step = { x: 120, y: 44 };
  const count = entries.length;
  const widths = entries.map((entry) => Math.min(world.width - 160 - step.x * (count - 1), entry.def.width ?? Math.round(widthOf(entry) * 1.55)));
  const base = (world.width - (Math.max(...widths) + step.x * (count - 1))) / 2;
  const h2 = HEIGHT - step.y * (count - 1);
  entries.forEach((entry, i) => {
    layout[entry.key] = { x: Math.round(base + step.x * i), y: TOP + step.y * i, w: widths[i], h: h2 };
  });
  return layout;
}
var BUILDERS = { row, stage, desktop };
function layoutFor(mode, entries, world) {
  const layout = (BUILDERS[mode] ?? row)(entries, world);
  for (const entry of entries) {
    const { place } = entry.def;
    if (typeof place === "string" && Object.prototype.hasOwnProperty.call(SLOTS, place)) layout[entry.key] = { ...SLOTS[place] };
    else if (place && typeof place === "object") layout[entry.key] = { x: place.x, y: place.y, w: place.w, h: place.h };
  }
  return layout;
}

// src/core/registry.js
var surfaces = /* @__PURE__ */ new Map();
var templates = /* @__PURE__ */ new Map();
function assertName(kind, name) {
  if (typeof name !== "string" || !/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new TypeError(`${kind} name must be lowercase kebab-case, got ${JSON.stringify(name)}`);
  }
}
function registerSurface(definition) {
  assertName("Surface", definition?.name);
  if (typeof definition.render !== "function") throw new TypeError(`Surface "${definition.name}" needs a render() function`);
  surfaces.set(definition.name, { parts: {}, actions: {}, width: 460, ...definition });
}
function registerTemplate(definition) {
  assertName("Template", definition?.name);
  if (definition.layout !== void 0 && typeof definition.layout !== "function" && !LAYOUTS.includes(definition.layout)) {
    throw new TypeError(`Template "${definition.name}" layout must be a function or one of ${LAYOUTS.join(", ")}`);
  }
  templates.set(definition.name, { requires: [], layout: "row", ...definition });
}
var surfaceStyles = () => [...surfaces.values()].map((surface) => surface.styles ?? "").join("\n");
var getSurface = (name) => surfaces.get(name);
var getTemplate = (name) => templates.get(name);
var surfaceNames = () => [...surfaces.keys()];
var templateNames = () => [...templates.keys()];
function catalog() {
  return {
    templates: [...templates.values()].map((t) => ({ name: t.name, title: t.title, summary: t.summary, requires: t.requires })),
    surfaces: [...surfaces.values()].map((sf) => ({
      name: sf.name,
      summary: sf.summary,
      parts: Object.keys(sf.parts),
      actions: Object.entries(sf.actions).map(([name, action]) => ({ name, summary: action.summary, keys: action.keys ?? [] }))
    }))
  };
}

// src/core/dom.js
var SVG_NS = "http://www.w3.org/2000/svg";
var URL_ATTRIBUTES = /* @__PURE__ */ new Set(["href", "src", "xlink:href", "action", "formaction"]);
var SAFE_URL = /^(?:https?:|\/|\.{0,2}\/|#|[^:]*$)/i;
var SAFE_IMAGE_DATA = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i;
function applyProps(el, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === void 0 || value === null || value === false) continue;
    if (/^on/i.test(key)) throw new TypeError(`h(): event-handler attribute "${key}" is not allowed; use addEventListener.`);
    const url = String(value).trim();
    if (URL_ATTRIBUTES.has(key.toLowerCase()) && !SAFE_URL.test(url) && !(key === "src" && SAFE_IMAGE_DATA.test(url))) {
      throw new TypeError(`h(): unsafe URL in "${key}".`);
    }
    if (key === "class") el.setAttribute("class", value);
    else if (key === "text") el.textContent = String(value);
    else if (key === "style") {
      for (const [property, styleValue] of Object.entries(value)) el.style.setProperty(property, String(styleValue));
    } else if (key === "dataset") Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
}
function appendChildren(el, children) {
  for (const child of [children].flat(Infinity)) {
    if (child === void 0 || child === null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
}
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}
function s(tag, props = {}, children = []) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}
function richText(text) {
  const fragment = document.createDocumentFragment();
  for (const token of String(text ?? "").split(/(\*[^*\n]+\*|`[^`\n]+`|\n)/)) {
    if (!token) continue;
    if (token === "\n") fragment.append(h("br"));
    else if (token.startsWith("*") && token.endsWith("*") && token.length > 2) fragment.append(h("b", { text: token.slice(1, -1) }));
    else if (token.startsWith("`") && token.endsWith("`") && token.length > 2) fragment.append(h("code", { text: token.slice(1, -1) }));
    else fragment.append(token);
  }
  return fragment;
}
function jsonNodes(value) {
  const source = JSON.stringify(value, null, 2) ?? "";
  const fragment = document.createDocumentFragment();
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    fragment.append(source.slice(last, match.index));
    const [whole, string, colon, literal, number2] = match;
    if (string && colon) fragment.append(h("span", { class: "j-key", text: string }), colon);
    else if (string) fragment.append(h("span", { class: "j-str", text: string }));
    else if (literal) fragment.append(h("span", { class: "j-lit", text: literal }));
    else if (number2) fragment.append(h("span", { class: "j-num", text: number2 }));
    last = match.index + whole.length;
  }
  fragment.append(source.slice(last));
  return fragment;
}
function rectIn(world, el) {
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

// src/core/util.js
var isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var hasOwn = (object, key) => object !== null && object !== void 0 && Object.prototype.hasOwnProperty.call(object, key);
var isHexColor = (value) => typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
}
function closest(word, options) {
  const target = String(word).toLowerCase();
  let best = null;
  let bestDistance = Infinity;
  for (const option of options) {
    const distance = levenshtein(target, String(option).toLowerCase());
    if (distance < bestDistance) {
      best = option;
      bestDistance = distance;
    }
  }
  const limit = Math.max(2, Math.floor(target.length / 3));
  return bestDistance <= limit ? best : null;
}
var suggest = (word, options) => {
  const match = closest(word, options);
  return match === null ? void 0 : `Did you mean "${match}"?`;
};
function parseSelector(selector) {
  const match = /^([A-Za-z_][\w-]*)(?:\.([a-z]+):(.+))?$/.exec(String(selector ?? ""));
  return match ? { screen: match[1], part: match[2] ?? null, name: match[3] ?? null } : null;
}
var initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
function nameColor(name) {
  let hue = 0;
  for (const char of String(name)) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hue} 55% 50%)`;
}
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var isImageSource = (value) => typeof value === "string" && (/^https:\/\/[^\s"'<>]+$/i.test(value) || /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/i.test(value) || /^[\w ./-]+\.(?:png|jpe?g|gif|webp|avif)$/i.test(value) && !value.startsWith("/") && !value.split("/").includes(".."));

// src/surfaces/ai-chat.css
var ai_chat_default = '/* ai-chat surface: an AI assistant app with connectors (warm, conversational look) */\n\n.cf-aichat {\n    --ai-bg: color-mix(in srgb, var(--cf-win) 90%, #efe3cf);\n    --ai-side: color-mix(in srgb, var(--cf-win-2) 82%, #e7dac3);\n    --ai-bubble: color-mix(in srgb, var(--cf-win-3) 72%, #e6dac6);\n    --ai-serif: "Tiempos Text", "Iowan Old Style", ui-serif, Georgia, Cambria, "Times New Roman", serif;\n\n    background: var(--ai-bg);\n}\n\n.cf-aichat .cf-appbar {\n    background: var(--ai-bg);\n    box-shadow: none;\n}\n\n.cf-ai-main {\n    display: flex;\n    flex: 1;\n    min-height: 0;\n}\n\n.cf-ai-side {\n    display: flex;\n    flex-direction: column;\n    width: 176px;\n    flex-shrink: 0;\n    padding: 12px 10px;\n    background: var(--ai-side);\n    border-right: 1px solid var(--cf-line);\n    font-size: 13px;\n}\n\n.cf-ai-new {\n    padding: 8px 10px;\n    border: 1px solid var(--cf-line-strong);\n    border-radius: 9px;\n    background: var(--cf-win);\n    font-weight: 650;\n}\n\n.cf-ai-label {\n    margin: 16px 6px 6px;\n    color: var(--cf-dim);\n    font-size: 11px;\n    font-weight: 700;\n    letter-spacing: 0.06em;\n    text-transform: uppercase;\n}\n\n.cf-ai-recent {\n    padding: 6px 8px;\n    overflow: hidden;\n    border-radius: 7px;\n    color: var(--cf-dim);\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.cf-ai-recent.cf-active {\n    background: var(--ai-bubble);\n    color: var(--cf-text);\n    font-weight: 600;\n}\n\n.cf-ai-user {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-top: auto;\n    padding: 6px 4px 0;\n    font-weight: 600;\n}\n\n.cf-ai-user .cf-avatar {\n    width: 26px;\n    height: 26px;\n    border-radius: 50%;\n    font-size: 10px;\n}\n\n.cf-ai-pane {\n    position: relative;\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    min-width: 0;\n}\n\n.cf-ai-thread {\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    gap: 14px;\n    min-height: 0;\n    padding: 20px 26px 12px;\n    overflow: hidden;\n}\n\n.cf-ai-thread:has(.cf-ai-msg, .cf-ai-tool) {\n    mask-image: linear-gradient(to bottom, transparent 0, #000 28px);\n}\n\n.cf-ai-empty {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    gap: 14px;\n    flex: 1;\n    padding-bottom: 30px;\n}\n\n.cf-ai-empty .cf-appicon {\n    width: 40px;\n    height: 40px;\n    border-radius: 50%;\n    font-size: 13px;\n}\n\n.cf-ai-greet {\n    font-family: var(--ai-serif);\n    font-size: 30px;\n    letter-spacing: -0.01em;\n    text-align: center;\n}\n\n.cf-ai-user-msg {\n    align-self: flex-end;\n    max-width: 82%;\n    animation: cf-in 350ms ease;\n}\n\n.cf-ai-bubble {\n    padding: 10px 14px;\n    background: var(--ai-bubble);\n    border-radius: 14px;\n    font-size: 14.5px;\n    line-height: 1.5;\n    overflow-wrap: anywhere;\n}\n\n.cf-ai-thinking {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    color: var(--cf-dim);\n    font-size: 13.5px;\n    font-style: italic;\n}\n\n.cf-ai-spark {\n    color: var(--app);\n    font-style: normal;\n    animation: cf-ai-pulse 1s ease-in-out infinite;\n}\n\n@keyframes cf-ai-pulse {\n    50% { opacity: 0.35; transform: rotate(30deg); }\n}\n\n.cf-ai-tool {\n    padding: 9px 12px;\n    background: var(--cf-win);\n    border: 1px solid var(--cf-line);\n    border-radius: 10px;\n    font-size: 13px;\n    animation: cf-in 300ms ease;\n}\n\n.cf-ai-tool-head {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\n.cf-ai-tool-head .cf-appicon,\n.cf-ai-chip .cf-appicon,\n.cf-ai-conn .cf-appicon {\n    width: 20px;\n    height: 20px;\n    border-radius: 6px;\n    font-size: 8.5px;\n}\n\n.cf-ai-tool-name {\n    flex: 1;\n    min-width: 0;\n    overflow: hidden;\n    font-family: var(--cf-font-mono);\n    font-size: 12.5px;\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.cf-ai-tool-name b {\n    font-family: var(--cf-font-ui);\n}\n\n.cf-ai-tool-status {\n    width: 14px;\n    height: 14px;\n    flex-shrink: 0;\n}\n\n.cf-ai-tool.cf-running .cf-ai-tool-status {\n    border: 2px solid var(--cf-line-strong);\n    border-top-color: var(--app);\n    border-radius: 50%;\n    animation: cf-ai-spin 800ms linear infinite;\n}\n\n.cf-ai-tool.cf-ok .cf-ai-tool-status::before {\n    content: "\u2713";\n    color: var(--cf-ok);\n    font-weight: 800;\n}\n\n@keyframes cf-ai-spin {\n    to { transform: rotate(360deg); }\n}\n\n.cf-ai-tool-input {\n    margin-top: 5px;\n    overflow: hidden;\n    color: var(--cf-dim);\n    font-family: var(--cf-font-mono);\n    font-size: 11.5px;\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.cf-ai-tool-result:empty {\n    display: none;\n}\n\n.cf-ai-tool-result {\n    margin-top: 5px;\n    font-size: 13px;\n    font-weight: 600;\n}\n\n.cf-ai-reply {\n    display: grid;\n    grid-template-columns: 28px minmax(0, 1fr);\n    gap: 12px;\n    animation: cf-in 400ms ease;\n}\n\n.cf-ai-mark .cf-appicon {\n    width: 26px;\n    height: 26px;\n    border-radius: 50%;\n    font-size: 9px;\n}\n\n.cf-ai-prose {\n    font-family: var(--ai-serif);\n    font-size: 15.5px;\n    line-height: 1.6;\n    overflow-wrap: anywhere;\n}\n\n.cf-ai-prose p {\n    margin: 0 0 8px;\n}\n\n.cf-ai-prose ul {\n    margin: 0 0 8px;\n    padding-left: 20px;\n}\n\n.cf-ai-prose li {\n    margin: 2px 0;\n}\n\n.cf-ai-prose code {\n    font-family: var(--cf-font-mono);\n    font-size: 0.85em;\n}\n\n.cf-ai-composer {\n    position: relative;\n    flex-shrink: 0;\n    margin: 6px 22px 18px;\n    padding: 12px 14px 10px;\n    background: var(--cf-win);\n    border: 1px solid var(--cf-line-strong);\n    border-radius: 18px;\n    box-shadow: 0 6px 20px rgb(0 0 0 / 0.07);\n    transition: border-color 200ms ease;\n}\n\n.cf-ai-composer.cf-typing {\n    border-color: var(--app);\n}\n\n.cf-ai-input {\n    min-height: 40px;\n    font-size: 14.5px;\n    line-height: 1.45;\n}\n\n.cf-ai-placeholder {\n    color: var(--cf-faint);\n}\n\n.cf-ai-composer.cf-typing .cf-ai-placeholder,\n.cf-ai-typed:not(:empty) ~ .cf-ai-placeholder {\n    display: none;\n}\n\n.cf-ai-bar {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-top: 6px;\n    font-size: 12.5px;\n}\n\n.cf-ai-plus {\n    display: grid;\n    place-items: center;\n    width: 26px;\n    height: 26px;\n    border: 1px solid var(--cf-line-strong);\n    border-radius: 50%;\n    color: var(--cf-dim);\n}\n\n.cf-ai-tools,\n.cf-ai-chip {\n    display: inline-flex;\n    align-items: center;\n    gap: 5px;\n    padding: 4px 9px;\n    border: 1px solid var(--cf-line-strong);\n    border-radius: 999px;\n    color: var(--cf-dim);\n    white-space: nowrap;\n}\n\n.cf-ai-chips {\n    display: flex;\n    gap: 6px;\n    min-width: 0;\n    overflow: hidden;\n}\n\n.cf-ai-chip {\n    padding: 3px 9px 3px 4px;\n    color: var(--cf-text);\n    font-weight: 600;\n}\n\n.cf-ai-model {\n    margin-left: auto;\n    color: var(--cf-dim);\n    white-space: nowrap;\n}\n\n.cf-ai-send {\n    display: grid;\n    place-items: center;\n    width: 30px;\n    height: 30px;\n    flex-shrink: 0;\n    border-radius: 9px;\n    background: var(--app);\n    color: #fff;\n    font-weight: 800;\n}\n\n.cf-ai-menu {\n    position: absolute;\n    left: 12px;\n    bottom: calc(100% + 8px);\n    z-index: 5;\n    width: 270px;\n    padding: 8px;\n    background: var(--cf-win);\n    border: 1px solid var(--cf-line-strong);\n    border-radius: 12px;\n    box-shadow: var(--cf-shadow);\n    opacity: 0;\n    transform: translateY(6px);\n    pointer-events: none;\n    transition: opacity 200ms ease, transform 200ms ease;\n}\n\n.cf-ai-menu.cf-open {\n    opacity: 1;\n    transform: none;\n}\n\n.cf-ai-menu-label {\n    margin: 2px 6px 6px;\n    color: var(--cf-dim);\n    font-size: 11px;\n    font-weight: 700;\n    letter-spacing: 0.06em;\n    text-transform: uppercase;\n}\n\n.cf-ai-conn {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 7px 8px;\n    border-radius: 8px;\n    font-size: 13.5px;\n}\n\n.cf-ai-conn-name {\n    flex: 1;\n}\n\n.cf-ai-conn .cf-switch {\n    position: relative;\n    width: 30px;\n    height: 18px;\n    border-radius: 999px;\n    background: var(--cf-line-strong);\n    transition: background 200ms ease;\n}\n\n.cf-ai-conn .cf-switch i {\n    position: absolute;\n    top: 2px;\n    left: 2px;\n    width: 14px;\n    height: 14px;\n    border-radius: 50%;\n    background: #fff;\n    transition: left 200ms ease;\n}\n\n.cf-ai-conn .cf-switch.cf-on {\n    background: var(--app);\n}\n\n.cf-ai-conn .cf-switch.cf-on i {\n    left: 14px;\n}\n\n/* ---------- typing caret ---------- */\n\n.cf-ai-caret {\n    display: none;\n    width: 2px;\n    height: 1.15em;\n    margin: 0 1px -0.2em;\n    background: var(--cf-text);\n    animation: cf-ai-blink 1s steps(1) infinite;\n}\n\n.cf-ai-composer.cf-typing .cf-ai-caret {\n    display: inline-block;\n}\n\n@keyframes cf-ai-blink {\n    50% { opacity: 0; }\n}\n\n/* ---------- file references ---------- */\n\n.cf-file-icon {\n    display: inline-grid;\n    place-items: center;\n    flex-shrink: 0;\n    width: 20px;\n    height: 20px;\n    border-radius: 6px;\n    background: var(--file);\n    color: #fff;\n}\n\n.cf-file-icon svg {\n    fill: none;\n    stroke: currentColor;\n    stroke-width: 2.2;\n    stroke-linecap: round;\n}\n\n.cf-ai-ref {\n    display: inline-flex;\n    align-items: center;\n    gap: 4px;\n    margin: 0 1px;\n    padding: 0 6px 0 3px;\n    background: var(--cf-ref-bg);\n    border-radius: 6px;\n    color: var(--cf-ref-text);\n    font-weight: 600;\n    white-space: nowrap;\n    animation: cf-in 260ms ease;\n    transition: box-shadow 160ms ease;\n}\n\n.cf-ai-ref .cf-file-icon {\n    width: 16px;\n    height: 16px;\n    border-radius: 4px;\n}\n\n.cf-ai-ref .cf-file-icon svg {\n    width: 11px;\n    height: 11px;\n}\n\n.cf-ai-ref.cf-hover {\n    box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--cf-ref-text) 65%, transparent);\n}\n\n.cf-ai-picker {\n    width: 330px;\n}\n\n.cf-ai-pick {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 7px 8px;\n    border-radius: 8px;\n    font-size: 13.5px;\n}\n\n.cf-ai-pick[hidden] {\n    display: none;\n}\n\n.cf-ai-pick.cf-active {\n    background: var(--cf-win-3);\n}\n\n.cf-ai-pick-name,\n.cf-ai-peek-name {\n    flex: 1;\n    min-width: 0;\n    overflow: hidden;\n    font-weight: 600;\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.cf-ai-pick-meta,\n.cf-ai-peek-meta {\n    color: var(--cf-dim);\n    font-size: 12px;\n    white-space: nowrap;\n}\n\n/* hover preview: pops up beside the reference */\n.cf-ai-peek {\n    position: absolute;\n    top: 0;\n    left: 0;\n    z-index: 6;\n    width: 252px;\n    padding: 8px;\n    background: var(--cf-win);\n    border: 1px solid var(--cf-line-strong);\n    border-radius: 14px;\n    box-shadow: var(--cf-shadow);\n    opacity: 0;\n    transform: translateY(6px) scale(0.9);\n    pointer-events: none;\n    transition: opacity 160ms ease, transform 320ms cubic-bezier(0.2, 1.45, 0.4, 1);\n}\n\n.cf-ai-peek.cf-open {\n    opacity: 1;\n    transform: none;\n}\n\n.cf-ai-thumb {\n    overflow: hidden;\n    aspect-ratio: 240 / 140;\n    background: #fff;\n    border-radius: 9px;\n}\n\n.cf-thumb-img {\n    display: block;\n    width: 100%;\n    height: 100%;\n    object-fit: cover;\n}\n\n.cf-thumb-art {\n    display: block;\n    width: 100%;\n    height: 100%;\n}\n\n.cf-ai-peek-info {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    padding: 8px 4px 2px;\n    font-size: 13px;\n}\n\n.cf-thumb-title { font: 700 12px var(--cf-font-ui); fill: #111827; }\n.cf-thumb-line { font: 500 9.5px var(--cf-font-ui); fill: #4b5563; }\n.cf-thumb-head { font: 700 9.5px var(--cf-font-ui); fill: #14532d; }\n.cf-thumb-cell { font: 500 9.5px var(--cf-font-ui); fill: #374151; }\n.cf-thumb-tag { font: 800 8px var(--cf-font-ui); fill: #fff; text-anchor: middle; }\n\n/* ---------- neutral look: a plain, grey, sans-serif assistant ---------- */\n\n.cf-aichat.cf-ai-neutral {\n    --cf-win: var(--cf-n-bg);\n    --cf-win-2: var(--cf-n-side);\n    --cf-win-3: var(--cf-n-raise);\n    --cf-line: var(--cf-n-line);\n    --cf-line-strong: var(--cf-n-line-strong);\n    --cf-text: var(--cf-n-text);\n    --cf-dim: var(--cf-n-dim);\n    --cf-faint: var(--cf-n-faint);\n    --ai-bg: var(--cf-n-bg);\n    --ai-side: var(--cf-n-side);\n    --ai-bubble: var(--cf-n-raise);\n    --ai-serif: var(--cf-font-ui);\n\n    color: var(--cf-text);\n}\n\n.cf-ai-neutral .cf-ai-side {\n    border-right: 0;\n}\n\n.cf-ai-neutral .cf-ai-new {\n    background: transparent;\n    border-color: transparent;\n}\n\n.cf-ai-neutral .cf-ai-label {\n    letter-spacing: 0;\n    text-transform: none;\n    font-size: 12px;\n    font-weight: 600;\n}\n\n.cf-ai-neutral .cf-ai-empty .cf-ai-mark,\n.cf-ai-neutral .cf-ai-reply .cf-ai-mark {\n    display: none;\n}\n\n.cf-ai-neutral .cf-ai-greet {\n    font-size: 27px;\n    font-weight: 500;\n    letter-spacing: -0.015em;\n}\n\n.cf-ai-neutral .cf-ai-bubble {\n    padding: 10px 16px;\n    border-radius: 20px;\n}\n\n.cf-ai-neutral .cf-ai-reply {\n    grid-template-columns: minmax(0, 1fr);\n}\n\n.cf-ai-neutral .cf-ai-prose {\n    font-size: 15px;\n    line-height: 1.65;\n}\n\n.cf-ai-neutral .cf-ai-composer {\n    background: var(--cf-n-composer);\n    border-color: var(--cf-n-line);\n    border-radius: 26px;\n    box-shadow: 0 8px 28px rgb(0 0 0 / 0.12);\n}\n\n.cf-ai-neutral .cf-ai-composer.cf-typing {\n    border-color: var(--cf-n-line-strong);\n}\n\n.cf-ai-neutral .cf-ai-plus,\n.cf-ai-neutral .cf-ai-tools {\n    border-color: transparent;\n}\n\n.cf-ai-neutral .cf-ai-send {\n    border-radius: 50%;\n    background: var(--cf-text);\n    color: var(--cf-win);\n}\n\n.cf-ai-neutral .cf-ai-menu {\n    background: var(--cf-n-menu);\n}\n\n.cf-ai-neutral .cf-ai-tool {\n    background: transparent;\n}\n\n.cf-ai-neutral .cf-ai-spark {\n    color: var(--cf-dim);\n}\n';

// src/surfaces/files.js
var FILE_KINDS = ["image", "doc", "pdf", "sheet"];
var KIND_COLORS = { image: "#a855f7", doc: "#3b82f6", pdf: "#ef4444", sheet: "#16a34a" };
var W = 240;
var H = 140;
var kindOf = (file) => FILE_KINDS.includes(file.kind) ? file.kind : "doc";
var clip = (text, max) => text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
function fileIcon(kind) {
  const glyphs = {
    image: [
      s("circle", { cx: "9", cy: "9", r: "2", fill: "currentColor" }),
      s("path", { d: "M4 18l5-5.5 3 3 3.5-4.5L20 18z", fill: "currentColor" })
    ],
    doc: [s("path", { d: "M7 8h10M7 12h10M7 16h6" })],
    pdf: [s("path", { d: "M7 8h10M7 12h10M7 16h6" })],
    sheet: [s("path", { d: "M5 9.5h14M5 14.5h14M10.5 5v14" })]
  };
  return h(
    "span",
    { class: "cf-file-icon", style: { "--file": KIND_COLORS[kind] }, "aria-hidden": "true" },
    s("svg", { viewBox: "0 0 24 24", width: "14", height: "14" }, glyphs[kind])
  );
}
function chartArt({ chart, title }, color) {
  const max = Math.max(...chart, 1);
  const left = 18;
  const right = W - 14;
  const top = title ? 40 : 18;
  const bottom = H - 18;
  const step = (right - left) / chart.length;
  return [
    s("rect", { width: W, height: H, fill: "#ffffff" }),
    title ? s("text", { x: left, y: 25, class: "cf-thumb-title" }, clip(title, 30)) : null,
    ...[1 / 3, 2 / 3].map((f) => s("line", { x1: left, x2: right, y1: bottom - (bottom - top) * f, y2: bottom - (bottom - top) * f, stroke: "#eceef2" })),
    s("line", { x1: left, x2: right, y1: bottom, y2: bottom, stroke: "#cfd5df" }),
    ...chart.map((value, i) => {
      const height = Math.max(2, value / max * (bottom - top));
      return s("rect", {
        x: (left + i * step + step * 0.18).toFixed(1),
        y: (bottom - height).toFixed(1),
        width: (step * 0.64).toFixed(1),
        height: height.toFixed(1),
        rx: "3",
        fill: color,
        opacity: i === chart.length - 1 ? "1" : "0.5"
      });
    })
  ];
}
function photoArt(color) {
  return [
    s("rect", { width: W, height: H, fill: "#ffffff" }),
    s("rect", { width: W, height: H, fill: color, opacity: "0.28" }),
    s("circle", { cx: "176", cy: "42", r: "17", fill: "#fff7d6" }),
    s("path", { d: `M0 ${H} L70 62 L118 104 L150 78 L${W} ${H}z`, fill: color, opacity: "0.75" }),
    s("path", { d: `M60 ${H} L150 90 L${W} 120 L${W} ${H}z`, fill: color })
  ];
}
function pageArt({ title, lines }, kind, color) {
  const rows = Array.isArray(lines) && lines.length ? lines.slice(0, 6).map((line, i) => s("text", { x: "58", y: 62 + i * 15, class: "cf-thumb-line" }, clip(line, 26))) : [0.9, 0.75, 0.85, 0.6, 0.8].map((f, i) => s("rect", { x: "58", y: 54 + i * 14, width: (124 * f).toFixed(0), height: "6", rx: "3", fill: "#e3e6ec" }));
  return [
    s("rect", { width: W, height: H, fill: "#eef0f4" }),
    s("rect", { x: "44", y: "14", width: "152", height: H, rx: "6", fill: "#ffffff", stroke: "#dde1e8" }),
    s("text", { x: "58", y: "38", class: "cf-thumb-title" }, clip(title ?? "Untitled", 20)),
    s("rect", { x: "58", y: "44", width: "30", height: "3", rx: "1.5", fill: color }),
    ...rows,
    kind === "pdf" ? s("rect", { x: "160", y: "22", width: "28", height: "14", rx: "3", fill: color }) : null,
    kind === "pdf" ? s("text", { x: "174", y: "32.5", class: "cf-thumb-tag" }, "PDF") : null
  ];
}
function sheetArt({ title, rows }, color) {
  const table = Array.isArray(rows) && rows.length ? rows.slice(0, 6) : [["", "", ""], ["", "", ""], ["", "", ""], ["", "", ""], ["", "", ""]];
  const columns = Math.max(...table.map((row2) => row2.length), 1);
  const top = title ? 34 : 12;
  const rowHeight = Math.min(20, (H - top - 8) / table.length);
  const colWidth = (W - 24) / columns;
  const cells = [];
  table.forEach((row2, r) => {
    const y = top + r * rowHeight;
    if (r === 0) cells.push(s("rect", { x: "12", y, width: W - 24, height: rowHeight, fill: color, opacity: "0.16" }));
    cells.push(s("line", { x1: "12", x2: W - 12, y1: y + rowHeight, y2: y + rowHeight, stroke: "#e3e6ec" }));
    row2.forEach((cell, c) => {
      if (cell) cells.push(s("text", { x: 18 + c * colWidth, y: y + rowHeight * 0.68, class: r === 0 ? "cf-thumb-head" : "cf-thumb-cell" }, clip(cell, 11)));
      else cells.push(s("rect", { x: 18 + c * colWidth, y: y + rowHeight * 0.38, width: colWidth * 0.6, height: "5", rx: "2.5", fill: "#e3e6ec" }));
    });
  });
  return [
    s("rect", { width: W, height: H, fill: "#ffffff" }),
    title ? s("text", { x: "14", y: "23", class: "cf-thumb-title" }, clip(title, 30)) : null,
    ...cells
  ];
}
function fileThumb(file) {
  if (file.src) return h("img", { class: "cf-thumb-img", src: file.src, alt: "" });
  const kind = kindOf(file);
  const preview = file.preview ?? {};
  const color = preview.color ?? KIND_COLORS[kind];
  let art;
  if (kind === "image") art = Array.isArray(preview.chart) && preview.chart.length ? chartArt(preview, color) : photoArt(color);
  else if (kind === "sheet") art = sheetArt(preview, color);
  else art = pageArt(preview, kind, color);
  return s("svg", { class: "cf-thumb-art", viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" }, art);
}

// src/surfaces/shared.js
function appIcon(app, color) {
  return h("span", {
    class: "cf-appicon",
    style: color ? { "--app": color } : void 0,
    text: app?.icon ?? initials(app?.name ?? "?")
  });
}
function appWindow(app, { title, trailing, className }) {
  const body = h("div", { class: "cf-body" });
  const el = h("div", { class: `cf-window ${className}` }, [
    h("div", { class: "cf-appbar" }, [
      appIcon(app),
      h("span", { class: "cf-appname", text: app.name }),
      title ? h("span", { class: "cf-apptitle", text: title }) : null,
      trailing ? h("span", { class: "cf-apptrail" }, trailing) : null
    ]),
    body
  ]);
  return { el, body };
}
var byData = (root, attribute, value) => [...root.querySelectorAll(`[data-${attribute}]`)].find((node) => node.dataset[attribute] === value) ?? null;
async function typeInto(el, text, ctx, msPerChar = 28) {
  if (ctx.fast) {
    el.textContent = text;
    return;
  }
  el.textContent = "";
  for (const char of text) {
    el.textContent += char;
    await ctx.wait(msPerChar);
  }
}

// src/surfaces/ai-chat.js
var ID = /^[A-Za-z_][\w-]*$/;
var LOOKS = ["warm", "neutral"];
var AREAS = ["composer", "thread", "sidebar"];
var FILE_KEYS = ["id", "name", "kind", "meta", "src", "preview"];
var PREVIEW_KEYS = ["title", "lines", "chart", "rows", "color"];
var REFERENCE = /(^|[\s([{"'])@([A-Za-z_][\w-]*)/g;
var TYPE_MS = 22;
var PEEK_MS = 1500;
function warnUnknownKeys(value, allowed, path, report) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) report.warn(`${path}.${key}`, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, allowed));
  }
}
function validatePreview(preview, path, report) {
  if (!isObject(preview)) {
    report.error(path, 'must be an object like { "title": "Revenue", "chart": [3, 5, 8] }.');
    return;
  }
  warnUnknownKeys(preview, PREVIEW_KEYS, path, report);
  if (preview.title !== void 0 && typeof preview.title !== "string") report.error(`${path}.title`, "must be a string.");
  if (preview.lines !== void 0 && !(Array.isArray(preview.lines) && preview.lines.every((line) => typeof line === "string"))) {
    report.error(`${path}.lines`, "must be an array of short text lines.");
  }
  const chartOk = Array.isArray(preview.chart) && preview.chart.length >= 2 && preview.chart.length <= 12 && preview.chart.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0);
  if (preview.chart !== void 0 && !chartOk) report.error(`${path}.chart`, "must be 2\u201312 numbers of zero or more (the bar heights).");
  const rowsOk = Array.isArray(preview.rows) && preview.rows.length <= 8 && preview.rows.every((row2) => Array.isArray(row2) && row2.length <= 5 && row2.every((cell) => typeof cell === "string"));
  if (preview.rows !== void 0 && !rowsOk) report.error(`${path}.rows`, "must be up to 8 rows of up to 5 text cells; the first row is the header.");
  if (preview.color !== void 0 && !isHexColor(preview.color)) report.error(`${path}.color`, "must be a hex colour.");
}
function validateFiles(files, path, report) {
  if (!Array.isArray(files)) {
    report.error(path, 'must be an array: [{ "id": "q3", "name": "Q3 revenue.png", "kind": "image" }].');
    return;
  }
  const seen = /* @__PURE__ */ new Set();
  files.forEach((file, i) => {
    const at = `${path}[${i}]`;
    if (!isObject(file)) {
      report.error(at, "must be an object.");
      return;
    }
    warnUnknownKeys(file, FILE_KEYS, at, report);
    if (typeof file.id !== "string" || !ID.test(file.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-"; prompts refer to it as "@id".');
    else if (seen.has(file.id)) report.error(`${at}.id`, `"${file.id}" is used twice.`);
    seen.add(file.id);
    if (typeof file.name !== "string" || !file.name) report.error(`${at}.name`, 'must be the file name shown, e.g. "Q3 revenue.png".');
    if (file.kind !== void 0 && !FILE_KINDS.includes(file.kind)) report.error(`${at}.kind`, `must be one of ${FILE_KINDS.join(", ")}.`, suggest(file.kind, FILE_KINDS));
    if (file.meta !== void 0 && typeof file.meta !== "string") report.error(`${at}.meta`, 'must be a short string, e.g. "PNG \xB7 240 KB".');
    if (file.src !== void 0 && !isImageSource(file.src)) {
      report.error(`${at}.src`, `must be an image: an https:// URL, a path in the clip's folder like "media/q3.png", or a data:image/\u2026 URL (PNG, JPEG, GIF, WebP, or AVIF).`);
    }
    if (file.preview !== void 0) validatePreview(file.preview, `${at}.preview`, report);
  });
}
function validateChat(def, path, report, screens) {
  for (const key of ["assistant", "model", "user", "title", "greeting", "placeholder"]) {
    if (def[key] !== void 0 && typeof def[key] !== "string") report.error(`${path}.${key}`, "must be a string.");
  }
  if (def.look !== void 0 && !LOOKS.includes(def.look)) report.error(`${path}.look`, `must be one of ${LOOKS.join(", ")}.`, suggest(def.look, LOOKS));
  if (def.recents !== void 0 && (!Array.isArray(def.recents) || def.recents.some((item) => typeof item !== "string"))) {
    report.error(`${path}.recents`, "must be an array of earlier chat titles.");
  }
  if (def.files !== void 0) validateFiles(def.files, `${path}.files`, report);
  if (def.connectors === void 0) return;
  if (!Array.isArray(def.connectors)) {
    report.error(`${path}.connectors`, 'must be an array: [{ "id": "books", "name": "Fastbooks", "app": "<screen id>" }].');
    return;
  }
  const seen = /* @__PURE__ */ new Set();
  def.connectors.forEach((connector, i) => {
    const at = `${path}.connectors[${i}]`;
    if (!isObject(connector)) {
      report.error(at, "must be an object.");
      return;
    }
    if (typeof connector.id !== "string" || !ID.test(connector.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-".');
    else if (seen.has(connector.id)) report.error(`${at}.id`, `"${connector.id}" is used twice.`);
    seen.add(connector.id);
    if (typeof connector.name !== "string" || !connector.name) report.error(`${at}.name`, "must be a non-empty string.");
    if (connector.app !== void 0 && !hasOwn(screens, connector.app)) {
      report.error(`${at}.app`, `"${connector.app}" isn't a screen id.`, suggest(connector.app, Object.keys(screens ?? {})));
    }
    if (connector.color !== void 0 && !isHexColor(connector.color)) report.error(`${at}.color`, "must be a hex colour.");
    if (connector.icon !== void 0 && (typeof connector.icon !== "string" || connector.icon.length > 4)) report.error(`${at}.icon`, "must be 1\u20134 characters.");
    if (connector.enabled !== void 0 && typeof connector.enabled !== "boolean") report.error(`${at}.enabled`, "must be true or false.");
  });
}
var connectorIds = (def) => Array.isArray(def.connectors) ? def.connectors.map((c) => c.id) : [];
var fileIds = (def) => Array.isArray(def.files) ? def.files.filter(isObject).map((file) => file.id) : [];
var referencesIn = (text) => [...String(text).matchAll(REFERENCE)].map((match) => match[2]);
function checkReferences(text, def, path, report) {
  const ids = fileIds(def);
  if (!ids.length) return;
  for (const id of referencesIn(text)) {
    if (!ids.includes(id)) report.error(path, `"@${id}" isn't one of this screen's files.`, suggest(id, ids) ?? `Files: ${ids.map((f) => `@${f}`).join(", ")}.`);
  }
}
function rememberReferences(facts, text) {
  facts.references ??= /* @__PURE__ */ new Set();
  for (const id of referencesIn(text)) facts.references.add(id);
}
function segments(text, files) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(REFERENCE)) {
    const file = files.get(match[2]);
    if (!file) continue;
    const start = match.index + match[1].length;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ file });
    last = start + 1 + match[2].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
var refChip = (file) => h("span", { class: "cf-ai-ref", dataset: { file: file.id } }, [fileIcon(kindOf(file)), h("span", { text: file.name })]);
var withReferences = (text, files, format = (run) => run) => segments(String(text), files).map((part) => part.file ? refChip(part.file) : format(part.text));
function brandOf(connector, screens) {
  const app = connector.app && hasOwn(screens, connector.app) ? screens[connector.app].app : null;
  return {
    name: connector.name,
    icon: connector.icon ?? app?.icon ?? initials(connector.name),
    color: connector.color ?? app?.color ?? "#6b7280"
  };
}
function inputSummary(input) {
  if (!isObject(input)) return "";
  return Object.entries(input).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : typeof value === "object" ? "{\u2026}" : value}`).join(" \xB7 ");
}
function prose(text, files) {
  const wrapper = h("div", { class: "cf-ai-prose" });
  let list = null;
  for (const line of String(text).split("\n")) {
    if (line.startsWith("- ")) {
      list ??= wrapper.appendChild(h("ul"));
      list.append(h("li", {}, withReferences(line.slice(2), files, richText)));
    } else {
      list = null;
      if (line.trim()) wrapper.append(h("p", {}, withReferences(line, files, richText)));
    }
  }
  return wrapper;
}
function render(def, { screens }) {
  const look = LOOKS.includes(def.look) ? def.look : "warm";
  const assistant = def.assistant ?? def.app.name;
  const { el, body } = appWindow(def.app, { title: def.title ?? "New chat", className: `cf-aichat cf-ai-${look}` });
  const connectors = Array.isArray(def.connectors) ? def.connectors : [];
  const enabled = new Set(connectors.filter((c) => c.enabled).map((c) => c.id));
  const files = new Map((Array.isArray(def.files) ? def.files : []).filter((file) => isObject(file) && typeof file.id === "string").map((file) => [file.id, file]));
  const sidebar = h("div", { class: "cf-ai-side" }, [
    h("div", { class: "cf-ai-new", text: look === "neutral" ? "\u270E  New chat" : "+ New chat" }),
    h("div", { class: "cf-ai-label", text: look === "neutral" ? "Chats" : "Recents" }),
    h("div", { class: "cf-ai-recent cf-active", text: def.title ?? "New chat" }),
    ...(def.recents ?? []).map((title) => h("div", { class: "cf-ai-recent", text: title })),
    h("div", { class: "cf-ai-user" }, [
      h("span", { class: "cf-avatar", style: { "--avatar": nameColor(def.user ?? "You") }, text: initials(def.user ?? "You") }),
      h("span", { text: def.user ?? "You" })
    ])
  ]);
  const firstName = String(def.user ?? "").split(/\s+/)[0];
  const greeting = def.greeting ?? (look === "neutral" ? "How can I help today?" : firstName ? `Good to see you, ${firstName}` : "How can I help?");
  const empty = h("div", { class: "cf-ai-empty" }, [
    h("span", { class: "cf-ai-mark", "aria-hidden": "true" }, appIcon(def.app)),
    h("div", { class: "cf-ai-greet", text: greeting })
  ]);
  const thread = h("div", { class: "cf-ai-thread" }, empty);
  const typed = h("span", { class: "cf-ai-typed" });
  const caret = h("i", { class: "cf-ai-caret", "aria-hidden": "true" });
  const chips = h("span", { class: "cf-ai-chips" });
  const menu = h("div", { class: "cf-ai-menu" }, [
    h("div", { class: "cf-ai-menu-label", text: "Connectors" }),
    ...connectors.map((connector) => {
      const brand = brandOf(connector, screens);
      return h("div", { class: "cf-ai-conn", dataset: { connector: connector.id } }, [
        appIcon({ icon: brand.icon, name: brand.name }, brand.color),
        h("span", { class: "cf-ai-conn-name", text: brand.name }),
        h("span", { class: enabled.has(connector.id) ? "cf-switch cf-on" : "cf-switch" }, h("i"))
      ]);
    })
  ]);
  const picker = h("div", { class: "cf-ai-menu cf-ai-picker" }, [
    h("div", { class: "cf-ai-menu-label", text: "Files" }),
    ...[...files.values()].map((file) => h("div", { class: "cf-ai-pick", dataset: { pick: file.id } }, [
      fileIcon(kindOf(file)),
      h("span", { class: "cf-ai-pick-name", text: file.name }),
      file.meta ? h("span", { class: "cf-ai-pick-meta", text: file.meta }) : null
    ]))
  ]);
  const toolsButton = h("span", { class: "cf-ai-tools", text: look === "neutral" ? "\u2699 Tools" : "\u2699 Connectors" });
  const sendButton = h("span", { class: "cf-ai-send", text: "\u2191" });
  const placeholder = def.placeholder ?? (look === "neutral" ? "Ask anything" : `Reply to ${assistant}\u2026`);
  const composer = h("div", { class: "cf-ai-composer" }, [
    h("div", { class: "cf-ai-input" }, [typed, caret, h("span", { class: "cf-ai-placeholder", text: placeholder })]),
    h("div", { class: "cf-ai-bar" }, [
      h("span", { class: "cf-ai-plus", text: "+" }),
      toolsButton,
      chips,
      h("span", { class: "cf-ai-model", text: def.model ?? assistant }),
      sendButton
    ]),
    menu,
    files.size ? picker : null
  ]);
  const peekCard = h("div", { class: "cf-ai-peek", "aria-hidden": "true" });
  const pane = h("div", { class: "cf-ai-pane" }, [thread, composer, peekCard]);
  body.append(h("div", { class: "cf-ai-main" }, [sidebar, pane]));
  const refreshChips = () => {
    chips.replaceChildren(...connectors.filter((c) => enabled.has(c.id)).map((connector) => {
      const brand = brandOf(connector, screens);
      return h("span", { class: "cf-ai-chip" }, [appIcon({ icon: brand.icon, name: brand.name }, brand.color), brand.name]);
    }));
  };
  refreshChips();
  const scroll = () => {
    thread.scrollTop = thread.scrollHeight;
  };
  const areas = { composer, thread, sidebar };
  return {
    el,
    files,
    toolsButton,
    sendButton,
    composer,
    typed,
    caret,
    menu,
    picker,
    draft: null,
    find(part, name) {
      if (part === "connector") return byData(menu, "connector", name);
      if (part === "file") return [...el.querySelectorAll(".cf-ai-ref")].filter((node) => node.dataset.file === name).at(-1) ?? null;
      if (part === "area") return hasOwn(areas, name) ? areas[name] : null;
      return null;
    },
    openMenu(open) {
      menu.classList.toggle("cf-open", open);
    },
    /** Show the file picker filtered by what follows "@", with one file highlighted. */
    openPicker(query, activeId) {
      const needle = query.toLowerCase();
      for (const row2 of picker.querySelectorAll(".cf-ai-pick")) {
        const file = files.get(row2.dataset.pick);
        row2.hidden = !file.name.toLowerCase().includes(needle);
        row2.classList.toggle("cf-active", row2.dataset.pick === activeId);
      }
      picker.classList.add("cf-open");
    },
    closePicker() {
      picker.classList.remove("cf-open");
    },
    enable(id) {
      enabled.add(id);
      byData(menu, "connector", id)?.querySelector(".cf-switch")?.classList.add("cf-on");
      refreshChips();
    },
    /** Pop a preview card up beside a reference chip. */
    peek(file, chip) {
      peekCard.replaceChildren(
        h("div", { class: "cf-ai-thumb" }, fileThumb(file)),
        h("div", { class: "cf-ai-peek-info" }, [
          fileIcon(kindOf(file)),
          h("span", { class: "cf-ai-peek-name", text: file.name }),
          file.meta ? h("span", { class: "cf-ai-peek-meta", text: file.meta }) : null
        ])
      );
      const at = rectIn(pane, chip);
      const width = peekCard.offsetWidth;
      const height = peekCard.offsetHeight;
      const left = clamp(at.x + at.w / 2 - width / 2, 10, pane.clientWidth - width - 10);
      const above = at.y - height - 10 >= 10;
      peekCard.style.setProperty("left", `${left}px`);
      peekCard.style.setProperty("top", `${above ? at.y - height - 10 : at.y + at.h + 10}px`);
      peekCard.style.setProperty("transform-origin", `${at.x + at.w / 2 - left}px ${above ? "100%" : "0%"}`);
      chip.classList.add("cf-hover");
      peekCard.classList.add("cf-open");
      return peekCard;
    },
    unpeek() {
      peekCard.classList.remove("cf-open");
      for (const chip of el.querySelectorAll(".cf-ai-ref.cf-hover")) chip.classList.remove("cf-hover");
    },
    addUser(text) {
      empty.remove();
      thread.append(h("div", { class: "cf-ai-msg cf-ai-user-msg" }, h("div", { class: "cf-ai-bubble" }, withReferences(text, files))));
      scroll();
    },
    addThinking() {
      const node = h("div", { class: "cf-ai-thinking" }, [h("span", { class: "cf-ai-spark", text: "\u2736" }), "Thinking\u2026"]);
      thread.append(node);
      scroll();
      return node;
    },
    addTool(connectorId, name, input) {
      const connector = connectors.find((c) => c.id === connectorId);
      const brand = connector ? brandOf(connector, screens) : { name: connectorId ?? assistant, icon: "\u2699", color: "#6b7280" };
      const status = h("span", { class: "cf-ai-tool-status" });
      const result = h("div", { class: "cf-ai-tool-result" });
      const block = h("div", { class: "cf-ai-tool" }, [
        h("div", { class: "cf-ai-tool-head" }, [
          appIcon({ icon: brand.icon, name: brand.name }, brand.color),
          h("span", { class: "cf-ai-tool-name" }, [h("b", { text: brand.name }), ` \xB7 ${name}`]),
          status
        ]),
        input !== void 0 ? h("div", { class: "cf-ai-tool-input", text: inputSummary(input) }) : null,
        result
      ]);
      thread.append(block);
      scroll();
      return { block, result };
    },
    addReply(text) {
      thread.append(h("div", { class: "cf-ai-msg cf-ai-reply" }, [
        h("span", { class: "cf-ai-mark", "aria-hidden": "true" }, appIcon(def.app)),
        prose(text, files)
      ]));
      scroll();
    }
  };
}
async function typeRun(view, text, ctx) {
  const node = view.typed.appendChild(document.createTextNode(""));
  if (ctx.fast) {
    node.data = text;
    return;
  }
  let count = 0;
  for (const char of text) {
    node.data += char;
    count += 1;
    if (count % 3 === 0) ctx.camera?.track(view.caret, view.composer);
    await ctx.wait(TYPE_MS);
  }
}
async function typeReference(view, file, ctx) {
  if (ctx.fast) {
    view.typed.append(refChip(file));
    return;
  }
  const node = view.typed.appendChild(document.createTextNode(""));
  for (const char of `@${file.name.slice(0, 3)}`) {
    node.data += char;
    view.openPicker(node.data.slice(1), file.id);
    if (char === "@") ctx.camera?.track(view.picker);
    await ctx.wait(TYPE_MS * 3);
  }
  await ctx.wait(650);
  node.remove();
  view.typed.append(refChip(file));
  view.closePicker();
  ctx.camera?.track(view.caret, view.composer);
  await ctx.wait(180);
}
async function typeDraft(view, text, ctx) {
  view.typed.replaceChildren();
  for (const part of segments(text, view.files)) {
    if (part.file) await typeReference(view, part.file, ctx);
    else await typeRun(view, part.text, ctx);
  }
}
async function sendDraft(view, ctx) {
  view.unpeek();
  view.typed.replaceChildren();
  view.composer.classList.remove("cf-typing");
  view.addUser(view.draft ?? "");
  view.draft = null;
  ctx.cursor.hide();
  await ctx.wait(500);
}
var ai_chat_default2 = {
  name: "ai-chat",
  summary: "An AI assistant app with connectors and @file references: switch a connector on, type a prompt, point at references, and watch tool calls and the reply.",
  width: 520,
  keys: ["assistant", "model", "user", "title", "greeting", "placeholder", "look", "recents", "connectors", "files"],
  styles: ai_chat_default,
  parts: {
    connector: connectorIds,
    file: fileIds,
    area: () => AREAS
  },
  validate: validateChat,
  render,
  recap: (view) => {
    view.openMenu(false);
    view.closePicker();
    view.unpeek();
  },
  actions: {
    connect: {
      summary: "Open the connectors menu and switch a connector on.",
      part: "connector",
      keys: [],
      async run(view, _step, ctx) {
        await ctx.cursor.moveTo(view.toolsButton, ctx);
        await ctx.cursor.click(ctx);
        view.openMenu(true);
        await ctx.wait(500);
        const row2 = view.find("connector", ctx.name);
        const toggle = row2?.querySelector(".cf-switch");
        if (toggle) {
          await ctx.cursor.moveTo(toggle, ctx);
          await ctx.cursor.click(ctx);
        }
        view.enable(ctx.name);
        await ctx.wait(700);
        view.openMenu(false);
        await ctx.wait(300);
      }
    },
    prompt: {
      summary: `Type a message into the composer and send it. "@id" pulls in one of the screen's files; "draft": true leaves it unsent for a "send" step.`,
      keys: ["draft"],
      follow: (view) => view.composer,
      validate(step, def, path, report) {
        if (typeof step.prompt !== "string" || !step.prompt) report.error(`${path}.prompt`, "must be the message the user sends.");
        else checkReferences(step.prompt, def, `${path}.prompt`, report);
        if (step.draft !== void 0 && typeof step.draft !== "boolean") report.error(`${path}.draft`, "must be true or false.");
      },
      order(facts, step) {
        rememberReferences(facts, step.prompt);
        facts.draft = step.draft === true;
      },
      async run(view, step, ctx) {
        ctx.camera?.track(view.typed, view.composer);
        await ctx.cursor.moveTo(view.composer, ctx, { dx: 0.3, dy: 0.3 });
        await ctx.cursor.click(ctx);
        view.composer.classList.add("cf-typing");
        await typeDraft(view, step.prompt, ctx);
        view.draft = step.prompt;
        if (step.draft) return;
        await ctx.wait(350);
        await sendDraft(view, ctx);
      }
    },
    send: {
      summary: 'Send the message left in the composer by a "prompt" step with "draft": true. Use { "send": true }.',
      keys: [],
      follow: (view) => view.composer,
      validate(step, _def, path, report) {
        if (step.send !== true) report.error(`${path}.send`, "must be true.");
      },
      order(facts, _step, path, report) {
        if (!facts.draft) report.warn(path, 'there is no draft to send; add a "prompt" step with "draft": true first.');
        facts.draft = false;
      },
      async run(view, _step, ctx) {
        if (view.draft === null) return;
        await ctx.cursor.moveTo(view.sendButton, ctx);
        await ctx.cursor.click(ctx);
        await sendDraft(view, ctx);
      }
    },
    hover: {
      summary: 'Point at a file reference in the chat: a preview card pops up. "zoom" (true or 1\u20132.5) moves the camera in on it; "ms" is how long it stays.',
      part: "file",
      keys: ["zoom", "ms"],
      validate(step, _def, path, report) {
        const zoomOk = step.zoom === void 0 || typeof step.zoom === "boolean" || typeof step.zoom === "number" && step.zoom >= 1 && step.zoom <= 2.5;
        if (!zoomOk) report.error(`${path}.zoom`, "must be true, false, or a zoom amount from 1 to 2.5.");
        if (step.ms !== void 0 && (typeof step.ms !== "number" || step.ms < 0 || step.ms > 1e4)) report.error(`${path}.ms`, "must be milliseconds between 0 and 10000.");
      },
      order(facts, step, path, report) {
        const id = String(step.hover).split(":").slice(1).join(":");
        if (!facts.references?.has(id)) report.warn(path, `"@${id}" isn't in the chat yet; mention it in a "prompt" or "respond" step first.`);
      },
      async run(view, step, ctx) {
        const chip = view.find("file", ctx.name);
        const file = view.files.get(ctx.name);
        if (!chip || !file || ctx.fast) return;
        await ctx.cursor.moveTo(chip, ctx, { dx: 0.35, dy: 0.6 });
        const card = view.peek(file, chip);
        await ctx.wait(300);
        const zoom = step.zoom === true ? 1 : step.zoom;
        if (zoom && ctx.camera) {
          await ctx.camera.look(card, { zoom });
          await ctx.wait(step.ms ?? PEEK_MS);
          await ctx.camera.back();
        } else {
          await ctx.wait(step.ms ?? PEEK_MS);
        }
        view.unpeek();
        await ctx.wait(250);
      }
    },
    think: {
      summary: "Show the assistant thinking for a moment (milliseconds).",
      keys: [],
      follow: (view) => view.el.querySelector(".cf-ai-thread"),
      validate(step, _def, path, report) {
        if (typeof step.think !== "number" || step.think < 0 || step.think > 1e4) report.error(`${path}.think`, "must be milliseconds between 0 and 10000.");
      },
      async run(view, step, ctx) {
        const node = view.addThinking();
        await ctx.wait(step.think);
        node.remove();
      }
    },
    tool: {
      summary: "The assistant calls a connector tool: a block shows the tool, its input, then its result.",
      keys: ["connector", "input", "result", "ms"],
      follow: (view) => view.el.querySelector(".cf-ai-thread"),
      validate(step, def, path, report) {
        if (typeof step.tool !== "string" || !step.tool) report.error(`${path}.tool`, 'must be the tool name, e.g. "create_invoice".');
        const ids = connectorIds(def);
        if (step.connector !== void 0 && !ids.includes(step.connector)) report.error(`${path}.connector`, `"${step.connector}" isn't one of this screen's connectors.`, suggest(step.connector, ids));
        if (step.input !== void 0 && !isObject(step.input)) report.error(`${path}.input`, "must be an object of the tool's arguments.");
        if (step.result !== void 0 && typeof step.result !== "string") report.error(`${path}.result`, "must be a short string describing what came back.");
        if (step.ms !== void 0 && (typeof step.ms !== "number" || step.ms < 0 || step.ms > 1e4)) report.error(`${path}.ms`, "must be milliseconds between 0 and 10000.");
      },
      async run(view, step, ctx) {
        const { block, result } = view.addTool(step.connector, step.tool, step.input);
        block.classList.add("cf-running");
        await ctx.wait(step.ms ?? 900);
        block.classList.remove("cf-running");
        block.classList.add("cf-ok");
        if (step.result) result.textContent = step.result;
        await ctx.wait(350);
      }
    },
    respond: {
      summary: 'The assistant replies. Supports paragraphs, "- " bullet lines, *bold*, `code`, and @file references.',
      keys: [],
      follow: (view) => view.el.querySelector(".cf-ai-thread"),
      validate(step, def, path, report) {
        if (typeof step.respond !== "string" || !step.respond) report.error(`${path}.respond`, "must be the assistant's reply text.");
        else checkReferences(step.respond, def, `${path}.respond`, report);
      },
      order(facts, step) {
        rememberReferences(facts, step.respond);
      },
      async run(view, step, ctx) {
        view.addReply(step.respond);
        await ctx.wait(1800);
      }
    }
  }
};

// src/surfaces/browser-app.css
var browser_app_default = "/* browser-app surface: a web app in a browser window */\n\n.cf-browser {\n    background: var(--cf-win);\n}\n\n.cf-bw-chrome {\n    flex-shrink: 0;\n    background: color-mix(in srgb, var(--cf-stage) 55%, var(--cf-win-2));\n    border-bottom: 1px solid var(--cf-line);\n}\n\n.cf-bw-tabs {\n    display: flex;\n    align-items: flex-end;\n    gap: 14px;\n    height: 40px;\n    padding: 0 12px;\n}\n\n.cf-bw-dots {\n    display: flex;\n    gap: 6px;\n    align-self: center;\n}\n\n.cf-bw-dots i {\n    width: 11px;\n    height: 11px;\n    border-radius: 50%;\n    background: #ff5f57;\n}\n\n.cf-bw-dots i:nth-child(2) { background: #febc2e; }\n.cf-bw-dots i:nth-child(3) { background: #28c840; }\n\n.cf-bw-tab {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    max-width: 280px;\n    padding: 8px 12px;\n    background: var(--cf-win-2);\n    border-radius: 9px 9px 0 0;\n    font-size: 12.5px;\n    font-weight: 600;\n    white-space: nowrap;\n}\n\n.cf-bw-tab span:nth-child(2) {\n    overflow: hidden;\n    text-overflow: ellipsis;\n}\n\n.cf-bw-tab .cf-appicon {\n    width: 16px;\n    height: 16px;\n    border-radius: 4px;\n    font-size: 7px;\n}\n\n.cf-bw-x {\n    margin-left: 4px;\n    color: var(--cf-faint);\n}\n\n.cf-bw-bar {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 7px 12px 8px;\n    background: var(--cf-win-2);\n}\n\n.cf-bw-nav {\n    color: var(--cf-faint);\n    font-size: 14px;\n    letter-spacing: 0.08em;\n    white-space: nowrap;\n}\n\n.cf-bw-url {\n    display: flex;\n    flex: 1;\n    align-items: center;\n    gap: 8px;\n    min-width: 0;\n    padding: 6px 12px;\n    overflow: hidden;\n    background: var(--cf-win);\n    border: 1px solid var(--cf-line);\n    border-radius: 999px;\n    color: var(--cf-dim);\n    font-size: 12.5px;\n    white-space: nowrap;\n}\n\n.cf-bw-lock {\n    font-size: 10px;\n}\n\n.cf-ba-app {\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    min-height: 0;\n}\n\n.cf-ba-header {\n    display: flex;\n    align-items: center;\n    gap: 14px;\n    height: 52px;\n    flex-shrink: 0;\n    padding: 0 16px;\n    border-bottom: 1px solid var(--cf-line);\n}\n\n.cf-ba-brand {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    font-size: 17px;\n    font-weight: 850;\n    letter-spacing: -0.02em;\n}\n\n.cf-ba-company {\n    padding: 4px 10px;\n    background: var(--cf-win-2);\n    border-radius: 7px;\n    color: var(--cf-dim);\n    font-size: 12.5px;\n    font-weight: 600;\n    white-space: nowrap;\n}\n\n.cf-ba-search {\n    flex: 1;\n    max-width: 220px;\n    margin-left: auto;\n    padding: 6px 12px;\n    background: var(--cf-win-2);\n    border: 1px solid var(--cf-line);\n    border-radius: 999px;\n    color: var(--cf-faint);\n    font-size: 12.5px;\n}\n\n.cf-ba-new,\n.cf-ba-primary {\n    padding: 6px 14px;\n    background: var(--app);\n    border-radius: 999px;\n    color: #fff;\n    font-size: 12.5px;\n    font-weight: 750;\n    white-space: nowrap;\n}\n\n.cf-ba-avatar {\n    width: 30px;\n    height: 30px;\n    border-radius: 50%;\n    font-size: 10px;\n}\n\n.cf-ba-body {\n    position: relative;\n    display: flex;\n    flex: 1;\n    min-height: 0;\n    overflow: hidden;\n}\n\n.cf-ba-nav {\n    width: 150px;\n    flex-shrink: 0;\n    padding: 12px 8px;\n    background: color-mix(in srgb, var(--cf-win-2) 85%, var(--cf-stage));\n    border-right: 1px solid var(--cf-line);\n}\n\n.cf-ba-link {\n    margin-bottom: 2px;\n    padding: 8px 12px;\n    border-left: 3px solid transparent;\n    border-radius: 6px;\n    color: var(--cf-dim);\n    font-size: 13px;\n    font-weight: 600;\n}\n\n.cf-ba-link.cf-active {\n    background: color-mix(in srgb, var(--app) 16%, transparent);\n    border-left-color: var(--app);\n    color: var(--cf-text);\n    font-weight: 750;\n}\n\n.cf-ba-page {\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    gap: 14px;\n    min-width: 0;\n    padding: 16px 20px;\n}\n\n.cf-ba-title-row {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n}\n\n.cf-ba-title {\n    font-size: 22px;\n    font-weight: 850;\n    letter-spacing: -0.02em;\n}\n\n.cf-ba-cards {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));\n    gap: 10px;\n}\n\n.cf-ba-card {\n    padding: 10px 12px;\n    background: var(--cf-win-2);\n    border: 1px solid var(--cf-line);\n    border-left: 3px solid var(--tone);\n    border-radius: 10px;\n}\n\n.cf-ba-card-label {\n    color: var(--cf-dim);\n    font-size: 11.5px;\n    font-weight: 600;\n}\n\n.cf-ba-card-value {\n    margin-top: 3px;\n    font-size: 18px;\n    font-weight: 850;\n}\n\n.cf-ba-table-wrap {\n    flex: 1;\n    min-height: 0;\n    overflow: hidden;\n    border: 1px solid var(--cf-line);\n    border-radius: 10px;\n}\n\n.cf-ba-table {\n    width: 100%;\n    border-collapse: collapse;\n    font-size: 13px;\n}\n\n.cf-ba-table th {\n    padding: 9px 10px;\n    background: var(--cf-win-2);\n    color: var(--cf-dim);\n    font-size: 11px;\n    font-weight: 750;\n    letter-spacing: 0.05em;\n    text-align: left;\n    text-transform: uppercase;\n}\n\n.cf-ba-table td {\n    padding: 10px;\n    border-top: 1px solid var(--cf-line);\n    overflow-wrap: anywhere;\n}\n\n.cf-ba-row.cf-pending {\n    display: none;\n}\n\n.cf-ba-row.cf-added {\n    animation: cf-ba-row-in 1200ms ease;\n}\n\n@keyframes cf-ba-row-in {\n    0% { background: color-mix(in srgb, var(--app) 40%, transparent); opacity: 0; }\n    25% { opacity: 1; }\n    100% { background: transparent; }\n}\n\n.cf-ba-row.cf-selected {\n    background: color-mix(in srgb, var(--app) 14%, transparent);\n}\n\n.cf-pill {\n    display: inline-block;\n    padding: 2px 9px;\n    border-radius: 999px;\n    background: color-mix(in srgb, var(--tone) 18%, transparent);\n    color: var(--tone);\n    font-size: 11.5px;\n    font-weight: 750;\n    white-space: nowrap;\n}\n\n.cf-tone-ok { --tone: var(--cf-ok); }\n.cf-tone-info { --tone: #60a5fa; }\n.cf-tone-warn { --tone: var(--cf-warn); }\n.cf-tone-danger { --tone: #f87171; }\n.cf-tone-muted { --tone: var(--cf-dim); }\n\n.cf-ba-drawer {\n    position: absolute;\n    top: 0;\n    right: 0;\n    bottom: 0;\n    z-index: 4;\n    width: 46%;\n    background: var(--cf-win);\n    border-left: 1px solid var(--cf-line-strong);\n    box-shadow: var(--cf-shadow);\n    transform: translateX(105%);\n    transition: transform 400ms cubic-bezier(0.3, 0.7, 0.2, 1);\n}\n\n.cf-ba-drawer.cf-open {\n    transform: none;\n}\n\n.cf-ba-drawer-head {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding: 14px 16px;\n    border-bottom: 1px solid var(--cf-line);\n}\n\n.cf-ba-drawer-title {\n    font-size: 16px;\n    font-weight: 850;\n}\n\n.cf-ba-drawer-body {\n    padding: 8px 16px;\n}\n\n.cf-ba-field {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    padding: 8px 0;\n    border-bottom: 1px solid var(--cf-line);\n    font-size: 13px;\n}\n\n.cf-ba-field span:first-child {\n    color: var(--cf-dim);\n}\n\n.cf-ba-field b {\n    text-align: right;\n    overflow-wrap: anywhere;\n}\n\n.cf-ba-toast {\n    position: absolute;\n    top: 104px;\n    right: 18px;\n    z-index: 6;\n    padding: 9px 16px;\n    background: var(--cf-ok);\n    border-radius: 8px;\n    color: #fff;\n    font-size: 13.5px;\n    font-weight: 750;\n    box-shadow: var(--cf-shadow);\n    opacity: 0;\n    transform: translateY(-8px);\n    transition: opacity 250ms ease, transform 250ms ease;\n}\n\n.cf-ba-toast.cf-show {\n    opacity: 1;\n    transform: none;\n}\n";

// src/surfaces/browser-app.js
var ROW_ID = /^[\w-]+$/;
var TONES = ["ok", "warn", "danger", "info", "muted"];
function toneOf(status) {
  const text = String(status ?? "").toLowerCase();
  if (/(paid|done|complete|active|sent|success)/.test(text)) return text.includes("sent") ? "info" : "ok";
  if (/(overdue|failed|error|declined)/.test(text)) return "danger";
  if (/(due|pending|draft|review)/.test(text)) return "warn";
  return "muted";
}
function validateApp(def, path, report) {
  for (const key of ["url", "tab", "company", "title", "active"]) {
    if (def[key] !== void 0 && typeof def[key] !== "string") report.error(`${path}.${key}`, "must be a string.");
  }
  if (def.nav !== void 0 && (!Array.isArray(def.nav) || def.nav.some((item) => typeof item !== "string"))) report.error(`${path}.nav`, "must be an array of navigation labels.");
  if (def.active !== void 0 && Array.isArray(def.nav) && !def.nav.includes(def.active)) report.warn(`${path}.active`, `"${def.active}" isn't in nav.`, suggest(def.active, def.nav));
  if (def.summary !== void 0) {
    if (!Array.isArray(def.summary)) report.error(`${path}.summary`, 'must be an array of { "label", "value", "tone"? } cards.');
    else {
      def.summary.forEach((card, i) => {
        if (!isObject(card) || typeof card.label !== "string" || typeof card.value !== "string") report.error(`${path}.summary[${i}]`, 'needs "label" and "value" strings.');
        else if (card.tone !== void 0 && !TONES.includes(card.tone)) report.error(`${path}.summary[${i}].tone`, `must be one of ${TONES.join(", ")}.`, suggest(card.tone, TONES));
      });
    }
  }
  if (!Array.isArray(def.columns) || def.columns.length === 0 || def.columns.some((c) => typeof c !== "string")) {
    report.error(`${path}.columns`, 'is required: an array of column headings, e.g. ["No.", "Customer", "Amount", "Status"].');
    return;
  }
  if (!Array.isArray(def.rows)) {
    report.error(`${path}.rows`, 'is required: an array of rows: [{ "id": "1042", "cells": [...], "status": "Sent" }].');
    return;
  }
  const seen = /* @__PURE__ */ new Set();
  def.rows.forEach((row2, i) => {
    const at = `${path}.rows[${i}]`;
    if (!isObject(row2)) {
      report.error(at, "must be an object.");
      return;
    }
    if (typeof row2.id !== "string" || !ROW_ID.test(row2.id)) report.error(`${at}.id`, 'must be a short id (letters, digits, "_" or "-").');
    else if (seen.has(row2.id)) report.error(`${at}.id`, `"${row2.id}" is used twice.`);
    seen.add(row2.id);
    const expected = def.columns.length - (row2.status !== void 0 ? 1 : 0);
    if (!Array.isArray(row2.cells) || row2.cells.some((c) => !["string", "number"].includes(typeof c))) report.error(`${at}.cells`, "must be an array of strings or numbers.");
    else if (row2.cells.length !== expected) report.warn(`${at}.cells`, `has ${row2.cells.length} cells; with ${def.columns.length} columns${row2.status !== void 0 ? " and a status" : ""} it should have ${expected}.`);
    if (row2.status !== void 0 && typeof row2.status !== "string") report.error(`${at}.status`, "must be a string.");
    if (row2.new !== void 0 && typeof row2.new !== "boolean") report.error(`${at}.new`, "must be true or false.");
    if (row2.detail !== void 0 && (!isObject(row2.detail) || Object.values(row2.detail).some((v) => typeof v !== "string"))) report.error(`${at}.detail`, "must map labels to strings.");
  });
}
var rowIds = (def) => Array.isArray(def.rows) ? def.rows.map((row2) => row2.id) : [];
var rowById = (def, id) => def.rows.find((row2) => row2.id === id);
function statusPill(status, tone) {
  return h("span", { class: `cf-pill cf-tone-${tone ?? toneOf(status)}`, text: status });
}
function render2(def) {
  const { app } = def;
  const tab = h("div", { class: "cf-bw-tab" }, [appIcon(app), h("span", { text: def.tab ?? `${def.title ?? "Home"} \xB7 ${app.name}` }), h("span", { class: "cf-bw-x", text: "\xD7" })]);
  const chrome = h("div", { class: "cf-bw-chrome" }, [
    h("div", { class: "cf-bw-tabs" }, [h("span", { class: "cf-bw-dots", "aria-hidden": "true" }, [h("i"), h("i"), h("i")]), tab]),
    h("div", { class: "cf-bw-bar" }, [
      h("span", { class: "cf-bw-nav", text: "\u2039  \u203A  \u27F3" }),
      h("div", { class: "cf-bw-url" }, [h("span", { class: "cf-bw-lock", text: "\u{1F512}" }), h("span", { text: def.url ?? "app.example.com" })])
    ])
  ]);
  const header = h("div", { class: "cf-ba-header" }, [
    h("div", { class: "cf-ba-brand" }, [appIcon(app), h("span", { text: app.name.toLowerCase() })]),
    def.company ? h("div", { class: "cf-ba-company", text: def.company }) : null,
    h("div", { class: "cf-ba-search", text: "Search" }),
    h("span", { class: "cf-ba-new", text: "+ New" }),
    h("span", { class: "cf-avatar cf-ba-avatar", style: { "--avatar": "var(--app)" }, text: initials(def.company ?? app.name) })
  ]);
  const nav = h("div", { class: "cf-ba-nav" }, (def.nav ?? []).map((item) => h("div", { class: item === def.active ? "cf-ba-link cf-active" : "cf-ba-link", text: item })));
  const summary = Array.isArray(def.summary) && def.summary.length ? h("div", { class: "cf-ba-cards" }, def.summary.map((card) => h("div", { class: `cf-ba-card cf-tone-${card.tone ?? "muted"}` }, [
    h("div", { class: "cf-ba-card-label", text: card.label }),
    h("div", { class: "cf-ba-card-value", text: card.value })
  ]))) : null;
  const statusIndex = def.columns.length - 1;
  const rowEl = (row2) => h("tr", { class: row2.new ? "cf-ba-row cf-pending" : "cf-ba-row", dataset: { row: row2.id } }, [
    ...row2.cells.map((cell) => h("td", { text: String(cell) })),
    row2.status !== void 0 ? h("td", {}, statusPill(row2.status, row2.tone)) : null
  ]);
  const tbody = h("tbody", {}, def.rows.map(rowEl));
  const table = h("table", { class: "cf-ba-table" }, [
    h("thead", {}, h("tr", {}, def.columns.map((column, i) => h("th", { class: i === statusIndex ? "cf-ba-status-col" : null, text: column })))),
    tbody
  ]);
  const drawerBody = h("div", { class: "cf-ba-drawer-body" });
  const drawerTitle = h("div", { class: "cf-ba-drawer-title" });
  const drawer = h("div", { class: "cf-ba-drawer" }, [h("div", { class: "cf-ba-drawer-head" }, [drawerTitle, h("span", { class: "cf-bw-x", text: "\xD7" })]), drawerBody]);
  const toast = h("div", { class: "cf-ba-toast", role: "status" });
  const page = h("div", { class: "cf-ba-page" }, [
    h("div", { class: "cf-ba-title-row" }, [h("div", { class: "cf-ba-title", text: def.title ?? "Overview" }), h("span", { class: "cf-ba-primary", text: `Create ${(def.title ?? "item").replace(/s$/, "").toLowerCase()}` })]),
    summary,
    h("div", { class: "cf-ba-table-wrap" }, table)
  ]);
  const el = h("div", { class: "cf-window cf-browser" }, [
    chrome,
    h("div", { class: "cf-ba-app" }, [header, h("div", { class: "cf-ba-body" }, [nav, page, drawer])]),
    toast
  ]);
  return {
    el,
    find: (part, name) => part === "row" ? byData(el, "row", name) : null,
    reveal(id) {
      const row2 = byData(tbody, "row", id);
      if (!row2) return;
      row2.classList.remove("cf-pending");
      row2.classList.add("cf-added");
    },
    setStatus(id, status) {
      const cell = byData(tbody, "row", id)?.lastElementChild;
      if (cell) cell.replaceChildren(statusPill(status));
    },
    select(id) {
      for (const row2 of tbody.children) row2.classList.toggle("cf-selected", row2.dataset.row === id);
      const data = rowById(def, id);
      if (!data) return;
      drawerTitle.textContent = `${def.columns[0]} ${data.cells[0]}`;
      const fields = def.columns.slice(1, data.cells.length).map((column, i) => [column, String(data.cells[i + 1])]);
      const extra = isObject(data.detail) ? Object.entries(data.detail) : [];
      drawerBody.replaceChildren(
        ...[...fields, ...extra].map(([label, value]) => h("div", { class: "cf-ba-field" }, [h("span", { text: label }), h("b", { text: value })])),
        data.status ? h("div", { class: "cf-ba-field" }, [h("span", { text: "Status" }), statusPill(byData(tbody, "row", id)?.querySelector(".cf-pill")?.textContent ?? data.status)]) : null
      );
      drawer.classList.add("cf-open");
    },
    showToast(text) {
      toast.textContent = `\u2713 ${text}`;
      toast.classList.add("cf-show");
    },
    hideToast() {
      toast.classList.remove("cf-show");
    }
  };
}
var browser_app_default2 = {
  name: "browser-app",
  summary: "A web app in a browser window: header, side navigation, summary cards, and a data table whose rows can appear, change status, and open in a drawer.",
  width: 560,
  keys: ["url", "tab", "company", "title", "nav", "active", "summary", "columns", "rows"],
  styles: browser_app_default,
  parts: {
    row: rowIds
  },
  validate: validateApp,
  render: render2,
  actions: {
    add: {
      summary: 'Reveal a row marked "new": true, highlighted as it appears.',
      part: "row",
      keys: [],
      validate(step, def, path, report) {
        const id = String(step.add).split(":").slice(1).join(":");
        const row2 = Array.isArray(def.rows) ? rowById(def, id) : null;
        if (row2 && row2.new !== true) report.warn(`${path}.add`, `row "${id}" is already visible; mark it "new": true so it appears on this step.`);
      },
      async run(view, _step, ctx) {
        view.reveal(ctx.name);
        await ctx.wait(650);
      }
    },
    status: {
      summary: "Change a row's status pill, e.g. Draft \u2192 Sent.",
      part: "row",
      keys: ["to"],
      validate(step, _def, path, report) {
        if (typeof step.to !== "string" || !step.to) report.error(`${path}.to`, 'is required: the new status, e.g. "Paid".');
      },
      async run(view, step, ctx) {
        view.setStatus(ctx.name, step.to);
        await ctx.wait(700);
      }
    },
    select: {
      summary: "Click a row to open its details in a drawer.",
      part: "row",
      keys: [],
      async run(view, _step, ctx) {
        const row2 = view.find("row", ctx.name);
        if (row2) {
          await ctx.cursor.moveTo(row2, ctx, { dx: 0.3 });
          await ctx.cursor.click(ctx);
        }
        view.select(ctx.name);
        await ctx.wait(900);
      }
    },
    toast: {
      summary: "Show a confirmation toast.",
      keys: [],
      validate(step, _def, path, report) {
        if (typeof step.toast !== "string" || !step.toast) report.error(`${path}.toast`, "must be the toast text.");
      },
      async run(view, step, ctx) {
        view.showToast(step.toast);
        await ctx.wait(1700);
        view.hideToast();
      }
    }
  }
};

// src/surfaces/crm-record.js
var isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
var stageFieldOf = (record) => record.stageField ?? "Stage";
var buttonsOf = (record) => record.buttons ?? ["Save"];
function optionsFor(record, field) {
  if (field === stageFieldOf(record) && Array.isArray(record.stages)) return record.stages;
  return Array.isArray(record.options?.[field]) ? record.options[field] : null;
}
function validateRecord(def, path, report) {
  const record = def.record;
  if (!isObject(record)) {
    report.error(`${path}.record`, 'is required: { "title": "...", "fields": { "Stage": "Negotiation" } }.');
    return;
  }
  if (typeof record.title !== "string" || !record.title) report.error(`${path}.record.title`, "must be a non-empty string.");
  for (const key of ["module", "type", "stageField"]) {
    if (record[key] !== void 0 && typeof record[key] !== "string") report.error(`${path}.record.${key}`, "must be a string.");
  }
  if (record.options !== void 0 && (!isObject(record.options) || !Object.values(record.options).every(isStringList))) {
    report.error(`${path}.record.options`, "must map field names to arrays of option strings.");
  }
  if (!isObject(record.fields) || Object.keys(record.fields).length === 0) {
    report.error(`${path}.record.fields`, 'must be an object of field names to values, e.g. { "Amount": "$48,000" }.');
    return;
  }
  for (const [name, value] of Object.entries(record.fields)) {
    if (!["string", "number"].includes(typeof value)) report.error(`${path}.record.fields.${name}`, "must be a string or number.");
  }
  if (record.stages !== void 0) {
    if (!Array.isArray(record.stages) || record.stages.some((stage2) => typeof stage2 !== "string")) {
      report.error(`${path}.record.stages`, "must be an array of stage names.");
    } else {
      const field = stageFieldOf(record);
      if (!(field in record.fields)) report.error(`${path}.record.stageField`, `stage field "${field}" isn't in record.fields.`, suggest(field, Object.keys(record.fields)));
      else if (!record.stages.includes(String(record.fields[field]))) {
        report.error(`${path}.record.fields.${field}`, `"${record.fields[field]}" isn't one of record.stages.`, suggest(record.fields[field], record.stages));
      }
    }
  }
  if (record.buttons !== void 0 && (!Array.isArray(record.buttons) || record.buttons.some((b) => typeof b !== "string"))) {
    report.error(`${path}.record.buttons`, "must be an array of button labels; the first is the primary button.");
  }
  if (record.activity !== void 0) {
    if (!Array.isArray(record.activity)) report.error(`${path}.record.activity`, 'must be an array of { "text": "...", "time": "..." } entries, newest first.');
    else {
      record.activity.forEach((item, i) => {
        if (!isObject(item) || typeof item.text !== "string" || item.time !== void 0 && typeof item.time !== "string") {
          report.error(`${path}.record.activity[${i}]`, 'needs a "text" string (and optionally a "time" string).');
        }
      });
    }
  }
}
function activityItem(item, isNew = false) {
  return h("li", { class: isNew ? "cf-act cf-new" : "cf-act" }, [
    h("span", { class: "cf-act-dot", "aria-hidden": "true" }),
    h("span", { class: "cf-act-text", text: item.text }),
    item.time ? h("span", { class: "cf-act-time", text: item.time }) : null
  ]);
}
function render3(def) {
  const { record } = def;
  const stages = Array.isArray(record.stages) ? record.stages : [];
  const { el, body } = appWindow(def.app, { title: record.module ?? "Records", className: "cf-crm" });
  const path = stages.length ? h("div", { class: "cf-path" }, stages.map((stage2) => h("span", { dataset: { stage: stage2 }, text: stage2 }))) : null;
  const fields = Object.entries(record.fields).map(([name, value]) => {
    const options = optionsFor(record, name);
    const control = options ? h("div", { class: "cf-select" }, [
      h("span", { class: "cf-val", text: String(value) }),
      h("span", { class: "cf-caret", text: "\u25BE" }),
      h("div", { class: "cf-menu" }, options.map((option) => h("div", { class: "cf-opt", dataset: { value: option }, text: option })))
    ]) : h("div", { class: "cf-val", text: String(value) });
    return h("div", { class: "cf-field", dataset: { field: name } }, [h("label", { text: name }), control]);
  });
  const buttons = buttonsOf(record).map((label, i) => h("button", {
    class: i === 0 ? "cf-btn cf-primary" : "cf-btn",
    type: "button",
    tabindex: "-1",
    dataset: { button: label },
    text: label
  }));
  const toast = h("div", { class: "cf-toast", role: "status" });
  const activity = h("ul", { class: "cf-activity-list" }, (record.activity ?? []).map((item) => activityItem(item)));
  body.append(
    h("div", { class: "cf-crm-head" }, [
      h("div", { class: "cf-crm-type", text: record.type ?? "Record" }),
      h("div", { class: "cf-crm-title", text: record.title }),
      path
    ]),
    h("div", { class: "cf-crm-tabs" }, [h("span", { class: "cf-active", text: "Details" }), h("span", { text: "Activity" }), h("span", { text: "Files" })]),
    h("div", { class: "cf-crm-fields" }, fields),
    h("div", { class: "cf-activity" }, [h("div", { class: "cf-activity-label", text: "Recent activity" }), activity]),
    h("div", { class: "cf-crm-actions" }, buttons)
  );
  el.append(toast);
  let changedStage = null;
  const view = {
    el,
    find: (part, name) => part === "field" ? byData(el, "field", name) : part === "button" ? byData(el, "button", name) : null,
    setStage(value) {
      if (!path) return;
      const index = stages.indexOf(value);
      [...path.children].forEach((chip, i) => {
        chip.classList.toggle("cf-done", i < index);
        chip.classList.toggle("cf-current", i === index);
        chip.classList.toggle("cf-won", i === index && index === stages.length - 1);
      });
    },
    setField(name, value) {
      const field = byData(el, "field", name);
      if (!field) return;
      field.querySelector(".cf-val").textContent = value;
      field.classList.add("cf-dirty");
      if (name === stageFieldOf(record)) {
        view.setStage(value);
        changedStage = value;
      }
    },
    save() {
      const changed = el.querySelectorAll(".cf-dirty");
      for (const field of changed) field.classList.remove("cf-dirty");
      if (changed.length) {
        const text = changedStage ? `Stage changed to ${changedStage}` : "Record updated";
        activity.prepend(activityItem({ text, time: "just now" }, true));
        changedStage = null;
      }
    },
    showToast(text) {
      toast.textContent = `\u2713 ${text}`;
      toast.classList.add("cf-show");
    },
    hideToast() {
      toast.classList.remove("cf-show");
    },
    closeMenus() {
      for (const select of el.querySelectorAll(".cf-select.cf-open")) select.classList.remove("cf-open");
    }
  };
  view.setStage(String(record.fields[stageFieldOf(record)] ?? ""));
  return view;
}
var crm_record_default = {
  name: "crm-record",
  summary: "A CRM record: title, stage path, fields (dropdowns where options exist), and buttons.",
  width: 430,
  keys: ["record"],
  parts: {
    field: (def) => Object.keys(def.record?.fields ?? {}),
    button: (def) => buttonsOf(def.record ?? {})
  },
  validate: validateRecord,
  render: render3,
  recap: (view) => view.closeMenus(),
  actions: {
    choose: {
      summary: "Open a dropdown field and pick a value.",
      part: "field",
      keys: ["value"],
      validate(step, def, path, report) {
        const field = String(step.choose).split(":").slice(1).join(":");
        const options = def.record ? optionsFor(def.record, field) : null;
        if (!options) report.error(`${path}.choose`, `field "${field}" isn't a dropdown; give it options via record.stages or record.options.`);
        else if (!options.includes(step.value)) report.error(`${path}.value`, `"${step.value}" isn't an option for ${field}.`, suggest(step.value, options));
      },
      async run(view, step, ctx) {
        const select = view.find("field", ctx.name)?.querySelector(".cf-select");
        if (!select) return;
        await ctx.cursor.moveTo(select, ctx);
        await ctx.cursor.click(ctx);
        select.classList.add("cf-open");
        await ctx.wait(500);
        const option = byData(select, "value", step.value);
        if (option) {
          await ctx.cursor.moveTo(option, ctx);
          option.classList.add("cf-hover");
          await ctx.cursor.click(ctx);
        }
        select.classList.remove("cf-open");
        view.setField(ctx.name, step.value);
        await ctx.wait(400);
      }
    },
    type: {
      summary: "Type into a field.",
      part: "field",
      keys: ["text"],
      validate(step, _def, path, report) {
        if (typeof step.text !== "string") report.error(`${path}.text`, "must be the text to type.");
      },
      async run(view, step, ctx) {
        const field = view.find("field", ctx.name);
        const value = field?.querySelector(".cf-val");
        if (!value) return;
        await ctx.cursor.moveTo(value, ctx);
        await ctx.cursor.click(ctx);
        field.classList.add("cf-editing");
        await typeInto(value, step.text, ctx);
        field.classList.remove("cf-editing");
        field.classList.add("cf-dirty");
        await ctx.wait(300);
      }
    },
    click: {
      summary: "Click a button. Clicking the primary (first) button saves the record.",
      part: "button",
      keys: [],
      async run(view, _step, ctx) {
        const button = view.find("button", ctx.name);
        if (!button) return;
        await ctx.cursor.moveTo(button, ctx);
        button.classList.add("cf-pressed");
        await ctx.cursor.click(ctx);
        button.classList.remove("cf-pressed");
        if (button.classList.contains("cf-primary")) view.save();
        await ctx.wait(250);
      }
    },
    toast: {
      summary: 'Show a confirmation toast, e.g. "Saved".',
      keys: [],
      validate(step, _def, path, report) {
        if (typeof step.toast !== "string" || !step.toast) report.error(`${path}.toast`, 'must be the toast text, e.g. "Opportunity saved".');
      },
      async run(view, step, ctx) {
        view.showToast(step.toast);
        await ctx.wait(1700);
        view.hideToast();
      }
    }
  }
};

// src/surfaces/flow-canvas.js
var NODE_ID = /^[A-Za-z_][\w-]*$/;
var MAX_NODES = 6;
function validateFlow(def, path, report, screens) {
  if (def.workflow !== void 0 && typeof def.workflow !== "string") report.error(`${path}.workflow`, "must be the workflow name.");
  if (!Array.isArray(def.nodes) || def.nodes.length < 2) {
    report.error(`${path}.nodes`, 'must be an array of at least 2 nodes: [{ "id": "trigger", "title": "...", "sub": "..." }, ...].');
    return;
  }
  if (def.nodes.length > MAX_NODES) report.warn(`${path}.nodes`, `has ${def.nodes.length} nodes; more than ${MAX_NODES} get cramped.`);
  const seen = /* @__PURE__ */ new Set();
  def.nodes.forEach((node, i) => {
    const at = `${path}.nodes[${i}]`;
    if (!isObject(node)) {
      report.error(at, "must be an object.");
      return;
    }
    if (typeof node.id !== "string" || !NODE_ID.test(node.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-".');
    else if (seen.has(node.id)) report.error(`${at}.id`, `"${node.id}" is used twice; node ids must be unique.`);
    seen.add(node.id);
    if (typeof node.title !== "string" || !node.title) report.error(`${at}.title`, "must be a non-empty string.");
    if (node.sub !== void 0 && typeof node.sub !== "string") report.error(`${at}.sub`, "must be a string.");
    if (node.params !== void 0 && (!isObject(node.params) || Object.values(node.params).some((v) => !["string", "number", "boolean"].includes(typeof v)))) {
      report.error(`${at}.params`, "must map parameter names to strings, numbers, or booleans.");
    }
    if (node.app !== void 0 && !hasOwn(screens, node.app)) {
      report.error(`${at}.app`, `"${node.app}" isn't a screen id; use it to borrow that screen's app icon and colour.`, suggest(node.app, Object.keys(screens ?? {})));
    }
    if (node.color !== void 0 && !isHexColor(node.color)) report.error(`${at}.color`, "must be a hex colour.");
    if (node.icon !== void 0 && (typeof node.icon !== "string" || node.icon.length > 4)) report.error(`${at}.icon`, "must be 1\u20134 characters.");
    if (node.trigger !== void 0 && typeof node.trigger !== "boolean") report.error(`${at}.trigger`, "must be true or false.");
  });
}
function nodeBrand(node, screens) {
  const app = node.app && hasOwn(screens, node.app) ? screens[node.app].app : null;
  return {
    icon: node.icon ?? app?.icon ?? initials(node.title),
    color: node.color ?? app?.color ?? null
  };
}
var isTrigger = (node, index) => node.trigger ?? index === 0;
var itemCount = (output) => Array.isArray(output) ? output.length : 1;
function wireGeometry(canvas, fromTile, toTile) {
  const a = rectIn(canvas, fromTile);
  const b = rectIn(canvas, toTile);
  const x1 = a.x + a.w + 6;
  const y1 = a.y + a.h / 2;
  const x2 = b.x - 8;
  const y2 = b.y + b.h / 2;
  const bend = Math.max(24, (x2 - x1) * 0.5);
  return {
    d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
    arrow: `M ${x2 - 7} ${y2 - 5} L ${x2 + 1} ${y2} L ${x2 - 7} ${y2 + 5} Z`,
    mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
  };
}
function render4(def, { screens }) {
  const { el, body } = appWindow(def.app, {
    title: def.workflow ?? "Workflow",
    trailing: [
      h("span", { class: "cf-flow-tabs" }, [h("span", { class: "cf-flow-tab cf-active", text: "Editor" }), h("span", { class: "cf-flow-tab", text: "Executions" })]),
      h("span", { class: "cf-toggle" }, [h("span", { class: "cf-switch" }, h("i")), "Active"]),
      h("span", { class: "cf-save", text: "Save" })
    ],
    className: "cf-flow"
  });
  const lastIndex = def.nodes.length - 1;
  const nodeEls = def.nodes.map((node, i) => {
    const brand = nodeBrand(node, screens);
    const trigger = isTrigger(node, i);
    return h("div", {
      class: trigger ? "cf-node cf-trigger" : "cf-node",
      dataset: { node: node.id },
      style: brand.color ? { "--node": brand.color } : void 0
    }, [
      h("div", { class: "cf-node-tile" }, [
        trigger ? h("span", { class: "cf-node-bolt", "aria-hidden": "true", text: "\u26A1" }) : h("span", { class: "cf-handle cf-handle-in" }),
        h("span", { class: "cf-node-icon", text: brand.icon }),
        i < lastIndex ? h("span", { class: "cf-handle cf-handle-out" }) : null,
        h("span", { class: "cf-node-badge", "aria-hidden": "true" })
      ]),
      h("div", { class: "cf-node-title", text: node.title }),
      node.sub ? h("div", { class: "cf-node-sub", text: node.sub }) : null,
      h("div", { class: "cf-node-meta" })
    ]);
  });
  const wires = s("svg", { class: "cf-wires", "aria-hidden": "true" });
  const status = h("span", { class: "cf-run-status" });
  const canvas = h("div", { class: "cf-canvas" }, [
    h("div", { class: "cf-rail", "aria-hidden": "true" }, [h("i", { class: "cf-rail-on" }), h("i"), h("i"), h("i")]),
    wires,
    h("div", { class: "cf-nodes" }, nodeEls),
    h("div", { class: "cf-canvas-bar" }, [h("span", { class: "cf-test-btn", text: "\u25B6 Test workflow" }), status])
  ]);
  const ndvTitle = h("div", { class: "cf-ndv-title" });
  const ndvInput = h("div", { class: "cf-ndv-col cf-ndv-input" });
  const ndvParams = h("div", { class: "cf-ndv-col cf-ndv-params" });
  const ndv = h("div", { class: "cf-ndv" }, h("div", { class: "cf-ndv-panel" }, [
    h("div", { class: "cf-ndv-head" }, [h("span", { class: "cf-ndv-back", text: "\u2190 Back to canvas" }), ndvTitle]),
    h("div", { class: "cf-ndv-cols" }, [ndvInput, ndvParams])
  ]));
  canvas.append(ndv);
  const outputTitle = h("span", { class: "cf-output-title", text: "Output" });
  const outputCount = h("span", { class: "cf-output-count" });
  const outputData = h("pre");
  const output = h("div", { class: "cf-output" }, [
    h("div", { class: "cf-output-head" }, [
      outputTitle,
      outputCount,
      h("span", { class: "cf-output-tabs" }, [h("span", { text: "Table" }), h("span", { class: "cf-active", text: "JSON" })])
    ]),
    outputData
  ]);
  body.append(canvas, output);
  const state = { ran: 0, totalMs: 0, wires: [], outputs: {} };
  const nodeById = (id) => def.nodes.find((node) => node.id === id);
  return {
    el,
    state,
    find: (part, name) => part === "node" ? byData(el, "node", name) : null,
    drawWires() {
      const lit = state.wires.map((wire) => wire.group.classList.contains("cf-lit"));
      const labels = state.wires.map((wire) => wire.label.textContent);
      wires.replaceChildren();
      wires.setAttribute("width", String(canvas.offsetWidth));
      wires.setAttribute("height", String(canvas.offsetHeight));
      state.wires = nodeEls.slice(0, -1).map((nodeEl, i) => {
        const geometry = wireGeometry(canvas, nodeEl.querySelector(".cf-node-tile"), nodeEls[i + 1].querySelector(".cf-node-tile"));
        const label = s("text", { class: "cf-wire-label", x: String(geometry.mid.x), y: String(geometry.mid.y - 10), "text-anchor": "middle" }, labels[i] ?? "");
        const group = s("g", { class: lit[i] ? "cf-wire cf-lit" : "cf-wire" }, [
          s("path", { class: "cf-wire-line", d: geometry.d }),
          s("path", { class: "cf-wire-arrow", d: geometry.arrow }),
          label
        ]);
        wires.append(group);
        return { group, label };
      });
    },
    markRunning(id, running) {
      byData(el, "node", id)?.classList.toggle("cf-running", running);
    },
    markDone(id, ms, result, output2) {
      const nodeEl = byData(el, "node", id);
      if (!nodeEl) return;
      nodeEl.classList.add("cf-ok");
      nodeEl.querySelector(".cf-node-meta").textContent = [typeof ms === "number" ? `${ms} ms` : null, result].filter(Boolean).join(" \xB7 ");
      const wire = state.wires[nodeEls.indexOf(nodeEl)];
      if (wire) {
        const count = itemCount(output2);
        wire.label.textContent = `${count} ${count === 1 ? "item" : "items"}`;
        wire.group.classList.add("cf-lit");
      }
      if (output2 !== void 0) state.outputs[id] = output2;
      state.ran += 1;
      state.totalMs += typeof ms === "number" ? ms : 0;
      status.textContent = state.ran >= def.nodes.length ? `\u2713 Workflow executed successfully \xB7 ${state.totalMs} ms` : `Running \xB7 ${state.ran} of ${def.nodes.length}`;
      status.classList.toggle("cf-ok", state.ran >= def.nodes.length);
    },
    showOutput(id, data) {
      outputTitle.textContent = `Output \xB7 ${nodeById(id)?.title ?? id}`;
      const count = itemCount(data);
      outputCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
      outputData.replaceChildren(jsonNodes(data));
      output.classList.add("cf-open");
    },
    openDetails(id) {
      const node = nodeById(id);
      const index = def.nodes.indexOf(node);
      const brand = nodeBrand(node, screens);
      ndvTitle.replaceChildren(
        appIcon({ icon: brand.icon, name: node.title }, brand.color ?? void 0),
        h("div", {}, [h("div", { class: "cf-ndv-name", text: node.title }), node.sub ? h("div", { class: "cf-ndv-sub", text: node.sub }) : null])
      );
      const upstream = def.nodes.slice(0, index).reverse().find((prev) => state.outputs[prev.id] !== void 0);
      ndvInput.replaceChildren(
        h("div", { class: "cf-ndv-label", text: "Input" }),
        upstream ? h("pre", { class: "cf-ndv-json" }, jsonNodes(state.outputs[upstream.id])) : h("div", { class: "cf-ndv-empty", text: "No input data yet" })
      );
      const params = isObject(node.params) ? Object.entries(node.params) : [];
      ndvParams.replaceChildren(
        h("div", { class: "cf-ndv-label", text: "Parameters" }),
        ...params.map(([key, value]) => h("div", { class: "cf-param" }, [h("span", { text: key }), h("span", { class: "cf-param-val", text: String(value) })]))
      );
      ndv.classList.add("cf-open");
    },
    /** Add an expression field to the open node; returns the parts to animate. */
    addExpression(label) {
      const editor = h("div", { class: "cf-expr-box" });
      const resultLabel = h("div", { class: "cf-ndv-label cf-result-label", text: "Result" });
      const result = h("div", { class: "cf-result" });
      ndvParams.append(h("div", { class: "cf-ndv-label", text: label }), editor, resultLabel, result);
      return { editor, result, resultLabel };
    },
    closeDetails() {
      ndv.classList.remove("cf-open");
    }
  };
}
function expressionNodes(text) {
  const fragment = document.createDocumentFragment();
  for (const token of text.split(/(\{\{[^}]*\}\})/)) {
    if (!token) continue;
    fragment.append(token.startsWith("{{") ? h("span", { class: "cf-tok", text: token }) : token);
  }
  return fragment;
}
var flow_canvas_default = {
  name: "flow-canvas",
  summary: "A node-based automation editor: nodes run in order with timings and item counts, and open to show input, parameters, and an expression.",
  width: 620,
  keys: ["workflow", "nodes"],
  parts: {
    node: (def) => Array.isArray(def.nodes) ? def.nodes.map((node) => node.id) : []
  },
  validate: validateFlow,
  render: render4,
  mounted: (view) => view.drawWires(),
  relayout: (view) => view.drawWires(),
  recap: (view) => view.closeDetails(),
  actions: {
    run: {
      summary: 'Run a node: it spins, then shows a check, its time, and an optional result; its wire lights up with an item count. "output" fills the output panel.',
      part: "node",
      keys: ["ms", "output", "result"],
      validate(step, _def, path, report) {
        if (step.ms !== void 0 && (typeof step.ms !== "number" || step.ms < 0 || step.ms > 6e4)) report.error(`${path}.ms`, "must be milliseconds between 0 and 60000.");
        if (step.output !== void 0 && !isObject(step.output) && !Array.isArray(step.output)) report.error(`${path}.output`, "must be an object or array of the data this node outputs.");
        if (step.result !== void 0 && typeof step.result !== "string") report.error(`${path}.result`, 'must be a short string, e.g. "true".');
      },
      async run(view, step, ctx) {
        if (view.state.ran === 0) view.drawWires();
        view.markRunning(ctx.name, true);
        await ctx.wait(700);
        view.markRunning(ctx.name, false);
        view.markDone(ctx.name, step.ms, step.result, step.output);
        if (step.output !== void 0) view.showOutput(ctx.name, step.output);
        await ctx.wait(450);
      }
    },
    open: {
      summary: "Open a node to show its input data and parameters.",
      part: "node",
      keys: [],
      order: (facts) => {
        facts.opened = true;
      },
      async run(view, _step, ctx) {
        const nodeEl = view.find("node", ctx.name);
        if (nodeEl) {
          await ctx.cursor.moveTo(nodeEl.querySelector(".cf-node-tile"), ctx);
          await ctx.cursor.click(ctx);
        }
        view.openDetails(ctx.name);
        ctx.cursor.hide();
        await ctx.wait(800);
      }
    },
    expression: {
      summary: "Type an expression into the open node and show its resolved result.",
      keys: ["preview", "field"],
      follow: (view) => view.el.querySelector(".cf-ndv-panel"),
      order(facts, _step, path, report) {
        if (!facts.opened) report.warn(path, 'there is no open node to type into; add an "open" step first.');
      },
      validate(step, _def, path, report) {
        if (typeof step.expression !== "string" || !step.expression) report.error(`${path}.expression`, 'must be the expression text, e.g. "{{ $json.name }} closed".');
        if (typeof step.preview !== "string") report.error(`${path}.preview`, "is required: the expression's resolved value.");
        if (step.field !== void 0 && typeof step.field !== "string") report.error(`${path}.field`, 'must be the field label, e.g. "Message".');
      },
      async run(view, step, ctx) {
        const { editor, result, resultLabel } = view.addExpression(step.field ?? "Message");
        await typeInto(editor, step.expression, ctx, 24);
        editor.replaceChildren(expressionNodes(step.expression));
        await ctx.wait(500);
        result.textContent = step.preview;
        result.classList.add("cf-show");
        resultLabel.classList.add("cf-show");
        await ctx.wait(1500);
      }
    }
  }
};

// src/surfaces/phone.css
var phone_default = `/* phone surface: a frameless phone with a lock screen, the Screen Pool, and the assistant glow */

.cf-phonewin,
.cf-phonewin * {
    box-sizing: border-box;
}

.cf-phonewin {
    display: flex;
    justify-content: center;
    height: 100%;
    font-family: var(--cf-font-ui);
}

.cf-phone {
    position: relative;
    height: 100%;
    aspect-ratio: 390 / 844;
    padding: 6px;
    background: linear-gradient(145deg, #a3a3aa, #3d3d44 28%, #8d8d94 52%, #2f2f35 78%, #a8a8af);
    /* the frame is the screen corner plus the 6px bezel, so they stay concentric */
    border-radius: calc(var(--ph-corner) + 6px);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45), 0 50px 90px -30px rgb(0 0 0 / 0.55);
    transition: box-shadow 500ms ease;
}

.cf-phone.cf-ph-iris {
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45), 0 50px 90px -30px rgb(0 0 0 / 0.55), 0 0 70px 8px rgb(186 120 255 / 0.5);
}

.cf-ph-screen {
    position: relative;
    height: 100%;
    overflow: hidden;
    color: #fff;
    background:
        radial-gradient(120% 70% at 12% 8%, color-mix(in srgb, var(--wall-2) 88%, transparent), transparent 62%),
        radial-gradient(90% 60% at 92% 44%, color-mix(in srgb, var(--wall-3) 82%, transparent), transparent 66%),
        radial-gradient(120% 80% at 30% 104%, color-mix(in srgb, var(--wall-1) 85%, #000), transparent 72%),
        linear-gradient(165deg, var(--wall-1), color-mix(in srgb, var(--wall-2) 55%, var(--wall-1)));
    border-radius: var(--ph-corner);
}

/* dark material dims the wallpaper, as phones do at night */
.cf-ph-mat-dark .cf-ph-screen::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.38);
}

.cf-ph-status {
    position: absolute;
    top: 15px;
    left: 28px;
    right: 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 650;
}

.cf-ph-status-icons {
    fill: #fff;
    stroke: #fff;
}

.cf-ph-clock {
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    text-align: center;
}

.cf-ph-date {
    font-size: 15px;
    font-weight: 600;
    opacity: 0.9;
}

.cf-ph-big {
    color: rgb(255 255 255 / 0.9);
    font-size: 84px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
    text-shadow: 0 2px 20px rgb(0 0 0 / 0.12);
}

/* ---------- cards: liquid glass, light, dark ---------- */

.cf-ph-glass {
    position: relative;
    background: linear-gradient(150deg, rgb(255 255 255 / 0.34), rgb(255 255 255 / 0.1) 55%, rgb(255 255 255 / 0.2));
    border: 1px solid rgb(255 255 255 / 0.4);
    box-shadow:
        inset 0 1px 1px rgb(255 255 255 / 0.75),
        inset 0 -1px 1px rgb(255 255 255 / 0.2),
        inset 0 0 20px rgb(255 255 255 / 0.08),
        0 14px 30px -14px rgb(0 0 0 / 0.4);
    color: #fff;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
    -webkit-backdrop-filter: blur(16px) saturate(185%);
    backdrop-filter: blur(16px) saturate(185%);
}

/* the bright edge light glass picks up from above */
.cf-ph-glass::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(130% 70% at 18% -10%, rgb(255 255 255 / 0.32), transparent 55%);
    border-radius: inherit;
    pointer-events: none;
}

.cf-ph-mat-light .cf-ph-glass {
    background: rgb(246 246 248 / 0.88);
    border-color: rgb(255 255 255 / 0.7);
    box-shadow: 0 12px 28px -14px rgb(0 0 0 / 0.35);
    color: #111114;
    text-shadow: none;
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    backdrop-filter: blur(24px) saturate(160%);
}

.cf-ph-mat-dark .cf-ph-glass {
    background: rgb(30 30 33 / 0.82);
    border-color: rgb(255 255 255 / 0.09);
    box-shadow: 0 12px 28px -14px rgb(0 0 0 / 0.6);
    color: #f2f2f7;
    text-shadow: none;
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    backdrop-filter: blur(24px) saturate(140%);
}

.cf-ph-mat-light .cf-ph-glass::after,
.cf-ph-mat-dark .cf-ph-glass::after {
    display: none;
}

/* ---------- notifications and the summary ---------- */

.cf-ph-notes {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 92px;
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.cf-ph-note {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 9px;
    padding: 9px 11px 10px;
    border-radius: 20px;
    transition: transform 420ms cubic-bezier(0.3, 1.25, 0.5, 1), opacity 380ms ease;
}

.cf-ph-new {
    animation: cf-ph-drop 640ms cubic-bezier(0.3, 1.45, 0.5, 1);
}

@keyframes cf-ph-drop {
    from { opacity: 0; transform: translateY(-28px) scale(0.86); }
}

.cf-ph-note.cf-ph-folding {
    opacity: 0;
    transform: translateY(34px) scale(0.88);
    transition: transform 480ms cubic-bezier(0.5, 0, 0.2, 1), opacity 420ms ease;
}

.cf-ph-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    background: var(--note);
    border-radius: 8px;
    color: #fff;
    font-size: 12px;
    font-weight: 750;
    text-shadow: none;
}

.cf-ph-note-head,
.cf-ph-summary-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 13px;
}

.cf-ph-note-head b {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cf-ph-time {
    margin-left: auto;
    font-size: 11px;
    opacity: 0.68;
    white-space: nowrap;
}

.cf-ph-note-text {
    display: -webkit-box;
    overflow: hidden;
    font-size: 12.5px;
    line-height: 1.3;
    opacity: 0.94;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.cf-ph-summary {
    padding: 11px 13px 12px;
    border-radius: 22px;
    animation: cf-ph-drop 640ms cubic-bezier(0.3, 1.45, 0.5, 1);
}

/* a colour that runs round the summary's edge */
.cf-ph-summary::before {
    content: "";
    position: absolute;
    inset: -1px;
    padding: 1.5px;
    background: linear-gradient(90deg, var(--ph-glow)) 0 0 / 200% 100%;
    border-radius: inherit;
    animation: cf-ph-shimmer 2.4s linear infinite;
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
}

@keyframes cf-ph-shimmer {
    to { background-position: 200% 0; }
}

.cf-ph-spark {
    background: linear-gradient(90deg, var(--ph-glow));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-size: 14px;
    text-shadow: none;
}

.cf-ph-summary-text {
    margin-top: 5px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.38;
}

/* ---------- the assistant: request bubble, orb, edge glow ---------- */

.cf-ph-ask {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 32px;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    padding: 10px 14px;
    border-radius: 23px;
    font-size: 14px;
    font-weight: 600;
    opacity: 0;
    transform: translateY(14px) scale(0.95);
    transition: opacity 300ms ease, transform 420ms cubic-bezier(0.3, 1.4, 0.5, 1);
}

.cf-ph-ask.cf-open {
    opacity: 1;
    transform: none;
}

.cf-ph-orb {
    position: relative;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    overflow: hidden;
    border-radius: 50%;
    box-shadow: 0 0 12px rgb(200 140 255 / 0.7);
}

.cf-ph-orb i {
    position: absolute;
    inset: 0;
    background: conic-gradient(var(--ph-glow));
    animation: cf-ph-spin 2.4s linear infinite;
}

.cf-ph-orb::after {
    content: "";
    position: absolute;
    inset: 5px;
    background: radial-gradient(circle, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0.2) 70%);
    border-radius: 50%;
}

@keyframes cf-ph-spin {
    to { transform: rotate(1turn); }
}

.cf-ph-glow {
    position: absolute;
    inset: 0;
    z-index: 4;
    overflow: hidden;
    border-radius: inherit;
    opacity: 0;
    pointer-events: none;
    transition: opacity 500ms ease;
    -webkit-mask-image: linear-gradient(to right, #000, transparent 28px, transparent calc(100% - 28px), #000), linear-gradient(to bottom, #000, transparent 28px, transparent calc(100% - 28px), #000);
    mask-image: linear-gradient(to right, #000, transparent 28px, transparent calc(100% - 28px), #000), linear-gradient(to bottom, #000, transparent 28px, transparent calc(100% - 28px), #000);
}

.cf-ph-glow i {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1000px;
    height: 1000px;
    margin: -500px 0 0 -500px;
    background: conic-gradient(var(--ph-glow));
    animation: cf-ph-spin 3.2s linear infinite;
}

.cf-ph-iris .cf-ph-glow {
    opacity: 1;
}

.cf-ph-home {
    position: absolute;
    bottom: 9px;
    left: 50%;
    width: 118px;
    height: 5px;
    margin-left: -59px;
    background: rgb(255 255 255 / 0.85);
    border-radius: 3px;
}

/* ---------- the Screen Pool ---------- */

.cf-ph-pool {
    position: absolute;
    top: calc(var(--ph-inset) + 2px);
    left: 50%;
    z-index: 5;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    width: 96px;
    height: 29px;
    padding: 0 10px 0 4px;
    overflow: hidden;
    background: #000;
    border-radius: 16px;
    transform: translateX(-50%);
    transition: width 560ms cubic-bezier(0.32, 1.32, 0.5, 1), height 560ms cubic-bezier(0.32, 1.32, 0.5, 1), border-radius 560ms ease, top 400ms ease, padding 400ms ease;
}

.cf-ph-pool > * {
    opacity: 0;
    transition: opacity 240ms ease 200ms;
}

.cf-pool-music,
.cf-pool-iris {
    width: 178px;
}

.cf-pool-music > *,
.cf-pool-iris > * {
    opacity: 1;
}

.cf-ph-pool:not(.cf-pool-expanded) .cf-ph-track,
.cf-ph-pool:not(.cf-pool-expanded) .cf-ph-progress,
.cf-ph-pool:not(.cf-pool-expanded) .cf-ph-controls {
    display: none;
}

.cf-pool-iris:not(.cf-pool-expanded) {
    grid-template-columns: 22px 1fr;
}

.cf-pool-iris .cf-ph-wave {
    justify-self: end;
}

.cf-pool-expanded {
    grid-template-columns: 48px minmax(0, 1fr) auto;
    grid-template-rows: 48px auto auto;
    row-gap: 12px;
    /* inset the same distance from the top and both sides, with corners concentric with the screen's */
    top: var(--ph-inset);
    width: calc(100% - 2 * var(--ph-inset));
    height: 160px;
    padding: 16px 20px;
    border-radius: calc(var(--ph-corner) - var(--ph-inset));
}

.cf-ph-art {
    width: 22px;
    height: 22px;
    background: linear-gradient(135deg, var(--art-1), var(--art-2));
    border-radius: 6px;
    box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.4);
    transition: width 500ms ease, height 500ms ease, border-radius 500ms ease;
}

.cf-pool-expanded .cf-ph-art {
    width: 48px;
    height: 48px;
    border-radius: 12px;
}

.cf-ph-track {
    display: grid;
    min-width: 0;
}

.cf-ph-track b,
.cf-ph-track span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cf-ph-track b {
    font-size: 14px;
}

.cf-ph-track span {
    color: rgb(255 255 255 / 0.6);
    font-size: 12px;
}

.cf-ph-wave {
    display: flex;
    align-items: center;
    gap: 2.5px;
    height: 16px;
}

.cf-ph-wave i {
    width: 3px;
    height: 100%;
    background: var(--wave, #fff);
    border-radius: 2px;
    animation: cf-ph-wave 820ms ease-in-out infinite alternate;
}

.cf-ph-wave i:nth-child(2) { animation-delay: -200ms; }
.cf-ph-wave i:nth-child(3) { animation-delay: -420ms; }
.cf-ph-wave i:nth-child(4) { animation-delay: -120ms; }
.cf-ph-wave i:nth-child(5) { animation-delay: -560ms; }

@keyframes cf-ph-wave {
    from { transform: scaleY(0.25); }
}

.cf-ph-progress {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-column: 1 / -1;
    align-items: center;
    gap: 9px;
    color: rgb(255 255 255 / 0.55);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
}

.cf-ph-progress i {
    position: relative;
    height: 4px;
    background: rgb(255 255 255 / 0.22);
    border-radius: 2px;
}

.cf-ph-progress b {
    position: absolute;
    inset: 0 68% 0 0;
    background: #fff;
    border-radius: 2px;
}

.cf-ph-controls {
    display: flex;
    grid-column: 1 / -1;
    align-items: center;
    justify-content: center;
    gap: 40px;
    color: #fff;
    font-size: 19px;
}

.cf-ph-pause {
    display: inline-flex;
    gap: 5px;
}

.cf-ph-pause i {
    width: 5px;
    height: 19px;
    background: #fff;
    border-radius: 1.5px;
}

/* ---------- an app screen: a settings-style list ---------- */

.cf-ph-mat-light .cf-ph-on-list {
    background: #f2f2f7;
    color: #111114;
}

.cf-ph-mat-dark .cf-ph-on-list {
    background: #000;
}

.cf-ph-mat-light .cf-ph-on-list .cf-ph-status-icons {
    fill: #111114;
    stroke: #111114;
}

.cf-ph-mat-light .cf-ph-on-list .cf-ph-home {
    background: rgb(0 0 0 / 0.8);
}

.cf-ph-list {
    position: absolute;
    top: 46px;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0 12px;
    overflow: hidden;
}

.cf-ph-list-title {
    margin: 6px 6px 10px;
    font-size: 30px;
    font-weight: 750;
    letter-spacing: -0.02em;
}

.cf-ph-circles {
    display: flex;
    margin: 0 6px 12px;
}

.cf-ph-circles i {
    width: 38px;
    height: 38px;
    margin-right: -10px;
    background: radial-gradient(circle at 34% 28%, color-mix(in oklch, var(--circle) 45%, #fff), var(--circle) 55%, color-mix(in oklch, var(--circle) 70%, #1d1450));
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
}

.cf-ph-section-title {
    margin: 12px 14px 5px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.62;
}

.cf-ph-group {
    overflow: hidden;
    border-radius: 16px;
}

.cf-ph-mat-light .cf-ph-on-list .cf-ph-group {
    background: #fff;
    border-color: transparent;
    box-shadow: none;
}

.cf-ph-mat-dark .cf-ph-on-list .cf-ph-group {
    background: #1c1c1e;
}

.cf-ph-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    padding: 6px 12px;
    transition: background 160ms ease;
}

.cf-ph-row + .cf-ph-row {
    border-top: 1px solid rgb(255 255 255 / 0.18);
}

.cf-ph-mat-light .cf-ph-row + .cf-ph-row {
    border-top-color: rgb(60 60 67 / 0.14);
}

.cf-ph-mat-dark .cf-ph-row + .cf-ph-row {
    border-top-color: rgb(84 84 88 / 0.5);
}

.cf-ph-row.cf-pressed {
    background: rgb(127 127 127 / 0.22);
}

.cf-ph-row-icon {
    width: 28px;
    height: 28px;
    font-size: 12px;
}

.cf-ph-row-text {
    display: grid;
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 550;
}

.cf-ph-row-text span,
.cf-ph-row-text small {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cf-ph-row-text small {
    font-size: 11.5px;
    font-weight: 500;
    opacity: 0.62;
}

.cf-ph-row-end {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13.5px;
}

.cf-ph-row-value {
    opacity: 0.6;
}

.cf-ph-chevron {
    font-size: 20px;
    line-height: 1;
    opacity: 0.4;
}

.cf-ph-toggle {
    position: relative;
    width: 46px;
    height: 28px;
    background: rgb(120 120 128 / 0.32);
    border-radius: 999px;
    transition: background 240ms ease;
}

.cf-ph-toggle i {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 24px;
    height: 24px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.2);
    transition: transform 280ms cubic-bezier(0.3, 1.4, 0.5, 1);
}

.cf-ph-toggle.cf-on {
    background: #34c759;
}

.cf-ph-toggle.cf-on i {
    transform: translateX(18px);
}

/* banners land at the top over an app, not in the lock-screen stack */
.cf-ph-on-list .cf-ph-notes {
    top: 48px;
    bottom: auto;
    z-index: 3;
}

.cf-ph-touch {
    position: absolute;
    z-index: 6;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    background: rgb(255 255 255 / 0.55);
    border: 1px solid rgb(0 0 0 / 0.08);
    border-radius: 50%;
    pointer-events: none;
    animation: cf-ph-touch 520ms ease-out forwards;
}

@keyframes cf-ph-touch {
    from { opacity: 0.9; transform: scale(0.35); }
    to { opacity: 0; transform: scale(1.4); }
}
`;

// src/surfaces/phone.js
var ID2 = /^[A-Za-z_][\w-]*$/;
var MATERIALS = ["glass", "light", "dark"];
var POOL_KINDS = ["idle", "music", "iris"];
var SCREENS = ["lock", "list"];
var AREAS2 = ["pool", "clock", "notes", "summary", "ask", "list"];
var NOTE_KEYS = ["id", "app", "title", "text", "icon", "color", "time"];
var LIST_KEYS = ["title", "circles", "sections"];
var SECTION_KEYS = ["title", "rows"];
var ROW_KEYS = ["id", "label", "icon", "color", "detail", "value", "toggle", "chevron"];
var TAP_MS = 420;
var WALLPAPER = ["#6d5dfc", "#ff7eb3", "#46d6c8"];
var GLOW = ["#ff5f9e", "#ff9f43", "#ffd36e", "#5ee7ff", "#7f7bff", "#d46bff"];
var CORNER = [24, 42, 60];
var INSET = [4, 8, 16];
var MAX_NOTES = 5;
var TYPE_MS2 = 32;
function validateNote(note, path, report) {
  if (!isObject(note)) {
    report.error(path, 'must be { "app": "Messages", "title": "Sam", "text": "Dinner at 8?" }.');
    return;
  }
  for (const key of Object.keys(note)) {
    if (!NOTE_KEYS.includes(key)) report.warn(`${path}.${key}`, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, NOTE_KEYS));
  }
  if (note.id !== void 0 && (typeof note.id !== "string" || !ID2.test(note.id))) report.error(`${path}.id`, 'must be a short id using letters, digits, "_" or "-".');
  for (const key of ["app", "text"]) {
    if (typeof note[key] !== "string" || !note[key]) report.error(`${path}.${key}`, "must be a non-empty string.");
  }
  for (const key of ["title", "time"]) {
    if (note[key] !== void 0 && typeof note[key] !== "string") report.error(`${path}.${key}`, "must be a string.");
  }
  if (note.icon !== void 0 && (typeof note.icon !== "string" || [...note.icon].length > 3)) report.error(`${path}.icon`, "must be 1\u20133 characters (a monogram or an emoji).");
  if (note.color !== void 0 && !isHexColor(note.color)) report.error(`${path}.color`, "must be a hex colour.");
}
function warnUnknown(value, allowed, path, report) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) report.warn(`${path}.${key}`, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, allowed));
  }
}
function validateList(list, path, report) {
  if (!isObject(list)) {
    report.error(path, 'must be { "title": "Family", "sections": [{ "rows": [{ "id": "sunny", "label": "Sunny" }] }] }.');
    return;
  }
  warnUnknown(list, LIST_KEYS, path, report);
  if (typeof list.title !== "string" || !list.title) report.error(`${path}.title`, 'must be the screen title, e.g. "Family".');
  if (list.circles !== void 0 && !(Array.isArray(list.circles) && list.circles.length <= 8 && list.circles.every(isHexColor))) {
    report.error(`${path}.circles`, "must be up to 8 hex colours for the overlapping circles under the title.");
  }
  if (!Array.isArray(list.sections) || list.sections.length === 0 || list.sections.length > 6) {
    report.error(`${path}.sections`, 'must be 1\u20136 sections, each { "title": "Members", "rows": [...] }.');
    return;
  }
  const seen = /* @__PURE__ */ new Set();
  list.sections.forEach((section, i) => {
    const at = `${path}.sections[${i}]`;
    if (!isObject(section)) {
      report.error(at, 'must be an object with "rows".');
      return;
    }
    warnUnknown(section, SECTION_KEYS, at, report);
    if (section.title !== void 0 && typeof section.title !== "string") report.error(`${at}.title`, "must be a string.");
    if (!Array.isArray(section.rows) || section.rows.length === 0 || section.rows.length > 8) {
      report.error(`${at}.rows`, 'must be 1\u20138 rows, each { "id": "sunny", "label": "Sunny" }.');
      return;
    }
    section.rows.forEach((row2, j) => {
      const rowAt = `${at}.rows[${j}]`;
      if (!isObject(row2)) {
        report.error(rowAt, "must be an object.");
        return;
      }
      warnUnknown(row2, ROW_KEYS, rowAt, report);
      if (typeof row2.id !== "string" || !ID2.test(row2.id)) report.error(`${rowAt}.id`, 'must be a short id using letters, digits, "_" or "-".');
      else if (seen.has(row2.id)) report.error(`${rowAt}.id`, `"${row2.id}" is used twice.`);
      seen.add(row2.id);
      if (typeof row2.label !== "string" || !row2.label) report.error(`${rowAt}.label`, "must be the row's label.");
      for (const key of ["detail", "value"]) {
        if (row2[key] !== void 0 && typeof row2[key] !== "string") report.error(`${rowAt}.${key}`, "must be a string.");
      }
      for (const key of ["toggle", "chevron"]) {
        if (row2[key] !== void 0 && typeof row2[key] !== "boolean") report.error(`${rowAt}.${key}`, "must be true or false.");
      }
      if (row2.icon !== void 0 && (typeof row2.icon !== "string" || [...row2.icon].length > 3)) report.error(`${rowAt}.icon`, "must be 1\u20133 characters (a monogram or an emoji).");
      if (row2.color !== void 0 && !isHexColor(row2.color)) report.error(`${rowAt}.color`, "must be a hex colour.");
    });
  });
}
var listRows = (def) => isObject(def.list) && Array.isArray(def.list.sections) ? def.list.sections.flatMap((section) => Array.isArray(section?.rows) ? section.rows : []).filter(isObject) : [];
var rowIds2 = (def) => listRows(def).filter((row2) => typeof row2.id === "string").map((row2) => row2.id);
function validatePhone(def, path, report) {
  if (def.screen !== void 0 && !SCREENS.includes(def.screen)) report.error(`${path}.screen`, `must be one of ${SCREENS.join(", ")}.`, suggest(def.screen, SCREENS));
  if (def.screen === "list" && def.list === void 0) report.error(`${path}.list`, 'is required when "screen" is "list".');
  if (def.list !== void 0) validateList(def.list, `${path}.list`, report);
  for (const key of ["time", "date", "assistant"]) {
    if (def[key] !== void 0 && typeof def[key] !== "string") report.error(`${path}.${key}`, "must be a string.");
  }
  for (const [key, [min, , max]] of [["corner", CORNER], ["poolInset", INSET]]) {
    if (def[key] !== void 0 && (typeof def[key] !== "number" || def[key] < min || def[key] > max)) report.error(`${path}.${key}`, `must be a number from ${min} to ${max} (px).`);
  }
  if (def.glow !== void 0 && !(Array.isArray(def.glow) && def.glow.length >= 2 && def.glow.length <= 7 && def.glow.every(isHexColor))) {
    report.error(`${path}.glow`, "must be 2\u20137 hex colours for the assistant's edge light.");
  }
  if (def.material !== void 0 && !MATERIALS.includes(def.material)) report.error(`${path}.material`, `must be one of ${MATERIALS.join(", ")}.`, suggest(def.material, MATERIALS));
  const wall = def.wallpaper;
  if (wall !== void 0 && !(isHexColor(wall) || Array.isArray(wall) && wall.length >= 1 && wall.length <= 3 && wall.every(isHexColor))) {
    report.error(`${path}.wallpaper`, 'must be a hex colour or 1\u20133 hex colours, e.g. ["#6d5dfc", "#ff7eb3", "#46d6c8"].');
  }
  if (def.notifications === void 0) return;
  if (!Array.isArray(def.notifications)) {
    report.error(`${path}.notifications`, "must be an array of notifications.");
    return;
  }
  if (def.notifications.length > MAX_NOTES) report.warn(`${path}.notifications`, `shows best with ${MAX_NOTES} or fewer.`);
  const seen = /* @__PURE__ */ new Set();
  def.notifications.forEach((note, i) => {
    validateNote(note, `${path}.notifications[${i}]`, report);
    if (isObject(note) && typeof note.id === "string") {
      if (seen.has(note.id)) report.error(`${path}.notifications[${i}].id`, `"${note.id}" is used twice.`);
      seen.add(note.id);
    }
  });
}
var noteIds = (def) => Array.isArray(def.notifications) ? def.notifications.filter((n) => isObject(n) && typeof n.id === "string").map((n) => n.id) : [];
function statusIcons() {
  return s("svg", { class: "cf-ph-status-icons", viewBox: "0 0 66 12", width: "66", height: "12", "aria-hidden": "true" }, [
    ...[0, 1, 2, 3].map((i) => s("rect", { x: i * 4.6, y: 8 - i * 2.4, width: "3.2", height: 3.6 + i * 2.4, rx: "0.9" })),
    s("path", { d: "M27.5 3.6a8.6 8.6 0 0 1 11.6 0M29.5 6.1a5.6 5.6 0 0 1 7.6 0M31.6 8.6a2.6 2.6 0 0 1 3.4 0", fill: "none", "stroke-width": "1.7", "stroke-linecap": "round" }),
    s("rect", { x: "43", y: "1", width: "20", height: "10", rx: "3", fill: "none", "stroke-width": "1", opacity: "0.5" }),
    s("rect", { x: "44.6", y: "2.6", width: "14", height: "6.8", rx: "1.8" }),
    s("rect", { x: "63.6", y: "4", width: "1.6", height: "4", rx: "0.8", opacity: "0.5" })
  ]);
}
function noteCard(note) {
  const icon = h("span", { class: "cf-ph-icon", style: { "--note": note.color ?? "#8e8e93" }, text: note.icon ?? initials(note.app) });
  return h("div", { class: "cf-ph-note cf-ph-glass", dataset: note.id ? { note: note.id } : {} }, [
    icon,
    h("div", { class: "cf-ph-note-body" }, [
      h("div", { class: "cf-ph-note-head" }, [
        h("b", { text: note.title ?? note.app }),
        h("span", { class: "cf-ph-time", text: note.time ?? "now" })
      ]),
      h("div", { class: "cf-ph-note-text", text: note.text })
    ])
  ]);
}
function rowView(row2) {
  const trailing = [];
  if (row2.value) trailing.push(h("span", { class: "cf-ph-row-value", text: row2.value }));
  if (row2.toggle !== void 0) trailing.push(h("span", { class: row2.toggle ? "cf-ph-toggle cf-on" : "cf-ph-toggle" }, h("i")));
  if (row2.chevron) trailing.push(h("span", { class: "cf-ph-chevron", "aria-hidden": "true", text: "\u203A" }));
  return h("div", { class: "cf-ph-row", dataset: { row: row2.id } }, [
    row2.icon || row2.color ? h("span", { class: "cf-ph-icon cf-ph-row-icon", style: { "--note": row2.color ?? "#8e8e93" }, text: row2.icon ?? initials(row2.label) }) : null,
    h("div", { class: "cf-ph-row-text" }, [h("span", { text: row2.label }), row2.detail ? h("small", { text: row2.detail }) : null]),
    trailing.length ? h("div", { class: "cf-ph-row-end" }, trailing) : null
  ]);
}
function listView(list) {
  return h("div", { class: "cf-ph-list" }, [
    h("div", { class: "cf-ph-list-title", text: list.title }),
    Array.isArray(list.circles) && list.circles.length ? h("div", { class: "cf-ph-circles", "aria-hidden": "true" }, list.circles.map((color) => h("i", { style: { "--circle": color } }))) : null,
    ...list.sections.filter(isObject).flatMap((section) => [
      section.title ? h("div", { class: "cf-ph-section-title", text: section.title }) : null,
      h("div", { class: "cf-ph-group cf-ph-glass" }, (section.rows ?? []).filter(isObject).map(rowView))
    ])
  ]);
}
var orb = () => h("span", { class: "cf-ph-orb", "aria-hidden": "true" }, h("i"));
var bars = (count) => h("span", { class: "cf-ph-wave", "aria-hidden": "true" }, Array.from({ length: count }, () => h("i")));
function render5(def) {
  const material = MATERIALS.includes(def.material) ? def.material : "glass";
  const assistant = def.assistant ?? "Iris";
  const wall = Array.isArray(def.wallpaper) ? def.wallpaper : isHexColor(def.wallpaper) ? [def.wallpaper] : WALLPAPER;
  const notes = h("div", { class: "cf-ph-notes" }, (def.notifications ?? []).filter(isObject).map(noteCard));
  const pool = h("div", { class: "cf-ph-pool" });
  const askText = h("span", { class: "cf-ph-ask-text" });
  const ask = h("div", { class: "cf-ph-ask cf-ph-glass" }, [orb(), askText]);
  const glow = h("div", { class: "cf-ph-glow", "aria-hidden": "true" }, h("i"));
  const onList = def.screen === "list" && isObject(def.list);
  const clock = onList ? null : h("div", { class: "cf-ph-clock" }, [
    h("div", { class: "cf-ph-date", text: def.date ?? "Tuesday, October 20" }),
    h("div", { class: "cf-ph-big", text: def.time ?? "9:41" })
  ]);
  const list = onList ? listView(def.list) : null;
  const screen = h("div", {
    class: onList ? "cf-ph-screen cf-ph-on-list" : "cf-ph-screen",
    style: { "--wall-1": wall[0], "--wall-2": wall[1] ?? wall[0], "--wall-3": wall[2] ?? wall[1] ?? wall[0] }
  }, [
    h("div", { class: "cf-ph-status" }, [h("span", { text: def.time ?? "9:41" }), statusIcons()]),
    clock,
    list,
    notes,
    ask,
    h("div", { class: "cf-ph-home" }),
    glow,
    pool
  ]);
  const phone = h("div", { class: "cf-phone" }, screen);
  const size = (value, [min, fallback, max]) => `${typeof value === "number" ? clamp(value, min, max) : fallback}px`;
  const glowColors = Array.isArray(def.glow) && def.glow.every(isHexColor) ? def.glow : GLOW;
  const el = h("div", {
    class: `cf-phonewin cf-ph-mat-${material}`,
    style: {
      "--ph-corner": size(def.corner, CORNER),
      "--ph-inset": size(def.poolInset, INSET),
      // repeat the first colour so the rotating light loops seamlessly
      "--ph-glow": [...glowColors, glowColors[0]].join(", ")
    }
  }, phone);
  const areas = { pool, clock, notes, ask, list };
  let summary = null;
  return {
    el,
    assistant,
    notes,
    askText,
    find(part, name) {
      if (part === "note") return [...notes.querySelectorAll(".cf-ph-note")].find((node) => node.dataset.note === name) ?? null;
      if (part === "row") return list ? [...list.querySelectorAll(".cf-ph-row")].find((node) => node.dataset.row === name) ?? null : null;
      if (part === "area") return name === "summary" ? summary : hasOwn(areas, name) ? areas[name] : null;
      return null;
    },
    /** A touch ripple where a finger meets the screen (phones have no pointer). */
    touch(target) {
      const at = rectIn(screen, target);
      const ripple = h("span", { class: "cf-ph-touch", "aria-hidden": "true", style: { left: `${at.x + at.w / 2}px`, top: `${at.y + at.h / 2}px` } });
      screen.append(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    },
    /** Add a notification at the top; the others slide down to make room. */
    addNote(note) {
      const before = new Map([...notes.children].map((node) => [node, node.offsetTop]));
      const card = noteCard(note);
      card.classList.add("cf-ph-new");
      notes.prepend(card);
      for (const [node, top] of before) {
        node.style.setProperty("transition", "none");
        node.style.setProperty("transform", `translateY(${top - node.offsetTop}px)`);
      }
      void notes.offsetHeight;
      for (const node of before.keys()) {
        node.style.removeProperty("transition");
        node.style.removeProperty("transform");
      }
      while (notes.children.length > MAX_NOTES) notes.lastElementChild.remove();
      return card;
    },
    iris(on) {
      phone.classList.toggle("cf-ph-iris", on);
      if (!on) ask.classList.remove("cf-open");
    },
    openAsk() {
      ask.classList.add("cf-open");
    },
    /** Fold every notification into one summary card. */
    collapse() {
      [...notes.children].forEach((node, i) => {
        node.style.setProperty("transition-delay", `${i * 60}ms`);
        node.classList.add("cf-ph-folding");
      });
    },
    showSummary(title, count) {
      notes.replaceChildren();
      summary = h("div", { class: "cf-ph-summary cf-ph-glass" }, [
        h("div", { class: "cf-ph-summary-head" }, [
          h("span", { class: "cf-ph-spark", text: "\u2726" }),
          h("b", { text: title ?? `${count} notification${count === 1 ? "" : "s"}` }),
          h("span", { class: "cf-ph-time", text: `by ${assistant}` })
        ]),
        h("div", { class: "cf-ph-summary-text" })
      ]);
      notes.append(summary);
      return summary.querySelector(".cf-ph-summary-text");
    },
    /** Morph the Screen Pool: idle pill, or a live activity (music, the assistant listening). */
    setPool(kind, { title, artist, art, expand } = {}) {
      pool.className = `cf-ph-pool cf-pool-${kind}${expand ? " cf-pool-expanded" : ""}`;
      const artColors = Array.isArray(art) && art.length ? art : ["#ff7a59", "#7b2ff7"];
      const cover = h("span", { class: "cf-ph-art", style: { "--art-1": artColors[0], "--art-2": artColors[1] ?? artColors[0] } });
      if (kind === "music") {
        pool.replaceChildren(
          cover,
          h("div", { class: "cf-ph-track" }, [h("b", { text: title ?? "Now playing" }), h("span", { text: artist ?? "" })]),
          bars(5),
          h("div", { class: "cf-ph-progress" }, [h("span", { text: "1:12" }), h("i", {}, h("b")), h("span", { text: "-2:31" })]),
          h("div", { class: "cf-ph-controls", "aria-hidden": "true" }, [h("span", { text: "\u23EE" }), h("span", { class: "cf-ph-pause" }, [h("i"), h("i")]), h("span", { text: "\u23ED" })])
        );
        pool.style.setProperty("--wave", artColors[0]);
      } else if (kind === "iris") {
        pool.replaceChildren(orb(), h("div", { class: "cf-ph-track" }, [h("b", { text: assistant }), h("span", { text: "Listening\u2026" })]), bars(5));
        pool.style.setProperty("--wave", "#c79bff");
      } else {
        pool.replaceChildren();
      }
    }
  };
}
async function typeText(el, text, ctx) {
  if (ctx.fast) {
    el.textContent = text;
    return;
  }
  el.textContent = "";
  for (const word of text.split(/(\s+)/)) {
    el.textContent += word;
    if (word.trim()) await ctx.wait(TYPE_MS2 * Math.min(4, word.length));
  }
}
var phone_default2 = {
  name: "phone",
  summary: "A phone lock screen: notifications drop in, the assistant (Iris) lights the screen edge and summarises them, and the Screen Pool grows into live activities like music.",
  width: 170,
  keys: ["time", "date", "assistant", "material", "wallpaper", "corner", "poolInset", "glow", "notifications", "screen", "list"],
  styles: phone_default,
  parts: {
    note: noteIds,
    row: rowIds2,
    area: () => AREAS2
  },
  validate: validatePhone,
  render: render5,
  recap: (view) => view.iris(false),
  actions: {
    toggle: {
      summary: 'Flip a switch in the list: { "toggle": "phone.row:summaries" } (add "on": false to switch it off).',
      part: "row",
      keys: ["on"],
      follow: (view, step) => view.find("row", String(step.toggle).split(":").slice(1).join(":")),
      validate(step, def, path, report) {
        const id = String(step.toggle).split(":").slice(1).join(":");
        const row2 = listRows(def).find((item) => item.id === id);
        if (row2 && row2.toggle === void 0) report.error(`${path}.toggle`, `row "${id}" has no switch; give it "toggle": false in the list.`);
        if (step.on !== void 0 && typeof step.on !== "boolean") report.error(`${path}.on`, "must be true or false.");
      },
      async run(view, step, ctx) {
        const toggle = view.find("row", ctx.name)?.querySelector(".cf-ph-toggle");
        if (!toggle) return;
        if (!ctx.fast) view.touch(toggle);
        toggle.classList.toggle("cf-on", step.on !== false);
        await ctx.wait(ctx.fast ? 0 : 700);
      }
    },
    tap: {
      summary: "Tap a row in the list: it highlights under a touch ripple.",
      part: "row",
      keys: [],
      follow: (view, step) => view.find("row", String(step.tap).split(":").slice(1).join(":")),
      async run(view, _step, ctx) {
        const row2 = view.find("row", ctx.name);
        if (!row2 || ctx.fast) return;
        view.touch(row2);
        row2.classList.add("cf-pressed");
        await ctx.wait(TAP_MS);
        row2.classList.remove("cf-pressed");
        await ctx.wait(300);
      }
    },
    notify: {
      summary: 'A notification drops onto the lock screen: { "notify": { "app": "Messages", "title": "Sam", "text": "Dinner at 8?" } }.',
      keys: [],
      follow: (view) => view.notes,
      validate(step, _def, path, report) {
        validateNote(step.notify, `${path}.notify`, report);
      },
      async run(view, step, ctx) {
        view.iris(false);
        view.addNote(step.notify);
        await ctx.wait(ctx.fast ? 0 : 900);
      }
    },
    ask: {
      summary: 'Ask the assistant something: the screen edge glows and the request is written out. Follow it with "summarize" or "pool".',
      keys: ["ms"],
      follow: (view) => view.find("area", "ask"),
      validate(step, _def, path, report) {
        if (typeof step.ask !== "string" || !step.ask) report.error(`${path}.ask`, 'must be what the viewer asks, e.g. "What did I miss?".');
        if (step.ms !== void 0 && (typeof step.ms !== "number" || step.ms < 0 || step.ms > 1e4)) report.error(`${path}.ms`, "must be milliseconds between 0 and 10000.");
      },
      order(facts) {
        facts.asked = true;
      },
      async run(view, step, ctx) {
        view.iris(true);
        await ctx.wait(ctx.fast ? 0 : 450);
        view.openAsk();
        await typeText(view.askText, step.ask, ctx);
        await ctx.wait(ctx.fast ? 0 : step.ms ?? 700);
      }
    },
    summarize: {
      summary: "The assistant folds the notifications into one summary card and writes the summary out.",
      keys: ["title", "ms"],
      follow: (view) => view.notes,
      validate(step, _def, path, report) {
        if (typeof step.summarize !== "string" || !step.summarize) report.error(`${path}.summarize`, "must be the summary text.");
        if (step.title !== void 0 && typeof step.title !== "string") report.error(`${path}.title`, 'must be a string, e.g. "3 apps \xB7 7 notifications".');
        if (step.ms !== void 0 && (typeof step.ms !== "number" || step.ms < 0 || step.ms > 1e4)) report.error(`${path}.ms`, "must be milliseconds between 0 and 10000.");
      },
      order(facts, _step, path, report) {
        if (!facts.asked) report.warn(path, 'nobody asked yet; an "ask" step first makes the summary land.');
      },
      async run(view, step, ctx) {
        const count = view.notes.children.length;
        view.iris(true);
        view.collapse();
        await ctx.wait(ctx.fast ? 0 : 520 + count * 60);
        const text = view.showSummary(step.title, count);
        await typeText(text, step.summarize, ctx);
        await ctx.wait(ctx.fast ? 0 : 500);
        view.iris(false);
        await ctx.wait(ctx.fast ? 0 : step.ms ?? 900);
      }
    },
    pool: {
      summary: 'Morph the Screen Pool: "music" (with "title", "artist", "art" colours; "expand": true for the large card), "iris" (listening), or "idle".',
      keys: ["title", "artist", "art", "expand", "ms"],
      follow: (view) => view.find("area", "pool"),
      validate(step, _def, path, report) {
        if (!POOL_KINDS.includes(step.pool)) report.error(`${path}.pool`, `must be one of ${POOL_KINDS.join(", ")}.`, suggest(step.pool, POOL_KINDS));
        for (const key of ["title", "artist"]) {
          if (step[key] !== void 0 && typeof step[key] !== "string") report.error(`${path}.${key}`, "must be a string.");
        }
        if (step.art !== void 0 && !(Array.isArray(step.art) && step.art.length >= 1 && step.art.length <= 2 && step.art.every(isHexColor))) {
          report.error(`${path}.art`, "must be one or two hex colours for the cover art.");
        }
        if (step.expand !== void 0 && typeof step.expand !== "boolean") report.error(`${path}.expand`, "must be true or false.");
        if (step.ms !== void 0 && (typeof step.ms !== "number" || step.ms < 0 || step.ms > 1e4)) report.error(`${path}.ms`, "must be milliseconds between 0 and 10000.");
      },
      async run(view, step, ctx) {
        view.iris(false);
        view.setPool(step.pool, step);
        await ctx.wait(ctx.fast ? 0 : step.ms ?? 900);
      }
    }
  }
};

// src/surfaces/team-chat.js
function validateChat2(def, path, report) {
  if (typeof def.channel !== "string" || !def.channel) report.error(`${path}.channel`, 'is required: the channel shown, e.g. "sales-wins".');
  if (def.channels !== void 0 && (!Array.isArray(def.channels) || def.channels.some((c) => typeof c !== "string"))) {
    report.error(`${path}.channels`, "must be an array of channel names for the sidebar.");
  }
  if (def.workspace !== void 0 && typeof def.workspace !== "string") report.error(`${path}.workspace`, "must be the workspace name.");
  if (def.members !== void 0 && (typeof def.members !== "number" || def.members < 0)) report.error(`${path}.members`, "must be a member count.");
  if (def.history !== void 0) {
    if (!Array.isArray(def.history)) report.error(`${path}.history`, 'must be an array of earlier messages: [{ "from": "Sam", "text": "..." }].');
    else {
      def.history.forEach((message, i) => {
        if (!isObject(message) || typeof message.from !== "string" || typeof message.text !== "string" || message.time !== void 0 && typeof message.time !== "string") {
          report.error(`${path}.history[${i}]`, 'needs "from" and "text" strings.');
        }
      });
    }
  }
}
function validateMessage(value, path, report, screens) {
  if (!isObject(value)) {
    report.error(path, 'must be { "from": "Name", "text": "..." } or { "app": "<screen id>", "text": "..." }.');
    return;
  }
  if (typeof value.text !== "string" || !value.text) report.error(`${path}.text`, "must be the message text (supports *bold* and `code`).");
  if (value.time !== void 0 && typeof value.time !== "string") report.error(`${path}.time`, "must be a string.");
  if (value.app !== void 0 && !hasOwn(screens, value.app)) {
    report.error(`${path}.app`, `"${value.app}" isn't a screen id.`, suggest(value.app, Object.keys(screens ?? {})));
  }
  if (value.app === void 0 && typeof value.from !== "string") report.error(`${path}.from`, "is required when the message is not from an app.");
}
function avatar(sender) {
  return h("span", { class: "cf-avatar", style: { "--avatar": sender.color }, text: sender.icon });
}
function senderOf(value, screens) {
  const app = value.app && hasOwn(screens, value.app) ? screens[value.app].app : null;
  if (app) return { name: app.name, icon: app.icon ?? initials(app.name), color: app.color ?? "var(--cf-accent)", isApp: true };
  return { name: value.from, icon: initials(value.from), color: nameColor(value.from), isApp: false };
}
function messageEl(value, screens, time) {
  const sender = senderOf(value, screens);
  return h("div", { class: "cf-msg" }, [
    avatar(sender),
    h("div", { class: "cf-msg-main" }, [
      h("div", { class: "cf-msg-head" }, [
        h("span", { class: "cf-msg-name", text: sender.name }),
        sender.isApp ? h("span", { class: "cf-badge", text: "APP" }) : null,
        h("span", { class: "cf-msg-time", text: value.time ?? time })
      ]),
      h("div", { class: "cf-msg-text" }, richText(value.text))
    ])
  ]);
}
function render6(def, { screens }) {
  const channels = Array.isArray(def.channels) ? def.channels : [def.channel];
  const list = channels.includes(def.channel) ? channels : [...channels, def.channel];
  const { el, body } = appWindow(def.app, { title: def.workspace, className: "cf-chat" });
  const messages = h("div", { class: "cf-msgs" }, (def.history ?? []).map((message) => messageEl(message, screens, message.time ?? "9:12 AM")));
  body.append(h("div", { class: "cf-chat-main" }, [
    h("div", { class: "cf-chat-side" }, [
      h("div", { class: "cf-side-label", text: "Channels" }),
      ...list.map((name) => h("div", { class: name === def.channel ? "cf-chan cf-active" : "cf-chan", text: `# ${name}` }))
    ]),
    h("div", { class: "cf-chat-pane" }, [
      h("div", { class: "cf-chat-head" }, [
        h("span", { text: `# ${def.channel}` }),
        typeof def.members === "number" ? h("span", { class: "cf-chat-members", text: `${def.members} members` }) : null
      ]),
      messages,
      h("div", { class: "cf-composer", text: `Message #${def.channel}` })
    ])
  ]));
  const last = () => messages.lastElementChild?.querySelector(".cf-msg-main");
  return {
    el,
    find: () => null,
    add(value) {
      const message = messageEl(value, screens, "now");
      message.classList.add("cf-new");
      messages.append(message);
      messages.scrollTop = messages.scrollHeight;
    },
    /** Add a reaction pill to the latest message; returns its counter so the caller can animate it. */
    react(emoji) {
      const main = last();
      if (!main) return null;
      const row2 = main.querySelector(".cf-reacts") ?? main.appendChild(h("div", { class: "cf-reacts" }));
      const pill = h("span", { class: "cf-react" }, [h("span", { text: emoji }), h("span", { class: "cf-react-count", text: "1" })]);
      row2.append(pill);
      messages.scrollTop = messages.scrollHeight;
      return pill.querySelector(".cf-react-count");
    },
    reply(value) {
      const main = last();
      if (!main) return;
      const thread = main.querySelector(".cf-thread") ?? main.appendChild(h("div", { class: "cf-thread" }, h("div", { class: "cf-thread-sum" })));
      thread.append(messageEl(value, screens, "now"));
      const replies = thread.querySelectorAll(".cf-msg").length;
      thread.querySelector(".cf-thread-sum").textContent = `${replies} ${replies === 1 ? "reply" : "replies"}`;
      messages.scrollTop = messages.scrollHeight;
    }
  };
}
var team_chat_default = {
  name: "team-chat",
  summary: "A team chat app: channel sidebar, messages (from people or from another screen's app), reactions, and thread replies.",
  width: 430,
  keys: ["workspace", "channel", "channels", "members", "history"],
  parts: {},
  validate: validateChat2,
  render: render6,
  actions: {
    message: {
      summary: "Post a message to the channel.",
      keys: [],
      follow: (view) => view.el.querySelector(".cf-msgs"),
      order: (facts) => {
        facts.messages += 1;
      },
      validate(step, _def, path, report, screens) {
        validateMessage(step.message, `${path}.message`, report, screens);
      },
      async run(view, step, ctx) {
        view.add(step.message);
        await ctx.wait(1300);
      }
    },
    react: {
      summary: "Add a reaction to the latest message; the count animates up.",
      keys: [],
      follow: (view) => view.el.querySelector(".cf-msgs"),
      order(facts, _step, path, report) {
        if (facts.messages === 0) report.warn(path, 'there is no message to react to yet; add a "message" step or channel history first.');
      },
      validate(step, _def, path, report) {
        const value = step.react;
        if (!isObject(value) || typeof value.emoji !== "string") report.error(`${path}.react`, 'must be { "emoji": "\u{1F389}", "count": 3 }.');
        else if (value.count !== void 0 && (!Number.isInteger(value.count) || value.count < 1 || value.count > 99)) report.error(`${path}.react.count`, "must be a whole number from 1 to 99.");
      },
      async run(view, step, ctx) {
        const counter = view.react(step.react.emoji);
        const target = step.react.count ?? 1;
        await ctx.animate(500, (progress) => {
          if (counter) counter.textContent = String(Math.max(1, Math.round(target * progress)));
        });
        await ctx.wait(250);
      }
    },
    reply: {
      summary: "Reply in a thread under the latest message.",
      keys: [],
      follow: (view) => view.el.querySelector(".cf-msgs"),
      order(facts, _step, path, report) {
        if (facts.messages === 0) report.warn(path, "there is no message to reply to yet.");
      },
      validate(step, _def, path, report, screens) {
        validateMessage(step.reply, `${path}.reply`, report, screens);
      },
      async run(view, step, ctx) {
        view.reply(step.reply);
        await ctx.wait(1200);
      }
    }
  }
};

// src/templates/assistant-connector.js
var assistant_connector_default = {
  name: "assistant-connector",
  title: "Assistant \u2192 connector \u2192 app",
  summary: "An AI assistant uses a connector to do work in another app, and the result shows up in that app.",
  requires: ["ai-chat"],
  layout: "stage",
  validate(clip2, report) {
    const chapters = Array.isArray(clip2.chapters) ? clip2.chapters : [];
    const steps = chapters.flatMap((chapter) => Array.isArray(chapter.steps) ? chapter.steps : []);
    if (!steps.some((step) => step && "tool" in step)) report.warn("chapters", 'no "tool" steps: show the assistant calling the connector.');
    if (!steps.some((step) => step && "enter" in step) && (clip2.layout ?? "stage") === "stage") {
      report.warn("chapters", 'in the stage layout, bring the target app on with an "enter" step so viewers see the result.');
    }
  }
};

// src/templates/assistant-files.js
var assistant_files_default = {
  name: "assistant-files",
  title: "Ask an assistant about your files",
  summary: "Pull files into a prompt with @, preview each one on hover, and get an answer that cites them.",
  requires: ["ai-chat"],
  layout: "stage",
  validate(clip2, report) {
    const chapters = Array.isArray(clip2.chapters) ? clip2.chapters : [];
    const steps = chapters.flatMap((chapter) => Array.isArray(chapter?.steps) ? chapter.steps : []).filter(isObject);
    const chats = Object.values(isObject(clip2.screens) ? clip2.screens : {}).filter((screen) => isObject(screen) && screen.surface === "ai-chat");
    if (!chats.some((screen) => Array.isArray(screen.files) && screen.files.length)) {
      report.warn("screens", 'give the ai-chat screen some "files" so prompts can reference them with @.');
    }
    if (!steps.some((step) => typeof step.prompt === "string" && /(^|\s)@[A-Za-z_]/.test(step.prompt))) {
      report.warn("chapters", 'no prompt references a file; write "@<file id>" in a "prompt" step.');
    }
    if (!steps.some((step) => "hover" in step)) report.warn("chapters", 'add a "hover" step so viewers see a file preview.');
  }
};

// src/templates/phone-feature.js
var phone_feature_default = {
  name: "phone-feature",
  title: "Phone feature, motion-graphics style",
  summary: "A phone feature with characters (spheres, blocks) that carry the story, a backdrop colour per scene, and confetti to finish.",
  requires: ["phone"],
  layout: "stage",
  validate(clip2, report) {
    if (!isObject(clip2.actors) || !Object.keys(clip2.actors).length) report.warn("actors", "add a few actors (spheres or blocks) to carry the story between scenes.");
    const chapters = Array.isArray(clip2.chapters) ? clip2.chapters : [];
    if (!chapters.some((chapter) => isObject(chapter) && chapter.backdrop !== void 0) && clip2.design?.backdrop === void 0) {
      report.warn("chapters", 'give scenes a "backdrop" colour; it marks each new topic.');
    }
  }
};

// src/templates/trigger-automation-notify.js
var trigger_automation_notify_default = {
  name: "trigger-automation-notify",
  title: "Trigger \u2192 automation \u2192 notification",
  summary: "A record changes in one app, an automation workflow runs, and a team is notified in chat.",
  requires: ["crm-record", "flow-canvas", "team-chat"],
  layout: "row",
  validate(clip2, report) {
    const chapters = Array.isArray(clip2.chapters) ? clip2.chapters : [];
    const last = chapters[chapters.length - 1];
    if (last && last.focus !== "all") {
      report.warn(`chapters[${chapters.length - 1}].focus`, 'this template ends best on a recap chapter with "focus": "all".');
    }
    const usesPackets = chapters.some((chapter) => Array.isArray(chapter.steps) && chapter.steps.some((step) => step && "packet" in step));
    if (!usesPackets) report.warn("chapters", 'no "packet" steps: add them to show data moving between the apps.');
  }
};

// src/styles/player.css
var player_default = `/* cueflick player \u2014 lives inside the <cue-flick> shadow root */

:host {
    display: block;
    width: 100%;
    min-width: 0;
    container-type: inline-size;
}

.cf-mount {
    width: 100%;
}

:host(:fullscreen) {
    display: grid;
    place-items: center;
    padding: 2vh 2vw;
    background: #000;
}

:host(:fullscreen) .cf-player {
    width: min(100%, calc((100vh - 140px) * 16 / 9));
}

/* ---------- palettes ---------- */

.cf-player,
.cf-screen[data-mode="dark"] {
    --cf-stage: #07090d;
    --cf-stage-top: #111624;
    --cf-stage-glow: rgb(34 211 238 / 0.10);
    --cf-stage-grid: rgb(255 255 255 / 0.035);
    --cf-win: #161a22;
    --cf-win-2: #1c212b;
    --cf-win-3: #262c39;
    --cf-line: #2a3141;
    --cf-line-strong: #363f53;
    --cf-canvas: #12151b;
    --cf-wire: #5b6476;
    --cf-node-bg: #232831;
    --cf-node-border: #414a5c;
    --cf-text: #e9ecf2;
    --cf-dim: #9ea7b7;
    --cf-faint: #6d768a;
    --cf-grid: rgb(255 255 255 / 0.07);
    --cf-shadow: 0 30px 70px -20px rgb(0 0 0 / 0.65);
    --cf-ok: #34d399;
    --cf-warn: #f59e0b;
    --cf-control-text: #c9d0dc;
    --cf-ref-bg: rgb(96 146 255 / 0.2);
    --cf-ref-text: #9dc0ff;
    /* the ai-chat "neutral" look */
    --cf-n-bg: #212121;
    --cf-n-side: #181818;
    --cf-n-raise: #303030;
    --cf-n-composer: #303030;
    --cf-n-menu: #353535;
    --cf-n-line: rgb(255 255 255 / 0.08);
    --cf-n-line-strong: rgb(255 255 255 / 0.16);
    --cf-n-text: #ececec;
    --cf-n-dim: #b4b4b4;
    --cf-n-faint: #8e8e8e;

    font-family: var(--cf-font-ui);
    color: var(--cf-text);
    -webkit-font-smoothing: antialiased;
}

.cf-player[data-mode="light"],
.cf-screen[data-mode="light"] {
    --cf-stage: #e4e9f1;
    --cf-stage-top: #f6f8fc;
    --cf-stage-glow: rgb(34 211 238 / 0.14);
    --cf-stage-grid: rgb(15 23 42 / 0.045);
    --cf-win: #ffffff;
    --cf-win-2: #f6f8fb;
    --cf-win-3: #eceff4;
    --cf-line: #e1e5ec;
    --cf-line-strong: #cdd4df;
    --cf-canvas: #f4f5f7;
    --cf-wire: #a3acba;
    --cf-node-bg: #ffffff;
    --cf-node-border: #c5ccd8;
    --cf-text: #1a2030;
    --cf-dim: #5a6475;
    --cf-faint: #8a93a4;
    --cf-grid: rgb(15 23 42 / 0.09);
    --cf-shadow: 0 24px 60px -18px rgb(15 23 42 / 0.25);
    --cf-ok: #10a36e;
    --cf-control-text: #3b4456;
    --cf-ref-bg: #e6efff;
    --cf-ref-text: #1d5fd1;
    --cf-n-bg: #ffffff;
    --cf-n-side: #f9f9f9;
    --cf-n-raise: #f3f3f3;
    --cf-n-composer: #ffffff;
    --cf-n-menu: #ffffff;
    --cf-n-line: #e5e5e5;
    --cf-n-line-strong: #d0d0d0;
    --cf-n-text: #0d0d0d;
    --cf-n-dim: #5d5d5d;
    --cf-n-faint: #8e8e8e;
}

/* ---------- stage and world ---------- */

.cf-stage {
    position: relative;
    aspect-ratio: var(--cf-aspect, 16 / 9);
    overflow: hidden;
    border-radius: 16px;
    background:
        radial-gradient(ellipse 70% 55% at 50% 0%, var(--cf-stage-glow), transparent 70%),
        linear-gradient(180deg, var(--cf-stage-top), var(--cf-stage));
    border: 1px solid var(--cf-line);
    box-shadow: 0 40px 100px -50px rgb(0 0 0 / 0.7);
}

.cf-stage::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(var(--cf-stage-grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--cf-stage-grid) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 50% 35%, #000 25%, transparent 78%);
    pointer-events: none;
}

.cf-world {
    position: absolute;
    left: 0;
    top: 0;
    width: 1600px;
    height: 900px;
    transform-origin: 0 0;
    will-change: transform;
}

.cf-instant,
.cf-instant * {
    transition: none !important;
}

/* screens are placed by the template in world units (beats .cf-window's position) */
.cf-world > .cf-screen {
    position: absolute;
    color: var(--cf-text);
    transition: filter 500ms ease;
}

.cf-world > .cf-screen.cf-off {
    visibility: hidden;
}

.cf-world > .cf-screen.cf-dimmed {
    filter: brightness(0.42) saturate(0.7);
}

/* rack focus: everything but the subject goes soft */
.cf-world > .cf-screen.cf-blurred,
.cf-actor.cf-blurred,
.cf-actor-shadow.cf-blurred {
    filter: blur(var(--cf-blur, 7px)) saturate(0.85);
}

.cf-world > .cf-screen.cf-dimmed.cf-blurred {
    filter: blur(var(--cf-blur, 7px)) brightness(0.42) saturate(0.7);
}

/* pausing freezes every CSS animation too */
.cf-player.cf-paused *,
.cf-player.cf-paused *::before,
.cf-player.cf-paused *::after {
    animation-play-state: paused !important;
}

/* ---------- app windows ---------- */

.cf-window {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--cf-win);
    border: 1px solid var(--cf-line-strong);
    border-radius: var(--cf-radius);
    box-shadow: var(--cf-shadow), 0 30px 90px -55px var(--app);
    font-size: 15px;
}

.cf-body {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}

.cf-appbar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 50px;
    flex-shrink: 0;
    padding: 0 16px;
    background: var(--cf-win-2);
    border-bottom: 1px solid var(--cf-line);
    box-shadow: inset 0 3px 0 var(--app);
}

.cf-appicon {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 8px;
    background: var(--app, var(--cf-accent));
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.cf-appname {
    font-size: 15px;
    font-weight: 800;
}

.cf-apptitle {
    overflow: hidden;
    color: var(--cf-dim);
    font-size: 13.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cf-apptrail {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    color: var(--cf-dim);
    font-size: 12.5px;
    font-weight: 600;
}

/* ---------- crm-record ---------- */

.cf-crm-head {
    padding: 18px 22px 14px;
}

.cf-crm-type {
    color: var(--cf-dim);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.cf-crm-title {
    overflow-wrap: anywhere;
    margin: 4px 0 14px;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.cf-path {
    display: flex;
    gap: 3px;
}

.cf-path span {
    flex: 1;
    padding: 8px 4px 8px 14px;
    overflow: hidden;
    background: var(--cf-win-3);
    color: var(--cf-dim);
    font-size: 11.5px;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
    transition: background 400ms ease, color 400ms ease;
}

.cf-path span:first-child {
    padding-left: 6px;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%);
}

.cf-path .cf-done {
    background: color-mix(in srgb, var(--app) 30%, var(--cf-win-3));
    color: var(--cf-text);
}

.cf-path .cf-current {
    background: var(--app);
    color: #fff;
}

.cf-path .cf-won {
    background: var(--cf-ok);
    color: #fff;
}

.cf-crm-tabs {
    display: flex;
    gap: 22px;
    padding: 0 22px;
    border-bottom: 1px solid var(--cf-line);
    color: var(--cf-dim);
    font-size: 13.5px;
    font-weight: 650;
}

.cf-crm-tabs span {
    margin-bottom: -1px;
    padding: 10px 0;
    border-bottom: 2px solid transparent;
}

.cf-crm-tabs .cf-active {
    border-bottom-color: var(--app);
    color: var(--cf-text);
}

.cf-crm-head,
.cf-crm-tabs,
.cf-crm-actions {
    flex-shrink: 0;
}

.cf-crm-fields {
    display: grid;
    flex-shrink: 1;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-content: start;
    gap: 14px 20px;
    min-height: 0;
    padding: 16px 22px 10px;
    overflow: hidden;
}

/* an open dropdown hangs over the activity list below instead of being clipped */
.cf-crm-fields:has(.cf-select.cf-open) {
    overflow: visible;
}

.cf-field label {
    display: block;
    margin-bottom: 4px;
    color: var(--cf-dim);
    font-size: 12px;
    font-weight: 600;
}

.cf-field .cf-val {
    font-size: 15.5px;
    font-weight: 650;
    overflow-wrap: anywhere;
}

.cf-field.cf-dirty label::after {
    content: " \u2022";
    color: var(--app);
}

.cf-field.cf-editing .cf-val {
    border-bottom: 2px solid var(--app);
}

.cf-select {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: var(--cf-win-2);
    border: 1px solid var(--cf-line-strong);
    border-radius: 8px;
    transition: border-color 200ms ease, box-shadow 200ms ease;
}

.cf-select.cf-open {
    border-color: var(--app);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--app) 25%, transparent);
}

.cf-caret {
    color: var(--cf-dim);
}

.cf-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 5;
    padding: 4px;
    background: var(--cf-win);
    border: 1px solid var(--cf-line-strong);
    border-radius: 8px;
    box-shadow: var(--cf-shadow);
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition: opacity 180ms ease, transform 180ms ease;
}

.cf-select.cf-open .cf-menu {
    opacity: 1;
    transform: none;
}

.cf-opt {
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 14px;
}

.cf-opt.cf-hover {
    background: color-mix(in srgb, var(--app) 20%, transparent);
}

.cf-activity {
    flex: 1 1 0;
    min-height: 0;
    padding: 6px 22px 8px;
    overflow: hidden;
}

.cf-activity-label {
    margin: 4px 0 10px;
    color: var(--cf-dim);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.cf-activity-list {
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;
}

.cf-activity-list::before {
    content: "";
    position: absolute;
    left: 5px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--cf-line);
}

.cf-act {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 0 6px 24px;
    font-size: 13.5px;
}

.cf-act-dot {
    position: absolute;
    left: 0;
    top: 10px;
    width: 12px;
    height: 12px;
    background: var(--cf-win);
    border: 2px solid var(--cf-line-strong);
    border-radius: 50%;
}

.cf-act.cf-new {
    animation: cf-in 400ms ease;
}

.cf-act.cf-new .cf-act-dot {
    background: var(--cf-ok);
    border-color: var(--cf-ok);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--cf-ok) 22%, transparent);
}

.cf-act.cf-new .cf-act-text {
    font-weight: 750;
}

.cf-act-time {
    margin-left: auto;
    color: var(--cf-faint);
    font-size: 12px;
    white-space: nowrap;
}

.cf-crm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--cf-line);
    background: var(--cf-win-2);
}

.cf-btn {
    padding: 9px 20px;
    background: var(--cf-win);
    border: 1px solid var(--cf-line-strong);
    border-radius: 8px;
    color: var(--cf-text);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    transition: transform 120ms ease, filter 120ms ease;
}

.cf-btn.cf-primary {
    background: var(--app);
    border-color: var(--app);
    color: #fff;
}

.cf-btn.cf-pressed {
    transform: scale(0.95);
    filter: brightness(1.15);
}

.cf-toast {
    position: absolute;
    bottom: 84px;
    left: 50%;
    z-index: 6;
    padding: 9px 16px;
    background: var(--cf-ok);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: var(--cf-shadow);
    opacity: 0;
    transform: translate(-50%, 8px);
    transition: opacity 250ms ease, transform 250ms ease;
}

.cf-toast.cf-show {
    opacity: 1;
    transform: translate(-50%, 0);
}

/* ---------- flow-canvas (node editor) ---------- */

.cf-flow-tabs {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--cf-win-3);
    border-radius: 8px;
}

.cf-flow-tab {
    padding: 4px 10px;
    border-radius: 6px;
    color: var(--cf-dim);
    font-size: 12px;
}

.cf-flow-tab.cf-active {
    background: var(--cf-win);
    color: var(--cf-text);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
}

.cf-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--cf-text);
}

.cf-switch {
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: 999px;
    background: var(--cf-ok);
}

.cf-switch i {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
}

.cf-save {
    padding: 5px 12px;
    border-radius: 7px;
    background: var(--app);
    color: #fff;
    font-weight: 700;
}

.cf-canvas {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background-color: var(--cf-canvas);
    background-image: radial-gradient(var(--cf-grid) 1.4px, transparent 1.4px);
    background-size: 20px 20px;
}

.cf-rail {
    position: absolute;
    top: 12px;
    left: 10px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cf-rail i {
    width: 26px;
    height: 26px;
    background: var(--cf-win-2);
    border: 1px solid var(--cf-line);
    border-radius: 7px;
}

.cf-rail .cf-rail-on {
    background: color-mix(in srgb, var(--app) 20%, var(--cf-win-2));
    border-color: var(--app);
}

.cf-wires {
    position: absolute;
    inset: 0;
    overflow: visible;
}

.cf-wire-line {
    fill: none;
    stroke: var(--cf-wire);
    stroke-width: 2;
    transition: stroke 400ms ease;
}

.cf-wire-arrow {
    fill: var(--cf-wire);
    transition: fill 400ms ease;
}

.cf-wire-label {
    fill: var(--cf-ok);
    font-family: var(--cf-font-mono);
    font-size: 11px;
    font-weight: 700;
    opacity: 0;
    transition: opacity 300ms ease;
}

.cf-wire.cf-lit .cf-wire-line {
    stroke: var(--cf-ok);
}

.cf-wire.cf-lit .cf-wire-arrow {
    fill: var(--cf-ok);
}

.cf-wire.cf-lit .cf-wire-label {
    opacity: 1;
}

.cf-nodes {
    position: absolute;
    inset: 0 0 60px 44px;
    display: flex;
    align-items: flex-start;
    justify-content: space-evenly;
    padding: 112px 6px 0;
}

.cf-node {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100px;
    text-align: center;
}

.cf-node-tile {
    position: relative;
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    background: var(--cf-node-bg);
    border: 2px solid var(--cf-node-border);
    border-radius: 12px;
    box-shadow: 0 6px 16px rgb(0 0 0 / 0.2);
    transition: border-color 300ms ease, box-shadow 300ms ease;
}

.cf-node.cf-trigger .cf-node-tile {
    border-radius: 38px 12px 12px 38px;
}

.cf-node-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: var(--node, var(--cf-win-3));
    color: var(--node-text, #fff);
    font-family: var(--cf-font-mono);
    font-size: 14px;
    font-weight: 800;
}

.cf-node:not([style]) .cf-node-icon {
    --node-text: var(--cf-text);
}

.cf-node-bolt {
    position: absolute;
    top: 50%;
    left: -24px;
    font-size: 15px;
    transform: translateY(-50%);
}

.cf-handle {
    position: absolute;
    top: 50%;
    background: var(--cf-wire);
    transform: translateY(-50%);
    transition: background 300ms ease;
}

.cf-handle-in {
    left: -6px;
    width: 6px;
    height: 16px;
    border-radius: 2px;
}

.cf-handle-out {
    right: -7px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.cf-node-badge {
    position: absolute;
    right: 5px;
    bottom: 5px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--cf-ok);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    opacity: 0;
    transform: scale(0.4);
    transition: opacity 250ms ease, transform 250ms cubic-bezier(0.3, 1.6, 0.5, 1);
}

.cf-node-badge::after {
    content: "\u2713";
}

.cf-node.cf-running .cf-node-tile {
    border-color: var(--app);
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--app) 22%, transparent);
    animation: cf-pulse 700ms ease-in-out infinite;
}

.cf-node.cf-ok .cf-node-tile {
    border-color: var(--cf-ok);
}

.cf-node.cf-ok .cf-handle {
    background: var(--cf-ok);
}

.cf-node.cf-ok .cf-node-badge {
    opacity: 1;
    transform: none;
}

.cf-node-title,
.cf-node-sub {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.cf-node-title {
    -webkit-line-clamp: 3;
    margin-top: 12px;
    font-size: 13px;
    font-weight: 750;
    line-height: 1.25;
}

.cf-node-sub {
    margin-top: 3px;
    color: var(--cf-dim);
    font-size: 11.5px;
    line-height: 1.3;
}

.cf-node-meta {
    min-height: 16px;
    margin-top: 6px;
    color: var(--cf-ok);
    font-family: var(--cf-font-mono);
    font-size: 11.5px;
}

.cf-canvas-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 16px;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
}

.cf-test-btn {
    padding: 8px 16px;
    border-radius: 8px;
    background: var(--app);
    color: #fff;
    font-size: 13px;
    font-weight: 750;
    box-shadow: 0 8px 20px -8px var(--app);
}

.cf-run-status {
    color: var(--cf-dim);
    font-family: var(--cf-font-mono);
    font-size: 12px;
}

.cf-run-status.cf-ok {
    color: var(--cf-ok);
}

.cf-ndv {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.45);
    opacity: 0;
    pointer-events: none;
    transition: opacity 300ms ease;
}

.cf-ndv.cf-open {
    opacity: 1;
}

.cf-ndv-panel {
    display: flex;
    flex-direction: column;
    width: calc(100% - 28px);
    height: calc(100% - 28px);
    overflow: hidden;
    background: var(--cf-win);
    border: 1px solid var(--cf-line-strong);
    border-radius: 12px;
    box-shadow: var(--cf-shadow);
    transform: scale(0.96);
    transition: transform 350ms cubic-bezier(0.3, 0.7, 0.2, 1);
}

.cf-ndv.cf-open .cf-ndv-panel {
    transform: none;
}

.cf-ndv-head {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    background: var(--cf-win-2);
    border-bottom: 1px solid var(--cf-line);
}

.cf-ndv-back {
    color: var(--cf-dim);
    font-size: 12px;
    white-space: nowrap;
}

.cf-ndv-title {
    display: flex;
    align-items: center;
    gap: 10px;
}

.cf-ndv-name {
    font-size: 15px;
    font-weight: 800;
}

.cf-ndv-sub {
    color: var(--cf-dim);
    font-size: 12px;
}

.cf-ndv-cols {
    display: grid;
    flex: 1;
    grid-template-columns: 0.85fr 1.15fr;
    min-height: 0;
}

.cf-ndv-col {
    min-width: 0;
    padding: 12px 14px;
    overflow: hidden;
}

.cf-ndv-input {
    background: var(--cf-canvas);
    border-right: 1px solid var(--cf-line);
}

.cf-ndv-label {
    margin: 4px 0 8px;
    color: var(--cf-dim);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.cf-ndv-json {
    margin: 0;
    font-family: var(--cf-font-mono);
    font-size: 11.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
}

.cf-ndv-empty {
    color: var(--cf-faint);
    font-size: 13px;
}

.cf-param {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
    padding: 7px 10px;
    background: var(--cf-win-2);
    border: 1px solid var(--cf-line);
    border-radius: 7px;
    font-size: 12.5px;
}

.cf-param-val {
    font-weight: 650;
}

.cf-expr-box,
.cf-msg-text code {
    font-family: var(--cf-font-mono);
}

.cf-expr-box {
    min-height: 58px;
    padding: 9px 11px;
    background: var(--cf-win-2);
    border: 1px solid var(--cf-line-strong);
    border-radius: 8px;
    font-size: 12.5px;
    line-height: 1.7;
    word-break: break-word;
}

.cf-tok {
    padding: 1px 4px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--cf-ok) 16%, transparent);
    color: var(--cf-ok);
    white-space: nowrap;
}

.cf-result-label {
    opacity: 0;
    transition: opacity 300ms ease;
}

.cf-result {
    opacity: 0;
    transition: opacity 300ms ease;
    padding: 9px 12px;
    background: color-mix(in srgb, var(--cf-ok) 10%, transparent);
    border-left: 3px solid var(--cf-ok);
    border-radius: 6px;
    font-size: 13.5px;
    line-height: 1.45;
}

.cf-result-label.cf-show,
.cf-result.cf-show {
    opacity: 1;
}

.cf-output {
    height: 0;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--cf-win-2);
    border-top: 1px solid transparent;
    transition: height 400ms ease;
}

.cf-output.cf-open {
    height: 156px;
    border-top-color: var(--cf-line);
}

.cf-output-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px 5px;
    color: var(--cf-dim);
    font-size: 12px;
    font-weight: 700;
}

.cf-output-count {
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--cf-ok) 16%, transparent);
    color: var(--cf-ok);
    font-size: 11px;
}

.cf-output-tabs {
    display: flex;
    gap: 2px;
    margin-left: auto;
    padding: 2px;
    background: var(--cf-win-3);
    border-radius: 6px;
    font-weight: 600;
}

.cf-output-tabs span {
    padding: 2px 8px;
    border-radius: 4px;
}

.cf-output-tabs .cf-active {
    background: var(--cf-win);
    color: var(--cf-text);
}

.cf-output pre {
    margin: 0;
    padding: 0 16px 10px;
    font-family: var(--cf-font-mono);
    font-size: 12.5px;
    line-height: 1.5;
    white-space: pre;
}

.j-key { color: var(--cf-accent); }
.j-str { color: var(--cf-ok); }
.j-num { color: var(--cf-warn); }
.j-lit { color: #c084fc; }

/* ---------- team-chat ---------- */

.cf-chat-main {
    display: flex;
    flex: 1;
    min-height: 0;
}

.cf-chat-side {
    width: 136px;
    flex-shrink: 0;
    padding: 12px 8px;
    background: color-mix(in srgb, var(--app) 12%, var(--cf-win-2));
    border-right: 1px solid var(--cf-line);
    font-size: 13.5px;
}

.cf-side-label {
    margin: 4px 8px 6px;
    color: var(--cf-dim);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.cf-chan {
    padding: 6px 8px;
    overflow: hidden;
    border-radius: 6px;
    color: var(--cf-dim);
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cf-chan.cf-active {
    background: var(--app);
    color: #fff;
    font-weight: 750;
}

.cf-chat-pane {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.cf-chat-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid var(--cf-line);
    font-size: 15.5px;
    font-weight: 800;
}

.cf-chat-members {
    color: var(--cf-dim);
    font-size: 12px;
    font-weight: 500;
}

.cf-msgs {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    padding: 12px 16px;
    overflow: hidden;
}

.cf-msgs > :first-child {
    margin-top: auto;
}

.cf-msg {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 10px;
}

.cf-msg.cf-new {
    animation: cf-in 400ms cubic-bezier(0.3, 0.7, 0.2, 1);
}

.cf-avatar {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: var(--avatar);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
}

.cf-msg-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.cf-msg-name {
    font-size: 14.5px;
    font-weight: 800;
}

.cf-badge {
    padding: 1px 4px;
    background: var(--cf-win-3);
    border-radius: 3px;
    color: var(--cf-dim);
    font-size: 9.5px;
    font-weight: 800;
}

.cf-msg-time {
    color: var(--cf-faint);
    font-size: 11.5px;
}

.cf-msg-main {
    min-width: 0;
}

.cf-msg-text {
    overflow-wrap: anywhere;
    margin-top: 2px;
    font-size: 14.5px;
    line-height: 1.45;
}

.cf-msg-text code {
    font-size: 13px;
}

.cf-reacts {
    display: flex;
    gap: 6px;
    margin-top: 7px;
}

.cf-react {
    display: inline-flex;
    gap: 5px;
    padding: 2px 9px;
    background: color-mix(in srgb, var(--cf-accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--cf-accent) 50%, transparent);
    border-radius: 999px;
    font-size: 13.5px;
    animation: cf-pop 350ms cubic-bezier(0.3, 1.6, 0.5, 1);
}

.cf-react-count {
    font-family: var(--cf-font-mono);
    font-weight: 700;
}

.cf-thread {
    margin-top: 9px;
    padding-left: 10px;
    border-left: 2px solid var(--cf-line);
}

.cf-thread-sum {
    margin-bottom: 6px;
    color: var(--cf-accent);
    font-size: 12.5px;
    font-weight: 800;
}

.cf-thread .cf-msg {
    grid-template-columns: 26px 1fr;
    animation: cf-in 400ms ease;
}

.cf-thread .cf-avatar {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    font-size: 10px;
}

.cf-composer {
    margin: 10px 16px 16px;
    padding: 11px 13px;
    border: 1px solid var(--cf-line);
    border-radius: 10px;
    color: var(--cf-faint);
    font-size: 14px;
}

/* ---------- cursor and packets ---------- */

.cf-cursor {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 50;
    width: 26px;
    height: 26px;
    margin: -4px 0 0 -4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 300ms ease;
}

.cf-cursor.cf-visible {
    opacity: 1;
}

.cf-cursor path {
    fill: #fff;
    stroke: #111;
    stroke-width: 1.4;
    stroke-linejoin: round;
    filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.4));
}

.cf-cursor-ring {
    position: absolute;
    left: -12px;
    top: -12px;
    width: 32px;
    height: 32px;
    border: 2px solid var(--cf-accent);
    border-radius: 50%;
    opacity: 0;
}

.cf-cursor.cf-click .cf-cursor-ring {
    animation: cf-ring 450ms ease-out;
}

.cf-links {
    position: absolute;
    inset: 0;
    z-index: 40;
    overflow: visible;
    pointer-events: none;
}

.cf-link {
    fill: none;
    stroke: var(--cf-accent);
    stroke-width: 3.5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 6px var(--cf-accent));
}

.cf-link.cf-trail {
    stroke-opacity: 0.3;
    filter: none;
}

.cf-link.cf-lit {
    stroke-opacity: 1;
    stroke-dasharray: 10 10 !important;
    filter: drop-shadow(0 0 6px var(--cf-accent));
    animation: cf-flow 900ms linear infinite;
}

.cf-packet {
    fill: #fff;
    filter: drop-shadow(0 0 10px var(--cf-accent));
}

/* ---------- overlays ---------- */

.cf-progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 60;
    height: 3px;
    background: rgb(255 255 255 / 0.08);
}

.cf-progress i {
    display: block;
    width: calc(var(--p, 0) * 100%);
    height: 100%;
    background: var(--cf-accent);
    box-shadow: 0 0 10px var(--cf-accent);
    transition: width 400ms ease;
}

.cf-subtitle {
    position: absolute;
    left: 50%;
    bottom: 4.5%;
    z-index: 60;
    max-width: 82%;
    padding: 0.45em 0.95em;
    background: rgb(8 10 14 / 0.74);
    border-radius: 0.55em;
    color: #fff;
    font-size: clamp(11px, 1.9cqi, 22px);
    font-weight: 600;
    line-height: 1.35;
    text-align: center;
    opacity: 0;
    transform: translate(-50%, 6px);
    transition: opacity 350ms ease, transform 350ms ease;
    backdrop-filter: blur(6px);
}

.cf-subtitle.cf-show {
    opacity: 1;
    transform: translate(-50%, 0);
}

.cf-intro,
.cf-endcard {
    position: absolute;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--cf-stage) 82%, transparent);
    opacity: 0;
    pointer-events: none;
    transition: opacity 500ms ease;
    backdrop-filter: blur(10px);
}

.cf-endcard {
    background: color-mix(in srgb, var(--cf-stage) 40%, transparent);
    backdrop-filter: none;
}

.cf-endcard-inner {
    padding: 1.6em 2.2em;
    background: color-mix(in srgb, var(--cf-win) 94%, transparent);
    border: 1px solid var(--cf-line-strong);
    border-radius: 16px;
    box-shadow: var(--cf-shadow);
}

.cf-endcard.cf-show.cf-instant li {
    opacity: 1;
    animation: none;
}

.cf-intro.cf-show,
.cf-endcard.cf-show {
    opacity: 1;
    pointer-events: auto;
}

.cf-intro-inner,
.cf-endcard-inner {
    max-width: 74%;
    text-align: center;
}

.cf-intro-chain {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.6em;
    margin-bottom: 1.1em;
    font-size: clamp(10px, 1.6cqi, 18px);
    font-weight: 700;
}

.cf-intro-app {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
}

.cf-intro-app .cf-appicon {
    width: 2.1em;
    height: 2.1em;
    border-radius: 0.55em;
    font-size: 0.8em;
}

.cf-intro-arrow {
    color: var(--cf-accent);
}

.cf-intro-title {
    font-size: clamp(18px, 4.2cqi, 50px);
    font-weight: 850;
    letter-spacing: -0.03em;
    line-height: 1.05;
}

.cf-intro-overview {
    margin-top: 0.7em;
    color: var(--cf-dim);
    font-size: clamp(11px, 1.75cqi, 20px);
    line-height: 1.45;
}

.cf-endcard-label {
    margin-bottom: 0.8em;
    color: var(--cf-accent);
    font-family: var(--cf-font-mono);
    font-size: clamp(10px, 1.3cqi, 15px);
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.cf-endcard ol {
    margin: 0 0 1.2em;
    padding: 0;
    list-style: none;
    font-size: clamp(11px, 1.75cqi, 20px);
    text-align: left;
}

.cf-endcard li {
    display: flex;
    gap: 0.6em;
    padding: 0.32em 0;
    opacity: 0;
}

.cf-endcard.cf-show li {
    animation: cf-in 450ms ease forwards;
    animation-delay: calc(var(--i, 0) * 160ms + 200ms);
}

.cf-check {
    color: var(--cf-ok);
    font-weight: 800;
}

.cf-poster {
    display: none;
}

.cf-player.cf-has-poster .cf-poster {
    position: absolute;
    inset: 0;
    z-index: 75;
    display: block;
}

.cf-poster ::slotted(*) {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cf-bigplay {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 80;
    width: 76px;
    height: 76px;
    padding-left: 6px;
    background: var(--cf-accent);
    border: none;
    border-radius: 50%;
    color: #031016;
    font-size: 28px;
    cursor: pointer;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 40px color-mix(in srgb, var(--cf-accent) 60%, transparent);
}

/* ---------- controls ---------- */

.cf-controls {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    margin-top: 1rem;
}

.cf-chapters {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 0.6rem;
}

.cf-ch {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.7rem 0.15rem 0;
    background: none;
    border: none;
    border-top: 2px solid var(--cf-line);
    color: var(--cf-control-text);
    font-family: var(--cf-font-mono);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
    opacity: 0.75;
    transition: color 300ms ease, border-color 300ms ease, opacity 300ms ease;
}

.cf-ch:hover,
.cf-ch.cf-done,
.cf-ch.cf-active {
    opacity: 1;
}

.cf-ch.cf-done {
    border-top-color: color-mix(in srgb, var(--cf-accent) 50%, transparent);
}

.cf-ch.cf-active {
    border-top-color: var(--cf-accent);
    box-shadow: 0 -6px 12px -8px var(--cf-accent);
}

.cf-ch-num {
    color: var(--cf-accent);
}

.cf-ch:focus-visible,
.cf-cbtn:focus-visible,
.cf-bigplay:focus-visible {
    outline: 2px solid var(--cf-accent);
    outline-offset: 3px;
}

.cf-now {
    display: none;
    color: var(--cf-control-text);
    font-family: var(--cf-font-mono);
    font-size: 12.5px;
}

.cf-buttons {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.7rem;
}

.cf-cbtn {
    padding: 0.45rem 0.85rem;
    background: none;
    border: 1px solid var(--cf-line);
    border-radius: 6px;
    color: var(--cf-accent);
    font-family: var(--cf-font-mono);
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
}

.cf-cbtn:hover {
    border-color: var(--cf-accent);
}

.cf-disclaimer {
    margin: 0.8rem 0 0;
    color: var(--cf-control-text);
    font-family: var(--cf-font-mono);
    font-size: 12px;
    opacity: 0.75;
}

.cf-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}

.cf-error {
    padding: 14px 16px;
    background: #2a1215;
    border: 1px solid #f87171;
    border-radius: 10px;
    color: #fecaca;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
}

.cf-error ul {
    margin: 8px 0 0;
    padding-left: 18px;
}

@container (max-width: 600px) {
    .cf-player[data-aspect="auto"] .cf-stage {
        aspect-ratio: 4 / 5;
    }
}

@container (max-width: 640px) {
    .cf-endcard-inner {
        max-width: 90%;
        padding: 0.9em 1.1em;
    }

    .cf-endcard ol {
        margin-bottom: 0.6em;
        font-size: clamp(10px, 3.1cqi, 15px);
    }

    .cf-endcard li {
        padding: 0.18em 0;
    }

    .cf-controls {
        flex-direction: column;
        gap: 0.6rem;
    }

    .cf-chapters {
        width: 100%;
    }

    .cf-ch-label {
        display: none;
    }

    .cf-now {
        display: block;
    }

    .cf-stage {
        border-radius: 10px;
    }
}

/* ---------- motion ---------- */

@keyframes cf-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
}

@keyframes cf-pop {
    from { transform: scale(0.5); }
    to { transform: none; }
}

@keyframes cf-ring {
    0% { opacity: 1; transform: scale(0.4); }
    100% { opacity: 0; transform: scale(1.4); }
}

@keyframes cf-pulse {
    50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--cf-accent) 12%, transparent); }
}

@keyframes cf-flow {
    to { stroke-dashoffset: -20; }
}

@media (prefers-reduced-motion: reduce) {
    .cf-ndv,
    .cf-ndv-panel,
    .cf-output,
    .cf-world > .cf-screen {
        transition: none;
    }

    .cf-link.cf-lit,
    .cf-node.cf-running .cf-node-tile {
        animation: none;
    }
}

/* ---------- scene backdrops ---------- */

.cf-backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.cf-backdrop-layer {
    position: absolute;
    inset: 0;
    background: linear-gradient(170deg, var(--bd-1), var(--bd-2));
    opacity: 0;
    transition: opacity 700ms ease;
}

.cf-backdrop-layer.cf-in {
    opacity: 1;
}

.cf-backdrop-layer.cf-instant {
    transition: none;
}

/* ---------- actors: spheres, blocks, pills, rings ---------- */

.cf-actor {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    opacity: 0;
    pointer-events: none;
    transform-origin: 50% 100%;
    transition: filter 500ms ease;
    will-change: transform;
}

/* a glossy ball: a soft two-tone body, a specular highlight, a window glint, and a rim of reflected light */
.cf-actor-sphere {
    background:
        radial-gradient(circle at 68% 80%, color-mix(in oklch, var(--actor) 72%, #fff) 0, transparent 30%),
        radial-gradient(circle at 34% 28%, color-mix(in oklch, var(--actor) 42%, #fff) 0, var(--actor) 40%, color-mix(in oklch, var(--actor) 62%, #2a1670) 100%);
    border-radius: 50%;
    box-shadow: inset -10px -16px 30px color-mix(in oklch, var(--actor) 50%, #000), inset 6px 8px 18px rgb(255 255 255 / 0.2);
}

.cf-actor-sphere::before {
    content: "";
    position: absolute;
    top: 10%;
    left: 17%;
    width: 36%;
    height: 25%;
    background: radial-gradient(ellipse, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0.5) 38%, transparent 72%);
    border-radius: 50%;
    transform: rotate(-32deg);
}

.cf-actor-sphere::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 63% 21%, rgb(255 255 255 / 0.75) 0, transparent 5%);
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14);
}

.cf-actor-block,
.cf-actor-pill {
    background: linear-gradient(160deg, color-mix(in oklch, var(--actor) 70%, #fff) 0%, var(--actor) 45%, color-mix(in oklch, var(--actor) 72%, #1d1450) 100%);
    border-radius: 26%;
    box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.45), inset 0 -8px 16px rgb(0 0 0 / 0.16);
}

/* a glossy sheen across the top */
.cf-actor-block::before,
.cf-actor-pill::before {
    content: "";
    position: absolute;
    top: 4%;
    left: 7%;
    right: 7%;
    height: 40%;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.42), rgb(255 255 255 / 0));
    border-radius: 999px 999px 40% 40%;
}

.cf-actor-pill {
    border-radius: 999px;
}

.cf-actor-ring {
    border: calc(var(--size) * 0.14) solid var(--actor);
    border-radius: 50%;
}

/* finishes: "gloss" (the default), "matte" with no shine, or see-through "glass" */
.cf-actor.cf-finish-matte::before,
.cf-actor.cf-finish-matte::after {
    display: none;
}

.cf-actor-sphere.cf-finish-matte {
    background: radial-gradient(circle at 36% 30%, color-mix(in oklch, var(--actor) 78%, #fff) 0, var(--actor) 50%, color-mix(in oklch, var(--actor) 75%, #2a1670) 100%);
    box-shadow: inset -8px -12px 24px color-mix(in oklch, var(--actor) 70%, #000);
}

/* glass is thin and clear in the middle and thick, deep-coloured at the rim; light gathers into a caustic near the bottom */
.cf-actor.cf-finish-glass {
    background:
        radial-gradient(ellipse 46% 26% at 50% 80%, color-mix(in oklch, var(--actor) 45%, #fff) 0, transparent 100%),
        radial-gradient(circle at 50% 46%, color-mix(in oklch, var(--actor) 22%, transparent) 0, color-mix(in oklch, var(--actor) 52%, transparent) 55%, color-mix(in oklch, var(--actor) 92%, #1d1450) 100%);
    border: 1.5px solid color-mix(in oklch, var(--actor) 45%, #fff);
    box-shadow:
        inset 0 0 0 1px rgb(255 255 255 / 0.3),
        inset 0 -16px 26px color-mix(in oklch, var(--actor) 65%, transparent),
        inset 0 12px 20px rgb(255 255 255 / 0.5);
    -webkit-backdrop-filter: blur(6px) saturate(180%);
    backdrop-filter: blur(6px) saturate(180%);
}

.cf-actor-block.cf-finish-glass,
.cf-actor-pill.cf-finish-glass {
    background: linear-gradient(160deg, color-mix(in oklch, var(--actor) 30%, rgb(255 255 255 / 0.6)), color-mix(in oklch, var(--actor) 50%, transparent) 50%, color-mix(in oklch, var(--actor) 85%, #1d1450));
}

/* the turning surface of a sphere: a faint seam and spot that show it rolling */
.cf-actor-spin {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 74% 62%, rgb(255 255 255 / 0.2) 0 8%, transparent 9.5%);
    border-radius: 50%;
}

.cf-actor-spin::before {
    content: "";
    position: absolute;
    inset: 16%;
    border: calc(var(--size) * 0.025) solid rgb(255 255 255 / 0.22);
    border-color: rgb(255 255 255 / 0.22) transparent transparent rgb(255 255 255 / 0.22);
    border-radius: 50%;
}

.cf-actor.cf-finish-matte .cf-actor-spin {
    opacity: 0.6;
}

/* light passing through glass tints its shadow */
.cf-actor-shadow.cf-shadow-glass {
    background: radial-gradient(closest-side, color-mix(in oklch, var(--actor) 55%, rgb(0 0 0 / 0.25)), transparent);
}

.cf-actor-shadow {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 39;
    background: radial-gradient(closest-side, rgb(0 0 0 / 0.32), rgb(0 0 0 / 0));
    border-radius: 50%;
    opacity: 0;
    pointer-events: none;
    will-change: transform;
}

.cf-actor-label {
    position: relative;
    padding: 0 10%;
    color: #fff;
    font: 700 calc(var(--size) * 0.13) / 1.2 var(--cf-font-ui);
    text-align: center;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
}

.cf-confetti-layer {
    position: absolute;
    inset: 0;
    z-index: 46;
    pointer-events: none;
}

.cf-confetti {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 2px;
    will-change: transform;
}

/* touch-first films hide the pointer */
.cf-cursor.cf-cursor-off {
    display: none;
}
`;

// src/core/constants.js
var VERSION = true ? "0.3.0" : "0.0.0-dev";
var STOP = /* @__PURE__ */ Symbol("cueflick.stop");
var WORLD = Object.freeze({ width: 1600, height: 900 });

// src/core/timeline.js
var Timeline = class {
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
      const frame = (now) => {
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
      wait: (ms) => animate(ms),
      animate
    };
  }
};
var easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
var EASES = Object.freeze({
  smooth: easeInOut,
  snappy: (t) => 1 - (1 - t) ** 5,
  linear: (t) => t,
  gentle: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  spring: (t) => {
    const c = 1.7;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
  bounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
    if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
    return n * (t - 2.625 / d) ** 2 + 0.984375;
  }
});
var EASE_NAMES = ["smooth", "snappy", "linear", "gentle", "spring"];
var easeOf = (name) => EASES[name] ?? EASES.smooth;

// src/core/design.js
var MODES = ["dark", "light", "auto"];
var ASPECTS = ["auto", "16:9", "4:5", "1:1"];
var DEFAULT_DESIGN = Object.freeze({
  mode: "dark",
  accent: "#22d3ee",
  font: Object.freeze({ ui: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', mono: '"JetBrains Mono", ui-monospace, Menlo, monospace' }),
  radius: 12,
  camera: Object.freeze({ zoom: 1.35, speed: 1, ease: "smooth", punch: null, follow: false }),
  pace: 1,
  aspect: "auto",
  intro: true,
  subtitles: true,
  endcard: true,
  cursor: true,
  backdrop: null
});
var LIMITS = Object.freeze({
  radius: [0, 24],
  zoom: [1, 2.5],
  speed: [0.25, 3],
  pace: [0.25, 3],
  duration: [100, 6e3],
  punchAmount: [1.05, 2],
  punchHold: [100, 3e3]
});
var DEFAULT_PUNCH = Object.freeze({ amount: 1.25, hold: 700 });
function resolvePunch(value) {
  if (value === void 0 || value === null || value === false) return null;
  if (value === true) return { ...DEFAULT_PUNCH };
  if (typeof value === "number") return { amount: number(value, DEFAULT_PUNCH.amount, LIMITS.punchAmount), hold: DEFAULT_PUNCH.hold };
  if (isObject(value)) {
    return {
      amount: number(value.amount, DEFAULT_PUNCH.amount, LIMITS.punchAmount),
      hold: number(value.hold, DEFAULT_PUNCH.hold, LIMITS.punchHold)
    };
  }
  return null;
}
function resolveBackdrop(value) {
  const colors = Array.isArray(value) ? value : [value];
  if (colors.length < 1 || colors.length > 2 || !colors.every(isHexColor)) return null;
  return [colors[0], colors[1] ?? colors[0]];
}
var resolveDuration = (value) => typeof value === "number" && Number.isFinite(value) ? clamp(value, ...LIMITS.duration) : void 0;
var safeFont = (value, fallback) => typeof value === "string" && /^[\w\s,'"-]+$/.test(value) ? value : fallback;
var number = (value, fallback, [min, max]) => typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
var clampZoom = (value) => number(value, 1, LIMITS.zoom);
function resolveDesign(design = {}) {
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
function applyDesign(root, design) {
  root.dataset.mode = design.mode === "auto" ? "dark" : design.mode;
  root.dataset.aspect = design.aspect;
  const tokens = {
    "--cf-accent": design.accent,
    "--cf-font-ui": design.font.ui,
    "--cf-font-mono": design.font.mono,
    "--cf-radius": `${design.radius}px`
  };
  if (design.aspect !== "auto") tokens["--cf-aspect"] = design.aspect.replace(":", " / ");
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}

// src/core/actors.js
var SHAPES = ["sphere", "block", "pill", "ring"];
var SPAWN_EFFECTS = ["pop", "drop", "rise", "fade"];
var LEAVE_EFFECTS = ["pop", "fall", "shrink", "fade"];
var PATHS = ["hop", "bounce", "roll", "slide", "float"];
var FINISHES = ["gloss", "matte", "glass"];
var ACTOR_KEYS = ["shape", "color", "colors", "size", "count", "columns", "gap", "label", "labels", "at", "squash", "finish"];
var MAX_BOUNCES = 4;
var MAX_PIECES = 24;
var CONFETTI_COLORS = ["#ff5f9e", "#ffc83d", "#34d399", "#3fa9ff", "#a66cff", "#ff7a45"];
var POP_MS = 520;
var DROP_MS = 460;
var LEAVE_MS = 360;
var SQUASH_MS = 90;
var SETTLE_MS = 320;
var BOUNCE_SETTLE_MS = 110;
var CONFETTI_MS = 2600;
var CONFETTI_WAIT_MS = 700;
var DROP_HEIGHT = 420;
var DEFAULT_BOUNCINESS = 0.36;
var heightOf = (shape, size) => shape === "pill" ? size * 0.46 : size;
var reboundCount = (value, fallback) => clamp(Math.round(typeof value === "number" ? value : fallback), 0, MAX_BOUNCES);
var reboundShare = (value) => clamp(typeof value === "number" ? value : DEFAULT_BOUNCINESS, 0.1, 0.8);
var Actors = class {
  /**
   * @param {HTMLElement} world
   * @param {Record<string, object>} defs  actor id → definition (validated)
   */
  constructor(world, defs) {
    this.world = world;
    this.items = /* @__PURE__ */ Object.create(null);
    this.bursts = 0;
    for (const [id, def] of Object.entries(defs ?? {})) this.items[id] = this.build(id, def);
  }
  build(id, def) {
    const shape = SHAPES.includes(def.shape) ? def.shape : "sphere";
    const size = clamp(typeof def.size === "number" ? def.size : 110, 16, 600);
    const count = clamp(Math.round(def.count ?? 1), 1, MAX_PIECES);
    const columns = clamp(Math.round(def.columns ?? count), 1, count);
    const rows = Math.ceil(count / columns);
    const gap = typeof def.gap === "number" ? def.gap : size * 0.25;
    const height = heightOf(shape, size);
    const finish = FINISHES.includes(def.finish) ? def.finish : "gloss";
    const pieces = Array.from({ length: count }, (_, i) => {
      const color = def.colors?.[i % def.colors.length] ?? def.color ?? "#a66cff";
      const label = def.labels?.[i] ?? (count === 1 ? def.label : void 0);
      const spin = shape === "sphere" ? h("span", { class: "cf-actor-spin" }) : null;
      const el = h("div", {
        class: `cf-actor cf-actor-${shape} cf-finish-${finish}`,
        "aria-hidden": "true",
        style: { "--actor": color, "--size": `${size}px`, width: `${size}px`, height: `${height}px` }
      }, [spin, label ? h("span", { class: "cf-actor-label", text: label }) : null]);
      const shadowW = size * 0.8;
      const shadowH = Math.max(8, size * 0.16);
      const shadow = h("div", {
        class: finish === "glass" ? "cf-actor-shadow cf-shadow-glass" : "cf-actor-shadow",
        "aria-hidden": "true",
        style: { "--actor": color, width: `${shadowW}px`, height: `${shadowH}px` }
      });
      this.world.append(shadow, el);
      return {
        el,
        spin,
        shadow,
        shadowW,
        shadowH,
        dx: (i % columns - (columns - 1) / 2) * (size + gap),
        dy: (Math.floor(i / columns) - (rows - 1) / 2) * (height + gap),
        lift: 0,
        sx: 1,
        sy: 1,
        opacity: 0
      };
    });
    const squash = clamp(typeof def.squash === "number" ? def.squash : shape === "sphere" ? 1 : 0.4, 0, 2);
    const actor = { id, shape, size, height, pieces, squash, x: def.at?.x ?? 800, y: def.at?.y ?? 450, turn: 0, take: 0, visible: false };
    this.place(actor);
    return actor;
  }
  place(actor) {
    for (const piece of actor.pieces) {
      const x = actor.x + piece.dx - actor.size / 2;
      const y = actor.y + piece.dy - actor.height / 2 - piece.lift;
      piece.el.style.setProperty("transform", `translate(${x}px, ${y}px) scale(${piece.sx}, ${piece.sy})`);
      piece.el.style.setProperty("opacity", String(piece.opacity));
      piece.spin?.style.setProperty("transform", `rotate(${actor.turn}rad)`);
      const near = clamp(1 - piece.lift / 520, 0.3, 1);
      const groundX = actor.x + piece.dx - piece.shadowW / 2;
      const groundY = actor.y + piece.dy + actor.height / 2 - piece.shadowH / 2;
      piece.shadow.style.setProperty("transform", `translate(${groundX}px, ${groundY}px) scale(${near * piece.sx}, ${near})`);
      piece.shadow.style.setProperty("opacity", String(piece.opacity * near));
    }
  }
  /** World rect of the whole formation, or of one piece. */
  rect(actor, index) {
    const pieces = index === void 0 ? actor.pieces : [actor.pieces[index]].filter(Boolean);
    if (!pieces.length) return null;
    const left = Math.min(...pieces.map((p) => actor.x + p.dx - actor.size / 2));
    const top = Math.min(...pieces.map((p) => actor.y + p.dy - actor.height / 2));
    const right = Math.max(...pieces.map((p) => actor.x + p.dx + actor.size / 2));
    const bottom = Math.max(...pieces.map((p) => actor.y + p.dy + actor.height / 2));
    return { x: left, y: top, w: right - left, h: bottom - top };
  }
  /** Where an actor's centre goes to sit on top of a rect ("perch"), or at its centre. */
  spotFor(actor, rect, { perch = false, offset } = {}) {
    const formation = this.rect(actor);
    const halfHeight = formation ? formation.h / 2 : actor.height / 2;
    return {
      x: rect.x + rect.w / 2 + (offset?.x ?? 0),
      y: (perch ? rect.y - halfHeight : rect.y + rect.h / 2) + (offset?.y ?? 0)
    };
  }
  /** Start a new motion for an actor; any older motion still running stops moving it. */
  claim(actor) {
    actor.take += 1;
    return actor.take;
  }
  /** Animate one take; resolves false if a newer motion took over meanwhile. */
  async frame(actor, take, ctx, ms, draw) {
    await ctx.animate(ms, (t) => {
      if (actor.take !== take) return;
      draw(t);
      this.place(actor);
    });
    return actor.take === take;
  }
  /** Squash (landing, take-off), then spring back; a quick settle launches straight into a rebound. */
  async squash(actor, ctx, take, { amount = 1, settle = SETTLE_MS, pieces = actor.pieces } = {}) {
    const sx = 1 + 0.3 * amount * actor.squash;
    const sy = 1 - 0.28 * amount * actor.squash;
    const pressed = await this.frame(actor, take, ctx, SQUASH_MS, (t) => {
      for (const piece of pieces) Object.assign(piece, { sx: 1 + (sx - 1) * t, sy: 1 + (sy - 1) * t });
    });
    if (!pressed) return false;
    const curve = settle < SETTLE_MS ? EASES.snappy : EASES.spring;
    return this.frame(actor, take, ctx, settle, (t) => {
      const k = curve(t);
      for (const piece of pieces) Object.assign(piece, { sx: sx + (1 - sx) * k, sy: sy + (1 - sy) * k });
    });
  }
  /**
   * One parabolic flight, stretching tall in the air. Without `from`/`to` the actor rebounds on
   * the spot; `carry` is the height each piece already had (taking over mid-air), eased away.
   */
  arc(actor, ctx, take, { ms, arc, curve = EASES.smooth, from, to, pieces = actor.pieces, carry }) {
    const stretch = actor.squash;
    return this.frame(actor, take, ctx, ms, (t) => {
      if (from && to) {
        const k = curve(t);
        actor.x = from.x + (to.x - from.x) * k;
        actor.y = from.y + (to.y - from.y) * k;
      }
      const air = Math.sin(Math.PI * t);
      pieces.forEach((piece, i) => Object.assign(piece, {
        lift: arc * 4 * t * (1 - t) + (carry?.[i] ?? 0) * (1 - t),
        sx: 1 - 0.1 * air * stretch,
        sy: 1 + 0.16 * air * stretch
      }));
    });
  }
  /**
   * Rebound after landing: `count` times, each `share` as high as the last, squashing less each
   * time. Flight time goes with √height, measured against a reference flight.
   */
  async rebound(actor, ctx, take, { count, share, height, reference, pieces = actor.pieces }) {
    let impact = 1;
    let rise = height;
    for (let i = 0; i < count; i++) {
      if (!await this.squash(actor, ctx, take, { amount: impact, settle: BOUNCE_SETTLE_MS, pieces })) return;
      rise *= share;
      if (!await this.arc(actor, ctx, take, { ms: reference.ms * Math.sqrt(rise / reference.height), arc: rise, pieces })) return;
      impact *= 0.6;
    }
    await this.squash(actor, ctx, take, { amount: count ? impact : 1, pieces });
  }
  async spawn(actor, ctx, { at, effect = "pop", stagger = 90, bounces, bounciness } = {}) {
    const take = this.claim(actor);
    if (at) Object.assign(actor, at);
    actor.visible = true;
    if (ctx.fast) {
      for (const piece of actor.pieces) Object.assign(piece, { opacity: 1, sx: 1, sy: 1, lift: 0 });
      this.place(actor);
      return;
    }
    await Promise.all(actor.pieces.map(async (piece, i) => {
      await ctx.wait(i * stagger);
      if (actor.take === take) await this.appear(actor, piece, effect, ctx, take, { bounces, bounciness });
    }));
  }
  async appear(actor, piece, effect, ctx, take, { bounces, bounciness } = {}) {
    if (effect === "drop") {
      Object.assign(piece, { opacity: 1, lift: DROP_HEIGHT });
      const landed = await this.frame(actor, take, ctx, DROP_MS, (t) => {
        piece.lift = DROP_HEIGHT * (1 - t * t);
      });
      if (landed) {
        await this.rebound(actor, ctx, take, {
          count: reboundCount(bounces, 1),
          share: reboundShare(bounciness),
          height: DROP_HEIGHT,
          reference: { height: DROP_HEIGHT, ms: DROP_MS * 2 },
          pieces: [piece]
        });
      }
      return;
    }
    const curve = effect === "pop" ? EASES.spring : EASES.snappy;
    await this.frame(actor, take, ctx, effect === "fade" ? 420 : POP_MS, (t) => {
      const k = curve(t);
      piece.opacity = effect === "fade" ? t : Math.min(1, t * 3);
      if (effect === "pop") Object.assign(piece, { sx: k, sy: k });
      if (effect === "rise") piece.lift = -90 * (1 - k);
    });
  }
  /**
   * Move to a world point. "hop" arcs and squashes on landing; "bounce" lands and rebounds;
   * "roll" stays on the surface and turns as it goes (distance ÷ radius); "slide" glides;
   * "float" drifts with a bob.
   */
  async move(actor, ctx, { to, path = "hop", duration, ease, height, bounces, bounciness }) {
    const take = this.claim(actor);
    const from = { x: actor.x, y: actor.y };
    const carry = actor.pieces.map((piece) => piece.lift);
    const airborne = carry.some((lift) => lift > 1);
    for (const piece of actor.pieces) Object.assign(piece, { sx: 1, sy: 1 });
    if (ctx.fast) {
      for (const piece of actor.pieces) piece.lift = 0;
      Object.assign(actor, to);
      this.place(actor);
      return;
    }
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const curve = easeOf(ease ?? (path === "float" ? "gentle" : "smooth"));
    if (path === "hop" || path === "bounce") {
      const ms2 = resolveDuration(duration) ?? clamp(380 + distance * 0.55, 450, 1400);
      if (!airborne && !await this.squash(actor, ctx, take, { amount: 0.5 })) return;
      const arc = typeof height === "number" ? height : clamp(distance * 0.45, 90, 320);
      if (!await this.arc(actor, ctx, take, { ms: ms2, arc, curve, from, to, carry })) return;
      await this.rebound(actor, ctx, take, {
        count: reboundCount(bounces, path === "bounce" ? 2 : 0),
        share: reboundShare(bounciness),
        height: arc,
        reference: { height: arc, ms: ms2 }
      });
      return;
    }
    const ms = resolveDuration(duration) ?? clamp(500 + distance * (path === "roll" ? 2.4 : 0.55), 450, 4e3);
    const turnFrom = actor.turn;
    const radius = actor.size / 2;
    await this.frame(actor, take, ctx, ms, (t) => {
      const k = curve(t);
      actor.x = from.x + (to.x - from.x) * k;
      actor.y = from.y + (to.y - from.y) * k;
      if (path === "roll") actor.turn = turnFrom + (to.x - from.x) * k / radius;
      actor.pieces.forEach((piece, i) => {
        piece.lift = carry[i] * (1 - k) + (path === "float" ? 14 * Math.sin(Math.PI * 2 * t) : 0);
      });
    });
  }
  async leave(actor, ctx, { effect = "pop" } = {}) {
    const take = this.claim(actor);
    actor.visible = false;
    if (ctx.fast) {
      for (const piece of actor.pieces) piece.opacity = 0;
      this.place(actor);
      return;
    }
    const start = actor.pieces.map((piece) => ({ ...piece }));
    const left = await this.frame(actor, take, ctx, effect === "fall" ? 620 : LEAVE_MS, (t) => {
      actor.pieces.forEach((piece, i) => {
        if (effect === "pop") {
          const k = t < 0.3 ? 1 + 0.18 * (t / 0.3) : 1.18 * (1 - (t - 0.3) / 0.7);
          Object.assign(piece, { sx: k, sy: k, opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3 });
        } else if (effect === "fall") {
          Object.assign(piece, { lift: start[i].lift - 700 * t * t, opacity: 1 - t * t });
        } else if (effect === "shrink") {
          const k = 1 - EASES.smooth(t);
          Object.assign(piece, { sx: k, sy: k, opacity: Math.min(1, k * 3) });
        } else {
          piece.opacity = 1 - t;
        }
      });
    });
    if (!left) return;
    for (const piece of actor.pieces) Object.assign(piece, { opacity: 0, lift: 0, sx: 1, sy: 1 });
    this.place(actor);
  }
  /**
   * A burst of confetti from a world point. Waits for the burst, and lets the
   * pieces finish falling while the film carries on.
   */
  async confetti(at, ctx, { count = 90, colors = CONFETTI_COLORS, power = 1 } = {}) {
    if (ctx.fast) return;
    const random = seeded(++this.bursts * 7919);
    const pieces = Array.from({ length: clamp(Math.round(count), 10, 240) }, (_, i) => {
      const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.95;
      const speed = (700 + random() * 900) * power;
      const el = h("i", {
        class: "cf-confetti",
        style: { background: colors[i % colors.length], width: `${8 + random() * 9}px`, height: `${5 + random() * 11}px` }
      });
      return { el, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, spin: (random() - 0.5) * 1600, flip: random() * 6.3, rate: 4 + random() * 8 };
    });
    const layer = h("div", { class: "cf-confetti-layer", "aria-hidden": "true" }, pieces.map((piece) => piece.el));
    this.world.append(layer);
    const drag = 1.9;
    const gravity = 1700;
    const fall = ctx.animate(CONFETTI_MS, (t) => {
      const s2 = t * CONFETTI_MS / 1e3;
      const slow = (1 - Math.exp(-drag * s2)) / drag;
      for (const piece of pieces) {
        const x = at.x + piece.vx * slow;
        const y = at.y + piece.vy * slow + gravity / drag * (s2 - slow);
        piece.el.style.setProperty("transform", `translate(${x}px, ${y}px) rotate(${piece.spin * s2}deg) scaleY(${Math.cos(piece.flip + piece.rate * s2)})`);
        piece.el.style.setProperty("opacity", String(t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25));
      }
    }).finally(() => layer.remove());
    fall.catch((error) => {
      if (error !== STOP) console.error(error);
    });
    await ctx.wait(CONFETTI_WAIT_MS);
  }
};

// src/core/camera.js
var PADDING = { screen: 28, part: 90, all: 24, follow: 170 };
var MOVE_MS = 900;
var FOLLOW_MS = 700;
var PUNCH_IN_MS = 260;
var PUNCH_OUT_MS = 480;
var PUNCH_STEP_MS = 40;
var TRACK = { edge: 0.1, aim: 0.4, small: 0.1, margin: 0.04 };
var FRAME = { top: 0.05, bottom: 0.18, side: 0.03 };
var CENTRE_Y = FRAME.top + (1 - FRAME.top - FRAME.bottom) / 2;
function frameFor(rect, stage2, { zoom = 1, maxZoom = 1.35 } = {}) {
  const k = stage2.width / WORLD.width;
  const viewport = { w: WORLD.width, h: stage2.height / k };
  const pad = PADDING[rect.kind] ?? PADDING.screen;
  const frameHeight = 1 - FRAME.top - FRAME.bottom;
  const fit = Math.min(
    viewport.w * (1 - FRAME.side * 2) / (rect.w + pad * 2),
    viewport.h * frameHeight / (rect.h + pad * 2)
  );
  const factor = clampZoom(zoom);
  const limit = (rect.kind === "part" || rect.kind === "follow" ? maxZoom * 1.6 : maxZoom) * factor;
  const scale = clamp(fit * factor, 0.15, limit) * k;
  return {
    x: stage2.width / 2 - (rect.x + rect.w / 2) * scale,
    y: stage2.height * CENTRE_Y - (rect.y + rect.h / 2) * scale,
    scale
  };
}
var lerp = (from, to, t) => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  scale: from.scale + (to.scale - from.scale) * t
});
var Camera = class {
  /**
   * @param {HTMLElement} stage  visible viewport
   * @param {HTMLElement} world  1600×900 layer that gets transformed
   * @param {(target: string) => object|null} resolve  target → world rect
   * @param {{maxZoom: number, speed: number, ease?: string}} options
   */
  constructor(stage2, world, resolve, { maxZoom, speed, ease = "smooth" }) {
    this.stage = stage2;
    this.world = world;
    this.resolve = resolve;
    this.maxZoom = maxZoom;
    this.speed = speed;
    this.ease = ease;
    this.target = "all";
    this.zoom = 1;
    this.current = null;
    this.moveId = 0;
    this.punchState = null;
    this.tracking = false;
    this.dived = null;
  }
  stageSize() {
    const width = this.stage.clientWidth;
    const height = this.stage.clientHeight;
    return width && height ? { width, height } : null;
  }
  /** Transform that frames a world rect. */
  frame(rect, zoom = this.zoom) {
    const size = this.stageSize();
    return rect && size ? frameFor(rect, size, { zoom, maxZoom: this.maxZoom }) : null;
  }
  goal() {
    const rect = this.resolve(this.target);
    return this.dived ? this.cover(rect, this.dived.round) : this.frame(rect);
  }
  /** The transform at which a rect fills the whole stage (a round one covers the corners too, so √2 further). */
  cover(rect, round) {
    const size = this.stageSize();
    if (!rect || !size) return null;
    const scale = Math.max(size.width / rect.w, size.height / rect.h) * (round ? Math.SQRT2 * 1.06 : 1.08);
    return { scale, x: size.width / 2 - (rect.x + rect.w / 2) * scale, y: size.height / 2 - (rect.y + rect.h / 2) * scale };
  }
  set(transform) {
    this.current = transform;
    this.world.style.setProperty("transform", `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`);
  }
  /** Re-frame the current target immediately (after a resize). */
  apply() {
    const goal = this.goal();
    if (goal) this.set(goal);
  }
  /**
   * Animate to a transform. Resolves when the move ends; a newer move takes over mid-flight.
   * @param {{x:number,y:number,scale:number}} goal
   * @param {{ctx?: object, instant?: boolean, duration?: number, ease?: string}} options
   */
  async moveTo(goal, { ctx, instant = false, duration, ease } = {}) {
    if (!goal) return;
    const id = ++this.moveId;
    const from = this.current;
    if (instant || !ctx || ctx.fast || !from) {
      this.set(goal);
      return;
    }
    const curve = easeOf(ease ?? this.ease);
    const ms = resolveDuration(duration) ?? MOVE_MS / this.speed;
    await ctx.animate(ms, (progress) => {
      if (id === this.moveId) this.set(lerp(from, goal, curve(progress)));
    });
  }
  /**
   * Frame a target ("all", a screen id, or "screen.part:name").
   * @param {string} target
   * @param {{zoom?: number, ctx?: object, instant?: boolean, duration?: number, ease?: string}} [options]
   */
  focus(target, { zoom, ...options } = {}) {
    this.target = target;
    this.zoom = clampZoom(zoom);
    this.dived = null;
    this.punchState = null;
    return this.moveTo(this.goal(), options);
  }
  /**
   * Slide at the current zoom: to a target's centre, or by an offset in world units.
   * @param {string|{x?: number, y?: number}} target
   */
  pan(target, options = {}) {
    const from = this.current;
    const size = this.stageSize();
    if (!from || !size) return Promise.resolve();
    let goal;
    if (typeof target === "string") {
      const rect = this.resolve(target);
      if (!rect) return Promise.resolve();
      goal = {
        scale: from.scale,
        x: size.width / 2 - (rect.x + rect.w / 2) * from.scale,
        y: size.height * CENTRE_Y - (rect.y + rect.h / 2) * from.scale
      };
    } else {
      goal = { scale: from.scale, x: from.x - (target.x ?? 0) * from.scale, y: from.y - (target.y ?? 0) * from.scale };
    }
    this.punchState = null;
    this.dived = null;
    return this.moveTo(goal, options);
  }
  /**
   * Follow the action: ease toward an element's world rect, but only when it is
   * drifting out of a comfortable frame (so the camera doesn't jitter).
   */
  follow(rect, ctx) {
    const size = this.stageSize();
    const from = this.current;
    if (!rect || !size || !from || ctx.fast) return Promise.resolve();
    const screenX = from.x + (rect.x + rect.w / 2) * from.scale;
    const screenY = from.y + (rect.y + rect.h / 2) * from.scale;
    const comfortable = screenX > size.width * 0.22 && screenX < size.width * 0.78 && screenY > size.height * 0.15 && screenY < size.height * 0.7;
    if (comfortable) return Promise.resolve();
    const goal = frameFor({ ...rect, kind: "follow" }, size, { maxZoom: this.maxZoom });
    goal.scale = Math.max(goal.scale, Math.min(from.scale, goal.scale * 1.2));
    goal.x = size.width / 2 - (rect.x + rect.w / 2) * goal.scale;
    goal.y = size.height * CENTRE_Y - (rect.y + rect.h / 2) * goal.scale;
    return this.moveTo(goal, { ctx, duration: FOLLOW_MS, ease: "smooth" });
  }
  /**
   * Keep an element on screen at the current zoom: a caret while typing, or a
   * menu that just opened. Pans only once it nears an edge, one move at a time,
   * so typing doesn't shake the frame. A small element is put a little left of
   * centre (room to type into); a larger one is nudged just inside the edge.
   * With `bounds` (the box being typed in), the pan never shows more of the
   * backdrop than it has to.
   * @param {{x:number,y:number,w:number,h:number}} rect  world units
   * @param {object} ctx  step context
   * @param {{x:number,y:number,w:number,h:number}} [bounds]  world units
   */
  async track(rect, ctx, bounds) {
    const size = this.stageSize();
    const from = this.current;
    if (!rect || !size || !from || ctx.fast || this.tracking) return;
    const { scale } = from;
    const left = from.x + rect.x * scale;
    const right = left + rect.w * scale;
    const top = from.y + rect.y * scale;
    const bottom = top + rect.h * scale;
    const edge = { left: size.width * TRACK.edge, right: size.width * (1 - TRACK.edge), top: size.height * FRAME.top, bottom: size.height * (1 - FRAME.bottom) };
    const outX = left < edge.left || right > edge.right;
    const outY = top < edge.top || bottom > edge.bottom;
    if (!outX && !outY) return;
    let x = from.x;
    let y = from.y;
    if (outX) {
      x += right - left < size.width * TRACK.small ? size.width * TRACK.aim - (left + right) / 2 : left < edge.left ? edge.left - left : edge.right - right;
      if (bounds) {
        const margin = size.width * TRACK.margin;
        x = bounds.w * scale <= size.width - margin * 2 ? size.width / 2 - (bounds.x + bounds.w / 2) * scale : clamp(x, size.width - margin - (bounds.x + bounds.w) * scale, margin - bounds.x * scale);
      }
    }
    if (outY) y += top < edge.top ? edge.top - top : edge.bottom - bottom;
    if (Math.abs(x - from.x) < 1 && Math.abs(y - from.y) < 1) return;
    const goal = { scale, x, y };
    this.tracking = true;
    try {
      await this.moveTo(goal, { ctx, duration: FOLLOW_MS, ease: "smooth" });
    } finally {
      this.tracking = false;
    }
  }
  /** Frame a detail for a moment without changing the chapter's framing; `back()` returns to it. */
  look(rect, { zoom, ...options } = {}) {
    this.punchState = null;
    return this.moveTo(this.frame({ ...rect, kind: "part" }, clampZoom(zoom)), options);
  }
  /**
   * Dive: move in until a target fills the whole stage, the way a scene cuts
   * "through" an object into the next one. It stays dived (through resizes)
   * until the next focus pulls back out.
   */
  dive(target, { round = false, ...options } = {}) {
    this.target = target;
    this.zoom = 1;
    this.dived = { round };
    this.punchState = null;
    return this.moveTo(this.goal(), options);
  }
  /** Return to the current target's framing (after a look). */
  back(options = {}) {
    this.punchState = null;
    return this.moveTo(this.goal(), options);
  }
  /**
   * Punch in toward a world point on a click, hold, then ease back out.
   * Clicks during an active punch extend its hold instead of starting another.
   * @param {{x:number,y:number}} point world units
   * @param {object} ctx step context
   * @param {{amount:number, hold:number}} punch
   */
  async punchAt(point, ctx, { amount, hold }) {
    if (ctx.fast || !this.current) return;
    if (this.punchState) {
      this.punchState.holdUntil = this.punchState.elapsed + hold;
      return;
    }
    const size = this.stageSize();
    if (!size) return;
    const base = this.current;
    const scale = base.scale * amount;
    const screen = { x: base.x + point.x * base.scale, y: base.y + point.y * base.scale };
    const aim = { x: screen.x + (size.width / 2 - screen.x) * 0.35, y: screen.y + (size.height * CENTRE_Y - screen.y) * 0.35 };
    const goal = { scale, x: aim.x - point.x * scale, y: aim.y - point.y * scale };
    const state = { elapsed: 0, holdUntil: hold };
    this.punchState = state;
    await this.moveTo(goal, { ctx, duration: PUNCH_IN_MS, ease: "snappy" });
    const moveAfterIn = this.moveId;
    while (this.punchState === state && state.elapsed < state.holdUntil) {
      await ctx.wait(PUNCH_STEP_MS);
      state.elapsed += PUNCH_STEP_MS;
    }
    if (this.punchState === state && this.moveId === moveAfterIn) {
      this.punchState = null;
      await this.moveTo(this.goal() ?? base, { ctx, duration: PUNCH_OUT_MS, ease: "smooth" });
    }
  }
};

// src/core/cursor.js
var MOVE_MS2 = 650;
var CLICK_MS = 260;
var Cursor = class {
  /** @param {{hidden?: boolean}} [options] hidden: touch-first films never show the pointer */
  constructor(world, { hidden = false } = {}) {
    this.world = world;
    this.hidden = hidden;
    this.el = h("div", { class: "cf-cursor", "aria-hidden": "true" }, [
      s("svg", { viewBox: "0 0 24 24", width: "26", height: "26" }, [
        s("path", { d: "M4 2l15 9.5-6.6 1.4L16 21l-3 1.5-3.7-8.2L4 18.6z" })
      ]),
      h("span", { class: "cf-cursor-ring" })
    ]);
    if (hidden) this.el.classList.add("cf-cursor-off");
    this.x = 1200;
    this.y = 820;
    this.place();
    world.append(this.el);
  }
  place() {
    this.el.style.setProperty("transform", `translate(${this.x}px, ${this.y}px)`);
  }
  /** Move to the centre of an element (or an offset within it). */
  async moveTo(target, ctx, { dx = 0.5, dy = 0.5 } = {}) {
    const rect = rectIn(this.world, target);
    const goal = { x: rect.x + rect.w * dx, y: rect.y + rect.h * dy };
    this.el.classList.add("cf-visible");
    if (ctx.fast) {
      Object.assign(this, goal);
      this.place();
      return;
    }
    const from = { x: this.x, y: this.y };
    await ctx.animate(MOVE_MS2, (progress) => {
      const t = easeInOut(progress);
      this.x = from.x + (goal.x - from.x) * t;
      this.y = from.y + (goal.y - from.y) * t;
      this.place();
    });
  }
  async click(ctx) {
    if (ctx.fast) return;
    this.el.classList.remove("cf-click");
    void this.el.offsetWidth;
    this.el.classList.add("cf-click");
    if (ctx.punch && ctx.player) {
      ctx.player.camera.punchAt({ x: this.x, y: this.y }, ctx, ctx.punch).catch((error) => {
        if (error !== STOP) console.error(error);
      });
    }
    await ctx.wait(CLICK_MS);
  }
  hide() {
    this.el.classList.remove("cf-visible");
  }
};

// src/core/links.js
var PACKET_MS = 1100;
var Links = class _Links {
  constructor(world) {
    this.trails = [];
    this.svg = s("svg", {
      class: "cf-links",
      viewBox: `0 0 ${WORLD.width} ${WORLD.height}`,
      width: String(WORLD.width),
      height: String(WORLD.height),
      "aria-hidden": "true"
    });
    world.append(this.svg);
  }
  static path(from, to) {
    const forward = to.x >= from.x + from.w / 2;
    const x1 = forward ? from.x + from.w : from.x;
    const y1 = from.y + from.h / 2;
    const x2 = forward ? to.x : to.x + to.w;
    const y2 = to.y + to.h / 2;
    const bend = Math.max(60, Math.abs(x2 - x1) * 0.45) * (forward ? 1 : -1);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
  }
  /**
   * Send a packet between two targets.
   * @param {string} from target
   * @param {string} to target
   * @param {(target: string) => object|null} resolve target → world rect
   */
  async packet(from, to, resolve, ctx) {
    const a = resolve(from);
    const b = resolve(to);
    if (!a || !b) return;
    const path = s("path", { class: "cf-link", d: _Links.path(a, b) });
    const dot = s("circle", { class: "cf-packet", r: "7" });
    this.svg.append(path, dot);
    const length = path.getTotalLength();
    path.style.setProperty("stroke-dasharray", `${length}`);
    await ctx.animate(PACKET_MS, (progress) => {
      const t = easeInOut(progress);
      path.style.setProperty("stroke-dashoffset", `${length * (1 - t)}`);
      const point = path.getPointAtLength(length * t);
      dot.setAttribute("cx", String(point.x));
      dot.setAttribute("cy", String(point.y));
    });
    dot.remove();
    path.style.removeProperty("stroke-dasharray");
    path.style.removeProperty("stroke-dashoffset");
    path.classList.add("cf-trail");
    this.trails.push({ from, to, path });
  }
  /** Recompute trail geometry (after a resize or a hidden-container reveal). */
  redraw(resolve) {
    for (const trail of this.trails) {
      const a = resolve(trail.from);
      const b = resolve(trail.to);
      if (a && b) trail.path.setAttribute("d", _Links.path(a, b));
    }
  }
  /** Light every trail (used by the recap). */
  lightAll() {
    for (const trail of this.trails) trail.path.classList.add("cf-lit");
  }
};

// src/core/steps.js
var GENERIC_ACTIONS = ["focus", "pan", "dive", "blur", "caption", "wait", "packet", "enter", "exit", "front", "spawn", "move", "leave", "confetti", "backdrop"];
var MOTION_KEYS = ["duration", "ease"];
var GENERIC_KEYS = {
  focus: ["zoom", ...MOTION_KEYS, "async"],
  pan: [...MOTION_KEYS, "async"],
  dive: [...MOTION_KEYS, "into"],
  blur: ["amount"],
  caption: [],
  wait: [],
  packet: [],
  enter: ["from", ...MOTION_KEYS],
  exit: ["to", ...MOTION_KEYS],
  front: ["dim"],
  spawn: ["at", "perch", "offset", "effect", "stagger", "bounces", "bounciness"],
  move: ["to", "perch", "offset", "path", "height", "bounces", "bounciness", ...MOTION_KEYS, "async"],
  leave: ["effect"],
  confetti: ["count", "colors", "power"],
  backdrop: []
};
var SURFACE_STEP_KEYS = ["on", "punch"];
var DIRECTIONS = ["left", "right", "top", "bottom", "fade", "zoom", "pop", "drop", "launch", "minimize", "flip"];
var SCREEN_ACTIONS = ["enter", "exit", "front"];
function actionOf(step, surfaceActions) {
  return Object.keys(step).find((key) => GENERIC_ACTIONS.includes(key) || surfaceActions.has(key)) ?? null;
}
function resolveStepScreen(step, action, screens) {
  const keys = Object.keys(screens);
  const owners = keys.filter((key) => hasOwn(screens[key].surface.actions, action));
  const selector = typeof step[action] === "string" ? parseSelector(step[action]) : null;
  const selected = selector && hasOwn(screens, selector.screen) && selector.part ? selector.screen : null;
  if (step.on !== void 0) {
    if (!hasOwn(screens, step.on)) return { error: `screen "${step.on}" is not defined.`, path: "on", candidates: keys };
    if (!hasOwn(screens[step.on].surface.actions, action)) return { error: `"${action}" can't run on "${step.on}".`, path: "on" };
    if (selected && selected !== step.on) {
      return { error: `"on": "${step.on}" disagrees with the target's screen "${selected}"; remove "on" or fix the target.`, path: "on" };
    }
    return { key: step.on };
  }
  if (selected) {
    if (!hasOwn(screens[selected].surface.actions, action)) return { error: `"${action}" doesn't work on "${selected}"; check the target.` };
    return { key: selected };
  }
  if (owners.length === 1) return { key: owners[0] };
  if (owners.length === 0) return { error: `"${action}" needs a screen that supports it, and this clip has none.` };
  return { error: `"${action}" could apply to ${owners.join(" or ")}; add "on": "<screen>".` };
}

// src/core/player.js
var INTRO_MS = 3e3;
var CHAPTER_SETTLE_MS = 300;
var CHAPTER_END_MS = 600;
var CAPTION_MS = 1100;
var ENTER_MS = 800;
var EXIT_MS = 650;
var FOLLOW_TRAIL = "follow";
var FRONT_MS = 450;
var ENDCARD_DELAY_MS = 2200;
var slide = (dx, dy) => ({
  ease: "smooth",
  apply: (el, amount) => {
    const rest = 1 - amount;
    el.style.setProperty("transform", `translate(${dx * rest}px, ${dy * rest}px)`);
    el.style.setProperty("opacity", String(clamp(amount, 0, 1)));
  }
});
var EFFECTS = {
  left: slide(-260, 0),
  right: slide(260, 0),
  top: slide(0, -200),
  bottom: slide(0, 200),
  fade: { ease: "smooth", apply: (el, amount) => el.style.setProperty("opacity", String(clamp(amount, 0, 1))) },
  zoom: {
    ease: "smooth",
    apply: (el, amount) => {
      el.style.setProperty("transform", `scale(${0.88 + 0.12 * amount})`);
      el.style.setProperty("opacity", String(clamp(amount, 0, 1)));
    }
  },
  // springs in from small with a little overshoot
  pop: {
    ease: "spring",
    ms: 650,
    apply: (el, amount) => {
      el.style.setProperty("transform", `scale(${0.55 + 0.45 * amount})`);
      el.style.setProperty("opacity", String(clamp(amount * 2, 0, 1)));
    }
  },
  // falls in from above and bounces to rest
  drop: {
    ease: "bounce",
    ms: 1e3,
    apply: (el, amount) => {
      el.style.setProperty("transform", `translateY(${-420 * (1 - amount)}px)`);
      el.style.setProperty("opacity", String(clamp(amount * 3, 0, 1)));
    }
  },
  // grows out of a dock point at the bottom centre of the stage
  launch: {
    ease: "snappy",
    ms: 700,
    dock: true,
    apply: (el, amount) => {
      el.style.setProperty("transform", `scale(${0.05 + 0.95 * amount})`);
      el.style.setProperty("opacity", String(clamp(amount * 1.6, 0, 1)));
    }
  },
  // turns in on its vertical axis like a card
  flip: {
    ease: "smooth",
    ms: 750,
    apply: (el, amount) => {
      el.style.setProperty("transform", `perspective(1400px) rotateY(${-90 * (1 - amount)}deg)`);
      el.style.setProperty("opacity", String(amount < 0.02 ? 0 : 1));
    }
  }
};
EFFECTS.minimize = EFFECTS.launch;
var prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
var Player = class {
  /**
   * @param {HTMLElement} host   element that receives events (the <cue-flick> element)
   * @param {HTMLElement} mount  container to render into (inside the shadow root)
   * @param {object} clip        a clip that passed validateClip()
   * @param {object} [options]   autoplay ('view' | 'none'), controls, chapter, mode, endcard, reducedMotion
   */
  constructor(host, mount2, clip2, options = {}) {
    this.host = host;
    this.clip = clip2;
    this.options = { autoplay: "view", controls: true, chapter: null, mode: null, endcard: true, ...options };
    this.design = resolveDesign(clip2.design);
    if (MODES.includes(this.options.mode)) this.design.mode = this.options.mode;
    this.template = getTemplate(clip2.template);
    this.chapters = clip2.chapters;
    this.timeline = new Timeline();
    this.reduced = this.options.reducedMotion ?? prefersReducedMotion();
    this.state = "idle";
    this.userPaused = false;
    this.autoPaused = false;
    this.pendingStart = null;
    this.readyChapter = null;
    this.views = /* @__PURE__ */ Object.create(null);
    this.actionNames = new Set(Object.values(clip2.screens).flatMap((screen) => Object.keys(getSurface(screen.surface).actions)));
    this.buildFrame(mount2);
    this.watchColorScheme();
    this.buildScene();
    this.start();
  }
  // ---------- structure ----------
  buildFrame(mount2) {
    const { clip: clip2 } = this;
    this.world = h("div", { class: "cf-world" });
    this.backdrop = h("div", { class: "cf-backdrop", "aria-hidden": "true" });
    this.progressBar = h("i");
    this.subtitle = h("span");
    this.intro = this.buildIntro();
    this.endcard = this.buildEndcard();
    this.stage = h("div", {
      class: "cf-stage",
      role: "group",
      "aria-roledescription": "product film",
      "aria-label": clip2.title
    }, [
      this.backdrop,
      this.world,
      h("div", { class: "cf-progress", "aria-hidden": "true" }, this.progressBar),
      this.intro,
      h("div", { class: "cf-subtitle", "aria-hidden": "true" }, this.subtitle),
      this.endcard,
      h("div", { class: "cf-poster" }, h("slot", { name: "poster" }))
    ]);
    this.root = h("div", { class: "cf-player" }, [
      this.stage,
      this.options.controls ? this.buildControls() : null,
      clip2.disclaimer ? h("p", { class: "cf-disclaimer", text: clip2.disclaimer }) : null,
      this.buildTranscript()
    ]);
    applyDesign(this.root, this.design);
    this.setState("idle");
    mount2.replaceChildren(this.root);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.stage);
  }
  /** In "auto" mode, follow the viewer's light/dark setting live. */
  watchColorScheme() {
    if (this.design.mode !== "auto" || typeof matchMedia !== "function") return;
    this.colorScheme = matchMedia("(prefers-color-scheme: light)");
    this.onColorScheme = () => {
      this.root.dataset.mode = this.colorScheme.matches ? "light" : "dark";
    };
    this.onColorScheme();
    this.colorScheme.addEventListener("change", this.onColorScheme);
  }
  buildIntro() {
    const apps = Object.values(this.clip.screens).map((screen) => screen.app);
    const chain = apps.flatMap((app, i) => [
      i ? h("span", { class: "cf-intro-arrow", text: "\u2192" }) : null,
      h("span", { class: "cf-intro-app" }, [
        h("span", { class: "cf-appicon", style: { "--app": app.color ?? this.design.accent }, text: app.icon ?? initials(app.name) }),
        h("span", { text: app.name })
      ])
    ]);
    return h("div", { class: "cf-intro", "aria-hidden": "true" }, h("div", { class: "cf-intro-inner" }, [
      h("div", { class: "cf-intro-chain" }, chain),
      h("div", { class: "cf-intro-title", text: this.clip.title }),
      h("div", { class: "cf-intro-overview", text: this.clip.story.overview })
    ]));
  }
  buildEndcard() {
    const steps = this.clip.story.workflow ?? [];
    const replay = h("button", { class: "cf-cbtn", type: "button", text: "Replay \u21BA" });
    replay.addEventListener("click", () => this.replay());
    return h("div", { class: "cf-endcard" }, h("div", { class: "cf-endcard-inner" }, [
      h("div", { class: "cf-endcard-label", text: "How it works" }),
      h("ol", {}, steps.map((text, i) => h("li", { style: { "--i": i } }, [h("span", { class: "cf-check", text: "\u2713" }), h("span", { text })]))),
      replay
    ]));
  }
  buildControls() {
    this.chapterButtons = this.chapters.map((chapter, i) => {
      const button = h("button", { class: "cf-ch", type: "button", "aria-label": `Chapter ${i + 1}: ${chapter.title}` }, [
        h("span", { class: "cf-ch-num", text: String(i + 1).padStart(2, "0") }),
        h("span", { class: "cf-ch-label", text: chapter.title })
      ]);
      button.addEventListener("click", () => this.goTo(i));
      return button;
    });
    this.nowLabel = h("div", { class: "cf-now", "aria-live": "polite" });
    this.playButton = h("button", { class: "cf-cbtn", type: "button", text: "Play \u25B6" });
    this.playButton.addEventListener("click", () => this.toggle());
    const replay = h("button", { class: "cf-cbtn", type: "button", text: "Replay \u21BA" });
    replay.addEventListener("click", () => this.replay());
    const fullscreen = h("button", { class: "cf-cbtn", type: "button", "aria-label": "Full screen", text: "\u26F6" });
    fullscreen.addEventListener("click", () => this.toggleFullscreen());
    const chapters = h("div", { class: "cf-chapters", style: { "--n": this.chapters.length } }, this.chapterButtons);
    return h("div", { class: "cf-controls" }, [chapters, this.nowLabel, h("div", { class: "cf-buttons" }, [this.playButton, replay, fullscreen])]);
  }
  /** Screen-reader transcript: the story and the script, read in order. */
  buildTranscript() {
    const { story } = this.clip;
    return h("div", { class: "cf-sr" }, [
      h("p", { text: `${this.clip.title}. ${story.overview}` }),
      story.description ? h("p", { text: story.description }) : null,
      h("ol", {}, this.chapters.map((chapter) => h("li", { text: `${chapter.title}: ${chapter.narration ?? ""}` })))
    ]);
  }
  /** (Re)build the world: screens laid out, plus cursor and packet layer. */
  buildScene() {
    this.world.replaceChildren();
    const entries = Object.entries(this.clip.screens).map(([key, def]) => ({ key, def, surface: getSurface(def.surface) }));
    const mode = this.clip.layout ?? this.template.layout;
    const layout = typeof mode === "function" ? mode(entries, WORLD) : layoutFor(mode, entries, WORLD);
    this.links = new Links(this.world);
    this.views = /* @__PURE__ */ Object.create(null);
    this.zTop = 0;
    for (const { key, def, surface } of entries) {
      const view = surface.render(def, { screens: this.clip.screens, accent: this.design.accent });
      const rect = layout[key];
      view.el.classList.add("cf-screen");
      view.el.classList.toggle("cf-off", def.hidden === true);
      view.el.dataset.screen = key;
      if (def.mode === "light" || def.mode === "dark") view.el.dataset.mode = def.mode;
      view.el.style.setProperty("--app", def.app.color ?? this.design.accent);
      view.el.style.setProperty("z-index", String(++this.zTop));
      for (const [property, value] of Object.entries({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })) {
        view.el.style.setProperty(property, `${value}px`);
      }
      this.world.append(view.el);
      this.views[key] = { key, def, surface, view, rect, visible: def.hidden !== true };
    }
    for (const { surface, view } of Object.values(this.views)) surface.mounted?.(view);
    this.actors = new Actors(this.world, this.clip.actors);
    this.cursor = new Cursor(this.world, { hidden: !this.design.cursor });
    this.setBackdrop(this.design.backdrop);
    this.camera = new Camera(this.stage, this.world, (target) => this.targetRect(target), {
      maxZoom: this.design.camera.zoom,
      speed: this.design.camera.speed,
      ease: this.design.camera.ease
    });
  }
  /** World rect for "all" (screens on stage), a screen id, or "screen.part:name". */
  targetRect(target) {
    const entries = Object.values(this.views);
    if (target === "all") {
      const onStage = [...entries.filter((entry2) => entry2.visible).map((entry2) => entry2.rect), ...this.actorRects()];
      const set = onStage.length ? onStage : entries.map((entry2) => entry2.rect);
      const x = Math.min(...set.map((r) => r.x));
      const y = Math.min(...set.map((r) => r.y));
      const right = Math.max(...set.map((r) => r.x + r.w));
      const bottom = Math.max(...set.map((r) => r.y + r.h));
      return { x, y, w: right - x, h: bottom - y, kind: "all" };
    }
    const parsed = parseSelector(target);
    if (parsed && !hasOwn(this.views, parsed.screen) && hasOwn(this.actors?.items, parsed.screen)) {
      const rect = this.actors.rect(this.actors.items[parsed.screen], parsed.part === "piece" ? Number(parsed.name) : void 0);
      return rect ? { ...rect, kind: "part" } : null;
    }
    if (!parsed || !hasOwn(this.views, parsed.screen)) return null;
    const entry = this.views[parsed.screen];
    if (!parsed.part) return { ...entry.rect, kind: "screen" };
    const el = entry.view.find(parsed.part, parsed.name);
    return el ? { ...rectIn(this.world, el), kind: "part" } : { ...entry.rect, kind: "screen" };
  }
  onResize() {
    if (!this.stage.clientWidth) return;
    if (this.pendingStart) {
      const start = this.pendingStart;
      this.pendingStart = null;
      start();
      return;
    }
    this.camera.apply();
    for (const { surface, view } of Object.values(this.views)) surface.relayout?.(view);
    this.links.redraw((target) => this.targetRect(target));
  }
  /** Run `fn` now, or once the stage has a size (e.g. inside a hidden tab). */
  whenSized(fn) {
    if (this.stage.clientWidth) fn();
    else this.pendingStart = fn;
  }
  // ---------- playback ----------
  start() {
    const last = this.chapters.length - 1;
    if (Number.isInteger(this.options.chapter)) {
      this.whenSized(() => this.show(clamp(this.options.chapter, 0, last)));
      return;
    }
    if (this.reduced) {
      this.playButton?.setAttribute("hidden", "");
      this.whenSized(() => this.show(last));
      return;
    }
    if (this.options.autoplay === "none") {
      this.whenSized(() => this.showPoster());
      return;
    }
    this.viewObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && this.state === "idle") this.run(0);
      else if (!entry.isIntersecting && this.state === "playing") {
        this.autoPaused = true;
        this.setState("paused");
      } else if (entry.isIntersecting && this.state === "paused" && this.autoPaused && !this.userPaused) {
        this.autoPaused = false;
        this.setState("playing");
      }
    }, { threshold: 0.35 });
    this.viewObserver.observe(this.stage);
  }
  showPoster() {
    this.camera.focus("all", { instant: true });
    this.root.classList.add("cf-has-poster");
    const play = h("button", { class: "cf-bigplay", type: "button", "aria-label": `Play ${this.clip.title}`, text: "\u25B6" });
    play.addEventListener("click", () => this.run(0));
    this.bigPlay = play;
    this.stage.append(play);
  }
  /** Show the end state of a chapter without animation. */
  show(index) {
    this.run(index + 1, index);
  }
  async run(animateFrom = 0, upTo = this.chapters.length - 1) {
    const id = this.timeline.begin();
    const isStatic = animateFrom > upTo;
    this.readyChapter = null;
    this.bigPlay?.remove();
    this.root.classList.remove("cf-has-poster", "cf-ended");
    this.setState(isStatic ? "static" : "playing");
    this.buildScene();
    this.intro.classList.remove("cf-show");
    this.endcard.classList.remove("cf-show");
    this.setSubtitle("");
    await this.camera.focus("all", { instant: true });
    try {
      if (animateFrom === 0 && this.design.intro && !isStatic) await this.playIntro(id);
      for (let i = 0; i <= upTo; i++) {
        await this.playChapter(i, this.context(id, i < animateFrom));
      }
      if (upTo === this.chapters.length - 1) await this.finish(id, isStatic);
      if (isStatic && this.timeline.isCurrent(id)) {
        this.readyChapter = upTo;
        this.emit("ready", { chapter: upTo });
      }
    } catch (error) {
      if (error !== STOP) throw error;
    }
  }
  context(id, fast) {
    return {
      ...this.timeline.context(id, { fast, pace: this.design.pace }),
      cursor: this.cursor,
      links: this.links,
      player: this
    };
  }
  async playIntro(id) {
    const ctx = this.context(id, false);
    this.intro.classList.add("cf-show");
    await ctx.wait(INTRO_MS);
    this.intro.classList.remove("cf-show");
    await ctx.wait(500);
  }
  async playChapter(index, ctx) {
    const chapter = this.chapters[index];
    this.setChapter(index);
    this.setProgress(index / this.chapters.length);
    this.setSubtitle(chapter.narration ?? "");
    if (chapter.backdrop !== void 0) this.setBackdrop(resolveBackdrop(chapter.backdrop), ctx);
    if (chapter.focus) await this.alongside(this.camera.focus(chapter.focus, { zoom: chapter.zoom, ctx, duration: chapter.duration, ease: chapter.ease }), chapter.async);
    await ctx.wait(CHAPTER_SETTLE_MS);
    for (const [j, step] of chapter.steps.entries()) {
      await this.runStep(step, ctx);
      this.setProgress((index + (j + 1) / chapter.steps.length) / this.chapters.length);
    }
    await ctx.wait(CHAPTER_END_MS);
  }
  async runStep(step, ctx) {
    const action = actionOf(step, this.actionNames);
    if (!GENERIC_ACTIONS.includes(action)) {
      await this.runSurfaceStep(step, action, ctx);
      return;
    }
    const value = step[action];
    if (action === "focus") await this.alongside(this.camera.focus(value, { zoom: step.zoom, ctx, duration: step.duration, ease: step.ease }), step.async);
    else if (action === "pan") await this.alongside(this.camera.pan(value, { ctx, duration: step.duration, ease: step.ease }), step.async);
    else if (action === "dive") await this.dive(value, step, ctx);
    else if (action === "blur") this.setBlur(value, step.amount);
    else if (action === "caption") {
      this.setSubtitle(value);
      await ctx.wait(CAPTION_MS);
    } else if (action === "wait") await ctx.wait(value);
    else if (action === "packet") await this.links.packet(value.from, value.to, (target) => this.targetRect(target), ctx);
    else if (action === "enter") await this.enterScreen(value, step.from ?? "right", ctx, step);
    else if (action === "exit") await this.exitScreen(value, step.to ?? "left", ctx, step);
    else if (action === "front") {
      this.frontScreen(value, step.dim !== false);
      await ctx.wait(FRONT_MS);
    } else if (action === "spawn") await this.spawnActors(value, step, ctx);
    else if (action === "move") await this.alongside(this.moveActor(value, step, ctx), step.async);
    else if (action === "leave") await this.leaveActors(value, step, ctx);
    else if (action === "confetti") await this.actors.confetti(this.pointFor(value), ctx, { count: step.count, colors: step.colors, power: step.power });
    else if (action === "backdrop") this.setBackdrop(resolveBackdrop(value), ctx);
  }
  /** Zoom through a target until it fills the frame; behind it, "into" changes the backdrop for the next scene. */
  async dive(target, step, ctx) {
    const parsed = parseSelector(target);
    const actor = parsed && !hasOwn(this.views, parsed.screen) && hasOwn(this.actors.items, parsed.screen) ? this.actors.items[parsed.screen] : null;
    const round = actor ? ["sphere", "ring"].includes(actor.shape) : false;
    await this.camera.dive(target, { ctx, round, duration: step.duration ?? 1100, ease: step.ease ?? "gentle" });
    if (step.into !== void 0) this.setBackdrop(resolveBackdrop(step.into));
  }
  /**
   * Rack focus: blur everything but one screen or actor (false clears it).
   * @param {string|false} target
   * @param {number} [amount] blur radius in px
   */
  setBlur(target, amount) {
    const keep = typeof target === "string" ? parseSelector(target)?.screen : null;
    const blur = (el, id) => el.classList.toggle("cf-blurred", keep !== null && id !== keep);
    for (const entry of Object.values(this.views)) blur(entry.view.el, entry.key);
    for (const actor of Object.values(this.actors.items)) {
      for (const piece of actor.pieces) {
        blur(piece.el, actor.id);
        blur(piece.shadow, actor.id);
      }
    }
    this.world.style.setProperty("--cf-blur", `${clamp(typeof amount === "number" ? amount : 7, 1, 24)}px`);
  }
  /** Visible actors' rects, for framing "all". */
  actorRects() {
    return Object.values(this.actors?.items ?? {}).filter((actor) => actor.visible).map((actor) => this.actors.rect(actor));
  }
  /** Where an actor goes for "at"/"to": a world point { x, y }, or a target (its centre, or its top edge with "perch"). */
  spotFor(actor, at, { perch, offset } = {}) {
    if (typeof at === "string") {
      const rect = this.targetRect(at);
      return rect ? this.actors.spotFor(actor, rect, { perch, offset }) : void 0;
    }
    return isObject(at) ? { x: at.x + (offset?.x ?? 0), y: at.y + (offset?.y ?? 0) } : void 0;
  }
  /** A world point for a target or { x, y } (the stage centre if neither). */
  pointFor(value) {
    const rect = typeof value === "string" ? this.targetRect(value) : null;
    if (rect) return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    return isObject(value) ? { x: value.x, y: value.y } : { x: WORLD.width / 2, y: WORLD.height / 2 };
  }
  /** Spawn one actor or several; each one's pieces pop in one after another. */
  async spawnActors(value, step, ctx) {
    const stagger = typeof step.stagger === "number" ? clamp(step.stagger, 0, 2e3) : 90;
    const runs = [];
    let delay = 0;
    for (const id of [value].flat()) {
      if (!hasOwn(this.actors.items, id)) continue;
      const actor = this.actors.items[id];
      const at = step.at === void 0 ? void 0 : this.spotFor(actor, step.at, step);
      const start = delay;
      runs.push((async () => {
        if (start && !ctx.fast) await ctx.wait(start);
        await this.actors.spawn(actor, ctx, { at, effect: step.effect, stagger, bounces: step.bounces, bounciness: step.bounciness });
      })());
      delay += stagger * actor.pieces.length;
    }
    await Promise.all(runs);
  }
  async moveActor(id, step, ctx) {
    if (!hasOwn(this.actors.items, id)) return;
    const actor = this.actors.items[id];
    const to = this.spotFor(actor, step.to, step);
    if (to) await this.actors.move(actor, ctx, { to, path: step.path, duration: step.duration, ease: step.ease, height: step.height, bounces: step.bounces, bounciness: step.bounciness });
  }
  async leaveActors(value, step, ctx) {
    const ids = [value].flat().filter((id) => hasOwn(this.actors.items, id));
    await Promise.all(ids.map(async (id, i) => {
      if (i && !ctx.fast) await ctx.wait(i * 70);
      await this.actors.leave(this.actors.items[id], ctx, { effect: step.effect });
    }));
  }
  /** Fade the stage backdrop to a colour pair; null clears it. Instant without a playing context. */
  setBackdrop(colors, ctx) {
    const instant = !ctx || ctx.fast;
    const old = [...this.backdrop.children];
    if (!colors) {
      for (const layer2 of old) layer2.remove();
      return;
    }
    const layer = h("div", { class: instant ? "cf-backdrop-layer cf-instant" : "cf-backdrop-layer", style: { "--bd-1": colors[0], "--bd-2": colors[1] } });
    this.backdrop.append(layer);
    const show = () => {
      layer.classList.add("cf-in");
      const clear = () => old.forEach((node) => node.remove());
      if (instant) clear();
      else setTimeout(clear, 750);
    };
    if (instant) show();
    else requestAnimationFrame(show);
  }
  async runSurfaceStep(step, action, ctx) {
    const target = resolveStepScreen(step, action, this.views);
    if (target.error) return;
    const entry = this.views[target.key];
    const spec = entry.surface.actions[action];
    const selector = typeof step[action] === "string" ? parseSelector(step[action]) : null;
    const name = selector?.part ? selector.name : null;
    if (this.design.camera.follow) this.followStep(entry, spec, step, name, ctx);
    await spec.run(entry.view, step, { ...ctx, name, screens: this.views, punch: this.punchFor(step), camera: this.cameraFor(ctx) });
  }
  /**
   * Camera moves a surface action may make: `look` at a detail and come
   * `back`, or `track` something (a caret) while the camera follows the action.
   */
  cameraFor(ctx) {
    return {
      look: (el, options) => this.camera.look(rectIn(this.world, el), { ctx, ...options }),
      back: (options) => this.camera.back({ ctx, ...options }),
      track: (el, within) => {
        if (!this.design.camera.follow) return;
        this.alongside(this.camera.track(rectIn(this.world, el), ctx, within ? rectIn(this.world, within) : void 0), true);
      }
    };
  }
  /** Punch-in settings for one step: the design default, overridden by the step's "punch". */
  punchFor(step) {
    if (step.punch === false || this.reduced) return null;
    const base = this.design.camera.punch ?? (step.punch !== void 0 ? { ...DEFAULT_PUNCH } : null);
    if (!base) return null;
    if (typeof step.punch === "number") return { ...base, amount: clamp(step.punch, ...LIMITS.punchAmount) };
    return base;
  }
  /** Follow mode: ease the camera toward what this step acts on, alongside the step. */
  followStep(entry, spec, step, name, ctx) {
    const el = (name && spec.part ? entry.view.find(spec.part, name) : null) ?? spec.follow?.(entry.view, step) ?? null;
    if (!el) return;
    this.alongside(this.camera.follow({ ...rectIn(this.world, el), kind: FOLLOW_TRAIL }, ctx), true);
  }
  /** Await a move, or let it run alongside the next steps. */
  alongside(move, async) {
    if (!async) return move;
    move.catch((error) => {
      if (error !== STOP) console.error(error);
    });
    return void 0;
  }
  // ---------- screens on and off stage ----------
  /** Run a screen effect from one amount to another, then clear the inline styles. */
  async playEffect(entry, effectName, ctx, { from, to, duration, ease, defaultMs }) {
    const { el } = entry.view;
    const effect = EFFECTS[effectName] ?? EFFECTS.right;
    if (effect.dock) {
      el.style.setProperty("transform-origin", `${WORLD.width / 2 - entry.rect.x}px ${WORLD.height - entry.rect.y}px`);
    }
    const curve = easeOf(ease ?? (to > from ? effect.ease : "smooth"));
    const ms = resolveDuration(duration) ?? effect.ms ?? defaultMs;
    effect.apply(el, from);
    await ctx.animate(ms, (progress) => effect.apply(el, from + (to - from) * curve(progress)));
    for (const property of ["transform", "opacity", "transform-origin"]) el.style.removeProperty(property);
  }
  async enterScreen(key, from, ctx, step = {}) {
    const entry = this.views[key];
    if (!entry || entry.visible) return;
    entry.visible = true;
    this.raise(entry);
    (EFFECTS[from] ?? EFFECTS.right).apply(entry.view.el, 0);
    entry.view.el.classList.remove("cf-off");
    await this.playEffect(entry, from, ctx, { from: 0, to: 1, duration: step.duration, ease: step.ease, defaultMs: ENTER_MS });
    entry.surface.relayout?.(entry.view);
  }
  async exitScreen(key, to, ctx, step = {}) {
    const entry = this.views[key];
    if (!entry || !entry.visible) return;
    await this.playEffect(entry, to, ctx, { from: 1, to: 0, duration: step.duration, ease: step.ease, defaultMs: EXIT_MS });
    entry.visible = false;
    entry.view.el.classList.add("cf-off");
    entry.view.el.classList.remove("cf-dimmed");
  }
  frontScreen(key, dimOthers) {
    const entry = this.views[key];
    if (!entry) return;
    this.raise(entry);
    for (const other of Object.values(this.views)) other.view.el.classList.toggle("cf-dimmed", dimOthers && other !== entry && other.visible);
  }
  raise(entry) {
    entry.view.el.style.setProperty("z-index", String(++this.zTop));
    this.cursor.el.style.setProperty("z-index", String(this.zTop + 1));
  }
  async finish(id, isStatic) {
    const ctx = this.context(id, isStatic);
    this.links.lightAll();
    for (const { surface, view } of Object.values(this.views)) surface.recap?.(view);
    this.cursor.hide();
    this.setProgress(1);
    if (this.design.endcard && this.options.endcard !== false && this.clip.story.workflow?.length) {
      await ctx.wait(ENDCARD_DELAY_MS);
      this.endcard.classList.toggle("cf-instant", isStatic);
      this.endcard.classList.add("cf-show");
    }
    this.root.classList.add("cf-ended");
    this.chapterButtons?.forEach((button) => {
      button.classList.add("cf-done");
      button.classList.remove("cf-active");
    });
    if (this.nowLabel) this.nowLabel.textContent = "Done \xB7 pick any chapter to replay it";
    this.setState(isStatic ? "static" : "ended");
    if (!isStatic) this.emit("ended", {});
  }
  // ---------- controls ----------
  goTo(index) {
    this.userPaused = false;
    if (this.reduced) this.show(index);
    else this.run(index);
  }
  replay() {
    this.userPaused = false;
    if (this.reduced) this.show(this.chapters.length - 1);
    else this.run(0);
  }
  toggle() {
    if (this.state === "playing") this.pause();
    else this.play();
  }
  play() {
    if (this.state === "paused") {
      this.userPaused = false;
      this.autoPaused = false;
      this.setState("playing");
    } else if (this.state !== "playing") {
      this.replay();
    }
  }
  pause() {
    if (this.state !== "playing") return;
    this.userPaused = true;
    this.setState("paused");
  }
  setState(state) {
    this.state = state;
    this.timeline.paused = state === "paused";
    this.root.dataset.state = state;
    this.root.classList.toggle("cf-paused", state === "paused");
    if (this.playButton) this.playButton.textContent = state === "playing" ? "Pause \u275A\u275A" : "Play \u25B6";
  }
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else this.host.requestFullscreen?.();
  }
  setChapter(index) {
    this.chapterButtons?.forEach((button, i) => {
      button.classList.toggle("cf-done", i < index);
      button.classList.toggle("cf-active", i === index);
      button.setAttribute("aria-current", i === index ? "step" : "false");
    });
    if (this.nowLabel) this.nowLabel.textContent = `${String(index + 1).padStart(2, "0")} \xB7 ${this.chapters[index].title}`;
    this.emit("chapter", { index, title: this.chapters[index].title });
  }
  setSubtitle(text) {
    this.subtitle.textContent = text;
    this.subtitle.parentElement.classList.toggle("cf-show", Boolean(text) && this.design.subtitles);
  }
  setProgress(fraction) {
    this.progressBar.style.setProperty("--p", String(fraction));
  }
  emit(name, detail) {
    this.host.dispatchEvent(new CustomEvent(`cueflick:${name}`, { detail, bubbles: true, composed: true }));
  }
  destroy() {
    this.timeline.cancel();
    this.viewObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.colorScheme?.removeEventListener("change", this.onColorScheme);
    this.pendingStart = null;
  }
};

// src/core/validate.js
var FORMAT_VERSION = "1";
var MAX_CHAPTERS = 12;
var TOP_KEYS = ["$schema", "cueflick", "title", "template", "layout", "disclaimer", "story", "design", "screens", "actors", "chapters"];
var STORY_KEYS = ["overview", "description", "audience", "workflow"];
var DESIGN_KEYS = ["mode", "accent", "font", "radius", "camera", "pace", "aspect", "intro", "subtitles", "endcard", "cursor", "backdrop"];
var CHAPTER_KEYS = ["title", "narration", "focus", "zoom", "duration", "ease", "async", "backdrop", "steps"];
var CAMERA_KEYS = ["zoom", "speed", "ease", "punch", "follow"];
var APP_KEYS = ["name", "color", "icon"];
var SCREEN_COMMON_KEYS = ["surface", "app", "hidden", "place", "width", "mode"];
var SCREEN_MODES = ["light", "dark"];
var FONT_PATTERN = /^[\w\s,'"-]+$/;
var Report = class {
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
};
var requireString = (report, value, path) => {
  if (typeof value !== "string" || !value.trim()) {
    report.error(path, "must be a non-empty string.");
    return false;
  }
  return true;
};
var optionalString = (report, value, path) => {
  if (value !== void 0 && typeof value !== "string") report.error(path, "must be a string.");
};
function checkRange(report, value, path, [min, max]) {
  if (value === void 0) return;
  if (typeof value !== "number" || !Number.isFinite(value)) report.error(path, "must be a number.");
  else if (value < min || value > max) report.warn(path, `is outside ${min}\u2013${max}; it will be clamped.`);
}
function checkMotion(report, owner, path) {
  if (owner.duration !== void 0) checkRange(report, owner.duration, `${path}.duration`, LIMITS.duration);
  if (owner.ease !== void 0 && !EASE_NAMES.includes(owner.ease)) {
    report.error(`${path}.ease`, `must be one of ${EASE_NAMES.join(", ")}.`, suggest(owner.ease, EASE_NAMES));
  }
  if (owner.async !== void 0 && typeof owner.async !== "boolean") report.error(`${path}.async`, "must be true or false.");
}
function checkPunch(report, value, path) {
  if (value === void 0 || typeof value === "boolean") return;
  if (typeof value === "number") {
    checkRange(report, value, path, LIMITS.punchAmount);
    return;
  }
  if (!isObject(value)) {
    report.error(path, 'must be true, false, a zoom amount like 1.3, or { "amount": 1.3, "hold": 800 }.');
    return;
  }
  checkUnknownKeys(report, value, ["amount", "hold"], path);
  checkRange(report, value.amount, `${path}.amount`, LIMITS.punchAmount);
  checkRange(report, value.hold, `${path}.hold`, LIMITS.punchHold);
}
function checkUnknownKeys(report, object, allowed, path) {
  for (const key of Object.keys(object)) {
    if (allowed.includes(key)) continue;
    report.warn(path ? `${path}.${key}` : key, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, allowed));
  }
}
function checkStory(report, story) {
  if (!isObject(story)) {
    report.error("story", 'is required: an object with at least "overview".', 'Add "story": { "overview": "One sentence on what this film shows." }');
    return;
  }
  checkUnknownKeys(report, story, STORY_KEYS, "story");
  if (requireString(report, story.overview, "story.overview") && story.overview.length > 220) {
    report.warn("story.overview", "is long; keep the overview to one or two sentences (under 220 characters).");
  }
  optionalString(report, story.description, "story.description");
  optionalString(report, story.audience, "story.audience");
  if (story.workflow !== void 0 && (!Array.isArray(story.workflow) || story.workflow.some((item) => typeof item !== "string"))) {
    report.error("story.workflow", "must be an array of strings, one per workflow step.");
  }
}
function checkDesign(report, design) {
  if (design === void 0) return;
  if (!isObject(design)) {
    report.error("design", "must be an object.");
    return;
  }
  checkUnknownKeys(report, design, DESIGN_KEYS, "design");
  if (design.mode !== void 0 && !MODES.includes(design.mode)) {
    report.error("design.mode", `must be one of ${MODES.join(", ")}.`, suggest(design.mode, MODES));
  }
  if (design.aspect !== void 0 && !ASPECTS.includes(design.aspect)) {
    report.error("design.aspect", `must be one of ${ASPECTS.join(", ")}.`, suggest(design.aspect, ASPECTS));
  }
  if (design.accent !== void 0 && !isHexColor(design.accent)) report.error("design.accent", 'must be a hex colour like "#22d3ee".');
  if (design.font !== void 0) {
    if (!isObject(design.font)) report.error("design.font", 'must be an object like { "ui": "Inter", "mono": "JetBrains Mono" }.');
    else {
      checkUnknownKeys(report, design.font, ["ui", "mono"], "design.font");
      for (const key of ["ui", "mono"]) {
        const value = design.font[key];
        if (value !== void 0 && (typeof value !== "string" || !FONT_PATTERN.test(value))) {
          report.error(`design.font.${key}`, "must be a font-family list using letters, digits, spaces, commas, quotes, and hyphens.");
        }
      }
    }
  }
  checkRange(report, design.radius, "design.radius", LIMITS.radius);
  checkRange(report, design.pace, "design.pace", LIMITS.pace);
  if (design.camera !== void 0) {
    if (!isObject(design.camera)) report.error("design.camera", 'must be an object like { "zoom": 1.35, "speed": 1 }.');
    else {
      checkUnknownKeys(report, design.camera, CAMERA_KEYS, "design.camera");
      checkRange(report, design.camera.zoom, "design.camera.zoom", LIMITS.zoom);
      checkRange(report, design.camera.speed, "design.camera.speed", LIMITS.speed);
      if (design.camera.ease !== void 0 && !EASE_NAMES.includes(design.camera.ease)) {
        report.error("design.camera.ease", `must be one of ${EASE_NAMES.join(", ")}.`, suggest(design.camera.ease, EASE_NAMES));
      }
      checkPunch(report, design.camera.punch, "design.camera.punch");
      if (design.camera.follow !== void 0 && typeof design.camera.follow !== "boolean") report.error("design.camera.follow", "must be true or false.");
    }
  }
  for (const flag of ["intro", "subtitles", "endcard", "cursor"]) {
    if (design[flag] !== void 0 && typeof design[flag] !== "boolean") report.error(`design.${flag}`, "must be true or false.");
  }
  if (design.backdrop !== void 0) checkBackdrop(report, design.backdrop, "design.backdrop");
}
function checkBackdrop(report, value, path) {
  if (!resolveBackdrop(value)) report.error(path, 'must be a hex colour, or two for a gradient, e.g. ["#130046", "#2e0b85"].');
}
var isPoint = (value) => isObject(value) && ["x", "y"].every((key) => typeof value[key] === "number" && Number.isFinite(value[key]));
function checkActors(report, actors, screens) {
  const valid = /* @__PURE__ */ Object.create(null);
  if (actors === void 0) return valid;
  if (!isObject(actors)) {
    report.error("actors", 'must be an object of actors keyed by id, e.g. { "sunny": { "shape": "sphere", "color": "#ffc83d" } }.');
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
    if (def.shape !== void 0 && !SHAPES.includes(def.shape)) report.error(`${path}.shape`, `must be one of ${SHAPES.join(", ")}.`, suggest(def.shape, SHAPES));
    if (def.color !== void 0 && !isHexColor(def.color)) report.error(`${path}.color`, "must be a hex colour.");
    if (def.colors !== void 0 && !(Array.isArray(def.colors) && def.colors.length > 0 && def.colors.every(isHexColor))) {
      report.error(`${path}.colors`, "must be an array of hex colours, one per piece (they repeat).");
    }
    checkRange(report, def.size, `${path}.size`, [16, 600]);
    checkRange(report, def.squash, `${path}.squash`, [0, 2]);
    if (def.finish !== void 0 && !FINISHES.includes(def.finish)) report.error(`${path}.finish`, `must be one of ${FINISHES.join(", ")}.`, suggest(def.finish, FINISHES));
    const count = def.count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > MAX_PIECES) report.error(`${path}.count`, `must be a whole number from 1 to ${MAX_PIECES}.`);
    if (def.columns !== void 0 && (!Number.isInteger(def.columns) || def.columns < 1)) report.error(`${path}.columns`, "must be a whole number of 1 or more.");
    if (def.gap !== void 0 && (typeof def.gap !== "number" || def.gap < 0)) report.error(`${path}.gap`, "must be a distance in world units (0 or more).");
    optionalString(report, def.label, `${path}.label`);
    if (def.labels !== void 0 && !(Array.isArray(def.labels) && def.labels.every((label) => typeof label === "string"))) {
      report.error(`${path}.labels`, "must be an array of short labels, one per piece.");
    } else if (Array.isArray(def.labels) && def.labels.length > count) {
      report.warn(`${path}.labels`, `has more labels than pieces (${count}); raise "count" or drop some labels.`);
    }
    if (def.at !== void 0 && !isPoint(def.at)) report.error(`${path}.at`, 'must be a world point { "x": 800, "y": 450 } (the world is 1600\xD7900).');
    valid[id] = { count: Number.isInteger(count) ? count : 1 };
  }
  return valid;
}
function checkActorTarget(report, parsed, path, actors) {
  if (!parsed.part) return { ...parsed, actor: true };
  const { count } = actors[parsed.screen];
  if (parsed.part !== "piece") {
    report.error(path, `actors only have "piece" parts, e.g. "${parsed.screen}.piece:0".`, suggest(parsed.part, ["piece"]));
    return null;
  }
  const index = Number(parsed.name);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    report.error(path, `"${parsed.screen}" has pieces 0 to ${count - 1}.`);
    return null;
  }
  return { ...parsed, actor: true };
}
function checkActorIds(report, value, path, stage2, { single = false } = {}) {
  const ids = single ? [value] : [value].flat();
  if (!ids.length || ids.some((id) => typeof id !== "string")) {
    report.error(path, single ? "must be an actor id." : "must be an actor id or an array of actor ids.");
    return [];
  }
  const known = Object.keys(stage2.actorDefs);
  return ids.filter((id) => {
    if (hasOwn(stage2.actorDefs, id)) return true;
    report.error(path, `"${id}" isn't an actor.`, suggest(id, known) ?? (known.length ? `Actors: ${known.join(", ")}.` : 'Define it under "actors" at the top of the clip.'));
    return false;
  });
}
function checkBounce(report, step, path) {
  if (step.bounces !== void 0 && (!Number.isInteger(step.bounces) || step.bounces < 0 || step.bounces > MAX_BOUNCES)) {
    report.error(`${path}.bounces`, `must be a whole number from 0 to ${MAX_BOUNCES}.`);
  }
  checkRange(report, step.bounciness, `${path}.bounciness`, [0.1, 0.8]);
}
function checkSpot(report, step, key, path, screens, stage2) {
  const value = step[key];
  if (typeof value === "string") checkSelector(report, value, `${path}.${key}`, screens, { actors: stage2.actorDefs });
  else if (!isPoint(value)) report.error(`${path}.${key}`, 'must be a target like "phone.area:pool" or a world point { "x": 800, "y": 450 }.');
  if (step.perch !== void 0 && typeof step.perch !== "boolean") report.error(`${path}.perch`, "must be true or false.");
  if (step.offset !== void 0 && !isPoint(step.offset)) report.error(`${path}.offset`, 'must be { "x": 0, "y": -20 } in world units.');
}
function checkApp(report, app, path) {
  if (!isObject(app)) {
    report.error(path, 'is required: { "name": "...", "color": "#hex", "icon": "AB" }.');
    return;
  }
  checkUnknownKeys(report, app, APP_KEYS, path);
  requireString(report, app.name, `${path}.name`);
  if (app.color !== void 0 && !isHexColor(app.color)) report.error(`${path}.color`, 'must be a hex colour like "#4f7cff".');
  if (app.icon !== void 0 && (typeof app.icon !== "string" || app.icon.length > 4)) {
    report.error(`${path}.icon`, 'must be 1\u20134 characters (a monogram such as "SA").');
  }
}
function checkPlacement(report, screen, path) {
  if (screen.hidden !== void 0 && typeof screen.hidden !== "boolean") report.error(`${path}.hidden`, "must be true or false.");
  if (screen.mode !== void 0 && !SCREEN_MODES.includes(screen.mode)) {
    report.error(`${path}.mode`, 'must be "light" or "dark" (overrides design.mode for this screen).', suggest(screen.mode, SCREEN_MODES));
  }
  if (screen.width !== void 0 && (typeof screen.width !== "number" || screen.width < 200 || screen.width > 1500)) {
    report.error(`${path}.width`, "must be a width in world units between 200 and 1500.");
  }
  const { place } = screen;
  if (place === void 0) return;
  if (typeof place === "string") {
    if (!hasOwn(SLOTS, place)) report.error(`${path}.place`, `"${place}" isn't a slot. Slots: ${Object.keys(SLOTS).join(", ")}.`, suggest(place, Object.keys(SLOTS)));
    return;
  }
  if (!isObject(place) || ["x", "y", "w", "h"].some((key) => typeof place[key] !== "number" || !Number.isFinite(place[key]))) {
    report.error(`${path}.place`, 'must be a slot name or { "x", "y", "w", "h" } in world units (1600\xD7900).');
  } else if (place.w < 120 || place.h < 120 || place.x + place.w < 0 || place.y + place.h < 0 || place.x > 1600 || place.y > 900) {
    report.warn(`${path}.place`, "is mostly outside the 1600\xD7900 world or very small.");
  }
}
function checkScreens(report, screens) {
  if (!isObject(screens) || Object.keys(screens).length === 0) {
    report.error("screens", 'is required: an object of screens keyed by a short id, e.g. { "crm": {...}, "flow": {...} }.');
    return {};
  }
  const resolved = {};
  for (const [key, screen] of Object.entries(screens)) {
    const path = `screens.${key}`;
    if (!/^[A-Za-z_][\w-]*$/.test(key)) report.error(path, 'screen ids may use letters, digits, "_" and "-" only.');
    if (!isObject(screen)) {
      report.error(path, "must be an object.");
      continue;
    }
    const surface = getSurface(screen.surface);
    if (!surface) {
      report.error(`${path}.surface`, `"${screen.surface}" is not a known surface. Known: ${surfaceNames().join(", ")}.`, suggest(screen.surface, surfaceNames()));
      continue;
    }
    checkApp(report, screen.app, `${path}.app`);
    checkPlacement(report, screen, path);
    checkUnknownKeys(report, screen, [...SCREEN_COMMON_KEYS, ...surface.keys ?? []], path);
    surface.validate?.(screen, path, report, screens);
    resolved[key] = { def: screen, surface };
  }
  return resolved;
}
function checkSelector(report, selector, path, screens, { allowAll = false, part: requiredPart, actors } = {}) {
  if (allowAll && selector === "all") return { all: true };
  const parsed = parseSelector(selector);
  if (!parsed) {
    report.error(path, `"${selector}" is not a valid target. Use "screen" or "screen.part:name", e.g. "crm.field:Stage".`);
    return null;
  }
  if (actors && !requiredPart && !hasOwn(screens, parsed.screen) && hasOwn(actors, parsed.screen)) return checkActorTarget(report, parsed, path, actors);
  const keys = Object.keys(screens);
  if (!hasOwn(screens, parsed.screen)) {
    const known = actors ? [...keys, ...Object.keys(actors)] : keys;
    const what = actors && Object.keys(actors).length ? "a screen or an actor" : 'defined in "screens"';
    report.error(path, `"${parsed.screen}" is not ${what}.`, suggest(parsed.screen, known) ?? `Defined: ${known.join(", ")}.`);
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
      report.error(path, `${screen.def.surface} screens have no "${parsed.part}" parts. Parts: ${parts.join(", ") || "none"}.`, suggest(parsed.part, parts));
      return null;
    }
    const names = screen.surface.parts[parsed.part](screen.def);
    if (!names.includes(parsed.name)) {
      report.error(path, `${parsed.part} "${parsed.name}" isn't on screen "${parsed.screen}". Available: ${names.join(", ")}.`, suggest(parsed.name, names));
      return null;
    }
  }
  return parsed;
}
function checkScreenId(report, value, path, screens) {
  if (typeof value !== "string" || !hasOwn(screens, value)) {
    report.error(path, `must be a screen id. Defined screens: ${Object.keys(screens).join(", ")}.`, typeof value === "string" ? suggest(value, Object.keys(screens)) : void 0);
    return false;
  }
  return true;
}
var StageState = class {
  constructor(screens, actorDefs = /* @__PURE__ */ Object.create(null)) {
    this.actorDefs = actorDefs;
    this.actors = /* @__PURE__ */ new Set();
    this.visible = new Set(Object.keys(screens).filter((key) => screens[key].def.hidden !== true));
    this.facts = /* @__PURE__ */ new Map();
    for (const [key, { def }] of Object.entries(screens)) {
      this.facts.set(key, { messages: Array.isArray(def.history) ? def.history.length : 0, opened: false });
    }
  }
};
function checkGenericStep(report, step, action, path, screens, stage2) {
  const value = step[action];
  if (action === "focus") {
    const parsed = checkSelector(report, value, `${path}.focus`, screens, { allowAll: true, actors: stage2.actorDefs });
    if (parsed?.screen && !parsed.actor && !stage2.visible.has(parsed.screen)) report.warn(`${path}.focus`, `the camera points at "${parsed.screen}" while it's off stage; add an "enter" step first.`);
    checkRange(report, step.zoom, `${path}.zoom`, LIMITS.zoom);
    checkMotion(report, step, path);
  } else if (action === "pan") {
    if (typeof value === "string") checkSelector(report, value, `${path}.pan`, screens, { actors: stage2.actorDefs });
    else if (!isObject(value) || ["x", "y"].some((key) => value[key] !== void 0 && (typeof value[key] !== "number" || !Number.isFinite(value[key])))) {
      report.error(`${path}.pan`, 'must be a target like "books.row:1042", or an offset { "x": 300, "y": 0 } in world units.');
    }
    checkMotion(report, step, path);
  } else if (action === "dive") {
    checkSelector(report, value, `${path}.dive`, screens, { actors: stage2.actorDefs });
    checkMotion(report, step, path);
    if (step.into !== void 0) checkBackdrop(report, step.into, `${path}.into`);
  } else if (action === "blur") {
    if (value !== false) {
      const parsed = checkSelector(report, value, `${path}.blur`, screens, { actors: stage2.actorDefs });
      if (parsed?.part) report.error(`${path}.blur`, 'keeps a whole screen or actor sharp; use "phone", not a part. Use false to clear the blur.');
    }
    checkRange(report, step.amount, `${path}.amount`, [1, 24]);
  } else if (action === "caption") {
    if (requireString(report, value, `${path}.caption`) && value.length > 90) report.warn(`${path}.caption`, "is long for a subtitle; keep it under 90 characters.");
  } else if (action === "wait") {
    if (typeof value !== "number" || value < 0 || value > 1e4) report.error(`${path}.wait`, "must be milliseconds between 0 and 10000.");
  } else if (action === "packet") {
    if (!isObject(value)) report.error(`${path}.packet`, 'must be { "from": "<target>", "to": "<target>" }.');
    else {
      for (const end of ["from", "to"]) {
        const parsed = checkSelector(report, value[end], `${path}.packet.${end}`, screens);
        if (parsed && !stage2.visible.has(parsed.screen)) report.warn(`${path}.packet.${end}`, `"${parsed.screen}" is off stage at this point.`);
      }
    }
  } else if (SCREEN_ACTIONS.includes(action)) {
    if (!checkScreenId(report, value, `${path}.${action}`, screens)) return;
    if (action !== "front") checkMotion(report, step, path);
    if (action === "enter") {
      if (step.from !== void 0 && !DIRECTIONS.includes(step.from)) report.error(`${path}.from`, `must be one of ${DIRECTIONS.join(", ")}.`, suggest(step.from, DIRECTIONS));
      if (stage2.visible.has(value)) report.warn(`${path}.enter`, `"${value}" is already on stage; give it "hidden": true or remove this step.`);
      stage2.visible.add(value);
    } else if (action === "exit") {
      if (step.to !== void 0 && !DIRECTIONS.includes(step.to)) report.error(`${path}.to`, `must be one of ${DIRECTIONS.join(", ")}.`, suggest(step.to, DIRECTIONS));
      if (!stage2.visible.has(value)) report.warn(`${path}.exit`, `"${value}" isn't on stage here.`);
      stage2.visible.delete(value);
    } else {
      if (step.dim !== void 0 && typeof step.dim !== "boolean") report.error(`${path}.dim`, "must be true or false.");
      if (!stage2.visible.has(value)) report.warn(`${path}.front`, `"${value}" is off stage; "enter" it first.`);
    }
  } else if (action === "spawn") {
    const ids = checkActorIds(report, value, `${path}.spawn`, stage2);
    if (step.effect !== void 0 && !SPAWN_EFFECTS.includes(step.effect)) report.error(`${path}.effect`, `must be one of ${SPAWN_EFFECTS.join(", ")}.`, suggest(step.effect, SPAWN_EFFECTS));
    if (step.stagger !== void 0 && (typeof step.stagger !== "number" || step.stagger < 0 || step.stagger > 2e3)) report.error(`${path}.stagger`, "must be milliseconds between 0 and 2000.");
    if (step.at !== void 0) checkSpot(report, step, "at", path, screens, stage2);
    checkBounce(report, step, path);
    for (const id of ids) {
      if (stage2.actors.has(id)) report.warn(`${path}.spawn`, `"${id}" is already on stage; "leave" it first or remove this step.`);
      stage2.actors.add(id);
    }
  } else if (action === "leave") {
    const ids = checkActorIds(report, value, `${path}.leave`, stage2);
    if (step.effect !== void 0 && !LEAVE_EFFECTS.includes(step.effect)) report.error(`${path}.effect`, `must be one of ${LEAVE_EFFECTS.join(", ")}.`, suggest(step.effect, LEAVE_EFFECTS));
    for (const id of ids) {
      if (!stage2.actors.has(id)) report.warn(`${path}.leave`, `"${id}" isn't on stage here; "spawn" it first.`);
      stage2.actors.delete(id);
    }
  } else if (action === "move") {
    const [id] = checkActorIds(report, value, `${path}.move`, stage2, { single: true });
    if (step.to === void 0) report.error(`${path}.to`, 'is required: a target like "phone.area:pool" or a world point { "x": 800, "y": 450 }.');
    else checkSpot(report, step, "to", path, screens, stage2);
    if (step.path !== void 0 && !PATHS.includes(step.path)) report.error(`${path}.path`, `must be one of ${PATHS.join(", ")}.`, suggest(step.path, PATHS));
    if (step.height !== void 0 && (typeof step.height !== "number" || step.height < 0)) report.error(`${path}.height`, "must be the hop height in world units.");
    checkBounce(report, step, path);
    checkMotion(report, step, path);
    if (id && !stage2.actors.has(id)) report.warn(`${path}.move`, `"${id}" isn't on stage yet; "spawn" it first.`);
  } else if (action === "confetti") {
    if (typeof value === "string") checkSelector(report, value, `${path}.confetti`, screens, { actors: stage2.actorDefs });
    else if (!isPoint(value)) report.error(`${path}.confetti`, 'must be a target like "phone" or a world point { "x": 800, "y": 450 }.');
    checkRange(report, step.count, `${path}.count`, [10, 240]);
    checkRange(report, step.power, `${path}.power`, [0.3, 3]);
    if (step.colors !== void 0 && !(Array.isArray(step.colors) && step.colors.length > 0 && step.colors.every(isHexColor))) report.error(`${path}.colors`, "must be an array of hex colours.");
  } else if (action === "backdrop") {
    checkBackdrop(report, value, `${path}.backdrop`);
  }
}
function checkSurfaceStep(report, step, action, path, screens, rawScreens, stage2) {
  const target = resolveStepScreen(step, action, screens);
  if (target.error) {
    report.error(target.path ? `${path}.${target.path}` : path, target.error, target.candidates ? suggest(step.on, target.candidates) : void 0);
    return;
  }
  const { def, surface } = screens[target.key];
  const spec = surface.actions[action];
  if (spec.part) checkSelector(report, step[action], `${path}.${action}`, screens, { part: spec.part });
  spec.validate?.(step, def, path, report, rawScreens);
  checkUnknownKeys(report, step, [action, ...SURFACE_STEP_KEYS, ...spec.keys ?? []], path);
  checkPunch(report, step.punch, `${path}.punch`);
  if (!stage2.visible.has(target.key)) report.warn(path, `"${action}" acts on "${target.key}" while it's off stage; add an "enter" step first.`);
  spec.order?.(stage2.facts.get(target.key), step, path, report);
}
function actionNames(screens) {
  const names = /* @__PURE__ */ new Set();
  for (const { surface } of Object.values(screens)) for (const name of Object.keys(surface.actions)) names.add(name);
  return names;
}
function checkStep(report, step, path, screens, rawScreens, names, stage2) {
  if (!isObject(step)) {
    report.error(path, 'each step must be an object with one action, e.g. { "click": "crm.button:Save" }.');
    return;
  }
  const known = [...GENERIC_ACTIONS, ...names];
  const actions = Object.keys(step).filter((key) => known.includes(key));
  if (actions.length === 0) {
    const first = Object.keys(step)[0];
    report.error(path, `step has no action. Use one of: ${known.join(", ")}.`, first ? suggest(first, known) : void 0);
    return;
  }
  if (actions.length > 1) {
    report.error(path, `step has more than one action (${actions.join(", ")}); split it into separate steps.`);
    return;
  }
  const action = actionOf(step, names);
  if (GENERIC_ACTIONS.includes(action)) {
    checkGenericStep(report, step, action, path, screens, stage2);
    checkUnknownKeys(report, step, [action, ...GENERIC_KEYS[action]], path);
  } else {
    checkSurfaceStep(report, step, action, path, screens, rawScreens, stage2);
  }
}
function checkChapters(report, chapters, screens, rawScreens, actorDefs) {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    report.error("chapters", "is required: an array of chapters, each with a title, narration, focus, and steps.");
    return;
  }
  if (chapters.length > MAX_CHAPTERS) report.warn("chapters", `has ${chapters.length} chapters; films read best with 3\u20136.`);
  const names = actionNames(screens);
  const stage2 = new StageState(screens, actorDefs);
  chapters.forEach((chapter, i) => {
    const path = `chapters[${i}]`;
    if (!isObject(chapter)) {
      report.error(path, "must be an object.");
      return;
    }
    checkUnknownKeys(report, chapter, CHAPTER_KEYS, path);
    requireString(report, chapter.title, `${path}.title`);
    if (chapter.narration === void 0) report.warn(`${path}.narration`, "is missing; narration is the script line shown as the subtitle.");
    else if (typeof chapter.narration !== "string") report.error(`${path}.narration`, "must be a string.");
    else if (chapter.narration.length > 140) report.warn(`${path}.narration`, "is long for a subtitle; aim for one sentence under 140 characters.");
    if (chapter.focus !== void 0) {
      const parsed = checkSelector(report, chapter.focus, `${path}.focus`, screens, { allowAll: true, actors: actorDefs });
      if (parsed?.screen && !parsed.actor && !stage2.visible.has(parsed.screen) && !enters(chapter, parsed.screen)) {
        report.warn(`${path}.focus`, `"${parsed.screen}" is off stage when this chapter starts.`);
      }
    }
    checkRange(report, chapter.zoom, `${path}.zoom`, LIMITS.zoom);
    checkMotion(report, chapter, path);
    if (chapter.backdrop !== void 0) checkBackdrop(report, chapter.backdrop, `${path}.backdrop`);
    if (!Array.isArray(chapter.steps) || chapter.steps.length === 0) {
      report.error(`${path}.steps`, "must be a non-empty array of steps.");
      return;
    }
    chapter.steps.forEach((step, j) => checkStep(report, step, `${path}.steps[${j}]`, screens, rawScreens, names, stage2));
  });
}
var enters = (chapter, key) => Array.isArray(chapter.steps) && isObject(chapter.steps[0]) && chapter.steps[0].enter === key;
function validateClip(clip2) {
  const report = new Report();
  if (!isObject(clip2)) {
    report.error("", "A clip must be a JSON object.");
    return { ok: false, errors: report.errors, warnings: report.warnings };
  }
  checkUnknownKeys(report, clip2, TOP_KEYS, "");
  if (clip2.cueflick === void 0) report.warn("cueflick", `is missing; add "cueflick": "${FORMAT_VERSION}" so future versions can read this file.`);
  else if (clip2.cueflick !== FORMAT_VERSION) report.error("cueflick", `format "${clip2.cueflick}" isn't supported; this version reads "${FORMAT_VERSION}".`);
  requireString(report, clip2.title, "title");
  optionalString(report, clip2.disclaimer, "disclaimer");
  if (clip2.layout !== void 0 && !LAYOUTS.includes(clip2.layout)) {
    report.error("layout", `must be one of ${LAYOUTS.join(", ")}.`, suggest(clip2.layout, LAYOUTS));
  }
  checkStory(report, clip2.story);
  checkDesign(report, clip2.design);
  const template = typeof clip2.template === "string" ? getTemplate(clip2.template) : void 0;
  if (!template) {
    report.error("template", `"${clip2.template}" is not a known template. Known: ${templateNames().join(", ")}.`, suggest(clip2.template, templateNames()));
  }
  const screens = checkScreens(report, clip2.screens);
  if (template) {
    const present = new Set(Object.values(screens).map((screen) => screen.def.surface));
    for (const needed of template.requires) {
      if (!present.has(needed)) report.error("screens", `template "${template.name}" needs a "${needed}" screen.`);
    }
    template.validate?.(clip2, report);
  }
  const actors = checkActors(report, clip2.actors, screens);
  checkChapters(report, clip2.chapters, screens, isObject(clip2.screens) ? clip2.screens : {}, actors);
  return { ok: report.errors.length === 0, errors: report.errors, warnings: report.warnings };
}
function formatReport(result, file = "clip") {
  const lines = [];
  const entry = (mark, item) => {
    lines.push(`${mark} ${item.path || "(root)"}: ${item.message}`);
    if (item.hint) lines.push(`    hint: ${item.hint}`);
  };
  result.errors.forEach((item) => entry("\u2717", item));
  result.warnings.forEach((item) => entry("!", item));
  const summary = result.ok ? `\u2713 ${file} is valid${result.warnings.length ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})` : ""}.` : `\u2717 ${file} has ${result.errors.length} error${result.errors.length === 1 ? "" : "s"}.`;
  return [...lines, summary].join("\n");
}

// src/core/element.js
var sheet = null;
var sheetSource = "";
function styleSheet() {
  const source = `${player_default}
${surfaceStyles()}`;
  if (!sheet || source !== sheetSource) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(source);
    sheetSource = source;
  }
  return sheet;
}
function errorPanel(errors, source) {
  return h("div", { class: "cf-error", role: "alert" }, [
    h("strong", { text: `Cueflick: ${source} can't be played` }),
    h("ul", {}, errors.map((item) => h("li", { text: `${item.path || "(root)"}: ${item.message}${item.hint ? ` ${item.hint}` : ""}` })))
  ]);
}
function parseChapter(value) {
  if (value === null || value === "") return null;
  if (/^\d+$/.test(value)) return Number(value);
  console.warn(`cueflick: chapter="${value}" must be a whole number (0 is the first chapter); ignoring it.`);
  return null;
}
function defineElement(tagName = "cue-flick") {
  if (typeof customElements === "undefined" || customElements.get(tagName)) return;
  class CueflickElement extends HTMLElement {
    static get observedAttributes() {
      return ["src", "mode", "chapter", "autoplay", "controls", "endcard", "reduced-motion"];
    }
    #clip = null;
    #player = null;
    #loadToken = 0;
    #scheduled = false;
    connectedCallback() {
      if (Object.prototype.hasOwnProperty.call(this, "clip")) {
        const value = this.clip;
        delete this.clip;
        this.#clip = value;
      }
      this.#schedule();
    }
    disconnectedCallback() {
      this.#loadToken += 1;
      this.#player?.destroy();
      this.#player = null;
    }
    attributeChangedCallback(_name, oldValue, newValue) {
      if (oldValue !== newValue) this.#schedule();
    }
    /** Set a clip object directly (instead of src or inline JSON). */
    set clip(value) {
      this.#clip = value;
      this.#schedule();
    }
    get clip() {
      return this.#clip;
    }
    get player() {
      return this.#player;
    }
    play() {
      this.#player?.play();
    }
    pause() {
      this.#player?.pause();
    }
    replay() {
      this.#player?.replay();
    }
    goTo(index) {
      this.#player?.goTo(index);
    }
    /** Coalesce attribute and property changes into one load per task. */
    #schedule() {
      if (this.#scheduled) return;
      this.#scheduled = true;
      queueMicrotask(() => {
        this.#scheduled = false;
        if (this.isConnected) this.#load();
      });
    }
    #options() {
      return {
        autoplay: this.getAttribute("autoplay") === "none" ? "none" : "view",
        controls: this.getAttribute("controls") !== "none",
        endcard: this.getAttribute("endcard") !== "none",
        chapter: parseChapter(this.getAttribute("chapter")),
        mode: this.getAttribute("mode"),
        reducedMotion: this.hasAttribute("reduced-motion") ? true : void 0
      };
    }
    async #readClip(src) {
      if (this.#clip) return this.#clip;
      const inline = this.querySelector('script[type="application/json"]');
      if (inline) return JSON.parse(inline.textContent);
      if (src) {
        const response = await fetch(src, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`could not load ${src} (HTTP ${response.status})`);
        return response.json();
      }
      return null;
    }
    async #load() {
      const token = ++this.#loadToken;
      const src = this.getAttribute("src");
      if (!this.#clip && !src && document.readyState === "loading" && !this.querySelector('script[type="application/json"]')) {
        document.addEventListener("DOMContentLoaded", () => this.#schedule(), { once: true });
        return;
      }
      const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      shadow.adoptedStyleSheets = [styleSheet()];
      const mount2 = h("div", { class: "cf-mount" });
      shadow.replaceChildren(mount2);
      this.#player?.destroy();
      this.#player = null;
      const source = src ?? "this clip";
      try {
        const clip2 = await this.#readClip(src);
        if (token !== this.#loadToken || !clip2) return;
        const result = validateClip(clip2);
        if (!result.ok) {
          console.warn(formatReport(result, source));
          mount2.replaceChildren(errorPanel(result.errors, source));
          this.dispatchEvent(new CustomEvent("cueflick:error", { detail: { result }, bubbles: true, composed: true }));
          return;
        }
        this.#player = new Player(this, mount2, clip2, this.#options());
      } catch (error) {
        if (token !== this.#loadToken) return;
        mount2.replaceChildren(errorPanel([{ path: "", message: error.message }], source));
        this.dispatchEvent(new CustomEvent("cueflick:error", { detail: { error }, bubbles: true, composed: true }));
      }
    }
  }
  customElements.define(tagName, CueflickElement);
}

// src/index.js
for (const surface of [crm_record_default, flow_canvas_default, team_chat_default, ai_chat_default2, browser_app_default2, phone_default2]) registerSurface(surface);
for (const template of [trigger_automation_notify_default, assistant_connector_default, assistant_files_default, phone_feature_default]) registerTemplate(template);
function mount(target, clip2, options = {}) {
  const tagName = options.tagName ?? "cue-flick";
  defineElement(tagName);
  const element = document.createElement(tagName);
  if (options.autoplay === "none") element.setAttribute("autoplay", "none");
  if (options.controls === false) element.setAttribute("controls", "none");
  if (options.endcard === false) element.setAttribute("endcard", "none");
  if (options.reducedMotion) element.setAttribute("reduced-motion", "");
  if (Number.isInteger(options.chapter)) element.setAttribute("chapter", String(options.chapter));
  if (options.mode) element.setAttribute("mode", options.mode);
  if (typeof clip2 === "string") element.setAttribute("src", clip2);
  else element.clip = clip2;
  target.append(element);
  return element;
}
if (typeof window !== "undefined") defineElement();
export {
  ASPECTS,
  DEFAULT_DESIGN,
  DIRECTIONS,
  EASES,
  EASE_NAMES,
  FORMAT_VERSION,
  GENERIC_ACTIONS,
  LAYOUTS,
  LEAVE_EFFECTS,
  MODES,
  PATHS,
  Player,
  SHAPES,
  SLOTS,
  SPAWN_EFFECTS,
  WORLD,
  catalog,
  defineElement,
  formatReport,
  frameFor,
  h,
  layoutFor,
  mount,
  registerSurface,
  registerTemplate,
  resolveDesign,
  richText,
  s,
  validateClip as validate,
  VERSION as version
};
