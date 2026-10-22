# clipscript

**Product films for software, written as data.**

Describe a workflow across app screens in one JSON file (a *clip script*), and clipscript plays it as a video-like film on any web page: real UI elements, a moving camera, a simulated cursor, data flying between apps, subtitles, and chapters. The same file can also be rendered to MP4 or GIF, or exported as a single shareable HTML page.

It's built so that Claude, Codex, or any AI coding agent can write the clip for you from a plain-English request, then check its own work.

```html
<script src="https://unpkg.com/clipscript/dist/clipscript.min.js" defer></script>
<clip-script src="my-film.clip.json"></clip-script>
```

## Examples

Both films below are a single JSON file each, played by the library. All apps, companies, and people in them are made up.

### Closed deal → automation → team chat

Three screens side by side: a CRM record, a node-based automation workflow, and a team chat, joined by data packets.

[![Closed deal to team channel](https://raw.githubusercontent.com/priyabratasahoo21/clipscript/main/media/closed-won.gif)](https://github.com/priyabratasahoo21/clipscript/blob/main/media/closed-won.mp4)

[Watch the MP4](https://github.com/priyabratasahoo21/clipscript/blob/main/media/closed-won.mp4) · [Read the clip](https://github.com/priyabratasahoo21/clipscript/blob/main/examples/closed-won/closed-won.clip.json)

### AI assistant → connector → accounting app

One screen at a time: an AI assistant (light mode) uses a connector to create and send invoices, then the accounting app (dark mode, in a browser window) slides in as the chat leaves.

[![Invoices sent from a chat](https://raw.githubusercontent.com/priyabratasahoo21/clipscript/main/media/claw-fastbooks.gif)](https://github.com/priyabratasahoo21/clipscript/blob/main/media/claw-fastbooks.mp4)

[Watch the MP4](https://github.com/priyabratasahoo21/clipscript/blob/main/media/claw-fastbooks.mp4) · [Read the clip](https://github.com/priyabratasahoo21/clipscript/blob/main/examples/claw-fastbooks/claw-fastbooks.clip.json)

## Who it's for

| Who | What they use it for |
|---|---|
| **Teams building developer tools and SaaS** | Product films on landing pages, docs, READMEs, and changelogs, with no screen recording. When the UI changes, edit the JSON instead of re-recording. |
| **Integration and automation builders** | Showing how data moves across apps end to end: APIs, connectors, workflow automations. |
| **Agencies and consultants** | Explaining a proposed workflow to a client before it's built. |
| **Sales engineers** | A film per prospect: swap the names, data, and steps, then render. |
| **Docs writers and trainers** | Lightweight, accessible walkthroughs (about 35 KB gzipped) instead of 10 MB screen recordings. |
| **Anyone, with an AI assistant** | Describe the film; Claude or Codex writes the clip, validates it, and checks the snapshots. |

**Not for:** interactive tours of your real, live app (use a capture tool), high-end motion graphics (use a video framework), or anything that needs real data or logins. clipscript only ever shows the scripted illustration.

## Install

```sh
npm install clipscript
```

```js
import 'clipscript';              // defines <clip-script>
// or: import { mount, validate } from 'clipscript';
```

No build step? Use the standalone script from a CDN:

```html
<script src="https://unpkg.com/clipscript/dist/clipscript.min.js" defer></script>
```

You can also install straight from this repo: `npm install github:priyabratasahoo21/clipscript`.

## Use it

**Plain HTML**

```html
<clip-script src="closed-won.clip.json"></clip-script>
```

**React, Vue, Svelte, Angular:** import `clipscript` once, then use the element like any HTML tag. Types for TSX are included.

```jsx
import 'clipscript';
export const Demo = () => <clip-script src="/films/closed-won.clip.json" />;
```

**From JavaScript**

```js
import { mount } from 'clipscript';
const film = mount(document.querySelector('#demo'), clipObject, { mode: 'light' });
film.addEventListener('clipscript:ended', () => console.log('done'));
```

The clip can also be inline: `<clip-script><script type="application/json">{ … }</script></clip-script>`.

**Attributes:** `src`, `autoplay="none"` (show a play button), `controls="none"`, `chapter="2"` (show one chapter's end state), `mode="light"`, `endcard="none"`, `reduced-motion`. Content with `slot="poster"` (for example an `<img>`) shows before playback and when JavaScript is off.

**Element API:** `play()`, `pause()`, `replay()`, `goTo(index)`, the `clip` property, and the events `clipscript:chapter`, `clipscript:ready`, `clipscript:ended`, and `clipscript:error`.

## Make a film with Claude or Codex

1. **Set up once** in your project:

   ```sh
   npm install --save-dev clipscript
   npx clipscript init --ai
   ```

   This creates `film.clip.json` and adds a short section to `CLAUDE.md` and `AGENTS.md` that points the agent at the authoring guide, [`llms.txt`](llms.txt).

2. **Ask in plain English:**

   > Make a clipscript film with the assistant-connector template: our assistant uses its "Fastbooks" connector to create three invoices, then the Fastbooks web app slides in showing them. Use made-up companies. Save it as `invoices.clip.json`, then validate and snapshot it and fix anything that looks wrong.

3. **The agent writes the clip, validates it, and looks at the snapshots.** Errors point at the exact spot and suggest a fix:

   ```text
   ✗ chapters[2].steps[0].connector: "fastbook" isn't one of this screen's connectors.
       hint: Did you mean "fastbooks"?
   ```

4. **Watch it, then share it** (next section).

## Share a film

| Where | How |
|---|---|
| On a website | `<clip-script src="film.clip.json">` plus the script tag |
| As one file | `npx clipscript export film.clip.json` → a self-contained `film.html` (player and clip inside). Email it, attach it, or host it anywhere; it opens with a double-click. |
| As a video | `npx clipscript render film.clip.json --out film.mp4` (or `.gif`, `.webm`) for email, chat, social posts, or a README |
| As images | `npx clipscript snapshot film.clip.json` → one PNG per chapter |

## How a clip is built

```json
{
  "clipscript": "1",
  "title": "Invoices sent from a chat",
  "template": "assistant-connector",
  "layout": "stage",
  "story": { "overview": "…", "description": "…", "audience": "…", "workflow": ["…"] },
  "design": { "mode": "dark", "accent": "#e07a5f", "camera": { "zoom": 1.25 } },
  "screens": {
    "claw":  { "surface": "ai-chat", "mode": "light", "app": { "name": "Claw" }, "connectors": [ … ] },
    "books": { "surface": "browser-app", "mode": "dark", "hidden": true, "app": { "name": "Fastbooks" }, "columns": [ … ], "rows": [ … ] }
  },
  "chapters": [
    { "title": "Ask Claw", "narration": "Jordan asks Claw to invoice October's jobs.", "focus": "claw",
      "steps": [ { "prompt": "Create invoices for October's completed jobs." }, { "think": 1400 } ] },
    { "title": "In Fastbooks", "narration": "The new invoices are already there.", "focus": "books",
      "steps": [ { "enter": "books", "from": "right" }, { "exit": "claw", "to": "left" }, { "add": "books.row:1042" } ] }
  ]
}
```

| Part | What it does |
|---|---|
| `story` | What the film is about. Feeds the intro card, the end card ("How it works"), and the screen-reader transcript. |
| `design` | `mode` (dark, light, or auto), `aspect` (auto, 16:9, 4:5, or 1:1; auto goes portrait on phones), `accent`, `font`, `radius`, `camera` (`zoom`, `speed`), and `pace`. |
| `screens` | The apps on stage. Each can set its own `mode`, start `hidden`, and take a `place` (a slot or an exact position). |
| `chapters` | The script. Each has a `narration` line shown as the subtitle, a camera `focus`, and its `steps`. |
| `layout` | `row` (side by side), `stage` (one screen at a time), or `desktop` (overlapping windows). |

### Screens

| Surface | Shows | Steps |
|---|---|---|
| `crm-record` | A CRM record: stage path, fields, activity, buttons | `choose`, `type`, `click`, `toast` |
| `flow-canvas` | A node-based automation editor | `run`, `open`, `expression` |
| `team-chat` | A team chat channel | `message`, `react`, `reply` |
| `ai-chat` | An AI assistant with connectors | `connect`, `prompt`, `think`, `tool`, `respond` |
| `browser-app` | A web app in a browser window, with a data table | `add`, `status`, `select`, `toast` |
| *any screen* | | `focus`, `caption`, `wait`, `packet`, `enter`, `exit`, `front` |

### Templates

| Template | Story | Default layout |
|---|---|---|
| `trigger-automation-notify` | A record changes, an automation runs, a team is notified | `row` |
| `assistant-connector` | An AI assistant uses a connector to act in another app | `stage` |

The full step reference is in [`llms.txt`](llms.txt), and `npx clipscript catalog` prints it. A [JSON Schema](schema/clipscript.schema.json) gives editors autocomplete.

## CLI

```text
clipscript validate <file...> [--json]       check clip scripts
clipscript preview <file> [--port 4321]      play locally; reloads on every save
clipscript snapshot <file> [--out dir]       one PNG per chapter (--poster poster.png for a cover image)
clipscript render <file> [--out film.mp4]    record to .mp4, .gif, or .webm
clipscript export <file> [--out film.html]   one self-contained HTML file
clipscript init [dir] [--ai]                 starter clip, plus guidance for AI agents
clipscript catalog [--json]                  templates, surfaces, parts, actions
clipscript guide                             print the AI authoring guide
clipscript demo                              serve the bundled examples
```

`snapshot` and `render` use [Playwright](https://playwright.dev), an optional peer dependency (`npm install --save-dev playwright && npx playwright install chromium`). MP4 and GIF output also need `ffmpeg` on your PATH. `render` records in real time. Everything else needs only Node 20+. The local servers listen on `127.0.0.1` only and reject requests addressed to any other host.

## Extend it

Add your own app screen with `registerSurface({ name, render, parts, actions, styles })`, or a story pattern with `registerTemplate({ name, layout, requires })`. Build screen DOM with the exported `h()` helper, which only sets text and rejects event-handler attributes and unsafe URLs. See [`src/surfaces/browser-app.js`](src/surfaces/browser-app.js) for a complete example.

## Safety and accessibility

- **Clip content is only ever inserted as text,** never parsed as HTML; a lint rule forbids `innerHTML`. There's no `eval`, no inline `style` attributes, and styles are applied through constructable stylesheets, so it works under a strict Content-Security-Policy.
- **Styles live in a shadow root,** so they can't leak into or out of your page.
- **Zero runtime dependencies.**
- **Accessible:** keyboard-operable controls, a screen-reader transcript built from the story and the script, and a static, no-motion view for people who prefer reduced motion.

## Browser support

Current Chrome, Edge, Firefox, and Safari 16.4+. It's tested in Chromium, WebKit, and Firefox on every change.

## Develop

```sh
npm install
npm run build          # dist/clipscript.mjs, dist/clipscript.js, dist/clipscript.min.js
npm run lint           # ESLint
npm test               # validator, layout, camera, and schema tests (node:test)
npm run test:browser   # Chromium, WebKit, and Firefox: every chapter, desktop and phone widths, security checks
npm run demo           # http://127.0.0.1:4321/examples/
```

## License

[MIT](LICENSE)
