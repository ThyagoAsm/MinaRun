import * as THREE from 'three';
import type { PowerUpId } from '../state/types';
import { puDuration } from '../data/powerups';
import { getPalette } from './TextureFactory';
import { LANE_X, type ProceduralMap } from './ProceduralMap';

// ============================================================
// Power-ups em tempo de execução: efeitos, temporizadores e
// visuais (drone companheiro, trilha do caminho seguro).
// ============================================================

export interface ActiveEffect {
  id: PowerUpId;
  t: number;
  dur: number;
}

export class PowerUpSystem {
  active = new Map<PowerUpId, ActiveEffect>();
  shieldCharged = false;
  private durMult = 1;

  // visuais
  private drone: THREE.Group | null = null;
  private droneRotors: THREE.Mesh[] = [];
  private laneGlow: THREE.Mesh | null = null;
  private glowMat: THREE.MeshBasicMaterial | null = null;
  private safeLane = 1;
  private safeLaneTimer = 0;
  /** acompanhou a faixa segura? (para o bônus do Caminho Seguro) */
  private followTime = 0;
  private totalTime = 0;

  constructor(private scene: THREE.Scene) {}

  reset(durMult: number) {
    this.active.clear();
    this.shieldCharged = false;
    this.durMult = durMult;
    this.followTime = 0;
    this.totalTime = 0;
    this.hideDrone();
    this.hideGlow();
  }

  has(id: PowerUpId): boolean {
    return id === 'escudo' ? this.shieldCharged : this.active.has(id);
  }

  get speedMult(): number {
    return this.active.has('inspecao') ? 0.62 : 1;
  }

  /** ativa um power-up (retorna a duração aplicada) */
  activate(id: PowerUpId, level: number): number {
    if (id === 'escudo') {
      this.shieldCharged = true;
      return 0;
    }
    const dur = puDuration(id, level, this.durMult);
    this.active.set(id, { id, t: dur, dur });
    if (id === 'drone') this.showDrone();
    if (id === 'caminho' || id === 'radio') this.showGlow(id);
    if (id === 'caminho') {
      this.followTime = 0;
      this.totalTime = 0;
    }
    return dur;
  }

  consumeShield(): boolean {
    if (!this.shieldCharged) return false;
    this.shieldCharged = false;
    return true;
  }

  /** o efeito mais relevante para o HUD */
  hudEffect(): ActiveEffect | null {
    let best: ActiveEffect | null = null;
    for (const e of this.active.values()) {
      if (!best || e.t > best.t) best = e;
    }
    return best;
  }

  update(dt: number, map: ProceduralMap, playerLane: number, playerX: number, time: number, onExpire: (id: PowerUpId, followRatio: number) => void) {
    for (const e of [...this.active.values()]) {
      e.t -= dt;
      if (e.t <= 0) {
        this.active.delete(e.id);
        if (e.id === 'drone') this.hideDrone();
        if (e.id === 'caminho' || e.id === 'radio') {
          if (!this.active.has('caminho') && !this.active.has('radio')) this.hideGlow();
        }
        const ratio = this.totalTime > 0 ? this.followTime / this.totalTime : 0;
        onExpire(e.id, ratio);
      }
    }

    // atualiza faixa segura sinalizada
    if (this.laneGlow && (this.active.has('caminho') || this.active.has('radio'))) {
      this.safeLaneTimer -= dt;
      if (this.safeLaneTimer <= 0) {
        this.safeLaneTimer = 0.35;
        this.safeLane = map.scanSafeLane(playerLane);
      }
      const targetX = LANE_X[this.safeLane];
      this.laneGlow.position.x += (targetX - this.laneGlow.position.x) * Math.min(1, dt * 8);
      if (this.glowMat) this.glowMat.opacity = 0.22 + Math.sin(time * 6) * 0.07;
      if (this.active.has('caminho')) {
        this.totalTime += dt;
        if (playerLane === this.safeLane) this.followTime += dt;
      }
    }

    // drone acompanha à frente
    if (this.drone && this.active.has('drone')) {
      this.drone.position.x += (playerX - this.drone.position.x) * Math.min(1, dt * 5);
      this.drone.position.y = 2.5 + Math.sin(time * 3.2) * 0.18;
      this.drone.position.z = -4.5;
      for (const r of this.droneRotors) r.rotation.y += dt * 30;
    }
  }

  // ---------------- visuais ----------------

  private showDrone() {
    if (!this.drone) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.14, 0.4),
        new THREE.MeshLambertMaterial({ color: '#4dd7f2', emissive: '#1a7a8a', emissiveIntensity: 0.5 }),
      );
      g.add(body);
      const rotorGeo = new THREE.BoxGeometry(0.34, 0.02, 0.06);
      const rotorMat = new THREE.MeshBasicMaterial({ color: '#dddddd', transparent: true, opacity: 0.7 });
      for (const [dx, dz] of [
        [-0.22, -0.22],
        [0.22, -0.22],
        [-0.22, 0.22],
        [0.22, 0.22],
      ]) {
        const r = new THREE.Mesh(rotorGeo, rotorMat);
        r.position.set(dx, 0.1, dz);
        g.add(r);
        this.droneRotors.push(r);
      }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff5a3c' }));
      eye.position.set(0, -0.04, 0.2);
      g.add(eye);
      this.drone = g;
      this.scene.add(g);
    }
    this.drone.visible = true;
    this.drone.position.set(0, 2.5, -4.5);
  }

  private hideDrone() {
    if (this.drone) this.drone.visible = false;
  }

  private showGlow(kind: 'caminho' | 'radio') {
    if (!this.laneGlow) {
      this.glowMat = new THREE.MeshBasicMaterial({
        color: getPalette().safe,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      this.laneGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 46), this.glowMat);
      this.laneGlow.rotation.x = -Math.PI / 2;
      this.laneGlow.position.set(0, 0.06, -26);
      this.scene.add(this.laneGlow);
    }
    if (this.glowMat) this.glowMat.color.set(kind === 'radio' ? '#4dabf7' : getPalette().safe);
    this.laneGlow.visible = true;
  }

  private hideGlow() {
    if (this.laneGlow) this.laneGlow.visible = false;
  }

  dispose() {
    if (this.drone) {
      this.drone.removeFromParent();
    }
    if (this.laneGlow) {
      this.laneGlow.removeFromParent();
      this.laneGlow.geometry.dispose();
      this.glowMat?.dispose();
    }
  }
}
