/**
 * ai-chat: an AI assistant app with connectors and file references. The user
 * turns a connector on, types a prompt (pulling files in with "@id"), and the
 * assistant calls connector tools (each shown as a block with its input and
 * result) before replying. Pointing at a reference pops up a preview card.
 */

import { h, rectIn, richText } from '../core/dom.js';
import { clamp, hasOwn, initials, isHexColor, isImageSource, isObject, nameColor, suggest } from '../core/util.js';
import styles from './ai-chat.css';
import { FILE_KINDS, fileIcon, fileThumb, kindOf } from './files.js';
import { appIcon, appWindow, byData } from './shared.js';

const ID = /^[A-Za-z_][\w-]*$/;
const LOOKS = ['warm', 'neutral'];
const AREAS = ['composer', 'thread', 'sidebar'];
const FILE_KEYS = ['id', 'name', 'kind', 'meta', 'src', 'preview'];
const PREVIEW_KEYS = ['title', 'lines', 'chart', 'rows', 'color'];
// "@id" at the start of a word refers to one of the screen's files
const REFERENCE = /(^|[\s([{"'])@([A-Za-z_][\w-]*)/g;
const TYPE_MS = 22;
const PEEK_MS = 1500;

function warnUnknownKeys(value, allowed, path, report) {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) report.warn(`${path}.${key}`, `"${key}" isn't a recognised key here and will be ignored.`, suggest(key, allowed));
    }
}

function validatePreview(preview, path, report) {
    if (!isObject(preview)) {
        report.error(path, 'must be an object like { "title": "Revenue", "chart": [3, 5, 8] }.');
        return;
    }
    warnUnknownKeys(preview, PREVIEW_KEYS, path, report);
    if (preview.title !== undefined && typeof preview.title !== 'string') report.error(`${path}.title`, 'must be a string.');
    if (preview.lines !== undefined && !(Array.isArray(preview.lines) && preview.lines.every(line => typeof line === 'string'))) {
        report.error(`${path}.lines`, 'must be an array of short text lines.');
    }
    const chartOk = Array.isArray(preview.chart) && preview.chart.length >= 2 && preview.chart.length <= 12
        && preview.chart.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
    if (preview.chart !== undefined && !chartOk) report.error(`${path}.chart`, 'must be 2–12 numbers of zero or more (the bar heights).');
    const rowsOk = Array.isArray(preview.rows) && preview.rows.length <= 8
        && preview.rows.every(row => Array.isArray(row) && row.length <= 5 && row.every(cell => typeof cell === 'string'));
    if (preview.rows !== undefined && !rowsOk) report.error(`${path}.rows`, 'must be up to 8 rows of up to 5 text cells; the first row is the header.');
    if (preview.color !== undefined && !isHexColor(preview.color)) report.error(`${path}.color`, 'must be a hex colour.');
}

function validateFiles(files, path, report) {
    if (!Array.isArray(files)) {
        report.error(path, 'must be an array: [{ "id": "q3", "name": "Q3 revenue.png", "kind": "image" }].');
        return;
    }
    const seen = new Set();
    files.forEach((file, i) => {
        const at = `${path}[${i}]`;
        if (!isObject(file)) {
            report.error(at, 'must be an object.');
            return;
        }
        warnUnknownKeys(file, FILE_KEYS, at, report);
        if (typeof file.id !== 'string' || !ID.test(file.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-"; prompts refer to it as "@id".');
        else if (seen.has(file.id)) report.error(`${at}.id`, `"${file.id}" is used twice.`);
        seen.add(file.id);
        if (typeof file.name !== 'string' || !file.name) report.error(`${at}.name`, 'must be the file name shown, e.g. "Q3 revenue.png".');
        if (file.kind !== undefined && !FILE_KINDS.includes(file.kind)) report.error(`${at}.kind`, `must be one of ${FILE_KINDS.join(', ')}.`, suggest(file.kind, FILE_KINDS));
        if (file.meta !== undefined && typeof file.meta !== 'string') report.error(`${at}.meta`, 'must be a short string, e.g. "PNG · 240 KB".');
        if (file.src !== undefined && !isImageSource(file.src)) {
            report.error(`${at}.src`, 'must be an image: an https:// URL, a path in the clip\'s folder like "media/q3.png", or a data:image/… URL (PNG, JPEG, GIF, WebP, or AVIF).');
        }
        if (file.preview !== undefined) validatePreview(file.preview, `${at}.preview`, report);
    });
}

function validateChat(def, path, report, screens) {
    for (const key of ['assistant', 'model', 'user', 'title', 'greeting', 'placeholder']) {
        if (def[key] !== undefined && typeof def[key] !== 'string') report.error(`${path}.${key}`, 'must be a string.');
    }
    if (def.look !== undefined && !LOOKS.includes(def.look)) report.error(`${path}.look`, `must be one of ${LOOKS.join(', ')}.`, suggest(def.look, LOOKS));
    if (def.recents !== undefined && (!Array.isArray(def.recents) || def.recents.some(item => typeof item !== 'string'))) {
        report.error(`${path}.recents`, 'must be an array of earlier chat titles.');
    }
    if (def.files !== undefined) validateFiles(def.files, `${path}.files`, report);
    if (def.connectors === undefined) return;
    if (!Array.isArray(def.connectors)) {
        report.error(`${path}.connectors`, 'must be an array: [{ "id": "books", "name": "Fastbooks", "app": "<screen id>" }].');
        return;
    }
    const seen = new Set();
    def.connectors.forEach((connector, i) => {
        const at = `${path}.connectors[${i}]`;
        if (!isObject(connector)) {
            report.error(at, 'must be an object.');
            return;
        }
        if (typeof connector.id !== 'string' || !ID.test(connector.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-".');
        else if (seen.has(connector.id)) report.error(`${at}.id`, `"${connector.id}" is used twice.`);
        seen.add(connector.id);
        if (typeof connector.name !== 'string' || !connector.name) report.error(`${at}.name`, 'must be a non-empty string.');
        if (connector.app !== undefined && !hasOwn(screens, connector.app)) {
            report.error(`${at}.app`, `"${connector.app}" isn't a screen id.`, suggest(connector.app, Object.keys(screens ?? {})));
        }
        if (connector.color !== undefined && !isHexColor(connector.color)) report.error(`${at}.color`, 'must be a hex colour.');
        if (connector.icon !== undefined && (typeof connector.icon !== 'string' || connector.icon.length > 4)) report.error(`${at}.icon`, 'must be 1–4 characters.');
        if (connector.enabled !== undefined && typeof connector.enabled !== 'boolean') report.error(`${at}.enabled`, 'must be true or false.');
    });
}

const connectorIds = def => (Array.isArray(def.connectors) ? def.connectors.map(c => c.id) : []);
const fileIds = def => (Array.isArray(def.files) ? def.files.filter(isObject).map(file => file.id) : []);
const referencesIn = text => [...String(text).matchAll(REFERENCE)].map(match => match[2]);

/** "@id" tokens must name one of the screen's files (when it has any). */
function checkReferences(text, def, path, report) {
    const ids = fileIds(def);
    if (!ids.length) return;
    for (const id of referencesIn(text)) {
        if (!ids.includes(id)) report.error(path, `"@${id}" isn't one of this screen's files.`, suggest(id, ids) ?? `Files: ${ids.map(f => `@${f}`).join(', ')}.`);
    }
}

function rememberReferences(facts, text) {
    facts.references ??= new Set();
    for (const id of referencesIn(text)) facts.references.add(id);
}

/** Split text into plain runs and references to known files. */
function segments(text, files) {
    const parts = [];
    let last = 0;
    for (const match of text.matchAll(REFERENCE)) {
        const file = files.get(match[2]);
        if (!file) continue;
        const start = match.index + match[1].length;
        if (start > last) parts.push({ text: text.slice(last, start) });
        parts.push({ file });
        last = start + 1 + match[2].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
}

const refChip = file => h('span', { class: 'cf-ai-ref', dataset: { file: file.id } }, [fileIcon(kindOf(file)), h('span', { text: file.name })]);

/** Text with references as highlighted chips; `format` renders the plain runs. */
const withReferences = (text, files, format = run => run) => segments(String(text), files).map(part => (part.file ? refChip(part.file) : format(part.text)));

function brandOf(connector, screens) {
    const app = connector.app && hasOwn(screens, connector.app) ? screens[connector.app].app : null;
    return {
        name: connector.name,
        icon: connector.icon ?? app?.icon ?? initials(connector.name),
        color: connector.color ?? app?.color ?? '#6b7280'
    };
}

/** One-line "key: value · key: value" summary of a tool's input. */
function inputSummary(input) {
    if (!isObject(input)) return '';
    return Object.entries(input)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? '{…}' : value}`)
        .join(' · ');
}

/** Assistant prose: paragraphs, "- " bullet lists, *bold*, `code`, and @references, built as nodes. */
function prose(text, files) {
    const wrapper = h('div', { class: 'cf-ai-prose' });
    let list = null;
    for (const line of String(text).split('\n')) {
        if (line.startsWith('- ')) {
            list ??= wrapper.appendChild(h('ul'));
            list.append(h('li', {}, withReferences(line.slice(2), files, richText)));
        } else {
            list = null;
            if (line.trim()) wrapper.append(h('p', {}, withReferences(line, files, richText)));
        }
    }
    return wrapper;
}

function render(def, { screens }) {
    const look = LOOKS.includes(def.look) ? def.look : 'warm';
    const assistant = def.assistant ?? def.app.name;
    const { el, body } = appWindow(def.app, { title: def.title ?? 'New chat', className: `cf-aichat cf-ai-${look}` });
    const connectors = Array.isArray(def.connectors) ? def.connectors : [];
    const enabled = new Set(connectors.filter(c => c.enabled).map(c => c.id));
    const files = new Map((Array.isArray(def.files) ? def.files : []).filter(file => isObject(file) && typeof file.id === 'string').map(file => [file.id, file]));

    const sidebar = h('div', { class: 'cf-ai-side' }, [
        h('div', { class: 'cf-ai-new', text: look === 'neutral' ? '✎  New chat' : '+ New chat' }),
        h('div', { class: 'cf-ai-label', text: look === 'neutral' ? 'Chats' : 'Recents' }),
        h('div', { class: 'cf-ai-recent cf-active', text: def.title ?? 'New chat' }),
        ...(def.recents ?? []).map(title => h('div', { class: 'cf-ai-recent', text: title })),
        h('div', { class: 'cf-ai-user' }, [
            h('span', { class: 'cf-avatar', style: { '--avatar': nameColor(def.user ?? 'You') }, text: initials(def.user ?? 'You') }),
            h('span', { text: def.user ?? 'You' })
        ])
    ]);

    const firstName = String(def.user ?? '').split(/\s+/)[0];
    const greeting = def.greeting ?? (look === 'neutral' ? 'How can I help today?' : firstName ? `Good to see you, ${firstName}` : 'How can I help?');
    const empty = h('div', { class: 'cf-ai-empty' }, [
        h('span', { class: 'cf-ai-mark', 'aria-hidden': 'true' }, appIcon(def.app)),
        h('div', { class: 'cf-ai-greet', text: greeting })
    ]);
    const thread = h('div', { class: 'cf-ai-thread' }, empty);
    const typed = h('span', { class: 'cf-ai-typed' });
    const caret = h('i', { class: 'cf-ai-caret', 'aria-hidden': 'true' });
    const chips = h('span', { class: 'cf-ai-chips' });
    const menu = h('div', { class: 'cf-ai-menu' }, [
        h('div', { class: 'cf-ai-menu-label', text: 'Connectors' }),
        ...connectors.map(connector => {
            const brand = brandOf(connector, screens);
            return h('div', { class: 'cf-ai-conn', dataset: { connector: connector.id } }, [
                appIcon({ icon: brand.icon, name: brand.name }, brand.color),
                h('span', { class: 'cf-ai-conn-name', text: brand.name }),
                h('span', { class: enabled.has(connector.id) ? 'cf-switch cf-on' : 'cf-switch' }, h('i'))
            ]);
        })
    ]);
    const picker = h('div', { class: 'cf-ai-menu cf-ai-picker' }, [
        h('div', { class: 'cf-ai-menu-label', text: 'Files' }),
        ...[...files.values()].map(file => h('div', { class: 'cf-ai-pick', dataset: { pick: file.id } }, [
            fileIcon(kindOf(file)),
            h('span', { class: 'cf-ai-pick-name', text: file.name }),
            file.meta ? h('span', { class: 'cf-ai-pick-meta', text: file.meta }) : null
        ]))
    ]);
    const toolsButton = h('span', { class: 'cf-ai-tools', text: look === 'neutral' ? '⚙ Tools' : '⚙ Connectors' });
    const sendButton = h('span', { class: 'cf-ai-send', text: '↑' });
    const placeholder = def.placeholder ?? (look === 'neutral' ? 'Ask anything' : `Reply to ${assistant}…`);
    const composer = h('div', { class: 'cf-ai-composer' }, [
        h('div', { class: 'cf-ai-input' }, [typed, caret, h('span', { class: 'cf-ai-placeholder', text: placeholder })]),
        h('div', { class: 'cf-ai-bar' }, [
            h('span', { class: 'cf-ai-plus', text: '+' }),
            toolsButton,
            chips,
            h('span', { class: 'cf-ai-model', text: def.model ?? assistant }),
            sendButton
        ]),
        menu,
        files.size ? picker : null
    ]);
    const peekCard = h('div', { class: 'cf-ai-peek', 'aria-hidden': 'true' });
    const pane = h('div', { class: 'cf-ai-pane' }, [thread, composer, peekCard]);
    body.append(h('div', { class: 'cf-ai-main' }, [sidebar, pane]));

    const refreshChips = () => {
        chips.replaceChildren(...connectors.filter(c => enabled.has(c.id)).map(connector => {
            const brand = brandOf(connector, screens);
            return h('span', { class: 'cf-ai-chip' }, [appIcon({ icon: brand.icon, name: brand.name }, brand.color), brand.name]);
        }));
    };
    refreshChips();
    const scroll = () => { thread.scrollTop = thread.scrollHeight; };
    const areas = { composer, thread, sidebar };

    return {
        el,
        files,
        toolsButton,
        sendButton,
        composer,
        typed,
        caret,
        menu,
        picker,
        draft: null,
        find(part, name) {
            if (part === 'connector') return byData(menu, 'connector', name);
            if (part === 'file') return [...el.querySelectorAll('.cf-ai-ref')].filter(node => node.dataset.file === name).at(-1) ?? null;
            if (part === 'area') return hasOwn(areas, name) ? areas[name] : null;
            return null;
        },
        openMenu(open) { menu.classList.toggle('cf-open', open); },
        /** Show the file picker filtered by what follows "@", with one file highlighted. */
        openPicker(query, activeId) {
            const needle = query.toLowerCase();
            for (const row of picker.querySelectorAll('.cf-ai-pick')) {
                const file = files.get(row.dataset.pick);
                row.hidden = !file.name.toLowerCase().includes(needle);
                row.classList.toggle('cf-active', row.dataset.pick === activeId);
            }
            picker.classList.add('cf-open');
        },
        closePicker() { picker.classList.remove('cf-open'); },
        enable(id) {
            enabled.add(id);
            byData(menu, 'connector', id)?.querySelector('.cf-switch')?.classList.add('cf-on');
            refreshChips();
        },
        /** Pop a preview card up beside a reference chip. */
        peek(file, chip) {
            peekCard.replaceChildren(
                h('div', { class: 'cf-ai-thumb' }, fileThumb(file)),
                h('div', { class: 'cf-ai-peek-info' }, [
                    fileIcon(kindOf(file)),
                    h('span', { class: 'cf-ai-peek-name', text: file.name }),
                    file.meta ? h('span', { class: 'cf-ai-peek-meta', text: file.meta }) : null
                ])
            );
            const at = rectIn(pane, chip);
            const width = peekCard.offsetWidth;
            const height = peekCard.offsetHeight;
            const left = clamp(at.x + at.w / 2 - width / 2, 10, pane.clientWidth - width - 10);
            const above = at.y - height - 10 >= 10;
            peekCard.style.setProperty('left', `${left}px`);
            peekCard.style.setProperty('top', `${above ? at.y - height - 10 : at.y + at.h + 10}px`);
            peekCard.style.setProperty('transform-origin', `${at.x + at.w / 2 - left}px ${above ? '100%' : '0%'}`);
            chip.classList.add('cf-hover');
            peekCard.classList.add('cf-open');
            return peekCard;
        },
        unpeek() {
            peekCard.classList.remove('cf-open');
            for (const chip of el.querySelectorAll('.cf-ai-ref.cf-hover')) chip.classList.remove('cf-hover');
        },
        addUser(text) {
            empty.remove();
            thread.append(h('div', { class: 'cf-ai-msg cf-ai-user-msg' }, h('div', { class: 'cf-ai-bubble' }, withReferences(text, files))));
            scroll();
        },
        addThinking() {
            const node = h('div', { class: 'cf-ai-thinking' }, [h('span', { class: 'cf-ai-spark', text: '✶' }), 'Thinking…']);
            thread.append(node);
            scroll();
            return node;
        },
        addTool(connectorId, name, input) {
            const connector = connectors.find(c => c.id === connectorId);
            const brand = connector ? brandOf(connector, screens) : { name: connectorId ?? assistant, icon: '⚙', color: '#6b7280' };
            const status = h('span', { class: 'cf-ai-tool-status' });
            const result = h('div', { class: 'cf-ai-tool-result' });
            const block = h('div', { class: 'cf-ai-tool' }, [
                h('div', { class: 'cf-ai-tool-head' }, [
                    appIcon({ icon: brand.icon, name: brand.name }, brand.color),
                    h('span', { class: 'cf-ai-tool-name' }, [h('b', { text: brand.name }), ` · ${name}`]),
                    status
                ]),
                input !== undefined ? h('div', { class: 'cf-ai-tool-input', text: inputSummary(input) }) : null,
                result
            ]);
            thread.append(block);
            scroll();
            return { block, result };
        },
        addReply(text) {
            thread.append(h('div', { class: 'cf-ai-msg cf-ai-reply' }, [
                h('span', { class: 'cf-ai-mark', 'aria-hidden': 'true' }, appIcon(def.app)),
                prose(text, files)
            ]));
            scroll();
        }
    };
}

/** Type a run of plain text, keeping the caret in view when the camera follows. */
async function typeRun(view, text, ctx) {
    const node = view.typed.appendChild(document.createTextNode(''));
    if (ctx.fast) {
        node.data = text;
        return;
    }
    let count = 0;
    for (const char of text) {
        node.data += char;
        count += 1;
        if (count % 3 === 0) ctx.camera?.track(view.caret, view.composer);
        await ctx.wait(TYPE_MS);
    }
}

/** Type "@" and the start of a file name, pick it from the menu, and leave a highlighted chip. */
async function typeReference(view, file, ctx) {
    if (ctx.fast) {
        view.typed.append(refChip(file));
        return;
    }
    const node = view.typed.appendChild(document.createTextNode(''));
    for (const char of `@${file.name.slice(0, 3)}`) {
        node.data += char;
        view.openPicker(node.data.slice(1), file.id);
        if (char === '@') ctx.camera?.track(view.picker);
        await ctx.wait(TYPE_MS * 3);
    }
    await ctx.wait(650);
    node.remove();
    view.typed.append(refChip(file));
    view.closePicker();
    ctx.camera?.track(view.caret, view.composer);
    await ctx.wait(180);
}

async function typeDraft(view, text, ctx) {
    view.typed.replaceChildren();
    for (const part of segments(text, view.files)) {
        if (part.file) await typeReference(view, part.file, ctx);
        else await typeRun(view, part.text, ctx);
    }
}

async function sendDraft(view, ctx) {
    view.unpeek();
    view.typed.replaceChildren();
    view.composer.classList.remove('cf-typing');
    view.addUser(view.draft ?? '');
    view.draft = null;
    ctx.cursor.hide();
    await ctx.wait(500);
}

export default {
    name: 'ai-chat',
    summary: 'An AI assistant app with connectors and @file references: switch a connector on, type a prompt, point at references, and watch tool calls and the reply.',
    width: 520,
    keys: ['assistant', 'model', 'user', 'title', 'greeting', 'placeholder', 'look', 'recents', 'connectors', 'files'],
    styles,
    parts: {
        connector: connectorIds,
        file: fileIds,
        area: () => AREAS
    },
    validate: validateChat,
    render,
    recap: view => {
        view.openMenu(false);
        view.closePicker();
        view.unpeek();
    },
    actions: {
        connect: {
            summary: 'Open the connectors menu and switch a connector on.',
            part: 'connector',
            keys: [],
            async run(view, _step, ctx) {
                await ctx.cursor.moveTo(view.toolsButton, ctx);
                await ctx.cursor.click(ctx);
                view.openMenu(true);
                await ctx.wait(500);
                const row = view.find('connector', ctx.name);
                const toggle = row?.querySelector('.cf-switch');
                if (toggle) {
                    await ctx.cursor.moveTo(toggle, ctx);
                    await ctx.cursor.click(ctx);
                }
                view.enable(ctx.name);
                await ctx.wait(700);
                view.openMenu(false);
                await ctx.wait(300);
            }
        },
        prompt: {
            summary: 'Type a message into the composer and send it. "@id" pulls in one of the screen\'s files; "draft": true leaves it unsent for a "send" step.',
            keys: ['draft'],
            follow: view => view.composer,
            validate(step, def, path, report) {
                if (typeof step.prompt !== 'string' || !step.prompt) report.error(`${path}.prompt`, 'must be the message the user sends.');
                else checkReferences(step.prompt, def, `${path}.prompt`, report);
                if (step.draft !== undefined && typeof step.draft !== 'boolean') report.error(`${path}.draft`, 'must be true or false.');
            },
            order(facts, step) {
                rememberReferences(facts, step.prompt);
                facts.draft = step.draft === true;
            },
            async run(view, step, ctx) {
                // bring the start of the box into view while the pointer travels there
                ctx.camera?.track(view.typed, view.composer);
                await ctx.cursor.moveTo(view.composer, ctx, { dx: 0.3, dy: 0.3 });
                await ctx.cursor.click(ctx);
                view.composer.classList.add('cf-typing');
                await typeDraft(view, step.prompt, ctx);
                view.draft = step.prompt;
                if (step.draft) return;
                await ctx.wait(350);
                await sendDraft(view, ctx);
            }
        },
        send: {
            summary: 'Send the message left in the composer by a "prompt" step with "draft": true. Use { "send": true }.',
            keys: [],
            follow: view => view.composer,
            validate(step, _def, path, report) {
                if (step.send !== true) report.error(`${path}.send`, 'must be true.');
            },
            order(facts, _step, path, report) {
                if (!facts.draft) report.warn(path, 'there is no draft to send; add a "prompt" step with "draft": true first.');
                facts.draft = false;
            },
            async run(view, _step, ctx) {
                if (view.draft === null) return;
                await ctx.cursor.moveTo(view.sendButton, ctx);
                await ctx.cursor.click(ctx);
                await sendDraft(view, ctx);
            }
        },
        hover: {
            summary: 'Point at a file reference in the chat: a preview card pops up. "zoom" (true or 1–2.5) moves the camera in on it; "ms" is how long it stays.',
            part: 'file',
            keys: ['zoom', 'ms'],
            validate(step, _def, path, report) {
                const zoomOk = step.zoom === undefined || typeof step.zoom === 'boolean'
                    || (typeof step.zoom === 'number' && step.zoom >= 1 && step.zoom <= 2.5);
                if (!zoomOk) report.error(`${path}.zoom`, 'must be true, false, or a zoom amount from 1 to 2.5.');
                if (step.ms !== undefined && (typeof step.ms !== 'number' || step.ms < 0 || step.ms > 10000)) report.error(`${path}.ms`, 'must be milliseconds between 0 and 10000.');
            },
            order(facts, step, path, report) {
                const id = String(step.hover).split(':').slice(1).join(':');
                if (!facts.references?.has(id)) report.warn(path, `"@${id}" isn't in the chat yet; mention it in a "prompt" or "respond" step first.`);
            },
            async run(view, step, ctx) {
                const chip = view.find('file', ctx.name);
                const file = view.files.get(ctx.name);
                if (!chip || !file || ctx.fast) return;
                await ctx.cursor.moveTo(chip, ctx, { dx: 0.35, dy: 0.6 });
                const card = view.peek(file, chip);
                await ctx.wait(300);
                const zoom = step.zoom === true ? 1 : step.zoom;
                if (zoom && ctx.camera) {
                    await ctx.camera.look(card, { zoom });
                    await ctx.wait(step.ms ?? PEEK_MS);
                    await ctx.camera.back();
                } else {
                    await ctx.wait(step.ms ?? PEEK_MS);
                }
                view.unpeek();
                await ctx.wait(250);
            }
        },
        think: {
            summary: 'Show the assistant thinking for a moment (milliseconds).',
            keys: [],
            follow: view => view.el.querySelector('.cf-ai-thread'),
            validate(step, _def, path, report) {
                if (typeof step.think !== 'number' || step.think < 0 || step.think > 10000) report.error(`${path}.think`, 'must be milliseconds between 0 and 10000.');
            },
            async run(view, step, ctx) {
                const node = view.addThinking();
                await ctx.wait(step.think);
                node.remove();
            }
        },
        tool: {
            summary: 'The assistant calls a connector tool: a block shows the tool, its input, then its result.',
            keys: ['connector', 'input', 'result', 'ms'],
            follow: view => view.el.querySelector('.cf-ai-thread'),
            validate(step, def, path, report) {
                if (typeof step.tool !== 'string' || !step.tool) report.error(`${path}.tool`, 'must be the tool name, e.g. "create_invoice".');
                const ids = connectorIds(def);
                if (step.connector !== undefined && !ids.includes(step.connector)) report.error(`${path}.connector`, `"${step.connector}" isn't one of this screen's connectors.`, suggest(step.connector, ids));
                if (step.input !== undefined && !isObject(step.input)) report.error(`${path}.input`, 'must be an object of the tool\'s arguments.');
                if (step.result !== undefined && typeof step.result !== 'string') report.error(`${path}.result`, 'must be a short string describing what came back.');
                if (step.ms !== undefined && (typeof step.ms !== 'number' || step.ms < 0 || step.ms > 10000)) report.error(`${path}.ms`, 'must be milliseconds between 0 and 10000.');
            },
            async run(view, step, ctx) {
                const { block, result } = view.addTool(step.connector, step.tool, step.input);
                block.classList.add('cf-running');
                await ctx.wait(step.ms ?? 900);
                block.classList.remove('cf-running');
                block.classList.add('cf-ok');
                if (step.result) result.textContent = step.result;
                await ctx.wait(350);
            }
        },
        respond: {
            summary: 'The assistant replies. Supports paragraphs, "- " bullet lines, *bold*, `code`, and @file references.',
            keys: [],
            follow: view => view.el.querySelector('.cf-ai-thread'),
            validate(step, def, path, report) {
                if (typeof step.respond !== 'string' || !step.respond) report.error(`${path}.respond`, 'must be the assistant\'s reply text.');
                else checkReferences(step.respond, def, `${path}.respond`, report);
            },
            order(facts, step) {
                rememberReferences(facts, step.respond);
            },
            async run(view, step, ctx) {
                view.addReply(step.respond);
                await ctx.wait(1800);
            }
        }
    }
};
