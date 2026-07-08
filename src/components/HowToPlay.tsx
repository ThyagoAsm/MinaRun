import { uiStore, useStore } from '../state/store';
import { startRun } from './MainMenu';
import { Btn, Icon, ScreenHeader } from './common';

const ROWS = [
  { icon: 'swipe', title: 'Deslize para os lados', desc: 'Troca de faixa (← → ou A/D no teclado).' },
  { icon: 'up', title: 'Deslize para cima', desc: 'Pula obstáculos baixos (↑ / Espaço).' },
  { icon: 'down', title: 'Deslize para baixo', desc: 'Rola por baixo de tubulações e portões (↓ / S).' },
  { icon: 'tap', title: 'Toque duplo', desc: 'Ativa o power-up equipado (Shift / E).' },
  { icon: 'helmet', title: 'Colete EPIs', desc: 'O kit completo (8 itens) dá bônus gigante. 4 seguidos ativam o DDS x2.' },
  { icon: 'barrier', title: 'Evite áreas isoladas', desc: 'Fita amarela e vazamentos sinalizados: respeite e desvie.' },
  { icon: 'shield', title: 'Índice de Segurança', desc: 'Jogue seguro para subir o índice — ele multiplica seu XP.' },
  { icon: 'warn', title: 'Fique atento aos avisos', desc: 'Luzes piscando, placas e alarmes avisam o risco antes dele chegar.' },
];

export function HowToPlay() {
  const ui = useStore(uiStore);
  const fromPlay = ui.from === 'play';

  return (
    <div className="screen submenu-screen">
      <ScreenHeader title="Como jogar" onBack={() => uiStore.set({ screen: 'menu' })} />
      <div className="howto-list">
        {ROWS.map((r) => (
          <div key={r.title} className="howto-row panel">
            <span className="howto-icon">
              <Icon name={r.icon} size={26} />
            </span>
            <div>
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="howto-footer">
        {fromPlay ? (
          <Btn variant="primary" size="lg" icon="play" full onClick={startRun}>
            COMEÇAR A CORRIDA!
          </Btn>
        ) : (
          <Btn variant="primary" size="lg" icon="back" full onClick={() => uiStore.set({ screen: 'menu' })}>
            Entendi!
          </Btn>
        )}
      </div>
    </div>
  );
}
