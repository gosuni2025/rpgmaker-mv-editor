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

  // Local width/height for editing
  const [editWidth, setEditWidth] = useState(currentMap?.width ?? 17);
  const [editHeight, setEditHeight] = useState(currentMap?.height ?? 13);

  // Sync when map changes
  useEffect(() => {
    if (currentMap) {
      setEditWidth(currentMap.width);
      setEditHeight(currentMap.height);
    }
  }, [currentMap?.width, currentMap?.height, currentMapId]);

  const handleApplyResize = useCallback(() => {
    if (!currentMap) return;
    const newW = Math.max(1, Math.min(256, editWidth));
    const newH = Math.max(1, Math.min(256, editHeight));
    if (newW === currentMap.width && newH === currentMap.height) return;
    resizeMap(newW, newH, 0, 0);
  }, [currentMap, editWidth, editHeight, resizeMap]);

  if (!currentMap) {
    return (
      <div className="light-inspector">
        <div style={{ color: '#666', fontSize: 12, padding: 8 }}>맵을 선택하세요</div>
      </div>
    );
  }

  const sizeChanged = editWidth !== currentMap.width || editHeight !== currentMap.height;

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
      </div>

      {/* Map Size */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">맵 크기</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">너비</span>
          <input
            type="number"
            className="light-inspector-input"
            style={{ width: 60 }}
            min={1}
            max={256}
            value={editWidth}
            onChange={(e) => setEditWidth(Math.max(1, Math.min(256, Number(e.target.value) || 1)))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }}
          />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">높이</span>
          <input
            type="number"
            className="light-inspector-input"
            style={{ width: 60 }}
            min={1}
            max={256}
            value={editHeight}
            onChange={(e) => setEditHeight(Math.max(1, Math.min(256, Number(e.target.value) || 1)))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyResize(); }}
          />
        </div>
        {sizeChanged && (
          <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
            <button
              className="map-inspector-apply-btn"
              onClick={handleApplyResize}
            >
              적용 ({currentMap.width}x{currentMap.height} → {editWidth}x{editHeight})
            </button>
            <button
              className="map-inspector-cancel-btn"
              onClick={() => {
                setEditWidth(currentMap.width);
                setEditHeight(currentMap.height);
              }}
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
