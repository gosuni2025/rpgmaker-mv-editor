import React, { useMemo } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './CameraZoneListPanel.css';

function computeContentBounds(map: { width: number; height: number; data: number[] }) {
  const { width, height, data } = map;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let z = 0; z < 3; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (z * height + y) * width + x;
        if (data[idx] !== 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export default function CameraZoneListPanel() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);
  const selectedCameraZoneIds = useEditorStore((s) => s.selectedCameraZoneIds);
  const setSelectedCameraZoneId = useEditorStore((s) => s.setSelectedCameraZoneId);
  const setSelectedCameraZoneIds = useEditorStore((s) => s.setSelectedCameraZoneIds);
  const addCameraZone = useEditorStore((s) => s.addCameraZone);
  const updateCameraZone = useEditorStore((s) => s.updateCameraZone);
  const deleteCameraZone = useEditorStore((s) => s.deleteCameraZone);
  const deleteCameraZones = useEditorStore((s) => s.deleteCameraZones);

  const zones = currentMap?.cameraZones;
  const selectedZone = selectedCameraZoneId != null && zones
    ? zones.find((z) => z.id === selectedCameraZoneId)
    : null;

  const mapWidth = currentMap?.width ?? 0;
  const mapHeight = currentMap?.height ?? 0;

  const contentBounds = useMemo(() => {
    if (!currentMap?.data || !currentMap.width || !currentMap.height) return null;
    return computeContentBounds(currentMap as { width: number; height: number; data: number[] });
  }, [currentMap?.data, currentMap?.width, currentMap?.height]);

  const applyBounds = (bounds: { x: number; y: number; width: number; height: number }) => {
    if (selectedZone) {
      updateCameraZone(selectedZone.id, bounds);
    } else {
      addCameraZone(bounds.x, bounds.y, bounds.width, bounds.height);
    }
  };

  const handleItemClick = (zoneId: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Shift+click: toggle selection
      if (selectedCameraZoneIds.includes(zoneId)) {
        const newIds = selectedCameraZoneIds.filter(id => id !== zoneId);
        setSelectedCameraZoneIds(newIds);
        setSelectedCameraZoneId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
      } else {
        const newIds = [...selectedCameraZoneIds, zoneId];
        setSelectedCameraZoneIds(newIds);
        setSelectedCameraZoneId(zoneId);
      }
    } else {
      // Normal click: toggle single or select
      if (selectedCameraZoneIds.length === 1 && selectedCameraZoneIds[0] === zoneId) {
        setSelectedCameraZoneIds([]);
        setSelectedCameraZoneId(null);
      } else {
        setSelectedCameraZoneIds([zoneId]);
        setSelectedCameraZoneId(zoneId);
      }
    }
  };

  const handleDeleteSelected = () => {
    if (selectedCameraZoneIds.length > 1) {
      deleteCameraZones(selectedCameraZoneIds);
    } else if (selectedZone) {
      deleteCameraZone(selectedZone.id);
      setSelectedCameraZoneId(null);
    }
  };

  return (
    <div className="camera-zone-list-panel">
      {/* Map Info */}
      <div className="light-palette-section-title">맵 정보</div>
      <div className="camera-zone-map-info">
        <span>크기: {mapWidth} x {mapHeight}</span>
        <span>영역: {zones?.length ?? 0}개</span>
      </div>

      {/* Auto Settings */}
      <div className="light-palette-section-title" style={{ marginTop: 6 }}>자동 설정</div>
      <div className="camera-zone-auto-buttons">
        <button
          className="camera-zone-action-btn"
          onClick={() => contentBounds && applyBounds(contentBounds)}
          disabled={!contentBounds}
        >
          {selectedZone ? '콘텐츠에 맞춤' : '콘텐츠로 생성'}
        </button>
        <button
          className="camera-zone-action-btn"
          onClick={() => currentMap && applyBounds({ x: 0, y: 0, width: mapWidth, height: mapHeight })}
        >
          {selectedZone ? '맵 전체에 맞춤' : '맵 전체로 생성'}
        </button>
      </div>

      {/* Zone List */}
      <div className="light-palette-section-title" style={{ marginTop: 6 }}>
        카메라 영역 목록
        {selectedCameraZoneIds.length > 0 && (
          <span
            style={{ float: 'right', cursor: 'pointer', color: '#8cf', fontWeight: 'normal', fontSize: 10 }}
            onClick={() => { setSelectedCameraZoneIds([]); setSelectedCameraZoneId(null); }}
          >
            선택 해제
          </span>
        )}
      </div>
      <div className="camera-zone-list">
        {zones && zones.length > 0 ? (
          zones.map((z) => (
            <div
              key={z.id}
              className={`camera-zone-list-item${selectedCameraZoneIds.includes(z.id) ? ' selected' : ''}${!z.enabled ? ' disabled' : ''}`}
              onClick={(e) => handleItemClick(z.id, e)}
            >
              <span className="camera-zone-list-item-name">
                #{z.id} {z.name}
              </span>
              <span className="camera-zone-list-item-size">
                {z.width}x{z.height}
              </span>
            </div>
          ))
        ) : (
          <div className="camera-zone-list-empty">
            맵에서 드래그하여 카메라 영역을 생성하세요
          </div>
        )}
      </div>

      {/* Selected zone quick actions */}
      {selectedCameraZoneIds.length > 0 && (
        <div className="camera-zone-list-actions">
          <button
            className="camera-zone-action-btn delete"
            onClick={handleDeleteSelected}
          >
            {selectedCameraZoneIds.length > 1 ? `선택 영역 ${selectedCameraZoneIds.length}개 삭제` : '선택 영역 삭제'}
          </button>
        </div>
      )}
    </div>
  );
}
