// A template made outside Cueflick, in the other form a --use module can take:
// a default export that receives Cueflick's API.

export default ({ registerTemplate }) => {
    registerTemplate({
        name: 'board-update',
        title: 'Board update',
        summary: 'A card moves across a kanban board.',
        requires: ['kanban'],
        layout: 'stage'
    });
};
