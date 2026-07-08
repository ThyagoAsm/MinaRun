import { mapById } from '../data/maps';
import { saveStore } from '../game/SaveSystem';
import { uiStore, useStore } from '../state/store';
import { Icon, ScreenHeader } from './common';

export function RankingMenu() {
  const save = useStore(saveStore);
  const rec = save.records;

  return (
    <div className="screen submenu-screen">
      <ScreenHeader title="Ranking local" onBack={() => uiStore.set({ screen: 'menu' })} />

      <div className="records-grid">
        <div className="record-card panel">
          <Icon name="road" size={22} />
          <label>Melhor distância</label>
          <b>{rec.distance} m</b>
        </div>
        <div className="record-card panel">
          <Icon name="trophy" size={22} />
          <label>Maior pontuação</label>
          <b>{rec.score.toLocaleString('pt-BR')}</b>
        </div>
        <div className="record-card panel">
          <Icon name="shield" size={22} />
          <label>Maior Índice de Segurança</label>
          <b>{rec.safety}</b>
        </div>
        <div className="record-card panel">
          <Icon name="check" size={22} />
          <label>Maior sequência sem colisão</label>
          <b>{rec.cleanStreak} m</b>
        </div>
        <div className="record-card panel">
          <Icon name="coin" size={22} />
          <label>Mais minérios em uma corrida</label>
          <b>{rec.coins}</b>
        </div>
      </div>

      <h3 className="section-title">Melhores corridas</h3>
      {save.ranking.length === 0 ? (
        <p className="store-hint">Nenhuma corrida registrada ainda. Bora para a pista!</p>
      ) : (
        <div className="rank-table panel">
          <div className="rank-row rank-head">
            <span>#</span>
            <span>Mapa</span>
            <span>Dist.</span>
            <span>Pontos</span>
            <span>
              <Icon name="shield" size={13} />
            </span>
          </div>
          {save.ranking.map((r, i) => (
            <div key={r.date + i} className="rank-row">
              <span>{i + 1}</span>
              <span>{mapById(r.map).name}</span>
              <span>{r.distance} m</span>
              <span>{r.score.toLocaleString('pt-BR')}</span>
              <span>{r.safety}</span>
            </div>
          ))}
        </div>
      )}
      <p className="store-hint">Ranking online: estrutura preparada para backend futuro (ver README).</p>
    </div>
  );
}
