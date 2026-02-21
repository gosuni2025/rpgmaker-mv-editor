import {
  GW, GH, WIN_H, FACE_SZ, PAD, LINE_H, TILE_SIZE,
  VN_X, VN_Y, VN_W, VN_H, VN_SPEAKER_COLOR,
  Layout, computeLayout,
  createTextRenderer, setupRendererText,
  getThree, makePlaneMesh, makePlaceholderTex, positionMesh,
  WINDOW_VERT, WINDOW_FRAG,
  ThreeRefs,
} from './messagePreviewUtils';

// ─── Three.js 씬 초기화 ───
export function initThreeScene(
  canvas: HTMLCanvasElement,
): ThreeRefs | null {
  const THREE = getThree();
  if (!THREE) return null;

  const camera = new THREE.OrthographicCamera(0, GW, 0, GH, -100, 100);
  camera.position.set(0, 0, 50);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setSize(GW, GH);
  renderer.setClearColor(0x222222, 1);

  const scene = new THREE.Scene();

  const mat = (cfg: any) => new THREE.MeshBasicMaterial({
    depthTest: false, depthWrite: false, transparent: true,
    side: THREE.DoubleSide, ...cfg,
  });

  // 0: 맵 배경
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = GW; mapCanvas.height = GH;
  const mapTexture = new THREE.CanvasTexture(mapCanvas);
  mapTexture.flipY = false;
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
    side: THREE.DoubleSide,
  });
  const windowMesh = makePlaneMesh(THREE, windowMat);
  windowMesh.renderOrder = 2;
  windowMesh.visible = false;
  scene.add(windowMesh);

  // 3: face
  const facePlaceholder = makePlaceholderTex(THREE);
  const faceMesh = makePlaneMesh(THREE, mat({ map: facePlaceholder, transparent: true }));
  faceMesh.renderOrder = 3;
  faceMesh.visible = false;
  scene.add(faceMesh);

  // 4: text bitmap
  const textOffCanvas = document.createElement('canvas');
  textOffCanvas.width = GW; textOffCanvas.height = GH;
  const textTextureBuf = new THREE.CanvasTexture(textOffCanvas);
  textTextureBuf.flipY = false;
  const textMesh = makePlaneMesh(THREE, mat({ map: textTextureBuf }));
  textMesh.renderOrder = 4;
  textMesh.visible = false;
  scene.add(textMesh);

  // 5: speaker name (VN 모드)
  const speakerPlaceholder = makePlaceholderTex(THREE);
  const speakerMesh = makePlaneMesh(THREE, mat({ map: speakerPlaceholder, transparent: true }));
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

  const refs: ThreeRefs = {
    renderer, scene, camera,
    mapBgMesh, dimMesh, windowMesh, faceMesh,
    textMesh, speakerMesh, arrowMesh,
    mapTexture, faceTexture: null, textTexture: textTextureBuf,
    textOffCanvas,
    speakerTexture: null,
    windowImg: null, winTexLoaded: false, lastFaceName: '',
  };

  // ExtendedText 오버레이를 프리뷰 씬에 연결
  const ET = (window as any).ExtendedText;
  if (ET) ET._overlayScene = scene;

  // Window.png 로드
  const img = new Image();
  img.onload = () => {
    refs.windowImg = img;
    refs.winTexLoaded = true;
    const tex = new THREE.Texture(img);
    tex.flipY = false;
    tex.needsUpdate = true;
    refs.windowMesh.material.uniforms.tWindow.value = tex;
  };
  img.src = '/img/system/Window.png';

  return refs;
}

