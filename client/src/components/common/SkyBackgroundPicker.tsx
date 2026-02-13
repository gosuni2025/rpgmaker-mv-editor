import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../api/client';
import './SkyBackgroundPicker.css';

interface SkyBackgroundPickerProps {
  value: string;
  rotationSpeed: number;
  sunPosition?: [number, number] | null;
  onChange: (image: string, rotationSpeed: number, sunPosition?: [number, number] | null) => void;
}

export default function SkyBackgroundPicker({ value, rotationSpeed, sunPosition, onChange }: SkyBackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [speed, setSpeed] = useState(rotationSpeed);
  const [sunPos, setSunPos] = useState<[number, number] | null>(sunPosition ?? null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(value);
    setSpeed(rotationSpeed);
    setSunPos(sunPosition ?? null);
    apiClient.get<string[]>('/resources/img_skybox').then(setFiles).catch(() => setFiles([]));
  }, [open]);

  const pngs = files.filter(f => /\.png$/i.test(f));

  const handleOk = () => {
    onChange(selected, speed, sunPos);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selected) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSunPos([u, v]);
  }, [selected]);

  const handleClearSun = () => {
    setSunPos(null);
  };

  return (
    <div className="sky-picker">
      <div className="audio-picker-preview" onClick={() => setOpen(true)}>
        {value ? (
          <div className="sky-picker-thumb-inline">
            <img src={`/api/resources/img_skybox/${value}`} alt={value} />
            <span>{value.replace(/\.png$/i, '')}</span>
          </div>
        ) : (
          <span>(없음)</span>
        )}
      </div>
      {open && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}>
          <div className="sky-picker-dialog">
            <div className="audio-picker-header">스카이 이미지 선택</div>
            <div className="sky-picker-body">
              <div className="sky-picker-grid">
                <div
                  className={`sky-picker-thumb${selected === '' ? ' selected' : ''}`}
                  onClick={() => setSelected('')}
                >
                  <div className="sky-picker-thumb-empty">(없음)</div>
                </div>
                {pngs.map(f => (
                  <div
                    key={f}
                    className={`sky-picker-thumb${selected === f ? ' selected' : ''}`}
                    onClick={() => setSelected(f)}
                  >
                    <img src={`/api/resources/img_skybox/${f}`} alt={f} loading="lazy" />
                    <span className="sky-picker-thumb-name">{f.replace(/\.png$/i, '').replace(/-\d+x\d+$/, '')}</span>
                  </div>
                ))}
              </div>
              <div className="sky-picker-controls">
                <div
                  ref={previewRef}
                  className={`sky-picker-preview-area${selected ? ' sky-picker-preview-clickable' : ''}`}
                  onClick={handlePreviewClick}
                >
                  {selected ? (
                    <>
                      <img src={`/api/resources/img_skybox/${selected}`} alt={selected} draggable={false} />
                      {sunPos && (
                        <div
                          className="sky-picker-sun-marker"
                          style={{ left: `${sunPos[0] * 100}%`, top: `${sunPos[1] * 100}%` }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="sky-picker-preview-empty">미리보기 없음</div>
                  )}
                </div>
                {/* 태양 광원 위치 */}
                <div className="sky-picker-sun-section">
                  <div className="sky-picker-sun-header">
                    <span className="sky-picker-sun-title">태양 광원 위치</span>
                    {sunPos && (
                      <button className="sky-picker-sun-clear" onClick={handleClearSun}>초기화</button>
                    )}
                  </div>
                  <div className="sky-picker-sun-hint">
                    {sunPos
                      ? `U: ${sunPos[0].toFixed(2)}, V: ${sunPos[1].toFixed(2)} — 미리보기 클릭으로 변경`
                      : '미리보기 이미지를 클릭하여 태양 위치를 지정하세요'}
                  </div>
                </div>
                <div className="audio-picker-slider-group" style={{ marginTop: 8 }}>
                  <span className="audio-picker-slider-title">회전 속도</span>
                  <input type="range" min={-5} max={5} step={0.1} value={speed}
                    onChange={e => setSpeed(Number(e.target.value))} />
                  <div className="audio-picker-value-input">
                    <input type="number" min={-5} max={5} step={0.1} value={speed}
                      onChange={e => setSpeed(Number(e.target.value))} />
                    <span>deg/s</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="audio-picker-footer">
              <button className="db-btn" onClick={handleOk}>OK</button>
              <button className="db-btn" onClick={handleCancel}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
