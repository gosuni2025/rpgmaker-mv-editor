import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../api/client';
import type { SkySunLight } from '../../types/rpgMakerMV';
import { DEFAULT_SKY_SUN_LIGHT } from '../../types/rpgMakerMV';
import useEscClose from '../../hooks/useEscClose';
import './SkyBackgroundPicker.css';

interface SkyBackgroundPickerProps {
  value: string;
  rotationSpeed: number;
  sunLights?: SkySunLight[];
  onChange: (image: string, rotationSpeed: number, sunLights: SkySunLight[]) => void;
}

export default function SkyBackgroundPicker({ value, rotationSpeed, sunLights, onChange }: SkyBackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  useEscClose(useCallback(() => { if (open) setOpen(false); }, [open]));
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [speed, setSpeed] = useState(rotationSpeed);
  const [lights, setLights] = useState<SkySunLight[]>(sunLights ?? []);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(value);
    setSpeed(rotationSpeed);
    setLights(sunLights ?? []);
    setSelectedIdx(sunLights && sunLights.length > 0 ? 0 : null);
    apiClient.get<string[]>('/resources/img_skybox').then(setFiles).catch(() => setFiles([]));
  }, [open]);

  const pngs = files.filter(f => /\.png$/i.test(f));

  const handleOk = () => {
    onChange(selected, speed, lights);
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

    if (selectedIdx !== null && selectedIdx < lights.length) {
      // 선택된 광원의 위치 이동
      const updated = lights.map((l, i) =>
        i === selectedIdx ? { ...l, position: [u, v] as [number, number] } : l
      );
      setLights(updated);
    } else {
      // 새 광원 추가
      const newLight: SkySunLight = { ...DEFAULT_SKY_SUN_LIGHT, position: [u, v] };
      const updated = [...lights, newLight];
      setLights(updated);
      setSelectedIdx(updated.length - 1);
    }
  }, [selected, selectedIdx, lights]);

  const handleAddLight = () => {
    const newLight: SkySunLight = { ...DEFAULT_SKY_SUN_LIGHT };
    const updated = [...lights, newLight];
    setLights(updated);
    setSelectedIdx(updated.length - 1);
  };

  const handleRemoveLight = (idx: number) => {
    const updated = lights.filter((_, i) => i !== idx);
    setLights(updated);
    if (selectedIdx === idx) {
      setSelectedIdx(updated.length > 0 ? Math.min(idx, updated.length - 1) : null);
    } else if (selectedIdx !== null && selectedIdx > idx) {
      setSelectedIdx(selectedIdx - 1);
    }
  };

  const updateLight = (idx: number, updates: Partial<SkySunLight>) => {
    setLights(lights.map((l, i) => i === idx ? { ...l, ...updates } : l));
  };

  const sel = selectedIdx !== null && selectedIdx < lights.length ? lights[selectedIdx] : null;

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
                {/* 미리보기 + 태양 마커 */}
                <div
                  ref={previewRef}
                  className={`sky-picker-preview-area${selected ? ' sky-picker-preview-clickable' : ''}`}
                  onClick={handlePreviewClick}
                >
                  {selected ? (
                    <>
                      <img src={`/api/resources/img_skybox/${selected}`} alt={selected} draggable={false} />
                      {lights.map((light, i) => (
                        <div
                          key={i}
                          className={`sky-picker-sun-marker${i === selectedIdx ? ' active' : ''}`}
                          style={{
                            left: `${light.position[0] * 100}%`,
                            top: `${light.position[1] * 100}%`,
                            borderColor: light.color,
                            background: `${light.color}44`,
                            boxShadow: i === selectedIdx
                              ? `0 0 10px ${light.color}, inset 0 0 4px ${light.color}66`
                              : `0 0 4px ${light.color}88`,
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedIdx(i); }}
                        />
                      ))}
                    </>
                  ) : (
                    <div className="sky-picker-preview-empty">미리보기 없음</div>
                  )}
                </div>

                {/* 태양 광원 목록 */}
                <div className="sky-picker-sun-section">
                  <div className="sky-picker-sun-header">
                    <span className="sky-picker-sun-title">태양 광원</span>
                    <button className="sky-picker-sun-add" onClick={handleAddLight}>+ 추가</button>
                  </div>
                  {lights.length === 0 && (
                    <div className="sky-picker-sun-hint">
                      미리보기 이미지를 클릭하거나 추가 버튼으로 태양 광원을 생성하세요
                    </div>
                  )}
                  {lights.length > 0 && (
                    <div className="sky-picker-sun-list">
                      {lights.map((light, i) => (
                        <div
                          key={i}
                          className={`sky-picker-sun-item${i === selectedIdx ? ' selected' : ''}`}
                          onClick={() => setSelectedIdx(i)}
                        >
                          <input
                            type="color"
                            className="sky-picker-sun-color"
                            value={light.color}
                            onChange={(e) => updateLight(i, { color: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="sky-picker-sun-item-label">광원 {i + 1}</span>
                          <span className="sky-picker-sun-item-uv">
                            ({light.position[0].toFixed(2)}, {light.position[1].toFixed(2)})
                          </span>
                          <button
                            className="sky-picker-sun-remove"
                            onClick={(e) => { e.stopPropagation(); handleRemoveLight(i); }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 선택된 광원 상세 설정 */}
                  {sel && selectedIdx !== null && (
                    <div className="sky-picker-sun-detail">
                      <div className="sky-picker-sun-detail-row">
                        <span>강도</span>
                        <input type="range" min={0} max={3} step={0.05} value={sel.intensity}
                          onChange={(e) => updateLight(selectedIdx, { intensity: Number(e.target.value) })} />
                        <input type="number" min={0} max={3} step={0.05} value={sel.intensity}
                          className="sky-picker-sun-num"
                          onChange={(e) => updateLight(selectedIdx, { intensity: Number(e.target.value) })} />
                      </div>
                      <div className="sky-picker-sun-detail-row">
                        <span>그림자</span>
                        <label className="sky-picker-sun-checkbox">
                          <input type="checkbox" checked={sel.castShadow !== false}
                            onChange={(e) => updateLight(selectedIdx, { castShadow: e.target.checked })} />
                        </label>
                      </div>
                      <div className="sky-picker-sun-detail-row">
                        <span>그림자맵</span>
                        <select className="sky-picker-sun-select"
                          value={sel.shadowMapSize ?? 2048}
                          onChange={(e) => updateLight(selectedIdx, { shadowMapSize: parseInt(e.target.value) })}>
                          <option value={512}>512</option>
                          <option value={1024}>1024</option>
                          <option value={2048}>2048</option>
                          <option value={4096}>4096</option>
                        </select>
                      </div>
                      <div className="sky-picker-sun-detail-row">
                        <span>바이어스</span>
                        <input type="number" step={0.0001} min={-0.01} max={0.01}
                          className="sky-picker-sun-num wide"
                          value={sel.shadowBias ?? -0.001}
                          onChange={(e) => updateLight(selectedIdx, { shadowBias: Number(e.target.value) })} />
                      </div>
                    </div>
                  )}
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
