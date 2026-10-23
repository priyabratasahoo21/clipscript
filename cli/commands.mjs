// cueflick CLI commands. Built on Node's standard library; Playwright is
// loaded only by `snapshot` and `render`, and only if it is installed.

import { spawn, spawnSync } from 'node:child_process';
import { appendFile, copyFile, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { catalog, formatReport, GENERIC_ACTIONS, validate } from '../dist/cueflick.mjs';
import { isInside, PACKAGE_ROOT, startPreviewServer, startStaticServer } from './server.mjs';
import { API_NAMES, loadUse, otherImports, UseError, useFiles } from './use.mjs';

const EXAMPLE = join(PACKAGE_ROOT, 'examples', 'closed-won', 'closed-won.clip.json');
const GUIDE = join(PACKAGE_ROOT, 'llms.txt');
const AI_MARKER = '<!-- cueflick -->';
const READY_TIMEOUT_MS = 15000;

export class CliError extends Error {}

/** Parse an integer option, with a range check. */
export function integerOption(value, name, { min, max, fallback }) {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(String(value))) throw new CliError(`--${name} must be a whole number, got "${value}".`);
    const number = Number(value);
    if (number < min || number > max) throw new CliError(`--${name} must be between ${min} and ${max}.`);
    return number;
}

async function loadClip(file) {
    if (!file) throw new CliError('Give a clip file, e.g. `cueflick validate my-film.clip.json`.');
    let text;
    try {
        text = await readFile(file, 'utf8');
    } catch (error) {
        throw new CliError(`Can't read ${file}: ${error.code ?? error.message}`);
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new CliError(`${file} isn't valid JSON: ${error.message}`);
    }
}

async function loadValidClip(file) {
    const clip = await loadClip(file);
    const result = validate(clip);
    if (!result.ok) throw new CliError(formatReport(result, basename(file)));
    return clip;
}

/** Register the screen types and templates in the --use modules; returns their absolute paths. */
async function useModules(value) {
    try {
        return await loadUse(useFiles(value));
    } catch (error) {
        if (error instanceof UseError) throw new CliError(error.message);
        throw error;
    }
}

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch {
        throw new CliError('This command needs Playwright: npm install --save-dev playwright && npx playwright install chromium');
    }
}

const stem = file => basename(file).replace(/\.clip\.json$|\.json$/, '');
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Wait until the player has drawn the given static chapter and fonts are ready. */
async function waitForReady(page, chapter) {
    // runs inside the page
    await page.waitForFunction(index => {
        const film = globalThis.document.querySelector('cue-flick');
        if (film?.shadowRoot?.querySelector('.cf-error')) throw new Error('the clip failed to load');
        const failed = globalThis.document.querySelector('.use-error');
        if (failed) throw new Error(failed.textContent);
        return film?.player?.readyChapter === index;
    }, chapter, { timeout: READY_TIMEOUT_MS });
    await page.evaluate(() => globalThis.document.fonts.ready);
    await page.evaluate(() => new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
}

// ---------- commands ----------

export async function validateCommand(files, { json, use }) {
    if (files.length === 0) throw new CliError('Give at least one clip file to validate.');
    await useModules(use);
    let failed = false;
    const results = [];
    for (const file of files) {
        const result = validate(await loadClip(file));
        failed ||= !result.ok;
        results.push({ file, ...result });
        if (!json) console.log(formatReport(result, file));
    }
    if (json) console.log(JSON.stringify(results, null, 2));
    return failed ? 1 : 0;
}

export async function previewCommand([file], { port, offline, use }) {
    await loadClip(file);
    const modules = await useModules(use);
    const server = await startPreviewServer(file, { port: integerOption(port, 'port', { min: 0, max: 65535, fallback: 4321 }), reload: true, offline, use: modules });
    console.log(`Previewing ${file} at ${server.url}  (reloads when the file changes; Ctrl+C to stop)`);
    await new Promise(() => {});
}

export async function demoCommand(_args, { port }) {
    const server = await startStaticServer(PACKAGE_ROOT, { port: integerOption(port, 'port', { min: 0, max: 65535, fallback: 4321 }) });
    const examples = (await readdir(join(PACKAGE_ROOT, 'examples'), { withFileTypes: true })).filter(entry => entry.isDirectory());
    console.log(`Demo running at ${server.url}/examples/  (Ctrl+C to stop)`);
    for (const entry of examples) console.log(`  ${server.url}/examples/${entry.name}/`);
    await new Promise(() => {});
}

export async function snapshotCommand([file], { out, width, mode, poster, offline, use }) {
    const modules = await useModules(use);
    const clip = await loadValidClip(file);
    const { chromium } = await loadPlaywright();
    const viewportWidth = integerOption(width, 'width', { min: 320, max: 3840, fallback: 1280 });
    const dir = resolve(out ?? `${stem(file)}-snapshots`);
    await mkdir(dir, { recursive: true });
    const server = await startPreviewServer(file, { port: 0, reload: false, offline, use: modules });
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: viewportWidth, height: Math.round(viewportWidth * 9 / 16) + 160 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const shoot = async (params, path) => {
            await page.goto(`${server.url}/?${new URLSearchParams({ bare: '1', controls: 'none', ...(mode ? { mode } : {}), ...params })}`);
            await waitForReady(page, Number(params.chapter));
            await page.locator('.cf-stage').screenshot({ path });
            return path;
        };
        const saved = [];
        for (let i = 0; i < clip.chapters.length; i++) {
            saved.push(await shoot({ chapter: String(i) }, join(dir, `${String(i + 1).padStart(2, '0')}-${slug(clip.chapters[i].title)}.png`)));
        }
        if (poster) saved.push(await shoot({ chapter: String(clip.chapters.length - 1), endcard: 'none' }, resolve(poster)));
        saved.forEach(path => console.log(path));
        if (errors.length) {
            console.error(`Page errors:\n${errors.join('\n')}`);
            return 1;
        }
        return 0;
    } finally {
        await browser.close();
        await server.close();
    }
}

