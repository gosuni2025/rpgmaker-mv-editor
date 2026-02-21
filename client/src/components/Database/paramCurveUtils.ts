export const PARAM_KEYS = ['maxHP', 'maxMP', 'attack', 'defense', 'mAttack', 'mDefense', 'agility', 'luck'];
export const PARAM_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1', '#fff176', '#a1887f'];
export const LEVELS_PER_COL = 20;

export const PARAM_PRESETS: Record<string, number[][]> = {
  maxHP:   [[450,9500],[400,8500],[350,7500],[300,6500],[250,5500]],
  maxMP:   [[100,1900],[90,1700],[80,1500],[70,1300],[60,1100]],
  attack:  [[30,300],[25,250],[20,200],[15,150],[10,100]],
  defense: [[30,300],[25,250],[20,200],[15,150],[10,100]],
  mAttack: [[30,300],[25,250],[20,200],[15,150],[10,100]],
  mDefense:[[30,300],[25,250],[20,200],[15,150],[10,100]],
  agility: [[30,300],[25,250],[20,200],[15,150],[10,100]],
  luck:    [[30,300],[25,250],[20,200],[15,150],[10,100]],
};

export function generateCurve(lv1: number, lv99: number, growthType: number): number[] {
  const arr = new Array(99);
  for (let i = 0; i < 99; i++) {
    const t = i / 98;
    let curve: number;
    if (growthType <= 0.5) {
      const blend = growthType / 0.5;
      const fast = Math.pow(t, 0.5);
      curve = fast * (1 - blend) + t * blend;
    } else {
      const blend = (growthType - 0.5) / 0.5;
      const slow = Math.pow(t, 2);
      curve = t * (1 - blend) + slow * blend;
    }
    arr[i] = Math.round(lv1 + (lv99 - lv1) * curve);
  }
  return arr;
}

export function cubicSplineInterpolate(anchors: { idx: number; val: number }[], totalLen: number, maxVal: number): number[] {
  const result = new Array(totalLen);
  if (anchors.length === 0) return result.fill(0);
  if (anchors.length === 1) return result.fill(anchors[0].val);

  anchors.sort((a, b) => a.idx - b.idx);
  const n = anchors.length;
  const xs = anchors.map(a => a.idx);
  const ys = anchors.map(a => a.val);

  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);

  const alpha: number[] = [0];
  for (let i = 1; i < n - 1; i++) {
    alpha.push((3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]));
  }

  const l: number[] = [1];
  const mu: number[] = [0];
  const z: number[] = [0];

  for (let i = 1; i < n - 1; i++) {
    l.push(2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]);
    mu.push(h[i] / l[i]);
    z.push((alpha[i] - h[i - 1] * z[i - 1]) / l[i]);
  }

  l.push(1);
  z.push(0);

  const c: number[] = new Array(n).fill(0);
  const b: number[] = new Array(n - 1).fill(0);
  const d: number[] = new Array(n - 1).fill(0);

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  for (let idx = 0; idx < totalLen; idx++) {
    if (idx < xs[0]) {
      result[idx] = ys[0];
    } else if (idx > xs[n - 1]) {
      result[idx] = ys[n - 1];
    } else {
      let seg = n - 2;
      for (let i = 0; i < n - 1; i++) {
        if (idx <= xs[i + 1]) { seg = i; break; }
      }
      const dx = idx - xs[seg];
      const val = ys[seg] + b[seg] * dx + c[seg] * dx * dx + d[seg] * dx * dx * dx;
      result[idx] = Math.max(0, Math.min(maxVal, Math.round(val)));
    }
  }

  return result;
}

export function getMaxForParam(paramIdx: number): number {
  const key = PARAM_KEYS[paramIdx];
  return (key === 'maxHP' || key === 'maxMP') ? 9999 : 999;
}

// ─── 그래프 렌더링 ───
interface GraphConfig {
  activeTab: number;
  currentArr: number[];
  maxVal: number;
  yScale: 'linear' | 'log';
  yZoomMin: number;
  yZoomMax: number;
  modifiedPoints: Set<number>;
}

