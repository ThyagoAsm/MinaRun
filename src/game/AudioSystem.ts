import { saveStore } from './SaveSystem';

// ============================================================
// Áudio 100% procedural via WebAudio — zero assets externos.
// Música, ambiente e efeitos sintetizados em tempo real.
// ============================================================

type MusicKind = 'menu' | 'run' | null;
type AmbientKind = 'aberto' | 'industrial' | 'tunel' | 'verde' | null;

class AudioSystemImpl {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private ambientBus!: GainNode;

  private music: MusicKind = null;
  private ambient: AmbientKind = null;
  private step = 0;
  private nextNote = 0;
  private schedTimer: number | undefined;
  private ambientNodes: AudioNode[] = [];
  private ambientTimer: number | undefined;
  private noiseBuf: AudioBuffer | null = null;

  get unlocked() {
    return this.ctx !== null;
  }

  /** cria o contexto no primeiro gesto do usuário (política de autoplay) */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 4000;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.musicFilter);
    this.musicFilter.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.ambientBus = ctx.createGain();
    this.ambientBus.connect(this.master);
    // buffer de ruído compartilhado (2s)
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // ruído "marrom" suave — menos agressivo que branco puro
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    this.applyVolumes();
    // reinicia música/ambiente pendentes
    const m = this.music;
    const a = this.ambient;
    this.music = null;
    this.ambient = null;
    if (m) this.setMusic(m);
    if (a) this.setAmbient(a);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = saveStore.get().settings;
    this.master.gain.value = s.master * s.master;
    this.musicBus.gain.value = s.music * s.music * 0.5;
    this.sfxBus.gain.value = s.sfx * s.sfx * 0.85;
    this.ambientBus.gain.value = s.master > 0 ? 0.5 : 0;
  }

  suspend() {
    this.ctx?.suspend().catch(() => {});
  }
  resume() {
    this.ctx?.resume().catch(() => {});
  }

  // ---------------- síntese base ----------------

  private tone(opts: {
    freq: number;
    dur: number;
    type?: OscillatorType;
    vol?: number;
    slideTo?: number;
    attack?: number;
    when?: number;
    bus?: GainNode;
  }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = (opts.when ?? ctx.currentTime) + 0.001;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + opts.dur);
    const vol = opts.vol ?? 0.2;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g);
    g.connect(opts.bus ?? this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noise(opts: { dur: number; vol?: number; freq?: number; type?: BiquadFilterType; when?: number; bus?: GainNode }) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t0 = (opts.when ?? ctx.currentTime) + 0.001;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.value = opts.freq ?? 800;
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f);
    f.connect(g);
    g.connect(opts.bus ?? this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + opts.dur + 0.05);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  // ---------------- efeitos ----------------

  click() {
    this.tone({ freq: 420, dur: 0.06, type: 'square', vol: 0.08, slideTo: 320 });
  }
  coin() {
    // pitch levemente variado para não cansar (GDD)
    const p = 0.92 + Math.random() * 0.16;
    this.tone({ freq: 900 * p, dur: 0.07, vol: 0.1 });
    this.tone({ freq: 1350 * p, dur: 0.09, vol: 0.09, when: this.now() + 0.05 });
  }
  epi() {
    const t = this.now();
    [523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.12, when: t + i * 0.06 }));
  }
  card() {
    const t = this.now();
    this.tone({ freq: 620, dur: 0.1, type: 'triangle', vol: 0.1, when: t });
    this.tone({ freq: 930, dur: 0.14, type: 'triangle', vol: 0.1, when: t + 0.08 });
  }
  powerup() {
    this.tone({ freq: 220, dur: 0.3, type: 'sawtooth', vol: 0.1, slideTo: 880 });
    this.tone({ freq: 440, dur: 0.25, type: 'triangle', vol: 0.08, slideTo: 1200, when: this.now() + 0.08 });
  }
  alarm() {
    const t = this.now();
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 740, dur: 0.14, type: 'square', vol: 0.06, when: t + i * 0.3 });
      this.tone({ freq: 520, dur: 0.14, type: 'square', vol: 0.06, when: t + i * 0.3 + 0.15 });
    }
    this.duck(1.1);
  }

  /** ducking: abaixa a música por instantes durante alertas (GDD) */
  private duck(dur: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = saveStore.get().settings;
    const base = s.music * s.music * 0.5;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(base * 0.35, ctx.currentTime + 0.08);
    g.linearRampToValueAtTime(base, ctx.currentTime + dur);
  }
  warn() {
    this.tone({ freq: 660, dur: 0.09, type: 'square', vol: 0.06 });
    this.tone({ freq: 660, dur: 0.09, type: 'square', vol: 0.06, when: this.now() + 0.14 });
  }
  crash() {
    this.noise({ dur: 0.4, vol: 0.35, freq: 500 });
    this.tone({ freq: 160, dur: 0.45, type: 'sine', vol: 0.35, slideTo: 50 });
  }
  shieldHit() {
    this.noise({ dur: 0.2, vol: 0.2, freq: 1200, type: 'bandpass' });
    this.tone({ freq: 500, dur: 0.25, type: 'triangle', vol: 0.18, slideTo: 260 });
  }
  whoosh() {
    this.noise({ dur: 0.16, vol: 0.12, freq: 1400, type: 'bandpass' });
  }
  jump() {
    this.tone({ freq: 300, dur: 0.14, type: 'sine', vol: 0.1, slideTo: 520 });
  }
  roll() {
    this.noise({ dur: 0.18, vol: 0.14, freq: 350 });
  }
  buy() {
    const t = this.now();
    this.tone({ freq: 700, dur: 0.06, vol: 0.1, when: t });
    this.tone({ freq: 1050, dur: 0.1, vol: 0.12, when: t + 0.07 });
  }
  error() {
    this.tone({ freq: 170, dur: 0.18, type: 'square', vol: 0.09 });
  }
  achievement() {
    const t = this.now();
    [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.13, when: t + i * 0.09 }));
  }
  record() {
    const t = this.now();
    [392, 523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: 'square', vol: 0.07, when: t + i * 0.1 }));
  }
  countdown(final: boolean) {
    this.tone({ freq: final ? 880 : 520, dur: final ? 0.25 : 0.1, type: 'square', vol: 0.09 });
  }
  nearMiss() {
    this.tone({ freq: 1100, dur: 0.05, vol: 0.07 });
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------------- música (sequenciador) ----------------

  private intensity = 0;

  setMusicIntensity(v: number) {
    this.intensity = Math.min(1, Math.max(0, v));
    if (!this.ctx) return;
    this.musicFilter.frequency.value = 1500 + 4500 * this.intensity;
  }

  setMusic(kind: MusicKind) {
    if (this.music === kind) return;
    this.music = kind;
    if (!this.ctx) return; // será iniciado no unlock
    if (this.schedTimer !== undefined) {
      clearInterval(this.schedTimer);
      this.schedTimer = undefined;
    }
    if (!kind) return;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.schedTimer = window.setInterval(() => this.schedule(), 90);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    const bpm = this.music === 'menu' ? 84 : 132;
    const spb = 60 / bpm / 2; // colcheias
    while (this.nextNote < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextNote);
      this.nextNote += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number) {
    if (this.music === 'menu') {
      // acordes suaves: Am — F — C — G (16 colcheias cada)
      const chords = [
        [220, 261.6, 329.6],
        [174.6, 220, 261.6],
        [261.6, 329.6, 392],
        [196, 246.9, 293.7],
      ];
      const chord = chords[Math.floor(step / 16) % 4];
      if (step % 16 === 0) {
        chord.forEach((f) => this.tone({ freq: f, dur: 1.6, type: 'triangle', vol: 0.05, attack: 0.3, when: t, bus: this.musicBus }));
        this.tone({ freq: chord[0] / 2, dur: 1.8, type: 'sine', vol: 0.08, attack: 0.2, when: t, bus: this.musicBus });
      }
      if (step % 4 === 2) {
        const f = chord[(step / 4) % chord.length | 0];
        this.tone({ freq: f * 2, dur: 0.3, type: 'sine', vol: 0.035, attack: 0.05, when: t, bus: this.musicBus });
      }
    } else if (this.music === 'run') {
      const bassLine = [110, 110, 130.8, 110, 164.8, 110, 98, 110]; // A2 A2 C3 A2 E3 A2 G2 A2
      const f = bassLine[step % 8];
      this.tone({ freq: f, dur: 0.16, type: 'sawtooth', vol: 0.07, when: t, bus: this.musicBus });
      if (step % 4 === 0) this.tone({ freq: 130, dur: 0.12, type: 'sine', vol: 0.16, slideTo: 48, when: t, bus: this.musicBus });
      if (step % 2 === 1) this.noise({ dur: 0.04, vol: 0.03, freq: 6000, type: 'highpass', when: t, bus: this.musicBus });
      if (step % 32 === 24) {
        const penta = [440, 523.3, 587.3, 659.3, 784];
        const n = penta[Math.floor(Math.random() * penta.length)];
        this.tone({ freq: n, dur: 0.25, type: 'square', vol: 0.035, when: t, bus: this.musicBus });
        this.tone({ freq: n * 1.5, dur: 0.2, type: 'square', vol: 0.025, when: t + 0.12, bus: this.musicBus });
      }
      // camada extra de percussão em alta velocidade (GDD: intensidade sem troca abrupta)
      if (this.intensity > 0.6) {
        this.noise({ dur: 0.03, vol: 0.022, freq: 8000, type: 'highpass', when: t, bus: this.musicBus });
        if (step % 8 === 6) this.tone({ freq: 196, dur: 0.1, type: 'sine', vol: 0.09, slideTo: 90, when: t, bus: this.musicBus });
      }
    }
  }

  // ---------------- ambiente ----------------

  setAmbient(kind: AmbientKind) {
    if (this.ambient === kind) return;
    this.ambient = kind;
    if (!this.ctx) return;
    this.stopAmbientNodes();
    if (!kind) return;
    const ctx = this.ctx;
    // vento contínuo
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = kind === 'tunel' ? 220 : kind === 'verde' ? 500 : 380;
    const g = ctx.createGain();
    g.gain.value = kind === 'tunel' ? 0.05 : 0.04;
    src.connect(f);
    f.connect(g);
    g.connect(this.ambientBus);
    src.start();
    this.ambientNodes.push(src, f, g);
    if (kind === 'industrial' || kind === 'tunel') {
      // zumbido elétrico/motores
      const hum = ctx.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.value = 55;
      const hg = ctx.createGain();
      hg.gain.value = 0.012;
      hum.connect(hg);
      hg.connect(this.ambientBus);
      hum.start();
      this.ambientNodes.push(hum, hg);
    }
    // eventos ambientes aleatórios (caminhão distante / pássaros)
    const tick = () => {
      if (!this.ctx || this.ambient !== kind) return;
      if (kind === 'aberto' || kind === 'industrial') {
        // ronco distante de caminhão
        this.tone({ freq: 46, dur: 1.8, type: 'sawtooth', vol: 0.05, attack: 0.6, bus: this.ambientBus });
      } else if (kind === 'verde') {
        // pássaro
        const base = 1800 + Math.random() * 800;
        this.tone({ freq: base, dur: 0.08, vol: 0.03, slideTo: base * 1.3, bus: this.ambientBus });
        this.tone({ freq: base * 1.1, dur: 0.07, vol: 0.025, when: this.now() + 0.12, bus: this.ambientBus });
      }
      this.ambientTimer = window.setTimeout(tick, 6000 + Math.random() * 9000);
    };
    this.ambientTimer = window.setTimeout(tick, 3000);
  }

  private stopAmbientNodes() {
    if (this.ambientTimer !== undefined) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = undefined;
    }
    for (const n of this.ambientNodes) {
      try {
        if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) n.stop();
        n.disconnect();
      } catch {
        /* já parado */
      }
    }
    this.ambientNodes = [];
  }
}

export const Audio = new AudioSystemImpl();
