// The CLI's export: one self-contained HTML file, images included.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportCommand } from '../cli/commands.mjs';

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
