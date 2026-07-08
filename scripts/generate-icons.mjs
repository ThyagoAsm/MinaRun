// Gera os ícones PNG da PWA sem nenhuma dependência externa:
// rasteriza a arte (capacete de segurança) e codifica PNG na mão
// usando apenas o zlib nativo do Node.
//   node scripts/generate-icons.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---------------- encoder PNG ----------------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // linhas com byte de filtro 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------- rasterização ----------------
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function drawIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const bg = hex('#14171c');
  const bg2 = hex('#20242b');
  const yellow = hex('#f2b705');
  const yellowDark = hex('#c99903');
  const cream = hex('#fff6cc');
  const orange = hex('#ff8c1a');

  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  const s = size;
  const corner = maskable ? 0 : s * 0.2;
  const k = maskable ? 0.74 : 0.92; // escala do conteúdo (zona segura maskable)
  const cx = s / 2;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // fundo com cantos arredondados (transparente fora)
      if (!maskable) {
        const dx = Math.max(corner - x, x - (s - corner), 0);
        const dy = Math.max(corner - y, y - (s - corner), 0);
        if (dx * dx + dy * dy > corner * corner) {
          set(x, y, bg, 0);
          continue;
        }
      }
      // gradiente sutil de fundo
      const t = y / s;
      set(x, y, [bg[0] + (bg2[0] - bg[0]) * t, bg[1] + (bg2[1] - bg[1]) * t, bg[2] + (bg2[2] - bg[2]) * t]);
    }
  }

  const domeCy = s * (0.5 + 0.1 * (1 - k));
  const domeR = s * 0.3 * k;
  const brimY0 = domeCy;
  const brimY1 = domeCy + s * 0.07 * k;
  const brimHalf = s * 0.42 * k;
  const crestHalf = s * 0.055 * k;
  const crestTop = domeCy - domeR - s * 0.02 * k;
  const stripeY0 = s * (0.5 + 0.36 * k * 0.5 + 0.08);
  const lampR = s * 0.05 * k;
  const lampCy = domeCy - s * 0.1 * k;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - cx;
      const dy = y - domeCy;
      // cúpula do capacete (meia esfera)
      if (y <= domeCy && dx * dx + dy * dy <= domeR * domeR) {
        const shade = dx < -domeR * 0.3 ? yellow : dx > domeR * 0.45 ? yellowDark : yellow;
        set(x, y, shade);
      }
      // crista central
      if (Math.abs(dx) <= crestHalf && y >= crestTop && y <= domeCy - domeR * 0.55) set(x, y, yellow);
      // aba
      if (Math.abs(dx) <= brimHalf && y >= brimY0 && y <= brimY1) {
        const edge = brimHalf - Math.abs(dx);
        if (edge > s * 0.012 || y < brimY1 - s * 0.01) set(x, y, y > (brimY0 + brimY1) / 2 ? yellowDark : yellow);
      }
      // lanterna
      const ldx = x - cx;
      const ldy = y - lampCy;
      if (ldx * ldx + ldy * ldy <= lampR * lampR) set(x, y, cream);
      // faixa industrial inferior
      if (y >= stripeY0 && y <= stripeY0 + s * 0.045 && Math.abs(dx) <= s * 0.36 * k) set(x, y, orange);
    }
  }
  return px;
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];

for (const [name, size, maskable] of targets) {
  const png = encodePng(size, drawIcon(size, maskable));
  writeFileSync(join(outDir, name), png);
  console.log(`gerado: public/icons/${name} (${png.length} bytes)`);
}
