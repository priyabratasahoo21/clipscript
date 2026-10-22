/**
 * File icons and preview thumbnails for referenced files. Thumbnails are
 * drawn as SVG from a few numbers and strings, so a clip needs no image assets.
 */

import { h, s } from '../core/dom.js';

export const FILE_KINDS = ['image', 'doc', 'pdf', 'sheet'];
const KIND_COLORS = { image: '#a855f7', doc: '#3b82f6', pdf: '#ef4444', sheet: '#16a34a' };
const W = 240;
const H = 140;

export const kindOf = file => (FILE_KINDS.includes(file.kind) ? file.kind : 'doc');

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Small coloured square with a glyph for the file kind. */
export function fileIcon(kind) {
    const glyphs = {
        image: [
            s('circle', { cx: '9', cy: '9', r: '2', fill: 'currentColor' }),
            s('path', { d: 'M4 18l5-5.5 3 3 3.5-4.5L20 18z', fill: 'currentColor' })
        ],
        doc: [s('path', { d: 'M7 8h10M7 12h10M7 16h6' })],
        pdf: [s('path', { d: 'M7 8h10M7 12h10M7 16h6' })],
        sheet: [s('path', { d: 'M5 9.5h14M5 14.5h14M10.5 5v14' })]
    };
    return h('span', { class: 'cf-file-icon', style: { '--file': KIND_COLORS[kind] }, 'aria-hidden': 'true' },
        s('svg', { viewBox: '0 0 24 24', width: '14', height: '14' }, glyphs[kind]));
}

function chartArt({ chart, title }, color) {
    const max = Math.max(...chart, 1);
    const left = 18;
    const right = W - 14;
    const top = title ? 40 : 18;
    const bottom = H - 18;
    const step = (right - left) / chart.length;
    return [
        s('rect', { width: W, height: H, fill: '#ffffff' }),
        title ? s('text', { x: left, y: 25, class: 'cf-thumb-title' }, clip(title, 30)) : null,
        ...[1 / 3, 2 / 3].map(f => s('line', { x1: left, x2: right, y1: bottom - (bottom - top) * f, y2: bottom - (bottom - top) * f, stroke: '#eceef2' })),
        s('line', { x1: left, x2: right, y1: bottom, y2: bottom, stroke: '#cfd5df' }),
        ...chart.map((value, i) => {
            const height = Math.max(2, (value / max) * (bottom - top));
            return s('rect', {
                x: (left + i * step + step * 0.18).toFixed(1),
                y: (bottom - height).toFixed(1),
                width: (step * 0.64).toFixed(1),
                height: height.toFixed(1),
                rx: '3',
                fill: color,
                opacity: i === chart.length - 1 ? '1' : '0.5'
            });
        })
    ];
}

function photoArt(color) {
    return [
        s('rect', { width: W, height: H, fill: '#ffffff' }),
        s('rect', { width: W, height: H, fill: color, opacity: '0.28' }),
        s('circle', { cx: '176', cy: '42', r: '17', fill: '#fff7d6' }),
        s('path', { d: `M0 ${H} L70 62 L118 104 L150 78 L${W} ${H}z`, fill: color, opacity: '0.75' }),
        s('path', { d: `M60 ${H} L150 90 L${W} 120 L${W} ${H}z`, fill: color })
    ];
}

function pageArt({ title, lines }, kind, color) {
    const rows = Array.isArray(lines) && lines.length
        ? lines.slice(0, 6).map((line, i) => s('text', { x: '58', y: 62 + i * 15, class: 'cf-thumb-line' }, clip(line, 26)))
        : [0.9, 0.75, 0.85, 0.6, 0.8].map((f, i) => s('rect', { x: '58', y: 54 + i * 14, width: (124 * f).toFixed(0), height: '6', rx: '3', fill: '#e3e6ec' }));
    return [
        s('rect', { width: W, height: H, fill: '#eef0f4' }),
        s('rect', { x: '44', y: '14', width: '152', height: H, rx: '6', fill: '#ffffff', stroke: '#dde1e8' }),
        s('text', { x: '58', y: '38', class: 'cf-thumb-title' }, clip(title ?? 'Untitled', 20)),
        s('rect', { x: '58', y: '44', width: '30', height: '3', rx: '1.5', fill: color }),
        ...rows,
        kind === 'pdf' ? s('rect', { x: '160', y: '22', width: '28', height: '14', rx: '3', fill: color }) : null,
        kind === 'pdf' ? s('text', { x: '174', y: '32.5', class: 'cf-thumb-tag' }, 'PDF') : null
    ];
}

function sheetArt({ title, rows }, color) {
    const table = Array.isArray(rows) && rows.length ? rows.slice(0, 6) : [['', '', ''], ['', '', ''], ['', '', ''], ['', '', ''], ['', '', '']];
    const columns = Math.max(...table.map(row => row.length), 1);
    const top = title ? 34 : 12;
    const rowHeight = Math.min(20, (H - top - 8) / table.length);
    const colWidth = (W - 24) / columns;
    const cells = [];
    table.forEach((row, r) => {
        const y = top + r * rowHeight;
        if (r === 0) cells.push(s('rect', { x: '12', y, width: W - 24, height: rowHeight, fill: color, opacity: '0.16' }));
        cells.push(s('line', { x1: '12', x2: W - 12, y1: y + rowHeight, y2: y + rowHeight, stroke: '#e3e6ec' }));
        row.forEach((cell, c) => {
            if (cell) cells.push(s('text', { x: 18 + c * colWidth, y: y + rowHeight * 0.68, class: r === 0 ? 'cf-thumb-head' : 'cf-thumb-cell' }, clip(cell, 11)));
            else cells.push(s('rect', { x: 18 + c * colWidth, y: y + rowHeight * 0.38, width: colWidth * 0.6, height: '5', rx: '2.5', fill: '#e3e6ec' }));
        });
    });
    return [
        s('rect', { width: W, height: H, fill: '#ffffff' }),
        title ? s('text', { x: '14', y: '23', class: 'cf-thumb-title' }, clip(title, 30)) : null,
        ...cells
    ];
}

/** A preview of the file: its own image ("src"), or a drawing of a chart or picture, a page of text, or a sheet. */
export function fileThumb(file) {
    if (file.src) return h('img', { class: 'cf-thumb-img', src: file.src, alt: '' });
    const kind = kindOf(file);
    const preview = file.preview ?? {};
    const color = preview.color ?? KIND_COLORS[kind];
    let art;
    if (kind === 'image') art = Array.isArray(preview.chart) && preview.chart.length ? chartArt(preview, color) : photoArt(color);
    else if (kind === 'sheet') art = sheetArt(preview, color);
    else art = pageArt(preview, kind, color);
    return s('svg', { class: 'cf-thumb-art', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, art);
}
