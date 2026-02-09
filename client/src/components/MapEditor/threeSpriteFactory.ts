import { TILE_SIZE_PX } from '../../utils/tileHelper';

// Runtime globals (loaded via index.html script tags)
declare const RendererFactory: any;
declare const ThreeSprite: any;

/** Create a canvas-based SpriteMaterial for 💡 marker */
export function createLightMarkerSprite(THREE: any, color: string): any {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💡', 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, side: THREE.DoubleSide });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(32, 32, 1);
  sprite.renderOrder = 999;
  return sprite;
}

/** Create a dashed line from ground to light Z position */
export function createLightStemLine(THREE: any, px: number, py: number, z: number, color: string): any {
  const material = new THREE.LineDashedMaterial({
    color: color,
    dashSize: 4,
    gapSize: 4,
    opacity: 0.6,
    transparent: true,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(px, py, 0),
    new THREE.Vector3(px, py, z),
  ]);
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  line.renderOrder = 998;
  return line;
}

/** 게임 런타임 ThreeSprite를 사용하여 이미지의 서브영역으로 메시 생성 */
function createRuntimeSprite(img: HTMLImageElement | HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number): any {
  const baseTexture = RendererFactory.createBaseTexture(img);
  const texture = RendererFactory.createTexture(baseTexture);
  texture.frame = { x: sx, y: sy, width: sw, height: sh };
  texture._updateID++;
  const sprite = new ThreeSprite(texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.updateTransform();
  return sprite;
}

/** Create a textured mesh for a tile from a tileset image.
 *  Uses game runtime ThreeSprite for correct UV/normal handling. */
export function createTileSprite(THREE: any, img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, drawW: number, drawH: number): any {
  const sprite = createRuntimeSprite(img, sx, sy, sw, sh);
  sprite.scale.set(drawW / sw, drawH / sh);
  sprite.updateTransform();

  const mesh = sprite._threeObj;
  mesh.renderOrder = 880;
  mesh.frustumCulled = false;
  mesh.material.depthTest = false;
  return mesh;
}

/** Create a textured mesh for a character image region.
 *  Uses game runtime ThreeSprite for correct UV/normal handling. */
export function createCharSprite(THREE: any, img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, tileSize: number): any {
  const sprite = createRuntimeSprite(img, sx, sy, sw, sh);
  const scaleFactor = Math.min(tileSize / sw, tileSize / sh);
  sprite.scale.set(scaleFactor, scaleFactor);
  sprite.updateTransform();

  const mesh = sprite._threeObj;
  mesh.renderOrder = 900;
  mesh.frustumCulled = false;

  // ShadowLight 활성 시 MeshPhongMaterial + castShadow 사용
  const ShadowLightGlobal = (window as any).ShadowLight;
  if (ShadowLightGlobal?._active) {
    const map = mesh.material.map;
    mesh.castShadow = true;
    mesh.material = new THREE.MeshPhongMaterial({
      map, depthTest: true, depthWrite: true, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide,
      emissive: new THREE.Color(0x000000), specular: new THREE.Color(0x000000), shininess: 0,
    });
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map, alphaTest: 0.5, side: THREE.DoubleSide,
    });
  }
  return mesh;
}

/** Create a flat colored quad (PlaneGeometry) at tile position */
export function createTileQuad(THREE: any, x: number, y: number, tileSize: number, color: number, opacity: number, renderOrder: number): any {
  const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
  const material = new THREE.MeshBasicMaterial({
    color, opacity, transparent: true, depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 2);
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

/** Create a wireframe rectangle at tile position */
export function createTileOutline(THREE: any, x: number, y: number, tileSize: number, color: number, lineWidth: number, renderOrder: number): any {
  const hw = tileSize / 2;
  const pts = [
    new THREE.Vector3(-hw, -hw, 0), new THREE.Vector3(hw, -hw, 0),
    new THREE.Vector3(hw, hw, 0), new THREE.Vector3(-hw, hw, 0),
    new THREE.Vector3(-hw, -hw, 0),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(pts);
  const material = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 1.0 });
  const line = new THREE.Line(geometry, material);
  line.position.set(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 3);
  line.renderOrder = renderOrder;
  line.frustumCulled = false;
  return line;
}

/** Create a text label using game runtime ThreeSprite */
export function createTextSprite(THREE: any, text: string, fontSize: number, color: string): any {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 2;
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 16, 124);

  const sprite = createRuntimeSprite(canvas, 0, 0, 128, 32);
  // 원본 PlaneGeometry(64,16)에 맞춤: ThreeSprite 지오메트리는 128x32이므로 0.5 스케일
  sprite.scale.set(0.5, 0.5);
  sprite.updateTransform();

  const mesh = sprite._threeObj;
  mesh.renderOrder = 910;
  mesh.frustumCulled = false;
  mesh.material.depthTest = false;
  return mesh;
}

/** 캔버스로부터 게임 런타임 ThreeSprite 메시를 생성 */
export function createCanvasSprite(canvas: HTMLCanvasElement): any {
  const sprite = createRuntimeSprite(canvas, 0, 0, canvas.width, canvas.height);
  sprite.updateTransform();
  const mesh = sprite._threeObj;
  mesh.renderOrder = 880;
  mesh.frustumCulled = false;
  mesh.material.depthTest = false;
  return mesh;
}

/** Create a runtime Bitmap from a loaded HTMLImageElement */
export function createBitmapFromImage(img: HTMLImageElement): any {
  const BitmapClass = (window as any).Bitmap;
  const bmp = Object.create(BitmapClass.prototype);
  bmp._defer = false;
  bmp._image = null;
  bmp._url = '';
  bmp._paintOpacity = 255;
  bmp._smooth = false;
  bmp._loadListeners = [];
  bmp._loadingState = 'loaded';
  bmp._decodeAfterRequest = false;
  bmp.cacheEntry = null;
  bmp.fontFace = 'GameFont';
  bmp.fontSize = 28;
  bmp.fontItalic = false;
  bmp.textColor = '#ffffff';
  bmp.outlineColor = 'rgba(0, 0, 0, 0.5)';
  bmp.outlineWidth = 4;
  bmp._dirty = false;

  // Create canvas and draw image onto it
  bmp.__canvas = document.createElement('canvas');
  bmp.__canvas.width = img.width;
  bmp.__canvas.height = img.height;
  bmp.__context = bmp.__canvas.getContext('2d', { willReadFrequently: true });
  bmp.__context.drawImage(img, 0, 0);

  // Create Three.js base texture from the canvas
  bmp.__baseTexture = RendererFactory.createBaseTexture(bmp.__canvas);
  bmp.__baseTexture.mipmap = false;
  bmp.__baseTexture.width = img.width;
  bmp.__baseTexture.height = img.height;
  RendererFactory.setScaleMode(bmp.__baseTexture, RendererFactory.SCALE_MODE_NEAREST);

  return bmp;
}
