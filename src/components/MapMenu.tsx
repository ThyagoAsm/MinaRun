import { useEffect, useState } from 'react';
import { MAPS } from '../data/maps';
import { Audio } from '../game/AudioSystem';
import { GameEngine } from '../game/GameEngine';
import { saveStore, selectMap, unlockMapByCoins } from '../game/SaveSystem';
import { showToast, uiStore, useStore } from '../state/store';
import { Btn, CoinBadge, Icon, ScreenHeader } from './common';

export function MapMenu() {
  const save = useStore(saveStore);
  const [selected, setSelected] = useState(save.map);

  useEffect(() => {
    GameEngine.I?.previewMap(selected);
  }, [selected]);

  useEffect(() => {
    return () => {
      const s = saveStore.get();
      GameEngine.I?.previewMap(s.map);
    };
  }, []);

  const back = () => uiStore.set({ screen: 'menu' });

  return (
    <div className="screen submenu-screen map-screen">
      <ScreenHeader title="Mapas" onBack={back} right={<CoinBadge value={save.coins} />} />
      <div className="map-list">
        {MAPS.map((m) => {
          const unlocked = save.unlockedMaps.includes(m.id);
          const active = save.map === m.id;
          const sel = selected === m.id;
          return (
            <div key={m.id} className={`map-card panel ${sel ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`}>
              <button
                className="map-card-main"
                onClick={() => {
                  Audio.click();
                  setSelected(m.id);
                }}
              >
                <div className="map-preview" style={{ background: `linear-gradient(160deg, ${m.theme.skyTop}, ${m.theme.skyBottom} 55%, ${m.theme.ground})` }}>
                  {!unlocked && <Icon name="lock" size={26} />}
                </div>
                <div className="map-info">
                  <h3>
                    {m.name} {m.bonusTag && <span className="bonus-tag">{m.bonusTag}</span>}
                  </h3>
                  <p>{m.desc}</p>
                  {!unlocked && (
                    <p className="unlock-req">
                      <Icon name="lock" size={13} /> Nível {m.unlockLevel} (você: {save.level}) ou{' '}
                      {m.unlockCoins.toLocaleString('pt-BR')} minérios
                    </p>
                  )}
                </div>
              </button>
              <div className="map-actions">
                {unlocked ? (
                  active ? (
                    <Btn variant="success" size="sm" icon="check" disabled>
                      Selecionado
                    </Btn>
                  ) : (
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        selectMap(m.id);
                        GameEngine.I?.previewMap(m.id);
                        showToast(`Mapa: ${m.name}`);
                      }}
                    >
                      Selecionar
                    </Btn>
                  )
                ) : (
                  <Btn
                    variant="primary"
                    size="sm"
                    icon="coin"
                    disabled={save.coins < m.unlockCoins}
                    onClick={() => {
                      if (unlockMapByCoins(m.id, m.unlockCoins)) {
                        Audio.buy();
                        showToast(`${m.name} desbloqueado!`);
                      } else {
                        Audio.error();
                      }
                    }}
                  >
                    Desbloquear · {m.unlockCoins.toLocaleString('pt-BR')}
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
