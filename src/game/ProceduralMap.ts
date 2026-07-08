import * as THREE from 'three';
import type { CrashCause, EpiId, PowerUpId } from '../state/types';
import type { MapDef } from '../data/maps';
import { CHAR_OBSTACLE, OBSTACLE_DEFS, PATTERNS, type ObstacleKind, type PatternDef } from '../data/obstacles';
import { EPI_LIST } from '../data/safetyTips';
import { Pools } from './ObstacleManager';

// ============================================================
// Pista infinita por módulos (chunks) com validação de rota:
// nunca existe trecho impossível — sempre há uma faixa passável.
// ============================================================

export const LANE_X = [-2.3, 0, 2.3];
export const ROW_GAP = 6;
const KILL_Z = 22;
const HORIZON = 175;

export type ZoneKind = 'wet' | 'dust' | 'spill' | 'conveyor' | 'saferoute';

export interface RunObstacle {
  key: string;
  kind: ObstacleKind;
  lane: number; // faixa central do colisor
  halfX: number;
  halfY: number;
  halfZ: number;
  yBase: number;
  z: number; // local ao chunk (atualizável por updaters)
  xOffset: number; // deslocamento extra em X (hazards largos)
  mesh: THREE.Object3D;
  cause: CrashCause;
  active: boolean;
  moving: boolean;
  dodged: boolean;
}

export interface RunZone {
  kind: ZoneKind;
  lane: number; // -1 = todas as faixas
  z: number;
  halfZ: number;
  entered: boolean;
  resolved: boolean; // já contabilizada (evitada/entrada)
  meta?: number; // conveyor: direção do empuxo
}

export interface RunItem {
  kind: 'coin' | 'epi' | 'card' | 'powerup';
  key: string;
  epi?: EpiId;
  pu?: PowerUpId;
  lane: number;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Object3D;
  spin: THREE.Object3D | null;
  taken: boolean;
  magnet: boolean;
}

export interface Chunk {
  root: THREE.Group;
  len: number;
  obstacles: RunObstacle[];
  zones: RunZone[];
  items: RunItem[];
  updaters: ((ctx: TrackUpdateCtx, chunk: Chunk) => void)[];
  released: { key: string; mesh: THREE.Object3D }[];
}

export interface TrackUpdateCtx {
  dt: number;
  time: number;
  speed: number;
  distance: number;
  playerLane: number;
  reducedFx: boolean;
}

export interface TrackCallbacks {
  warn(text: string, sound: 'alarm' | 'warn' | null): void;
  onDetonationResult(ratio: number): void;
  onDodge(cause: CrashCause): void;
}

// ---------------- RNG determinístico ----------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- validação de padrões ----------------
// BFS com "recarga de ação": depois de pular/rolar numa linha,
// só permite nova ação 2 linhas depois. Garante rota justa.
export function validatePattern(p: PatternDef): boolean {
  const rows = p.rows;
  let states = new Set<string>();
  for (let l = 0; l < 3; l++) states.add(`${l}:0`);
  for (const row of rows) {
    const next = new Set<string>();
    for (const st of states) {
      const [laneS, cdS] = st.split(':');
      const lane = +laneS;
      const cd = +cdS;
      for (const nl of [lane - 1, lane, lane + 1]) {
        if (nl < 0 || nl > 2) continue;
        const ch = row[nl] ?? '.';
        const ob = CHAR_OBSTACLE[ch];
        if (!ob) {
          next.add(`${nl}:${Math.max(0, cd - 1)}`);
          continue;
        }
        const kind = OBSTACLE_DEFS[ob].kind;
        if (kind === 'full') continue;
        if (cd === 0) next.add(`${nl}:2`);
      }
    }
    if (next.size === 0) return false;
    states = next;
  }
  return true;
}

// valida todos os padrões no carregamento (defesa em profundidade)
const VALID_PATTERNS = PATTERNS.filter((p) => {
  const ok = validatePattern(p);
  if (!ok) console.warn(`[ProceduralMap] padrão inválido ignorado: ${p.id}`);
  return ok;
});

const PU_SPAWNABLE: PowerUpId[] = ['escudo', 'radio', 'botas', 'mascara', 'inspecao', 'caminho', 'drone'];

