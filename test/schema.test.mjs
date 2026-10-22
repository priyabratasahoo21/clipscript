// The JSON Schema and the validator must agree on the examples and on
// warning-only cases (the schema checks shape; the validator checks meaning).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { validate } from '../dist/clipscript.mjs';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const schema = await read('../schema/clipscript.schema.json');
const checkSchema = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const examples = {
    'closed-won': await read('../examples/closed-won/closed-won.clip.json'),
    'claw-fastbooks': await read('../examples/claw-fastbooks/claw-fastbooks.clip.json')
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
