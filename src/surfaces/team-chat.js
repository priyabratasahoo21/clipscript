/**
 * team-chat: a team chat app with a channel sidebar, a message list,
 * reactions, and thread replies. Messages can come from people or from
 * another screen's app (shown with that app's icon and an APP badge).
 */

import { h, richText } from '../core/dom.js';
import { hasOwn, initials, isObject, nameColor, suggest } from '../core/util.js';
import { appWindow } from './shared.js';

function validateChat(def, path, report) {
    if (typeof def.channel !== 'string' || !def.channel) report.error(`${path}.channel`, 'is required: the channel shown, e.g. "sales-wins".');
    if (def.channels !== undefined && (!Array.isArray(def.channels) || def.channels.some(c => typeof c !== 'string'))) {
        report.error(`${path}.channels`, 'must be an array of channel names for the sidebar.');
    }
    if (def.workspace !== undefined && typeof def.workspace !== 'string') report.error(`${path}.workspace`, 'must be the workspace name.');
    if (def.members !== undefined && (typeof def.members !== 'number' || def.members < 0)) report.error(`${path}.members`, 'must be a member count.');
    if (def.history !== undefined) {
        if (!Array.isArray(def.history)) report.error(`${path}.history`, 'must be an array of earlier messages: [{ "from": "Sam", "text": "..." }].');
        else {
            def.history.forEach((message, i) => {
                if (!isObject(message) || typeof message.from !== 'string' || typeof message.text !== 'string' || (message.time !== undefined && typeof message.time !== 'string')) {
                    report.error(`${path}.history[${i}]`, 'needs "from" and "text" strings.');
                }
            });
        }
    }
}

function validateMessage(value, path, report, screens) {
    if (!isObject(value)) {
        report.error(path, 'must be { "from": "Name", "text": "..." } or { "app": "<screen id>", "text": "..." }.');
        return;
    }
    if (typeof value.text !== 'string' || !value.text) report.error(`${path}.text`, 'must be the message text (supports *bold* and `code`).');
    if (value.time !== undefined && typeof value.time !== 'string') report.error(`${path}.time`, 'must be a string.');
    if (value.app !== undefined && !hasOwn(screens, value.app)) {
        report.error(`${path}.app`, `"${value.app}" isn't a screen id.`, suggest(value.app, Object.keys(screens ?? {})));
    }
    if (value.app === undefined && typeof value.from !== 'string') report.error(`${path}.from`, 'is required when the message is not from an app.');
}

function avatar(sender) {
    return h('span', { class: 'cf-avatar', style: { '--avatar': sender.color }, text: sender.icon });
}

function senderOf(value, screens) {
    const app = value.app && hasOwn(screens, value.app) ? screens[value.app].app : null;
    if (app) return { name: app.name, icon: app.icon ?? initials(app.name), color: app.color ?? 'var(--cf-accent)', isApp: true };
    return { name: value.from, icon: initials(value.from), color: nameColor(value.from), isApp: false };
}

function messageEl(value, screens, time) {
    const sender = senderOf(value, screens);
    return h('div', { class: 'cf-msg' }, [
        avatar(sender),
        h('div', { class: 'cf-msg-main' }, [
            h('div', { class: 'cf-msg-head' }, [
                h('span', { class: 'cf-msg-name', text: sender.name }),
                sender.isApp ? h('span', { class: 'cf-badge', text: 'APP' }) : null,
                h('span', { class: 'cf-msg-time', text: value.time ?? time })
            ]),
            h('div', { class: 'cf-msg-text' }, richText(value.text))
        ])
    ]);
}

