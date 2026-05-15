import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error catcher for diagnostics
window.onerror = (message, source, lineno, colno, error) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; background: #fff1f2; color: #991b1b; font-family: monospace; border: 1px solid #fecaca; border-radius: 8px;">
        <h1 style="margin: 0 0 10px 0; font-size: 18px;">Runtime Error Detected</h1>
        <p style="margin: 0 0 5px 0;"><strong>Message:</strong> ${message}</p>
        <p style="margin: 0;"><strong>Source:</strong> ${source}:${lineno}:${colno}</p>
      </div>
    `;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
