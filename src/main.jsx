import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { CurrentDraftProvider } from './context/CurrentDraftContext';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <CurrentDraftProvider>
          <App />
        </CurrentDraftProvider>
      </ToastProvider>
    </HashRouter>
  </StrictMode>
);
