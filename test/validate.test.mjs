import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatReport, validate } from '../dist/cueflick.mjs';

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

// ---------- v0.3: camera timing, punch, follow, pan, effects ----------

test('camera options, per-move timing, pan, and new effects validate cleanly', () => {
    const clip = cloneClaw();
    clip.design.camera = { zoom: 1.25, speed: 1, ease: 'snappy', punch: { amount: 1.3, hold: 800 }, follow: true };
    clip.chapters[0].duration = 1200;
    clip.chapters[0].ease = 'gentle';
    clip.chapters[0].async = true;
    clip.chapters[3].steps[0] = { enter: 'books', from: 'launch', duration: 900, ease: 'spring' };
    clip.chapters[3].steps[1] = { exit: 'claw', to: 'minimize' };
    clip.chapters[3].steps.push({ pan: 'books.row:1039', duration: 800 }, { pan: { x: -120 } }, { focus: 'books', async: true, ease: 'linear' });
    clip.chapters[0].steps[0].punch = 1.5;
    const result = validate(clip);
    assert.equal(result.ok, true, formatReport(result));
    assert.deepEqual(result.warnings, []);
});

test('easing names, durations, punch values, and pan offsets are checked with hints', () => {
    const clip = cloneClaw();
    clip.design.camera.ease = 'snapy';
    clip.design.camera.punch = { amount: 'big' };
    clip.chapters[3].steps[0].from = 'lanch';
    clip.chapters[3].steps[0].ease = 'sprng';
    clip.chapters[0].duration = 99999;
    clip.chapters[3].steps.push({ pan: { x: 'left' } });
    const result = validate(clip);
    assert.match(result.errors.find(e => e.path === 'design.camera.ease').hint, /"snappy"/);
    assert.ok(result.errors.some(e => e.path === 'design.camera.punch.amount'));
    assert.match(result.errors.find(e => e.path === 'chapters[3].steps[0].from').hint, /"launch"/);
    assert.match(result.errors.find(e => e.path === 'chapters[3].steps[0].ease').hint, /"spring"/);
    assert.ok(result.warnings.some(w => w.path === 'chapters[0].duration'));
    assert.ok(result.errors.some(e => e.path === `chapters[3].steps[${clip.chapters[3].steps.length - 1}].pan`));
});

// ---------- v0.3: @file references, hover previews, drafts ----------

const gossipt = JSON.parse(await readFile(new URL('../examples/gossipt-files/gossipt-files.clip.json', import.meta.url), 'utf8'));
const cloneGossipt = () => structuredClone(gossipt);

test('the GossipT example is valid with no warnings', () => {
    const result = validate(gossipt);
    assert.equal(result.ok, true, formatReport(result));
    assert.deepEqual(result.warnings, []);
});

test('an unknown @reference is an error that suggests the right file', () => {
    const clip = cloneGossipt();
    clip.chapters[0].steps[0].prompt = 'Does @q3-chrt back up @board-memo?';
    clip.chapters[2].steps[3].respond = 'See @pipline.';
    const result = validate(clip);
    assert.match(result.errors.find(e => e.path === 'chapters[0].steps[0].prompt').hint, /q3-chart/);
    assert.match(result.errors.find(e => e.path === 'chapters[2].steps[3].respond').hint, /pipeline/);
});

test('an "@" inside an email address is not a reference', () => {
    const clip = cloneGossipt();
    clip.chapters[0].steps[0].prompt = 'Email the summary to maya@example.com and cite @q3-chart and @board-memo.';
    assert.equal(validate(clip).ok, true, formatReport(validate(clip)));
});

test('files are checked: kind, duplicate ids, preview shape, unknown keys', () => {
    const clip = cloneGossipt();
    const files = clip.screens.chat.files;
    files[0].kind = 'imgae';
    files[1].id = 'q3-chart';
    files[2].preview.rows = [['a', 'b', 'c', 'd', 'e', 'f']];
    files[0].preview.chart = [1];
    files[0].thumb = 'x.png';
    clip.screens.chat.look = 'chatgpt';
    const result = validate(clip);
    assert.match(result.errors.find(e => e.path === 'screens.chat.files[0].kind').hint, /"image"/);
    assert.ok(paths(result).includes('screens.chat.files[1].id'));
    assert.ok(paths(result).includes('screens.chat.files[2].preview.rows'));
    assert.ok(paths(result).includes('screens.chat.files[0].preview.chart'));
    assert.ok(paths(result).includes('screens.chat.look'));
    assert.ok(result.warnings.some(w => w.path === 'screens.chat.files[0].thumb'));
});

