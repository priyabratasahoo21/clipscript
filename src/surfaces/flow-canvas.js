/**
 * flow-canvas: a node-based automation editor. Nodes sit on a dotted canvas
 * joined by wires; running a node marks it done and lights its outgoing
 * wire with an item count. Opening a node shows its input and parameters,
 * where an expression resolves to a live result.
 */

import { h, jsonNodes, rectIn, s } from '../core/dom.js';
import { hasOwn, initials, isHexColor, isObject, suggest } from '../core/util.js';
import { appIcon, appWindow, byData, typeInto } from './shared.js';

const NODE_ID = /^[A-Za-z_][\w-]*$/;
const MAX_NODES = 6;

function validateFlow(def, path, report, screens) {
    if (def.workflow !== undefined && typeof def.workflow !== 'string') report.error(`${path}.workflow`, 'must be the workflow name.');
    if (!Array.isArray(def.nodes) || def.nodes.length < 2) {
        report.error(`${path}.nodes`, 'must be an array of at least 2 nodes: [{ "id": "trigger", "title": "...", "sub": "..." }, ...].');
        return;
    }
    if (def.nodes.length > MAX_NODES) report.warn(`${path}.nodes`, `has ${def.nodes.length} nodes; more than ${MAX_NODES} get cramped.`);
    const seen = new Set();
    def.nodes.forEach((node, i) => {
        const at = `${path}.nodes[${i}]`;
        if (!isObject(node)) {
            report.error(at, 'must be an object.');
            return;
        }
        if (typeof node.id !== 'string' || !NODE_ID.test(node.id)) report.error(`${at}.id`, 'must be a short id using letters, digits, "_" or "-".');
        else if (seen.has(node.id)) report.error(`${at}.id`, `"${node.id}" is used twice; node ids must be unique.`);
        seen.add(node.id);
        if (typeof node.title !== 'string' || !node.title) report.error(`${at}.title`, 'must be a non-empty string.');
        if (node.sub !== undefined && typeof node.sub !== 'string') report.error(`${at}.sub`, 'must be a string.');
        if (node.params !== undefined && (!isObject(node.params) || Object.values(node.params).some(v => !['string', 'number', 'boolean'].includes(typeof v)))) {
            report.error(`${at}.params`, 'must map parameter names to strings, numbers, or booleans.');
        }
        if (node.app !== undefined && !hasOwn(screens, node.app)) {
            report.error(`${at}.app`, `"${node.app}" isn't a screen id; use it to borrow that screen's app icon and colour.`, suggest(node.app, Object.keys(screens ?? {})));
        }
        if (node.color !== undefined && !isHexColor(node.color)) report.error(`${at}.color`, 'must be a hex colour.');
        if (node.icon !== undefined && (typeof node.icon !== 'string' || node.icon.length > 4)) report.error(`${at}.icon`, 'must be 1–4 characters.');
        if (node.trigger !== undefined && typeof node.trigger !== 'boolean') report.error(`${at}.trigger`, 'must be true or false.');
    });
}

function nodeBrand(node, screens) {
    const app = node.app && hasOwn(screens, node.app) ? screens[node.app].app : null;
    return {
        icon: node.icon ?? app?.icon ?? initials(node.title),
        color: node.color ?? app?.color ?? null
    };
}

const isTrigger = (node, index) => node.trigger ?? index === 0;
const itemCount = output => (Array.isArray(output) ? output.length : 1);

/** Wire from one node tile's output handle to the next tile's input. */
function wireGeometry(canvas, fromTile, toTile) {
    const a = rectIn(canvas, fromTile);
    const b = rectIn(canvas, toTile);
    const x1 = a.x + a.w + 6;
    const y1 = a.y + a.h / 2;
    const x2 = b.x - 8;
    const y2 = b.y + b.h / 2;
    const bend = Math.max(24, (x2 - x1) * 0.5);
    return {
        d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        arrow: `M ${x2 - 7} ${y2 - 5} L ${x2 + 1} ${y2} L ${x2 - 7} ${y2 + 5} Z`,
        mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
    };
}

