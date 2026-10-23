# Cueflick

**Product films for software, written as data.**

Describe app screens, a camera, and a few characters in one JSON file. Cueflick plays it on any web page as a film, with chapters and subtitles, or records it to video. Any AI agent can write one for you.

```html
<script src="https://unpkg.com/cueflick/dist/cueflick.min.js" defer></script>
<cue-flick src="my-film.clip.json"></cue-flick>
```

## Examples

Each film is one JSON file. Every app, company, and person in them is made up. Click a film to watch it in full.

### Ask about your files

Files pulled into a prompt with `@`, highlighted as they're typed, previewed on hover, and cited in the answer. The camera keeps up with the typing and moves in on each preview.

[![Ask about your files](https://raw.githubusercontent.com/priyabratasahoo21/cueflick/main/media/gossipt-files.gif)](https://github.com/priyabratasahoo21/cueflick/releases/download/v0.3.0/gossipt-files.mp4)

[Watch the video](https://github.com/priyabratasahoo21/cueflick/releases/download/v0.3.0/gossipt-files.mp4) · [See the clip](examples/gossipt-files/gossipt-files.clip.json)

### Less noise, more now

A phone film in a motion-graphics style. Glass spheres carry the story. Notifications pile up on a liquid-glass lock screen, and the assistant, Iris, folds them into one summary. Music plays in the Screen Pool while a sphere rolls along the top of the phone. The few things that matter land as blocks.

[![Less noise, more now](https://raw.githubusercontent.com/priyabratasahoo21/cueflick/main/media/iris-phone.gif)](https://github.com/priyabratasahoo21/cueflick/releases/download/v0.3.0/iris-phone.mp4)

[Watch the video](https://github.com/priyabratasahoo21/cueflick/releases/download/v0.3.0/iris-phone.mp4) · [See the clip](examples/iris-phone/iris-phone.clip.json)

### Invoices sent from a chat

An AI assistant uses a connector to create and email three invoices, then the accounting app launches in as the chat minimizes.

[![Invoices sent from a chat](https://raw.githubusercontent.com/priyabratasahoo21/cueflick/main/media/claw-fastbooks.gif)](https://github.com/priyabratasahoo21/cueflick/releases/download/v0.3.0/claw-fastbooks.mp4)

[Watch the video](https://github.com/priyabratasahoo21/cueflick/releases/download/v0.3.0/claw-fastbooks.mp4) · [See the clip](examples/claw-fastbooks/claw-fastbooks.clip.json)

## What a film can have

- **App screens:**
  - an AI assistant with connectors and `@file` references
  - a phone: lock screen, notifications, an assistant that summarizes, the Screen Pool, a settings list
  - a CRM record, a workflow editor, a team chat, and a web app with a table

  Need another app? [Add a screen type](llms.txt), or ask your AI agent to. Every `cueflick` command can use it with `--use`.
- **A directed camera:** framing, zoom, pan, follow-the-action, punch-in on clicks, and easing per move. It can also zoom *through* an object into the next scene, or blur everything but the subject.
- **Characters:** spheres, blocks, pills, and rings that pop in, hop, bounce, roll, and land with a squash, in a glossy, matte, or glass finish. Plus confetti.
- **Look:**
  - light, dark, or auto, with light and dark screens in one film
  - liquid-glass, light, or dark phone cards
  - a backdrop colour per scene
  - 16:9, 4:5, or 1:1

You direct every visual choice as a setting: how many bounces, how soft a ball is, how round the phone's corners are. Each one has a default that already looks right.

## Who it's for

- **Product and developer-tool teams:** product films for websites, docs, and READMEs, without screen recording or a motion designer.
- **Integration builders:** show how data moves between apps.
- **Consultants and sales engineers:** explain a workflow before it's built, or make a film for each customer.
- **Anyone with an AI agent:** describe the film and your agent writes it. Works with Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, or any agent that can read files and run commands.

## Quick start

```sh
npm install cueflick
```

```js
import 'cueflick';
```

```html
<cue-flick src="my-film.clip.json"></cue-flick>
```

It works the same in plain HTML, React, Vue, Svelte, or any other framework. It's under 60 kB gzipped, with no dependencies.

## Make a film with any AI agent

1. Run `npx cueflick init --ai` in your project. It adds a short pointer to the authoring guide in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, which most agents read automatically. For any other agent, point it at `node_modules/cueflick/llms.txt`.
2. Describe the film in plain words, for example: *"Make a Cueflick film where our assistant summarizes a pile of notifications on a phone. Keep it calm and premium. Validate it and check the snapshots."*
3. The agent follows the guide's director's notes:
   - picks a template and screens
   - plans the scenes and camera moves
   - writes the clip
   - checks it with `npx cueflick validate` and looks at `npx cueflick snapshot`
   - fixes anything it finds

## Share a film

- **On a website:** use the `<cue-flick>` tag above.
- **As one file:** `npx cueflick export my-film.clip.json` creates a single HTML file you can email or host anywhere.
- **As a video:** `npx cueflick render my-film.clip.json --out my-film.mp4` (also `.gif` and `.webm`). This needs Playwright (`npm install -D playwright`), and ffmpeg for MP4 and GIF.

## What it isn't

Cueflick isn't a video editor or a 3D tool. Motion comes from shaped curves, not a physics engine, and films are silent. It shows the built-in screens plus any screen type you add. It never uses real logos or brand assets.

## Learn more

- [Reference](docs/reference.md): the clip format, screens, characters, camera, layouts, the element API, and the CLI
- [Authoring guide for AI agents](llms.txt), including the director's notes and how to add a screen type
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
