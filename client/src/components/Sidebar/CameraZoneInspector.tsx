import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import './InspectorPanel.css';

function HelpButton({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <button
        style={{
          width: 16, height: 16, borderRadius: '50%', border: '1px solid #666',
          background: '#383838', color: '#aaa', fontSize: 10, lineHeight: '14px',
          padding: 0, cursor: 'pointer', verticalAlign: 'middle',
        }}
        onClick={() => setShow(!show)}
        onBlur={() => setShow(false)}
        title={text}
      >?</button>
      {show && (
        <div style={{
          position: 'absolute', left: 20, top: -4, zIndex: 100,
          background: '#333', border: '1px solid #555', borderRadius: 4,
          padding: '6px 10px', fontSize: 11, color: '#ccc', whiteSpace: 'pre-line',
          minWidth: 180, maxWidth: 260, boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

export default function CameraZoneInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);
  const updateCameraZone = useEditorStore((s) => s.updateCameraZone);
  const deleteCameraZone = useEditorStore((s) => s.deleteCameraZone);
  const setSelectedCameraZoneId = useEditorStore((s) => s.setSelectedCameraZoneId);

  const zones = currentMap?.cameraZones;
  const selectedZone = selectedCameraZoneId != null && zones
    ? zones.find((z) => z.id === selectedCameraZoneId)
    : null;

  const mapWidth = currentMap?.width ?? 0;
  const mapHeight = currentMap?.height ?? 0;

  // 카메라존 최소 크기 = 화면 타일 수 (816/48=17, 624/48=13)
  const minZoneWidth = Math.ceil(816 / 48);  // 17
  const minZoneHeight = Math.ceil(624 / 48); // 13

  if (!selectedZone) {
    return (
      <div className="light-inspector">
        <div className="light-inspector-section">
          <div style={{ color: '#888', fontSize: 12, padding: 8 }}>
            왼쪽 목록에서 카메라 영역을 선택하세요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="light-inspector">
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
              <DragLabel label="X" value={selectedZone.x} step={1} min={-999} max={mapWidth + 999}
                onChange={(v) => updateCameraZone(selectedZone.id, { x: Math.round(v) })} />
              <input type="number" className="light-inspector-input"
                value={selectedZone.x}
                onChange={(e) => updateCameraZone(selectedZone.id, { x: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Y" value={selectedZone.y} step={1} min={-999} max={mapHeight + 999}
                onChange={(v) => updateCameraZone(selectedZone.id, { y: Math.round(v) })} />
              <input type="number" className="light-inspector-input"
                value={selectedZone.y}
                onChange={(e) => updateCameraZone(selectedZone.id, { y: parseInt(e.target.value) || 0 })} />
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
              <DragLabel label="W" value={selectedZone.width} step={1} min={minZoneWidth} max={mapWidth * 3}
                onChange={(v) => updateCameraZone(selectedZone.id, { width: Math.max(minZoneWidth, Math.round(v)) })} />
              <input type="number" className="light-inspector-input" min={minZoneWidth}
                value={selectedZone.width}
                onChange={(e) => updateCameraZone(selectedZone.id, { width: Math.max(minZoneWidth, parseInt(e.target.value) || minZoneWidth) })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="H" value={selectedZone.height} step={1} min={minZoneHeight} max={mapHeight * 3}
                onChange={(v) => updateCameraZone(selectedZone.id, { height: Math.max(minZoneHeight, Math.round(v)) })} />
              <input type="number" className="light-inspector-input" min={minZoneHeight}
                value={selectedZone.height}
                onChange={(e) => updateCameraZone(selectedZone.id, { height: Math.max(minZoneHeight, parseInt(e.target.value) || minZoneHeight) })} />
            </div>
            <div className="light-inspector-row" style={{ marginTop: 2 }}>
              <span className="light-inspector-label" style={{ color: '#777', fontSize: 10 }}>최소 크기</span>
              <span style={{ color: '#777', fontSize: 10 }}>
                {minZoneWidth} x {minZoneHeight} (화면 크기 이상이어야 카메라 경계가 동작)
              </span>
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
              <HelpButton text="카메라가 내려다보는 각도입니다.\n90°에 가까울수록 위에서 수직으로 내려다보고,\n작을수록 수평에 가깝게 비스듬히 봅니다.\n기본값: 60°" />
              <input type="range" className="light-inspector-slider" min={20} max={85} step={1}
                value={selectedZone.tilt}
                onChange={(e) => updateCameraZone(selectedZone.id, { tilt: parseInt(e.target.value) })} />
              <input type="number" className="light-inspector-input" min={20} max={85} step={1}
                style={{ width: 55 }}
                value={selectedZone.tilt}
                onChange={(e) => updateCameraZone(selectedZone.id, { tilt: parseInt(e.target.value) || 60 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Fov" value={selectedZone.fov ?? 60} step={1} min={30} max={120}
                onChange={(v) => updateCameraZone(selectedZone.id, { fov: Math.round(v) })} />
              <HelpButton text="카메라 시야각(Field of View)입니다.\n값이 클수록 화면에 더 넓은 영역이 보이며\n원근감이 강해집니다.\n값이 작으면 망원 효과로 납작해 보입니다.\n기본값: 60°" />
              <input type="range" className="light-inspector-slider" min={30} max={120} step={1}
                value={selectedZone.fov ?? 60}
                onChange={(e) => updateCameraZone(selectedZone.id, { fov: parseInt(e.target.value) })} />
              <input type="number" className="light-inspector-input" min={30} max={120} step={1}
                style={{ width: 55 }}
                value={selectedZone.fov ?? 60}
                onChange={(e) => updateCameraZone(selectedZone.id, { fov: parseInt(e.target.value) || 60 })} />
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

          {/* DoF Settings */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">DoF (피사계 심도)</div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">DoF 활성화</span>
              <input
                type="checkbox"
                checked={selectedZone.dofEnabled ?? false}
                onChange={(e) => updateCameraZone(selectedZone.id, { dofEnabled: e.target.checked })}
              />
            </div>
            {selectedZone.dofEnabled && (
              <>
                <div className="light-inspector-row">
                  <DragLabel label="Focus Y" value={selectedZone.dofFocusY ?? 0.55} step={0.01} min={0} max={1}
                    onChange={(v) => updateCameraZone(selectedZone.id, { dofFocusY: Math.round(v * 100) / 100 })} />
                  <input type="range" className="light-inspector-slider" min={0} max={1} step={0.01}
                    value={selectedZone.dofFocusY ?? 0.55}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofFocusY: parseFloat(e.target.value) })} />
                  <input type="number" className="light-inspector-input" min={0} max={1} step={0.01}
                    style={{ width: 55 }}
                    value={selectedZone.dofFocusY ?? 0.55}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofFocusY: parseFloat(e.target.value) || 0.55 })} />
                </div>
                <div className="light-inspector-row">
                  <DragLabel label="Range" value={selectedZone.dofFocusRange ?? 0.1} step={0.01} min={0} max={0.5}
                    onChange={(v) => updateCameraZone(selectedZone.id, { dofFocusRange: Math.round(v * 100) / 100 })} />
                  <input type="range" className="light-inspector-slider" min={0} max={0.5} step={0.01}
                    value={selectedZone.dofFocusRange ?? 0.1}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofFocusRange: parseFloat(e.target.value) })} />
                  <input type="number" className="light-inspector-input" min={0} max={0.5} step={0.01}
                    style={{ width: 55 }}
                    value={selectedZone.dofFocusRange ?? 0.1}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofFocusRange: parseFloat(e.target.value) || 0.1 })} />
                </div>
                <div className="light-inspector-row">
                  <DragLabel label="Max Blur" value={selectedZone.dofMaxBlur ?? 0.05} step={0.005} min={0} max={0.2}
                    onChange={(v) => updateCameraZone(selectedZone.id, { dofMaxBlur: Math.round(v * 1000) / 1000 })} />
                  <input type="range" className="light-inspector-slider" min={0} max={0.2} step={0.005}
                    value={selectedZone.dofMaxBlur ?? 0.05}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofMaxBlur: parseFloat(e.target.value) })} />
                  <input type="number" className="light-inspector-input" min={0} max={0.2} step={0.005}
                    style={{ width: 55 }}
                    value={selectedZone.dofMaxBlur ?? 0.05}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofMaxBlur: parseFloat(e.target.value) || 0.05 })} />
                </div>
                <div className="light-inspector-row">
                  <DragLabel label="Power" value={selectedZone.dofBlurPower ?? 1.5} step={0.1} min={0.5} max={5}
                    onChange={(v) => updateCameraZone(selectedZone.id, { dofBlurPower: Math.round(v * 10) / 10 })} />
                  <input type="range" className="light-inspector-slider" min={0.5} max={5} step={0.1}
                    value={selectedZone.dofBlurPower ?? 1.5}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofBlurPower: parseFloat(e.target.value) })} />
                  <input type="number" className="light-inspector-input" min={0.5} max={5} step={0.1}
                    style={{ width: 55 }}
                    value={selectedZone.dofBlurPower ?? 1.5}
                    onChange={(e) => updateCameraZone(selectedZone.id, { dofBlurPower: parseFloat(e.target.value) || 1.5 })} />
                </div>
              </>
            )}
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