export function drawParamGraph(canvas: HTMLCanvasElement, config: GraphConfig) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { activeTab, currentArr, maxVal, yScale, yZoomMin, yZoomMax, modifiedPoints } = config;
  const W = canvas.width, H = canvas.height;
  const padL = 50, padR = 15, padT = 15, padB = 30;
  const gW = W - padL - padR;
  const gH = H - padT - padB;

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  const useLog = yScale === 'log';
  const dataMin = Math.max(1, Math.min(...currentArr.filter(v => v > 0)));
  const logMin = useLog ? Math.log10(dataMin) : 0;
  const logMax = useLog ? Math.log10(maxVal) : maxVal;

  const normalize = (v: number): number => {
    if (useLog) {
      const lv = Math.log10(Math.max(1, v));
      return logMax > logMin ? (lv - logMin) / (logMax - logMin) : 0;
    }
    return v / maxVal;
  };

  const valToY = (v: number): number => {
    const norm = normalize(v);
    const viewRange = yZoomMax - yZoomMin;
    const mapped = viewRange > 0 ? (norm - yZoomMin) / viewRange : 0;
    return padT + gH - mapped * gH;
  };

  const denormalize = (norm: number): number => {
    if (useLog) return Math.pow(10, logMin + norm * (logMax - logMin));
    return norm * maxVal;
  };

  // Grid
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const y = padT + (i / 10) * gH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }
  for (let lv = 1; lv <= 99; lv += 10) {
    const x = padL + ((lv - 1) / 98) * gW;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + gH); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + gH); ctx.lineTo(W - padR, padT + gH); ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.rect(padL, padT, gW, gH); ctx.clip();

  const color = PARAM_COLORS[activeTab];

  // Fill under curve
  ctx.fillStyle = color + '40';
  ctx.beginPath();
  ctx.moveTo(padL, padT + gH);
  for (let i = 0; i < 99; i++) {
    ctx.lineTo(padL + (i / 98) * gW, valToY(Math.max(0, Math.min(currentArr[i], maxVal))));
  }
  ctx.lineTo(padL + gW, padT + gH);
  ctx.closePath();
  ctx.fill();

  // Curve line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 99; i++) {
    const x = padL + (i / 98) * gW;
    const y = valToY(Math.max(0, Math.min(currentArr[i], maxVal)));
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Modified points (anchors)
  for (const idx of modifiedPoints) {
    const x = padL + (idx / 98) * gW;
    const y = valToY(Math.max(0, Math.min(currentArr[idx], maxVal)));
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Points every 10 levels
  for (let lv = 1; lv <= 99; lv += 10) {
    const i = lv - 1;
    if (modifiedPoints.has(i)) continue;
    const x = padL + (i / 98) * gW;
    const y = valToY(Math.max(0, Math.min(currentArr[i], maxVal)));
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
  }

  ctx.restore();

  // Axis labels
  ctx.fillStyle = '#999';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (let lv = 1; lv <= 99; lv += 10) {
    ctx.fillText(String(lv), padL + ((lv - 1) / 98) * gW, padT + gH + 16);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const viewNorm = yZoomMin + (i / 5) * (yZoomMax - yZoomMin);
    ctx.fillText(Math.round(denormalize(viewNorm)).toLocaleString(), padL - 5, padT + gH - (i / 5) * gH);
  }
  ctx.textBaseline = 'alphabetic';
}

// ─── 캔버스 좌표 → 레벨/값 변환 ───
export function canvasToLevelValue(
  canvas: HTMLCanvasElement, clientX: number, clientY: number,
  maxVal: number, yScale: 'linear' | 'log', yZoomMin: number, yZoomMax: number,
  currentArr: number[],
): { lv: number; val: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (clientX - rect.left) * scaleX;
  const my = (clientY - rect.top) * scaleY;

  const W = canvas.width, H = canvas.height;
  const padL = 50, padR = 15, padT = 15, padB = 30;
  const gW = W - padL - padR;
  const gH = H - padT - padB;

  const lv = Math.round(((mx - padL) / gW) * 98) + 1;
  const yRatio = 1 - (my - padT) / gH;
  const viewRange = yZoomMax - yZoomMin;
  const norm = yZoomMin + yRatio * viewRange;

  let val: number;
  if (yScale === 'log') {
    const dataMin = Math.max(1, Math.min(...currentArr.filter(v => v > 0)));
    const logMin = Math.log10(dataMin);
    const logMax = Math.log10(maxVal);
    val = Math.round(Math.pow(10, logMin + norm * (logMax - logMin)));
  } else {
    val = Math.round(norm * maxVal);
  }

  return { lv: Math.max(1, Math.min(99, lv)), val: Math.max(0, Math.min(maxVal, val)) };
}
