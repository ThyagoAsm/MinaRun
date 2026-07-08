import * as THREE from 'three';

// ============================================================
// Texturas procedurais via canvas — nenhum asset externo.
// Todas em cache; tamanhos potência de 2; leves e reutilizáveis.
// ============================================================

const cache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finish(key: string, canvas: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = 2;
  cache.set(key, tex);
  return tex;
}

/** ruído quadriculado suave — solo, rocha, concreto */
export function texNoise(base: string, detail: string, cells = 24, size = 128): THREE.CanvasTexture {
  const key = `noise:${base}:${detail}:${cells}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const cell = size / cells;
  ctx.fillStyle = detail;
  for (let i = 0; i < cells * cells * 0.4; i++) {
    const x = Math.floor(Math.random() * cells) * cell;
    const y = Math.floor(Math.random() * cells) * cell;
    ctx.globalAlpha = 0.08 + Math.random() * 0.22;
    ctx.fillRect(x, y, cell * (1 + Math.random()), cell);
  }
  ctx.globalAlpha = 1;
  return finish(key, c);
}

export type TrackStyle = 'dirt' | 'road' | 'metal' | 'concrete' | 'rails' | 'trail';

/** pista de corrida com identidade visual por bioma */
export function texTrack(track: string, line: string, style: TrackStyle = 'dirt'): THREE.CanvasTexture {
  const key = `track:${track}:${line}:${style}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = track;
  ctx.fillRect(0, 0, size, size);
  // desgaste base
  for (let i = 0; i < 110; i++) {
    ctx.globalAlpha = 0.05 + Math.random() * 0.08;
    ctx.fillStyle = Math.random() > 0.5 ? '#000000' : '#ffffff';
    ctx.fillRect(Math.random() * size, Math.random() * size, 4 + Math.random() * 20, 3 + Math.random() * 6);
  }
  ctx.globalAlpha = 1;

  const laneCenters = [size / 6, size / 2, (5 * size) / 6];
  const dash = size / 8;
  const edges = () => {
    ctx.fillStyle = line;
    ctx.fillRect(3, 0, 5, size);
    ctx.fillRect(size - 8, 0, 5, size);
  };
  const dividers = (alpha = 0.65) => {
    ctx.fillStyle = line;
    for (let y = 0; y < size; y += dash * 2) {
      ctx.globalAlpha = alpha;
      ctx.fillRect(size / 3 - 2, y, 4, dash);
      ctx.fillRect((2 * size) / 3 - 2, y, 4, dash);
    }
    ctx.globalAlpha = 1;
  };

  switch (style) {
    case 'dirt': {
      // marcas de pneu nas faixas + pedrinhas
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (const cx of laneCenters) {
        ctx.fillRect(cx - 15, 0, 7, size);
        ctx.fillRect(cx + 8, 0, 7, size);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, 1.5 + Math.random() * 2, 0, 7);
        ctx.fill();
      }
      edges();
      dividers();
      break;
    }
    case 'road': {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (const cx of laneCenters) {
        ctx.fillRect(cx - 18, 0, 9, size);
        ctx.fillRect(cx + 9, 0, 9, size);
      }
      edges();
      ctx.fillStyle = '#f5ecd2';
      for (let y = 0; y < size; y += dash * 2) {
        ctx.fillRect(size / 3 - 3, y, 6, dash);
        ctx.fillRect((2 * size) / 3 - 3, y, 6, dash);
      }
      break;
    }
    case 'metal': {
      // grade metálica com ranhuras
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = 8; y < size; y += 26) {
        for (let x = 10; x < size - 14; x += 30) {
          ctx.fillRect(x, y, 20, 9);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let y = 6; y < size; y += 26) ctx.fillRect(0, y, size, 2);
      edges();
      dividers(0.5);
      break;
    }
    case 'concrete': {
      // juntas de dilatação + faixas amarelas pintadas
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let y = 0; y < size; y += 64) ctx.fillRect(0, y, size, 3);
      ctx.fillStyle = line;
      ctx.fillRect(3, 0, 6, size);
      ctx.fillRect(size - 9, 0, 6, size);
      dividers(0.8);
      // marcas de pintura desgastada
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 14, 4);
      ctx.globalAlpha = 1;
      break;
    }
    case 'rails': {
      // dormentes de madeira + 3 pares de trilhos (um por faixa)
      ctx.fillStyle = '#4a3a24';
      for (let y = 4; y < size; y += 42) {
        ctx.fillRect(4, y, size - 8, 15);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(4, y + 11, size - 8, 4);
        ctx.fillStyle = '#4a3a24';
      }
      for (const cx of laneCenters) {
        for (const off of [-15, 15]) {
          ctx.fillStyle = '#1c1a16';
          ctx.fillRect(cx + off - 4, 0, 8, size);
          ctx.fillStyle = '#b8bcc2';
          ctx.fillRect(cx + off - 2.5, 0, 5, size);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(cx + off - 1, 0, 1.6, size);
        }
      }
      break;
    }
    case 'trail': {
      // trilha de terra com vegetação nas bordas
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(size / 2 - 14, 0, 28, size);
      const greens = ['#3d8a4a', '#5aa855', '#2f7a3d'];
      for (let i = 0; i < 46; i++) {
        const edge = Math.random() > 0.5 ? Math.random() * 22 : size - Math.random() * 22;
        ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)];
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(edge, Math.random() * size, 2 + Math.random() * 3, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      dividers(0.35);
      break;
    }
  }
  return finish(key, c);
}

