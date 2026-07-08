import * as THREE from 'three';
import { MAPS, mapById } from '../data/maps';
import { ACHIEVEMENTS } from '../data/achievements';
import { EDU_CARDS } from '../data/safetyTips';
import type { BannerKind, CrashCause, MapId, PowerUpId, RunResult, SkinId } from '../state/types';
import { hudStore, initialHud, uiStore } from '../state/store';
import {
  addCoins,
  addXp,
  consumeCharge,
  mutateSave,
  persistNow,
  saveStore,
  unlockMapByLevel,
} from './SaveSystem';
import { Audio } from './AudioSystem';
import { applyPalette } from './TextureFactory';
import { Pools } from './ObstacleManager';
import { ProceduralMap, type RunItem, type RunZone } from './ProceduralMap';
import { PlayerController } from './PlayerController';
import { EnvironmentSystem } from './EnvironmentSystem';
import { ParticleSystem } from './ParticleSystem';
import { CollisionSystem } from './CollisionSystem';
import { PowerUpSystem } from './PowerUpSystem';
import { MissionSystem } from './MissionSystem';
import { ScoreSystem } from './ScoreSystem';
import { EventSystem, type GameEventDef } from './EventSystem';
import { InputSystem } from './InputSystem';

// ============================================================
// GameEngine: ciclo de vida, loop, câmera, qualidade e a
// orquestração de todos os sistemas do jogo.
// ============================================================

type Mode = 'menu' | 'run' | 'crash';
type QualityLevel = 'low' | 'medium' | 'high';

const TRAIL_COLORS: Record<string, string | null> = {
  nenhuma: null,
  faiscas: '#ffb020',
  ouro: '#ffd94d',
  eco: '#4dd7f2',
  folhas: '#7ae87a',
};

