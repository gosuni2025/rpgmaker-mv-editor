import React, { useCallback, useEffect, useRef, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';

// ─── 상수 ───
const GW = 816;
const GH = 624;
const WIN_H = 180;
const FACE_SZ = 144;
const PAD = 12;
const LINE_H = 36;

const VN_X = 60;
const VN_Y = 40;
const VN_W = 700;
const VN_H = 520;
const VN_OVERLAY_ALPHA = 120 / 255;
const VN_SPEAKER_COLOR = '#ffe066';
const TILE_SIZE = 48;

// ─── Props ───
interface MessagePreviewProps {
  faceName: string;
  faceIndex: number;
  background: number;
  positionType: number;
  text: string;
}

// ─── Window_Base 오프스크린 렌더러 생성 ───
function createTextRenderer(contentsW: number, contentsH: number): any | null {
  const WB = (window as any).Window_Base;
  const BitmapCls = (window as any).Bitmap;
  if (!WB || !BitmapCls) return null;

  const bmp = new BitmapCls(Math.max(1, contentsW), Math.max(1, contentsH));
  const r = Object.create(WB.prototype);

  Object.defineProperty(r, 'contents', { value: bmp,              writable: true, configurable: true });
  Object.defineProperty(r, 'width',    { value: contentsW + 36,   writable: true, configurable: true });
  Object.defineProperty(r, 'height',   { value: contentsH + 36,   writable: true, configurable: true });
  Object.defineProperty(r, 'padding',  { value: 18,               writable: true, configurable: true });

  r._windowskin = (window as any).ImageManager
    ? (window as any).ImageManager.loadSystem('Window')
    : null;

  r.normalColor = () => '#ffffff';
  r.textColor = (n: number) => {
    const ws = r._windowskin;
    if (ws && typeof ws.isReady === 'function' && ws.isReady()) {
      const px = 96 + (n % 8) * 12 + 6;
      const py = 144 + Math.floor(n / 8) * 12 + 6;
      const c = ws.getPixel(px, py);
      return c || '#ffffff';
    }
    return '#ffffff';
  };

  r._etTags = null;
  r._etEffectStack = [];
  r._etAnimSegs = [];

  try {
    WB.prototype.resetFontSettings.call(r);
  } catch (e) {
    try { bmp.fontFace = 'Dotum, AppleGothic, sans-serif'; } catch (_) {}
    try { bmp.fontSize = 28; } catch (_) {}
  }
  try { bmp.textColor = '#ffffff'; } catch (_) {}

  return r;
}

// ─── 텍스트를 renderer에 그리기 ───
function setupRendererText(renderer: any, lines: string[]) {
  const WB = (window as any).Window_Base;
  if (!WB || !renderer) return;
  renderer.contents.clear();
  renderer._etTags = null;
  renderer._etEffectStack = [];
  renderer._etAnimSegs = [];
  try { WB.prototype.resetFontSettings.call(renderer); } catch (e) {}
  try { renderer.contents.textColor = '#ffffff'; } catch (_) {}

  lines.forEach((line, i) => {
    try {
      WB.prototype.drawTextEx.call(renderer, line, 0, i * LINE_H);
    } catch (e) { /* ignore */ }
  });

  // windowskin 로드 완료 시 재그리기
  const ws = renderer._windowskin;
  if (ws && typeof ws.addLoadListener === 'function' && !ws.isReady?.()) {
    ws.addLoadListener(() => { setupRendererText(renderer, lines); });
  }
}

// ─── 레이아웃 계산 ───
interface Layout {
  windowX: number; windowY: number; windowW: number; windowH: number;
  faceX: number;   faceY: number;   faceW: number;   faceH: number;
  textX: number;   textY: number;   textW: number;   textH: number;
  speakerX: number; speakerY: number;
  dimAlpha: number; showWindow: boolean;
}
function computeLayout(
  isVN: boolean, bg: number, pt: number, hasFace: boolean, hasSpeaker: boolean,
): Layout {
  if (isVN) {
    const innerX = VN_X + PAD;
    const innerY = VN_Y + PAD;
    const faceW = hasFace ? 120 : 0;
    const textStartX = hasFace ? innerX + faceW + 12 : innerX;
    const textY = innerY + (hasSpeaker ? LINE_H : 0);
    const textW = VN_X + VN_W - textStartX - PAD;
    const textH = VN_Y + VN_H - textY - PAD;
    return {
      windowX: VN_X, windowY: VN_Y, windowW: VN_W, windowH: VN_H,
      faceX: innerX, faceY: innerY, faceW, faceH: 120,
      textX: textStartX, textY, textW, textH,
      speakerX: textStartX, speakerY: innerY,
      dimAlpha: VN_OVERLAY_ALPHA, showWindow: true,
    };
  } else {
    const winY = pt === 0 ? 0 : pt === 1 ? Math.floor((GH - WIN_H) / 2) : GH - WIN_H;
    const textX = hasFace ? PAD + FACE_SZ + 16 : PAD;
    const textW = GW - textX - PAD;
    return {
      windowX: 0, windowY: winY, windowW: GW, windowH: WIN_H,
      faceX: PAD, faceY: winY + PAD, faceW: FACE_SZ, faceH: FACE_SZ,
      textX, textY: winY + PAD, textW, textH: WIN_H - PAD * 2,
      speakerX: textX, speakerY: winY + PAD,
      dimAlpha: bg === 1 ? 0.5 : 0,
      showWindow: bg !== 2,
    };
  }
}

// ─── Three.js 헬퍼 ───
function getThree(): any { return (window as any).THREE; }

function makePlaneMesh(THREE: any, material: any): any {
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
}

// Y-down 좌표계: OrthographicCamera(0,GW, 0,GH) 기준
// position.set(x+w/2, y+h/2) 로 직접 배치 (flip 불필요)
function positionMesh(mesh: any, x: number, y: number, w: number, h: number) {
  mesh.position.set(x + w / 2, y + h / 2, 0);
  mesh.scale.set(w, h, 1);
}

// ─── Window.png 9-slice ShaderMaterial ───
// 카메라: Y-down, flipY=false → vUv.y=0=화면상단, vUv.y=1=화면하단
// Window.png 192×192: 배경(0,0,64,64), 테두리(64,64,64,64)
// flipY=false: V=0=이미지 상단 → 배경V∈[0,64/192], 테두리V∈[64/192,128/192]
const WINDOW_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const WINDOW_FRAG = `
uniform sampler2D tWindow;
uniform vec2 uDstSize;
const float BORDER = 12.0;

varying vec2 vUv;

vec2 nineSliceUV(vec2 uv, vec2 dstSize, float border) {
  float bx = border / dstSize.x;
  float by = border / dstSize.y;
  float sx, sy;
  if (uv.x < bx)            sx = uv.x / bx * (border / 64.0);
  else if (uv.x > 1.0 - bx) sx = (64.0 - border + (uv.x - (1.0 - bx)) / bx * border) / 64.0;
  else                       sx = (border + (uv.x - bx) / (1.0 - 2.0 * bx) * (64.0 - 2.0 * border)) / 64.0;
  if (uv.y < by)            sy = uv.y / by * (border / 64.0);
  else if (uv.y > 1.0 - by) sy = (64.0 - border + (uv.y - (1.0 - by)) / by * border) / 64.0;
  else                       sy = (border + (uv.y - by) / (1.0 - 2.0 * by) * (64.0 - 2.0 * border)) / 64.0;
  return vec2(sx, sy);
}

void main() {
  // 배경 타일: 이미지 (0,0)~(64,64) → V∈[0, 64/192]
  float bgU = mod(vUv.x * uDstSize.x / 64.0, 1.0) * (64.0 / 192.0);
  float bgV = mod(vUv.y * uDstSize.y / 64.0, 1.0) * (64.0 / 192.0);
  vec4 bg = texture2D(tWindow, vec2(bgU, bgV));
  bg.a *= 0.82;

  // 테두리 9-slice: 이미지 (64,64)~(128,128) → UV∈[64/192, 128/192]
  vec2 bUV = nineSliceUV(vUv, uDstSize, BORDER);
  vec2 borderUV = (vec2(1.0) + bUV) * (64.0 / 192.0);
  vec4 border = texture2D(tWindow, borderUV);

  gl_FragColor = mix(bg, border, border.a);
}
`;

// ─── 메인 컴포넌트 ───
export function MessagePreview({ faceName, faceIndex, background, positionType, text }: MessagePreviewProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const threeRef   = useRef<{
    renderer: any; scene: any; camera: any;
    mapBgMesh: any; dimMesh: any; windowMesh: any; faceMesh: any;
    textMesh: any; speakerMesh: any; arrowMesh: any;
    mapTexture: any; faceTexture: any; textTexture: any;
    speakerTexture: any; windowImg: HTMLImageElement | null;
    winTexLoaded: boolean; lastFaceName: string;
  } | null>(null);
  const rendererRef  = useRef<any>(null);
  const rafRef       = useRef(0);
  const sceneDirtyRef = useRef(true);  // 씬 업데이트 필요 플래그

  const currentMap      = useEditorStore((s) => s.currentMap);
  const selectedEventId = useEditorStore((s) => s.selectedEventId);
  const event           = currentMap?.events?.find((e) => e && e.id === selectedEventId);
  const eventTileX      = event?.x ?? null;
  const eventTileY      = event?.y ?? null;
  const eventTileRef    = useRef({ x: eventTileX, y: eventTileY });
  eventTileRef.current  = { x: eventTileX, y: eventTileY };

  const propsRef = useRef({ faceName, faceIndex, background, positionType, text });
  propsRef.current = { faceName, faceIndex, background, positionType, text };

  const [runtimeReady, setRuntimeReady] = useState(() =>
    !!(window as any).Window_Base && !!(window as any).Bitmap,
  );

  const isVNMode = text.split('\n').length > 4;

  const [vnScrollLine, setVnScrollLine] = useState(0);
  const vnScrollRef = useRef(0);
  useEffect(() => { vnScrollRef.current = vnScrollLine; sceneDirtyRef.current = true; }, [vnScrollLine]);

  // ─── 런타임 로드 대기 ───
  useEffect(() => {
    if (runtimeReady) return;
    const id = setInterval(() => {
      if ((window as any).Window_Base && (window as any).Bitmap) {
        setRuntimeReady(true); clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [runtimeReady]);

  // ─── Three.js 초기화 (최초 1회) ───
  const initThree = useCallback(() => {
    const THREE = getThree();
    if (!THREE || !canvasRef.current || threeRef.current) return;

    // Y-down OrthographicCamera: top=0, bottom=GH
    // → world Y=0=화면 상단, world Y=GH=화면 하단
    const camera = new THREE.OrthographicCamera(0, GW, 0, GH, -100, 100);
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setSize(GW, GH);
    renderer.setClearColor(0x222222, 1);

    const scene = new THREE.Scene();

    const mat = (cfg: any) => new THREE.MeshBasicMaterial({
      depthTest: false, depthWrite: false, transparent: true, ...cfg,
    });

    // 0: 맵 배경
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = GW; mapCanvas.height = GH;
    const mapTexture = new THREE.CanvasTexture(mapCanvas);
    mapTexture.flipY = false;  // Y-down 카메라 기준 — flip 불필요
    const mapBgMesh = makePlaneMesh(THREE, mat({ map: mapTexture, transparent: false }));
    mapBgMesh.renderOrder = 0;
    positionMesh(mapBgMesh, 0, 0, GW, GH);
    scene.add(mapBgMesh);

    // 1: dim 오버레이
    const dimMesh = makePlaneMesh(THREE, mat({ color: 0x000000, opacity: 0 }));
    dimMesh.renderOrder = 1;
    positionMesh(dimMesh, 0, 0, GW, GH);
    scene.add(dimMesh);

    // 2: window frame (9-slice shader)
    const windowMat = new THREE.ShaderMaterial({
      uniforms: {
        tWindow: { value: new THREE.Texture() },
        uDstSize: { value: new THREE.Vector2(GW, WIN_H) },
      },
      vertexShader: WINDOW_VERT,
      fragmentShader: WINDOW_FRAG,
      transparent: true, depthTest: false, depthWrite: false,
    });
    const windowMesh = makePlaneMesh(THREE, windowMat);
    windowMesh.renderOrder = 2;
    windowMesh.visible = false;
    scene.add(windowMesh);

    // 3: face
    const faceMesh = makePlaneMesh(THREE, mat({ transparent: true }));
    faceMesh.renderOrder = 3;
    faceMesh.visible = false;
    scene.add(faceMesh);

    // 4: text bitmap
    const textMesh = makePlaneMesh(THREE, mat({ transparent: true }));
    textMesh.renderOrder = 4;
    textMesh.visible = false;
    scene.add(textMesh);

    // 5: speaker name (VN 모드)
    const speakerMesh = makePlaneMesh(THREE, mat({ transparent: true }));
    speakerMesh.renderOrder = 5;
    speakerMesh.visible = false;
    scene.add(speakerMesh);

    // 6: ▼ 화살표
    const arrowCanvas = document.createElement('canvas');
    arrowCanvas.width = 32; arrowCanvas.height = 32;
    const arrowCtx = arrowCanvas.getContext('2d')!;
    arrowCtx.fillStyle = 'rgba(255,255,255,0.7)';
    arrowCtx.font = '20px serif';
    arrowCtx.fillText('▼', 6, 22);
    const arrowTex = new THREE.CanvasTexture(arrowCanvas);
    arrowTex.flipY = false;
    const arrowMesh = makePlaneMesh(THREE, mat({ map: arrowTex }));
    arrowMesh.renderOrder = 6;
    arrowMesh.visible = false;
    scene.add(arrowMesh);

    threeRef.current = {
      renderer, scene, camera,
      mapBgMesh, dimMesh, windowMesh, faceMesh,
      textMesh, speakerMesh, arrowMesh,
      mapTexture, faceTexture: null, textTexture: null, speakerTexture: null,
      windowImg: null, winTexLoaded: false, lastFaceName: '',
    };

    // Window.png 로드
    const img = new Image();
    img.onload = () => {
      const t = threeRef.current;
      if (!t) return;
      t.windowImg = img;
      t.winTexLoaded = true;
      const tex = new THREE.Texture(img);
      tex.flipY = false;  // Y-down 카메라 기준
      tex.needsUpdate = true;
      t.windowMesh.material.uniforms.tWindow.value = tex;
      sceneDirtyRef.current = true;
    };
    img.src = '/img/system/Window.png';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 씬 메시 업데이트 (dirty 플래그 소비) ───
  const updateScene = useCallback(() => {
    const t = threeRef.current;
    const THREE = getThree();
    if (!t || !THREE) return;

    const { faceName: fn, faceIndex: fi, background: bg, positionType: pt, text: txt } = propsRef.current;
    const isVN = txt.split('\n').length > 4;
    const hasFace = !!fn;
    const hasSpeaker = isVN && !!fn;
    const layout = computeLayout(isVN, bg, pt, hasFace, hasSpeaker);

    // dim
    t.dimMesh.material.opacity = layout.dimAlpha;

    // window frame
    if (layout.showWindow) {
      positionMesh(t.windowMesh, layout.windowX, layout.windowY, layout.windowW, layout.windowH);
      t.windowMesh.material.uniforms.uDstSize.value.set(layout.windowW, layout.windowH);
      // Window.png 미로드 시 폴백: 단색 오버레이로 교체
      if (!t.winTexLoaded) {
        // ShaderMaterial로 유지, 배경이 보이지 않으면 fallback canvas texture 사용
        const fbCanvas = document.createElement('canvas');
        fbCanvas.width = 4; fbCanvas.height = 4;
        const fbCtx = fbCanvas.getContext('2d')!;
        fbCtx.fillStyle = 'rgba(8,14,40,0.9)';
        fbCtx.fillRect(0, 0, 4, 4);
        const fbTex = new THREE.CanvasTexture(fbCanvas);
        fbTex.flipY = false;
        t.windowMesh.material.uniforms.tWindow.value = fbTex;
      }
      t.windowMesh.visible = true;
    } else {
      t.windowMesh.visible = false;
    }

    // face
    if (hasFace && fn) {
      if (t.lastFaceName !== fn) {
        t.lastFaceName = fn;
        const faceImg = new Image();
        faceImg.onload = () => {
          const t2 = threeRef.current;
          if (!t2) return;
          if (t2.faceTexture) t2.faceTexture.dispose();
          const tex = new THREE.Texture(faceImg);
          tex.flipY = false;  // Y-down 기준
          // UV: 4×2 face sheet에서 선택
          const col = fi % 4;
          const row = Math.floor(fi / 4);
          const totalW = faceImg.naturalWidth  || (FACE_SZ * 4);
          const totalH = faceImg.naturalHeight || (FACE_SZ * 2);
          const uW = FACE_SZ / totalW;
          const uH = FACE_SZ / totalH;
          tex.repeat.set(uW, uH);
          tex.offset.set(col * uW, row * uH);  // Y-down: row 0=상단 → V=0=이미지 상단 ✓
          tex.needsUpdate = true;
          t2.faceTexture = tex;
          t2.faceMesh.material.map = tex;
          t2.faceMesh.material.needsUpdate = true;
          positionMesh(t2.faceMesh, layout.faceX, layout.faceY, layout.faceW, layout.faceH);
          t2.faceMesh.visible = true;
        };
        faceImg.src = `/img/faces/${fn}.png`;
      } else {
        // faceIndex 변경만 → UV 재계산
        const tex = t.faceTexture;
        if (tex && tex.image) {
          const col = fi % 4;
          const row = Math.floor(fi / 4);
          const totalW = tex.image.naturalWidth  || (FACE_SZ * 4);
          const totalH = tex.image.naturalHeight || (FACE_SZ * 2);
          tex.repeat.set(FACE_SZ / totalW, FACE_SZ / totalH);
          tex.offset.set(col * (FACE_SZ / totalW), row * (FACE_SZ / totalH));
          tex.needsUpdate = true;
        }
        positionMesh(t.faceMesh, layout.faceX, layout.faceY, layout.faceW, layout.faceH);
        t.faceMesh.visible = true;
      }
    } else {
      t.faceMesh.visible = false;
    }

    // text bitmap
    const textRenderer = rendererRef.current;
    if (textRenderer?.contents) {
      const bmpCanvas = textRenderer.contents.canvas || textRenderer.contents._canvas;
      if (bmpCanvas) {
        if (t.textTexture) t.textTexture.dispose();
        const tex = new THREE.CanvasTexture(bmpCanvas);
        tex.flipY = false;  // Y-down 기준
        // VN 스크롤: Y-down + flipY=false → V=0=canvas 상단 → offset.y = scrollY/totalH
        if (isVN) {
          const totalH = bmpCanvas.height;
          const visH = layout.textH;
          const scrollY = vnScrollRef.current * LINE_H;
          tex.repeat.set(1, visH / totalH);
          tex.offset.set(0, scrollY / totalH);
        }
        t.textTexture = tex;
        t.textMesh.material.map = tex;
        t.textMesh.material.needsUpdate = true;
        positionMesh(t.textMesh, layout.textX, layout.textY, layout.textW, layout.textH);
        t.textMesh.visible = true;
      }
    } else {
      t.textMesh.visible = false;
    }

    // speaker name (VN)
    if (hasSpeaker && fn) {
      const spW = Math.max(100, fn.length * 16 + 20);
      const spH = LINE_H;
      const spCanvas = document.createElement('canvas');
      spCanvas.width = spW; spCanvas.height = spH;
      const spCtx = spCanvas.getContext('2d')!;
      spCtx.clearRect(0, 0, spW, spH);
      spCtx.font = `bold 22px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
      spCtx.fillStyle = '#000000';
      spCtx.fillText(fn, 1, 23);
      spCtx.fillStyle = VN_SPEAKER_COLOR;
      spCtx.fillText(fn, 0, 22);
      if (t.speakerTexture) t.speakerTexture.dispose();
      const spTex = new THREE.CanvasTexture(spCanvas);
      spTex.flipY = false;
      t.speakerTexture = spTex;
      t.speakerMesh.material.map = spTex;
      t.speakerMesh.material.needsUpdate = true;
      positionMesh(t.speakerMesh, layout.speakerX, layout.speakerY, spW, spH);
      t.speakerMesh.visible = true;
    } else {
      t.speakerMesh.visible = false;
    }

    // 화살표 ▼
    if (layout.showWindow) {
      positionMesh(t.arrowMesh, layout.windowX + layout.windowW - 28, layout.windowY + layout.windowH - 28, 24, 24);
      t.arrowMesh.visible = true;
    } else {
      t.arrowMesh.visible = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── renderer(Window_Base) 생성 ───
  const buildRenderer = useCallback((resetScroll = false) => {
    if (!runtimeReady) return;
    const allLines = propsRef.current.text.split('\n');
    const fn = propsRef.current.faceName;
    const isVN = allLines.length > 4;
    const hasFace = !!fn;

    let contentsW: number, contentsH: number;
    if (isVN) {
      contentsW = VN_W - PAD * 2 - (hasFace ? 120 + 12 : 0);
      contentsH = Math.max(LINE_H, allLines.length * LINE_H);
    } else {
      contentsW = GW - PAD * 2 - (hasFace ? FACE_SZ + 16 : 0);
      contentsH = WIN_H - PAD * 2;
    }

    const r = createTextRenderer(contentsW, contentsH);
    rendererRef.current = r;
    if (r) setupRendererText(r, isVN ? allLines : allLines.slice(0, 4));
    if (resetScroll) setVnScrollLine(0);
    sceneDirtyRef.current = true;
  }, [runtimeReady]);

  useEffect(() => { buildRenderer(true); }, [runtimeReady, text, faceName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sceneDirtyRef.current = true; }, [faceName, faceIndex, background, positionType, text]);

  const handleReplay = useCallback(() => { buildRenderer(true); }, [buildRenderer]);

  // ─── RAF 루프 ───
  useEffect(() => {
    if (!runtimeReady) return;

    initThree();       // 최초 1회 초기화
    updateScene();     // 초기화 직후 즉시 씬 업데이트
    sceneDirtyRef.current = false;

    let running = true;
    const tick = () => {
      if (!running) return;

      const t = threeRef.current;
      const canvas = canvasRef.current;
      if (!t || !canvas) { rafRef.current = requestAnimationFrame(tick); return; }

      const THREE = getThree();

      // ExtendedText 시간 진행
      const ET = (window as any).ExtendedText;
      if (ET) ET._time += 1 / 60;

      // ExtendedText 애니메이션 패스
      const r = rendererRef.current;
      if (r?._etAnimSegs?.length > 0) {
        try { r._etRunAnimPass(); } catch (_) {}
      }

      // 씬 dirty 시 업데이트
      if (sceneDirtyRef.current) {
        updateScene();
        sceneDirtyRef.current = false;
      }

      // 맵 배경 텍스처 매 프레임 갱신
      const mapCanvas = ((window as any)._editorRendererObj?.view) as HTMLCanvasElement | null | undefined;
      const offCanvas = t.mapTexture.image as HTMLCanvasElement;
      if (offCanvas && mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
        const ctx2d = offCanvas.getContext('2d');
        if (ctx2d) {
          const { x: evX, y: evY } = eventTileRef.current;
          let srcX = 0, srcY = 0;
          if (evX !== null && evY !== null) {
            srcX = Math.max(0, Math.min(Math.round(evX * TILE_SIZE + TILE_SIZE / 2 - GW / 2), mapCanvas.width  - GW));
            srcY = Math.max(0, Math.min(Math.round(evY * TILE_SIZE + TILE_SIZE / 2 - GH / 2), mapCanvas.height - GH));
          }
          ctx2d.drawImage(mapCanvas, srcX, srcY, GW, GH, 0, 0, GW, GH);
          ctx2d.fillStyle = 'rgba(0,0,0,0.25)';
          ctx2d.fillRect(0, 0, GW, GH);
          t.mapTexture.needsUpdate = true;
        }
      } else if (!mapCanvas || mapCanvas.width === 0) {
        const ctx2d = offCanvas?.getContext('2d');
        if (ctx2d) {
          ctx2d.fillStyle = '#3a4a5a';
          ctx2d.fillRect(0, 0, GW, GH);
          t.mapTexture.needsUpdate = true;
        }
      }

      // textTexture 애니메이션 갱신
      if (r?._etAnimSegs?.length > 0 && t.textTexture) {
        t.textTexture.needsUpdate = true;
      }

      // Three.js 렌더링
      t.renderer.render(t.scene, t.camera);

      // WebGL canvas → 2D preview canvas 복사
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(t.renderer.domElement, 0, 0, GW, GH, 0, 0, GW, GH);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeReady]);

  // ─── 언마운트 정리 ───
  useEffect(() => () => {
    const t = threeRef.current;
    if (!t) return;
    [t.mapTexture, t.faceTexture, t.textTexture, t.speakerTexture].forEach(tx => tx?.dispose());
    [t.mapBgMesh, t.dimMesh, t.windowMesh, t.faceMesh, t.textMesh, t.speakerMesh, t.arrowMesh].forEach(m => {
      m?.geometry?.dispose(); m?.material?.dispose();
    });
    t.renderer?.dispose();
    threeRef.current = null;
  }, []);

  // VN 스크롤 계산
  const vnAllLines = isVNMode ? text.split('\n') : [];
  const vnHasFace  = isVNMode && !!faceName;
  const vnCurY     = VN_Y + PAD + (vnHasFace ? LINE_H : 0);
  const vnClipH    = VN_Y + VN_H - vnCurY - PAD;
  const vnMaxVisLines = Math.floor(vnClipH / LINE_H);
  const vnMaxScroll   = Math.max(0, vnAllLines.length - vnMaxVisLines);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isVNMode) return;
    e.preventDefault();
    setVnScrollLine(prev => Math.max(0, Math.min(vnMaxScroll, prev + (e.deltaY > 0 ? 1 : -1))));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 4 }}>
      <div style={{ fontSize: 11, color: isVNMode ? '#ffe066' : '#666', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {isVNMode
          ? <><span style={{ background: '#5a4200', border: '1px solid #ffe066', borderRadius: 3, padding: '1px 6px', color: '#ffe066', fontWeight: 'bold' }}>VN MODE</span> 4줄 초과 — Visual Novel 렌더링</>
          : <><span style={{ background: '#1a3a1a', border: '1px solid #4a8', borderRadius: 3, padding: '1px 6px', color: '#4da' }}>NORMAL</span> Window_Message 렌더링</>
        }
        <button
          onClick={handleReplay}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 8px', background: '#2a3a5a', border: '1px solid #4a6a9a', borderRadius: 3, color: '#9cf', cursor: 'pointer' }}
          title="애니메이션 다시 재생"
        >▶ 재생</button>
        {isVNMode && vnMaxScroll > 0 && (
          <>
            <button onClick={() => setVnScrollLine(p => Math.max(0, p - 1))} disabled={vnScrollLine <= 0}
              style={{ fontSize: 11, padding: '1px 6px', background: '#2a2a2a', border: '1px solid #555', borderRadius: 3, color: '#ccc', cursor: 'pointer' }}>▲</button>
            <span style={{ color: '#888', fontSize: 11 }}>{vnScrollLine + 1}/{vnAllLines.length}</span>
            <button onClick={() => setVnScrollLine(p => Math.min(vnMaxScroll, p + 1))} disabled={vnScrollLine >= vnMaxScroll}
              style={{ fontSize: 11, padding: '1px 6px', background: '#2a2a2a', border: '1px solid #555', borderRadius: 3, color: '#ccc', cursor: 'pointer' }}>▼</button>
          </>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={GW}
        height={GH}
        onWheel={handleWheel}
        style={{ width: '100%', aspectRatio: `${GW}/${GH}`, display: 'block', imageRendering: 'pixelated', background: '#222', cursor: isVNMode && vnMaxScroll > 0 ? 'ns-resize' : 'default' }}
      />

      {!runtimeReady && <div style={{ fontSize: 11, color: '#888' }}>런타임 로딩 중...</div>}
    </div>
  );
}
