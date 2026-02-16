import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import ImagePicker from '../common/ImagePicker';
import AudioPicker from '../common/AudioPicker';
import BattlebackPicker from '../common/BattlebackPicker';
import SkyBackgroundPicker from '../common/SkyBackgroundPicker';
import type { AudioFile } from '../../types/rpgMakerMV';
import { AnimTileShaderSection } from './AnimTileShaderSection';
import { PostProcessSection } from './PostProcessSection';
import './InspectorPanel.css';

interface TilesetEntry { id: number; name: string; }

function ExtBadge({ inline }: { inline?: boolean }) {
  const [show, setShow] = useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 230) });
    }
    setShow(!show);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    // requestAnimationFrame으로 지연 등록하여 현재 클릭 이벤트에 의한 즉시 닫힘 방지
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleOutside);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [show]);

  return (
    <span ref={ref} className={`sky-ext-badge${inline ? ' sky-ext-badge-inline' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      EXT
      {show && pos && (
        <div className="ext-badge-popup" style={{ position: 'fixed', top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}>
          <strong>EXT</strong> (Extension) 표시가 있는 항목은 에디터 확장 기능입니다.<br /><br />
          이 데이터는 별도의 확장 파일(<code>_ext.json</code>)에 저장되므로 RPG Maker MV 원본 에디터와의 호환성에 영향을 주지 않습니다.
        </div>
      )}
    </span>
  );
}

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
  const [showSkyHelp, setShowSkyHelp] = useState(false);

  // Tilesets
  const [tilesets, setTilesets] = useState<TilesetEntry[]>([]);
  useEffect(() => {
    apiClient.get<(null | { id: number; name: string })[]>('/database/tilesets').then(data => {
      const entries: TilesetEntry[] = [];
      data.forEach((t, i) => { if (t && t.name) entries.push({ id: i, name: t.name }); });
      setTilesets(entries);
    }).catch(() => {});
  }, []);

  // Expand amounts for each direction
  const [addLeft, setAddLeft] = useState(0);
  const [addTop, setAddTop] = useState(0);
  const [addRight, setAddRight] = useState(0);
  const [addBottom, setAddBottom] = useState(0);

  // Reset when map changes
  useEffect(() => {
    setAddLeft(0);
    setAddTop(0);
    setAddRight(0);
    setAddBottom(0);
    setEditingName(false);
  }, [currentMapId]);

  const handleApplyResize = useCallback(() => {
    if (!currentMap) return;
    if (addLeft === 0 && addTop === 0 && addRight === 0 && addBottom === 0) return;
    const newW = Math.max(1, Math.min(256, currentMap.width + addLeft + addRight));
    const newH = Math.max(1, Math.min(256, currentMap.height + addTop + addBottom));
    resizeMap(newW, newH, addLeft, addTop);
    setAddLeft(0);
    setAddTop(0);
    setAddRight(0);
    setAddBottom(0);
  }, [currentMap, addLeft, addTop, addRight, addBottom, resizeMap]);

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

  const hasChange = addLeft !== 0 || addTop !== 0 || addRight !== 0 || addBottom !== 0;
  const newW = Math.max(1, Math.min(256, currentMap.width + addLeft + addRight));
  const newH = Math.max(1, Math.min(256, currentMap.height + addTop + addBottom));

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
            <span
              style={{ fontSize: 12, color: '#ddd', cursor: 'pointer', flex: 1 }}
              onDoubleClick={() => { setNameValue(mapName); setEditingName(true); }}
              title="더블클릭으로 이름 편집"
            >{mapName}</span>
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
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!currentMap.disableDashing}
            onChange={(e) => updateMapField('disableDashing', e.target.checked)} />
          <span>대시 금지</span>
        </label>
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
          <span
            className="sky-type-help"
            onClick={() => setShowSkyHelp(!showSkyHelp)}
          >
            ?
          </span>
        </div>
        {showSkyHelp && (
          <div className="sky-help-popup" onClick={() => setShowSkyHelp(false)}>
            <strong>Sky Sphere</strong>는 에디터 확장 기능입니다.<br />
            3D 모드에서 파노라마 이미지를 구체에 매핑하여 하늘 배경을 표현합니다.<br /><br />
            이 데이터는 별도의 확장 파일(<code>_ext.json</code>)에 저장되므로 RPG Maker MV 원본 에디터와 호환됩니다.
          </div>
        )}

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
        ExtBadge={ExtBadge}
      />

      {/* Post Processing Effects (블룸 포함) */}
      <PostProcessSection
        currentMap={currentMap}
        updateMapField={updateMapField}
        ExtBadge={ExtBadge}
      />

      {/* Fog of War */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">
          Fog of War <ExtBadge inline />
        </div>
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!(currentMap as any).fogOfWar?.enabled}
            onChange={(e) => {
              const prev = (currentMap as any).fogOfWar || { enabled: false, radius: 5, fogColor: '#000000', unexploredAlpha: 1.0, exploredAlpha: 0.6, fogHeight: 300, lineOfSight: true, absorption: 0.012, visibilityBrightness: 0.0, edgeAnimation: true, edgeAnimationSpeed: 1.0 };
              updateMapField('fogOfWar', { ...prev, enabled: e.target.checked });
            }} />
          <span>활성화</span>
        </label>
        {(currentMap as any).fogOfWar?.enabled && (() => {
          const fow = (currentMap as any).fogOfWar;
          return (
            <>
              {/* ── 공통 ── */}
              <div style={{ color: '#aaa', fontSize: 10, marginTop: 6, borderBottom: '1px solid #444', paddingBottom: 2 }}>공통</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>시야 반경</span>
                <input type="range" min={1} max={20} step={1}
                  value={fow.radius ?? 5}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, radius: Number(e.target.value) })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 24, textAlign: 'right' }}>
                  {fow.radius ?? 5}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>안개 색상</span>
                <input type="color" value={fow.fogColor ?? '#000000'}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, fogColor: e.target.value })}
                  style={{ width: 28, height: 20, padding: 0, border: '1px solid #555', background: 'none', cursor: 'pointer' }} />
                <span style={{ fontSize: 11, color: '#888' }}>{fow.fogColor ?? '#000000'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>미탐험</span>
                <input type="range" min={0} max={100} step={1}
                  value={Math.round((fow.unexploredAlpha ?? 1.0) * 100)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, unexploredAlpha: Number(e.target.value) / 100 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {Math.round((fow.unexploredAlpha ?? 1.0) * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>탐험완료</span>
                <input type="range" min={0} max={100} step={1}
                  value={Math.round((fow.exploredAlpha ?? 0.6) * 100)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, exploredAlpha: Number(e.target.value) / 100 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {Math.round((fow.exploredAlpha ?? 0.6) * 100)}%
                </span>
              </div>
              <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={fow.lineOfSight !== false}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, lineOfSight: e.target.checked })} />
                <span>시야 차단 (Line of Sight)</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>전환 속도</span>
                <input type="range" min={1} max={20} step={0.5}
                  value={fow.fogTransitionSpeed ?? 5.0}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, fogTransitionSpeed: Number(e.target.value) })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {fow.fogTransitionSpeed ?? 5.0}
                </span>
              </div>

              {/* ── 2D 셰이더 ── */}
              <div className="fow-group fow-group-2d">
                <div className="fow-group-title">2D 셰이더</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>촉수 길이</span>
                  <input type="range" min={0} max={40} step={1}
                    value={Math.round((fow.dissolveStrength ?? 2.0) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, dissolveStrength: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.dissolveStrength ?? 2.0).toFixed(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>페이드 범위</span>
                  <input type="range" min={5} max={100} step={5}
                    value={Math.round((fow.fadeSmoothness ?? 0.3) * 100)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, fadeSmoothness: Number(e.target.value) / 100 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.fadeSmoothness ?? 0.3).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>날카로움</span>
                  <input type="range" min={10} max={60} step={1}
                    value={Math.round((fow.tentacleSharpness ?? 3.0) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, tentacleSharpness: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.tentacleSharpness ?? 3.0).toFixed(1)}
                  </span>
                </div>
                <label className="map-inspector-checkbox" style={{ marginTop: 2 }}>
                  <input type="checkbox" checked={fow.edgeAnimation !== false}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, edgeAnimation: e.target.checked })} />
                  <span>경계 애니메이션</span>
                </label>
                {fow.edgeAnimation !== false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>애니 속도</span>
                    <input type="range" min={10} max={300} step={10}
                      value={Math.round((fow.edgeAnimationSpeed ?? 1.0) * 100)}
                      onChange={(e) => updateMapField('fogOfWar', { ...fow, edgeAnimationSpeed: Number(e.target.value) / 100 })}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                      {((fow.edgeAnimationSpeed ?? 1.0) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}

                {/* 촉수 타이밍 */}
                <div style={{ color: '#af6', fontSize: 10, marginTop: 8, borderTop: '1px solid #3a5a8a', paddingTop: 4 }}>촉수 타이밍</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>삭제 시간</span>
                  <input type="range" min={1} max={50} step={1}
                    value={Math.round((fow.tentacleFadeDuration ?? 1.0) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, tentacleFadeDuration: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.tentacleFadeDuration ?? 1.0).toFixed(1)}s
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>생성 시간</span>
                  <input type="range" min={1} max={50} step={1}
                    value={Math.round((fow.tentacleGrowDuration ?? 0.5) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, tentacleGrowDuration: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.tentacleGrowDuration ?? 0.5).toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* ── 3D Volume ── */}
              <div className="fow-group fow-group-3d">
                <div className="fow-group-title">3D Volume</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>안개 높이</span>
                  <input type="range" min={48} max={480} step={24}
                    value={fow.fogHeight ?? 200}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, fogHeight: Number(e.target.value) })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {fow.fogHeight ?? 200}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>흡수율</span>
                  <input type="range" min={1} max={50} step={1}
                    value={Math.round((fow.absorption ?? 0.018) * 1000)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, absorption: Number(e.target.value) / 1000 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 36, textAlign: 'right' }}>
                    {(fow.absorption ?? 0.018).toFixed(3)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>가시 밝기</span>
                  <input type="range" min={0} max={100} step={5}
                    value={Math.round((fow.visibilityBrightness ?? 0.0) * 100)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, visibilityBrightness: Number(e.target.value) / 100 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.visibilityBrightness ?? 0.0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>해상도 (1/N)</span>
                  <input type="range" min={1} max={8} step={1}
                    value={fow.volumeResolution ?? 4}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, volumeResolution: Number(e.target.value) })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {fow.volumeResolution ?? 4}
                  </span>
                </div>
                <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={fow.heightGradient !== false}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, heightGradient: e.target.checked })} />
                  <span>높이 색상 그라데이션</span>
                </label>
                {fow.heightGradient !== false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>상단 색상</span>
                    <input type="color" value={fow.fogColorTop ?? '#1a1a26'}
                      onChange={(e) => updateMapField('fogOfWar', { ...fow, fogColorTop: e.target.value })}
                      style={{ width: 28, height: 20, padding: 0, border: '1px solid #555', background: 'none', cursor: 'pointer' }} />
                    <span style={{ fontSize: 11, color: '#888' }}>{fow.fogColorTop ?? '#1a1a26'}</span>
                  </div>
                )}
                <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={fow.lineOfSight3D ?? false}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, lineOfSight3D: e.target.checked })} />
                  <span>3D 시야 차단</span>
                </label>
                {fow.lineOfSight3D && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>눈 높이</span>
                    <input type="range" min={5} max={50} step={1}
                      value={Math.round((fow.eyeHeight ?? 1.5) * 10)}
                      onChange={(e) => updateMapField('fogOfWar', { ...fow, eyeHeight: Number(e.target.value) / 10 })}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                      {(fow.eyeHeight ?? 1.5).toFixed(1)}
                    </span>
                  </div>
                )}
                <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={fow.godRay !== false}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, godRay: e.target.checked })} />
                  <span>God Ray</span>
                </label>
                {fow.godRay !== false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>광선 강도</span>
                    <input type="range" min={0} max={20} step={1}
                      value={Math.round((fow.godRayIntensity ?? 0.4) * 10)}
                      onChange={(e) => updateMapField('fogOfWar', { ...fow, godRayIntensity: Number(e.target.value) / 10 })}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                      {(fow.godRayIntensity ?? 0.4).toFixed(1)}
                    </span>
                  </div>
                )}
                <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={fow.vortex !== false}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, vortex: e.target.checked })} />
                  <span>소용돌이</span>
                </label>
                {fow.vortex !== false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>소용돌이 속도</span>
                    <input type="range" min={0} max={50} step={1}
                      value={Math.round((fow.vortexSpeed ?? 1.0) * 10)}
                      onChange={(e) => updateMapField('fogOfWar', { ...fow, vortexSpeed: Number(e.target.value) / 10 })}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                      {(fow.vortexSpeed ?? 1.0).toFixed(1)}
                    </span>
                  </div>
                )}
                <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={fow.lightScattering !== false}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, lightScattering: e.target.checked })} />
                  <span>광산란</span>
                </label>
                {fow.lightScattering !== false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>산란 강도</span>
                    <input type="range" min={0} max={30} step={1}
                      value={Math.round((fow.lightScatterIntensity ?? 1.0) * 10)}
                      onChange={(e) => updateMapField('fogOfWar', { ...fow, lightScatterIntensity: Number(e.target.value) / 10 })}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                      {(fow.lightScatterIntensity ?? 1.0).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

            </>
          );
        })()}
      </div>

      {/* Map Size Adjust */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">맵 크기 조절</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">크기</span>
          <span style={{ fontSize: 12, color: '#ddd' }}>{currentMap.width} x {currentMap.height}</span>
        </div>

        <div className="map-resize-grid">
          <div className="map-resize-row">
            <div className="map-resize-cell" />
            <div className="map-resize-cell center">
              <label className="map-resize-label">위</label>
              <input type="number" className="map-resize-input" value={addTop}
                onChange={(e) => setAddTop(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }} />
            </div>
            <div className="map-resize-cell" />
          </div>
          <div className="map-resize-row">
            <div className="map-resize-cell center">
              <label className="map-resize-label">좌</label>
              <input type="number" className="map-resize-input" value={addLeft}
                onChange={(e) => setAddLeft(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }} />
            </div>
            <div className="map-resize-cell center map-resize-center">
              {hasChange ? (
                <span className="map-resize-preview">{newW} x {newH}</span>
              ) : (
                <span className="map-resize-current">{currentMap.width} x {currentMap.height}</span>
              )}
            </div>
            <div className="map-resize-cell center">
              <label className="map-resize-label">우</label>
              <input type="number" className="map-resize-input" value={addRight}
                onChange={(e) => setAddRight(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }} />
            </div>
          </div>
          <div className="map-resize-row">
            <div className="map-resize-cell" />
            <div className="map-resize-cell center">
              <label className="map-resize-label">아래</label>
              <input type="number" className="map-resize-input" value={addBottom}
                onChange={(e) => setAddBottom(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }} />
            </div>
            <div className="map-resize-cell" />
          </div>
        </div>

        {hasChange && (
          <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
            <button className="map-inspector-apply-btn" onClick={handleApplyResize}>
              적용 ({currentMap.width}x{currentMap.height} → {newW}x{newH})
            </button>
            <button className="map-inspector-cancel-btn"
              onClick={() => { setAddLeft(0); setAddTop(0); setAddRight(0); setAddBottom(0); }}>
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
