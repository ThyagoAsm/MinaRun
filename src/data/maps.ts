import type { MapId } from '../state/types';

export interface MapTheme {
  /** cor do céu (topo/horizonte), névoa e luzes */
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogFar: number; // distância da névoa em qualidade alta (escala com qualidade)
  sun: string;
  sunIntensity: number;
  hemi: string;
  hemiGround: string;
  hemiIntensity: number;
  ground: string; // tinta base do solo
  groundDetail: string; // tinta do ruído
  track: string; // faixa de corrida
  trackLine: string;
  /** estilo visual do piso da pista (diferencial de cada bioma) */
  trackStyle: 'dirt' | 'road' | 'metal' | 'concrete' | 'rails' | 'trail';
  /** true = ambiente fechado (túnel) com lanterna no jogador */
  dark?: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  desc: string;
  /** requisito de desbloqueio: nível OU compra com moedas */
  unlockLevel: number;
  unlockCoins: number;
  bonusTag?: string;
  theme: MapTheme;
  /** multiplicadores de spawn por categoria de risco */
  hazardBias: { wet: number; dust: number; spill: number; moving: number; conveyor: number; rocks: number };
  speedCap: number;
}

export const MAPS: MapDef[] = [
  {
    id: 'patio',
    name: 'Pátio de Minério',
    desc: 'Solo avermelhado, pilhas de minério e caminhões ao fundo. O coração da operação.',
    unlockLevel: 1,
    unlockCoins: 0,
    theme: {
      skyTop: '#3f7fd4',
      skyBottom: '#f5c98a',
      fog: '#d9b184',
      fogFar: 150,
      sun: '#fff2d8',
      sunIntensity: 2.6,
      hemi: '#cfe4ff',
      hemiGround: '#8a5a3a',
      hemiIntensity: 1.3,
      ground: '#b5582b',
      groundDetail: '#8a3a14',
      track: '#a04c22',
      trackLine: '#e8d9b0',
      trackStyle: 'dirt',
    },
    hazardBias: { wet: 0.6, dust: 1.4, spill: 1, moving: 1, conveyor: 0, rocks: 0.6 },
    speedCap: 26,
  },
  {
    id: 'correia',
    name: 'Correia Transportadora',
    desc: 'Passarelas metálicas, roletes e galerias. Cuidado com o que se move sozinho.',
    unlockLevel: 3,
    unlockCoins: 1500,
    theme: {
      skyTop: '#31537a',
      skyBottom: '#c8935c',
      fog: '#a88a68',
      fogFar: 130,
      sun: '#ffe9c4',
      sunIntensity: 2.2,
      hemi: '#bcd4ea',
      hemiGround: '#5c5148',
      hemiIntensity: 1.05,
      ground: '#5f6670',
      groundDetail: '#464c55',
      track: '#4c545e',
      trackLine: '#f2b705',
      trackStyle: 'metal',
    },
    hazardBias: { wet: 0.8, dust: 0.7, spill: 1.2, moving: 0.8, conveyor: 1.6, rocks: 0.4 },
    speedCap: 25,
  },
  {
    id: 'oficina',
    name: 'Oficina de Manutenção',
    desc: 'Piso de concreto, pontes rolantes e bancadas. Bloqueio e etiquetagem em todo lugar.',
    unlockLevel: 5,
    unlockCoins: 2800,
    theme: {
      skyTop: '#2c3a4d',
      skyBottom: '#9fb2c8',
      fog: '#8f9aa8',
      fogFar: 120,
      sun: '#eef4ff',
      sunIntensity: 2.0,
      hemi: '#dce8f5',
      hemiGround: '#5f6670',
      hemiIntensity: 1.2,
      ground: '#7d838c',
      groundDetail: '#63696f',
      track: '#6f757e',
      trackLine: '#ffd23f',
      trackStyle: 'concrete',
    },
    hazardBias: { wet: 1.6, dust: 0.3, spill: 1.4, moving: 1.1, conveyor: 0.4, rocks: 0 },
    speedCap: 24,
  },
  {
    id: 'acesso',
    name: 'Acesso de Mina',
    desc: 'Estrada larga, taludes e caminhões gigantes. Todo equipamento tem ponto cego.',
    unlockLevel: 8,
    unlockCoins: 4500,
    theme: {
      skyTop: '#4d94e8',
      skyBottom: '#ffe3ad',
      fog: '#e8c896',
      fogFar: 165,
      sun: '#fff6dd',
      sunIntensity: 3.0,
      hemi: '#d8ecff',
      hemiGround: '#96683c',
      hemiIntensity: 1.25,
      ground: '#b0793f',
      groundDetail: '#8f5d2b',
      track: '#9c6a34',
      trackLine: '#f5ecd2',
      trackStyle: 'road',
    },
    hazardBias: { wet: 0.5, dust: 1.8, spill: 0.7, moving: 1.7, conveyor: 0, rocks: 1.2 },
    speedCap: 27,
  },
  {
    id: 'tunel',
    name: 'Túnel Industrial',
    desc: 'Trilhos, ventiladores e luzes amarelas. Enxergue o risco antes que ele te enxergue.',
    unlockLevel: 11,
    unlockCoins: 6500,
    theme: {
      skyTop: '#101318',
      skyBottom: '#26221c',
      fog: '#191712',
      fogFar: 95,
      sun: '#ffd9a0',
      sunIntensity: 0.9,
      hemi: '#6b6152',
      hemiGround: '#241f18',
      hemiIntensity: 0.8,
      ground: '#4a453c',
      groundDetail: '#332f28',
      track: '#3a352c',
      trackLine: '#f2b705',
      trackStyle: 'rails',
      dark: true,
    },
    hazardBias: { wet: 1.0, dust: 0.8, spill: 0.9, moving: 1.4, conveyor: 0.3, rocks: 1.4 },
    speedCap: 24,
  },
  {
    id: 'ambiental',
    name: 'Área Ambiental',
    desc: 'Mapa bônus: vegetação, bacias de contenção e vida ao redor. Colete verde, ganhe verde.',
    unlockLevel: 14,
    unlockCoins: 9000,
    bonusTag: 'BÔNUS: +25% moedas e +Índice',
    theme: {
      skyTop: '#57a8e8',
      skyBottom: '#cdeaa8',
      fog: '#b8d9a0',
      fogFar: 155,
      sun: '#fffbe8',
      sunIntensity: 2.7,
      hemi: '#e2f4ff',
      hemiGround: '#4d7a3d',
      hemiIntensity: 1.3,
      ground: '#6d9a4b',
      groundDetail: '#537c38',
      track: '#8f7a4d',
      trackLine: '#f5ecd2',
      trackStyle: 'trail',
    },
    hazardBias: { wet: 1.3, dust: 0.2, spill: 1.5, moving: 0.6, conveyor: 0, rocks: 0.3 },
    speedCap: 25,
  },
];

export const mapById = (id: MapId): MapDef => MAPS.find((m) => m.id === id) ?? MAPS[0];
