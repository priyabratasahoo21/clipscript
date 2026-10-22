// Type definitions for cueflick 0.3

export declare const version: string;
export declare const FORMAT_VERSION: '1';
export declare const WORLD: { readonly width: 1600; readonly height: 900 };

// ---------- clip format ----------

export type Mode = 'dark' | 'light' | 'auto';
export type Aspect = 'auto' | '16:9' | '4:5' | '1:1';
export type Layout = 'row' | 'stage' | 'desktop';
export type Slot = 'left' | 'center' | 'right' | 'wide-left' | 'wide-right' | 'full' | 'pip' | 'pip-left';
export type Direction = 'left' | 'right' | 'top' | 'bottom' | 'fade' | 'zoom' | 'pop' | 'drop' | 'launch' | 'minimize' | 'flip';
export type Ease = 'smooth' | 'snappy' | 'linear' | 'gentle' | 'spring';
/** A stage colour, or two for a top-to-bottom gradient. */
export type Backdrop = string | [string] | [string, string];
/** Punch in on clicks: true, a zoom amount (1.05–2), or { amount, hold }. */
export type Punch = boolean | number | { amount?: number; hold?: number };
/** Where an actor goes: a target (with "perch" it sits on top) or a world point. */
export type Spot = Target | { x: number; y: number };
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

/** "screen", "screen.part:name", an actor id, or "actor.piece:2", e.g. "crm.field:Stage", "chat.file:q3", "tiles.piece:1". */
export type Target = string;

export interface Rect { x: number; y: number; w: number; h: number }

export interface App {
    name: string;
    /** Hex colour, e.g. "#4f7cff". */
    color?: string;
    /** 1–4 character monogram, e.g. "SA". */
    icon?: string;
}

export interface Story {
    /** One or two sentences: what happens and why it matters. */
    overview: string;
    description?: string;
    audience?: string;
    /** The process, one plain sentence per step. Shown on the end card. */
    workflow?: string[];
}

export interface Design {
    mode?: Mode;
    /** "auto" is 16:9, or 4:5 on narrow players. */
    aspect?: Aspect;
    accent?: string;
    font?: { ui?: string; mono?: string };
    radius?: number;
    camera?: {
        zoom?: number;
        speed?: number;
        ease?: Ease;
        punch?: Punch;
        /** Ease toward what each step acts on, and keep a caret in view while typing. */
        follow?: boolean;
    };
    pace?: number;
    intro?: boolean;
    subtitles?: boolean;
    endcard?: boolean;
    /** false hides the pointer (touch-first films). */
    cursor?: boolean;
    backdrop?: Backdrop;
}

/** Options every screen accepts. */
export interface ScreenBase {
    app: App;
    /** This screen's colour mode, overriding design.mode. */
    mode?: 'light' | 'dark';
    /** Start off stage; bring it on with an `enter` step. */
    hidden?: boolean;
    /** A slot name or an explicit rect in world units (1600×900). */
    place?: Slot | Rect;
    /** Width in world units (the layout decides the rest). */
    width?: number;
}

export interface CrmRecordScreen extends ScreenBase {
    surface: 'crm-record';
    record: {
        title: string;
        fields: Record<string, string | number>;
        module?: string;
        type?: string;
        stages?: string[];
        stageField?: string;
        options?: Record<string, string[]>;
        buttons?: string[];
        activity?: Array<{ text: string; time?: string }>;
    };
}

export interface FlowNode {
    id: string;
    title: string;
    sub?: string;
    icon?: string;
    color?: string;
    /** A screen id whose app icon and colour this node borrows. */
    app?: string;
    trigger?: boolean;
    params?: Record<string, string | number | boolean>;
}

export interface FlowCanvasScreen extends ScreenBase {
    surface: 'flow-canvas';
    workflow?: string;
    nodes: FlowNode[];
}

