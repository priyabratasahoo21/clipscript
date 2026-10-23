// --use: screen types and templates from your own modules, for every command.
// A module registers them either way:
//   import { registerSurface, h } from 'cueflick';  registerSurface({ … });
//   export default ({ registerSurface, h }) => { registerSurface({ … }); };
// Code only runs when you name it with --use; a clip can't ask for it.

import { existsSync, statSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as Cueflick from '../dist/cueflick.mjs';
import * as API from './use-api.mjs';
import { registrations } from './use-count.mjs';

// "cueflick" in a --use module: the CLI's own copy, with registrations counted
const API_URL = new URL('./use-api.mjs', import.meta.url).href;
const EXTENSIONS = ['.js', '.mjs'];
const loaded = new Map();
let hooked = false;

export class UseError extends Error {}

/** The --use value(s) as absolute paths: repeat the flag or separate files with commas. */
export function useFiles(value) {
    const list = [value ?? []].flat().flatMap(item => String(item).split(',')).map(item => item.trim()).filter(Boolean);
    return [...new Set(list.map(file => resolve(file)))].map(file => {
        if (!existsSync(file) || !statSync(file).isFile()) throw new UseError(`--use ${file}: no such file.`);
        if (!EXTENSIONS.includes(extname(file).toLowerCase())) throw new UseError(`--use ${file}: give a .js or .mjs module.`);
        return file;
    });
}

/** Run each module once, so its screen types and templates are registered before a clip is checked. */
export async function loadUse(files) {
    if (files.length && !hooked && typeof nodeModule.register === 'function') {
        nodeModule.register(new URL('./use-hooks.mjs', import.meta.url), { data: { url: API_URL } });
        hooked = true;
    }
    for (const file of files) {
        if (loaded.has(file)) continue;
        const before = { count: registrations.count, catalog: JSON.stringify(Cueflick.catalog()) };
        let mod;
        try {
            mod = await import(pathToFileURL(file).href);
            if (typeof mod.default === 'function') await mod.default(API);
        } catch (error) {
            throw new UseError(`--use ${file} failed to load: ${error.message}`);
        }
        // the count sees every registration; the catalog also catches one made through another
        // route to the same copy (Node without module hooks)
        if (registrations.count === before.count && JSON.stringify(Cueflick.catalog()) === before.catalog) {
            throw new UseError(`--use ${file} didn't register a screen type or template. Call registerSurface() or registerTemplate() in it, or export a default function ({ registerSurface, h }) => { … }.`);
        }
        loaded.set(file, true);
    }
    return files;
}

/** Imports a module makes besides 'cueflick' (export embeds each module as one file, so it can't follow them). */
export function otherImports(source) {
    const specifiers = [];
    const patterns = [
        /(?:^|[\s;])(?:import|export)\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
        /(?:^|[\s;])import\s*['"]([^'"]+)['"]/g,
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    ];
    for (const pattern of patterns) for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
    return [...new Set(specifiers)].filter(specifier => specifier !== 'cueflick');
}

/** Names the cueflick module exports (for the browser stand-in that re-exports them). */
export const API_NAMES = Object.keys(Cueflick).filter(name => name !== 'default');
