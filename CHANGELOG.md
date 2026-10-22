# Changelog

## 0.2.0

### Added
- **Screens that come and go:** `enter` and `exit` steps (from or to the left, right, top, bottom, or with a fade or zoom), `front` to raise a screen and dim the others, and screens that start `hidden`.
- **Layouts:** `row`, `stage` (one screen at a time), and `desktop` (overlapping windows), plus per-screen `place` (named slots or exact positions) and `width`.
- **Per-screen colour mode:** one film can mix light and dark screens.
- **`design.aspect`:** `auto`, `16:9`, `4:5`, or `1:1`. `auto` switches to portrait on narrow players.
- **New surfaces:** `ai-chat`, an AI assistant with connectors (`connect`, `prompt`, `think`, `tool`, `respond`), and `browser-app`, a web app in a browser window with a data table (`add`, `status`, `select`, `toast`).
- **New template:** `assistant-connector`.
- **New example:** *Invoices sent from a chat*.
- **`clipscript export`:** one self-contained HTML file to share or host anywhere.
- **`snapshot --poster`** and **`--offline`**.
- **`init --ai`** writes guidance for any AI agent: `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`.
- **`clipscript:ready`** event and `player.readyChapter`, so tools can wait for a static chapter.
- **Poster slot:** `<img slot="poster">` shows before playback and when JavaScript is off.
- **Surfaces can ship their own CSS** (`styles`), declare screen keys (`keys`), and check step order (`order`).
- **Firefox** in the browser test suite, plus unit tests for layouts and camera framing, and a test that the schema and the validator agree.

### Fixed
- The validator no longer crashes on, or accepts, built-in object property names like `"constructor"` used as screen ids.
- The validator and the player now pick a step's screen with the same rule; a conflicting `"on"` is an error.
- Typos in keys (for example `desing`) are warned about with a suggestion. Steps that act on a screen before it enters, reactions before any message, and expressions before an open node are warned about too.
- `<clip-script>` fills flex and grid containers instead of collapsing to zero width.
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

- First release: `<clip-script>` player, `crm-record`, `flow-canvas`, and `team-chat` surfaces, the `trigger-automation-notify` template, the validator with hints, the CLI (`validate`, `preview`, `snapshot`, `render`, `init`, `catalog`, `guide`, `demo`), the JSON Schema, and `llms.txt`.
