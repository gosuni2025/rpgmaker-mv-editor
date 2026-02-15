import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FogOfWarTestPage.css';

declare const THREE: any;
declare const FogOfWar: any;
declare const FogOfWar3DVolume: any;

const TILE_SIZE = 48;
const MAP_W = 20;
const MAP_H = 15;

// 1 = 벽 (LoS 차단, 통행 불가), 0 = 바닥
function createTestBlockMap(): Uint8Array {
  const map = new Uint8Array(MAP_W * MAP_H);

  // 외벽
  for (let x = 0; x < MAP_W; x++) {
    map[0 * MAP_W + x] = 1;
    map[(MAP_H - 1) * MAP_W + x] = 1;
  }
  for (let y = 0; y < MAP_H; y++) {
    map[y * MAP_W + 0] = 1;
    map[y * MAP_W + (MAP_W - 1)] = 1;
  }

  // L자형 내부 벽
  for (let y = 3; y <= 8; y++) map[y * MAP_W + 6] = 1;
  for (let x = 6; x <= 11; x++) map[8 * MAP_W + x] = 1;

  // 작은 방 (문 있음)
  for (let x = 13; x <= 17; x++) map[3 * MAP_W + x] = 1;
  for (let y = 3; y <= 7; y++) map[y * MAP_W + 13] = 1;
  for (let y = 3; y <= 7; y++) map[y * MAP_W + 17] = 1;
  for (let x = 13; x <= 17; x++) map[7 * MAP_W + x] = 1;
  map[5 * MAP_W + 13] = 0; // 문

  // 기둥
  map[5 * MAP_W + 3] = 1;
  map[5 * MAP_W + 10] = 1;
  map[11 * MAP_W + 4] = 1;
  map[11 * MAP_W + 8] = 1;
  map[11 * MAP_W + 12] = 1;
  map[11 * MAP_W + 16] = 1;

  return map;
}

