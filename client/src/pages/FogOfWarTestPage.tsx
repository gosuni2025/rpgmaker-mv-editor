<<<<<<< HEAD
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FogOfWarTestPage.css';

declare const THREE: any;
declare const FogOfWar: any;

const MAP_W = 20;
const MAP_H = 15;
const TILE_SIZE = 48;

type TestMode = 'live' | 'grow' | 'fade';

export default function FogOfWarTestPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const playerRef = useRef({ x: 10, y: 7 });
  const lastTimeRef = useRef(0);
  const testModeRef = useRef<TestMode>('live');

  // 파라미터
  const [radius, setRadius] = useState(5);
  const [dissolveStrength, setDissolveStrength] = useState(2.0);
  const [fadeSmoothness, setFadeSmoothness] = useState(0.3);
  const [tentacleSharpness, setTentacleSharpness] = useState(3.0);
  const [fadeDuration, setFadeDuration] = useState(1.0);
  const [growDuration, setGrowDuration] = useState(0.5);
  const [exploredAlpha, setExploredAlpha] = useState(0.6);
  const [unexploredAlpha, setUnexploredAlpha] = useState(1.0);
  const [playerPos, setPlayerPos] = useState({ x: 10, y: 7 });
  const [testMode, setTestMode] = useState<TestMode>('live');
  const [timeSlider, setTimeSlider] = useState(0); // 0~1, 테스트 모드용

  // 스냅샷 저장용 ref (생성/삭제 모드 진입 시 캡처)
  const snapshotRef = useRef<{
    exploredData: Uint8Array;
    visibilityData: Float32Array;
    displayVis: Float32Array;
    displayExpl: Float32Array;
    borderState: Uint8Array;
  } | null>(null);

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
    FogOfWar._tentacleFadeDuration = fadeDuration;
    FogOfWar._tentacleGrowDuration = growDuration;

    // 초기 visibility
    FogOfWar.updateVisibility(playerRef.current.x, playerRef.current.y);

    // 초기 상태를 즉시 완료 상태로 설정 (타이머가 흘러가지 않도록)
    const size = MAP_W * MAP_H;
    for (let i = 0; i < size; i++) {
      FogOfWar._displayVis[i] = FogOfWar._visibilityData[i];
      FogOfWar._displayExpl[i] = FogOfWar._exploredData[i];
      FogOfWar._tentacleFade[i] = 0;  // 삭제 완료
      FogOfWar._growFade[i] = 1;      // 생성 완료
      FogOfWar._borderState[i] = 0;
    }
    // 경계 상태를 현재 상태로 반영
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const idx = y * MAP_W + x;
        if (FogOfWar._exploredData[idx] > 0) continue;
        let isBorder = false;
        if (x > 0 && FogOfWar._exploredData[idx - 1] > 0) isBorder = true;
        else if (x < MAP_W - 1 && FogOfWar._exploredData[idx + 1] > 0) isBorder = true;
        else if (y > 0 && FogOfWar._exploredData[idx - MAP_W] > 0) isBorder = true;
        else if (y < MAP_H - 1 && FogOfWar._exploredData[idx + MAP_W] > 0) isBorder = true;
        if (isBorder) FogOfWar._borderState[idx] = 1;
      }
    }
    FogOfWar._updateTexture();

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

      // live 모드에서만 _lerpDisplay 실행
      if (testModeRef.current === 'live') {
        const changed = FogOfWar._lerpDisplay(dt);
        if (changed) {
          FogOfWar._updateTexture();
        }
      }

      // 시간 업데이트 (셰이더 애니메이션용)
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

  // 플레이어 이동 (live 모드에서만)
  const movePlayer = useCallback((dx: number, dy: number) => {
    if (testModeRef.current !== 'live') return;

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
      FogOfWar._tentacleFadeDuration = fadeDuration;
      FogOfWar._tentacleGrowDuration = growDuration;
    }
  }, [fadeDuration, growDuration]);

  useEffect(() => {
    if (FogOfWar._active && testModeRef.current === 'live') {
      FogOfWar._radius = radius;
      FogOfWar._prevPlayerX = -1;
      FogOfWar._prevPlayerY = -1;
      FogOfWar.updateVisibility(playerRef.current.x, playerRef.current.y);
    }
  }, [radius]);

  // 리셋
  const handleReset = useCallback(() => {
    if (!FogOfWar._active) return;
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

  // 현재 FOW 상태의 스냅샷을 캡처
  const captureSnapshot = useCallback(() => {
    if (!FogOfWar._active) return;
    const size = MAP_W * MAP_H;
    snapshotRef.current = {
      exploredData: new Uint8Array(FogOfWar._exploredData),
      visibilityData: new Float32Array(FogOfWar._visibilityData),
      displayVis: new Float32Array(FogOfWar._displayVis),
      displayExpl: new Float32Array(FogOfWar._displayExpl),
      borderState: new Uint8Array(FogOfWar._borderState),
    };
  }, []);

  // 경계 타일 인덱스를 구한다 (미탐험이면서 인접에 탐험이 있는 타일)
  const getBorderIndices = useCallback(() => {
    const indices: number[] = [];
    const expl = FogOfWar._exploredData;
    const w = MAP_W, h = MAP_H;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (expl[idx] > 0) continue;
        let isBorder = false;
        if (x > 0 && expl[idx - 1] > 0) isBorder = true;
        else if (x < w - 1 && expl[idx + 1] > 0) isBorder = true;
        else if (y > 0 && expl[idx - w] > 0) isBorder = true;
        else if (y < h - 1 && expl[idx + w] > 0) isBorder = true;
        else if (x > 0 && y > 0 && expl[idx - w - 1] > 0) isBorder = true;
        else if (x < w - 1 && y > 0 && expl[idx - w + 1] > 0) isBorder = true;
        else if (x > 0 && y < h - 1 && expl[idx + w - 1] > 0) isBorder = true;
        else if (x < w - 1 && y < h - 1 && expl[idx + w + 1] > 0) isBorder = true;
        if (isBorder) indices.push(idx);
      }
    }
    return indices;
  }, []);

  // 테스트 모드 전환
  const switchTestMode = useCallback((mode: TestMode) => {
    if (!FogOfWar._active) return;
    testModeRef.current = mode;
    setTestMode(mode);
    setTimeSlider(0);

    if (mode === 'live') {
      // 스냅샷 복원 + 즉시 완료 상태로
      if (snapshotRef.current) {
        const snap = snapshotRef.current;
        const size = MAP_W * MAP_H;
        FogOfWar._exploredData.set(snap.exploredData);
        FogOfWar._visibilityData.set(snap.visibilityData);
        FogOfWar._displayVis.set(snap.displayVis);
        FogOfWar._displayExpl.set(snap.displayExpl);
        FogOfWar._borderState.set(snap.borderState);
        for (let i = 0; i < size; i++) {
          FogOfWar._tentacleFade[i] = 0;
          FogOfWar._growFade[i] = 1;
        }
        FogOfWar._updateTexture();
        snapshotRef.current = null;
      }
      return;
    }

    // 스냅샷 캡처
    captureSnapshot();

    const size = MAP_W * MAP_H;

    if (mode === 'grow') {
      // 생성 테스트: 경계 타일의 growFade를 0으로 (촉수 없는 상태)
      // display 버퍼는 현재 완료 상태 유지
      for (let i = 0; i < size; i++) {
        FogOfWar._tentacleFade[i] = 0;
        FogOfWar._growFade[i] = 0; // 모든 경계 타일이 t=0 상태
        FogOfWar._borderState[i] = 0;
      }
      // 경계 상태 재계산
      const borders = getBorderIndices();
      for (const idx of borders) {
        FogOfWar._borderState[idx] = 1;
        FogOfWar._growFade[idx] = 0;
      }
      // 비경계 타일은 growFade=1 (정상)
      for (let i = 0; i < size; i++) {
        if (FogOfWar._borderState[i] === 0) {
          FogOfWar._growFade[i] = 1;
        }
      }
      FogOfWar._updateTexture();
    } else if (mode === 'fade') {
      // 삭제 테스트: 탐험된 경계 인접 타일의 tentacleFade를 1로 (촉수 완전한 상태)
      // 경계 타일의 growFade는 1 (완성 상태)
      for (let i = 0; i < size; i++) {
        FogOfWar._tentacleFade[i] = 0;
        FogOfWar._growFade[i] = 1;
        FogOfWar._borderState[i] = 0;
      }
      const borders = getBorderIndices();
      for (const idx of borders) {
        FogOfWar._borderState[idx] = 1;
      }
      // 탐험 영역 중 경계 인접 타일에 tentacleFade=1 설정
      const expl = FogOfWar._exploredData;
      const w = MAP_W, h = MAP_H;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (expl[idx] === 0) continue; // 미탐험은 건너뛰기
          // 인접에 미탐험 경계가 있는 탐험 타일 = fade 대상
          let nearBorder = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              if (FogOfWar._borderState[ny * w + nx] === 1) nearBorder = true;
            }
          }
          if (nearBorder) {
            FogOfWar._tentacleFade[idx] = 1;
          }
        }
      }
      FogOfWar._updateTexture();
    }
  }, [captureSnapshot, getBorderIndices]);

  // 시간 슬라이더 변경 시 grow/fade 값 직접 세팅
  useEffect(() => {
    if (!FogOfWar._active || testMode === 'live') return;
    const t = timeSlider; // 0~1

    const size = MAP_W * MAP_H;

    if (testMode === 'grow') {
      // t=0: growFade=0 (촉수 없음), t=1: growFade=1 (촉수 완성)
      const borders = getBorderIndices();
      for (const idx of borders) {
        FogOfWar._growFade[idx] = t;
      }
    } else if (testMode === 'fade') {
      // t=0: tentacleFade=1 (촉수 완전), t=1: tentacleFade=0 (촉수 소멸)
      for (let i = 0; i < size; i++) {
        if (FogOfWar._tentacleFade[i] > 0 || (snapshotRef.current && t < 1)) {
          // 초기에 fade=1이었던 타일만 조절
        }
      }
      // 더 간단히: 스냅샷에서 fade가 설정된 타일들을 (1-t)로 세팅
      const expl = FogOfWar._exploredData;
      const w = MAP_W, h = MAP_H;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (expl[idx] === 0) continue;
          let nearBorder = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              if (FogOfWar._borderState[ny * w + nx] === 1) nearBorder = true;
            }
          }
          FogOfWar._tentacleFade[idx] = nearBorder ? (1 - t) : 0;
        }
      }
    }

    FogOfWar._updateTexture();
  }, [timeSlider, testMode, getBorderIndices]);
