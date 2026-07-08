import type { RunResult, SaveData } from '../state/types';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  reward: number; // moedas
  /** avaliada ao fim de cada corrida (ou em mudanças de save) */
  check: (save: SaveData, run: RunResult | null) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'primeira_corrida',
    name: 'Primeira Corrida Segura',
    desc: 'Complete sua primeira corrida.',
    icon: 'flag',
    reward: 100,
    check: (s) => s.stats.runs >= 1,
  },
  {
    id: 'km_seguro',
    name: '1 km Sem Acidente',
    desc: 'Percorra 1.000m sem colidir em uma corrida.',
    icon: 'road',
    reward: 300,
    check: (s) => s.records.cleanStreak >= 1000,
  },
  {
    id: 'mestre_epi',
    name: 'Mestre dos EPIs',
    desc: 'Colete o conjunto completo de EPIs em uma corrida.',
    icon: 'helmet',
    reward: 250,
    check: (_s, r) => !!r?.epiSet,
  },
  {
    id: 'fiscal_risco',
    name: 'Fiscal de Risco',
    desc: 'Respeite 20 áreas de risco sinalizadas.',
    icon: 'warn',
    reward: 250,
    check: (s) => s.stats.risksAvoided >= 20,
  },
  {
    id: 'nota10',
    name: 'Operação Nota 10',
    desc: 'Termine uma corrida com Índice de Segurança 90+.',
    icon: 'star',
    reward: 300,
    check: (_s, r) => (r?.safety ?? 0) >= 90,
  },
  {
    id: 'desvio_perfeito',
    name: 'Desvio Perfeito',
    desc: 'Desvie de 6 equipamentos móveis em uma corrida.',
    icon: 'truck',
    reward: 250,
    check: (_s, r) => (r?.dodges ?? 0) >= 6,
  },
  {
    id: 'brigadista_lendario',
    name: 'Brigadista Lendário',
    desc: 'Possua a skin Brigadista e corra 1.500m em uma corrida.',
    icon: 'fire',
    reward: 400,
    check: (s, r) => s.ownedSkins.includes('brigadista') && (r?.distance ?? 0) >= 1500,
  },
  {
    id: 'respeitou_isolamento',
    name: 'Respeitou o Isolamento',
    desc: 'Respeite 10 áreas isoladas no total.',
    icon: 'barrier',
    reward: 200,
    check: (s) => s.stats.isolationsRespected >= 10,
  },
  {
    id: 'guardiao_ambiental',
    name: 'Guardião Ambiental',
    desc: 'Percorra 800m na Área Ambiental.',
    icon: 'leaf',
    reward: 350,
    check: (_s, r) => r?.map === 'ambiental' && (r?.distance ?? 0) >= 800,
  },
  {
    id: 'colecionador',
    name: 'Guarda-Roupa de Campo',
    desc: 'Possua 4 skins diferentes.',
    icon: 'shirt',
    reward: 300,
    check: (s) => s.ownedSkins.length >= 4,
  },
  {
    id: 'magnata',
    name: 'Magnata do Minério',
    desc: 'Acumule 10.000 Minérios de Ouro no total.',
    icon: 'coin',
    reward: 500,
    check: (s) => s.totalCoins >= 10000,
  },
  {
    id: 'veterano',
    name: 'Veterano da Operação',
    desc: 'Alcance o nível 10.',
    icon: 'medal',
    reward: 500,
    check: (s) => s.level >= 10,
  },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
