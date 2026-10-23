/**
 * phone: a frameless phone showing its lock screen or an app's settings-style
 * list. Notifications drop in, an assistant (Iris by default) lights the
 * screen edge, listens, and folds the pile into one summary card, and the
 * Screen Pool (the pill at the top) grows into live activities such as
 * music. In a list, switches toggle and rows answer taps with a touch ripple.
 * Cards come in three materials: liquid glass, light, and dark.
 */

import { h, rectIn, s } from '../core/dom.js';
import { clamp, hasOwn, initials, isHexColor, isObject, suggest } from '../core/util.js';
import styles from './phone.css';

const ID = /^[A-Za-z_][\w-]*$/;
export const MATERIALS = ['glass', 'light', 'dark'];
const POOL_KINDS = ['idle', 'music', 'iris'];
const SCREENS = ['lock', 'list'];
const AREAS = ['pool', 'clock', 'notes', 'summary', 'ask', 'list'];
const NOTE_KEYS = ['id', 'app', 'title', 'text', 'icon', 'color', 'time'];
const LIST_KEYS = ['title', 'circles', 'sections'];
const SECTION_KEYS = ['title', 'rows'];
const ROW_KEYS = ['id', 'label', 'icon', 'color', 'detail', 'value', 'toggle', 'chevron'];
const TAP_MS = 420;
const WALLPAPER = ['#6d5dfc', '#ff7eb3', '#46d6c8'];
const GLOW = ['#ff5f9e', '#ff9f43', '#ffd36e', '#5ee7ff', '#7f7bff', '#d46bff'];
// screen corner radius and the Screen Pool's inset, in px: [min, default, max]
const CORNER = [24, 42, 60];
const INSET = [4, 8, 16];
const MAX_NOTES = 5;
const TYPE_MS = 32;

function validateNote(note, path, report) {
    if (!isObject(note)) {
        report.error(path, 'must be { "app": "Messages", "title": "Sam", "text": "Dinner at 8?" }.');
        return;
    }
    for (const key of Object.keys(note)) {
        if (!NOTE_KEYS.includes(key)) report.warn(`${path}.${key}`, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, NOTE_KEYS));
    }
    if (note.id !== undefined && (typeof note.id !== 'string' || !ID.test(note.id))) report.error(`${path}.id`, 'must be a short id using letters, digits, "_" or "-".');
    for (const key of ['app', 'text']) {
        if (typeof note[key] !== 'string' || !note[key]) report.error(`${path}.${key}`, 'must be a non-empty string.');
    }
    for (const key of ['title', 'time']) {
        if (note[key] !== undefined && typeof note[key] !== 'string') report.error(`${path}.${key}`, 'must be a string.');
    }
    if (note.icon !== undefined && (typeof note.icon !== 'string' || [...note.icon].length > 3)) report.error(`${path}.icon`, 'must be 1–3 characters (a monogram or an emoji).');
    if (note.color !== undefined && !isHexColor(note.color)) report.error(`${path}.color`, 'must be a hex colour.');
}

function warnUnknown(value, allowed, path, report) {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) report.warn(`${path}.${key}`, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, allowed));
    }
}

