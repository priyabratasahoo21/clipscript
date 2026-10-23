/**
 * browser-app: a web app in a browser window: tab and address bar, an app
 * header and side navigation, summary cards, and a data table. Rows marked
 * "new" appear with an `add` step; rows can change status, and opening one
 * shows its details in a drawer.
 */

import { h } from '../core/dom.js';
import { initials, isObject, suggest } from '../core/util.js';
import styles from './browser-app.css';
import { appIcon, byData } from './shared.js';

const ROW_ID = /^[\w-]+$/;
const TONES = ['ok', 'warn', 'danger', 'info', 'muted'];

/** Status label → tone, used when a row doesn't give one. */
function toneOf(status) {
    const text = String(status ?? '').toLowerCase();
    if (/(paid|done|complete|active|sent|success)/.test(text)) return text.includes('sent') ? 'info' : 'ok';
    if (/(overdue|failed|error|declined)/.test(text)) return 'danger';
    if (/(due|pending|draft|review)/.test(text)) return 'warn';
    return 'muted';
}

function validateApp(def, path, report) {
    for (const key of ['url', 'tab', 'company', 'title', 'active']) {
        if (def[key] !== undefined && typeof def[key] !== 'string') report.error(`${path}.${key}`, 'must be a string.');
    }
    if (def.nav !== undefined && (!Array.isArray(def.nav) || def.nav.some(item => typeof item !== 'string'))) report.error(`${path}.nav`, 'must be an array of navigation labels.');
    if (def.active !== undefined && Array.isArray(def.nav) && !def.nav.includes(def.active)) report.warn(`${path}.active`, `"${def.active}" isn't in nav.`, suggest(def.active, def.nav));
    if (def.summary !== undefined) {
        if (!Array.isArray(def.summary)) report.error(`${path}.summary`, 'must be an array of { "label", "value", "tone"? } cards.');
        else {
            def.summary.forEach((card, i) => {
                if (!isObject(card) || typeof card.label !== 'string' || typeof card.value !== 'string') report.error(`${path}.summary[${i}]`, 'needs "label" and "value" strings.');
                else if (card.tone !== undefined && !TONES.includes(card.tone)) report.error(`${path}.summary[${i}].tone`, `must be one of ${TONES.join(', ')}.`, suggest(card.tone, TONES));
            });
        }
    }
    if (!Array.isArray(def.columns) || def.columns.length === 0 || def.columns.some(c => typeof c !== 'string')) {
        report.error(`${path}.columns`, 'is required: an array of column headings, e.g. ["No.", "Customer", "Amount", "Status"].');
        return;
    }
    if (!Array.isArray(def.rows)) {
        report.error(`${path}.rows`, 'is required: an array of rows: [{ "id": "1042", "cells": [...], "status": "Sent" }].');
        return;
    }
    const seen = new Set();
    def.rows.forEach((row, i) => {
        const at = `${path}.rows[${i}]`;
        if (!isObject(row)) {
            report.error(at, 'must be an object.');
            return;
        }
        if (typeof row.id !== 'string' || !ROW_ID.test(row.id)) report.error(`${at}.id`, 'must be a short id (letters, digits, "_" or "-").');
        else if (seen.has(row.id)) report.error(`${at}.id`, `"${row.id}" is used twice.`);
        seen.add(row.id);
        const expected = def.columns.length - (row.status !== undefined ? 1 : 0);
        if (!Array.isArray(row.cells) || row.cells.some(c => !['string', 'number'].includes(typeof c))) report.error(`${at}.cells`, 'must be an array of strings or numbers.');
        else if (row.cells.length !== expected) report.warn(`${at}.cells`, `has ${row.cells.length} cells; with ${def.columns.length} columns${row.status !== undefined ? ' and a status' : ''} it should have ${expected}.`);
        if (row.status !== undefined && typeof row.status !== 'string') report.error(`${at}.status`, 'must be a string.');
        if (row.new !== undefined && typeof row.new !== 'boolean') report.error(`${at}.new`, 'must be true or false.');
        if (row.detail !== undefined && (!isObject(row.detail) || Object.values(row.detail).some(v => typeof v !== 'string'))) report.error(`${at}.detail`, 'must map labels to strings.');
    });
}