// ─── 씬 메시 업데이트 ───
export function updateSceneMeshes(
  t: ThreeRefs,
  faceName: string, faceIndex: number, background: number, positionType: number, text: string,
  textRenderer: any, vnScrollLine: number,
) {
  const THREE = getThree();
  if (!THREE) return;

  const isVN = text.split('\n').length > 4;
  const hasFace = !!faceName;
  const hasSpeaker = isVN && !!faceName;
  const layout = computeLayout(isVN, background, positionType, hasFace, hasSpeaker);

  // dim
  t.dimMesh.material.opacity = layout.dimAlpha;

  // window frame
  if (layout.showWindow) {
    positionMesh(t.windowMesh, layout.windowX, layout.windowY, layout.windowW, layout.windowH);
    t.windowMesh.material.uniforms.uDstSize.value.set(layout.windowW, layout.windowH);
    if (!t.winTexLoaded) {
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
  updateFaceMesh(t, THREE, faceName, faceIndex, layout);

  // ExtendedText 오버레이 위치 기준점
  if (textRenderer) {
    textRenderer._etWindowX = layout.textX;
    textRenderer._etWindowY = layout.textY;
    textRenderer._etPadding = 0;
    textRenderer._etScrollY = isVN ? vnScrollLine * LINE_H : 0;
  }

  // text bitmap
  updateTextMesh(t, textRenderer, isVN, vnScrollLine, layout);

  // speaker name (VN)
  updateSpeakerMesh(t, THREE, faceName, hasSpeaker, layout);

  // 화살표 ▼
  if (layout.showWindow) {
    positionMesh(t.arrowMesh, layout.windowX + layout.windowW - 28, layout.windowY + layout.windowH - 28, 24, 24);
    t.arrowMesh.visible = true;
  } else {
    t.arrowMesh.visible = false;
  }
}

function updateFaceMesh(t: ThreeRefs, THREE: any, faceName: string, faceIndex: number, layout: Layout) {
  if (!faceName) { t.faceMesh.visible = false; return; }

  if (t.lastFaceName !== faceName) {
    t.lastFaceName = faceName;
    const faceImg = new Image();
    faceImg.onload = () => {
      if (t.faceTexture) t.faceTexture.dispose();
      const tex = new THREE.Texture(faceImg);
      tex.flipY = false;
      const col = faceIndex % 4;
      const row = Math.floor(faceIndex / 4);
      const totalW = faceImg.naturalWidth || (FACE_SZ * 4);
      const totalH = faceImg.naturalHeight || (FACE_SZ * 2);
      const uW = FACE_SZ / totalW;
      const uH = FACE_SZ / totalH;
      tex.repeat.set(uW, uH);
      tex.offset.set(col * uW, row * uH);
      tex.needsUpdate = true;
      t.faceTexture = tex;
      t.faceMesh.material.map = tex;
      t.faceMesh.material.needsUpdate = true;
      positionMesh(t.faceMesh, layout.faceX, layout.faceY, layout.faceW, layout.faceH);
      t.faceMesh.visible = true;
    };
    faceImg.src = `/img/faces/${faceName}.png`;
  } else {
    const tex = t.faceTexture;
    if (tex && tex.image) {
      const col = faceIndex % 4;
      const row = Math.floor(faceIndex / 4);
      const totalW = tex.image.naturalWidth || (FACE_SZ * 4);
      const totalH = tex.image.naturalHeight || (FACE_SZ * 2);
      tex.repeat.set(FACE_SZ / totalW, FACE_SZ / totalH);
      tex.offset.set(col * (FACE_SZ / totalW), row * (FACE_SZ / totalH));
      tex.needsUpdate = true;
    }
    positionMesh(t.faceMesh, layout.faceX, layout.faceY, layout.faceW, layout.faceH);
    t.faceMesh.visible = true;
  }
}

function updateTextMesh(t: ThreeRefs, textRenderer: any, isVN: boolean, vnScrollLine: number, layout: Layout) {
  const textOffCanvas = t.textOffCanvas;
  const textCtx = textOffCanvas.getContext('2d')!;
  if (textRenderer?.contents) {
    const bmpCanvas = (textRenderer.contents.canvas || textRenderer.contents._canvas) as HTMLCanvasElement | null;
    if (bmpCanvas && bmpCanvas.width > 0 && bmpCanvas.height > 0) {
      const tex = t.textTexture;
      if (isVN) {
        const scrollY = vnScrollLine * LINE_H;
        tex.repeat.set(bmpCanvas.width / GW, layout.textH / GH);
        tex.offset.set(0, scrollY / GH);
      } else {
        tex.repeat.set(layout.textW / GW, layout.textH / GH);
        tex.offset.set(0, 0);
      }
      tex.needsUpdate = true;
      positionMesh(t.textMesh, layout.textX, layout.textY, layout.textW, layout.textH);
      t.textMesh.visible = true;
    } else {
      textCtx.clearRect(0, 0, textOffCanvas.width, textOffCanvas.height);
      t.textMesh.visible = false;
    }
  } else {
    textCtx.clearRect(0, 0, textOffCanvas.width, textOffCanvas.height);
    t.textMesh.visible = false;
  }
}

function updateSpeakerMesh(t: ThreeRefs, THREE: any, faceName: string, hasSpeaker: boolean, layout: Layout) {
  if (hasSpeaker && faceName) {
    const spW = Math.max(100, faceName.length * 16 + 20);
    const spH = LINE_H;
    const spCanvas = document.createElement('canvas');
    spCanvas.width = spW; spCanvas.height = spH;
    const spCtx = spCanvas.getContext('2d')!;
    spCtx.clearRect(0, 0, spW, spH);
    spCtx.font = `bold 22px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
    spCtx.fillStyle = '#000000';
    spCtx.fillText(faceName, 1, 23);
    spCtx.fillStyle = VN_SPEAKER_COLOR;
    spCtx.fillText(faceName, 0, 22);
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
}

// ─── ET 오버레이 메시 정리 ───
export function cleanupETOverlays(renderer: any, scene: any) {
  if (!renderer?._etAnimSegs || !scene) return;
  (renderer._etAnimSegs as any[]).forEach((seg: any) => {
    if (seg._overlayMesh && typeof seg._overlayMesh === 'object') {
      scene.remove(seg._overlayMesh);
      seg._overlayMesh.geometry?.dispose();
      seg._overlayMesh.material?.dispose();
      seg._overlayTex?.dispose();
      seg._overlayMesh = null;
      seg._overlayTex = null;
    }
    if (seg._charMeshes) {
      (seg._charMeshes as any[]).forEach((cm: any) => {
        scene.remove(cm.mesh);
        cm.mesh?.geometry?.dispose();
        cm.mesh?.material?.dispose();
        cm.tex?.dispose();
      });
      seg._charMeshes = null;
    }
  });
}

// ─── Three.js 씬 완전 정리 ───
export function disposeThreeScene(t: ThreeRefs) {
  const ET = (window as any).ExtendedText;
  if (ET && ET._overlayScene === t.scene) ET._overlayScene = null;
  [t.mapTexture, t.faceTexture, t.textTexture, t.speakerTexture].forEach(tx => tx?.dispose());
  [t.mapBgMesh, t.dimMesh, t.windowMesh, t.faceMesh, t.textMesh, t.speakerMesh, t.arrowMesh].forEach(m => {
    m?.geometry?.dispose(); m?.material?.dispose();
  });
  t.renderer?.dispose();
}

// ─── 텍스트 렌더러 빌드 ───
export function buildTextRenderer(
  text: string, faceName: string, background: number, positionType: number,
  vnScrollLine: number, threeScene: any,
): { renderer: any; resetScroll: boolean } | null {
  const allLines = text.split('\n');
  const isVN = allLines.length > 4;
  const hasFace = !!faceName;
  const hasSpeaker = isVN && hasFace;

  let contentsW: number, contentsH: number;
  if (isVN) {
    contentsW = VN_W - PAD * 2 - (hasFace ? 120 + 12 : 0);
    contentsH = Math.max(LINE_H, allLines.length * LINE_H);
  } else {
    contentsW = GW - PAD * 2 - (hasFace ? FACE_SZ + 16 : 0);
    contentsH = WIN_H - PAD * 2;
  }

  const r = createTextRenderer(contentsW, contentsH);
  if (r) {
    const layout = computeLayout(isVN, background, positionType, hasFace, hasSpeaker);
    r._etWindowX = layout.textX;
    r._etWindowY = layout.textY;
    r._etPadding = 0;
    r._etScrollY = isVN ? vnScrollLine * LINE_H : 0;
    if (threeScene) r._etScene = threeScene;
  }
  if (r) setupRendererText(r, isVN ? allLines : allLines.slice(0, 4));
  return r;
}

// ─── RAF 틱: 맵 배경 갱신 ───
export function tickMapBackground(t: ThreeRefs, eventTileX: number | null, eventTileY: number | null) {
  const mapCanvas = ((window as any)._editorRendererObj?.view) as HTMLCanvasElement | null | undefined;
  const offCanvas = t.mapTexture.image as HTMLCanvasElement;
  if (offCanvas && mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
    const ctx2d = offCanvas.getContext('2d');
    if (ctx2d) {
      let srcX = 0, srcY = 0;
      if (eventTileX !== null && eventTileY !== null) {
        srcX = Math.max(0, Math.min(Math.round(eventTileX * TILE_SIZE + TILE_SIZE / 2 - GW / 2), mapCanvas.width - GW));
        srcY = Math.max(0, Math.min(Math.round(eventTileY * TILE_SIZE + TILE_SIZE / 2 - GH / 2), mapCanvas.height - GH));
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
}

// ─── RAF 틱: 텍스트 캔버스 복사 ───
export function tickTextCanvas(t: ThreeRefs, renderer: any) {
  if (!renderer?.contents) return;
  const bmpCanvas = (renderer.contents.canvas || renderer.contents._canvas) as HTMLCanvasElement | null;
  if (bmpCanvas && bmpCanvas.width > 0 && bmpCanvas.height > 0) {
    const textCtxR = t.textOffCanvas.getContext('2d');
    if (textCtxR) {
      textCtxR.clearRect(0, 0, t.textOffCanvas.width, t.textOffCanvas.height);
      textCtxR.drawImage(bmpCanvas, 0, 0);
      t.textTexture.needsUpdate = true;
    }
  }
}