export interface ChatMessage {
    /** Person's name (when not from an app). */
    from?: string;
    /** A screen id: the message shows that app's name and icon. */
    app?: string;
    /** Supports *bold*, `code`, and line breaks. */
    text: string;
    time?: string;
}

export interface TeamChatScreen extends ScreenBase {
    surface: 'team-chat';
    channel: string;
    channels?: string[];
    workspace?: string;
    members?: number;
    history?: Array<{ from: string; text: string; time?: string }>;
}

export interface Connector {
    id: string;
    name: string;
    /** A screen id whose app icon and colour this connector borrows. */
    app?: string;
    icon?: string;
    color?: string;
    enabled?: boolean;
}

export interface ChatFile {
    /** Referenced in prompts and replies as "@id". */
    id: string;
    name: string;
    kind?: 'image' | 'doc' | 'pdf' | 'sheet';
    meta?: string;
    /** A real image for the preview: an https URL, a path in the clip's folder, or a data:image/… URL. */
    src?: string;
    /** Otherwise the preview is drawn from this. */
    preview?: { title?: string; lines?: string[]; chart?: number[]; rows?: string[][]; color?: string };
}

export interface AiChatScreen extends ScreenBase {
    surface: 'ai-chat';
    assistant?: string;
    model?: string;
    user?: string;
    title?: string;
    greeting?: string;
    placeholder?: string;
    /** warm: soft and serif; neutral: plain grey and sans-serif. */
    look?: 'warm' | 'neutral';
    recents?: string[];
    connectors?: Connector[];
    files?: ChatFile[];
}

export interface Notification {
    id?: string;
    app: string;
    title?: string;
    text: string;
    /** 1–3 characters: a monogram or an emoji. */
    icon?: string;
    color?: string;
    time?: string;
}

export interface ListRow {
    id: string;
    label: string;
    icon?: string;
    color?: string;
    detail?: string;
    value?: string;
    /** A switch, on or off. */
    toggle?: boolean;
    chevron?: boolean;
}

export interface PhoneScreen extends ScreenBase {
    surface: 'phone';
    time?: string;
    date?: string;
    /** The assistant's name; default "Iris". */
    assistant?: string;
    /** Cards in liquid glass, light, or dark. */
    material?: 'glass' | 'light' | 'dark';
    wallpaper?: string | string[];
    /** Screen corner radius in px (24–60); the frame and the Screen Pool stay concentric with it. */
    corner?: number;
    /** The expanded Screen Pool's gap from the top and sides, in px (4–16). */
    poolInset?: number;
    /** 2–7 colours for the assistant's edge light. */
    glow?: string[];
    notifications?: Notification[];
    screen?: 'lock' | 'list';
    list?: { title: string; circles?: string[]; sections: Array<{ title?: string; rows: ListRow[] }> };
}

export interface TableRow {
    id: string;
    cells: Array<string | number>;
    status?: string;
    tone?: Tone;
    /** Hidden until an `add` step reveals it. */
    new?: boolean;
    detail?: Record<string, string>;
}

export interface BrowserAppScreen extends ScreenBase {
    surface: 'browser-app';
    url?: string;
    tab?: string;
    company?: string;
    title?: string;
    nav?: string[];
    active?: string;
    summary?: Array<{ label: string; value: string; tone?: Tone }>;
    columns: string[];
    rows: TableRow[];
}

export type Screen =
    | CrmRecordScreen
    | FlowCanvasScreen
    | TeamChatScreen
    | AiChatScreen
    | BrowserAppScreen
    | PhoneScreen
    | (ScreenBase & { surface: string } & Record<string, unknown>);

