import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import ImagePicker from '../common/ImagePicker';
import useEscClose from '../../hooks/useEscClose';
import './MapPropertiesDialog.css';

interface TilesetEntry {
  id: number;
  name: string;
}

interface FogOfWarConfig {
  enabled: boolean;
  radius: number;
  fogColor: string;
  unexploredAlpha: number;
  exploredAlpha: number;
  lineOfSight?: boolean;
  fogTransitionSpeed?: number;
  // 2D 셰이더
  dissolveStrength?: number;
  fadeSmoothness?: number;
  tentacleSharpness?: number;
  edgeAnimation?: boolean;
  edgeAnimationSpeed?: number;
  // 촉수 타이밍
  tentacleFadeDuration?: number;
  tentacleGrowDuration?: number;
  // 3D 볼류메트릭
  fogHeight?: number;
  absorption?: number;
  visibilityBrightness?: number;
  fogColorTop?: string;
  heightGradient?: boolean;
  godRay?: boolean;
  godRayIntensity?: number;
  vortex?: boolean;
  vortexSpeed?: number;
  lightScattering?: boolean;
  lightScatterIntensity?: number;
}

interface MapProps {
  displayName: string;
  tilesetId: number;
  width: number;
  height: number;
  scrollType: number;
  encounterStep: number;
  autoplayBgm: boolean;
  autoplayBgs: boolean;
  bgm: { name: string; pan: number; pitch: number; volume: number };
  bgs: { name: string; pan: number; pitch: number; volume: number };
  parallaxName: string;
  parallaxLoopX: boolean;
  parallaxLoopY: boolean;
  parallaxSx: number;
  parallaxSy: number;
  parallaxShow: boolean;
  specifyBattleback: boolean;
  battleback1Name: string;
  battleback2Name: string;
  disableDashing: boolean;
  weatherType: number;
  weatherPower: number;
  note: string;
  fogOfWar?: FogOfWarConfig;
}

interface Props {
  mapId: number;
  mapName: string;
  onClose: () => void;
}

