// Unit tests for the DOM-free parts of the player: layouts and camera framing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, EASE_NAMES, EASES, frameFor, LAYOUTS, layoutFor, SLOTS, WORLD } from '../dist/cueflick.mjs';

const surface = width => ({ width });
const entries = [
    { key: 'a', def: {}, surface: surface(430) },
    { key: 'b', def: {}, surface: surface(620) },
    { key: 'c', def: {}, surface: surface(430) }
];

test('row layout places screens left to right without overlap, inside the world', () => {
    const layout = layoutFor('row', entries, WORLD);
    assert.ok(layout.a.x + layout.a.w < layout.b.x);
    assert.ok(layout.b.x + layout.b.w < layout.c.x);
    assert.ok(layout.a.x >= 0 && layout.c.x + layout.c.w <= WORLD.width);
});

test('stage layout centres every screen in the same spot', () => {
    const layout = layoutFor('stage', entries, WORLD);
    for (const key of ['a', 'b', 'c']) {
        assert.equal(Math.round(layout[key].x + layout[key].w / 2), WORLD.width / 2);
        assert.ok(layout[key].w <= WORLD.width - 120);
    }
});

test('desktop layout cascades overlapping windows', () => {
    const layout = layoutFor('desktop', entries, WORLD);
    assert.ok(layout.b.x > layout.a.x && layout.b.y > layout.a.y);
    assert.ok(layout.b.x < layout.a.x + layout.a.w, 'windows overlap');
});

test('a screen\'s place (slot or rect) overrides the layout', () => {
    const placed = [
        { key: 'a', def: { place: 'pip' }, surface: surface(430) },
        { key: 'b', def: { place: { x: 10, y: 20, w: 300, h: 200 } }, surface: surface(430) }
    ];
    const layout = layoutFor('row', placed, WORLD);
    assert.deepEqual(layout.a, SLOTS.pip);
    assert.deepEqual(layout.b, { x: 10, y: 20, w: 300, h: 200 });
});

test('unknown layout names fall back to row', () => {
    assert.deepEqual(layoutFor('nope', entries, WORLD), layoutFor('row', entries, WORLD));
    assert.deepEqual(LAYOUTS, ['row', 'stage', 'desktop']);
});

test('frameFor centres the target in the framed area', () => {
    const stage = { width: 1280, height: 720 };
    const rect = { x: 600, y: 100, w: 400, h: 600, kind: 'screen' };
    const { x, y, scale } = frameFor(rect, stage);
    const centreX = x + (rect.x + rect.w / 2) * scale;
    assert.ok(Math.abs(centreX - stage.width / 2) < 0.5);
    assert.ok(y + rect.y * scale >= 0, 'top edge stays on stage');
    assert.ok(y + (rect.y + rect.h) * scale <= stage.height * 0.83, 'bottom edge stays above the subtitle band');
});

test('frameFor clamps zoom: 0, negative, and huge values stay in range', () => {
    const stage = { width: 1280, height: 720 };
    const rect = { x: 0, y: 0, w: 1600, h: 900, kind: 'all' };
    const normal = frameFor(rect, stage, { zoom: 1 }).scale;
    assert.equal(frameFor(rect, stage, { zoom: 0 }).scale, normal);
    assert.equal(frameFor(rect, stage, { zoom: -1 }).scale, normal);
    assert.ok(frameFor(rect, stage, { zoom: 40 }).scale <= normal * 2.5 + 1e-9);
    assert.ok(Number.isFinite(frameFor(rect, stage, { zoom: Number.NaN }).scale));
});

test('frameFor fits portrait stages too', () => {
    const portrait = { width: 400, height: 500 };
    const rect = { x: 585, y: 92, w: 430, h: 650, kind: 'screen' };
    const { y, scale } = frameFor(rect, portrait);
    assert.ok(y + (rect.y + rect.h) * scale <= portrait.height);
});

test('the catalog lists every built-in template and surface', () => {
    const info = catalog();
    assert.deepEqual(info.templates.map(t => t.name).sort(), ['assistant-connector', 'assistant-files', 'phone-feature', 'trigger-automation-notify']);
    assert.deepEqual(info.surfaces.map(s => s.name).sort(), ['ai-chat', 'browser-app', 'crm-record', 'flow-canvas', 'phone', 'team-chat']);
});

// ---------- v0.3: easing ----------


test('every easing curve starts at 0 and ends at 1', () => {
    for (const [name, curve] of Object.entries(EASES)) {
        assert.ok(Math.abs(curve(0)) < 1e-9, `${name}(0)`);
        assert.ok(Math.abs(curve(1) - 1) < 1e-9, `${name}(1)`);
    }
    assert.deepEqual(EASE_NAMES, ['smooth', 'snappy', 'linear', 'gentle', 'spring']);
});

test('spring overshoots and settles; snappy front-loads the motion', () => {
    const samples = Array.from({ length: 101 }, (_, i) => EASES.spring(i / 100));
    assert.ok(Math.max(...samples) > 1.02, 'spring should overshoot');
    assert.ok(EASES.snappy(0.3) > EASES.smooth(0.3) + 0.3, 'snappy should be well ahead of smooth early on');
    assert.equal(EASES.linear(0.42), 0.42);
});

