import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './index.css';

/**
 * Development-only backend connection indicator.
 *
 * Lazily imported behind `import.meta.env.DEV` so the module — and the health
 * request it makes — is excluded from production bundles entirely. This is the
 * only place the app talks to the Express API unconditionally; everything else
 * still runs on the mock service layer.
 */
const BackendStatusIndicator = import.meta.env.DEV
  ? lazy(() => import('./components/ui/BackendStatusIndicator.jsx'))
  : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
          {BackendStatusIndicator ? (
            <Suspense fallback={null}>
              <BackendStatusIndicator />
            </Suspense>
          ) : null}
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
