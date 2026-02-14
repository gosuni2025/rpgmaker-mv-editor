import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import { DEFAULT_EDITOR_LIGHTS } from '../../types/rpgMakerMV';
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

export default function LightInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const updatePointLight = useEditorStore((s) => s.updatePointLight);
  const deletePointLight = useEditorStore((s) => s.deletePointLight);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const updateAmbientLight = useEditorStore((s) => s.updateAmbientLight);
  const updateDirectionalLight = useEditorStore((s) => s.updateDirectionalLight);
  const updatePlayerLight = useEditorStore((s) => s.updatePlayerLight);
  const updateSpotLight = useEditorStore((s) => s.updateSpotLight);
  const updateShadowSettings = useEditorStore((s) => s.updateShadowSettings);

  const editorLights = currentMap?.editorLights;
  if (!editorLights) return <div className="light-inspector"><div style={{ color: '#666', fontSize: 12, padding: 8 }}>조명 데이터 없음</div></div>;

  const selectedPoint = selectedLightType === 'point' && selectedLightId != null
    ? editorLights.points.find((p) => p.id === selectedLightId)
    : null;

  const playerLight = editorLights.playerLight ?? DEFAULT_EDITOR_LIGHTS.playerLight!;
  const spotLight = editorLights.spotLight ?? DEFAULT_EDITOR_LIGHTS.spotLight!;
  const shadow = editorLights.shadow ?? DEFAULT_EDITOR_LIGHTS.shadow!;
  const dir = editorLights.directional;

  return (
    <div className="light-inspector">
      {/* Ambient Light */}
      {selectedLightType === 'ambient' && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">
            앰비언트 라이트
            <HelpButton text={"글로벌 환경광 설정입니다.\n맵 전체에 기본 적용되며,\n카메라 존에 환경광이 설정된 경우\n해당 존 내에서는 존의 값이 우선 적용됩니다."} />
          </div>
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
            <DragLabel label="강도" value={editorLights.ambient.intensity} step={0.05} min={0} max={10}
              onChange={(v) => updateAmbientLight({ intensity: v })} />
            <input type="number" className="light-inspector-input" step={0.05}
              value={editorLights.ambient.intensity}
              onChange={(e) => updateAmbientLight({ intensity: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      )}

      {/* Directional Light */}
      {selectedLightType === 'directional' && (
        <>
          <div className="light-inspector-section">
            <div className="light-inspector-title">디렉셔널 라이트</div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">적용</span>
              <input type="checkbox" checked={dir.enabled === true}
                onChange={(e) => updateDirectionalLight({ enabled: e.target.checked })} />
            </div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">색상</span>
              <input
                type="color"
                className="light-inspector-color"
                value={dir.color}
                onChange={(e) => updateDirectionalLight({ color: e.target.value })}
              />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="강도" value={dir.intensity} step={0.05} min={0} max={10}
                onChange={(v) => updateDirectionalLight({ intensity: v })} />
              <input type="number" className="light-inspector-input" step={0.05}
                value={dir.intensity}
                onChange={(e) => updateDirectionalLight({ intensity: parseFloat(e.target.value) || 0 })} />
            </div>
            {[0, 1, 2].map((i) => (
              <div className="light-inspector-row" key={`dir-${i}`}>
                <DragLabel label={`방향 ${'XYZ'[i]}`} value={dir.direction[i]} step={0.1} min={-5} max={5}
                  onChange={(v) => {
                    const d = [...dir.direction] as [number, number, number];
                    d[i] = v;
                    updateDirectionalLight({ direction: d });
                  }} />
                <input type="number" className="light-inspector-input" step={0.1}
                  value={dir.direction[i]}
                  onChange={(e) => {
                    const d = [...dir.direction] as [number, number, number];
                    d[i] = parseFloat(e.target.value) || 0;
                    updateDirectionalLight({ direction: d });
                  }} />
              </div>
            ))}
            <div className="light-inspector-row">
              <span className="light-inspector-label">그림자</span>
              <input type="checkbox" checked={dir.castShadow !== false}
                onChange={(e) => updateDirectionalLight({ castShadow: e.target.checked })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="그림자맵" value={dir.shadowMapSize ?? 2048} step={256} min={512} max={4096}
                onChange={(v) => updateDirectionalLight({ shadowMapSize: Math.round(v) })} />
              <select className="light-inspector-input" style={{ width: 'auto' }}
                value={dir.shadowMapSize ?? 2048}
                onChange={(e) => updateDirectionalLight({ shadowMapSize: parseInt(e.target.value) })}>
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
              </select>
            </div>
            <div className="light-inspector-row">
              <DragLabel label="바이어스" value={dir.shadowBias ?? -0.001} step={0.0001} min={-0.01} max={0.01}
                onChange={(v) => updateDirectionalLight({ shadowBias: v })} />
              <input type="number" className="light-inspector-input" step={0.0001} style={{ width: 80 }}
                value={dir.shadowBias ?? -0.001}
                onChange={(e) => updateDirectionalLight({ shadowBias: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Near" value={dir.shadowNear ?? 1} step={1} min={0.1} max={100}
                onChange={(v) => updateDirectionalLight({ shadowNear: v })} />
              <input type="number" className="light-inspector-input" step={1}
                value={dir.shadowNear ?? 1}
                onChange={(e) => updateDirectionalLight({ shadowNear: parseFloat(e.target.value) || 1 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Far" value={dir.shadowFar ?? 5000} step={100} min={100} max={20000}
                onChange={(v) => updateDirectionalLight({ shadowFar: v })} />
              <input type="number" className="light-inspector-input" step={100}
                value={dir.shadowFar ?? 5000}
                onChange={(e) => updateDirectionalLight({ shadowFar: parseFloat(e.target.value) || 5000 })} />
            </div>
          </div>

          {/* Shadow Settings */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">그림자 설정</div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">색상</span>
              <input type="color" className="light-inspector-color"
                value={shadow.color}
                onChange={(e) => updateShadowSettings({ color: e.target.value })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="불투명도" value={shadow.opacity} step={0.05} min={0} max={1}
                onChange={(v) => updateShadowSettings({ opacity: v })} />
              <input type="number" className="light-inspector-input" step={0.05}
                value={shadow.opacity}
                onChange={(e) => updateShadowSettings({ opacity: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="오프셋" value={shadow.offsetScale} step={0.1} min={0} max={10}
                onChange={(v) => updateShadowSettings({ offsetScale: v })} />
              <input type="number" className="light-inspector-input" step={0.1}
                value={shadow.offsetScale}
                onChange={(e) => updateShadowSettings({ offsetScale: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </>
      )}

      {/* Point Light mode */}
      {selectedLightType === 'point' && (
        <>
          {/* Player Light */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">플레이어 라이트</div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">색상</span>
              <input type="color" className="light-inspector-color"
                value={playerLight.color}
                onChange={(e) => updatePlayerLight({ color: e.target.value })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="강도" value={playerLight.intensity} step={0.1} min={0} max={10}
                onChange={(v) => updatePlayerLight({ intensity: v })} />
              <input type="number" className="light-inspector-input" step={0.1}
                value={playerLight.intensity}
                onChange={(e) => updatePlayerLight({ intensity: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="거리" value={playerLight.distance} step={10} min={50} max={5000}
                onChange={(v) => updatePlayerLight({ distance: Math.round(v) })} />
              <input type="number" className="light-inspector-input" step={10}
                value={playerLight.distance}
                onChange={(e) => updatePlayerLight({ distance: parseFloat(e.target.value) || 200 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Z (높이)" value={playerLight.z} step={1} min={0} max={1000}
                onChange={(v) => updatePlayerLight({ z: Math.round(v) })} />
              <input type="number" className="light-inspector-input" step={1}
                value={playerLight.z}
                onChange={(e) => updatePlayerLight({ z: parseFloat(e.target.value) || 40 })} />
            </div>
          </div>

          {/* Spot Light */}
          <div className="light-inspector-section">
            <div className="light-inspector-title">스포트라이트</div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">활성화</span>
              <input type="checkbox" checked={spotLight.enabled}
                onChange={(e) => updateSpotLight({ enabled: e.target.checked })} />
            </div>
            <div className="light-inspector-row">
              <span className="light-inspector-label">색상</span>
              <input type="color" className="light-inspector-color"
                value={spotLight.color}
                onChange={(e) => updateSpotLight({ color: e.target.value })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="강도" value={spotLight.intensity} step={0.1} min={0} max={20}
                onChange={(v) => updateSpotLight({ intensity: v })} />
              <input type="number" className="light-inspector-input" step={0.1}
                value={spotLight.intensity}
                onChange={(e) => updateSpotLight({ intensity: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="거리" value={spotLight.distance} step={10} min={50} max={5000}
                onChange={(v) => updateSpotLight({ distance: Math.round(v) })} />
              <input type="number" className="light-inspector-input" step={10}
                value={spotLight.distance}
                onChange={(e) => updateSpotLight({ distance: parseFloat(e.target.value) || 250 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="각도" value={spotLight.angle} step={0.05} min={0.1} max={1.5}
                onChange={(v) => updateSpotLight({ angle: v })} />
              <input type="number" className="light-inspector-input" step={0.05}
                value={spotLight.angle}
                onChange={(e) => updateSpotLight({ angle: parseFloat(e.target.value) || 0.6 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="페넘브라" value={spotLight.penumbra} step={0.05} min={0} max={1}
                onChange={(v) => updateSpotLight({ penumbra: v })} />
              <input type="number" className="light-inspector-input" step={0.05}
                value={spotLight.penumbra}
                onChange={(e) => updateSpotLight({ penumbra: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="Z (높이)" value={spotLight.z} step={10} min={10} max={1000}
                onChange={(v) => updateSpotLight({ z: Math.round(v) })} />
              <input type="number" className="light-inspector-input" step={10}
                value={spotLight.z}
                onChange={(e) => updateSpotLight({ z: parseFloat(e.target.value) || 120 })} />
            </div>
            <div className="light-inspector-row">
              <DragLabel label="그림자맵" value={spotLight.shadowMapSize} step={256} min={512} max={4096}
                onChange={(v) => updateSpotLight({ shadowMapSize: Math.round(v) })} />
              <select className="light-inspector-input" style={{ width: 'auto' }}
                value={spotLight.shadowMapSize}
                onChange={(e) => updateSpotLight({ shadowMapSize: parseInt(e.target.value) })}>
                <option value={512}>512</option>
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
              </select>
            </div>
            <div className="light-inspector-row">
              <DragLabel label="타겟거리" value={spotLight.targetDistance} step={10} min={30} max={1000}
                onChange={(v) => updateSpotLight({ targetDistance: Math.round(v) })} />
              <input type="number" className="light-inspector-input" step={10}
                value={spotLight.targetDistance}
                onChange={(e) => updateSpotLight({ targetDistance: parseFloat(e.target.value) || 70 })} />
            </div>
          </div>

          {/* Selected Point Light */}
          {selectedPoint && (
            <div className="light-inspector-section">
              <div className="light-inspector-title">포인트 라이트 #{selectedPoint.id}</div>
              <div className="light-inspector-row">
                <DragLabel label="X" value={selectedPoint.x} step={1}
                  onChange={(v) => updatePointLight(selectedPoint.id, { x: Math.round(v) })} />
                <input type="number" className="light-inspector-input"
                  value={selectedPoint.x}
                  onChange={(e) => updatePointLight(selectedPoint.id, { x: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="light-inspector-row">
                <DragLabel label="Y" value={selectedPoint.y} step={1}
                  onChange={(v) => updatePointLight(selectedPoint.id, { y: Math.round(v) })} />
                <input type="number" className="light-inspector-input"
                  value={selectedPoint.y}
                  onChange={(e) => updatePointLight(selectedPoint.id, { y: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="light-inspector-row">
                <DragLabel label="Z (높이)" value={selectedPoint.z} step={1} min={0} max={1000}
                  onChange={(v) => updatePointLight(selectedPoint.id, { z: Math.round(v) })} />
                <input type="number" className="light-inspector-input" step={1}
                  value={selectedPoint.z}
                  onChange={(e) => updatePointLight(selectedPoint.id, { z: parseFloat(e.target.value) || 0 })} />
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
                <DragLabel label="강도" value={selectedPoint.intensity} step={0.1} min={0} max={10}
                  onChange={(v) => updatePointLight(selectedPoint.id, { intensity: v })} />
                <input type="number" className="light-inspector-input" step={0.1}
                  value={selectedPoint.intensity}
                  onChange={(e) => updatePointLight(selectedPoint.id, { intensity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="light-inspector-row">
                <DragLabel label="거리" value={selectedPoint.distance} step={10} min={50} max={5000}
                  onChange={(v) => updatePointLight(selectedPoint.id, { distance: Math.round(v) })} />
                <input type="number" className="light-inspector-input" step={10}
                  value={selectedPoint.distance}
                  onChange={(e) => updatePointLight(selectedPoint.id, { distance: parseFloat(e.target.value) || 150 })} />
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

          {/* No point light selected hint */}
          {!selectedPoint && (
            <div style={{ color: '#666', fontSize: 12, padding: 8 }}>
              맵을 클릭하여 포인트 라이트를 배치하거나, 목록에서 선택하세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}
