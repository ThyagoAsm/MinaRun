// ============================================================
// Tipos compartilhados entre jogo, estado e interface
// ============================================================

export type ScreenId =
  | 'loading'
  | 'menu'
  | 'run'
  | 'pause'
  | 'gameover'
  | 'missions'
  | 'character'
  | 'store'
  | 'maps'
  | 'ranking'
  | 'settings'
  | 'howto';

export type QualityId = 'auto' | 'low' | 'medium' | 'high';
export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';

export type SkinId =
  | 'operador'
  | 'tecnica'
  | 'brigadista'
  | 'mecanico'
  | 'geologa'
  | 'fiscal'
  | 'supervisor'
  | 'ambiental';

export type MapId = 'patio' | 'correia' | 'oficina' | 'acesso' | 'tunel' | 'ambiental';

export type PowerUpId =
  | 'escudo'
  | 'radio'
  | 'botas'
  | 'mascara'
  | 'inspecao'
  | 'caminho'
  | 'dds'
  | 'drone';

export type EpiId =
  | 'capacete'
  | 'oculos'
  | 'luvas'
  | 'botas'
  | 'auricular'
  | 'mascara'
  | 'colete'
  | 'radio';

export type TrailId = 'nenhuma' | 'faiscas' | 'ouro' | 'eco' | 'folhas';

export type CrashCause =
  | 'cone'
  | 'cavalete'
  | 'tambor'
  | 'caixa'
  | 'palete'
  | 'bloco'
  | 'bobina'
  | 'isolamento'
  | 'tubulacao'
  | 'portao'
  | 'caminhao'
  | 'vagao'
  | 'braco'
  | 'rocha'
  | 'placa'
  | 'generico';

export interface Settings {
  master: number; // 0..1
  music: number;
  sfx: number;
  vibration: boolean;
  swipeSensitivity: number; // 0.5 (curto) .. 1.5 (longo)
  quality: QualityId;
  eduMessages: boolean;
  colorblind: boolean;
  reducedFx: boolean;
  cameraShake: boolean;
  language: 'pt-BR';
}

export interface RecordSet {
  distance: number;
  score: number;
  safety: number;
  coins: number;
  cleanStreak: number;
}

export interface RankEntry {
  date: string; // ISO
  map: MapId;
  distance: number;
  score: number;
  coins: number;
  safety: number;
}

export interface ActiveMission {
  id: string; // id do template
  tier: number; // escala alvo/recompensa
  progress: number; // progresso persistente (missões perRun reiniciam a cada corrida)
}

export interface LifetimeStats {
  runs: number;
  totalDistance: number;
  epis: number;
  cards: number;
  dodges: number;
  risksAvoided: number;
  isolationsRespected: number;
  quizRight: number;
  safePathUses: number;
  powerupsUsed: number;
}

/** analytics local simples (GDD): últimos game overs para balanceamento */
export interface RunLog {
  map: MapId;
  distance: number;
  cause: CrashCause;
  date: string;
}

export interface SaveData {
  version: number;
  analytics: RunLog[];
  coins: number;
  totalCoins: number;
  xp: number;
  level: number;
  ownedSkins: SkinId[];
  skin: SkinId;
  unlockedMaps: MapId[];
  map: MapId;
  puLevels: Partial<Record<PowerUpId, number>>;
  puCharges: Partial<Record<PowerUpId, number>>;
  equippedPu: PowerUpId | null;
  ownedTrails: TrailId[];
  trail: TrailId;
  records: RecordSet;
  ranking: RankEntry[];
  missions: { active: ActiveMission[]; completedCount: number };
  achievements: string[];
  stats: LifetimeStats;
  settings: Settings;
  seenHowTo: boolean;
  lastDaily: string; // YYYY-MM-DD
  dailyStreak: number;
  gameOversSinceQuiz: number;
}

/** Resultado consolidado de uma corrida (tela de game over) */
export interface RunResult {
  map: MapId;
  distance: number;
  score: number;
  coins: number;
  safety: number;
  cleanStreak: number;
  epiSet: boolean;
  episCollected: number;
  dodges: number;
  cause: CrashCause;
  missionsCompleted: string[]; // textos das missões concluídas
  achievementsUnlocked: string[]; // nomes
  xpGained: number;
  levelUps: number;
  newRecords: string[]; // rótulos dos recordes batidos
  doubled: boolean;
}

/** Estado de HUD atualizado pelo engine em alta frequência */
export interface HudState {
  phase: 'idle' | 'countdown' | 'live' | 'crash';
  countdown: number;
  score: number;
  distance: number;
  coins: number;
  safety: number;
  pu: { id: PowerUpId; t: number; dur: number } | null;
  charges: number;
  equippedPu: PowerUpId | null;
  mission: { text: string; cur: number; target: number } | null;
  banner: { id: number; text: string; kind: BannerKind } | null;
  pulse: number; // incrementa a cada coleta (anima o contador)
}

export type BannerKind = 'info' | 'danger' | 'success' | 'edu' | 'event' | 'record';
