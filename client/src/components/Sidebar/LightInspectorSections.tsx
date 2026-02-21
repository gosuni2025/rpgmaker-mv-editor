import React from 'react';
import DragLabel from '../common/DragLabel';
import ExtBadge from '../common/ExtBadge';

interface DragCallbacks {
  onDragStart: () => void;
  onDragEnd: () => void;
}

// ─── Directional Light + Shadow Settings ───
export function DirectionalLightSection({ dir, shadow, updateDirectionalLight, updateShadowSettings, onDragStart, onDragEnd }: DragCallbacks & {
  dir: any;
  shadow: any;
  updateDirectionalLight: (p: any, isDrag?: boolean) => void;
  updateShadowSettings: (p: any, isDrag?: boolean) => void;
}) {
  return (
    <>
      <div className="light-inspector-section">
        <div className="light-inspector-title">방향 조명 <ExtBadge inline /></div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">적용</span>
          <input type="checkbox" checked={dir.enabled === true}
            onChange={(e) => updateDirectionalLight({ enabled: e.target.checked })} />
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">색상</span>
          <input type="color" className="light-inspector-color" value={dir.color}
            onChange={(e) => updateDirectionalLight({ color: e.target.value })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="강도" value={dir.intensity} step={0.05} min={0} max={10}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateDirectionalLight({ intensity: v }, true)} />
          <input type="number" className="light-inspector-input" step={0.05}
            value={dir.intensity}
            onChange={(e) => updateDirectionalLight({ intensity: parseFloat(e.target.value) || 0 })} />
        </div>
        {[0, 1, 2].map((i) => (
          <div className="light-inspector-row" key={`dir-${i}`}>
            <DragLabel label={`방향 ${'XYZ'[i]}`} value={dir.direction[i]} step={0.1} min={-5} max={5}
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onChange={(v) => {
                const d = [...dir.direction] as [number, number, number];
                d[i] = v;
                updateDirectionalLight({ direction: d }, true);
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
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateDirectionalLight({ shadowMapSize: Math.round(v) }, true)} />
          <select className="light-inspector-input" style={{ width: 'auto' }}
            value={dir.shadowMapSize ?? 2048}
            onChange={(e) => updateDirectionalLight({ shadowMapSize: parseInt(e.target.value) })}>
            <option value={512}>512</option><option value={1024}>1024</option>
            <option value={2048}>2048</option><option value={4096}>4096</option>
          </select>
        </div>
        <div className="light-inspector-row">
          <DragLabel label="바이어스" value={dir.shadowBias ?? -0.001} step={0.0001} min={-0.01} max={0.01}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateDirectionalLight({ shadowBias: v }, true)} />
          <input type="number" className="light-inspector-input" step={0.0001} style={{ width: 80 }}
            value={dir.shadowBias ?? -0.001}
            onChange={(e) => updateDirectionalLight({ shadowBias: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="Near" value={dir.shadowNear ?? 1} step={1} min={0.1} max={100}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateDirectionalLight({ shadowNear: v }, true)} />
          <input type="number" className="light-inspector-input" step={1}
            value={dir.shadowNear ?? 1}
            onChange={(e) => updateDirectionalLight({ shadowNear: parseFloat(e.target.value) || 1 })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="Far" value={dir.shadowFar ?? 5000} step={100} min={100} max={20000}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateDirectionalLight({ shadowFar: v }, true)} />
          <input type="number" className="light-inspector-input" step={100}
            value={dir.shadowFar ?? 5000}
            onChange={(e) => updateDirectionalLight({ shadowFar: parseFloat(e.target.value) || 5000 })} />
        </div>
      </div>

      <div className="light-inspector-section">
        <div className="light-inspector-title">그림자 설정</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">색상</span>
          <input type="color" className="light-inspector-color" value={shadow.color}
            onChange={(e) => updateShadowSettings({ color: e.target.value })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="불투명도" value={shadow.opacity} step={0.05} min={0} max={1}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateShadowSettings({ opacity: v }, true)} />
          <input type="number" className="light-inspector-input" step={0.05}
            value={shadow.opacity}
            onChange={(e) => updateShadowSettings({ opacity: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="오프셋" value={shadow.offsetScale} step={0.1} min={0} max={10}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateShadowSettings({ offsetScale: v }, true)} />
          <input type="number" className="light-inspector-input" step={0.1}
            value={shadow.offsetScale}
            onChange={(e) => updateShadowSettings({ offsetScale: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>
    </>
  );
}

// ─── Spot Light ───
export function SpotLightSection({ spotLight, updateSpotLight, onDragStart, onDragEnd }: DragCallbacks & {
  spotLight: any;
  updateSpotLight: (p: any, isDrag?: boolean) => void;
}) {
  const fields: { label: string; key: string; step: number; min: number; max: number; fallback: number }[] = [
    { label: '강도', key: 'intensity', step: 0.1, min: 0, max: 20, fallback: 0 },
    { label: '거리', key: 'distance', step: 10, min: 50, max: 5000, fallback: 250 },
    { label: '각도', key: 'angle', step: 0.05, min: 0.1, max: 1.5, fallback: 0.6 },
    { label: '페넘브라', key: 'penumbra', step: 0.05, min: 0, max: 1, fallback: 0 },
    { label: 'Z (높이)', key: 'z', step: 10, min: 10, max: 1000, fallback: 120 },
    { label: '타겟거리', key: 'targetDistance', step: 10, min: 30, max: 1000, fallback: 70 },
  ];

  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">집중 조명 <ExtBadge inline /></div>
      <div className="light-inspector-row">
        <span className="light-inspector-label">활성화</span>
        <input type="checkbox" checked={spotLight.enabled}
          onChange={(e) => updateSpotLight({ enabled: e.target.checked })} />
      </div>
      <div className="light-inspector-row">
        <span className="light-inspector-label">색상</span>
        <input type="color" className="light-inspector-color" value={spotLight.color}
          onChange={(e) => updateSpotLight({ color: e.target.value })} />
      </div>
      {fields.map(({ label, key, step, min, max, fallback }) => (
        <div className="light-inspector-row" key={key}>
          <DragLabel label={label} value={spotLight[key]} step={step} min={min} max={max}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateSpotLight({ [key]: key === 'distance' || key === 'z' || key === 'targetDistance' ? Math.round(v) : v }, true)} />
          <input type="number" className="light-inspector-input" step={step}
            value={spotLight[key]}
            onChange={(e) => updateSpotLight({ [key]: parseFloat(e.target.value) || fallback })} />
        </div>
      ))}
      <div className="light-inspector-row">
        <DragLabel label="그림자맵" value={spotLight.shadowMapSize} step={256} min={512} max={4096}
          onDragStart={onDragStart} onDragEnd={onDragEnd}
          onChange={(v) => updateSpotLight({ shadowMapSize: Math.round(v) }, true)} />
        <select className="light-inspector-input" style={{ width: 'auto' }}
          value={spotLight.shadowMapSize}
          onChange={(e) => updateSpotLight({ shadowMapSize: parseInt(e.target.value) })}>
          <option value={512}>512</option><option value={1024}>1024</option>
          <option value={2048}>2048</option><option value={4096}>4096</option>
        </select>
      </div>
    </div>
  );
}

// ─── Point Light ───
export function PointLightSection({ selectedPoint, updatePointLight, deletePointLight, setSelectedLightId, onDragStart, onDragEnd }: DragCallbacks & {
  selectedPoint: any | null;
  updatePointLight: (id: number, p: any, isDrag?: boolean) => void;
  deletePointLight: (id: number) => void;
  setSelectedLightId: (id: number | null) => void;
}) {
  if (!selectedPoint) {
    return (
      <div style={{ color: '#666', fontSize: 12, padding: 8 }}>
        <span style={{ color: '#4a4' }}>맵에서 점 조명을 선택하세요.</span>
        <div style={{ color: '#aaa', marginTop: 8, lineHeight: 1.6 }}>
          점 조명은 맵의 특정 위치에서 모든 방향으로 빛을 발산하는 조명입니다.
          횃불, 가로등, 마법 오브 등의 효과에 사용합니다.
          <br /><br />
          빈 타일을 클릭하면 새 점 조명을 배치하고,
          드래그로 이동하거나 인스펙터에서 색상, 강도, 거리를 조절할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">점 조명 #{selectedPoint.id}</div>
      {['x', 'y'].map(axis => (
        <div className="light-inspector-row" key={axis}>
          <DragLabel label={axis.toUpperCase()} value={selectedPoint[axis]} step={1}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updatePointLight(selectedPoint.id, { [axis]: Math.round(v) }, true)} />
          <input type="number" className="light-inspector-input"
            value={selectedPoint[axis]}
            onChange={(e) => updatePointLight(selectedPoint.id, { [axis]: parseInt(e.target.value) || 0 })} />
        </div>
      ))}
      <div className="light-inspector-row">
        <DragLabel label="Z (높이)" value={selectedPoint.z} step={1} min={0} max={1000}
          onDragStart={onDragStart} onDragEnd={onDragEnd}
          onChange={(v) => updatePointLight(selectedPoint.id, { z: Math.round(v) }, true)} />
        <input type="number" className="light-inspector-input" step={1}
          value={selectedPoint.z}
          onChange={(e) => updatePointLight(selectedPoint.id, { z: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="light-inspector-row">
        <span className="light-inspector-label">색상</span>
        <input type="color" className="light-inspector-color" value={selectedPoint.color}
          onChange={(e) => updatePointLight(selectedPoint.id, { color: e.target.value })} />
      </div>
      <div className="light-inspector-row">
        <DragLabel label="강도" value={selectedPoint.intensity} step={0.1} min={0} max={10}
          onDragStart={onDragStart} onDragEnd={onDragEnd}
          onChange={(v) => updatePointLight(selectedPoint.id, { intensity: v }, true)} />
        <input type="number" className="light-inspector-input" step={0.1}
          value={selectedPoint.intensity}
          onChange={(e) => updatePointLight(selectedPoint.id, { intensity: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="light-inspector-row">
        <DragLabel label="거리" value={selectedPoint.distance} step={10} min={50} max={5000}
          onDragStart={onDragStart} onDragEnd={onDragEnd}
          onChange={(v) => updatePointLight(selectedPoint.id, { distance: Math.round(v) }, true)} />
        <input type="number" className="light-inspector-input" step={10}
          value={selectedPoint.distance}
          onChange={(e) => updatePointLight(selectedPoint.id, { distance: parseFloat(e.target.value) || 150 })} />
      </div>
      <div className="light-inspector-row">
        <span className="light-inspector-label">감쇠</span>
        <select className="light-inspector-input" style={{ width: 'auto' }}
          value={selectedPoint.decay}
          onChange={(e) => updatePointLight(selectedPoint.id, { decay: parseInt(e.target.value) })}>
          <option value={0}>0 (선형)</option>
          <option value={1}>1 (물리)</option>
          <option value={2}>2 (강한 물리)</option>
        </select>
      </div>
      <button className="light-inspector-delete"
        onClick={() => { deletePointLight(selectedPoint.id); setSelectedLightId(null); }}>삭제</button>
    </div>
  );
}
