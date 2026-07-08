import type { Rarity, SkinId } from '../state/types';

export interface SkinDef {
  id: SkinId;
  name: string;
  desc: string;
  rarity: Rarity;
  price: number; // 0 = inicial
  bonus: string; // descrição curta exibida na loja/tela de personagem
  colors: {
    helmet: string;
    suit: string;
    vest: string;
    skin: string;
    accent: string;
    pants: string;
  };
  /** acessório extra desenhado no modelo */
  accessory: 'nenhum' | 'prancheta' | 'extintor' | 'chave' | 'bolsa' | 'bandeira' | 'faixa' | 'cantil';
}

export const SKINS: SkinDef[] = [
  {
    id: 'operador',
    name: 'Operador de Mina',
    desc: 'O clássico da operação. Sempre pronto para o turno.',
    rarity: 'comum',
    price: 0,
    bonus: 'Sem bônus — raiz da operação',
    colors: { helmet: '#f2b705', suit: '#2e5d8f', vest: '#ff8c1a', skin: '#c98d5e', accent: '#e8e8e8', pants: '#31445c' },
    accessory: 'nenhum',
  },
  {
    id: 'tecnica',
    name: 'Técnica de Segurança',
    desc: 'Enxerga o risco antes de todo mundo.',
    rarity: 'comum',
    price: 800,
    bonus: '+10% de ganho no Índice de Segurança',
    colors: { helmet: '#f5f5f5', suit: '#1f8a7d', vest: '#ffd23f', skin: '#8a5a3b', accent: '#ffffff', pants: '#20343f' },
    accessory: 'prancheta',
  },
  {
    id: 'brigadista',
    name: 'Brigadista',
    desc: 'Primeiro a chegar quando o alarme toca.',
    rarity: 'raro',
    price: 1600,
    bonus: '-50% de perda de Índice ao colidir',
    colors: { helmet: '#d63a2f', suit: '#3a3f47', vest: '#ff5a3c', skin: '#e0ac7e', accent: '#f2d16b', pants: '#2b2f36' },
    accessory: 'extintor',
  },
  {
    id: 'mecanico',
    name: 'Mecânico Industrial',
    desc: 'Se range, ele conserta. Se trava, ele destrava.',
    rarity: 'raro',
    price: 1600,
    bonus: '+15% de duração de power-ups',
    colors: { helmet: '#5b6570', suit: '#7a4a21', vest: '#ff8c1a', skin: '#a06b42', accent: '#c9c9c9', pants: '#4a3b2a' },
    accessory: 'chave',
  },
  {
    id: 'geologa',
    name: 'Geóloga',
    desc: 'Lê a rocha como quem lê manchete de jornal.',
    rarity: 'epico',
    price: 3200,
    bonus: '+10% de Minérios de Ouro coletados',
    colors: { helmet: '#ff8c1a', suit: '#b0895a', vest: '#ffd23f', skin: '#6d4530', accent: '#eadbc3', pants: '#5c4a33' },
    accessory: 'bolsa',
  },
  {
    id: 'fiscal',
    name: 'Fiscal de Campo',
    desc: 'Nada passa despercebido no checklist dele.',
    rarity: 'epico',
    price: 3200,
    bonus: 'Cartas educativas valem 2x moedas',
    colors: { helmet: '#f5f5f5', suit: '#25354d', vest: '#b7f34d', skin: '#d9a878', accent: '#9fb2c8', pants: '#1d2a3d' },
    accessory: 'bandeira',
  },
  {
    id: 'supervisor',
    name: 'Supervisor de Operação',
    desc: 'A mina inteira no rádio, o turno inteiro na cabeça.',
    rarity: 'lendario',
    price: 6400,
    bonus: '+10% de XP por corrida',
    colors: { helmet: '#f8f8f8', suit: '#3d4a5c', vest: '#ffd23f', skin: '#b57a4a', accent: '#e3b341', pants: '#33404f' },
    accessory: 'faixa',
  },
  {
    id: 'ambiental',
    name: 'Agente Ambiental',
    desc: 'Protege a operação e tudo o que vive ao redor dela.',
    rarity: 'lendario',
    price: 6400,
    bonus: 'Começa a corrida com +10 de Índice',
    colors: { helmet: '#2f9e44', suit: '#2b6a4d', vest: '#b7f34d', skin: '#8d5f3f', accent: '#d9f2c5', pants: '#24523e' },
    accessory: 'cantil',
  },
];

export const skinById = (id: SkinId): SkinDef => SKINS.find((s) => s.id === id) ?? SKINS[0];

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: 'Comum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  comum: '#9db2c4',
  raro: '#4dabf7',
  epico: '#b563f2',
  lendario: '#ffb020',
};