type SpecialKind = 'truck' | 'wagon' | 'gate' | 'arm' | 'rocks' | 'conveyor' | 'dust' | 'wet' | 'bonus';

export class ProceduralMap {
  group = new THREE.Group();
  chunks: Chunk[] = [];
  private frontier = -20;
  private rng: () => number = mulberry32(1);
  private map!: MapDef;
  private tier = 0;
  private lastPatternId = '';
  private specialCooldown: Partial<Record<SpecialKind, number>> = {};
  private lastSpecialDist = 0;
  private detonationQueued = false;
  private eventMovingBoost = 1;
  private distance = 0;

  constructor(private pools: Pools, private cb: TrackCallbacks) {}

  reset(map: MapDef, seed = Date.now()) {
    this.map = map;
    this.rng = mulberry32(seed);
    for (const c of [...this.chunks]) this.releaseChunk(c);
    this.chunks = [];
    this.frontier = -16;
    this.tier = 0;
    this.lastPatternId = '';
    this.specialCooldown = {};
    this.lastSpecialDist = 0;
    this.detonationQueued = false;
    this.eventMovingBoost = 1;
    this.distance = 0;
    // trecho inicial aberto (pista limpa com algumas moedas)
    this.spawnOpenChunk(true);
    this.spawnOpenChunk(false);
    while (this.frontier > -HORIZON) this.spawnNext();
  }

  setEventMovingBoost(v: number) {
    this.eventMovingBoost = v;
  }

  queueDetonationRoute() {
    this.detonationQueued = true;
  }

  update(ctx: TrackUpdateCtx) {
    this.distance = ctx.distance;
    this.tier = Math.min(8, Math.floor(ctx.distance / 250));
    const dz = ctx.speed * ctx.dt;
    for (const c of this.chunks) c.root.position.z += dz;
    this.frontier += dz;

    // recicla chunks atrás do jogador
    while (this.chunks.length > 0 && this.chunks[0].root.position.z - this.chunks[0].len > KILL_Z) {
      const c = this.chunks.shift()!;
      this.releaseChunk(c);
    }
    // gera à frente
    let guard = 0;
    while (this.frontier > -HORIZON && guard++ < 8) this.spawnNext();

    // updaters (animações/gatilhos) + giro dos itens
    for (const c of this.chunks) {
      for (const u of c.updaters) u(ctx, c);
      for (const it of c.items) {
        if (!it.taken && it.spin) it.spin.rotation.y += ctx.dt * 2.6;
      }
    }
  }

