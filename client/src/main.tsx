import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';

if (import.meta.env.DEV) {
  import('js-error-overlay').then(({ install }) => install());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