/** An app screen: a big title, optional coloured circles, and grouped rows of settings. */
function validateList(list, path, report) {
    if (!isObject(list)) {
        report.error(path, 'must be { "title": "Family", "sections": [{ "rows": [{ "id": "sunny", "label": "Sunny" }] }] }.');
        return;
    }
    warnUnknown(list, LIST_KEYS, path, report);
    if (typeof list.title !== 'string' || !list.title) report.error(`${path}.title`, 'must be the screen title, e.g. "Family".');
    if (list.circles !== undefined && !(Array.isArray(list.circles) && list.circles.length <= 8 && list.circles.every(isHexColor))) {
        report.error(`${path}.circles`, 'must be up to 8 hex colours for the overlapping circles under the title.');
    }
    if (!Array.isArray(list.sections) || list.sections.length === 0 || list.sections.length > 6) {
        report.error(`${path}.sections`, 'must be 1–6 sections, each { "title": "Members", "rows": [...] }.');
        return;
    }
    const seen = new Set();
    list.sections.forEach((section, i) => {
        const at = `${path}.sections[${i}]`;
        if (!isObject(section)) {
            report.error(at, 'must be an object with "rows".');
            return;
        }
        warnUnknown(section, SECTION_KEYS, at, report);
        if (section.title !== undefined && typeof section.title !== 'string') report.error(`${at}.title`, 'must be a string.');
        if (!Array.isArray(section.rows) || section.rows.length === 0 || section.rows.length > 8) {
            report.error(`${at}.rows`, 'must be 1–8 rows, each { "id": "sunny", "label": "Sunny" }.');
            return;
        }
        section.rows.forEach((row, j) => {
            const rowAt = `${at}.rows[${j}]`;
            if (!isObject(row)) {
                report.error(rowAt, 'must be an object.');
                return;
            }
            warnUnknown(row, ROW_KEYS, rowAt, report);
            if (typeof row.id !== 'string' || !ID.test(row.id)) report.error(`${rowAt}.id`, 'must be a short id using letters, digits, "_" or "-".');
            else if (seen.has(row.id)) report.error(`${rowAt}.id`, `"${row.id}" is used twice.`);
            seen.add(row.id);
            if (typeof row.label !== 'string' || !row.label) report.error(`${rowAt}.label`, 'must be the row\'s label.');
            for (const key of ['detail', 'value']) {
                if (row[key] !== undefined && typeof row[key] !== 'string') report.error(`${rowAt}.${key}`, 'must be a string.');
            }
            for (const key of ['toggle', 'chevron']) {
                if (row[key] !== undefined && typeof row[key] !== 'boolean') report.error(`${rowAt}.${key}`, 'must be true or false.');
            }
            if (row.icon !== undefined && (typeof row.icon !== 'string' || [...row.icon].length > 3)) report.error(`${rowAt}.icon`, 'must be 1–3 characters (a monogram or an emoji).');
            if (row.color !== undefined && !isHexColor(row.color)) report.error(`${rowAt}.color`, 'must be a hex colour.');
        });
    });
}

const listRows = def => (isObject(def.list) && Array.isArray(def.list.sections)
    ? def.list.sections.flatMap(section => (Array.isArray(section?.rows) ? section.rows : [])).filter(isObject)
    : []);
const rowIds = def => listRows(def).filter(row => typeof row.id === 'string').map(row => row.id);

function validatePhone(def, path, report) {
    if (def.screen !== undefined && !SCREENS.includes(def.screen)) report.error(`${path}.screen`, `must be one of ${SCREENS.join(', ')}.`, suggest(def.screen, SCREENS));
    if (def.screen === 'list' && def.list === undefined) report.error(`${path}.list`, 'is required when "screen" is "list".');
    if (def.list !== undefined && def.screen !== 'list') report.warn(`${path}.list`, 'only shows when "screen" is "list"; until then its rows can\'t be toggled or tapped.', 'Add "screen": "list".');
    if (def.list !== undefined) validateList(def.list, `${path}.list`, report);
    for (const key of ['time', 'date', 'assistant']) {
        if (def[key] !== undefined && typeof def[key] !== 'string') report.error(`${path}.${key}`, 'must be a string.');
    }
    for (const [key, [min, , max]] of [['corner', CORNER], ['poolInset', INSET]]) {
        if (def[key] !== undefined && (typeof def[key] !== 'number' || def[key] < min || def[key] > max)) report.error(`${path}.${key}`, `must be a number from ${min} to ${max} (px).`);
    }
    if (def.glow !== undefined && !(Array.isArray(def.glow) && def.glow.length >= 2 && def.glow.length <= 7 && def.glow.every(isHexColor))) {
        report.error(`${path}.glow`, 'must be 2–7 hex colours for the assistant\'s edge light.');
    }
    if (def.material !== undefined && !MATERIALS.includes(def.material)) report.error(`${path}.material`, `must be one of ${MATERIALS.join(', ')}.`, suggest(def.material, MATERIALS));
    const wall = def.wallpaper;
    if (wall !== undefined && !(isHexColor(wall) || (Array.isArray(wall) && wall.length >= 1 && wall.length <= 3 && wall.every(isHexColor)))) {
        report.error(`${path}.wallpaper`, 'must be a hex colour or 1–3 hex colours, e.g. ["#6d5dfc", "#ff7eb3", "#46d6c8"].');
    }
    if (def.notifications === undefined) return;
    if (!Array.isArray(def.notifications)) {
        report.error(`${path}.notifications`, 'must be an array of notifications.');
        return;
    }
    if (def.notifications.length > MAX_NOTES) report.warn(`${path}.notifications`, `shows best with ${MAX_NOTES} or fewer.`);
    const seen = new Set();
    def.notifications.forEach((note, i) => {
        validateNote(note, `${path}.notifications[${i}]`, report);
        if (isObject(note) && typeof note.id === 'string') {
            if (seen.has(note.id)) report.error(`${path}.notifications[${i}].id`, `"${note.id}" is used twice.`);
            seen.add(note.id);
        }
    });
}