export default function FogOfWar3DVolumeTestPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const playerRef = useRef({ x: 3, y: 3 });
  const lastTimeRef = useRef(0);
  const blockMapRef = useRef<Uint8Array | null>(null);

  const orbitRef = useRef({
    center: null as any,
    theta: 0,
    phi: Math.PI / 3,
    distance: 800,
    isDragging: false,
    dragButton: -1,
    lastMouse: { x: 0, y: 0 },
  });

  const [radius, setRadius] = useState(6);
  const [lineOfSight, setLineOfSight] = useState(true);
  const [exploredAlpha, setExploredAlpha] = useState(0.6);
  const [unexploredAlpha, setUnexploredAlpha] = useState(1.0);
  const [fogHeight, setFogHeight] = useState(200);
  const [absorption, setAbsorption] = useState(0.018);
  const [resolution, setResolution] = useState(4);
  const [edgeAnimation, setEdgeAnimation] = useState(true);
  const [edgeAnimSpeed, setEdgeAnimSpeed] = useState(1.0);
  const [playerPos, setPlayerPos] = useState({ x: 3, y: 3 });
  const [infoText, setInfoText] = useState('Loading...');

  const initScene = useCallback(() => {
    if (!canvasRef.current || typeof THREE === 'undefined') return;

    const totalW = MAP_W * TILE_SIZE;
    const totalH = MAP_H * TILE_SIZE;
    const blockMap = createTestBlockMap();
    blockMapRef.current = blockMap;

    // 렌더러
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const container = canvasRef.current;
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x1a2a3a, 1);
    renderer.autoClear = false;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 씬
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // PerspectiveCamera
    const camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 1, 10000);
    cameraRef.current = camera;

    // 바닥: 2D 맵 텍스처 (벽은 갈색, 바닥은 체커보드 초록)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = totalW;
    floorCanvas.height = totalH;
    const ctx = floorCanvas.getContext('2d')!;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (blockMap[y * MAP_W + x] === 1) {
          ctx.fillStyle = '#5a3a2a';
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#3a7a3a' : '#2d6b2d';
        }
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
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
      new THREE.MeshBasicMaterial({ map: floorTexture, side: THREE.DoubleSide })
    );
    floorMesh.position.set(totalW / 2, totalH / 2, -1);
    scene.add(floorMesh);

    // FogOfWar 초기화 (LoS 데이터용)
    FogOfWar.setup(MAP_W, MAP_H, {
      radius,
      lineOfSight,
      exploredAlpha,
      unexploredAlpha,
      edgeAnimation,
      edgeAnimationSpeed: edgeAnimSpeed,
    });
    FogOfWar._blockMap = blockMap;
    FogOfWar._blockMapDirty = false;

    const startX = playerRef.current.x;
    const startY = playerRef.current.y;
    FogOfWar._prevPlayerX = -1;
    FogOfWar.updateVisibilityAt(startX, startY);
    FogOfWar._syncDisplay();
    FogOfWar._updateTexture();

    // FogOfWar3DVolume 초기화
    FogOfWar3DVolume.setup(MAP_W, MAP_H, rect.width, rect.height, {
      resolution,
      fogHeight,
      absorption,
    });

    // 플레이어 마커
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(TILE_SIZE * 0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    marker.position.set((startX + 0.5) * TILE_SIZE, (startY + 0.5) * TILE_SIZE, 2);
    marker.name = 'playerMarker';
    marker.renderOrder = 10000;
    scene.add(marker);

    // orbit camera
    const orbit = orbitRef.current;
    orbit.center = new THREE.Vector3(totalW / 2, totalH / 2, 0);
    orbit.theta = -Math.PI / 6;  // 약간 회전
    orbit.phi = Math.PI / 5;     // 위에서 더 내려다봄 (낮을수록 수직)
    orbit.distance = 900;

    const updateCamera = () => {
      const o = orbitRef.current;
      if (!o.center) return;
      camera.position.set(
        o.center.x + o.distance * Math.sin(o.phi) * Math.cos(o.theta),
        o.center.y + o.distance * Math.sin(o.phi) * Math.sin(o.theta),
        o.center.z + o.distance * Math.cos(o.phi)
      );
      camera.lookAt(o.center);
      camera.updateMatrixWorld();
    };
    updateCamera();

    // controls
    const onMouseDown = (e: MouseEvent) => {
      orbit.isDragging = true; orbit.dragButton = e.button;
      orbit.lastMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { orbit.isDragging = false; orbit.dragButton = -1; };
    const onMouseMove = (e: MouseEvent) => {
      if (!orbit.isDragging) return;
      const dx = e.clientX - orbit.lastMouse.x;
      const dy = e.clientY - orbit.lastMouse.y;
      orbit.lastMouse = { x: e.clientX, y: e.clientY };
      if (orbit.dragButton === 0) {
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.01, orbit.phi - dy * 0.005));
      } else if (orbit.dragButton === 2) {
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        camera.getWorldDirection(up);
        right.crossVectors(up, camera.up).normalize();
        up.crossVectors(right, up).normalize();
        const s = orbit.distance * 0.002;
        orbit.center.add(right.multiplyScalar(-dx * s));
        orbit.center.add(up.multiplyScalar(dy * s));
      }
      updateCamera();
    };
    const onWheel = (e: WheelEvent) => {
      orbit.distance = Math.max(50, Math.min(10000, orbit.distance * (1 + e.deltaY * 0.001)));
      updateCamera();
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onDblClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      );
      const rc = new THREE.Raycaster();
      rc.setFromCamera(mouse, camera);
      const pt = new THREE.Vector3();
      if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pt)) {
        const nx = Math.floor(pt.x / TILE_SIZE);
        const ny = Math.floor(pt.y / TILE_SIZE);
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && blockMap[ny * MAP_W + nx] === 0) {
          playerRef.current = { x: nx, y: ny };
          setPlayerPos({ x: nx, y: ny });
          FogOfWar._prevPlayerX = -1;
          FogOfWar.updateVisibilityAt(nx, ny);
          const m = scene.getObjectByName('playerMarker');
          if (m) m.position.set((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE, 2);
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('dblclick', onDblClick);

    setInfoText(`${MAP_W}x${MAP_H} 테스트맵 | WASD:이동 | 더블클릭:텔레포트 | 좌드래그:회전 | 우드래그:팬 | 휠:줌`);

    // 렌더 루프
    lastTimeRef.current = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // FogOfWar 보간
      if (FogOfWar._active && FogOfWar._lerpDisplay) {
        FogOfWar._lerpDisplay(dt);
        FogOfWar._computeEdgeData(dt);
        FogOfWar._updateTexture();
      }

      // 1) 메인 씬 렌더 (바닥 + 플레이어)
      renderer.setClearColor(0x1a2a3a, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      // 2) 3D Volume fog: lowRes RT → upsample → 합성
      FogOfWar3DVolume.render(renderer, camera, dt);

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // resize
    const onResize = () => {
      const r = container.getBoundingClientRect();
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height);
      FogOfWar3DVolume.resize(r.width, r.height);
    };
    window.addEventListener('resize', onResize);

    return () => {
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => { cleanup = initScene(); }, 100);
    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cleanup) cleanup();
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
      FogOfWar3DVolume.dispose();
      FogOfWar.dispose();
    };
  }, [initScene]);

  const movePlayer = useCallback((dx: number, dy: number) => {
    const nx = Math.max(0, Math.min(MAP_W - 1, playerRef.current.x + dx));
    const ny = Math.max(0, Math.min(MAP_H - 1, playerRef.current.y + dy));
    if (nx === playerRef.current.x && ny === playerRef.current.y) return;
    if (blockMapRef.current && blockMapRef.current[ny * MAP_W + nx] === 1) return;
    playerRef.current = { x: nx, y: ny };
    setPlayerPos({ x: nx, y: ny });
    const scene = sceneRef.current;
    if (scene) {
      const m = scene.getObjectByName('playerMarker');
      if (m) m.position.set((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE, 2);
    }
    FogOfWar._prevPlayerX = -1;
    FogOfWar.updateVisibilityAt(nx, ny);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
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

  useEffect(() => {
    if (!FogOfWar._active) return;
    FogOfWar._exploredAlpha = exploredAlpha;
    FogOfWar._unexploredAlpha = unexploredAlpha;
    FogOfWar._edgeAnimation = edgeAnimation;
    FogOfWar._edgeAnimationSpeed = edgeAnimSpeed;
  }, [exploredAlpha, unexploredAlpha, edgeAnimation, edgeAnimSpeed]);

  useEffect(() => {
    if (!FogOfWar._active) return;
    FogOfWar._radius = radius;
    FogOfWar._lineOfSight = lineOfSight;
    FogOfWar._prevPlayerX = -1;
    FogOfWar.updateVisibilityAt(playerRef.current.x, playerRef.current.y);
  }, [radius, lineOfSight]);

  useEffect(() => {
    if (!FogOfWar3DVolume._active) return;
    FogOfWar3DVolume._fogHeight = fogHeight;
    FogOfWar3DVolume._absorption = absorption;
  }, [fogHeight, absorption]);

  useEffect(() => {
    if (!FogOfWar3DVolume._active) return;
    FogOfWar3DVolume._resolution = resolution;
    FogOfWar3DVolume.resize(FogOfWar3DVolume._screenWidth, FogOfWar3DVolume._screenHeight);
  }, [resolution]);

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
    FogOfWar.updateVisibilityAt(playerRef.current.x, playerRef.current.y);
    FogOfWar._updateTexture();
  }, []);

  return (
    <div className="fow-test-page">
      <div className="fow-test-header">
        <button className="fow-back-btn" onClick={() => navigate('/')}>
          &larr; 메인
        </button>
        <h2>FogOfWar 3D Volume (저해상도 RT)</h2>
        <span className="fow-test-hint">{infoText}</span>
      </div>
      <div className="fow-test-body">
        <div className="fow-test-canvas" ref={canvasRef} />
        <div className="fow-test-controls">
          <div className="fow-control-group">
            <h3>플레이어</h3>
            <div className="fow-info">위치: ({playerPos.x}, {playerPos.y})</div>
            <div className="fow-dpad">
              <button onClick={() => movePlayer(0, -1)}>&#9650;</button>
              <div>
                <button onClick={() => movePlayer(-1, 0)}>&#9664;</button>
                <button onClick={() => movePlayer(1, 0)}>&#9654;</button>
              </div>
              <button onClick={() => movePlayer(0, 1)}>&#9660;</button>
            </div>
            <button className="fow-reset-btn" onClick={handleReset}>리셋 (FOW 초기화)</button>
          </div>
          <div className="fow-control-group">
            <h3>시야</h3>
            <label>반경: {radius}<input type="range" min={1} max={15} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={lineOfSight} onChange={(e) => setLineOfSight(e.target.checked)} /> 가시선 (Line of Sight)</label>
          </div>
          <div className="fow-control-group">
            <h3>3D 볼륨</h3>
            <label>fogHeight: {fogHeight}<input type="range" min={48} max={480} step={24} value={fogHeight} onChange={(e) => setFogHeight(Number(e.target.value))} /></label>
            <label>absorption: {absorption.toFixed(3)}<input type="range" min={0.001} max={0.05} step={0.001} value={absorption} onChange={(e) => setAbsorption(Number(e.target.value))} /></label>
            <label>해상도 (1/N): {resolution}<input type="range" min={1} max={8} step={1} value={resolution} onChange={(e) => setResolution(Number(e.target.value))} /></label>
          </div>
          <div className="fow-control-group">
            <h3>애니메이션</h3>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={edgeAnimation} onChange={(e) => setEdgeAnimation(e.target.checked)} /> 경계 애니메이션</label>
            <label>애니메이션 속도: {edgeAnimSpeed.toFixed(1)}<input type="range" min={0.1} max={5} step={0.1} value={edgeAnimSpeed} onChange={(e) => setEdgeAnimSpeed(Number(e.target.value))} /></label>
          </div>
          <div className="fow-control-group">
            <h3>알파</h3>
            <label>exploredAlpha: {exploredAlpha.toFixed(2)}<input type="range" min={0} max={1} step={0.05} value={exploredAlpha} onChange={(e) => setExploredAlpha(Number(e.target.value))} /></label>
            <label>unexploredAlpha: {unexploredAlpha.toFixed(2)}<input type="range" min={0} max={1} step={0.05} value={unexploredAlpha} onChange={(e) => setUnexploredAlpha(Number(e.target.value))} /></label>
          </div>
        </div>
      </div>
    </div>
  );
}
