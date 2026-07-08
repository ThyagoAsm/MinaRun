import { useState } from 'react';
import { POWERUPS, upgradePrice } from '../data/powerups';
import { Audio } from '../game/AudioSystem';
import { GameEngine } from '../game/GameEngine';
import { addCoins, buyCharge, buyTrail, equipPu, equipTrail, saveStore, upgradePu } from '../game/SaveSystem';
import type { TrailId } from '../state/types';
import { showToast, uiStore, useStore } from '../state/store';
import { Btn, CoinBadge, Icon, Modal, ScreenHeader } from './common';

const TRAILS: { id: TrailId; name: string; desc: string; color: string; price: number }[] = [
  { id: 'nenhuma', name: 'Sem trilha', desc: 'Visual limpo, foco total.', color: '#5c6570', price: 0 },
  { id: 'faiscas', name: 'Faíscas de Solda', desc: 'Rastro laranja de oficina.', color: '#ffb020', price: 900 },
  { id: 'ouro', name: 'Poeira Dourada', desc: 'Brilho de minério nobre.', color: '#ffd94d', price: 1400 },
  { id: 'eco', name: 'Eco Azul', desc: 'Rastro do rádio de alerta.', color: '#4dd7f2', price: 1400 },
  { id: 'folhas', name: 'Folhas Verdes', desc: 'A natureza corre junto.', color: '#7ae87a', price: 1800 },
];

const COIN_PACKS = [
  { coins: 500, label: 'Pacote Brita' },
  { coins: 1500, label: 'Pacote Minério' },
  { coins: 4000, label: 'Pacote Filão' },
];

type Tab = 'powerups' | 'trilhas' | 'moedas';

