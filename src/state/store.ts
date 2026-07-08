import { useSyncExternalStore } from 'react';
import type { HudState, RunResult, ScreenId } from './types';

// ============================================================
// Mini store observável — evita dependência externa de estado.
// O engine escreve, o React lê via useSyncExternalStore.
// ============================================================

export interface Store<T> {
  get: () => T;
  set: (patch: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (fn: () => void) => () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      subs.forEach((f) => f());
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<T extends object>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

// ------------------------------------------------------------
// Store da interface (telas, modais, resultado da última corrida)
// ------------------------------------------------------------

export interface UiState {
  screen: ScreenId;
  /** tela a partir da qual um overlay foi aberto (para "voltar"); 'play' = como jogar antes da 1ª corrida */
  from: ScreenId | 'play' | 'pause';
  lastRun: RunResult | null;
  modal: 'none' | 'daily' | 'reset' | 'quiz' | 'ad';
  loadProgress: number;
  loadPhrase: string;
  toast: { id: number; text: string } | null;
  fatalError: string | null;
}

export const uiStore = createStore<UiState>({
  screen: 'loading',
  from: 'menu',
  lastRun: null,
  modal: 'none',
  loadProgress: 0,
  loadPhrase: '',
  toast: null,
  fatalError: null,
});

let toastId = 0;
export function showToast(text: string) {
  uiStore.set({ toast: { id: ++toastId, text } });
}

// ------------------------------------------------------------
// Store do HUD (atualizado pelo engine ~8x/s durante a corrida)
// ------------------------------------------------------------

export const initialHud: HudState = {
  phase: 'idle',
  countdown: 0,
  score: 0,
  distance: 0,
  coins: 0,
  safety: 50,
  pu: null,
  charges: 0,
  equippedPu: null,
  mission: null,
  banner: null,
  pulse: 0,
};

export const hudStore = createStore<HudState>({ ...initialHud });
