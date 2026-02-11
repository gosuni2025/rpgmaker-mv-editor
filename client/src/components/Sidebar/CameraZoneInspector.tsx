import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';

export default function CameraZoneInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);
  const updateCameraZone = useEditorStore((s) => s.updateCameraZone);
  const deleteCameraZone = useEditorStore((s) => s.deleteCameraZone);
  const setSelectedCameraZoneId = useEditorStore((s) => s.setSelectedCameraZoneId);
  const addCameraZone = useEditorStore((s) => s.addCameraZone);

  const zones = currentMap?.cameraZones;
  const selectedZone = selectedCameraZoneId != null && zones
    ? zones.find((z) => z.id === selectedCameraZoneId)
    : null;

  const mapWidth = currentMap?.width ?? 0;
  const mapHeight = currentMap?.height ?? 0;

  const handleFitToMap = () => {
    if (!currentMap) return;
    if (selectedZone) {
      updateCameraZone(selectedZone.id, {
        x: 0, y: 0, width: mapWidth, height: mapHeight,
      });
    } else {
      addCameraZone(0, 0, mapWidth, mapHeight);
    }
  };

  return (
    <div className="light-inspector">
      {/* Map Info */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">맵 정보</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">맵 크기</span>
          <span style={{ color: '#ddd', fontSize: 12 }}>{mapWidth} x {mapHeight}</span>
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">픽셀</span>
          <span style={{ color: '#999', fontSize: 11 }}>{mapWidth * 48} x {mapHeight * 48}</span>
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">영역 수</span>
          <span style={{ color: '#ddd', fontSize: 12 }}>{zones?.length ?? 0}</span>
        </div>
      </div>

      {/* Auto Settings */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">자동 설정</div>
        <button className="camera-zone-action-btn" onClick={handleFitToMap}>
          {selectedZone ? '선택 영역을 맵 전체에 맞춤' : '맵 전체 영역 생성'}
        </button>
      </div>

      {/* Zone List */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">
          카메라 영역 목록
          {selectedZone && (
            <span
              style={{ float: 'right', cursor: 'pointer', color: '#8cf', fontWeight: 'normal', fontSize: 10 }}
              onClick={() => setSelectedCameraZoneId(null)}
            >
              선택 해제
            </span>
          )}
        </div>
        {zones && zones.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {zones.map((z) => (
              <div
                key={z.id}
                className="light-inspector-row"
                style={{
                  cursor: 'pointer', padding: '4px 6px', borderRadius: 3,
                  background: z.id === selectedCameraZoneId ? '#2675bf' : '#3a3a3a',
                }}
                onClick={() => setSelectedCameraZoneId(z.id === selectedCameraZoneId ? null : z.id)}
              >
                <span style={{
                  color: z.id === selectedCameraZoneId ? '#fff' : z.enabled ? '#ccc' : '#666',
                  fontSize: 12, flex: 1,
                }}>
                  #{z.id} {z.name}
                </span>
                <span style={{ color: z.id === selectedCameraZoneId ? '#cde' : '#888', fontSize: 11 }}>
                  {z.width}x{z.height}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#666', fontSize: 12, padding: 8 }}>
            맵에서 드래그하여 카메라 영역을 생성하세요
          </div>
        )}
      </div>

      {/* Selected Zone Detail */}
      {selectedZone && (
        <>
          {/* Name & Enabled */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">기본 정보</div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">이름</span>
              <input
                type="text"
                className="light-inspector-input"
                style={{ width: '100%' }}
                value={selectedZone.name}
                onChange={(e) => updateCameraZone(selectedZone.id, { name: e.target.value })}
              />
            </div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">활성화</span>
              <input
                type="checkbox"
                checked={selectedZone.enabled}
                onChange={(e) => updateCameraZone(selectedZone.id, { enabled: e.target.checked })}
              />
            </div>
          </div>

          {/* Position */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">위치</div>
            <div className="light-inspector-row">
              <DragLabel label="X" value={selectedZone.x} step={1} min={0} max={mapWidth - 1}
                onChange={(v) => updateCameraZone(selectedZone.id, { x: Math.max(0, Math.min(mapWidth - 1, Math.round(v))) })} />
              <input type="number" className="light-inspector-input" min={0} max={mapWidth - 1}
                value={selectedZone.x}
                onChange={(e) => updateCameraZone(selectedZone.id, { x: Math.max(0, Math.min(mapWidth - 1, parseInt(e.target.value) || 0)) })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Y" value={selectedZone.y} step={1} min={0} max={mapHeight - 1}
                onChange={(v) => updateCameraZone(selectedZone.id, { y: Math.max(0, Math.min(mapHeight - 1, Math.round(v))) })} />
              <input type="number" className="light-inspector-input" min={0} max={mapHeight - 1}
                value={selectedZone.y}
                onChange={(e) => updateCameraZone(selectedZone.id, { y: Math.max(0, Math.min(mapHeight - 1, parseInt(e.target.value) || 0)) })} />
            </div>
            <div className="light-inspector-row" style={{ marginTop: 2 }}>
              <span className="light-inspector-label" style={{ color: '#777', fontSize: 10 }}>끝 좌표</span>
              <span style={{ color: '#777', fontSize: 10 }}>
                ({selectedZone.x + selectedZone.width - 1}, {selectedZone.y + selectedZone.height - 1})
              </span>
            </div>
          </div>

          {/* Size */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">크기</div>
            <div className="light-inspector-row">
              <DragLabel label="W" value={selectedZone.width} step={1} min={1} max={mapWidth}
                onChange={(v) => updateCameraZone(selectedZone.id, { width: Math.max(1, Math.min(mapWidth, Math.round(v))) })} />
              <input type="number" className="light-inspector-input" min={1} max={mapWidth}
                value={selectedZone.width}
                onChange={(e) => updateCameraZone(selectedZone.id, { width: Math.max(1, Math.min(mapWidth, parseInt(e.target.value) || 1)) })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="H" value={selectedZone.height} step={1} min={1} max={mapHeight}
                onChange={(v) => updateCameraZone(selectedZone.id, { height: Math.max(1, Math.min(mapHeight, Math.round(v))) })} />
              <input type="number" className="light-inspector-input" min={1} max={mapHeight}
                value={selectedZone.height}
                onChange={(e) => updateCameraZone(selectedZone.id, { height: Math.max(1, Math.min(mapHeight, parseInt(e.target.value) || 1)) })} />
            </div>
            <div className="light-inspector-row" style={{ marginTop: 2 }}>
              <span className="light-inspector-label" style={{ color: '#777', fontSize: 10 }}>픽셀</span>
              <span style={{ color: '#777', fontSize: 10 }}>
                {selectedZone.width * 48} x {selectedZone.height * 48}
              </span>
            </div>
            <div className="light-inspector-row" style={{ marginTop: 2 }}>
              <span className="light-inspector-label" style={{ color: '#777', fontSize: 10 }}>맵 커버</span>
              <span style={{ color: '#777', fontSize: 10 }}>
                {mapWidth > 0 && mapHeight > 0
                  ? `${Math.round((selectedZone.width * selectedZone.height) / (mapWidth * mapHeight) * 100)}%`
                  : '-'}
              </span>
            </div>
          </div>

          {/* Camera Settings */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">카메라 설정</div>
            <div className="light-inspector-row">
              <DragLabel label="줌" value={selectedZone.zoom} step={0.05} min={0.5} max={3.0}
                onChange={(v) => updateCameraZone(selectedZone.id, { zoom: Math.round(v * 100) / 100 })} />
              <input type="range" className="light-inspector-slider" min={0.5} max={3.0} step={0.05}
                value={selectedZone.zoom}
                onChange={(e) => updateCameraZone(selectedZone.id, { zoom: parseFloat(e.target.value) })} />
              <input type="number" className="light-inspector-input" min={0.5} max={3.0} step={0.05}
                style={{ width: 55 }}
                value={selectedZone.zoom}
                onChange={(e) => updateCameraZone(selectedZone.id, { zoom: parseFloat(e.target.value) || 1.0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Tilt" value={selectedZone.tilt} step={1} min={20} max={85}
                onChange={(v) => updateCameraZone(selectedZone.id, { tilt: Math.round(v) })} />
              <input type="range" className="light-inspector-slider" min={20} max={85} step={1}
                value={selectedZone.tilt}
                onChange={(e) => updateCameraZone(selectedZone.id, { tilt: parseInt(e.target.value) })} />
              <input type="number" className="light-inspector-input" min={20} max={85} step={1}
                style={{ width: 55 }}
                value={selectedZone.tilt}
                onChange={(e) => updateCameraZone(selectedZone.id, { tilt: parseInt(e.target.value) || 60 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Yaw" value={selectedZone.yaw} step={1} min={-180} max={180}
                onChange={(v) => updateCameraZone(selectedZone.id, { yaw: Math.round(v) })} />
              <input type="range" className="light-inspector-slider" min={-180} max={180} step={1}
                value={selectedZone.yaw}
                onChange={(e) => updateCameraZone(selectedZone.id, { yaw: parseInt(e.target.value) })} />
              <input type="number" className="light-inspector-input" min={-180} max={180} step={1}
                style={{ width: 55 }}
                value={selectedZone.yaw}
                onChange={(e) => updateCameraZone(selectedZone.id, { yaw: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          {/* Transition */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">전환</div>
            <div className="light-inspector-row">
              <DragLabel label="속도" value={selectedZone.transitionSpeed} step={0.1} min={0.1} max={5.0}
                onChange={(v) => updateCameraZone(selectedZone.id, { transitionSpeed: Math.round(v * 10) / 10 })} />
              <input type="range" className="light-inspector-slider" min={0.1} max={5.0} step={0.1}
                value={selectedZone.transitionSpeed}
                onChange={(e) => updateCameraZone(selectedZone.id, { transitionSpeed: parseFloat(e.target.value) })} />
              <input type="number" className="light-inspector-input" min={0.1} max={5.0} step={0.1}
                style={{ width: 55 }}
                value={selectedZone.transitionSpeed}
                onChange={(e) => updateCameraZone(selectedZone.id, { transitionSpeed: parseFloat(e.target.value) || 1.0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="우선순위" value={selectedZone.priority} step={1} min={0} max={100}
                onChange={(v) => updateCameraZone(selectedZone.id, { priority: Math.round(v) })} />
              <input type="number" className="light-inspector-input" min={0} max={100} step={1}
                value={selectedZone.priority}
                onChange={(e) => updateCameraZone(selectedZone.id, { priority: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          {/* Delete */}
          <button
            className="light-inspector-delete"
            onClick={() => {
              deleteCameraZone(selectedZone.id);
              setSelectedCameraZoneId(null);
            }}
          >
            삭제
          </button>
        </>
      )}
    </div>
  );
}