function hasFfmpeg() {
    return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
}

function ffmpeg(args) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('error', reject);
        child.on('close', code => (code === 0 ? resolvePromise() : reject(new CliError(`ffmpeg exited with code ${code}`))));
    });
}

/** Move a file, falling back to copy + delete across volumes. */
async function moveFile(from, to) {
    try {
        await rename(from, to);
    } catch (error) {
        if (error.code !== 'EXDEV') throw error;
        await copyFile(from, to);
        await rm(from, { force: true });
    }
}

export async function renderCommand([file], { out, width, mode, offline, use }) {
    const modules = await useModules(use);
    const clip = await loadValidClip(file);
    const target = resolve(out ?? `${stem(file)}.mp4`);
    const format = extname(target).toLowerCase();
    if (!['.webm', '.mp4', '.gif'].includes(format)) throw new CliError('--out must end in .webm, .mp4, or .gif');
    if (format !== '.webm' && !hasFfmpeg()) throw new CliError(`${format} output needs ffmpeg on your PATH; use --out film.webm without it.`);
    const { chromium } = await loadPlaywright();
    const w = integerOption(width, 'width', { min: 320, max: 3840, fallback: 1280 });
    const size = { width: w, height: Math.round(w * 9 / 16) };
    const workDir = await mkdtemp(join(tmpdir(), 'cueflick-'));
    const server = await startPreviewServer(file, { port: 0, reload: false, offline, use: modules });
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext({ viewport: size, recordVideo: { dir: workDir, size } });
        const page = await context.newPage();
        const query = new URLSearchParams({ bare: '1', controls: 'none', ...(mode ? { mode } : {}) });
        console.log(`Recording "${clip.title}" (${clip.chapters.length} chapters) in real time…`);
        await page.goto(`${server.url}/?${query}`);
        // runs inside the page: fail now, not after the 10-minute wait, if a --use module didn't load
        const started = await page.waitForFunction(() => {
            const note = globalThis.document.querySelector('.use-error');
            if (note) return { error: note.textContent };
            const film = globalThis.document.querySelector('cue-flick');
            if (film?.shadowRoot?.querySelector('.cf-error')) return { error: `the clip failed to load: ${film.shadowRoot.querySelector('.cf-error').textContent}` };
            return film?.player ? { error: null } : null;
        }, null, { timeout: READY_TIMEOUT_MS }).then(handle => handle.jsonValue());
        if (started.error) throw new CliError(started.error);
        // runs inside the page
        await page.evaluate(() => new Promise((done, fail) => {
            const timer = setTimeout(() => fail(new Error('film did not finish within 10 minutes')), 600000);
            globalThis.document.addEventListener('cueflick:ended', () => {
                clearTimeout(timer);
                done();
            }, { once: true });
        }));
        await page.waitForTimeout(2500);
        const video = page.video();
        await context.close();
        const webm = await video.path();
        if (format === '.webm') await moveFile(webm, target);
        else if (format === '.mp4') await ffmpeg(['-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', target]);
        else await ffmpeg(['-i', webm, '-vf', `fps=12,scale=${Math.min(960, w)}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`, target]);
        console.log(target);
        return 0;
    } finally {
        await browser.close();
        await server.close();
        await rm(workDir, { recursive: true, force: true });
    }
}

