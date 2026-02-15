import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <h1>RPG Maker MV Editor</h1>
      <div className="landing-buttons">
        <button className="landing-btn" onClick={() => navigate('/editor')}>
          에디터
        </button>
        <button className="landing-btn" onClick={() => navigate('/fogofwar')}>
          Fog of War 테스트
        </button>
        <button className="landing-btn" onClick={() => navigate('/fogtest3d')}>
          FogOfWar 3D Box 테스트
        </button>
      </div>
    </div>
  );
}
