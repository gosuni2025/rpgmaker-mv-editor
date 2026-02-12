import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import ImagePicker from '../common/ImagePicker';
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
        <div className="light-inspector-title">맵 정보</div>
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
          <span className="light-inspector-label">표시 이름</span>
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
        <div className="light-inspector-title">타일셋</div>
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
        <div className="light-inspector-title">맵 설정</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">스크롤</span>
          <select
            className="map-inspector-select"
            value={currentMap.scrollType ?? 0}
            onChange={(e) => updateMapField('scrollType', Number(e.target.value))}
          >
            <option value={0}>스크롤 없음</option>
            <option value={1}>좌우 루프</option>
            <option value={2}>상하 루프</option>
            <option value={3}>양방향 루프</option>
          </select>
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">전투 빈도</span>
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

      {/* BGM / BGS */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">자동 재생</div>
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!currentMap.autoplayBgm}
            onChange={(e) => updateMapField('autoplayBgm', e.target.checked)} />
          <span>BGM</span>
        </label>
        {currentMap.autoplayBgm && (
          <div className="light-inspector-row" style={{ marginLeft: 16 }}>
            <input type="text" className="light-inspector-input" style={{ flex: 1 }}
              value={currentMap.bgm?.name || ''} placeholder="BGM 파일"
              onChange={(e) => updateNestedField('bgm', 'name', e.target.value)} />
          </div>
        )}
        <label className="map-inspector-checkbox">
          <input type="checkbox" checked={!!currentMap.autoplayBgs}
            onChange={(e) => updateMapField('autoplayBgs', e.target.checked)} />
          <span>BGS</span>
        </label>
        {currentMap.autoplayBgs && (
          <div className="light-inspector-row" style={{ marginLeft: 16 }}>
            <input type="text" className="light-inspector-input" style={{ flex: 1 }}
              value={currentMap.bgs?.name || ''} placeholder="BGS 파일"
              onChange={(e) => updateNestedField('bgs', 'name', e.target.value)} />
          </div>
        )}
      </div>

      {/* Parallax */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">원경</div>
        <div style={{ marginBottom: 4 }}>
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
                <span>X 루프</span>
              </label>
              <label className="map-inspector-checkbox">
                <input type="checkbox" checked={!!currentMap.parallaxLoopY}
                  onChange={(e) => updateMapField('parallaxLoopY', e.target.checked)} />
                <span>Y 루프</span>
              </label>
            </div>
            <label className="map-inspector-checkbox">
              <input type="checkbox" checked={currentMap.parallaxShow ?? false}
                onChange={(e) => updateMapField('parallaxShow', e.target.checked)} />
              <span>에디터 표시</span>
            </label>
          </>
        )}
      </div>

      {/* Note */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">노트</div>
        <textarea
          className="map-inspector-textarea"
          value={currentMap.note || ''}
          onChange={(e) => updateMapField('note', e.target.value)}
          rows={3}
        />
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
