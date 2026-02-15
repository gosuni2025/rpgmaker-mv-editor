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
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const handleParamChange = useCallback((index: number, value: number) => {
    setExpParams(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

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
    const padL = 60, padR = 15, padT = 15, padB = 30;
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
    ctx.fillStyle = '#4fc3f740';
    ctx.beginPath();
    ctx.moveTo(padL, padT + gH);
    for (let i = 0; i < 99; i++) {
      const x = padL + (i / 98) * gW;
      const y = padT + gH - (values[i] / maxVal) * gH;
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
      const y = padT + gH - (values[i] / maxVal) * gH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw points (every 10 levels)
    for (let lv = 1; lv <= 99; lv += 10) {
      const i = lv - 1;
      const x = padL + (i / 98) * gW;
      const y = padT + gH - (values[i] / maxVal) * gH;
      ctx.fillStyle = '#4fc3f7';
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
      ctx.fillText(val.toLocaleString(), padL - 5, y);
    }
    ctx.textBaseline = 'alphabetic';
  }, [expValues, totalValues, viewMode]);

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
              style={{ width: '100%', height: '100%' }}
            />
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
