// Type definitions for clipscript 0.2

export declare const version: string;
export declare const FORMAT_VERSION: '1';
export declare const WORLD: { readonly width: 1600; readonly height: 900 };

// ---------- clip format ----------

export type Mode = 'dark' | 'light' | 'auto';
export type Aspect = 'auto' | '16:9' | '4:5' | '1:1';
export type Layout = 'row' | 'stage' | 'desktop';
export type Slot = 'left' | 'center' | 'right' | 'wide-left' | 'wide-right' | 'full' | 'pip' | 'pip-left';
export type Direction = 'left' | 'right' | 'top' | 'bottom' | 'fade' | 'zoom';
export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

/** "screen" or "screen.part:name", e.g. "crm.field:Stage", "flow.node:trigger", "books.row:1042". */
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
    camera?: { zoom?: number; speed?: number };
    pace?: number;
    intro?: boolean;
    subtitles?: boolean;
    endcard?: boolean;
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

export interface AiChatScreen extends ScreenBase {
    surface: 'ai-chat';
    assistant?: string;
    model?: string;
    user?: string;
    title?: string;
    greeting?: string;
    recents?: string[];
    connectors?: Connector[];
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
    | (ScreenBase & { surface: string } & Record<string, unknown>);

export type Step =
    | { focus: Target | 'all'; zoom?: number }
    | { caption: string }
    | { wait: number }
    | { packet: { from: Target; to: Target } }
    | { enter: string; from?: Direction }
    | { exit: string; to?: Direction }
    | { front: string; dim?: boolean }
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
    | { prompt: string; on?: string }
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
    steps: Step[];
}

export interface Clip {
    $schema?: string;
    clipscript: '1';
    title: string;
    template: 'trigger-automation-notify' | 'assistant-connector' | (string & {});
    layout?: Layout;
    disclaimer?: string;
    story: Story;
    design?: Design;
    screens: Record<string, Screen>;
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

export interface ClipScriptElement extends HTMLElement {
    clip: Clip | null;
    readonly player: Player | null;
    play(): void;
    pause(): void;
    replay(): void;
    goTo(index: number): void;
}

export declare function mount(target: Element, clip: Clip | string, options?: MountOptions): ClipScriptElement;
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

interface ClipScriptAttributes {
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
        'clip-script': ClipScriptElement;
    }
    interface HTMLElementEventMap {
        'clipscript:chapter': CustomEvent<{ index: number; title: string }>;
        'clipscript:ready': CustomEvent<{ chapter: number }>;
        'clipscript:ended': CustomEvent<Record<string, never>>;
        'clipscript:error': CustomEvent<{ error?: Error; result?: ValidationResult }>;
    }
    // lets <clip-script src="..."> type-check in TSX
    namespace JSX {
        interface IntrinsicElements {
            'clip-script': ClipScriptAttributes;
        }
    }
}
