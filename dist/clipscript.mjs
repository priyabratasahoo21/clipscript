/*! clipscript v0.2.0 | MIT License | product films for software, written as data */

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
function applyProps(el, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === void 0 || value === null || value === false) continue;
    if (/^on/i.test(key)) throw new TypeError(`h(): event-handler attribute "${key}" is not allowed; use addEventListener.`);
    if (URL_ATTRIBUTES.has(key.toLowerCase()) && !SAFE_URL.test(String(value).trim())) {
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

// src/surfaces/ai-chat.css
var ai_chat_default = '/* ai-chat surface: an AI assistant app with connectors (warm, conversational look) */\n\n.cs-aichat {\n    --ai-bg: color-mix(in srgb, var(--cs-win) 90%, #efe3cf);\n    --ai-side: color-mix(in srgb, var(--cs-win-2) 82%, #e7dac3);\n    --ai-bubble: color-mix(in srgb, var(--cs-win-3) 72%, #e6dac6);\n    --ai-serif: "Tiempos Text", "Iowan Old Style", ui-serif, Georgia, Cambria, "Times New Roman", serif;\n\n    background: var(--ai-bg);\n}\n\n.cs-aichat .cs-appbar {\n    background: var(--ai-bg);\n    box-shadow: none;\n}\n\n.cs-ai-main {\n    display: flex;\n    flex: 1;\n    min-height: 0;\n}\n\n.cs-ai-side {\n    display: flex;\n    flex-direction: column;\n    width: 176px;\n    flex-shrink: 0;\n    padding: 12px 10px;\n    background: var(--ai-side);\n    border-right: 1px solid var(--cs-line);\n    font-size: 13px;\n}\n\n.cs-ai-new {\n    padding: 8px 10px;\n    border: 1px solid var(--cs-line-strong);\n    border-radius: 9px;\n    background: var(--cs-win);\n    font-weight: 650;\n}\n\n.cs-ai-label {\n    margin: 16px 6px 6px;\n    color: var(--cs-dim);\n    font-size: 11px;\n    font-weight: 700;\n    letter-spacing: 0.06em;\n    text-transform: uppercase;\n}\n\n.cs-ai-recent {\n    padding: 6px 8px;\n    overflow: hidden;\n    border-radius: 7px;\n    color: var(--cs-dim);\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.cs-ai-recent.cs-active {\n    background: var(--ai-bubble);\n    color: var(--cs-text);\n    font-weight: 600;\n}\n\n.cs-ai-user {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-top: auto;\n    padding: 6px 4px 0;\n    font-weight: 600;\n}\n\n.cs-ai-user .cs-avatar {\n    width: 26px;\n    height: 26px;\n    border-radius: 50%;\n    font-size: 10px;\n}\n\n.cs-ai-pane {\n    position: relative;\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    min-width: 0;\n}\n\n.cs-ai-thread {\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    gap: 14px;\n    min-height: 0;\n    padding: 20px 26px 12px;\n    overflow: hidden;\n}\n\n.cs-ai-thread:has(.cs-ai-msg, .cs-ai-tool) {\n    mask-image: linear-gradient(to bottom, transparent 0, #000 28px);\n}\n\n.cs-ai-empty {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    gap: 14px;\n    flex: 1;\n    padding-bottom: 30px;\n}\n\n.cs-ai-empty .cs-appicon {\n    width: 40px;\n    height: 40px;\n    border-radius: 50%;\n    font-size: 13px;\n}\n\n.cs-ai-greet {\n    font-family: var(--ai-serif);\n    font-size: 30px;\n    letter-spacing: -0.01em;\n    text-align: center;\n}\n\n.cs-ai-user-msg {\n    align-self: flex-end;\n    max-width: 82%;\n    animation: cs-in 350ms ease;\n}\n\n.cs-ai-bubble {\n    padding: 10px 14px;\n    background: var(--ai-bubble);\n    border-radius: 14px;\n    font-size: 14.5px;\n    line-height: 1.5;\n    overflow-wrap: anywhere;\n}\n\n.cs-ai-thinking {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    color: var(--cs-dim);\n    font-size: 13.5px;\n    font-style: italic;\n}\n\n.cs-ai-spark {\n    color: var(--app);\n    font-style: normal;\n    animation: cs-ai-pulse 1s ease-in-out infinite;\n}\n\n@keyframes cs-ai-pulse {\n    50% { opacity: 0.35; transform: rotate(30deg); }\n}\n\n.cs-ai-tool {\n    padding: 9px 12px;\n    background: var(--cs-win);\n    border: 1px solid var(--cs-line);\n    border-radius: 10px;\n    font-size: 13px;\n    animation: cs-in 300ms ease;\n}\n\n.cs-ai-tool-head {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\n.cs-ai-tool-head .cs-appicon,\n.cs-ai-chip .cs-appicon,\n.cs-ai-conn .cs-appicon {\n    width: 20px;\n    height: 20px;\n    border-radius: 6px;\n    font-size: 8.5px;\n}\n\n.cs-ai-tool-name {\n    flex: 1;\n    min-width: 0;\n    overflow: hidden;\n    font-family: var(--cs-font-mono);\n    font-size: 12.5px;\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.cs-ai-tool-name b {\n    font-family: var(--cs-font-ui);\n}\n\n.cs-ai-tool-status {\n    width: 14px;\n    height: 14px;\n    flex-shrink: 0;\n}\n\n.cs-ai-tool.cs-running .cs-ai-tool-status {\n    border: 2px solid var(--cs-line-strong);\n    border-top-color: var(--app);\n    border-radius: 50%;\n    animation: cs-ai-spin 800ms linear infinite;\n}\n\n.cs-ai-tool.cs-ok .cs-ai-tool-status::before {\n    content: "\u2713";\n    color: var(--cs-ok);\n    font-weight: 800;\n}\n\n@keyframes cs-ai-spin {\n    to { transform: rotate(360deg); }\n}\n\n.cs-ai-tool-input {\n    margin-top: 5px;\n    overflow: hidden;\n    color: var(--cs-dim);\n    font-family: var(--cs-font-mono);\n    font-size: 11.5px;\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.cs-ai-tool-result:empty {\n    display: none;\n}\n\n.cs-ai-tool-result {\n    margin-top: 5px;\n    font-size: 13px;\n    font-weight: 600;\n}\n\n.cs-ai-reply {\n    display: grid;\n    grid-template-columns: 28px minmax(0, 1fr);\n    gap: 12px;\n    animation: cs-in 400ms ease;\n}\n\n.cs-ai-mark .cs-appicon {\n    width: 26px;\n    height: 26px;\n    border-radius: 50%;\n    font-size: 9px;\n}\n\n.cs-ai-prose {\n    font-family: var(--ai-serif);\n    font-size: 15.5px;\n    line-height: 1.6;\n    overflow-wrap: anywhere;\n}\n\n.cs-ai-prose p {\n    margin: 0 0 8px;\n}\n\n.cs-ai-prose ul {\n    margin: 0 0 8px;\n    padding-left: 20px;\n}\n\n.cs-ai-prose li {\n    margin: 2px 0;\n}\n\n.cs-ai-prose code {\n    font-family: var(--cs-font-mono);\n    font-size: 0.85em;\n}\n\n.cs-ai-composer {\n    position: relative;\n    flex-shrink: 0;\n    margin: 6px 22px 18px;\n    padding: 12px 14px 10px;\n    background: var(--cs-win);\n    border: 1px solid var(--cs-line-strong);\n    border-radius: 18px;\n    box-shadow: 0 6px 20px rgb(0 0 0 / 0.07);\n    transition: border-color 200ms ease;\n}\n\n.cs-ai-composer.cs-typing {\n    border-color: var(--app);\n}\n\n.cs-ai-input {\n    min-height: 40px;\n    font-size: 14.5px;\n    line-height: 1.45;\n}\n\n.cs-ai-placeholder {\n    color: var(--cs-faint);\n}\n\n.cs-ai-composer.cs-typing .cs-ai-placeholder,\n.cs-ai-typed:not(:empty) + .cs-ai-placeholder {\n    display: none;\n}\n\n.cs-ai-bar {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-top: 6px;\n    font-size: 12.5px;\n}\n\n.cs-ai-plus {\n    display: grid;\n    place-items: center;\n    width: 26px;\n    height: 26px;\n    border: 1px solid var(--cs-line-strong);\n    border-radius: 50%;\n    color: var(--cs-dim);\n}\n\n.cs-ai-tools,\n.cs-ai-chip {\n    display: inline-flex;\n    align-items: center;\n    gap: 5px;\n    padding: 4px 9px;\n    border: 1px solid var(--cs-line-strong);\n    border-radius: 999px;\n    color: var(--cs-dim);\n    white-space: nowrap;\n}\n\n.cs-ai-chips {\n    display: flex;\n    gap: 6px;\n    min-width: 0;\n    overflow: hidden;\n}\n\n.cs-ai-chip {\n    padding: 3px 9px 3px 4px;\n    color: var(--cs-text);\n    font-weight: 600;\n}\n\n.cs-ai-model {\n    margin-left: auto;\n    color: var(--cs-dim);\n    white-space: nowrap;\n}\n\n.cs-ai-send {\n    display: grid;\n    place-items: center;\n    width: 30px;\n    height: 30px;\n    flex-shrink: 0;\n    border-radius: 9px;\n    background: var(--app);\n    color: #fff;\n    font-weight: 800;\n}\n\n.cs-ai-menu {\n    position: absolute;\n    left: 12px;\n    bottom: calc(100% + 8px);\n    z-index: 5;\n    width: 270px;\n    padding: 8px;\n    background: var(--cs-win);\n    border: 1px solid var(--cs-line-strong);\n    border-radius: 12px;\n    box-shadow: var(--cs-shadow);\n    opacity: 0;\n    transform: translateY(6px);\n    pointer-events: none;\n    transition: opacity 200ms ease, transform 200ms ease;\n}\n\n.cs-ai-menu.cs-open {\n    opacity: 1;\n    transform: none;\n}\n\n.cs-ai-menu-label {\n    margin: 2px 6px 6px;\n    color: var(--cs-dim);\n    font-size: 11px;\n    font-weight: 700;\n    letter-spacing: 0.06em;\n    text-transform: uppercase;\n}\n\n.cs-ai-conn {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 7px 8px;\n    border-radius: 8px;\n    font-size: 13.5px;\n}\n\n.cs-ai-conn-name {\n    flex: 1;\n}\n\n.cs-ai-conn .cs-switch {\n    position: relative;\n    width: 30px;\n    height: 18px;\n    border-radius: 999px;\n    background: var(--cs-line-strong);\n    transition: background 200ms ease;\n}\n\n.cs-ai-conn .cs-switch i {\n    position: absolute;\n    top: 2px;\n    left: 2px;\n    width: 14px;\n    height: 14px;\n    border-radius: 50%;\n    background: #fff;\n    transition: left 200ms ease;\n}\n\n.cs-ai-conn .cs-switch.cs-on {\n    background: var(--app);\n}\n\n.cs-ai-conn .cs-switch.cs-on i {\n    left: 14px;\n}\n';

// src/surfaces/shared.js
function appIcon(app, color) {
  return h("span", {
    class: "cs-appicon",
    style: color ? { "--app": color } : void 0,
    text: app?.icon ?? initials(app?.name ?? "?")
  });
}
function appWindow(app, { title, trailing, className }) {
  const body = h("div", { class: "cs-body" });
  const el = h("div", { class: `cs-window ${className}` }, [
    h("div", { class: "cs-appbar" }, [
      appIcon(app),
      h("span", { class: "cs-appname", text: app.name }),
      title ? h("span", { class: "cs-apptitle", text: title }) : null,
      trailing ? h("span", { class: "cs-apptrail" }, trailing) : null
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
var CONNECTOR_ID = /^[A-Za-z_][\w-]*$/;
function validateChat(def, path, report, screens) {
  for (const key of ["assistant", "model", "user", "title", "greeting"]) {
    if (def[key] !== void 0 && typeof def[key] !== "string") report.error(`${path}.${key}`, "must be a string.");
  }
  if (def.recents !== void 0 && (!Array.isArray(def.recents) || def.recents.some((item) => typeof item !== "string"))) {
    report.error(`${path}.recents`, "must be an array of earlier chat titles.");
  }
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
    if (typeof connector.id !== "string" || !CONNECTOR_ID.test(connector.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-".');
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
function prose(text) {
  const wrapper = h("div", { class: "cs-ai-prose" });
  let list = null;
  for (const line of String(text).split("\n")) {
    if (line.startsWith("- ")) {
      list ??= wrapper.appendChild(h("ul"));
      list.append(h("li", {}, richText(line.slice(2))));
    } else {
      list = null;
      if (line.trim()) wrapper.append(h("p", {}, richText(line)));
    }
  }
  return wrapper;
}
function render(def, { screens }) {
  const assistant = def.assistant ?? def.app.name;
  const { el, body } = appWindow(def.app, { title: def.title ?? "New chat", className: "cs-aichat" });
  const connectors = Array.isArray(def.connectors) ? def.connectors : [];
  const enabled = new Set(connectors.filter((c) => c.enabled).map((c) => c.id));
  const sidebar = h("div", { class: "cs-ai-side" }, [
    h("div", { class: "cs-ai-new", text: "+ New chat" }),
    h("div", { class: "cs-ai-label", text: "Recents" }),
    h("div", { class: "cs-ai-recent cs-active", text: def.title ?? "New chat" }),
    ...(def.recents ?? []).map((title) => h("div", { class: "cs-ai-recent", text: title })),
    h("div", { class: "cs-ai-user" }, [
      h("span", { class: "cs-avatar", style: { "--avatar": nameColor(def.user ?? "You") }, text: initials(def.user ?? "You") }),
      h("span", { text: def.user ?? "You" })
    ])
  ]);
  const firstName = String(def.user ?? "").split(/\s+/)[0];
  const empty = h("div", { class: "cs-ai-empty" }, [
    h("span", { class: "cs-ai-mark", "aria-hidden": "true" }, appIcon(def.app)),
    h("div", { class: "cs-ai-greet", text: def.greeting ?? (firstName ? `Good to see you, ${firstName}` : "How can I help?") })
  ]);
  const thread = h("div", { class: "cs-ai-thread" }, empty);
  const typed = h("span", { class: "cs-ai-typed" });
  const chips = h("span", { class: "cs-ai-chips" });
  const menu = h("div", { class: "cs-ai-menu" }, [
    h("div", { class: "cs-ai-menu-label", text: "Connectors" }),
    ...connectors.map((connector) => {
      const brand = brandOf(connector, screens);
      return h("div", { class: "cs-ai-conn", dataset: { connector: connector.id } }, [
        appIcon({ icon: brand.icon, name: brand.name }, brand.color),
        h("span", { class: "cs-ai-conn-name", text: brand.name }),
        h("span", { class: enabled.has(connector.id) ? "cs-switch cs-on" : "cs-switch" }, h("i"))
      ]);
    })
  ]);
  const toolsButton = h("span", { class: "cs-ai-tools", text: "\u2699 Connectors" });
  const composer = h("div", { class: "cs-ai-composer" }, [
    h("div", { class: "cs-ai-input" }, [typed, h("span", { class: "cs-ai-placeholder", text: `Reply to ${assistant}\u2026` })]),
    h("div", { class: "cs-ai-bar" }, [
      h("span", { class: "cs-ai-plus", text: "+" }),
      toolsButton,
      chips,
      h("span", { class: "cs-ai-model", text: def.model ?? assistant }),
      h("span", { class: "cs-ai-send", text: "\u2191" })
    ]),
    menu
  ]);
  body.append(h("div", { class: "cs-ai-main" }, [sidebar, h("div", { class: "cs-ai-pane" }, [thread, composer])]));
  const refreshChips = () => {
    chips.replaceChildren(...connectors.filter((c) => enabled.has(c.id)).map((connector) => {
      const brand = brandOf(connector, screens);
      return h("span", { class: "cs-ai-chip" }, [appIcon({ icon: brand.icon, name: brand.name }, brand.color), brand.name]);
    }));
  };
  refreshChips();
  const scroll = () => {
    thread.scrollTop = thread.scrollHeight;
  };
  return {
    el,
    find: (part, name) => part === "connector" ? byData(el, "connector", name) : null,
    toolsButton,
    composer,
    typed,
    menu,
    openMenu(open) {
      menu.classList.toggle("cs-open", open);
    },
    enable(id) {
      enabled.add(id);
      byData(menu, "connector", id)?.querySelector(".cs-switch")?.classList.add("cs-on");
      refreshChips();
    },
    addUser(text) {
      empty.remove();
      thread.append(h("div", { class: "cs-ai-msg cs-ai-user-msg" }, h("div", { class: "cs-ai-bubble", text })));
      scroll();
    },
    addThinking() {
      const node = h("div", { class: "cs-ai-thinking" }, [h("span", { class: "cs-ai-spark", text: "\u2736" }), "Thinking\u2026"]);
      thread.append(node);
      scroll();
      return node;
    },
    addTool(connectorId, name, input) {
      const connector = connectors.find((c) => c.id === connectorId);
      const brand = connector ? brandOf(connector, screens) : { name: connectorId ?? "Tool", icon: "\u2699", color: "#6b7280" };
      const status = h("span", { class: "cs-ai-tool-status" });
      const result = h("div", { class: "cs-ai-tool-result" });
      const block = h("div", { class: "cs-ai-tool" }, [
        h("div", { class: "cs-ai-tool-head" }, [
          appIcon({ icon: brand.icon, name: brand.name }, brand.color),
          h("span", { class: "cs-ai-tool-name" }, [h("b", { text: brand.name }), ` \xB7 ${name}`]),
          status
        ]),
        input !== void 0 ? h("div", { class: "cs-ai-tool-input", text: inputSummary(input) }) : null,
        result
      ]);
      thread.append(block);
      scroll();
      return { block, result };
    },
    addReply(text) {
      thread.append(h("div", { class: "cs-ai-msg cs-ai-reply" }, [
        h("span", { class: "cs-ai-mark", "aria-hidden": "true" }, appIcon(def.app)),
        prose(text)
      ]));
      scroll();
    }
  };
}
var ai_chat_default2 = {
  name: "ai-chat",
  summary: "An AI assistant app with connectors: turn a connector on, send a prompt, and watch tool calls and the reply.",
  width: 520,
  keys: ["assistant", "model", "user", "title", "greeting", "recents", "connectors"],
  styles: ai_chat_default,
  parts: {
    connector: connectorIds
  },
  validate: validateChat,
  render,
  recap: (view) => view.openMenu(false),
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
        const toggle = row2?.querySelector(".cs-switch");
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
      summary: "Type a message into the composer and send it.",
      keys: [],
      validate(step, _def, path, report) {
        if (typeof step.prompt !== "string" || !step.prompt) report.error(`${path}.prompt`, "must be the message the user sends.");
      },
      async run(view, step, ctx) {
        await ctx.cursor.moveTo(view.composer, ctx, { dx: 0.3, dy: 0.3 });
        await ctx.cursor.click(ctx);
        view.composer.classList.add("cs-typing");
        await typeInto(view.typed, step.prompt, ctx, 22);
        await ctx.wait(350);
        view.typed.textContent = "";
        view.composer.classList.remove("cs-typing");
        view.addUser(step.prompt);
        ctx.cursor.hide();
        await ctx.wait(500);
      }
    },
    think: {
      summary: "Show the assistant thinking for a moment (milliseconds).",
      keys: [],
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
        block.classList.add("cs-running");
        await ctx.wait(step.ms ?? 900);
        block.classList.remove("cs-running");
        block.classList.add("cs-ok");
        if (step.result) result.textContent = step.result;
        await ctx.wait(350);
      }
    },
    respond: {
      summary: 'The assistant replies. Supports paragraphs, "- " bullet lines, *bold*, and `code`.',
      keys: [],
      validate(step, _def, path, report) {
        if (typeof step.respond !== "string" || !step.respond) report.error(`${path}.respond`, "must be the assistant's reply text.");
      },
      async run(view, step, ctx) {
        view.addReply(step.respond);
        await ctx.wait(1800);
      }
    }
  }
};

// src/surfaces/browser-app.css
var browser_app_default = "/* browser-app surface: a web app in a browser window */\n\n.cs-browser {\n    background: var(--cs-win);\n}\n\n.cs-bw-chrome {\n    flex-shrink: 0;\n    background: color-mix(in srgb, var(--cs-stage) 55%, var(--cs-win-2));\n    border-bottom: 1px solid var(--cs-line);\n}\n\n.cs-bw-tabs {\n    display: flex;\n    align-items: flex-end;\n    gap: 14px;\n    height: 40px;\n    padding: 0 12px;\n}\n\n.cs-bw-dots {\n    display: flex;\n    gap: 6px;\n    align-self: center;\n}\n\n.cs-bw-dots i {\n    width: 11px;\n    height: 11px;\n    border-radius: 50%;\n    background: #ff5f57;\n}\n\n.cs-bw-dots i:nth-child(2) { background: #febc2e; }\n.cs-bw-dots i:nth-child(3) { background: #28c840; }\n\n.cs-bw-tab {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    max-width: 280px;\n    padding: 8px 12px;\n    background: var(--cs-win-2);\n    border-radius: 9px 9px 0 0;\n    font-size: 12.5px;\n    font-weight: 600;\n    white-space: nowrap;\n}\n\n.cs-bw-tab span:nth-child(2) {\n    overflow: hidden;\n    text-overflow: ellipsis;\n}\n\n.cs-bw-tab .cs-appicon {\n    width: 16px;\n    height: 16px;\n    border-radius: 4px;\n    font-size: 7px;\n}\n\n.cs-bw-x {\n    margin-left: 4px;\n    color: var(--cs-faint);\n}\n\n.cs-bw-bar {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 7px 12px 8px;\n    background: var(--cs-win-2);\n}\n\n.cs-bw-nav {\n    color: var(--cs-faint);\n    font-size: 14px;\n    letter-spacing: 0.08em;\n    white-space: nowrap;\n}\n\n.cs-bw-url {\n    display: flex;\n    flex: 1;\n    align-items: center;\n    gap: 8px;\n    min-width: 0;\n    padding: 6px 12px;\n    overflow: hidden;\n    background: var(--cs-win);\n    border: 1px solid var(--cs-line);\n    border-radius: 999px;\n    color: var(--cs-dim);\n    font-size: 12.5px;\n    white-space: nowrap;\n}\n\n.cs-bw-lock {\n    font-size: 10px;\n}\n\n.cs-ba-app {\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    min-height: 0;\n}\n\n.cs-ba-header {\n    display: flex;\n    align-items: center;\n    gap: 14px;\n    height: 52px;\n    flex-shrink: 0;\n    padding: 0 16px;\n    border-bottom: 1px solid var(--cs-line);\n}\n\n.cs-ba-brand {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    font-size: 17px;\n    font-weight: 850;\n    letter-spacing: -0.02em;\n}\n\n.cs-ba-company {\n    padding: 4px 10px;\n    background: var(--cs-win-2);\n    border-radius: 7px;\n    color: var(--cs-dim);\n    font-size: 12.5px;\n    font-weight: 600;\n    white-space: nowrap;\n}\n\n.cs-ba-search {\n    flex: 1;\n    max-width: 220px;\n    margin-left: auto;\n    padding: 6px 12px;\n    background: var(--cs-win-2);\n    border: 1px solid var(--cs-line);\n    border-radius: 999px;\n    color: var(--cs-faint);\n    font-size: 12.5px;\n}\n\n.cs-ba-new,\n.cs-ba-primary {\n    padding: 6px 14px;\n    background: var(--app);\n    border-radius: 999px;\n    color: #fff;\n    font-size: 12.5px;\n    font-weight: 750;\n    white-space: nowrap;\n}\n\n.cs-ba-avatar {\n    width: 30px;\n    height: 30px;\n    border-radius: 50%;\n    font-size: 10px;\n}\n\n.cs-ba-body {\n    position: relative;\n    display: flex;\n    flex: 1;\n    min-height: 0;\n    overflow: hidden;\n}\n\n.cs-ba-nav {\n    width: 150px;\n    flex-shrink: 0;\n    padding: 12px 8px;\n    background: color-mix(in srgb, var(--cs-win-2) 85%, var(--cs-stage));\n    border-right: 1px solid var(--cs-line);\n}\n\n.cs-ba-link {\n    margin-bottom: 2px;\n    padding: 8px 12px;\n    border-left: 3px solid transparent;\n    border-radius: 6px;\n    color: var(--cs-dim);\n    font-size: 13px;\n    font-weight: 600;\n}\n\n.cs-ba-link.cs-active {\n    background: color-mix(in srgb, var(--app) 16%, transparent);\n    border-left-color: var(--app);\n    color: var(--cs-text);\n    font-weight: 750;\n}\n\n.cs-ba-page {\n    display: flex;\n    flex: 1;\n    flex-direction: column;\n    gap: 14px;\n    min-width: 0;\n    padding: 16px 20px;\n}\n\n.cs-ba-title-row {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n}\n\n.cs-ba-title {\n    font-size: 22px;\n    font-weight: 850;\n    letter-spacing: -0.02em;\n}\n\n.cs-ba-cards {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));\n    gap: 10px;\n}\n\n.cs-ba-card {\n    padding: 10px 12px;\n    background: var(--cs-win-2);\n    border: 1px solid var(--cs-line);\n    border-left: 3px solid var(--tone);\n    border-radius: 10px;\n}\n\n.cs-ba-card-label {\n    color: var(--cs-dim);\n    font-size: 11.5px;\n    font-weight: 600;\n}\n\n.cs-ba-card-value {\n    margin-top: 3px;\n    font-size: 18px;\n    font-weight: 850;\n}\n\n.cs-ba-table-wrap {\n    flex: 1;\n    min-height: 0;\n    overflow: hidden;\n    border: 1px solid var(--cs-line);\n    border-radius: 10px;\n}\n\n.cs-ba-table {\n    width: 100%;\n    border-collapse: collapse;\n    font-size: 13px;\n}\n\n.cs-ba-table th {\n    padding: 9px 10px;\n    background: var(--cs-win-2);\n    color: var(--cs-dim);\n    font-size: 11px;\n    font-weight: 750;\n    letter-spacing: 0.05em;\n    text-align: left;\n    text-transform: uppercase;\n}\n\n.cs-ba-table td {\n    padding: 10px;\n    border-top: 1px solid var(--cs-line);\n    overflow-wrap: anywhere;\n}\n\n.cs-ba-row.cs-pending {\n    display: none;\n}\n\n.cs-ba-row.cs-added {\n    animation: cs-ba-row-in 1200ms ease;\n}\n\n@keyframes cs-ba-row-in {\n    0% { background: color-mix(in srgb, var(--app) 40%, transparent); opacity: 0; }\n    25% { opacity: 1; }\n    100% { background: transparent; }\n}\n\n.cs-ba-row.cs-selected {\n    background: color-mix(in srgb, var(--app) 14%, transparent);\n}\n\n.cs-pill {\n    display: inline-block;\n    padding: 2px 9px;\n    border-radius: 999px;\n    background: color-mix(in srgb, var(--tone) 18%, transparent);\n    color: var(--tone);\n    font-size: 11.5px;\n    font-weight: 750;\n    white-space: nowrap;\n}\n\n.cs-tone-ok { --tone: var(--cs-ok); }\n.cs-tone-info { --tone: #60a5fa; }\n.cs-tone-warn { --tone: var(--cs-warn); }\n.cs-tone-danger { --tone: #f87171; }\n.cs-tone-muted { --tone: var(--cs-dim); }\n\n.cs-ba-drawer {\n    position: absolute;\n    top: 0;\n    right: 0;\n    bottom: 0;\n    z-index: 4;\n    width: 46%;\n    background: var(--cs-win);\n    border-left: 1px solid var(--cs-line-strong);\n    box-shadow: var(--cs-shadow);\n    transform: translateX(105%);\n    transition: transform 400ms cubic-bezier(0.3, 0.7, 0.2, 1);\n}\n\n.cs-ba-drawer.cs-open {\n    transform: none;\n}\n\n.cs-ba-drawer-head {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding: 14px 16px;\n    border-bottom: 1px solid var(--cs-line);\n}\n\n.cs-ba-drawer-title {\n    font-size: 16px;\n    font-weight: 850;\n}\n\n.cs-ba-drawer-body {\n    padding: 8px 16px;\n}\n\n.cs-ba-field {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    padding: 8px 0;\n    border-bottom: 1px solid var(--cs-line);\n    font-size: 13px;\n}\n\n.cs-ba-field span:first-child {\n    color: var(--cs-dim);\n}\n\n.cs-ba-field b {\n    text-align: right;\n    overflow-wrap: anywhere;\n}\n\n.cs-ba-toast {\n    position: absolute;\n    top: 104px;\n    right: 18px;\n    z-index: 6;\n    padding: 9px 16px;\n    background: var(--cs-ok);\n    border-radius: 8px;\n    color: #fff;\n    font-size: 13.5px;\n    font-weight: 750;\n    box-shadow: var(--cs-shadow);\n    opacity: 0;\n    transform: translateY(-8px);\n    transition: opacity 250ms ease, transform 250ms ease;\n}\n\n.cs-ba-toast.cs-show {\n    opacity: 1;\n    transform: none;\n}\n";

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
  return h("span", { class: `cs-pill cs-tone-${tone ?? toneOf(status)}`, text: status });
}
function render2(def) {
  const { app } = def;
  const tab = h("div", { class: "cs-bw-tab" }, [appIcon(app), h("span", { text: def.tab ?? `${def.title ?? "Home"} \xB7 ${app.name}` }), h("span", { class: "cs-bw-x", text: "\xD7" })]);
  const chrome = h("div", { class: "cs-bw-chrome" }, [
    h("div", { class: "cs-bw-tabs" }, [h("span", { class: "cs-bw-dots", "aria-hidden": "true" }, [h("i"), h("i"), h("i")]), tab]),
    h("div", { class: "cs-bw-bar" }, [
      h("span", { class: "cs-bw-nav", text: "\u2039  \u203A  \u27F3" }),
      h("div", { class: "cs-bw-url" }, [h("span", { class: "cs-bw-lock", text: "\u{1F512}" }), h("span", { text: def.url ?? "app.example.com" })])
    ])
  ]);
  const header = h("div", { class: "cs-ba-header" }, [
    h("div", { class: "cs-ba-brand" }, [appIcon(app), h("span", { text: app.name.toLowerCase() })]),
    def.company ? h("div", { class: "cs-ba-company", text: def.company }) : null,
    h("div", { class: "cs-ba-search", text: "Search" }),
    h("span", { class: "cs-ba-new", text: "+ New" }),
    h("span", { class: "cs-avatar cs-ba-avatar", style: { "--avatar": "var(--app)" }, text: initials(def.company ?? app.name) })
  ]);
  const nav = h("div", { class: "cs-ba-nav" }, (def.nav ?? []).map((item) => h("div", { class: item === def.active ? "cs-ba-link cs-active" : "cs-ba-link", text: item })));
  const summary = Array.isArray(def.summary) && def.summary.length ? h("div", { class: "cs-ba-cards" }, def.summary.map((card) => h("div", { class: `cs-ba-card cs-tone-${card.tone ?? "muted"}` }, [
    h("div", { class: "cs-ba-card-label", text: card.label }),
    h("div", { class: "cs-ba-card-value", text: card.value })
  ]))) : null;
  const statusIndex = def.columns.length - 1;
  const rowEl = (row2) => h("tr", { class: row2.new ? "cs-ba-row cs-pending" : "cs-ba-row", dataset: { row: row2.id } }, [
    ...row2.cells.map((cell) => h("td", { text: String(cell) })),
    row2.status !== void 0 ? h("td", {}, statusPill(row2.status, row2.tone)) : null
  ]);
  const tbody = h("tbody", {}, def.rows.map(rowEl));
  const table = h("table", { class: "cs-ba-table" }, [
    h("thead", {}, h("tr", {}, def.columns.map((column, i) => h("th", { class: i === statusIndex ? "cs-ba-status-col" : null, text: column })))),
    tbody
  ]);
  const drawerBody = h("div", { class: "cs-ba-drawer-body" });
  const drawerTitle = h("div", { class: "cs-ba-drawer-title" });
  const drawer = h("div", { class: "cs-ba-drawer" }, [h("div", { class: "cs-ba-drawer-head" }, [drawerTitle, h("span", { class: "cs-bw-x", text: "\xD7" })]), drawerBody]);
  const toast = h("div", { class: "cs-ba-toast", role: "status" });
  const page = h("div", { class: "cs-ba-page" }, [
    h("div", { class: "cs-ba-title-row" }, [h("div", { class: "cs-ba-title", text: def.title ?? "Overview" }), h("span", { class: "cs-ba-primary", text: `Create ${(def.title ?? "item").replace(/s$/, "").toLowerCase()}` })]),
    summary,
    h("div", { class: "cs-ba-table-wrap" }, table)
  ]);
  const el = h("div", { class: "cs-window cs-browser" }, [
    chrome,
    h("div", { class: "cs-ba-app" }, [header, h("div", { class: "cs-ba-body" }, [nav, page, drawer])]),
    toast
  ]);
  return {
    el,
    find: (part, name) => part === "row" ? byData(el, "row", name) : null,
    reveal(id) {
      const row2 = byData(tbody, "row", id);
      if (!row2) return;
      row2.classList.remove("cs-pending");
      row2.classList.add("cs-added");
    },
    setStatus(id, status) {
      const cell = byData(tbody, "row", id)?.lastElementChild;
      if (cell) cell.replaceChildren(statusPill(status));
    },
    select(id) {
      for (const row2 of tbody.children) row2.classList.toggle("cs-selected", row2.dataset.row === id);
      const data = rowById(def, id);
      if (!data) return;
      drawerTitle.textContent = `${def.columns[0]} ${data.cells[0]}`;
      const fields = def.columns.slice(1, data.cells.length).map((column, i) => [column, String(data.cells[i + 1])]);
      const extra = isObject(data.detail) ? Object.entries(data.detail) : [];
      drawerBody.replaceChildren(
        ...[...fields, ...extra].map(([label, value]) => h("div", { class: "cs-ba-field" }, [h("span", { text: label }), h("b", { text: value })])),
        data.status ? h("div", { class: "cs-ba-field" }, [h("span", { text: "Status" }), statusPill(byData(tbody, "row", id)?.querySelector(".cs-pill")?.textContent ?? data.status)]) : null
      );
      drawer.classList.add("cs-open");
    },
    showToast(text) {
      toast.textContent = `\u2713 ${text}`;
      toast.classList.add("cs-show");
    },
    hideToast() {
      toast.classList.remove("cs-show");
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
  return h("li", { class: isNew ? "cs-act cs-new" : "cs-act" }, [
    h("span", { class: "cs-act-dot", "aria-hidden": "true" }),
    h("span", { class: "cs-act-text", text: item.text }),
    item.time ? h("span", { class: "cs-act-time", text: item.time }) : null
  ]);
}
function render3(def) {
  const { record } = def;
  const stages = Array.isArray(record.stages) ? record.stages : [];
  const { el, body } = appWindow(def.app, { title: record.module ?? "Records", className: "cs-crm" });
  const path = stages.length ? h("div", { class: "cs-path" }, stages.map((stage2) => h("span", { dataset: { stage: stage2 }, text: stage2 }))) : null;
  const fields = Object.entries(record.fields).map(([name, value]) => {
    const options = optionsFor(record, name);
    const control = options ? h("div", { class: "cs-select" }, [
      h("span", { class: "cs-val", text: String(value) }),
      h("span", { class: "cs-caret", text: "\u25BE" }),
      h("div", { class: "cs-menu" }, options.map((option) => h("div", { class: "cs-opt", dataset: { value: option }, text: option })))
    ]) : h("div", { class: "cs-val", text: String(value) });
    return h("div", { class: "cs-field", dataset: { field: name } }, [h("label", { text: name }), control]);
  });
  const buttons = buttonsOf(record).map((label, i) => h("button", {
    class: i === 0 ? "cs-btn cs-primary" : "cs-btn",
    type: "button",
    tabindex: "-1",
    dataset: { button: label },
    text: label
  }));
  const toast = h("div", { class: "cs-toast", role: "status" });
  const activity = h("ul", { class: "cs-activity-list" }, (record.activity ?? []).map((item) => activityItem(item)));
  body.append(
    h("div", { class: "cs-crm-head" }, [
      h("div", { class: "cs-crm-type", text: record.type ?? "Record" }),
      h("div", { class: "cs-crm-title", text: record.title }),
      path
    ]),
    h("div", { class: "cs-crm-tabs" }, [h("span", { class: "cs-active", text: "Details" }), h("span", { text: "Activity" }), h("span", { text: "Files" })]),
    h("div", { class: "cs-crm-fields" }, fields),
    h("div", { class: "cs-activity" }, [h("div", { class: "cs-activity-label", text: "Recent activity" }), activity]),
    h("div", { class: "cs-crm-actions" }, buttons)
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
        chip.classList.toggle("cs-done", i < index);
        chip.classList.toggle("cs-current", i === index);
        chip.classList.toggle("cs-won", i === index && index === stages.length - 1);
      });
    },
    setField(name, value) {
      const field = byData(el, "field", name);
      if (!field) return;
      field.querySelector(".cs-val").textContent = value;
      field.classList.add("cs-dirty");
      if (name === stageFieldOf(record)) {
        view.setStage(value);
        changedStage = value;
      }
    },
    save() {
      const changed = el.querySelectorAll(".cs-dirty");
      for (const field of changed) field.classList.remove("cs-dirty");
      if (changed.length) {
        const text = changedStage ? `Stage changed to ${changedStage}` : "Record updated";
        activity.prepend(activityItem({ text, time: "just now" }, true));
        changedStage = null;
      }
    },
    showToast(text) {
      toast.textContent = `\u2713 ${text}`;
      toast.classList.add("cs-show");
    },
    hideToast() {
      toast.classList.remove("cs-show");
    },
    closeMenus() {
      for (const select of el.querySelectorAll(".cs-select.cs-open")) select.classList.remove("cs-open");
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
        const select = view.find("field", ctx.name)?.querySelector(".cs-select");
        if (!select) return;
        await ctx.cursor.moveTo(select, ctx);
        await ctx.cursor.click(ctx);
        select.classList.add("cs-open");
        await ctx.wait(500);
        const option = byData(select, "value", step.value);
        if (option) {
          await ctx.cursor.moveTo(option, ctx);
          option.classList.add("cs-hover");
          await ctx.cursor.click(ctx);
        }
        select.classList.remove("cs-open");
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
        const value = field?.querySelector(".cs-val");
        if (!value) return;
        await ctx.cursor.moveTo(value, ctx);
        await ctx.cursor.click(ctx);
        field.classList.add("cs-editing");
        await typeInto(value, step.text, ctx);
        field.classList.remove("cs-editing");
        field.classList.add("cs-dirty");
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
        button.classList.add("cs-pressed");
        await ctx.cursor.click(ctx);
        button.classList.remove("cs-pressed");
        if (button.classList.contains("cs-primary")) view.save();
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
      h("span", { class: "cs-flow-tabs" }, [h("span", { class: "cs-flow-tab cs-active", text: "Editor" }), h("span", { class: "cs-flow-tab", text: "Executions" })]),
      h("span", { class: "cs-toggle" }, [h("span", { class: "cs-switch" }, h("i")), "Active"]),
      h("span", { class: "cs-save", text: "Save" })
    ],
    className: "cs-flow"
  });
  const lastIndex = def.nodes.length - 1;
  const nodeEls = def.nodes.map((node, i) => {
    const brand = nodeBrand(node, screens);
    const trigger = isTrigger(node, i);
    return h("div", {
      class: trigger ? "cs-node cs-trigger" : "cs-node",
      dataset: { node: node.id },
      style: brand.color ? { "--node": brand.color } : void 0
    }, [
      h("div", { class: "cs-node-tile" }, [
        trigger ? h("span", { class: "cs-node-bolt", "aria-hidden": "true", text: "\u26A1" }) : h("span", { class: "cs-handle cs-handle-in" }),
        h("span", { class: "cs-node-icon", text: brand.icon }),
        i < lastIndex ? h("span", { class: "cs-handle cs-handle-out" }) : null,
        h("span", { class: "cs-node-badge", "aria-hidden": "true" })
      ]),
      h("div", { class: "cs-node-title", text: node.title }),
      node.sub ? h("div", { class: "cs-node-sub", text: node.sub }) : null,
      h("div", { class: "cs-node-meta" })
    ]);
  });
  const wires = s("svg", { class: "cs-wires", "aria-hidden": "true" });
  const status = h("span", { class: "cs-run-status" });
  const canvas = h("div", { class: "cs-canvas" }, [
    h("div", { class: "cs-rail", "aria-hidden": "true" }, [h("i", { class: "cs-rail-on" }), h("i"), h("i"), h("i")]),
    wires,
    h("div", { class: "cs-nodes" }, nodeEls),
    h("div", { class: "cs-canvas-bar" }, [h("span", { class: "cs-test-btn", text: "\u25B6 Test workflow" }), status])
  ]);
  const ndvTitle = h("div", { class: "cs-ndv-title" });
  const ndvInput = h("div", { class: "cs-ndv-col cs-ndv-input" });
  const ndvParams = h("div", { class: "cs-ndv-col cs-ndv-params" });
  const ndv = h("div", { class: "cs-ndv" }, h("div", { class: "cs-ndv-panel" }, [
    h("div", { class: "cs-ndv-head" }, [h("span", { class: "cs-ndv-back", text: "\u2190 Back to canvas" }), ndvTitle]),
    h("div", { class: "cs-ndv-cols" }, [ndvInput, ndvParams])
  ]));
  canvas.append(ndv);
  const outputTitle = h("span", { class: "cs-output-title", text: "Output" });
  const outputCount = h("span", { class: "cs-output-count" });
  const outputData = h("pre");
  const output = h("div", { class: "cs-output" }, [
    h("div", { class: "cs-output-head" }, [
      outputTitle,
      outputCount,
      h("span", { class: "cs-output-tabs" }, [h("span", { text: "Table" }), h("span", { class: "cs-active", text: "JSON" })])
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
      const lit = state.wires.map((wire) => wire.group.classList.contains("cs-lit"));
      const labels = state.wires.map((wire) => wire.label.textContent);
      wires.replaceChildren();
      wires.setAttribute("width", String(canvas.offsetWidth));
      wires.setAttribute("height", String(canvas.offsetHeight));
      state.wires = nodeEls.slice(0, -1).map((nodeEl, i) => {
        const geometry = wireGeometry(canvas, nodeEl.querySelector(".cs-node-tile"), nodeEls[i + 1].querySelector(".cs-node-tile"));
        const label = s("text", { class: "cs-wire-label", x: String(geometry.mid.x), y: String(geometry.mid.y - 10), "text-anchor": "middle" }, labels[i] ?? "");
        const group = s("g", { class: lit[i] ? "cs-wire cs-lit" : "cs-wire" }, [
          s("path", { class: "cs-wire-line", d: geometry.d }),
          s("path", { class: "cs-wire-arrow", d: geometry.arrow }),
          label
        ]);
        wires.append(group);
        return { group, label };
      });
    },
    markRunning(id, running) {
      byData(el, "node", id)?.classList.toggle("cs-running", running);
    },
    markDone(id, ms, result, output2) {
      const nodeEl = byData(el, "node", id);
      if (!nodeEl) return;
      nodeEl.classList.add("cs-ok");
      nodeEl.querySelector(".cs-node-meta").textContent = [typeof ms === "number" ? `${ms} ms` : null, result].filter(Boolean).join(" \xB7 ");
      const wire = state.wires[nodeEls.indexOf(nodeEl)];
      if (wire) {
        const count = itemCount(output2);
        wire.label.textContent = `${count} ${count === 1 ? "item" : "items"}`;
        wire.group.classList.add("cs-lit");
      }
      if (output2 !== void 0) state.outputs[id] = output2;
      state.ran += 1;
      state.totalMs += typeof ms === "number" ? ms : 0;
      status.textContent = state.ran >= def.nodes.length ? `\u2713 Workflow executed successfully \xB7 ${state.totalMs} ms` : `Running \xB7 ${state.ran} of ${def.nodes.length}`;
      status.classList.toggle("cs-ok", state.ran >= def.nodes.length);
    },
    showOutput(id, data) {
      outputTitle.textContent = `Output \xB7 ${nodeById(id)?.title ?? id}`;
      const count = itemCount(data);
      outputCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
      outputData.replaceChildren(jsonNodes(data));
      output.classList.add("cs-open");
    },
    openDetails(id) {
      const node = nodeById(id);
      const index = def.nodes.indexOf(node);
      const brand = nodeBrand(node, screens);
      ndvTitle.replaceChildren(
        appIcon({ icon: brand.icon, name: node.title }, brand.color ?? void 0),
        h("div", {}, [h("div", { class: "cs-ndv-name", text: node.title }), node.sub ? h("div", { class: "cs-ndv-sub", text: node.sub }) : null])
      );
      const upstream = def.nodes.slice(0, index).reverse().find((prev) => state.outputs[prev.id] !== void 0);
      ndvInput.replaceChildren(
        h("div", { class: "cs-ndv-label", text: "Input" }),
        upstream ? h("pre", { class: "cs-ndv-json" }, jsonNodes(state.outputs[upstream.id])) : h("div", { class: "cs-ndv-empty", text: "No input data yet" })
      );
      const params = isObject(node.params) ? Object.entries(node.params) : [];
      ndvParams.replaceChildren(
        h("div", { class: "cs-ndv-label", text: "Parameters" }),
        ...params.map(([key, value]) => h("div", { class: "cs-param" }, [h("span", { text: key }), h("span", { class: "cs-param-val", text: String(value) })]))
      );
      ndv.classList.add("cs-open");
    },
    /** Add an expression field to the open node; returns the parts to animate. */
    addExpression(label) {
      const editor = h("div", { class: "cs-expr-box" });
      const resultLabel = h("div", { class: "cs-ndv-label cs-result-label", text: "Result" });
      const result = h("div", { class: "cs-result" });
      ndvParams.append(h("div", { class: "cs-ndv-label", text: label }), editor, resultLabel, result);
      return { editor, result, resultLabel };
    },
    closeDetails() {
      ndv.classList.remove("cs-open");
    }
  };
}
function expressionNodes(text) {
  const fragment = document.createDocumentFragment();
  for (const token of text.split(/(\{\{[^}]*\}\})/)) {
    if (!token) continue;
    fragment.append(token.startsWith("{{") ? h("span", { class: "cs-tok", text: token }) : token);
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
          await ctx.cursor.moveTo(nodeEl.querySelector(".cs-node-tile"), ctx);
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
        result.classList.add("cs-show");
        resultLabel.classList.add("cs-show");
        await ctx.wait(1500);
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
  return h("span", { class: "cs-avatar", style: { "--avatar": sender.color }, text: sender.icon });
}
function senderOf(value, screens) {
  const app = value.app && hasOwn(screens, value.app) ? screens[value.app].app : null;
  if (app) return { name: app.name, icon: app.icon ?? initials(app.name), color: app.color ?? "var(--cs-accent)", isApp: true };
  return { name: value.from, icon: initials(value.from), color: nameColor(value.from), isApp: false };
}
function messageEl(value, screens, time) {
  const sender = senderOf(value, screens);
  return h("div", { class: "cs-msg" }, [
    avatar(sender),
    h("div", { class: "cs-msg-main" }, [
      h("div", { class: "cs-msg-head" }, [
        h("span", { class: "cs-msg-name", text: sender.name }),
        sender.isApp ? h("span", { class: "cs-badge", text: "APP" }) : null,
        h("span", { class: "cs-msg-time", text: value.time ?? time })
      ]),
      h("div", { class: "cs-msg-text" }, richText(value.text))
    ])
  ]);
}
function render5(def, { screens }) {
  const channels = Array.isArray(def.channels) ? def.channels : [def.channel];
  const list = channels.includes(def.channel) ? channels : [...channels, def.channel];
  const { el, body } = appWindow(def.app, { title: def.workspace, className: "cs-chat" });
  const messages = h("div", { class: "cs-msgs" }, (def.history ?? []).map((message) => messageEl(message, screens, message.time ?? "9:12 AM")));
  body.append(h("div", { class: "cs-chat-main" }, [
    h("div", { class: "cs-chat-side" }, [
      h("div", { class: "cs-side-label", text: "Channels" }),
      ...list.map((name) => h("div", { class: name === def.channel ? "cs-chan cs-active" : "cs-chan", text: `# ${name}` }))
    ]),
    h("div", { class: "cs-chat-pane" }, [
      h("div", { class: "cs-chat-head" }, [
        h("span", { text: `# ${def.channel}` }),
        typeof def.members === "number" ? h("span", { class: "cs-chat-members", text: `${def.members} members` }) : null
      ]),
      messages,
      h("div", { class: "cs-composer", text: `Message #${def.channel}` })
    ])
  ]));
  const last = () => messages.lastElementChild?.querySelector(".cs-msg-main");
  return {
    el,
    find: () => null,
    add(value) {
      const message = messageEl(value, screens, "now");
      message.classList.add("cs-new");
      messages.append(message);
      messages.scrollTop = messages.scrollHeight;
    },
    /** Add a reaction pill to the latest message; returns its counter so the caller can animate it. */
    react(emoji) {
      const main = last();
      if (!main) return null;
      const row2 = main.querySelector(".cs-reacts") ?? main.appendChild(h("div", { class: "cs-reacts" }));
      const pill = h("span", { class: "cs-react" }, [h("span", { text: emoji }), h("span", { class: "cs-react-count", text: "1" })]);
      row2.append(pill);
      messages.scrollTop = messages.scrollHeight;
      return pill.querySelector(".cs-react-count");
    },
    reply(value) {
      const main = last();
      if (!main) return;
      const thread = main.querySelector(".cs-thread") ?? main.appendChild(h("div", { class: "cs-thread" }, h("div", { class: "cs-thread-sum" })));
      thread.append(messageEl(value, screens, "now"));
      const replies = thread.querySelectorAll(".cs-msg").length;
      thread.querySelector(".cs-thread-sum").textContent = `${replies} ${replies === 1 ? "reply" : "replies"}`;
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
  render: render5,
  actions: {
    message: {
      summary: "Post a message to the channel.",
      keys: [],
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
  validate(clip, report) {
    const chapters = Array.isArray(clip.chapters) ? clip.chapters : [];
    const steps = chapters.flatMap((chapter) => Array.isArray(chapter.steps) ? chapter.steps : []);
    if (!steps.some((step) => step && "tool" in step)) report.warn("chapters", 'no "tool" steps: show the assistant calling the connector.');
    if (!steps.some((step) => step && "enter" in step) && (clip.layout ?? "stage") === "stage") {
      report.warn("chapters", 'in the stage layout, bring the target app on with an "enter" step so viewers see the result.');
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
  validate(clip, report) {
    const chapters = Array.isArray(clip.chapters) ? clip.chapters : [];
    const last = chapters[chapters.length - 1];
    if (last && last.focus !== "all") {
      report.warn(`chapters[${chapters.length - 1}].focus`, 'this template ends best on a recap chapter with "focus": "all".');
    }
    const usesPackets = chapters.some((chapter) => Array.isArray(chapter.steps) && chapter.steps.some((step) => step && "packet" in step));
    if (!usesPackets) report.warn("chapters", 'no "packet" steps: add them to show data moving between the apps.');
  }
};

// src/styles/player.css
var player_default = `/* clipscript player \u2014 lives inside the <clip-script> shadow root */

:host {
    display: block;
    width: 100%;
    min-width: 0;
    container-type: inline-size;
}

.cs-mount {
    width: 100%;
}

:host(:fullscreen) {
    display: grid;
    place-items: center;
    padding: 2vh 2vw;
    background: #000;
}

:host(:fullscreen) .cs-player {
    width: min(100%, calc((100vh - 140px) * 16 / 9));
}

/* ---------- palettes ---------- */

.cs-player,
.cs-screen[data-mode="dark"] {
    --cs-stage: #07090d;
    --cs-stage-top: #111624;
    --cs-stage-glow: rgb(34 211 238 / 0.10);
    --cs-stage-grid: rgb(255 255 255 / 0.035);
    --cs-win: #161a22;
    --cs-win-2: #1c212b;
    --cs-win-3: #262c39;
    --cs-line: #2a3141;
    --cs-line-strong: #363f53;
    --cs-canvas: #12151b;
    --cs-wire: #5b6476;
    --cs-node-bg: #232831;
    --cs-node-border: #414a5c;
    --cs-text: #e9ecf2;
    --cs-dim: #9ea7b7;
    --cs-faint: #6d768a;
    --cs-grid: rgb(255 255 255 / 0.07);
    --cs-shadow: 0 30px 70px -20px rgb(0 0 0 / 0.65);
    --cs-ok: #34d399;
    --cs-warn: #f59e0b;
    --cs-control-text: #c9d0dc;

    font-family: var(--cs-font-ui);
    color: var(--cs-text);
    -webkit-font-smoothing: antialiased;
}

.cs-player[data-mode="light"],
.cs-screen[data-mode="light"] {
    --cs-stage: #e4e9f1;
    --cs-stage-top: #f6f8fc;
    --cs-stage-glow: rgb(34 211 238 / 0.14);
    --cs-stage-grid: rgb(15 23 42 / 0.045);
    --cs-win: #ffffff;
    --cs-win-2: #f6f8fb;
    --cs-win-3: #eceff4;
    --cs-line: #e1e5ec;
    --cs-line-strong: #cdd4df;
    --cs-canvas: #f4f5f7;
    --cs-wire: #a3acba;
    --cs-node-bg: #ffffff;
    --cs-node-border: #c5ccd8;
    --cs-text: #1a2030;
    --cs-dim: #5a6475;
    --cs-faint: #8a93a4;
    --cs-grid: rgb(15 23 42 / 0.09);
    --cs-shadow: 0 24px 60px -18px rgb(15 23 42 / 0.25);
    --cs-ok: #10a36e;
    --cs-control-text: #3b4456;
}

/* ---------- stage and world ---------- */

.cs-stage {
    position: relative;
    aspect-ratio: var(--cs-aspect, 16 / 9);
    overflow: hidden;
    border-radius: 16px;
    background:
        radial-gradient(ellipse 70% 55% at 50% 0%, var(--cs-stage-glow), transparent 70%),
        linear-gradient(180deg, var(--cs-stage-top), var(--cs-stage));
    border: 1px solid var(--cs-line);
    box-shadow: 0 40px 100px -50px rgb(0 0 0 / 0.7);
}

.cs-stage::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(var(--cs-stage-grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--cs-stage-grid) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 50% 35%, #000 25%, transparent 78%);
    pointer-events: none;
}

.cs-world {
    position: absolute;
    left: 0;
    top: 0;
    width: 1600px;
    height: 900px;
    transform-origin: 0 0;
    will-change: transform;
}

.cs-instant,
.cs-instant * {
    transition: none !important;
}

/* screens are placed by the template in world units (beats .cs-window's position) */
.cs-world > .cs-screen {
    position: absolute;
    color: var(--cs-text);
    transition: filter 500ms ease;
}

.cs-world > .cs-screen.cs-off {
    visibility: hidden;
}

.cs-world > .cs-screen.cs-dimmed {
    filter: brightness(0.42) saturate(0.7);
}

/* pausing freezes every CSS animation too */
.cs-player.cs-paused *,
.cs-player.cs-paused *::before,
.cs-player.cs-paused *::after {
    animation-play-state: paused !important;
}

/* ---------- app windows ---------- */

.cs-window {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--cs-win);
    border: 1px solid var(--cs-line-strong);
    border-radius: var(--cs-radius);
    box-shadow: var(--cs-shadow), 0 30px 90px -55px var(--app);
    font-size: 15px;
}

.cs-body {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}

.cs-appbar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 50px;
    flex-shrink: 0;
    padding: 0 16px;
    background: var(--cs-win-2);
    border-bottom: 1px solid var(--cs-line);
    box-shadow: inset 0 3px 0 var(--app);
}

.cs-appicon {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 8px;
    background: var(--app, var(--cs-accent));
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.cs-appname {
    font-size: 15px;
    font-weight: 800;
}

.cs-apptitle {
    overflow: hidden;
    color: var(--cs-dim);
    font-size: 13.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cs-apptrail {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    color: var(--cs-dim);
    font-size: 12.5px;
    font-weight: 600;
}

/* ---------- crm-record ---------- */

.cs-crm-head {
    padding: 18px 22px 14px;
}

.cs-crm-type {
    color: var(--cs-dim);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.cs-crm-title {
    overflow-wrap: anywhere;
    margin: 4px 0 14px;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.cs-path {
    display: flex;
    gap: 3px;
}

.cs-path span {
    flex: 1;
    padding: 8px 4px 8px 14px;
    overflow: hidden;
    background: var(--cs-win-3);
    color: var(--cs-dim);
    font-size: 11.5px;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
    transition: background 400ms ease, color 400ms ease;
}

.cs-path span:first-child {
    padding-left: 6px;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%);
}

.cs-path .cs-done {
    background: color-mix(in srgb, var(--app) 30%, var(--cs-win-3));
    color: var(--cs-text);
}

.cs-path .cs-current {
    background: var(--app);
    color: #fff;
}

.cs-path .cs-won {
    background: var(--cs-ok);
    color: #fff;
}

.cs-crm-tabs {
    display: flex;
    gap: 22px;
    padding: 0 22px;
    border-bottom: 1px solid var(--cs-line);
    color: var(--cs-dim);
    font-size: 13.5px;
    font-weight: 650;
}

.cs-crm-tabs span {
    margin-bottom: -1px;
    padding: 10px 0;
    border-bottom: 2px solid transparent;
}

.cs-crm-tabs .cs-active {
    border-bottom-color: var(--app);
    color: var(--cs-text);
}

.cs-crm-head,
.cs-crm-tabs,
.cs-crm-actions {
    flex-shrink: 0;
}

.cs-crm-fields {
    display: grid;
    flex-shrink: 1;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-content: start;
    gap: 14px 20px;
    min-height: 0;
    padding: 16px 22px 10px;
    overflow: hidden;
}

.cs-field label {
    display: block;
    margin-bottom: 4px;
    color: var(--cs-dim);
    font-size: 12px;
    font-weight: 600;
}

.cs-field .cs-val {
    font-size: 15.5px;
    font-weight: 650;
    overflow-wrap: anywhere;
}

.cs-field.cs-dirty label::after {
    content: " \u2022";
    color: var(--app);
}

.cs-field.cs-editing .cs-val {
    border-bottom: 2px solid var(--app);
}

.cs-select {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: var(--cs-win-2);
    border: 1px solid var(--cs-line-strong);
    border-radius: 8px;
    transition: border-color 200ms ease, box-shadow 200ms ease;
}

.cs-select.cs-open {
    border-color: var(--app);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--app) 25%, transparent);
}

.cs-caret {
    color: var(--cs-dim);
}

.cs-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 5;
    padding: 4px;
    background: var(--cs-win);
    border: 1px solid var(--cs-line-strong);
    border-radius: 8px;
    box-shadow: var(--cs-shadow);
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition: opacity 180ms ease, transform 180ms ease;
}

.cs-select.cs-open .cs-menu {
    opacity: 1;
    transform: none;
}

.cs-opt {
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 14px;
}

.cs-opt.cs-hover {
    background: color-mix(in srgb, var(--app) 20%, transparent);
}

.cs-activity {
    flex: 1 1 0;
    min-height: 0;
    padding: 6px 22px 8px;
    overflow: hidden;
}

.cs-activity-label {
    margin: 4px 0 10px;
    color: var(--cs-dim);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.cs-activity-list {
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;
}

.cs-activity-list::before {
    content: "";
    position: absolute;
    left: 5px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--cs-line);
}

.cs-act {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 0 6px 24px;
    font-size: 13.5px;
}

.cs-act-dot {
    position: absolute;
    left: 0;
    top: 10px;
    width: 12px;
    height: 12px;
    background: var(--cs-win);
    border: 2px solid var(--cs-line-strong);
    border-radius: 50%;
}

.cs-act.cs-new {
    animation: cs-in 400ms ease;
}

.cs-act.cs-new .cs-act-dot {
    background: var(--cs-ok);
    border-color: var(--cs-ok);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--cs-ok) 22%, transparent);
}

.cs-act.cs-new .cs-act-text {
    font-weight: 750;
}

.cs-act-time {
    margin-left: auto;
    color: var(--cs-faint);
    font-size: 12px;
    white-space: nowrap;
}

.cs-crm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--cs-line);
    background: var(--cs-win-2);
}

.cs-btn {
    padding: 9px 20px;
    background: var(--cs-win);
    border: 1px solid var(--cs-line-strong);
    border-radius: 8px;
    color: var(--cs-text);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    transition: transform 120ms ease, filter 120ms ease;
}

.cs-btn.cs-primary {
    background: var(--app);
    border-color: var(--app);
    color: #fff;
}

.cs-btn.cs-pressed {
    transform: scale(0.95);
    filter: brightness(1.15);
}

.cs-toast {
    position: absolute;
    bottom: 84px;
    left: 50%;
    z-index: 6;
    padding: 9px 16px;
    background: var(--cs-ok);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: var(--cs-shadow);
    opacity: 0;
    transform: translate(-50%, 8px);
    transition: opacity 250ms ease, transform 250ms ease;
}

.cs-toast.cs-show {
    opacity: 1;
    transform: translate(-50%, 0);
}

/* ---------- flow-canvas (node editor) ---------- */

.cs-flow-tabs {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--cs-win-3);
    border-radius: 8px;
}

.cs-flow-tab {
    padding: 4px 10px;
    border-radius: 6px;
    color: var(--cs-dim);
    font-size: 12px;
}

.cs-flow-tab.cs-active {
    background: var(--cs-win);
    color: var(--cs-text);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
}

.cs-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--cs-text);
}

.cs-switch {
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: 999px;
    background: var(--cs-ok);
}

.cs-switch i {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
}

.cs-save {
    padding: 5px 12px;
    border-radius: 7px;
    background: var(--app);
    color: #fff;
    font-weight: 700;
}

.cs-canvas {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background-color: var(--cs-canvas);
    background-image: radial-gradient(var(--cs-grid) 1.4px, transparent 1.4px);
    background-size: 20px 20px;
}

.cs-rail {
    position: absolute;
    top: 12px;
    left: 10px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cs-rail i {
    width: 26px;
    height: 26px;
    background: var(--cs-win-2);
    border: 1px solid var(--cs-line);
    border-radius: 7px;
}

.cs-rail .cs-rail-on {
    background: color-mix(in srgb, var(--app) 20%, var(--cs-win-2));
    border-color: var(--app);
}

.cs-wires {
    position: absolute;
    inset: 0;
    overflow: visible;
}

.cs-wire-line {
    fill: none;
    stroke: var(--cs-wire);
    stroke-width: 2;
    transition: stroke 400ms ease;
}

.cs-wire-arrow {
    fill: var(--cs-wire);
    transition: fill 400ms ease;
}

.cs-wire-label {
    fill: var(--cs-ok);
    font-family: var(--cs-font-mono);
    font-size: 11px;
    font-weight: 700;
    opacity: 0;
    transition: opacity 300ms ease;
}

.cs-wire.cs-lit .cs-wire-line {
    stroke: var(--cs-ok);
}

.cs-wire.cs-lit .cs-wire-arrow {
    fill: var(--cs-ok);
}

.cs-wire.cs-lit .cs-wire-label {
    opacity: 1;
}

.cs-nodes {
    position: absolute;
    inset: 0 0 60px 44px;
    display: flex;
    align-items: flex-start;
    justify-content: space-evenly;
    padding: 112px 6px 0;
}

.cs-node {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100px;
    text-align: center;
}

.cs-node-tile {
    position: relative;
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    background: var(--cs-node-bg);
    border: 2px solid var(--cs-node-border);
    border-radius: 12px;
    box-shadow: 0 6px 16px rgb(0 0 0 / 0.2);
    transition: border-color 300ms ease, box-shadow 300ms ease;
}

.cs-node.cs-trigger .cs-node-tile {
    border-radius: 38px 12px 12px 38px;
}

.cs-node-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: var(--node, var(--cs-win-3));
    color: var(--node-text, #fff);
    font-family: var(--cs-font-mono);
    font-size: 14px;
    font-weight: 800;
}

.cs-node:not([style]) .cs-node-icon {
    --node-text: var(--cs-text);
}

.cs-node-bolt {
    position: absolute;
    top: 50%;
    left: -24px;
    font-size: 15px;
    transform: translateY(-50%);
}

.cs-handle {
    position: absolute;
    top: 50%;
    background: var(--cs-wire);
    transform: translateY(-50%);
    transition: background 300ms ease;
}

.cs-handle-in {
    left: -6px;
    width: 6px;
    height: 16px;
    border-radius: 2px;
}

.cs-handle-out {
    right: -7px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.cs-node-badge {
    position: absolute;
    right: 5px;
    bottom: 5px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--cs-ok);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    opacity: 0;
    transform: scale(0.4);
    transition: opacity 250ms ease, transform 250ms cubic-bezier(0.3, 1.6, 0.5, 1);
}

.cs-node-badge::after {
    content: "\u2713";
}

.cs-node.cs-running .cs-node-tile {
    border-color: var(--app);
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--app) 22%, transparent);
    animation: cs-pulse 700ms ease-in-out infinite;
}

.cs-node.cs-ok .cs-node-tile {
    border-color: var(--cs-ok);
}

.cs-node.cs-ok .cs-handle {
    background: var(--cs-ok);
}

.cs-node.cs-ok .cs-node-badge {
    opacity: 1;
    transform: none;
}

.cs-node-title,
.cs-node-sub {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.cs-node-title {
    -webkit-line-clamp: 3;
    margin-top: 12px;
    font-size: 13px;
    font-weight: 750;
    line-height: 1.25;
}

.cs-node-sub {
    margin-top: 3px;
    color: var(--cs-dim);
    font-size: 11.5px;
    line-height: 1.3;
}

.cs-node-meta {
    min-height: 16px;
    margin-top: 6px;
    color: var(--cs-ok);
    font-family: var(--cs-font-mono);
    font-size: 11.5px;
}

.cs-canvas-bar {
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

.cs-test-btn {
    padding: 8px 16px;
    border-radius: 8px;
    background: var(--app);
    color: #fff;
    font-size: 13px;
    font-weight: 750;
    box-shadow: 0 8px 20px -8px var(--app);
}

.cs-run-status {
    color: var(--cs-dim);
    font-family: var(--cs-font-mono);
    font-size: 12px;
}

.cs-run-status.cs-ok {
    color: var(--cs-ok);
}

.cs-ndv {
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

.cs-ndv.cs-open {
    opacity: 1;
}

.cs-ndv-panel {
    display: flex;
    flex-direction: column;
    width: calc(100% - 28px);
    height: calc(100% - 28px);
    overflow: hidden;
    background: var(--cs-win);
    border: 1px solid var(--cs-line-strong);
    border-radius: 12px;
    box-shadow: var(--cs-shadow);
    transform: scale(0.96);
    transition: transform 350ms cubic-bezier(0.3, 0.7, 0.2, 1);
}

.cs-ndv.cs-open .cs-ndv-panel {
    transform: none;
}

.cs-ndv-head {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    background: var(--cs-win-2);
    border-bottom: 1px solid var(--cs-line);
}

.cs-ndv-back {
    color: var(--cs-dim);
    font-size: 12px;
    white-space: nowrap;
}

.cs-ndv-title {
    display: flex;
    align-items: center;
    gap: 10px;
}

.cs-ndv-name {
    font-size: 15px;
    font-weight: 800;
}

.cs-ndv-sub {
    color: var(--cs-dim);
    font-size: 12px;
}

.cs-ndv-cols {
    display: grid;
    flex: 1;
    grid-template-columns: 0.85fr 1.15fr;
    min-height: 0;
}

.cs-ndv-col {
    min-width: 0;
    padding: 12px 14px;
    overflow: hidden;
}

.cs-ndv-input {
    background: var(--cs-canvas);
    border-right: 1px solid var(--cs-line);
}

.cs-ndv-label {
    margin: 4px 0 8px;
    color: var(--cs-dim);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.cs-ndv-json {
    margin: 0;
    font-family: var(--cs-font-mono);
    font-size: 11.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
}

.cs-ndv-empty {
    color: var(--cs-faint);
    font-size: 13px;
}

.cs-param {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
    padding: 7px 10px;
    background: var(--cs-win-2);
    border: 1px solid var(--cs-line);
    border-radius: 7px;
    font-size: 12.5px;
}

.cs-param-val {
    font-weight: 650;
}

.cs-expr-box,
.cs-msg-text code {
    font-family: var(--cs-font-mono);
}

.cs-expr-box {
    min-height: 58px;
    padding: 9px 11px;
    background: var(--cs-win-2);
    border: 1px solid var(--cs-line-strong);
    border-radius: 8px;
    font-size: 12.5px;
    line-height: 1.7;
    word-break: break-word;
}

.cs-tok {
    padding: 1px 4px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--cs-ok) 16%, transparent);
    color: var(--cs-ok);
    white-space: nowrap;
}

.cs-result-label {
    opacity: 0;
    transition: opacity 300ms ease;
}

.cs-result {
    opacity: 0;
    transition: opacity 300ms ease;
    padding: 9px 12px;
    background: color-mix(in srgb, var(--cs-ok) 10%, transparent);
    border-left: 3px solid var(--cs-ok);
    border-radius: 6px;
    font-size: 13.5px;
    line-height: 1.45;
}

.cs-result-label.cs-show,
.cs-result.cs-show {
    opacity: 1;
}

.cs-output {
    height: 0;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--cs-win-2);
    border-top: 1px solid transparent;
    transition: height 400ms ease;
}

.cs-output.cs-open {
    height: 156px;
    border-top-color: var(--cs-line);
}

.cs-output-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px 5px;
    color: var(--cs-dim);
    font-size: 12px;
    font-weight: 700;
}

.cs-output-count {
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--cs-ok) 16%, transparent);
    color: var(--cs-ok);
    font-size: 11px;
}

.cs-output-tabs {
    display: flex;
    gap: 2px;
    margin-left: auto;
    padding: 2px;
    background: var(--cs-win-3);
    border-radius: 6px;
    font-weight: 600;
}

.cs-output-tabs span {
    padding: 2px 8px;
    border-radius: 4px;
}

.cs-output-tabs .cs-active {
    background: var(--cs-win);
    color: var(--cs-text);
}

.cs-output pre {
    margin: 0;
    padding: 0 16px 10px;
    font-family: var(--cs-font-mono);
    font-size: 12.5px;
    line-height: 1.5;
    white-space: pre;
}

.j-key { color: var(--cs-accent); }
.j-str { color: var(--cs-ok); }
.j-num { color: var(--cs-warn); }
.j-lit { color: #c084fc; }

/* ---------- team-chat ---------- */

.cs-chat-main {
    display: flex;
    flex: 1;
    min-height: 0;
}

.cs-chat-side {
    width: 136px;
    flex-shrink: 0;
    padding: 12px 8px;
    background: color-mix(in srgb, var(--app) 12%, var(--cs-win-2));
    border-right: 1px solid var(--cs-line);
    font-size: 13.5px;
}

.cs-side-label {
    margin: 4px 8px 6px;
    color: var(--cs-dim);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.cs-chan {
    padding: 6px 8px;
    overflow: hidden;
    border-radius: 6px;
    color: var(--cs-dim);
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cs-chan.cs-active {
    background: var(--app);
    color: #fff;
    font-weight: 750;
}

.cs-chat-pane {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.cs-chat-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid var(--cs-line);
    font-size: 15.5px;
    font-weight: 800;
}

.cs-chat-members {
    color: var(--cs-dim);
    font-size: 12px;
    font-weight: 500;
}

.cs-msgs {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    padding: 12px 16px;
    overflow: hidden;
}

.cs-msgs > :first-child {
    margin-top: auto;
}

.cs-msg {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 10px;
}

.cs-msg.cs-new {
    animation: cs-in 400ms cubic-bezier(0.3, 0.7, 0.2, 1);
}

.cs-avatar {
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

.cs-msg-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.cs-msg-name {
    font-size: 14.5px;
    font-weight: 800;
}

.cs-badge {
    padding: 1px 4px;
    background: var(--cs-win-3);
    border-radius: 3px;
    color: var(--cs-dim);
    font-size: 9.5px;
    font-weight: 800;
}

.cs-msg-time {
    color: var(--cs-faint);
    font-size: 11.5px;
}

.cs-msg-main {
    min-width: 0;
}

.cs-msg-text {
    overflow-wrap: anywhere;
    margin-top: 2px;
    font-size: 14.5px;
    line-height: 1.45;
}

.cs-msg-text code {
    font-size: 13px;
}

.cs-reacts {
    display: flex;
    gap: 6px;
    margin-top: 7px;
}

.cs-react {
    display: inline-flex;
    gap: 5px;
    padding: 2px 9px;
    background: color-mix(in srgb, var(--cs-accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--cs-accent) 50%, transparent);
    border-radius: 999px;
    font-size: 13.5px;
    animation: cs-pop 350ms cubic-bezier(0.3, 1.6, 0.5, 1);
}

.cs-react-count {
    font-family: var(--cs-font-mono);
    font-weight: 700;
}

.cs-thread {
    margin-top: 9px;
    padding-left: 10px;
    border-left: 2px solid var(--cs-line);
}

.cs-thread-sum {
    margin-bottom: 6px;
    color: var(--cs-accent);
    font-size: 12.5px;
    font-weight: 800;
}

.cs-thread .cs-msg {
    grid-template-columns: 26px 1fr;
    animation: cs-in 400ms ease;
}

.cs-thread .cs-avatar {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    font-size: 10px;
}

.cs-composer {
    margin: 10px 16px 16px;
    padding: 11px 13px;
    border: 1px solid var(--cs-line);
    border-radius: 10px;
    color: var(--cs-faint);
    font-size: 14px;
}

/* ---------- cursor and packets ---------- */

.cs-cursor {
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

.cs-cursor.cs-visible {
    opacity: 1;
}

.cs-cursor path {
    fill: #fff;
    stroke: #111;
    stroke-width: 1.4;
    stroke-linejoin: round;
    filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.4));
}

.cs-cursor-ring {
    position: absolute;
    left: -12px;
    top: -12px;
    width: 32px;
    height: 32px;
    border: 2px solid var(--cs-accent);
    border-radius: 50%;
    opacity: 0;
}

.cs-cursor.cs-click .cs-cursor-ring {
    animation: cs-ring 450ms ease-out;
}

.cs-links {
    position: absolute;
    inset: 0;
    z-index: 40;
    overflow: visible;
    pointer-events: none;
}

.cs-link {
    fill: none;
    stroke: var(--cs-accent);
    stroke-width: 3.5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 6px var(--cs-accent));
}

.cs-link.cs-trail {
    stroke-opacity: 0.3;
    filter: none;
}

.cs-link.cs-lit {
    stroke-opacity: 1;
    stroke-dasharray: 10 10 !important;
    filter: drop-shadow(0 0 6px var(--cs-accent));
    animation: cs-flow 900ms linear infinite;
}

.cs-packet {
    fill: #fff;
    filter: drop-shadow(0 0 10px var(--cs-accent));
}

/* ---------- overlays ---------- */

.cs-progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 60;
    height: 3px;
    background: rgb(255 255 255 / 0.08);
}

.cs-progress i {
    display: block;
    width: calc(var(--p, 0) * 100%);
    height: 100%;
    background: var(--cs-accent);
    box-shadow: 0 0 10px var(--cs-accent);
    transition: width 400ms ease;
}

.cs-subtitle {
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

.cs-subtitle.cs-show {
    opacity: 1;
    transform: translate(-50%, 0);
}

.cs-intro,
.cs-endcard {
    position: absolute;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--cs-stage) 82%, transparent);
    opacity: 0;
    pointer-events: none;
    transition: opacity 500ms ease;
    backdrop-filter: blur(10px);
}

.cs-endcard {
    background: color-mix(in srgb, var(--cs-stage) 40%, transparent);
    backdrop-filter: none;
}

.cs-endcard-inner {
    padding: 1.6em 2.2em;
    background: color-mix(in srgb, var(--cs-win) 94%, transparent);
    border: 1px solid var(--cs-line-strong);
    border-radius: 16px;
    box-shadow: var(--cs-shadow);
}

.cs-endcard.cs-show.cs-instant li {
    opacity: 1;
    animation: none;
}

.cs-intro.cs-show,
.cs-endcard.cs-show {
    opacity: 1;
    pointer-events: auto;
}

.cs-intro-inner,
.cs-endcard-inner {
    max-width: 74%;
    text-align: center;
}

.cs-intro-chain {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.6em;
    margin-bottom: 1.1em;
    font-size: clamp(10px, 1.6cqi, 18px);
    font-weight: 700;
}

.cs-intro-app {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
}

.cs-intro-app .cs-appicon {
    width: 2.1em;
    height: 2.1em;
    border-radius: 0.55em;
    font-size: 0.8em;
}

.cs-intro-arrow {
    color: var(--cs-accent);
}

.cs-intro-title {
    font-size: clamp(18px, 4.2cqi, 50px);
    font-weight: 850;
    letter-spacing: -0.03em;
    line-height: 1.05;
}

.cs-intro-overview {
    margin-top: 0.7em;
    color: var(--cs-dim);
    font-size: clamp(11px, 1.75cqi, 20px);
    line-height: 1.45;
}

.cs-endcard-label {
    margin-bottom: 0.8em;
    color: var(--cs-accent);
    font-family: var(--cs-font-mono);
    font-size: clamp(10px, 1.3cqi, 15px);
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.cs-endcard ol {
    margin: 0 0 1.2em;
    padding: 0;
    list-style: none;
    font-size: clamp(11px, 1.75cqi, 20px);
    text-align: left;
}

.cs-endcard li {
    display: flex;
    gap: 0.6em;
    padding: 0.32em 0;
    opacity: 0;
}

.cs-endcard.cs-show li {
    animation: cs-in 450ms ease forwards;
    animation-delay: calc(var(--i, 0) * 160ms + 200ms);
}

.cs-check {
    color: var(--cs-ok);
    font-weight: 800;
}

.cs-poster {
    display: none;
}

.cs-player.cs-has-poster .cs-poster {
    position: absolute;
    inset: 0;
    z-index: 75;
    display: block;
}

.cs-poster ::slotted(*) {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cs-bigplay {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 80;
    width: 76px;
    height: 76px;
    padding-left: 6px;
    background: var(--cs-accent);
    border: none;
    border-radius: 50%;
    color: #031016;
    font-size: 28px;
    cursor: pointer;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 40px color-mix(in srgb, var(--cs-accent) 60%, transparent);
}

/* ---------- controls ---------- */

.cs-controls {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    margin-top: 1rem;
}

.cs-chapters {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 0.6rem;
}

.cs-ch {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.7rem 0.15rem 0;
    background: none;
    border: none;
    border-top: 2px solid var(--cs-line);
    color: var(--cs-control-text);
    font-family: var(--cs-font-mono);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
    opacity: 0.75;
    transition: color 300ms ease, border-color 300ms ease, opacity 300ms ease;
}

.cs-ch:hover,
.cs-ch.cs-done,
.cs-ch.cs-active {
    opacity: 1;
}

.cs-ch.cs-done {
    border-top-color: color-mix(in srgb, var(--cs-accent) 50%, transparent);
}

.cs-ch.cs-active {
    border-top-color: var(--cs-accent);
    box-shadow: 0 -6px 12px -8px var(--cs-accent);
}

.cs-ch-num {
    color: var(--cs-accent);
}

.cs-ch:focus-visible,
.cs-cbtn:focus-visible,
.cs-bigplay:focus-visible {
    outline: 2px solid var(--cs-accent);
    outline-offset: 3px;
}

.cs-now {
    display: none;
    color: var(--cs-control-text);
    font-family: var(--cs-font-mono);
    font-size: 12.5px;
}

.cs-buttons {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.7rem;
}

.cs-cbtn {
    padding: 0.45rem 0.85rem;
    background: none;
    border: 1px solid var(--cs-line);
    border-radius: 6px;
    color: var(--cs-accent);
    font-family: var(--cs-font-mono);
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
}

.cs-cbtn:hover {
    border-color: var(--cs-accent);
}

.cs-disclaimer {
    margin: 0.8rem 0 0;
    color: var(--cs-control-text);
    font-family: var(--cs-font-mono);
    font-size: 12px;
    opacity: 0.75;
}

.cs-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}

.cs-error {
    padding: 14px 16px;
    background: #2a1215;
    border: 1px solid #f87171;
    border-radius: 10px;
    color: #fecaca;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 13px;
    line-height: 1.5;
}

.cs-error ul {
    margin: 8px 0 0;
    padding-left: 18px;
}

@container (max-width: 600px) {
    .cs-player[data-aspect="auto"] .cs-stage {
        aspect-ratio: 4 / 5;
    }
}

@container (max-width: 640px) {
    .cs-endcard-inner {
        max-width: 90%;
        padding: 0.9em 1.1em;
    }

    .cs-endcard ol {
        margin-bottom: 0.6em;
        font-size: clamp(10px, 3.1cqi, 15px);
    }

    .cs-endcard li {
        padding: 0.18em 0;
    }

    .cs-controls {
        flex-direction: column;
        gap: 0.6rem;
    }

    .cs-chapters {
        width: 100%;
    }

    .cs-ch-label {
        display: none;
    }

    .cs-now {
        display: block;
    }

    .cs-stage {
        border-radius: 10px;
    }
}

/* ---------- motion ---------- */

@keyframes cs-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
}

@keyframes cs-pop {
    from { transform: scale(0.5); }
    to { transform: none; }
}

@keyframes cs-ring {
    0% { opacity: 1; transform: scale(0.4); }
    100% { opacity: 0; transform: scale(1.4); }
}

@keyframes cs-pulse {
    50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--cs-accent) 12%, transparent); }
}

@keyframes cs-flow {
    to { stroke-dashoffset: -20; }
}

@media (prefers-reduced-motion: reduce) {
    .cs-ndv,
    .cs-ndv-panel,
    .cs-output,
    .cs-world > .cs-screen {
        transition: none;
    }

    .cs-link.cs-lit,
    .cs-node.cs-running .cs-node-tile {
        animation: none;
    }
}
`;

// src/core/constants.js
var VERSION = true ? "0.2.0" : "0.0.0-dev";
var STOP = /* @__PURE__ */ Symbol("clipscript.stop");
var WORLD = Object.freeze({ width: 1600, height: 900 });

// src/core/design.js
var MODES = ["dark", "light", "auto"];
var ASPECTS = ["auto", "16:9", "4:5", "1:1"];
var DEFAULT_DESIGN = Object.freeze({
  mode: "dark",
  accent: "#22d3ee",
  font: Object.freeze({ ui: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', mono: '"JetBrains Mono", ui-monospace, Menlo, monospace' }),
  radius: 12,
  camera: Object.freeze({ zoom: 1.35, speed: 1 }),
  pace: 1,
  aspect: "auto",
  intro: true,
  subtitles: true,
  endcard: true
});
var LIMITS = Object.freeze({
  radius: [0, 24],
  zoom: [1, 2.5],
  speed: [0.25, 3],
  pace: [0.25, 3]
});
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
      speed: number(camera.speed, DEFAULT_DESIGN.camera.speed, LIMITS.speed)
    },
    pace: number(d.pace, DEFAULT_DESIGN.pace, LIMITS.pace),
    aspect: ASPECTS.includes(d.aspect) ? d.aspect : DEFAULT_DESIGN.aspect,
    intro: d.intro !== false,
    subtitles: d.subtitles !== false,
    endcard: d.endcard !== false
  };
}
function applyDesign(root, design) {
  root.dataset.mode = design.mode === "auto" ? "dark" : design.mode;
  root.dataset.aspect = design.aspect;
  const tokens = {
    "--cs-accent": design.accent,
    "--cs-font-ui": design.font.ui,
    "--cs-font-mono": design.font.mono,
    "--cs-radius": `${design.radius}px`
  };
  if (design.aspect !== "auto") tokens["--cs-aspect"] = design.aspect.replace(":", " / ");
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}

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

// src/core/camera.js
var PADDING = { screen: 28, part: 90, all: 24 };
var MOVE_MS = 900;
var FRAME = { top: 0.05, bottom: 0.18, side: 0.03 };
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
  const limit = (rect.kind === "part" ? maxZoom * 1.6 : maxZoom) * factor;
  const scale = clamp(fit * factor, 0.15, limit) * k;
  return {
    x: stage2.width / 2 - (rect.x + rect.w / 2) * scale,
    y: stage2.height * (FRAME.top + frameHeight / 2) - (rect.y + rect.h / 2) * scale,
    scale
  };
}
var Camera = class {
  /**
   * @param {HTMLElement} stage  visible viewport
   * @param {HTMLElement} world  1600×900 layer that gets transformed
   * @param {(target: string) => object|null} resolve  target → world rect
   * @param {{maxZoom: number, speed: number}} options
   */
  constructor(stage2, world, resolve, { maxZoom, speed }) {
    this.stage = stage2;
    this.world = world;
    this.resolve = resolve;
    this.maxZoom = maxZoom;
    this.speed = speed;
    this.target = "all";
    this.zoom = 1;
    this.current = null;
  }
  goal() {
    const rect = this.resolve(this.target);
    const width = this.stage.clientWidth;
    const height = this.stage.clientHeight;
    if (!rect || !width || !height) return null;
    return frameFor(rect, { width, height }, { zoom: this.zoom, maxZoom: this.maxZoom });
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
   * Move to a target. Animated on the timeline when a step context is given.
   * @param {string} target
   * @param {{zoom?: number, ctx?: object, instant?: boolean}} [options]
   */
  async focus(target, { zoom, ctx, instant = false } = {}) {
    this.target = target;
    this.zoom = clampZoom(zoom);
    const goal = this.goal();
    if (!goal) return;
    const from = this.current;
    if (instant || !ctx || ctx.fast || !from) {
      this.set(goal);
      return;
    }
    await ctx.animate(MOVE_MS / this.speed, (progress) => {
      const t = easeInOut(progress);
      this.set({
        x: from.x + (goal.x - from.x) * t,
        y: from.y + (goal.y - from.y) * t,
        scale: from.scale + (goal.scale - from.scale) * t
      });
    });
  }
};

// src/core/cursor.js
var MOVE_MS2 = 650;
var CLICK_MS = 260;
var Cursor = class {
  constructor(world) {
    this.world = world;
    this.el = h("div", { class: "cs-cursor", "aria-hidden": "true" }, [
      s("svg", { viewBox: "0 0 24 24", width: "26", height: "26" }, [
        s("path", { d: "M4 2l15 9.5-6.6 1.4L16 21l-3 1.5-3.7-8.2L4 18.6z" })
      ]),
      h("span", { class: "cs-cursor-ring" })
    ]);
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
    this.el.classList.add("cs-visible");
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
    this.el.classList.remove("cs-click");
    void this.el.offsetWidth;
    this.el.classList.add("cs-click");
    await ctx.wait(CLICK_MS);
  }
  hide() {
    this.el.classList.remove("cs-visible");
  }
};

// src/core/links.js
var PACKET_MS = 1100;
var Links = class _Links {
  constructor(world) {
    this.trails = [];
    this.svg = s("svg", {
      class: "cs-links",
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
    const path = s("path", { class: "cs-link", d: _Links.path(a, b) });
    const dot = s("circle", { class: "cs-packet", r: "7" });
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
    path.classList.add("cs-trail");
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
    for (const trail of this.trails) trail.path.classList.add("cs-lit");
  }
};

// src/core/steps.js
var GENERIC_ACTIONS = ["focus", "caption", "wait", "packet", "enter", "exit", "front"];
var GENERIC_KEYS = {
  focus: ["zoom"],
  caption: [],
  wait: [],
  packet: [],
  enter: ["from"],
  exit: ["to"],
  front: ["dim"]
};
var DIRECTIONS = ["left", "right", "top", "bottom", "fade", "zoom"];
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
var FRONT_MS = 450;
var ENDCARD_DELAY_MS = 2200;
var MOTION = {
  left: { dx: -260, dy: 0, scale: 1 },
  right: { dx: 260, dy: 0, scale: 1 },
  top: { dx: 0, dy: -200, scale: 1 },
  bottom: { dx: 0, dy: 200, scale: 1 },
  fade: { dx: 0, dy: 0, scale: 1 },
  zoom: { dx: 0, dy: 0, scale: 0.88 }
};
var easeOut = (t) => 1 - (1 - t) ** 3;
var prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
var Player = class {
  /**
   * @param {HTMLElement} host   element that receives events (the <clip-script> element)
   * @param {HTMLElement} mount  container to render into (inside the shadow root)
   * @param {object} clip        a clip script that passed validateClip()
   * @param {object} [options]   autoplay ('view' | 'none'), controls, chapter, mode, endcard, reducedMotion
   */
  constructor(host, mount2, clip, options = {}) {
    this.host = host;
    this.clip = clip;
    this.options = { autoplay: "view", controls: true, chapter: null, mode: null, endcard: true, ...options };
    this.design = resolveDesign(clip.design);
    if (MODES.includes(this.options.mode)) this.design.mode = this.options.mode;
    this.template = getTemplate(clip.template);
    this.chapters = clip.chapters;
    this.timeline = new Timeline();
    this.reduced = this.options.reducedMotion ?? prefersReducedMotion();
    this.state = "idle";
    this.userPaused = false;
    this.autoPaused = false;
    this.pendingStart = null;
    this.readyChapter = null;
    this.views = /* @__PURE__ */ Object.create(null);
    this.actionNames = new Set(Object.values(clip.screens).flatMap((screen) => Object.keys(getSurface(screen.surface).actions)));
    this.buildFrame(mount2);
    this.watchColorScheme();
    this.buildScene();
    this.start();
  }
  // ---------- structure ----------
  buildFrame(mount2) {
    const { clip } = this;
    this.world = h("div", { class: "cs-world" });
    this.progressBar = h("i");
    this.subtitle = h("span");
    this.intro = this.buildIntro();
    this.endcard = this.buildEndcard();
    this.stage = h("div", {
      class: "cs-stage",
      role: "group",
      "aria-roledescription": "product film",
      "aria-label": clip.title
    }, [
      this.world,
      h("div", { class: "cs-progress", "aria-hidden": "true" }, this.progressBar),
      this.intro,
      h("div", { class: "cs-subtitle", "aria-hidden": "true" }, this.subtitle),
      this.endcard,
      h("div", { class: "cs-poster" }, h("slot", { name: "poster" }))
    ]);
    this.root = h("div", { class: "cs-player" }, [
      this.stage,
      this.options.controls ? this.buildControls() : null,
      clip.disclaimer ? h("p", { class: "cs-disclaimer", text: clip.disclaimer }) : null,
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
      i ? h("span", { class: "cs-intro-arrow", text: "\u2192" }) : null,
      h("span", { class: "cs-intro-app" }, [
        h("span", { class: "cs-appicon", style: { "--app": app.color ?? this.design.accent }, text: app.icon ?? initials(app.name) }),
        h("span", { text: app.name })
      ])
    ]);
    return h("div", { class: "cs-intro", "aria-hidden": "true" }, h("div", { class: "cs-intro-inner" }, [
      h("div", { class: "cs-intro-chain" }, chain),
      h("div", { class: "cs-intro-title", text: this.clip.title }),
      h("div", { class: "cs-intro-overview", text: this.clip.story.overview })
    ]));
  }
  buildEndcard() {
    const steps = this.clip.story.workflow ?? [];
    const replay = h("button", { class: "cs-cbtn", type: "button", text: "Replay \u21BA" });
    replay.addEventListener("click", () => this.replay());
    return h("div", { class: "cs-endcard" }, h("div", { class: "cs-endcard-inner" }, [
      h("div", { class: "cs-endcard-label", text: "How it works" }),
      h("ol", {}, steps.map((text, i) => h("li", { style: { "--i": i } }, [h("span", { class: "cs-check", text: "\u2713" }), h("span", { text })]))),
      replay
    ]));
  }
  buildControls() {
    this.chapterButtons = this.chapters.map((chapter, i) => {
      const button = h("button", { class: "cs-ch", type: "button", "aria-label": `Chapter ${i + 1}: ${chapter.title}` }, [
        h("span", { class: "cs-ch-num", text: String(i + 1).padStart(2, "0") }),
        h("span", { class: "cs-ch-label", text: chapter.title })
      ]);
      button.addEventListener("click", () => this.goTo(i));
      return button;
    });
    this.nowLabel = h("div", { class: "cs-now", "aria-live": "polite" });
    this.playButton = h("button", { class: "cs-cbtn", type: "button", text: "Play \u25B6" });
    this.playButton.addEventListener("click", () => this.toggle());
    const replay = h("button", { class: "cs-cbtn", type: "button", text: "Replay \u21BA" });
    replay.addEventListener("click", () => this.replay());
    const fullscreen = h("button", { class: "cs-cbtn", type: "button", "aria-label": "Full screen", text: "\u26F6" });
    fullscreen.addEventListener("click", () => this.toggleFullscreen());
    const chapters = h("div", { class: "cs-chapters", style: { "--n": this.chapters.length } }, this.chapterButtons);
    return h("div", { class: "cs-controls" }, [chapters, this.nowLabel, h("div", { class: "cs-buttons" }, [this.playButton, replay, fullscreen])]);
  }
  /** Screen-reader transcript: the story and the script, read in order. */
  buildTranscript() {
    const { story } = this.clip;
    return h("div", { class: "cs-sr" }, [
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
      view.el.classList.add("cs-screen");
      view.el.classList.toggle("cs-off", def.hidden === true);
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
    this.cursor = new Cursor(this.world);
    this.camera = new Camera(this.stage, this.world, (target) => this.targetRect(target), {
      maxZoom: this.design.camera.zoom,
      speed: this.design.camera.speed
    });
  }
  /** World rect for "all" (screens on stage), a screen id, or "screen.part:name". */
  targetRect(target) {
    const entries = Object.values(this.views);
    if (target === "all") {
      const onStage = entries.filter((entry2) => entry2.visible);
      const set = onStage.length ? onStage : entries;
      const x = Math.min(...set.map((v) => v.rect.x));
      const y = Math.min(...set.map((v) => v.rect.y));
      const right = Math.max(...set.map((v) => v.rect.x + v.rect.w));
      const bottom = Math.max(...set.map((v) => v.rect.y + v.rect.h));
      return { x, y, w: right - x, h: bottom - y, kind: "all" };
    }
    const parsed = parseSelector(target);
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
    this.root.classList.add("cs-has-poster");
    const play = h("button", { class: "cs-bigplay", type: "button", "aria-label": `Play ${this.clip.title}`, text: "\u25B6" });
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
    this.root.classList.remove("cs-has-poster", "cs-ended");
    this.setState(isStatic ? "static" : "playing");
    this.buildScene();
    this.intro.classList.remove("cs-show");
    this.endcard.classList.remove("cs-show");
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
    return { ...this.timeline.context(id, { fast, pace: this.design.pace }), cursor: this.cursor, links: this.links, player: this };
  }
  async playIntro(id) {
    const ctx = this.context(id, false);
    this.intro.classList.add("cs-show");
    await ctx.wait(INTRO_MS);
    this.intro.classList.remove("cs-show");
    await ctx.wait(500);
  }
  async playChapter(index, ctx) {
    const chapter = this.chapters[index];
    this.setChapter(index);
    this.setProgress(index / this.chapters.length);
    this.setSubtitle(chapter.narration ?? "");
    if (chapter.focus) await this.camera.focus(chapter.focus, { zoom: chapter.zoom, ctx });
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
    if (action === "focus") await this.camera.focus(value, { zoom: step.zoom, ctx });
    else if (action === "caption") {
      this.setSubtitle(value);
      await ctx.wait(CAPTION_MS);
    } else if (action === "wait") await ctx.wait(value);
    else if (action === "packet") await this.links.packet(value.from, value.to, (target) => this.targetRect(target), ctx);
    else if (action === "enter") await this.enterScreen(value, step.from ?? "right", ctx);
    else if (action === "exit") await this.exitScreen(value, step.to ?? "left", ctx);
    else if (action === "front") {
      this.frontScreen(value, step.dim !== false);
      await ctx.wait(FRONT_MS);
    }
  }
  async runSurfaceStep(step, action, ctx) {
    const target = resolveStepScreen(step, action, this.views);
    if (target.error) return;
    const entry = this.views[target.key];
    const selector = typeof step[action] === "string" ? parseSelector(step[action]) : null;
    await entry.surface.actions[action].run(entry.view, step, { ...ctx, name: selector?.part ? selector.name : null, screens: this.views });
  }
  // ---------- screens on and off stage ----------
  setScreenMotion(el, motion, amount) {
    const remaining = 1 - amount;
    const scale = motion.scale + (1 - motion.scale) * amount;
    el.style.setProperty("transform", `translate(${motion.dx * remaining}px, ${motion.dy * remaining}px) scale(${scale})`);
    el.style.setProperty("opacity", String(amount));
  }
  async enterScreen(key, from, ctx) {
    const entry = this.views[key];
    if (!entry || entry.visible) return;
    const { el } = entry.view;
    const motion = MOTION[from] ?? MOTION.right;
    entry.visible = true;
    this.raise(entry);
    this.setScreenMotion(el, motion, 0);
    el.classList.remove("cs-off");
    await ctx.animate(ENTER_MS, (progress) => this.setScreenMotion(el, motion, easeOut(progress)));
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
    entry.surface.relayout?.(entry.view);
  }
  async exitScreen(key, to, ctx) {
    const entry = this.views[key];
    if (!entry || !entry.visible) return;
    const { el } = entry.view;
    const motion = MOTION[to] ?? MOTION.left;
    await ctx.animate(EXIT_MS, (progress) => this.setScreenMotion(el, motion, 1 - easeOut(progress)));
    entry.visible = false;
    el.classList.add("cs-off");
    el.classList.remove("cs-dimmed");
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
  }
  frontScreen(key, dimOthers) {
    const entry = this.views[key];
    if (!entry) return;
    this.raise(entry);
    for (const other of Object.values(this.views)) other.view.el.classList.toggle("cs-dimmed", dimOthers && other !== entry && other.visible);
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
      this.endcard.classList.toggle("cs-instant", isStatic);
      this.endcard.classList.add("cs-show");
    }
    this.root.classList.add("cs-ended");
    this.chapterButtons?.forEach((button) => {
      button.classList.add("cs-done");
      button.classList.remove("cs-active");
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
    this.root.classList.toggle("cs-paused", state === "paused");
    if (this.playButton) this.playButton.textContent = state === "playing" ? "Pause \u275A\u275A" : "Play \u25B6";
  }
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else this.host.requestFullscreen?.();
  }
  setChapter(index) {
    this.chapterButtons?.forEach((button, i) => {
      button.classList.toggle("cs-done", i < index);
      button.classList.toggle("cs-active", i === index);
      button.setAttribute("aria-current", i === index ? "step" : "false");
    });
    if (this.nowLabel) this.nowLabel.textContent = `${String(index + 1).padStart(2, "0")} \xB7 ${this.chapters[index].title}`;
    this.emit("chapter", { index, title: this.chapters[index].title });
  }
  setSubtitle(text) {
    this.subtitle.textContent = text;
    this.subtitle.parentElement.classList.toggle("cs-show", Boolean(text) && this.design.subtitles);
  }
  setProgress(fraction) {
    this.progressBar.style.setProperty("--p", String(fraction));
  }
  emit(name, detail) {
    this.host.dispatchEvent(new CustomEvent(`clipscript:${name}`, { detail, bubbles: true, composed: true }));
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
var TOP_KEYS = ["$schema", "clipscript", "title", "template", "layout", "disclaimer", "story", "design", "screens", "chapters"];
var STORY_KEYS = ["overview", "description", "audience", "workflow"];
var DESIGN_KEYS = ["mode", "accent", "font", "radius", "camera", "pace", "aspect", "intro", "subtitles", "endcard"];
var CHAPTER_KEYS = ["title", "narration", "focus", "zoom", "steps"];
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
      checkUnknownKeys(report, design.camera, ["zoom", "speed"], "design.camera");
      checkRange(report, design.camera.zoom, "design.camera.zoom", LIMITS.zoom);
      checkRange(report, design.camera.speed, "design.camera.speed", LIMITS.speed);
    }
  }
  for (const flag of ["intro", "subtitles", "endcard"]) {
    if (design[flag] !== void 0 && typeof design[flag] !== "boolean") report.error(`design.${flag}`, "must be true or false.");
  }
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
function checkSelector(report, selector, path, screens, { allowAll = false, part: requiredPart } = {}) {
  if (allowAll && selector === "all") return { all: true };
  const parsed = parseSelector(selector);
  if (!parsed) {
    report.error(path, `"${selector}" is not a valid target. Use "screen" or "screen.part:name", e.g. "crm.field:Stage".`);
    return null;
  }
  const keys = Object.keys(screens);
  if (!hasOwn(screens, parsed.screen)) {
    report.error(path, `screen "${parsed.screen}" is not defined in "screens".`, suggest(parsed.screen, keys) ?? `Defined screens: ${keys.join(", ")}.`);
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
  constructor(screens) {
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
    const parsed = checkSelector(report, value, `${path}.focus`, screens, { allowAll: true });
    if (parsed?.screen && !stage2.visible.has(parsed.screen)) report.warn(`${path}.focus`, `the camera points at "${parsed.screen}" while it's off stage; add an "enter" step first.`);
    checkRange(report, step.zoom, `${path}.zoom`, LIMITS.zoom);
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
  checkUnknownKeys(report, step, [action, "on", ...spec.keys ?? []], path);
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
function checkChapters(report, chapters, screens, rawScreens) {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    report.error("chapters", "is required: an array of chapters, each with a title, narration, focus, and steps.");
    return;
  }
  if (chapters.length > MAX_CHAPTERS) report.warn("chapters", `has ${chapters.length} chapters; films read best with 3\u20136.`);
  const names = actionNames(screens);
  const stage2 = new StageState(screens);
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
      const parsed = checkSelector(report, chapter.focus, `${path}.focus`, screens, { allowAll: true });
      if (parsed?.screen && !stage2.visible.has(parsed.screen) && !enters(chapter, parsed.screen)) {
        report.warn(`${path}.focus`, `"${parsed.screen}" is off stage when this chapter starts.`);
      }
    }
    checkRange(report, chapter.zoom, `${path}.zoom`, LIMITS.zoom);
    if (!Array.isArray(chapter.steps) || chapter.steps.length === 0) {
      report.error(`${path}.steps`, "must be a non-empty array of steps.");
      return;
    }
    chapter.steps.forEach((step, j) => checkStep(report, step, `${path}.steps[${j}]`, screens, rawScreens, names, stage2));
  });
}
var enters = (chapter, key) => Array.isArray(chapter.steps) && isObject(chapter.steps[0]) && chapter.steps[0].enter === key;
function validateClip(clip) {
  const report = new Report();
  if (!isObject(clip)) {
    report.error("", "A clip script must be a JSON object.");
    return { ok: false, errors: report.errors, warnings: report.warnings };
  }
  checkUnknownKeys(report, clip, TOP_KEYS, "");
  if (clip.clipscript === void 0) report.warn("clipscript", `is missing; add "clipscript": "${FORMAT_VERSION}" so future versions can read this file.`);
  else if (clip.clipscript !== FORMAT_VERSION) report.error("clipscript", `format "${clip.clipscript}" isn't supported; this version reads "${FORMAT_VERSION}".`);
  requireString(report, clip.title, "title");
  optionalString(report, clip.disclaimer, "disclaimer");
  if (clip.layout !== void 0 && !LAYOUTS.includes(clip.layout)) {
    report.error("layout", `must be one of ${LAYOUTS.join(", ")}.`, suggest(clip.layout, LAYOUTS));
  }
  checkStory(report, clip.story);
  checkDesign(report, clip.design);
  const template = typeof clip.template === "string" ? getTemplate(clip.template) : void 0;
  if (!template) {
    report.error("template", `"${clip.template}" is not a known template. Known: ${templateNames().join(", ")}.`, suggest(clip.template, templateNames()));
  }
  const screens = checkScreens(report, clip.screens);
  if (template) {
    const present = new Set(Object.values(screens).map((screen) => screen.def.surface));
    for (const needed of template.requires) {
      if (!present.has(needed)) report.error("screens", `template "${template.name}" needs a "${needed}" screen.`);
    }
    template.validate?.(clip, report);
  }
  checkChapters(report, clip.chapters, screens, isObject(clip.screens) ? clip.screens : {});
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
  return h("div", { class: "cs-error", role: "alert" }, [
    h("strong", { text: `clipscript: ${source} can't be played` }),
    h("ul", {}, errors.map((item) => h("li", { text: `${item.path || "(root)"}: ${item.message}${item.hint ? ` ${item.hint}` : ""}` })))
  ]);
}
function parseChapter(value) {
  if (value === null || value === "") return null;
  if (/^\d+$/.test(value)) return Number(value);
  console.warn(`clipscript: chapter="${value}" must be a whole number (0 is the first chapter); ignoring it.`);
  return null;
}
function defineElement(tagName = "clip-script") {
  if (typeof customElements === "undefined" || customElements.get(tagName)) return;
  class ClipScriptElement extends HTMLElement {
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
      const mount2 = h("div", { class: "cs-mount" });
      shadow.replaceChildren(mount2);
      this.#player?.destroy();
      this.#player = null;
      const source = src ?? "this clip";
      try {
        const clip = await this.#readClip(src);
        if (token !== this.#loadToken || !clip) return;
        const result = validateClip(clip);
        if (!result.ok) {
          console.warn(formatReport(result, source));
          mount2.replaceChildren(errorPanel(result.errors, source));
          this.dispatchEvent(new CustomEvent("clipscript:error", { detail: { result }, bubbles: true, composed: true }));
          return;
        }
        this.#player = new Player(this, mount2, clip, this.#options());
      } catch (error) {
        if (token !== this.#loadToken) return;
        mount2.replaceChildren(errorPanel([{ path: "", message: error.message }], source));
        this.dispatchEvent(new CustomEvent("clipscript:error", { detail: { error }, bubbles: true, composed: true }));
      }
    }
  }
  customElements.define(tagName, ClipScriptElement);
}

// src/index.js
for (const surface of [crm_record_default, flow_canvas_default, team_chat_default, ai_chat_default2, browser_app_default2]) registerSurface(surface);
for (const template of [trigger_automation_notify_default, assistant_connector_default]) registerTemplate(template);
function mount(target, clip, options = {}) {
  const tagName = options.tagName ?? "clip-script";
  defineElement(tagName);
  const element = document.createElement(tagName);
  if (options.autoplay === "none") element.setAttribute("autoplay", "none");
  if (options.controls === false) element.setAttribute("controls", "none");
  if (options.endcard === false) element.setAttribute("endcard", "none");
  if (options.reducedMotion) element.setAttribute("reduced-motion", "");
  if (Number.isInteger(options.chapter)) element.setAttribute("chapter", String(options.chapter));
  if (options.mode) element.setAttribute("mode", options.mode);
  if (typeof clip === "string") element.setAttribute("src", clip);
  else element.clip = clip;
  target.append(element);
  return element;
}
if (typeof window !== "undefined") defineElement();
export {
  ASPECTS,
  DEFAULT_DESIGN,
  DIRECTIONS,
  FORMAT_VERSION,
  GENERIC_ACTIONS,
  LAYOUTS,
  MODES,
  Player,
  SLOTS,
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
