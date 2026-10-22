/**
 * Small, DOM-free helpers shared by the validator, the player, and the CLI.
 */

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Own-property lookup, so keys like "constructor" or "toString" never resolve to Object.prototype. */
export const hasOwn = (object, key) => object !== null && object !== undefined && Object.prototype.hasOwnProperty.call(object, key);

export const ownValue = (object, key) => (hasOwn(object, key) ? object[key] : undefined);

export const isHexColor = value => typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Edit distance between two strings (used for "did you mean" hints). */
export function levenshtein(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const above = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
            diagonal = above;
        }
    }
    return prev[b.length];
}

/** The option closest to `word`, or null when nothing is reasonably close. */
export function closest(word, options) {
    const target = String(word).toLowerCase();
    let best = null;
    let bestDistance = Infinity;
    for (const option of options) {
        const distance = levenshtein(target, String(option).toLowerCase());
        if (distance < bestDistance) {
            best = option;
            bestDistance = distance;
        }
    }
    const limit = Math.max(2, Math.floor(target.length / 3));
    return bestDistance <= limit ? best : null;
}

/** A "did you mean" hint, or undefined. */
export const suggest = (word, options) => {
    const match = closest(word, options);
    return match === null ? undefined : `Did you mean "${match}"?`;
};

/**
 * Parse a step target: "screen" or "screen.part:name".
 * @returns {{screen: string, part: string|null, name: string|null}|null}
 */
export function parseSelector(selector) {
    const match = /^([A-Za-z_][\w-]*)(?:\.([a-z]+):(.+))?$/.exec(String(selector ?? ''));
    return match ? { screen: match[1], part: match[2] ?? null, name: match[3] ?? null } : null;
}

export const initials = name => String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();

/** A stable, readable colour derived from a name (for avatars). */
export function nameColor(name) {
    let hue = 0;
    for (const char of String(name)) hue = (hue * 31 + char.charCodeAt(0)) % 360;
    return `hsl(${hue} 55% 50%)`;
}
