import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// StrictMode desativado de propósito: o engine 3D tem efeitos
// colaterais (WebGL/áudio) que não devem ser montados em dobro.
createRoot(document.getElementById('root')!).render(<App />);

// PWA: service worker apenas em produção
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => {
      console.warn('[MinaSegura] service worker não registrado:', e);
    });
  });
}
