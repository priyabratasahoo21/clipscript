// A screen type made outside Cueflick, the way the guide shows: a kanban board
// whose cards can be dragged between columns. Loaded with --use.

import { registerSurface, h } from 'cueflick';

const columnsOf = def => (Array.isArray(def.columns) ? def.columns.filter(column => column && Array.isArray(column.cards)) : []);

registerSurface({
    name: 'kanban',
    summary: 'A kanban board: cards move between columns.',
    width: 620,
    keys: ['columns'],
    // the theme's variables keep it right in light and dark films; cf-window stacks its children, so set a row
    styles: `
.kb { flex-direction: row; gap: 12px; padding: 16px; box-sizing: border-box; }
.kb-col { flex: 1; background: var(--cf-win-2); border: 1px solid var(--cf-line); border-radius: 10px; padding: 10px; }
.kb-col b { display: block; margin-bottom: 8px; color: var(--cf-dim); }
.kb-card { background: var(--cf-win); border-left: 3px solid var(--app); border-radius: 8px; padding: 10px; margin-bottom: 8px; }`,
    parts: { card: def => columnsOf(def).flatMap(column => column.cards.map(card => card.id)) },
    validate(def, path, report) {
        if (!columnsOf(def).length) report.error(`${path}.columns`, 'must be a list of columns, each with "name" and "cards".');
    },
    render(def) {
        const columns = new Map(columnsOf(def).map(column => [column.name, h('div', { class: 'kb-col' }, [
            h('b', { text: column.name }),
            ...column.cards.map(card => h('div', { class: 'kb-card', dataset: { card: card.id }, text: card.title }))
        ])]));
        const el = h('div', { class: 'cf-window kb' }, [...columns.values()]);
        return {
            el,
            columns,
            find: (part, name) => (part === 'card' ? [...el.querySelectorAll('.kb-card')].find(node => node.dataset.card === name) ?? null : null)
        };
    },
    actions: {
        drag: {
            summary: 'Drag a card to another column: { "drag": "board.card:42", "to": "Done" }.',
            part: 'card',
            keys: ['to'],
            validate(step, def, path, report) {
                if (!columnsOf(def).some(column => column.name === step.to)) report.error(`${path}.to`, 'must be one of the column names.');
            },
            async run(view, step, ctx) {
                const card = view.find('card', ctx.name);
                const column = view.columns.get(step.to);
                if (!card || !column) return;
                await ctx.cursor.moveTo(card, ctx);
                await ctx.cursor.click(ctx);
                column.append(card);
                await ctx.cursor.moveTo(card, ctx);
                await ctx.wait(ctx.fast ? 0 : 500);
            }
        }
    }
});