const noteIds = def => (Array.isArray(def.notifications) ? def.notifications.filter(n => isObject(n) && typeof n.id === 'string').map(n => n.id) : []);

function statusIcons() {
    return s('svg', { class: 'cf-ph-status-icons', viewBox: '0 0 66 12', width: '66', height: '12', 'aria-hidden': 'true' }, [
        ...[0, 1, 2, 3].map(i => s('rect', { x: i * 4.6, y: 8 - i * 2.4, width: '3.2', height: 3.6 + i * 2.4, rx: '0.9' })),
        s('path', { d: 'M27.5 3.6a8.6 8.6 0 0 1 11.6 0M29.5 6.1a5.6 5.6 0 0 1 7.6 0M31.6 8.6a2.6 2.6 0 0 1 3.4 0', fill: 'none', 'stroke-width': '1.7', 'stroke-linecap': 'round' }),
        s('rect', { x: '43', y: '1', width: '20', height: '10', rx: '3', fill: 'none', 'stroke-width': '1', opacity: '0.5' }),
        s('rect', { x: '44.6', y: '2.6', width: '14', height: '6.8', rx: '1.8' }),
        s('rect', { x: '63.6', y: '4', width: '1.6', height: '4', rx: '0.8', opacity: '0.5' })
    ]);
}

function noteCard(note) {
    const icon = h('span', { class: 'cf-ph-icon', style: { '--note': note.color ?? '#8e8e93' }, text: note.icon ?? initials(note.app) });
    return h('div', { class: 'cf-ph-note cf-ph-glass', dataset: note.id ? { note: note.id } : {} }, [
        icon,
        h('div', { class: 'cf-ph-note-body' }, [
            h('div', { class: 'cf-ph-note-head' }, [
                h('b', { text: note.title ?? note.app }),
                h('span', { class: 'cf-ph-time', text: note.time ?? 'now' })
            ]),
            h('div', { class: 'cf-ph-note-text', text: note.text })
        ])
    ]);
}

function rowView(row) {
    const trailing = [];
    if (row.value) trailing.push(h('span', { class: 'cf-ph-row-value', text: row.value }));
    if (row.toggle !== undefined) trailing.push(h('span', { class: row.toggle ? 'cf-ph-toggle cf-on' : 'cf-ph-toggle' }, h('i')));
    if (row.chevron) trailing.push(h('span', { class: 'cf-ph-chevron', 'aria-hidden': 'true', text: '›' }));
    return h('div', { class: 'cf-ph-row', dataset: { row: row.id } }, [
        row.icon || row.color ? h('span', { class: 'cf-ph-icon cf-ph-row-icon', style: { '--note': row.color ?? '#8e8e93' }, text: row.icon ?? initials(row.label) }) : null,
        h('div', { class: 'cf-ph-row-text' }, [h('span', { text: row.label }), row.detail ? h('small', { text: row.detail }) : null]),
        trailing.length ? h('div', { class: 'cf-ph-row-end' }, trailing) : null
    ]);
}

function listView(list) {
    return h('div', { class: 'cf-ph-list' }, [
        h('div', { class: 'cf-ph-list-title', text: list.title }),
        Array.isArray(list.circles) && list.circles.length
            ? h('div', { class: 'cf-ph-circles', 'aria-hidden': 'true' }, list.circles.map(color => h('i', { style: { '--circle': color } })))
            : null,
        ...list.sections.filter(isObject).flatMap(section => [
            section.title ? h('div', { class: 'cf-ph-section-title', text: section.title }) : null,
            h('div', { class: 'cf-ph-group cf-ph-glass' }, (section.rows ?? []).filter(isObject).map(rowView))
        ])
    ]);
}

const orb = () => h('span', { class: 'cf-ph-orb', 'aria-hidden': 'true' }, h('i'));
const bars = count => h('span', { class: 'cf-ph-wave', 'aria-hidden': 'true' }, Array.from({ length: count }, () => h('i')));