/** A character: a sphere, block, pill, or ring (or a group of them) that moves like an actor. */
export interface Actor {
    shape?: 'sphere' | 'block' | 'pill' | 'ring';
    color?: string;
    /** One colour per piece of a group (they repeat). */
    colors?: string[];
    /** World units, 16–600. */
    size?: number;
    /** Pieces in a group (1–24), laid out in a grid. */
    count?: number;
    columns?: number;
    gap?: number;
    label?: string;
    labels?: string[];
    at?: { x: number; y: number };
    /** How much it squashes and stretches, 0–2 (spheres 1, blocks 0.4). */
    squash?: number;
    finish?: 'gloss' | 'matte' | 'glass';
}

type Motion = { duration?: number; ease?: Ease };
type Bounce = { bounces?: number; bounciness?: number };

export type Step =
    | ({ focus: Target | 'all'; zoom?: number; async?: boolean } & Motion)
    | ({ pan: Target | { x?: number; y?: number }; async?: boolean } & Motion)
    | ({ dive: Target; into?: Backdrop } & Motion)
    | { blur: Target | false; amount?: number }
    | { caption: string }
    | { wait: number }
    | { packet: { from: Target; to: Target } }
    | ({ enter: string; from?: Direction } & Motion)
    | ({ exit: string; to?: Direction } & Motion)
    | { front: string; dim?: boolean }
    | ({ spawn: string | string[]; effect?: 'pop' | 'drop' | 'rise' | 'fade'; stagger?: number; at?: Spot; perch?: boolean; offset?: { x: number; y: number } } & Bounce)
    | ({ move: string; to: Spot; path?: 'hop' | 'bounce' | 'roll' | 'slide' | 'float'; perch?: boolean; offset?: { x: number; y: number }; height?: number; async?: boolean } & Motion & Bounce)
    | { leave: string | string[]; effect?: 'pop' | 'fall' | 'shrink' | 'fade' }
    | { confetti: Spot; count?: number; colors?: string[]; power?: number }
    | { backdrop: Backdrop }
    | { choose: Target; value: string; on?: string }
    | { type: Target; text: string; on?: string }
    | { click: Target; on?: string }
    | { toast: string; on?: string }
    | { run: Target; ms?: number; output?: unknown; result?: string; on?: string }
    | { open: Target; on?: string }
    | { expression: string; preview: string; field?: string; on?: string }
    | { message: ChatMessage; on?: string }
    | { react: { emoji: string; count?: number }; on?: string }
    | { reply: ChatMessage; on?: string }
    | { connect: Target; on?: string }
    | { prompt: string; draft?: boolean; on?: string }
    | { send: true; on?: string }
    | { hover: Target; zoom?: boolean | number; ms?: number; on?: string }
    | { notify: Notification; on?: string }
    | { ask: string; ms?: number; on?: string }
    | { summarize: string; title?: string; ms?: number; on?: string }
    | { pool: 'idle' | 'music' | 'iris'; title?: string; artist?: string; art?: string[]; expand?: boolean; ms?: number; on?: string }
    | { toggle: Target; on?: boolean }
    | { tap: Target; on?: string }
    | { think: number; on?: string }
    | { tool: string; connector?: string; input?: Record<string, unknown>; result?: string; ms?: number; on?: string }
    | { respond: string; on?: string }
    | { add: Target; on?: string }
    | { status: Target; to: string; on?: string }
    | { select: Target; on?: string };

export interface Chapter {
    title: string;
    /** The script line for this chapter, shown as the subtitle. */
    narration?: string;
    focus?: Target | 'all';
    zoom?: number;
    duration?: number;
    ease?: Ease;
    /** Start the steps while the camera is still moving. */
    async?: boolean;
    backdrop?: Backdrop;
    steps: Step[];
}

export interface Clip {
    $schema?: string;
    cueflick: '1';
    title: string;
    template: 'assistant-files' | 'phone-feature' | 'assistant-connector' | 'trigger-automation-notify' | (string & {});
    layout?: Layout;
    disclaimer?: string;
    story: Story;
    design?: Design;
    screens: Record<string, Screen>;
    actors?: Record<string, Actor>;
    chapters: Chapter[];
}

