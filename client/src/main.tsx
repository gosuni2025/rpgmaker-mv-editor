import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './i18n';
import App from './App';
import LandingPage from './pages/LandingPage';
import FogOfWarTestPage from './pages/FogOfWarTestPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/editor" element={<App />} />
        <Route path="/fogofwar" element={<FogOfWarTestPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
