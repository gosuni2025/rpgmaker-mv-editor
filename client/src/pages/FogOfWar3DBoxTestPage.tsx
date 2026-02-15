import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FogOfWarTestPage.css';

declare const THREE: any;
declare const FogOfWar: any;
declare const FogOfWar3D: any;

const TILE_SIZE = 48;
const DEFAULT_MAP_ID = 4;

export default function FogOfWar3DBoxTestPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const playerRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(0);
  const markerRef = useRef<any>(null);
  const mapSizeRef = useRef({ w: 20, h: 15 });

  // orbit camera state
  const orbitRef = useRef({
    center: null as any,
    theta: 0,
    phi: Math.PI / 3,
    distance: 600,
    isDragging: false,
    dragButton: -1,
    lastMouse: { x: 0, y: 0 },
  });

  // 파라미터
  const [mapId, setMapId] = useState(DEFAULT_MAP_ID);
  const [radius, setRadius] = useState(5);
  const [lineOfSight, setLineOfSight] = useState(false);
  const [exploredAlpha, setExploredAlpha] = useState(0.6);
  const [unexploredAlpha, setUnexploredAlpha] = useState(1.0);
  const [fadeDuration, setFadeDuration] = useState(1.0);
  const [growDuration, setGrowDuration] = useState(0.5);
  const [fogHeight, setFogHeight] = useState(144);
  const [heightFalloff, setHeightFalloff] = useState(1.5);
  const [dissolveStrength, setDissolveStrength] = useState(4.0);
  const [tentacleSharpness, setTentacleSharpness] = useState(1.8);
  const [fadeSmoothness, setFadeSmoothness] = useState(0.3);
  const [edgeAnimation, setEdgeAnimation] = useState(true);
  const [edgeAnimSpeed, setEdgeAnimSpeed] = useState(1.0);
  const [heightGradient, setHeightGradient] = useState(true);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [infoText, setInfoText] = useState('Loading...');

  const initScene = useCallback(async () => {
    if (!canvasRef.current || typeof THREE === 'undefined') return;

    // 맵 데이터 로드
    const mapStr = String(mapId).padStart(3, '0');
    let mapData: any;
    try {
      const resp = await fetch(`/data/Map${mapStr}.json`);
      mapData = await resp.json();
    } catch (err: any) {
      setInfoText('맵 로드 실패: ' + err.message);
      return;
    }

    const fow = mapData.fogOfWar || {};
    const mapW = mapData.width;
    const mapH = mapData.height;
    mapSizeRef.current = { w: mapW, h: mapH };
    const totalW = mapW * TILE_SIZE;
    const totalH = mapH * TILE_SIZE;

    // 시스템 데이터에서 시작 위치 가져오기
    let startX = Math.floor(mapW / 2);
    let startY = Math.floor(mapH / 2);
    try {
      const sysResp = await fetch('/data/System.json');
      const sys = await sysResp.json();
      if (sys.startX != null) startX = sys.startX;
      if (sys.startY != null) startY = sys.startY;
    } catch {}

    playerRef.current = { x: startX, y: startY };
    setPlayerPos({ x: startX, y: startY });

    // 렌더러
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const container = canvasRef.current;
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x1a2a3a, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 씬
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // PerspectiveCamera
    const camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 1, 10000);
    cameraRef.current = camera;

    // 바닥
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(totalW, totalH),
      new THREE.MeshBasicMaterial({ color: 0x2a4a2a, side: THREE.DoubleSide })
    );
    floorMesh.position.set(totalW / 2, totalH / 2, -1);
    scene.add(floorMesh);

    // 격자선
    const gridMat = new THREE.LineBasicMaterial({ color: 0x3a5a3a });
    for (let x = 0; x <= mapW; x++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x * TILE_SIZE, 0, 0),
          new THREE.Vector3(x * TILE_SIZE, totalH, 0),
        ]),
        gridMat
      ));
    }
    for (let y = 0; y <= mapH; y++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, y * TILE_SIZE, 0),
          new THREE.Vector3(totalW, y * TILE_SIZE, 0),
        ]),
        gridMat
      ));
    }

    // FogOfWar 초기화
    FogOfWar.setup(mapW, mapH, {
      ...fow,
      radius,
      lineOfSight,
      exploredAlpha,
      unexploredAlpha,
      edgeAnimation,
      edgeAnimationSpeed: edgeAnimSpeed,
    });
    FogOfWar._tentacleFadeDuration = fadeDuration;
    FogOfWar._tentacleGrowDuration = growDuration;

    // 초기 visibility
    FogOfWar._prevPlayerX = -1;
    FogOfWar._prevPlayerY = -1;
    FogOfWar.updateVisibilityAt(startX, startY);
    FogOfWar._syncDisplay();
    FogOfWar._updateTexture();

    // 플레이어 마커
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(TILE_SIZE * 0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    marker.position.set((startX + 0.5) * TILE_SIZE, (startY + 0.5) * TILE_SIZE, 2);
    scene.add(marker);
    markerRef.current = marker;

    // FogOfWar3D 박스 메쉬 생성
    const mesh = FogOfWar3D._createMesh(mapW, mapH, {
      ...fow,
      fogHeight3D: fogHeight,
      heightFalloff,
    });
    if (mesh) scene.add(mesh);

    // 촉수 메쉬 생성
    FogOfWar3D._createTentacles(scene);

    // orbit camera 초기화
    const orbit = orbitRef.current;
    orbit.center = new THREE.Vector3(
      (startX + 0.5) * TILE_SIZE,
      (startY + 0.5) * TILE_SIZE,
      0
    );
    orbit.theta = 0;
    orbit.phi = Math.PI / 3;
    orbit.distance = 600;

    const updateCamera = () => {
      const o = orbitRef.current;
      if (!o.center) return;
      camera.position.set(
        o.center.x + o.distance * Math.sin(o.phi) * Math.cos(o.theta),
        o.center.y + o.distance * Math.sin(o.phi) * Math.sin(o.theta),
        o.center.z + o.distance * Math.cos(o.phi)
      );
      camera.lookAt(o.center);
    };
    updateCamera();

    // orbit controls - mouse
    const onMouseDown = (e: MouseEvent) => {
      orbit.isDragging = true;
      orbit.dragButton = e.button;
      orbit.lastMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      orbit.isDragging = false;
      orbit.dragButton = -1;
    };
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

    // 더블클릭: 텔레포트
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
        if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
          playerRef.current = { x: nx, y: ny };
          setPlayerPos({ x: nx, y: ny });
          FogOfWar.updateVisibilityAt(nx, ny);
          marker.position.set((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE, 2);
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('dblclick', onDblClick);

    // info
    setInfoText(`맵 ${mapStr} (${mapW}x${mapH}) | WASD/방향키:이동 | 더블클릭:텔레포트 | 좌드래그:회전 | 우드래그:팬 | 휠:줌`);

    // 렌더 루프
    lastTimeRef.current = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // FogOfWar 시간 업데이트
      if (FogOfWar._active && FogOfWar._lerpDisplay) {
        FogOfWar._lerpDisplay(dt);
        FogOfWar._computeEdgeData(dt);
        FogOfWar._updateTexture();
      }

      // FogOfWar3D 유니폼 갱신 + 촉수 갱신
      if (FogOfWar3D._active) {
        FogOfWar3D._updateUniforms(dt);
        FogOfWar3D._refreshTentaclesIfNeeded(scene);
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // resize
    const onResize = () => {
      const r = container.getBoundingClientRect();
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height);
    };
    window.addEventListener('resize', onResize);

    // cleanup 리턴
    return () => {
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('resize', onResize);
    };
  }, [mapId]);

  // 씬 초기화
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initScene().then((c) => { cleanup = c; });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cleanup) cleanup();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      FogOfWar3D._disposeMesh();
      FogOfWar.dispose();
    };
  }, [initScene]);

  // 플레이어 이동
  const movePlayer = useCallback((dx: number, dy: number) => {
    const { w: mapW, h: mapH } = mapSizeRef.current;
    const nx = Math.max(0, Math.min(mapW - 1, playerRef.current.x + dx));
    const ny = Math.max(0, Math.min(mapH - 1, playerRef.current.y + dy));
    if (nx === playerRef.current.x && ny === playerRef.current.y) return;

    playerRef.current = { x: nx, y: ny };
    setPlayerPos({ x: nx, y: ny });

    if (markerRef.current) {
      markerRef.current.position.set(
        (nx + 0.5) * TILE_SIZE,
        (ny + 0.5) * TILE_SIZE,
        2
      );
    }
    FogOfWar.updateVisibilityAt(nx, ny);
  }, []);

  // 키보드 이동
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // input 요소에 포커스가 있으면 무시
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

  // FogOfWar 파라미터 변경 시 업데이트
  useEffect(() => {
    if (!FogOfWar._active) return;
    FogOfWar._exploredAlpha = exploredAlpha;
    FogOfWar._unexploredAlpha = unexploredAlpha;
    FogOfWar._edgeAnimation = edgeAnimation;
    FogOfWar._edgeAnimationSpeed = edgeAnimSpeed;
  }, [exploredAlpha, unexploredAlpha, edgeAnimation, edgeAnimSpeed]);

  useEffect(() => {
    if (FogOfWar._active) {
      FogOfWar._tentacleFadeDuration = fadeDuration;
      FogOfWar._tentacleGrowDuration = growDuration;
    }
  }, [fadeDuration, growDuration]);

  useEffect(() => {
    if (FogOfWar._active) {
      FogOfWar._radius = radius;
      FogOfWar._lineOfSight = lineOfSight;
      FogOfWar._prevPlayerX = -1;
      FogOfWar._prevPlayerY = -1;
      FogOfWar.updateVisibilityAt(playerRef.current.x, playerRef.current.y);
    }
  }, [radius, lineOfSight]);

  // FogOfWar3D 유니폼 직접 업데이트 (박스 + 촉수 메쉬)
  useEffect(() => {
    if (!FogOfWar3D._instancedMesh) return;
    const u = FogOfWar3D._instancedMesh.material.uniforms;
    if (u.heightFalloff) u.heightFalloff.value = heightFalloff;
    if (u.dissolveStrength) u.dissolveStrength.value = dissolveStrength;
    if (u.tentacleSharpness) u.tentacleSharpness.value = tentacleSharpness;
    if (u.fadeSmoothness) u.fadeSmoothness.value = fadeSmoothness;
    if (u.exploredAlpha) u.exploredAlpha.value = exploredAlpha;
    if (u.unexploredAlpha) u.unexploredAlpha.value = unexploredAlpha;
    if (u.edgeAnimOn) u.edgeAnimOn.value = edgeAnimation ? 1.0 : 0.0;
    if (u.edgeAnimSpeed) u.edgeAnimSpeed.value = edgeAnimSpeed;
    if (u.heightGradientOn) u.heightGradientOn.value = heightGradient ? 1.0 : 0.0;

    // 촉수 메쉬 유니폼도 동기화
    if (FogOfWar3D._tentacleMesh) {
      const tu = FogOfWar3D._tentacleMesh.material.uniforms;
      if (tu.dissolveStrength) tu.dissolveStrength.value = dissolveStrength;
      if (tu.tentacleSharpness) tu.tentacleSharpness.value = tentacleSharpness;
      if (tu.unexploredAlpha) tu.unexploredAlpha.value = unexploredAlpha;
      if (tu.edgeAnimSpeed) tu.edgeAnimSpeed.value = edgeAnimSpeed;
      if (tu.heightGradientOn) tu.heightGradientOn.value = heightGradient ? 1.0 : 0.0;
    }
  }, [heightFalloff, dissolveStrength, tentacleSharpness, fadeSmoothness, exploredAlpha, unexploredAlpha, edgeAnimation, edgeAnimSpeed, heightGradient]);

  // fogHeight 변경 시 메쉬 재생성
  useEffect(() => {
    if (!FogOfWar3D._active || !sceneRef.current) return;
    const scene = sceneRef.current;
    const { w: mapW, h: mapH } = mapSizeRef.current;
    FogOfWar3D._disposeMesh();
    const mesh = FogOfWar3D._createMesh(mapW, mapH, {
      fogHeight3D: fogHeight,
      heightFalloff,
    });
    if (mesh) scene.add(mesh);
  }, [fogHeight]);

  // 리셋
  const handleReset = useCallback(() => {
    if (!FogOfWar._active) return;
    const { w: mapW, h: mapH } = mapSizeRef.current;
    const size = mapW * mapH;
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
    FogOfWar.updateVisibilityAt(playerRef.current.x, playerRef.current.y);
    FogOfWar._updateTexture();
  }, []);

  return (
    <div className="fow-test-page">
      <div className="fow-test-header">
        <button className="fow-back-btn" onClick={() => navigate('/')}>
          &larr; 메인
        </button>
        <h2>FogOfWar 3D Box 테스트</h2>
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
            <label>
              반경: {radius}
              <input type="range" min={1} max={15} step={1} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))} />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={lineOfSight}
                onChange={(e) => setLineOfSight(e.target.checked)} />
              가시선 (Line of Sight)
            </label>
          </div>

          <div className="fow-control-group">
            <h3>타이머 (생성/삭제)</h3>
            <label>
              생성 시간: {growDuration.toFixed(1)}초
              <input type="range" min={0.1} max={5} step={0.1} value={growDuration}
                onChange={(e) => setGrowDuration(Number(e.target.value))} />
            </label>
            <label>
              삭제 시간: {fadeDuration.toFixed(1)}초
              <input type="range" min={0.1} max={5} step={0.1} value={fadeDuration}
                onChange={(e) => setFadeDuration(Number(e.target.value))} />
            </label>
          </div>

          <div className="fow-control-group">
            <h3>3D 박스</h3>
            <label>
              fogHeight: {fogHeight}
              <input type="range" min={48} max={480} step={24} value={fogHeight}
                onChange={(e) => setFogHeight(Number(e.target.value))} />
            </label>
            <label>
              heightFalloff: {heightFalloff.toFixed(1)}
              <input type="range" min={0.1} max={5} step={0.1} value={heightFalloff}
                onChange={(e) => setHeightFalloff(Number(e.target.value))} />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={heightGradient}
                onChange={(e) => setHeightGradient(e.target.checked)} />
              높이 그라데이션
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
              tentacleSharpness: {tentacleSharpness.toFixed(1)}
              <input type="range" min={1} max={8} step={0.5} value={tentacleSharpness}
                onChange={(e) => setTentacleSharpness(Number(e.target.value))} />
            </label>
            <label>
              fadeSmoothness: {fadeSmoothness.toFixed(2)}
              <input type="range" min={0.05} max={1} step={0.05} value={fadeSmoothness}
                onChange={(e) => setFadeSmoothness(Number(e.target.value))} />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={edgeAnimation}
                onChange={(e) => setEdgeAnimation(e.target.checked)} />
              경계 애니메이션
            </label>
            <label>
              애니메이션 속도: {edgeAnimSpeed.toFixed(1)}
              <input type="range" min={0.1} max={5} step={0.1} value={edgeAnimSpeed}
                onChange={(e) => setEdgeAnimSpeed(Number(e.target.value))} />
            </label>
          </div>

          <div className="fow-control-group">
            <h3>알파</h3>
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

          <div className="fow-control-group">
            <h3>맵</h3>
            <label>
              맵 ID: {mapId}
              <input type="number" min={1} max={999} value={mapId}
                onChange={(e) => setMapId(Number(e.target.value))}
                style={{ width: '60px', background: '#333', color: '#ddd', border: '1px solid #555', borderRadius: 4, padding: '2px 6px' }} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
