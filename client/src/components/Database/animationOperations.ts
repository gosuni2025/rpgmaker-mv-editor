import type { TweenOptions, BatchSettingData, ShiftData } from './AnimationDialogs';

type FrameData = number[][][];

function cloneFrames(frames: number[][][]): FrameData {
  return frames.map(f => f.map(c => [...c]));
}

export function applyTween(frames: number[][][], opts: TweenOptions): FrameData {
  const result = cloneFrames(frames);
  const fi = opts.frameStart - 1;
  const fe = opts.frameEnd - 1;
  if (fi < 0 || fe >= result.length || fi >= fe) return result;
  const ci = opts.cellStart - 1;
  const ce = opts.cellEnd - 1;
  const totalSteps = fe - fi;

  for (let c = ci; c <= ce; c++) {
    const startCell = result[fi]?.[c];
    const endCell = result[fe]?.[c];
    if (!startCell || startCell.length < 8 || !endCell || endCell.length < 8) continue;
    for (let f = fi + 1; f < fe; f++) {
      const t = (f - fi) / totalSteps;
      if (!result[f]) result[f] = [];
      const existing = result[f][c] ? [...result[f][c]] : [...startCell];
      if (opts.pattern) existing[0] = Math.round(startCell[0] + (endCell[0] - startCell[0]) * t);
      if (opts.x) existing[1] = Math.round(startCell[1] + (endCell[1] - startCell[1]) * t);
      if (opts.y) existing[2] = Math.round(startCell[2] + (endCell[2] - startCell[2]) * t);
      if (opts.scale) existing[3] = Math.round(startCell[3] + (endCell[3] - startCell[3]) * t);
      if (opts.rotation) existing[4] = Math.round(startCell[4] + (endCell[4] - startCell[4]) * t);
      if (opts.mirror) existing[5] = t < 0.5 ? startCell[5] : endCell[5];
      if (opts.opacity) existing[6] = Math.round(startCell[6] + (endCell[6] - startCell[6]) * t);
      if (opts.blendMode) existing[7] = t < 0.5 ? startCell[7] : endCell[7];
      result[f][c] = existing;
    }
  }
  return result;
}

export function applyBatchSetting(frames: number[][][], batchData: BatchSettingData): FrameData {
  const result = cloneFrames(frames);
  const fi = batchData.frameStart - 1;
  const fe = batchData.frameEnd - 1;
  const ci = batchData.cellStart - 1;
  const ce = batchData.cellEnd - 1;

  for (let f = fi; f <= fe && f < result.length; f++) {
    if (!result[f]) result[f] = [];
    for (let c = ci; c <= ce; c++) {
      if (!result[f][c] || result[f][c].length < 8) continue;
      const cell = [...result[f][c]];
      if (batchData.patternEnabled) cell[0] = batchData.pattern;
      if (batchData.xEnabled) cell[1] = batchData.x;
      if (batchData.yEnabled) cell[2] = batchData.y;
      if (batchData.scaleEnabled) cell[3] = batchData.scale;
      if (batchData.rotationEnabled) cell[4] = batchData.rotation;
      if (batchData.mirrorEnabled) cell[5] = batchData.mirror;
      if (batchData.opacityEnabled) cell[6] = batchData.opacity;
      if (batchData.blendModeEnabled) cell[7] = batchData.blendMode;
      result[f][c] = cell;
    }
  }
  return result;
}

export function applyShift(frames: number[][][], shiftData: ShiftData): FrameData {
  const result = cloneFrames(frames);
  const fi = shiftData.frameStart - 1;
  const fe = shiftData.frameEnd - 1;
  const ci = shiftData.cellStart - 1;
  const ce = shiftData.cellEnd - 1;

  for (let f = fi; f <= fe && f < result.length; f++) {
    if (!result[f]) continue;
    for (let c = ci; c <= ce; c++) {
      if (!result[f][c] || result[f][c].length < 8) continue;
      result[f][c][1] += shiftData.offsetX;
      result[f][c][2] += shiftData.offsetY;
    }
  }
  return result;
}
