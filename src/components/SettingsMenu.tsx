import { useState } from 'react';
import { Audio } from '../game/AudioSystem';
import { GameEngine } from '../game/GameEngine';
import { resetProgress, saveStore, setSettings } from '../game/SaveSystem';
import type { QualityId } from '../state/types';
import { showToast, uiStore, useStore } from '../state/store';
import { Btn, Modal, ScreenHeader } from './common';

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <b className="setting-val">{Math.round(value * 100)}%</b>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <button
        role="switch"
        aria-checked={value}
        className={`toggle ${value ? 'on' : ''}`}
        onClick={() => {
          Audio.click();
          onChange(!value);
        }}
      >
        <i />
      </button>
    </label>
  );
}

export function SettingsMenu() {
  const save = useStore(saveStore);
  const ui = useStore(uiStore);
  const s = save.settings;
  const [confirmReset, setConfirmReset] = useState(false);

  const apply = (patch: Parameters<typeof setSettings>[0]) => {
    setSettings(patch);
    GameEngine.I?.applySettings();
  };

  const back = () => uiStore.set({ screen: ui.from === 'pause' ? 'pause' : 'menu' });

  return (
    <div className="screen submenu-screen">
      <ScreenHeader title="Configurações" onBack={back} />

      <div className="settings-list">
        <h3 className="section-title">Áudio</h3>
        <div className="panel settings-group">
          <Slider label="Volume geral" value={s.master} onChange={(v) => apply({ master: v })} />
          <Slider label="Música" value={s.music} onChange={(v) => apply({ music: v })} />
          <Slider label="Efeitos sonoros" value={s.sfx} onChange={(v) => apply({ sfx: v })} />
        </div>

        <h3 className="section-title">Jogabilidade</h3>
        <div className="panel settings-group">
          <Toggle label="Vibração (mobile)" value={s.vibration} onChange={(v) => apply({ vibration: v })} />
          <label className="setting-row">
            <span>Sensibilidade do swipe</span>
            <input
              type="range"
              min={50}
              max={150}
              value={Math.round(s.swipeSensitivity * 100)}
              onChange={(e) => apply({ swipeSensitivity: Number(e.target.value) / 100 })}
            />
            <b className="setting-val">
              {s.swipeSensitivity < 0.85 ? 'Longo' : s.swipeSensitivity > 1.15 ? 'Curto' : 'Médio'}
            </b>
          </label>
          <Toggle label="Mensagens educativas" value={s.eduMessages} onChange={(v) => apply({ eduMessages: v })} />
        </div>

        <h3 className="section-title">Gráficos e acessibilidade</h3>
        <div className="panel settings-group">
          <label className="setting-row">
            <span>Qualidade gráfica</span>
            <select value={s.quality} onChange={(e) => apply({ quality: e.target.value as QualityId })}>
              <option value="auto">Automática</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <Toggle label="Modo daltônico" value={s.colorblind} onChange={(v) => apply({ colorblind: v })} />
          <Toggle label="Reduzir efeitos visuais" value={s.reducedFx} onChange={(v) => apply({ reducedFx: v })} />
          <Toggle label="Tremor de câmera" value={s.cameraShake} onChange={(v) => apply({ cameraShake: v })} />
          <label className="setting-row">
            <span>Idioma</span>
            <select value={s.language} onChange={() => {}}>
              <option value="pt-BR">Português (BR)</option>
              <option value="en" disabled>
                English (em breve)
              </option>
            </select>
          </label>
        </div>

        <h3 className="section-title">Dados</h3>
        <div className="panel settings-group">
          <Btn variant="danger" icon="reset" full onClick={() => setConfirmReset(true)}>
            Resetar progresso
          </Btn>
        </div>
      </div>

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <h3>Resetar progresso?</h3>
          <p>
            Isso apaga <b>moedas, skins, mapas, recordes, missões e conquistas</b>. Não dá para desfazer.
          </p>
          <div className="btn-row">
            <Btn variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Btn>
            <Btn
              variant="danger"
              icon="reset"
              onClick={() => {
                resetProgress();
                const engine = GameEngine.I;
                engine?.applySettings();
                engine?.refreshEquipped();
                engine?.previewMap(saveStore.get().map);
                setConfirmReset(false);
                showToast('Progresso resetado. Novo turno, nova história!');
              }}
            >
              Resetar tudo
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