export class GameEngine {
  static I: GameEngine | null = null;

  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, 1, 0.1, 400);

  private pools = new Pools();
  private env!: EnvironmentSystem;
  private fx!: ParticleSystem;
  private map!: ProceduralMap;
  player!: PlayerController;
  private collision = new CollisionSystem();
  private powerups!: PowerUpSystem;
  private missions = new MissionSystem();
  private score = new ScoreSystem();
  private events = new EventSystem();
  private input: InputSystem;

  mode: Mode = 'menu';
  private paused = false;
  private phase: 'countdown' | 'live' = 'countdown';
  private countdownT = 0;
  private lastBeep = -1;
  private time = 0;
  private speed = 0;
  private crashT = 0;
  private crashCause: CrashCause = 'generico';
  private finalized = false;
  private recordCelebrated = false;
  private shakeT = 0;
  private menuOrbit = 0;

  // estados de efeito
  private wetCount = 0;
  private dustCount = 0;
  private conveyorZones = new Set<RunZone>();
  private rainOn = false;
  private darknessTarget = 0;
  private darkness = 0;
  private eventFogBoost = 1;
  private zoneFogBoost = 1;
  private cardCoinBonus = 15;
  private brigadista = false;

  // HUD / avisos
  private hudTimer = 0;
  private bannerQueue: { text: string; kind: BannerKind }[] = [];
  private bannerT = 0;
  private bannerId = 0;
  private lastWarn = '';
  private lastWarnT = 0;
  private pulse = 0;

  // qualidade
  quality: QualityLevel = 'medium';
  private fpsAcc = 0;
  private fpsN = 0;
  private fpsCheckT = 0;

  private lastFrame = 0;
  private running = false;

  onRunEnd: ((r: RunResult) => void) | null = null;
  onPauseRequest: (() => void) | null = null;

  constructor() {
    GameEngine.I = this;
    this.input = new InputSystem({
      onLane: (d) => {
        if (this.isLive() && this.player.moveLane(d)) Audio.whoosh();
      },
      onJump: () => {
        if (this.isLive() && this.player.jump()) Audio.jump();
      },
      onRoll: () => {
        if (this.isLive() && this.player.roll()) Audio.roll();
      },
      onPause: () => {
        if (this.mode === 'run' && !this.paused) this.onPauseRequest?.();
      },
      onActivate: () => this.activateEquipped(),
    });
  }

  private isLive(): boolean {
    return this.mode === 'run' && this.phase === 'live' && !this.paused;
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  async boot(canvas: HTMLCanvasElement, onProgress: (p: number, label: string) => void): Promise<void> {
    const step = async (p: number, label: string) => {
      onProgress(p, label);
      await new Promise((r) => setTimeout(r, 30));
    };

    await step(0.08, 'Ligando os motores');
    this.quality = this.resolveQuality();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    await step(0.28, 'Pintando o pátio de minério');
    this.env = new EnvironmentSystem(this.scene);
    this.fx = new ParticleSystem(this.scene, 1);
    this.powerups = new PowerUpSystem(this.scene);
    this.map = new ProceduralMap(this.pools, {
      warn: (text, sound) => this.warn(text, sound),
      onDetonationResult: (ratio) => this.onDetonationResult(ratio),
      onDodge: () => {},
    });
    this.scene.add(this.map.group);

    await step(0.5, 'Contratando a equipe');
    this.player = new PlayerController(this.scene);
    const save = saveStore.get();
    this.player.setSkin(save.skin, true);
    this.env.applyTheme(mapById(save.map));

    await step(0.68, 'Aquecendo os equipamentos');
    // pré-aquece pools para evitar engasgos na primeira corrida
    const warm = ['ob:cone', 'ob:tambor', 'ob:bloco', 'ob:isolamento', 'item:coin', 'item:epi:capacete', 'fx:beacon'];
    const tmp: [string, THREE.Object3D][] = [];
    for (const k of warm) tmp.push([k, this.pools.acquire(k)]);
    for (const [k, o] of tmp) this.pools.release(k, o);

    await step(0.84, 'Conferindo o checklist de segurança');
    this.applyQuality(this.quality);
    this.applySettings();
    this.input.attach(canvas);

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    const unlockAudio = () => {
      Audio.unlock();
      Audio.applyVolumes();
      if (this.mode === 'menu') Audio.setMusic('menu');
    };
    window.addEventListener('pointerdown', unlockAudio, { once: false });
    window.addEventListener('keydown', unlockAudio, { once: false });

    this.onResize();
    this.setMenuMode();
    await step(1, 'Tudo pronto. Boa corrida!');
    this.startLoop();

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__msr = {
        engine: this,
        forceCrash: () => this.handleCrash('generico'),
        addDistance: (m: number) => {
          this.score.distance += m;
        },
      };
    }
  }

  private startLoop() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private stopLoop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private onVisibility = () => {
    if (document.hidden) {
      if (this.mode === 'run' && !this.paused && this.phase === 'live') this.onPauseRequest?.();
      this.stopLoop();
      Audio.suspend();
    } else {
      this.startLoop();
      if (!this.paused) Audio.resume();
    }
  };

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const pr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.5 : 2);
    this.renderer.setPixelRatio(pr);
    this.camera.aspect = w / h;
    // GDD: FOV entre ~55 e 70 graus, ajustável por proporção de tela
    this.camera.fov = this.camera.aspect < 0.75 ? 72 : this.camera.aspect < 1.1 ? 66 : 60;
    this.camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------
  // Qualidade
  // ------------------------------------------------------------
  private resolveQuality(): QualityLevel {
    const pref = saveStore.get().settings.quality;
    if (pref !== 'auto') return pref;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const mem = nav.deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (mem <= 2 || cores <= 3) return 'low';
    if (!coarse && mem >= 8) return 'high';
    return 'medium';
  }

  applyQuality(q: QualityLevel) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== 'low';
    const density = q === 'low' ? 0.55 : q === 'medium' ? 0.8 : 1;
    this.env.setQuality(density, q !== 'low', q === 'high' ? 2048 : 1024);
    this.fx.setQuality(q === 'low' ? 0.5 : q === 'medium' ? 0.8 : 1);
    this.onResize();
  }

  /** reaplica configurações do save (som, paleta, sensibilidade, qualidade) */
  applySettings() {
    const s = saveStore.get().settings;
    Audio.applyVolumes();
    applyPalette(s.colorblind);
    this.input.sensitivity = s.swipeSensitivity;
    const q = this.resolveQuality();
    if (q !== this.quality) this.applyQuality(q);
  }

  refreshEquipped() {
    const save = saveStore.get();
    this.player.setSkin(save.skin, true);
    if (this.mode === 'menu') this.player.anim = 'idle';
    this.fx.setTrailColor(TRAIL_COLORS[save.trail] ?? null);
    this.syncLamp();
  }

  private syncLamp() {
    const dark = mapById(saveStore.get().map).theme.dark || this.darknessTarget > 0.4;
    this.player.setLampIntensity(dark && this.mode !== 'menu' ? 65 : 0);
  }

  // ------------------------------------------------------------
  // Modos
  // ------------------------------------------------------------
  setMenuMode() {
    this.mode = 'menu';
    this.paused = false;
    this.speed = 0;
    this.player.reset();
    this.player.anim = 'idle';
    this.player.root.rotation.y = Math.PI; // de frente para a câmera no menu
    this.player.setShield(false);
    this.map.group.visible = false;
    this.events.clear(this.eventHooks);
    this.endAllEffects();
    this.fx.clearBursts();
    this.powerups.reset(1);
    Audio.setMusic('menu');
    this.setAmbientByMap(saveStore.get().map);
    hudStore.set({ ...initialHud });
    this.syncLamp();
  }

  previewSkin(id: SkinId) {
    this.player.setSkin(id, true);
    this.player.anim = 'idle';
  }

  previewMap(id: MapId) {
    this.env.applyTheme(mapById(id));
    this.setAmbientByMap(id);
  }

  private setAmbientByMap(id: MapId) {
    const kind = id === 'tunel' ? 'tunel' : id === 'ambiental' ? 'verde' : id === 'correia' || id === 'oficina' ? 'industrial' : 'aberto';
    Audio.setAmbient(kind);
  }

  startRun() {
    const save = saveStore.get();
    const mapDef = mapById(save.map);

    this.mode = 'run';
    this.paused = false;
    this.phase = 'countdown';
    this.countdownT = 3.0;
    this.lastBeep = -1;
    this.speed = 0;
    this.crashT = 0;
    this.shakeT = 0;
    this.finalized = false;
    this.recordCelebrated = false;

    this.env.applyTheme(mapDef);
    this.map.reset(mapDef);
    this.map.group.visible = true;
    this.player.reset();
    this.player.anim = 'run';
    this.player.setShield(false);
    this.collision.reset();
    this.fx.clearBursts();
    this.fx.setTrailColor(TRAIL_COLORS[save.trail] ?? null);

    // bônus de skin e mapa
    let startSafety = 50;
    let durMult = 1;
    this.cardCoinBonus = 15;
    this.brigadista = save.skin === 'brigadista';
    this.score.reset(startSafety);
    if (save.skin === 'ambiental') startSafety = 60;
    this.score.safety = startSafety;
    if (save.skin === 'tecnica') this.score.safetyGainMult = 1.1;
    if (save.skin === 'geologa') this.score.coinMult = 1.1;
    if (save.skin === 'mecanico') durMult = 1.15;
    if (save.skin === 'fiscal') this.cardCoinBonus = 30;
    if (mapDef.id === 'ambiental') {
      this.score.coinMult *= 1.25;
      this.score.safetyGainMult *= 1.15;
    }
    this.powerups.reset(durMult);
    this.missions.startRun();
    this.missions.onComplete = (info) => {
      this.banner(`Missão concluída: +${info.coins} minérios!`, 'success');
      Audio.achievement();
    };
    this.events.reset(!!mapDef.theme.dark, ['patio', 'acesso', 'ambiental', 'correia'].includes(mapDef.id));
    this.endAllEffects();
    this.wetCount = 0;
    this.dustCount = 0;
    this.conveyorZones.clear();
    this.input.enabled = true;

    Audio.setMusic('run');
    this.setAmbientByMap(mapDef.id);
    this.syncLamp();
    this.pulse = 0;
    hudStore.set({
      ...initialHud,
      phase: 'countdown',
      countdown: 3,
      safety: this.score.safety,
      equippedPu: save.equippedPu,
      charges: save.equippedPu ? save.puCharges[save.equippedPu] ?? 0 : 0,
    });
  }

  pauseRun() {
    if (this.mode !== 'run' || this.paused) return;
    this.paused = true;
    this.input.enabled = false;
    Audio.suspend();
  }

  resumeRun() {
    if (this.mode !== 'run' || !this.paused) return;
    this.paused = false;
    this.phase = 'countdown';
    this.countdownT = 3.0;
    this.lastBeep = -1;
    this.input.enabled = true;
    Audio.resume();
    hudStore.set({ phase: 'countdown', countdown: 3 });
  }

  quitToMenu() {
    this.input.enabled = false;
    this.setMenuMode();
  }

  // ------------------------------------------------------------
  // Loop principal
  // ------------------------------------------------------------
  private frame() {
    const now = performance.now();
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.1) dt = 0.1; // clamp: evita saltos após stalls

    // monitor de FPS (ajuste automático de qualidade)
    this.fpsAcc += dt;
    this.fpsN++;
    this.fpsCheckT += dt;
    if (this.fpsCheckT > 4.5 && this.mode === 'run' && !this.paused) {
      const avg = this.fpsAcc / Math.max(1, this.fpsN);
      this.fpsCheckT = 0;
      this.fpsAcc = 0;
      this.fpsN = 0;
      if (avg > 0.03 && this.quality !== 'low' && saveStore.get().settings.quality === 'auto') {
        this.applyQuality(this.quality === 'high' ? 'medium' : 'low');
        this.banner('Qualidade ajustada para manter o desempenho', 'info');
      }
    }

    if (!this.paused) {
      this.time += dt;
      this.update(dt);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number) {
    const reducedFx = saveStore.get().settings.reducedFx;

    // escurecimento suave (apagão / túnel)
    if (Math.abs(this.darkness - this.darknessTarget) > 0.01) {
      this.darkness += (this.darknessTarget - this.darkness) * Math.min(1, dt * 2.2);
      this.env.setDarkness(this.darkness);
    }

    if (this.mode === 'menu') {
      this.menuOrbit += dt;
      this.player.update(dt, 0);
      this.env.update(dt, 1.6, this.time);
      this.fx.update(dt, 1.6, this.player.x, this.player.y, true, reducedFx || true, this.time);
      return;
    }

    if (this.mode === 'crash') {
      // depois de consolidar o resultado, congela a cena (tela de game over por cima)
      if (this.finalized) return;
      const slowDt = dt * 0.3;
      this.crashT += dt;
      this.player.update(slowDt, this.speed);
      this.map.update({
        dt: slowDt,
        time: this.time,
        speed: this.speed * 0.3,
        distance: this.score.distance,
        playerLane: this.player.lane,
        reducedFx,
      });
      this.env.update(slowDt, this.speed * 0.3, this.time);
      this.fx.update(dt, this.speed * 0.3, this.player.x, this.player.y, this.player.grounded, reducedFx, this.time);
      if (this.crashT > 1.05) {
        this.finalized = true;
        this.finalizeRun();
      }
      return;
    }

    // -------- modo corrida --------
    if (this.phase === 'countdown') {
      this.countdownT -= dt;
      const n = Math.ceil(this.countdownT);
      if (n !== this.lastBeep && n >= 0) {
        this.lastBeep = n;
        Audio.countdown(n <= 0);
        hudStore.set({ phase: 'countdown', countdown: Math.max(0, n) });
      }
      this.player.update(dt, 6);
      this.env.update(dt, 0, this.time);
      if (this.countdownT <= 0) {
        this.phase = 'live';
        hudStore.set({ phase: 'live', countdown: 0 });
      }
      return;
    }

    const save = saveStore.get();
    const mapDef = mapById(save.map);

    // velocidade progressiva com teto por mapa
    const base = Math.min(11 + this.score.distance * 0.011, mapDef.speedCap);
    this.speed = base * this.powerups.speedMult;
    Audio.setMusicIntensity((base - 11) / 16);

    // efeitos de zona ativos
    const boots = this.powerups.has('botas');
    const mask = this.powerups.has('mascara');
    const wet = (this.wetCount > 0 || this.rainOn) && !boots;
    this.player.laneSpeedMult = wet ? 2.0 : 1;
    const dustActive = this.dustCount > 0 && !mask;
    const targetZoneFog = dustActive ? 0.42 : 1;
    this.zoneFogBoost += (targetZoneFog - this.zoneFogBoost) * Math.min(1, dt * 3);
    this.env.setFogBoost(Math.min(this.zoneFogBoost, this.eventFogBoost));

    // empuxo da correia
    if (this.conveyorZones.size > 0 && !boots && this.player.grounded) {
      let dir = 0;
      for (const z of this.conveyorZones) dir += z.meta ?? 0;
      if (dir !== 0) this.player.applyDrift(Math.sign(dir) * 1.7 * dt);
    } else {
      this.player.recenter(dt);
    }

    this.score.tick(dt, this.speed);
    this.missions.emitAbsolute('distance_run', Math.floor(this.score.distance));
    this.missions.emitAbsolute('clean_run', Math.floor(this.score.cleanStreak));

    // comemoração ao vivo ao bater o recorde de distância (GDD)
    const bestDist = save.records.distance;
    if (!this.recordCelebrated && bestDist > 150 && this.score.distance > bestDist) {
      this.recordCelebrated = true;
      this.player.celebrate();
      this.banner('NOVO RECORDE DE DISTÂNCIA!', 'record');
      Audio.record();
      this.fx.burstCollect(this.player.x, 1.6, 0, '#ffd94d');
      this.vibrate([30, 30, 60]);
    }

    this.player.update(dt, this.speed);
    this.map.update({
      dt,
      time: this.time,
      speed: this.speed,
      distance: this.score.distance,
      playerLane: this.player.lane,
      reducedFx,
    });
    this.env.update(dt, this.speed, this.time);
    this.fx.update(dt, this.speed, this.player.x, this.player.y, this.player.grounded, reducedFx, this.time);

    this.powerups.update(dt, this.map, this.player.lane, this.player.x, this.time, (id, followRatio) => {
      if (id === 'dds') this.score.scoreMult = 1;
      if (id === 'caminho') {
        if (followRatio >= 0.65) {
          this.score.onSafePathComplete();
          this.missions.emit('safe_path');
          this.banner('Caminho seguro concluído! +Índice', 'success');
        }
      }
    });

    this.events.update(dt, this.score.distance, this.eventHooks);

    // colisões e coletas
    this.collision.update(dt, this.map, this.player, this.powerups.has('drone'), {
      onCrash: (cause) => this.handleCrash(cause),
      onPickup: (item) => this.handlePickup(item),
      onZoneEnter: (zone) => this.handleZoneEnter(zone),
      onZoneExit: (zone) => this.handleZoneExit(zone),
      onZoneAvoided: (zone) => {
        if (zone.kind === 'spill') {
          this.score.onSpillAvoided();
          this.missions.emit('risk_avoided');
        }
      },
      onNearMiss: () => {
        this.score.onNearMiss();
        this.player.scare(); // expressão de susto (GDD)
        Audio.nearMiss();
      },
      onDodgeMoving: () => {
        this.score.onDodge();
        this.missions.emit('dodge_moving');
      },
      onIsolationRespected: () => {
        this.score.onIsolationRespected();
        this.missions.emit('risk_avoided');
      },
    });

    // DDS automático: 4 EPIs seguidos
    if (this.score.epiStreak >= 4 && !this.powerups.has('dds')) {
      this.score.epiStreak = 0;
      const level = saveStore.get().puLevels.dds ?? 1;
      this.powerups.activate('dds', level);
      this.score.scoreMult = 2;
      this.score.powerupsUsed++;
      this.missions.emit('powerup_used');
      this.banner('Treinamento DDS ativo: pontos x2!', 'success');
      Audio.powerup();
    }

    // HUD
    this.hudTimer += dt;
    if (this.hudTimer > 0.12) {
      this.hudTimer = 0;
      this.pushHud();
    }
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.bannerT <= 0 && this.bannerQueue.length > 0) {
      const b = this.bannerQueue.shift()!;
      this.bannerT = 1.75;
      hudStore.set({ banner: { id: ++this.bannerId, text: b.text, kind: b.kind } });
    }
  }

  private pushHud() {
    const save = saveStore.get();
    const eff = this.powerups.hudEffect();
    hudStore.set({
      phase: this.phase,
      score: Math.floor(this.score.score),
      distance: Math.floor(this.score.distance),
      coins: this.score.coins,
      safety: Math.round(this.score.safety),
      pu: eff ? { id: eff.id, t: eff.t, dur: eff.dur } : this.powerups.shieldCharged ? { id: 'escudo', t: 1, dur: 1 } : null,
      equippedPu: save.equippedPu,
      charges: save.equippedPu ? save.puCharges[save.equippedPu] ?? 0 : 0,
      mission: this.missions.hudMission(),
      pulse: this.pulse,
    });
  }

  // ------------------------------------------------------------
  // Câmera
  // ------------------------------------------------------------
  private camPos = new THREE.Vector3(0, 3.4, 8);
  private camLook = new THREE.Vector3(0, 1, -8);

  private updateCamera(dt: number) {
    const tgt = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (this.mode === 'menu') {
      const a = this.menuOrbit * 0.22;
      tgt.set(Math.sin(a) * 3.6, 1.7 + Math.sin(this.menuOrbit * 0.5) * 0.15, Math.cos(a) * 3.6 + 0.6);
      look.set(0, 1.0, 0);
    } else {
      const px = this.player.x;
      tgt.set(px * 0.42, 4.25 + this.player.y * 0.25, 7.1);
      look.set(px * 0.72, 1.35 + this.player.y * 0.3, -9);
    }
    const k = Math.min(1, dt * (this.mode === 'menu' ? 2.2 : 7.5));
    this.camPos.lerp(tgt, k);
    this.camLook.lerp(look, k);
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0 && saveStore.get().settings.cameraShake && !saveStore.get().settings.reducedFx) {
      this.shakeT -= dt;
      const amp = this.shakeT * 0.5;
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp;
    }
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  // ------------------------------------------------------------
  // Eventos de gameplay
  // ------------------------------------------------------------
  private handlePickup(item: RunItem) {
    const s = saveStore.get().settings;
    if (item.kind === 'coin') {
      this.score.addCoin(1);
      this.missions.emit('coin');
      Audio.coin();
      this.fx.burstCollect(this.player.x, 1.2, 0);
      this.vibrate(10);
    } else if (item.kind === 'epi' && item.epi) {
      const done = this.score.addEpi(item.epi);
      this.missions.emit('epi_any');
      if (item.epi === 'capacete') this.missions.emit('epi_capacete');
      if (done) this.missions.emit('epi_set');
      Audio.epi();
      this.fx.burstCollect(this.player.x, 1.4, 0, '#b7f34d');
      this.vibrate(20);
      if (done) this.banner('KIT EPI COMPLETO! +500 pontos', 'success');
    } else if (item.kind === 'card') {
      this.score.addCard(this.cardCoinBonus);
      this.missions.emit('card');
      Audio.card();
      if (s.eduMessages) {
        const msg = EDU_CARDS[Math.floor(Math.random() * EDU_CARDS.length)];
        this.banner(`“${msg}”`, 'edu');
      }
      this.vibrate(15);
    } else if (item.kind === 'powerup' && item.pu) {
      this.activatePu(item.pu);
    }
    this.pulse++;
    this.pushHud();
  }

  private activatePu(id: PowerUpId) {
    const level = saveStore.get().puLevels[id] ?? 1;
    this.powerups.activate(id, level);
    if (id === 'escudo') this.player.setShield(true);
    if (id === 'dds') this.score.scoreMult = 2;
    this.score.powerupsUsed++;
    this.missions.emit('powerup_used');
    Audio.powerup();
    const names: Record<PowerUpId, string> = {
      escudo: 'Escudo EPI ativo!',
      radio: 'Rádio de Alerta: faixa segura sinalizada',
      botas: 'Botas Antiderrapantes ativas',
      mascara: 'Máscara contra Poeira ativa',
      inspecao: 'Modo Inspeção: precisão máxima',
      caminho: 'Caminho Seguro: siga a trilha!',
      dds: 'Treinamento DDS: pontos x2!',
      drone: 'Drone de Inspeção a postos',
    };
    this.banner(names[id], 'info');
    this.vibrate(25);
  }

  /** ativa o power-up equipado gastando 1 carga (toque duplo / Shift / botão) */
  activateEquipped() {
    if (!this.isLive()) return;
    const save = saveStore.get();
    const id = save.equippedPu;
    if (!id) return;
    if (id === 'escudo' && this.powerups.shieldCharged) return;
    if (id !== 'escudo' && this.powerups.has(id)) return;
    if (!consumeCharge(id)) {
      Audio.error();
      this.banner('Sem cargas — compre na loja', 'danger');
      return;
    }
    this.activatePu(id);
    this.pushHud();
  }

  private handleZoneEnter(zone: RunZone) {
    if (zone.kind === 'wet') {
      this.wetCount++;
      if (!this.powerups.has('botas')) {
        this.fx.burstSplash(this.player.x, 0);
        this.warn('Área molhada — controle reduzido!', 'warn');
      }
    } else if (zone.kind === 'dust') {
      this.dustCount++;
      if (!this.powerups.has('mascara')) this.warn('Poeira intensa — visibilidade baixa!', 'warn');
    } else if (zone.kind === 'spill') {
      this.score.onSpillEntered();
      Audio.alarm();
      this.banner('Você invadiu uma área de risco! -Índice', 'danger');
      this.vibrate(40);
    } else if (zone.kind === 'conveyor') {
      this.conveyorZones.add(zone);
      if (!this.powerups.has('botas')) this.warn('Correia em movimento — segure firme!', 'warn');
    }
  }

  private handleZoneExit(zone: RunZone) {
    if (zone.kind === 'wet') this.wetCount = Math.max(0, this.wetCount - 1);
    else if (zone.kind === 'dust') this.dustCount = Math.max(0, this.dustCount - 1);
    else if (zone.kind === 'conveyor') this.conveyorZones.delete(zone);
  }

  private handleCrash(cause: CrashCause) {
    if (this.mode !== 'run' || this.phase !== 'live') return;
    if (this.powerups.consumeShield()) {
      this.player.setShield(false);
      this.collision.invulnT = 1.6;
      this.score.onCrash(true, this.brigadista);
      Audio.shieldHit();
      this.fx.burstCrash(this.player.x, 0.6, 0);
      this.banner('O Escudo EPI absorveu o impacto!', 'info');
      this.vibrate(60);
      this.pushHud();
      return;
    }
    this.mode = 'crash';
    this.crashT = 0;
    this.crashCause = cause;
    this.score.onCrash(false, this.brigadista);
    this.player.crash();
    this.input.enabled = false;
    this.shakeT = 0.6;
    Audio.crash();
    Audio.setMusic(null);
    this.fx.burstCrash(this.player.x, 0.7, 0);
    this.vibrate([60, 40, 120]);
    hudStore.set({ phase: 'crash' });
  }

  private onDetonationResult(ratio: number) {
    const coins = this.score.onDetonationRoute(ratio);
    if (ratio >= 0.7) {
      this.missions.emit('detonation_route');
      this.banner(`Rota segura concluída! +${coins} minérios`, 'success');
    } else {
      this.banner('Siga as setas na próxima detonação!', 'info');
    }
  }

  // ------------------------------------------------------------
  // Eventos aleatórios
  // ------------------------------------------------------------
  private eventHooks = {
    onStart: (def: GameEventDef) => {
      this.banner(`${def.name} — ${def.caption}`, 'event');
      Audio.alarm();
      this.vibrate(30);
      switch (def.kind) {
        case 'poeira':
          this.eventFogBoost = 0.45;
          this.env.setFogBoost(this.eventFogBoost);
          this.dustCount++;
          break;
        case 'chuva':
          this.rainOn = true;
          this.fx.setRain(true);
          this.darknessTarget = 0.2;
          break;
        case 'apagao':
          this.darknessTarget = 0.85;
          this.player.setLampIntensity(65);
          break;
        case 'detonacao':
          this.map.queueDetonationRoute();
          break;
        case 'turno':
          this.map.setEventMovingBoost(2.4);
          break;
      }
    },
    onEnd: (def: GameEventDef) => {
      switch (def.kind) {
        case 'poeira':
          this.eventFogBoost = 1;
          this.dustCount = Math.max(0, this.dustCount - 1);
          break;
        case 'chuva':
          this.rainOn = false;
          this.fx.setRain(false);
          this.darknessTarget = 0;
          break;
        case 'apagao':
          this.darknessTarget = 0;
          this.syncLamp();
          break;
        case 'turno':
          this.map.setEventMovingBoost(1);
          break;
        case 'detonacao':
          break;
      }
    },
  };

  private endAllEffects() {
    this.eventFogBoost = 1;
    this.zoneFogBoost = 1;
    this.env.setFogBoost(1);
    this.rainOn = false;
    this.fx.setRain(false);
    this.darknessTarget = 0;
    this.darkness = 0;
    this.env.setDarkness(0);
    this.map.setEventMovingBoost(1);
  }

  // ------------------------------------------------------------
  // Fim de corrida
  // ------------------------------------------------------------
  private finalizeRun() {
    const save = saveStore.get();
    const sc = this.score;
    const mapDef = mapById(save.map);

    const missionsInfo = this.missions.takeCompletedThisRun();
    const missionXp = missionsInfo.reduce((s, m) => s + m.xp, 0);
    let xp = sc.distance * 0.35 + sc.coins * 0.6 + missionXp;
    xp *= 0.6 + (sc.safety / 100) * 0.8;
    if (save.skin === 'supervisor') xp *= 1.1;
    xp = Math.round(xp);

    addCoins(sc.coins);
    const levelUps = addXp(xp);

    // recordes
    const newRecords: string[] = [];
    const rec = { ...saveStore.get().records };
    const dist = Math.floor(sc.distance);
    if (dist > rec.distance) {
      rec.distance = dist;
      newRecords.push('Melhor distância');
    }
    if (Math.floor(sc.score) > rec.score) {
      rec.score = Math.floor(sc.score);
      newRecords.push('Maior pontuação');
    }
    if (Math.round(sc.safety) > rec.safety) {
      rec.safety = Math.round(sc.safety);
      newRecords.push('Maior Índice de Segurança');
    }
    if (sc.coins > rec.coins) {
      rec.coins = sc.coins;
      newRecords.push('Mais minérios em uma corrida');
    }
    if (Math.floor(sc.bestCleanStreak) > rec.cleanStreak) {
      rec.cleanStreak = Math.floor(sc.bestCleanStreak);
      newRecords.push('Maior sequência sem colisão');
    }

    // ranking local (top 8 por pontuação)
    const ranking = [...saveStore.get().ranking];
    ranking.push({
      date: new Date().toISOString(),
      map: mapDef.id,
      distance: dist,
      score: Math.floor(sc.score),
      coins: sc.coins,
      safety: Math.round(sc.safety),
    });
    ranking.sort((a, b) => b.score - a.score);
    ranking.length = Math.min(ranking.length, 8);

    // analytics local simples (GDD): últimos 10 fins de corrida
    const analytics = [...saveStore.get().analytics];
    analytics.unshift({ map: mapDef.id, distance: dist, cause: this.crashCause, date: new Date().toISOString() });
    analytics.length = Math.min(analytics.length, 10);

    const st = saveStore.get().stats;
    mutateSave({
      records: rec,
      ranking,
      analytics,
      gameOversSinceQuiz: saveStore.get().gameOversSinceQuiz + 1,
      stats: {
        ...st,
        runs: st.runs + 1,
        totalDistance: st.totalDistance + dist,
        epis: st.epis + sc.epiCount,
        cards: st.cards + sc.cardsCollected,
        dodges: st.dodges + sc.dodges,
        risksAvoided: st.risksAvoided + sc.risksAvoided,
        isolationsRespected: st.isolationsRespected + sc.isolationsRespected,
        safePathUses: st.safePathUses + sc.safePathUses,
        powerupsUsed: st.powerupsUsed + sc.powerupsUsed,
      },
    });

    // desbloqueio de mapas por nível
    const level = saveStore.get().level;
    for (const m of MAPS) {
      if (level >= m.unlockLevel) unlockMapByLevel(m.id);
    }

    const result: RunResult = {
      map: mapDef.id,
      distance: dist,
      score: Math.floor(sc.score),
      coins: sc.coins,
      safety: Math.round(sc.safety),
      cleanStreak: Math.floor(sc.bestCleanStreak),
      epiSet: sc.epiSetDone,
      episCollected: sc.epiCount,
      dodges: sc.dodges,
      cause: this.crashCause,
      missionsCompleted: missionsInfo.map((m) => m.text),
      achievementsUnlocked: [],
      xpGained: xp,
      levelUps,
      newRecords,
      doubled: false,
    };

    // conquistas
    const owned = new Set(saveStore.get().achievements);
    const unlocked: string[] = [];
    for (const a of ACHIEVEMENTS) {
      if (owned.has(a.id)) continue;
      try {
        if (a.check(saveStore.get(), result)) {
          unlocked.push(a.name);
          mutateSave((s) => ({
            achievements: [...s.achievements, a.id],
            coins: s.coins + a.reward,
            totalCoins: s.totalCoins + a.reward,
          }));
        }
      } catch {
        /* checagem defensiva */
      }
    }
    result.achievementsUnlocked = unlocked;
    if (unlocked.length > 0) Audio.achievement();
    if (newRecords.length > 0) Audio.record();

    this.events.clear(this.eventHooks);
    this.endAllEffects();
    persistNow();
    uiStore.set({ lastRun: result });
    this.onRunEnd?.(result);
  }

  // ------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------
  private warn(text: string, sound: 'alarm' | 'warn' | null) {
    const now = this.time;
    if (text === this.lastWarn && now - this.lastWarnT < 4) return;
    this.lastWarn = text;
    this.lastWarnT = now;
    this.banner(text, 'danger');
    if (sound === 'alarm') Audio.alarm();
    else if (sound === 'warn') Audio.warn();
  }

  banner(text: string, kind: BannerKind) {
    if (this.bannerQueue.length > 3) this.bannerQueue.shift();
    this.bannerQueue.push({ text, kind });
  }

  private vibrate(pattern: number | number[]) {
    if (!saveStore.get().settings.vibration) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* sem suporte */
    }
  }
}