function render(def, { screens }) {
    const { el, body } = appWindow(def.app, {
        title: def.workflow ?? 'Workflow',
        trailing: [
            h('span', { class: 'cs-flow-tabs' }, [h('span', { class: 'cs-flow-tab cs-active', text: 'Editor' }), h('span', { class: 'cs-flow-tab', text: 'Executions' })]),
            h('span', { class: 'cs-toggle' }, [h('span', { class: 'cs-switch' }, h('i')), 'Active']),
            h('span', { class: 'cs-save', text: 'Save' })
        ],
        className: 'cs-flow'
    });

    const lastIndex = def.nodes.length - 1;
    const nodeEls = def.nodes.map((node, i) => {
        const brand = nodeBrand(node, screens);
        const trigger = isTrigger(node, i);
        return h('div', {
            class: trigger ? 'cs-node cs-trigger' : 'cs-node',
            dataset: { node: node.id },
            style: brand.color ? { '--node': brand.color } : undefined
        }, [
            h('div', { class: 'cs-node-tile' }, [
                trigger ? h('span', { class: 'cs-node-bolt', 'aria-hidden': 'true', text: '⚡' }) : h('span', { class: 'cs-handle cs-handle-in' }),
                h('span', { class: 'cs-node-icon', text: brand.icon }),
                i < lastIndex ? h('span', { class: 'cs-handle cs-handle-out' }) : null,
                h('span', { class: 'cs-node-badge', 'aria-hidden': 'true' })
            ]),
            h('div', { class: 'cs-node-title', text: node.title }),
            node.sub ? h('div', { class: 'cs-node-sub', text: node.sub }) : null,
            h('div', { class: 'cs-node-meta' })
        ]);
    });

    const wires = s('svg', { class: 'cs-wires', 'aria-hidden': 'true' });
    const status = h('span', { class: 'cs-run-status' });
    const canvas = h('div', { class: 'cs-canvas' }, [
        h('div', { class: 'cs-rail', 'aria-hidden': 'true' }, [h('i', { class: 'cs-rail-on' }), h('i'), h('i'), h('i')]),
        wires,
        h('div', { class: 'cs-nodes' }, nodeEls),
        h('div', { class: 'cs-canvas-bar' }, [h('span', { class: 'cs-test-btn', text: '▶ Test workflow' }), status])
    ]);

    // node details: input data on the left, parameters on the right
    const ndvTitle = h('div', { class: 'cs-ndv-title' });
    const ndvInput = h('div', { class: 'cs-ndv-col cs-ndv-input' });
    const ndvParams = h('div', { class: 'cs-ndv-col cs-ndv-params' });
    const ndv = h('div', { class: 'cs-ndv' }, h('div', { class: 'cs-ndv-panel' }, [
        h('div', { class: 'cs-ndv-head' }, [h('span', { class: 'cs-ndv-back', text: '← Back to canvas' }), ndvTitle]),
        h('div', { class: 'cs-ndv-cols' }, [ndvInput, ndvParams])
    ]));
    canvas.append(ndv);

    const outputTitle = h('span', { class: 'cs-output-title', text: 'Output' });
    const outputCount = h('span', { class: 'cs-output-count' });
    const outputData = h('pre');
    const output = h('div', { class: 'cs-output' }, [
        h('div', { class: 'cs-output-head' }, [
            outputTitle,
            outputCount,
            h('span', { class: 'cs-output-tabs' }, [h('span', { text: 'Table' }), h('span', { class: 'cs-active', text: 'JSON' })])
        ]),
        outputData
    ]);
    body.append(canvas, output);

    const state = { ran: 0, totalMs: 0, wires: [], outputs: {} };
    const nodeById = id => def.nodes.find(node => node.id === id);

    return {
        el,
        state,
        find: (part, name) => (part === 'node' ? byData(el, 'node', name) : null),
        drawWires() {
            const lit = state.wires.map(wire => wire.group.classList.contains('cs-lit'));
            const labels = state.wires.map(wire => wire.label.textContent);
            wires.replaceChildren();
            wires.setAttribute('width', String(canvas.offsetWidth));
            wires.setAttribute('height', String(canvas.offsetHeight));
            state.wires = nodeEls.slice(0, -1).map((nodeEl, i) => {
                const geometry = wireGeometry(canvas, nodeEl.querySelector('.cs-node-tile'), nodeEls[i + 1].querySelector('.cs-node-tile'));
                const label = s('text', { class: 'cs-wire-label', x: String(geometry.mid.x), y: String(geometry.mid.y - 10), 'text-anchor': 'middle' }, labels[i] ?? '');
                const group = s('g', { class: lit[i] ? 'cs-wire cs-lit' : 'cs-wire' }, [
                    s('path', { class: 'cs-wire-line', d: geometry.d }),
                    s('path', { class: 'cs-wire-arrow', d: geometry.arrow }),
                    label
                ]);
                wires.append(group);
                return { group, label };
            });
        },
        markRunning(id, running) {
            byData(el, 'node', id)?.classList.toggle('cs-running', running);
        },
        markDone(id, ms, result, output) {
            const nodeEl = byData(el, 'node', id);
            if (!nodeEl) return;
            nodeEl.classList.add('cs-ok');
            nodeEl.querySelector('.cs-node-meta').textContent = [typeof ms === 'number' ? `${ms} ms` : null, result].filter(Boolean).join(' · ');
            const wire = state.wires[nodeEls.indexOf(nodeEl)];
            if (wire) {
                const count = itemCount(output);
                wire.label.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
                wire.group.classList.add('cs-lit');
            }
            if (output !== undefined) state.outputs[id] = output;
            state.ran += 1;
            state.totalMs += typeof ms === 'number' ? ms : 0;
            status.textContent = state.ran >= def.nodes.length
                ? `✓ Workflow executed successfully · ${state.totalMs} ms`
                : `Running · ${state.ran} of ${def.nodes.length}`;
            status.classList.toggle('cs-ok', state.ran >= def.nodes.length);
        },
        showOutput(id, data) {
            outputTitle.textContent = `Output · ${nodeById(id)?.title ?? id}`;
            const count = itemCount(data);
            outputCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
            outputData.replaceChildren(jsonNodes(data));
            output.classList.add('cs-open');
        },
        openDetails(id) {
            const node = nodeById(id);
            const index = def.nodes.indexOf(node);
            const brand = nodeBrand(node, screens);
            ndvTitle.replaceChildren(
                appIcon({ icon: brand.icon, name: node.title }, brand.color ?? undefined),
                h('div', {}, [h('div', { class: 'cs-ndv-name', text: node.title }), node.sub ? h('div', { class: 'cs-ndv-sub', text: node.sub }) : null])
            );
            const upstream = def.nodes.slice(0, index).reverse().find(prev => state.outputs[prev.id] !== undefined);
            ndvInput.replaceChildren(
                h('div', { class: 'cs-ndv-label', text: 'Input' }),
                upstream
                    ? h('pre', { class: 'cs-ndv-json' }, jsonNodes(state.outputs[upstream.id]))
                    : h('div', { class: 'cs-ndv-empty', text: 'No input data yet' })
            );
            const params = isObject(node.params) ? Object.entries(node.params) : [];
            ndvParams.replaceChildren(
                h('div', { class: 'cs-ndv-label', text: 'Parameters' }),
                ...params.map(([key, value]) => h('div', { class: 'cs-param' }, [h('span', { text: key }), h('span', { class: 'cs-param-val', text: String(value) })]))
            );
            ndv.classList.add('cs-open');
        },
        /** Add an expression field to the open node; returns the parts to animate. */
        addExpression(label) {
            const editor = h('div', { class: 'cs-expr-box' });
            const resultLabel = h('div', { class: 'cs-ndv-label cs-result-label', text: 'Result' });
            const result = h('div', { class: 'cs-result' });
            ndvParams.append(h('div', { class: 'cs-ndv-label', text: label }), editor, resultLabel, result);
            return { editor, result, resultLabel };
        },
        closeDetails() {
            ndv.classList.remove('cs-open');
        }
    };
}

