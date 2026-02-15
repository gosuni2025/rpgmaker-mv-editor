import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './i18n';
import App from './App';
import LandingPage from './pages/LandingPage';
import FogOfWarTestPage from './pages/FogOfWarTestPage';
import FogOfWar3DBoxTestPage from './pages/FogOfWar3DBoxTestPage';
import LoS3DTestPage from './pages/LoS3DTestPage';
import FogOfWar3DVolumeTestPage from './pages/FogOfWar3DVolumeTestPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/editor" element={<App />} />
        <Route path="/fogofwar" element={<FogOfWarTestPage />} />
        <Route path="/fogtest3d" element={<FogOfWar3DBoxTestPage />} />
        <Route path="/los3d" element={<LoS3DTestPage />} />
        <Route path="/fogvolume3d" element={<FogOfWar3DVolumeTestPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
