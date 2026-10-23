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
    claw: await read('../../examples/claw-fastbooks/claw-fastbooks.clip.json'),
    gossipt: await read('../../examples/gossipt-files/gossipt-files.clip.json'),
    iris: await read('../../examples/iris-phone/iris-phone.clip.json')
};
const servers = {};
let workDir;

async function serve(name, clip) {
    const file = join(workDir, `${name}.clip.json`);
    await writeFile(file, JSON.stringify(clip));
    servers[name] = await startPreviewServer(file, { port: 0, reload: false, offline: true });
}

before(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'cueflick-test-'));
    await serve('closedWon', clips.closedWon);
    await serve('claw', clips.claw);
    await serve('gossipt', clips.gossipt);
    await serve('iris', clips.iris);
    // each material, and a director's own corner and pool inset
    for (const [name, phone] of [['irisLight', { material: 'light' }], ['irisDark', { material: 'dark' }], ['irisEdges', { corner: 52, poolInset: 12 }]]) {
        const variant = structuredClone(clips.iris);
        Object.assign(variant.screens.phone, phone);
        await serve(name, variant);
    }
    const listed = structuredClone(clips.iris);
    Object.assign(listed.screens.phone, {
        hidden: false,
        screen: 'list',
        list: { title: 'Family', circles: ['#ffc83d', '#ff6b5e'], sections: [{ title: 'Iris', rows: [
            { id: 'summaries', label: 'Summarise notifications', toggle: false },
            { id: 'alerts', label: 'Alerts', toggle: true },
            { id: 'sunny', label: 'Sunny', detail: 'Age 7', color: '#ffc83d', chevron: true }
        ] }] }
    });
    listed.chapters = [{ title: 'List', narration: 'A list.', focus: 'phone', steps: [
        { toggle: 'phone.row:summaries' }, { toggle: 'phone.row:alerts', to: false }, { tap: 'phone.row:sunny' }, { blur: 'phone', amount: 8 }, { dive: 'phone.row:sunny' }
    ] }, { title: 'After', narration: 'Then the film carries on.', steps: [{ wait: 100 }] }];
    await serve('irisList', listed);
    const pictured = structuredClone(clips.gossipt);
    pictured.screens.chat.files[0].src = 'pixel.png';
    await serve('gossiptPicture', pictured);
    await writeFile(join(workDir, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    await writeFile(join(workDir, '..', 'outside.png'), 'not served');
    await serve('bounce', {
        cueflick: '1', title: 'Bounce', template: 'phone-feature', layout: 'stage',
        story: { overview: 'A ball bounces onto a block.' },
        design: { intro: false, endcard: false, cursor: false, backdrop: '#f1f0f5' },
        screens: { phone: { surface: 'phone', app: { name: 'Iris' }, hidden: true } },
        actors: {
            ball: { shape: 'sphere', color: '#ff6b5e', size: 140, at: { x: 560, y: 260 } },
            block: { shape: 'block', color: '#3fa9ff', size: 200, at: { x: 1000, y: 560 } }
        },
        chapters: [{ title: 'Bounce', narration: 'Bounce.', steps: [
            { spawn: ['ball', 'block'] },
            { move: 'ball', to: 'block', perch: true, path: 'bounce', bounces: 2, duration: 900 },
            { wait: 600 }
        ] }]
    });
    // a bounce with no height: nothing to rebound from, and the film must still finish
    await serve('flatBounce', {
        cueflick: '1', title: 'Flat bounce', template: 'phone-feature', layout: 'stage',
        story: { overview: 'A ball bounces without leaving the ground.' },
        design: { intro: false, endcard: false, cursor: false, backdrop: '#f1f0f5' },
        screens: { phone: { surface: 'phone', app: { name: 'Iris' }, hidden: true } },
        actors: { ball: { shape: 'sphere', color: '#ff6b5e', size: 140, at: { x: 560, y: 450 } } },
        chapters: [{ title: 'Flat', narration: 'Flat.', steps: [
            { spawn: 'ball' },
            { move: 'ball', to: { x: 1000, y: 450 }, path: 'bounce', height: 0, duration: 400 },
            { wait: 100 }
        ] }]
    });
    // zoomed far in on the composer, with and without the camera following the typing
    for (const [name, follow] of [['typingFollow', true], ['typingStill', false]]) {
        const zoomed = structuredClone(clips.gossipt);
        zoomed.design.camera.follow = follow;
        zoomed.chapters[0].zoom = 2.2;
        await serve(name, zoomed);
    }
    const fx = structuredClone(clips.claw);
    fx.design.camera = { ...fx.design.camera, follow: true, punch: { amount: 1.3, hold: 500 }, ease: 'snappy' };
    fx.chapters.forEach(chapter => { chapter.async = true; });
    fx.chapters[3].steps[0] = { enter: 'books', from: 'launch' };
    fx.chapters[3].steps[1] = { exit: 'claw', to: 'minimize' };
    await serve('clawFx', fx);
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
const ready = (page, chapter, selector = 'cue-flick') => page.waitForFunction(
    ([index, css]) => document.querySelector(css)?.player?.readyChapter === index,
    [chapter, selector],
    { timeout: 20000 }
);

for (const engine of ['chromium', 'webkit', 'firefox']) {
    test(`${engine}: every chapter of every film renders, with no errors or overflow`, { skip: !playwright }, async () => {
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
                        const root = document.querySelector('cue-flick').shadowRoot;
                        const stage = root.querySelector('.cf-stage').getBoundingClientRect();
                        const card = root.querySelector('.cf-endcard-inner').getBoundingClientRect();
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

    test(`${engine}: the film plays to the end and fires cueflick:ended`, { skip: !playwright }, async () => {
        const browser = await playwright[engine].launch();
        try {
            const { page, errors } = await openPage(browser, `${servers.closedWon.url}/`);
            await page.locator('.cf-ch').last().click();
            await page.evaluate(() => new Promise(done => document.addEventListener('cueflick:ended', done, { once: true })));
            assert.ok(await page.locator('.cf-msg').count() >= 2);
            assert.equal(await page.locator('.cf-buttons .cf-cbtn').first().textContent(), 'Play ▶');
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
            const root = document.querySelector('cue-flick').shadowRoot;
            const off = key => root.querySelector(`[data-screen="${key}"]`).classList.contains('cf-off');
            return {
                clawOff: off('claw'),
                booksOff: off('books'),
                booksMode: root.querySelector('[data-screen="books"]').dataset.mode,
                clawMode: root.querySelector('[data-screen="claw"]').dataset.mode,
                added: root.querySelectorAll('.cf-ba-row.cf-added').length,
                drawerOpen: root.querySelector('.cf-ba-drawer').classList.contains('cf-open')
            };
        });
        assert.deepEqual(state, { clawOff: true, booksOff: false, booksMode: 'dark', clawMode: 'light', added: 3, drawerOpen: true });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

for (const engine of ['chromium', 'webkit', 'firefox']) {
    test(`${engine}: follow, punch-in, easing, async moves, and launch/minimize effects play cleanly`, { skip: !playwright }, async () => {
        const browser = await playwright[engine].launch();
        try {
            const { page, errors } = await openPage(browser, `${servers.clawFx.url}/`);
            await page.locator('.cf-ch').nth(3).click();
            await page.evaluate(() => new Promise(done => document.addEventListener('cueflick:ended', done, { once: true })));
            const state = await page.evaluate(() => {
                const root = document.querySelector('cue-flick').shadowRoot;
                const books = root.querySelector('[data-screen="books"]');
                return { booksOn: !books.classList.contains('cf-off'), inline: books.getAttribute('style').includes('opacity'), state: document.querySelector('cue-flick').player.state };
            });
            assert.deepEqual(state, { booksOn: true, inline: false, state: 'ended' }, 'effects should finish and clear their inline styles');
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });
}

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
            const film = document.createElement('cue-flick');
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
            const film = document.createElement('cue-flick');
            film.setAttribute('src', '/clip.json');
            film.setAttribute('chapter', '1');
            box.append(film);
            document.body.append(box);
            await new Promise(resolve => setTimeout(resolve, 400));
            box.hidden = false;
            while (film.player?.readyChapter !== 1) await new Promise(resolve => setTimeout(resolve, 50));
            return film.shadowRoot.querySelector('.cf-wire-line').getAttribute('d');
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
        const button = page.locator('.cf-buttons .cf-cbtn').first();
        assert.equal(await button.textContent(), 'Play ▶', 'a static chapter shows Play');
        await button.click();
        assert.equal(await page.evaluate(() => document.querySelector('cue-flick').player.state), 'playing');
        assert.equal(await button.textContent(), 'Pause ❚❚');
        await button.click();
        assert.equal(await page.evaluate(() => document.querySelector('cue-flick').player.state), 'paused');
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
        assert.equal(await page.locator('.cf-stage img').count(), 0);
        assert.equal(await page.locator('.cf-stage script').count(), 0);
        assert.match(await page.locator('.cf-intro-title').textContent(), /<img src=x/);
        assert.equal(await page.locator('.cf-msg-text b').last().textContent(), 'bold');
    } finally {
        await browser.close();
    }
});

test('reduced motion shows a static film without autoplay', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page } = await openPage(browser, `${servers.closedWon.url}/`, { reducedMotion: 'reduce' });
        await page.locator('.cf-endcard.cf-show').waitFor();
        assert.equal(await page.locator('.cf-intro.cf-show').count(), 0);
        assert.equal(await page.evaluate(() => document.querySelector('cue-flick').player.state), 'static');
    } finally {
        await browser.close();
    }
});

/** Adds window.unclipped(el): true when nothing inside the film's world (the camera frame aside) clips the element. */
function installUnclipped() {
    window.unclipped = el => {
        const box = el.getBoundingClientRect();
        for (let node = el.parentElement; node && !node.classList.contains('cf-world'); node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
            const clip = node.getBoundingClientRect();
            if (box.left < clip.left - 1 || box.right > clip.right + 1 || box.top < clip.top - 1 || box.bottom > clip.bottom + 1) return node.className || node.tagName;
        }
        return true;
    };
}

for (const engine of ['chromium', 'webkit', 'firefox']) {
    test(`${engine}: pop-ups are never clipped: dropdown options, the @ file picker, and the hover preview`, { skip: !playwright }, async () => {
        const browser = await playwright[engine].launch();
        try {
            const crm = await openPage(browser, `${servers.closedWon.url}/?chapter=0`);
            await ready(crm.page, 0);
            await crm.page.evaluate(installUnclipped);
            const dropdown = await crm.page.evaluate(async () => {
                const root = document.querySelector('cue-flick').shadowRoot;
                root.querySelector('.cf-select').classList.add('cf-open');
                await new Promise(resolve => setTimeout(resolve, 300));
                const menu = root.querySelector('.cf-menu');
                return { unclipped: window.unclipped(menu), options: [...menu.querySelectorAll('.cf-opt')].map(o => o.textContent) };
            });
            assert.deepEqual(dropdown, { unclipped: true, options: ['Prospecting', 'Proposal', 'Negotiation', 'Closed Won'] });

            const chat = await openPage(browser, `${servers.gossipt.url}/?chapter=0`);
            await ready(chat.page, 0);
            await chat.page.evaluate(installUnclipped);
            const popups = await chat.page.evaluate(async () => {
                const { view } = document.querySelector('cue-flick').player.views.chat;
                view.openPicker('', 'q3-chart');
                const chip = view.find('file', 'q3-chart');
                const card = view.peek(view.files.get('q3-chart'), chip);
                await new Promise(resolve => setTimeout(resolve, 400));
                const picker = view.picker;
                return {
                    picker: window.unclipped(picker),
                    rows: [...picker.querySelectorAll('.cf-ai-pick:not([hidden])')].length,
                    active: picker.querySelector('.cf-ai-pick.cf-active')?.dataset.pick,
                    card: window.unclipped(card),
                    bars: card.querySelectorAll('.cf-thumb-art rect').length,
                    name: card.querySelector('.cf-ai-peek-name').textContent
                };
            });
            // background + six bars
            assert.deepEqual(popups, { picker: true, rows: 3, active: 'q3-chart', card: true, bars: 7, name: 'Q3 revenue.png' });
            assert.deepEqual([...crm.errors, ...chat.errors], []);
        } finally {
            await browser.close();
        }
    });
}

test('a prompt with @ references leaves highlighted file chips, and sending moves them into the thread', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.gossipt.url}/?chapter=0`);
        await ready(page, 0);
        const draft = await page.evaluate(() => {
            const root = document.querySelector('cue-flick').shadowRoot;
            const typed = root.querySelector('.cf-ai-typed');
            return { text: typed.textContent, refs: [...typed.querySelectorAll('.cf-ai-ref')].map(chip => chip.dataset.file) };
        });
        assert.deepEqual(draft, { text: 'Does Q3 revenue.png back up the growth claim in Board memo, Oct.pdf? Keep it short.', refs: ['q3-chart', 'board-memo'] });
        await page.goto(`${servers.gossipt.url}/?chapter=3`);
        await ready(page, 3);
        const thread = await page.evaluate(() => {
            const root = document.querySelector('cue-flick').shadowRoot;
            return {
                composer: root.querySelector('.cf-ai-typed').textContent,
                sent: [...root.querySelectorAll('.cf-ai-user-msg .cf-ai-ref')].map(chip => chip.dataset.file),
                cited: [...root.querySelectorAll('.cf-ai-reply .cf-ai-ref')].map(chip => chip.dataset.file)
            };
        });
        assert.deepEqual(thread, { composer: '', sent: ['q3-chart', 'board-memo'], cited: ['q3-chart', 'pipeline'] });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

/** Where an element sits relative to the film's stage. */
const inFrame = (page, css) => page.evaluate(selector => {
    const root = document.querySelector('cue-flick').shadowRoot;
    const stage = root.querySelector('.cf-stage').getBoundingClientRect();
    const box = root.querySelector(selector).getBoundingClientRect();
    return {
        inside: box.left >= stage.left && box.right <= stage.right && box.top >= stage.top && box.bottom <= stage.bottom,
        share: box.width / stage.width,
        across: (box.left + box.width / 2 - stage.left) / stage.width
    };
}, css);

/** Play chapter `index` and wait until the typed prompt ends, plus time for the camera to settle. */
async function typeChapter(page, index = 0) {
    await page.locator('.cf-ch').nth(index).click();
    await page.waitForFunction(() => document.querySelector('cue-flick').shadowRoot.querySelector('.cf-ai-typed').textContent.endsWith('short.'), null, { timeout: 20000 });
    await page.waitForTimeout(900);
}

test('while typing zoomed in, following keeps the caret and the @ picker in frame (without it the caret reaches the edge)', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const follow = await openPage(browser, `${servers.typingFollow.url}/?chapter=0`);
        await ready(follow.page, 0);
        await follow.page.locator('.cf-ch').first().click();
        await follow.page.waitForFunction(() => {
            const root = document.querySelector('cue-flick').shadowRoot;
            const picker = root.querySelector('.cf-ai-picker.cf-open');
            if (!picker) return false;
            const stage = root.querySelector('.cf-stage').getBoundingClientRect();
            const box = picker.getBoundingClientRect();
            return box.top >= stage.top && box.left >= stage.left && box.right <= stage.right;
        }, null, { timeout: 15000 });
        await typeChapter(follow.page);
        const followed = await inFrame(follow.page, '.cf-ai-caret');
        assert.ok(followed.inside && followed.across < 0.9, `following: the caret should sit well inside the frame (it is ${Math.round(followed.across * 100)}% across)`);

        const still = await openPage(browser, `${servers.typingStill.url}/?chapter=0`);
        await ready(still.page, 0);
        await typeChapter(still.page);
        const fixed = await inFrame(still.page, '.cf-ai-caret');
        assert.ok(fixed.across > 0.9, `without following, this zoom leaves the caret at the edge or beyond (it is ${Math.round(fixed.across * 100)}% across)`);
        assert.deepEqual([...follow.errors, ...still.errors], []);
    } finally {
        await browser.close();
    }
});

test('a hover pops up the preview and zooms in on it', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.gossipt.url}/?chapter=1`);
        await ready(page, 1);
        await page.locator('.cf-ch').nth(1).click();
        await page.waitForFunction(() => document.querySelector('cue-flick').shadowRoot.querySelector('.cf-ai-peek.cf-open'), null, { timeout: 20000 });
        await page.waitForTimeout(1300);
        const card = await inFrame(page, '.cf-ai-peek');
        assert.equal(card.inside, true, 'the preview should be in frame');
        assert.ok(card.share > 0.3, `the camera should zoom in on the preview (it fills ${Math.round(card.share * 100)}% of the width)`);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

