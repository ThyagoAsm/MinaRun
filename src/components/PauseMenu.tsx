import { GameEngine } from '../game/GameEngine';
import { hudStore, uiStore, useStore } from '../state/store';
import { Btn, Icon } from './common';

export function PauseMenu() {
  const hud = useStore(hudStore);

  const resume = () => {
    uiStore.set({ screen: 'run' });
    GameEngine.I?.resumeRun();
  };
  const restart = () => {
    GameEngine.I?.startRun();
    uiStore.set({ screen: 'run' });
  };
  const quit = () => {
    GameEngine.I?.quitToMenu();
    uiStore.set({ screen: 'menu' });
  };

  return (
    <div className="screen overlay-screen">
      <div className="panel pause-panel">
        <h2 className="panel-title">
          <Icon name="pause" size={22} /> PAUSA
        </h2>
        <div className="stat-grid">
          <div className="stat">
            <label>Pontuação</label>
            <b>{hud.score.toLocaleString('pt-BR')}</b>
          </div>
          <div className="stat">
            <label>Distância</label>
            <b>{hud.distance} m</b>
          </div>
          <div className="stat">
            <label>Minérios</label>
            <b>
              <Icon name="coin" size={15} /> {hud.coins}
            </b>
          </div>
          <div className="stat">
            <label>Índice de Segurança</label>
            <b>{hud.safety}</b>
          </div>
        </div>
        <div className="btn-col">
          <Btn variant="primary" size="lg" icon="play" full onClick={resume}>
            Continuar
          </Btn>
          <Btn icon="reset" full onClick={restart}>
            Reiniciar
          </Btn>
          <Btn icon="gear" full onClick={() => uiStore.set({ screen: 'settings', from: 'pause' })}>
            Configurações
          </Btn>
          <Btn variant="ghost" icon="back" full onClick={quit}>
            Sair para o menu
          </Btn>
        </div>
      </div>
    </div>
  );
}
