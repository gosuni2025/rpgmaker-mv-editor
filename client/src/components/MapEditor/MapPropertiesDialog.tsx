import React from 'react';
import { useTranslation } from 'react-i18next';
import AudioPicker from '../common/AudioPicker';
import ImagePicker from '../common/ImagePicker';
import BattlebackPicker from '../common/BattlebackPicker';
import { DataListPicker } from '../EventEditor/dataListPicker';
import EncounterDialog from './EncounterDialog';
import { useMapPropertiesForm } from './useMapPropertiesForm';
import './MapPropertiesDialog.css';

interface MapPropertiesDialogProps {
  mapId?: number;
  parentId?: number;
  onClose: () => void;
}

export default function MapPropertiesDialog({ mapId, parentId, onClose }: MapPropertiesDialogProps) {
  const { t } = useTranslation();
  const f = useMapPropertiesForm(mapId, parentId, onClose);

  const scrollSpeedOptions = [];
  for (let i = -32; i <= 32; i++) scrollSpeedOptions.push(i);

  const tilesetDisplayName = f.tilesetNames[f.tilesetId]
    ? `${String(f.tilesetId).padStart(4, '0')} ${f.tilesetNames[f.tilesetId]}`
    : String(f.tilesetId).padStart(4, '0');

  const dialogTitle = f.isNew
    ? t('mapProperties.titleNew', '새 맵')
    : t('mapProperties.title', { id: String(mapId).padStart(3, '0') });

  if (f.loading) {
    return (
      <div className="map-props-overlay">
        <div className="map-props-dialog">
          <div className="map-props-header">{dialogTitle}</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            {t('common.loading')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-props-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="map-props-dialog">
        <div className="map-props-header">{dialogTitle}</div>

        <div className="map-props-body">
          {/* Left column */}
          <div className="map-props-left">
            {/* General Settings */}
            <div className="map-props-section">
              <div className="map-props-section-title">{t('mapProperties.generalSettings')}</div>
              <div className="map-props-row">
                <div className="map-props-field flex-1">
                  <span>{t('mapProperties.name')}</span>
                  <input type="text" value={f.name} onChange={(e) => f.setName(e.target.value)} />
                </div>
                <div className="map-props-field flex-1">
                  <span>{t('mapProperties.displayName')}</span>
                  <input type="text" value={f.displayName} onChange={(e) => f.setDisplayName(e.target.value)} />
                </div>
              </div>
              <div className="map-props-row">
                <div className="map-props-field flex-1">
                  <span>{t('mapProperties.tileset')}</span>
                  <div className="map-props-picker-row">
                    <input type="text" readOnly value={tilesetDisplayName} className="map-props-picker-input" />
                    <button className="map-props-picker-btn" onClick={() => f.setShowTilesetPicker(true)}>...</button>
                  </div>
                </div>
                <div className="map-props-field">
                  <span>{t('mapProperties.width')}</span>
                  <input type="number" min={1} max={256} value={f.width}
                    onChange={(e) => f.setWidth(Math.max(1, Math.min(256, Number(e.target.value) || 1)))} />
                </div>
                <div className="map-props-field">
                  <span>{t('mapProperties.height')}</span>
                  <input type="number" min={1} max={256} value={f.height}
                    onChange={(e) => f.setHeight(Math.max(1, Math.min(256, Number(e.target.value) || 1)))} />
                </div>
              </div>
              <div className="map-props-row">
                <div className="map-props-field flex-1">
                  <span>{t('mapProperties.scrollType')}</span>
                  <div className="map-props-radio-group">
                    {[
                      { value: 0, label: t('mapProperties.scrollNone') },
                      { value: 1, label: t('mapProperties.scrollHorizontal') },
                      { value: 2, label: t('mapProperties.scrollVertical') },
                      { value: 3, label: t('mapProperties.scrollBoth') },
                    ].map(opt => (
                      <label key={opt.value} className="map-props-radio">
                        <input type="radio" name="scrollType" value={opt.value}
                          checked={f.scrollType === opt.value} onChange={() => f.setScrollType(opt.value)} />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="map-props-field">
                  <span>{t('mapProperties.encounterSteps')}</span>
                  <input type="number" min={1} max={999} value={f.encounterStep}
                    onChange={(e) => f.setEncounterStep(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} />
                </div>
              </div>
            </div>

            {/* BGM / BGS / Battleback / Dashing */}
            <div className="map-props-section">
              <div className="map-props-audio-row">
                <label className="map-props-checkbox">
                  <input type="checkbox" checked={f.autoplayBgm} onChange={(e) => f.setAutoplayBgm(e.target.checked)} />
                  <span>BGM {t('mapProperties.autoplay')}</span>
                </label>
              </div>
              {f.autoplayBgm && (
                <div style={{ marginLeft: 20, marginBottom: 6 }}>
                  <AudioPicker type="bgm" value={f.bgm} onChange={f.setBgm} />
                </div>
              )}
              <div className="map-props-audio-row">
                <label className="map-props-checkbox">
                  <input type="checkbox" checked={f.autoplayBgs} onChange={(e) => f.setAutoplayBgs(e.target.checked)} />
                  <span>BGS {t('mapProperties.autoplay')}</span>
                </label>
              </div>
              {f.autoplayBgs && (
                <div style={{ marginLeft: 20, marginBottom: 6 }}>
                  <AudioPicker type="bgs" value={f.bgs} onChange={f.setBgs} />
                </div>
              )}
              <label className="map-props-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={f.specifyBattleback}
                  onChange={(e) => f.setSpecifyBattleback(e.target.checked)} />
                <span>{t('mapProperties.specifyBattleback')}</span>
              </label>
              {f.specifyBattleback && (
                <div style={{ marginLeft: 20, marginTop: 4 }}>
                  <BattlebackPicker
                    value1={f.battleback1Name} value2={f.battleback2Name}
                    onChange={(n1, n2) => { f.setBattleback1Name(n1); f.setBattleback2Name(n2); }}
                  />
                </div>
              )}
              <label className="map-props-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={f.disableDashing}
                  onChange={(e) => f.setDisableDashing(e.target.checked)} />
                <span>{t('mapProperties.disableDashing')}</span>
              </label>
            </div>

            {/* Bottom row: Parallax + Note */}
            <div className="map-props-bottom-row">
              <div className="map-props-bottom-left">
                <div className="map-props-section">
                  <div className="map-props-section-title">{t('mapProperties.parallaxBg')}</div>
                  <div className="map-props-field" style={{ marginBottom: 6 }}>
                    <span>{t('mapProperties.image')}</span>
                    <ImagePicker type="parallaxes" value={f.parallaxName} onChange={f.setParallaxName} />
                  </div>
                  <label className="map-props-checkbox">
                    <input type="checkbox" checked={f.parallaxLoopX} onChange={(e) => f.setParallaxLoopX(e.target.checked)} />
                    <span>{t('mapProperties.loopHorizontal')}</span>
                  </label>
                  {f.parallaxLoopX && (
                    <div className="map-props-parallax-scroll">
                      <span>{t('mapProperties.scroll')}</span>
                      <select value={f.parallaxSx} onChange={(e) => f.setParallaxSx(Number(e.target.value))}>
                        {scrollSpeedOptions.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="map-props-checkbox">
                    <input type="checkbox" checked={f.parallaxLoopY} onChange={(e) => f.setParallaxLoopY(e.target.checked)} />
                    <span>{t('mapProperties.loopVertical')}</span>
                  </label>
                  {f.parallaxLoopY && (
                    <div className="map-props-parallax-scroll">
                      <span>{t('mapProperties.scroll')}</span>
                      <select value={f.parallaxSy} onChange={(e) => f.setParallaxSy(Number(e.target.value))}>
                        {scrollSpeedOptions.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="map-props-checkbox" style={{ marginTop: 4 }}>
                    <input type="checkbox" checked={f.parallaxShow} onChange={(e) => f.setParallaxShow(e.target.checked)} />
                    <span>{t('mapProperties.showInEditor')}</span>
                  </label>
                </div>
              </div>
              <div className="map-props-bottom-right">
                <div className="map-props-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="map-props-section-title">{t('mapProperties.note')}</div>
                  <div className="map-props-note">
                    <textarea value={f.note} onChange={(e) => f.setNote(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Encounters */}
          <div className="map-props-right">
            <div className="map-props-enc-title">{t('mapProperties.encounters')}</div>
            <div className="map-props-enc-table">
              <div className="map-props-enc-header">
                <div className="map-props-enc-col-troop">{t('mapProperties.encTroop')}</div>
                <div className="map-props-enc-col-weight">{t('mapProperties.encWeight')}</div>
                <div className="map-props-enc-col-region">{t('mapProperties.encRange')}</div>
              </div>
              <div className="map-props-enc-body">
                {f.encounterList.map((enc, idx) => (
                  <div key={idx}
                    className={`map-props-enc-row${f.selectedEncIdx === idx ? ' selected' : ''}`}
                    onClick={() => f.setSelectedEncIdx(idx)}
                    onDoubleClick={() => {
                      f.setSelectedEncIdx(idx);
                      f.setEncDialogEditIdx(idx);
                      f.setEncDialogOpen(true);
                    }}>
                    <div className="map-props-enc-col-troop" style={{ padding: '3px 6px', fontSize: 12 }}>
                      {String(enc.troopId).padStart(4, '0')} {f.troopNames[enc.troopId] || ''}
                    </div>
                    <div className="map-props-enc-col-weight" style={{ padding: '3px 6px', fontSize: 12, textAlign: 'center' }}>
                      {enc.weight}
                    </div>
                    <div className="map-props-enc-col-region" style={{ padding: '3px 6px', fontSize: 12, textAlign: 'center' }}>
                      {enc.regionSet.length === 0 ? t('mapProperties.encEntireMap') : enc.regionSet.join(',')}
                    </div>
                  </div>
                ))}
                <div className="map-props-enc-row-empty" onDoubleClick={f.handleAddEncounter}>&nbsp;</div>
              </div>
            </div>
            <div className="map-props-enc-buttons">
              <button className="db-btn-small" onClick={f.handleAddEncounter}>{t('mapProperties.encAdd')}</button>
              <button className="db-btn-small" onClick={f.handleDeleteEncounter} disabled={f.selectedEncIdx === null}>
                {t('mapProperties.encDelete')}
              </button>
            </div>
          </div>
        </div>

        <div className="map-props-footer">
          <button className="db-btn" onClick={f.handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>

      {f.showTilesetPicker && (
        <DataListPicker
          title={t('mapProperties.tileset') + ' 선택'}
          items={f.tilesetNames}
          value={f.tilesetId}
          onChange={(id) => f.setTilesetId(id)}
          onClose={() => f.setShowTilesetPicker(false)}
        />
      )}

      {f.encDialogOpen && (
        <EncounterDialog
          initial={f.encDialogEditIdx !== null ? f.encounterList[f.encDialogEditIdx] : undefined}
          onOk={f.handleEncDialogOk}
          onCancel={() => { f.setEncDialogOpen(false); f.setEncDialogEditIdx(null); }}
        />
      )}
    </div>
  );
}
