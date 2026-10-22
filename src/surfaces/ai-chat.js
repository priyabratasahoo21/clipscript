/**
 * ai-chat: an AI assistant app with connectors. The user turns a connector
 * on, sends a prompt, and the assistant calls connector tools (each shown as
 * a block with its input and result) before replying.
 */

import { h, richText } from '../core/dom.js';
import { hasOwn, initials, isHexColor, isObject, nameColor, suggest } from '../core/util.js';
import styles from './ai-chat.css';
import { appIcon, appWindow, byData, typeInto } from './shared.js';

const CONNECTOR_ID = /^[A-Za-z_][\w-]*$/;

function validateChat(def, path, report, screens) {
    for (const key of ['assistant', 'model', 'user', 'title', 'greeting']) {
        if (def[key] !== undefined && typeof def[key] !== 'string') report.error(`${path}.${key}`, 'must be a string.');
    }
    if (def.recents !== undefined && (!Array.isArray(def.recents) || def.recents.some(item => typeof item !== 'string'))) {
        report.error(`${path}.recents`, 'must be an array of earlier chat titles.');
    }
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
        if (typeof connector.id !== 'string' || !CONNECTOR_ID.test(connector.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-".');
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

/** Assistant prose: paragraphs, "- " bullet lists, *bold*, and `code`, built as nodes. */
function prose(text) {
    const wrapper = h('div', { class: 'cs-ai-prose' });
    let list = null;
    for (const line of String(text).split('\n')) {
        if (line.startsWith('- ')) {
            list ??= wrapper.appendChild(h('ul'));
            list.append(h('li', {}, richText(line.slice(2))));
        } else {
            list = null;
            if (line.trim()) wrapper.append(h('p', {}, richText(line)));
        }
    }
    return wrapper;
}

function render(def, { screens }) {
    const assistant = def.assistant ?? def.app.name;
    const { el, body } = appWindow(def.app, { title: def.title ?? 'New chat', className: 'cs-aichat' });
    const connectors = Array.isArray(def.connectors) ? def.connectors : [];
    const enabled = new Set(connectors.filter(c => c.enabled).map(c => c.id));

    const sidebar = h('div', { class: 'cs-ai-side' }, [
        h('div', { class: 'cs-ai-new', text: '+ New chat' }),
        h('div', { class: 'cs-ai-label', text: 'Recents' }),
        h('div', { class: 'cs-ai-recent cs-active', text: def.title ?? 'New chat' }),
        ...(def.recents ?? []).map(title => h('div', { class: 'cs-ai-recent', text: title })),
        h('div', { class: 'cs-ai-user' }, [
            h('span', { class: 'cs-avatar', style: { '--avatar': nameColor(def.user ?? 'You') }, text: initials(def.user ?? 'You') }),
            h('span', { text: def.user ?? 'You' })
        ])
    ]);

    const firstName = String(def.user ?? '').split(/\s+/)[0];
    const empty = h('div', { class: 'cs-ai-empty' }, [
        h('span', { class: 'cs-ai-mark', 'aria-hidden': 'true' }, appIcon(def.app)),
        h('div', { class: 'cs-ai-greet', text: def.greeting ?? (firstName ? `Good to see you, ${firstName}` : 'How can I help?') })
    ]);
    const thread = h('div', { class: 'cs-ai-thread' }, empty);
    const typed = h('span', { class: 'cs-ai-typed' });
    const chips = h('span', { class: 'cs-ai-chips' });
    const menu = h('div', { class: 'cs-ai-menu' }, [
        h('div', { class: 'cs-ai-menu-label', text: 'Connectors' }),
        ...connectors.map(connector => {
            const brand = brandOf(connector, screens);
            return h('div', { class: 'cs-ai-conn', dataset: { connector: connector.id } }, [
                appIcon({ icon: brand.icon, name: brand.name }, brand.color),
                h('span', { class: 'cs-ai-conn-name', text: brand.name }),
                h('span', { class: enabled.has(connector.id) ? 'cs-switch cs-on' : 'cs-switch' }, h('i'))
            ]);
        })
    ]);
    const toolsButton = h('span', { class: 'cs-ai-tools', text: '⚙ Connectors' });
    const composer = h('div', { class: 'cs-ai-composer' }, [
        h('div', { class: 'cs-ai-input' }, [typed, h('span', { class: 'cs-ai-placeholder', text: `Reply to ${assistant}…` })]),
        h('div', { class: 'cs-ai-bar' }, [
            h('span', { class: 'cs-ai-plus', text: '+' }),
            toolsButton,
            chips,
            h('span', { class: 'cs-ai-model', text: def.model ?? assistant }),
            h('span', { class: 'cs-ai-send', text: '↑' })
        ]),
        menu
    ]);
    body.append(h('div', { class: 'cs-ai-main' }, [sidebar, h('div', { class: 'cs-ai-pane' }, [thread, composer])]));

    const refreshChips = () => {
        chips.replaceChildren(...connectors.filter(c => enabled.has(c.id)).map(connector => {
            const brand = brandOf(connector, screens);
            return h('span', { class: 'cs-ai-chip' }, [appIcon({ icon: brand.icon, name: brand.name }, brand.color), brand.name]);
        }));
    };
    refreshChips();
    const scroll = () => { thread.scrollTop = thread.scrollHeight; };

    return {
        el,
        find: (part, name) => (part === 'connector' ? byData(el, 'connector', name) : null),
        toolsButton,
        composer,
        typed,
        menu,
        openMenu(open) { menu.classList.toggle('cs-open', open); },
        enable(id) {
            enabled.add(id);
            byData(menu, 'connector', id)?.querySelector('.cs-switch')?.classList.add('cs-on');
            refreshChips();
        },
        addUser(text) {
            empty.remove();
            thread.append(h('div', { class: 'cs-ai-msg cs-ai-user-msg' }, h('div', { class: 'cs-ai-bubble', text })));
            scroll();
        },
        addThinking() {
            const node = h('div', { class: 'cs-ai-thinking' }, [h('span', { class: 'cs-ai-spark', text: '✶' }), 'Thinking…']);
            thread.append(node);
            scroll();
            return node;
        },
        addTool(connectorId, name, input) {
            const connector = connectors.find(c => c.id === connectorId);
            const brand = connector ? brandOf(connector, screens) : { name: connectorId ?? 'Tool', icon: '⚙', color: '#6b7280' };
            const status = h('span', { class: 'cs-ai-tool-status' });
            const result = h('div', { class: 'cs-ai-tool-result' });
            const block = h('div', { class: 'cs-ai-tool' }, [
                h('div', { class: 'cs-ai-tool-head' }, [
                    appIcon({ icon: brand.icon, name: brand.name }, brand.color),
                    h('span', { class: 'cs-ai-tool-name' }, [h('b', { text: brand.name }), ` · ${name}`]),
                    status
                ]),
                input !== undefined ? h('div', { class: 'cs-ai-tool-input', text: inputSummary(input) }) : null,
                result
            ]);
            thread.append(block);
            scroll();
            return { block, result };
        },
        addReply(text) {
            thread.append(h('div', { class: 'cs-ai-msg cs-ai-reply' }, [
                h('span', { class: 'cs-ai-mark', 'aria-hidden': 'true' }, appIcon(def.app)),
                prose(text)
            ]));
            scroll();
        }
    };
}

export default {
    name: 'ai-chat',
    summary: 'An AI assistant app with connectors: turn a connector on, send a prompt, and watch tool calls and the reply.',
    width: 520,
    keys: ['assistant', 'model', 'user', 'title', 'greeting', 'recents', 'connectors'],
    styles,
    parts: {
        connector: connectorIds
    },
    validate: validateChat,
    render,
    recap: view => view.openMenu(false),
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
                const toggle = row?.querySelector('.cs-switch');
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
            summary: 'Type a message into the composer and send it.',
            keys: [],
            validate(step, _def, path, report) {
                if (typeof step.prompt !== 'string' || !step.prompt) report.error(`${path}.prompt`, 'must be the message the user sends.');
            },
            async run(view, step, ctx) {
                await ctx.cursor.moveTo(view.composer, ctx, { dx: 0.3, dy: 0.3 });
                await ctx.cursor.click(ctx);
                view.composer.classList.add('cs-typing');
                await typeInto(view.typed, step.prompt, ctx, 22);
                await ctx.wait(350);
                view.typed.textContent = '';
                view.composer.classList.remove('cs-typing');
                view.addUser(step.prompt);
                ctx.cursor.hide();
                await ctx.wait(500);
            }
        },
        think: {
            summary: 'Show the assistant thinking for a moment (milliseconds).',
            keys: [],
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
                block.classList.add('cs-running');
                await ctx.wait(step.ms ?? 900);
                block.classList.remove('cs-running');
                block.classList.add('cs-ok');
                if (step.result) result.textContent = step.result;
                await ctx.wait(350);
            }
        },
        respond: {
            summary: 'The assistant replies. Supports paragraphs, "- " bullet lines, *bold*, and `code`.',
            keys: [],
            validate(step, _def, path, report) {
                if (typeof step.respond !== 'string' || !step.respond) report.error(`${path}.respond`, 'must be the assistant\'s reply text.');
            },
            async run(view, step, ctx) {
                view.addReply(step.respond);
                await ctx.wait(1800);
            }
        }
    }
};