=======
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFogOfWarTest } from './useFogOfWarTest';
import './FogOfWarTestPage.css';

export default function FogOfWarTestPage() {
  const navigate = useNavigate();
  const fw = useFogOfWarTest();
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

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
<<<<<<< HEAD
        <div className="fow-test-canvas" ref={canvasRef} />
=======
        <div className="fow-test-canvas" ref={fw.canvasRef} />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

        <div className="fow-test-controls">
          <div className="fow-control-group">
            <h3>테스트 모드</h3>
            <div className="fow-mode-buttons">
<<<<<<< HEAD
              <button
                className={`fow-mode-btn ${testMode === 'live' ? 'active' : ''}`}
                onClick={() => switchTestMode('live')}
              >
                실시간
              </button>
              <button
                className={`fow-mode-btn ${testMode === 'grow' ? 'active' : ''}`}
                onClick={() => switchTestMode('grow')}
              >
                생성 테스트
              </button>
              <button
                className={`fow-mode-btn ${testMode === 'fade' ? 'active' : ''}`}
                onClick={() => switchTestMode('fade')}
              >
                삭제 테스트
              </button>
            </div>
          </div>

          {testMode !== 'live' && (
            <div className="fow-control-group">
              <h3>
                {testMode === 'grow' ? '생성 진행도' : '삭제 진행도'}
              </h3>
              <label>
                t = {timeSlider.toFixed(2)}
                <input type="range" min={0} max={1} step={0.01} value={timeSlider}
                  onChange={(e) => setTimeSlider(Number(e.target.value))} />
              </label>
              <div className="fow-info">
                {testMode === 'grow'
                  ? '0 = 촉수 없음 → 1 = 촉수 완성'
                  : '0 = 촉수 있음 → 1 = 촉수 소멸'}
=======
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
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
              </div>
            </div>
          )}

<<<<<<< HEAD
          {testMode === 'live' && (
            <>
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
=======
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
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
              </div>

              <div className="fow-control-group">
                <h3>시야</h3>
                <label>
<<<<<<< HEAD
                  반경: {radius}
                  <input type="range" min={1} max={10} step={1} value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))} />