export async function initCommand([dir = '.'], { ai }) {
    const base = resolve(dir);
    await mkdir(base, { recursive: true });
    const clipPath = join(base, 'film.clip.json');
    if (existsSync(clipPath)) throw new CliError(`${clipPath} already exists; not overwriting it.`);
    const clip = JSON.parse(await readFile(EXAMPLE, 'utf8'));
    clip.$schema = 'https://unpkg.com/cueflick/schema/cueflick.schema.json';
    await writeFile(clipPath, `${JSON.stringify(clip, null, 2)}\n`, { flag: 'wx' });
    console.log(`Created ${clipPath}`);
    if (ai) {
        const block = `\n${AI_MARKER}\n## Product films (Cueflick)\n\nTo make or edit a product film, read \`node_modules/cueflick/llms.txt\` first. Write clips as \`*.clip.json\`, then run \`npx cueflick validate <file>\` and fix every error, and \`npx cueflick snapshot <file>\` and look at each PNG before finishing.\n`;
        for (const name of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
            const path = join(base, name);
            const current = existsSync(path) ? await readFile(path, 'utf8') : '';
            if (current.includes(AI_MARKER)) {
                console.log(`${name} already mentions Cueflick`);
                continue;
            }
            await appendFile(path, block);
            console.log(`Added Cueflick guidance to ${path}`);
        }
    }
    console.log('Next: npx cueflick preview film.clip.json');
    return 0;
}

export async function catalogCommand(_args, { json, use }) {
    await useModules(use);
    const info = catalog();
    if (json) {
        console.log(JSON.stringify({ ...info, genericActions: GENERIC_ACTIONS }, null, 2));
        return 0;
    }
    for (const template of info.templates) console.log(`template  ${template.name}  — ${template.summary} (needs: ${template.requires.join(', ')})`);
    for (const surface of info.surfaces) {
        console.log(`\nsurface   ${surface.name}  — ${surface.summary}`);
        if (surface.parts.length) console.log(`  parts:   ${surface.parts.join(', ')}`);
        for (const action of surface.actions) console.log(`  ${action.name.padEnd(11)} ${action.summary}${action.keys.length ? ` [${action.keys.join(', ')}]` : ''}`);
    }
    console.log(`\ngeneric   ${GENERIC_ACTIONS.join(', ')}`);
    return 0;
}

const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Make text safe inside an inline <script>: it can't end the element or open an HTML comment. */
const inlineScriptSafe = text => text.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

/** A single self-contained HTML file: the player and the clip inlined, nothing else to host. */
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };
const MAX_INLINE_IMAGE = 8 * 1024 * 1024;

/** A shared film has to stand alone: images that sit beside the clip are embedded as data: URLs. */
async function inlineImages(clip, baseDir) {
    for (const screen of Object.values(clip.screens)) {
        for (const item of Array.isArray(screen.files) ? screen.files : []) {
            const src = item?.src;
            if (typeof src !== 'string' || /^(?:https:|data:)/i.test(src)) continue;
            const path = resolve(baseDir, src);
            if (!path.startsWith(baseDir + sep)) throw new CliError(`${src} is outside the clip's folder.`);
            const cantRead = () => {
                throw new CliError(`Can't read ${src} (looked for ${path}).`);
            };
            // check where the file really is, so a symlink can't pull in a file from outside the folder
            const [real, realBase] = await Promise.all([realpath(path).catch(cantRead), realpath(baseDir)]);
            if (!isInside(real, realBase)) throw new CliError(`${src} is outside the clip's folder.`);
            const bytes = await readFile(real).catch(cantRead);
            if (bytes.length > MAX_INLINE_IMAGE) throw new CliError(`${src} is over 8 MB; use a smaller image.`);
            item.src = `data:${IMAGE_MIME[extname(path).toLowerCase()]};base64,${bytes.toString('base64')}`;
        }
    }
}

