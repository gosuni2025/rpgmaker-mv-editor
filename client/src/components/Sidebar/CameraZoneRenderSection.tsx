import React from 'react';
import DragLabel from '../common/DragLabel';
import HelpButton from '../common/HelpButton';

interface CameraZoneRenderSectionProps {
  zone: {
    id: number;
    dofEnabled?: boolean;
    dofFocusY?: number;
    dofFocusRange?: number;
    dofMaxBlur?: number;
    dofBlurPower?: number;
    ambientIntensity?: number;
    ambientColor?: string;
  };
  updateCameraZone: (id: number, data: Record<string, unknown>, isDrag?: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function CameraZoneRenderSection({ zone, updateCameraZone, onDragStart, onDragEnd }: CameraZoneRenderSectionProps) {
  const id = zone.id;

  return (
    <>
      {/* DoF Settings */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">DoF (피사계 심도)</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">DoF 활성화</span>
          <input
            type="checkbox"
            checked={zone.dofEnabled ?? false}
            onChange={(e) => updateCameraZone(id, { dofEnabled: e.target.checked })}
          />
        </div>
        {zone.dofEnabled && (
          <>
            <div className="light-inspector-row">
              <DragLabel label="Focus Y" value={zone.dofFocusY ?? 0.55} step={0.01} min={0} max={1}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
                onChange={(v) => updateCameraZone(id, { dofFocusY: Math.round(v * 100) / 100 }, true)} />
              <input type="range" className="light-inspector-slider" min={0} max={1} step={0.01}
                value={zone.dofFocusY ?? 0.55}
                onChange={(e) => updateCameraZone(id, { dofFocusY: parseFloat(e.target.value) })} />
              <input type="number" className="light-inspector-input" step={0.01}
                style={{ width: 55 }}
                value={zone.dofFocusY ?? 0.55}
                onChange={(e) => updateCameraZone(id, { dofFocusY: parseFloat(e.target.value) || 0.55 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Range" value={zone.dofFocusRange ?? 0.1} step={0.01} min={0} max={1}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
                onChange={(v) => updateCameraZone(id, { dofFocusRange: Math.round(v * 100) / 100 }, true)} />
              <input type="range" className="light-inspector-slider" min={0} max={1} step={0.01}
                value={zone.dofFocusRange ?? 0.1}
                onChange={(e) => updateCameraZone(id, { dofFocusRange: parseFloat(e.target.value) })} />
              <input type="number" className="light-inspector-input" step={0.01}
                style={{ width: 55 }}
                value={zone.dofFocusRange ?? 0.1}
                onChange={(e) => updateCameraZone(id, { dofFocusRange: parseFloat(e.target.value) || 0.1 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Max Blur" value={zone.dofMaxBlur ?? 0.05} step={0.005} min={0} max={0.5}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
                onChange={(v) => updateCameraZone(id, { dofMaxBlur: Math.round(v * 1000) / 1000 }, true)} />
              <input type="range" className="light-inspector-slider" min={0} max={0.5} step={0.005}
                value={zone.dofMaxBlur ?? 0.05}
                onChange={(e) => updateCameraZone(id, { dofMaxBlur: parseFloat(e.target.value) })} />
              <input type="number" className="light-inspector-input" step={0.005}
                style={{ width: 55 }}
                value={zone.dofMaxBlur ?? 0.05}
                onChange={(e) => updateCameraZone(id, { dofMaxBlur: parseFloat(e.target.value) || 0.05 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Power" value={zone.dofBlurPower ?? 1.5} step={0.1} min={0.1} max={10}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
                onChange={(v) => updateCameraZone(id, { dofBlurPower: Math.round(v * 10) / 10 }, true)} />
              <input type="range" className="light-inspector-slider" min={0.1} max={10} step={0.1}
                value={zone.dofBlurPower ?? 1.5}
                onChange={(e) => updateCameraZone(id, { dofBlurPower: parseFloat(e.target.value) })} />
              <input type="number" className="light-inspector-input" step={0.1}
                style={{ width: 55 }}
                value={zone.dofBlurPower ?? 1.5}
                onChange={(e) => updateCameraZone(id, { dofBlurPower: parseFloat(e.target.value) || 1.5 })} />
            </div>
          </>
        )}
      </div>

      {/* Ambient Light Override */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">
          환경광
          <HelpButton text={"이 카메라 존에 진입할 때 적용할 환경광입니다.\n활성화하면 글로벌 환경광 대신 이 값을 사용합니다.\n존 간 이동 시 부드럽게 보간됩니다.\n\n카메라 존 바깥의 환경광은\n조명 편집 모드에서 설정하세요."} />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">환경광 설정</span>
          <input
            type="checkbox"
            checked={zone.ambientIntensity != null}
            onChange={(e) => {
              if (e.target.checked) {
                updateCameraZone(id, { ambientIntensity: 0.3, ambientColor: '#667788' });
              } else {
                updateCameraZone(id, { ambientIntensity: undefined, ambientColor: undefined });
              }
            }}
          />
        </div>
        {zone.ambientIntensity != null && (
          <>
            <div className="light-inspector-row">
              <span className="light-inspector-label">색상</span>
              <input
                type="color"
                className="light-inspector-color"
                value={zone.ambientColor ?? '#667788'}
                onChange={(e) => updateCameraZone(id, { ambientColor: e.target.value })}
              />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="강도" value={zone.ambientIntensity} step={0.05} min={0} max={10}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
                onChange={(v) => updateCameraZone(id, { ambientIntensity: Math.round(v * 100) / 100 }, true)} />
              <input type="range" className="light-inspector-slider" min={0} max={10} step={0.05}
                value={zone.ambientIntensity}
                onChange={(e) => updateCameraZone(id, { ambientIntensity: parseFloat(e.target.value) })} />
              <input type="number" className="light-inspector-input" step={0.05}
                style={{ width: 55 }}
                value={zone.ambientIntensity}
                onChange={(e) => updateCameraZone(id, { ambientIntensity: parseFloat(e.target.value) || 0 })} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
