// What a --use module gets as "cueflick": the CLI's own copy, unchanged, except that
// registrations are counted, so the CLI can tell a module that registered nothing
// from one that registered a screen type that's already there.

import * as Cueflick from '../dist/cueflick.mjs';
import { registrations } from './use-count.mjs';

export * from '../dist/cueflick.mjs';

export function registerSurface(definition) {
    Cueflick.registerSurface(definition);
    registrations.count += 1;
}

export function registerTemplate(definition) {
    Cueflick.registerTemplate(definition);
    registrations.count += 1;
}
