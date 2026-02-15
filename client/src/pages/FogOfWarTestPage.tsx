import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FogOfWarTestPage.css';

declare const THREE: any;
declare const FogOfWar: any;

const MAP_W = 20;
const MAP_H = 15;
const TILE_SIZE = 48;

export default function FogOfWarTestPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const playerRef = useRef({ x: 10, y: 7 });
  const lastTimeRef = useRef(0);

  // 파라미터
  const [radius, setRadius] = useState(5);
  const [dissolveStrength, setDissolveStrength] = useState(2.0);
  const [fadeSmoothness, setFadeSmoothness] = useState(0.3);
  const [tentacleSharpness, setTentacleSharpness] = useState(3.0);
  const [tentacleFadeSpeed, setTentacleFadeSpeed] = useState(1.0);
  const [exploredAlpha, setExploredAlpha] = useState(0.6);
  const [unexploredAlpha, setUnexploredAlpha] = useState(1.0);
  const [playerPos, setPlayerPos] = useState({ x: 10, y: 7 });

  const initScene = useCallback(() => {
    if (!canvasRef.current || typeof THREE === 'undefined') return;

    const totalW = MAP_W * TILE_SIZE;
    const totalH = MAP_H * TILE_SIZE;

    // 렌더러
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(totalW, totalH);
    renderer.setClearColor(0x228833, 1);
    canvasRef.current.innerHTML = '';
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 씬
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 카메라: orthographic, 맵 전체 표시
    const camera = new THREE.OrthographicCamera(0, totalW, 0, totalH, -1000, 1000);
    camera.position.set(totalW / 2, totalH / 2, 500);
    camera.lookAt(totalW / 2, totalH / 2, 0);
    cameraRef.current = camera;

    // 바닥: 체커보드 (밝은 초록 / 어두운 초록)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = totalW;
    floorCanvas.height = totalH;
    const ctx = floorCanvas.getContext('2d')!;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#3a7a3a' : '#2d6b2d';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    // 격자
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAP_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_SIZE, 0);
      ctx.lineTo(x * TILE_SIZE, totalH);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_SIZE);
      ctx.lineTo(totalW, y * TILE_SIZE);
      ctx.stroke();
    }

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    const floorMat = new THREE.MeshBasicMaterial({ map: floorTexture });
    const floorGeo = new THREE.PlaneGeometry(totalW, totalH);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(totalW / 2, totalH / 2, 0);
    scene.add(floorMesh);

    // FogOfWar 초기화
    FogOfWar.setup(MAP_W, MAP_H, {
      radius: radius,
      lineOfSight: false,
      exploredAlpha: exploredAlpha,
      unexploredAlpha: unexploredAlpha,
      edgeAnimation: true,
      edgeAnimationSpeed: 1.0,
    });
    FogOfWar._tentacleFadeSpeed = tentacleFadeSpeed;

    // 그로우 페이드를 전부 1로 초기화 (이미 있는 타일)
    if (FogOfWar._growFade) {
      for (let i = 0; i < FogOfWar._growFade.length; i++) {
        FogOfWar._growFade[i] = 1.0;
      }
    }

    // 초기 visibility
    FogOfWar.updateVisibility(playerRef.current.x, playerRef.current.y);

    // FOW 메시 생성 - _createMesh 호출
    const fogGroup = FogOfWar._createMesh();
    if (fogGroup) {
      // 위치 설정: 맵 중앙
      fogGroup.position.set(totalW / 2, totalH / 2, 0);
      scene.add(fogGroup);

      // isOrtho = 1 (2D 모드)
      fogGroup.children.forEach((child: any) => {
        if (child.material && child.material.uniforms) {
          if (child.material.uniforms.isOrtho) {
            child.material.uniforms.isOrtho.value = 1.0;
          }
          if (child.material.uniforms.dissolveStrength) {
            child.material.uniforms.dissolveStrength.value = dissolveStrength;
          }
          if (child.material.uniforms.fadeSmoothness) {
            child.material.uniforms.fadeSmoothness.value = fadeSmoothness;
          }
          if (child.material.uniforms.tentacleSharpness) {
            child.material.uniforms.tentacleSharpness.value = tentacleSharpness;
          }
        }
      });
    }

    // 플레이어 표시
    const playerGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.6, TILE_SIZE * 0.6);
    const playerMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 });
    const playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.position.set(
      playerRef.current.x * TILE_SIZE + TILE_SIZE / 2,
      playerRef.current.y * TILE_SIZE + TILE_SIZE / 2,
      1
    );
    playerMesh.renderOrder = 10000;
    playerMesh.name = 'player';
    scene.add(playerMesh);

    // 렌더 루프
    lastTimeRef.current = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // lerp + 텍스처 업데이트
      const changed = FogOfWar._lerpDisplay(dt);
      if (changed) {
        FogOfWar._updateTexture();
      }

      // 시간 업데이트
      if (FogOfWar._fogGroup) {
        FogOfWar._time += dt;
        FogOfWar._fogGroup.children.forEach((child: any) => {
          if (child.material && child.material.uniforms && child.material.uniforms.uTime) {
            child.material.uniforms.uTime.value = FogOfWar._time;
          }
        });
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // 씬 초기화
  useEffect(() => {
    initScene();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      FogOfWar.dispose();
    };
  }, [initScene]);

  // 플레이어 이동
  const movePlayer = useCallback((dx: number, dy: number) => {
    const nx = Math.max(0, Math.min(MAP_W - 1, playerRef.current.x + dx));
    const ny = Math.max(0, Math.min(MAP_H - 1, playerRef.current.y + dy));
    if (nx === playerRef.current.x && ny === playerRef.current.y) return;

    playerRef.current = { x: nx, y: ny };
    setPlayerPos({ x: nx, y: ny });

    // 플레이어 메시 이동
    const scene = sceneRef.current;
    if (scene) {
      const pm = scene.getObjectByName('player');
      if (pm) {
        pm.position.set(nx * TILE_SIZE + TILE_SIZE / 2, ny * TILE_SIZE + TILE_SIZE / 2, 1);
      }
    }

    // FOW 갱신
    FogOfWar.updateVisibility(nx, ny);
  }, []);

  // 키보드 이동
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': movePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': movePlayer(1, 0); break;
        case 'ArrowUp': case 'w': movePlayer(0, -1); break;
        case 'ArrowDown': case 's': movePlayer(0, 1); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [movePlayer]);

  // 파라미터 변경 시 유니폼 업데이트
  useEffect(() => {
    if (!FogOfWar._fogGroup) return;
    FogOfWar._fogGroup.children.forEach((child: any) => {
      const u = child.material?.uniforms;
      if (!u) return;
      if (u.dissolveStrength) u.dissolveStrength.value = dissolveStrength;
      if (u.fadeSmoothness) u.fadeSmoothness.value = fadeSmoothness;
      if (u.tentacleSharpness) u.tentacleSharpness.value = tentacleSharpness;
      if (u.exploredAlpha) u.exploredAlpha.value = exploredAlpha;
      if (u.unexploredAlpha) u.unexploredAlpha.value = unexploredAlpha;
    });
  }, [dissolveStrength, fadeSmoothness, tentacleSharpness, exploredAlpha, unexploredAlpha]);

  useEffect(() => {
    if (FogOfWar._active) {
      FogOfWar._tentacleFadeSpeed = tentacleFadeSpeed;
    }
  }, [tentacleFadeSpeed]);

  useEffect(() => {
    if (FogOfWar._active) {
      FogOfWar._radius = radius;
      // 강제 재계산
      FogOfWar._prevPlayerX = -1;
      FogOfWar._prevPlayerY = -1;
      FogOfWar.updateVisibility(playerRef.current.x, playerRef.current.y);
    }
  }, [radius]);

  // 리셋
  const handleReset = useCallback(() => {
    if (!FogOfWar._active) return;
    // explored와 display 초기화
    const size = MAP_W * MAP_H;
    for (let i = 0; i < size; i++) {
      FogOfWar._exploredData[i] = 0;
      FogOfWar._displayExpl[i] = 0;
      FogOfWar._displayVis[i] = 0;
      FogOfWar._visibilityData[i] = 0;
      FogOfWar._tentacleFade[i] = 0;
      FogOfWar._growFade[i] = 1;
      FogOfWar._borderState[i] = 0;
    }
    FogOfWar._prevPlayerX = -1;
    FogOfWar._prevPlayerY = -1;
    FogOfWar.updateVisibility(playerRef.current.x, playerRef.current.y);
    FogOfWar._updateTexture();
  }, []);

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
        <div className="fow-test-canvas" ref={canvasRef} />

        <div className="fow-test-controls">
          <div className="fow-control-group">
            <h3>플레이어</h3>
            <div className="fow-info">위치: ({playerPos.x}, {playerPos.y})</div>
            <div className="fow-dpad">
              <button onClick={() => movePlayer(0, -1)}>▲</button>
              <div>
                <button onClick={() => movePlayer(-1, 0)}>◀</button>
                <button onClick={() => movePlayer(1, 0)}>▶</button>
              </div>
              <button onClick={() => movePlayer(0, 1)}>▼</button>
            </div>
            <button className="fow-reset-btn" onClick={handleReset}>리셋 (FOW 초기화)</button>
          </div>

          <div className="fow-control-group">
            <h3>시야</h3>
            <label>
              반경: {radius}
              <input type="range" min={1} max={10} step={1} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))} />
            </label>
          </div>

          <div className="fow-control-group">
            <h3>촉수 셰이더</h3>
            <label>
              dissolveStrength: {dissolveStrength.toFixed(1)}
              <input type="range" min={0.5} max={5} step={0.1} value={dissolveStrength}
                onChange={(e) => setDissolveStrength(Number(e.target.value))} />
            </label>
            <label>
              fadeSmoothness: {fadeSmoothness.toFixed(2)}
              <input type="range" min={0.05} max={1} step={0.05} value={fadeSmoothness}
                onChange={(e) => setFadeSmoothness(Number(e.target.value))} />
            </label>
            <label>
              tentacleSharpness: {tentacleSharpness.toFixed(1)}
              <input type="range" min={1} max={8} step={0.5} value={tentacleSharpness}
                onChange={(e) => setTentacleSharpness(Number(e.target.value))} />
            </label>
          </div>

          <div className="fow-control-group">
            <h3>페이드</h3>
            <label>
              tentacleFadeSpeed: {tentacleFadeSpeed.toFixed(1)}
              <input type="range" min={0.1} max={5} step={0.1} value={tentacleFadeSpeed}
                onChange={(e) => setTentacleFadeSpeed(Number(e.target.value))} />
            </label>
            <label>
              exploredAlpha: {exploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={exploredAlpha}
                onChange={(e) => setExploredAlpha(Number(e.target.value))} />
            </label>
            <label>
              unexploredAlpha: {unexploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={unexploredAlpha}
                onChange={(e) => setUnexploredAlpha(Number(e.target.value))} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
