// ============================================================
// Eventos aleatórios de operação: mudam o mapa por alguns
// segundos (poeira, chuva, apagão, detonação, mudança de turno).
// ============================================================

export type GameEventKind = 'poeira' | 'chuva' | 'apagao' | 'detonacao' | 'turno';

export interface GameEventDef {
  kind: GameEventKind;
  name: string;
  caption: string; // legenda curta acessível
  dur: number;
}

export const EVENT_DEFS: Record<GameEventKind, GameEventDef> = {
  poeira: { kind: 'poeira', name: 'Poeira Elevada', caption: 'Visibilidade reduzida — máscara ajuda', dur: 13 },
  chuva: { kind: 'chuva', name: 'Chuva Forte', caption: 'Pista escorregadia — botas ajudam', dur: 14 },
  apagao: { kind: 'apagao', name: 'Falha de Iluminação', caption: 'Trecho escuro — lanterna ligada', dur: 11 },
  detonacao: { kind: 'detonacao', name: 'Simulado de Detonação', caption: 'Siga a rota segura sinalizada!', dur: 12 },
  turno: { kind: 'turno', name: 'Mudança de Turno', caption: 'Mais equipamentos móveis em circulação', dur: 16 },
};

export interface EventHooks {
  onStart(def: GameEventDef): void;
  onEnd(def: GameEventDef): void;
}

export class EventSystem {
  current: GameEventDef | null = null;
  private t = 0;
  private nextAt = 0;
  private enabledKinds: GameEventKind[] = [];

  reset(mapDark: boolean, hasRain: boolean) {
    this.current = null;
    this.t = 0;
    this.nextAt = 300 + Math.random() * 120;
    this.enabledKinds = ['poeira', 'detonacao', 'turno'];
    if (hasRain) this.enabledKinds.push('chuva');
    if (!mapDark) this.enabledKinds.push('apagao');
  }

  update(dt: number, distance: number, hooks: EventHooks) {
    if (this.current) {
      this.t -= dt;
      if (this.t <= 0) {
        hooks.onEnd(this.current);
        this.current = null;
        this.nextAt = distance + 380 + Math.random() * 240;
      }
      return;
    }
    if (distance >= this.nextAt) {
      const kind = this.enabledKinds[Math.floor(Math.random() * this.enabledKinds.length)];
      const def = EVENT_DEFS[kind];
      this.current = def;
      this.t = def.dur;
      hooks.onStart(def);
    }
  }

  /** encerra o evento atual imediatamente (fim de corrida) */
  clear(hooks: EventHooks) {
    if (this.current) {
      hooks.onEnd(this.current);
      this.current = null;
    }
  }
}
