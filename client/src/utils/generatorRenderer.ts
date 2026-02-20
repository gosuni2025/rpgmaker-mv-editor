// Canvas rendering engine for the RPG Maker MV Character Generator.
// Handles gradient-based recoloring and layer compositing for Face, TV, and SV modes.

const GRADIENT_WIDTH = 256;
const GRADIENT_ROWS = 70;
const GRADIENT_ROW_HEIGHT = 4;
const GRADIENT_SAMPLE_X = 128;

// Face 렌더링 순서 (bottom → top, layer 37→1)
export const FACE_RENDER_ORDER: string[] = [
  'RearHair2', 'Cloak2', 'Body', 'Clothing2', 'Face', 'Mouth', 'Nose',
  'FacialMark', 'Eyes', 'Eyebrows', 'RearHair1', 'Ears', 'Clothing1',
  'Beard', 'BeastEars', 'AccA', 'Cloak1', 'FrontHair', 'Glasses', 'AccB',
];

// TV(걷기) 렌더링 순서 (bottom → top)
// X2 = 배경 레이어 (Body 이전에 그림), X1 = 전경 레이어 (Body 이후에 그림)
// 근거: TV_RearHair2는 DOWN/LEFT/RIGHT 프레임(y=1-129)에만 존재 → Body 뒤에 위치
//       TV_RearHair1은 UP 프레임(y=145-177)에만 존재 → 뒤돌아볼 때 Body 위에 표시
export const TV_RENDER_ORDER: string[] = [
  'Wing2', 'Cloak2', 'Tail2', 'RearHair2', 'FrontHair2', 'Beard2', 'Body', 'Ears',
  'FacialMark', 'Clothing2', 'Beard1', 'Clothing1', 'Tail1',
  'Cloak1', 'BeastEars', 'Glasses', 'RearHair1', 'AccA', 'FrontHair1',
  'AccB', 'Wing1',
];

// SV(전투) 렌더링 순서 (bottom → top)
// SV는 항상 측면 뷰 → RearHair1이 Body 뒤에 위치하므로 Body 이전에 그림
export const SV_RENDER_ORDER: string[] = [
  'Wing', 'Cloak2', 'Tail', 'RearHair1', 'Body', 'Ears', 'FacialMark',
  'Clothing2', 'Beard', 'Clothing1', 'Cloak1', 'BeastEars', 'Glasses',
  'AccA', 'FrontHair', 'AccB',
];

const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = function () {
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
}

export async function loadGradients(url: string): Promise<ImageData> {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// 소스 픽셀의 gradient x 위치를 계산 (0=밝음, 255=어두움)
// luminance 기반이되, 고채도 픽셀(파란 홍채 등)은 max-channel 쪽으로 자동 전환
// 공식: lum + sat² × (max - lum), where sat = HSV saturation
function pixelBrightness(r: number, g: number, b: number): number {
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
  return 255 - Math.round(lum + sat * sat * (maxChannel - lum));
}

function getGradientColor(
  gradients: ImageData,
  row: number,
  brightness: number,
): { r: number; g: number; b: number } {
  const y = row * GRADIENT_ROW_HEIGHT;
  const x = Math.max(0, Math.min(brightness, GRADIENT_WIDTH - 1));
  const idx = (y * gradients.width + x) * 4;
  return {
    r: gradients.data[idx],
    g: gradients.data[idx + 1],
    b: gradients.data[idx + 2],
  };
}

export function getGradientSwatches(
  gradients: ImageData,
): Array<{ row: number; color: string }> {
  const swatches: Array<{ row: number; color: string }> = [];

  for (let row = 0; row < GRADIENT_ROWS; row++) {
    const { r, g, b } = getGradientColor(gradients, row, GRADIENT_SAMPLE_X);
    const hex =
      '#' +
      r.toString(16).padStart(2, '0') +
      g.toString(16).padStart(2, '0') +
      b.toString(16).padStart(2, '0');
    swatches.push({ row, color: hex });
  }

  return swatches;
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export async function recolorFacePart(
  imageUrl: string,
  gradients: ImageData,
  gradientRow: number,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageUrl);
  const canvas = imageToCanvas(img);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha === 0) {
      continue;
    }

    const brightness = pixelBrightness(pixels[i], pixels[i + 1], pixels[i + 2]);
    const color = getGradientColor(gradients, gradientRow, brightness);
    pixels[i] = color.r;
    pixels[i + 1] = color.g;
    pixels[i + 2] = color.b;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function recolorTVSVPart(
  baseImageUrl: string,
  colorMapUrl: string | null,
  gradients: ImageData,
  gradientRow: number,
): Promise<HTMLCanvasElement> {
  const baseImg = await loadImage(baseImageUrl);
  const canvas = imageToCanvas(baseImg);

  if (colorMapUrl === null) {
    return canvas;
  }

  const colorMapImg = await loadImage(colorMapUrl);
  const colorMapCanvas = imageToCanvas(colorMapImg);
  const colorMapCtx = colorMapCanvas.getContext('2d')!;
  const colorMapData = colorMapCtx.getImageData(
    0,
    0,
    colorMapCanvas.width,
    colorMapCanvas.height,
  );

  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const mapPixels = colorMapData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha === 0) {
      continue;
    }

    const mapR = mapPixels[i];
    if (mapR === 0) {
      continue;
    }

    const brightness = pixelBrightness(pixels[i], pixels[i + 1], pixels[i + 2]);
    const color = getGradientColor(gradients, gradientRow, brightness);
    pixels[i] = color.r;
    pixels[i + 1] = color.g;
    pixels[i + 2] = color.b;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function compositeFaceCharacter(
  parts: Array<{
    partName: string;
    layers: Array<{
      imageUrl: string;
      gradientRow: number | null;
    }>;
  }>,
  gradients: ImageData,
  canvasWidth: number,
  canvasHeight: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  const sortedParts = sortByRenderOrder(parts, FACE_RENDER_ORDER);

  for (const part of sortedParts) {
    // c1(홍채 등 gradient 레이어) → c2(동공/하이라이트 등 fixed 레이어) 순으로 그림
    for (const layer of part.layers) {
      if (layer.gradientRow !== null) {
        const recolored = await recolorFacePart(
          layer.imageUrl,
          gradients,
          layer.gradientRow,
        );
        ctx.drawImage(recolored, 0, 0);
      } else {
        const img = await loadImage(layer.imageUrl);
        ctx.drawImage(img, 0, 0);
      }
    }
  }

  return canvas;
}

export async function compositeTVSVCharacter(
  parts: Array<{
    partName: string;
    baseImageUrl: string;
    colorMapUrl: string | null;
    gradientRow: number;
  }>,
  gradients: ImageData,
  canvasWidth: number,
  canvasHeight: number,
  outputType: 'TV' | 'SV' = 'TV',
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  const order = outputType === 'SV' ? SV_RENDER_ORDER : TV_RENDER_ORDER;
  const sortedParts = sortByRenderOrder(parts, order);

  for (const part of sortedParts) {
    const recolored = await recolorTVSVPart(
      part.baseImageUrl,
      part.colorMapUrl,
      gradients,
      part.gradientRow,
    );
    ctx.drawImage(recolored, 0, 0);
  }

  return canvas;
}

function sortByRenderOrder<T extends { partName: string }>(
  parts: T[],
  order: string[],
): T[] {
  return [...parts].sort((a, b) => {
    const idxA = order.indexOf(a.partName);
    const idxB = order.indexOf(b.partName);
    const orderA = idxA === -1 ? order.length : idxA;
    const orderB = idxB === -1 ? order.length : idxB;
    return orderA - orderB;
  });
}
