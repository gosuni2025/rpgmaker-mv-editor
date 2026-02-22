import React, { useEffect, useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { GW, GH, WIN_H, TILE_SIZE, getThree, makePlaneMesh, positionMesh, WINDOW_VERT, WINDOW_FRAG } from './messagePreviewUtils';

export interface PictureSnapshot {
  imageName: string;
  origin: number;         // 0=좌상단, 1=중앙
  positionType: number;   // 0=직접, 1=변수, 2=프리셋
  posX: number;
  posY: number;
  presetX: number;        // 1=0%, 2=25%, 3=50%, 4=75%, 5=100%
  presetY: number;
  presetOffsetX: number;
  presetOffsetY: number;
  scaleWidth: number;     // %
  scaleHeight: number;    // %
  opacity: number;        // 0~255
  blendMode: number;      // 0=일반, 1=추가, 2=곱하기, 3=스크린
}

// 게임 좌표에서 Three.js mesh 위치/크기 계산
function computePicRect(snap: PictureSnapshot, imgW: number, imgH: number) {
  const w = Math.max(1, imgW * snap.scaleWidth / 100);
  const h = Math.max(1, imgH * snap.scaleHeight / 100);
  let px = snap.posX, py = snap.posY;
  if (snap.positionType === 2) {
    px = (snap.presetX - 1) * GW / 4 + snap.presetOffsetX;
    py = (snap.presetY - 1) * GH / 4 + snap.presetOffsetY;
  }
  const x = snap.origin === 0 ? px : px - w / 2;
  const y = snap.origin === 0 ? py : py - h / 2;
  return { x, y, w, h };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function lerpSnap(a: PictureSnapshot, b: PictureSnapshot, t: number): PictureSnapshot {
  return {
    ...b,
    posX: lerp(a.posX, b.posX, t),
    posY: lerp(a.posY, b.posY, t),
    scaleWidth: lerp(a.scaleWidth, b.scaleWidth, t),
    scaleHeight: lerp(a.scaleHeight, b.scaleHeight, t),
    opacity: lerp(a.opacity, b.opacity, t),
  };
}

interface PicRefs {
  renderer: any; scene: any; camera: any;
  mapBgMesh: any; pictureMesh: any; windowMesh: any;
  mapCanvas: HTMLCanvasElement; mapTexture: any;
  picTexture: any | null;
  lastImageName: string;
  imgNatW: number; imgNatH: number;
}

function initScene(canvas: HTMLCanvasElement): PicRefs | null {
  const THREE = getThree();
  if (!THREE) return null;

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(GW, GH);
  renderer.setClearColor(0x222222, 1);

  const camera = new THREE.OrthographicCamera(0, GW, 0, GH, -100, 100);
  camera.position.set(0, 0, 50);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  const mat = (cfg: any) => new THREE.MeshBasicMaterial({
    depthTest: false, depthWrite: false, transparent: true,
    side: THREE.DoubleSide, ...cfg,
  });

  // 맵 배경
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = GW; mapCanvas.height = GH;
  const mapTexture = new THREE.CanvasTexture(mapCanvas);
  mapTexture.flipY = false;
  const mapBgMesh = makePlaneMesh(THREE, mat({ map: mapTexture, transparent: false }));
  mapBgMesh.renderOrder = 0;
  positionMesh(mapBgMesh, 0, 0, GW, GH);
  scene.add(mapBgMesh);

  // 그림 메시
  const pictureMesh = makePlaneMesh(THREE, mat({ transparent: true }));
  pictureMesh.renderOrder = 5;
  pictureMesh.visible = false;
  scene.add(pictureMesh);

  // 대화창 (9-slice shader, 화면 하단)
  const windowMat = new THREE.ShaderMaterial({
    uniforms: {
      tWindow: { value: new THREE.Texture() },
      uDstSize: { value: new THREE.Vector2(GW, WIN_H) },
    },
    vertexShader: WINDOW_VERT,
    fragmentShader: WINDOW_FRAG,
    transparent: true, depthTest: false, depthWrite: false,
    side: THREE.DoubleSide,
  });
  const windowMesh = makePlaneMesh(THREE, windowMat);
  windowMesh.renderOrder = 10;
  windowMesh.visible = false;
  positionMesh(windowMesh, 0, GH - WIN_H, GW, WIN_H);
  scene.add(windowMesh);

  const refs: PicRefs = { renderer, scene, camera, mapBgMesh, pictureMesh, windowMesh, mapCanvas, mapTexture, picTexture: null, lastImageName: '', imgNatW: 0, imgNatH: 0 };

  // Window.png 로드 (비동기)
  const winImg = new Image();
  winImg.onload = () => {
    const tex = new THREE.Texture(winImg);
    tex.flipY = false; tex.needsUpdate = true;
    windowMesh.material.uniforms.tWindow.value = tex;
  };
  winImg.src = '/img/system/Window.png';

  return refs;
}

interface Props {
  current: PictureSnapshot;
  from?: PictureSnapshot | null;   // 이동 시작 상태
  durationMs?: number;             // 애니메이션 지속 시간 (ms)
  replayTrigger?: number;          // 변경 시 애니메이션 재시작
  showWindow?: boolean;            // 대화창 표시 여부
}

export function PicturePreview({ current, from, durationMs = 1000, replayTrigger = 0, showWindow = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refsRef = useRef<PicRefs | null>(null);
  const rafRef = useRef(0);
  const animRef = useRef<{ startTime: number; durationMs: number } | null>(null);

  const currentMap = useEditorStore(s => s.currentMap);
  const selectedEventId = useEditorStore(s => s.selectedEventId);
  const event = currentMap?.events?.find(e => e?.id === selectedEventId);
  const eventTileRef = useRef({ x: event?.x ?? null, y: event?.y ?? null });
  eventTileRef.current = { x: event?.x ?? null, y: event?.y ?? null };

  const currentRef = useRef(current);
  currentRef.current = current;
  const fromRef = useRef(from ?? null);
  fromRef.current = from ?? null;
  const durRef = useRef(durationMs);
  durRef.current = durationMs;
  const showWindowRef = useRef(showWindow);
  showWindowRef.current = showWindow;

  // 재생 트리거
  useEffect(() => {
    if (replayTrigger === 0) return;
    animRef.current = { startTime: performance.now(), durationMs: durRef.current };
  }, [replayTrigger]);

  // Three.js 씬 초기화
  useEffect(() => {
    if (!canvasRef.current || refsRef.current) return;
    refsRef.current = initScene(canvasRef.current);
  }, []);

  // RAF 루프
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      const refs = refsRef.current;
      const canvas = canvasRef.current;
      const THREE = getThree();
      if (!refs || !canvas || !THREE) { rafRef.current = requestAnimationFrame(tick); return; }

      // 애니메이션 진행률
      let t = 1;
      if (animRef.current) {
        const elapsed = performance.now() - animRef.current.startTime;
        t = Math.min(1, elapsed / animRef.current.durationMs);
        if (t >= 1) animRef.current = null;
      }

      const fromSnap = fromRef.current;
      const snap: PictureSnapshot = (fromSnap && t < 1) ? lerpSnap(fromSnap, currentRef.current, t) : currentRef.current;

      // 이미지 로드/교체
      if (snap.imageName !== refs.lastImageName) {
        refs.lastImageName = snap.imageName;
        refs.imgNatW = 0; refs.imgNatH = 0;
        refs.pictureMesh.visible = false;
        if (snap.imageName) {
          const name = snap.imageName;
          const img = new Image();
          img.onload = () => {
            const r = refsRef.current;
            if (!r || r.lastImageName !== name) return;
            if (r.picTexture) r.picTexture.dispose();
            const tex = new THREE.Texture(img);
            tex.flipY = false; tex.needsUpdate = true;
            r.picTexture = tex;
            r.imgNatW = img.naturalWidth;
            r.imgNatH = img.naturalHeight;
            r.pictureMesh.material.map = tex;
            r.pictureMesh.material.needsUpdate = true;
          };
          img.src = `/img/pictures/${name}.png`;
        }
      }

      // 위치/크기/투명도/블렌드 업데이트
      if (refs.picTexture && refs.imgNatW > 0) {
        const { x, y, w, h } = computePicRect(snap, refs.imgNatW, refs.imgNatH);
        positionMesh(refs.pictureMesh, x, y, w, h);
        refs.pictureMesh.material.opacity = snap.opacity / 255;
        refs.pictureMesh.material.blending =
          snap.blendMode === 1 ? THREE.AdditiveBlending :
          snap.blendMode === 2 ? THREE.MultiplyBlending :
          THREE.NormalBlending;
        refs.pictureMesh.material.needsUpdate = true;
        refs.pictureMesh.visible = true;
      }

      // 맵 배경 갱신
      const mapCanvasSrc = ((window as any)._editorRendererObj?.view) as HTMLCanvasElement | null;
      const ctx2d = refs.mapCanvas.getContext('2d');
      if (ctx2d && mapCanvasSrc && mapCanvasSrc.width > 0) {
        const et = eventTileRef.current;
        const srcX = et.x !== null ? Math.max(0, Math.min(Math.round(et.x * TILE_SIZE + TILE_SIZE / 2 - GW / 2), mapCanvasSrc.width - GW)) : 0;
        const srcY = et.y !== null ? Math.max(0, Math.min(Math.round(et.y * TILE_SIZE + TILE_SIZE / 2 - GH / 2), mapCanvasSrc.height - GH)) : 0;
        ctx2d.drawImage(mapCanvasSrc, srcX, srcY, GW, GH, 0, 0, GW, GH);
        ctx2d.fillStyle = 'rgba(0,0,0,0.15)';
        ctx2d.fillRect(0, 0, GW, GH);
        refs.mapTexture.needsUpdate = true;
      } else if (ctx2d) {
        ctx2d.fillStyle = '#3a4a5a';
        ctx2d.fillRect(0, 0, GW, GH);
        refs.mapTexture.needsUpdate = true;
      }

      // 대화창 visible 제어
      refs.windowMesh.visible = showWindowRef.current;

      refs.renderer.render(refs.scene, refs.camera);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(refs.renderer.domElement, 0, 0, GW, GH, 0, 0, GW, GH);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  // 언마운트 정리
  useEffect(() => () => {
    const refs = refsRef.current;
    if (refs) {
      refs.picTexture?.dispose();
      refs.mapTexture?.dispose();
      refs.renderer?.dispose();
      refsRef.current = null;
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={GW}
      height={GH}
      style={{
        width: '100%',
        aspectRatio: `${GW}/${GH}`,
        display: 'block',
        imageRendering: 'pixelated',
        background: '#222',
      }}
    />
  );
}
