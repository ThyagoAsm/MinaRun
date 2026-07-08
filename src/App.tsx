import { useEffect, useRef } from 'react';
import { GameEngine } from './game/GameEngine';
import { saveStore, todayStr } from './game/SaveSystem';
import { uiStore, useStore } from './state/store';
import { LoadingScreen } from './components/LoadingScreen';
import { MainMenu } from './components/MainMenu';
import { HUD } from './components/HUD';
import { PauseMenu } from './components/PauseMenu';
import { GameOverMenu } from './components/GameOverMenu';
import { MissionsMenu } from './components/MissionsMenu';
import { CharacterMenu } from './components/CharacterMenu';
import { StoreMenu } from './components/StoreMenu';
import { MapMenu } from './components/MapMenu';
import { RankingMenu } from './components/RankingMenu';
import { SettingsMenu } from './components/SettingsMenu';
import { HowToPlay } from './components/HowToPlay';
import { DailyModal } from './components/DailyModal';
import { Toast } from './components/Toast';

let booted = false;

export default function App() {
  const ui = useStore(uiStore);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (booted || !canvasRef.current) return;
    booted = true;
    const engine = new GameEngine();
    engine.onRunEnd = () => uiStore.set({ screen: 'gameover' });
    engine.onPauseRequest = () => {
      engine.pauseRun();
      uiStore.set({ screen: 'pause' });
    };
    engine
      .boot(canvasRef.current, (p, label) => uiStore.set({ loadProgress: p, loadPhrase: label }))
      .then(() => {
        uiStore.set({ screen: 'menu' });
        if (saveStore.get().lastDaily !== todayStr()) {
          setTimeout(() => uiStore.set({ modal: 'daily' }), 500);
        }
      })
      .catch((e) => {
        console.error('[MinaSegura] falha ao iniciar:', e);
        uiStore.set({ fatalError: String(e?.message ?? e) });
      });
  }, []);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="game-canvas" />
      {ui.screen === 'loading' && <LoadingScreen />}
      {ui.screen === 'menu' && <MainMenu />}
      {(ui.screen === 'run' || ui.screen === 'pause') && <HUD />}
      {ui.screen === 'pause' && <PauseMenu />}
      {ui.screen === 'gameover' && <GameOverMenu />}
      {ui.screen === 'missions' && <MissionsMenu />}
      {ui.screen === 'character' && <CharacterMenu />}
      {ui.screen === 'store' && <StoreMenu />}
      {ui.screen === 'maps' && <MapMenu />}
      {ui.screen === 'ranking' && <RankingMenu />}
      {ui.screen === 'settings' && <SettingsMenu />}
      {ui.screen === 'howto' && <HowToPlay />}
      {ui.modal === 'daily' && ui.screen === 'menu' && <DailyModal />}
      <Toast />
    </div>
  );
}
