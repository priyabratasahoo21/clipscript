/**
 * crm-record: a CRM record with a stage path, fields (dropdowns where options
 * are given), and buttons.
 */

import { h } from '../core/dom.js';
import { isObject, suggest } from '../core/util.js';

const isStringList = value => Array.isArray(value) && value.every(item => typeof item === 'string');
import { appWindow, byData, typeInto } from './shared.js';

const stageFieldOf = record => record.stageField ?? 'Stage';
const buttonsOf = record => record.buttons ?? ['Save'];

/** Options for a dropdown field: the stage path for the stage field, or record.options[field]. */
function optionsFor(record, field) {
    if (field === stageFieldOf(record) && Array.isArray(record.stages)) return record.stages;
    return Array.isArray(record.options?.[field]) ? record.options[field] : null;
}

function validateRecord(def, path, report) {
    const record = def.record;
    if (!isObject(record)) {
        report.error(`${path}.record`, 'is required: { "title": "...", "fields": { "Stage": "Negotiation" } }.');
        return;
    }
    if (typeof record.title !== 'string' || !record.title) report.error(`${path}.record.title`, 'must be a non-empty string.');
    for (const key of ['module', 'type', 'stageField']) {
        if (record[key] !== undefined && typeof record[key] !== 'string') report.error(`${path}.record.${key}`, 'must be a string.');
    }
    if (record.options !== undefined && (!isObject(record.options) || !Object.values(record.options).every(isStringList))) {
        report.error(`${path}.record.options`, 'must map field names to arrays of option strings.');
    }
    if (!isObject(record.fields) || Object.keys(record.fields).length === 0) {
        report.error(`${path}.record.fields`, 'must be an object of field names to values, e.g. { "Amount": "$48,000" }.');
        return;
    }
    for (const [name, value] of Object.entries(record.fields)) {
        if (!['string', 'number'].includes(typeof value)) report.error(`${path}.record.fields.${name}`, 'must be a string or number.');
    }
    if (record.stages !== undefined) {
        if (!Array.isArray(record.stages) || record.stages.some(stage => typeof stage !== 'string')) {
            report.error(`${path}.record.stages`, 'must be an array of stage names.');
        } else {
            const field = stageFieldOf(record);
            if (!(field in record.fields)) report.error(`${path}.record.stageField`, `stage field "${field}" isn't in record.fields.`, suggest(field, Object.keys(record.fields)));
            else if (!record.stages.includes(String(record.fields[field]))) {
                report.error(`${path}.record.fields.${field}`, `"${record.fields[field]}" isn't one of record.stages.`, suggest(record.fields[field], record.stages));
            }
        }
    }
    if (record.buttons !== undefined && (!Array.isArray(record.buttons) || record.buttons.some(b => typeof b !== 'string'))) {
        report.error(`${path}.record.buttons`, 'must be an array of button labels; the first is the primary button.');
    }
    if (record.activity !== undefined) {
        if (!Array.isArray(record.activity)) report.error(`${path}.record.activity`, 'must be an array of { "text": "...", "time": "..." } entries, newest first.');
        else {
            record.activity.forEach((item, i) => {
                if (!isObject(item) || typeof item.text !== 'string' || (item.time !== undefined && typeof item.time !== 'string')) {
                    report.error(`${path}.record.activity[${i}]`, 'needs a "text" string (and optionally a "time" string).');
                }
            });
        }
    }
}

