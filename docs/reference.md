# ClipScript reference

Everything beyond the [README](../README.md): the clip format, screens, layouts, the element and JavaScript API, the CLI, extending the library, and development.

- [Install options](#install-options)
- [The element](#the-element)
- [JavaScript API](#javascript-api)
- [The clip format](#the-clip-format)
- [Screens](#screens)
- [Templates and layouts](#templates-and-layouts)
- [CLI](#cli)
- [Extending](#extending)
- [Safety and accessibility](#safety-and-accessibility)
- [Development](#development)

## Install options

| Way | How |
|---|---|
| npm | `npm install clipscript`, then `import 'clipscript'` |
| CDN | `<script src="https://unpkg.com/clipscript/dist/clipscript.min.js" defer></script>` (defines `window.ClipScript`) |
| From GitHub | `npm install github:priyabratasahoo21/clipscript` |

In React and other frameworks, import `clipscript` once and use `<clip-script>` like any HTML tag. TypeScript types, including TSX support, ship in `index.d.ts`.

## The element

```html
<clip-script src="film.clip.json"></clip-script>
```

| Attribute | Effect |
|---|---|
| `src` | URL of a `.clip.json` file |
| `autoplay="none"` | Show a play button instead of starting when scrolled into view |
| `controls="none"` | Hide the chapter bar and buttons |
| `chapter="2"` | Show the end state of chapter 3 (0-based) without animation |
| `mode="light"` | Override `design.mode` |
| `endcard="none"` | Skip the "How it works" end card |
| `reduced-motion` | Force the static, no-motion view |

The clip can also be inline: `<clip-script><script type="application/json">{ … }</script></clip-script>`. Content with `slot="poster"` (for example an `<img>`) shows before playback and when JavaScript is off.

**Methods:** `play()`, `pause()`, `replay()`, `goTo(index)`. **Properties:** `clip` (set a clip object), `player` (`state`, `readyChapter`). **Events:** `clipscript:chapter`, `clipscript:ready`, `clipscript:ended`, `clipscript:error`.

## JavaScript API

```js
import { mount, validate, formatReport } from 'clipscript';

const film = mount(document.querySelector('#demo'), clipObject, { mode: 'light', autoplay: 'none' });
film.addEventListener('clipscript:ended', () => console.log('done'));

const result = validate(clipObject);
if (!result.ok) console.log(formatReport(result));
```

Other exports: `defineElement`, `registerSurface`, `registerTemplate`, `catalog`, `Player`, `resolveDesign`, `DEFAULT_DESIGN`, `layoutFor`, `frameFor`, `LAYOUTS`, `SLOTS`, `GENERIC_ACTIONS`, `DIRECTIONS`, `h`, `s`, `richText`, `version`.

## The clip format

```json
{
  "clipscript": "1",
  "title": "Invoices sent from a chat",
  "template": "assistant-connector",
  "layout": "stage",
  "disclaimer": "Illustration · all names are made up",
  "story": { "overview": "…", "description": "…", "audience": "…", "workflow": ["…"] },
  "design": { "mode": "dark", "aspect": "auto", "accent": "#e07a5f", "camera": { "zoom": 1.25, "speed": 1 }, "pace": 1 },
  "screens": {
    "claw":  { "surface": "ai-chat", "mode": "light", "app": { "name": "Claw" } },
    "books": { "surface": "browser-app", "mode": "dark", "hidden": true, "app": { "name": "Fastbooks" } }
  },
  "chapters": [
    { "title": "Ask Claw", "narration": "Jordan asks Claw to invoice October's jobs.", "focus": "claw",
      "steps": [ { "prompt": "Create invoices for October's completed jobs." }, { "think": 1400 } ] }
  ]
}
```

| Part | What it does |
|---|---|
| `story` | What the film is about. Feeds the intro card, the end card, and the screen-reader transcript. `overview` is required. |
| `design` | `mode` (dark, light, auto), `aspect` (auto, 16:9, 4:5, 1:1; auto goes portrait on phones), `accent`, `font` (`ui`, `mono`), `radius`, `camera` (`zoom` 1–2.5, `speed` 0.25–3), `pace` (0.25–3), and the `intro`, `subtitles`, `endcard` switches. |
| `screens` | The apps on stage, keyed by an id. Every screen takes `surface`, `app` (`name`, `color`, `icon`), and optionally `mode` (light or dark), `hidden`, `place` (a slot or `{ x, y, w, h }`), and `width`. |
| `chapters` | The script. Each has a `title`, a `narration` line (the subtitle), a camera `focus` (a screen, a part, or `all`), an optional `zoom`, and `steps`. |

**Targets** name a screen or a part of one: `crm`, `crm.field:Stage`, `crm.button:Save`, `flow.node:trigger`, `claw.connector:fastbooks`, `books.row:1042`.

**Steps for any screen:** `focus`, `caption`, `wait`, `packet` (data flying between two targets), `enter` (`from`: left, right, top, bottom, fade, zoom), `exit` (`to`), and `front` (raise a screen and dim the others).

A [JSON Schema](../schema/clipscript.schema.json) gives editors autocomplete; add `"$schema": "https://unpkg.com/clipscript/schema/clipscript.schema.json"` to a clip.

## Screens

| Surface | Shows | Steps |
|---|---|---|
| `crm-record` | A CRM record: stage path, fields, activity, buttons | `choose`, `type`, `click`, `toast` |
| `flow-canvas` | A node-based automation editor | `run`, `open`, `expression` |
| `team-chat` | A team chat channel | `message`, `react`, `reply` |
| `ai-chat` | An AI assistant with connectors | `connect`, `prompt`, `think`, `tool`, `respond` |
| `browser-app` | A web app in a browser window, with a data table | `add`, `status`, `select`, `toast` |

Every field and step is documented in [`llms.txt`](../llms.txt), and `npx clipscript catalog` prints them.

## Templates and layouts

| Template | Story | Default layout |
|---|---|---|
| `trigger-automation-notify` | A record changes, an automation runs, a team is notified | `row` |
| `assistant-connector` | An AI assistant uses a connector to act in another app | `stage` |

| Layout | Arrangement |
|---|---|
| `row` | Screens side by side |
| `stage` | One large screen at a time; use `enter` and `exit` |
| `desktop` | Overlapping windows; use `front` |

Slots for `place`: `left`, `center`, `right`, `wide-left`, `wide-right`, `full`, `pip`, `pip-left`.

## CLI

```text
clipscript validate <file...> [--json]       check clip scripts; errors include a path and a hint
clipscript preview <file> [--port 4321]      play locally; reloads on every save
clipscript snapshot <file> [--out dir]       one PNG per chapter (--poster poster.png for a cover image)
clipscript render <file> [--out film.mp4]    record to .mp4, .gif, or .webm
clipscript export <file> [--out film.html]   one self-contained HTML file
clipscript init [dir] [--ai]                 starter clip, plus guidance for AI agents
clipscript catalog [--json]                  templates, surfaces, parts, and actions
clipscript guide                             print the AI authoring guide
clipscript demo                              serve the bundled examples

Options: --width <px>, --mode dark|light|auto, --offline (no web fonts)
```

- Node 20 or newer.
- `snapshot` and `render` need Playwright (`npm install -D playwright && npx playwright install chromium`).
- MP4 and GIF output also need `ffmpeg`.
- `render` records in real time.
- The local servers listen on `127.0.0.1` only.

## Extending

Add an app screen with `registerSurface({ name, render, parts, actions, styles, keys })`, or a story pattern with `registerTemplate({ name, layout, requires })`. Build screen DOM with the exported `h()` helper, which only sets text and rejects event-handler attributes and unsafe URLs. [`src/surfaces/browser-app.js`](../src/surfaces/browser-app.js) is a complete example.

## Safety and accessibility

- Clip content is only ever inserted as text, never parsed as HTML; there's no `eval` and no inline `style` attribute, so it works under a strict Content-Security-Policy.
- Styles live in a shadow root, so they can't leak into or out of your page.
- Zero runtime dependencies.
- Keyboard-operable controls, a screen-reader transcript from the story and script, and a static view for people who prefer reduced motion.
- Works in current Chrome, Edge, Firefox, and Safari 16.4+.

## Development

```sh
npm install
npm run build          # dist/: ES module, standalone script, minified script
npm run lint
npm test               # validator, layout, camera, and schema tests
npm run test:browser   # end-to-end tests in Chromium, WebKit, and Firefox
npm run demo           # http://127.0.0.1:4321/examples/
```
