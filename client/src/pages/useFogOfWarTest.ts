import { useState, useEffect, useCallback, useRef } from 'react';

declare const THREE: any;
declare const FogOfWar: any;

const MAP_W = 20;
const MAP_H = 15;
const TILE_SIZE = 48;

export type TestMode = 'live' | 'grow' | 'fade';

export { MAP_W, MAP_H, TILE_SIZE };

export function useFogOfWarTest() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const playerRef = useRef({ x: 10, y: 7 });
  const lastTimeRef = useRef(0);
  const testModeRef = useRef<TestMode>('live');

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
  const [timeSlider, setTimeSlider] = useState(0);

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(totalW, totalH);
    renderer.setClearColor(0x228833, 1);
    canvasRef.current.innerHTML = '';
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(0, totalW, 0, totalH, -1000, 1000);
    camera.position.set(totalW / 2, totalH / 2, 500);
    camera.lookAt(totalW / 2, totalH / 2, 0);
    cameraRef.current = camera;

    // 체커보드 바닥
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
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAP_W; x++) {
      ctx.beginPath(); ctx.moveTo(x * TILE_SIZE, 0); ctx.lineTo(x * TILE_SIZE, totalH); ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * TILE_SIZE); ctx.lineTo(totalW, y * TILE_SIZE); ctx.stroke();
    }

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(totalW, totalH),
      new THREE.MeshBasicMaterial({ map: floorTexture })
    );
    floorMesh.position.set(totalW / 2, totalH / 2, 0);
    scene.add(floorMesh);

    // FogOfWar 초기화
    FogOfWar.setup(MAP_W, MAP_H, {
      radius, lineOfSight: false, exploredAlpha, unexploredAlpha,
      edgeAnimation: true, edgeAnimationSpeed: 1.0,
    });
    FogOfWar._tentacleFadeDuration = fadeDuration;
    FogOfWar._tentacleGrowDuration = growDuration;
    FogOfWar.updateVisibility(playerRef.current.x, playerRef.current.y);

    // 초기 상태를 즉시 완료 상태로
    const size = MAP_W * MAP_H;
    for (let i = 0; i < size; i++) {
      FogOfWar._displayVis[i] = FogOfWar._visibilityData[i];
      FogOfWar._displayExpl[i] = FogOfWar._exploredData[i];
      FogOfWar._tentacleFade[i] = 0;
      FogOfWar._growFade[i] = 1;
      FogOfWar._borderState[i] = 0;
    }
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

    // FOW 메시 생성
    const fogGroup = FogOfWar._createMesh();
    if (fogGroup) {
      fogGroup.position.set(totalW / 2, totalH / 2, 0);
      scene.add(fogGroup);
      fogGroup.children.forEach((child: any) => {
        const u = child.material?.uniforms;
        if (!u) return;
        if (u.isOrtho) u.isOrtho.value = 1.0;
        if (u.dissolveStrength) u.dissolveStrength.value = dissolveStrength;
        if (u.fadeSmoothness) u.fadeSmoothness.value = fadeSmoothness;
        if (u.tentacleSharpness) u.tentacleSharpness.value = tentacleSharpness;
      });
    }

    // 플레이어 표시
    const playerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE * 0.6, TILE_SIZE * 0.6),
      new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 })
    );
    playerMesh.position.set(
      playerRef.current.x * TILE_SIZE + TILE_SIZE / 2,
      playerRef.current.y * TILE_SIZE + TILE_SIZE / 2, 1
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
      if (testModeRef.current === 'live') {
        if (FogOfWar._lerpDisplay(dt)) FogOfWar._updateTexture();
      }
      if (FogOfWar._fogGroup) {
        FogOfWar._time += dt;
        FogOfWar._fogGroup.children.forEach((child: any) => {
          if (child.material?.uniforms?.uTime) child.material.uniforms.uTime.value = FogOfWar._time;
        });
      }
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    initScene();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (rendererRef.current) rendererRef.current.dispose();
      FogOfWar.dispose();
    };
  }, [initScene]);

  // 플레이어 이동
  const movePlayer = useCallback((dx: number, dy: number) => {
    if (testModeRef.current !== 'live') return;
    const nx = Math.max(0, Math.min(MAP_W - 1, playerRef.current.x + dx));
    const ny = Math.max(0, Math.min(MAP_H - 1, playerRef.current.y + dy));
    if (nx === playerRef.current.x && ny === playerRef.current.y) return;
    playerRef.current = { x: nx, y: ny };
    setPlayerPos({ x: nx, y: ny });
    const scene = sceneRef.current;
    if (scene) {
      const pm = scene.getObjectByName('player');
      if (pm) pm.position.set(nx * TILE_SIZE + TILE_SIZE / 2, ny * TILE_SIZE + TILE_SIZE / 2, 1);
    }
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

  // 유니폼 업데이트
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

  const handleReset = useCallback(() => {
    if (!FogOfWar._active) return;
    const size = MAP_W * MAP_H;
    for (let i = 0; i < size; i++) {
      FogOfWar._exploredData[i] = 0; FogOfWar._displayExpl[i] = 0;
      FogOfWar._displayVis[i] = 0; FogOfWar._visibilityData[i] = 0;
      FogOfWar._tentacleFade[i] = 0; FogOfWar._growFade[i] = 1;
      FogOfWar._borderState[i] = 0;
    }
    FogOfWar._prevPlayerX = -1;
    FogOfWar._prevPlayerY = -1;
    FogOfWar.updateVisibility(playerRef.current.x, playerRef.current.y);
    FogOfWar._updateTexture();
  }, []);

  const captureSnapshot = useCallback(() => {
    if (!FogOfWar._active) return;
    snapshotRef.current = {
      exploredData: new Uint8Array(FogOfWar._exploredData),
      visibilityData: new Float32Array(FogOfWar._visibilityData),
      displayVis: new Float32Array(FogOfWar._displayVis),
      displayExpl: new Float32Array(FogOfWar._displayExpl),
      borderState: new Uint8Array(FogOfWar._borderState),
    };
  }, []);

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

  const switchTestMode = useCallback((mode: TestMode) => {
    if (!FogOfWar._active) return;
    testModeRef.current = mode;
    setTestMode(mode);
    setTimeSlider(0);

    if (mode === 'live') {
      if (snapshotRef.current) {
        const snap = snapshotRef.current;
        const size = MAP_W * MAP_H;
        FogOfWar._exploredData.set(snap.exploredData);
        FogOfWar._visibilityData.set(snap.visibilityData);
        FogOfWar._displayVis.set(snap.displayVis);
        FogOfWar._displayExpl.set(snap.displayExpl);
        FogOfWar._borderState.set(snap.borderState);
        for (let i = 0; i < size; i++) { FogOfWar._tentacleFade[i] = 0; FogOfWar._growFade[i] = 1; }
        FogOfWar._updateTexture();
        snapshotRef.current = null;
      }
      return;
    }

    captureSnapshot();
    const size = MAP_W * MAP_H;

    if (mode === 'grow') {
      for (let i = 0; i < size; i++) {
        FogOfWar._tentacleFade[i] = 0; FogOfWar._growFade[i] = 0; FogOfWar._borderState[i] = 0;
      }
      const borders = getBorderIndices();
      for (const idx of borders) { FogOfWar._borderState[idx] = 1; FogOfWar._growFade[idx] = 0; }
      for (let i = 0; i < size; i++) {
        if (FogOfWar._borderState[i] === 0) FogOfWar._growFade[i] = 1;
      }
      FogOfWar._updateTexture();
    } else if (mode === 'fade') {
      for (let i = 0; i < size; i++) {
        FogOfWar._tentacleFade[i] = 0; FogOfWar._growFade[i] = 1; FogOfWar._borderState[i] = 0;
      }
      const borders = getBorderIndices();
      for (const idx of borders) FogOfWar._borderState[idx] = 1;
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
          if (nearBorder) FogOfWar._tentacleFade[idx] = 1;
        }
      }
      FogOfWar._updateTexture();
    }
  }, [captureSnapshot, getBorderIndices]);

  // 시간 슬라이더
  useEffect(() => {
    if (!FogOfWar._active || testMode === 'live') return;
    const t = timeSlider;

    if (testMode === 'grow') {
      const borders = getBorderIndices();
      for (const idx of borders) FogOfWar._growFade[idx] = t;
    } else if (testMode === 'fade') {
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

  return {
    canvasRef, playerPos, testMode, timeSlider, setTimeSlider,
    radius, setRadius, dissolveStrength, setDissolveStrength,
    fadeSmoothness, setFadeSmoothness, tentacleSharpness, setTentacleSharpness,
    fadeDuration, setFadeDuration, growDuration, setGrowDuration,
    exploredAlpha, setExploredAlpha, unexploredAlpha, setUnexploredAlpha,
    movePlayer, handleReset, switchTestMode,
  };
}
