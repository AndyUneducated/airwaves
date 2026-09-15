// Shared plumbing for the probe scripts: a browser and a server to point it at.
//
// Both used to be assumed rather than arranged - every script resolved Playwright through
// one developer's temp directory and expected a static server to already be listening on a
// fixed port. That works until someone else clones the repo.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Respect PLAYWRIGHT_BROWSERS_PATH only if a browser is actually there. Some sandboxes
// export it pointing at a per-session cache that holds no build, and Playwright then fails
// with "run npx playwright install" even though the browsers are sitting in its own default
// location. Dropping the variable in that case falls back to the default.
{
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const stocked = d => {
    try { return readdirSync(d).some(e => /^(chromium|firefox|webkit)/.test(e)); }
    catch { return false; }
  };
  if (dir && (!existsSync(dir) || !stocked(dir))) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
}

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); } catch { /* try the next one */ }
  }
  throw new Error(
    'Playwright is missing. Run:\n  npm install\n  npx playwright install chromium'
  );
}

export const { chromium } = loadPlaywright();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.csv': 'text/csv; charset=utf-8'
};

// A static server on a port the OS picks, so two runs cannot collide and nothing has to be
// started by hand. Returns the base URL and stays alive until the process exits.
export async function serve(root = ROOT) {
  const server = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      // Keep the server inside the project even if a test asks for something silly.
      const path = join(root, normalize(rel).replace(/^([/\\]|\.\.)+/, ''));
      const body = await readFile(path);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
        // The service worker is cache-first, and a stale copy between groups would make
        // failures impossible to read.
        'Cache-Control': 'no-store'
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });

  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  server.unref();
  return `http://localhost:${port}/`;
}
