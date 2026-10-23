// The JSON Schema and the validator must agree on the examples and on
// warning-only cases (the schema checks shape; the validator checks meaning).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { validate } from '../dist/cueflick.mjs';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const schema = await read('../schema/cueflick.schema.json');
const checkSchema = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const examples = {
    'closed-won': await read('../examples/closed-won/closed-won.clip.json'),
    'claw-fastbooks': await read('../examples/claw-fastbooks/claw-fastbooks.clip.json'),
    'gossipt-files': await read('../examples/gossipt-files/gossipt-files.clip.json'),
    'iris-phone': await read('../examples/iris-phone/iris-phone.clip.json')
};

for (const [name, clip] of Object.entries(examples)) {
    test(`${name} passes both the schema and the validator`, () => {
        assert.equal(checkSchema(clip), true, JSON.stringify(checkSchema.errors, null, 2));
        assert.equal(validate(clip).ok, true);
    });
}

test('warning-only issues never fail the schema', () => {
    const clip = structuredClone(examples['closed-won']);
    clip.chapters[0].narration = 'x'.repeat(200);
    clip.story.overview = 'y'.repeat(300);
    clip.design.camera.zoom = 9;
    clip.chapters[0].steps.unshift({ caption: 'z'.repeat(120) });
    const result = validate(clip);
    assert.equal(result.ok, true);
    assert.ok(result.warnings.length >= 4);
    assert.equal(checkSchema(clip), true, JSON.stringify(checkSchema.errors, null, 2));
});

test('shape errors fail both', () => {
    const clip = structuredClone(examples['closed-won']);
    clip.design.mode = 'neon';
    clip.chapters[0].steps[0] = { choose: 'crm.field:Stage', value: 'Closed Won', click: 'crm.button:Save' };
    assert.equal(checkSchema(clip), false);
    assert.equal(validate(clip).ok, false);
});

test('v0.3 camera, timing, and effect options pass both', () => {
    const clip = structuredClone(examples['claw-fastbooks']);
    clip.design.camera = { zoom: 1.25, speed: 1, ease: 'snappy', punch: { amount: 1.3, hold: 800 }, follow: true };
    Object.assign(clip.chapters[0], { duration: 1200, ease: 'gentle', async: true });
    clip.chapters[0].steps[0].punch = 1.5;
    clip.chapters[3].steps[0] = { enter: 'books', from: 'launch', duration: 900, ease: 'spring' };
    clip.chapters[3].steps[1] = { exit: 'claw', to: 'minimize' };
    clip.chapters[3].steps.push({ pan: 'books.row:1039', duration: 800 }, { pan: { x: -120 } }, { focus: 'books', async: true, ease: 'linear' });
    assert.equal(checkSchema(clip), true, JSON.stringify(checkSchema.errors, null, 2));
    assert.equal(validate(clip).ok, true);
});

test('a switch turns off with "to": false in both; a boolean "on" fails both', () => {
    const clip = structuredClone(examples['iris-phone']);
    Object.assign(clip.screens.phone, { screen: 'list', list: { title: 'Family', sections: [{ rows: [{ id: 'alerts', label: 'Alerts', toggle: true }] }] } });
    clip.chapters[1].steps.push({ toggle: 'phone.row:alerts', to: false });
    assert.equal(checkSchema(clip), true, JSON.stringify(checkSchema.errors, null, 2));
    assert.equal(validate(clip).ok, true);
    clip.chapters[1].steps[clip.chapters[1].steps.length - 1] = { toggle: 'phone.row:alerts', on: false };
    assert.equal(checkSchema(clip), false);
    assert.equal(validate(clip).ok, false);
});
