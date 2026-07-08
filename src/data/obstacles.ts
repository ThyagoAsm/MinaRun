import type { CrashCause, MapId } from '../state/types';

// ============================================================
// Definições de obstáculos e padrões (grades) da geração procedural.
//
// Cada padrão é uma grade de linhas com 3 colunas (faixas L, C, R).
// A linha de índice 0 é a PRIMEIRA que o jogador encontra.
// Linhas ficam espaçadas ROW_GAP metros entre si.
//
// Caracteres:
//   .  vazio                    m  minério (moeda)
//   c  cone (pular)             e  EPI aleatório
//   v  cavalete (pular)         E  carta educativa
//   d  tambor (pular)           P  power-up
//   t  caixa de ferramentas     w  poça / área molhada (zona)
//   l  palete (pular)           i  vazamento sinalizado (zona, perde Índice)
//   g  placa caída (pular)
//   h  dormente (pular)
//   k  bloco de concreto (bloqueio total)
//   s  bobina de cabo (bloqueio total)
//   x  barreira de isolamento (bloqueio total)
//   o  tubulação baixa (rolar)
// ============================================================

export type ObstacleTypeId =
  | 'cone'
  | 'cavalete'
  | 'tambor'
  | 'caixa'
  | 'palete'
  | 'bloco'
  | 'bobina'
  | 'isolamento'
  | 'tubulacao'
  | 'placa'
  | 'dormente';

export type ObstacleKind = 'low' | 'over' | 'full';

export interface ObstacleDef {
  id: ObstacleTypeId;
  kind: ObstacleKind;
  /** meia-extensão do colisor (já com folga "justa" embutida) */
  half: { x: number; y: number; z: number };
  /** altura do vão para obstáculos "over" (base do colisor) */
  overGap?: number;
  cause: CrashCause;
}

export const OBSTACLE_DEFS: Record<ObstacleTypeId, ObstacleDef> = {
  cone: { id: 'cone', kind: 'low', half: { x: 0.3, y: 0.42, z: 0.3 }, cause: 'cone' },
  cavalete: { id: 'cavalete', kind: 'low', half: { x: 0.78, y: 0.5, z: 0.22 }, cause: 'cavalete' },
  tambor: { id: 'tambor', kind: 'low', half: { x: 0.36, y: 0.5, z: 0.36 }, cause: 'tambor' },
  caixa: { id: 'caixa', kind: 'low', half: { x: 0.5, y: 0.38, z: 0.36 }, cause: 'caixa' },
  palete: { id: 'palete', kind: 'low', half: { x: 0.6, y: 0.55, z: 0.5 }, cause: 'palete' },
  bloco: { id: 'bloco', kind: 'full', half: { x: 0.8, y: 1.3, z: 0.5 }, cause: 'bloco' },
  bobina: { id: 'bobina', kind: 'full', half: { x: 0.75, y: 0.95, z: 0.55 }, cause: 'bobina' },
  isolamento: { id: 'isolamento', kind: 'full', half: { x: 0.9, y: 1.1, z: 0.2 }, cause: 'isolamento' },
  tubulacao: { id: 'tubulacao', kind: 'over', half: { x: 0.95, y: 0.55, z: 0.28 }, overGap: 1.15, cause: 'tubulacao' },
  placa: { id: 'placa', kind: 'low', half: { x: 0.55, y: 0.3, z: 0.25 }, cause: 'placa' },
  dormente: { id: 'dormente', kind: 'low', half: { x: 0.8, y: 0.26, z: 0.26 }, cause: 'caixa' },
};

export const CHAR_OBSTACLE: Record<string, ObstacleTypeId> = {
  c: 'cone',
  v: 'cavalete',
  d: 'tambor',
  t: 'caixa',
  l: 'palete',
  g: 'placa',
  h: 'dormente',
  k: 'bloco',
  s: 'bobina',
  x: 'isolamento',
  o: 'tubulacao',
};

export interface PatternDef {
  id: string;
  minTier: number;
  maxTier: number;
  weight: number;
  themes?: MapId[];
  rows: string[];
}