/** listras diagonais de perigo (amarelo/preto por padrão) */
export function texHazard(a = '#f2b705', b = '#22252b'): THREE.CanvasTexture {
  const key = `hazard:${a}:${b}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = b;
  const w = size / 4;
  for (let i = -size; i < size * 2; i += w * 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + w, 0);
    ctx.lineTo(i + w + size, size);
    ctx.lineTo(i + size, size);
    ctx.closePath();
    ctx.fill();
  }
  return finish(key, c);
}

/** chapa metálica com rebites */
export function texMetal(base = '#7d838c'): THREE.CanvasTexture {
  const key = `metal:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  const positions = [12, size - 12];
  for (const x of positions)
    for (const y of positions) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 30; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 8, 2);
  return finish(key, c);
}

/** correia transportadora: borracha escura com chevrons */
export function texBelt(): THREE.CanvasTexture {
  const key = 'belt';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#3c4249';
  ctx.lineWidth = 8;
  for (let y = 16; y < size + 32; y += 42) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(size / 2, y - 18);
    ctx.lineTo(size - 8, y);
    ctx.stroke();
  }
  return finish(key, c);
}

/** container/galpão com ondulações verticais */
export function texContainer(color: string): THREE.CanvasTexture {
  const key = `container:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, 0, 4, size);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 4, 0, 3, size);
  }
  return finish(key, c);
}

/** placa com texto (sinalização) */
export function texSign(text: string, bg: string, fg: string, border = '#ffffff'): THREE.CanvasTexture {
  const key = `sign:${text}:${bg}:${fg}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = border;
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, size - 20, size - 20);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  const fs = lines.length > 1 ? 64 : text.length > 5 ? 56 : 96;
  ctx.font = `bold ${fs}px Arial, sans-serif`;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, size / 2, size / 2 + (i - (lines.length - 1) / 2) * (fs + 8));
  });
  return finish(key, c, false);
}

/** carta educativa (cartão com faixa e exclamação) */
export function texCard(): THREE.CanvasTexture {
  const key = 'card';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#f7f9fc';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#2e8b57';
  ctx.fillRect(0, 0, size, 34);
  ctx.fillStyle = '#20242b';
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', size / 2, size / 2 + 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('DDS', size / 2, 18);
  return finish(key, c, false);
}

/** seta/chevron usada no caminho seguro e rota de detonação */
export function texArrow(color = '#3ddc84'): THREE.CanvasTexture {
  const key = `arrow:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const [c, ctx] = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(8, 44);
  ctx.lineTo(size / 2, 16);
  ctx.lineTo(size - 8, 44);
  ctx.lineTo(size - 8, 58);
  ctx.lineTo(size / 2, 32);
  ctx.lineTo(8, 58);
  ctx.closePath();
  ctx.fill();
  return finish(key, c, false);
}

/** água com reflexos suaves */
export function texWater(): THREE.CanvasTexture {
  const key = 'water';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#3d84c8';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, y);
    ctx.lineTo(Math.random() * size, y);
    ctx.stroke();
  }
  return finish(key, c);
}

export function disposeAllTextures() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}

// ============================================================
// Paleta funcional (com variante para daltonismo)
// Cores de PERIGO/AVISO/SEGURO usadas em materiais registrados.
// ============================================================

export interface Palette {
  danger: string;
  warn: string;
  safe: string;
  coin: string;
  water: string;
}

export const PALETTE_NORMAL: Palette = {
  danger: '#e5484d',
  warn: '#f2b705',
  safe: '#3ddc84',
  coin: '#ffce3a',
  water: '#4d9fe8',
};

/** paleta amigável para daltonismo (azul/laranja de alto contraste) */
export const PALETTE_CB: Palette = {
  danger: '#e69f00',
  warn: '#f0e442',
  safe: '#56b4e9',
  coin: '#fff0a8',
  water: '#0072b2',
};

type PaletteRole = keyof Palette;
const paletteRegistry: { mat: THREE.Material & { color?: THREE.Color; emissive?: THREE.Color }; role: PaletteRole; emissive: boolean }[] = [];

let currentPalette: Palette = PALETTE_NORMAL;

export function getPalette(): Palette {
  return currentPalette;
}

/** registra um material para trocar de cor quando o modo daltônico mudar */
export function registerPaletteMaterial(
  mat: THREE.Material & { color?: THREE.Color; emissive?: THREE.Color },
  role: PaletteRole,
  emissive = false,
) {
  paletteRegistry.push({ mat, role, emissive });
  const c = new THREE.Color(currentPalette[role]);
  if (emissive && mat.emissive) mat.emissive.copy(c);
  else if (mat.color) mat.color.copy(c);
}

export function applyPalette(colorblind: boolean) {
  currentPalette = colorblind ? PALETTE_CB : PALETTE_NORMAL;
  for (const { mat, role, emissive } of paletteRegistry) {
    const c = new THREE.Color(currentPalette[role]);
    if (emissive && mat.emissive) mat.emissive.copy(c);
    else if (mat.color) mat.color.copy(c);
  }
}