function render(def) {
    const material = MATERIALS.includes(def.material) ? def.material : 'glass';
    const assistant = def.assistant ?? 'Iris';
    const wall = Array.isArray(def.wallpaper) ? def.wallpaper : isHexColor(def.wallpaper) ? [def.wallpaper] : WALLPAPER;
    const notes = h('div', { class: 'cf-ph-notes' }, (def.notifications ?? []).filter(isObject).map(noteCard));
    const pool = h('div', { class: 'cf-ph-pool' });
    const askText = h('span', { class: 'cf-ph-ask-text' });
    const ask = h('div', { class: 'cf-ph-ask cf-ph-glass' }, [orb(), askText]);
    const glow = h('div', { class: 'cf-ph-glow', 'aria-hidden': 'true' }, h('i'));
    const onList = def.screen === 'list' && isObject(def.list);
    const clock = onList ? null : h('div', { class: 'cf-ph-clock' }, [
        h('div', { class: 'cf-ph-date', text: def.date ?? 'Tuesday, October 20' }),
        h('div', { class: 'cf-ph-big', text: def.time ?? '9:41' })
    ]);
    const list = onList ? listView(def.list) : null;
    const screen = h('div', {
        class: onList ? 'cf-ph-screen cf-ph-on-list' : 'cf-ph-screen',
        style: { '--wall-1': wall[0], '--wall-2': wall[1] ?? wall[0], '--wall-3': wall[2] ?? wall[1] ?? wall[0] }
    }, [
        h('div', { class: 'cf-ph-status' }, [h('span', { text: def.time ?? '9:41' }), statusIcons()]),
        clock,
        list,
        notes,
        ask,
        h('div', { class: 'cf-ph-home' }),
        glow,
        pool
    ]);
    const phone = h('div', { class: 'cf-phone' }, screen);
    const size = (value, [min, fallback, max]) => `${typeof value === 'number' ? clamp(value, min, max) : fallback}px`;
    const glowColors = Array.isArray(def.glow) && def.glow.every(isHexColor) ? def.glow : GLOW;
    const el = h('div', {
        class: `cf-phonewin cf-ph-mat-${material}`,
        style: {
            '--ph-corner': size(def.corner, CORNER),
            '--ph-inset': size(def.poolInset, INSET),
            // repeat the first colour so the rotating light loops seamlessly
            '--ph-glow': [...glowColors, glowColors[0]].join(', ')
        }
    }, phone);
    const areas = { pool, clock, notes, ask, list };
    let summary = null;

    return {
        el,
        assistant,
        notes,
        askText,
        find(part, name) {
            if (part === 'note') return [...notes.querySelectorAll('.cf-ph-note')].find(node => node.dataset.note === name) ?? null;
            if (part === 'row') return list ? [...list.querySelectorAll('.cf-ph-row')].find(node => node.dataset.row === name) ?? null : null;
            if (part === 'area') return name === 'summary' ? summary : hasOwn(areas, name) ? areas[name] : null;
            return null;
        },
        /** A touch ripple where a finger meets the screen (phones have no pointer). */
        touch(target) {
            const at = rectIn(screen, target);
            const ripple = h('span', { class: 'cf-ph-touch', 'aria-hidden': 'true', style: { left: `${at.x + at.w / 2}px`, top: `${at.y + at.h / 2}px` } });
            screen.append(ripple);
            ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        },
        /** Add a notification at the top; the others slide down to make room. */
        addNote(note) {
            const before = new Map([...notes.children].map(node => [node, node.offsetTop]));
            const card = noteCard(note);
            card.classList.add('cf-ph-new');
            notes.prepend(card);
            for (const [node, top] of before) {
                node.style.setProperty('transition', 'none');
                node.style.setProperty('transform', `translateY(${top - node.offsetTop}px)`);
            }
            void notes.offsetHeight;
            for (const node of before.keys()) {
                node.style.removeProperty('transition');
                node.style.removeProperty('transform');
            }
            while (notes.children.length > MAX_NOTES) notes.lastElementChild.remove();
            return card;
        },
        iris(on) {
            phone.classList.toggle('cf-ph-iris', on);
            if (!on) ask.classList.remove('cf-open');
        },
        openAsk() { ask.classList.add('cf-open'); },
        /** Fold every notification into one summary card. */
        collapse() {
            [...notes.children].forEach((node, i) => {
                node.style.setProperty('transition-delay', `${i * 60}ms`);
                node.classList.add('cf-ph-folding');
            });
        },
        showSummary(title, count) {
            notes.replaceChildren();
            summary = h('div', { class: 'cf-ph-summary cf-ph-glass' }, [
                h('div', { class: 'cf-ph-summary-head' }, [
                    h('span', { class: 'cf-ph-spark', text: '✦' }),
                    h('b', { text: title ?? `${count} notification${count === 1 ? '' : 's'}` }),
                    h('span', { class: 'cf-ph-time', text: `by ${assistant}` })
                ]),
                h('div', { class: 'cf-ph-summary-text' })
            ]);
            notes.append(summary);
            return summary.querySelector('.cf-ph-summary-text');
        },
        /** Morph the Screen Pool: idle pill, or a live activity (music, the assistant listening). */
        setPool(kind, { title, artist, art, expand } = {}) {
            pool.className = `cf-ph-pool cf-pool-${kind}${expand ? ' cf-pool-expanded' : ''}`;
            const artColors = Array.isArray(art) && art.length ? art : ['#ff7a59', '#7b2ff7'];
            const cover = h('span', { class: 'cf-ph-art', style: { '--art-1': artColors[0], '--art-2': artColors[1] ?? artColors[0] } });
            if (kind === 'music') {
                pool.replaceChildren(
                    cover,
                    h('div', { class: 'cf-ph-track' }, [h('b', { text: title ?? 'Now playing' }), h('span', { text: artist ?? '' })]),
                    bars(5),
                    h('div', { class: 'cf-ph-progress' }, [h('span', { text: '1:12' }), h('i', {}, h('b')), h('span', { text: '-2:31' })]),
                    h('div', { class: 'cf-ph-controls', 'aria-hidden': 'true' }, [h('span', { text: '⏮' }), h('span', { class: 'cf-ph-pause' }, [h('i'), h('i')]), h('span', { text: '⏭' })])
                );
                pool.style.setProperty('--wave', artColors[0]);
            } else if (kind === 'iris') {
                pool.replaceChildren(orb(), h('div', { class: 'cf-ph-track' }, [h('b', { text: assistant }), h('span', { text: 'Listening…' })]), bars(5));
                pool.style.setProperty('--wave', '#c79bff');
            } else {
                pool.replaceChildren();
            }
        }
    };
}

