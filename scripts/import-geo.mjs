// Cuts a small outline for each region out of the Natural Earth line layers, so the horizon
// map can show a coast and a state border without a tile server.
//
//   node scripts/import-geo.mjs
//
// The site has no backend and is meant to work with no signal, so a basemap can only come
// from geometry committed to the repository. A world file is far too big for that, but the
// map for a region never leaves that region: clipped to the ground it can actually draw and
// simplified to the resolution it is drawn at, each region's outline is a few kilobytes.
//
// Sources, both public domain:
//   - Natural Earth 1:10m coastline
//   - Natural Earth 1:10m admin-1 boundary lines (US states, Chinese provinces, and the
//     equivalents in every other country the clip happens to touch)
//
// Nothing here is editorial. Every coordinate comes from Natural Earth; this script only
// selects, clips, thins and rounds.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CACHE = join(ROOT, '.cache');
const OUT = join(ROOT, 'data', 'geo');

const SRC = {
  coast: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson',
  admin: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces_lines.geojson'
};

// How far past the sites the map can reach: a horizon ring is up to about 200 km, you may
// be a region's width from the middle of it, and the drawing widens the short axis to keep
// the scale square. Beyond this the outline simply stops, which the map draws honestly as
// an edge rather than pretending the land ends there.
const PAD_LAT = 2.4;

// Roughly 400 m. The map is at most 920 px wide across several hundred kilometres, so a
// pixel is never finer than about 700 m: anything below that is detail nobody can see.
const TOL = 0.005;

async function layer(name) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, name + '.geojson');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  process.stdout.write(`fetching ${name}… `);
  const r = await fetch(SRC[name]);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const text = await r.text();
  writeFileSync(file, text);
  console.log(`${(text.length / 1048576).toFixed(1)} MB`);
  return JSON.parse(text);
}

// Every LineString in the layer, as plain [lon, lat] arrays.
function lines(fc) {
  const out = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') out.push(g.coordinates);
    else if (g.type === 'MultiLineString') out.push(...g.coordinates);
  }
  return out;
}

// Clip a polyline to a box, keeping each run inside as its own piece. Segments that cross
// the edge are cut at it, so a coast does not stop short of the frame or run past it.
function clip(pts, box) {
  const [w, s, e, n] = box;
  const inside = p => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
  // Where the segment a→b crosses the box edge, by the standard parametric clip.
  const cut = (a, b) => {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - w], [dx, e - a[0]], [-dy, a[1] - s], [dy, n - a[1]]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
  };

  const runs = [];
  let run = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = cut(a, b);
    if (!seg) { if (run.length > 1) runs.push(run); run = []; continue; }
    if (!run.length) run.push(seg[0]);
    run.push(seg[1]);
    // Left the box at this segment's end, so the run ends here.
    if (!inside(b)) { if (run.length > 1) runs.push(run); run = []; }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

// Douglas-Peucker. Iterative, because a coastline can be tens of thousands of points and
// the recursive form overflows on the worst of them.
function thin(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi - lo < 2) continue;
    const a = pts[lo], b = pts[hi];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    let far = -1, at = lo;
    for (let i = lo + 1; i < hi; i++) {
      const p = pts[i];
      const d = len === 0
        ? Math.hypot(p[0] - a[0], p[1] - a[1])
        : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
      if (d > far) { far = d; at = i; }
    }
    if (far > tol) { keep[at] = 1; stack.push([lo, at], [at, hi]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const r3 = n => Math.round(n * 1000) / 1000;

function main(coastFc, adminFc) {
  const meta = JSON.parse(readFileSync(join(ROOT, 'data', 'regions.json'), 'utf8'));
  const air = JSON.parse(readFileSync(join(ROOT, 'data', 'places.json'), 'utf8')).air;
  const coast = lines(coastFc), admin = lines(adminFc);
  console.log(`${coast.length} coast lines, ${admin.length} admin lines`);
  mkdirSync(OUT, { recursive: true });

  let total = 0, wrote = 0, skipped = [];
  for (const r of meta.regions) {
    if (r.lat == null || r.lon == null) continue;

    // The frame the map can actually draw: every site it plots, or the region centre when
    // it plots none, padded by everything the drawing can add.
    const stations = JSON.parse(readFileSync(join(ROOT, 'data', 'r', r.id + '.json'), 'utf8')).stations;
    const pts = [[r.lon, r.lat]];
    for (const s of stations) { const p = s.ref && air[s.ref]; if (p) pts.push([p[1], p[0]]); }
    const lat = pts.map(p => p[1]), lon = pts.map(p => p[0]);
    const padLon = PAD_LAT / Math.max(0.25, Math.cos(r.lat * Math.PI / 180));
    const box = [
      Math.min(...lon) - padLon, Math.min(...lat) - PAD_LAT,
      Math.max(...lon) + padLon, Math.max(...lat) + PAD_LAT
    ];

    const take = src => {
      const out = [];
      for (const l of src) {
        for (const run of clip(l, box)) {
          const t = thin(run, TOL);
          if (t.length > 1) out.push(t.map(p => [r3(p[0]), r3(p[1])]));
        }
      }
      return out;
    };
    const geo = { box: box.map(r3), coast: take(coast), admin: take(admin) };
    const n = geo.coast.length + geo.admin.length;
    if (!n) { skipped.push(r.id); continue; }

    const text = JSON.stringify(geo);
    writeFileSync(join(OUT, r.id + '.json'), text + '\n');
    total += text.length; wrote++;
    const verts = [...geo.coast, ...geo.admin].reduce((a, l) => a + l.length, 0);
    console.log(`  ${r.id.padEnd(18)} ${String(geo.coast.length).padStart(3)} coast, ${String(geo.admin.length).padStart(3)} admin, ${String(verts).padStart(5)} points, ${(text.length / 1024).toFixed(1)} kB`);
  }
  console.log(`\n${wrote} files, ${(total / 1024).toFixed(0)} kB total`);
  if (skipped.length) console.log(`nothing in frame: ${skipped.join(', ')}`);
}

main(await layer('coast'), await layer('admin'));