const rowIds = def => (Array.isArray(def.rows) ? def.rows.filter(isObject).map(row => row.id) : []);
const rowById = (def, id) => def.rows.find(row => isObject(row) && row.id === id);

function statusPill(status, tone) {
    return h('span', { class: `cf-pill cf-tone-${tone ?? toneOf(status)}`, text: status });
}

function render(def) {
    const { app } = def;
    const tab = h('div', { class: 'cf-bw-tab' }, [appIcon(app), h('span', { text: def.tab ?? `${def.title ?? 'Home'} · ${app.name}` }), h('span', { class: 'cf-bw-x', text: '×' })]);
    const chrome = h('div', { class: 'cf-bw-chrome' }, [
        h('div', { class: 'cf-bw-tabs' }, [h('span', { class: 'cf-bw-dots', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]), tab]),
        h('div', { class: 'cf-bw-bar' }, [
            h('span', { class: 'cf-bw-nav', text: '‹  ›  ⟳' }),
            h('div', { class: 'cf-bw-url' }, [h('span', { class: 'cf-bw-lock', text: '🔒' }), h('span', { text: def.url ?? 'app.example.com' })])
        ])
    ]);

    const header = h('div', { class: 'cf-ba-header' }, [
        h('div', { class: 'cf-ba-brand' }, [appIcon(app), h('span', { text: app.name.toLowerCase() })]),
        def.company ? h('div', { class: 'cf-ba-company', text: def.company }) : null,
        h('div', { class: 'cf-ba-search', text: 'Search' }),
        h('span', { class: 'cf-ba-new', text: '+ New' }),
        h('span', { class: 'cf-avatar cf-ba-avatar', style: { '--avatar': 'var(--app)' }, text: initials(def.company ?? app.name) })
    ]);
    const nav = h('div', { class: 'cf-ba-nav' }, (def.nav ?? []).map(item => h('div', { class: item === def.active ? 'cf-ba-link cf-active' : 'cf-ba-link', text: item })));

    const summary = Array.isArray(def.summary) && def.summary.length
        ? h('div', { class: 'cf-ba-cards' }, def.summary.map(card => h('div', { class: `cf-ba-card cf-tone-${card.tone ?? 'muted'}` }, [
            h('div', { class: 'cf-ba-card-label', text: card.label }),
            h('div', { class: 'cf-ba-card-value', text: card.value })
        ])))
        : null;

    const statusIndex = def.columns.length - 1;
    const rowEl = row => h('tr', { class: row.new ? 'cf-ba-row cf-pending' : 'cf-ba-row', dataset: { row: row.id } }, [
        ...row.cells.map(cell => h('td', { text: String(cell) })),
        row.status !== undefined ? h('td', {}, statusPill(row.status, row.tone)) : null
    ]);
    const tbody = h('tbody', {}, def.rows.map(rowEl));
    const table = h('table', { class: 'cf-ba-table' }, [
        h('thead', {}, h('tr', {}, def.columns.map((column, i) => h('th', { class: i === statusIndex ? 'cf-ba-status-col' : null, text: column })))),
        tbody
    ]);

    const drawerBody = h('div', { class: 'cf-ba-drawer-body' });
    const drawerTitle = h('div', { class: 'cf-ba-drawer-title' });
    const drawer = h('div', { class: 'cf-ba-drawer' }, [h('div', { class: 'cf-ba-drawer-head' }, [drawerTitle, h('span', { class: 'cf-bw-x', text: '×' })]), drawerBody]);
    const toast = h('div', { class: 'cf-ba-toast', role: 'status' });

    const page = h('div', { class: 'cf-ba-page' }, [
        h('div', { class: 'cf-ba-title-row' }, [h('div', { class: 'cf-ba-title', text: def.title ?? 'Overview' }), h('span', { class: 'cf-ba-primary', text: `Create ${(def.title ?? 'item').replace(/s$/, '').toLowerCase()}` })]),
        summary,
        h('div', { class: 'cf-ba-table-wrap' }, table)
    ]);
    const el = h('div', { class: 'cf-window cf-browser' }, [
        chrome,
        h('div', { class: 'cf-ba-app' }, [header, h('div', { class: 'cf-ba-body' }, [nav, page, drawer])]),
        toast
    ]);

    return {
        el,
        find: (part, name) => (part === 'row' ? byData(el, 'row', name) : null),
        reveal(id) {
            const row = byData(tbody, 'row', id);
            if (!row) return;
            row.classList.remove('cf-pending');
            row.classList.add('cf-added');
        },
        setStatus(id, status) {
            const cell = byData(tbody, 'row', id)?.lastElementChild;
            if (cell) cell.replaceChildren(statusPill(status));
        },
        select(id) {
            for (const row of tbody.children) row.classList.toggle('cf-selected', row.dataset.row === id);
            const data = rowById(def, id);
            if (!data) return;
            drawerTitle.textContent = `${def.columns[0]} ${data.cells[0]}`;
            const fields = def.columns.slice(1, data.cells.length).map((column, i) => [column, String(data.cells[i + 1])]);
            const extra = isObject(data.detail) ? Object.entries(data.detail) : [];
            drawerBody.replaceChildren(
                ...[...fields, ...extra].map(([label, value]) => h('div', { class: 'cf-ba-field' }, [h('span', { text: label }), h('b', { text: value })])),
                data.status ? h('div', { class: 'cf-ba-field' }, [h('span', { text: 'Status' }), statusPill(byData(tbody, 'row', id)?.querySelector('.cf-pill')?.textContent ?? data.status)]) : null
            );
            drawer.classList.add('cf-open');
        },
        showToast(text) {
            toast.textContent = `✓ ${text}`;
            toast.classList.add('cf-show');
        },
        hideToast() {
            toast.classList.remove('cf-show');
        }
    };
}

