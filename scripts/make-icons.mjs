/* Rasterises the Airwaves mark to PNG. Run: node scripts/make-icons.mjs
   Written by hand so the repo has no build dependencies. */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x08, 0x09, 0x0b];
const AC = [0x5e, 0xf2, 0xa8];

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // truecolour + alpha
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 4 + 1);
    raw[o] = 0;
    rgba.copy(raw, o + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* -- geometry, expressed in a 512-unit design space -- */

const S = 512;
const CX = 256, CY = 380;
const DOT = 42;
const RINGS = [138, 220];
const STROKE = 26;
const APERTURE = 46 * Math.PI / 180;   // half-angle of the fan, measured from straight up
const CORNER = 112;

function inRoundRect(x, y) {
  const r = CORNER;
  const dx = Math.min(x, S - x), dy = Math.min(y, S - y);
  if (dx >= r || dy >= r) return dx >= 0 && dy >= 0;
  return (r - dx) ** 2 + (r - dy) ** 2 <= r * r;
}

function inMark(x, y) {
  const dx = x - CX, dy = y - CY;
  const d = Math.hypot(dx, dy);
  if (d <= DOT) return true;
  if (dy >= 0) return false;
  if (Math.atan2(Math.abs(dx), -dy) > APERTURE) return false;
  return RINGS.some(r => Math.abs(d - r) <= STROKE / 2);
}

function render(size) {
  const SS = 3;                        // supersampling factor
  const px = Buffer.alloc(size * size * 4);
  const scale = S / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = 0, mark = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const gx = (x + (sx + 0.5) / SS) * scale;
          const gy = (y + (sy + 0.5) / SS) * scale;
          n++;
          if (inRoundRect(gx, gy)) { inside++; if (inMark(gx, gy)) mark++; }
        }
      }
      const a = inside / n;
      const m = inside ? mark / inside : 0;
      const o = (y * size + x) * 4;
      for (let ch = 0; ch < 3; ch++) px[o + ch] = Math.round(BG[ch] * (1 - m) + AC[ch] * m);
      px[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, size, px);
}

mkdirSync('icons', { recursive: true });
for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  writeFileSync(`icons/${name}`, render(size));
  console.log(`icons/${name}  ${size}x${size}`);
}