// ---------- validation ----------

export interface Issue {
    path: string;
    message: string;
    hint?: string;
}

export interface ValidationResult {
    ok: boolean;
    errors: Issue[];
    warnings: Issue[];
}

export interface Report {
    error(path: string, message: string, hint?: string): void;
    warn(path: string, message: string, hint?: string): void;
}

export declare function validate(clip: unknown): ValidationResult;
export declare function formatReport(result: ValidationResult, file?: string): string;

// ---------- playback ----------

export type PlayerState = 'idle' | 'playing' | 'paused' | 'static' | 'ended';

export interface MountOptions {
    autoplay?: 'view' | 'none';
    controls?: boolean;
    /** Show one chapter's end state, without animation. */
    chapter?: number;
    mode?: Mode;
    endcard?: boolean;
    reducedMotion?: boolean;
    tagName?: string;
}

export declare class Player {
    constructor(host: HTMLElement, mount: HTMLElement, clip: Clip, options?: Omit<MountOptions, 'tagName'>);
    readonly state: PlayerState;
    /** Index of the chapter whose static view has finished drawing, or null. */
    readonly readyChapter: number | null;
    play(): void;
    pause(): void;
    toggle(): void;
    replay(): void;
    goTo(index: number): void;
    destroy(): void;
}

export interface CueflickElement extends HTMLElement {
    clip: Clip | null;
    readonly player: Player | null;
    play(): void;
    pause(): void;
    replay(): void;
    goTo(index: number): void;
}

export declare function mount(target: Element, clip: Clip | string, options?: MountOptions): CueflickElement;
export declare function defineElement(tagName?: string): void;

export declare const DEFAULT_DESIGN: Readonly<Required<Design>>;
export declare const MODES: Mode[];
export declare const ASPECTS: Aspect[];
export declare function resolveDesign(design?: Design): Required<Design>;

// ---------- layout and camera ----------

export declare const LAYOUTS: Layout[];
export declare const SLOTS: Readonly<Record<Slot, Rect>>;
export declare const GENERIC_ACTIONS: string[];
export declare const DIRECTIONS: Direction[];
export declare const EASE_NAMES: Ease[];
export declare const EASES: Readonly<Record<Ease | 'bounce', (t: number) => number>>;
export declare const SHAPES: Array<NonNullable<Actor['shape']>>;
export declare const PATHS: Array<'hop' | 'bounce' | 'roll' | 'slide' | 'float'>;
export declare const SPAWN_EFFECTS: Array<'pop' | 'drop' | 'rise' | 'fade'>;
export declare const LEAVE_EFFECTS: Array<'pop' | 'fall' | 'shrink' | 'fade'>;

export interface LayoutEntry {
    key: string;
    def: Record<string, unknown>;
    surface: SurfaceDefinition;
}

export declare function layoutFor(mode: Layout, entries: LayoutEntry[], world: typeof WORLD): Record<string, Rect>;
/** The world transform (pixels) that frames a rect on a stage of the given size. */
export declare function frameFor(rect: Rect & { kind?: 'screen' | 'part' | 'all' }, stage: { width: number; height: number }, options?: { zoom?: number; maxZoom?: number }): { x: number; y: number; scale: number };

// ---------- extending ----------

export interface StepContext {
    fast: boolean;
    wait(ms: number): Promise<void>;
    animate(ms: number, onFrame: (progress: number) => void): Promise<void>;
    cursor: { moveTo(el: Element, ctx: StepContext, offset?: { dx?: number; dy?: number }): Promise<void>; click(ctx: StepContext): Promise<void>; hide(): void };
    /** Part name from the step's target, e.g. "Stage" for "crm.field:Stage". */
    name: string | null;
    /** Camera moves a surface may make: frame a detail and come back, or keep something in view while following. */
    camera: {
        look(el: Element, options?: { zoom?: number } & Motion): Promise<void>;
        back(options?: Motion): Promise<void>;
        track(el: Element, within?: Element): void;
    };
    /** Punch-in settings for this step, or null. */
    punch: { amount: number; hold: number } | null;
}

