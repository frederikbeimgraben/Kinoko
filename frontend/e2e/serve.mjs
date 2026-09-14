#!/usr/bin/env node
/** Gibt den Angular-Build statisch aus. Unbekannte Wege fallen auf `index.html`. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../dist/pilzkarte/browser');
const PORT = Number(process.argv[2] ?? 4400);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.pmtiles': 'application/octet-stream',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`kein Build in ${ROOT}, erst: npm run build`);
  process.exit(1);
}

/** Löst einen Weg auf eine Datei im Build auf. */
function file(path) {
  const safe = normalize(decodeURIComponent(path.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const target = join(ROOT, safe);
  if (!target.startsWith(ROOT)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  return null;
}

createServer((request, reply) => {
  const path = request.url ?? '/';
  if (path.startsWith('/api/')) {
    reply.writeHead(503, { 'content-type': 'application/problem+json' });
    reply.end('{"type":"about:blank","title":"kein Backend","status":503,"code":"no_backend"}');
    return;
  }
  const target = file(path) ?? join(ROOT, 'index.html');
  reply.writeHead(200, {
    'content-type': TYPES[extname(target)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(target).pipe(reply);
}).listen(PORT, '127.0.0.1', () => console.log(`Build auf http://127.0.0.1:${PORT}`));
