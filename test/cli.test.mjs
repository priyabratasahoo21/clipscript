// The CLI's export: one self-contained HTML file, images included.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportCommand } from '../cli/commands.mjs';
import { startPreviewServer } from '../cli/server.mjs';

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
