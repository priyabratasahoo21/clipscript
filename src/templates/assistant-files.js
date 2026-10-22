/**
 * assistant-files: someone asks an AI assistant about their own files,
 * pulling them into the prompt with "@" references. Hovering a reference
 * previews the file, and the reply cites its sources.
 */

import { isObject } from '../core/util.js';

export default {
    name: 'assistant-files',
    title: 'Ask an assistant about your files',
    summary: 'Pull files into a prompt with @, preview each one on hover, and get an answer that cites them.',
    requires: ['ai-chat'],
    layout: 'stage',
    validate(clip, report) {
        const chapters = Array.isArray(clip.chapters) ? clip.chapters : [];
        const steps = chapters.flatMap(chapter => (Array.isArray(chapter?.steps) ? chapter.steps : [])).filter(isObject);
        const chats = Object.values(isObject(clip.screens) ? clip.screens : {}).filter(screen => isObject(screen) && screen.surface === 'ai-chat');
        if (!chats.some(screen => Array.isArray(screen.files) && screen.files.length)) {
            report.warn('screens', 'give the ai-chat screen some "files" so prompts can reference them with @.');
        }
        if (!steps.some(step => typeof step.prompt === 'string' && /(^|\s)@[A-Za-z_]/.test(step.prompt))) {
            report.warn('chapters', 'no prompt references a file; write "@<file id>" in a "prompt" step.');
        }
        if (!steps.some(step => 'hover' in step)) report.warn('chapters', 'add a "hover" step so viewers see a file preview.');
    }
};
