import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFogOfWarTest } from './useFogOfWarTest';
import './FogOfWarTestPage.css';

export default function FogOfWarTestPage() {
  const navigate = useNavigate();
  const fw = useFogOfWarTest();

  return (
    <div className="fow-test-page">
      <div className="fow-test-header">
        <button className="fow-back-btn" onClick={() => navigate('/')}>
          &larr; 메인
        </button>
        <h2>Fog of War 테스트</h2>
        <span className="fow-test-hint">방향키/WASD로 이동 | 촉수 생성/해제를 확인하세요</span>
      </div>

      <div className="fow-test-body">
        <div className="fow-test-canvas" ref={fw.canvasRef} />

        <div className="fow-test-controls">
          <div className="fow-control-group">
            <h3>테스트 모드</h3>
            <div className="fow-mode-buttons">
              {(['live', 'grow', 'fade'] as const).map(mode => (
                <button key={mode}
                  className={`fow-mode-btn ${fw.testMode === mode ? 'active' : ''}`}
                  onClick={() => fw.switchTestMode(mode)}>
                  {mode === 'live' ? '실시간' : mode === 'grow' ? '생성 테스트' : '삭제 테스트'}
                </button>
              ))}
            </div>
          </div>

          {fw.testMode !== 'live' && (
            <div className="fow-control-group">
              <h3>{fw.testMode === 'grow' ? '생성 진행도' : '삭제 진행도'}</h3>
              <label>
                t = {fw.timeSlider.toFixed(2)}
                <input type="range" min={0} max={1} step={0.01} value={fw.timeSlider}
                  onChange={(e) => fw.setTimeSlider(Number(e.target.value))} />
              </label>
              <div className="fow-info">
                {fw.testMode === 'grow' ? '0 = 촉수 없음 → 1 = 촉수 완성' : '0 = 촉수 있음 → 1 = 촉수 소멸'}
              </div>
            </div>
          )}

          {fw.testMode === 'live' && (
            <>
              <div className="fow-control-group">
                <h3>플레이어</h3>
                <div className="fow-info">위치: ({fw.playerPos.x}, {fw.playerPos.y})</div>
                <div className="fow-dpad">
                  <button onClick={() => fw.movePlayer(0, -1)}>▲</button>
                  <div>
                    <button onClick={() => fw.movePlayer(-1, 0)}>◀</button>
                    <button onClick={() => fw.movePlayer(1, 0)}>▶</button>
                  </div>
                  <button onClick={() => fw.movePlayer(0, 1)}>▼</button>
                </div>
                <button className="fow-reset-btn" onClick={fw.handleReset}>리셋 (FOW 초기화)</button>
              </div>

              <div className="fow-control-group">
                <h3>시야</h3>
                <label>
                  반경: {fw.radius}
                  <input type="range" min={1} max={10} step={1} value={fw.radius}
                    onChange={(e) => fw.setRadius(Number(e.target.value))} />
                </label>
              </div>

              <div className="fow-control-group">
                <h3>타이머 (생성/삭제)</h3>
                <label>
                  생성 시간: {fw.growDuration.toFixed(1)}초
                  <input type="range" min={0.1} max={5} step={0.1} value={fw.growDuration}
                    onChange={(e) => fw.setGrowDuration(Number(e.target.value))} />
                </label>
                <label>
                  삭제 시간: {fw.fadeDuration.toFixed(1)}초
                  <input type="range" min={0.1} max={5} step={0.1} value={fw.fadeDuration}
                    onChange={(e) => fw.setFadeDuration(Number(e.target.value))} />
                </label>
              </div>
            </>
          )}

          <div className="fow-control-group">
            <h3>촉수 셰이더</h3>
            <label>
              dissolveStrength: {fw.dissolveStrength.toFixed(1)}
              <input type="range" min={0.5} max={5} step={0.1} value={fw.dissolveStrength}
                onChange={(e) => fw.setDissolveStrength(Number(e.target.value))} />
            </label>
            <label>
              fadeSmoothness: {fw.fadeSmoothness.toFixed(2)}
              <input type="range" min={0.05} max={1} step={0.05} value={fw.fadeSmoothness}
                onChange={(e) => fw.setFadeSmoothness(Number(e.target.value))} />
            </label>
            <label>
              tentacleSharpness: {fw.tentacleSharpness.toFixed(1)}
              <input type="range" min={1} max={8} step={0.5} value={fw.tentacleSharpness}
                onChange={(e) => fw.setTentacleSharpness(Number(e.target.value))} />
            </label>
          </div>

          <div className="fow-control-group">
            <h3>알파</h3>
            <label>
              exploredAlpha: {fw.exploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={fw.exploredAlpha}
                onChange={(e) => fw.setExploredAlpha(Number(e.target.value))} />
            </label>
            <label>
              unexploredAlpha: {fw.unexploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={fw.unexploredAlpha}
                onChange={(e) => fw.setUnexploredAlpha(Number(e.target.value))} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
