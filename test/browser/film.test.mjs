// End-to-end checks in real browser engines (Chromium, WebKit, Firefox).
// Skipped automatically when Playwright isn't installed.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPreviewServer } from '../../cli/server.mjs';

let playwright = null;
try {
    playwright = await import('playwright');
} catch {
    playwright = null;
}

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const clips = {
    closedWon: await read('../../examples/closed-won/closed-won.clip.json'),
    claw: await read('../../examples/claw-fastbooks/claw-fastbooks.clip.json')
};
const servers = {};
let workDir;

async function serve(name, clip) {
    const file = join(workDir, `${name}.clip.json`);
    await writeFile(file, JSON.stringify(clip));
    servers[name] = await startPreviewServer(file, { port: 0, reload: false, offline: true });
}

before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'clipscript-test-'));
    await serve('closedWon', clips.closedWon);
    await serve('claw', clips.claw);
    // a clip whose text tries to inject markup; it must render as plain text
    const attack = structuredClone(clips.closedWon);
    attack.title = '<img src=x onerror="window.__pwned=1">';
    attack.chapters[3].steps[0].message.text = '<script>window.__pwned=1</script> *bold*';
    await serve('hostile', attack);
});

after(async () => {
    await Promise.all(Object.values(servers).map(server => server.close()));
    await rm(workDir, { recursive: true, force: true });
});

/** Open a page and collect page errors. */
async function openPage(browser, url, options = {}) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...options });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    return { page, errors };
}

/** Wait for a static chapter view to finish drawing (state is recorded, so this never misses it). */
const ready = (page, chapter, selector = 'clip-script') => page.waitForFunction(
    ([index, css]) => document.querySelector(css)?.player?.readyChapter === index,
    [chapter, selector],
    { timeout: 20000 }
);

