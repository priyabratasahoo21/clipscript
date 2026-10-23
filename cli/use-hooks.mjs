// Node module hook for --use: `import … from 'cueflick'` in a screen module
// resolves to the CLI's own copy (through use-api.mjs), so the module registers
// into the same registry the CLI validates and catalogs with, wherever cueflick
// is installed.

let target;

export function initialize(data) {
    target = data.url;
}

export async function resolve(specifier, context, next) {
    if (specifier === 'cueflick' && target) return { url: target, shortCircuit: true };
    return next(specifier, context);
}
