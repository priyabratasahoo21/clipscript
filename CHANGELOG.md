# Changelog

## 0.3.0

**Renamed:** the project is now **Cueflick**: package and CLI `cueflick`, element `<cue-flick>`, global `window.Cueflick`, events `cueflick:*`, and clips start with `"cueflick": "1"`.

### Added
- **Camera direction:** `follow` (the camera eases toward each step's target and keeps a caret in view while typing), moves that run alongside the action (`"async": true`), punch-in on clicks, per-move `duration` and `ease` (smooth, snappy, linear, gentle, spring), `pan`, `dive` (zoom through a sphere or card into the next scene, with `into` for the new backdrop), and `blur` (rack focus: one screen or actor sharp, the rest soft).
- **Window effects:** `pop`, `drop`, `launch`, `minimize`, and `flip`, alongside the slides, fade, and zoom.
- **Characters (`actors`):** spheres, blocks, pills, and rings, alone or in labelled groups. They `spawn` (pop, drop, rise, fade), `move` (hop, bounce, roll, slide, float), `perch` on anything, and `leave`. Squash and stretch, contact shadows, a rolling surface, and a glossy, matte, or glass finish. A new move on an actor takes over smoothly, even mid-air.
- **Director controls:** `bounces`, `bounciness`, `squash`, `finish`, and the phone's `corner`, `poolInset`, and `glow`, each with a default that already looks right.
- **`confetti`**, a **`backdrop`** colour per film, chapter, or step, and **`cursor: false`** for touch-first films.
- **`phone` surface:** a lock screen where notifications drop in, the assistant (Iris) lights the screen edge, listens (`ask`), and folds the pile into one summary (`summarize`), and the Screen Pool grows into live activities (`pool`: music, listening). An app screen (`"screen": "list"`) with switches (`toggle`; `"to": false` switches one off) and taps (`tap`, with a touch ripple). Cards in liquid glass, light, or dark.
- **`ai-chat` file references:** a `neutral` look, `files`, `@id` references while typing (with a picker), highlighted names, `hover` previews (drawn charts, pages, and sheets, or a real image with `src`) that the camera can zoom into, and `"draft": true` with a later `send`.
- **Templates:** `assistant-files` and `phone-feature`.
- **Examples:** *Ask about your files* (GossipT) and *Less noise, more now* (Iris on a phone).
- **AI guide:** a director's guide (story shape, camera grammar, characters, mood → settings, which template fits) and how to add a screen type.
- **Export** embeds images that sit beside the clip, so the single HTML file still stands alone; the preview server serves them, and nothing outside the clip's folder (a symlink can't lead out of it). On any page, an image path resolves against the clip's URL.

### Fixed
- The camera and the pointer no longer head for the corner of the stage when a step points at something that isn't showing yet, such as a row an `add` step is about to reveal. Focusing on one frames its screen instead.
- The validator reports, rather than crashes on, `null` or other non-object entries in flow nodes, table rows, connectors, CRM buttons, chapters, and steps.
- A CRM dropdown's options were clipped by the fields panel and never showed. A browser test now checks that no pop-up is clipped, in Chromium, WebKit, and Firefox.

### Changed
- The npm package no longer ships `src/` (the built files are enough): 251 kB to download.

## 0.2.0

### Added
- **Screens that come and go:** `enter` and `exit` steps (from or to the left, right, top, bottom, or with a fade or zoom), `front` to raise a screen and dim the others, and screens that start `hidden`.
- **Layouts:** `row`, `stage` (one screen at a time), and `desktop` (overlapping windows), plus per-screen `place` (named slots or exact positions) and `width`.
- **Per-screen colour mode:** one film can mix light and dark screens.
- **`design.aspect`:** `auto`, `16:9`, `4:5`, or `1:1`. `auto` switches to portrait on narrow players.
- **New surfaces:** `ai-chat`, an AI assistant with connectors (`connect`, `prompt`, `think`, `tool`, `respond`), and `browser-app`, a web app in a browser window with a data table (`add`, `status`, `select`, `toast`).
- **New template:** `assistant-connector`.
- **New example:** *Invoices sent from a chat*.
- **`cueflick export`:** one self-contained HTML file to share or host anywhere.
- **`snapshot --poster`** and **`--offline`**.
- **`init --ai`** writes guidance for any AI agent: `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`.
- **`cueflick:ready`** event and `player.readyChapter`, so tools can wait for a static chapter.
- **Poster slot:** `<img slot="poster">` shows before playback and when JavaScript is off.
- **Surfaces can ship their own CSS** (`styles`), declare screen keys (`keys`), and check step order (`order`).
- **Firefox** in the browser test suite, plus unit tests for layouts and camera framing, and a test that the schema and the validator agree.

### Fixed
- The validator no longer crashes on, or accepts, built-in object property names like `"constructor"` used as screen ids.
- The validator and the player now pick a step's screen with the same rule; a conflicting `"on"` is an error.
- Typos in keys (for example `desing`) are warned about with a suggestion. Steps that act on a screen before it enters, reactions before any message, and expressions before an open node are warned about too.
- `<cue-flick>` fills flex and grid containers instead of collapsing to zero width.
- Element lifecycle: loads are coalesced (one fetch), removing the element cancels its load, a `clip` set before the script loads is used, inline JSON waits for the page to parse, and `chapter` must be a whole number.
- Zoom values are clamped in the camera, not just warned about.
- Films inside hidden containers draw correctly once shown; wires and trails redraw on resize.
- Play/Pause always matches the real playback state.
- Pause and pace now control camera and cursor motion, and pause freezes CSS animations.
- Long words wrap, many CRM fields no longer push the Save button off screen, and the end card fits on phones.
- CLI: a busy preview port no longer hangs, file watching survives editors that replace the file, renders move across disks, and `--port` and `--width` must be numbers.
- Local servers reject requests with a non-local `Host` header (DNS rebinding), and `demo` serves only the examples and the built player.
- `h()` rejects event-handler attributes and unsafe URLs.

### Changed
- Requires Node 20 or newer for the CLI.
- The version comes from `package.json` at build time.

## 0.1.0

- First release: `<cue-flick>` player, `crm-record`, `flow-canvas`, and `team-chat` surfaces, the `trigger-automation-notify` template, the validator with hints, the CLI (`validate`, `preview`, `snapshot`, `render`, `init`, `catalog`, `guide`, `demo`), the JSON Schema, and `llms.txt`.