/** The phone's cards, pool, and screen, measured in the phone's own pixels (the camera's zoom divided out). */
function phoneGeometry() {
    const root = document.querySelector('cue-flick').shadowRoot;
    const screen = root.querySelector('.cf-ph-screen');
    const pool = root.querySelector('.cf-ph-pool');
    const card = root.querySelector('.cf-ph-summary, .cf-ph-note');
    const unit = screen.getBoundingClientRect().width / screen.offsetWidth;
    const s = screen.getBoundingClientRect();
    const q = pool.getBoundingClientRect();
    const style = getComputedStyle(card);
    const alpha = /rgba?\(([^)]+)\)/.exec(style.backgroundColor)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return {
        gaps: [q.top - s.top, q.left - s.left, s.right - q.right].map(v => Math.round(v / unit)),
        screenRadius: parseFloat(getComputedStyle(screen).borderTopLeftRadius),
        poolRadius: parseFloat(getComputedStyle(pool).borderTopLeftRadius),
        blur: (style.backdropFilter || style.webkitBackdropFilter || '').includes('blur'),
        // glass's tint is a gradient over a clear colour; light and dark paint a solid, opaque-ish colour
        background: alpha ? { alpha: alpha[3] ?? 1, brightness: (alpha[0] + alpha[1] + alpha[2]) / 3 } : null
    };
}

