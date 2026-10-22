/**
 * Plays a validated clip script: builds the stage and screens, then runs
 * chapters step by step through a pausable timeline.
 *
 * States: idle → playing ⇄ paused → ended, or static (a chapter shown
 * without animation). The play button and autoplay follow the state.
 */

import { Camera } from './camera.js';
import { STOP, WORLD } from './constants.js';
import { Cursor } from './cursor.js';
import { applyDesign, MODES, resolveDesign } from './design.js';
import { h, rectIn } from './dom.js';
import { Links } from './links.js';
import { getSurface, getTemplate } from './registry.js';
import { actionOf, GENERIC_ACTIONS, resolveStepScreen } from './steps.js';
import { Timeline } from './timeline.js';
import { clamp, hasOwn, initials, parseSelector } from './util.js';
import { layoutFor } from '../templates/layouts.js';

const INTRO_MS = 3000;
const CHAPTER_SETTLE_MS = 300;
const CHAPTER_END_MS = 600;
const CAPTION_MS = 1100;
const ENTER_MS = 800;
const EXIT_MS = 650;
const FRONT_MS = 450;
const ENDCARD_DELAY_MS = 2200;

// where an entering screen comes from (and an exiting one goes), in world units
const MOTION = {
    left: { dx: -260, dy: 0, scale: 1 },
    right: { dx: 260, dy: 0, scale: 1 },
    top: { dx: 0, dy: -200, scale: 1 },
    bottom: { dx: 0, dy: 200, scale: 1 },
    fade: { dx: 0, dy: 0, scale: 1 },
    zoom: { dx: 0, dy: 0, scale: 0.88 }
};

