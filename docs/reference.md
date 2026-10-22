# Cueflick reference

Everything beyond the [README](../README.md): the clip format, screens, characters, the camera, layouts, the element and JavaScript API, the CLI, extending the library, and development.

- [Install options](#install-options)
- [The element](#the-element)
- [JavaScript API](#javascript-api)
- [The clip format](#the-clip-format)
- [Screens](#screens)
- [Characters](#characters)
- [Camera and motion](#camera-and-motion)
- [Templates and layouts](#templates-and-layouts)
- [CLI](#cli)
- [Extending](#extending)
- [Safety and accessibility](#safety-and-accessibility)
- [Development](#development)

## Install options

| Way | How |
|---|---|
| npm | `npm install cueflick`, then `import 'cueflick'` |
| CDN | `<script src="https://unpkg.com/cueflick/dist/cueflick.min.js" defer></script>` (defines `window.Cueflick`) |
| From GitHub | `npm install github:priyabratasahoo21/cueflick` |

In React and other frameworks, import `cueflick` once and use `<cue-flick>` like any HTML tag. TypeScript types, including TSX support, ship in `index.d.ts`.

## The element

```html
<cue-flick src="film.clip.json"></cue-flick>
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

The clip can also be inline: `<cue-flick><script type="application/json">{ … }</script></cue-flick>`. Content with `slot="poster"` (for example an `<img>`) shows before playback and when JavaScript is off.

**Methods:** `play()`, `pause()`, `replay()`, `goTo(index)`. **Properties:** `clip` (set a clip object), `player` (`state`, `readyChapter`). **Events:** `cueflick:chapter`, `cueflick:ready`, `cueflick:ended`, `cueflick:error`.

## JavaScript API

```js
import { mount, validate, formatReport } from 'cueflick';

const film = mount(document.querySelector('#demo'), clipObject, { mode: 'light', autoplay: 'none' });
film.addEventListener('cueflick:ended', () => console.log('done'));

const result = validate(clipObject);
if (!result.ok) console.log(formatReport(result));
```

Other exports: `defineElement`, `registerSurface`, `registerTemplate`, `catalog`, `Player`, `resolveDesign`, `DEFAULT_DESIGN`, `layoutFor`, `frameFor`, `LAYOUTS`, `SLOTS`, `GENERIC_ACTIONS`, `DIRECTIONS`, `EASES`, `EASE_NAMES`, `SHAPES`, `PATHS`, `SPAWN_EFFECTS`, `LEAVE_EFFECTS`, `h`, `s`, `richText`, `version`.

## The clip format

```json
{
  "cueflick": "1",
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
| `design` | `mode` (dark, light, auto), `aspect` (auto, 16:9, 4:5, 1:1; auto goes portrait on phones), `accent`, `font` (`ui`, `mono`), `radius`, `camera` (`zoom` 1–2.5, `speed` 0.25–3, `ease`, `follow`, `punch`), `pace` (0.25–3), `cursor` (false for touch-first films), `backdrop` (a colour or two), and the `intro`, `subtitles`, `endcard` switches. |
| `screens` | The apps on stage, keyed by an id. Every screen takes `surface`, `app` (`name`, `color`, `icon`), and optionally `mode` (light or dark), `hidden`, `place` (a slot or `{ x, y, w, h }`), and `width`. |
| `actors` | Optional characters (spheres, blocks, pills, rings), keyed by an id. See [Characters](#characters). |
| `chapters` | The script. Each has a `title`, a `narration` line (the subtitle), a camera `focus` (a screen, a part, an actor, or `all`), an optional `zoom`, `duration`, `ease`, `async`, `backdrop`, and `steps`. |

**Targets** name a screen, a part of one, an actor, or one piece of an actor group: `crm`, `crm.field:Stage`, `chat.file:q3-chart`, `phone.row:sunny`, `sunny`, `tiles.piece:2`.

**Steps for any film:** `focus`, `pan`, `dive`, `blur`, `caption`, `wait`, `packet` (data flying between two targets), `enter` (`from`: left, right, top, bottom, fade, zoom, pop, drop, launch, flip), `exit` (`to`, also minimize), `front` (raise a screen and dim the others), `backdrop`, and the character steps `spawn`, `move`, `leave`, and `confetti`.

A [JSON Schema](../schema/cueflick.schema.json) gives editors autocomplete; add `"$schema": "https://unpkg.com/cueflick/schema/cueflick.schema.json"` to a clip.

## Screens

| Surface | Shows | Steps |
|---|---|---|
| `crm-record` | A CRM record: stage path, fields, activity, buttons | `choose`, `type`, `click`, `toast` |
| `flow-canvas` | A node-based automation editor | `run`, `open`, `expression` |
| `team-chat` | A team chat channel | `message`, `react`, `reply` |
| `ai-chat` | An AI assistant (`look`: warm or neutral) with connectors and `@file` references | `connect`, `prompt` (with `draft`), `send`, `hover`, `think`, `tool`, `respond` |
| `browser-app` | A web app in a browser window, with a data table | `add`, `status`, `select`, `toast` |
| `phone` | A phone: lock screen or a settings list (`screen`), cards in glass, light, or dark (`material`) | `notify`, `ask`, `summarize`, `pool`, `toggle`, `tap` |

File previews in `ai-chat` are drawn from a few numbers and strings (a chart, a page, a sheet), or show a real image with `src`: an `https://` URL, a path inside the clip's folder, or a `data:image/…` URL. `export` embeds images that sit beside the clip.

The phone's `corner` (screen corner radius) and `poolInset` (the Screen Pool's gap) are yours to set; the Screen Pool's own corners always follow as `corner − poolInset`, so they stay concentric.

Every field and step is documented in [`llms.txt`](../llms.txt), and `npx cueflick catalog` prints them.

## Characters

```json
"actors": {
  "sunny": { "shape": "sphere", "color": "#ffc83d", "size": 120, "finish": "glass", "at": { "x": 690, "y": 400 } },
  "tiles": { "shape": "block", "size": 190, "count": 4, "columns": 4, "colors": ["#ff6b5e", "#3fa9ff"], "labels": ["Dinner at 8", "2 parcels"] }
}
```

| Key | Meaning |
|---|---|
| `shape` | `sphere`, `block`, `pill`, or `ring` |
| `size`, `at` | Size and start point, in world units (the world is 1600×900) |
| `finish` | `gloss` (default), `matte`, or `glass` |
| `squash` | How soft it is, 0–2 (spheres 1, blocks 0.4) |
| `count`, `columns`, `gap`, `colors`, `labels` | A group of pieces in a grid, each with its own colour and label |

Steps: `{ "spawn": ["sunny"], "effect": "pop" }` (pop, drop, rise, fade), `{ "move": "sunny", "to": "phone", "perch": true, "path": "bounce", "bounces": 2, "bounciness": 0.36 }` (hop, bounce, roll, slide, float; `to` is a target or `{ x, y }`, `offset` nudges it), `{ "leave": "sunny", "effect": "pop" }` (pop, fall, shrink, fade), and `{ "confetti": "phone", "count": 140 }`. A new move on an actor takes over from one still running.

## Camera and motion

| Setting | Effect |
|---|---|
| `design.camera.follow` | The camera eases toward what each step acts on, and keeps a caret in view while typing |
| `design.camera.punch` | A quick zoom toward each click: `true`, an amount like `1.3`, or `{ "amount", "hold" }` |
| `ease`, `duration` | Per chapter, per camera step, and per enter or exit: smooth, snappy, linear, gentle, spring |
| `"async": true` | Steps start while the camera is still moving |
| `{ "pan": … }` | Slide to a target, or by `{ x, y }` |
| `{ "dive": "coral", "into": "#06352f" }` | Zoom through a target until it fills the frame, changing the backdrop behind it; the next focus pulls back out |
| `{ "blur": "phone" }` | Keep one screen or actor sharp and blur the rest; `{ "blur": false }` clears it |

## Templates and layouts

| Template | Story | Default layout |
|---|---|---|
| `trigger-automation-notify` | A record changes, an automation runs, a team is notified | `row` |
| `assistant-connector` | An AI assistant uses a connector to act in another app | `stage` |
| `assistant-files` | Ask an assistant about your files, with `@` references and previews | `stage` |
| `phone-feature` | A phone feature in a motion-graphics style, with characters | `stage` |

| Layout | Arrangement |
|---|---|
| `row` | Screens side by side |
| `stage` | One large screen at a time; use `enter` and `exit` |
| `desktop` | Overlapping windows; use `front` |

Slots for `place`: `left`, `center`, `right`, `wide-left`, `wide-right`, `full`, `pip`, `pip-left`.

## CLI

```text
cueflick validate <file...> [--json]       check clips; errors include a path and a hint
cueflick preview <file> [--port 4321]      play locally; reloads on every save
cueflick snapshot <file> [--out dir]       one PNG per chapter (--poster poster.png for a cover image)
cueflick render <file> [--out film.mp4]    record to .mp4, .gif, or .webm (films are silent)
cueflick export <file> [--out film.html]   one self-contained HTML file
cueflick init [dir] [--ai]                 starter clip, plus guidance for AI agents
cueflick catalog [--json]                  templates, surfaces, parts, and actions
cueflick guide                             print the AI authoring guide
cueflick demo                              serve the bundled examples

Options: --width <px>, --mode dark|light|auto, --offline (no web fonts)
```

- Node 20 or newer.
- `snapshot` and `render` need Playwright (`npm install -D playwright && npx playwright install chromium`).
- MP4 and GIF output also need `ffmpeg`.
- `render` records in real time.
- The local servers listen on `127.0.0.1` only.

## Extending

Add an app screen with `registerSurface({ name, render, parts, actions, styles, keys })`, or a story pattern with `registerTemplate({ name, layout, requires })`. Build screen DOM with the exported `h()` helper, which only sets text and rejects event-handler attributes and unsafe URLs. Actions get `ctx.wait`, `ctx.animate`, `ctx.cursor`, and `ctx.camera` (`look`, `back`, `track`). [The AI guide](../llms.txt) walks through a complete screen type, and [`src/surfaces/browser-app.js`](../src/surfaces/browser-app.js) is a small real one.

## Safety and accessibility

- Clip content is only ever inserted as text, never parsed as HTML; there's no `eval` and no inline `style` attribute, so it works under a strict Content-Security-Policy.
- Images in a clip must be `https://`, a path inside the clip's folder, or an embedded raster image (never SVG). The preview server serves nothing outside the clip's folder.
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
