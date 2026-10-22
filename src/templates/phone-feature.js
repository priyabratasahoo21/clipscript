/**
 * phone-feature: a product feature told on a phone, in a motion-graphics
 * style: actors (spheres, blocks) carry the story between scenes, each scene
 * has its own backdrop colour, and there's no pointer: it's a touch screen.
 */

import { isObject } from '../core/util.js';

export default {
    name: 'phone-feature',
    title: 'Phone feature, motion-graphics style',
    summary: 'A phone feature with characters (spheres, blocks) that carry the story, a backdrop colour per scene, and confetti to finish.',
    requires: ['phone'],
    layout: 'stage',
    validate(clip, report) {
        if (!isObject(clip.actors) || !Object.keys(clip.actors).length) report.warn('actors', 'add a few actors (spheres or blocks) to carry the story between scenes.');
        const chapters = Array.isArray(clip.chapters) ? clip.chapters : [];
        if (!chapters.some(chapter => isObject(chapter) && chapter.backdrop !== undefined) && clip.design?.backdrop === undefined) {
            report.warn('chapters', 'give scenes a "backdrop" colour; it marks each new topic.');
        }
    }
};