const easeOut = t => 1 - (1 - t) ** 3;
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Player {
    /**
     * @param {HTMLElement} host   element that receives events (the <clip-script> element)
     * @param {HTMLElement} mount  container to render into (inside the shadow root)
     * @param {object} clip        a clip script that passed validateClip()
     * @param {object} [options]   autoplay ('view' | 'none'), controls, chapter, mode, endcard, reducedMotion
     */
    constructor(host, mount, clip, options = {}) {
        this.host = host;
        this.clip = clip;
        this.options = { autoplay: 'view', controls: true, chapter: null, mode: null, endcard: true, ...options };
        this.design = resolveDesign(clip.design);
        if (MODES.includes(this.options.mode)) this.design.mode = this.options.mode;
        this.template = getTemplate(clip.template);
        this.chapters = clip.chapters;
        this.timeline = new Timeline();
        this.reduced = this.options.reducedMotion ?? prefersReducedMotion();
        this.state = 'idle';
        this.userPaused = false;
        this.autoPaused = false;
        this.pendingStart = null;
        /** Index of the chapter whose static view has finished drawing (null while drawing or playing). */
        this.readyChapter = null;
        this.views = Object.create(null);
        this.actionNames = new Set(Object.values(clip.screens).flatMap(screen => Object.keys(getSurface(screen.surface).actions)));
        this.buildFrame(mount);
        this.watchColorScheme();
        this.buildScene();
        this.start();
    }

    // ---------- structure ----------

    buildFrame(mount) {
        const { clip } = this;
        this.world = h('div', { class: 'cs-world' });
        this.progressBar = h('i');
        this.subtitle = h('span');
        this.intro = this.buildIntro();
        this.endcard = this.buildEndcard();
        this.stage = h('div', {
            class: 'cs-stage',
            role: 'group',
            'aria-roledescription': 'product film',
            'aria-label': clip.title
        }, [
            this.world,
            h('div', { class: 'cs-progress', 'aria-hidden': 'true' }, this.progressBar),
            this.intro,
            h('div', { class: 'cs-subtitle', 'aria-hidden': 'true' }, this.subtitle),
            this.endcard,
            h('div', { class: 'cs-poster' }, h('slot', { name: 'poster' }))
        ]);
        this.root = h('div', { class: 'cs-player' }, [
            this.stage,
            this.options.controls ? this.buildControls() : null,
            clip.disclaimer ? h('p', { class: 'cs-disclaimer', text: clip.disclaimer }) : null,
            this.buildTranscript()
        ]);
        applyDesign(this.root, this.design);
        this.setState('idle');
        mount.replaceChildren(this.root);
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.stage);
    }

    /** In "auto" mode, follow the viewer's light/dark setting live. */
    watchColorScheme() {
        if (this.design.mode !== 'auto' || typeof matchMedia !== 'function') return;
        this.colorScheme = matchMedia('(prefers-color-scheme: light)');
        this.onColorScheme = () => { this.root.dataset.mode = this.colorScheme.matches ? 'light' : 'dark'; };
        this.onColorScheme();
        this.colorScheme.addEventListener('change', this.onColorScheme);
    }

    buildIntro() {
        const apps = Object.values(this.clip.screens).map(screen => screen.app);
        const chain = apps.flatMap((app, i) => [
            i ? h('span', { class: 'cs-intro-arrow', text: '→' }) : null,
            h('span', { class: 'cs-intro-app' }, [
                h('span', { class: 'cs-appicon', style: { '--app': app.color ?? this.design.accent }, text: app.icon ?? initials(app.name) }),
                h('span', { text: app.name })
            ])
        ]);
        return h('div', { class: 'cs-intro', 'aria-hidden': 'true' }, h('div', { class: 'cs-intro-inner' }, [
            h('div', { class: 'cs-intro-chain' }, chain),
            h('div', { class: 'cs-intro-title', text: this.clip.title }),
            h('div', { class: 'cs-intro-overview', text: this.clip.story.overview })
        ]));
    }

    buildEndcard() {
        const steps = this.clip.story.workflow ?? [];
        const replay = h('button', { class: 'cs-cbtn', type: 'button', text: 'Replay ↺' });
        replay.addEventListener('click', () => this.replay());
        return h('div', { class: 'cs-endcard' }, h('div', { class: 'cs-endcard-inner' }, [
            h('div', { class: 'cs-endcard-label', text: 'How it works' }),
            h('ol', {}, steps.map((text, i) => h('li', { style: { '--i': i } }, [h('span', { class: 'cs-check', text: '✓' }), h('span', { text })]))),
            replay
        ]));
    }

    buildControls() {
        this.chapterButtons = this.chapters.map((chapter, i) => {
            const button = h('button', { class: 'cs-ch', type: 'button', 'aria-label': `Chapter ${i + 1}: ${chapter.title}` }, [
                h('span', { class: 'cs-ch-num', text: String(i + 1).padStart(2, '0') }),
                h('span', { class: 'cs-ch-label', text: chapter.title })
            ]);
            button.addEventListener('click', () => this.goTo(i));
            return button;
        });
        this.nowLabel = h('div', { class: 'cs-now', 'aria-live': 'polite' });
        this.playButton = h('button', { class: 'cs-cbtn', type: 'button', text: 'Play ▶' });
        this.playButton.addEventListener('click', () => this.toggle());
        const replay = h('button', { class: 'cs-cbtn', type: 'button', text: 'Replay ↺' });
        replay.addEventListener('click', () => this.replay());
        const fullscreen = h('button', { class: 'cs-cbtn', type: 'button', 'aria-label': 'Full screen', text: '⛶' });
        fullscreen.addEventListener('click', () => this.toggleFullscreen());
        const chapters = h('div', { class: 'cs-chapters', style: { '--n': this.chapters.length } }, this.chapterButtons);
        return h('div', { class: 'cs-controls' }, [chapters, this.nowLabel, h('div', { class: 'cs-buttons' }, [this.playButton, replay, fullscreen])]);
    }

    /** Screen-reader transcript: the story and the script, read in order. */
    buildTranscript() {
        const { story } = this.clip;
        return h('div', { class: 'cs-sr' }, [
            h('p', { text: `${this.clip.title}. ${story.overview}` }),
            story.description ? h('p', { text: story.description }) : null,
            h('ol', {}, this.chapters.map(chapter => h('li', { text: `${chapter.title}: ${chapter.narration ?? ''}` })))
        ]);
    }

    /** (Re)build the world: screens laid out, plus cursor and packet layer. */
    buildScene() {
        this.world.replaceChildren();
        const entries = Object.entries(this.clip.screens).map(([key, def]) => ({ key, def, surface: getSurface(def.surface) }));
        const mode = this.clip.layout ?? this.template.layout;
        const layout = typeof mode === 'function' ? mode(entries, WORLD) : layoutFor(mode, entries, WORLD);
        this.links = new Links(this.world);
        this.views = Object.create(null);
        this.zTop = 0;
        for (const { key, def, surface } of entries) {
            const view = surface.render(def, { screens: this.clip.screens, accent: this.design.accent });
            const rect = layout[key];
            view.el.classList.add('cs-screen');
            view.el.classList.toggle('cs-off', def.hidden === true);
            view.el.dataset.screen = key;
            if (def.mode === 'light' || def.mode === 'dark') view.el.dataset.mode = def.mode;
            view.el.style.setProperty('--app', def.app.color ?? this.design.accent);
            view.el.style.setProperty('z-index', String(++this.zTop));
            for (const [property, value] of Object.entries({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })) {
                view.el.style.setProperty(property, `${value}px`);
            }
            this.world.append(view.el);
            this.views[key] = { key, def, surface, view, rect, visible: def.hidden !== true };
        }
        for (const { surface, view } of Object.values(this.views)) surface.mounted?.(view);
        this.cursor = new Cursor(this.world);
        this.camera = new Camera(this.stage, this.world, target => this.targetRect(target), {
            maxZoom: this.design.camera.zoom,
            speed: this.design.camera.speed
        });
    }

    /** World rect for "all" (screens on stage), a screen id, or "screen.part:name". */
    targetRect(target) {
        const entries = Object.values(this.views);
        if (target === 'all') {
            const onStage = entries.filter(entry => entry.visible);
            const set = onStage.length ? onStage : entries;
            const x = Math.min(...set.map(v => v.rect.x));
            const y = Math.min(...set.map(v => v.rect.y));
            const right = Math.max(...set.map(v => v.rect.x + v.rect.w));
            const bottom = Math.max(...set.map(v => v.rect.y + v.rect.h));
            return { x, y, w: right - x, h: bottom - y, kind: 'all' };
        }
        const parsed = parseSelector(target);
        if (!parsed || !hasOwn(this.views, parsed.screen)) return null;
        const entry = this.views[parsed.screen];
        if (!parsed.part) return { ...entry.rect, kind: 'screen' };
        const el = entry.view.find(parsed.part, parsed.name);
        return el ? { ...rectIn(this.world, el), kind: 'part' } : { ...entry.rect, kind: 'screen' };
    }

    onResize() {
        if (!this.stage.clientWidth) return;
        if (this.pendingStart) {
            const start = this.pendingStart;
            this.pendingStart = null;
            start();
            return;
        }
        this.camera.apply();
        for (const { surface, view } of Object.values(this.views)) surface.relayout?.(view);
        this.links.redraw(target => this.targetRect(target));
    }

    /** Run `fn` now, or once the stage has a size (e.g. inside a hidden tab). */
    whenSized(fn) {
        if (this.stage.clientWidth) fn();
        else this.pendingStart = fn;
    }

    // ---------- playback ----------

    start() {
        const last = this.chapters.length - 1;
        if (Number.isInteger(this.options.chapter)) {
            this.whenSized(() => this.show(clamp(this.options.chapter, 0, last)));
            return;
        }
        if (this.reduced) {
            this.playButton?.setAttribute('hidden', '');
            this.whenSized(() => this.show(last));
            return;
        }
        if (this.options.autoplay === 'none') {
            this.whenSized(() => this.showPoster());
            return;
        }
        this.viewObserver = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && this.state === 'idle') this.run(0);
            else if (!entry.isIntersecting && this.state === 'playing') {
                this.autoPaused = true;
                this.setState('paused');
            } else if (entry.isIntersecting && this.state === 'paused' && this.autoPaused && !this.userPaused) {
                this.autoPaused = false;
                this.setState('playing');
            }
        }, { threshold: 0.35 });
        this.viewObserver.observe(this.stage);
    }

    showPoster() {
        this.camera.focus('all', { instant: true });
        this.root.classList.add('cs-has-poster');
        const play = h('button', { class: 'cs-bigplay', type: 'button', 'aria-label': `Play ${this.clip.title}`, text: '▶' });
        play.addEventListener('click', () => this.run(0));
        this.bigPlay = play;
        this.stage.append(play);
    }

    /** Show the end state of a chapter without animation. */
    show(index) {
        this.run(index + 1, index);
    }

    async run(animateFrom = 0, upTo = this.chapters.length - 1) {
        const id = this.timeline.begin();
        const isStatic = animateFrom > upTo;
        this.readyChapter = null;
        this.bigPlay?.remove();
        this.root.classList.remove('cs-has-poster', 'cs-ended');
        this.setState(isStatic ? 'static' : 'playing');
        this.buildScene();
        this.intro.classList.remove('cs-show');
        this.endcard.classList.remove('cs-show');
        this.setSubtitle('');
        await this.camera.focus('all', { instant: true });
        try {
            if (animateFrom === 0 && this.design.intro && !isStatic) await this.playIntro(id);
            for (let i = 0; i <= upTo; i++) {
                await this.playChapter(i, this.context(id, i < animateFrom));
            }
            if (upTo === this.chapters.length - 1) await this.finish(id, isStatic);
            if (isStatic && this.timeline.isCurrent(id)) {
                this.readyChapter = upTo;
                this.emit('ready', { chapter: upTo });
            }
        } catch (error) {
            if (error !== STOP) throw error;
        }
    }

    context(id, fast) {
        return { ...this.timeline.context(id, { fast, pace: this.design.pace }), cursor: this.cursor, links: this.links, player: this };
    }

    async playIntro(id) {
        const ctx = this.context(id, false);
        this.intro.classList.add('cs-show');
        await ctx.wait(INTRO_MS);
        this.intro.classList.remove('cs-show');
        await ctx.wait(500);
    }

    async playChapter(index, ctx) {
        const chapter = this.chapters[index];
        this.setChapter(index);
        this.setProgress(index / this.chapters.length);
        this.setSubtitle(chapter.narration ?? '');
        if (chapter.focus) await this.camera.focus(chapter.focus, { zoom: chapter.zoom, ctx });
        await ctx.wait(CHAPTER_SETTLE_MS);
        for (const [j, step] of chapter.steps.entries()) {
            await this.runStep(step, ctx);
            this.setProgress((index + (j + 1) / chapter.steps.length) / this.chapters.length);
        }
        await ctx.wait(CHAPTER_END_MS);
    }

    async runStep(step, ctx) {
        const action = actionOf(step, this.actionNames);
        if (!GENERIC_ACTIONS.includes(action)) {
            await this.runSurfaceStep(step, action, ctx);
            return;
        }
        const value = step[action];
        if (action === 'focus') await this.camera.focus(value, { zoom: step.zoom, ctx });
        else if (action === 'caption') {
            this.setSubtitle(value);
            await ctx.wait(CAPTION_MS);
        } else if (action === 'wait') await ctx.wait(value);
        else if (action === 'packet') await this.links.packet(value.from, value.to, target => this.targetRect(target), ctx);
        else if (action === 'enter') await this.enterScreen(value, step.from ?? 'right', ctx);
        else if (action === 'exit') await this.exitScreen(value, step.to ?? 'left', ctx);
        else if (action === 'front') {
            this.frontScreen(value, step.dim !== false);
            await ctx.wait(FRONT_MS);
        }
    }

    async runSurfaceStep(step, action, ctx) {
        const target = resolveStepScreen(step, action, this.views);
        if (target.error) return;
        const entry = this.views[target.key];
        const selector = typeof step[action] === 'string' ? parseSelector(step[action]) : null;
        await entry.surface.actions[action].run(entry.view, step, { ...ctx, name: selector?.part ? selector.name : null, screens: this.views });
    }

    // ---------- screens on and off stage ----------

    setScreenMotion(el, motion, amount) {
        const remaining = 1 - amount;
        const scale = motion.scale + (1 - motion.scale) * amount;
        el.style.setProperty('transform', `translate(${motion.dx * remaining}px, ${motion.dy * remaining}px) scale(${scale})`);
        el.style.setProperty('opacity', String(amount));
    }

    async enterScreen(key, from, ctx) {
        const entry = this.views[key];
        if (!entry || entry.visible) return;
        const { el } = entry.view;
        const motion = MOTION[from] ?? MOTION.right;
        entry.visible = true;
        this.raise(entry);
        this.setScreenMotion(el, motion, 0);
        el.classList.remove('cs-off');
        await ctx.animate(ENTER_MS, progress => this.setScreenMotion(el, motion, easeOut(progress)));
        el.style.removeProperty('transform');
        el.style.removeProperty('opacity');
        entry.surface.relayout?.(entry.view);
    }

    async exitScreen(key, to, ctx) {
        const entry = this.views[key];
        if (!entry || !entry.visible) return;
        const { el } = entry.view;
        const motion = MOTION[to] ?? MOTION.left;
        await ctx.animate(EXIT_MS, progress => this.setScreenMotion(el, motion, 1 - easeOut(progress)));
        entry.visible = false;
        el.classList.add('cs-off');
        el.classList.remove('cs-dimmed');
        el.style.removeProperty('transform');
        el.style.removeProperty('opacity');
    }

    frontScreen(key, dimOthers) {
        const entry = this.views[key];
        if (!entry) return;
        this.raise(entry);
        for (const other of Object.values(this.views)) other.view.el.classList.toggle('cs-dimmed', dimOthers && other !== entry && other.visible);
    }

    raise(entry) {
        entry.view.el.style.setProperty('z-index', String(++this.zTop));
        this.cursor.el.style.setProperty('z-index', String(this.zTop + 1));
    }

    async finish(id, isStatic) {
        const ctx = this.context(id, isStatic);
        this.links.lightAll();
        for (const { surface, view } of Object.values(this.views)) surface.recap?.(view);
        this.cursor.hide();
        this.setProgress(1);
        if (this.design.endcard && this.options.endcard !== false && this.clip.story.workflow?.length) {
            await ctx.wait(ENDCARD_DELAY_MS);
            this.endcard.classList.toggle('cs-instant', isStatic);
            this.endcard.classList.add('cs-show');
        }
        this.root.classList.add('cs-ended');
        this.chapterButtons?.forEach(button => {
            button.classList.add('cs-done');
            button.classList.remove('cs-active');
        });
        if (this.nowLabel) this.nowLabel.textContent = 'Done · pick any chapter to replay it';
        this.setState(isStatic ? 'static' : 'ended');
        if (!isStatic) this.emit('ended', {});
    }

    // ---------- controls ----------

    goTo(index) {
        this.userPaused = false;
        if (this.reduced) this.show(index);
        else this.run(index);
    }

    replay() {
        this.userPaused = false;
        if (this.reduced) this.show(this.chapters.length - 1);
        else this.run(0);
    }

    toggle() {
        if (this.state === 'playing') this.pause();
        else this.play();
    }

    play() {
        if (this.state === 'paused') {
            this.userPaused = false;
            this.autoPaused = false;
            this.setState('playing');
        } else if (this.state !== 'playing') {
            this.replay();
        }
    }

    pause() {
        if (this.state !== 'playing') return;
        this.userPaused = true;
        this.setState('paused');
    }

    setState(state) {
        this.state = state;
        this.timeline.paused = state === 'paused';
        this.root.dataset.state = state;
        this.root.classList.toggle('cs-paused', state === 'paused');
        if (this.playButton) this.playButton.textContent = state === 'playing' ? 'Pause ❚❚' : 'Play ▶';
    }

    toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else this.host.requestFullscreen?.();
    }

    setChapter(index) {
        this.chapterButtons?.forEach((button, i) => {
            button.classList.toggle('cs-done', i < index);
            button.classList.toggle('cs-active', i === index);
            button.setAttribute('aria-current', i === index ? 'step' : 'false');
        });
        if (this.nowLabel) this.nowLabel.textContent = `${String(index + 1).padStart(2, '0')} · ${this.chapters[index].title}`;
        this.emit('chapter', { index, title: this.chapters[index].title });
    }

    setSubtitle(text) {
        this.subtitle.textContent = text;
        this.subtitle.parentElement.classList.toggle('cs-show', Boolean(text) && this.design.subtitles);
    }

    setProgress(fraction) {
        this.progressBar.style.setProperty('--p', String(fraction));
    }

    emit(name, detail) {
        this.host.dispatchEvent(new CustomEvent(`clipscript:${name}`, { detail, bubbles: true, composed: true }));
    }

    destroy() {
        this.timeline.cancel();
        this.viewObserver?.disconnect();
        this.resizeObserver?.disconnect();
        this.colorScheme?.removeEventListener('change', this.onColorScheme);
        this.pendingStart = null;
    }
}
