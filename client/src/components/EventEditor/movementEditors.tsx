import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import useEditorStore from '../../store/useEditorStore';
import { MapLocationPicker } from './MapLocationPicker';

export { GetLocationInfoEditor } from './GetLocationInfoEditor';
export { TransferPlayerEditor } from './TransferPlayerEditor';
export { SetEventLocationEditor } from './SetEventLocationEditor';

/**
 * 탈 것 위치 설정 에디터 (코드 202)
 * params: [vehicleType, designationType, mapId, x, y]
 * vehicleType: 0=보트, 1=선박, 2=비행선
 * designationType: 0=직접 지정, 1=변수로 지정
 */
const VEHICLE_NAMES = ['보트', '선박', '비행선'];

export function SetVehicleLocationEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [vehicleType, setVehicleType] = useState<number>((p[0] as number) || 0);
  const [designationType, setDesignationType] = useState<number>((p[1] as number) || 0);
  const [mapId, setMapId] = useState<number>((p[2] as number) || 1);
  const [x, setX] = useState<number>((p[3] as number) || 0);
  const [y, setY] = useState<number>((p[4] as number) || 0);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const maps = useEditorStore(s => s.maps);

  const mapName = useMemo(() => {
    if (!maps) return '';
    const info = maps[mapId];
    return info?.name || '';
  }, [maps, mapId]);

  const directLabel = `${mapName} ${mapId} (${x},${y})`;

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>탈 것:</span>
        <select value={vehicleType} onChange={e => setVehicleType(Number(e.target.value))} style={selectStyle}>
          {VEHICLE_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
        </select>
      </div>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 직접 지정 */}
          <label style={radioStyle}>
            <input type="radio" name="vehicle-designation" checked={designationType === 0} onChange={() => setDesignationType(0)} />
            직접 지정
          </label>
          <div style={{ paddingLeft: 20 }}>
            <button className="db-btn" disabled={designationType !== 0}
              onClick={() => setShowMapPicker(true)}
              style={{ width: '100%', textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: designationType === 0 ? 1 : 0.5 }}>
              {directLabel}
            </button>
          </div>

          {/* 변수로 지정 */}
          <label style={radioStyle}>
            <input type="radio" name="vehicle-designation" checked={designationType === 1} onChange={() => setDesignationType(1)} />
            변수로 지정
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20, opacity: designationType === 1 ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 24 }}>ID:</span>
              <VariableSwitchPicker type="variable" value={designationType === 1 ? (mapId || 1) : 1} onChange={setMapId} disabled={designationType !== 1} style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 24 }}>X:</span>
              <VariableSwitchPicker type="variable" value={designationType === 1 ? (x || 1) : 1} onChange={setX} disabled={designationType !== 1} style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 24 }}>Y:</span>
              <VariableSwitchPicker type="variable" value={designationType === 1 ? (y || 1) : 1} onChange={setY} disabled={designationType !== 1} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([vehicleType, designationType, mapId, x, y])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showMapPicker && createPortal(
        <MapLocationPicker mapId={mapId} x={x} y={y}
          onOk={(newMapId, newX, newY) => { setMapId(newMapId); setX(newX); setY(newY); setShowMapPicker(false); }}
          onCancel={() => setShowMapPicker(false)} />,
        document.body
      )}
    </>
  );
}

/**
 * 지도 스크롤 에디터 (코드 204)
 * params: [direction, distance, speed]
 * direction: 2=아래, 4=왼쪽, 6=오른쪽, 8=위
 * distance: 타일 수
 * speed: 1~6 (1=x8느리게, 2=x4느리게, 3=x2느리게, 4=보통, 5=x2빠르게, 6=x4빠르게)
 */
const SCROLL_DIRECTIONS = [
  { value: 2, label: '아래' },
  { value: 4, label: '왼쪽' },
  { value: 6, label: '오른쪽' },
  { value: 8, label: '위' },
];

const SCROLL_SPEEDS = [
  { value: 1, label: '1: x8 느리게' },
  { value: 2, label: '2: x4 느리게' },
  { value: 3, label: '3: x2 느리게' },
  { value: 4, label: '4: 보통' },
  { value: 5, label: '5: x2 빠르게' },
  { value: 6, label: '6: x4 빠르게' },
];

export function ScrollMapEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [direction, setDirection] = useState<number>((p[0] as number) || 2);
  const [distance, setDistance] = useState<number>((p[1] as number) || 1);
  const [speed, setSpeed] = useState<number>((p[2] as number) || 4);

  return (
    <>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span style={{ fontSize: 12, color: '#aaa' }}>방향:</span>
          <select value={direction} onChange={e => setDirection(Number(e.target.value))} style={selectStyle}>
            {SCROLL_DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span style={{ fontSize: 12, color: '#aaa' }}>거리:</span>
          <input type="number" value={distance} onChange={e => setDistance(Math.max(1, Number(e.target.value)))}
            min={1} style={{ ...selectStyle, width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>속도:</span>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))} style={selectStyle}>
          {SCROLL_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([direction, distance, speed])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
