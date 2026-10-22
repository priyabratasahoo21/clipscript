#!/usr/bin/env node
// clipscript command-line interface.

import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import {
    CliError,
    catalogCommand,
    demoCommand,
    exportCommand,
    guideCommand,
    initCommand,
    previewCommand,
    renderCommand,
    snapshotCommand,
    validateCommand
} from '../cli/commands.mjs';

const HELP = `ClipScript — product films for software, written as data

Usage
  clipscript validate <file...> [--json]       check clip scripts; errors include a path and a hint
  clipscript preview <file> [--port 4321]      play a clip locally; reloads when the file changes
  clipscript snapshot <file> [--out dir]       save one PNG per chapter (needs Playwright); --poster poster.png too
  clipscript render <file> [--out film.mp4]    record the film to .mp4, .gif, or .webm (needs Playwright; ffmpeg for mp4/gif)
  clipscript export <file> [--out film.html]   one self-contained HTML file to share or host anywhere
  clipscript init [dir] [--ai]                 create film.clip.json; --ai adds AI-agent guidance (AGENTS.md, CLAUDE.md, GEMINI.md)
  clipscript catalog [--json]                  list templates, surfaces, parts, and actions
  clipscript guide                             print the authoring guide for AI agents (llms.txt)
  clipscript demo                              serve the bundled examples

Options
  --width <px>      snapshot/render width (default 1280)
  --mode <mode>     override design.mode: dark, light, or auto
  --offline         don't load web fonts in preview, snapshot, or render pages
  -h, --help        show this help
  -v, --version     show the version`;

const COMMANDS = {
    validate: validateCommand,
    preview: previewCommand,
    snapshot: snapshotCommand,
    render: renderCommand,
    export: exportCommand,
    init: initCommand,
    catalog: catalogCommand,
    guide: guideCommand,
    demo: demoCommand
};

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            json: { type: 'boolean' },
            ai: { type: 'boolean' },
            out: { type: 'string', short: 'o' },
            port: { type: 'string' },
            width: { type: 'string' },
            mode: { type: 'string' },
            poster: { type: 'string' },
            offline: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
            version: { type: 'boolean', short: 'v' }
        }
    });
    if (values.version) {
        const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
        console.log(pkg.version);
        return 0;
    }
    const [name, ...args] = positionals;
    if (values.help || !name) {
        console.log(HELP);
        return 0;
    }
    const command = COMMANDS[name];
    if (!command) throw new CliError(`Unknown command "${name}". Run clipscript --help.`);
    if (values.mode && !['dark', 'light', 'auto'].includes(values.mode)) throw new CliError('--mode must be dark, light, or auto');
    return command(args, values);
}

main().then(
    code => { process.exitCode = code ?? 0; },
    error => {
        console.error(error instanceof CliError ? error.message : error);
        process.exitCode = error instanceof CliError ? 1 : 2;
    }
);
