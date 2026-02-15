import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FogOfWarTestPage.css';

declare const THREE: any;
declare const FogOfWar: any;
declare const FogOfWar3D: any;

const TILE_SIZE = 48;
const MAP_W = 15;
const MAP_H = 12;

function generateTestHeightMap(w: number, h: number, preset: string): Float32Array {
  const hm = new Float32Array(w * h);
  if (preset === 'castle') {
    for (let x = 1; x < w - 1; x++) { hm[1 * w + x] = 3; hm[(h - 2) * w + x] = 3; }
    for (let y = 1; y < h - 1; y++) { hm[y * w + 1] = 3; hm[y * w + (w - 2)] = 3; }
    for (let y = 1; y < h - 4; y++) hm[y * w + 7] = 2;
    hm[4 * w + 7] = 0; hm[1 * w + 5] = 0; hm[(h - 2) * w + 5] = 0;
    hm[4 * w + 4] = 4; hm[4 * w + 10] = 4;
  } else if (preset === 'canyon') {
    for (let y = 0; y < h; y++) {
      if (y <= 1 || y >= h - 2) { for (let x = 0; x < w; x++) hm[y * w + x] = 4; }
    }
    for (let y = 0; y < h; y++) { if (y < 4 || y > 6) hm[y * w + 7] = 3; }
    hm[5 * w + 3] = 1; hm[5 * w + 4] = 1;
  } else {
    const S: number[][] = [
      [3,2,2,2,1], [7,2,1,4,2], [10,1,2,2,3], [12,5,1,1,4],
      [3,6,4,1,1], [3,9,1,2,3], [9,7,3,3,2.5],
    ];
    for (const [sx,sy,sw,sh,ht] of S)
      for (let dy = 0; dy < sh; dy++)
        for (let dx = 0; dx < sw; dx++) {
          const px = sx + dx, py = sy + dy;
          if (px < w && py < h) hm[py * w + px] = ht;
        }
  }
  return hm;
}

