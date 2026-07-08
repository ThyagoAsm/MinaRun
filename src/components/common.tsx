import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Audio } from '../game/AudioSystem';
import { useStore } from '../state/store';
import { saveStore, xpForNext } from '../game/SaveSystem';

// ============================================================
// Componentes visuais compartilhados: botões (com som), ícones
// SVG originais, logo, badges e barras.
// ============================================================

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  full?: boolean;
};

export function Btn({ variant = 'secondary', size = 'md', icon, full, children, onClick, className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`btn btn-${variant} btn-${size} ${full ? 'btn-full' : ''} ${className ?? ''}`}
      onClick={(e) => {
        Audio.unlock();
        Audio.click();
        onClick?.(e);
      }}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 24 : 18} />}
      <span>{children}</span>
    </button>
  );
}

// ---------------- ícones (SVG originais, geométricos) ----------------

const ICON_PATHS: Record<string, ReactNode> = {
  play: <path d="M7 4l13 8-13 8z" fill="currentColor" />,
  pause: (
    <g fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </g>
  ),
  back: <path d="M15 4l-8 8 8 8" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
  check: <path d="M4 12.5l5.5 5.5L20 7" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  lock: (
    <g fill="currentColor">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2.4" fill="none" />
    </g>
  ),
  coin: (
    <g>
      <path d="M12 3l6 3.5v7L12 21l-6-7.5v-7z" fill="#ffce3a" stroke="#a8761a" strokeWidth="1.4" />
      <path d="M12 7l3 2v3.5L12 16l-3-3.5V9z" fill="#fff0a8" />
    </g>
  ),
  helmet: (
    <g fill="currentColor">
      <path d="M4 14a8 8 0 0116 0v1H4z" />
      <rect x="2.5" y="15" width="19" height="2.6" rx="1.3" />
      <rect x="10.5" y="4" width="3" height="4" rx="1" />
    </g>
  ),
  shield: <path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5z" fill="currentColor" />,
  radio: (
    <g fill="currentColor">
      <rect x="7" y="7" width="10" height="14" rx="2" />
      <rect x="9.4" y="10" width="5.2" height="3" rx="0.6" fill="#20242b" />
      <rect x="15" y="2" width="2" height="6" rx="1" />
    </g>
  ),
  boots: <path d="M6 3h6v9l6 3v5H6z" fill="currentColor" />,
  mask: (
    <g fill="currentColor">
      <path d="M4 10a8 8 0 0116 0v4a8 8 0 01-16 0z" />
      <circle cx="12" cy="14" r="2.6" fill="#20242b" />
    </g>
  ),
  eye: (
    <g>
      <path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z" fill="currentColor" />
      <circle cx="12" cy="12" r="3" fill="#20242b" />
    </g>
  ),
  path: <path d="M6 21c0-4 12-5 12-9 0-3-4-3-6-3" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeDasharray="1 4.5" />,
  star: <path d="M12 2l2.7 6.3 6.8.6-5.2 4.5 1.6 6.6L12 16.4 6.1 20l1.6-6.6L2.5 8.9l6.8-.6z" fill="currentColor" />,
  drone: (
    <g fill="currentColor">
      <rect x="9" y="10" width="6" height="4" rx="1.4" />
      <path d="M4 6h6M14 6h6M4 6v2M20 6v2M7 6v4M17 6v4" stroke="currentColor" strokeWidth="1.8" />
    </g>
  ),
  mission: (
    <g fill="currentColor">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="#20242b" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  ),
  person: (
    <g fill="currentColor">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21a8 8 0 0116 0z" />
    </g>
  ),
  store: (
    <g fill="currentColor">
      <path d="M4 4h3l2.4 11h9.8L21 8H8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="19.5" r="1.8" />
      <circle cx="17.5" cy="19.5" r="1.8" />
    </g>
  ),
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zm6-2v14m6-12v14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  trophy: (
    <g fill="currentColor">
      <path d="M7 3h10v6a5 5 0 01-10 0z" />
      <path d="M7 5H3.5v1A4.5 4.5 0 008 10.5M17 5h3.5v1A4.5 4.5 0 0116 10.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="10.4" y="13" width="3.2" height="4" />
      <rect x="7.5" y="17" width="9" height="3.4" rx="1" />
    </g>
  ),
  gear: (
    <g fill="currentColor">
      <circle cx="12" cy="12" r="3.2" fill="#20242b" />
      <path d="M12 2.8l1.6 2.7 3.1-.5 1 3 3 1-.6 3.1 2.2 2.3-2.2 2.3.6 3.1-3 1-1 3-3.1-.5L12 21.2l-1.6-2.7-3.1.5-1-3-3-1 .6-3.1L1.7 9.6l2.2-2.3-.6-3.1 3-1 1-3 3.1.5z" />
      <circle cx="12" cy="12" r="3.2" fill="#20242b" />
    </g>
  ),
  help: (
    <g fill="currentColor">
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M9 9.5A3 3 0 0115 10c0 2-3 2.2-3 4.2" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="17.6" r="1.4" />
    </g>
  ),
  warn: (
    <g fill="currentColor">
      <path d="M12 3l10 18H2z" />
      <rect x="11" y="9.4" width="2" height="5.4" fill="#20242b" rx="1" />
      <circle cx="12" cy="17.6" r="1.2" fill="#20242b" />
    </g>
  ),
  leaf: <path d="M20 4C9 4 4 10 4 16c0 2 1 4 1 4s1-3 4-4c-1 2-1 4-1 4s6 1 9-4 3-12 3-12z" fill="currentColor" />,
  flag: <path d="M6 21V3m0 1h11l-2.5 3.5L17 11H6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  road: (
    <g fill="currentColor">
      <path d="M8 3L4 21h16L16 3z" opacity="0.85" />
      <rect x="11.2" y="5" width="1.6" height="3" fill="#20242b" />
      <rect x="11.2" y="11" width="1.6" height="3" fill="#20242b" />
      <rect x="11.2" y="17" width="1.6" height="3" fill="#20242b" />
    </g>
  ),
  truck: (
    <g fill="currentColor">
      <rect x="2" y="8" width="12" height="7" rx="1" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="7" cy="17.4" r="2.2" />
      <circle cx="17" cy="17.4" r="2.2" />
    </g>
  ),
  fire: <path d="M12 2s5 4.5 5 9a5 5 0 01-10 0c0-2 1-3.5 2-5 .3 1.5 1 2.5 2 3 0-2.5.4-5 1-7z" fill="currentColor" />,
  barrier: (
    <g fill="currentColor">
      <rect x="3" y="8" width="18" height="5" rx="1" />
      <path d="M5 8l4 5M11 8l4 5M17 8l4 5" stroke="#20242b" strokeWidth="2" />
      <rect x="5" y="13" width="2.4" height="8" />
      <rect x="16.6" y="13" width="2.4" height="8" />
    </g>
  ),
  shirt: <path d="M8 3l4 2 4-2 5 4-2.5 3L17 9v12H7V9l-1.5 1L3 7z" fill="currentColor" />,
  medal: (
    <g fill="currentColor">
      <circle cx="12" cy="15" r="6" />
      <path d="M8 3h3l1 4 1-4h3l-3 7h-2z" />
      <circle cx="12" cy="15" r="2.6" fill="#20242b" />
    </g>
  ),
  reset: <path d="M4 8a9 9 0 111 8M4 8V3m0 5h5" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  swipe: <path d="M4 12h13m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  up: <path d="M12 20V5m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  down: <path d="M12 4v15m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  tap: (
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 8V4" />
      <circle cx="12" cy="13" r="3.4" />
      <circle cx="12" cy="13" r="7" opacity="0.4" />
    </g>
  ),
  card: (
    <g fill="currentColor">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <rect x="4" y="5" width="16" height="4" rx="2" fill="#2e8b57" />
      <path d="M12 11v4" stroke="#20242b" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="#20242b" />
    </g>
  ),
  gift: (
    <g fill="currentColor">
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <rect x="3" y="6.5" width="18" height="4" rx="1" />
      <rect x="11" y="6.5" width="2" height="13.5" fill="#20242b" />
      <path d="M12 6.5C9 6.5 7 3 9.5 2.5S12 6.5 12 6.5zm0 0c3 0 5-3.5 2.5-4S12 6.5 12 6.5z" />
    </g>
  ),
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`icon ${className ?? ''}`} aria-hidden="true">
      {ICON_PATHS[name] ?? <circle cx="12" cy="12" r="8" fill="currentColor" />}
    </svg>
  );
}

