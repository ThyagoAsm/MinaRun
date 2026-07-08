import { useMemo } from 'react';
import { Audio } from '../game/AudioSystem';
import { addCoins, mutateSave, saveStore, todayStr } from '../game/SaveSystem';
import { uiStore, useStore } from '../state/store';
import { Btn, Icon, Modal } from './common';

export function DailyModal() {
  const save = useStore(saveStore);

  const { streak, reward } = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
      yesterday.getDate(),
    ).padStart(2, '0')}`;
    const streak = save.lastDaily === yStr ? save.dailyStreak + 1 : 1;
    return { streak, reward: 80 + Math.min(streak - 1, 6) * 30 };
  }, [save.lastDaily, save.dailyStreak]);

  const claim = () => {
    addCoins(reward);
    mutateSave({ lastDaily: todayStr(), dailyStreak: streak });
    Audio.buy();
    uiStore.set({ modal: 'none' });
  };

  return (
    <Modal>
      <div className="daily-modal">
        <Icon name="gift" size={44} />
        <h3>Recompensa diária</h3>
        <p>
          Dia <b>{streak}</b> de turno seguido!
        </p>
        <div className="daily-reward">
          <Icon name="coin" size={22} /> +{reward}
        </div>
        <Btn variant="primary" size="lg" icon="check" full onClick={claim}>
          Receber
        </Btn>
      </div>
    </Modal>
  );
}
