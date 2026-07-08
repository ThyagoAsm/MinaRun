import * as THREE from 'three';
import { buildCharacter, type CharacterRig, type Expression } from './CharacterFactory';
import type { SkinId } from '../state/types';
import { LANE_X } from './ProceduralMap';

// ============================================================
// Jogador: corrida automática, troca de faixa, pulo, rolagem.
// Hitbox menor que o modelo (colisões justas) e animação 100%
// procedural (sem clipes externos).
// ============================================================

const JUMP_VY = 8.8;
const GRAVITY = 23.5;
const LANE_TIME = 0.16;
const ROLL_TIME = 0.62;

export type PlayerAnim = 'run' | 'idle' | 'crash';

export class PlayerController {
  root = new THREE.Group();
  rig: CharacterRig | null = null;
  shield: THREE.Mesh;

  lane = 1;
  x = 0;
  private fromX = 0;
  private laneT = 1; // 1 = transição completa
  y = 0;
  private vy = 0;
  grounded = true;
  rolling = false;
  private rollT = 0;
  anim: PlayerAnim = 'idle';
  private crashT = 0;
  private celebrateT = 0;
  private runCycle = 0;
  private buffered: 'jump' | 'roll' | null = null;
  private bufferT = 0;
  private idlePhase = Math.random() * 10;
  private scaredT = 0;
  private currentExpr: Expression = 'neutral';
  /** multiplicador de tempo de troca de faixa (piso molhado = mais lento) */
  laneSpeedMult = 1;

