import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import useEditorStore from '../../store/useEditorStore';
import { MapLocationPicker } from './MapLocationPicker';

/**
 * 이벤트 위치 설정 에디터 (코드 203)
 * params: [eventId, designationType, x/varX/exchangeEventId, y/varY, direction]
 * eventId: -1=플레이어, 0=해당 이벤트, 1~=이벤트 ID
 * designationType: 0=직접 지정, 1=변수로 지정, 2=다른 이벤트와 교환
 * direction: 0=유지, 2=아래, 4=왼쪽, 6=오른쪽, 8=위
 */
export function SetEventLocationEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [eventId, setEventId] = useState<number>((p[0] as number) || 0);
  const [designationType, setDesignationType] = useState<number>((p[1] as number) || 0);
  const [x, setX] = useState<number>((p[2] as number) || 0);
  const [y, setY] = useState<number>((p[3] as number) || 0);
  const [direction, setDirection] = useState<number>((p[4] as number) || 0);
  const [exchangeEventId, setExchangeEventId] = useState<number>(p[1] === 2 ? (p[2] as number) || 0 : 0);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const currentMapId = useEditorStore(s => s.currentMapId);
  const currentMap = useEditorStore(s => s.currentMap);

  // 현재 맵의 이벤트 목록
  const eventList = useMemo(() => {
    const list: { id: number; name: string }[] = [
      { id: -1, name: '플레이어' },
      { id: 0, name: '해당 이벤트' },
    ];
    if (currentMap?.events) {
      for (const ev of currentMap.events) {
        if (ev && ev.id > 0) {
          list.push({ id: ev.id, name: `${String(ev.id).padStart(3, '0')}: ${(ev as any).name || ''}` });
        }
      }
    }
    return list;
  }, [currentMap]);

  const directLabel = `현재 지도 (${x},${y})`;

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  const handleOk = () => {
    if (designationType === 2) {
      onOk([eventId, designationType, exchangeEventId, 0, direction]);
    } else {
      onOk([eventId, designationType, x, y, direction]);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>이벤트:</span>
        <select value={eventId} onChange={e => setEventId(Number(e.target.value))} style={selectStyle}>
          {eventList.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 직접 지정 */}
          <label style={radioStyle}>
            <input type="radio" name="event-loc-designation" checked={designationType === 0} onChange={() => setDesignationType(0)} />
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
            <input type="radio" name="event-loc-designation" checked={designationType === 1} onChange={() => setDesignationType(1)} />
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

          {/* 다른 이벤트와 교환 */}
          <label style={radioStyle}>
            <input type="radio" name="event-loc-designation" checked={designationType === 2} onChange={() => setDesignationType(2)} />
            다른 이벤트와 교환
          </label>
          <div style={{ paddingLeft: 20, opacity: designationType === 2 ? 1 : 0.5 }}>
            <select value={exchangeEventId} onChange={e => setExchangeEventId(Number(e.target.value))}
              disabled={designationType !== 2} style={{ ...selectStyle, width: '100%' }}>
              {eventList.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>방향:</span>
        <select value={direction} onChange={e => setDirection(Number(e.target.value))} style={selectStyle}>
          <option value={0}>유지</option>
          <option value={2}>아래</option>
          <option value={4}>왼쪽</option>
          <option value={6}>오른쪽</option>
          <option value={8}>위</option>
        </select>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showMapPicker && currentMapId && createPortal(
        <MapLocationPicker mapId={currentMapId} x={x} y={y} fixedMap
          onOk={(_mapId, newX, newY) => { setX(newX); setY(newY); setShowMapPicker(false); }}
          onCancel={() => setShowMapPicker(false)} />,
        document.body
      )}
    </>
  );
}
