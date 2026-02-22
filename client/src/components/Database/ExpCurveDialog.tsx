import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEscClose from '../../hooks/useEscClose';
import './ExpCurveDialog.css';

interface ExpCurveDialogProps {
  expParams: number[]; // [base, extra, accA, accB]
  onConfirm: (expParams: number[]) => void;
  onCancel: () => void;
}

// RPG Maker MV EXP formula
function expForLevel(level: number, expParams: number[]): number {
  const basis = expParams[0] || 30;
  const extra = expParams[1] || 20;
  const acc_a = expParams[2] || 30;
  const acc_b = expParams[3] || 30;
  return Math.round(
    basis * (Math.pow(level - 1, 0.9 + acc_a / 250)) * level *
    (level + 1) / (6 + Math.pow(level, 2) / 50 / acc_b) + (level - 1) * extra
  );
}

const LEVELS_PER_COL = 20;
const EXP_PARAM_KEYS = ['baseValue', 'extraValue', 'accelerationA', 'accelerationB'];

export default function ExpCurveDialog({ expParams: initial, onConfirm, onCancel }: ExpCurveDialogProps) {
  const { t } = useTranslation();
  useEscClose(onCancel);
  const [expParams, setExpParams] = useState<number[]>([...initial]);
  const [viewMode, setViewMode] = useState<'next' | 'total'>('next');
  const [yScale, setYScale] = useState<'linear' | 'log'>('linear');

  // 다이얼로그 내부 undo/redo
  const undoStackRef = useRef<number[][]>([]);
  const redoStackRef = useRef<number[][]>([]);

  const pushUndo = useCallback((snapshot: number[]) => {
    undoStackRef.current = [...undoStackRef.current, [...snapshot]];
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, []);

  const internalUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setExpParams(current => {
      redoStackRef.current = [...redoStackRef.current, [...current]];
      return [...prev];
    });
  }, []);

  const internalRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    setExpParams(current => {
      undoStackRef.current = [...undoStackRef.current, [...current]];
      return [...next];
    });
  }, []);
  // Y축 줌/패닝 상태: yZoomMin ~ yZoomMax (0~1 범위, 전체 데이터 대비 비율)
  const [yZoomMin, setYZoomMin] = useState(0);
  const [yZoomMax, setYZoomMax] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ y: 0, yMin: 0, yMax: 0 });

  // Compute initial EXP values for comparison
  const initialValuesRef = useRef<{ next: number[]; total: number[] } | null>(null);
  if (!initialValuesRef.current) {
    const next: number[] = [];
    const total: number[] = [];
    let running = 0;
    for (let lv = 1; lv <= 99; lv++) {
      const v = expForLevel(lv, initial);
      next.push(v);
      running += v;
      total.push(running);
    }
    initialValuesRef.current = { next, total };
  }

  // viewMode나 yScale 변경 시 줌 리셋
  const prevViewRef = useRef(viewMode);
  const prevScaleRef = useRef(yScale);
  if (prevViewRef.current !== viewMode || prevScaleRef.current !== yScale) {
    prevViewRef.current = viewMode;
    prevScaleRef.current = yScale;
    setYZoomMin(0);
    setYZoomMax(1);
  }

  const handleParamChange = useCallback((index: number, value: number) => {
    setExpParams(prev => {
      pushUndo(prev);
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, [pushUndo]);

  // Compute EXP values
  const expValues: number[] = [];
  const totalValues: number[] = [];
  let runningTotal = 0;
  for (let lv = 1; lv <= 99; lv++) {
    const v = expForLevel(lv, expParams);
    expValues.push(v);
    runningTotal += v;
    totalValues.push(runningTotal);
  }

  const displayValues = viewMode === 'next' ? expValues : totalValues;
  const initialDisplay = viewMode === 'next'
    ? initialValuesRef.current.next
    : initialValuesRef.current.total;

  // Value color: red=increase, blue=decrease, white=same
  const getValueColor = (index: number) => {
    const cur = displayValues[index];
    const orig = initialDisplay[index];
    if (cur > orig) return '#e57373';
    if (cur < orig) return '#64b5f6';
    return '#ddd';
  };

  // Build columns (20 levels per column)
  const columns: { startLv: number; endLv: number }[] = [];
  for (let start = 1; start <= 99; start += LEVELS_PER_COL) {
    columns.push({ startLv: start, endLv: Math.min(start + LEVELS_PER_COL - 1, 99) });
  }

  const PARAM_LABELS = EXP_PARAM_KEYS.map(k => t(`expParams.${k}`));

  // Draw graph
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const padL = 70, padR = 15, padT = 15, padB = 30;
    const gW = W - padL - padR;
    const gH = H - padT - padB;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    const values = viewMode === 'next' ? expValues : totalValues;
    let maxVal = 0;
    for (const v of values) {
      if (v > maxVal) maxVal = v;
    }
    if (maxVal === 0) maxVal = 1;

    // Y축 매핑 함수: 데이터 값 → 정규화 비율(0~1)
    const useLog = yScale === 'log';
    const logMin = useLog ? Math.log10(Math.max(1, values[0] || 1)) : 0;
    const logMax = useLog ? Math.log10(maxVal) : maxVal;

    // 정규화: 값 → 0~1 (전체 범위 기준)
    const normalize = (v: number): number => {
      if (useLog) {
        const lv = Math.log10(Math.max(1, v));
        return logMax > logMin ? (lv - logMin) / (logMax - logMin) : 0;
      }
      return v / maxVal;
    };

    // 줌 범위 적용: 정규화된 0~1 → 현재 뷰 비율
    const valToY = (v: number): number => {
      const norm = normalize(v);
      const viewRange = yZoomMax - yZoomMin;
      const mapped = viewRange > 0 ? (norm - yZoomMin) / viewRange : 0;
      return padT + gH - mapped * gH;
    };

    // 역변환: 정규화 비율 → 실제 값
    const denormalize = (norm: number): number => {
      if (useLog) {
        return Math.pow(10, logMin + norm * (logMax - logMin));
      }
      return norm * maxVal;
    };

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

    // Clip to graph area
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, gW, gH);
    ctx.clip();

    // Fill under curve
    ctx.fillStyle = '#4fc3f740';
    ctx.beginPath();
    ctx.moveTo(padL, padT + gH);
    for (let i = 0; i < 99; i++) {
      const x = padL + (i / 98) * gW;
      const y = valToY(values[i]);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padL + gW, padT + gH);
    ctx.closePath();
    ctx.fill();

    // Curve line
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 99; i++) {
      const x = padL + (i / 98) * gW;
      const y = valToY(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw points (every 10 levels)
    for (let lv = 1; lv <= 99; lv += 10) {
      const i = lv - 1;
      const x = padL + (i / 98) * gW;
      const y = valToY(values[i]);
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore(); // unclip

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
    const labelCount = 5;
    for (let i = 0; i <= labelCount; i++) {
      const viewNorm = yZoomMin + (i / labelCount) * (yZoomMax - yZoomMin);
      const val = Math.round(denormalize(viewNorm));
      const y = padT + gH - (i / labelCount) * gH;
      ctx.fillText(val.toLocaleString(), padL - 5, y);
    }
    ctx.textBaseline = 'alphabetic';
  }, [expValues, totalValues, viewMode, yScale, yZoomMin, yZoomMax]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Mouse wheel zoom on Y axis
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padT = 15, padB = 30;
    const gH = canvas.height - padT - padB;
    // 마우스 위치의 Y 비율 (0=하단, 1=상단)
    const mouseY = e.clientY - rect.top;
    const canvasY = mouseY * (canvas.height / rect.height);
    const yRatio = 1 - Math.max(0, Math.min(1, (canvasY - padT) / gH));

    const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const curMin = yZoomMin;
    const curMax = yZoomMax;
    const range = curMax - curMin;
    const newRange = Math.min(1, range * zoomFactor);
    // 마우스 위치를 기준으로 확대/축소
    const pivot = curMin + yRatio * range;
    let newMin = pivot - yRatio * newRange;
    let newMax = pivot + (1 - yRatio) * newRange;
    // 범위 클램프
    if (newMin < 0) { newMax -= newMin; newMin = 0; }
    if (newMax > 1) { newMin -= (newMax - 1); newMax = 1; }
    newMin = Math.max(0, newMin);
    newMax = Math.min(1, newMax);
    setYZoomMin(newMin);
    setYZoomMax(newMax);
  }, [yZoomMin, yZoomMax]);

  // Mouse drag panning
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    isPanningRef.current = true;
    panStartRef.current = { y: e.clientY, yMin: yZoomMin, yMax: yZoomMax };
  }, [yZoomMin, yZoomMax]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padT = 15, padB = 30;
    const gH = rect.height - (padT + padB) * (rect.height / canvas.height);
    const dy = e.clientY - panStartRef.current.y;
    const range = panStartRef.current.yMax - panStartRef.current.yMin;
    const delta = (dy / gH) * range;
    let newMin = panStartRef.current.yMin + delta;
    let newMax = panStartRef.current.yMax + delta;
    if (newMin < 0) { newMax -= newMin; newMin = 0; }
    if (newMax > 1) { newMin -= (newMax - 1); newMax = 1; }
    newMin = Math.max(0, newMin);
    newMax = Math.min(1, newMax);
    setYZoomMin(newMin);
    setYZoomMax(newMax);
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Non-passive wheel event to allow preventDefault
  const wheelHandlerRef = useRef(handleWheel);
  wheelHandlerRef.current = handleWheel;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      wheelHandlerRef.current(e as unknown as React.WheelEvent<HTMLCanvasElement>);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

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

  // 다이얼로그 내부 undo/redo 키 핸들러
  const internalUndoRef = useRef(internalUndo);
  const internalRedoRef = useRef(internalRedo);
  internalUndoRef.current = internalUndo;
  internalRedoRef.current = internalRedo;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        internalUndoRef.current();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        e.stopPropagation();
        internalRedoRef.current();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <div className="exp-curve-overlay">
      <div className="exp-curve-dialog">
        <div className="exp-curve-header">
          {t('fields.expCurve')}
        </div>
        <div className="exp-curve-body">
          {/* View mode tabs */}
          <div className="exp-curve-view-tabs">
            <div
              className={`exp-curve-view-tab${viewMode === 'next' ? ' active' : ''}`}
              onClick={() => setViewMode('next')}
            >
              {t('expCurve.nextLevel', '다음 레벨까지')}
            </div>
            <div
              className={`exp-curve-view-tab${viewMode === 'total' ? ' active' : ''}`}
              onClick={() => setViewMode('total')}
            >
              {t('expCurve.total', '총계')}
            </div>
          </div>

          {/* Graph */}
          <div className="exp-curve-graph-container">
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%', cursor: isPanningRef.current ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div className="exp-curve-graph-controls">
              <button
                className={`exp-curve-scale-btn${yScale === 'linear' ? ' active' : ''}`}
                onClick={() => setYScale('linear')}
                title="Linear"
              >
                Lin
              </button>
              <button
                className={`exp-curve-scale-btn${yScale === 'log' ? ' active' : ''}`}
                onClick={() => setYScale('log')}
                title="Logarithmic"
              >
                Log
              </button>
              {(yZoomMin > 0.001 || yZoomMax < 0.999) && (
                <button
                  className="exp-curve-scale-btn"
                  onClick={() => { setYZoomMin(0); setYZoomMax(1); }}
                  title={t('expCurve.resetZoom', '줌 리셋')}
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* Value table */}
          <div className="exp-curve-table">
            {columns.map((col, ci) => (
              <div key={ci} className="exp-curve-table-col">
                {Array.from({ length: col.endLv - col.startLv + 1 }, (_, j) => {
                  const lv = col.startLv + j;
                  return (
                    <div key={lv} className="exp-curve-table-row">
                      <span className="exp-curve-table-lv">L{String(lv).padStart(2, ' ')}:</span>
                      <span className="exp-curve-table-val" style={{ color: getValueColor(lv - 1) }}>
                        {displayValues[lv - 1].toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Param controls */}
          <div className="exp-curve-params">
            {PARAM_LABELS.map((label, i) => (
              <label key={i} className="exp-curve-param">
                {label}
                <input
                  type="number"
                  value={expParams[i]}
                  onChange={(e) => handleParamChange(i, Number(e.target.value))}
                  className="exp-curve-param-input"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="exp-curve-footer">
          <button className="db-btn" onClick={() => onConfirm(expParams)}>OK</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel', '취소')}</button>
        </div>
      </div>
    </div>
  );
}
