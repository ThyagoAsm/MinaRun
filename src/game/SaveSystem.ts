import { createStore } from '../state/store';
import type { MapId, PowerUpId, SaveData, Settings, SkinId, TrailId } from '../state/types';
import { MISSION_TEMPLATES } from '../data/missions';

// ============================================================
// Salvamento local robusto (localStorage) com validação,
// valores padrão e migração simples por versão.
// ============================================================

const KEY = 'mina-segura-run:v1';
const SAVE_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    master: 0.9,
    music: 0.65,
    sfx: 0.9,
    vibration: true,
    swipeSensitivity: 1,
    quality: 'auto',
    eduMessages: true,
    colorblind: false,
    reducedFx: false,
    cameraShake: true,
    language: 'pt-BR',
  };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    analytics: [],
    coins: 0,
    totalCoins: 0,
    xp: 0,
    level: 1,
    ownedSkins: ['operador'],
    skin: 'operador',
    unlockedMaps: ['patio'],
    map: 'patio',
    puLevels: {},
    puCharges: { escudo: 1 }, // 1 carga grátis para ensinar a mecânica
    equippedPu: 'escudo',
    ownedTrails: ['nenhuma'],
    trail: 'nenhuma',
    records: { distance: 0, score: 0, safety: 0, coins: 0, cleanStreak: 0 },
    ranking: [],
    missions: {
      active: MISSION_TEMPLATES.slice(0, 3).map((m) => ({ id: m.id, tier: 1, progress: 0 })),
      completedCount: 0,
    },
    achievements: [],
    stats: {
      runs: 0,
      totalDistance: 0,
      epis: 0,
      cards: 0,
      dodges: 0,
      risksAvoided: 0,
      isolationsRespected: 0,
      quizRight: 0,
      safePathUses: 0,
      powerupsUsed: 0,
    },
    settings: defaultSettings(),
    seenHowTo: false,
    lastDaily: '',
    dailyStreak: 0,
    gameOversSinceQuiz: 0,
  };
}

/** mescla recursiva mantendo apenas valores com o mesmo tipo do padrão */
function sanitize<T>(def: T, loaded: unknown): T {
  if (Array.isArray(def)) {
    return Array.isArray(loaded) ? (loaded as T) : def;
  }
  if (def === null || typeof def !== 'object') {
    return typeof loaded === typeof def && loaded !== null && loaded !== undefined ? (loaded as T) : def;
  }
  const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
  if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
    const src = loaded as Record<string, unknown>;
    for (const k of Object.keys(out)) {
      const d = out[k];
      const l = src[k];
      if (l === undefined) continue;
      if (Array.isArray(d)) {
        out[k] = Array.isArray(l) ? l : d;
      } else if (d !== null && typeof d === 'object') {
        out[k] = sanitize(d, l);
      } else if (typeof l === typeof d) {
        out[k] = l;
      }
    }
  }
  return out as T;
}

function load(): SaveData {
  const def = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    const data = sanitize(def, parsed);
    // dicionários dinâmicos (sanitize só preserva chaves do padrão)
    for (const dictKey of ['puLevels', 'puCharges'] as const) {
      const src = parsed?.[dictKey];
      if (src && typeof src === 'object' && !Array.isArray(src)) {
        const clean: Record<string, number> = {};
        for (const [k, v] of Object.entries(src)) {
          if (typeof v === 'number' && isFinite(v)) clean[k] = Math.max(0, Math.floor(v));
        }
        data[dictKey] = clean;
      }
    }
    // saneamento extra de coleções
    if (!data.ownedSkins.includes('operador')) data.ownedSkins.push('operador');
    if (!data.ownedSkins.includes(data.skin)) data.skin = 'operador';
    if (!data.unlockedMaps.includes('patio')) data.unlockedMaps.push('patio');
    if (!data.unlockedMaps.includes(data.map)) data.map = 'patio';
    if (!Array.isArray(data.missions.active) || data.missions.active.length === 0) {
      data.missions = def.missions;
    }
    data.coins = Math.max(0, Math.floor(data.coins));
    data.level = Math.max(1, Math.floor(data.level));
    return data;
  } catch (e) {
    console.warn('[MinaSegura] Save corrompido, restaurando padrão.', e);
    return def;
  }
}

export const saveStore = createStore<SaveData>(load());

