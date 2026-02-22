import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEscClose from '../../hooks/useEscClose';
import {
  PARAM_KEYS, PARAM_COLORS, PARAM_PRESETS, LEVELS_PER_COL,
  generateCurve, cubicSplineInterpolate, getMaxForParam,
  drawParamGraph, canvasToLevelValue,
} from './paramCurveUtils';
import './ParamCurveDialog.css';

interface ParamCurveDialogProps {
  params: number[][];
  initialTab?: number;
  onConfirm: (params: number[][]) => void;
  onCancel: () => void;
}

export default function ParamCurveDialog({ params: initialParams, initialTab = 0, onConfirm, onCancel }: ParamCurveDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [params, setParams] = useState<number[][]>(() => initialParams.map(arr => [...arr]));
  const [growthType, setGrowthType] = useState(0.5);
  const [yScale, setYScale] = useState<'linear' | 'log'>('linear');
  const [yZoomMin, setYZoomMin] = useState(0);
  const [yZoomMax, setYZoomMax] = useState(1);

  const initialParamsRef = useRef<number[][]>(initialParams.map(arr => [...arr]));
  const modifiedPointsRef = useRef<Set<number>[]>(Array.from({ length: 8 }, () => new Set<number>()));

  // 다이얼로그 내부 undo/redo
  const undoStackRef = useRef<number[][][]>([]);
  const redoStackRef = useRef<number[][][]>([]);
  const dragSnapshotRef = useRef<number[][] | null>(null);
  const paramsRef = useRef<number[][]>(params);
  paramsRef.current = params;

  useEscClose(onCancel);

  const pushUndo = useCallback((snapshot: number[][]) => {
    undoStackRef.current = [...undoStackRef.current, snapshot.map(a => [...a])];
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, []);

  const internalUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setParams(current => {
      redoStackRef.current = [...redoStackRef.current, current.map(a => [...a])];
      modifiedPointsRef.current = Array.from({ length: 8 }, () => new Set<number>());
      return prev.map(a => [...a]);
    });
  }, []);

  const internalRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    setParams(current => {
      undoStackRef.current = [...undoStackRef.current, current.map(a => [...a])];
      modifiedPointsRef.current = Array.from({ length: 8 }, () => new Set<number>());
      return next.map(a => [...a]);
    });
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const lastDragLv = useRef(-1);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ y: 0, yMin: 0, yMax: 0 });

  // 탭/스케일 변경 시 줌 리셋
  const prevTabRef = useRef(activeTab);
  const prevScaleRef = useRef(yScale);
  if (prevTabRef.current !== activeTab || prevScaleRef.current !== yScale) {
    prevTabRef.current = activeTab;
    prevScaleRef.current = yScale;
    setYZoomMin(0);
    setYZoomMax(1);
  }

  const PARAM_NAMES = PARAM_KEYS.map(k => t(`params.${k}`));
  const currentArr = params[activeTab] || new Array(99).fill(0);
  const maxVal = getMaxForParam(activeTab);

  const getValueColor = useCallback((lv: number) => {
    const cur = params[activeTab][lv - 1];
    const orig = initialParamsRef.current[activeTab][lv - 1];
    if (cur > orig) return '#e57373';
    if (cur < orig) return '#64b5f6';
    return '#ddd';
  }, [params, activeTab]);

  // Draw graph
  const drawGraph = useCallback(() => {
    if (!canvasRef.current) return;
    drawParamGraph(canvasRef.current, {
      activeTab, currentArr, maxVal, yScale, yZoomMin, yZoomMax,
      modifiedPoints: modifiedPointsRef.current[activeTab],
    });
  }, [currentArr, activeTab, maxVal, yScale, yZoomMin, yZoomMax]);

  useEffect(() => { drawGraph(); }, [drawGraph]);

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

  // Canvas interaction
  const canvasToLvVal = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;
    return canvasToLevelValue(canvasRef.current, e.clientX, e.clientY, maxVal, yScale, yZoomMin, yZoomMax, currentArr);
  }, [maxVal, yScale, yZoomMin, yZoomMax, currentArr]);

  const applyDragPoint = useCallback((lv: number, val: number) => {
    modifiedPointsRef.current[activeTab].add(lv - 1);
    setParams(prev => {
      const np = prev.map(a => [...a]);
      np[activeTab][lv - 1] = val;
      return np;
    });
  }, [activeTab]);

  const interpolateDrag = useCallback((fromLv: number, toLv: number, toVal: number) => {
    setParams(prev => {
      const np = prev.map(a => [...a]);
      const arr = np[activeTab];
      const modSet = modifiedPointsRef.current[activeTab];
      if (fromLv === toLv) {
        arr[toLv - 1] = toVal;
        modSet.add(toLv - 1);
      } else {
        const fromVal = arr[fromLv - 1];
        const minLv = Math.min(fromLv, toLv), maxLv = Math.max(fromLv, toLv);
        for (let lv = minLv; lv <= maxLv; lv++) {
          arr[lv - 1] = Math.round(fromVal + (toVal - fromVal) * ((lv - fromLv) / (toLv - fromLv)));
          modSet.add(lv - 1);
        }
      }
      return np;
    });
  }, [activeTab]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { y: e.clientY, yMin: yZoomMin, yMax: yZoomMax };
      return;
    }
    if (e.button !== 0) return;
    const pt = canvasToLvVal(e);
    if (!pt) return;
    dragSnapshotRef.current = paramsRef.current.map(a => [...a]);
    isDragging.current = true;
    lastDragLv.current = pt.lv;
    applyDragPoint(pt.lv, pt.val);
  }, [canvasToLvVal, applyDragPoint, yZoomMin, yZoomMax]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const gH = rect.height - (15 + 30) * (rect.height / canvas.height);
      const dy = e.clientY - panStartRef.current.y;
      const range = panStartRef.current.yMax - panStartRef.current.yMin;
      const delta = (dy / gH) * range;
      let newMin = panStartRef.current.yMin + delta;
      let newMax = panStartRef.current.yMax + delta;
      if (newMin < 0) { newMax -= newMin; newMin = 0; }
      if (newMax > 1) { newMin -= (newMax - 1); newMax = 1; }
      setYZoomMin(Math.max(0, newMin));
      setYZoomMax(Math.min(1, newMax));
      return;
    }
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
    if (isDragging.current && dragSnapshotRef.current) {
      pushUndo(dragSnapshotRef.current);
      dragSnapshotRef.current = null;
    }
    isDragging.current = false;
    lastDragLv.current = -1;
    isPanningRef.current = false;
  }, [pushUndo]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gH = canvas.height - 15 - 30;
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const yRatio = 1 - Math.max(0, Math.min(1, (canvasY - 15) / gH));
    const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const range = yZoomMax - yZoomMin;
    const newRange = Math.min(1, range * zoomFactor);
    const pivot = yZoomMin + yRatio * range;
    let newMin = pivot - yRatio * newRange;
    let newMax = pivot + (1 - yRatio) * newRange;
    if (newMin < 0) { newMax -= newMin; newMin = 0; }
    if (newMax > 1) { newMin -= (newMax - 1); newMax = 1; }
    setYZoomMin(Math.max(0, newMin));
    setYZoomMax(Math.min(1, newMax));
  }, [yZoomMin, yZoomMax]);

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

  const handleGenerate = useCallback(() => {
    modifiedPointsRef.current[activeTab].clear();
    setParams(prev => {
      pushUndo(prev);
      const np = prev.map(a => [...a]);
      np[activeTab] = generateCurve(currentArr[0], currentArr[98], growthType);
      return np;
    });
  }, [currentArr, growthType, activeTab, pushUndo]);

  const applyPreset = useCallback((presetIdx: number) => {
    const preset = PARAM_PRESETS[PARAM_KEYS[activeTab]][presetIdx];
    modifiedPointsRef.current[activeTab].clear();
    setParams(prev => {
      pushUndo(prev);
      const np = prev.map(a => [...a]);
      np[activeTab] = generateCurve(preset[0], preset[1], 0.5);
      return np;
    });
  }, [activeTab, pushUndo]);

  const handleInterpolate = useCallback(() => {
    const modSet = modifiedPointsRef.current[activeTab];
    if (modSet.size < 2) return;
    setParams(prev => {
      pushUndo(prev);
      const np = prev.map(a => [...a]);
      const arr = np[activeTab];
      const anchors = Array.from(modSet).sort((a, b) => a - b).map(idx => ({ idx, val: arr[idx] }));
      const interpolated = cubicSplineInterpolate(anchors, 99, maxVal);
      const firstIdx = anchors[0].idx, lastIdx = anchors[anchors.length - 1].idx;
      for (let i = firstIdx; i <= lastIdx; i++) {
        if (!modSet.has(i)) arr[i] = interpolated[i];
      }
      return np;
    });
  }, [activeTab, maxVal, pushUndo]);

  const handleClearAnchors = useCallback(() => {
    modifiedPointsRef.current[activeTab].clear();
    setParams(prev => prev.map(a => [...a]));
  }, [activeTab]);

  const handleValueChange = useCallback((lv: number, val: number) => {
    setParams(prev => {
      pushUndo(prev);
      const np = prev.map(a => [...a]);
      np[activeTab][lv - 1] = Math.max(0, Math.min(maxVal, val));
      return np;
    });
  }, [activeTab, maxVal, pushUndo]);

  const columns: { startLv: number; endLv: number }[] = [];
  for (let start = 1; start <= 99; start += LEVELS_PER_COL) {
    columns.push({ startLv: start, endLv: Math.min(start + LEVELS_PER_COL - 1, 99) });
  }
  const modCount = modifiedPointsRef.current[activeTab].size;

  return (
    <div className="param-curve-overlay" onMouseUp={handleMouseUp}>
      <div className="param-curve-dialog">
        <div className="param-curve-header">{t('fields.paramCurves')}</div>
        <div className="param-curve-body">
          <div className="param-curve-tabs">
            {PARAM_NAMES.map((name, i) => (
              <div key={i} className={`param-curve-tab${i === activeTab ? ' active' : ''}`}
                style={i === activeTab ? { borderBottomColor: PARAM_COLORS[i] } : undefined}
                onClick={() => setActiveTab(i)}>{name}</div>
            ))}
          </div>

          <div className="param-curve-controls">
            <div className="param-curve-presets">
              <span className="param-curve-label">{t('paramCurve.quickSetup', '간단 설정')}</span>
              {['A', 'B', 'C', 'D', 'E'].map((letter, i) => (
                <button key={letter} className="db-btn-small param-preset-btn" onClick={() => applyPreset(i)}>{letter}</button>
              ))}
            </div>
            <div className="param-curve-lv-val">
              <span className="param-curve-label">{t('fields.level', '레벨')}:</span>
              <input type="number" className="param-curve-input" value={currentArr[0]} min={0} max={maxVal}
                onChange={(e) => handleValueChange(1, Number(e.target.value))} />
              <span className="param-curve-arrow">&gt;</span>
              <span className="param-curve-label">{t('paramCurve.value', '값')}:</span>
              <input type="number" className="param-curve-input" value={currentArr[98]} min={0} max={maxVal}
                onChange={(e) => handleValueChange(99, Number(e.target.value))} />
              <button className="db-btn param-generate-btn" onClick={handleGenerate}>
                {t('paramCurve.generateCurve', '곡선 생성...')}
              </button>
            </div>
            <div className="param-curve-interpolate">
              <button className="db-btn" onClick={handleInterpolate} disabled={modCount < 2}
                title={t('paramCurve.interpolateDesc', '수정한 포인트를 기준으로 곡선 보간')}>
                {t('paramCurve.interpolate', '보간')} ({modCount})
              </button>
              {modCount > 0 && (
                <button className="db-btn-small" onClick={handleClearAnchors}
                  title={t('paramCurve.clearAnchors', '앵커 초기화')}>✕</button>
              )}
            </div>
          </div>

          <div className="param-curve-growth">
            <span className="param-curve-growth-label">{t('paramCurve.fast', '빠른 성장')}</span>
            <input type="range" min={0} max={1} step={0.01} value={growthType}
              onChange={(e) => setGrowthType(Number(e.target.value))} className="param-curve-growth-slider" />
            <span className="param-curve-growth-label">{t('paramCurve.slow', '느린 성장')}</span>
          </div>

          <div className="param-curve-graph-container">
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              style={{ width: '100%', height: '100%', cursor: 'crosshair' }} />
            <div className="param-curve-graph-controls">
              <button className={`param-curve-scale-btn${yScale === 'linear' ? ' active' : ''}`}
                onClick={() => setYScale('linear')} title="Linear">Lin</button>
              <button className={`param-curve-scale-btn${yScale === 'log' ? ' active' : ''}`}
                onClick={() => setYScale('log')} title="Logarithmic">Log</button>
              {(yZoomMin > 0.001 || yZoomMax < 0.999) && (
                <button className="param-curve-scale-btn"
                  onClick={() => { setYZoomMin(0); setYZoomMax(1); }}
                  title={t('expCurve.resetZoom', '줌 리셋')}>↺</button>
              )}
            </div>
          </div>

          <div className="param-curve-table">
            {columns.map((col, ci) => (
              <div key={ci} className="param-curve-table-col">
                {Array.from({ length: col.endLv - col.startLv + 1 }, (_, j) => {
                  const lv = col.startLv + j;
                  return (
                    <div key={lv} className="param-curve-table-row">
                      <span className="param-curve-table-lv">Lv {String(lv).padStart(2, ' ')}</span>
                      <input type="number" className="param-curve-table-input"
                        style={{ color: getValueColor(lv) }} value={currentArr[lv - 1]}
                        min={0} max={maxVal} onChange={(e) => handleValueChange(lv, Number(e.target.value))} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="param-curve-footer">
          <button className="db-btn" onClick={() => onConfirm(params)}>OK</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel', '취소')}</button>
        </div>
      </div>
    </div>
  );
}