export default {
    name: 'browser-app',
    summary: 'A web app in a browser window: header, side navigation, summary cards, and a data table whose rows can appear, change status, and open in a drawer.',
    width: 560,
    keys: ['url', 'tab', 'company', 'title', 'nav', 'active', 'summary', 'columns', 'rows'],
    styles,
    parts: {
        row: rowIds
    },
    validate: validateApp,
    render,
    actions: {
        add: {
            summary: 'Reveal a row marked "new": true, highlighted as it appears.',
            part: 'row',
            keys: [],
            validate(step, def, path, report) {
                const id = String(step.add).split(':').slice(1).join(':');
                const row = Array.isArray(def.rows) ? rowById(def, id) : null;
                if (row && row.new !== true) report.warn(`${path}.add`, `row "${id}" is already visible; mark it "new": true so it appears on this step.`);
            },
            async run(view, _step, ctx) {
                view.reveal(ctx.name);
                await ctx.wait(650);
            }
        },
        status: {
            summary: 'Change a row\'s status pill, e.g. Draft → Sent.',
            part: 'row',
            keys: ['to'],
            validate(step, _def, path, report) {
                if (typeof step.to !== 'string' || !step.to) report.error(`${path}.to`, 'is required: the new status, e.g. "Paid".');
            },
            async run(view, step, ctx) {
                view.setStatus(ctx.name, step.to);
                await ctx.wait(700);
            }
        },
        select: {
            summary: 'Click a row to open its details in a drawer.',
            part: 'row',
            keys: [],
            async run(view, _step, ctx) {
                const row = view.find('row', ctx.name);
                if (row) {
                    await ctx.cursor.moveTo(row, ctx, { dx: 0.3 });
                    await ctx.cursor.click(ctx);
                }
                view.select(ctx.name);
                await ctx.wait(900);
            }
        },
        toast: {
            summary: 'Show a confirmation toast.',
            keys: [],
            validate(step, _def, path, report) {
                if (typeof step.toast !== 'string' || !step.toast) report.error(`${path}.toast`, 'must be the toast text.');
            },
            async run(view, step, ctx) {
                view.showToast(step.toast);
                await ctx.wait(1700);
                view.hideToast();
            }
        }
    }
};
