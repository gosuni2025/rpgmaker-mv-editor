import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import useEditorStore from '../../store/useEditorStore';
import { MapLocationPicker } from './MapLocationPicker';

export function TransferPlayerEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [designationType, setDesignationType] = useState<number>((p[0] as number) || 0);
  const [mapId, setMapId] = useState<number>((p[1] as number) || 1);
  const [x, setX] = useState<number>((p[2] as number) || 0);
  const [y, setY] = useState<number>((p[3] as number) || 0);
  const [direction, setDirection] = useState<number>((p[4] as number) || 0);
  const [fadeType, setFadeType] = useState<number>((p[5] as number) || 0);
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
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 직접 지정 */}
          <label style={radioStyle}>
            <input type="radio" name="transfer-designation" checked={designationType === 0} onChange={() => setDesignationType(0)} />
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
            <input type="radio" name="transfer-designation" checked={designationType === 1} onChange={() => setDesignationType(1)} />
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

      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ fontSize: 12, color: '#aaa', flex: 1 }}>
          방향:
          <select value={direction} onChange={e => setDirection(Number(e.target.value))} style={{ ...selectStyle, width: '100%' }}>
            <option value={0}>유지</option>
            <option value={2}>아래</option>
            <option value={4}>왼쪽</option>
            <option value={6}>오른쪽</option>
            <option value={8}>위</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: '#aaa', flex: 1 }}>
          페이드:
          <select value={fadeType} onChange={e => setFadeType(Number(e.target.value))} style={{ ...selectStyle, width: '100%' }}>
            <option value={0}>검게</option>
            <option value={1}>희게</option>
            <option value={2}>없음</option>
          </select>
        </label>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([designationType, mapId, x, y, direction, fadeType])}>OK</button>
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