export const PATTERNS: PatternDef[] = [
  // ---------- Tier 0: suave ----------
  { id: 'cone_solo', minTier: 0, maxTier: 2, weight: 3, rows: ['m.m', '.c.', 'm.m'] },
  { id: 'cones_zig', minTier: 0, maxTier: 3, weight: 3, rows: ['c..', '.m.', '..c'] },
  { id: 'linha_moedas', minTier: 0, maxTier: 8, weight: 2, rows: ['.m.', '.m.', '.m.', 'm.m'] },
  { id: 'tambores', minTier: 0, maxTier: 3, weight: 2, rows: ['d..', '...', '..d'] },
  { id: 'presente_epi', minTier: 0, maxTier: 8, weight: 2, rows: ['.e.', 'm.m'] },
  { id: 'cavalete_pulo', minTier: 0, maxTier: 4, weight: 2, rows: ['m.m', '.v.', '.m.'] },
  { id: 'arco_sobre_cone', minTier: 0, maxTier: 5, weight: 2, rows: ['.c.', '.m.', '.m.'] },

  // ---------- Tier 1: moderado ----------
  { id: 'dupla_baixa', minTier: 1, maxTier: 4, weight: 3, rows: ['c.c', 'm.m', '.d.'] },
  { id: 'bloco_central', minTier: 1, maxTier: 6, weight: 3, rows: ['.k.', 'm.m'] },
  { id: 'rolagem_dupla', minTier: 1, maxTier: 5, weight: 2, rows: ['.o.', '.m.', 'o..'] },
  { id: 'isolamento_lados', minTier: 1, maxTier: 6, weight: 2, rows: ['x..', '.m.', '..x'] },
  { id: 'oficina_bagunca', minTier: 1, maxTier: 5, weight: 2, themes: ['oficina', 'correia'], rows: ['l.t', '...', '.c.'] },
  { id: 'placas_dormentes', minTier: 1, maxTier: 4, weight: 2, rows: ['g.h', 'm.m', 'h.g'] },
  { id: 'poca_simples', minTier: 1, maxTier: 8, weight: 2, rows: ['w..', '.w.', '..w'] },
  { id: 'carta_row', minTier: 1, maxTier: 8, weight: 1.4, rows: ['.E.', 'm.m'] },

  // ---------- Tier 2: firme ----------
  { id: 'muro_duplo', minTier: 2, maxTier: 7, weight: 3, rows: ['k.k', 'm.m', '.s.'] },
  { id: 'corredor_isolado', minTier: 2, maxTier: 8, weight: 2.5, rows: ['x.x', '.c.', 'x.x'] },
  { id: 'slalom_bobinas', minTier: 2, maxTier: 7, weight: 2.5, themes: ['correia', 'oficina', 'patio'], rows: ['s..', '.m.', '..s', '.m.', 's..'] },
  { id: 'fileira_epi', minTier: 2, maxTier: 8, weight: 1.6, rows: ['e.e', '.P.'] },
  { id: 'rolagem_salto', minTier: 2, maxTier: 8, weight: 2.5, rows: ['.o.', '...', 'c.c'] },
  { id: 'cavaletes_duplos', minTier: 2, maxTier: 7, weight: 2.5, rows: ['vv.', 'm..', '.vv'] },
  { id: 'vazamento_lados', minTier: 2, maxTier: 8, weight: 2, rows: ['ii.', '.m.', '.ii'] },

  // ---------- Tier 3+: pesado ----------
  { id: 'slalom_blocos', minTier: 3, maxTier: 8, weight: 3, rows: ['k..', '..k', '.k.', 'm.m'] },
  { id: 'tunel_rolagens', minTier: 3, maxTier: 8, weight: 2.5, themes: ['tunel', 'correia'], rows: ['o.o', '.o.', 'm.m'] },
  { id: 'isolamento_forte', minTier: 3, maxTier: 8, weight: 2.5, rows: ['xx.', 'm..', '.xx'] },
  { id: 'carga_caida', minTier: 3, maxTier: 8, weight: 2.5, rows: ['t.d', '.k.', 'd.t'] },
  { id: 'corredor_epi', minTier: 3, maxTier: 8, weight: 1.5, rows: ['x.x', '.e.', 'x.x', '.m.'] },
  { id: 'festa_moedas', minTier: 1, maxTier: 8, weight: 1.6, rows: ['mmm', 'm.m', 'mmm', '.m.'] },

  // ---------- Tier 4+: intenso ----------
  { id: 'mix_pesado', minTier: 4, maxTier: 8, weight: 3, rows: ['k.s', 'm..', '.x.', '..m', 's.k'] },
  { id: 'acao_dupla', minTier: 4, maxTier: 8, weight: 2.5, rows: ['.c.', 'm.m', '.o.'] },
  { id: 'zigzag_total', minTier: 4, maxTier: 8, weight: 2.5, rows: ['kk.', '...', '.kk', '...', 'kk.'] },
  { id: 'chicane_molhada', minTier: 4, maxTier: 8, weight: 2, rows: ['w.k', '...', 'k.w', '.m.'] },
];