function activityItem(item, isNew = false) {
    return h('li', { class: isNew ? 'cf-act cf-new' : 'cf-act' }, [
        h('span', { class: 'cf-act-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'cf-act-text', text: item.text }),
        item.time ? h('span', { class: 'cf-act-time', text: item.time }) : null
    ]);
}

function render(def) {
    const { record } = def;
    const stages = Array.isArray(record.stages) ? record.stages : [];
    const { el, body } = appWindow(def.app, { title: record.module ?? 'Records', className: 'cf-crm' });
    const path = stages.length ? h('div', { class: 'cf-path' }, stages.map(stage => h('span', { dataset: { stage }, text: stage }))) : null;

    const fields = Object.entries(record.fields).map(([name, value]) => {
        const options = optionsFor(record, name);
        const control = options
            ? h('div', { class: 'cf-select' }, [
                h('span', { class: 'cf-val', text: String(value) }),
                h('span', { class: 'cf-caret', text: '▾' }),
                h('div', { class: 'cf-menu' }, options.map(option => h('div', { class: 'cf-opt', dataset: { value: option }, text: option })))
            ])
            : h('div', { class: 'cf-val', text: String(value) });
        return h('div', { class: 'cf-field', dataset: { field: name } }, [h('label', { text: name }), control]);
    });

    const buttons = buttonsOf(record).map((label, i) => h('button', {
        class: i === 0 ? 'cf-btn cf-primary' : 'cf-btn',
        type: 'button',
        tabindex: '-1',
        dataset: { button: label },
        text: label
    }));
    const toast = h('div', { class: 'cf-toast', role: 'status' });
    const activity = h('ul', { class: 'cf-activity-list' }, (record.activity ?? []).map(item => activityItem(item)));

    body.append(
        h('div', { class: 'cf-crm-head' }, [
            h('div', { class: 'cf-crm-type', text: record.type ?? 'Record' }),
            h('div', { class: 'cf-crm-title', text: record.title }),
            path
        ]),
        h('div', { class: 'cf-crm-tabs' }, [h('span', { class: 'cf-active', text: 'Details' }), h('span', { text: 'Activity' }), h('span', { text: 'Files' })]),
        h('div', { class: 'cf-crm-fields' }, fields),
        h('div', { class: 'cf-activity' }, [h('div', { class: 'cf-activity-label', text: 'Recent activity' }), activity]),
        h('div', { class: 'cf-crm-actions' }, buttons)
    );
    el.append(toast);
    let changedStage = null;

    const view = {
        el,
        find: (part, name) => (part === 'field' ? byData(el, 'field', name) : part === 'button' ? byData(el, 'button', name) : null),
        setStage(value) {
            if (!path) return;
            const index = stages.indexOf(value);
            [...path.children].forEach((chip, i) => {
                chip.classList.toggle('cf-done', i < index);
                chip.classList.toggle('cf-current', i === index);
                chip.classList.toggle('cf-won', i === index && index === stages.length - 1);
            });
        },
        setField(name, value) {
            const field = byData(el, 'field', name);
            if (!field) return;
            field.querySelector('.cf-val').textContent = value;
            field.classList.add('cf-dirty');
            if (name === stageFieldOf(record)) {
                view.setStage(value);
                changedStage = value;
            }
        },
        save() {
            const changed = el.querySelectorAll('.cf-dirty');
            for (const field of changed) field.classList.remove('cf-dirty');
            if (changed.length) {
                const text = changedStage ? `Stage changed to ${changedStage}` : 'Record updated';
                activity.prepend(activityItem({ text, time: 'just now' }, true));
                changedStage = null;
            }
        },
        showToast(text) {
            toast.textContent = `✓ ${text}`;
            toast.classList.add('cf-show');
        },
        hideToast() {
            toast.classList.remove('cf-show');
        },
        closeMenus() {
            for (const select of el.querySelectorAll('.cf-select.cf-open')) select.classList.remove('cf-open');
        }
    };
    view.setStage(String(record.fields[stageFieldOf(record)] ?? ''));
    return view;
}

export default {
    name: 'crm-record',
    summary: 'A CRM record: title, stage path, fields (dropdowns where options exist), and buttons.',
    width: 430,
    keys: ['record'],
    parts: {
        field: def => Object.keys(def.record?.fields ?? {}),
        button: def => buttonsOf(def.record ?? {})
    },
    validate: validateRecord,
    render,
    recap: view => view.closeMenus(),
    actions: {
        choose: {
            summary: 'Open a dropdown field and pick a value.',
            part: 'field',
            keys: ['value'],
            validate(step, def, path, report) {
                const field = String(step.choose).split(':').slice(1).join(':');
                const options = def.record ? optionsFor(def.record, field) : null;
                if (!options) report.error(`${path}.choose`, `field "${field}" isn't a dropdown; give it options via record.stages or record.options.`);
                else if (!options.includes(step.value)) report.error(`${path}.value`, `"${step.value}" isn't an option for ${field}.`, suggest(step.value, options));
            },
            async run(view, step, ctx) {
                const select = view.find('field', ctx.name)?.querySelector('.cf-select');
                if (!select) return;
                await ctx.cursor.moveTo(select, ctx);
                await ctx.cursor.click(ctx);
                select.classList.add('cf-open');
                await ctx.wait(500);
                const option = byData(select, 'value', step.value);
                if (option) {
                    await ctx.cursor.moveTo(option, ctx);
                    option.classList.add('cf-hover');
                    await ctx.cursor.click(ctx);
                }
                select.classList.remove('cf-open');
                view.setField(ctx.name, step.value);
                await ctx.wait(400);
            }
        },
        type: {
            summary: 'Type into a field.',
            part: 'field',
            keys: ['text'],
            validate(step, _def, path, report) {
                if (typeof step.text !== 'string') report.error(`${path}.text`, 'must be the text to type.');
            },
            async run(view, step, ctx) {
                const field = view.find('field', ctx.name);
                const value = field?.querySelector('.cf-val');
                if (!value) return;
                await ctx.cursor.moveTo(value, ctx);
                await ctx.cursor.click(ctx);
                field.classList.add('cf-editing');
                await typeInto(value, step.text, ctx);
                field.classList.remove('cf-editing');
                field.classList.add('cf-dirty');
                await ctx.wait(300);
            }
        },
        click: {
            summary: 'Click a button. Clicking the primary (first) button saves the record.',
            part: 'button',
            keys: [],
            async run(view, _step, ctx) {
                const button = view.find('button', ctx.name);
                if (!button) return;
                await ctx.cursor.moveTo(button, ctx);
                button.classList.add('cf-pressed');
                await ctx.cursor.click(ctx);
                button.classList.remove('cf-pressed');
                if (button.classList.contains('cf-primary')) view.save();
                await ctx.wait(250);
            }
        },
        toast: {
            summary: 'Show a confirmation toast, e.g. "Saved".',
            keys: [],
            validate(step, _def, path, report) {
                if (typeof step.toast !== 'string' || !step.toast) report.error(`${path}.toast`, 'must be the toast text, e.g. "Opportunity saved".');
            },
            async run(view, step, ctx) {
                view.showToast(step.toast);
                await ctx.wait(1700);
                view.hideToast();
            }
        }
    }
};
