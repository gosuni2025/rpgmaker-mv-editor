import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './InspectorPanel.css';

export default function MapInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const maps = useEditorStore((s) => s.maps);
  const resizeMap = useEditorStore((s) => s.resizeMap);

  const mapInfo = currentMapId != null ? maps.find(m => m && m.id === currentMapId) : null;
  const mapName = mapInfo?.name ?? '';

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
          <span style={{ fontSize: 12, color: '#ddd' }}>{mapName}</span>
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">ID</span>
          <span style={{ fontSize: 12, color: '#ddd' }}>{currentMapId}</span>
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">타일셋</span>
          <span style={{ fontSize: 12, color: '#ddd' }}>{currentMap.tilesetId}</span>
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">크기</span>
          <span style={{ fontSize: 12, color: '#ddd' }}>{currentMap.width} x {currentMap.height}</span>
        </div>
      </div>

      {/* Map Size Adjust */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">맵 크기 조절</div>

        {/* Visual grid: top / left-center-right / bottom */}
        <div className="map-resize-grid">
          {/* Top row */}
          <div className="map-resize-row">
            <div className="map-resize-cell" />
            <div className="map-resize-cell center">
              <label className="map-resize-label">위</label>
              <input
                type="number"
                className="map-resize-input"
                value={addTop}
                onChange={(e) => setAddTop(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }}
              />
            </div>
            <div className="map-resize-cell" />
          </div>

          {/* Middle row */}
          <div className="map-resize-row">
            <div className="map-resize-cell center">
              <label className="map-resize-label">좌</label>
              <input
                type="number"
                className="map-resize-input"
                value={addLeft}
                onChange={(e) => setAddLeft(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }}
              />
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
              <input
                type="number"
                className="map-resize-input"
                value={addRight}
                onChange={(e) => setAddRight(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }}
              />
            </div>
          </div>

          {/* Bottom row */}
          <div className="map-resize-row">
            <div className="map-resize-cell" />
            <div className="map-resize-cell center">
              <label className="map-resize-label">아래</label>
              <input
                type="number"
                className="map-resize-input"
                value={addBottom}
                onChange={(e) => setAddBottom(Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }}
              />
            </div>
            <div className="map-resize-cell" />
          </div>
        </div>

        {hasChange && (
          <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
            <button className="map-inspector-apply-btn" onClick={handleApplyResize}>
              적용 ({currentMap.width}x{currentMap.height} → {newW}x{newH})
            </button>
            <button
              className="map-inspector-cancel-btn"
              onClick={() => { setAddLeft(0); setAddTop(0); setAddRight(0); setAddBottom(0); }}
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