function render(def, { screens }) {
    const channels = Array.isArray(def.channels) ? def.channels : [def.channel];
    const list = channels.includes(def.channel) ? channels : [...channels, def.channel];
    const { el, body } = appWindow(def.app, { title: def.workspace, className: 'cf-chat' });

    const messages = h('div', { class: 'cf-msgs' }, (def.history ?? []).map(message => messageEl(message, screens, message.time ?? '9:12 AM')));
    body.append(h('div', { class: 'cf-chat-main' }, [
        h('div', { class: 'cf-chat-side' }, [
            h('div', { class: 'cf-side-label', text: 'Channels' }),
            ...list.map(name => h('div', { class: name === def.channel ? 'cf-chan cf-active' : 'cf-chan', text: `# ${name}` }))
        ]),
        h('div', { class: 'cf-chat-pane' }, [
            h('div', { class: 'cf-chat-head' }, [
                h('span', { text: `# ${def.channel}` }),
                typeof def.members === 'number' ? h('span', { class: 'cf-chat-members', text: `${def.members} members` }) : null
            ]),
            messages,
            h('div', { class: 'cf-composer', text: `Message #${def.channel}` })
        ])
    ]));

    const last = () => messages.lastElementChild?.querySelector('.cf-msg-main');
    return {
        el,
        find: () => null,
        add(value) {
            const message = messageEl(value, screens, 'now');
            message.classList.add('cf-new');
            messages.append(message);
            messages.scrollTop = messages.scrollHeight;
        },
        /** Add a reaction pill to the latest message; returns its counter so the caller can animate it. */
        react(emoji) {
            const main = last();
            if (!main) return null;
            const row = main.querySelector('.cf-reacts') ?? main.appendChild(h('div', { class: 'cf-reacts' }));
            const pill = h('span', { class: 'cf-react' }, [h('span', { text: emoji }), h('span', { class: 'cf-react-count', text: '1' })]);
            row.append(pill);
            messages.scrollTop = messages.scrollHeight;
            return pill.querySelector('.cf-react-count');
        },
        reply(value) {
            const main = last();
            if (!main) return;
            const thread = main.querySelector('.cf-thread') ?? main.appendChild(h('div', { class: 'cf-thread' }, h('div', { class: 'cf-thread-sum' })));
            thread.append(messageEl(value, screens, 'now'));
            const replies = thread.querySelectorAll('.cf-msg').length;
            thread.querySelector('.cf-thread-sum').textContent = `${replies} ${replies === 1 ? 'reply' : 'replies'}`;
            messages.scrollTop = messages.scrollHeight;
        }
    };
}

export default {
    name: 'team-chat',
    summary: 'A team chat app: channel sidebar, messages (from people or from another screen\'s app), reactions, and thread replies.',
    width: 430,
    keys: ['workspace', 'channel', 'channels', 'members', 'history'],
    parts: {},
    validate: validateChat,
    render,
    actions: {
        message: {
            summary: 'Post a message to the channel.',
            keys: [],
            follow: view => view.el.querySelector('.cf-msgs'),
            order: facts => { facts.messages += 1; },
            validate(step, _def, path, report, screens) {
                validateMessage(step.message, `${path}.message`, report, screens);
            },
            async run(view, step, ctx) {
                view.add(step.message);
                await ctx.wait(1300);
            }
        },
        react: {
            summary: 'Add a reaction to the latest message; the count animates up.',
            keys: [],
            follow: view => view.el.querySelector('.cf-msgs'),
            order(facts, _step, path, report) {
                if (facts.messages === 0) report.warn(path, 'there is no message to react to yet; add a "message" step or channel history first.');
            },
            validate(step, _def, path, report) {
                const value = step.react;
                if (!isObject(value) || typeof value.emoji !== 'string') report.error(`${path}.react`, 'must be { "emoji": "🎉", "count": 3 }.');
                else if (value.count !== undefined && (!Number.isInteger(value.count) || value.count < 1 || value.count > 99)) report.error(`${path}.react.count`, 'must be a whole number from 1 to 99.');
            },
            async run(view, step, ctx) {
                const counter = view.react(step.react.emoji);
                const target = step.react.count ?? 1;
                await ctx.animate(500, progress => {
                    if (counter) counter.textContent = String(Math.max(1, Math.round(target * progress)));
                });
                await ctx.wait(250);
            }
        },
        reply: {
            summary: 'Reply in a thread under the latest message.',
            keys: [],
            follow: view => view.el.querySelector('.cf-msgs'),
            order(facts, _step, path, report) {
                if (facts.messages === 0) report.warn(path, 'there is no message to reply to yet.');
            },
            validate(step, _def, path, report, screens) {
                validateMessage(step.reply, `${path}.reply`, report, screens);
            },
            async run(view, step, ctx) {
                view.reply(step.reply);
                await ctx.wait(1200);
            }
        }
    }
};
