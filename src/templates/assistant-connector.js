/**
 * assistant-connector: someone asks an AI assistant to do a job, the
 * assistant uses a connector to act in another app, and the result appears
 * there. One screen at a time by default: the app enters as the chat leaves.
 */

import { isObject } from '../core/util.js';

export default {
    name: 'assistant-connector',
    title: 'Assistant → connector → app',
    summary: 'An AI assistant uses a connector to do work in another app, and the result shows up in that app.',
    requires: ['ai-chat'],
    layout: 'stage',
    validate(clip, report) {
        const chapters = Array.isArray(clip.chapters) ? clip.chapters : [];
        const steps = chapters.flatMap(chapter => (Array.isArray(chapter?.steps) ? chapter.steps : [])).filter(isObject);
        if (!steps.some(step => 'tool' in step)) report.warn('chapters', 'no "tool" steps: show the assistant calling the connector.');
        if (!steps.some(step => 'enter' in step) && (clip.layout ?? 'stage') === 'stage') {
            report.warn('chapters', 'in the stage layout, bring the target app on with an "enter" step so viewers see the result.');
        }
    }
};
