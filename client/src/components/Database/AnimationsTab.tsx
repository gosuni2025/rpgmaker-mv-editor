import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Animation, AnimationTiming, AudioFile } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import AudioPicker from '../common/AudioPicker';
import AnimationPreview from './AnimationPreview';
import DatabaseList from './DatabaseList';
import './AnimationsTab.css';
import './AnimationPreview.css';

// 마지막으로 사용된 애니메이션 이미지를 기억하기 위한 모듈 변수
let lastUsedAnimation1Name: string | null = null;

interface AnimationsTabProps {
  data: (Animation | null)[] | undefined;
  onChange: (data: (Animation | null)[]) => void;
}

export default function AnimationsTab({ data, onChange }: AnimationsTabProps) {
  const { t } = useTranslation();
  const POSITION_OPTIONS = [t('animations.positions.0'), t('animations.positions.1'), t('animations.positions.2'), t('animations.positions.3')];
  const [selectedId, setSelectedId] = useState(1);
  const [selectedTimingIdx, setSelectedTimingIdx] = useState<number>(-1);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const initRef = useRef(false);

  // 처음 열 때 마지막 사용 이미지 추적: 데이터에서 이미지가 있는 마지막 애니메이션을 찾아 저장
  useEffect(() => {
    if (initRef.current || !data) return;
    initRef.current = true;
    // 데이터에서 animation1Name이 있는 항목 중 가장 마지막 것을 찾기
    const items = data.filter(Boolean) as Animation[];
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].animation1Name) {
        lastUsedAnimation1Name = items[i].animation1Name;
        break;
      }
    }
  }, [data]);

  const handleFieldChange = (field: keyof Animation, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        const updated = { ...item, [field]: value };
        // 이미지 변경 시 추적
        if (field === 'animation1Name' && typeof value === 'string' && value) {
          lastUsedAnimation1Name = value;
        }
        return updated;
      }
      return item;
    });
    onChange(newData);
  };

  const handleAddNew = useCallback(() => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    // 기본 이미지: 마지막 사용 이미지 또는 Dragon
    const defaultImage = lastUsedAnimation1Name || 'Dragon';
    const newAnim: Animation = {
      id: maxId + 1, name: '', animation1Name: defaultImage, animation1Hue: 0,
      animation2Name: '', animation2Hue: 0, position: 1, frames: [[]], timings: [],
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newAnim;
    onChange(newData);
    setSelectedId(maxId + 1);
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Animation[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as Animation[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newData = [...data];
    while (newData.length <= newId) newData.push(null);
    newData[newId] = {
      ...source, id: newId,
      frames: source.frames.map(f => f.map(c => [...c])),
      timings: source.timings.map(t => ({ ...t, flashColor: [...(t.flashColor || [255, 255, 255, 170])], se: { ...(t.se || { name: '', pan: 0, pitch: 100, volume: 90 }) } })),
    };
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Animation[];
    const fromIdx = items.findIndex(item => item.id === fromId);
    if (fromIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);
    if (toId === -1) {
      items.push(moved);
    } else {
      const toIdx = items.findIndex(item => item.id === toId);
      if (toIdx < 0) items.push(moved);
      else items.splice(toIdx, 0, moved);
    }
    onChange([null, ...items]);
  }, [data, onChange]);

  const handleTimingChange = (index: number, field: keyof AnimationTiming, value: unknown) => {
    const timings = [...(selectedItem?.timings || [])];
    timings[index] = { ...timings[index], [field]: value };
    handleFieldChange('timings', timings);
  };

  const addTiming = () => {
    const timings = [...(selectedItem?.timings || []), { flashColor: [255, 255, 255, 170], flashDuration: 5, flashScope: 1, frame: 0, se: { name: '', pan: 0, pitch: 100, volume: 90 } }];
    handleFieldChange('timings', timings);
    setSelectedTimingIdx(timings.length - 1);
  };

  const removeTiming = (index: number) => {
    handleFieldChange('timings', (selectedItem?.timings || []).filter((_: unknown, i: number) => i !== index));
    setSelectedTimingIdx(-1);
  };

  // 타이밍 정보를 텍스트로 표시
  const getTimingSeText = (timing: AnimationTiming): string => {
    if (timing.se && timing.se.name) {
      return timing.se.name;
    }
    return t('animations.noSe');
  };

  const getTimingFlashText = (timing: AnimationTiming): string => {
    if (timing.flashScope === 3) {
      return t('animations.hideTarget');
    }
    if (timing.flashScope === 0 || (!timing.flashColor && timing.flashScope !== 3)) {
      return t('animations.noFlash');
    }
    const c = timing.flashColor || [255, 255, 255, 170];
    const d = timing.flashDuration || 0;
    if (timing.flashScope === 2) {
      return `화면(${c[0]},${c[1]},${c[2]},${c[3]}), ${d}프레임들`;
    }
    return `대상(${c[0]},${c[1]},${c[2]},${c[3]}), ${d}프레임들`;
  };

  const totalFrames = selectedItem?.frames?.length || 0;

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAddNew}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />
      <div className="db-form anim-form-layout">
        {selectedItem && (
          <>
            {/* 상단: 일반 설정 + SE와 Flash 타이밍 */}
            <div className="anim-upper-section">
              {/* 왼쪽: 일반 설정 */}
              <div className="anim-general-settings">
                <div className="db-form-section">{t('animations.generalSettings')}</div>
                <label>
                  {t('common.name')}
                  <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
                </label>

                <div className="anim-image-row">
                  <div className="anim-image-col">
                    <label>{t('animations.image1')}</label>
                    <ImagePicker
                      type="animations"
                      value={selectedItem.animation1Name || ''}
                      onChange={(n) => handleFieldChange('animation1Name', n)}
                    />
                    <label className="anim-hue-label">
                      {t('animations.hue')}
                      <div className="db-slider-row">
                        <input type="range" min={0} max={360} value={selectedItem.animation1Hue || 0} onChange={(e) => handleFieldChange('animation1Hue', Number(e.target.value))} />
                        <span className="db-slider-value">{selectedItem.animation1Hue || 0}</span>
                      </div>
                    </label>
                  </div>
                  <div className="anim-image-col">
                    <label>{t('animations.image2')}</label>
                    <ImagePicker
                      type="animations"
                      value={selectedItem.animation2Name || ''}
                      onChange={(n) => handleFieldChange('animation2Name', n)}
                    />
                    <label className="anim-hue-label">
                      {t('animations.hue')}
                      <div className="db-slider-row">
                        <input type="range" min={0} max={360} value={selectedItem.animation2Hue || 0} onChange={(e) => handleFieldChange('animation2Hue', Number(e.target.value))} />
                        <span className="db-slider-value">{selectedItem.animation2Hue || 0}</span>
                      </div>
                    </label>
                  </div>
                </div>

                <label>
                  {t('animations.position')}
                  <select value={selectedItem.position || 0} onChange={(e) => handleFieldChange('position', Number(e.target.value))}>
                    {POSITION_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                  </select>
                </label>
              </div>

              {/* 오른쪽: SE와 Flash 타이밍 테이블 */}
              <div className="anim-timing-section">
                <div className="db-form-section">
                  {t('animations.seAndFlashTiming')}
                  <div className="anim-timing-buttons">
                    <button className="db-btn-small" onClick={addTiming}>+</button>
                    <button className="db-btn-small" onClick={() => selectedTimingIdx >= 0 && removeTiming(selectedTimingIdx)} disabled={selectedTimingIdx < 0}>-</button>
                  </div>
                </div>
                <div className="anim-timing-table-wrapper">
                  <table className="anim-timing-table">
                    <thead>
                      <tr>
                        <th className="anim-timing-col-no">{t('animations.timingNo')}</th>
                        <th className="anim-timing-col-se">{t('animations.timingSe')}</th>
                        <th className="anim-timing-col-flash">{t('animations.timingFlash')}</th>
                        <th className="anim-timing-col-frame">{t('animations.timingFrameAt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.timings || []).map((timing: AnimationTiming, i: number) => (
                        <tr
                          key={i}
                          className={selectedTimingIdx === i ? 'selected' : ''}
                          onClick={() => setSelectedTimingIdx(i)}
                        >
                          <td className="anim-timing-col-no">#{String(i + 1).padStart(3, '0')}</td>
                          <td className="anim-timing-col-se">{getTimingSeText(timing)}</td>
                          <td className="anim-timing-col-flash">{getTimingFlashText(timing)}</td>
                          <td className="anim-timing-col-frame">{timing.frame}프레임들</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 선택된 타이밍 편집 */}
                {selectedTimingIdx >= 0 && selectedItem.timings && selectedItem.timings[selectedTimingIdx] && (
                  <div className="anim-timing-edit">
                    <div className="anim-timing-edit-row">
                      <label>
                        {t('animations.frame')}
                        <input type="number" min={0} value={selectedItem.timings[selectedTimingIdx].frame} onChange={(e) => handleTimingChange(selectedTimingIdx, 'frame', Number(e.target.value))} style={{ width: 60 }} />
                      </label>
                      <label>
                        {t('animations.flashScope')}
                        <select value={selectedItem.timings[selectedTimingIdx].flashScope} onChange={(e) => handleTimingChange(selectedTimingIdx, 'flashScope', Number(e.target.value))}>
                          <option value={0}>{t('animations.flashScopes.0')}</option>
                          <option value={1}>{t('animations.flashScopes.1')}</option>
                          <option value={2}>{t('animations.flashScopes.2')}</option>
                          <option value={3}>{t('animations.flashScopes.3')}</option>
                        </select>
                      </label>
                      <label>
                        {t('animations.duration')}
                        <input type="number" min={0} value={selectedItem.timings[selectedTimingIdx].flashDuration || 0} onChange={(e) => handleTimingChange(selectedTimingIdx, 'flashDuration', Number(e.target.value))} style={{ width: 50 }} />
                      </label>
                    </div>
                    <div className="anim-timing-edit-row">
                      <label style={{ flex: 1 }}>
                        SE
                        <AudioPicker type="se" value={selectedItem.timings[selectedTimingIdx].se || { name: '', pan: 0, pitch: 100, volume: 90 }} onChange={(a: AudioFile) => handleTimingChange(selectedTimingIdx, 'se', a)} />
                      </label>
                    </div>
                    <div className="anim-timing-edit-row">
                      <label>{t('animations.flashColor')}
                        <div className="anim-flash-color-inputs">
                          {[0, 1, 2, 3].map((ci) => (
                            <input key={ci} type="number" value={(selectedItem.timings![selectedTimingIdx].flashColor || [255, 255, 255, 170])[ci]}
                              onChange={(e) => { const c = [...(selectedItem.timings![selectedTimingIdx].flashColor || [255, 255, 255, 170])]; c[ci] = Number(e.target.value); handleTimingChange(selectedTimingIdx, 'flashColor', c); }}
                              min={0} max={255} />
                          ))}
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 하단: 프레임 */}
            <div className="anim-lower-section">
              <div className="db-form-section">{t('animations.frames')}</div>
              <div className="anim-frame-area">
                {/* 왼쪽: 프레임 목록 */}
                <div className="anim-frame-list">
                  {Array.from({ length: totalFrames }, (_, i) => (
                    <div
                      key={i}
                      className={`anim-frame-item${selectedFrameIdx === i ? ' selected' : ''}`}
                      onClick={() => setSelectedFrameIdx(i)}
                    >
                      #{String(i + 1).padStart(3, '0')}
                    </div>
                  ))}
                  {totalFrames === 0 && (
                    <div className="anim-frame-empty">-----</div>
                  )}
                </div>

                {/* 오른쪽: 애니메이션 미리보기 */}
                <div className="anim-frame-preview">
                  <AnimationPreview animation={selectedItem} initialFrame={selectedFrameIdx} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
