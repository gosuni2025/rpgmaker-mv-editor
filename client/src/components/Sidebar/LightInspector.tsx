import React, { useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import ExtBadge from '../common/ExtBadge';
import HelpButton from '../common/HelpButton';
import { DEFAULT_EDITOR_LIGHTS } from '../../types/rpgMakerMV';
import { DirectionalLightSection, SpotLightSection, PointLightSection } from './LightInspectorSections';
import './InspectorPanel.css';

export default function LightInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const updatePointLight = useEditorStore((s) => s.updatePointLight);
  const deletePointLight = useEditorStore((s) => s.deletePointLight);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const updateEditorLightsEnabled = useEditorStore((s) => s.updateEditorLightsEnabled);
  const updateAmbientLight = useEditorStore((s) => s.updateAmbientLight);
  const updateDirectionalLight = useEditorStore((s) => s.updateDirectionalLight);
  const updatePlayerLight = useEditorStore((s) => s.updatePlayerLight);
  const updateSpotLight = useEditorStore((s) => s.updateSpotLight);
  const updateShadowSettings = useEditorStore((s) => s.updateShadowSettings);
  const commitLightDragUndo = useEditorStore((s) => s.commitLightDragUndo);

  const dragSnapshotRef = useRef<any>(null);
  const onDragStart = useCallback(() => {
    const map = useEditorStore.getState().currentMap;
    dragSnapshotRef.current = map?.editorLights ? JSON.parse(JSON.stringify(map.editorLights)) : null;
  }, []);
  const onDragEnd = useCallback(() => {
    if (dragSnapshotRef.current) {
      commitLightDragUndo(dragSnapshotRef.current);
      dragSnapshotRef.current = null;
    }
  }, [commitLightDragUndo]);

  const editorLights = currentMap?.editorLights;
  if (!editorLights) return <div className="light-inspector"><div style={{ color: '#666', fontSize: 12, padding: 8 }}>조명 데이터 없음</div></div>;

  const selectedPoint = selectedLightType === 'point' && selectedLightId != null
    ? editorLights.points.find((p) => p.id === selectedLightId) : null;
  const playerLight = editorLights.playerLight ?? DEFAULT_EDITOR_LIGHTS.playerLight!;
  const spotLight = editorLights.spotLight ?? DEFAULT_EDITOR_LIGHTS.spotLight!;
  const shadow = editorLights.shadow ?? DEFAULT_EDITOR_LIGHTS.shadow!;

  return (
    <div className="light-inspector">
      {/* Lights enabled toggle */}
      <div className="light-inspector-section">
        <div className="light-inspector-row">
          <span className="light-inspector-label">조명 적용</span>
          <input type="checkbox" checked={editorLights.enabled !== false}
            onChange={(e) => updateEditorLightsEnabled(e.target.checked)} />
          <HelpButton text={"이 맵에 에디터 조명 시스템을 적용할지 결정합니다.\n맵 속성의 동일한 설정과 연동됩니다."} />
        </div>
      </div>

      {/* Ambient Light */}
      {selectedLightType === 'ambient' && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">
            환경광 <ExtBadge inline />
            <HelpButton text={"글로벌 환경광 설정입니다.\n맵 전체에 기본 적용되며,\n카메라 존에 환경광이 설정된 경우\n해당 존 내에서는 존의 값이 우선 적용됩니다."} />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">적용</span>
            <input type="checkbox" checked={editorLights.ambient.enabled !== false}
              onChange={(e) => updateAmbientLight({ enabled: e.target.checked })} />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">색상</span>
            <input type="color" className="light-inspector-color"
              value={editorLights.ambient.color}
              onChange={(e) => updateAmbientLight({ color: e.target.value })}
              disabled={editorLights.ambient.enabled === false} />
          </div>
          <div className="light-inspector-row">
            <DragLabel label="강도" value={editorLights.ambient.intensity} step={0.05} min={0} max={10}
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onChange={(v) => updateAmbientLight({ intensity: v }, true)} />
            <input type="range" className="light-inspector-slider" min={0} max={3} step={0.05}
              value={editorLights.ambient.intensity}
              onChange={(e) => updateAmbientLight({ intensity: parseFloat(e.target.value) })}
              disabled={editorLights.ambient.enabled === false} />
            <input type="number" className="light-inspector-input" step={0.05}
              value={editorLights.ambient.intensity}
              onChange={(e) => updateAmbientLight({ intensity: parseFloat(e.target.value) || 0 })}
              disabled={editorLights.ambient.enabled === false} />
          </div>
        </div>
      )}

      {/* Directional + Shadow */}
      {selectedLightType === 'directional' && (
        <DirectionalLightSection dir={editorLights.directional} shadow={shadow}
          updateDirectionalLight={updateDirectionalLight} updateShadowSettings={updateShadowSettings}
          onDragStart={onDragStart} onDragEnd={onDragEnd} />
      )}

      {/* Player Light */}
      {selectedLightType === 'playerLight' && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">플레이어 조명 <ExtBadge inline /></div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">적용</span>
            <input type="checkbox" checked={playerLight.enabled !== false}
              onChange={(e) => updatePlayerLight({ enabled: e.target.checked })} />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">색상</span>
            <input type="color" className="light-inspector-color" value={playerLight.color}
              onChange={(e) => updatePlayerLight({ color: e.target.value })}
              disabled={playerLight.enabled === false} />
          </div>
          {[
            { label: '강도', key: 'intensity', step: 0.1, min: 0, max: 10, fallback: 0 },
            { label: '거리', key: 'distance', step: 10, min: 50, max: 5000, fallback: 200 },
            { label: 'Z (높이)', key: 'z', step: 1, min: 0, max: 1000, fallback: 40 },
          ].map(({ label, key, step, min, max, fallback }) => (
            <div className="light-inspector-row" key={key}>
              <DragLabel label={label} value={playerLight[key]} step={step} min={min} max={max}
                onDragStart={onDragStart} onDragEnd={onDragEnd}
                onChange={(v) => updatePlayerLight({ [key]: key === 'distance' || key === 'z' ? Math.round(v) : v }, true)} />
              <input type="number" className="light-inspector-input" step={step}
                value={playerLight[key]}
                onChange={(e) => updatePlayerLight({ [key]: parseFloat(e.target.value) || fallback })}
                disabled={playerLight.enabled === false} />
            </div>
          ))}
        </div>
      )}

      {/* Spot Light */}
      {selectedLightType === 'spotLight' && (
        <SpotLightSection spotLight={spotLight} updateSpotLight={updateSpotLight}
          onDragStart={onDragStart} onDragEnd={onDragEnd} />
      )}

      {/* Point Light */}
      {selectedLightType === 'point' && (
        <PointLightSection selectedPoint={selectedPoint} updatePointLight={updatePointLight}
          deletePointLight={deletePointLight} setSelectedLightId={setSelectedLightId}
          onDragStart={onDragStart} onDragEnd={onDragEnd} />
      )}
    </div>
  );
}
