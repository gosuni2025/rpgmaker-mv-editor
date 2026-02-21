import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import useEditorStore from '../../store/useEditorStore';
import { MapLocationPicker } from './MapLocationPicker';

/**
 * 지정 위치의 정보 획득 에디터 (코드 285)
 * params: [variableId, infoType, designationType, x, y]
 * variableId: 결과를 저장할 변수 ID
 * infoType: 0=지형 태그, 1=이벤트 ID, 2=타일 ID(레이어1), 3=타일 ID(레이어2), 4=타일 ID(레이어3), 5=타일 ID(레이어4), 6=지역 ID
 * designationType: 0=직접 지정, 1=변수로 지정
 * x: X좌표 또는 X변수 ID
 * y: Y좌표 또는 Y변수 ID
 */
const INFO_TYPES = [
  { value: 0, label: '지형 태그' },
  { value: 1, label: '이벤트 ID' },
  { value: 2, label: '타일 ID (레이어 1)' },
  { value: 3, label: '타일 ID (레이어 2)' },
  { value: 4, label: '타일 ID (레이어 3)' },
  { value: 5, label: '타일 ID (레이어 4)' },
  { value: 6, label: '지역 ID' },
];

export function GetLocationInfoEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [variableId, setVariableId] = useState<number>((p[0] as number) || 1);
  const [infoType, setInfoType] = useState<number>((p[1] as number) || 0);
  const [designationType, setDesignationType] = useState<number>((p[2] as number) || 0);
  const [x, setX] = useState<number>((p[3] as number) || 0);
  const [y, setY] = useState<number>((p[4] as number) || 0);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const currentMapId = useEditorStore(s => s.currentMapId);
  const currentMap = useEditorStore(s => s.currentMap);
  const selectedEventId = useEditorStore(s => s.selectedEventId);

  // 현재 이벤트의 위치 정보
  const eventMarker = useMemo(() => {
    if (!currentMap?.events || !selectedEventId) return undefined;
    const ev = currentMap.events[selectedEventId];
    if (!ev) return undefined;
    return { x: ev.x, y: ev.y, label: `현재 이벤트` };
  }, [currentMap, selectedEventId]);

  const directLabel = `현재 지도 (${x},${y})`;

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>변수:</span>
        <VariableSwitchPicker type="variable" value={variableId} onChange={setVariableId} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>정보 유형:</span>
        <select value={infoType} onChange={e => setInfoType(Number(e.target.value))} style={selectStyle}>
          {INFO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 직접 지정 */}
          <label style={radioStyle}>
            <input type="radio" name="locinfo-designation" checked={designationType === 0} onChange={() => setDesignationType(0)} />
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
            <input type="radio" name="locinfo-designation" checked={designationType === 1} onChange={() => setDesignationType(1)} />
            변수로 지정
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20, opacity: designationType === 1 ? 1 : 0.5 }}>
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
        <button className="db-btn" onClick={() => onOk([variableId, infoType, designationType, x, y])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showMapPicker && currentMapId && createPortal(
        <MapLocationPicker mapId={currentMapId} x={x} y={y} fixedMap
          eventMarker={eventMarker}
          onOk={(_mapId, newX, newY) => { setX(newX); setY(newY); setShowMapPicker(false); }}
          onCancel={() => setShowMapPicker(false)} />,
        document.body
      )}
    </>
  );
}