  /** faixa com caminho livre mais longo à frente (radar / caminho seguro) */
  scanSafeLane(playerLane: number): number {
    const dist = [Infinity, Infinity, Infinity];
    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (!ob.active) continue;
        const wz = c.root.position.z + ob.z;
        if (wz > -1 || wz < -80) continue;
        const lanes = this.lanesCovered(ob);
        for (const l of lanes) {
          const penalty = ob.kind === 'full' ? 0 : 18; // baixos/rolar contam menos
          const d = -wz + penalty;
          if (d < dist[l]) dist[l] = d;
        }
      }
    }
    let best = playerLane;
    let bestD = dist[playerLane];
    for (let l = 0; l < 3; l++) {
      if (dist[l] > bestD + 4) {
        best = l;
        bestD = dist[l];
      }
    }
    return best;
  }

  lanesCovered(ob: RunObstacle): number[] {
    const out: number[] = [];
    const cx = LANE_X[ob.lane] + ob.xOffset;
    for (let l = 0; l < 3; l++) {
      if (Math.abs(LANE_X[l] - cx) < ob.halfX + 0.6) out.push(l);
    }
    return out;
  }

  // ------------------------------------------------------------
  private releaseChunk(c: Chunk) {
    for (const r of c.released) this.pools.release(r.key, r.mesh);
    c.root.removeFromParent();
    c.obstacles.length = 0;
    c.zones.length = 0;
    c.items.length = 0;
    c.updaters.length = 0;
    c.released.length = 0;
  }

  private newChunk(len: number): Chunk {
    const root = new THREE.Group();
    root.position.z = this.frontier;
    this.group.add(root);
    const chunk: Chunk = { root, len, obstacles: [], zones: [], items: [], updaters: [], released: [] };
    this.chunks.push(chunk);
    this.frontier -= len;
    return chunk;
  }

  private place(chunk: Chunk, key: string, x: number, z: number): THREE.Object3D {
    const m = this.pools.acquire(key);
    m.position.set(x, 0, z);
    chunk.root.add(m);
    chunk.released.push({ key, mesh: m });
    return m;
  }

  private addObstacle(
    chunk: Chunk,
    key: string,
    kind: ObstacleKind,
    lane: number,
    z: number,
    half: { x: number; y: number; z: number },
    cause: CrashCause,
    opts?: { yBase?: number; xOffset?: number; moving?: boolean; mesh?: THREE.Object3D; active?: boolean },
  ): RunObstacle {
    const mesh = opts?.mesh ?? this.place(chunk, key, LANE_X[lane] + (opts?.xOffset ?? 0), z);
    const ob: RunObstacle = {
      key,
      kind,
      lane,
      halfX: half.x,
      halfY: half.y,
      halfZ: half.z,
      yBase: opts?.yBase ?? 0,
      z,
      xOffset: opts?.xOffset ?? 0,
      mesh,
      cause,
      active: opts?.active ?? true,
      moving: opts?.moving ?? false,
      dodged: false,
    };
    chunk.obstacles.push(ob);
    return ob;
  }

  private addItem(chunk: Chunk, kind: RunItem['kind'], lane: number, z: number, y: number, epi?: EpiId, pu?: PowerUpId) {
    const key = kind === 'epi' ? `item:epi:${epi}` : kind === 'powerup' ? `item:pu:${pu}` : `item:${kind}`;
    const mesh = this.place(chunk, key, LANE_X[lane], z);
    let spin: THREE.Object3D | null = null;
    mesh.traverse((o) => {
      if (o.name === 'spin') spin = o;
    });
    const item: RunItem = { kind, key, epi, pu, lane, x: LANE_X[lane], y, z, mesh, spin, taken: false, magnet: false };
    if (kind === 'coin' && y > 1.05 && spin) (spin as THREE.Object3D).position.y = y;
    chunk.items.push(item);
  }

  private addZone(chunk: Chunk, kind: ZoneKind, lane: number, z: number, halfZ: number, meta?: number): RunZone {
    const zone: RunZone = { kind, lane, z, halfZ, entered: false, resolved: false, meta };
    chunk.zones.push(zone);
    return zone;
  }

  private addBeacons(chunk: Chunk, z: number) {
    const bulbs: THREE.Object3D[] = [];
    for (const s of [-1, 1]) {
      const b = this.place(chunk, 'fx:beacon', 4.3 * s, z);
      b.traverse((o) => {
        if (o.name === 'bulb') bulbs.push(o);
      });
    }
    chunk.updaters.push((ctx) => {
      const on = Math.sin(ctx.time * 9) > 0;
      for (const b of bulbs) b.visible = on;
    });
  }

  private addSign(chunk: Chunk, text: string, z: number, side = -1) {
    this.place(chunk, `fx:sign:${text.replace(/\n/g, '_')}`, 4.3 * side, z);
  }

  // ------------------------------------------------------------
  private spawnOpenChunk(withCoins: boolean) {
    const chunk = this.newChunk(30);
    if (withCoins) {
      const lane = Math.floor(this.rng() * 3);
      for (let i = 1; i < 5; i++) this.addItem(chunk, 'coin', lane, -i * ROW_GAP, 1.0);
    }
  }

  private spawnNext() {
    if (this.detonationQueued) {
      this.detonationQueued = false;
      this.spawnDetonationRoute();
      return;
    }
    const canSpecial = this.distance > 180;
    const roll = this.rng();
    if (canSpecial && roll < 0.34) {
      const kind = this.pickSpecial();
      if (kind) {
        this.spawnSpecial(kind);
        return;
      }
    }
    this.spawnPatternChunk();
  }

  private pickSpecial(): SpecialKind | null {
    const bias = this.map.hazardBias;
    const entries: [SpecialKind, number][] = [
      ['truck', 1.1 * bias.moving * this.eventMovingBoost],
      ['wagon', 0.9 * bias.moving * this.eventMovingBoost],
      ['gate', 0.7 * bias.moving],
      ['arm', this.map.id === 'oficina' ? 1.2 : 0.25],
      ['rocks', 0.9 * bias.rocks],
      ['conveyor', 1.2 * bias.conveyor],
      ['dust', 0.9 * bias.dust],
      ['wet', 0.9 * bias.wet],
      ['bonus', 0.8],
    ];
    const now = this.distance;
    const pool = entries.filter(([k, w]) => w > 0.05 && now >= (this.specialCooldown[k] ?? 0));
    if (pool.length === 0 || now - this.lastSpecialDist < 90) return null;
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [k, w] of pool) {
      r -= w;
      if (r <= 0) {
        this.specialCooldown[k] = now + 260 + this.rng() * 240;
        this.lastSpecialDist = now;
        return k;
      }
    }
    return null;
  }

  // ------------------------------------------------------------
  private spawnPatternChunk() {
    const t = this.tier;
    const pool = VALID_PATTERNS.filter(
      (p) => t >= p.minTier && t <= p.maxTier && p.id !== this.lastPatternId && (!p.themes || p.themes.includes(this.map.id)),
    );
    const pick = this.weighted(pool.length ? pool : VALID_PATTERNS.filter((p) => p.minTier === 0));
    this.lastPatternId = pick.id;

    const buffer = 1 + (t === 0 ? 1 : 0);
    const rows = pick.rows;
    const len = (buffer + rows.length) * ROW_GAP;
    const chunk = this.newChunk(len);

    for (let i = 0; i < rows.length; i++) {
      const z = -(buffer + i) * ROW_GAP;
      const row = rows[i];
      for (let lane = 0; lane < 3; lane++) {
        const ch = row[lane] ?? '.';
        if (ch === '.') continue;
        const obId = CHAR_OBSTACLE[ch];
        if (obId) {
          const def = OBSTACLE_DEFS[obId];
          this.addObstacle(chunk, `ob:${obId}`, def.kind, lane, z, def.half, def.cause, {
            yBase: def.kind === 'over' ? def.overGap ?? 1.15 : 0,
          });
          continue;
        }
        switch (ch) {
          case 'm': {
            // moedas sobre obstáculo baixo anterior formam arco de pulo
            let y = 1.0;
            if (i > 0) {
              const prev = rows[i - 1][lane];
              const prevOb = CHAR_OBSTACLE[prev];
              if (prevOb && OBSTACLE_DEFS[prevOb].kind === 'low') y = 1.9;
            }
            this.addItem(chunk, 'coin', lane, z, y);
            break;
          }
          case 'e': {
            const epi = EPI_LIST[Math.floor(this.rng() * EPI_LIST.length)];
            this.addItem(chunk, 'epi', lane, z, 1.15, epi);
            break;
          }
          case 'E':
            this.addItem(chunk, 'card', lane, z, 1.15);
            break;
          case 'P': {
            const pu = PU_SPAWNABLE[Math.floor(this.rng() * PU_SPAWNABLE.length)];
            this.addItem(chunk, 'powerup', lane, z, 1.1, undefined, pu);
            break;
          }
          case 'w': {
            this.place(chunk, 'zone:wet', LANE_X[lane], z);
            this.addZone(chunk, 'wet', lane, z, 2.7);
            break;
          }
          case 'i': {
            this.place(chunk, 'zone:spill', LANE_X[lane], z);
            this.addZone(chunk, 'spill', lane, z, 2.6);
            break;
          }
        }
      }
    }
  }

  private weighted(pool: PatternDef[]): PatternDef {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let r = this.rng() * total;
    for (const p of pool) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return pool[pool.length - 1];
  }

  // ------------------------------------------------------------
  private spawnSpecial(kind: SpecialKind) {
    switch (kind) {
      case 'truck': return this.spawnTruck();
      case 'wagon': return this.spawnWagon();
      case 'gate': return this.spawnGate();
      case 'arm': return this.spawnArm();
      case 'rocks': return this.spawnRocks();
      case 'conveyor': return this.spawnConveyor();
      case 'dust': return this.spawnDust();
      case 'wet': return this.spawnWetWide();
      case 'bonus': return this.spawnBonus();
    }
  }

  private spawnTruck() {
    const chunk = this.newChunk(48);
    const safeLane = Math.floor(this.rng() * 3);
    const blocked = [0, 1, 2].filter((l) => l !== safeLane);
    const cx = (LANE_X[blocked[0]] + LANE_X[blocked[1]]) / 2;
    const z = -26;
    this.addSign(chunk, 'EQUIPAMENTO\nMÓVEL', -6);
    this.addBeacons(chunk, -10);
    // cones marcando as faixas bloqueadas
    for (const l of blocked) {
      const def = OBSTACLE_DEFS.cone;
      this.addObstacle(chunk, 'ob:cone', 'low', l, -14, def.half, 'cone');
    }
    // moedas na faixa segura
    for (let i = 0; i < 4; i++) this.addItem(chunk, 'coin', safeLane, z + 6 - i * 4, 1.0);

    const truckMesh = this.place(chunk, 'hz:caminhao', cx, z);
    const fromSide = cx <= 0 ? -1 : 1;
    truckMesh.position.x = fromSide * 22;
    truckMesh.rotation.y = fromSide > 0 ? Math.PI : 0;
    const ob = this.addObstacle(chunk, 'hz:caminhao', 'full', 1, z, { x: 2.45, y: 1.7, z: 1.25 }, 'caminhao', {
      xOffset: cx - LANE_X[1],
      moving: true,
      mesh: truckMesh,
      active: false,
    });
    let phase = 0; // 0 aguardando, 1 entrando, 2 parado, 3 saindo
    let t = 0;
    const cbWarn = this.cb;
    chunk.updaters.push((ctx, c) => {
      const wz = c.root.position.z + z;
      if (phase === 0 && wz > -60) {
        phase = 1;
        ob.active = true;
        cbWarn.warn('Equipamento móvel cruzando!', 'alarm');
      } else if (phase === 1) {
        t += ctx.dt;
        const k = Math.min(1, t / 1.1);
        truckMesh.position.x = THREE.MathUtils.lerp(fromSide * 22, cx, 1 - (1 - k) * (1 - k));
        if (k >= 1) phase = 2;
      } else if (phase === 2 && wz > 6) {
        phase = 3;
        ob.active = false;
        t = 0;
      } else if (phase === 3) {
        t += ctx.dt;
        truckMesh.position.x = THREE.MathUtils.lerp(cx, -fromSide * 24, Math.min(1, t / 1.6));
      }
    });
  }

  private spawnWagon() {
    const chunk = this.newChunk(54);
    const lane = Math.floor(this.rng() * 3);
    this.addSign(chunk, 'VAGÃO EM\nMOVIMENTO', -5);
    this.addBeacons(chunk, -8);
    const startZ = -48;
    const wagonMesh = this.place(chunk, 'hz:vagao', LANE_X[lane], startZ);
    const ob = this.addObstacle(chunk, 'hz:vagao', 'full', lane, startZ, { x: 0.8, y: 1.05, z: 1.35 }, 'vagao', {
      moving: true,
      mesh: wagonMesh,
      active: true,
    });
    let warned = false;
    chunk.updaters.push((ctx, c) => {
      // vagão avança em direção ao jogador
      ob.z += ctx.dt * 6.5;
      wagonMesh.position.z = ob.z;
      const wz = c.root.position.z + ob.z;
      if (!warned && wz > -55) {
        warned = true;
        this.cb.warn('Vagão nos trilhos — troque de faixa!', 'alarm');
      }
    });
  }

  private spawnGate() {
    const chunk = this.newChunk(46);
    const z = -26;
    this.addSign(chunk, 'PORTÃO\nFECHANDO', -6);
    this.addBeacons(chunk, -10);
    const gateMesh = this.place(chunk, 'hz:portao', 0, z);
    let door: THREE.Object3D | null = null;
    gateMesh.traverse((o) => {
      if (o.name === 'door') door = o;
    });
    const ob = this.addObstacle(chunk, 'hz:portao', 'over', 1, z, { x: 3.5, y: 0.72, z: 0.16 }, 'portao', {
      yBase: 1.18,
      xOffset: 0,
      mesh: gateMesh,
      active: false,
    });
    let closing = false;
    let k = 0;
    chunk.updaters.push((ctx, c) => {
      const wz = c.root.position.z + z;
      if (!closing && wz > -55) {
        closing = true;
        this.cb.warn('Portão fechando — passe rolando!', 'warn');
      }
      if (closing && k < 1) {
        k = Math.min(1, k + ctx.dt / 0.9);
        if (door) door.position.y = THREE.MathUtils.lerp(4.6, 2.62, k);
        if (k >= 0.85) ob.active = true;
      }
    });
  }

  private spawnArm() {
    const chunk = this.newChunk(44);
    const z = -24;
    this.addSign(chunk, 'MANUTENÇÃO\nEM CURSO', -6);
    this.addBeacons(chunk, -10);
    const armMesh = this.place(chunk, 'hz:braco', 0, z);
    let claw: THREE.Object3D | null = null;
    armMesh.traverse((o) => {
      if (o.name === 'claw') claw = o;
    });
    this.addObstacle(chunk, 'hz:braco', 'over', 1, z, { x: 3.5, y: 0.55, z: 0.3 }, 'braco', {
      yBase: 1.35,
      mesh: armMesh,
      moving: true,
    });
    let warned = false;
    chunk.updaters.push((ctx, c) => {
      if (claw) claw.position.x = Math.sin(ctx.time * 1.6) * 2.8;
      const wz = c.root.position.z + z;
      if (!warned && wz > -50) {
        warned = true;
        this.cb.warn('Braço mecânico à frente — passe rolando!', 'warn');
      }
    });
  }

  private spawnRocks() {
    const chunk = this.newChunk(50);
    const safeLane = Math.floor(this.rng() * 3);
    const lanes = [0, 1, 2].filter((l) => l !== safeLane);
    this.addSign(chunk, 'QUEDA DE\nMATERIAL', -5);
    this.addBeacons(chunk, -8);
    const spots = [
      { lane: lanes[0], z: -20 },
      { lane: lanes[1], z: -30 },
    ];
    const states = spots.map((s) => {
      const shadow = this.place(chunk, 'fx:shadow', LANE_X[s.lane], s.z);
      shadow.visible = false;
      const rockMesh = this.place(chunk, 'hz:rocha', LANE_X[s.lane], s.z);
      rockMesh.position.y = 14;
      rockMesh.visible = false;
      const ob = this.addObstacle(chunk, 'hz:rocha', 'low', s.lane, s.z, { x: 0.5, y: 0.5, z: 0.5 }, 'rocha', {
        mesh: rockMesh,
        active: false,
      });
      return { ...s, shadow, rockMesh, ob, phase: 0, t: 0 };
    });
    let warned = false;
    chunk.updaters.push((ctx, c) => {
      for (const st of states) {
        const wz = c.root.position.z + st.z;
        if (st.phase === 0 && wz > -46) {
          st.phase = 1;
          st.shadow.visible = true;
          if (!warned) {
            warned = true;
            this.cb.warn('Queda de material — observe as sombras!', 'alarm');
          }
        } else if (st.phase === 1) {
          st.t += ctx.dt;
          st.shadow.scale.setScalar(1 + Math.sin(ctx.time * 10) * 0.12);
          if (st.t > 0.55) {
            st.phase = 2;
            st.rockMesh.visible = true;
          }
        } else if (st.phase === 2) {
          st.rockMesh.position.y = Math.max(0, st.rockMesh.position.y - ctx.dt * 26);
          if (st.rockMesh.position.y <= 0.01) {
            st.phase = 3;
            st.ob.active = true;
            st.shadow.visible = false;
          }
        }
      }
    });
  }

  private spawnConveyor() {
    const chunk = this.newChunk(42);
    const lane = Math.floor(this.rng() * 3);
    const dir = this.rng() > 0.5 ? 1 : -1;
    this.addSign(chunk, 'CORREIA EM\nMOVIMENTO', -4);
    const z = -20;
    const beltGroup = this.place(chunk, 'zone:conveyor', LANE_X[lane], z);
    let belt: THREE.Mesh | null = null;
    beltGroup.traverse((o) => {
      if (o.name === 'belt' && (o as THREE.Mesh).isMesh) belt = o as THREE.Mesh;
    });
    this.addZone(chunk, 'conveyor', lane, z, 3.7, dir);
    chunk.updaters.push((ctx) => {
      if (belt) {
        const mat = belt.material as THREE.MeshBasicMaterial;
        if (mat.map) mat.map.offset.y -= ctx.dt * 1.5;
      }
    });
    // moedas na correia como recompensa por dominar o empuxo
    for (let i = 0; i < 3; i++) this.addItem(chunk, 'coin', lane, z - 2 + i * 2, 1.0);
  }

  private spawnDust() {
    const chunk = this.newChunk(56);
    this.addSign(chunk, 'POEIRA\nINTENSA', -5);
    this.addBeacons(chunk, -8);
    this.place(chunk, 'zone:dust', 0, -30);
    this.addZone(chunk, 'dust', -1, -30, 14);
    // obstáculos leves dentro da poeira (justos, com faixa livre)
    const def = OBSTACLE_DEFS.cone;
    const freeLane = Math.floor(this.rng() * 3);
    for (const l of [0, 1, 2]) {
      if (l !== freeLane) this.addObstacle(chunk, 'ob:cone', 'low', l, -32, def.half, 'cone');
    }
  }

  private spawnWetWide() {
    const chunk = this.newChunk(44);
    this.addSign(chunk, 'PISO\nMOLHADO', -5);
    const z = -22;
    for (const l of [0, 1, 2]) this.place(chunk, 'zone:wet', LANE_X[l], z);
    this.addZone(chunk, 'wet', -1, z, 3.2);
    for (let i = 0; i < 3; i++) this.addItem(chunk, 'coin', Math.floor(this.rng() * 3), z - 10 - i * 5, 1.0);
  }

  private spawnBonus() {
    const chunk = this.newChunk(44);
    const startLane = Math.floor(this.rng() * 3);
    let lane = startLane;
    for (let i = 0; i < 6; i++) {
      const z = -(i + 1) * 6;
      this.addItem(chunk, 'coin', lane, z, 1.0);
      if (this.rng() > 0.6) lane = Math.max(0, Math.min(2, lane + (this.rng() > 0.5 ? 1 : -1)));
    }
    const roll = this.rng();
    if (roll < 0.45) {
      const pu = PU_SPAWNABLE[Math.floor(this.rng() * PU_SPAWNABLE.length)];
      this.addItem(chunk, 'powerup', lane, -40, 1.1, undefined, pu);
    } else if (roll < 0.75) {
      const epi = EPI_LIST[Math.floor(this.rng() * EPI_LIST.length)];
      this.addItem(chunk, 'epi', lane, -40, 1.15, epi);
    } else {
      this.addItem(chunk, 'card', lane, -40, 1.15);
    }
  }

  // rota segura do simulado de detonação
  private spawnDetonationRoute() {
    const rows = 9;
    const chunk = this.newChunk((rows + 2) * ROW_GAP);
    let lane = 1;
    const markers: { lane: number; z: number; passed: boolean; hit: boolean }[] = [];
    for (let i = 0; i < rows; i++) {
      const z = -(i + 1) * ROW_GAP;
      if (i > 0 && this.rng() > 0.45) lane = Math.max(0, Math.min(2, lane + (this.rng() > 0.5 ? 1 : -1)));
      this.place(chunk, 'fx:arrow', LANE_X[lane], z);
      markers.push({ lane, z, passed: false, hit: false });
      // risco leve nas outras faixas (sempre transponível)
      for (const l of [0, 1, 2]) {
        if (l !== lane && this.rng() > 0.62) {
          const def = OBSTACLE_DEFS.cone;
          this.addObstacle(chunk, 'ob:cone', 'low', l, z, def.half, 'cone');
        }
      }
    }
    let done = false;
    chunk.updaters.push((ctx, c) => {
      if (done) return;
      let allPassed = true;
      for (const m of markers) {
        const wz = c.root.position.z + m.z;
        if (!m.passed && wz > 0.5) {
          m.passed = true;
          m.hit = ctx.playerLane === m.lane;
        }
        if (!m.passed) allPassed = false;
      }
      if (allPassed) {
        done = true;
        const hits = markers.filter((m) => m.hit).length;
        this.cb.onDetonationResult(hits / markers.length);
      }
    });
  }
}
