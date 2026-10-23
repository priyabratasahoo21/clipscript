// The CLI: export (one self-contained HTML file, images included), the preview
// server's limits, and --use (screen types and templates from your own modules).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCommand } from '../cli/commands.mjs';
import { startPreviewServer } from '../cli/server.mjs';
import { loadUse, useFiles } from '../cli/use.mjs';

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const example = JSON.parse(await readFile(new URL('../examples/gossipt-files/gossipt-files.clip.json', import.meta.url), 'utf8'));

async function exportWith(src) {
    const dir = await mkdtemp(join(tmpdir(), 'cueflick-export-'));
    const clip = structuredClone(example);
    clip.screens.chat.files[0].src = src;
    await writeFile(join(dir, 'film.clip.json'), JSON.stringify(clip));
    await writeFile(join(dir, 'pixel.png'), Buffer.from(PIXEL, 'base64'));
    const out = join(dir, 'film.html');
    const log = console.log;
    console.log = () => {};
    try {
        await exportCommand([join(dir, 'film.clip.json')], { out, offline: true });
        return await readFile(out, 'utf8');
    } finally {
        console.log = log;
        await rm(dir, { recursive: true, force: true });
    }
}

test('export embeds images that sit beside the clip, so the file works on its own', async () => {
    const html = await exportWith('pixel.png');
    assert.ok(html.includes(`"src": "data:image/png;base64,${PIXEL}"`), 'the image is embedded as a data: URL');
    assert.ok(!html.includes('"src": "pixel.png"'));
});

test('export leaves https images alone', async () => {
    const html = await exportWith('https://example.com/q3.png');
    assert.ok(html.includes('"src": "https://example.com/q3.png"'));
});

/** A clip folder holding pixel.png, a symlink to it (inside), and a symlink to a secret beside the folder (outside). */
async function linkedFolder() {
    const base = await mkdtemp(join(tmpdir(), 'cueflick-links-'));
    const dir = join(base, 'clip');
    await mkdir(dir);
    await writeFile(join(base, 'secret.txt'), 'not for sharing');
    await writeFile(join(dir, 'pixel.png'), Buffer.from(PIXEL, 'base64'));
    await symlink(join(base, 'secret.txt'), join(dir, 'leak.png'));
    await symlink(join(dir, 'pixel.png'), join(dir, 'alias.png'));
    return { base, dir };
}

async function exportFrom(dir, src) {
    const clip = structuredClone(example);
    clip.screens.chat.files[0].src = src;
    await writeFile(join(dir, 'film.clip.json'), JSON.stringify(clip));
    const out = join(dir, `${src}.html`);
    const log = console.log;
    console.log = () => {};
    try {
        await exportCommand([join(dir, 'film.clip.json')], { out, offline: true });
        return await readFile(out, 'utf8');
    } finally {
        console.log = log;
    }
}

