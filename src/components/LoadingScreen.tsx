import { useEffect, useState } from 'react';
import { LOADING_PHRASES, LOADING_TIPS } from '../data/safetyTips';
import { uiStore, useStore } from '../state/store';
import { Logo } from './common';

export function LoadingScreen() {
  const ui = useStore(uiStore);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 2200);
    return () => clearInterval(t);
  }, []);

  const phrase = LOADING_PHRASES[idx % LOADING_PHRASES.length];
  const tip = LOADING_TIPS[idx % LOADING_TIPS.length];
  const pct = Math.round(ui.loadProgress * 100);

  return (
    <div className="screen loading-screen">
      <Logo />
      <div className="loading-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="loading-fill" style={{ width: `${pct}%` }} />
        <span className="loading-pct">{pct}%</span>
      </div>
      <p className="loading-phrase">“{phrase}”</p>
      <p className="loading-tip">DICA: {tip}</p>
      {ui.loadPhrase && <p className="loading-step">{ui.loadPhrase}</p>}
      {ui.fatalError && (
        <div className="fatal-error panel">
          <h3>Não foi possível iniciar o 3D</h3>
          <p>{ui.fatalError}</p>
          <p>Verifique se o WebGL está habilitado no navegador.</p>
        </div>
      )}
    </div>
  );
}
