import { useEffect, useState } from 'react';
import { uiStore, useStore } from '../state/store';

export function Toast() {
  const ui = useStore(uiStore);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ui.toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, [ui.toast]);

  if (!ui.toast || !visible) return null;
  return (
    <div className="toast" key={ui.toast.id}>
      {ui.toast.text}
    </div>
  );
}