  constructor(parent: THREE.Object3D) {
    parent.add(this.root);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: '#ffd23f',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), shieldMat);
    this.shield.position.y = 0.95;
    this.shield.visible = false;
    this.root.add(this.shield);
  }

  setSkin(id: SkinId, withLamp: boolean) {
    if (this.rig) {
      this.root.remove(this.rig.root);
      this.rig.dispose();
    }
    this.rig = buildCharacter(id, withLamp);
    this.root.add(this.rig.root);
  }

  setLampIntensity(v: number) {
    if (this.rig?.lamp) this.rig.lamp.intensity = v;
  }

  reset() {
    this.lane = 1;
    this.x = 0;
    this.fromX = 0;
    this.laneT = 1;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.rolling = false;
    this.rollT = 0;
    this.anim = 'run';
    this.crashT = 0;
    this.celebrateT = 0;
    this.buffered = null;
    this.laneSpeedMult = 1;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    if (this.rig) {
      this.rig.spin.rotation.set(0, 0, 0);
      this.rig.root.position.set(0, 0, 0);
      this.rig.root.rotation.set(0, Math.PI, 0); // preserva o rig de frente para -Z
    }
  }

  get changingLane(): boolean {
    return this.laneT < 1;
  }

  /** hitbox atual (meias-extensões) — menor que o visual */
  get halfW(): number {
    return this.changingLane ? 0.26 : 0.33;
  }
  get halfH(): number {
    return this.rolling ? 0.4 : 0.8;
  }
  get baseY(): number {
    return this.y;
  }
  get halfD(): number {
    return 0.3;
  }

  moveLane(dir: -1 | 1): boolean {
    const target = this.lane + dir;
    if (target < 0 || target > 2 || this.anim === 'crash') return false;
    this.fromX = this.x;
    this.lane = target;
    this.laneT = 0;
    return true;
  }

  jump(): boolean {
    if (this.anim === 'crash') return false;
    if (!this.grounded || this.rolling) {
      this.buffered = 'jump';
      this.bufferT = 0.28;
      return false;
    }
    this.vy = JUMP_VY;
    this.grounded = false;
    return true;
  }

  roll(): boolean {
    if (this.anim === 'crash') return false;
    if (!this.grounded) {
      // rolagem no ar = queda rápida (padrão do gênero)
      this.vy = Math.min(this.vy, -10);
      this.buffered = 'roll';
      this.bufferT = 0.3;
      return false;
    }
    if (this.rolling) return false;
    this.rolling = true;
    this.rollT = 0;
    return true;
  }

  celebrate() {
    this.celebrateT = 0.9;
  }

  /** expressão de susto (quase-acidente) */
  scare() {
    this.scaredT = 0.7;
  }

  /** empuxo lateral (correia transportadora) */
  applyDrift(dx: number) {
    if (this.anim === 'crash' || this.laneT < 1) return;
    this.x = Math.max(-3.1, Math.min(3.1, this.x + dx));
  }

  /** retorna suavemente ao centro da faixa após um empuxo */
  recenter(dt: number) {
    if (this.laneT < 1) return;
    const target = LANE_X[this.lane];
    if (Math.abs(this.x - target) > 0.001) {
      this.x += (target - this.x) * Math.min(1, dt * 6);
    }
  }

  crash() {
    this.anim = 'crash';
    this.crashT = 0;
    this.rolling = false;
  }

  setShield(on: boolean) {
    this.shield.visible = on;
  }

  update(dt: number, speed: number) {
    // troca de faixa suave (sem "snap" — preserva o empuxo da correia)
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / (LANE_TIME * this.laneSpeedMult));
      const k = this.laneT * this.laneT * (3 - 2 * this.laneT);
      this.x = THREE.MathUtils.lerp(this.fromX, LANE_X[this.lane], k);
    }

    // física vertical
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }

    // rolagem
    if (this.rolling) {
      this.rollT += dt;
      if (this.rollT >= ROLL_TIME) this.rolling = false;
    }

    // ações em buffer
    if (this.buffered) {
      this.bufferT -= dt;
      if (this.bufferT <= 0) this.buffered = null;
      else if (this.buffered === 'jump' && this.grounded && !this.rolling) {
        this.buffered = null;
        this.jump();
      } else if (this.buffered === 'roll' && this.grounded && !this.rolling) {
        this.buffered = null;
        this.roll();
      }
    }

    this.root.position.x = this.x;
    this.root.position.y = this.y;
    this.animate(dt, speed);
    if (this.shield.visible) {
      this.shield.rotation.y += dt * 1.5;
      const s = 1 + Math.sin(performance.now() * 0.006) * 0.04;
      this.shield.scale.setScalar(s);
    }
  }

  private animate(dt: number, speed: number) {
    const rig = this.rig;
    if (!rig) return;

    // expressão facial conforme o estado (GDD: neutra, esforço, susto, feliz)
    if (this.scaredT > 0) this.scaredT -= dt;
    let expr: Expression;
    if (this.anim === 'crash' || this.scaredT > 0) expr = 'scared';
    else if (this.celebrateT > 0) expr = 'happy';
    else if (this.anim === 'idle') expr = 'neutral';
    else expr = 'effort';
    if (expr !== this.currentExpr) {
      this.currentExpr = expr;
      rig.setExpression(expr);
    }

    if (this.anim === 'crash') {
      this.crashT += dt;
      const k = Math.min(1, this.crashT / 0.5);
      rig.spin.rotation.x = -0.9 * k;
      rig.armL.rotation.x = -2.4 * k;
      rig.armR.rotation.x = -2.2 * k;
      rig.legL.rotation.x = 0.6 * k;
      rig.legR.rotation.x = -0.4 * k;
      this.root.position.z = k * 1.4;
      this.root.position.y = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.5;
      return;
    }

    if (this.anim === 'idle') {
      this.idlePhase += dt;
      const t = this.idlePhase;
      rig.hips.position.y = 0.1 + Math.sin(t * 2.2) * 0.018;
      rig.armL.rotation.x = Math.sin(t * 2.2) * 0.08;
      rig.armR.rotation.x = -Math.sin(t * 2.2) * 0.08;
      rig.armL.rotation.z = 0.08;
      rig.armR.rotation.z = -0.08;
      rig.legL.rotation.x = 0;
      rig.legR.rotation.x = 0;
      rig.head.rotation.y = Math.sin(t * 0.7) * 0.25;
      rig.spin.rotation.x = 0;
      // comemoração breve (recorde no menu / vitória)
      if (this.celebrateT > 0) {
        this.celebrateT -= dt;
        rig.armR.rotation.x = -2.6;
        rig.armL.rotation.x = -0.4;
      }
      return;
    }

    // corrida
    const freq = 1.9 + speed * 0.34;
    this.runCycle += dt * freq;
    const c = this.runCycle;

    if (this.rolling) {
      const k = this.rollT / ROLL_TIME;
      rig.spin.rotation.x = Math.PI * 2 * k; // cambalhota para a frente
      rig.hips.position.y = 0.02;
      rig.legL.rotation.x = 1.2;
      rig.legR.rotation.x = 1.2;
      rig.armL.rotation.x = 1.0;
      rig.armR.rotation.x = 1.0;
    } else if (!this.grounded) {
      rig.spin.rotation.x = 0;
      rig.hips.position.y = 0.1;
      rig.legL.rotation.x = -0.7;
      rig.legR.rotation.x = 0.55;
      rig.armL.rotation.x = -2.2;
      rig.armR.rotation.x = -1.8;
    } else {
      rig.spin.rotation.x = 0.12; // leve inclinação para frente
      const swing = Math.sin(c);
      rig.legL.rotation.x = swing * 0.95;
      rig.legR.rotation.x = -swing * 0.95;
      rig.armL.rotation.x = -swing * 0.75;
      rig.armR.rotation.x = swing * 0.75;
      rig.armL.rotation.z = 0.06;
      rig.armR.rotation.z = -0.06;
      rig.hips.position.y = 0.1 + Math.abs(Math.sin(c)) * 0.055;
      rig.head.rotation.y = 0;
      if (this.celebrateT > 0) {
        this.celebrateT -= dt;
        rig.armR.rotation.x = -2.8;
        rig.armR.rotation.z = -0.2;
      }
    }

    // inclinação na troca de faixa
    const laneLean = this.changingLane ? (LANE_X[this.lane] - this.x) * 0.16 : 0;
    this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, -laneLean, Math.min(1, dt * 14));
    this.root.rotation.y = THREE.MathUtils.lerp(this.root.rotation.y, -laneLean * 0.8, Math.min(1, dt * 14));
    this.root.position.z = 0;
  }

  dispose() {
    if (this.rig) this.rig.dispose();
    this.shield.geometry.dispose();
    (this.shield.material as THREE.Material).dispose();
    this.root.removeFromParent();
  }
}