async function typeText(el, text, ctx) {
    if (ctx.fast) {
        el.textContent = text;
        return;
    }
    el.textContent = '';
    for (const word of text.split(/(\s+)/)) {
        el.textContent += word;
        if (word.trim()) await ctx.wait(TYPE_MS * Math.min(4, word.length));
    }
}

export default {
    name: 'phone',
    summary: 'A phone lock screen: notifications drop in, the assistant (Iris) lights the screen edge and summarises them, and the Screen Pool grows into live activities like music.',
    width: 170,
    keys: ['time', 'date', 'assistant', 'material', 'wallpaper', 'corner', 'poolInset', 'glow', 'notifications', 'screen', 'list'],
    styles,
    parts: {
        note: noteIds,
        row: rowIds,
        area: () => AREAS
    },
    validate: validatePhone,
    render,
    recap: view => view.iris(false),
    actions: {
        toggle: {
            summary: 'Flip a switch in the list: { "toggle": "phone.row:summaries" } (add "to": false to switch it off).',
            part: 'row',
            keys: ['to'],
            follow: (view, step) => view.find('row', String(step.toggle).split(':').slice(1).join(':')),
            validate(step, def, path, report) {
                const id = String(step.toggle).split(':').slice(1).join(':');
                const row = listRows(def).find(item => item.id === id);
                if (row && row.toggle === undefined) report.error(`${path}.toggle`, `row "${id}" has no switch; give it "toggle": false in the list.`);
                if (step.to !== undefined && typeof step.to !== 'boolean') report.error(`${path}.to`, 'must be true or false.');
            },
            async run(view, step, ctx) {
                const toggle = view.find('row', ctx.name)?.querySelector('.cf-ph-toggle');
                if (!toggle) return;
                if (!ctx.fast) view.touch(toggle);
                toggle.classList.toggle('cf-on', step.to !== false);
                await ctx.wait(ctx.fast ? 0 : 700);
            }
        },
        tap: {
            summary: 'Tap a row in the list: it highlights under a touch ripple.',
            part: 'row',
            keys: [],
            follow: (view, step) => view.find('row', String(step.tap).split(':').slice(1).join(':')),
            async run(view, _step, ctx) {
                const row = view.find('row', ctx.name);
                if (!row || ctx.fast) return;
                view.touch(row);
                row.classList.add('cf-pressed');
                await ctx.wait(TAP_MS);
                row.classList.remove('cf-pressed');
                await ctx.wait(300);
            }
        },
        notify: {
            summary: 'A notification drops onto the lock screen: { "notify": { "app": "Messages", "title": "Sam", "text": "Dinner at 8?" } }.',
            keys: [],
            follow: view => view.notes,
            validate(step, _def, path, report) {
                validateNote(step.notify, `${path}.notify`, report);
            },
            async run(view, step, ctx) {
                view.iris(false);
                view.addNote(step.notify);
                await ctx.wait(ctx.fast ? 0 : 900);
            }
        },
        ask: {
            summary: 'Ask the assistant something: the screen edge glows and the request is written out. Follow it with "summarize" or "pool".',
            keys: ['ms'],
            follow: view => view.find('area', 'ask'),
            validate(step, _def, path, report) {
                if (typeof step.ask !== 'string' || !step.ask) report.error(`${path}.ask`, 'must be what the viewer asks, e.g. "What did I miss?".');
                if (step.ms !== undefined && (typeof step.ms !== 'number' || step.ms < 0 || step.ms > 10000)) report.error(`${path}.ms`, 'must be milliseconds between 0 and 10000.');
            },
            order(facts) { facts.asked = true; },
            async run(view, step, ctx) {
                view.iris(true);
                await ctx.wait(ctx.fast ? 0 : 450);
                view.openAsk();
                await typeText(view.askText, step.ask, ctx);
                await ctx.wait(ctx.fast ? 0 : step.ms ?? 700);
            }
        },
        summarize: {
            summary: 'The assistant folds the notifications into one summary card and writes the summary out.',
            keys: ['title', 'ms'],
            follow: view => view.notes,
            validate(step, _def, path, report) {
                if (typeof step.summarize !== 'string' || !step.summarize) report.error(`${path}.summarize`, 'must be the summary text.');
                if (step.title !== undefined && typeof step.title !== 'string') report.error(`${path}.title`, 'must be a string, e.g. "3 apps · 7 notifications".');
                if (step.ms !== undefined && (typeof step.ms !== 'number' || step.ms < 0 || step.ms > 10000)) report.error(`${path}.ms`, 'must be milliseconds between 0 and 10000.');
            },
            order(facts, _step, path, report) {
                if (!facts.asked) report.warn(path, 'nobody asked yet; an "ask" step first makes the summary land.');
            },
            async run(view, step, ctx) {
                const count = view.notes.children.length;
                view.iris(true);
                view.collapse();
                await ctx.wait(ctx.fast ? 0 : 520 + count * 60);
                const text = view.showSummary(step.title, count);
                await typeText(text, step.summarize, ctx);
                await ctx.wait(ctx.fast ? 0 : 500);
                view.iris(false);
                await ctx.wait(ctx.fast ? 0 : step.ms ?? 900);
            }
        },
        pool: {
            summary: 'Morph the Screen Pool: "music" (with "title", "artist", "art" colours; "expand": true for the large card), "iris" (listening), or "idle".',
            keys: ['title', 'artist', 'art', 'expand', 'ms'],
            follow: view => view.find('area', 'pool'),
            validate(step, _def, path, report) {
                if (!POOL_KINDS.includes(step.pool)) report.error(`${path}.pool`, `must be one of ${POOL_KINDS.join(', ')}.`, suggest(step.pool, POOL_KINDS));
                for (const key of ['title', 'artist']) {
                    if (step[key] !== undefined && typeof step[key] !== 'string') report.error(`${path}.${key}`, 'must be a string.');
                }
                if (step.art !== undefined && !(Array.isArray(step.art) && step.art.length >= 1 && step.art.length <= 2 && step.art.every(isHexColor))) {
                    report.error(`${path}.art`, 'must be one or two hex colours for the cover art.');
                }
                if (step.expand !== undefined && typeof step.expand !== 'boolean') report.error(`${path}.expand`, 'must be true or false.');
                if (step.ms !== undefined && (typeof step.ms !== 'number' || step.ms < 0 || step.ms > 10000)) report.error(`${path}.ms`, 'must be milliseconds between 0 and 10000.');
            },
            async run(view, step, ctx) {
                view.iris(false);
                view.setPool(step.pool, step);
                await ctx.wait(ctx.fast ? 0 : step.ms ?? 900);
            }
        }
    }
};
