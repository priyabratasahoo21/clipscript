/**
 * Plays a validated clip: builds the stage and screens, then runs
 * chapters step by step through a pausable timeline.
 *
 * States: idle → playing ⇄ paused → ended, or static (a chapter shown
 * without animation). The play button and autoplay follow the state.
 */

import { Actors } from './actors.js';
import { Camera } from './camera.js';
import { STOP, WORLD } from './constants.js';
import { Cursor } from './cursor.js';
import { applyDesign, DEFAULT_PUNCH, LIMITS, MODES, resolveBackdrop, resolveDesign, resolveDuration } from './design.js';
import { h, rectIn } from './dom.js';
import { Links } from './links.js';
import { getSurface, getTemplate } from './registry.js';
import { actionOf, GENERIC_ACTIONS, resolveStepScreen } from './steps.js';
import { easeOf, Timeline } from './timeline.js';
import { clamp, hasOwn, initials, isObject, parseSelector } from './util.js';
import { layoutFor } from '../templates/layouts.js';

const INTRO_MS = 3000;
const CHAPTER_SETTLE_MS = 300;
const CHAPTER_END_MS = 600;
const CAPTION_MS = 1100;
const ENTER_MS = 800;
const EXIT_MS = 650;
const FOLLOW_TRAIL = 'follow';
const FRONT_MS = 450;
const ENDCARD_DELAY_MS = 2200;

// How screens enter (amount 0 → 1) and exit (amount 1 → 0). `apply` sets the
// element's transform and opacity for a given amount; `ease` and `ms` are defaults.
const slide = (dx, dy) => ({
    ease: 'smooth',
    apply: (el, amount) => {
        const rest = 1 - amount;
        el.style.setProperty('transform', `translate(${dx * rest}px, ${dy * rest}px)`);
        el.style.setProperty('opacity', String(clamp(amount, 0, 1)));
    }
});

