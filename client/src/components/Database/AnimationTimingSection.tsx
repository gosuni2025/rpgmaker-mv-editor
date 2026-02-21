import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Animation, AnimationTiming, AudioFile } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';

interface AnimationTimingSectionProps {
  timings: AnimationTiming[];
  onTimingsChange: (timings: AnimationTiming[]) => void;
}

export function AnimationTimingSection({ timings, onTimingsChange }: AnimationTimingSectionProps) {
  const { t } = useTranslation();
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  const handleChange = (index: number, field: keyof AnimationTiming, value: unknown) => {
    const updated = [...timings];
    updated[index] = { ...updated[index], [field]: value };
    onTimingsChange(updated);
  };

  const addTiming = () => {
    const updated = [...timings, { flashColor: [255, 255, 255, 170], flashDuration: 5, flashScope: 1, frame: 0, se: { name: '', pan: 0, pitch: 100, volume: 90 } }];
    onTimingsChange(updated);
    setSelectedIdx(updated.length - 1);
  };

  const removeTiming = (index: number) => {
    onTimingsChange(timings.filter((_: unknown, i: number) => i !== index));
    setSelectedIdx(-1);
  };

  const getSeText = (timing: AnimationTiming): string => {
    if (timing.se && timing.se.name) return timing.se.name;
    return t('animations.noSe');
  };

  const getFlashText = (timing: AnimationTiming): string => {
    if (timing.flashScope === 3) return t('animations.hideTarget');
    if (timing.flashScope === 0 || (!timing.flashColor && timing.flashScope !== 3)) return t('animations.noFlash');
    const c = timing.flashColor || [255, 255, 255, 170];
    const d = timing.flashDuration || 0;
    if (timing.flashScope === 2) return `화면(${c[0]},${c[1]},${c[2]},${c[3]}), ${d}프레임들`;
    return `대상(${c[0]},${c[1]},${c[2]},${c[3]}), ${d}프레임들`;
  };

  const selectedTiming = selectedIdx >= 0 ? timings[selectedIdx] : null;

  return (
    <fieldset className="anim-fieldset anim-timing-section">
      <legend>{t('animations.seAndFlashTiming')}</legend>
      <div className="anim-timing-table-wrapper">
        <table className="anim-timing-table">
          <thead>
            <tr>
              <th className="anim-timing-col-no">{t('animations.timingNo')}</th>
              <th className="anim-timing-col-se">{t('animations.timingSe')}</th>
              <th className="anim-timing-col-flash">{t('animations.timingFlash')}</th>
            </tr>
          </thead>
          <tbody>
            {timings.map((timing: AnimationTiming, i: number) => (
              <tr
                key={i}
                className={selectedIdx === i ? 'selected' : ''}
                onClick={() => setSelectedIdx(i)}
              >
                <td className="anim-timing-col-no">#{String(i + 1).padStart(3, '0')}</td>
                <td className="anim-timing-col-se">{getSeText(timing)}</td>
                <td className="anim-timing-col-flash">{getFlashText(timing)}, {timing.frame}프레임들</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTiming && (
        <div className="anim-timing-edit">
          <div className="anim-timing-edit-row">
            <label>
              {t('animations.frame')}
              <input type="number" min={0} value={selectedTiming.frame} onChange={(e) => handleChange(selectedIdx, 'frame', Number(e.target.value))} style={{ width: 60 }} />
            </label>
            <label>
              {t('animations.flashScope')}
              <select value={selectedTiming.flashScope} onChange={(e) => handleChange(selectedIdx, 'flashScope', Number(e.target.value))}>
                <option value={0}>{t('animations.flashScopes.0')}</option>
                <option value={1}>{t('animations.flashScopes.1')}</option>
                <option value={2}>{t('animations.flashScopes.2')}</option>
                <option value={3}>{t('animations.flashScopes.3')}</option>
              </select>
            </label>
            <label>
              {t('animations.duration')}
              <input type="number" min={0} value={selectedTiming.flashDuration || 0} onChange={(e) => handleChange(selectedIdx, 'flashDuration', Number(e.target.value))} style={{ width: 50 }} />
            </label>
            <button className="db-btn-small" style={{ marginLeft: 'auto' }} onClick={addTiming}>+</button>
            <button className="db-btn-small" onClick={() => removeTiming(selectedIdx)}>-</button>
          </div>
          <div className="anim-timing-edit-row">
            <label style={{ flex: 1 }}>
              SE
              <AudioPicker type="se" value={selectedTiming.se || { name: '', pan: 0, pitch: 100, volume: 90 }} onChange={(a: AudioFile) => handleChange(selectedIdx, 'se', a)} />
            </label>
          </div>
          <div className="anim-timing-edit-row">
            <label>{t('animations.flashColor')}
              <div className="anim-flash-color-inputs">
                {[0, 1, 2, 3].map((ci) => (
                  <input key={ci} type="number" value={(selectedTiming.flashColor || [255, 255, 255, 170])[ci]}
                    onChange={(e) => { const c = [...(selectedTiming.flashColor || [255, 255, 255, 170])]; c[ci] = Number(e.target.value); handleChange(selectedIdx, 'flashColor', c); }}
                    min={0} max={255} />
                ))}
              </div>
            </label>
          </div>
        </div>
      )}
      {!selectedTiming && (
        <div className="anim-timing-edit-row" style={{ padding: '4px 0' }}>
          <button className="db-btn-small" style={{ marginLeft: 'auto' }} onClick={addTiming}>+</button>
        </div>
      )}
    </fieldset>
  );
}