// ---------------- logo ----------------

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'logo-small' : ''}`}>
      <svg viewBox="0 0 96 60" width={small ? 72 : 120} height={small ? 45 : 75} aria-hidden="true">
        <path d="M18 40a30 30 0 0160 0v4H18z" fill="#f2b705" stroke="#20242b" strokeWidth="3" />
        <rect x="8" y="42" width="80" height="9" rx="4.5" fill="#f2b705" stroke="#20242b" strokeWidth="3" />
        <rect x="42" y="8" width="12" height="14" rx="4" fill="#f2b705" stroke="#20242b" strokeWidth="3" />
        <circle cx="48" cy="34" r="5" fill="#fff6cc" />
      </svg>
      <div className="logo-text">
        <span className="logo-mina">MINA SEGURA</span>
        <span className="logo-run">RUN</span>
      </div>
      {!small && <div className="logo-sub">Corra, desvie, colete EPIs e mantenha a operação segura.</div>}
    </div>
  );
}

// ---------------- badges e barras ----------------

export function CoinBadge({ value, pulseKey }: { value: number; pulseKey?: number }) {
  return (
    <div className="coin-badge" key={pulseKey}>
      <Icon name="coin" size={20} />
      <span>{value.toLocaleString('pt-BR')}</span>
    </div>
  );
}

export function LevelBadge() {
  const save = useStore(saveStore);
  const need = xpForNext(save.level);
  const pct = Math.min(100, Math.round((save.xp / need) * 100));
  return (
    <div className="level-badge" title={`XP ${save.xp}/${need}`}>
      <div className="level-num">{save.level}</div>
      <div className="level-info">
        <span>Nível {save.level}</span>
        <div className="level-bar">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="screen-header">
      <Btn variant="ghost" size="md" icon="back" onClick={onBack} aria-label="Voltar">
        Voltar
      </Btn>
      <h2>{title}</h2>
      <div className="header-right">{right}</div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
