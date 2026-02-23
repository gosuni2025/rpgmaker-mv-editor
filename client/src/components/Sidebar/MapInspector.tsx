import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import ImagePicker from '../common/ImagePicker';
import AudioPicker from '../common/AudioPicker';
import BattlebackPicker from '../common/BattlebackPicker';
import SkyBackgroundPicker from '../common/SkyBackgroundPicker';
import ExtBadge from '../common/ExtBadge';
import HelpButton from '../common/HelpButton';
import type { AudioFile, DofConfig } from '../../types/rpgMakerMV';
import { DEFAULT_DOF_CONFIG } from '../../types/rpgMakerMV';
import { AnimTileShaderSection } from './AnimTileShaderSection';
import { PostProcessSection } from './PostProcessSection';
import { FogOfWarSection } from './FogOfWarSection';
import { MapResizeSection } from './MapResizeSection';
import './InspectorPanel.css';

interface TilesetEntry { id: number; name: string; }

export default function MapInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const maps = useEditorStore((s) => s.maps);
  const resizeMap = useEditorStore((s) => s.resizeMap);
  const updateMapInfos = useEditorStore((s) => s.updateMapInfos);
  const showToast = useEditorStore((s) => s.showToast);

  const mapInfo = currentMapId != null ? maps.find(m => m && m.id === currentMapId) : null;
  const mapName = mapInfo?.name ?? '';

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  // Tilesets
  const [tilesets, setTilesets] = useState<TilesetEntry[]>([]);
  useEffect(() => {
    apiClient.get<(null | { id: number; name: string })[]>('/database/tilesets').then(data => {
      const entries: TilesetEntry[] = [];
      data.forEach((t, i) => { if (t && t.name) entries.push({ id: i, name: t.name }); });
      setTilesets(entries);
    }).catch(() => {});
  }, []);

  // Reset when map changes
  useEffect(() => {
    setEditingName(false);
  }, [currentMapId]);

  const handleRenameSave = useCallback(async () => {
    if (!currentMapId || !nameValue.trim()) { setEditingName(false); return; }
    const newMaps = maps.map(m => {
      if (m && m.id === currentMapId) return { ...m, name: nameValue.trim() };
      return m;
    });
    await updateMapInfos(newMaps);
    setEditingName(false);
    showToast('맵 이름 변경 완료');
  }, [currentMapId, nameValue, maps, updateMapInfos, showToast]);

  const updateMapField = useCallback((field: string, value: unknown) => {
    const cm = useEditorStore.getState().currentMap;
    if (!cm) return;
    useEditorStore.setState({ currentMap: { ...cm, [field]: value } });
  }, []);

  const updateNestedField = useCallback((parent: string, field: string, value: unknown) => {
    const cm = useEditorStore.getState().currentMap;
    if (!cm) return;
    const parentObj = (cm as any)[parent] || {};
    useEditorStore.setState({ currentMap: { ...cm, [parent]: { ...parentObj, [field]: value } } });
  }, []);

  const handleTilesetChange = useCallback(async (tilesetId: number) => {
    updateMapField('tilesetId', tilesetId);
    try {
      const tsData = await apiClient.get<(null | { tilesetNames: string[] })[]>('/database/tilesets');
      const ts = tsData[tilesetId];
      if (ts) {
        const cm = useEditorStore.getState().currentMap;
        if (cm) {
          useEditorStore.setState({
            currentMap: { ...cm, tilesetId, tilesetNames: ts.tilesetNames },
            tilesetInfo: ts as any,
          });
        }
      }
    } catch {}
  }, [updateMapField]);

  if (!currentMap) {
    return (
      <div className="light-inspector">
        <div style={{ color: '#666', fontSize: 12, padding: 8 }}>맵을 선택하세요</div>
      </div>
    );
  }

  return (
    <div className="light-inspector">
      {/* Map Info */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">일반 설정</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">이름</span>
          {editingName ? (
            <input
              type="text"
              className="light-inspector-input"
              style={{ flex: 1 }}
              value={nameValue}
              autoFocus
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') setEditingName(false); }}
              onBlur={handleRenameSave}
            />
          ) : (
            <button
              className="inspector-clickable-label"
              onClick={() => { setNameValue(mapName); setEditingName(true); }}
              title="클릭하여 이름 편집"
            >{`[${String(currentMapId).padStart(3, '0')}] ${currentMap.displayName ? `${mapName}(${currentMap.displayName})` : mapName}`}</button>
          )}
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">이름 표시</span>
          <input
            type="text"
            className="light-inspector-input"
            style={{ flex: 1 }}
            value={currentMap.displayName || ''}
            onChange={(e) => updateMapField('displayName', e.target.value)}
          />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">ID</span>
          <span style={{ fontSize: 12, color: '#888' }}>{currentMapId}</span>
        </div>
      </div>

      {/* Tileset */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">타일셋:</div>
        <select
          className="map-inspector-select"
          value={currentMap.tilesetId}
          onChange={(e) => handleTilesetChange(Number(e.target.value))}
        >
          {tilesets.map(ts => (
            <option key={ts.id} value={ts.id}>{ts.id}: {ts.name}</option>
          ))}
        </select>
      </div>

      {/* Map Properties */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">스크롤 유형:</div>
        <select
          className="map-inspector-select"
          value={currentMap.scrollType ?? 0}
          onChange={(e) => updateMapField('scrollType', Number(e.target.value))}
        >
          <option value={0}>루프하지 않음</option>
          <option value={1}>좌우 루프</option>
          <option value={2}>상하 루프</option>
          <option value={3}>양방향 루프</option>
        </select>
        <div className="light-inspector-row" style={{ marginTop: 8 }}>
          <span className="light-inspector-label" style={{ width: 'auto' }}>적 출현까지 걸음 횟수</span>
          <input
            type="number"
            className="light-inspector-input"
            style={{ width: 60 }}
            min={1} max={999}
            value={currentMap.encounterStep ?? 30}
            onChange={(e) => updateMapField('encounterStep', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Battleback */}
      <div className="light-inspector-section">
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!currentMap.specifyBattleback}
            onChange={(e) => updateMapField('specifyBattleback', e.target.checked)} />
          <span>전투 배경 설정</span>
        </label>
        {currentMap.specifyBattleback && (
          <div style={{ marginTop: 4 }}>
            <BattlebackPicker
              value1={currentMap.battleback1Name || ''}
              value2={currentMap.battleback2Name || ''}
              onChange={(name1, name2) => {
                const cm = useEditorStore.getState().currentMap;
                if (!cm) return;
                useEditorStore.setState({
                  currentMap: { ...cm, battleback1Name: name1, battleback2Name: name2 },
                });
              }}
            />
          </div>
        )}
        <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
          <input type="checkbox" checked={!!currentMap.disableDashing}
            onChange={(e) => updateMapField('disableDashing', e.target.checked)} />
          <span>대시 금지</span>
        </label>
      </div>

      {/* BGM / BGS */}
      <div className="light-inspector-section">
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!currentMap.autoplayBgm}
            onChange={(e) => updateMapField('autoplayBgm', e.target.checked)} />
          <span>BGM 자동재생</span>
        </label>
        {currentMap.autoplayBgm && (
          <div style={{ marginLeft: 16 }}>
            <AudioPicker
              type="bgm"
              value={currentMap.bgm || { name: '', volume: 90, pitch: 100, pan: 0 }}
              onChange={(audio: AudioFile) => updateMapField('bgm', audio)}
            />
          </div>
        )}
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!currentMap.autoplayBgs}
            onChange={(e) => updateMapField('autoplayBgs', e.target.checked)} />
          <span>BGS 자동재생</span>
        </label>
        {currentMap.autoplayBgs && (
          <div style={{ marginLeft: 16 }}>
            <AudioPicker
              type="bgs"
              value={currentMap.bgs || { name: '', volume: 90, pitch: 100, pan: 0 }}
              onChange={(audio: AudioFile) => updateMapField('bgs', audio)}
            />
          </div>
        )}
      </div>

      {/* 렌더 모드 (2D/3D) */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">렌더 모드 <ExtBadge inline /></div>
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!(currentMap as any).is3D}
            onChange={(e) => {
              updateMapField('is3D', e.target.checked || undefined);
            }} />
          <span>3D 모드</span>
        </label>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
          이 맵을 3D 모드로 렌더링합니다. 게임 플레이 시 이 맵에 진입할 때 자동으로 3D/2D 모드가 전환됩니다.
        </div>
      </div>

      {/* 3D Tile Layer Elevation */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">3D 타일 레이어 <ExtBadge inline /></div>
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!(currentMap as any).tileLayerElevation}
            onChange={(e) => updateMapField('tileLayerElevation', e.target.checked)} />
          <span>타일 레이어 높이 분리</span>
        </label>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
          3D 모드에서 상층/하층 타일의 Z축 높이를 분리합니다.
        </div>
      </div>

      {/* Editor Lights enabled */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">조명 시스템 <ExtBadge inline /></div>
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={currentMap.editorLights?.enabled !== false}
            onChange={(e) => {
              const cm = useEditorStore.getState().currentMap;
              if (!cm || !cm.editorLights) return;
              useEditorStore.getState().updateEditorLightsEnabled(e.target.checked);
            }} />
          <span>조명 적용</span>
        </label>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
          이 맵에 에디터 조명(환경광, 방향 조명, 점 조명 등)을 적용합니다.
          조명 편집 모드의 동일한 설정과 연동됩니다.
        </div>
      </div>

      {/* Parallax - standard MV */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">먼 배경</div>

        {/* Background type selector */}
        <div className="sky-type-selector">
          <button
            className={`sky-type-btn${(!currentMap.skyBackground || currentMap.skyBackground.type === 'parallax') ? ' active' : ''}`}
            onClick={() => updateMapField('skyBackground', { ...currentMap.skyBackground, type: 'parallax' })}
          >
            Parallax
          </button>
          <button
            className={`sky-type-btn sky-type-btn-ext${currentMap.skyBackground?.type === 'skysphere' ? ' active' : ''}`}
            onClick={() => updateMapField('skyBackground', {
              type: 'skysphere',
              skyImage: currentMap.skyBackground?.skyImage || '',
              rotationSpeed: currentMap.skyBackground?.rotationSpeed ?? 0,
            })}
          >
            Sky Sphere
          </button>
          <HelpButton placement="bottom">
            <strong>Sky Sphere</strong>는 에디터 확장 기능입니다.<br />
            3D 모드에서 파노라마 이미지를 구체에 매핑하여 하늘 배경을 표현합니다.<br /><br />
            이 데이터는 별도의 확장 파일(<code style={{ background: '#222', padding: '0 3px', borderRadius: 2 }}>_ext.json</code>)에 저장되므로 RPG Maker MV 원본 에디터와 호환됩니다.
          </HelpButton>
        </div>

        {/* Parallax mode (default MV) */}
        {(!currentMap.skyBackground || currentMap.skyBackground.type === 'parallax') && (
          <>
            <div style={{ marginBottom: 4, marginTop: 8 }}>
              <ImagePicker
                type="parallaxes"
                value={currentMap.parallaxName || ''}
                onChange={(name) => updateMapField('parallaxName', name)}
              />
            </div>
            {currentMap.parallaxName && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label className="map-inspector-checkbox">
                    <input type="checkbox" checked={!!currentMap.parallaxLoopX}
                      onChange={(e) => updateMapField('parallaxLoopX', e.target.checked)} />
                    <span>가로 루프</span>
                  </label>
                  <label className="map-inspector-checkbox">
                    <input type="checkbox" checked={!!currentMap.parallaxLoopY}
                      onChange={(e) => updateMapField('parallaxLoopY', e.target.checked)} />
                    <span>세로 루프</span>
                  </label>
                </div>
                {currentMap.parallaxLoopX && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 60 }}>가로 속도</span>
                    <input type="range" min={-32} max={32} step={1}
                      value={currentMap.parallaxSx || 0}
                      onChange={(e) => updateMapField('parallaxSx', Number(e.target.value))}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#aaa', minWidth: 24, textAlign: 'right' }}>
                      {currentMap.parallaxSx || 0}
                    </span>
                  </div>
                )}
                {currentMap.parallaxLoopY && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 60 }}>세로 속도</span>
                    <input type="range" min={-32} max={32} step={1}
                      value={currentMap.parallaxSy || 0}
                      onChange={(e) => updateMapField('parallaxSy', Number(e.target.value))}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#aaa', minWidth: 24, textAlign: 'right' }}>
                      {currentMap.parallaxSy || 0}
                    </span>
                  </div>
                )}
                <label className="map-inspector-checkbox">
                  <input type="checkbox" checked={currentMap.parallaxShow ?? false}
                    onChange={(e) => updateMapField('parallaxShow', e.target.checked)} />
                  <span>에디터에서 보여주기</span>
                </label>
              </>
            )}
          </>
        )}

        {/* Sky Sphere mode (extension) */}
        {currentMap.skyBackground?.type === 'skysphere' && (
          <div className="sky-ext-section">
            <ExtBadge />
            <SkyBackgroundPicker
              value={currentMap.skyBackground.skyImage || ''}
              rotationSpeed={currentMap.skyBackground.rotationSpeed ?? 0}
              sunLights={currentMap.skyBackground.sunLights}
              onChange={(image, speed, sunLights) => {
                updateMapField('skyBackground', {
                  type: 'skysphere',
                  skyImage: image,
                  rotationSpeed: speed,
                  sunLights: sunLights.length > 0 ? sunLights : undefined,
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Note */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">메모</div>
        <textarea
          className="map-inspector-textarea"
          value={currentMap.note || ''}
          onChange={(e) => updateMapField('note', e.target.value)}
          rows={3}
        />
      </div>

      {/* Anim Tile Shader Settings */}
      <AnimTileShaderSection
        currentMap={currentMap}
        updateMapField={updateMapField}
      />

      {/* Post Processing Effects (블룸 포함) */}
      <PostProcessSection
        currentMap={currentMap}
        updateMapField={updateMapField}
      />

      {/* Fog of War */}
      <FogOfWarSection currentMap={currentMap} updateMapField={updateMapField} />

      {/* Map Size Adjust */}
      <MapResizeSection
        currentMapId={currentMapId}
        width={currentMap.width}
        height={currentMap.height}
        resizeMap={resizeMap}
      />
    </div>
  );
}