export function StoreMenu() {
  const save = useStore(saveStore);
  const [tab, setTab] = useState<Tab>('powerups');
  const [packConfirm, setPackConfirm] = useState<number | null>(null);

  const back = () => uiStore.set({ screen: 'menu' });

  return (
    <div className="screen submenu-screen store-screen">
      <ScreenHeader title="Loja" onBack={back} right={<CoinBadge value={save.coins} />} />

      <div className="tabs">
        <button className={tab === 'powerups' ? 'active' : ''} onClick={() => { Audio.click(); setTab('powerups'); }}>
          Power-ups
        </button>
        <button className={tab === 'trilhas' ? 'active' : ''} onClick={() => { Audio.click(); setTab('trilhas'); }}>
          Trilhas
        </button>
        <button className={tab === 'moedas' ? 'active' : ''} onClick={() => { Audio.click(); setTab('moedas'); }}>
          Minérios
        </button>
      </div>

      {tab === 'powerups' && (
        <div className="store-list">
          <p className="store-hint">
            Compre <b>cargas</b> para usar na corrida (toque duplo / Shift) e <b>melhorias</b> permanentes de duração.
          </p>
          {POWERUPS.map((p) => {
            const level = save.puLevels[p.id] ?? 1;
            const charges = save.puCharges[p.id] ?? 0;
            const equipped = save.equippedPu === p.id;
            const upPrice = upgradePrice(p.id, level);
            return (
              <div key={p.id} className="store-card panel">
                <div className="store-card-head">
                  <span className="pu-icon" style={{ background: p.color }}>
                    <Icon name={p.icon} size={22} />
                  </span>
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.desc}</p>
                  </div>
                </div>
                <div className="store-card-meta">
                  <span className="level-dots" title={`Nível ${level}/${p.maxLevel}`}>
                    {Array.from({ length: p.maxLevel }).map((_, i) => (
                      <i key={i} className={i < level ? 'on' : ''} />
                    ))}
                  </span>
                  {p.chargePrice > 0 && <span className="charge-count">{charges} carga{charges === 1 ? '' : 's'}</span>}
                  {p.id === 'dds' && <span className="charge-count">ativação automática</span>}
                </div>
                <div className="btn-row">
                  {p.chargePrice > 0 && (
                    <Btn
                      size="sm"
                      icon="coin"
                      disabled={save.coins < p.chargePrice}
                      onClick={() => {
                        if (buyCharge(p.id, p.chargePrice)) {
                          Audio.buy();
                          showToast('+1 carga');
                        } else Audio.error();
                      }}
                    >
                      Carga · {p.chargePrice}
                    </Btn>
                  )}
                  <Btn
                    size="sm"
                    icon="star"
                    disabled={level >= p.maxLevel || save.coins < upPrice}
                    title={p.upgradeDesc}
                    onClick={() => {
                      if (upgradePu(p.id, upPrice, p.maxLevel)) {
                        Audio.buy();
                        showToast(`${p.short} melhorado! (nível ${level + 1})`);
                      } else Audio.error();
                    }}
                  >
                    {level >= p.maxLevel ? 'Máximo' : `Melhorar · ${upPrice}`}
                  </Btn>
                  {p.chargePrice > 0 && (
                    <Btn
                      size="sm"
                      variant={equipped ? 'success' : 'ghost'}
                      icon={equipped ? 'check' : 'person'}
                      onClick={() => {
                        equipPu(equipped ? null : p.id);
                        Audio.click();
                      }}
                    >
                      {equipped ? 'Equipado' : 'Equipar'}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'trilhas' && (
        <div className="store-list">
          <p className="store-hint">Trilhas de efeito visual atrás do personagem. Só estilo, zero vantagem.</p>
          {TRAILS.map((t) => {
            const owned = save.ownedTrails.includes(t.id);
            const equipped = save.trail === t.id;
            return (
              <div key={t.id} className="store-card panel trail-card">
                <div className="store-card-head">
                  <span className="trail-swatch" style={{ background: t.color }} />
                  <div>
                    <h3>{t.name}</h3>
                    <p>{t.desc}</p>
                  </div>
                </div>
                <div className="btn-row">
                  {!owned ? (
                    <Btn
                      size="sm"
                      icon="coin"
                      disabled={save.coins < t.price}
                      onClick={() => {
                        if (buyTrail(t.id, t.price)) {
                          Audio.buy();
                          showToast(`${t.name} comprada!`);
                        } else Audio.error();
                      }}
                    >
                      Comprar · {t.price.toLocaleString('pt-BR')}
                    </Btn>
                  ) : (
                    <Btn
                      size="sm"
                      variant={equipped ? 'success' : 'primary'}
                      icon={equipped ? 'check' : 'star'}
                      disabled={equipped}
                      onClick={() => {
                        equipTrail(t.id);
                        GameEngine.I?.refreshEquipped();
                        Audio.click();
                        showToast(`Trilha: ${t.name}`);
                      }}
                    >
                      {equipped ? 'Equipada' : 'Equipar'}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'moedas' && (
        <div className="store-list">
          <p className="store-hint">
            Estrutura pronta para monetização futura. <b>Nenhum pagamento real</b> — pacotes de demonstração.
          </p>
          {COIN_PACKS.map((p) => (
            <div key={p.coins} className="store-card panel">
              <div className="store-card-head">
                <span className="pu-icon" style={{ background: '#ffce3a' }}>
                  <Icon name="coin" size={22} />
                </span>
                <div>
                  <h3>{p.label}</h3>
                  <p>+{p.coins.toLocaleString('pt-BR')} Minérios de Ouro (simulado)</p>
                </div>
              </div>
              <div className="btn-row">
                <Btn size="sm" variant="primary" icon="gift" onClick={() => setPackConfirm(p.coins)}>
                  Resgatar demo
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {packConfirm !== null && (
        <Modal onClose={() => setPackConfirm(null)}>
          <h3>Compra simulada</h3>
          <p>
            Este pacote é uma demonstração da estrutura de loja. Nenhum valor real é cobrado. Resgatar{' '}
            <b>+{packConfirm.toLocaleString('pt-BR')}</b> minérios?
          </p>
          <div className="btn-row">
            <Btn variant="ghost" onClick={() => setPackConfirm(null)}>
              Cancelar
            </Btn>
            <Btn
              variant="primary"
              icon="check"
              onClick={() => {
                addCoins(packConfirm);
                Audio.buy();
                showToast(`+${packConfirm.toLocaleString('pt-BR')} minérios (demo)`);
                setPackConfirm(null);
              }}
            >
              Confirmar
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
