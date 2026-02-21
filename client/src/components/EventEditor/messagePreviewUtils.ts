// ─── 상수 ───
export const GW = 816;
export const GH = 624;
export const WIN_H = 180;
export const FACE_SZ = 144;
export const PAD = 12;
export const LINE_H = 36;

export const VN_X = 60;
export const VN_Y = 40;
export const VN_W = 700;
export const VN_H = 520;
export const VN_OVERLAY_ALPHA = 120 / 255;
export const VN_SPEAKER_COLOR = '#ffe066';
export const TILE_SIZE = 48;

// ─── 레이아웃 ───
export interface Layout {
  windowX: number; windowY: number; windowW: number; windowH: number;
  faceX: number;   faceY: number;   faceW: number;   faceH: number;
  textX: number;   textY: number;   textW: number;   textH: number;
  speakerX: number; speakerY: number;
  dimAlpha: number; showWindow: boolean;
}

export function computeLayout(
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

// ─── Window_Base 오프스크린 렌더러 ───
export function createTextRenderer(contentsW: number, contentsH: number): any | null {
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

export function setupRendererText(renderer: any, lines: string[]) {
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
    } catch (e) {
      try { renderer.contents.drawText(line, 0, i * LINE_H, renderer.contents.width, LINE_H, 'left'); } catch (_) {}
    }
  });

  const ws = renderer._windowskin;
  if (ws && typeof ws.addLoadListener === 'function' && !ws.isReady?.()) {
    ws.addLoadListener(() => { setupRendererText(renderer, lines); });
  }
}

// ─── Three.js 헬퍼 ───
export function getThree(): any { return (window as any).THREE; }

export function makePlaneMesh(THREE: any, material: any): any {
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
}

export function makePlaceholderTex(THREE: any): any {
  const c = document.createElement('canvas');
  c.width = 1; c.height = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  return tex;
}

export function positionMesh(mesh: any, x: number, y: number, w: number, h: number) {
  mesh.position.set(x + w / 2, y + h / 2, 0);
  mesh.scale.set(w, h, 1);
}

// ─── Window.png 9-slice ShaderMaterial ───
export const WINDOW_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const WINDOW_FRAG = `
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
  float bgU = mod(vUv.x * uDstSize.x / 64.0, 1.0) * (64.0 / 192.0);
  float bgV = mod(vUv.y * uDstSize.y / 64.0, 1.0) * (64.0 / 192.0);
  vec4 bg = texture2D(tWindow, vec2(bgU, bgV));
  bg.a *= 0.82;

  vec2 bUV = nineSliceUV(vUv, uDstSize, BORDER);
  vec2 borderUV = (vec2(1.0) + bUV) * (64.0 / 192.0);
  vec4 border = texture2D(tWindow, borderUV);

  gl_FragColor = mix(bg, border, border.a);
}
`;

// ─── ThreeRefs 타입 ───
export interface ThreeRefs {
  renderer: any; scene: any; camera: any;
  mapBgMesh: any; dimMesh: any; windowMesh: any; faceMesh: any;
  textMesh: any; speakerMesh: any; arrowMesh: any;
  mapTexture: any; faceTexture: any; textTexture: any;
  textOffCanvas: HTMLCanvasElement;
  speakerTexture: any; windowImg: HTMLImageElement | null;
  winTexLoaded: boolean; lastFaceName: string;
}
