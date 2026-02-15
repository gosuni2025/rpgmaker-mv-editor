import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEscClose from '../../hooks/useEscClose';
import './ParamCurveDialog.css';

interface ParamCurveDialogProps {
  params: number[][];  // 8 arrays of 99 values
  initialTab?: number; // which tab to open initially (0-7)
  onConfirm: (params: number[][]) => void;
  onCancel: () => void;
}

const PARAM_KEYS = ['maxHP', 'maxMP', 'attack', 'defense', 'mAttack', 'mDefense', 'agility', 'luck'];
const PARAM_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1', '#fff176', '#a1887f'];

// Generate curve from lv1, lv99, and growth type
// growthType: 0=fast(log-like), 0.5=linear, 1=slow(exp-like)
function generateCurve(lv1: number, lv99: number, growthType: number): number[] {
  const arr = new Array(99);
  for (let i = 0; i < 99; i++) {
    const lv = i + 1;
    const t = (lv - 1) / 98; // 0..1
    let curve: number;
    if (growthType <= 0.5) {
      // Fast growth: interpolate between sqrt curve and linear
      const blend = growthType / 0.5; // 0..1
      const fast = Math.pow(t, 0.5); // sqrt curve (fast start)
      curve = fast * (1 - blend) + t * blend;
    } else {
      // Slow growth: interpolate between linear and pow curve
      const blend = (growthType - 0.5) / 0.5; // 0..1
      const slow = Math.pow(t, 2); // pow curve (slow start)
      curve = t * (1 - blend) + slow * blend;
    }
    arr[i] = Math.round(lv1 + (lv99 - lv1) * curve);
  }
  return arr;
}

// Cubic spline interpolation between anchor points
function cubicSplineInterpolate(anchors: { idx: number; val: number }[], totalLen: number, maxVal: number): number[] {
  const result = new Array(totalLen);
  if (anchors.length === 0) return result.fill(0);
  if (anchors.length === 1) return result.fill(anchors[0].val);

  // Sort anchors by index
  anchors.sort((a, b) => a.idx - b.idx);

  // For segments before first anchor and after last anchor, just keep existing values
  // We'll only interpolate between first and last anchor

  const n = anchors.length;

  // Build cubic spline (natural spline)
  const xs = anchors.map(a => a.idx);
  const ys = anchors.map(a => a.val);

  // Compute spline coefficients using tridiagonal algorithm
  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
  }

  // Set up tridiagonal system for second derivatives
  const alpha: number[] = [0];
  for (let i = 1; i < n - 1; i++) {
    alpha.push(
      (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1])
    );
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

  // Evaluate spline at each integer point
  for (let idx = 0; idx < totalLen; idx++) {
    if (idx < xs[0]) {
      result[idx] = ys[0];
    } else if (idx > xs[n - 1]) {
      result[idx] = ys[n - 1];
    } else {
      // Find the right segment
      let seg = n - 2;
      for (let i = 0; i < n - 1; i++) {
        if (idx <= xs[i + 1]) {
          seg = i;
          break;
        }
      }
      const dx = idx - xs[seg];
      const val = ys[seg] + b[seg] * dx + c[seg] * dx * dx + d[seg] * dx * dx * dx;
      result[idx] = Math.max(0, Math.min(maxVal, Math.round(val)));
    }
  }

  return result;
}

// Preset parameter ranges for A~E presets
// [lv1, lv99] for each param and preset level
const PARAM_PRESETS: Record<string, number[][]> = {
  maxHP:   [[450,9500],[400,8500],[350,7500],[300,6500],[250,5500]],
  maxMP:   [[100,1900],[90,1700],[80,1500],[70,1300],[60,1100]],
  attack:  [[30,300],[25,250],[20,200],[15,150],[10,100]],
  defense: [[30,300],[25,250],[20,200],[15,150],[10,100]],
  mAttack: [[30,300],[25,250],[20,200],[15,150],[10,100]],
  mDefense:[[30,300],[25,250],[20,200],[15,150],[10,100]],
  agility: [[30,300],[25,250],[20,200],[15,150],[10,100]],
  luck:    [[30,300],[25,250],[20,200],[15,150],[10,100]],
};

const LEVELS_PER_COL = 20;

