import { useEffect, useState } from 'react';
import { DEATH_TIPS } from '../data/safetyTips';
import { mapById } from '../data/maps';
import { GameEngine } from '../game/GameEngine';
import { Audio } from '../game/AudioSystem';
import { addCoins, mutateSave, saveStore } from '../game/SaveSystem';
import { uiStore, useStore } from '../state/store';
import { Btn, Icon, Modal } from './common';
import { QuizModal } from './QuizModal';

export function GameOverMenu() {
  const ui = useStore(uiStore);
  const save = useStore(saveStore);
  const run = ui.lastRun;
  const [adState, setAdState] = useState<'idle' | 'playing' | 'done'>('idle');
  const [adT, setAdT] = useState(3);
  const [quizOpen, setQuizOpen] = useState(false);

  // quiz opcional a cada 3 corridas (se mensagens educativas ativas)
  useEffect(() => {
    const s = saveStore.get();
    if (s.gameOversSinceQuiz >= 3 && s.settings.eduMessages) {
      mutateSave({ gameOversSinceQuiz: 0 });
      const t = setTimeout(() => setQuizOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  // contagem do anúncio simulado
  useEffect(() => {
    if (adState !== 'playing') return;
    if (adT <= 0) {
      if (run) {
        addCoins(run.coins);
        uiStore.set({ lastRun: { ...run, doubled: true } });
      }
      Audio.buy();
      setAdState('done');
      return;
    }
    const t = setTimeout(() => setAdT((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [adState, adT, run]);

  if (!run) return null;

  const again = () => {
    GameEngine.I?.startRun();
    uiStore.set({ screen: 'run' });
  };
  const toMenu = () => {
    GameEngine.I?.quitToMenu();
    uiStore.set({ screen: 'menu' });
  };

  return (
    <div className="screen overlay-screen gameover-screen">
      <div className="panel gameover-panel">
        <h2 className="panel-title danger-title">FIM DA CORRIDA</h2>
        <p className="gameover-map">{mapById(run.map).name}</p>

        <div className="stat-grid">
          <div className="stat big">
            <label>Distância</label>
            <b>{run.distance} m</b>
          </div>
          <div className="stat big">
            <label>Pontuação</label>
            <b>{run.score.toLocaleString('pt-BR')}</b>
          </div>
          <div className="stat">
            <label>Minérios</label>
            <b>
              <Icon name="coin" size={15} /> {run.coins}
              {run.doubled && <span className="doubled-tag">x2</span>}
            </b>
          </div>
          <div className="stat">
            <label>Índice de Segurança</label>
            <b>{run.safety}</b>
          </div>
          <div className="stat">
            <label>EPIs coletados</label>
            <b>{run.episCollected}{run.epiSet ? ' · KIT!' : ''}</b>
          </div>
          <div className="stat">
            <label>XP ganho</label>
            <b>+{run.xpGained}</b>
          </div>
        </div>

        {run.levelUps > 0 && (
          <div className="reward-line levelup">
            <Icon name="medal" size={18} /> Subiu para o nível {save.level}!
          </div>
        )}
        {run.newRecords.map((r) => (
          <div key={r} className="reward-line record">
            <Icon name="trophy" size={18} /> NOVO RECORDE: {r}
          </div>
        ))}
        {run.missionsCompleted.map((m) => (
          <div key={m} className="reward-line mission-done">
            <Icon name="check" size={18} /> Missão: {m}
          </div>
        ))}
        {run.achievementsUnlocked.map((a) => (
          <div key={a} className="reward-line achievement">
            <Icon name="star" size={18} /> Conquista: {a}
          </div>
        ))}

        <div className="death-tip">
          <Icon name="warn" size={20} />
          <p>{DEATH_TIPS[run.cause]}</p>
        </div>

        <p className="personal-best">
          Recorde pessoal: <b>{save.records.distance} m</b> · <b>{save.records.score.toLocaleString('pt-BR')} pts</b>
        </p>

        <div className="btn-col">
          <Btn variant="primary" size="lg" icon="play" full onClick={again}>
            Jogar novamente
          </Btn>
          <div className="btn-row">
            <Btn icon="mission" onClick={() => uiStore.set({ screen: 'missions', from: 'gameover' })}>
              Missões
            </Btn>
            <Btn icon="back" onClick={toMenu}>
              Menu
            </Btn>
          </div>
          {!run.doubled && adState === 'idle' && (
            <Btn variant="success" icon="gift" full onClick={() => { setAdT(3); setAdState('playing'); }}>
              Dobrar recompensa (anúncio simulado)
            </Btn>
          )}
          {adState === 'done' && (
            <div className="reward-line record">
              <Icon name="coin" size={18} /> Recompensa dobrada: +{run.coins} minérios!
            </div>
          )}
        </div>
      </div>

      {adState === 'playing' && (
        <Modal>
          <h3>Anúncio simulado</h3>
          <div className="ad-sim">
            <Icon name="gift" size={48} />
            <p>Este é um espaço reservado para anúncio recompensado.</p>
            <p className="ad-count">{adT}s</p>
          </div>
        </Modal>
      )}

      {quizOpen && <QuizModal onClose={() => setQuizOpen(false)} />}
    </div>
  );
}
