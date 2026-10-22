# ClipScript

**Product films for software, written as data.**

Write one JSON file that describes a workflow across app screens. ClipScript plays it on any web page as a film, with a moving camera, a cursor, subtitles, and chapters, or turns it into a video.

```html
<script src="https://unpkg.com/clipscript/dist/clipscript.min.js" defer></script>
<clip-script src="my-film.clip.json"></clip-script>
```

## Examples

Each film is one JSON file. All apps, companies, and people in them are made up.

**An AI assistant sends invoices through a connector**

[![Invoices sent from a chat](https://raw.githubusercontent.com/priyabratasahoo21/clipscript/main/media/claw-fastbooks.gif)](https://github.com/priyabratasahoo21/clipscript/blob/main/media/claw-fastbooks.mp4)

[Watch the video](https://github.com/priyabratasahoo21/clipscript/blob/main/media/claw-fastbooks.mp4) · [See the clip](examples/claw-fastbooks/claw-fastbooks.clip.json)

**A closed deal triggers an automation that tells the team**

[![Closed deal to team channel](https://raw.githubusercontent.com/priyabratasahoo21/clipscript/main/media/closed-won.gif)](https://github.com/priyabratasahoo21/clipscript/blob/main/media/closed-won.mp4)

[Watch the video](https://github.com/priyabratasahoo21/clipscript/blob/main/media/closed-won.mp4) · [See the clip](examples/closed-won/closed-won.clip.json)

## Who it's for

- **Product and developer-tool teams:** product films for websites, docs, and READMEs, without screen recording.
- **Integration builders:** show how data moves between apps.
- **Consultants and sales engineers:** explain a workflow before it's built, or make a film per customer.
- **Anyone with an AI agent:** describe the film, and your agent writes it. It works with Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, or any agent that can read files and run commands.

## Quick start

```sh
npm install clipscript
```

```js
import 'clipscript';
```

```html
<clip-script src="my-film.clip.json"></clip-script>
```

It works the same in plain HTML, React, Vue, Svelte, or any other framework.

## Make a film with any AI agent

1. Run `npx clipscript init --ai` in your project. It adds a short pointer to the authoring guide in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, which most agents read automatically. For any other agent, point it at `node_modules/clipscript/llms.txt`.
2. Ask in plain English, for example: *"Make a ClipScript film where our assistant creates three invoices in the accounting app. Validate it and check the snapshots."*
3. The agent writes the clip, checks it with `npx clipscript validate`, and fixes anything it finds.

## Share a film

- **On a website:** the `<clip-script>` tag above.
- **As one file:** `npx clipscript export my-film.clip.json` creates a single HTML file you can email or host anywhere.
- **As a video:** `npx clipscript render my-film.clip.json --out my-film.mp4` (also `.gif`). This needs Playwright: `npm install -D playwright`.

## Learn more

- [Reference](docs/reference.md): the clip format, screens, layouts, the element API, and the CLI
- [Authoring guide for AI agents](llms.txt)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
