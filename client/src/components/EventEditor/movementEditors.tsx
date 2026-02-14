import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import { useThreeRenderer } from '../MapEditor/useThreeRenderer';

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

/** 맵 위치 선택 다이얼로그 - 왼쪽 맵 목록 + 오른쪽 2D 맵 프리뷰 */
function MapLocationPicker({ mapId, x, y, onOk, onCancel, fixedMap }: {
  mapId: number; x: number; y: number;
  onOk: (mapId: number, x: number, y: number) => void;
  onCancel: () => void;
  fixedMap?: boolean;
}) {
  const maps = useEditorStore(s => s.maps);
  const [selectedMapId, setSelectedMapId] = useState(mapId);
  const [selectedX, setSelectedX] = useState(x);
  const [selectedY, setSelectedY] = useState(y);
  const [canvasScale, setCanvasScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [mapData, setMapData] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // 맵 목록 (트리를 flat list로 표시)
  const mapList = useMemo(() => {
    if (!maps) return [];
    const result: { id: number; name: string; indent: number }[] = [];
    const buildTree = (parentId: number, indent: number) => {
      const children = maps
        .filter((m): m is NonNullable<typeof m> => m != null && m.parentId === parentId)
        .sort((a, b) => a.order - b.order);
      for (const child of children) {
        result.push({ id: child.id, name: child.name, indent });
        buildTree(child.id, indent + 1);
      }
    };
    buildTree(0, 0);
    return result;
  }, [maps]);

  // 맵 데이터 로드
  useEffect(() => {
    if (!selectedMapId) return;
    let cancelled = false;
    apiClient.get<any>(`/maps/${selectedMapId}`).then(data => {
      if (!cancelled) setMapData(data);
    }).catch(e => console.warn('[MapLocationPicker] Failed to load map:', e));
    return () => { cancelled = true; };
  }, [selectedMapId]);

  // useThreeRenderer standalone 모드로 맵 렌더링
  const standaloneOpts = useMemo(
    () => mapData && selectedMapId ? { mapId: selectedMapId, mapData, simple: true } : undefined,
    [selectedMapId, mapData],
  );
  const { rendererReady } = useThreeRenderer(canvasRef, false, [], standaloneOpts);

  // 렌더러 준비 후 자동 스케일링 (fit-to-container)
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !mapData || !rendererReady) return;
    const TILE_SIZE = 48;
    const mapPxW = mapData.width * TILE_SIZE;
    const mapPxH = mapData.height * TILE_SIZE;
    const scale = Math.min(container.clientWidth / mapPxW, container.clientHeight / mapPxH, 1);
    setCanvasScale(scale);
    setPanOffset({ x: 0, y: 0 });
  }, [mapData, rendererReady]);

  // 휠 확대/축소 (native event listener로 passive: false 설정)
  const mapDataRef = useRef(mapData);
  mapDataRef.current = mapData;

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const md = mapDataRef.current;
      if (!md) return;

      const TILE_SIZE = 48;
      const mapPxW = md.width * TILE_SIZE;
      const mapPxH = md.height * TILE_SIZE;
      const minScale = Math.min(container.clientWidth / mapPxW, container.clientHeight / mapPxH, 0.1);

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setCanvasScale(prev => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const next = Math.max(minScale, Math.min(5, prev * factor));
        const ratio = next / prev;

        setPanOffset(p => ({
          x: mouseX - ratio * (mouseX - p.x),
          y: mouseY - ratio * (mouseY - p.y),
        }));

        return next;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // 미들 클릭 팬 시작
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return; // 미들 클릭만
    e.preventDefault();
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, offsetX: panOffset.x, offsetY: panOffset.y };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = ev.clientX - panStartRef.current.x;
      const dy = ev.clientY - panStartRef.current.y;
      setPanOffset({ x: panStartRef.current.offsetX + dx, y: panStartRef.current.offsetY + dy });
    };
    const handleMouseUp = () => {
      isPanningRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [panOffset]);

  // 맵 캔버스 클릭 → 좌표 지정
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const TILE_SIZE = 48;
    const tileX = Math.floor(px / TILE_SIZE);
    const tileY = Math.floor(py / TILE_SIZE);

    if (tileX >= 0 && tileX < mapData.width && tileY >= 0 && tileY < mapData.height) {
      setSelectedX(tileX);
      setSelectedY(tileY);
    }
  }, [mapData]);

  // 캔버스 래퍼 스타일 (줌 + 팬)
  const canvasWrapperStyle = useMemo((): React.CSSProperties => {
    if (!mapData) return { position: 'relative', display: 'inline-block' };
    const TILE_SIZE = 48;
    const mapPxW = mapData.width * TILE_SIZE;
    const mapPxH = mapData.height * TILE_SIZE;
    return {
      position: 'absolute',
      left: panOffset.x,
      top: panOffset.y,
      width: mapPxW * canvasScale,
      height: mapPxH * canvasScale,
    };
  }, [mapData, canvasScale, panOffset]);

  // 캔버스 CSS 크기
  const canvasStyle = useMemo((): React.CSSProperties => {
    if (!mapData) return { cursor: 'crosshair', display: 'block' };
    const TILE_SIZE = 48;
    return {
      cursor: 'crosshair',
      display: 'block',
      width: mapData.width * TILE_SIZE * canvasScale,
      height: mapData.height * TILE_SIZE * canvasScale,
    };
  }, [mapData, canvasScale]);

  // 마커 오버레이 (선택한 좌표 표시)
  const markerStyle = useMemo((): React.CSSProperties | null => {
    if (!mapData || !canvasScale) return null;
    const TILE_SIZE = 48;
    const s = canvasScale;
    return {
      position: 'absolute',
      left: selectedX * TILE_SIZE * s,
      top: selectedY * TILE_SIZE * s,
      width: TILE_SIZE * s,
      height: TILE_SIZE * s,
      border: '2px solid #ff0',
      background: 'rgba(255, 255, 0, 0.3)',
      pointerEvents: 'none',
      boxSizing: 'border-box',
    };
  }, [selectedX, selectedY, canvasScale, mapData]);

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: '90vw', maxWidth: 1200, height: '85vh', maxHeight: 900 }}>
        <div className="image-picker-header">{fixedMap ? '위치' : '맵 선택'}</div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 왼쪽: 맵 목록 (fixedMap 시 숨김) */}
          {!fixedMap && <div style={{ width: 180, minWidth: 180, borderRight: '1px solid #444', overflowY: 'auto' }}>
            {mapList.map(m => (
              <div key={m.id} style={{
                padding: '3px 8px', paddingLeft: 8 + m.indent * 16,
                cursor: 'pointer', fontSize: 12, color: '#ddd',
                background: m.id === selectedMapId ? '#2675bf' : 'transparent',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
                onClick={() => setSelectedMapId(m.id)}
              >
                {String(m.id).padStart(3, '0')}: {m.name}
              </div>
            ))}
          </div>}
          {/* 오른쪽: 맵 프리뷰 (휠 줌, 미들 클릭 팬) */}
          <div ref={previewContainerRef}
            onMouseDown={handleMouseDown}
            style={{ flex: 1, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
            <div style={canvasWrapperStyle}>
              <canvas ref={canvasRef} onClick={handleCanvasClick}
                style={canvasStyle} />
              {markerStyle && <div style={markerStyle} />}
            </div>
          </div>
        </div>
        {/* 하단: 좌표 + 버튼 */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #444', display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
            X:
            <input type="number" value={selectedX} onChange={e => setSelectedX(Number(e.target.value))}
              min={0} style={{ ...selectStyle, width: 60 }} />
          </label>
          <label style={{ fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
            Y:
            <input type="number" value={selectedY} onChange={e => setSelectedY(Number(e.target.value))}
              min={0} style={{ ...selectStyle, width: 60 }} />
          </label>
          <div style={{ flex: 1 }} />
          <button className="db-btn" onClick={() => onOk(selectedMapId, selectedX, selectedY)}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}

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