export default function ParamCurveDialog({ params: initialParams, initialTab = 0, onConfirm, onCancel }: ParamCurveDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [params, setParams] = useState<number[][]>(() =>
    initialParams.map(arr => [...arr])
  );
  const [growthType, setGrowthType] = useState(0.5);

  // Track initial values for color comparison
  const initialParamsRef = useRef<number[][]>(initialParams.map(arr => [...arr]));

  // Track manually modified (dragged) points per param for interpolation
  const modifiedPointsRef = useRef<Set<number>[]>(
    Array.from({ length: 8 }, () => new Set<number>())
  );

  useEscClose(onCancel);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const lastDragLv = useRef(-1);

  const PARAM_NAMES = PARAM_KEYS.map(k => t(`params.${k}`));

  const currentArr = params[activeTab] || new Array(99).fill(0);

  // Get max value for current param type for Y axis scaling
  const getMaxForParam = useCallback((paramIdx: number) => {
    const key = PARAM_KEYS[paramIdx];
    if (key === 'maxHP') return 9999;
    if (key === 'maxMP') return 9999;
    return 999;
  }, []);

  const maxVal = getMaxForParam(activeTab);

  // Value color: red=increase, blue=decrease, white=same
  const getValueColor = useCallback((lv: number) => {
    const cur = params[activeTab][lv - 1];
    const orig = initialParamsRef.current[activeTab][lv - 1];
    if (cur > orig) return '#e57373';
    if (cur < orig) return '#64b5f6';
    return '#ddd';
  }, [params, activeTab]);

  // Draw graph
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const padL = 50, padR = 15, padT = 15, padB = 30;
    const gW = W - padL - padR;
    const gH = H - padT - padB;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = padT + (i / 10) * gH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
    }
    for (let lv = 1; lv <= 99; lv += 10) {
      const x = padL + ((lv - 1) / 98) * gW;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + gH);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + gH);
    ctx.lineTo(W - padR, padT + gH);
    ctx.stroke();

    // Fill under curve
    const color = PARAM_COLORS[activeTab];
    ctx.fillStyle = color + '40';
    ctx.beginPath();
    ctx.moveTo(padL, padT + gH);
    for (let i = 0; i < 99; i++) {
      const x = padL + (i / 98) * gW;
      const v = Math.max(0, Math.min(currentArr[i], maxVal));
      const y = padT + gH - (v / maxVal) * gH;
      ctx.lineTo(x, y);
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
      const v = Math.max(0, Math.min(currentArr[i], maxVal));
      const y = padT + gH - (v / maxVal) * gH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw modified points (anchor markers)
    const modSet = modifiedPointsRef.current[activeTab];
    if (modSet.size > 0) {
      for (const idx of modSet) {
        const x = padL + (idx / 98) * gW;
        const v = Math.max(0, Math.min(currentArr[idx], maxVal));
        const y = padT + gH - (v / maxVal) * gH;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw points (every 10 levels)
    for (let lv = 1; lv <= 99; lv += 10) {
      const i = lv - 1;
      if (modSet.has(i)) continue; // already drawn as anchor
      const x = padL + (i / 98) * gW;
      const v = Math.max(0, Math.min(currentArr[i], maxVal));
      const y = padT + gH - (v / maxVal) * gH;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    for (let lv = 1; lv <= 99; lv += 10) {
      const x = padL + ((lv - 1) / 98) * gW;
      ctx.fillText(String(lv), x, padT + gH + 16);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((i / 4) * maxVal);
      const y = padT + gH - (i / 4) * gH;
      ctx.fillText(String(val), padL - 5, y);
    }
    ctx.textBaseline = 'alphabetic';
  }, [currentArr, activeTab, maxVal]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
      drawGraph();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawGraph]);

  // Mouse -> level/value mapping
  const canvasToLvVal = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const W = canvas.width, H = canvas.height;
    const padL = 50, padR = 15, padT = 15, padB = 30;
    const gW = W - padL - padR;
    const gH = H - padT - padB;

    const lv = Math.round(((mx - padL) / gW) * 98) + 1;
    const val = Math.round((1 - (my - padT) / gH) * maxVal);

    return {
      lv: Math.max(1, Math.min(99, lv)),
      val: Math.max(0, Math.min(maxVal, val))
    };
  }, [maxVal]);

  const applyDragPoint = useCallback((lv: number, val: number) => {
    const idx = lv - 1;
    modifiedPointsRef.current[activeTab].add(idx);
    setParams(prev => {
      const newParams = prev.map(a => [...a]);
      newParams[activeTab][idx] = val;
      return newParams;
    });
  }, [activeTab]);

  const interpolateDrag = useCallback((fromLv: number, toLv: number, toVal: number) => {
    setParams(prev => {
      const newParams = prev.map(a => [...a]);
      const arr = newParams[activeTab];
      const modSet = modifiedPointsRef.current[activeTab];
      if (fromLv === toLv) {
        arr[toLv - 1] = toVal;
        modSet.add(toLv - 1);
      } else {
        const fromVal = arr[fromLv - 1];
        const minLv = Math.min(fromLv, toLv);
        const maxLv = Math.max(fromLv, toLv);
        for (let lv = minLv; lv <= maxLv; lv++) {
          const t = (lv - fromLv) / (toLv - fromLv);
          arr[lv - 1] = Math.round(fromVal + (toVal - fromVal) * t);
          modSet.add(lv - 1);
        }
      }
      return newParams;
    });
  }, [activeTab]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = canvasToLvVal(e);
    if (!pt) return;
    isDragging.current = true;
    lastDragLv.current = pt.lv;
    applyDragPoint(pt.lv, pt.val);
  }, [canvasToLvVal, applyDragPoint]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const pt = canvasToLvVal(e);
    if (!pt) return;
    if (lastDragLv.current >= 0 && lastDragLv.current !== pt.lv) {
      interpolateDrag(lastDragLv.current, pt.lv, pt.val);
    } else {
      applyDragPoint(pt.lv, pt.val);
    }
    lastDragLv.current = pt.lv;
  }, [canvasToLvVal, applyDragPoint, interpolateDrag]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    lastDragLv.current = -1;
  }, []);

  // Generate curve
  const handleGenerate = useCallback(() => {
    const lv1 = currentArr[0];
    const lv99 = currentArr[98];
    const curve = generateCurve(lv1, lv99, growthType);
    modifiedPointsRef.current[activeTab].clear();
    setParams(prev => {
      const newParams = prev.map(a => [...a]);
      newParams[activeTab] = curve;
      return newParams;
    });
  }, [currentArr, growthType, activeTab]);

  // Apply preset
  const applyPreset = useCallback((presetIdx: number) => {
    const key = PARAM_KEYS[activeTab];
    const preset = PARAM_PRESETS[key][presetIdx];
    const curve = generateCurve(preset[0], preset[1], 0.5);
    modifiedPointsRef.current[activeTab].clear();
    setParams(prev => {
      const newParams = prev.map(a => [...a]);
      newParams[activeTab] = curve;
      return newParams;
    });
  }, [activeTab]);

  // Interpolation: smooth between modified anchor points using cubic spline
  const handleInterpolate = useCallback(() => {
    const modSet = modifiedPointsRef.current[activeTab];
    if (modSet.size < 2) return; // need at least 2 anchor points

    setParams(prev => {
      const newParams = prev.map(a => [...a]);
      const arr = newParams[activeTab];
      const anchors = Array.from(modSet)
        .sort((a, b) => a - b)
        .map(idx => ({ idx, val: arr[idx] }));

      const interpolated = cubicSplineInterpolate(anchors, 99, maxVal);

      // Apply interpolated values only between first and last anchor
      const firstIdx = anchors[0].idx;
      const lastIdx = anchors[anchors.length - 1].idx;
      for (let i = firstIdx; i <= lastIdx; i++) {
        if (!modSet.has(i)) {
          arr[i] = interpolated[i];
        }
      }

      return newParams;
    });
  }, [activeTab, maxVal]);

  // Clear modified points
  const handleClearAnchors = useCallback(() => {
    modifiedPointsRef.current[activeTab].clear();
    // Force re-render
    setParams(prev => prev.map(a => [...a]));
  }, [activeTab]);

  // Value editing
  const handleValueChange = useCallback((lv: number, val: number) => {
    setParams(prev => {
      const newParams = prev.map(a => [...a]);
      newParams[activeTab][lv - 1] = Math.max(0, Math.min(maxVal, val));
      return newParams;
    });
  }, [activeTab, maxVal]);

  // Build columns for the table (20 levels per column)
  const columns: { startLv: number; endLv: number }[] = [];
  for (let start = 1; start <= 99; start += LEVELS_PER_COL) {
    columns.push({ startLv: start, endLv: Math.min(start + LEVELS_PER_COL - 1, 99) });
  }

  const modCount = modifiedPointsRef.current[activeTab].size;

  return (
    <div className="param-curve-overlay" onMouseUp={handleMouseUp}>
      <div className="param-curve-dialog">
        <div className="param-curve-header">
          {t('fields.paramCurves')}
        </div>
        <div className="param-curve-body">
          {/* Param tabs */}
          <div className="param-curve-tabs">
            {PARAM_NAMES.map((name, i) => (
              <div
                key={i}
                className={`param-curve-tab${i === activeTab ? ' active' : ''}`}
                style={i === activeTab ? { borderBottomColor: PARAM_COLORS[i] } : undefined}
                onClick={() => setActiveTab(i)}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Controls row */}
          <div className="param-curve-controls">
            <div className="param-curve-presets">
              <span className="param-curve-label">{t('paramCurve.quickSetup', '간단 설정')}</span>
              {['A', 'B', 'C', 'D', 'E'].map((letter, i) => (
                <button key={letter} className="db-btn-small param-preset-btn" onClick={() => applyPreset(i)}>
                  {letter}
                </button>
              ))}
            </div>
            <div className="param-curve-lv-val">
              <span className="param-curve-label">{t('fields.level', '레벨')}:</span>
              <input
                type="number"
                className="param-curve-input"
                value={currentArr[0]}
                min={0}
                max={maxVal}
                onChange={(e) => handleValueChange(1, Number(e.target.value))}
              />
              <span className="param-curve-arrow">&gt;</span>
              <span className="param-curve-label">{t('paramCurve.value', '값')}:</span>
              <input
                type="number"
                className="param-curve-input"
                value={currentArr[98]}
                min={0}
                max={maxVal}
                onChange={(e) => handleValueChange(99, Number(e.target.value))}
              />
              <button className="db-btn param-generate-btn" onClick={handleGenerate}>
                {t('paramCurve.generateCurve', '곡선 생성...')}
              </button>
            </div>
            <div className="param-curve-interpolate">
              <button
                className="db-btn"
                onClick={handleInterpolate}
                disabled={modCount < 2}
                title={t('paramCurve.interpolateDesc', '수정한 포인트를 기준으로 곡선 보간')}
              >
                {t('paramCurve.interpolate', '보간')} ({modCount})
              </button>
              {modCount > 0 && (
                <button
                  className="db-btn-small"
                  onClick={handleClearAnchors}
                  title={t('paramCurve.clearAnchors', '앵커 초기화')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Growth type slider */}
          <div className="param-curve-growth">
            <span className="param-curve-growth-label">{t('paramCurve.fast', '빠른 성장')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={growthType}
              onChange={(e) => setGrowthType(Number(e.target.value))}
              className="param-curve-growth-slider"
            />
            <span className="param-curve-growth-label">{t('paramCurve.slow', '느린 성장')}</span>
          </div>

          {/* Graph */}
          <div className="param-curve-graph-container">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
            />
          </div>

          {/* Value table */}
          <div className="param-curve-table">
            {columns.map((col, ci) => (
              <div key={ci} className="param-curve-table-col">
                {Array.from({ length: col.endLv - col.startLv + 1 }, (_, j) => {
                  const lv = col.startLv + j;
                  return (
                    <div key={lv} className="param-curve-table-row">
                      <span className="param-curve-table-lv">Lv {String(lv).padStart(2, ' ')}</span>
                      <input
                        type="number"
                        className="param-curve-table-input"
                        style={{ color: getValueColor(lv) }}
                        value={currentArr[lv - 1]}
                        min={0}
                        max={maxVal}
                        onChange={(e) => handleValueChange(lv, Number(e.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="param-curve-footer">
          <button className="db-btn" onClick={() => onConfirm(params)}>OK</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel', '취소')}</button>
        </div>
      </div>
    </div>
  );
}
