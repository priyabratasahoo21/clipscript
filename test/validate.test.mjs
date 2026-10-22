import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatReport, validate } from '../dist/clipscript.mjs';

const example = JSON.parse(await readFile(new URL('../examples/closed-won/closed-won.clip.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(example);
const paths = result => result.errors.map(error => error.path);

test('the bundled example is valid with no warnings', () => {
    const result = validate(example);
    assert.equal(result.ok, true, formatReport(result));
    assert.deepEqual(result.warnings, []);
});

test('rejects non-objects', () => {
    assert.equal(validate(null).ok, false);
    assert.equal(validate([]).ok, false);
    assert.equal(validate('clip').ok, false);
});

test('unknown template gets a "did you mean" hint', () => {
    const clip = clone();
    clip.template = 'trigger-automation-notfy';
    const error = validate(clip).errors.find(e => e.path === 'template');
    assert.ok(error);
    assert.match(error.hint, /trigger-automation-notify/);
});

test('missing story overview is an error with a fix', () => {
    const clip = clone();
    delete clip.story;
    const error = validate(clip).errors.find(e => e.path === 'story');
    assert.ok(error);
    assert.match(error.hint, /overview/);
});

test('a misspelled node id points at the step and suggests the right id', () => {
    const clip = clone();
    clip.chapters[1].steps[1].run = 'flow.node:chek';
    const error = validate(clip).errors.find(e => e.path === 'chapters[1].steps[1].run');
    assert.ok(error);
    assert.match(error.hint, /"check"/);
});

test('choose must use one of the field options', () => {
    const clip = clone();
    clip.chapters[0].steps[0].value = 'Closed Wonn';
    const error = validate(clip).errors.find(e => e.path === 'chapters[0].steps[0].value');
    assert.ok(error);
    assert.match(error.hint, /Closed Won/);
});

test('a step with no action lists the actions and suggests one', () => {
    const clip = clone();
    clip.chapters[0].steps[1] = { clik: 'crm.button:Save' };
    const error = validate(clip).errors.find(e => e.path === 'chapters[0].steps[1]');
    assert.ok(error);
    assert.match(error.hint, /"click"/);
});

test('a step with two actions is rejected', () => {
    const clip = clone();
    clip.chapters[0].steps[1] = { click: 'crm.button:Save', toast: 'Saved' };
    assert.ok(paths(validate(clip)).includes('chapters[0].steps[1]'));
});

test('an action on the wrong kind of screen is rejected', () => {
    const clip = clone();
    clip.chapters[0].steps[1] = { click: 'flow.node:check' };
    assert.equal(validate(clip).ok, false);
});

test('design values are checked', () => {
    const clip = clone();
    clip.design.mode = 'darkk';
    clip.design.accent = 'cyan';
    clip.design.font.ui = 'Inter; background: url(x)';
    const result = validate(clip);
    assert.ok(paths(result).includes('design.mode'));
    assert.ok(paths(result).includes('design.accent'));
    assert.ok(paths(result).includes('design.font.ui'));
    assert.match(result.errors.find(e => e.path === 'design.mode').hint, /dark/);
});

test('out-of-range camera zoom is a warning, not an error', () => {
    const clip = clone();
    clip.design.camera.zoom = 9;
    const result = validate(clip);
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some(w => w.path === 'design.camera.zoom'));
});

test('unknown step keys are warned about with a suggestion', () => {
    const clip = clone();
    clip.chapters[0].steps[0] = { choose: 'crm.field:Stage', value: 'Closed Won', vale: 'x' };
    const warning = validate(clip).warnings.find(w => w.path === 'chapters[0].steps[0].vale');
    assert.ok(warning);
    assert.match(warning.hint, /"value"/);
});

test('message from an unknown app screen is rejected', () => {
    const clip = clone();
    clip.chapters[3].steps[0].message.app = 'flw';
    const error = validate(clip).errors.find(e => e.path === 'chapters[3].steps[0].message.app');
    assert.ok(error);
    assert.match(error.hint, /"flow"/);
});

test('formatReport includes paths, hints, and a summary line', () => {
    const clip = clone();
    clip.template = 'nope';
    const text = formatReport(validate(clip), 'x.clip.json');
    assert.match(text, /✗ template:/);
    assert.match(text, /x\.clip\.json has 1 error/);
});

// ---------- review fixes and new features ----------

const claw = JSON.parse(await readFile(new URL('../examples/claw-fastbooks/claw-fastbooks.clip.json', import.meta.url), 'utf8'));
const cloneClaw = () => structuredClone(claw);

test('the Claw → Fastbooks example is valid with no warnings', () => {
    const result = validate(claw);
    assert.equal(result.ok, true, formatReport(result));
    assert.deepEqual(result.warnings, []);
});

test('Object.prototype names never resolve as screens', () => {
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
        const clip = clone();
        clip.chapters[0].steps[1] = { click: 'crm.button:Save', on: name };
        clip.chapters[1].focus = name;
        clip.chapters[3].steps[0].message.app = name;
        clip.chapters[0].steps[3].packet.to = name;
        let result;
        assert.doesNotThrow(() => { result = validate(clip); }, name);
        assert.equal(result.ok, false, name);
        for (const path of ['chapters[0].steps[1].on', 'chapters[1].focus', 'chapters[3].steps[0].message.app', 'chapters[0].steps[3].packet.to']) {
            assert.ok(paths(result).includes(path), `${name}: expected an error at ${path}`);
        }
    }
});

test('"on" that disagrees with the target\'s screen is an error', () => {
    const clip = clone();
    clip.screens.crm2 = structuredClone(clip.screens.crm);
    clip.chapters[0].steps[1] = { click: 'crm.button:Save', on: 'crm2' };
    const error = validate(clip).errors.find(e => e.path === 'chapters[0].steps[1].on');
    assert.ok(error);
    assert.match(error.message, /disagrees/);
});

test('misspelled top-level and section keys are warned about with a hint', () => {
    const clip = clone();
    clip.desing = clip.design;
    delete clip.design;
    clip.story.overveiw = 'x';
    const result = validate(clip);
    assert.match(result.warnings.find(w => w.path === 'desing').hint, /"design"/);
    assert.match(result.warnings.find(w => w.path === 'story.overveiw').hint, /"overview"/);
});

test('reacting before any message is a warning', () => {
    const clip = clone();
    delete clip.screens.chat.history;
    clip.chapters[3].steps.shift();
    assert.ok(validate(clip).warnings.some(w => w.path === 'chapters[3].steps[0]' && /no message/.test(w.message)));
});

test('an expression before any open node is a warning', () => {
    const clip = clone();
    clip.chapters[2].steps.shift();
    assert.ok(validate(clip).warnings.some(w => w.path === 'chapters[2].steps[0]' && /open/.test(w.message)));
});

test('acting on a hidden screen before it enters is a warning', () => {
    const clip = cloneClaw();
    clip.chapters[0].steps.push({ add: 'books.row:1042' });
    assert.ok(validate(clip).warnings.some(w => w.path === 'chapters[0].steps[1]' && /off stage/.test(w.message)));
});

test('enter directions, layouts, aspects, and screen modes are checked with hints', () => {
    const clip = cloneClaw();
    clip.chapters[3].steps[0].from = 'rigth';
    clip.layout = 'stag';
    clip.design.aspect = '16:10';
    clip.screens.claw.mode = 'ligth';
    const result = validate(clip);
    assert.match(result.errors.find(e => e.path === 'chapters[3].steps[0].from').hint, /"right"/);
    assert.match(result.errors.find(e => e.path === 'layout').hint, /"stage"/);
    assert.ok(paths(result).includes('design.aspect'));
    assert.match(result.errors.find(e => e.path === 'screens.claw.mode').hint, /"light"/);
});

test('a tool call must name one of the screen\'s connectors', () => {
    const clip = cloneClaw();
    clip.chapters[2].steps[0].connector = 'fastbook';
    assert.match(validate(clip).errors.find(e => e.path === 'chapters[2].steps[0].connector').hint, /"fastbooks"/);
});

test('field values that would render as [object Object] are rejected', () => {
    const clip = clone();
    clip.screens.flow.nodes[2].params.Mode = { nested: true };
    clip.screens.flow.nodes[1].sub = 42;
    const result = validate(clip);
    assert.ok(paths(result).includes('screens.flow.nodes[2].params'));
    assert.ok(paths(result).includes('screens.flow.nodes[1].sub'));
});