test('hover and send are checked against what happened earlier in the film', () => {
    const clip = cloneGossipt();
    clip.chapters[0].steps[0].draft = false;
    clip.chapters[1].steps.unshift({ hover: 'chat.file:pipeline', zoom: 3 });
    const result = validate(clip);
    assert.ok(result.warnings.some(w => w.path === 'chapters[1].steps[0]' && /@pipeline/.test(w.message)), 'hovering a file nobody mentioned yet warns');
    assert.ok(result.warnings.some(w => w.path === 'chapters[1].steps[4]' && /draft/.test(w.message)), 'sending with no draft warns');
    assert.ok(paths(result).includes('chapters[1].steps[0].zoom'));
});

test('a hover target must be a file of the screen', () => {
    const clip = cloneGossipt();
    clip.chapters[1].steps[0].hover = 'chat.file:q4-chart';
    assert.match(validate(clip).errors.find(e => e.path === 'chapters[1].steps[0].hover').hint, /q3-chart/);
});

// ---------- v0.3: phone, actors, backdrops ----------

const iris = JSON.parse(await readFile(new URL('../examples/iris-phone/iris-phone.clip.json', import.meta.url), 'utf8'));
const cloneIris = () => structuredClone(iris);

test('the Iris phone example is valid with no warnings', () => {
    const result = validate(iris);
    assert.equal(result.ok, true, formatReport(result));
    assert.deepEqual(result.warnings, []);
});

test('actors are checked: shape, finish, count, id clashes, labels, squash', () => {
    const clip = cloneIris();
    clip.actors.sunny.shape = 'sphear';
    clip.actors.coral.finish = 'glosy';
    clip.actors.tiles.count = 40;
    clip.actors.phone = { shape: 'sphere' };
    clip.actors.sky.squash = 5;
    clip.actors.mint.labels = ['a', 'b'];
    const result = validate(clip);
    assert.match(result.errors.find(e => e.path === 'actors.sunny.shape').hint, /"sphere"/);
    assert.match(result.errors.find(e => e.path === 'actors.coral.finish').hint, /"gloss"/);
    assert.ok(paths(result).includes('actors.tiles.count'));
    assert.ok(paths(result).includes('actors.phone'), 'an actor may not share a screen id');
    assert.ok(result.warnings.some(w => w.path === 'actors.sky.squash'));
    assert.ok(result.warnings.some(w => w.path === 'actors.mint.labels'));
});

test('actor steps are checked with hints, and against what is on stage', () => {
    const clip = cloneIris();
    clip.chapters[0].steps.unshift({ move: 'violet', to: { x: 10, y: 10 }, path: 'bounse', bounces: 9 });
    clip.chapters[0].steps.push({ spawn: 'sunnny' }, { leave: 'tiles' }, { move: 'sky' }, { confetti: 'nowhere' }, { backdrop: 'blue' });
    clip.chapters[4].steps.push({ move: 'sunny', to: 'tiles.piece:9' });
    const result = validate(clip);
    const steps = 'chapters[0].steps';
    assert.ok(result.warnings.some(w => w.path === `${steps}[0].move`), 'moving an actor before it spawns warns');
    assert.match(result.errors.find(e => e.path === `${steps}[0].path`).hint, /"bounce"/);
    assert.ok(paths(result).includes(`${steps}[0].bounces`));
    assert.match(result.errors.find(e => e.path === `${steps}[4].spawn`).hint, /sunny/);
    assert.ok(result.warnings.some(w => w.path === `${steps}[5].leave`), 'leaving before spawning warns');
    assert.ok(paths(result).includes(`${steps}[6].to`), 'move needs a "to"');
    assert.ok(paths(result).includes(`${steps}[7].confetti`));
    assert.ok(paths(result).includes(`${steps}[8].backdrop`));
    assert.ok(paths(result).includes(`chapters[4].steps[${clip.chapters[4].steps.length - 1}].to`), 'piece index out of range');
});

