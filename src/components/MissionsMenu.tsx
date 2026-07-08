import { useState } from 'react';
import { ACHIEVEMENTS } from '../data/achievements';
import { missionTemplateById } from '../data/missions';
import { Audio } from '../game/AudioSystem';
import { saveStore } from '../game/SaveSystem';
import { uiStore, useStore } from '../state/store';
import { Icon, ScreenHeader } from './common';

export function MissionsMenu() {
  const save = useStore(saveStore);
  const ui = useStore(uiStore);
  const [tab, setTab] = useState<'missoes' | 'conquistas'>('missoes');

  const back = () => uiStore.set({ screen: ui.from === 'gameover' ? 'gameover' : 'menu' });

  return (
    <div className="screen submenu-screen">
      <ScreenHeader title="Missões" onBack={back} />

      <div className="tabs">
        <button className={tab === 'missoes' ? 'active' : ''} onClick={() => { Audio.click(); setTab('missoes'); }}>
          Missões ativas
        </button>
        <button className={tab === 'conquistas' ? 'active' : ''} onClick={() => { Audio.click(); setTab('conquistas'); }}>
          Conquistas
        </button>
      </div>

      {tab === 'missoes' && (
        <div className="store-list">
          <p className="store-hint">
            Missões concluídas: <b>{save.missions.completedCount}</b> · Complete para ganhar minérios e XP. Novas
            missões chegam automaticamente.
          </p>
          {save.missions.active.map((am) => {
            const t = missionTemplateById(am.id);
            if (!t) return null;
            const target = t.target(am.tier);
            const cur = t.perRun ? 0 : Math.min(am.progress, target);
            const pct = Math.round((cur / target) * 100);
            return (
              <div key={am.id} className="mission-card panel">
                <div className="mission-head">
                  <Icon name="mission" size={20} />
                  <h3>{t.text(target)}</h3>
                </div>
                <div className="mission-bar">
                  <div style={{ width: `${pct}%` }} />
                </div>
                <div className="mission-meta">
                  <span>
                    {t.perRun ? 'em uma corrida' : `${cur}/${target}`}
                    {am.tier > 1 ? ` · série ${am.tier}` : ''}
                  </span>
                  <span className="mission-reward">
                    <Icon name="coin" size={13} /> {t.rewardCoins(am.tier)} · +{t.rewardXp(am.tier)} XP
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'conquistas' && (
        <div className="store-list">
          <p className="store-hint">
            Desbloqueadas: <b>{save.achievements.length}</b>/{ACHIEVEMENTS.length}
          </p>
          {ACHIEVEMENTS.map((a) => {
            const done = save.achievements.includes(a.id);
            return (
              <div key={a.id} className={`achievement-card panel ${done ? 'done' : ''}`}>
                <span className={`ach-icon ${done ? 'on' : ''}`}>
                  <Icon name={a.icon} size={22} />
                </span>
                <div className="ach-info">
                  <h3>{a.name}</h3>
                  <p>{a.desc}</p>
                </div>
                <span className="ach-reward">
                  {done ? <Icon name="check" size={18} /> : <><Icon name="coin" size={13} /> {a.reward}</>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
