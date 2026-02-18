import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import AudioPicker from '../common/AudioPicker';
import ImagePicker from '../common/ImagePicker';
import BattlebackPicker from '../common/BattlebackPicker';
import { DataListPicker } from '../EventEditor/dataListPicker';
import EncounterDialog from './EncounterDialog';
import type { AudioFile, MapData } from '../../types/rpgMakerMV';
import './MapPropertiesDialog.css';

interface EncounterEntry {
  troopId: number;
  weight: number;
  regionSet: number[];
}

interface TilesetEntry { id: number; name: string; }

interface MapPropertiesDialogProps {
  /** 편집 모드: 기존 맵 ID */
  mapId?: number;
  /** 신규 모드: 부모 맵 ID (mapId가 없을 때 사용) */
  parentId?: number;
  onClose: () => void;
}

export default function MapPropertiesDialog({ mapId, parentId, onClose }: MapPropertiesDialogProps) {
  const { t } = useTranslation();
  const maps = useEditorStore((s) => s.maps);
  const updateMapInfos = useEditorStore((s) => s.updateMapInfos);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const createMap = useEditorStore((s) => s.createMap);
  const selectMap = useEditorStore((s) => s.selectMap);
  const showToast = useEditorStore((s) => s.showToast);

  const isNew = mapId == null;

  // Local state for form fields
  const [loading, setLoading] = useState(!isNew);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tilesetId, setTilesetId] = useState(1);
  const [width, setWidth] = useState(17);
  const [height, setHeight] = useState(13);
  const [scrollType, setScrollType] = useState(0);
  const [encounterStep, setEncounterStep] = useState(30);
  const [autoplayBgm, setAutoplayBgm] = useState(false);
  const [bgm, setBgm] = useState<AudioFile>({ name: '', volume: 90, pitch: 100, pan: 0 });
  const [autoplayBgs, setAutoplayBgs] = useState(false);
  const [bgs, setBgs] = useState<AudioFile>({ name: '', volume: 90, pitch: 100, pan: 0 });
  const [specifyBattleback, setSpecifyBattleback] = useState(false);
  const [battleback1Name, setBattleback1Name] = useState('');
  const [battleback2Name, setBattleback2Name] = useState('');
  const [disableDashing, setDisableDashing] = useState(false);
  const [parallaxName, setParallaxName] = useState('');
  const [parallaxLoopX, setParallaxLoopX] = useState(false);
  const [parallaxLoopY, setParallaxLoopY] = useState(false);
  const [parallaxSx, setParallaxSx] = useState(0);
  const [parallaxSy, setParallaxSy] = useState(0);
  const [parallaxShow, setParallaxShow] = useState(true);
  const [note, setNote] = useState('');
  const [encounterList, setEncounterList] = useState<EncounterEntry[]>([]);
  const [selectedEncIdx, setSelectedEncIdx] = useState<number | null>(null);
  const [encDialogOpen, setEncDialogOpen] = useState(false);
  const [encDialogEditIdx, setEncDialogEditIdx] = useState<number | null>(null);

  // Tilesets and troops for dropdowns
  const [tilesets, setTilesets] = useState<TilesetEntry[]>([]);
  const [tilesetNames, setTilesetNames] = useState<string[]>([]);
  const [troopNames, setTroopNames] = useState<string[]>([]);
  const [showTilesetPicker, setShowTilesetPicker] = useState(false);

  // Load data
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [tsRes, troopRes] = await Promise.all([
          apiClient.get<(null | { id: number; name: string })[]>('/database/tilesets'),
          apiClient.get<(null | { id: number; name: string })[]>('/database/troops'),
        ]);

        // Tilesets
        const entries: TilesetEntry[] = [];
        const names: string[] = [];
        tsRes.forEach((ts, i) => {
          if (ts && ts.name) {
            entries.push({ id: i, name: ts.name });
            names[i] = ts.name;
          }
        });
        setTilesets(entries);
        setTilesetNames(names);

        // Troops
        const tNames: string[] = [];
        troopRes.forEach(tr => { if (tr) tNames[tr.id] = tr.name || ''; });
        setTroopNames(tNames);

        // 편집 모드: 기존 맵 데이터 로드
        if (!isNew && mapId != null) {
          const mapRes = await apiClient.get<MapData>(`/maps/${mapId}`);
          setMapData(mapRes);
          setDisplayName(mapRes.displayName || '');
          setTilesetId(mapRes.tilesetId || 1);
          setWidth(mapRes.width);
          setHeight(mapRes.height);
          setScrollType(mapRes.scrollType ?? 0);
          setEncounterStep(mapRes.encounterStep ?? 30);
          setAutoplayBgm(!!mapRes.autoplayBgm);
          setBgm(mapRes.bgm || { name: '', volume: 90, pitch: 100, pan: 0 });
          setAutoplayBgs(!!mapRes.autoplayBgs);
          setBgs(mapRes.bgs || { name: '', volume: 90, pitch: 100, pan: 0 });
          setSpecifyBattleback(!!mapRes.specifyBattleback);
          setBattleback1Name(mapRes.battleback1Name || '');
          setBattleback2Name(mapRes.battleback2Name || '');
          setDisableDashing(!!mapRes.disableDashing);
          setParallaxName(mapRes.parallaxName || '');
          setParallaxLoopX(!!mapRes.parallaxLoopX);
          setParallaxLoopY(!!mapRes.parallaxLoopY);
          setParallaxSx(mapRes.parallaxSx || 0);
          setParallaxSy(mapRes.parallaxSy || 0);
          setParallaxShow(mapRes.parallaxShow ?? true);
          setNote(mapRes.note || '');
          setEncounterList((mapRes.encounterList as EncounterEntry[]) || []);

          // Map name from MapInfos
          const info = maps.find(m => m && m.id === mapId);
          setName(info?.name || '');
        }
      } catch (e) {
        console.error('Failed to load map properties', e);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, isNew]);

  // Encounter handlers
  const handleAddEncounter = useCallback(() => {
    setEncDialogEditIdx(null);
    setEncDialogOpen(true);
  }, []);

  const handleDeleteEncounter = useCallback(() => {
    if (selectedEncIdx === null || selectedEncIdx >= encounterList.length) return;
    setEncounterList(prev => prev.filter((_, i) => i !== selectedEncIdx));
    setSelectedEncIdx(null);
  }, [selectedEncIdx, encounterList.length]);

  const handleEncDialogOk = useCallback((entry: EncounterEntry) => {
    if (encDialogEditIdx !== null) {
      setEncounterList(prev => prev.map((e, i) => i === encDialogEditIdx ? entry : e));
      setSelectedEncIdx(encDialogEditIdx);
    } else {
      setEncounterList(prev => {
        setSelectedEncIdx(prev.length);
        return [...prev, entry];
      });
    }
    setEncDialogOpen(false);
    setEncDialogEditIdx(null);
  }, [encDialogEditIdx]);

  // Save handler
  const handleOk = useCallback(async () => {
    try {
      if (isNew) {
        // 신규 맵 생성
        const newId = await createMap({
          name: name || t('mapProperties.newMapDefaultName', '신규 맵'),
          width,
          height,
          tilesetId,
          parentId: parentId ?? 0,
        });
        if (!newId) {
          showToast(t('mapProperties.saveFailed'));
          return;
        }

        // 생성된 맵에 나머지 속성 저장
        const newMapData = await apiClient.get<MapData>(`/maps/${newId}`);
        const updatedMap: MapData = {
          ...newMapData,
          displayName,
          tilesetId,
          width,
          height,
          scrollType,
          encounterStep,
          autoplayBgm,
          bgm,
          autoplayBgs,
          bgs,
          specifyBattleback,
          battleback1Name,
          battleback2Name,
          disableDashing,
          parallaxName,
          parallaxLoopX,
          parallaxLoopY,
          parallaxSx,
          parallaxSy,
          parallaxShow,
          note,
          encounterList,
        };
        await apiClient.put(`/maps/${newId}`, updatedMap);

        // MapInfos 이름 업데이트
        const updatedMaps = useEditorStore.getState().maps.map(m => {
          if (m && m.id === newId) return { ...m, name: name || t('mapProperties.newMapDefaultName', '신규 맵') };
          return m;
        });
        await updateMapInfos(updatedMaps);

        selectMap(newId);
        showToast(t('mapProperties.saved'));
        onClose();
      } else {
        // 편집 모드
        if (!mapData) return;

        // Update MapInfos name
        const newMaps = maps.map(m => {
          if (m && m.id === mapId) return { ...m, name };
          return m;
        });
        await updateMapInfos(newMaps);

        // Build updated map data
        const updatedMap: MapData = {
          ...mapData,
          displayName,
          tilesetId,
          width,
          height,
          scrollType,
          encounterStep,
          autoplayBgm,
          bgm,
          autoplayBgs,
          bgs,
          specifyBattleback,
          battleback1Name,
          battleback2Name,
          disableDashing,
          parallaxName,
          parallaxLoopX,
          parallaxLoopY,
          parallaxSx,
          parallaxSy,
          parallaxShow,
          note,
          encounterList,
        };

        // Handle resize if dimensions changed
        if (width !== mapData.width || height !== mapData.height) {
          const oldW = mapData.width;
          const oldH = mapData.height;
          const newData = new Array(width * height * 6).fill(0);
          for (let z = 0; z < 6; z++) {
            for (let y = 0; y < Math.min(oldH, height); y++) {
              for (let x = 0; x < Math.min(oldW, width); x++) {
                newData[(z * height + y) * width + x] = mapData.data[(z * oldH + y) * oldW + x] || 0;
              }
            }
          }
          updatedMap.data = newData;
          // Trim events outside the new map bounds
          updatedMap.events = mapData.events.map(ev => {
            if (!ev) return null;
            if (ev.x >= width || ev.y >= height) return null;
            return ev;
          });
        }

        await apiClient.put(`/maps/${mapId}`, updatedMap);

        // If this is the currently loaded map, reload it in the store
        if (currentMapId === mapId) {
          const refreshed = await apiClient.get<MapData>(`/maps/${mapId}`);
          useEditorStore.setState({ currentMap: refreshed });
        }

        showToast(t('mapProperties.saved'));
        onClose();
      }
    } catch (e) {
      console.error('Failed to save map properties', e);
      showToast(t('mapProperties.saveFailed'));
    }
  }, [isNew, mapData, maps, mapId, parentId, name, displayName, tilesetId, width, height, scrollType, encounterStep,
    autoplayBgm, bgm, autoplayBgs, bgs, specifyBattleback, battleback1Name, battleback2Name,
    disableDashing, parallaxName, parallaxLoopX, parallaxLoopY, parallaxSx, parallaxSy, parallaxShow,
    note, encounterList, currentMapId, createMap, updateMapInfos, selectMap, showToast, onClose, t]);

  // Scroll speed options (-32 to 32)
  const scrollSpeedOptions = [];
  for (let i = -32; i <= 32; i++) scrollSpeedOptions.push(i);

  // Tileset display name
  const tilesetDisplayName = tilesetNames[tilesetId]
    ? `${String(tilesetId).padStart(4, '0')} ${tilesetNames[tilesetId]}`
    : String(tilesetId).padStart(4, '0');

  const dialogTitle = isNew
    ? t('mapProperties.titleNew', '새 맵')
    : t('mapProperties.title', { id: String(mapId).padStart(3, '0') });

  if (loading) {
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
        {/* Header */}
        <div className="map-props-header">{dialogTitle}</div>

        {/* Body */}
        <div className="map-props-body">
          {/* Left column */}
          <div className="map-props-left">
            {/* General Settings */}
            <div className="map-props-section">
              <div className="map-props-section-title">{t('mapProperties.generalSettings')}</div>
              <div className="map-props-row">
                <div className="map-props-field flex-1">
                  <span>{t('mapProperties.name')}</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="map-props-field flex-1">
                  <span>{t('mapProperties.displayName')}</span>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
              </div>
              <div className="map-props-row">
                <div className="map-props-field flex-1">
                  <span>{t('mapProperties.tileset')}</span>
                  <div className="map-props-picker-row">
                    <input
                      type="text"
                      readOnly
                      value={tilesetDisplayName}
                      className="map-props-picker-input"
                    />
                    <button
                      className="map-props-picker-btn"
                      onClick={() => setShowTilesetPicker(true)}
                    >...</button>
                  </div>
                </div>
                <div className="map-props-field">
                  <span>{t('mapProperties.width')}</span>
                  <input type="number" min={1} max={256} value={width}
                    onChange={(e) => setWidth(Math.max(1, Math.min(256, Number(e.target.value) || 1)))} />
                </div>
                <div className="map-props-field">
                  <span>{t('mapProperties.height')}</span>
                  <input type="number" min={1} max={256} value={height}
                    onChange={(e) => setHeight(Math.max(1, Math.min(256, Number(e.target.value) || 1)))} />
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
                        <input
                          type="radio"
                          name="scrollType"
                          value={opt.value}
                          checked={scrollType === opt.value}
                          onChange={() => setScrollType(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="map-props-field">
                  <span>{t('mapProperties.encounterSteps')}</span>
                  <input type="number" min={1} max={999} value={encounterStep}
                    onChange={(e) => setEncounterStep(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} />
                </div>
              </div>
            </div>

            {/* BGM / BGS / Battleback / Dashing */}
            <div className="map-props-section">
              <div className="map-props-audio-row">
                <label className="map-props-checkbox">
                  <input type="checkbox" checked={autoplayBgm} onChange={(e) => setAutoplayBgm(e.target.checked)} />
                  <span>BGM {t('mapProperties.autoplay')}</span>
                </label>
              </div>
              {autoplayBgm && (
                <div style={{ marginLeft: 20, marginBottom: 6 }}>
                  <AudioPicker type="bgm" value={bgm} onChange={setBgm} />
                </div>
              )}
              <div className="map-props-audio-row">
                <label className="map-props-checkbox">
                  <input type="checkbox" checked={autoplayBgs} onChange={(e) => setAutoplayBgs(e.target.checked)} />
                  <span>BGS {t('mapProperties.autoplay')}</span>
                </label>
              </div>
              {autoplayBgs && (
                <div style={{ marginLeft: 20, marginBottom: 6 }}>
                  <AudioPicker type="bgs" value={bgs} onChange={setBgs} />
                </div>
              )}
              <label className="map-props-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={specifyBattleback}
                  onChange={(e) => setSpecifyBattleback(e.target.checked)} />
                <span>{t('mapProperties.specifyBattleback')}</span>
              </label>
              {specifyBattleback && (
                <div style={{ marginLeft: 20, marginTop: 4 }}>
                  <BattlebackPicker
                    value1={battleback1Name}
                    value2={battleback2Name}
                    onChange={(n1, n2) => { setBattleback1Name(n1); setBattleback2Name(n2); }}
                  />
                </div>
              )}
              <label className="map-props-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={disableDashing}
                  onChange={(e) => setDisableDashing(e.target.checked)} />
                <span>{t('mapProperties.disableDashing')}</span>
              </label>
            </div>

            {/* Bottom row: Parallax + Note */}
            <div className="map-props-bottom-row">
              {/* Parallax Background */}
              <div className="map-props-bottom-left">
                <div className="map-props-section">
                  <div className="map-props-section-title">{t('mapProperties.parallaxBg')}</div>
                  <div className="map-props-field" style={{ marginBottom: 6 }}>
                    <span>{t('mapProperties.image')}</span>
                    <ImagePicker type="parallaxes" value={parallaxName} onChange={setParallaxName} />
                  </div>
                  <label className="map-props-checkbox">
                    <input type="checkbox" checked={parallaxLoopX} onChange={(e) => setParallaxLoopX(e.target.checked)} />
                    <span>{t('mapProperties.loopHorizontal')}</span>
                  </label>
                  {parallaxLoopX && (
                    <div className="map-props-parallax-scroll">
                      <span>{t('mapProperties.scroll')}</span>
                      <select value={parallaxSx} onChange={(e) => setParallaxSx(Number(e.target.value))}>
                        {scrollSpeedOptions.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="map-props-checkbox">
                    <input type="checkbox" checked={parallaxLoopY} onChange={(e) => setParallaxLoopY(e.target.checked)} />
                    <span>{t('mapProperties.loopVertical')}</span>
                  </label>
                  {parallaxLoopY && (
                    <div className="map-props-parallax-scroll">
                      <span>{t('mapProperties.scroll')}</span>
                      <select value={parallaxSy} onChange={(e) => setParallaxSy(Number(e.target.value))}>
                        {scrollSpeedOptions.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="map-props-checkbox" style={{ marginTop: 4 }}>
                    <input type="checkbox" checked={parallaxShow} onChange={(e) => setParallaxShow(e.target.checked)} />
                    <span>{t('mapProperties.showInEditor')}</span>
                  </label>
                </div>
              </div>

              {/* Note */}
              <div className="map-props-bottom-right">
                <div className="map-props-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="map-props-section-title">{t('mapProperties.note')}</div>
                  <div className="map-props-note">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} />
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
                {encounterList.map((enc, idx) => (
                  <div
                    key={idx}
                    className={`map-props-enc-row${selectedEncIdx === idx ? ' selected' : ''}`}
                    onClick={() => setSelectedEncIdx(idx)}
                    onDoubleClick={() => {
                      setSelectedEncIdx(idx);
                      setEncDialogEditIdx(idx);
                      setEncDialogOpen(true);
                    }}
                  >
                    <div className="map-props-enc-col-troop" style={{ padding: '3px 6px', fontSize: 12 }}>
                      {String(enc.troopId).padStart(4, '0')} {troopNames[enc.troopId] || ''}
                    </div>
                    <div className="map-props-enc-col-weight" style={{ padding: '3px 6px', fontSize: 12, textAlign: 'center' }}>
                      {enc.weight}
                    </div>
                    <div className="map-props-enc-col-region" style={{ padding: '3px 6px', fontSize: 12, textAlign: 'center' }}>
                      {enc.regionSet.length === 0 ? t('mapProperties.encEntireMap') : enc.regionSet.join(',')}
                    </div>
                  </div>
                ))}
                {/* Empty row: double-click to add */}
                <div className="map-props-enc-row-empty" onDoubleClick={handleAddEncounter}>
                  &nbsp;
                </div>
              </div>
            </div>
            <div className="map-props-enc-buttons">
              <button className="db-btn-small" onClick={handleAddEncounter}>{t('mapProperties.encAdd')}</button>
              <button className="db-btn-small" onClick={handleDeleteEncounter} disabled={selectedEncIdx === null}>
                {t('mapProperties.encDelete')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="map-props-footer">
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>

      {/* Tileset Picker Popup */}
      {showTilesetPicker && (
        <DataListPicker
          title={t('mapProperties.tileset') + ' 선택'}
          items={tilesetNames}
          value={tilesetId}
          onChange={(id) => setTilesetId(id)}
          onClose={() => setShowTilesetPicker(false)}
        />
      )}

      {/* Encounter Dialog */}
      {encDialogOpen && (
        <EncounterDialog
          initial={encDialogEditIdx !== null ? encounterList[encDialogEditIdx] : undefined}
          troopNames={troopNames}
          onOk={handleEncDialogOk}
          onCancel={() => { setEncDialogOpen(false); setEncDialogEditIdx(null); }}
        />
      )}
    </div>
  );
}