export default function MapPropertiesDialog({ mapId, mapName, onClose }: Props) {
  const { t } = useTranslation();
  useEscClose(onClose);
  const currentMap = useEditorStore((s) => s.currentMap);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const selectMap = useEditorStore((s) => s.selectMap);
  const maps = useEditorStore((s) => s.maps);
  const updateMapInfos = useEditorStore((s) => s.updateMapInfos);
  const showToast = useEditorStore((s) => s.showToast);

  const [tilesets, setTilesets] = useState<TilesetEntry[]>([]);
  const [mapData, setMapData] = useState<MapProps | null>(null);
  const [name, setName] = useState(mapName);
  const [loading, setLoading] = useState(true);

  // Load tileset list and map data
  useEffect(() => {
    (async () => {
      try {
        const [tsData, mData] = await Promise.all([
          apiClient.get<(null | { id: number; name: string })[]>('/database/tilesets'),
          apiClient.get<MapProps>(`/maps/${mapId}`),
        ]);
        const entries: TilesetEntry[] = [];
        tsData.forEach((t, i) => {
          if (t && t.name) entries.push({ id: i, name: t.name });
        });
        setTilesets(entries);
        setMapData(mData);
      } catch (e) {
        console.error('Failed to load map properties:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [mapId]);

  const updateField = <K extends keyof MapProps>(key: K, value: MapProps[K]) => {
    if (!mapData) return;
    setMapData({ ...mapData, [key]: value });
  };

  const handleOK = async () => {
    if (!mapData) return;
    try {
      // Save map data (need to merge with full map data including tile data)
      const fullMap = await apiClient.get<Record<string, unknown>>(`/maps/${mapId}`);
      const merged = {
        ...fullMap,
        displayName: mapData.displayName,
        tilesetId: mapData.tilesetId,
        width: mapData.width,
        height: mapData.height,
        scrollType: mapData.scrollType,
        encounterStep: mapData.encounterStep,
        autoplayBgm: mapData.autoplayBgm,
        autoplayBgs: mapData.autoplayBgs,
        bgm: mapData.bgm,
        bgs: mapData.bgs,
        parallaxName: mapData.parallaxName,
        parallaxLoopX: mapData.parallaxLoopX,
        parallaxLoopY: mapData.parallaxLoopY,
        parallaxSx: mapData.parallaxSx,
        parallaxSy: mapData.parallaxSy,
        parallaxShow: mapData.parallaxShow,
        specifyBattleback: mapData.specifyBattleback,
        battleback1Name: mapData.battleback1Name,
        battleback2Name: mapData.battleback2Name,
        disableDashing: mapData.disableDashing,
        weatherType: mapData.weatherType ?? 0,
        weatherPower: mapData.weatherPower ?? 0,
        note: mapData.note,
        fogOfWar: mapData.fogOfWar,
      };
      const res = await apiClient.put<{ success: boolean; l10nDiff?: { added: string[]; modified: string[]; deleted: string[] } }>(`/maps/${mapId}`, merged);
      if (res.l10nDiff) {
        const parts: string[] = [];
        if (res.l10nDiff.added.length) parts.push(`추가 ${res.l10nDiff.added.length}`);
        if (res.l10nDiff.modified.length) parts.push(`변경 ${res.l10nDiff.modified.length}`);
        if (res.l10nDiff.deleted.length) parts.push(`삭제 ${res.l10nDiff.deleted.length}`);
        showToast(`맵 속성 저장 완료 (L10n: ${parts.join(', ')})`);
      }

      // Update map name in MapInfos
      if (name !== mapName) {
        const newMaps = maps.map(m => {
          if (m && m.id === mapId) return { ...m, name };
          return m;
        });
        await updateMapInfos(newMaps);
      }

      // Reload the map if it's currently selected
      if (currentMapId === mapId) {
        await selectMap(mapId);
      }
    } catch (e) {
      console.error('Failed to save map properties:', e);
    }
    onClose();
  };

  if (loading || !mapData) {
    return (
      <div className="db-dialog-overlay">
        <div className="db-dialog" style={{ width: 550, height: 600 }}>
          <div className="db-dialog-header">{t('mapProperties.title')}</div>
          <div className="db-dialog-body"><div className="db-loading">{t('common.loading')}</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 550, maxHeight: '85vh' }}>
        <div className="db-dialog-header">{t('mapProperties.title')} - {name}</div>
        <div className="db-dialog-body" style={{ flexDirection: 'column', overflowY: 'auto', padding: 16, gap: 12 }}>
          {/* General Settings */}
          <div className="db-form-section">{t('mapProperties.generalSettings')}</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label>
              <span>{t('common.name')}</span>
              <input type="text" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>
              <span>{t('mapProperties.displayName')}</span>
              <input type="text" value={mapData.displayName} onChange={e => updateField('displayName', e.target.value)} />
            </label>
            <label>
              <span>{t('mapProperties.tileset')}</span>
              <select value={mapData.tilesetId} onChange={e => updateField('tilesetId', Number(e.target.value))}>
                {tilesets.map(ts => (
                  <option key={ts.id} value={ts.id}>{ts.id}: {ts.name}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 1 }}>
                <span>{t('mapProperties.width')}</span>
                <input type="number" min={1} max={256} value={mapData.width}
                  onChange={e => updateField('width', Math.max(1, Math.min(256, Number(e.target.value))))} />
              </label>
              <label style={{ flex: 1 }}>
                <span>{t('mapProperties.height')}</span>
                <input type="number" min={1} max={256} value={mapData.height}
                  onChange={e => updateField('height', Math.max(1, Math.min(256, Number(e.target.value))))} />
              </label>
            </div>
            <label>
              <span>{t('mapProperties.scrollType')}</span>
              <select value={mapData.scrollType} onChange={e => updateField('scrollType', Number(e.target.value))}>
                <option value={0}>{t('mapProperties.scrollTypes.0')}</option>
                <option value={1}>{t('mapProperties.scrollTypes.1')}</option>
                <option value={2}>{t('mapProperties.scrollTypes.2')}</option>
                <option value={3}>{t('mapProperties.scrollTypes.3')}</option>
              </select>
            </label>
            <label>
              <span>{t('mapProperties.encSteps')}</span>
              <input type="number" min={1} max={999} value={mapData.encounterStep}
                onChange={e => updateField('encounterStep', Number(e.target.value))} />
            </label>
          </div>

          {/* Autoplay */}
          <div className="db-form-section">{t('mapProperties.autoplay')}</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.autoplayBgm}
                onChange={e => updateField('autoplayBgm', e.target.checked)} />
              <span>{t('mapProperties.autoplayBGM')}</span>
            </label>
            {mapData.autoplayBgm && (
              <label>
                <span>{t('mapProperties.bgmName')}</span>
                <input type="text" value={mapData.bgm.name}
                  onChange={e => updateField('bgm', { ...mapData.bgm, name: e.target.value })} />
              </label>
            )}
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.autoplayBgs}
                onChange={e => updateField('autoplayBgs', e.target.checked)} />
              <span>{t('mapProperties.autoplayBGS')}</span>
            </label>
            {mapData.autoplayBgs && (
              <label>
                <span>{t('mapProperties.bgsName')}</span>
                <input type="text" value={mapData.bgs.name}
                  onChange={e => updateField('bgs', { ...mapData.bgs, name: e.target.value })} />
              </label>
            )}
          </div>

          {/* Options */}
          <div className="db-form-section">{t('mapProperties.options')}</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.specifyBattleback}
                onChange={e => updateField('specifyBattleback', e.target.checked)} />
              <span>{t('mapProperties.specifyBattleback')}</span>
            </label>
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.disableDashing}
                onChange={e => updateField('disableDashing', e.target.checked)} />
              <span>{t('mapProperties.disableDashing')}</span>
            </label>
          </div>

          {/* Parallax */}
          <div className="db-form-section">{t('mapProperties.parallaxBackground')}</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: '#aaa' }}>
              <span>{t('mapProperties.image')}</span>
              <ImagePicker
                type="parallaxes"
                value={mapData.parallaxName}
                onChange={name => updateField('parallaxName', name)}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <label className="db-checkbox-row">
                <input type="checkbox" checked={mapData.parallaxLoopX}
                  onChange={e => updateField('parallaxLoopX', e.target.checked)} />
                <span>{t('mapProperties.loopX')}</span>
              </label>
              <label className="db-checkbox-row">
                <input type="checkbox" checked={mapData.parallaxLoopY}
                  onChange={e => updateField('parallaxLoopY', e.target.checked)} />
                <span>{t('mapProperties.loopY')}</span>
              </label>
            </div>
            {mapData.parallaxLoopX && (
              <label>
                <span>{t('mapProperties.scrollX')}</span>
                <input type="number" min={-32} max={32} value={mapData.parallaxSx}
                  onChange={e => updateField('parallaxSx', Number(e.target.value))} />
              </label>
            )}
            {mapData.parallaxLoopY && (
              <label>
                <span>{t('mapProperties.scrollY')}</span>
                <input type="number" min={-32} max={32} value={mapData.parallaxSy}
                  onChange={e => updateField('parallaxSy', Number(e.target.value))} />
              </label>
            )}
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.parallaxShow}
                onChange={e => updateField('parallaxShow', e.target.checked)} />
              <span>{t('mapProperties.showInEditor')}</span>
            </label>
          </div>

          {/* Weather */}
          <div className="db-form-section">{t('mapProperties.weather')}</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label>
              <span>{t('mapProperties.weatherType')}</span>
              <select value={mapData.weatherType ?? 0} onChange={e => updateField('weatherType', Number(e.target.value))}>
                <option value={0}>{t('mapProperties.weatherTypes.0')}</option>
                <option value={1}>{t('mapProperties.weatherTypes.1')}</option>
                <option value={2}>{t('mapProperties.weatherTypes.2')}</option>
                <option value={3}>{t('mapProperties.weatherTypes.3')}</option>
              </select>
            </label>
            {(mapData.weatherType ?? 0) > 0 && (
              <label>
                <span>{t('mapProperties.weatherPower')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={1} max={9} value={mapData.weatherPower || 5}
                    onChange={e => updateField('weatherPower', Number(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ minWidth: 20, textAlign: 'center', color: '#ccc' }}>{mapData.weatherPower || 5}</span>
                </div>
              </label>
            )}
          </div>

          {/* Fog of War */}
          <div className="db-form-section">Fog of War</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.fogOfWar?.enabled ?? false}
                onChange={e => updateField('fogOfWar', {
                  ...(mapData.fogOfWar || { enabled: false, radius: 5, fogColor: '#000000', unexploredAlpha: 1.0, exploredAlpha: 0.6 }),
                  enabled: e.target.checked,
                })} />
              <span>활성화</span>
            </label>
            {mapData.fogOfWar?.enabled && (() => {
              const fow = mapData.fogOfWar!;
              const u = (patch: Partial<FogOfWarConfig>) => updateField('fogOfWar', { ...fow, ...patch });
              return (
              <>
                {/* 공통 */}
                <label>
                  <span>시야 반경 (타일)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={1} max={30} value={fow.radius ?? 5}
                      onChange={e => u({ radius: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 20, textAlign: 'center', color: '#ccc' }}>{fow.radius ?? 5}</span>
                  </div>
                </label>
                <label>
                  <span>안개 색상</span>
                  <input type="color" value={fow.fogColor ?? '#000000'}
                    onChange={e => u({ fogColor: e.target.value })} />
                </label>
                <label>
                  <span>미탐험 불투명도</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0} max={100} value={Math.round((fow.unexploredAlpha ?? 1.0) * 100)}
                      onChange={e => u({ unexploredAlpha: Number(e.target.value) / 100 })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>
                      {Math.round((fow.unexploredAlpha ?? 1.0) * 100)}%
                    </span>
                  </div>
                </label>
                <label>
                  <span>탐험완료 불투명도</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0} max={100} value={Math.round((fow.exploredAlpha ?? 0.6) * 100)}
                      onChange={e => u({ exploredAlpha: Number(e.target.value) / 100 })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>
                      {Math.round((fow.exploredAlpha ?? 0.6) * 100)}%
                    </span>
                  </div>
                </label>
                <label className="db-checkbox-row">
                  <input type="checkbox" checked={fow.lineOfSight ?? true}
                    onChange={e => u({ lineOfSight: e.target.checked })} />
                  <span>시선 차단 (Line of Sight)</span>
                </label>
                <label>
                  <span>전환 속도</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={1} max={20} step={0.5} value={fow.fogTransitionSpeed ?? 5.0}
                      onChange={e => u({ fogTransitionSpeed: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.fogTransitionSpeed ?? 5.0}</span>
                  </div>
                </label>

                {/* 2D 셰이더 */}
                <div style={{ color: '#6af', fontSize: 11, marginTop: 8 }}>2D 셰이더</div>
                <label>
                  <span>촉수 길이</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0} max={4} step={0.1} value={fow.dissolveStrength ?? 2.0}
                      onChange={e => u({ dissolveStrength: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.dissolveStrength ?? 2.0}</span>
                  </div>
                </label>
                <label>
                  <span>페이드 범위</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0.05} max={1} step={0.05} value={fow.fadeSmoothness ?? 0.3}
                      onChange={e => u({ fadeSmoothness: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.fadeSmoothness ?? 0.3}</span>
                  </div>
                </label>
                <label>
                  <span>촉수 날카로움</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={1} max={6} step={0.1} value={fow.tentacleSharpness ?? 3.0}
                      onChange={e => u({ tentacleSharpness: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.tentacleSharpness ?? 3.0}</span>
                  </div>
                </label>
                <label className="db-checkbox-row">
                  <input type="checkbox" checked={fow.edgeAnimation ?? true}
                    onChange={e => u({ edgeAnimation: e.target.checked })} />
                  <span>경계 애니메이션</span>
                </label>
                {(fow.edgeAnimation ?? true) && (
                  <label>
                    <span>애니메이션 속도</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min={0} max={5} step={0.1} value={fow.edgeAnimationSpeed ?? 1.0}
                        onChange={e => u({ edgeAnimationSpeed: Number(e.target.value) })} style={{ flex: 1 }} />
                      <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.edgeAnimationSpeed ?? 1.0}</span>
                    </div>
                  </label>
                )}

                {/* 촉수 타이밍 */}
                <div style={{ color: '#af6', fontSize: 11, marginTop: 8 }}>촉수 타이밍</div>
                <label>
                  <span>삭제 시간 (초)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0.1} max={5} step={0.1} value={fow.tentacleFadeDuration ?? 1.0}
                      onChange={e => u({ tentacleFadeDuration: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.tentacleFadeDuration ?? 1.0}</span>
                  </div>
                </label>
                <label>
                  <span>생성 시간 (초)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0.1} max={5} step={0.1} value={fow.tentacleGrowDuration ?? 0.5}
                      onChange={e => u({ tentacleGrowDuration: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.tentacleGrowDuration ?? 0.5}</span>
                  </div>
                </label>

                {/* 3D 볼류메트릭 */}
                <div style={{ color: '#f8a', fontSize: 11, marginTop: 8 }}>3D 볼류메트릭</div>
                <label>
                  <span>안개 높이</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={50} max={1000} step={10} value={fow.fogHeight ?? 300}
                      onChange={e => u({ fogHeight: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.fogHeight ?? 300}</span>
                  </div>
                </label>
                <label>
                  <span>흡수율</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0.001} max={0.1} step={0.001} value={fow.absorption ?? 0.012}
                      onChange={e => u({ absorption: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 40, textAlign: 'center', color: '#ccc' }}>{(fow.absorption ?? 0.012).toFixed(3)}</span>
                  </div>
                </label>
                <label>
                  <span>시야 밝기 보정</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="range" min={0} max={1} step={0.05} value={fow.visibilityBrightness ?? 0.0}
                      onChange={e => u({ visibilityBrightness: Number(e.target.value) })} style={{ flex: 1 }} />
                    <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.visibilityBrightness ?? 0.0}</span>
                  </div>
                </label>
                <label>
                  <span>상단 안개 색상</span>
                  <input type="color" value={fow.fogColorTop ?? '#262633'}
                    onChange={e => u({ fogColorTop: e.target.value })} />
                </label>
                <label className="db-checkbox-row">
                  <input type="checkbox" checked={fow.heightGradient ?? true}
                    onChange={e => u({ heightGradient: e.target.checked })} />
                  <span>높이 그라데이션</span>
                </label>
                <label className="db-checkbox-row">
                  <input type="checkbox" checked={fow.godRay ?? true}
                    onChange={e => u({ godRay: e.target.checked })} />
                  <span>God Ray</span>
                </label>
                {(fow.godRay ?? true) && (
                  <label>
                    <span>God Ray 강도</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min={0} max={2} step={0.1} value={fow.godRayIntensity ?? 0.4}
                        onChange={e => u({ godRayIntensity: Number(e.target.value) })} style={{ flex: 1 }} />
                      <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.godRayIntensity ?? 0.4}</span>
                    </div>
                  </label>
                )}
                <label className="db-checkbox-row">
                  <input type="checkbox" checked={fow.vortex ?? true}
                    onChange={e => u({ vortex: e.target.checked })} />
                  <span>소용돌이</span>
                </label>
                {(fow.vortex ?? true) && (
                  <label>
                    <span>소용돌이 속도</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min={0} max={5} step={0.1} value={fow.vortexSpeed ?? 1.0}
                        onChange={e => u({ vortexSpeed: Number(e.target.value) })} style={{ flex: 1 }} />
                      <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.vortexSpeed ?? 1.0}</span>
                    </div>
                  </label>
                )}
                <label className="db-checkbox-row">
                  <input type="checkbox" checked={fow.lightScattering ?? true}
                    onChange={e => u({ lightScattering: e.target.checked })} />
                  <span>라이트 산란</span>
                </label>
                {(fow.lightScattering ?? true) && (
                  <label>
                    <span>산란 강도</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min={0} max={3} step={0.1} value={fow.lightScatterIntensity ?? 1.0}
                        onChange={e => u({ lightScatterIntensity: Number(e.target.value) })} style={{ flex: 1 }} />
                      <span style={{ minWidth: 30, textAlign: 'center', color: '#ccc' }}>{fow.lightScatterIntensity ?? 1.0}</span>
                    </div>
                  </label>
                )}

                {/* 붙여넣기 버튼 */}
                <button className="db-btn" style={{ marginTop: 8, width: '100%' }}
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const parsed = JSON.parse(text) as Partial<FogOfWarConfig>;
                      if (typeof parsed !== 'object' || parsed === null) return;
                      const merged = { ...fow };
                      const keys: (keyof FogOfWarConfig)[] = [
                        'radius', 'fogColor', 'unexploredAlpha', 'exploredAlpha',
                        'lineOfSight', 'fogTransitionSpeed',
                        'dissolveStrength', 'fadeSmoothness', 'tentacleSharpness',
                        'edgeAnimation', 'edgeAnimationSpeed',
                        'tentacleFadeDuration', 'tentacleGrowDuration',
                        'fogHeight', 'absorption', 'visibilityBrightness',
                        'fogColorTop', 'heightGradient',
                        'godRay', 'godRayIntensity',
                        'vortex', 'vortexSpeed',
                        'lightScattering', 'lightScatterIntensity',
                      ];
                      for (const k of keys) {
                        if (parsed[k] !== undefined) (merged as Record<string, unknown>)[k] = parsed[k];
                      }
                      updateField('fogOfWar', merged);
                    } catch {
                      // 클립보드 읽기 실패 또는 JSON 파싱 실패
                    }
                  }}>
                  클립보드에서 붙여넣기
                </button>
              </>
              );
            })()}
          </div>

          {/* Note */}
          <div className="db-form-section">{t('common.note')}</div>
          <textarea value={mapData.note} onChange={e => updateField('note', e.target.value)}
            style={{ width: '100%', minHeight: 60, background: '#2a2a2a', color: '#ccc', border: '1px solid #555', padding: 8, resize: 'vertical' }} />
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOK}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
