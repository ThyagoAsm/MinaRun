import { useEffect, useState } from 'react';
import { MENU_TIPS } from '../data/safetyTips';
import { GameEngine } from '../game/GameEngine';
import { mutateSave, saveStore } from '../game/SaveSystem';
import { uiStore, useStore } from '../state/store';
import { Btn, CoinBadge, LevelBadge, Logo } from './common';

export function startRun() {
  const engine = GameEngine.I;
  if (!engine) return;
  engine.startRun();
  uiStore.set({ screen: 'run' });
}

export function MainMenu() {
  const save = useStore(saveStore);
  const [tipIdx, setTipIdx] = useState(Math.floor(Math.random() * MENU_TIPS.length));

  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => i + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const play = () => {
    if (!save.seenHowTo) {
      mutateSave({ seenHowTo: true });
      uiStore.set({ screen: 'howto', from: 'play' });
    } else {
      startRun();
    }
  };

  const nav = (screen: 'missions' | 'character' | 'store' | 'maps' | 'ranking' | 'settings' | 'howto') =>
    uiStore.set({ screen, from: 'menu' });

  return (
    <div className="screen menu-screen">
      <div className="menu-top">
        <LevelBadge />
        <CoinBadge value={save.coins} />
      </div>

      <div className="menu-logo-wrap">
        <Logo />
      </div>

      <div className="menu-spacer" />

      <div className="menu-actions">
        <Btn variant="primary" size="lg" icon="play" full onClick={play}>
          JOGAR
        </Btn>
        <div className="menu-grid">
          <Btn icon="mission" onClick={() => nav('missions')}>
            Missões
          </Btn>
          <Btn icon="person" onClick={() => nav('character')}>
            Personagem
          </Btn>
          <Btn icon="store" onClick={() => nav('store')}>
            Loja
          </Btn>
          <Btn icon="map" onClick={() => nav('maps')}>
            Mapas
          </Btn>
          <Btn icon="trophy" onClick={() => nav('ranking')}>
            Ranking
          </Btn>
          <Btn icon="help" onClick={() => nav('howto')}>
            Como jogar
          </Btn>
        </div>
        <Btn variant="ghost" icon="gear" full onClick={() => nav('settings')}>
          Configurações
        </Btn>
      </div>

      <p className="menu-tip">“{MENU_TIPS[tipIdx % MENU_TIPS.length]}”</p>
    </div>
  );
}