const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

/**
 * With --use, the film needs its screen modules too: each is embedded as a data: URL, "cueflick"
 * maps to the inlined player, and the film is created once they've run (so its screens are known).
 */
async function embedUse(modules, json) {
    const urls = [];
    for (const path of modules) {
        const source = await readFile(path, 'utf8');
        const others = otherImports(source);
        if (others.length) {
            throw new CliError(`export embeds each --use module as one file, but ${basename(path)} imports ${others.join(', ')}. Bundle it into one file first (for example with esbuild), or move that code into it.`);
        }
        urls.push(dataModule(source));
    }
    const player = dataModule(`const C = globalThis.Cueflick;\nexport const { ${API_NAMES.join(', ')} } = C;\nexport default C;\n`);
    return {
        head: `<script type="importmap">${JSON.stringify({ imports: { cueflick: player } })}</script>\n`,
        film: `<div id="cueflick-film"></div>
<script type="application/json" id="cueflick-clip">
${json}
</script>
<script type="module">
import * as Cueflick from 'cueflick';
const slot = document.getElementById('cueflick-film');
try {
  for (const url of ${JSON.stringify(urls)}) {
    const mod = await import(url);
    if (typeof mod.default === 'function') await mod.default(Cueflick);
  }
  const film = document.createElement('cue-flick');
  film.clip = JSON.parse(document.getElementById('cueflick-clip').textContent);
  slot.replaceWith(film);
} catch (error) {
  slot.textContent = 'This film\\'s screens failed to load: ' + error.message;
  throw error;
}
</script>`
    };
}

export async function exportCommand([file], { out, offline, use }) {
    const modules = await useModules(use);
    const clip = await loadValidClip(file);
    await inlineImages(clip, dirname(resolve(file)));
    const target = resolve(out ?? `${stem(file)}.html`);
    if (extname(target).toLowerCase() !== '.html') throw new CliError('--out must end in .html');
    const player = await readFile(join(PACKAGE_ROOT, 'dist', 'cueflick.min.js'), 'utf8');
    // JSON with "<" escaped can't close the <script> element it sits in
    const json = JSON.stringify(clip, null, 2).replace(/</g, '\\u003c');
    const custom = modules.length ? await embedUse(modules, json) : null;
    const fonts = offline ? '' : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap">\n';
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(clip.title)}</title>
<meta name="description" content="${escapeHtml(clip.story.overview)}">
${fonts}<style>
  body { margin: 0; background: #07080b; color: #e8ebf1; font-family: Inter, system-ui, sans-serif; }
  main { max-width: 1240px; margin: 0 auto; padding: 32px 20px 48px; }
  h1 { margin: 0 0 6px; font-size: clamp(22px, 3.5vw, 34px); letter-spacing: -0.02em; }
  p { margin: 0 0 24px; color: #9ba4b4; max-width: 760px; line-height: 1.55; }
</style>
<script>${inlineScriptSafe(player)}</script>
${custom?.head ?? ''}</head>
<body>
<main>
<h1>${escapeHtml(clip.title)}</h1>
<p>${escapeHtml(clip.story.overview)}</p>
${custom?.film ?? `<cue-flick><script type="application/json">
${json}
</script></cue-flick>`}
</main>
</body>
</html>
`;
    try {
        await writeFile(target, html, { flag: 'wx' });
    } catch (error) {
        if (error.code === 'EEXIST') throw new CliError(`${target} already exists; not overwriting it. Pass a different --out.`);
        throw error;
    }
    console.log(target);
    return 0;
}

export async function guideCommand() {
    process.stdout.write(await readFile(GUIDE, 'utf8'));
    return 0;
}
