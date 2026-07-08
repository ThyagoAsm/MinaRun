import type { PowerUpId } from '../state/types';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  short: string;
  desc: string;
  icon: string; // identificador para o ícone SVG da UI
  baseDuration: number; // segundos (0 = instantâneo/por carga)
  chargePrice: number; // preço por carga na loja (0 = não vendável, só coletável)
  upgradePriceBase: number; // custo do nível 2 (escala por nível)
  maxLevel: number;
  /** o que cada nível melhora, para exibir na loja */
  upgradeDesc: string;
  color: string;
}

export const POWERUPS: PowerUpDef[] = [
  {
    id: 'escudo',
    name: 'Escudo EPI Completo',
    short: 'Escudo EPI',
    desc: 'Protege contra 1 colisão. Brilho amarelo de proteção total.',
    icon: 'shield',
    baseDuration: 0,
    chargePrice: 220,
    upgradePriceBase: 400,
    maxLevel: 3,
    upgradeDesc: 'Nível 2+: mantém parte do combo ao absorver impacto',
    color: '#ffd23f',
  },
  {
    id: 'radio',
    name: 'Rádio de Alerta',
    short: 'Rádio',
    desc: 'Destaca obstáculos à frente e ilumina a faixa segura por alguns segundos.',
    icon: 'radio',
    baseDuration: 8,
    chargePrice: 150,
    upgradePriceBase: 300,
    maxLevel: 5,
    upgradeDesc: '+1,5s de duração por nível',
    color: '#4dabf7',
  },
  {
    id: 'botas',
    name: 'Botas Antiderrapantes',
    short: 'Botas',
    desc: 'Atravesse áreas molhadas e correias sem perder o controle.',
    icon: 'boots',
    baseDuration: 14,
    chargePrice: 130,
    upgradePriceBase: 260,
    maxLevel: 5,
    upgradeDesc: '+2s de duração por nível',
    color: '#b7f34d',
  },
  {
    id: 'mascara',
    name: 'Máscara contra Poeira',
    short: 'Máscara',
    desc: 'Anula a perda de visibilidade em trechos de poeira intensa.',
    icon: 'mask',
    baseDuration: 14,
    chargePrice: 130,
    upgradePriceBase: 260,
    maxLevel: 5,
    upgradeDesc: '+2s de duração por nível',
    color: '#9fb2c8',
  },
  {
    id: 'inspecao',
    name: 'Modo Inspeção',
    short: 'Inspeção',
    desc: 'Reduz a velocidade do mundo e aumenta a precisão dos movimentos.',
    icon: 'eye',
    baseDuration: 6,
    chargePrice: 180,
    upgradePriceBase: 320,
    maxLevel: 4,
    upgradeDesc: '+1s de duração por nível',
    color: '#b563f2',
  },
  {
    id: 'caminho',
    name: 'Caminho Seguro',
    short: 'Caminho',
    desc: 'Cria uma trilha luminosa indicando a melhor rota. Segui-la aumenta o Índice.',
    icon: 'path',
    baseDuration: 9,
    chargePrice: 160,
    upgradePriceBase: 300,
    maxLevel: 5,
    upgradeDesc: '+1,5s de duração por nível',
    color: '#3ddc84',
  },
  {
    id: 'dds',
    name: 'Treinamento DDS',
    short: 'DDS',
    desc: 'Multiplicador de pontos x2. Ativa sozinho ao coletar 4 EPIs seguidos.',
    icon: 'star',
    baseDuration: 10,
    chargePrice: 0,
    upgradePriceBase: 350,
    maxLevel: 5,
    upgradeDesc: '+2s de duração por nível',
    color: '#ff8c1a',
  },
  {
    id: 'drone',
    name: 'Drone de Inspeção',
    short: 'Drone',
    desc: 'Voa à frente atraindo minérios próximos e sinalizando obstáculos.',
    icon: 'drone',
    baseDuration: 10,
    chargePrice: 200,
    upgradePriceBase: 360,
    maxLevel: 5,
    upgradeDesc: '+2s de duração por nível',
    color: '#4dd7f2',
  },
];

export const puById = (id: PowerUpId): PowerUpDef => POWERUPS.find((p) => p.id === id) ?? POWERUPS[0];

/** duração efetiva considerando nível e bônus de skin (mult) */
export function puDuration(id: PowerUpId, level: number, mult = 1): number {
  const def = puById(id);
  if (def.baseDuration === 0) return 0;
  const perLevel: Record<string, number> = {
    radio: 1.5,
    botas: 2,
    mascara: 2,
    inspecao: 1,
    caminho: 1.5,
    dds: 2,
    drone: 2,
  };
  const extra = (perLevel[id] ?? 1.5) * Math.max(0, level - 1);
  return (def.baseDuration + extra) * mult;
}

export function upgradePrice(id: PowerUpId, currentLevel: number): number {
  const def = puById(id);
  return def.upgradePriceBase * currentLevel;
}
