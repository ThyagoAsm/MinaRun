import { useEffect, useState } from 'react';
import { RARITY_COLOR, RARITY_LABEL, SKINS } from '../data/characters';
import { Audio } from '../game/AudioSystem';
import { GameEngine } from '../game/GameEngine';
import { buySkin, equipSkin, saveStore } from '../game/SaveSystem';
import { showToast, uiStore, useStore } from '../state/store';
import { Btn, CoinBadge, Icon, ScreenHeader } from './common';

export function CharacterMenu() {
  const save = useStore(saveStore);
  const [selected, setSelected] = useState(save.skin);

  // pré-visualiza a skin selecionada no diorama 3D do fundo
  useEffect(() => {
    GameEngine.I?.previewSkin(selected);
  }, [selected]);

  // ao sair, restaura a skin equipada
  useEffect(() => {
    return () => {
      GameEngine.I?.refreshEquipped();
    };
  }, []);

  const def = SKINS.find((s) => s.id === selected)!;
  const owned = save.ownedSkins.includes(selected);
  const equipped = save.skin === selected;

  const back = () => uiStore.set({ screen: uiStore.get().from === 'pause' ? 'pause' : 'menu' });

  const buy = () => {
    if (buySkin(def.id, def.price)) {
      Audio.buy();
      showToast(`${def.name} agora faz parte da equipe!`);
    } else {
      Audio.error();
      showToast('Minérios insuficientes.');
    }
  };

  const equip = () => {
    equipSkin(def.id);
    Audio.buy();
    showToast(`${def.name} equipado.`);
  };

  return (
    <div className="screen submenu-screen character-screen">
      <ScreenHeader title="Personagem" onBack={back} right={<CoinBadge value={save.coins} />} />

      <div className="character-detail panel">
        <div className="char-title">
          <h3>{def.name}</h3>
          <span className="rarity-tag" style={{ background: RARITY_COLOR[def.rarity] }}>
            {RARITY_LABEL[def.rarity]}
          </span>
        </div>
        <p className="char-desc">{def.desc}</p>
        <p className="char-bonus">
          <Icon name="star" size={15} /> {def.bonus}
        </p>
        <p className="char-hint">O personagem gira no cenário atrás deste painel.</p>
        {!owned ? (
          <Btn variant="primary" icon="coin" full onClick={buy} disabled={save.coins < def.price}>
            Comprar · {def.price.toLocaleString('pt-BR')}
          </Btn>
        ) : equipped ? (
          <Btn variant="success" icon="check" full disabled>
            Equipado
          </Btn>
        ) : (
          <Btn variant="primary" icon="person" full onClick={equip}>
            Equipar
          </Btn>
        )}
      </div>

      <div className="skin-row">
        {SKINS.map((s) => {
          const has = save.ownedSkins.includes(s.id);
          return (
            <button
              key={s.id}
              className={`skin-card ${selected === s.id ? 'selected' : ''} ${!has ? 'locked' : ''}`}
              style={{ borderColor: selected === s.id ? RARITY_COLOR[s.rarity] : undefined }}
              onClick={() => {
                Audio.click();
                setSelected(s.id);
              }}
            >
              <div className="skin-swatch">
                <span style={{ background: s.colors.helmet }} />
                <span style={{ background: s.colors.suit }} />
                <span style={{ background: s.colors.vest }} />
              </div>
              <span className="skin-name">{s.name}</span>
              {!has && (
                <span className="skin-price">
                  <Icon name="coin" size={12} /> {s.price.toLocaleString('pt-BR')}
                </span>
              )}
              {save.skin === s.id && <Icon name="check" size={14} className="skin-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