test('export refuses a symlink that leads outside the clip folder, and follows one that stays inside', { skip: process.platform === 'win32' }, async () => {
    const { base, dir } = await linkedFolder();
    try {
        await assert.rejects(exportFrom(dir, 'leak.png'), /outside the clip's folder/);
        assert.ok((await exportFrom(dir, 'alias.png')).includes(`data:image/png;base64,${PIXEL}`));
    } finally {
        await rm(base, { recursive: true, force: true });
    }
});

test('the preview server refuses a symlink that leads outside the clip folder', { skip: process.platform === 'win32' }, async () => {
    const { base, dir } = await linkedFolder();
    await writeFile(join(dir, 'film.clip.json'), JSON.stringify(example));
    const server = await startPreviewServer(join(dir, 'film.clip.json'), { port: 0, reload: false, offline: true });
    try {
        const leak = await fetch(`${server.url}/leak.png`);
        assert.equal(leak.status, 403);
        assert.ok(!(await leak.text()).includes('not for sharing'));
        const alias = await fetch(`${server.url}/alias.png`);
        assert.equal(alias.status, 200);
        assert.equal(Buffer.from(await alias.arrayBuffer()).toString('base64'), PIXEL);
    } finally {
        await server.close();
        await rm(base, { recursive: true, force: true });
    }
});

// ---------- --use: screen types and templates made outside Cueflick ----------

const CLI = fileURLToPath(new URL('../bin/cueflick.mjs', import.meta.url));
const FIXTURES = fileURLToPath(new URL('./fixtures/use/', import.meta.url));

/** A project folder outside the package (so "cueflick" doesn't resolve on its own), with the fixture screen, template, and clip. */
async function project() {
    const dir = await mkdtemp(join(tmpdir(), 'cueflick-use-'));
    await mkdir(join(dir, 'screens'));
    for (const file of ['kanban.mjs', 'board-template.mjs']) await copyFile(join(FIXTURES, file), join(dir, 'screens', file));
    await copyFile(join(FIXTURES, 'board.clip.json'), join(dir, 'board.clip.json'));
    return dir;
}

const cueflick = (dir, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8' });
const BOTH = ['--use', 'screens/kanban.mjs,screens/board-template.mjs'];

test('--use registers your own screen type and template for validate and catalog, in either module form', async () => {
    const dir = await project();
    try {
        const without = cueflick(dir, 'validate', 'board.clip.json');
        assert.equal(without.status, 1);
        assert.match(without.stdout, /"kanban" is not a known surface/);
        assert.match(without.stdout, /--use/, 'the error says how to register it');
        const valid = cueflick(dir, 'validate', 'board.clip.json', ...BOTH);
        assert.equal(valid.status, 0, valid.stdout + valid.stderr);
        // the flag can also be repeated
        const repeated = cueflick(dir, 'catalog', '--json', '--use', 'screens/kanban.mjs', '--use', 'screens/board-template.mjs');
        const info = JSON.parse(repeated.stdout);
        assert.ok(info.surfaces.some(surface => surface.name === 'kanban' && surface.actions.some(action => action.name === 'drag')));
        assert.ok(info.templates.some(template => template.name === 'board-update'));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('--use explains a missing file, a module that registers nothing, and one that fails', async () => {
    const dir = await project();
    try {
        await writeFile(join(dir, 'screens', 'empty.mjs'), 'export const nothing = 1;\n');
        await writeFile(join(dir, 'screens', 'broken.mjs'), "throw new Error('kanban exploded');\n");
        await writeFile(join(dir, 'screens', 'clash.mjs'), "export default ({ registerSurface }) => registerSurface({ name: 'clash', render: () => ({}), actions: { move: { async run() {} } } });\n");
        const cases = [['screens/missing.mjs', /no such file/], ['screens/empty.mjs', /didn't register a screen type or template/], ['screens/broken.mjs', /kanban exploded/], ['screens/clash.mjs', /"move" is a built-in step/]];
        for (const [file, message] of cases) {
            const result = cueflick(dir, 'validate', 'board.clip.json', '--use', file);
            assert.equal(result.status, 1, file);
            assert.match(result.stderr, message, file);
            assert.ok(!/\n\s+at /.test(result.stderr), `${file}: a plain message, not a stack trace`);
        }
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('export embeds --use modules, so the HTML file still stands alone', async () => {
    const dir = await project();
    try {
        const result = cueflick(dir, 'export', 'board.clip.json', '--out', 'board.html', '--offline', ...BOTH);
        assert.equal(result.status, 0, result.stderr);
        const html = await readFile(join(dir, 'board.html'), 'utf8');
        assert.ok(html.includes('<script type="importmap">'), 'cueflick maps to the inlined player');
        const kanban = Buffer.from(await readFile(join(dir, 'screens', 'kanban.mjs'))).toString('base64');
        assert.ok(html.includes(`data:text/javascript;base64,${kanban}`), 'the screen module is embedded');
        assert.ok(html.includes('id="cueflick-clip"'));
        // a module that imports another file can't be embedded as one file
        await writeFile(join(dir, 'screens', 'helper.mjs'), 'export const columns = 2;\n');
        await writeFile(join(dir, 'screens', 'split.mjs'), `import './helper.mjs';\n${await readFile(join(dir, 'screens', 'kanban.mjs'), 'utf8')}`);
        const split = cueflick(dir, 'export', 'board.clip.json', '--out', 'split.html', '--use', 'screens/split.mjs,screens/board-template.mjs');
        assert.equal(split.status, 1);
        assert.match(split.stderr, /imports \.\/helper\.mjs/);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('the preview server serves a --use module and scripts beside it, and nothing else', async () => {
    const dir = await project();
    await writeFile(join(dir, 'screens', 'notes.txt'), 'not a script');
    await writeFile(join(dir, 'secret.mjs'), 'export const secret = 1;');
    const server = await startPreviewServer(join(dir, 'board.clip.json'), { port: 0, reload: false, offline: true, use: [join(dir, 'screens', 'kanban.mjs')] });
    try {
        const page = await (await fetch(server.url)).text();
        assert.ok(page.includes('"cueflick": "/__cueflick/cueflick.mjs"') && page.includes('/__use/0/kanban.mjs'));
        assert.equal((await fetch(`${server.url}/__use/0/kanban.mjs`)).status, 200);
        assert.equal((await fetch(`${server.url}/__use/0/board-template.mjs`)).status, 200, 'a script beside it (for its own imports)');
        assert.equal((await fetch(`${server.url}/__use/0/notes.txt`)).status, 403, 'only scripts');
        assert.equal((await fetch(`${server.url}/__use/0/..%2fsecret.mjs`)).status, 403, 'nothing outside its folder');
        assert.ok([403, 404].includes((await fetch(`${server.url}/__use/0/%2e%2e/secret.mjs`)).status), 'nothing outside its folder');
        assert.equal((await fetch(`${server.url}/__use/1/kanban.mjs`)).status, 404, 'only the modules named with --use');
    } finally {
        await server.close();
        await rm(dir, { recursive: true, force: true });
    }
});

test('loading the same screen module again from another folder is fine (one process, many runs)', async () => {
    const first = await project();
    const second = await project();
    try {
        for (const dir of [first, second]) {
            const files = useFiles([join(dir, 'screens', 'kanban.mjs'), join(dir, 'screens', 'board-template.mjs')]);
            assert.deepEqual(await loadUse(files), files);
        }
    } finally {
        await rm(first, { recursive: true, force: true });
        await rm(second, { recursive: true, force: true });
    }
});
