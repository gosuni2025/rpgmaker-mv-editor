import React, { useState, useCallback } from 'react';
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

  // Build columns (20 levels per column)
  const columns: { startLv: number; endLv: number }[] = [];
  for (let start = 1; start <= 99; start += LEVELS_PER_COL) {
    columns.push({ startLv: start, endLv: Math.min(start + LEVELS_PER_COL - 1, 99) });
  }

  const PARAM_LABELS = EXP_PARAM_KEYS.map(k => t(`expParams.${k}`));

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

          {/* Value table */}
          <div className="exp-curve-table">
            {columns.map((col, ci) => (
              <div key={ci} className="exp-curve-table-col">
                {Array.from({ length: col.endLv - col.startLv + 1 }, (_, j) => {
                  const lv = col.startLv + j;
                  return (
                    <div key={lv} className="exp-curve-table-row">
                      <span className="exp-curve-table-lv">L{String(lv).padStart(2, ' ')}:</span>
                      <span className="exp-curve-table-val">{displayValues[lv - 1].toLocaleString()}</span>
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
