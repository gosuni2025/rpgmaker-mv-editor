import React from 'react';
import useEditorStore from '../../store/useEditorStore';

export default function LightInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const updatePointLight = useEditorStore((s) => s.updatePointLight);
  const deletePointLight = useEditorStore((s) => s.deletePointLight);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const updateAmbientLight = useEditorStore((s) => s.updateAmbientLight);
  const updateDirectionalLight = useEditorStore((s) => s.updateDirectionalLight);

  const editorLights = currentMap?.editorLights;
  if (!editorLights) return <div className="light-inspector"><div style={{ color: '#666', fontSize: 12, padding: 8 }}>조명 데이터 없음</div></div>;

  const selectedPoint = selectedLightType === 'point' && selectedLightId != null
    ? editorLights.points.find((p) => p.id === selectedLightId)
    : null;

  return (
    <div className="light-inspector">
      {/* Ambient Light - always visible */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">앰비언트 라이트</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">색상</span>
          <input
            type="color"
            className="light-inspector-color"
            value={editorLights.ambient.color}
            onChange={(e) => updateAmbientLight({ color: e.target.value })}
          />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">강도</span>
          <input
            type="range"
            className="light-inspector-slider"
            min={0} max={2} step={0.05}
            value={editorLights.ambient.intensity}
            onChange={(e) => updateAmbientLight({ intensity: parseFloat(e.target.value) })}
          />
          <input
            type="number"
            className="light-inspector-input"
            min={0} max={2} step={0.05}
            value={editorLights.ambient.intensity}
            onChange={(e) => updateAmbientLight({ intensity: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      {/* Directional Light - always visible */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">디렉셔널 라이트</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">색상</span>
          <input
            type="color"
            className="light-inspector-color"
            value={editorLights.directional.color}
            onChange={(e) => updateDirectionalLight({ color: e.target.value })}
          />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">강도</span>
          <input
            type="range"
            className="light-inspector-slider"
            min={0} max={2} step={0.05}
            value={editorLights.directional.intensity}
            onChange={(e) => updateDirectionalLight({ intensity: parseFloat(e.target.value) })}
          />
          <input
            type="number"
            className="light-inspector-input"
            min={0} max={2} step={0.05}
            value={editorLights.directional.intensity}
            onChange={(e) => updateDirectionalLight({ intensity: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">방향 X</span>
          <input
            type="range"
            className="light-inspector-slider"
            min={-5} max={5} step={0.1}
            value={editorLights.directional.direction[0]}
            onChange={(e) => {
              const d = [...editorLights.directional.direction] as [number, number, number];
              d[0] = parseFloat(e.target.value);
              updateDirectionalLight({ direction: d });
            }}
          />
          <input
            type="number"
            className="light-inspector-input"
            step={0.1}
            value={editorLights.directional.direction[0]}
            onChange={(e) => {
              const d = [...editorLights.directional.direction] as [number, number, number];
              d[0] = parseFloat(e.target.value) || 0;
              updateDirectionalLight({ direction: d });
            }}
          />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">방향 Y</span>
          <input
            type="range"
            className="light-inspector-slider"
            min={-5} max={5} step={0.1}
            value={editorLights.directional.direction[1]}
            onChange={(e) => {
              const d = [...editorLights.directional.direction] as [number, number, number];
              d[1] = parseFloat(e.target.value);
              updateDirectionalLight({ direction: d });
            }}
          />
          <input
            type="number"
            className="light-inspector-input"
            step={0.1}
            value={editorLights.directional.direction[1]}
            onChange={(e) => {
              const d = [...editorLights.directional.direction] as [number, number, number];
              d[1] = parseFloat(e.target.value) || 0;
              updateDirectionalLight({ direction: d });
            }}
          />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">방향 Z</span>
          <input
            type="range"
            className="light-inspector-slider"
            min={-5} max={5} step={0.1}
            value={editorLights.directional.direction[2]}
            onChange={(e) => {
              const d = [...editorLights.directional.direction] as [number, number, number];
              d[2] = parseFloat(e.target.value);
              updateDirectionalLight({ direction: d });
            }}
          />
          <input
            type="number"
            className="light-inspector-input"
            step={0.1}
            value={editorLights.directional.direction[2]}
            onChange={(e) => {
              const d = [...editorLights.directional.direction] as [number, number, number];
              d[2] = parseFloat(e.target.value) || 0;
              updateDirectionalLight({ direction: d });
            }}
          />
        </div>
      </div>

      {/* Selected Point Light */}
      {selectedPoint && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">포인트 라이트 #{selectedPoint.id}</div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">X</span>
            <input
              type="number"
              className="light-inspector-input"
              value={selectedPoint.x}
              onChange={(e) => updatePointLight(selectedPoint.id, { x: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">Y</span>
            <input
              type="number"
              className="light-inspector-input"
              value={selectedPoint.y}
              onChange={(e) => updatePointLight(selectedPoint.id, { y: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">Z (높이)</span>
            <input
              type="range"
              className="light-inspector-slider"
              min={0} max={200} step={1}
              value={selectedPoint.z}
              onChange={(e) => updatePointLight(selectedPoint.id, { z: parseFloat(e.target.value) })}
            />
            <input
              type="number"
              className="light-inspector-input"
              min={0} max={200} step={1}
              value={selectedPoint.z}
              onChange={(e) => updatePointLight(selectedPoint.id, { z: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">색상</span>
            <input
              type="color"
              className="light-inspector-color"
              value={selectedPoint.color}
              onChange={(e) => updatePointLight(selectedPoint.id, { color: e.target.value })}
            />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">강도</span>
            <input
              type="range"
              className="light-inspector-slider"
              min={0} max={5} step={0.1}
              value={selectedPoint.intensity}
              onChange={(e) => updatePointLight(selectedPoint.id, { intensity: parseFloat(e.target.value) })}
            />
            <input
              type="number"
              className="light-inspector-input"
              min={0} max={5} step={0.1}
              value={selectedPoint.intensity}
              onChange={(e) => updatePointLight(selectedPoint.id, { intensity: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">거리</span>
            <input
              type="range"
              className="light-inspector-slider"
              min={50} max={2000} step={10}
              value={selectedPoint.distance}
              onChange={(e) => updatePointLight(selectedPoint.id, { distance: parseFloat(e.target.value) })}
            />
            <input
              type="number"
              className="light-inspector-input"
              min={50} max={2000} step={10}
              value={selectedPoint.distance}
              onChange={(e) => updatePointLight(selectedPoint.id, { distance: parseFloat(e.target.value) || 150 })}
            />
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">감쇠</span>
            <select
              className="light-inspector-input"
              style={{ width: 'auto' }}
              value={selectedPoint.decay}
              onChange={(e) => updatePointLight(selectedPoint.id, { decay: parseInt(e.target.value) })}
            >
              <option value={0}>0 (선형)</option>
              <option value={1}>1 (물리)</option>
              <option value={2}>2 (강한 물리)</option>
            </select>
          </div>
          <button
            className="light-inspector-delete"
            onClick={() => {
              deletePointLight(selectedPoint.id);
              setSelectedLightId(null);
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
