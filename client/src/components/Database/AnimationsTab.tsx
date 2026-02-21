import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Animation, AnimationTiming, AudioFile } from '../../types/rpgMakerMV';
import AnimationPreview from './AnimationPreview';
import type { AnimationPreviewHandle } from './AnimationPreview';
import DatabaseList from './DatabaseList';
import { ImageSelectPopup, EnemyImageSelectPopup, MaxFrameDialog, TweenDialog, BatchSettingDialog, ShiftDialog } from './AnimationDialogs';
import { applyTween, applyBatchSetting, applyShift } from './animationOperations';
import { AnimationTimingSection } from './AnimationTimingSection';
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
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [showImg1Popup, setShowImg1Popup] = useState(false);
  const [showImg2Popup, setShowImg2Popup] = useState(false);
  const [showMaxFrameDialog, setShowMaxFrameDialog] = useState(false);
  const [showEnemyImagePopup, setShowEnemyImagePopup] = useState(false);
  const [showTweenDialog, setShowTweenDialog] = useState(false);
  const [showBatchSettingDialog, setShowBatchSettingDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [targetImageName, setTargetImageName] = useState('Dragon');
  const previewRef = useRef<AnimationPreviewHandle>(null);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const initRef = useRef(false);

  // 처음 열 때 마지막 사용 이미지 추적
  useEffect(() => {
    if (initRef.current || !data) return;
    initRef.current = true;
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
        if (field === 'animation1Name' && typeof value === 'string' && value) {
          lastUsedAnimation1Name = value;
        }
        return updated;
      }
      return item;
    });
    onChange(newData);
  };

  const handleMultiFieldChange = (fields: Partial<Animation>) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        const updated = { ...item, ...fields };
        if ('animation1Name' in fields && typeof fields.animation1Name === 'string' && fields.animation1Name) {
          lastUsedAnimation1Name = fields.animation1Name;
        }
        return updated;
      }
      return item;
    });
    onChange(newData);
  };

  const handleMaxFrameChange = (newMax: number) => {
    if (!selectedItem || newMax < 1) return;
    const frames = [...(selectedItem.frames || [])];
    if (newMax > frames.length) {
      while (frames.length < newMax) frames.push([]);
    } else {
      frames.length = newMax;
    }
    handleFieldChange('frames', frames);
    if (selectedFrameIdx >= newMax) setSelectedFrameIdx(newMax - 1);
  };

  const handleTween = (opts: Parameters<typeof applyTween>[1]) => {
    if (!selectedItem?.frames) return;
    handleFieldChange('frames', applyTween(selectedItem.frames, opts));
  };

  const handleBatchSetting = (batchData: Parameters<typeof applyBatchSetting>[1]) => {
    if (!selectedItem?.frames) return;
    handleFieldChange('frames', applyBatchSetting(selectedItem.frames, batchData));
  };

  const handleShift = (shiftData: Parameters<typeof applyShift>[1]) => {
    if (!selectedItem?.frames) return;
    handleFieldChange('frames', applyShift(selectedItem.frames, shiftData));
  };

  const handleAddNew = useCallback(() => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
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
      timings: source.timings.map(ti => ({ ...ti, flashColor: [...(ti.flashColor || [255, 255, 255, 170])], se: { ...(ti.se || { name: '', pan: 0, pitch: 100, volume: 90 }) } })),
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
            {/* ===== 상단: 일반 설정 + SE와 Flash 타이밍 ===== */}
            <div className="anim-upper-section">
              {/* 왼쪽: 일반 설정 (테두리 박스) */}
              <fieldset className="anim-fieldset anim-general-settings">
                <legend>{t('animations.generalSettings')}</legend>
                <div className="anim-field-row">
                  <label className="anim-field-label">{t('common.name')}:</label>
                  <input type="text" className="anim-field-input" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
                </div>

                <div className="anim-field-row">
                  <label className="anim-field-label">{t('animations.image1')}:</label>
                  <div className="anim-img-btn-row">
                    <input type="text" className="anim-field-input" value={selectedItem.animation1Name || '(None)'} readOnly />
                    <button className="db-btn-small" onClick={() => setShowImg1Popup(true)}>...</button>
                  </div>
                </div>
                <div className="anim-field-row">
                  <label className="anim-field-label">{t('animations.image2')}:</label>
                  <div className="anim-img-btn-row">
                    <input type="text" className="anim-field-input" value={selectedItem.animation2Name || '(None)'} readOnly />
                    <button className="db-btn-small" onClick={() => setShowImg2Popup(true)}>...</button>
                  </div>
                </div>

                <div className="anim-field-row">
                  <label className="anim-field-label">{t('animations.position')}:</label>
                  <select className="anim-field-select" value={selectedItem.position || 0} onChange={(e) => handleFieldChange('position', Number(e.target.value))}>
                    {POSITION_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                  </select>
                  <label className="anim-field-label" style={{ marginLeft: 12 }}>최대 프레임:</label>
                  <input type="text" className="anim-maxframe-input" value={totalFrames} readOnly />
                  <button className="db-btn-small" onClick={() => setShowMaxFrameDialog(true)}>...</button>
                </div>
              </fieldset>

              {/* 오른쪽: SE와 Flash 타이밍 */}
              <AnimationTimingSection
                timings={selectedItem.timings || []}
                onTimingsChange={(timings) => handleFieldChange('timings', timings)}
              />
            </div>

            {/* ===== 하단: 프레임 (테두리 박스) ===== */}
            <fieldset className="anim-fieldset anim-lower-section">
              <legend>{t('animations.frames')}</legend>
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

                {/* 가운데: 미리보기 캔버스 */}
                <div className="anim-frame-preview">
                  <AnimationPreview ref={previewRef} animation={selectedItem} initialFrame={selectedFrameIdx} targetImageName={targetImageName} />
                </div>

                {/* 오른쪽: 버튼 */}
                <div className="anim-frame-buttons">
                  <button className="anim-frame-btn" onClick={() => setShowEnemyImagePopup(true)}>대상 변경...</button>
                  <button className="anim-frame-btn">전 프레임 붙이기</button>
                  <button className="anim-frame-btn" onClick={() => setShowTweenDialog(true)}>보완...</button>
                  <button className="anim-frame-btn" onClick={() => setShowBatchSettingDialog(true)}>일괄 설정...</button>
                  <button className="anim-frame-btn" onClick={() => setShowShiftDialog(true)}>시프트...</button>
                  <button className="anim-frame-btn anim-frame-btn-play" onClick={() => previewRef.current?.play()}>재생</button>
                </div>
              </div>

              {/* 하단: 셀 팔레트 (이미지1의 스프라이트 시트) */}
              <div className="anim-cell-palette">
                {selectedItem.animation1Name && (
                  <img
                    src={`/api/resources/animations/${selectedItem.animation1Name}.png`}
                    alt="Cell palette"
                    className="anim-cell-palette-img"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            </fieldset>

            {/* ===== 팝업들 ===== */}
            {showImg1Popup && (
              <ImageSelectPopup
                type="animations"
                value={selectedItem.animation1Name || ''}
                hue={selectedItem.animation1Hue || 0}
                onSelect={(name, hue) => handleMultiFieldChange({ animation1Name: name, animation1Hue: hue })}
                onClose={() => setShowImg1Popup(false)}
              />
            )}
            {showImg2Popup && (
              <ImageSelectPopup
                type="animations"
                value={selectedItem.animation2Name || ''}
                hue={selectedItem.animation2Hue || 0}
                onSelect={(name, hue) => handleMultiFieldChange({ animation2Name: name, animation2Hue: hue })}
                onClose={() => setShowImg2Popup(false)}
              />
            )}
            {showMaxFrameDialog && (
              <MaxFrameDialog
                value={totalFrames}
                onConfirm={handleMaxFrameChange}
                onClose={() => setShowMaxFrameDialog(false)}
              />
            )}
            {showEnemyImagePopup && (
              <EnemyImageSelectPopup
                value={targetImageName}
                onSelect={(name) => setTargetImageName(name || 'Dragon')}
                onClose={() => setShowEnemyImagePopup(false)}
              />
            )}
            {showTweenDialog && (
              <TweenDialog
                totalFrames={totalFrames}
                maxCells={Math.max(...(selectedItem.frames || []).map(f => f.length), 16)}
                onConfirm={handleTween}
                onClose={() => setShowTweenDialog(false)}
              />
            )}
            {showBatchSettingDialog && (
              <BatchSettingDialog
                totalFrames={totalFrames}
                maxCells={Math.max(...(selectedItem.frames || []).map(f => f.length), 16)}
                onConfirm={handleBatchSetting}
                onClose={() => setShowBatchSettingDialog(false)}
              />
            )}
            {showShiftDialog && (
              <ShiftDialog
                totalFrames={totalFrames}
                maxCells={Math.max(...(selectedItem.frames || []).map(f => f.length), 16)}
                onConfirm={handleShift}
                onClose={() => setShowShiftDialog(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