export default function LoS3DTestPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const playerRef = useRef({ x: 6, y: 5 });
  const markerRef = useRef<any>(null);
  const heightMapRef = useRef<Float32Array | null>(null);
  // 디버그 오버레이 (가시/차단 색상 표시)
  const debugMeshRef = useRef<any>(null);
  // hover
  const hoverRef = useRef<any>(null);
  const hoverTileRef = useRef({ x: -1, y: -1 });

  const orbitRef = useRef({
    center: null as any, theta: 0, phi: Math.PI / 4, distance: 600,
    isDragging: false, dragButton: -1, lastMouse: { x: 0, y: 0 },
  });

  const [preset, setPreset] = useState('mixed');
  const [radius, setRadius] = useState(8);
  const [lineOfSight, setLineOfSight] = useState(true);
  const [lineOfSight3D, setLineOfSight3D] = useState(true);
  const [eyeHeight, setEyeHeight] = useState(1.5);
  const [showDebug, setShowDebug] = useState(true);
  const [fogHeight, setFogHeight] = useState(144);
  const [heightFalloff, setHeightFalloff] = useState(1.5);
  const [playerPos, setPlayerPos] = useState({ x: 6, y: 5 });
  const [hoverInfo, setHoverInfo] = useState('');
  const [infoText, setInfoText] = useState('Loading...');

  // debug 오버레이 색상 갱신
  const refreshDebugOverlay = useCallback(() => {
    if (!FogOfWar._active || !debugMeshRef.current) return;
    const vis = FogOfWar._visibilityData;
    if (!vis) return;
    const px = playerRef.current.x, py = playerRef.current.y;
    const r = radius;

    const colors = debugMeshRef.current.geometry.getAttribute('color');
    const arr = colors.array;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const idx = y * MAP_W + x;
        const v = vis[idx];
        const dx = x - px, dy = y - py;
        const inRange = dx * dx + dy * dy <= r * r;

        let cr: number, cg: number, cb: number, ca: number;
        if (!showDebug || !inRange) {
          cr = 0; cg = 0; cb = 0; ca = 0;
        } else if (v > 0.5) {
          cr = 0; cg = 0.8; cb = 0; ca = 0.4;
        } else if (v > 0.01) {
          cr = 0.8; cg = 0.8; cb = 0; ca = 0.4;
        } else {
          cr = 0.8; cg = 0; cb = 0; ca = 0.4;
        }
        const base = idx * 6 * 4;
        for (let i = 0; i < 6; i++) {
          arr[base + i * 4] = cr;
          arr[base + i * 4 + 1] = cg;
          arr[base + i * 4 + 2] = cb;
          arr[base + i * 4 + 3] = ca;
        }
      }
    }
    colors.needsUpdate = true;
  }, [showDebug, radius]);

  // 디버그 오버레이 메쉬 생성 (초기화 시 1회)
  const createDebugMesh = useCallback((scene: any) => {
    const tileCount = MAP_W * MAP_H;
    const hm = heightMapRef.current;
    const positions = new Float32Array(tileCount * 6 * 3);
    const colors = new Float32Array(tileCount * 6 * 4);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const idx = y * MAP_W + x;
        const cx = (x + 0.5) * TILE_SIZE, cy = (y + 0.5) * TILE_SIZE;
        const s = TILE_SIZE * 0.35;
        const tileH = hm ? hm[idx] : 0;
        const z = tileH > 0 ? tileH * TILE_SIZE * 0.5 + 2 : 2;
        const base = idx * 18;
        positions[base]   = cx-s; positions[base+1] = cy-s; positions[base+2] = z;
        positions[base+3] = cx+s; positions[base+4] = cy-s; positions[base+5] = z;
        positions[base+6] = cx+s; positions[base+7] = cy+s; positions[base+8] = z;
        positions[base+9] = cx-s; positions[base+10]= cy-s; positions[base+11]= z;
        positions[base+12]= cx+s; positions[base+13]= cy+s; positions[base+14]= z;
        positions[base+15]= cx-s; positions[base+16]= cy+s; positions[base+17]= z;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true,
      side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 200;
    scene.add(mesh);
    debugMeshRef.current = mesh;
  }, []);

  const initScene = useCallback(async () => {
    if (!canvasRef.current || typeof THREE === 'undefined') return;

    const totalW = MAP_W * TILE_SIZE, totalH = MAP_H * TILE_SIZE;
    const startX = 6, startY = 5;
    playerRef.current = { x: startX, y: startY };
    setPlayerPos({ x: startX, y: startY });

    const heightMap = generateTestHeightMap(MAP_W, MAP_H, preset);
    heightMapRef.current = heightMap;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const container = canvasRef.current;
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1a1a2e, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 1, 5000);
    cameraRef.current = camera;

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(totalW, totalH),
      new THREE.MeshLambertMaterial({ color: 0x3a5a3a, side: THREE.DoubleSide })
    );
    floor.position.set(totalW / 2, totalH / 2, -0.5);
    scene.add(floor);

    // 격자
    const gridMat = new THREE.LineBasicMaterial({ color: 0x4a6a4a });
    for (let x = 0; x <= MAP_W; x++) {
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x * TILE_SIZE, 0, 0), new THREE.Vector3(x * TILE_SIZE, totalH, 0)
      ]), gridMat));
    }
    for (let y = 0; y <= MAP_H; y++) {
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, y * TILE_SIZE, 0), new THREE.Vector3(totalW, y * TILE_SIZE, 0)
      ]), gridMat));
    }

    // 조명
    scene.add(new THREE.AmbientLight(0x888888));
    const dl = new THREE.DirectionalLight(0xffffff, 0.6);
    dl.position.set(totalW, totalH, 400);
    scene.add(dl);

    // 벽 블록 + 높이 라벨
    const hColors: Record<number, number> = {
      1: 0x9B8B6B, 2: 0x6B7B8B, 2.5: 0x5B6B7B, 3: 0x7B6B5B, 4: 0x5B4B3B
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tH = heightMap[y * MAP_W + x];
        if (tH <= 0) continue;
        const bH = tH * TILE_SIZE * 0.5;
        let bestK = 2, bestD = 99;
        for (const k of Object.keys(hColors)) {
          const d = Math.abs(parseFloat(k) - tH);
          if (d < bestD) { bestD = d; bestK = parseFloat(k); }
        }
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(TILE_SIZE - 2, TILE_SIZE - 2, bH),
          new THREE.MeshLambertMaterial({ color: hColors[bestK] || 0x6B7B8B })
        );
        block.position.set((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE, bH / 2);
        scene.add(block);

        const c = document.createElement('canvas');
        c.width = 48; c.height = 24;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(tH), 24, 12);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
        sp.position.set((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE, bH + 10);
        sp.scale.set(24, 12, 1);
        scene.add(sp);
      }
    }

    // FogOfWar 초기화
    FogOfWar.setup(MAP_W, MAP_H, {
      radius, lineOfSight, lineOfSight3D, eyeHeight,
      exploredAlpha: 0.6, unexploredAlpha: 1.0, edgeAnimation: true,
    });
    FogOfWar.setCustomHeightMap(heightMap);
    FogOfWar._prevPlayerX = -1;
    FogOfWar.updateVisibilityAt(startX, startY);
    if (FogOfWar._syncDisplay) FogOfWar._syncDisplay();
    if (FogOfWar._updateTexture) FogOfWar._updateTexture();

    // FogOfWar3D 박스 메쉬
    const fog3dMesh = FogOfWar3D._createMesh(MAP_W, MAP_H, {
      fogHeight3D: fogHeight,
      heightFalloff,
    });
    if (fog3dMesh) scene.add(fog3dMesh);

    // FogOfWar3D 촉수 메쉬
    FogOfWar3D._createTentacles(scene);

    // 디버그 오버레이 메쉬
    createDebugMesh(scene);

    // 플레이어 마커
    const mg = new THREE.Group();
    mg.add(new THREE.Mesh(
      new THREE.CircleGeometry(TILE_SIZE * 0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    ));
    mg.children[0].position.z = 1;
    const eyeH = eyeHeight * TILE_SIZE * 0.5;
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, eyeH, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    bar.rotation.x = Math.PI / 2; bar.position.z = eyeH / 2;
    mg.add(bar);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    eye.position.z = eyeH;
    mg.add(eye);
    mg.position.set((startX + 0.5) * TILE_SIZE, (startY + 0.5) * TILE_SIZE, 0);
    scene.add(mg);
    markerRef.current = mg;

    // hover 하이라이트 메쉬
    const hoverGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.2,
      side: THREE.DoubleSide, depthTest: false,
    });
    const hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
    hoverMesh.visible = false;
    hoverMesh.renderOrder = 300;
    scene.add(hoverMesh);
    hoverRef.current = hoverMesh;

    // orbit camera
    const orbit = orbitRef.current;
    orbit.center = new THREE.Vector3(totalW / 2, totalH / 2, 0);
    orbit.phi = Math.PI / 4; orbit.distance = 600;

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

    // mouse controls
    const onMouseDown = (e: MouseEvent) => {
      orbit.isDragging = true; orbit.dragButton = e.button;
      orbit.lastMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { orbit.isDragging = false; };
    const onMouseMove = (e: MouseEvent) => {
      // hover 처리
      const rr = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rr.left) / rr.width) * 2 - 1,
        -((e.clientY - rr.top) / rr.height) * 2 + 1
      );
      const rc = new THREE.Raycaster();
      rc.setFromCamera(mouse, camera);
      const pt = new THREE.Vector3();
      if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pt)) {
        const tx = Math.floor(pt.x / TILE_SIZE), ty = Math.floor(pt.y / TILE_SIZE);
        if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
          if (tx !== hoverTileRef.current.x || ty !== hoverTileRef.current.y) {
            hoverTileRef.current = { x: tx, y: ty };
            if (hoverRef.current) {
              const hm = heightMapRef.current;
              const tH = hm ? hm[ty * MAP_W + tx] : 0;
              const z = tH > 0 ? tH * TILE_SIZE * 0.5 + 3 : 3;
              hoverRef.current.position.set((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, z);
              hoverRef.current.visible = true;
            }
            const idx = ty * MAP_W + tx;
            const hm = heightMapRef.current;
            const tH = hm ? hm[idx] : 0;
            const vis = FogOfWar._visibilityData;
            const v = vis ? vis[idx] : 0;
            const visStr = v > 0.9 ? '보임' : v > 0.01 ? `부분(${v.toFixed(2)})` : '차단';
            setHoverInfo(`(${tx},${ty}) h=${tH} ${visStr}`);
          }
        } else {
          if (hoverRef.current) hoverRef.current.visible = false;
          setHoverInfo('');
        }
      }

      // orbit drag
      if (!orbit.isDragging) return;
      const dx = e.clientX - orbit.lastMouse.x, dy = e.clientY - orbit.lastMouse.y;
      orbit.lastMouse = { x: e.clientX, y: e.clientY };
      if (orbit.dragButton === 0) {
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, orbit.phi - dy * 0.005));
      } else if (orbit.dragButton === 2) {
        const right = new THREE.Vector3(), up = new THREE.Vector3();
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
      orbit.distance = Math.max(100, Math.min(3000, orbit.distance * (1 + e.deltaY * 0.001)));
      updateCamera();
    };
    const onCtx = (e: MouseEvent) => e.preventDefault();
    const onDbl = (e: MouseEvent) => {
      const rr = renderer.domElement.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rr.left) / rr.width) * 2 - 1, -((e.clientY - rr.top) / rr.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(m, camera);
      const pt = new THREE.Vector3();
      if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1), 0), pt)) {
        const nx = Math.floor(pt.x / TILE_SIZE), ny = Math.floor(pt.y / TILE_SIZE);
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && heightMap[ny * MAP_W + nx] <= 0) {
          playerRef.current = { x: nx, y: ny }; setPlayerPos({ x: nx, y: ny });
          FogOfWar.updateVisibilityAt(nx, ny);
          mg.position.set((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE, 0);
        }
      }
    };

    const el = renderer.domElement;
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    el.addEventListener('wheel', onWheel);
    el.addEventListener('contextmenu', onCtx);
    el.addEventListener('dblclick', onDbl);

    setInfoText(`(${MAP_W}x${MAP_H}) WASD | 더블클릭:텔레포트 | 좌드래그:회전 | 우드래그:팬`);

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

    const onResize = () => {
      const rr = container.getBoundingClientRect();
      camera.aspect = rr.width / rr.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rr.width, rr.height);
    };
    window.addEventListener('resize', onResize);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onCtx);
      el.removeEventListener('dblclick', onDbl);
      window.removeEventListener('resize', onResize);
    };
  }, [preset, createDebugMesh]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initScene().then((c) => { cleanup = c; });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cleanup) cleanup();
      debugMeshRef.current = null;
      hoverRef.current = null;
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
      FogOfWar3D._disposeMesh();
      FogOfWar.dispose();
    };
  }, [initScene]);

  // 초기 디버그 오버레이
  useEffect(() => {
    if (debugMeshRef.current && FogOfWar._active) refreshDebugOverlay();
  }, [preset, refreshDebugOverlay]);

  const movePlayer = useCallback((dx: number, dy: number) => {
    const nx = Math.max(0, Math.min(MAP_W - 1, playerRef.current.x + dx));
    const ny = Math.max(0, Math.min(MAP_H - 1, playerRef.current.y + dy));
    if (nx === playerRef.current.x && ny === playerRef.current.y) return;
    if (heightMapRef.current && heightMapRef.current[ny * MAP_W + nx] > 0) return;
    playerRef.current = { x: nx, y: ny }; setPlayerPos({ x: nx, y: ny });
    if (markerRef.current) markerRef.current.position.set((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE, 0);
    FogOfWar.updateVisibilityAt(nx, ny);
    refreshDebugOverlay();
  }, [refreshDebugOverlay]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowLeft': case 'a': movePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': movePlayer(1, 0); break;
        case 'ArrowUp': case 'w': movePlayer(0, -1); break;
        case 'ArrowDown': case 's': movePlayer(0, 1); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [movePlayer]);

  // 파라미터 변경 시
  useEffect(() => {
    if (!FogOfWar._active) return;
    FogOfWar._radius = radius;
    FogOfWar._lineOfSight = lineOfSight;
    FogOfWar._lineOfSight3D = lineOfSight3D;
    FogOfWar._eyeHeight = eyeHeight;
    FogOfWar._prevPlayerX = -1;
    FogOfWar.updateVisibilityAt(playerRef.current.x, playerRef.current.y);
    refreshDebugOverlay();
  }, [radius, lineOfSight, lineOfSight3D, eyeHeight, refreshDebugOverlay]);

  // 눈높이 마커
  useEffect(() => {
    if (!markerRef.current) return;
    const g = markerRef.current;
    const eH = eyeHeight * TILE_SIZE * 0.5;
    if (g.children[1]) { g.children[1].scale.y = eyeHeight / 1.5; g.children[1].position.z = eH / 2; }
    if (g.children[2]) g.children[2].position.z = eH;
  }, [eyeHeight]);

  // 디버그 토글
  useEffect(() => { refreshDebugOverlay(); }, [showDebug, refreshDebugOverlay]);

  // FogOfWar3D fogHeight 변경 시 메쉬 재생성
  useEffect(() => {
    if (!FogOfWar3D._active || !sceneRef.current) return;
    const scene = sceneRef.current;
    FogOfWar3D._disposeMesh();
    const mesh = FogOfWar3D._createMesh(MAP_W, MAP_H, {
      fogHeight3D: fogHeight,
      heightFalloff,
    });
    if (mesh) scene.add(mesh);
  }, [fogHeight]);

  // FogOfWar3D 유니폼 업데이트
  useEffect(() => {
    if (!FogOfWar3D._instancedMesh) return;
    const u = FogOfWar3D._instancedMesh.material.uniforms;
    if (u.heightFalloff) u.heightFalloff.value = heightFalloff;
    if (u.heightGradientOn) u.heightGradientOn.value = 1.0;
    if (FogOfWar3D._tentacleMesh) {
      const tu = FogOfWar3D._tentacleMesh.material.uniforms;
      if (tu.fogHeight) tu.fogHeight.value = fogHeight;
      if (tu.tentacleMaxLength) tu.tentacleMaxLength.value = fogHeight * 0.6;
    }
  }, [heightFalloff, fogHeight]);

  const handleReset = useCallback(() => {
    if (!FogOfWar._active) return;
    const size = MAP_W * MAP_H;
    for (let i = 0; i < size; i++) {
      FogOfWar._exploredData[i] = 0; FogOfWar._displayExpl[i] = 0;
      FogOfWar._displayVis[i] = 0; FogOfWar._visibilityData[i] = 0;
      FogOfWar._tentacleFade[i] = 0; FogOfWar._growFade[i] = 1; FogOfWar._borderState[i] = 0;
    }
    FogOfWar._prevPlayerX = -1;
    FogOfWar.updateVisibilityAt(playerRef.current.x, playerRef.current.y);
    if (FogOfWar._updateTexture) FogOfWar._updateTexture();
    refreshDebugOverlay();
  }, [refreshDebugOverlay]);

  return (
    <div className="fow-test-page">
      <div className="fow-test-header">
        <button className="fow-back-btn" onClick={() => navigate('/')}>&larr; 메인</button>
        <h2>3D Line of Sight 테스트</h2>
        <span className="fow-test-hint">{infoText}</span>
      </div>
      <div className="fow-test-body">
        <div className="fow-test-canvas" ref={canvasRef} />
        <div className="fow-test-controls">
          <div className="fow-control-group">
            <h3>플레이어</h3>
            <div className="fow-info">위치: ({playerPos.x}, {playerPos.y})</div>
            {hoverInfo && <div className="fow-info" style={{ color: '#8cf' }}>{hoverInfo}</div>}
            <div className="fow-dpad">
              <button onClick={() => movePlayer(0, -1)}>&#9650;</button>
              <div>
                <button onClick={() => movePlayer(-1, 0)}>&#9664;</button>
                <button onClick={() => movePlayer(1, 0)}>&#9654;</button>
              </div>
              <button onClick={() => movePlayer(0, 1)}>&#9660;</button>
            </div>
            <button className="fow-reset-btn" onClick={handleReset}>리셋</button>
          </div>

          <div className="fow-control-group">
            <h3>맵 프리셋</h3>
            <div className="fow-mode-buttons">
              {['mixed','castle','canyon'].map(p => (
                <button key={p} className={`fow-mode-btn ${preset === p ? 'active' : ''}`}
                  onClick={() => setPreset(p)}>
                  {p === 'mixed' ? '혼합' : p === 'castle' ? '성곽' : '협곡'}
                </button>
              ))}
            </div>
          </div>

          <div className="fow-control-group">
            <h3>시야 (LoS)</h3>
            <label>반경: {radius}
              <input type="range" min={1} max={20} step={1} value={radius} onChange={e => setRadius(+e.target.value)} />
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={lineOfSight} onChange={e => setLineOfSight(e.target.checked)} />
              가시선 (2D LoS)
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={lineOfSight3D} onChange={e => setLineOfSight3D(e.target.checked)} />
              3D 높이 기반 LoS
            </label>
            <label>눈 높이: {eyeHeight.toFixed(1)} 타일
              <input type="range" min={0.5} max={5} step={0.1} value={eyeHeight} onChange={e => setEyeHeight(+e.target.value)} />
            </label>
          </div>

          <div className="fow-control-group">
            <h3>3D 안개</h3>
            <label>fogHeight: {fogHeight}
              <input type="range" min={48} max={480} step={24} value={fogHeight} onChange={e => setFogHeight(+e.target.value)} />
            </label>
            <label>heightFalloff: {heightFalloff.toFixed(1)}
              <input type="range" min={0.1} max={5} step={0.1} value={heightFalloff} onChange={e => setHeightFalloff(+e.target.value)} />
            </label>
          </div>

          <div className="fow-control-group">
            <h3>디버그</h3>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} />
              LoS 디버그 (초록/빨강)
            </label>
            <div className="fow-info" style={{ fontSize: 11, lineHeight: 1.4 }}>
              초록=보임 | 노랑=부분 | 빨강=차단<br/>
              노란 구=눈 높이 | 흰 사각=hover<br/>
              블록 위 숫자=타일 높이
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