export interface SurfaceView {
    el: HTMLElement;
    find(part: string, name: string): Element | null;
    [key: string]: unknown;
}

export interface SurfaceAction {
    summary?: string;
    /** The part kind this action's target must name, e.g. "field". */
    part?: string;
    /** Extra step keys this action reads, e.g. ["value"]. */
    keys?: string[];
    validate?(step: Record<string, unknown>, def: Record<string, unknown>, path: string, report: Report, screens: Record<string, Screen>): void;
    /** Ordering checks: called in film order with per-screen facts (e.g. message counts). */
    order?(facts: Record<string, unknown>, step: Record<string, unknown>, path: string, report: Report): void;
    run(view: SurfaceView, step: Record<string, unknown>, ctx: StepContext): Promise<void>;
}

export interface SurfaceDefinition {
    name: string;
    summary?: string;
    /** Default width in world units. */
    width?: number;
    /** Screen-level keys this surface reads (others are warned about). */
    keys?: string[];
    /** CSS added to the player's shadow root. */
    styles?: string;
    parts?: Record<string, (def: Record<string, unknown>) => string[]>;
    validate?(def: Record<string, unknown>, path: string, report: Report, screens: Record<string, Screen>): void;
    render(def: Record<string, unknown>, context: { screens: Record<string, Screen>; accent: string }): SurfaceView;
    mounted?(view: SurfaceView): void;
    /** Called after a resize or when the screen enters the stage. */
    relayout?(view: SurfaceView): void;
    recap?(view: SurfaceView): void;
    actions?: Record<string, SurfaceAction>;
}

export interface TemplateDefinition {
    name: string;
    title?: string;
    summary?: string;
    requires?: string[];
    /** A layout name, or a function returning a rect per screen. */
    layout?: Layout | ((entries: LayoutEntry[], world: typeof WORLD) => Record<string, Rect>);
    validate?(clip: Clip, report: Report): void;
}

export declare function registerSurface(definition: SurfaceDefinition): void;
export declare function registerTemplate(definition: TemplateDefinition): void;
export declare function catalog(): {
    templates: Array<{ name: string; title?: string; summary?: string; requires: string[] }>;
    surfaces: Array<{ name: string; summary?: string; parts: string[]; actions: Array<{ name: string; summary?: string; keys: string[] }> }>;
};

/** Safe element builder for custom surfaces: sets text only; rejects on* attributes and unsafe URLs. */
export declare function h(tag: string, props?: Record<string, unknown>, children?: unknown): HTMLElement;
export declare function s(tag: string, props?: Record<string, unknown>, children?: unknown): SVGElement;
export declare function richText(text: string): DocumentFragment;

// ---------- DOM and JSX ----------

interface CueflickAttributes {
    src?: string;
    autoplay?: 'view' | 'none';
    controls?: 'none';
    chapter?: string | number;
    mode?: Mode;
    endcard?: 'none';
    'reduced-motion'?: boolean | '';
    class?: string;
    className?: string;
    id?: string;
    style?: unknown;
    children?: unknown;
}

declare global {
    interface HTMLElementTagNameMap {
        'cue-flick': CueflickElement;
    }
    interface HTMLElementEventMap {
        'cueflick:chapter': CustomEvent<{ index: number; title: string }>;
        'cueflick:ready': CustomEvent<{ chapter: number }>;
        'cueflick:ended': CustomEvent<Record<string, never>>;
        'cueflick:error': CustomEvent<{ error?: Error; result?: ValidationResult }>;
    }
    // lets <cue-flick src="..."> type-check in TSX
    namespace JSX {
        interface IntrinsicElements {
            'cue-flick': CueflickAttributes;
        }
    }
}