/** Expression text with {{ ... }} tokens highlighted, as nodes. */
function expressionNodes(text) {
    const fragment = document.createDocumentFragment();
    for (const token of text.split(/(\{\{[^}]*\}\})/)) {
        if (!token) continue;
        fragment.append(token.startsWith('{{') ? h('span', { class: 'cs-tok', text: token }) : token);
    }
    return fragment;
}

export default {
    name: 'flow-canvas',
    summary: 'A node-based automation editor: nodes run in order with timings and item counts, and open to show input, parameters, and an expression.',
    width: 620,
    keys: ['workflow', 'nodes'],
    parts: {
        node: def => (Array.isArray(def.nodes) ? def.nodes.map(node => node.id) : [])
    },
    validate: validateFlow,
    render,
    mounted: view => view.drawWires(),
    relayout: view => view.drawWires(),
    recap: view => view.closeDetails(),
    actions: {
        run: {
            summary: 'Run a node: it spins, then shows a check, its time, and an optional result; its wire lights up with an item count. "output" fills the output panel.',
            part: 'node',
            keys: ['ms', 'output', 'result'],
            validate(step, _def, path, report) {
                if (step.ms !== undefined && (typeof step.ms !== 'number' || step.ms < 0 || step.ms > 60000)) report.error(`${path}.ms`, 'must be milliseconds between 0 and 60000.');
                if (step.output !== undefined && !isObject(step.output) && !Array.isArray(step.output)) report.error(`${path}.output`, 'must be an object or array of the data this node outputs.');
                if (step.result !== undefined && typeof step.result !== 'string') report.error(`${path}.result`, 'must be a short string, e.g. "true".');
            },
            async run(view, step, ctx) {
                if (view.state.ran === 0) view.drawWires();
                view.markRunning(ctx.name, true);
                await ctx.wait(700);
                view.markRunning(ctx.name, false);
                view.markDone(ctx.name, step.ms, step.result, step.output);
                if (step.output !== undefined) view.showOutput(ctx.name, step.output);
                await ctx.wait(450);
            }
        },
        open: {
            summary: 'Open a node to show its input data and parameters.',
            part: 'node',
            keys: [],
            order: facts => { facts.opened = true; },
            async run(view, _step, ctx) {
                const nodeEl = view.find('node', ctx.name);
                if (nodeEl) {
                    await ctx.cursor.moveTo(nodeEl.querySelector('.cs-node-tile'), ctx);
                    await ctx.cursor.click(ctx);
                }
                view.openDetails(ctx.name);
                ctx.cursor.hide();
                await ctx.wait(800);
            }
        },
        expression: {
            summary: 'Type an expression into the open node and show its resolved result.',
            keys: ['preview', 'field'],
            order(facts, _step, path, report) {
                if (!facts.opened) report.warn(path, 'there is no open node to type into; add an "open" step first.');
            },
            validate(step, _def, path, report) {
                if (typeof step.expression !== 'string' || !step.expression) report.error(`${path}.expression`, 'must be the expression text, e.g. "{{ $json.name }} closed".');
                if (typeof step.preview !== 'string') report.error(`${path}.preview`, 'is required: the expression\'s resolved value.');
                if (step.field !== undefined && typeof step.field !== 'string') report.error(`${path}.field`, 'must be the field label, e.g. "Message".');
            },
            async run(view, step, ctx) {
                const { editor, result, resultLabel } = view.addExpression(step.field ?? 'Message');
                await typeInto(editor, step.expression, ctx, 24);
                editor.replaceChildren(expressionNodes(step.expression));
                await ctx.wait(500);
                result.textContent = step.preview;
                result.classList.add('cs-show');
                resultLabel.classList.add('cs-show');
                await ctx.wait(1500);
            }
        }
    }
};
