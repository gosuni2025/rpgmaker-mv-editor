import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Animation, AnimationTiming, AudioFile } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import AudioPicker from '../common/AudioPicker';
import AnimationPreview from './AnimationPreview';
import './AnimationPreview.css';

interface AnimationsTabProps {
  data: (Animation | null)[] | undefined;
  onChange: (data: (Animation | null)[]) => void;
}

export default function AnimationsTab({ data, onChange }: AnimationsTabProps) {
  const { t } = useTranslation();
  const POSITION_OPTIONS = [t('animations.positions.0'), t('animations.positions.1'), t('animations.positions.2'), t('animations.positions.3')];
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const handleFieldChange = (field: keyof Animation, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleAddNew = () => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newAnim: Animation = {
      id: maxId + 1, name: '', animation1Name: '', animation1Hue: 0,
      animation2Name: '', animation2Hue: 0, position: 1, frames: [[]], timings: [],
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newAnim;
    onChange(newData);
    setSelectedId(maxId + 1);
  };

  const handleTimingChange = (index: number, field: keyof AnimationTiming, value: unknown) => {
    const timings = [...(selectedItem?.timings || [])];
    timings[index] = { ...timings[index], [field]: value };
    handleFieldChange('timings', timings);
  };

  const addTiming = () => {
    const timings = [...(selectedItem?.timings || []), { flashColor: [255, 255, 255, 170], flashDuration: 5, flashScope: 1, frame: 0, se: { name: '', pan: 0, pitch: 100, volume: 90 } }];
    handleFieldChange('timings', timings);
  };

  const removeTiming = (index: number) => {
    handleFieldChange('timings', (selectedItem?.timings || []).filter((_: unknown, i: number) => i !== index));
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={handleAddNew}>+</button>
        </div>
        {data?.filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className={`db-list-item${item!.id === selectedId ? ' selected' : ''}`}
            onClick={() => setSelectedId(item!.id)}
          >
            {String(item!.id).padStart(4, '0')}: {item!.name}
          </div>
        ))}
      </div>
      <div className="db-form anim-form-layout">
        {selectedItem && (
          <>
            <div className="anim-top-section">
              <div className="anim-settings-panel">
                <label>
                  {t('common.name')}
                  <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
                </label>

                <div className="db-form-section">{t('animations.image1')}</div>
                <ImagePicker
                  type="animations"
                  value={selectedItem.animation1Name || ''}
                  onChange={(n) => handleFieldChange('animation1Name', n)}
                />
                <label>
                  {t('animations.hue')}
                  <div className="db-slider-row">
                    <input type="range" min={0} max={360} value={selectedItem.animation1Hue || 0} onChange={(e) => handleFieldChange('animation1Hue', Number(e.target.value))} />
                    <span className="db-slider-value">{selectedItem.animation1Hue || 0}</span>
                  </div>
                </label>

                <div className="db-form-section">{t('animations.image2')}</div>
                <ImagePicker
                  type="animations"
                  value={selectedItem.animation2Name || ''}
                  onChange={(n) => handleFieldChange('animation2Name', n)}
                />
                <label>
                  {t('animations.hue')}
                  <div className="db-slider-row">
                    <input type="range" min={0} max={360} value={selectedItem.animation2Hue || 0} onChange={(e) => handleFieldChange('animation2Hue', Number(e.target.value))} />
                    <span className="db-slider-value">{selectedItem.animation2Hue || 0}</span>
                  </div>
                </label>

                <label>
                  {t('animations.position')}
                  <select value={selectedItem.position || 0} onChange={(e) => handleFieldChange('position', Number(e.target.value))}>
                    {POSITION_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                  </select>
                </label>

                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                  {(selectedItem.frames || []).length} {t('animations.frame')}
                </div>
              </div>

              <AnimationPreview animation={selectedItem} />
            </div>

            <div className="db-form-section">
              {t('animations.timing')}
              <button className="db-btn-small" onClick={addTiming}>+</button>
            </div>
            {(selectedItem.timings || []).map((timing: AnimationTiming, i: number) => (
              <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #444' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <label>{t('animations.frame')} <input type="number" value={timing.frame} onChange={(e) => handleTimingChange(i, 'frame', Number(e.target.value))} style={{ width: 50 }} /></label>
                  <label>
                    {t('animations.flashScope')}
                    <select value={timing.flashScope} onChange={(e) => handleTimingChange(i, 'flashScope', Number(e.target.value))} style={{ width: 90 }}>
                      <option value={0}>{t('animations.flashScopes.0')}</option>
                      <option value={1}>{t('animations.flashScopes.1')}</option>
                      <option value={2}>{t('animations.flashScopes.2')}</option>
                      <option value={3}>{t('animations.flashScopes.3')}</option>
                    </select>
                  </label>
                  <label>{t('animations.duration')} <input type="number" value={timing.flashDuration || 0} onChange={(e) => handleTimingChange(i, 'flashDuration', Number(e.target.value))} style={{ width: 40 }} /></label>
                  <button className="db-btn-small" onClick={() => removeTiming(i)}>-</button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ flex: 1 }}>
                    SE
                    <AudioPicker type="se" value={timing.se || { name: '', pan: 0, pitch: 100, volume: 90 }} onChange={(a: AudioFile) => handleTimingChange(i, 'se', a)} />
                  </label>
                  <label>{t('animations.flashColor')}
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[0, 1, 2, 3].map((ci) => (
                        <input key={ci} type="number" value={(timing.flashColor || [255, 255, 255, 170])[ci]}
                          onChange={(e) => { const c = [...(timing.flashColor || [255, 255, 255, 170])]; c[ci] = Number(e.target.value); handleTimingChange(i, 'flashColor', c); }}
                          style={{ width: 40 }} min={0} max={255} />
                      ))}
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