test('phone settings and steps are checked', () => {
    const clip = cloneIris();
    Object.assign(clip.screens.phone, { material: 'glas', corner: 90, poolInset: 2, glow: ['#fff'] });
    clip.chapters[1].steps.push({ notify: { app: 'Mail' } }, { pool: 'musc' });
    clip.chapters[2].steps.reverse();
    const result = validate(clip);
    assert.match(result.errors.find(e => e.path === 'screens.phone.material').hint, /"glass"/);
    for (const key of ['corner', 'poolInset', 'glow']) assert.ok(paths(result).includes(`screens.phone.${key}`), key);
    const last = clip.chapters[1].steps.length - 1;
    assert.ok(paths(result).includes(`chapters[1].steps[${last - 1}].notify.text`));
    assert.match(result.errors.find(e => e.path === `chapters[1].steps[${last}].pool`).hint, /"music"/);
    assert.ok(result.warnings.some(w => w.path === 'chapters[2].steps[0]' && /ask/.test(w.message)), 'summarizing before anyone asks warns');
});

test('design takes cursor and a backdrop; chapters take a backdrop', () => {
    const clip = cloneIris();
    Object.assign(clip.design, { cursor: 'no', backdrop: ['#000', '#111', '#222'] });
    clip.chapters[0].backdrop = 'navy';
    const result = validate(clip);
    for (const path of ['design.cursor', 'design.backdrop', 'chapters[0].backdrop']) assert.ok(paths(result).includes(path), path);
});

test('dive, blur, image sources, and the phone list are checked', () => {
    const clip = cloneIris();
    clip.chapters[0].steps.push({ dive: 'coral', into: 'teal' }, { blur: 'phone.area:pool' }, { blur: false, amount: 99 });
    Object.assign(clip.screens.phone, { screen: 'lsit' });
    const result = validate(clip);
    const last = clip.chapters[0].steps.length - 1;
    assert.ok(paths(result).includes(`chapters[0].steps[${last - 2}].into`), 'dive "into" must be a colour');
    assert.ok(paths(result).includes(`chapters[0].steps[${last - 1}].blur`), 'blur keeps whole screens, not parts');
    assert.ok(result.warnings.some(w => w.path === `chapters[0].steps[${last}].amount`));
    assert.match(result.errors.find(e => e.path === 'screens.phone.screen').hint, /"list"/);

    const chat = cloneGossipt();
    const files = chat.screens.chat.files;
    files[0].src = 'media/q3.png';
    files[1].src = 'https://example.com/memo.jpg';
    files[2].src = 'data:image/png;base64,iVBORw0KGgo=';
    assert.equal(validate(chat).ok, true, formatReport(validate(chat)));
    for (const bad of ['../secret.png', '/etc/passwd.png', ['java', 'script:alert(1)'].join(''), 'http://example.com/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'notes.txt']) {
        files[0].src = bad;
        assert.ok(paths(validate(chat)).includes('screens.chat.files[0].src'), `${bad} should be refused`);
    }
});

test('a phone list needs rows with ids, and "toggle" needs a row with a switch', () => {
    const clip = cloneIris();
    Object.assign(clip.screens.phone, {
        screen: 'list',
        list: { title: 'Family', sections: [{ rows: [{ id: 'sunny', label: 'Sunny' }, { id: 'sunny', label: 'Again' }, { label: 'No id' }] }] }
    });
    clip.chapters[1].steps.push({ toggle: 'phone.row:sunny' }, { tap: 'phone.row:sunnny' });
    const result = validate(clip);
    const last = clip.chapters[1].steps.length - 1;
    assert.ok(paths(result).includes('screens.phone.list.sections[0].rows[1].id'), 'duplicate row id');
    assert.ok(paths(result).includes('screens.phone.list.sections[0].rows[2].id'), 'missing row id');
    assert.ok(paths(result).includes(`chapters[1].steps[${last - 1}].toggle`), 'a row without a switch');
    assert.match(result.errors.find(e => e.path === `chapters[1].steps[${last}].tap`).hint, /sunny/);
    delete clip.screens.phone.list;
    assert.ok(paths(validate(clip)).includes('screens.phone.list'), 'a list screen needs a list');
});
