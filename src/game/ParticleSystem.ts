import * as THREE from 'three';

// ============================================================
// Partículas leves em CPU (THREE.Points) com buffers fixos.
// Contagem escalada pela qualidade; nada é alocado por frame.
// ============================================================

interface Particle {
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
}

class PointsPool {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  data: Particle[];
  positions: Float32Array;
  count: number;
  cursor = 0;

  constructor(count: number, size: number, color: string, opacity = 1) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.data = new Array(count);
    for (let i = 0; i < count; i++) {
      this.data[i] = { life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 };
      this.positions[i * 3 + 1] = -999; // fora da tela
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      size,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, v: { vx: number; vy: number; vz: number }, life: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const p = this.data[i];
    p.life = life;
    p.maxLife = life;
    p.vx = v.vx;
    p.vy = v.vy;
    p.vz = v.vz;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
  }

  update(dt: number, gravity: number, drag = 1) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const p = this.data[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= gravity * dt;
      p.vx *= drag;
      p.vz *= drag;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
      if (p.life <= 0) this.positions[i * 3 + 1] = -999;
    }
    if (any) (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.count; i++) {
      this.data[i].life = 0;
      this.positions[i * 3 + 1] = -999;
    }
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export class ParticleSystem {
  group = new THREE.Group();
  private sparkle: PointsPool;
  private debris: PointsPool;
  private splash: PointsPool;
  private dustPuffs: PointsPool;
  private trail: PointsPool;
  private rain: PointsPool;
  private ambient: PointsPool;
  private streaks: PointsPool;
  private rainOn = false;
  private trailColor: string | null = null;
  private puffAcc = 0;
  private scaleCount = 1;

  constructor(scene: THREE.Scene, quality: number) {
    this.scaleCount = quality;
    this.sparkle = new PointsPool(48, 0.16, '#ffd94d');
    this.debris = new PointsPool(40, 0.14, '#8a8f96');
    this.splash = new PointsPool(32, 0.12, '#7ec8ff', 0.9);
    this.dustPuffs = new PointsPool(60, 0.22, '#c9a76a', 0.5);
    this.trail = new PointsPool(70, 0.14, '#ffd94d', 0.85);
    this.rain = new PointsPool(220, 0.1, '#9fc8e8', 0.7);
    this.ambient = new PointsPool(50, 0.11, '#d9c8a0', 0.22);
    this.streaks = new PointsPool(60, 0.09, '#ffffff', 0.16);
    for (const p of [this.sparkle, this.debris, this.splash, this.dustPuffs, this.trail, this.rain, this.ambient, this.streaks]) {
      this.group.add(p.points);
    }
    scene.add(this.group);
    // motas ambientes iniciais
    for (let i = 0; i < 40; i++) {
      this.ambient.emit(
        (Math.random() - 0.5) * 24,
        0.5 + Math.random() * 5,
        -Math.random() * 90,
        { vx: (Math.random() - 0.5) * 0.3, vy: 0.05, vz: 1.5 + Math.random() },
        6 + Math.random() * 6,
      );
    }
  }

  setQuality(q: number) {
    this.scaleCount = q;
  }
  setRain(on: boolean) {
    this.rainOn = on;
  }
  setTrailColor(c: string | null) {
    this.trailColor = c;
    if (c) this.trail.material.color.set(c);
  }

  burstCollect(x: number, y: number, z: number, color?: string) {
    if (color) this.sparkle.material.color.set(color);
    else this.sparkle.material.color.set('#ffd94d');
    const n = Math.round(10 * this.scaleCount);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.sparkle.emit(x, y, z, { vx: Math.cos(a) * 2.2, vy: 2.4 + Math.random() * 1.6, vz: Math.sin(a) * 2 + 2 }, 0.5);
    }
  }

  burstCrash(x: number, y: number, z: number) {
    const n = Math.round(16 * this.scaleCount);
    for (let i = 0; i < n; i++) {
      this.debris.emit(x, y + 0.5, z, {
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 4,
        vz: 1 + Math.random() * 4,
      }, 0.7);
    }
  }

  burstSplash(x: number, z: number) {
    const n = Math.round(8 * this.scaleCount);
    for (let i = 0; i < n; i++) {
      this.splash.emit(x + (Math.random() - 0.5) * 0.6, 0.1, z, {
        vx: (Math.random() - 0.5) * 2.4,
        vy: 1.6 + Math.random() * 1.8,
        vz: 2 + Math.random() * 2,
      }, 0.45);
    }
  }

  update(dt: number, speed: number, playerX: number, playerY: number, grounded: boolean, reducedFx: boolean, time: number) {
    this.sparkle.update(dt, 6);
    this.debris.update(dt, 9);
    this.splash.update(dt, 7);
    this.dustPuffs.update(dt, -0.4, 0.96);
    this.trail.update(dt, 0.4, 0.98);
    this.rain.update(dt, 0);
    this.ambient.update(dt, 0);
    this.streaks.update(dt, 0);

    if (reducedFx) return;

    // motion streaks laterais em alta velocidade (GDD: sensação de movimento)
    if (speed > 18 && Math.random() > 0.4) {
      const side = Math.random() > 0.5 ? 1 : -1;
      this.streaks.emit(side * (4.4 + Math.random() * 2.4), 0.6 + Math.random() * 2.6, -30 - Math.random() * 30, {
        vx: 0,
        vy: 0,
        vz: speed * 2.2,
      }, 0.8);
    }

    // poeira nos pés durante a corrida
    if (grounded && speed > 1) {
      this.puffAcc += dt;
      if (this.puffAcc > 0.11) {
        this.puffAcc = 0;
        this.dustPuffs.emit(playerX + (Math.random() - 0.5) * 0.4, 0.08, 0.4, {
          vx: (Math.random() - 0.5) * 0.8,
          vy: 0.7 + Math.random() * 0.5,
          vz: 2.5 + speed * 0.12,
        }, 0.6);
      }
    }

    // trilha cosmética
    if (this.trailColor && speed > 1 && Math.random() > 0.35) {
      this.trail.emit(playerX + (Math.random() - 0.5) * 0.3, playerY + 0.4 + Math.random() * 0.7, 0.5, {
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.3,
        vz: 3 + speed * 0.2,
      }, 0.55);
    }

    // chuva
    if (this.rainOn) {
      const n = Math.round(6 * this.scaleCount);
      for (let i = 0; i < n; i++) {
        this.rain.emit((Math.random() - 0.5) * 26, 10 + Math.random() * 4, -Math.random() * 70 + 5, {
          vx: 0,
          vy: -18 - Math.random() * 6,
          vz: speed * 0.4,
        }, 0.9);
      }
    }

    // motas ambientes continuam circulando
    if (Math.random() > 0.82) {
      this.ambient.emit(
        (Math.random() - 0.5) * 26,
        0.5 + Math.random() * 5,
        -80,
        { vx: (Math.random() - 0.5) * 0.3, vy: 0.03 + Math.sin(time) * 0.02, vz: speed * 0.55 },
        7,
      );
    }
  }

  clearBursts() {
    this.sparkle.clear();
    this.debris.clear();
    this.splash.clear();
    this.dustPuffs.clear();
    this.trail.clear();
    this.rain.clear();
    this.streaks.clear();
  }

  dispose() {
    for (const p of [this.sparkle, this.debris, this.splash, this.dustPuffs, this.trail, this.rain, this.ambient, this.streaks]) p.dispose();
    this.group.removeFromParent();
  }
}
