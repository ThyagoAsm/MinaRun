// ============================================================
// Missões de segurança — templates com escala por tier.
// Missões "perRun" reiniciam progresso a cada corrida.
// ============================================================

export type MissionEvent =
  | 'epi_capacete'
  | 'epi_any'
  | 'coin'
  | 'dodge_moving'
  | 'safe_path'
  | 'epi_set'
  | 'risk_avoided'
  | 'card'
  | 'powerup_used'
  | 'detonation_route'
  | 'distance_run'
  | 'clean_run';

export interface MissionTemplate {
  id: string;
  event: MissionEvent;
  perRun: boolean;
  text: (n: number) => string;
  target: (tier: number) => number;
  rewardCoins: (tier: number) => number;
  rewardXp: (tier: number) => number;
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'capacetes',
    event: 'epi_capacete',
    perRun: false,
    text: (n) => `Colete ${n} capacetes`,
    target: (t) => 5 + t * 5,
    rewardCoins: (t) => 120 + t * 60,
    rewardXp: (t) => 60 + t * 30,
  },
  {
    id: 'epis',
    event: 'epi_any',
    perRun: false,
    text: (n) => `Colete ${n} itens de EPI`,
    target: (t) => 12 + t * 10,
    rewardCoins: (t) => 150 + t * 70,
    rewardXp: (t) => 80 + t * 35,
  },
  {
    id: 'minerios',
    event: 'coin',
    perRun: false,
    text: (n) => `Colete ${n} Minérios de Ouro`,
    target: (t) => 150 + t * 120,
    rewardCoins: (t) => 140 + t * 70,
    rewardXp: (t) => 70 + t * 30,
  },
  {
    id: 'desvios',
    event: 'dodge_moving',
    perRun: false,
    text: (n) => `Desvie de ${n} equipamentos móveis`,
    target: (t) => 3 + t * 3,
    rewardCoins: (t) => 180 + t * 80,
    rewardXp: (t) => 90 + t * 40,
  },
  {
    id: 'caminho_seguro',
    event: 'safe_path',
    perRun: false,
    text: (n) => `Use o Caminho Seguro ${n} vezes`,
    target: (t) => 2 + t,
    rewardCoins: (t) => 160 + t * 70,
    rewardXp: (t) => 80 + t * 35,
  },
  {
    id: 'kit_completo',
    event: 'epi_set',
    perRun: true,
    text: () => 'Colete o conjunto completo de EPIs em uma corrida',
    target: () => 1,
    rewardCoins: (t) => 300 + t * 120,
    rewardXp: (t) => 150 + t * 50,
  },
  {
    id: 'riscos',
    event: 'risk_avoided',
    perRun: false,
    text: (n) => `Respeite ${n} áreas de risco sinalizadas`,
    target: (t) => 4 + t * 4,
    rewardCoins: (t) => 150 + t * 70,
    rewardXp: (t) => 80 + t * 35,
  },
  {
    id: 'cartas',
    event: 'card',
    perRun: false,
    text: (n) => `Colete ${n} cartas de segurança`,
    target: (t) => 3 + t * 3,
    rewardCoins: (t) => 130 + t * 60,
    rewardXp: (t) => 70 + t * 30,
  },
  {
    id: 'powerups',
    event: 'powerup_used',
    perRun: false,
    text: (n) => `Use ${n} power-ups`,
    target: (t) => 4 + t * 3,
    rewardCoins: (t) => 140 + t * 60,
    rewardXp: (t) => 70 + t * 30,
  },
  {
    id: 'detonacao',
    event: 'detonation_route',
    perRun: false,
    text: (n) => (n === 1 ? 'Complete 1 rota segura de detonação' : `Complete ${n} rotas seguras de detonação`),
    target: (t) => Math.max(1, Math.ceil(t / 2)),
    rewardCoins: (t) => 250 + t * 100,
    rewardXp: (t) => 120 + t * 50,
  },
  {
    id: 'distancia',
    event: 'distance_run',
    perRun: true,
    text: (n) => `Percorra ${n}m em uma única corrida`,
    target: (t) => 500 + t * 300,
    rewardCoins: (t) => 160 + t * 80,
    rewardXp: (t) => 90 + t * 40,
  },
  {
    id: 'sem_colisao',
    event: 'clean_run',
    perRun: true,
    text: (n) => `Corra ${n}m sem colidir`,
    target: (t) => 400 + t * 250,
    rewardCoins: (t) => 180 + t * 90,
    rewardXp: (t) => 100 + t * 45,
  },
];

export const missionTemplateById = (id: string) => MISSION_TEMPLATES.find((m) => m.id === id);
