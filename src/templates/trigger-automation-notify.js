/**
 * trigger-automation-notify: a change in one app starts an automation that
 * notifies a team in chat. Screens sit side by side by default; packets
 * carry the data across; the film ends on a recap of the whole path.
 */

import { isObject } from '../core/util.js';

export default {
    name: 'trigger-automation-notify',
    title: 'Trigger → automation → notification',
    summary: 'A record changes in one app, an automation workflow runs, and a team is notified in chat.',
    requires: ['crm-record', 'flow-canvas', 'team-chat'],
    layout: 'row',
    validate(clip, report) {
        const chapters = Array.isArray(clip.chapters) ? clip.chapters : [];
        const last = chapters[chapters.length - 1];
        if (last && last.focus !== 'all') {
            report.warn(`chapters[${chapters.length - 1}].focus`, 'this template ends best on a recap chapter with "focus": "all".');
        }
        const usesPackets = chapters.some(chapter => Array.isArray(chapter?.steps) && chapter.steps.some(step => isObject(step) && 'packet' in step));
        if (!usesPackets) report.warn('chapters', 'no "packet" steps: add them to show data moving between the apps.');
    }
};
