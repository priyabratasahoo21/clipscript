/**
 * <cue-flick> custom element: the easiest way to add a film to any page or
 * framework. Styles live in its shadow root, so they never leak either way.
 *
 *   <cue-flick src="closed-won.clip.json"></cue-flick>
 *   <cue-flick><script type="application/json">{ ... }</script></cue-flick>
 *
 * Content with slot="poster" (e.g. an <img>) shows before the film loads and
 * when JavaScript is off.
 */

import STYLES from '../styles/player.css';
import { h } from './dom.js';
import { Player } from './player.js';
import { surfaceStyles } from './registry.js';
import { formatReport, validateClip } from './validate.js';

let sheet = null;
let sheetSource = '';

/** One constructable stylesheet shared by every player (CSP-friendly). */
function styleSheet() {
    const source = `${STYLES}\n${surfaceStyles()}`;
    if (!sheet || source !== sheetSource) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(source);
        sheetSource = source;
    }
    return sheet;
}

function errorPanel(errors, source) {
    return h('div', { class: 'cf-error', role: 'alert' }, [
        h('strong', { text: `Cueflick: ${source} can't be played` }),
        h('ul', {}, errors.map(item => h('li', { text: `${item.path || '(root)'}: ${item.message}${item.hint ? ` ${item.hint}` : ''}` })))
    ]);
}

function parseChapter(value) {
    if (value === null || value === '') return null;
    if (/^\d+$/.test(value)) return Number(value);
    console.warn(`cueflick: chapter="${value}" must be a whole number (0 is the first chapter); ignoring it.`);
    return null;
}

/** Define <cue-flick> (or a custom tag name). Safe to call more than once. */
export function defineElement(tagName = 'cue-flick') {
    if (typeof customElements === 'undefined' || customElements.get(tagName)) return;

    class CueflickElement extends HTMLElement {
        static get observedAttributes() {
            return ['src', 'mode', 'chapter', 'autoplay', 'controls', 'endcard', 'reduced-motion'];
        }

        #clip = null;
        #player = null;
        #loadToken = 0;
        #scheduled = false;

        connectedCallback() {
            // a `clip` property set before this element was defined is an own property; re-apply it through the setter
            if (Object.prototype.hasOwnProperty.call(this, 'clip')) {
                const value = this.clip;
                delete this.clip;
                this.#clip = value;
            }
            this.#schedule();
        }

        disconnectedCallback() {
            this.#loadToken += 1;
            this.#player?.destroy();
            this.#player = null;
        }

        attributeChangedCallback(_name, oldValue, newValue) {
            if (oldValue !== newValue) this.#schedule();
        }

        /** Set a clip object directly (instead of src or inline JSON). */
        set clip(value) {
            this.#clip = value;
            this.#schedule();
        }

        get clip() {
            return this.#clip;
        }

        get player() {
            return this.#player;
        }

        play() { this.#player?.play(); }
        pause() { this.#player?.pause(); }
        replay() { this.#player?.replay(); }
        goTo(index) { this.#player?.goTo(index); }

        /** Coalesce attribute and property changes into one load per task. */
        #schedule() {
            if (this.#scheduled) return;
            this.#scheduled = true;
            queueMicrotask(() => {
                this.#scheduled = false;
                if (this.isConnected) this.#load();
            });
        }

        #options() {
            return {
                autoplay: this.getAttribute('autoplay') === 'none' ? 'none' : 'view',
                controls: this.getAttribute('controls') !== 'none',
                endcard: this.getAttribute('endcard') !== 'none',
                chapter: parseChapter(this.getAttribute('chapter')),
                mode: this.getAttribute('mode'),
                reducedMotion: this.hasAttribute('reduced-motion') ? true : undefined
            };
        }

        /** The clip, and (when it was fetched) its URL, which relative image paths in it resolve against. */
        async #readClip(src) {
            if (this.#clip) return { clip: this.#clip };
            const inline = this.querySelector('script[type="application/json"]');
            if (inline) return { clip: JSON.parse(inline.textContent) };
            if (src) {
                const response = await fetch(src, { credentials: 'same-origin' });
                if (!response.ok) throw new Error(`could not load ${src} (HTTP ${response.status})`);
                return { clip: await response.json(), base: response.url || undefined };
            }
            return { clip: null };
        }

        async #load() {
            const token = ++this.#loadToken;
            const src = this.getAttribute('src');
            // inline JSON may not be parsed yet when the script runs before the element's children
            if (!this.#clip && !src && document.readyState === 'loading' && !this.querySelector('script[type="application/json"]')) {
                document.addEventListener('DOMContentLoaded', () => this.#schedule(), { once: true });
                return;
            }
            const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
            shadow.adoptedStyleSheets = [styleSheet()];
            const mount = h('div', { class: 'cf-mount' });
            shadow.replaceChildren(mount);
            this.#player?.destroy();
            this.#player = null;
            const source = src ?? 'this clip';
            try {
                const { clip, base } = await this.#readClip(src);
                if (token !== this.#loadToken || !clip) return;
                const result = validateClip(clip);
                if (!result.ok) {
                    console.warn(formatReport(result, source));
                    mount.replaceChildren(errorPanel(result.errors, source));
                    this.dispatchEvent(new CustomEvent('cueflick:error', { detail: { result }, bubbles: true, composed: true }));
                    return;
                }
                this.#player = new Player(this, mount, clip, { ...this.#options(), base });
            } catch (error) {
                if (token !== this.#loadToken) return;
                mount.replaceChildren(errorPanel([{ path: '', message: error.message }], source));
                this.dispatchEvent(new CustomEvent('cueflick:error', { detail: { error }, bubbles: true, composed: true }));
            }
        }
    }

    customElements.define(tagName, CueflickElement);
}
