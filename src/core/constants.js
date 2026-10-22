/* global __CLIPSCRIPT_VERSION__ */
export const VERSION = typeof __CLIPSCRIPT_VERSION__ === 'string' ? __CLIPSCRIPT_VERSION__ : '0.0.0-dev';

/** Rejection value used to unwind a playback run that was replaced or stopped. */
export const STOP = Symbol('clipscript.stop');

/** Every film is laid out on a fixed 16:9 world; the camera scales it to fit. */
export const WORLD = Object.freeze({ width: 1600, height: 900 });