for (const engine of ['chromium', 'webkit', 'firefox']) {
    test(`${engine}: liquid glass, light, and dark cards; a Screen Pool concentric with the screen on three sides`, { skip: !playwright }, async () => {
        const browser = await playwright[engine].launch();
        try {
            const measure = async name => {
                const { page, errors } = await openPage(browser, `${servers[name].url}/?chapter=3`);
                await ready(page, 3);
                await page.waitForTimeout(700);
                const geometry = await page.evaluate(phoneGeometry);
                assert.deepEqual(errors, [], `${name}: page errors`);
                await page.close();
                return geometry;
            };
            const glass = await measure('iris');
            assert.ok(glass.blur, 'glass cards blur what is behind them');
            assert.ok(glass.background.alpha < 0.5, `glass cards are see-through (alpha ${glass.background.alpha})`);
            assert.deepEqual(glass.gaps, [8, 8, 8], 'the expanded pool sits 8px from the top and both sides');
            assert.equal(glass.poolRadius, glass.screenRadius - 8, 'its corners are concentric with the screen');
            const light = await measure('irisLight');
            assert.ok(light.blur && light.background.alpha > 0.8 && light.background.brightness > 200, 'light cards are frosted white');
            const dark = await measure('irisDark');
            assert.ok(dark.blur && dark.background.alpha > 0.7 && dark.background.brightness < 60, 'dark cards are charcoal');
            const edges = await measure('irisEdges');
            assert.deepEqual(edges.gaps, [12, 12, 12], "a director's inset applies on all three sides");
            assert.deepEqual([edges.screenRadius, edges.poolRadius], [52, 40], "a director's corner keeps the pool concentric");
        } finally {
            await browser.close();
        }
    });
}