for (const engine of ['chromium', 'webkit', 'firefox']) {
    test(`${engine}: every chapter of both films renders, with no errors or overflow`, { skip: !playwright }, async () => {
        const browser = await playwright[engine].launch();
        try {
            for (const [name, clip] of Object.entries(clips)) {
                for (const width of [1280, 390]) {
                    const page = await browser.newPage({ viewport: { width, height: 900 } });
                    const errors = [];
                    page.on('pageerror', error => errors.push(error.message));
                    for (let i = 0; i < clip.chapters.length; i++) {
                        await page.goto(`${servers[name].url}/?chapter=${i}`);
                        await ready(page, i);
                    }
                    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                    const endcardFits = await page.evaluate(() => {
                        const root = document.querySelector('clip-script').shadowRoot;
                        const stage = root.querySelector('.cs-stage').getBoundingClientRect();
                        const card = root.querySelector('.cs-endcard-inner').getBoundingClientRect();
                        return card.top >= stage.top - 1 && card.bottom <= stage.bottom + 1;
                    });
                    assert.deepEqual(errors, [], `${name} at ${width}px: page errors`);
                    assert.equal(overflow, 0, `${name} at ${width}px: horizontal overflow`);
                    assert.ok(endcardFits, `${name} at ${width}px: end card spills out of the stage`);
                    await page.close();
                }
            }
        } finally {
            await browser.close();
        }
    });

    test(`${engine}: the film plays to the end and fires clipscript:ended`, { skip: !playwright }, async () => {
        const browser = await playwright[engine].launch();
        try {
            const { page, errors } = await openPage(browser, `${servers.closedWon.url}/`);
            await page.locator('.cs-ch').last().click();
            await page.evaluate(() => new Promise(done => document.addEventListener('clipscript:ended', done, { once: true })));
            assert.ok(await page.locator('.cs-msg').count() >= 2);
            assert.equal(await page.locator('.cs-buttons .cs-cbtn').first().textContent(), 'Play ▶');
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });
}

test('screens enter and exit: Fastbooks arrives, Claw leaves, the new rows appear', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.claw.url}/?chapter=3`);
        await ready(page, 3);
        const state = await page.evaluate(() => {
            const root = document.querySelector('clip-script').shadowRoot;
            const off = key => root.querySelector(`[data-screen="${key}"]`).classList.contains('cs-off');
            return {
                clawOff: off('claw'),
                booksOff: off('books'),
                booksMode: root.querySelector('[data-screen="books"]').dataset.mode,
                clawMode: root.querySelector('[data-screen="claw"]').dataset.mode,
                added: root.querySelectorAll('.cs-ba-row.cs-added').length,
                drawerOpen: root.querySelector('.cs-ba-drawer').classList.contains('cs-open')
            };
        });
        assert.deepEqual(state, { clawOff: true, booksOff: false, booksMode: 'dark', clawMode: 'light', added: 3, drawerOpen: true });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('the element fills a flex container and fetches its clip once', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        let fetches = 0;
        page.on('request', request => { if (request.url().endsWith('/clip.json')) fetches += 1; });
        await page.goto(`${servers.closedWon.url}/?chapter=1&mode=light`);
        await ready(page, 1);
        assert.equal(fetches, 1, 'the clip should be fetched exactly once');
        const width = await page.evaluate(async () => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            const film = document.createElement('clip-script');
            film.setAttribute('src', '/clip.json');
            film.setAttribute('chapter', '0');
            row.append(film);
            document.body.append(row);
            while (film.player?.readyChapter !== 0) await new Promise(resolve => setTimeout(resolve, 50));
            return film.getBoundingClientRect().width;
        });
        assert.ok(width > 600, `expected the film to fill the flex row, got ${width}px`);
    } finally {
        await browser.close();
    }
});

test('a film in a hidden container draws correctly once shown', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await page.goto(`${servers.closedWon.url}/?chapter=0`);
        await ready(page, 0);
        const wire = await page.evaluate(async () => {
            const box = document.createElement('div');
            box.hidden = true;
            const film = document.createElement('clip-script');
            film.setAttribute('src', '/clip.json');
            film.setAttribute('chapter', '1');
            box.append(film);
            document.body.append(box);
            await new Promise(resolve => setTimeout(resolve, 400));
            box.hidden = false;
            while (film.player?.readyChapter !== 1) await new Promise(resolve => setTimeout(resolve, 50));
            return film.shadowRoot.querySelector('.cs-wire-line').getAttribute('d');
        });
        assert.doesNotMatch(wire, /^M 6 0 /, `wire drawn with zero geometry: ${wire}`);
    } finally {
        await browser.close();
    }
});

test('play/pause follows the playback state', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.closedWon.url}/?chapter=1`);
        await ready(page, 1);
        const button = page.locator('.cs-buttons .cs-cbtn').first();
        assert.equal(await button.textContent(), 'Play ▶', 'a static chapter shows Play');
        await button.click();
        assert.equal(await page.evaluate(() => document.querySelector('clip-script').player.state), 'playing');
        assert.equal(await button.textContent(), 'Pause ❚❚');
        await button.click();
        assert.equal(await page.evaluate(() => document.querySelector('clip-script').player.state), 'paused');
        assert.equal(await button.textContent(), 'Play ▶');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('clip text is rendered as text, never as HTML', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page } = await openPage(browser, `${servers.hostile.url}/?chapter=4`);
        await ready(page, 4);
        assert.equal(await page.evaluate(() => window.__pwned), undefined);
        assert.equal(await page.locator('.cs-stage img').count(), 0);
        assert.equal(await page.locator('.cs-stage script').count(), 0);
        assert.match(await page.locator('.cs-intro-title').textContent(), /<img src=x/);
        assert.equal(await page.locator('.cs-msg-text b').last().textContent(), 'bold');
    } finally {
        await browser.close();
    }
});

test('reduced motion shows a static film without autoplay', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page } = await openPage(browser, `${servers.closedWon.url}/`, { reducedMotion: 'reduce' });
        await page.locator('.cs-endcard.cs-show').waitFor();
        assert.equal(await page.locator('.cs-intro.cs-show').count(), 0);
        assert.equal(await page.evaluate(() => document.querySelector('clip-script').player.state), 'static');
    } finally {
        await browser.close();
    }
});
