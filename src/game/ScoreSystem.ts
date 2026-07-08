import type { EpiId } from '../state/types';
import { EPI_LIST } from '../data/safetyTips';

// ============================================================
// Pontuação, moedas, distância e o Índice de Segurança —
// o diferencial: jogar "seguro" vale tanto quanto jogar rápido.
// ============================================================

export class ScoreSystem {
  score = 0;
  distance = 0;
  coins = 0;
  safety = 50;
  cleanStreak = 0; // metros sem colisão (corrente)
  bestCleanStreak = 0;
  episCollected: Set<EpiId> = new Set();
  epiCount = 0;
  epiStreak = 0; // EPIs seguidos (ativa DDS)
  cardsCollected = 0;
  dodges = 0;
  nearMisses = 0;
  risksAvoided = 0;
  isolationsRespected = 0;
  safePathUses = 0;
  powerupsUsed = 0;
  detonationRoutes = 0;
  epiSetDone = false;

  /** multiplicadores externos (DDS, mapa bônus, skins) */
  scoreMult = 1;
  coinMult = 1;
  safetyGainMult = 1;

  reset(startSafety: number) {
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.safety = startSafety;
    this.cleanStreak = 0;
    this.bestCleanStreak = 0;
    this.episCollected.clear();
    this.epiCount = 0;
    this.epiStreak = 0;
    this.cardsCollected = 0;
    this.dodges = 0;
    this.nearMisses = 0;
    this.risksAvoided = 0;
    this.isolationsRespected = 0;
    this.safePathUses = 0;
    this.powerupsUsed = 0;
    this.detonationRoutes = 0;
    this.epiSetDone = false;
    this.scoreMult = 1;
    this.coinMult = 1;
    this.safetyGainMult = 1;
  }

  tick(dt: number, speed: number) {
    const d = speed * dt;
    this.distance += d;
    this.cleanStreak += d;
    if (this.cleanStreak > this.bestCleanStreak) this.bestCleanStreak = this.cleanStreak;
    this.score += d * 12 * this.scoreMult;
    // corrida limpa alimenta o índice lentamente
    this.addSafety(dt * 0.12);
  }

  addSafety(v: number) {
    const gain = v > 0 ? v * this.safetyGainMult : v;
    this.safety = Math.max(0, Math.min(100, this.safety + gain));
  }

  addCoin(n = 1): number {
    const total = Math.round(n * this.coinMult);
    this.coins += total;
    this.score += 25 * this.scoreMult * n;
    return total;
  }

  /** retorna true quando completa o conjunto de 8 EPIs */
  addEpi(epi: EpiId): boolean {
    this.epiCount++;
    this.epiStreak++;
    this.episCollected.add(epi);
    this.score += 150 * this.scoreMult;
    this.addSafety(2);
    if (!this.epiSetDone && this.episCollected.size >= EPI_LIST.length) {
      this.epiSetDone = true;
      this.score += 500 * this.scoreMult;
      this.coins += 50;
      this.addSafety(10);
      return true;
    }
    return false;
  }

  addCard(coinBonus: number) {
    this.cardsCollected++;
    this.score += 50 * this.scoreMult;
    this.coins += coinBonus;
    this.addSafety(1.5);
  }

  onCrash(shielded: boolean, brigadista: boolean) {
    this.cleanStreak = 0;
    this.epiStreak = 0;
    let penalty = shielded ? 5 : 10;
    if (brigadista) penalty *= 0.5;
    this.addSafety(-penalty);
  }

  onNearMiss() {
    this.nearMisses++;
    this.score += 40 * this.scoreMult;
    // desvio em cima da hora é arriscado: pequeno custo no índice
    this.addSafety(-0.5);
  }

  onDodge() {
    this.dodges++;
    this.score += 80 * this.scoreMult;
    this.addSafety(1);
  }

  onSpillEntered() {
    this.addSafety(-8);
    this.epiStreak = 0;
  }

  onSpillAvoided() {
    this.risksAvoided++;
    this.score += 60 * this.scoreMult;
    this.addSafety(2);
  }

  onIsolationRespected() {
    this.isolationsRespected++;
    this.addSafety(1);
  }

  onSafePathComplete() {
    this.safePathUses++;
    this.addSafety(5);
    this.score += 120 * this.scoreMult;
  }

  onDetonationRoute(ratio: number): number {
    this.detonationRoutes++;
    const coins = Math.round(30 + ratio * 90);
    this.coins += coins;
    this.addSafety(4 + ratio * 8);
    this.score += 300 * ratio * this.scoreMult;
    return coins;
  }
}