test('a bouncing ball stretches in the air, and each impact squashes less than the one before', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.bounce.url}/`);
        const samples = await page.evaluate(async () => {
            const out = [];
            const start = performance.now();
            while (performance.now() - start < 5000) {
                const ball = document.querySelector('cue-flick')?.shadowRoot?.querySelector('.cf-actor-sphere');
                const scale = ball && /scale\(([\d.]+), ([\d.]+)\)/.exec(ball.style.transform);
                if (scale && ball.style.opacity === '1') out.push([performance.now() - start, Number(scale[1]), Number(scale[2])]);
                await new Promise(resolve => setTimeout(resolve, 16));
            }
            return out;
        });
        const stretch = Math.max(...samples.map(([, , sy]) => sy));
        assert.ok(stretch > 1.1, `it stretches tall in the air (scaleY ${stretch})`);
        const peaks = samples.filter((sample, i) => i > 0 && i < samples.length - 1 && sample[1] > 1.08
            && sample[1] >= samples[i - 1][1] && sample[1] > samples[i + 1][1]).map(([, sx]) => sx);
        // the first impact is the hardest squash; the two rebounds after it squash less each time
        const impacts = peaks.slice(peaks.indexOf(Math.max(...peaks)));
        assert.ok(impacts.length >= 3, `expected an impact and two rebounds, got squashes ${peaks}`);
        assert.ok(impacts[0] > 1.25, `the first impact squashes hard (scaleX ${impacts[0]})`);
        assert.ok(impacts.every((value, i) => i === 0 || value < impacts[i - 1]), `impacts should weaken: ${impacts}`);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('a touch-first film never shows the pointer', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.iris.url}/?chapter=1`);
        await ready(page, 1);
        assert.equal(await page.evaluate(() => document.querySelector('cue-flick').shadowRoot.querySelector('.cf-cursor').classList.contains('cf-cursor-off')), true);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('a list screen toggles and taps; blur keeps one subject sharp; a dive fills the frame', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.irisList.url}/?chapter=0`);
        await ready(page, 0);
        const state = await page.evaluate(() => {
            const root = document.querySelector('cue-flick').shadowRoot;
            const stage = root.querySelector('.cf-stage').getBoundingClientRect();
            const row = root.querySelector('[data-row=sunny]').getBoundingClientRect();
            return {
                switchOn: root.querySelector('[data-row=summaries] .cf-ph-toggle').classList.contains('cf-on'),
                switchOff: !root.querySelector('[data-row=alerts] .cf-ph-toggle').classList.contains('cf-on'),
                phoneSharp: !root.querySelector('[data-screen=phone]').classList.contains('cf-blurred'),
                spheresBlurred: [...root.querySelectorAll('.cf-actor')].every(el => el.classList.contains('cf-blurred')),
                // the dived-into row covers the whole stage
                covers: row.left <= stage.left && row.right >= stage.right && row.top <= stage.top && row.bottom >= stage.bottom
            };
        });
        assert.deepEqual(state, { switchOn: true, switchOff: true, phoneSharp: true, spheresBlurred: true, covers: true });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('a file preview can show a real image from the clip folder, and nothing outside it is served', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.gossiptPicture.url}/?chapter=0`);
        await ready(page, 0);
        const image = await page.evaluate(async () => {
            const { view } = document.querySelector('cue-flick').player.views.chat;
            const card = view.peek(view.files.get('q3-chart'), view.find('file', 'q3-chart'));
            const img = card.querySelector('img.cf-thumb-img');
            await img.decode();
            return { path: new URL(img.src).pathname, width: img.naturalWidth };
        });
        assert.deepEqual(image, { path: '/pixel.png', width: 1 });
        const outside = await page.evaluate(async () => (await fetch('/%2e%2e/outside.png')).status);
        assert.ok([403, 404].includes(outside), `a path outside the clip folder must not be served (got ${outside})`);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('a bounce with no height still lands, and the film plays on to the end', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.flatBounce.url}/`);
        await page.waitForFunction(() => document.querySelector('cue-flick')?.player?.state === 'ended', null, { timeout: 15000 });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('an image path in a clip resolves against the clip, not the page that embeds it', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const { url } = servers.gossiptPicture;
        // a page two folders down; the clip and its image sit at the root
        await page.route(`${url}/pages/demo/`, route => route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><script src="/__cueflick/cueflick.min.js"></script><cue-flick src="../../clip.json" chapter="0" controls="none"></cue-flick>'
        }));
        await page.goto(`${url}/pages/demo/`);
        await ready(page, 0);
        const image = await page.evaluate(async () => {
            const { view } = document.querySelector('cue-flick').player.views.chat;
            const img = view.peek(view.files.get('q3-chart'), view.find('file', 'q3-chart')).querySelector('img.cf-thumb-img');
            await img.decode();
            return { path: new URL(img.src).pathname, width: img.naturalWidth };
        });
        assert.deepEqual(image, { path: '/pixel.png', width: 1 });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});

test('following steps on rows that are about to appear keeps the camera on the window, not the world\'s corner', { skip: !playwright }, async () => {
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await openPage(browser, `${servers.clawFx.url}/?chapter=0`, { viewport: { width: 1280, height: 720 } });
        await ready(page, 0);
        // a row that isn't showing yet has no position of its own, so targeting it frames its screen
        assert.equal(await page.evaluate(() => document.querySelector('cue-flick').player.targetRect('books.row:1042').kind), 'screen');
        await page.evaluate(() => document.querySelector('cue-flick').goTo(3));
        const centres = await page.evaluate(async () => {
            const player = document.querySelector('cue-flick').player;
            const out = [];
            // Fastbooks launches, Claw minimizes, then three rows are added (before the click on a row)
            for (let t = 0; t < 4400; t += 100) {
                const { x, y, scale } = player.camera.current;
                const books = player.views.books.rect;
                out.push([(x + (books.x + books.w / 2) * scale) / player.stage.clientWidth, (y + (books.y + books.h / 2) * scale) / player.stage.clientHeight]);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return out;
        });
        const strays = centres.filter(([cx, cy]) => cx < 0.3 || cx > 0.7 || cy < 0.2 || cy > 0.7);
        assert.deepEqual(strays, [], 'the Fastbooks window stays in frame while its rows appear');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