const EFFECTS = {
    left: slide(-260, 0),
    right: slide(260, 0),
    top: slide(0, -200),
    bottom: slide(0, 200),
    fade: { ease: 'smooth', apply: (el, amount) => el.style.setProperty('opacity', String(clamp(amount, 0, 1))) },
    zoom: {
        ease: 'smooth',
        apply: (el, amount) => {
            el.style.setProperty('transform', `scale(${0.88 + 0.12 * amount})`);
            el.style.setProperty('opacity', String(clamp(amount, 0, 1)));
        }
    },
    // springs in from small with a little overshoot
    pop: {
        ease: 'spring',
        ms: 650,
        apply: (el, amount) => {
            el.style.setProperty('transform', `scale(${0.55 + 0.45 * amount})`);
            el.style.setProperty('opacity', String(clamp(amount * 2, 0, 1)));
        }
    },
    // falls in from above and bounces to rest
    drop: {
        ease: 'bounce',
        ms: 1000,
        apply: (el, amount) => {
            el.style.setProperty('transform', `translateY(${-420 * (1 - amount)}px)`);
            el.style.setProperty('opacity', String(clamp(amount * 3, 0, 1)));
        }
    },
    // grows out of a dock point at the bottom centre of the stage
    launch: {
        ease: 'snappy',
        ms: 700,
        dock: true,
        apply: (el, amount) => {
            el.style.setProperty('transform', `scale(${0.05 + 0.95 * amount})`);
            el.style.setProperty('opacity', String(clamp(amount * 1.6, 0, 1)));
        }
    },
    // turns in on its vertical axis like a card
    flip: {
        ease: 'smooth',
        ms: 750,
        apply: (el, amount) => {
            el.style.setProperty('transform', `perspective(1400px) rotateY(${-90 * (1 - amount)}deg)`);
            el.style.setProperty('opacity', String(amount < 0.02 ? 0 : 1));
        }
    }
};
// minimize is launch in reverse (it's an exit effect, but entering with it reads the same as launch)
EFFECTS.minimize = EFFECTS.launch;

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Player {
    /**
     * @param {HTMLElement} host   element that receives events (the <cue-flick> element)
     * @param {HTMLElement} mount  container to render into (inside the shadow root)
     * @param {object} clip        a clip that passed validateClip()
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
        this.world = h('div', { class: 'cf-world' });
        this.backdrop = h('div', { class: 'cf-backdrop', 'aria-hidden': 'true' });
        this.progressBar = h('i');
        this.subtitle = h('span');
        this.intro = this.buildIntro();
        this.endcard = this.buildEndcard();
        this.stage = h('div', {
            class: 'cf-stage',
            role: 'group',
            'aria-roledescription': 'product film',
            'aria-label': clip.title
        }, [
            this.backdrop,
            this.world,
            h('div', { class: 'cf-progress', 'aria-hidden': 'true' }, this.progressBar),
            this.intro,
            h('div', { class: 'cf-subtitle', 'aria-hidden': 'true' }, this.subtitle),
            this.endcard,
            h('div', { class: 'cf-poster' }, h('slot', { name: 'poster' }))
        ]);
        this.root = h('div', { class: 'cf-player' }, [
            this.stage,
            this.options.controls ? this.buildControls() : null,
            clip.disclaimer ? h('p', { class: 'cf-disclaimer', text: clip.disclaimer }) : null,
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
            i ? h('span', { class: 'cf-intro-arrow', text: '→' }) : null,
            h('span', { class: 'cf-intro-app' }, [
                h('span', { class: 'cf-appicon', style: { '--app': app.color ?? this.design.accent }, text: app.icon ?? initials(app.name) }),
                h('span', { text: app.name })
            ])
        ]);
        return h('div', { class: 'cf-intro', 'aria-hidden': 'true' }, h('div', { class: 'cf-intro-inner' }, [
            h('div', { class: 'cf-intro-chain' }, chain),
            h('div', { class: 'cf-intro-title', text: this.clip.title }),
            h('div', { class: 'cf-intro-overview', text: this.clip.story.overview })
        ]));
    }

    buildEndcard() {
        const steps = this.clip.story.workflow ?? [];
        const replay = h('button', { class: 'cf-cbtn', type: 'button', text: 'Replay ↺' });
        replay.addEventListener('click', () => this.replay());
        return h('div', { class: 'cf-endcard' }, h('div', { class: 'cf-endcard-inner' }, [
            h('div', { class: 'cf-endcard-label', text: 'How it works' }),
            h('ol', {}, steps.map((text, i) => h('li', { style: { '--i': i } }, [h('span', { class: 'cf-check', text: '✓' }), h('span', { text })]))),
            replay
        ]));
    }

    buildControls() {
        this.chapterButtons = this.chapters.map((chapter, i) => {
            const button = h('button', { class: 'cf-ch', type: 'button', 'aria-label': `Chapter ${i + 1}: ${chapter.title}` }, [
                h('span', { class: 'cf-ch-num', text: String(i + 1).padStart(2, '0') }),
                h('span', { class: 'cf-ch-label', text: chapter.title })
            ]);
            button.addEventListener('click', () => this.goTo(i));
            return button;
        });
        this.nowLabel = h('div', { class: 'cf-now', 'aria-live': 'polite' });
        this.playButton = h('button', { class: 'cf-cbtn', type: 'button', text: 'Play ▶' });
        this.playButton.addEventListener('click', () => this.toggle());
        const replay = h('button', { class: 'cf-cbtn', type: 'button', text: 'Replay ↺' });
        replay.addEventListener('click', () => this.replay());
        const fullscreen = h('button', { class: 'cf-cbtn', type: 'button', 'aria-label': 'Full screen', text: '⛶' });
        fullscreen.addEventListener('click', () => this.toggleFullscreen());
        const chapters = h('div', { class: 'cf-chapters', style: { '--n': this.chapters.length } }, this.chapterButtons);
        return h('div', { class: 'cf-controls' }, [chapters, this.nowLabel, h('div', { class: 'cf-buttons' }, [this.playButton, replay, fullscreen])]);
    }

    /** Screen-reader transcript: the story and the script, read in order. */
    buildTranscript() {
        const { story } = this.clip;
        return h('div', { class: 'cf-sr' }, [
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
            view.el.classList.add('cf-screen');
            view.el.classList.toggle('cf-off', def.hidden === true);
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
        this.actors = new Actors(this.world, this.clip.actors);
        this.cursor = new Cursor(this.world, { hidden: !this.design.cursor });
        this.setBackdrop(this.design.backdrop);
        this.camera = new Camera(this.stage, this.world, target => this.targetRect(target), {
            maxZoom: this.design.camera.zoom,
            speed: this.design.camera.speed,
            ease: this.design.camera.ease
        });
    }

    /** World rect for "all" (screens on stage), a screen id, or "screen.part:name". */
    targetRect(target) {
        const entries = Object.values(this.views);
        if (target === 'all') {
            const onStage = [...entries.filter(entry => entry.visible).map(entry => entry.rect), ...this.actorRects()];
            const set = onStage.length ? onStage : entries.map(entry => entry.rect);
            const x = Math.min(...set.map(r => r.x));
            const y = Math.min(...set.map(r => r.y));
            const right = Math.max(...set.map(r => r.x + r.w));
            const bottom = Math.max(...set.map(r => r.y + r.h));
            return { x, y, w: right - x, h: bottom - y, kind: 'all' };
        }
        const parsed = parseSelector(target);
        if (parsed && !hasOwn(this.views, parsed.screen) && hasOwn(this.actors?.items, parsed.screen)) {
            const rect = this.actors.rect(this.actors.items[parsed.screen], parsed.part === 'piece' ? Number(parsed.name) : undefined);
            return rect ? { ...rect, kind: 'part' } : null;
        }
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
        this.root.classList.add('cf-has-poster');
        const play = h('button', { class: 'cf-bigplay', type: 'button', 'aria-label': `Play ${this.clip.title}`, text: '▶' });
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
        this.root.classList.remove('cf-has-poster', 'cf-ended');
        this.setState(isStatic ? 'static' : 'playing');
        this.buildScene();
        this.intro.classList.remove('cf-show');
        this.endcard.classList.remove('cf-show');
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
        return {
            ...this.timeline.context(id, { fast, pace: this.design.pace }),
            cursor: this.cursor,
            links: this.links,
            player: this
        };
    }

    async playIntro(id) {
        const ctx = this.context(id, false);
        this.intro.classList.add('cf-show');
        await ctx.wait(INTRO_MS);
        this.intro.classList.remove('cf-show');
        await ctx.wait(500);
    }

    async playChapter(index, ctx) {
        const chapter = this.chapters[index];
        this.setChapter(index);
        this.setProgress(index / this.chapters.length);
        this.setSubtitle(chapter.narration ?? '');
        if (chapter.backdrop !== undefined) this.setBackdrop(resolveBackdrop(chapter.backdrop), ctx);
        if (chapter.focus) await this.alongside(this.camera.focus(chapter.focus, { zoom: chapter.zoom, ctx, duration: chapter.duration, ease: chapter.ease }), chapter.async);
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
        if (action === 'focus') await this.alongside(this.camera.focus(value, { zoom: step.zoom, ctx, duration: step.duration, ease: step.ease }), step.async);
        else if (action === 'pan') await this.alongside(this.camera.pan(value, { ctx, duration: step.duration, ease: step.ease }), step.async);
        else if (action === 'dive') await this.dive(value, step, ctx);
        else if (action === 'blur') this.setBlur(value, step.amount);
        else if (action === 'caption') {
            this.setSubtitle(value);
            await ctx.wait(CAPTION_MS);
        } else if (action === 'wait') await ctx.wait(value);
        else if (action === 'packet') await this.links.packet(value.from, value.to, target => this.targetRect(target), ctx);
        else if (action === 'enter') await this.enterScreen(value, step.from ?? 'right', ctx, step);
        else if (action === 'exit') await this.exitScreen(value, step.to ?? 'left', ctx, step);
        else if (action === 'front') {
            this.frontScreen(value, step.dim !== false);
            await ctx.wait(FRONT_MS);
        } else if (action === 'spawn') await this.spawnActors(value, step, ctx);
        else if (action === 'move') await this.alongside(this.moveActor(value, step, ctx), step.async);
        else if (action === 'leave') await this.leaveActors(value, step, ctx);
        else if (action === 'confetti') await this.actors.confetti(this.pointFor(value), ctx, { count: step.count, colors: step.colors, power: step.power });
        else if (action === 'backdrop') this.setBackdrop(resolveBackdrop(value), ctx);
    }

    /** Zoom through a target until it fills the frame; behind it, "into" changes the backdrop for the next scene. */
    async dive(target, step, ctx) {
        const parsed = parseSelector(target);
        const actor = parsed && !hasOwn(this.views, parsed.screen) && hasOwn(this.actors.items, parsed.screen) ? this.actors.items[parsed.screen] : null;
        const round = actor ? ['sphere', 'ring'].includes(actor.shape) : false;
        await this.camera.dive(target, { ctx, round, duration: step.duration ?? 1100, ease: step.ease ?? 'gentle' });
        if (step.into !== undefined) this.setBackdrop(resolveBackdrop(step.into));
    }

    /**
     * Rack focus: blur everything but one screen or actor (false clears it).
     * @param {string|false} target
     * @param {number} [amount] blur radius in px
     */
    setBlur(target, amount) {
        const keep = typeof target === 'string' ? parseSelector(target)?.screen : null;
        const blur = (el, id) => el.classList.toggle('cf-blurred', keep !== null && id !== keep);
        for (const entry of Object.values(this.views)) blur(entry.view.el, entry.key);
        for (const actor of Object.values(this.actors.items)) {
            for (const piece of actor.pieces) {
                blur(piece.el, actor.id);
                blur(piece.shadow, actor.id);
            }
        }
        this.world.style.setProperty('--cf-blur', `${clamp(typeof amount === 'number' ? amount : 7, 1, 24)}px`);
    }

    /** Visible actors' rects, for framing "all". */
    actorRects() {
        return Object.values(this.actors?.items ?? {}).filter(actor => actor.visible).map(actor => this.actors.rect(actor));
    }

    /** Where an actor goes for "at"/"to": a world point { x, y }, or a target (its centre, or its top edge with "perch"). */
    spotFor(actor, at, { perch, offset } = {}) {
        if (typeof at === 'string') {
            const rect = this.targetRect(at);
            return rect ? this.actors.spotFor(actor, rect, { perch, offset }) : undefined;
        }
        return isObject(at) ? { x: at.x + (offset?.x ?? 0), y: at.y + (offset?.y ?? 0) } : undefined;
    }

    /** A world point for a target or { x, y } (the stage centre if neither). */
    pointFor(value) {
        const rect = typeof value === 'string' ? this.targetRect(value) : null;
        if (rect) return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
        return isObject(value) ? { x: value.x, y: value.y } : { x: WORLD.width / 2, y: WORLD.height / 2 };
    }

    /** Spawn one actor or several; each one's pieces pop in one after another. */
    async spawnActors(value, step, ctx) {
        const stagger = typeof step.stagger === 'number' ? clamp(step.stagger, 0, 2000) : 90;
        const runs = [];
        let delay = 0;
        for (const id of [value].flat()) {
            if (!hasOwn(this.actors.items, id)) continue;
            const actor = this.actors.items[id];
            const at = step.at === undefined ? undefined : this.spotFor(actor, step.at, step);
            const start = delay;
            runs.push((async () => {
                if (start && !ctx.fast) await ctx.wait(start);
                await this.actors.spawn(actor, ctx, { at, effect: step.effect, stagger, bounces: step.bounces, bounciness: step.bounciness });
            })());
            delay += stagger * actor.pieces.length;
        }
        await Promise.all(runs);
    }

    async moveActor(id, step, ctx) {
        if (!hasOwn(this.actors.items, id)) return;
        const actor = this.actors.items[id];
        const to = this.spotFor(actor, step.to, step);
        if (to) await this.actors.move(actor, ctx, { to, path: step.path, duration: step.duration, ease: step.ease, height: step.height, bounces: step.bounces, bounciness: step.bounciness });
    }

    async leaveActors(value, step, ctx) {
        const ids = [value].flat().filter(id => hasOwn(this.actors.items, id));
        await Promise.all(ids.map(async (id, i) => {
            if (i && !ctx.fast) await ctx.wait(i * 70);
            await this.actors.leave(this.actors.items[id], ctx, { effect: step.effect });
        }));
    }

    /** Fade the stage backdrop to a colour pair; null clears it. Instant without a playing context. */
    setBackdrop(colors, ctx) {
        const instant = !ctx || ctx.fast;
        const old = [...this.backdrop.children];
        if (!colors) {
            for (const layer of old) layer.remove();
            return;
        }
        const layer = h('div', { class: instant ? 'cf-backdrop-layer cf-instant' : 'cf-backdrop-layer', style: { '--bd-1': colors[0], '--bd-2': colors[1] } });
        this.backdrop.append(layer);
        const show = () => {
            layer.classList.add('cf-in');
            const clear = () => old.forEach(node => node.remove());
            if (instant) clear();
            else setTimeout(clear, 750);
        };
        if (instant) show();
        else requestAnimationFrame(show);
    }

    async runSurfaceStep(step, action, ctx) {
        const target = resolveStepScreen(step, action, this.views);
        if (target.error) return;
        const entry = this.views[target.key];
        const spec = entry.surface.actions[action];
        const selector = typeof step[action] === 'string' ? parseSelector(step[action]) : null;
        const name = selector?.part ? selector.name : null;
        if (this.design.camera.follow) this.followStep(entry, spec, step, name, ctx);
        await spec.run(entry.view, step, { ...ctx, name, screens: this.views, punch: this.punchFor(step), camera: this.cameraFor(ctx) });
    }

    /**
     * Camera moves a surface action may make: `look` at a detail and come
     * `back`, or `track` something (a caret) while the camera follows the action.
     */
    cameraFor(ctx) {
        return {
            look: (el, options) => this.camera.look(rectIn(this.world, el), { ctx, ...options }),
            back: options => this.camera.back({ ctx, ...options }),
            track: (el, within) => {
                if (!this.design.camera.follow) return;
                this.alongside(this.camera.track(rectIn(this.world, el), ctx, within ? rectIn(this.world, within) : undefined), true);
            }
        };
    }

    /** Punch-in settings for one step: the design default, overridden by the step's "punch". */
    punchFor(step) {
        if (step.punch === false || this.reduced) return null;
        const base = this.design.camera.punch ?? (step.punch !== undefined ? { ...DEFAULT_PUNCH } : null);
        if (!base) return null;
        if (typeof step.punch === 'number') return { ...base, amount: clamp(step.punch, ...LIMITS.punchAmount) };
        return base;
    }

    /** Follow mode: ease the camera toward what this step acts on, alongside the step. */
    followStep(entry, spec, step, name, ctx) {
        const el = (name && spec.part ? entry.view.find(spec.part, name) : null) ?? spec.follow?.(entry.view, step) ?? null;
        if (!el) return;
        this.alongside(this.camera.follow({ ...rectIn(this.world, el), kind: FOLLOW_TRAIL }, ctx), true);
    }

    /** Await a move, or let it run alongside the next steps. */
    alongside(move, async) {
        if (!async) return move;
        move.catch(error => {
            if (error !== STOP) console.error(error);
        });
        return undefined;
    }

    // ---------- screens on and off stage ----------

    /** Run a screen effect from one amount to another, then clear the inline styles. */
    async playEffect(entry, effectName, ctx, { from, to, duration, ease, defaultMs }) {
        const { el } = entry.view;
        const effect = EFFECTS[effectName] ?? EFFECTS.right;
        if (effect.dock) {
            // the dock point is the bottom centre of the world, relative to this screen
            el.style.setProperty('transform-origin', `${WORLD.width / 2 - entry.rect.x}px ${WORLD.height - entry.rect.y}px`);
        }
        const curve = easeOf(ease ?? (to > from ? effect.ease : 'smooth'));
        const ms = resolveDuration(duration) ?? effect.ms ?? defaultMs;
        effect.apply(el, from);
        await ctx.animate(ms, progress => effect.apply(el, from + (to - from) * curve(progress)));
        for (const property of ['transform', 'opacity', 'transform-origin']) el.style.removeProperty(property);
    }

    async enterScreen(key, from, ctx, step = {}) {
        const entry = this.views[key];
        if (!entry || entry.visible) return;
        entry.visible = true;
        this.raise(entry);
        (EFFECTS[from] ?? EFFECTS.right).apply(entry.view.el, 0);
        entry.view.el.classList.remove('cf-off');
        await this.playEffect(entry, from, ctx, { from: 0, to: 1, duration: step.duration, ease: step.ease, defaultMs: ENTER_MS });
        entry.surface.relayout?.(entry.view);
    }

    async exitScreen(key, to, ctx, step = {}) {
        const entry = this.views[key];
        if (!entry || !entry.visible) return;
        await this.playEffect(entry, to, ctx, { from: 1, to: 0, duration: step.duration, ease: step.ease, defaultMs: EXIT_MS });
        entry.visible = false;
        entry.view.el.classList.add('cf-off');
        entry.view.el.classList.remove('cf-dimmed');
    }

    frontScreen(key, dimOthers) {
        const entry = this.views[key];
        if (!entry) return;
        this.raise(entry);
        for (const other of Object.values(this.views)) other.view.el.classList.toggle('cf-dimmed', dimOthers && other !== entry && other.visible);
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
            this.endcard.classList.toggle('cf-instant', isStatic);
            this.endcard.classList.add('cf-show');
        }
        this.root.classList.add('cf-ended');
        this.chapterButtons?.forEach(button => {
            button.classList.add('cf-done');
            button.classList.remove('cf-active');
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
        this.root.classList.toggle('cf-paused', state === 'paused');
        if (this.playButton) this.playButton.textContent = state === 'playing' ? 'Pause ❚❚' : 'Play ▶';
    }

    toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else this.host.requestFullscreen?.();
    }

    setChapter(index) {
        this.chapterButtons?.forEach((button, i) => {
            button.classList.toggle('cf-done', i < index);
            button.classList.toggle('cf-active', i === index);
            button.setAttribute('aria-current', i === index ? 'step' : 'false');
        });
        if (this.nowLabel) this.nowLabel.textContent = `${String(index + 1).padStart(2, '0')} · ${this.chapters[index].title}`;
        this.emit('chapter', { index, title: this.chapters[index].title });
    }

    setSubtitle(text) {
        this.subtitle.textContent = text;
        this.subtitle.parentElement.classList.toggle('cf-show', Boolean(text) && this.design.subtitles);
    }

    setProgress(fraction) {
        this.progressBar.style.setProperty('--p', String(fraction));
    }

    emit(name, detail) {
        this.host.dispatchEvent(new CustomEvent(`cueflick:${name}`, { detail, bubbles: true, composed: true }));
    }

    destroy() {
        this.timeline.cancel();
        this.viewObserver?.disconnect();
        this.resizeObserver?.disconnect();
        this.colorScheme?.removeEventListener('change', this.onColorScheme);
        this.pendingStart = null;
    }
}
