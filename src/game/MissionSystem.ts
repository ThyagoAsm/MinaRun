import { MISSION_TEMPLATES, missionTemplateById, type MissionEvent } from '../data/missions';
import type { ActiveMission } from '../state/types';
import { mutateSave, saveStore } from './SaveSystem';

// ============================================================
// Missões de segurança: 3 ativas, progresso persistente entre
// corridas (exceto missões "perRun") e substituição automática.
// ============================================================

export interface CompletedMissionInfo {
  text: string;
  coins: number;
  xp: number;
}

export class MissionSystem {
  /** progresso da corrida atual para missões perRun */
  private runProgress = new Map<string, number>();
  private completedThisRun: CompletedMissionInfo[] = [];
  onComplete: ((info: CompletedMissionInfo) => void) | null = null;

  startRun() {
    this.runProgress.clear();
    this.completedThisRun = [];
  }

  get activeMissions(): ActiveMission[] {
    return saveStore.get().missions.active;
  }

  /** missão em destaque para o HUD (primeira não concluída) */
  hudMission(): { text: string; cur: number; target: number } | null {
    for (const am of this.activeMissions) {
      const t = missionTemplateById(am.id);
      if (!t) continue;
      const target = t.target(am.tier);
      const cur = Math.min(target, this.currentProgress(am));
      if (cur < target) return { text: t.text(target), cur, target };
    }
    return null;
  }

  currentProgress(am: ActiveMission): number {
    const t = missionTemplateById(am.id);
    if (!t) return 0;
    return t.perRun ? this.runProgress.get(am.id) ?? 0 : am.progress;
  }

  /** registra um evento de jogo e conclui missões quando alcançadas */
  emit(event: MissionEvent, amount = 1) {
    const save = saveStore.get();
    let changed = false;
    const next: ActiveMission[] = [];
    let completedCount = save.missions.completedCount;

    for (const am of save.missions.active) {
      const t = missionTemplateById(am.id);
      if (!t) {
        changed = true;
        continue; // template removido: descarta
      }
      let progress = am.progress;
      if (t.event === event) {
        if (t.perRun) {
          const cur = (this.runProgress.get(am.id) ?? 0) + amount;
          this.runProgress.set(am.id, cur);
          if (cur >= t.target(am.tier)) {
            this.complete(t.text(t.target(am.tier)), t.rewardCoins(am.tier), t.rewardXp(am.tier));
            completedCount++;
            next.push(this.nextMission(completedCount, [...save.missions.active, ...next]));
            changed = true;
            continue;
          }
        } else {
          progress = am.progress + amount;
          if (progress >= t.target(am.tier)) {
            this.complete(t.text(t.target(am.tier)), t.rewardCoins(am.tier), t.rewardXp(am.tier));
            completedCount++;
            next.push(this.nextMission(completedCount, [...save.missions.active, ...next]));
            changed = true;
            continue;
          }
          if (progress !== am.progress) changed = true;
        }
      }
      next.push({ ...am, progress });
    }

    if (changed) {
      mutateSave({ missions: { active: next, completedCount } });
    }
  }

  /** eventos avaliados por valor absoluto (distância na corrida, etc.) */
  emitAbsolute(event: 'distance_run' | 'clean_run', value: number) {
    const save = saveStore.get();
    for (const am of save.missions.active) {
      const t = missionTemplateById(am.id);
      if (!t || t.event !== event) continue;
      const cur = this.runProgress.get(am.id) ?? 0;
      if (value > cur) {
        this.runProgress.set(am.id, value);
        if (cur < t.target(am.tier) && value >= t.target(am.tier)) {
          // completou agora
          this.completeAbsolute(am.id);
        }
      }
    }
  }

  private completeAbsolute(id: string) {
    const save = saveStore.get();
    const am = save.missions.active.find((m) => m.id === id);
    const t = missionTemplateById(id);
    if (!am || !t) return;
    const completedCount = save.missions.completedCount + 1;
    const next = save.missions.active.filter((m) => m !== am);
    next.push(this.nextMission(completedCount, save.missions.active));
    this.complete(t.text(t.target(am.tier)), t.rewardCoins(am.tier), t.rewardXp(am.tier));
    mutateSave({ missions: { active: next, completedCount } });
  }

  private complete(text: string, coins: number, xp: number) {
    const info: CompletedMissionInfo = { text, coins, xp };
    this.completedThisRun.push(info);
    mutateSave((s) => ({
      coins: s.coins + coins,
      totalCoins: s.totalCoins + coins,
    }));
    this.onComplete?.(info);
  }

  /** escolhe a próxima missão evitando duplicar ids ativos e subindo o tier */
  private nextMission(completedCount: number, current: ActiveMission[]): ActiveMission {
    const activeIds = new Set(current.map((m) => m.id));
    const tier = 1 + Math.floor(completedCount / MISSION_TEMPLATES.length);
    for (let i = 0; i < MISSION_TEMPLATES.length; i++) {
      const idx = (completedCount + i) % MISSION_TEMPLATES.length;
      const t = MISSION_TEMPLATES[idx];
      if (!activeIds.has(t.id)) return { id: t.id, tier, progress: 0 };
    }
    return { id: MISSION_TEMPLATES[0].id, tier, progress: 0 };
  }

  takeCompletedThisRun(): CompletedMissionInfo[] {
    const out = this.completedThisRun;
    this.completedThisRun = [];
    return out;
  }
}