=======
                  반경: {fw.radius}
                  <input type="range" min={1} max={10} step={1} value={fw.radius}
                    onChange={(e) => fw.setRadius(Number(e.target.value))} />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
                </label>
              </div>

              <div className="fow-control-group">
                <h3>타이머 (생성/삭제)</h3>
                <label>
<<<<<<< HEAD
                  생성 시간: {growDuration.toFixed(1)}초
                  <input type="range" min={0.1} max={5} step={0.1} value={growDuration}
                    onChange={(e) => setGrowDuration(Number(e.target.value))} />
                </label>
                <label>
                  삭제 시간: {fadeDuration.toFixed(1)}초
                  <input type="range" min={0.1} max={5} step={0.1} value={fadeDuration}
                    onChange={(e) => setFadeDuration(Number(e.target.value))} />
=======
                  생성 시간: {fw.growDuration.toFixed(1)}초
                  <input type="range" min={0.1} max={5} step={0.1} value={fw.growDuration}
                    onChange={(e) => fw.setGrowDuration(Number(e.target.value))} />
                </label>
                <label>
                  삭제 시간: {fw.fadeDuration.toFixed(1)}초
                  <input type="range" min={0.1} max={5} step={0.1} value={fw.fadeDuration}
                    onChange={(e) => fw.setFadeDuration(Number(e.target.value))} />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
                </label>
              </div>
            </>
          )}

          <div className="fow-control-group">
            <h3>촉수 셰이더</h3>
            <label>
<<<<<<< HEAD
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
=======
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
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
            </label>
          </div>

          <div className="fow-control-group">
            <h3>알파</h3>
            <label>
<<<<<<< HEAD
              exploredAlpha: {exploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={exploredAlpha}
                onChange={(e) => setExploredAlpha(Number(e.target.value))} />
            </label>
            <label>
              unexploredAlpha: {unexploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={unexploredAlpha}
                onChange={(e) => setUnexploredAlpha(Number(e.target.value))} />
=======
              exploredAlpha: {fw.exploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={fw.exploredAlpha}
                onChange={(e) => fw.setExploredAlpha(Number(e.target.value))} />
            </label>
            <label>
              unexploredAlpha: {fw.unexploredAlpha.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={fw.unexploredAlpha}
                onChange={(e) => fw.setUnexploredAlpha(Number(e.target.value))} />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
