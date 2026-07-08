// ============================================================
// Entrada unificada: teclado (desktop) + swipe/toque (mobile).
// Swipe dispara no movimento (não espera soltar) — responsivo.
// ============================================================

export interface InputCallbacks {
  onLane(dir: -1 | 1): void;
  onJump(): void;
  onRoll(): void;
  onPause(): void;
  onActivate(): void;
}

export class InputSystem {
  enabled = false;
  /** sensibilidade 0.5..1.5 — maior = swipe mais curto */
  sensitivity = 1;

  private el: HTMLElement | null = null;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private tracking = false;
  private consumed = false;
  private lastTapT = 0;
  private lastTapX = 0;
  private lastTapY = 0;

  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private downHandler = (e: PointerEvent) => this.onDown(e);
  private moveHandler = (e: PointerEvent) => this.onMove(e);
  private upHandler = (e: PointerEvent) => this.onUp(e);

  constructor(private cb: InputCallbacks) {}

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.keyHandler);
    el.addEventListener('pointerdown', this.downHandler);
    el.addEventListener('pointermove', this.moveHandler);
    el.addEventListener('pointerup', this.upHandler);
    el.addEventListener('pointercancel', this.upHandler);
  }

  detach() {
    window.removeEventListener('keydown', this.keyHandler);
    if (this.el) {
      this.el.removeEventListener('pointerdown', this.downHandler);
      this.el.removeEventListener('pointermove', this.moveHandler);
      this.el.removeEventListener('pointerup', this.upHandler);
      this.el.removeEventListener('pointercancel', this.upHandler);
    }
    this.el = null;
  }

  private onKey(e: KeyboardEvent) {
    if (e.repeat) return;
    const k = e.key;
    // impede rolagem da página com as teclas do jogo
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (k === 'Escape' || k === 'p' || k === 'P') {
      this.cb.onPause();
      return;
    }
    if (!this.enabled) return;
    switch (k) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.cb.onLane(-1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.cb.onLane(1);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        this.cb.onJump();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.cb.onRoll();
        break;
      case 'Shift':
      case 'e':
      case 'E':
        this.cb.onActivate();
        break;
    }
  }

  private threshold(): number {
    return Math.max(22, 46 - 24 * (this.sensitivity - 1));
  }

  private onDown(e: PointerEvent) {
    if (!this.enabled) return;
    this.tracking = true;
    this.consumed = false;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startT = performance.now();
  }

  private onMove(e: PointerEvent) {
    if (!this.enabled || !this.tracking || this.consumed) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const thr = this.threshold();
    if (Math.abs(dx) < thr && Math.abs(dy) < thr) return;
    this.consumed = true;
    if (Math.abs(dx) > Math.abs(dy)) this.cb.onLane(dx > 0 ? 1 : -1);
    else if (dy < 0) this.cb.onJump();
    else this.cb.onRoll();
  }

  private onUp(e: PointerEvent) {
    if (!this.tracking) return;
    this.tracking = false;
    if (!this.enabled || this.consumed) return;
    const dt = performance.now() - this.startT;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const thr = this.threshold();
    if (dt < 300 && Math.abs(dx) < thr && Math.abs(dy) < thr) {
      // toque: verifica toque duplo para ativar power-up
      const now = performance.now();
      if (now - this.lastTapT < 320 && Math.abs(e.clientX - this.lastTapX) < 70 && Math.abs(e.clientY - this.lastTapY) < 70) {
        this.lastTapT = 0;
        this.cb.onActivate();
      } else {
        this.lastTapT = now;
        this.lastTapX = e.clientX;
        this.lastTapY = e.clientY;
      }
    }
  }
}