let persistTimer: number | undefined;
export function persistSoon() {
  if (persistTimer !== undefined) clearTimeout(persistTimer);
  persistTimer = window.setTimeout(persistNow, 250);
}

export function persistNow() {
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(saveStore.get()));
  } catch (e) {
    console.warn('[MinaSegura] Não foi possível salvar o progresso.', e);
  }
}

export function mutateSave(patch: Partial<SaveData> | ((s: SaveData) => Partial<SaveData>)) {
  saveStore.set(patch);
  persistSoon();
}

// ------------------------------------------------------------
// Helpers de progresso
// ------------------------------------------------------------

export function addCoins(n: number) {
  if (n === 0) return;
  mutateSave((s) => ({
    coins: Math.max(0, s.coins + Math.round(n)),
    totalCoins: n > 0 ? s.totalCoins + Math.round(n) : s.totalCoins,
  }));
}

export function trySpend(price: number): boolean {
  const s = saveStore.get();
  if (s.coins < price) return false;
  mutateSave({ coins: s.coins - price });
  return true;
}

export function xpForNext(level: number): number {
  return 400 + (level - 1) * 250;
}

/** adiciona XP e retorna quantos níveis subiu */
export function addXp(amount: number): number {
  let ups = 0;
  mutateSave((s) => {
    let xp = s.xp + Math.round(amount);
    let level = s.level;
    while (xp >= xpForNext(level)) {
      xp -= xpForNext(level);
      level++;
      ups++;
    }
    return { xp, level };
  });
  return ups;
}

export function buySkin(id: SkinId, price: number): boolean {
  const s = saveStore.get();
  if (s.ownedSkins.includes(id)) return true;
  if (!trySpend(price)) return false;
  mutateSave((cur) => ({ ownedSkins: [...cur.ownedSkins, id] }));
  return true;
}

export function equipSkin(id: SkinId) {
  const s = saveStore.get();
  if (s.ownedSkins.includes(id)) mutateSave({ skin: id });
}

export function unlockMapByCoins(id: MapId, price: number): boolean {
  const s = saveStore.get();
  if (s.unlockedMaps.includes(id)) return true;
  if (!trySpend(price)) return false;
  mutateSave((cur) => ({ unlockedMaps: [...cur.unlockedMaps, id] }));
  return true;
}

export function unlockMapByLevel(id: MapId) {
  const s = saveStore.get();
  if (!s.unlockedMaps.includes(id)) mutateSave((cur) => ({ unlockedMaps: [...cur.unlockedMaps, id] }));
}

export function selectMap(id: MapId) {
  const s = saveStore.get();
  if (s.unlockedMaps.includes(id)) mutateSave({ map: id });
}

export function buyCharge(id: PowerUpId, price: number): boolean {
  if (!trySpend(price)) return false;
  mutateSave((s) => ({ puCharges: { ...s.puCharges, [id]: (s.puCharges[id] ?? 0) + 1 } }));
  return true;
}

export function consumeCharge(id: PowerUpId): boolean {
  const s = saveStore.get();
  const n = s.puCharges[id] ?? 0;
  if (n <= 0) return false;
  mutateSave({ puCharges: { ...s.puCharges, [id]: n - 1 } });
  return true;
}

export function upgradePu(id: PowerUpId, price: number, maxLevel: number): boolean {
  const s = saveStore.get();
  const cur = s.puLevels[id] ?? 1;
  if (cur >= maxLevel) return false;
  if (!trySpend(price)) return false;
  mutateSave({ puLevels: { ...s.puLevels, [id]: cur + 1 } });
  return true;
}

export function equipPu(id: PowerUpId | null) {
  mutateSave({ equippedPu: id });
}

export function buyTrail(id: TrailId, price: number): boolean {
  const s = saveStore.get();
  if (s.ownedTrails.includes(id)) return true;
  if (!trySpend(price)) return false;
  mutateSave((cur) => ({ ownedTrails: [...cur.ownedTrails, id] }));
  return true;
}

export function equipTrail(id: TrailId) {
  const s = saveStore.get();
  if (s.ownedTrails.includes(id)) mutateSave({ trail: id });
}

export function setSettings(patch: Partial<Settings>) {
  mutateSave((s) => ({ settings: { ...s.settings, ...patch } }));
}

export function resetProgress() {
  const fresh = defaultSave();
  saveStore.set(() => fresh);
  persistNow();
}

// data local YYYY-MM-DD (para recompensa diária)
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
