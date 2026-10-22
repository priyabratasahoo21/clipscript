// Local-only HTTP server for previews, snapshots, and renders.
// Binds to 127.0.0.1, accepts only local Host headers (no DNS rebinding),
// serves a fixed set of routes (preview mode) or an allow-listed set of
// folders (demo mode), and never lists directories.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PLAYER_FILE = join(PACKAGE_ROOT, 'dist', 'cueflick.min.js');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap">';

const IMAGE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8'
};

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS });
    res.end(body);
}

/** Reject requests whose Host isn't this machine (blocks DNS-rebinding pages). */
function isLocalHost(req) {
    const host = String(req.headers.host ?? '').replace(/:\d+$/, '');
    return LOCAL_HOSTS.has(host);
}

function previewPage({ reload, offline }) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cueflick Preview</title>
${offline ? '' : FONTS}
<style>
  body { margin: 0; background: #07080b; color: #e8ebf1; font-family: Inter, system-ui, sans-serif; }
  main { max-width: 1280px; margin: 0 auto; padding: 32px 24px; }
  body.bare main { max-width: none; padding: 0; }
  body.bare { overflow: hidden; }
</style>
<script src="/__cueflick/cueflick.min.js" defer></script>
</head>
<body>
<main><cue-flick id="film" src="/clip.json"></cue-flick></main>
<script>
  const params = new URLSearchParams(location.search);
  const film = document.getElementById('film');
  for (const name of ['chapter', 'mode', 'controls', 'autoplay', 'endcard']) {
    if (params.has(name)) film.setAttribute(name, params.get(name));
  }
  if (params.has('bare')) document.body.classList.add('bare');
  ${reload ? "new EventSource('/__events').onmessage = () => location.reload();" : ''}
</script>
</body>
</html>`;
}

function listen(server, port) {
    return new Promise((resolvePromise, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            server.off('error', reject);
            resolvePromise(server.address().port);
        });
    });
}

function closer(server, cleanup) {
    return () => new Promise(done => {
        cleanup?.();
        server.closeAllConnections?.();
        server.close(() => done());
    });
}

/**
 * Preview server for one clip file.
 * @returns {Promise<{url: string, close: () => Promise<void>}>}
 */
export async function startPreviewServer(clipFile, { port = 4321, reload = true, offline = false } = {}) {
    const clipPath = resolve(clipFile);
    const clipDir = dirname(clipPath);
    const clients = new Set();
    const page = previewPage({ reload, offline });

    const server = createServer(async (req, res) => {
        if (!isLocalHost(req)) return send(res, 403, 'Forbidden');
        if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
        const { pathname } = new URL(req.url, 'http://localhost');
        try {
            if (pathname === '/') return send(res, 200, page, TYPES['.html']);
            if (pathname === '/clip.json') return send(res, 200, await readFile(clipPath), TYPES['.json']);
            if (pathname === '/__cueflick/cueflick.min.js') return send(res, 200, await readFile(PLAYER_FILE), TYPES['.js']);
            if (IMAGE_TYPES.has(extname(pathname).toLowerCase())) {
                const image = resolve(clipDir, `.${decodeURIComponent(pathname)}`);
                if (!image.startsWith(clipDir + sep)) return send(res, 403, 'Forbidden');
                return send(res, 200, await readFile(image), TYPES[extname(image).toLowerCase()]);
            }
            if (pathname === '/__events' && reload) {
                res.writeHead(200, { 'Content-Type': 'text/event-stream', ...SECURITY_HEADERS });
                clients.add(res);
                req.on('close', () => clients.delete(res));
                return undefined;
            }
            return send(res, 404, 'Not found');
        } catch (error) {
            return send(res, error.code === 'ENOENT' ? 404 : 500, `Could not read file: ${error.code ?? error.message}`);
        }
    });

    const actual = await listen(server, port);
    // watch the folder, not the file: editors that save by replacing the file keep working
    const watcher = reload
        ? watch(dirname(clipPath), (_event, name) => {
            if (name === basename(clipPath)) clients.forEach(res => res.write('data: changed\n\n'));
        })
        : null;
    return {
        url: `http://127.0.0.1:${actual}`,
        close: closer(server, () => {
            watcher?.close();
            clients.forEach(res => res.end());
        })
    };
}

/**
 * Static server for the bundled examples (used by `cueflick demo`).
 * Only files under the allow-listed folders are served; ".." escapes are rejected.
 */
export async function startStaticServer(root, { port = 4321, allow = ['examples', 'dist'] } = {}) {
    const base = resolve(root);
    const allowed = allow.map(folder => resolve(base, folder));
    const server = createServer(async (req, res) => {
        if (!isLocalHost(req)) return send(res, 403, 'Forbidden');
        if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
        let pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch {
            return send(res, 400, 'Bad request');
        }
        const target = resolve(base, `.${normalize(pathname)}`);
        if (!allowed.some(folder => target === folder || target.startsWith(folder + sep))) return send(res, 404, 'Not found');
        try {
            const info = await stat(target);
            const file = info.isDirectory() ? join(target, 'index.html') : target;
            return send(res, 200, await readFile(file), TYPES[extname(file)] ?? 'application/octet-stream');
        } catch {
            return send(res, 404, 'Not found');
        }
    });
    const actual = await listen(server, port);
    return { url: `http://127.0.0.1:${actual}`, close: closer(server) };
}

export { PACKAGE_ROOT };
