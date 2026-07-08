import { useEffect, useState } from 'react';
import { puById } from '../data/powerups';
import { GameEngine } from '../game/GameEngine';
import { saveStore } from '../game/SaveSystem';
import { hudStore, uiStore, useStore } from '../state/store';
import { Icon } from './common';

export function HUD() {
  const hud = useStore(hudStore);
  const [showKeys, setShowKeys] = useState(false);

  // atalhos de teclado exibidos discretamente no início (desktop)
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (fine) {
      setShowKeys(true);
      const t = setTimeout(() => setShowKeys(false), 7000);
      return () => clearTimeout(t);
    }
  }, []);

  const pause = () => {
    GameEngine.I?.pauseRun();
    uiStore.set({ screen: 'pause' });
  };

  const safetyColor = hud.safety >= 70 ? 'var(--safe)' : hud.safety >= 40 ? 'var(--warn)' : 'var(--danger)';
  const pu = hud.pu ? puById(hud.pu.id) : null;
  const equipped = hud.equippedPu ? puById(hud.equippedPu) : null;

  return (
    <div className="hud">
      {/* topo */}
      <div className="hud-top">
        <div className="hud-stats">
          <div className="hud-score">{hud.score.toLocaleString('pt-BR')}</div>
          <div className="hud-distance">{hud.distance} m</div>
          <div className="hud-coins" key={`p${hud.pulse}`}>
            <Icon name="coin" size={18} />
            <span>{hud.coins}</span>
          </div>
          <div className="hud-safety" style={{ borderColor: safetyColor, color: safetyColor }}>
            <Icon name="shield" size={16} />
            <span>{hud.safety}</span>
          </div>
        </div>
        <button className="hud-pause" onClick={pause} aria-label="Pausar">
          <Icon name="pause" size={26} />
        </button>
      </div>

      {/* banner central de avisos/eventos */}
      {hud.banner && (
        <div key={hud.banner.id} className={`hud-banner banner-${hud.banner.kind}`}>
          {hud.banner.kind === 'danger' && <Icon name="warn" size={20} />}
          {hud.banner.kind === 'edu' && <Icon name="card" size={20} />}
          {hud.banner.kind === 'success' && <Icon name="check" size={20} />}
          <span>{hud.banner.text}</span>
        </div>
      )}

      {/* missão em andamento */}
      {hud.mission && hud.phase === 'live' && (
        <div className="hud-mission">
          <Icon name="mission" size={14} />
          <span>
            {hud.mission.text} · {hud.mission.cur}/{hud.mission.target}
          </span>
        </div>
      )}

      {/* power-up ativo */}
      {pu && hud.pu && (
        <div className="hud-pu" style={{ borderColor: pu.color }}>
          <Icon name={pu.icon} size={22} />
          <div className="hud-pu-info">
            <span>{pu.short}</span>
            {hud.pu.dur > 1 && (
              <div className="hud-pu-bar">
                <div style={{ width: `${(hud.pu.t / hud.pu.dur) * 100}%`, background: pu.color }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* botão de ativar power-up equipado */}
      {equipped && (
        <button
          className={`hud-activate ${hud.charges <= 0 ? 'disabled' : ''}`}
          onClick={() => GameEngine.I?.activateEquipped()}
          aria-label={`Ativar ${equipped.name}`}
          style={{ borderColor: equipped.color }}
        >
          <Icon name={equipped.icon} size={26} />
          <span className="hud-charges">{hud.charges}</span>
        </button>
      )}

      {/* contagem regressiva */}
      {hud.phase === 'countdown' && (
        <div className="hud-countdown" key={hud.countdown}>
          {hud.countdown > 0 ? hud.countdown : 'JÁ!'}
        </div>
      )}

      {/* vinheta de colisão */}
      {hud.phase === 'crash' && <div className="hud-crash-vignette" />}

      {/* atalhos desktop */}
      {showKeys && hud.phase !== 'crash' && (
        <div className="hud-keys">
          <span><b>←→/AD</b> faixa</span>
          <span><b>↑/Espaço</b> pular</span>
          <span><b>↓/S</b> rolar</span>
          <span><b>Shift/E</b> power-up</span>
          <span><b>ESC</b> pausa</span>
        </div>
      )}
    </div>
  );
}

export function useHudSnapshotForPause() {
  return useStore(hudStore);
}

/** usado na tela de pausa para congelar os números atuais */
export function hudSnapshot() {
  const h = hudStore.get();
  const s = saveStore.get();
  return { ...h, best: s.records.distance };
}
