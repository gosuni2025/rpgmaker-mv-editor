import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AudioFile } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';
import MoviePicker from '../common/MoviePicker';
import ImagePicker from '../common/ImagePicker';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { DataListPicker, IconSprite, CharacterSprite, type CharacterInfo } from './controlEditors';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import { useThreeRenderer } from '../MapEditor/useThreeRenderer';

interface NamedItem { id: number; name: string; iconIndex?: number; characterName?: string; characterIndex?: number }

function useDbNames(endpoint: string): string[] {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    apiClient.get<(NamedItem | null)[]>(`/database/${endpoint}`).then(data => {
      const arr: string[] = [];
      for (const item of data) {
        if (item) arr[item.id] = item.name || '';
      }
      setItems(arr);
    }).catch(() => {});
  }, [endpoint]);
  return items;
}

/** 이름과 아이콘 인덱스를 함께 가져오는 훅 */
function useDbNamesWithIcons(endpoint: string): { names: string[]; iconIndices: (number | undefined)[] } {
  const [names, setNames] = useState<string[]>([]);
  const [iconIndices, setIconIndices] = useState<(number | undefined)[]>([]);
  useEffect(() => {
    apiClient.get<(NamedItem | null)[]>(`/database/${endpoint}`).then(data => {
      const nameArr: string[] = [];
      const iconArr: (number | undefined)[] = [];
      for (const item of data) {
        if (item) {
          nameArr[item.id] = item.name || '';
          iconArr[item.id] = item.iconIndex;
        }
      }
      setNames(nameArr);
      setIconIndices(iconArr);
    }).catch(() => {});
  }, [endpoint]);
  return { names, iconIndices };
}

/** 액터 이름과 캐릭터 정보를 함께 가져오는 훅 */
function useActorData(): { names: string[]; characterData: (CharacterInfo | undefined)[] } {
  const [names, setNames] = useState<string[]>([]);
  const [characterData, setCharacterData] = useState<(CharacterInfo | undefined)[]>([]);
  useEffect(() => {
    apiClient.get<(NamedItem | null)[]>('/database/actors').then(data => {
      const nameArr: string[] = [];
      const charArr: (CharacterInfo | undefined)[] = [];
      for (const item of data) {
        if (item) {
          nameArr[item.id] = item.name || '';
          if (item.characterName) {
            charArr[item.id] = { characterName: item.characterName, characterIndex: item.characterIndex ?? 0 };
          }
        }
      }
      setNames(nameArr);
      setCharacterData(charArr);
    }).catch(() => {});
  }, []);
  return { names, characterData };
}

export const DEFAULT_AUDIO: AudioFile = { name: '', pan: 0, pitch: 100, volume: 90 };

export function ChangeGoldEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [operation, setOperation] = useState<number>((p[0] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[1] as number) || 0);
  const [operand, setOperand] = useState<number>((p[2] as number) || 0);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="gold-op" checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="gold-op" checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="gold-operand" checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={0} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="gold-operand" checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1} onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([operation, operandType, operand])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

const ITEM_ENDPOINTS: Record<string, { endpoint: string; title: string; fieldLabel: string }> = {
  'Item': { endpoint: 'items', title: '아이템 선택', fieldLabel: '아이템:' },
  'Weapon': { endpoint: 'weapons', title: '무기 선택', fieldLabel: '무기:' },
  'Armor': { endpoint: 'armors', title: '방어구 선택', fieldLabel: '방어구:' },
};

export function ChangeItemEditor({ p, onOk, onCancel, label, showIncludeEquip }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string; showIncludeEquip?: boolean }) {
  const [itemId, setItemId] = useState<number>((p[0] as number) || 1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[2] as number) || 0);
  const [operand, setOperand] = useState<number>((p[3] as number) || 1);
  const [includeEquip, setIncludeEquip] = useState<boolean>((p[4] as boolean) ?? false);
  const [showPicker, setShowPicker] = useState(false);

  const { endpoint, title, fieldLabel } = ITEM_ENDPOINTS[label] || ITEM_ENDPOINTS['Item'];
  const { names: dbNames, iconIndices } = useDbNamesWithIcons(endpoint);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const radioName = `change-${label.toLowerCase()}`;

  const itemLabel = itemId > 0 && dbNames[itemId]
    ? `${String(itemId).padStart(4, '0')} ${dbNames[itemId]}`
    : `${String(itemId).padStart(4, '0')}`;

  return (
    <>
      {/* 아이템 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{fieldLabel}</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{itemLabel}</button>
      </div>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name={`${radioName}-op`} checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name={`${radioName}-op`} checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      {/* 피연산자 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioName}-operand`} checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={1} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioName}-operand`} checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1} onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {showIncludeEquip && (
        <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={includeEquip} onChange={e => setIncludeEquip(e.target.checked)} />
          장비 포함
        </label>
      )}

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const params: unknown[] = [itemId, operation, operandType, operand];
          if (showIncludeEquip) params.push(includeEquip);
          onOk(params);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showPicker && (
        <DataListPicker items={dbNames} value={itemId} onChange={setItemId}
          onClose={() => setShowPicker(false)} title={title} iconIndices={iconIndices} />
      )}
    </>
  );
}

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

export function AudioEditor({ p, onOk, onCancel, type }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; type: 'bgm' | 'bgs' | 'me' | 'se' }) {
  const audioParam = (p[0] as AudioFile) || { ...DEFAULT_AUDIO };
  const [audio, setAudio] = useState<AudioFile>(audioParam);
  return (
    <>
      <AudioPicker type={type} value={audio} onChange={setAudio} inline />
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([audio])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function MovieEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [name, setName] = useState<string>((p[0] as string) || '');
  return (
    <>
      <MoviePicker value={name} onChange={setName} inline />
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([name])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function FadeoutEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [duration, setDuration] = useState<number>((p[0] as number) || 10);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>지속 시간</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={duration} min={1} max={999}
            onChange={e => setDuration(Number(e.target.value))}
            style={{ ...selectStyle, width: 80 }} />
          <span style={{ fontSize: 13, color: '#ddd' }}>초</span>
        </div>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([duration])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

function getLabel(id: number, list: string[]) {
  const name = list[id] || '';
  return `${String(id).padStart(4, '0')} ${name}`;
}

export function ChangePartyMemberEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [initialize, setInitialize] = useState<boolean>((p[2] as boolean) ?? true);
  const { names: actors, characterData: actorChars } = useActorData();
  const [showPicker, setShowPicker] = useState(false);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="party-op" checked={operation === 0} onChange={() => setOperation(0)} />
            추가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="party-op" checked={operation === 1} onChange={() => setOperation(1)} />
            삭제
          </label>
        </div>
      </fieldset>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
        <input type="checkbox" checked={initialize} onChange={e => setInitialize(e.target.checked)}
          disabled={operation !== 0} />
        <span style={{ opacity: operation === 0 ? 1 : 0.5 }}>초기화</span>
      </label>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk(operation === 0 ? [actorId, operation, initialize] : [actorId, operation])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
    </>
  );
}

/**
 * HP/MP/TP 증감 공용 에디터
 * HP(311): params: [actorType, actorId, operation, operandType, operand, allowKnockout]
 * MP(312)/TP(326): params: [actorType, actorId, operation, operandType, operand]
 */
function ActorStatChangeEditor({ p, onOk, onCancel, radioPrefix, showAllowKnockout, showLevelUp }: {
  p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void;
  radioPrefix: string; showAllowKnockout?: boolean; showLevelUp?: boolean;
}) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[3] as number) || 0);
  const [operand, setOperand] = useState<number>((p[4] as number) || 1);
  const [allowKnockout, setAllowKnockout] = useState<boolean>((p[5] as boolean) ?? false);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-actor`} checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-actor`} checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name={`${radioPrefix}-op`} checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name={`${radioPrefix}-op`} checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      {/* 피연산자 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-operand`} checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={1} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-operand`} checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1}
              onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {showAllowKnockout && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
          <input type="checkbox" checked={allowKnockout} onChange={e => setAllowKnockout(e.target.checked)} />
          전투 불능 상태를 허용
        </label>
      )}

      {showLevelUp && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
          <input type="checkbox" checked={allowKnockout} onChange={e => setAllowKnockout(e.target.checked)} />
          레벨업 보여주기
        </label>
      )}

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const params: unknown[] = [actorType, actorId, operation, operandType, operand];
          if (showAllowKnockout || showLevelUp) params.push(allowKnockout);
          onOk(params);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
    </>
  );
}

export function ChangeHPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="hp" showAllowKnockout />;
}

export function ChangeMPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="mp" />;
}

export function ChangeTPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="tp" />;
}

export function ChangeEXPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="exp" showLevelUp />;
}

export function ChangeLevelEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="level" showLevelUp />;
}

/**
 * 능력치 증감 에디터 (코드 317)
 * params: [actorType, actorId, paramId, operation, operandType, operand]
 */
const PARAM_NAMES = ['최대 HP', '최대 MP', '공격', '방어', '마법 공격', '마법 방어', '민첩성', '운'];

export function ChangeParameterEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [paramId, setParamId] = useState<number>((p[2] as number) || 0);
  const [operation, setOperation] = useState<number>((p[3] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[4] as number) || 0);
  const [operand, setOperand] = useState<number>((p[5] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 능력치 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ddd' }}>능력치:</span>
        <select value={paramId} onChange={e => setParamId(Number(e.target.value))}
          style={{ ...selectStyle, flex: 1 }}>
          {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
        </select>
      </div>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="param-op" checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="param-op" checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      {/* 피연산자 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-operand" checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={1} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-operand" checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1}
              onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, paramId, operation, operandType, operand])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
    </>
  );
}

/**
 * 스테이트 변경 에디터 (코드 313)
 * params: [actorType, actorId, operation, stateId]
 */
export function ChangeStateEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [stateId, setStateId] = useState<number>((p[3] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();
  const { names: stateNames, iconIndices: stateIcons } = useDbNamesWithIcons('states');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="state-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="state-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="state-op" checked={operation === 0} onChange={() => setOperation(0)} />
            추가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="state-op" checked={operation === 1} onChange={() => setOperation(1)} />
            해제
          </label>
        </div>
      </fieldset>

      {/* 스탯 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>스탯:</span>
        <button className="db-btn" onClick={() => setShowStatePicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(stateId, stateNames)}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, stateId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
      {showStatePicker && (
        <DataListPicker items={stateNames} value={stateId} onChange={setStateId}
          onClose={() => setShowStatePicker(false)} title="대상 선택" iconIndices={stateIcons} />
      )}
    </>
  );
}

/**
 * 스킬 증감 에디터 (코드 318)
 * params: [actorType, actorId, operation, skillId]
 */
export function ChangeSkillEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [skillId, setSkillId] = useState<number>((p[3] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();
  const { names: skillNames, iconIndices: skillIcons } = useDbNamesWithIcons('skills');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="skill-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="skill-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="skill-op" checked={operation === 0} onChange={() => setOperation(0)} />
            배우다
          </label>
          <label style={radioStyle}>
            <input type="radio" name="skill-op" checked={operation === 1} onChange={() => setOperation(1)} />
            까먹다
          </label>
        </div>
      </fieldset>

      {/* 스킬 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>스킬:</span>
        <button className="db-btn" onClick={() => setShowSkillPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(skillId, skillNames)}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, skillId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
      {showSkillPicker && (
        <DataListPicker items={skillNames} value={skillId} onChange={setSkillId}
          onClose={() => setShowSkillPicker(false)} title="대상 선택" iconIndices={skillIcons} />
      )}
    </>
  );
}

/**
 * 모두 회복 에디터 (코드 314)
 * params: [actorType, actorId]
 * actorType: 0=고정, 1=변수
 * actorId: 고정 시 0=전체 파티, 1~N=특정 액터 / 변수 시 변수 ID
 */
export function RecoverAllEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 0);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  const actorLabel = actorId === 0
    ? '0000 전체 파티'
    : getLabel(actorId, actorNames);

  // "전체 파티"를 인덱스 0에 포함하는 목록 생성
  const actorListWithAll = useMemo(() => {
    const list = ['전체 파티', ...actorNames.slice(1)];
    return list;
  }, [actorNames]);

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="recover-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{actorLabel}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="recover-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPickerWithZero items={actorListWithAll} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
    </>
  );
}

/** 인덱스 0부터 시작하는 DataListPicker (전체 파티 등 0번 항목 포함) */
function DataListPickerWithZero({ items, value, onChange, onClose, title, iconIndices, characterData }: {
  items: string[]; value: number; onChange: (id: number) => void; onClose: () => void; title?: string;
  iconIndices?: (number | undefined)[];
  characterData?: (CharacterInfo | undefined)[];
}) {
  const GROUP_SIZE = 20;
  const totalCount = items.length;
  const groups = useMemo(() => {
    const result: { label: string; startId: number; endId: number }[] = [];
    for (let start = 0; start < totalCount; start += GROUP_SIZE) {
      const end = Math.min(start + GROUP_SIZE - 1, totalCount - 1);
      result.push({
        label: `[ ${String(start).padStart(4, '0')} - ${String(end).padStart(4, '0')} ]`,
        startId: start,
        endId: end,
      });
    }
    return result;
  }, [totalCount]);

  const initGroupIdx = Math.max(0, Math.floor(value / GROUP_SIZE));
  const [selectedGroup, setSelectedGroup] = useState(initGroupIdx);
  const [selected, setSelected] = useState(value);

  const currentGroup = groups[selectedGroup];
  const groupItems = useMemo(() => {
    if (!currentGroup) return [];
    const result: { id: number; label: string }[] = [];
    for (let i = currentGroup.startId; i <= currentGroup.endId; i++) {
      result.push({ id: i, label: `${String(i).padStart(4, '0')} ${items[i] || ''}` });
    }
    return result;
  }, [currentGroup, items]);

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 500, maxHeight: '70vh' }}>
        <div className="image-picker-header">{title || '대상 선택'}</div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 300 }}>
          <div style={{ width: 170, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {groups.map((g, idx) => (
              <div key={g.startId} style={{
                padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ccc',
                background: idx === selectedGroup ? '#2675bf' : 'transparent',
              }} onClick={() => setSelectedGroup(idx)}>{g.label}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {groupItems.map(item => {
              const iconIdx = iconIndices?.[item.id];
              const charInfo = characterData?.[item.id];
              return (
                <div key={item.id} style={{
                  padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#ddd',
                  background: item.id === selected ? '#2675bf' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 4,
                }} onClick={() => setSelected(item.id)} onDoubleClick={() => { onChange(item.id); onClose(); }}>
                  {iconIdx != null && iconIdx > 0 && <IconSprite iconIndex={iconIdx} />}
                  {charInfo?.characterName && <CharacterSprite {...charInfo} />}
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => { onChange(selected); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 직업 변경 에디터 (코드 321)
 * params: [actorId, classId, keepLevel]
 */
export function ChangeClassEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [classId, setClassId] = useState<number>((p[1] as number) || 1);
  const [keepLevel, setKeepLevel] = useState<boolean>((p[2] as boolean) || false);
  const { names: actors, characterData: actorChars } = useActorData();
  const classes = useDbNames('classes');
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowActorPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>직업:</span>
        <button className="db-btn" onClick={() => setShowClassPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(classId, classes)}</button>
      </div>
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={keepLevel} onChange={e => setKeepLevel(e.target.checked)} />
        레벨 저장
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, classId, keepLevel])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showActorPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
      {showClassPicker && (
        <DataListPicker items={classes} value={classId} onChange={setClassId}
          onClose={() => setShowClassPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

/**
 * 장비 변경 에디터 (코드 319)
 * params: [actorId, etypeId, itemId]
 * etypeId: 1=무기, 2=방패, 3=머리, 4=몸, 5=액세서리
 * itemId: 0=없음, etypeId===1이면 무기ID, 그 외 방어구ID
 */
export function ChangeEquipmentEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [etypeId, setEtypeId] = useState<number>((p[1] as number) || 1);
  const [itemId, setItemId] = useState<number>((p[2] as number) || 0);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);

  const { names: actors, characterData: actorChars } = useActorData();
  const { names: weapons, iconIndices: weaponIcons } = useDbNamesWithIcons('weapons');
  const { names: armors, iconIndices: armorIcons } = useDbNamesWithIcons('armors');

  const EQUIP_TYPES = [
    { id: 1, label: '무기' },
    { id: 2, label: '방패' },
    { id: 3, label: '머리' },
    { id: 4, label: '몸' },
    { id: 5, label: '액세서리' },
  ];

  const isWeapon = etypeId === 1;

  // 장비 아이템 목록 (0번 = 없음)
  const filteredItems = useMemo(() => {
    const list: string[] = ['없음'];
    if (isWeapon) {
      for (let i = 1; i < weapons.length; i++) {
        list[i] = weapons[i] || '';
      }
    } else {
      for (let i = 1; i < armors.length; i++) {
        list[i] = armors[i] || '';
      }
    }
    return list;
  }, [isWeapon, weapons, armors]);

  const filteredIcons = useMemo(() => {
    return isWeapon ? weaponIcons : armorIcons;
  }, [isWeapon, weaponIcons, armorIcons]);

  const itemLabel = itemId === 0
    ? '없음'
    : getLabel(itemId, isWeapon ? weapons : armors);

  const handleEtypeChange = (newEtype: number) => {
    setEtypeId(newEtype);
    setItemId(0);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowActorPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>장비 유형:</span>
        <select value={etypeId} onChange={e => handleEtypeChange(Number(e.target.value))} style={selectStyle}>
          {EQUIP_TYPES.map(et => (
            <option key={et.id} value={et.id}>{et.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>장비 아이템:</span>
        <button className="db-btn" onClick={() => setShowItemPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{itemLabel}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, etypeId, itemId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
      {showItemPicker && (
        <DataListPickerWithZero items={filteredItems} value={itemId} onChange={setItemId}
          onClose={() => setShowItemPicker(false)} title="장비 아이템 선택" iconIndices={filteredIcons} />
      )}
    </>
  );
}

export function ChangeNameEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [name, setName] = useState<string>((p[1] as string) || '');
  const { names: actors, characterData: actorChars } = useActorData();
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ ...selectStyle, width: '100%' }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, name])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
    </>
  );
}

/**
 * 이름 입력 처리 에디터 (코드 303)
 * params: [actorId, maxCharacters]
 */
export function NameInputEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [maxChars, setMaxChars] = useState<number>((p[1] as number) || 8);
  const { names: actors, characterData: actorChars } = useActorData();
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>최대 문자 수:</span>
        <input type="number" value={maxChars} onChange={e => setMaxChars(Math.max(1, Math.min(16, Number(e.target.value))))}
          min={1} max={16} style={{ ...selectStyle, width: 120 }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, maxChars])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
    </>
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

export function ToggleEditor({ p, onOk, onCancel, legend }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; legend: string }) {
  const [value, setValue] = useState<number>((p[0] as number) ?? 0);
  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>{legend}</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="toggle" checked={value === 0} onChange={() => setValue(0)} />
            ON
          </label>
          <label style={radioStyle}>
            <input type="radio" name="toggle" checked={value === 1} onChange={() => setValue(1)} />
            OFF
          </label>
        </div>
      </fieldset>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function ChangeTransparencyEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="투명 상태" />;
}

export function ChangeSaveAccessEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="저장" />;
}

export function ChangeMenuAccessEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="메뉴" />;
}

export function ChangeEncounterEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="조우" />;
}

export function ChangeFormationAccessEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="대열로 보행" />;
}

export function ChangePlayerFollowersEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="대열로 보행" />;
}

export function ShowAnimationEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [characterId, setCharacterId] = useState<number>((p[0] as number) ?? -1);
  const [animationId, setAnimationId] = useState<number>((p[1] as number) || 1);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[2] as boolean) || false);
  const [showAnimPicker, setShowAnimPicker] = useState(false);

  const animNames = useDbNames('animations');
  const currentMap = useEditorStore(s => s.currentMap);

  const eventList = useMemo(() => {
    const list: { id: number; name: string }[] = [
      { id: -1, name: '플레이어' },
      { id: 0, name: '해당 이벤트' },
    ];
    if (currentMap?.events) {
      for (const ev of currentMap.events) {
        if (ev && ev.id > 0) {
          list.push({ id: ev.id, name: `EV${String(ev.id).padStart(3, '0')}` });
        }
      }
    }
    return list;
  }, [currentMap]);

  const animLabel = animationId > 0 && animNames[animationId]
    ? `${String(animationId).padStart(4, '0')} ${animNames[animationId]}`
    : `${String(animationId).padStart(4, '0')}`;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>캐릭터:</span>
        <select value={characterId} onChange={e => setCharacterId(Number(e.target.value))} style={selectStyle}>
          {eventList.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>애니메이션:</span>
        <button className="db-btn" onClick={() => setShowAnimPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{animLabel}</button>
      </div>
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
        완료까지 대기
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([characterId, animationId, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showAnimPicker && (
        <DataListPicker items={animNames} value={animationId} onChange={setAnimationId}
          onClose={() => setShowAnimPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

export function ChangeProfileEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [profile, setProfile] = useState<string>((p[1] as string) || '');
  const { names: actors, characterData: actorChars } = useActorData();
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>프로필:</span>
        <textarea value={profile} onChange={e => setProfile(e.target.value)}
          rows={4}
          style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4' }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, profile])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
    </>
  );
}

const BALLOON_ICONS = [
  { value: 1, label: '느낌표' },
  { value: 2, label: '물음표' },
  { value: 3, label: '음표' },
  { value: 4, label: '하트' },
  { value: 5, label: '분노' },
  { value: 6, label: '땀' },
  { value: 7, label: '뒤죽박죽' },
  { value: 8, label: '침묵' },
  { value: 9, label: '전구' },
  { value: 10, label: 'Zzz' },
  { value: 11, label: '사용자 정의 1' },
  { value: 12, label: '사용자 정의 2' },
  { value: 13, label: '사용자 정의 3' },
  { value: 14, label: '사용자 정의 4' },
  { value: 15, label: '사용자 정의 5' },
];

/**
 * 말풍선 아이콘 표시 에디터 (코드 213)
 * params: [characterId, balloonId, waitForCompletion]
 * characterId: -1=플레이어, 0=해당 이벤트, >0=이벤트 ID
 * balloonId: 1~15
 * waitForCompletion: boolean
 */
export function ShowBalloonIconEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [characterId, setCharacterId] = useState<number>((p[0] as number) ?? -1);
  const [balloonId, setBalloonId] = useState<number>((p[1] as number) || 1);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[2] as boolean) ?? false);

  const currentMap = useEditorStore(s => s.currentMap);

  const eventList = useMemo(() => {
    const list: { id: number; name: string }[] = [
      { id: -1, name: '플레이어' },
      { id: 0, name: '해당 이벤트' },
    ];
    if (currentMap?.events) {
      for (const ev of currentMap.events) {
        if (ev && ev.id > 0) {
          list.push({ id: ev.id, name: `EV${String(ev.id).padStart(3, '0')}` });
        }
      }
    }
    return list;
  }, [currentMap]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>캐릭터:</span>
        <select value={characterId} onChange={e => setCharacterId(Number(e.target.value))} style={selectStyle}>
          {eventList.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>말풍선 아이콘:</span>
        <select value={balloonId} onChange={e => setBalloonId(Number(e.target.value))} style={selectStyle}>
          {BALLOON_ICONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
        완료까지 대기
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([characterId, balloonId, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 셰이더 프리뷰 컴포넌트 ───
declare const THREE: any;
declare const PictureShader: any;

interface ShaderEntry { type: string; enabled: boolean; params: Record<string, number> }

function ShaderPreviewCanvas({ imageName, shaderList, size = 280 }: {
  imageName: string; shaderList: ShaderEntry[]; size?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: any; scene: any; camera: any; mesh: any;
    originalMaterial: any; texture: any;
    materials: any[]; renderTargets: any[]; outputMaterial: any;
    fullscreenQuad: any; fullscreenScene: any;
    animId: number; startTime: number; loadedImage: string;
    hasShake: boolean; canvasSize: number;
  } | null>(null);

  // Three.js 씬 초기화
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof THREE === 'undefined') return;

    const W = size, H = size;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setClearColor(0x1a1a1a, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1, 1);

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // 체커보드 배경
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 256; checkerCanvas.height = 256;
    const ctx = checkerCanvas.getContext('2d')!;
    const cSize = 16;
    for (let y = 0; y < 256; y += cSize) {
      for (let x = 0; x < 256; x += cSize) {
        ctx.fillStyle = ((x + y) / cSize) % 2 === 0 ? '#333' : '#444';
        ctx.fillRect(x, y, cSize, cSize);
      }
    }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    checkerTex.wrapS = THREE.RepeatWrapping;
    checkerTex.wrapT = THREE.RepeatWrapping;
    const bgMat = new THREE.MeshBasicMaterial({ map: checkerTex, depthTest: false });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat);
    bgMesh.position.z = -0.5;
    bgMesh.frustumCulled = false;
    scene.add(bgMesh);

    // 풀스크린 쿼드 (멀티패스용)
    const fsScene = new THREE.Scene();
    const fsGeo = new THREE.PlaneGeometry(2, 2);
    const fsMat = new THREE.MeshBasicMaterial();
    const fsQuad = new THREE.Mesh(fsGeo, fsMat);
    fsQuad.frustumCulled = false;
    fsScene.add(fsQuad);

    stateRef.current = {
      renderer, scene, camera, mesh,
      originalMaterial: mat, texture: null,
      materials: [], renderTargets: [], outputMaterial: mat,
      fullscreenQuad: fsQuad, fullscreenScene: fsScene,
      animId: 0, startTime: performance.now() / 1000, loadedImage: '',
      hasShake: false, canvasSize: W,
    };

    const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    const animate = () => {
      const s = stateRef.current;
      if (!s) return;
      const time = performance.now() / 1000 - s.startTime;

      // 멀티패스 렌더링
      if (s.materials.length > 0 && s.texture) {
        let inputTex = s.texture;
        for (let i = 0; i < s.materials.length; i++) {
          const m = s.materials[i];
          if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = time;
          if (m.uniforms && m.uniforms.map) m.uniforms.map.value = inputTex;
          s.fullscreenQuad.material = m;
          const rt = s.renderTargets[i];
          s.renderer.setRenderTarget(rt);
          s.renderer.render(s.fullscreenScene, fsCamera);
          inputTex = rt.texture;
        }
        s.renderer.setRenderTarget(null);
        s.outputMaterial.map = inputTex;
        s.outputMaterial.needsUpdate = true;
      }

      // shake offset
      if (s.hasShake) {
        const shakeEntry = shaderList.find(e => e.type === 'shake' && e.enabled);
        if (shakeEntry) {
          const p = shakeEntry.params;
          const power = p.power ?? 5;
          const speed = p.speed ?? 10;
          const dir = p.direction ?? 2;
          const t = time * speed;
          let dx = 0, dy = 0;
          if (dir === 0 || dir === 2) dx = (Math.sin(t * 7.13) + Math.sin(t * 5.71) * 0.5) * power;
          if (dir === 1 || dir === 2) dy = (Math.sin(t * 6.47) + Math.sin(t * 4.93) * 0.5) * power;
          s.mesh.position.x = dx;
          s.mesh.position.y = -dy;
        }
      } else {
        s.mesh.position.x = 0;
        s.mesh.position.y = 0;
      }

      s.renderer.render(s.scene, s.camera);
      s.animId = requestAnimationFrame(animate);
    };
    stateRef.current.animId = requestAnimationFrame(animate);

    return () => {
      const s = stateRef.current;
      if (s) {
        cancelAnimationFrame(s.animId);
        s.materials.forEach((m: any) => m.dispose());
        s.renderTargets.forEach((rt: any) => rt.dispose());
        s.renderer.dispose();
        s.renderer.domElement.remove();
        if (s.texture) s.texture.dispose();
        if (s.originalMaterial) s.originalMaterial.dispose();
        stateRef.current = null;
      }
    };
  }, []);

  // 이미지 로드
  useEffect(() => {
    const s = stateRef.current;
    if (!s || typeof THREE === 'undefined') return;
    if (!imageName) {
      s.mesh.visible = false;
      s.loadedImage = '';
      return;
    }
    if (s.loadedImage === imageName) return;
    s.loadedImage = imageName;

    const loader = new THREE.TextureLoader();
    loader.load(`/img/pictures/${imageName}.png`, (tex: any) => {
      if (!stateRef.current || stateRef.current.loadedImage !== imageName) {
        tex.dispose();
        return;
      }
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      if (stateRef.current.texture) stateRef.current.texture.dispose();
      stateRef.current.texture = tex;

      const img = tex.image;
      const CS = stateRef.current.canvasSize;
      const scale = Math.min(CS / img.width, CS / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      stateRef.current.mesh.geometry.dispose();
      stateRef.current.mesh.geometry = new THREE.PlaneGeometry(w, h);
      stateRef.current.mesh.visible = true;

      // material에 텍스처 설정 (셰이더 없는 경우)
      const mat = stateRef.current.outputMaterial;
      if (mat === stateRef.current.originalMaterial) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
    });
  }, [imageName]);

  // 셰이더 변경 - 멀티패스 지원
  useEffect(() => {
    const s = stateRef.current;
    if (!s || typeof PictureShader === 'undefined' || typeof THREE === 'undefined') return;

    // 기존 리소스 정리
    s.materials.forEach((m: any) => m.dispose());
    s.renderTargets.forEach((rt: any) => rt.dispose());
    s.materials = [];
    s.renderTargets = [];

    const renderPasses = shaderList.filter(e => e.enabled && e.type !== 'shake');
    s.hasShake = shaderList.some(e => e.enabled && e.type === 'shake');

    if (renderPasses.length === 0) {
      // 셰이더 없음 - 원래 material 사용
      s.outputMaterial = s.originalMaterial;
      s.mesh.material = s.originalMaterial;
      if (s.texture) {
        s.originalMaterial.map = s.texture;
        s.originalMaterial.needsUpdate = true;
      }
      if (!s.hasShake) {
        s.mesh.position.x = 0;
        s.mesh.position.y = 0;
      }
      return;
    }

    // 멀티패스 셋업
    const CS = s.canvasSize;
    for (const entry of renderPasses) {
      const mat = PictureShader.createMaterial(entry.type, entry.params, s.texture);
      if (mat) {
        s.materials.push(mat);
        const rt = new THREE.WebGLRenderTarget(CS, CS, {
          minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
        });
        s.renderTargets.push(rt);
      }
    }

    // 출력 material (MeshBasicMaterial)
    const outMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    s.outputMaterial = outMat;
    s.mesh.material = outMat;
  }, [shaderList]);

  return (
    <div ref={containerRef} style={{
      width: size, height: size, flexShrink: 0,
      border: '1px solid #555', borderRadius: 4, overflow: 'hidden',
    }} />
  );
}

// ─── 셰이더 정의 ───
interface ShaderParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  type?: 'slider' | 'select';
  options?: { value: number; label: string }[];
}

interface ShaderDef {
  type: string;
  label: string;
  params: ShaderParamDef[];
}

const SHADER_DEFINITIONS: ShaderDef[] = [
  { type: 'wave', label: '물결', params: [
    { key: 'amplitude', label: '진폭', min: 0, max: 50, step: 1, defaultValue: 10 },
    { key: 'frequency', label: '빈도', min: 0.1, max: 20, step: 0.1, defaultValue: 5 },
    { key: 'speed', label: '속도', min: 0.1, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'direction', label: '방향', min: 0, max: 2, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '수평' }, { value: 1, label: '수직' }, { value: 2, label: '양방향' }
    ]},
  ]},
  { type: 'glitch', label: '글리치', params: [
    { key: 'intensity', label: '강도', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'rgbShift', label: 'RGB 쉬프트', min: 0, max: 30, step: 1, defaultValue: 5 },
    { key: 'lineSpeed', label: '라인 속도', min: 0.1, max: 10, step: 0.1, defaultValue: 3 },
    { key: 'blockSize', label: '블록 크기', min: 1, max: 50, step: 1, defaultValue: 8 },
  ]},
  { type: 'dissolve', label: '디졸브', params: [
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 1 },
    { key: 'thresholdMin', label: '임계값 최소', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'thresholdMax', label: '임계값 최대', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'threshold', label: '임계값 (고정)', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'edgeWidth', label: '경계 넓이', min: 0, max: 0.2, step: 0.01, defaultValue: 0.05 },
    { key: 'edgeColorR', label: '경계색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'edgeColorG', label: '경계색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'edgeColorB', label: '경계색 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'noiseScale', label: '노이즈 크기', min: 1, max: 50, step: 1, defaultValue: 10 },
  ]},
  { type: 'glow', label: '발광', params: [
    { key: 'intensity', label: '강도', min: 0, max: 3, step: 0.1, defaultValue: 1 },
    { key: 'radius', label: '반경', min: 0, max: 20, step: 1, defaultValue: 4 },
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
  ]},
  { type: 'chromatic', label: '색수차', params: [
    { key: 'offset', label: '오프셋', min: 0, max: 20, step: 1, defaultValue: 3 },
    { key: 'angle', label: '각도', min: 0, max: 360, step: 1, defaultValue: 0 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
  ]},
  { type: 'pixelate', label: '픽셀화', params: [
    { key: 'size', label: '크기 (고정)', min: 1, max: 64, step: 1, defaultValue: 8 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'minSize', label: '최소 크기', min: 1, max: 64, step: 1, defaultValue: 2 },
    { key: 'maxSize', label: '최대 크기', min: 1, max: 64, step: 1, defaultValue: 16 },
  ]},
  { type: 'shake', label: '흔들림', params: [
    { key: 'power', label: '파워', min: 0, max: 50, step: 1, defaultValue: 5 },
    { key: 'speed', label: '속도', min: 0.1, max: 30, step: 0.1, defaultValue: 10 },
    { key: 'direction', label: '방향', min: 0, max: 2, step: 1, defaultValue: 2, type: 'select', options: [
      { value: 0, label: '수평' }, { value: 1, label: '수직' }, { value: 2, label: '양방향' }
    ]},
  ]},
  { type: 'blur', label: '흐림', params: [
    { key: 'strength', label: '강도 (고정)', min: 0, max: 20, step: 1, defaultValue: 4 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'minStrength', label: '최소 강도', min: 0, max: 20, step: 1, defaultValue: 0 },
    { key: 'maxStrength', label: '최대 강도', min: 0, max: 20, step: 1, defaultValue: 8 },
  ]},
  { type: 'rainbow', label: '무지개', params: [
    { key: 'speed', label: '속도', min: 0.1, max: 10, step: 0.1, defaultValue: 1 },
    { key: 'saturation', label: '채도', min: 0, max: 2, step: 0.01, defaultValue: 0.5 },
    { key: 'brightness', label: '밝기', min: 0, max: 2, step: 0.01, defaultValue: 0.1 },
  ]},
  { type: 'hologram', label: '홀로그램', params: [
    { key: 'scanlineSpacing', label: '스캔라인 간격', min: 1, max: 20, step: 1, defaultValue: 4 },
    { key: 'scanlineAlpha', label: '스캔라인 투명도', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'flickerSpeed', label: '깜빡임 속도', min: 0, max: 20, step: 1, defaultValue: 5 },
    { key: 'flickerIntensity', label: '깜빡임 강도', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'rgbShift', label: 'RGB 쉬프트', min: 0, max: 10, step: 1, defaultValue: 2 },
    { key: 'tintR', label: '틴트 R', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'tintG', label: '틴트 G', min: 0, max: 1, step: 0.01, defaultValue: 0.8 },
    { key: 'tintB', label: '틴트 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'outline', label: '외곽선', params: [
    { key: 'thickness', label: '두께', min: 1, max: 10, step: 1, defaultValue: 3 },
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'intensity', label: '강도', min: 0, max: 3, step: 0.1, defaultValue: 1.5 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMin', label: '애니 최소', min: 0, max: 3, step: 0.1, defaultValue: 0.8 },
    { key: 'animMax', label: '애니 최대', min: 0, max: 3, step: 0.1, defaultValue: 2.0 },
  ]},
  { type: 'fireAura', label: '불꽃 오라', params: [
    { key: 'radius', label: '반경', min: 1, max: 20, step: 1, defaultValue: 12 },
    { key: 'intensity', label: '강도', min: 0, max: 3, step: 0.1, defaultValue: 1.2 },
    { key: 'speed', label: '불꽃 속도', min: 0.1, max: 5, step: 0.1, defaultValue: 1.5 },
    { key: 'noiseScale', label: '노이즈 크기', min: 1, max: 30, step: 1, defaultValue: 8 },
    { key: 'innerColorR', label: '안쪽 색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'innerColorG', label: '안쪽 색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'innerColorB', label: '안쪽 색 B', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'outerColorR', label: '바깥 색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'outerColorG', label: '바깥 색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'outerColorB', label: '바깥 색 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'turbulence', label: '난류', min: 0, max: 5, step: 0.1, defaultValue: 1.5 },
    { key: 'flameHeight', label: '불꽃 높이', min: 0, max: 3, step: 0.1, defaultValue: 1.0 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 1 },
  ]},
  // ── 새 셰이더 (AllIn1SpriteShader 기반) ──
  { type: 'greyscale', label: '그레이스케일', params: [
    { key: 'luminosity', label: '밝기 보정', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintR', label: '틴트 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintG', label: '틴트 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintB', label: '틴트 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'negative', label: '네거티브', params: [
    { key: 'amount', label: '적용량', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'hitEffect', label: '히트 플래시', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'glow', label: '발광 강도', min: 1, max: 100, step: 1, defaultValue: 5 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'shine', label: '광택', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'location', label: '위치', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'rotate', label: '회전 (라디안)', min: 0, max: 6.28, step: 0.01, defaultValue: 0 },
    { key: 'width', label: '너비', min: 0.05, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'glowAmount', label: '발광', min: 0, max: 100, step: 1, defaultValue: 1 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 1 },
  ]},
  { type: 'flicker', label: '깜빡임', params: [
    { key: 'percent', label: '깜빡임 비율', min: 0, max: 1, step: 0.01, defaultValue: 0.05 },
    { key: 'freq', label: '빈도', min: 0, max: 5, step: 0.01, defaultValue: 0.2 },
    { key: 'alpha', label: '최소 알파', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'gradient', label: '그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '좌상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '좌상 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '좌상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '좌상 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightR', label: '우상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightG', label: '우상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightB', label: '우상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topRightA', label: '우상 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '좌하 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '좌하 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '좌하 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '좌하 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botRightR', label: '우하 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botRightG', label: '우하 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botRightB', label: '우하 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botRightA', label: '우하 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostX', label: 'X축 부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
    { key: 'boostY', label: 'Y축 부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
    { key: 'radial', label: '방사형', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '선형' }, { value: 1, label: '방사형' }
    ]},
  ]},
  { type: 'gradient2col', label: '2색 그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '상단 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '상단 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '상단 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '상단 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '하단 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '하단 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '하단 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '하단 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostY', label: 'Y축 부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
  ]},
  { type: 'radialGradient', label: '방사형 그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '중심 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '중심 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '중심 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '중심 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '외곽 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '외곽 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '외곽 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '외곽 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostX', label: '부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
  ]},
  { type: 'colorSwap', label: '색상 스왑', params: [
    { key: 'redNewR', label: 'R→새R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'redNewG', label: 'R→새G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'redNewB', label: 'R→새B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenNewR', label: 'G→새R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenNewG', label: 'G→새G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'greenNewB', label: 'G→새B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewR', label: 'B→새R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewG', label: 'B→새G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewB', label: 'B→새B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'redLum', label: 'R 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenLum', label: 'G 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueLum', label: 'B 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'hsv', label: 'HSV 시프트', params: [
    { key: 'hsvShift', label: '색조 시프트', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'hsvSaturation', label: '채도', min: -2, max: 2, step: 0.01, defaultValue: 0 },
    { key: 'hsvBright', label: '밝기', min: -2, max: 2, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'contrast', label: '명도/대비', params: [
    { key: 'contrast', label: '대비', min: 0, max: 3, step: 0.01, defaultValue: 1 },
    { key: 'brightness', label: '밝기', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'motionBlur', label: '모션 블러', params: [
    { key: 'angle', label: '각도', min: -1, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'dist', label: '거리', min: -3, max: 3, step: 0.01, defaultValue: 1.25 },
  ]},
  { type: 'ghost', label: '고스트', params: [
    { key: 'colorBoost', label: '색상 부스트', min: 0, max: 5, step: 0.1, defaultValue: 1 },
    { key: 'transparency', label: '투명도', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'shadow', label: '드롭 섀도우', params: [
    { key: 'shadowX', label: 'X 오프셋', min: -0.5, max: 0.5, step: 0.01, defaultValue: 0.1 },
    { key: 'shadowY', label: 'Y 오프셋', min: -0.5, max: 0.5, step: 0.01, defaultValue: -0.05 },
    { key: 'shadowAlpha', label: '그림자 알파', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'shadowColorR', label: '그림자 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'shadowColorG', label: '그림자 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'shadowColorB', label: '그림자 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'doodle', label: '손그림', params: [
    { key: 'amount', label: '양', min: 0, max: 20, step: 1, defaultValue: 10 },
    { key: 'speed', label: '속도', min: 1, max: 15, step: 1, defaultValue: 5 },
  ]},
  { type: 'warp', label: '워프', params: [
    { key: 'strength', label: '강도', min: 0, max: 0.1, step: 0.001, defaultValue: 0.025 },
    { key: 'speed', label: '속도', min: 0, max: 25, step: 0.5, defaultValue: 8 },
    { key: 'scale', label: '스케일', min: 0.05, max: 3, step: 0.05, defaultValue: 0.5 },
  ]},
  { type: 'twist', label: '트위스트', params: [
    { key: 'amount', label: '회전량', min: 0, max: 3.14, step: 0.01, defaultValue: 1 },
    { key: 'posX', label: '중심 X', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'posY', label: '중심 Y', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'radius', label: '반경', min: 0, max: 3, step: 0.01, defaultValue: 0.75 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'roundWave', label: '원형 파동', params: [
    { key: 'strength', label: '강도', min: 0, max: 1, step: 0.01, defaultValue: 0.7 },
    { key: 'speed', label: '속도', min: 0, max: 5, step: 0.1, defaultValue: 2 },
  ]},
  { type: 'fisheye', label: '어안 렌즈', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 0.5, step: 0.01, defaultValue: 0.35 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'pinch', label: '핀치', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 0.5, step: 0.01, defaultValue: 0.35 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'overlay', label: '오버레이', params: [
    { key: 'overlayColorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayColorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayColorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayGlow', label: '발광', min: 0, max: 25, step: 0.1, defaultValue: 1 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'multiply', label: '모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '가산' }, { value: 1, label: '곱하기' }
    ]},
  ]},
  { type: 'wind', label: '바람', params: [
    { key: 'speed', label: '속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'wind', label: '바람 세기', min: 0, max: 20, step: 0.5, defaultValue: 5 },
  ]},
  { type: 'textureScroll', label: '텍스처 스크롤', params: [
    { key: 'speedX', label: 'X 속도', min: -5, max: 5, step: 0.01, defaultValue: 0.25 },
    { key: 'speedY', label: 'Y 속도', min: -5, max: 5, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'zoomUV', label: 'UV 줌', params: [
    { key: 'zoom', label: '줌', min: 0.1, max: 5, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'rotateUV', label: 'UV 회전', params: [
    { key: 'angle', label: '각도 (라디안)', min: 0, max: 6.28, step: 0.01, defaultValue: 0 },
    { key: 'speed', label: '회전 속도', min: 0, max: 5, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'polarUV', label: '극좌표 변환', params: [
    { key: 'speed', label: '회전 속도', min: 0, max: 5, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'offsetUV', label: 'UV 오프셋', params: [
    { key: 'offsetX', label: 'X 오프셋', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'offsetY', label: 'Y 오프셋', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'clipping', label: '사각형 클리핑', params: [
    { key: 'left', label: '왼쪽', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'right', label: '오른쪽', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'up', label: '위', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'down', label: '아래', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'radialClipping', label: '방사형 클리핑', params: [
    { key: 'startAngle', label: '시작 각도', min: 0, max: 360, step: 1, defaultValue: 0 },
    { key: 'clip', label: '클리핑', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'innerOutline', label: '내부 아웃라인', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'width', label: '두께', min: 1, max: 10, step: 1, defaultValue: 2 },
    { key: 'alpha', label: '알파', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'onlyOutline', label: '아웃라인만', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '아니오' }, { value: 1, label: '예' }
    ]},
  ]},
  { type: 'alphaOutline', label: '알파 아웃라인', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'glow', label: '발광', min: 0, max: 25, step: 0.1, defaultValue: 1 },
    { key: 'power', label: '파워', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'minAlpha', label: '최소 알파', min: 0, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'distort', label: '왜곡', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 3, step: 0.01, defaultValue: 0.5 },
    { key: 'speedX', label: 'X 속도', min: -5, max: 5, step: 0.1, defaultValue: 0.5 },
    { key: 'speedY', label: 'Y 속도', min: -5, max: 5, step: 0.1, defaultValue: 0.3 },
    { key: 'scale', label: '스케일', min: 1, max: 30, step: 1, defaultValue: 5 },
  ]},
  { type: 'colorRamp', label: '컬러 램프', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'luminosity', label: '밝기 보정', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkR', label: '어두운 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkG', label: '어두운 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkB', label: '어두운 B', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'colorMidR', label: '중간 R', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorMidG', label: '중간 G', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'colorMidB', label: '중간 B', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorLightR', label: '밝은 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorLightG', label: '밝은 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'colorLightB', label: '밝은 B', min: 0, max: 1, step: 0.01, defaultValue: 0.7 },
  ]},
  { type: 'onlyOutline', label: '외곽선만', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'thickness', label: '두께', min: 1, max: 10, step: 1, defaultValue: 2 },
    { key: 'glow', label: '발광', min: 0, max: 5, step: 0.1, defaultValue: 1 },
  ]},
  { type: 'shakeUV', label: 'UV 떨림', params: [
    { key: 'speed', label: '속도', min: 0, max: 15, step: 0.5, defaultValue: 5 },
    { key: 'shakeX', label: 'X 떨림', min: 0, max: 20, step: 0.5, defaultValue: 5 },
    { key: 'shakeY', label: 'Y 떨림', min: 0, max: 20, step: 0.5, defaultValue: 5 },
  ]},
];

// ─── 셰이더 에디터 다이얼로그 (전체화면) ───
function ShaderEditorDialog({ imageName, shaderList: initialList, onOk, onCancel }: {
  imageName: string;
  shaderList: ShaderEntry[];
  onOk: (shaderList: ShaderEntry[]) => void;
  onCancel: () => void;
}) {
  const [shaderList, setShaderList] = useState<ShaderEntry[]>(initialList.map(s => ({ ...s, params: { ...s.params } })));
  const [selectedShaderIdx, setSelectedShaderIdx] = useState<number>(0);

  const addShader = () => {
    const def = SHADER_DEFINITIONS[0];
    const params: Record<string, number> = {};
    def.params.forEach(pd => { params[pd.key] = pd.defaultValue; });
    const newList = [...shaderList, { type: def.type, enabled: true, params }];
    setShaderList(newList);
    setSelectedShaderIdx(newList.length - 1);
  };

  const removeShader = (idx: number) => {
    const newList = shaderList.filter((_, i) => i !== idx);
    setShaderList(newList);
    setSelectedShaderIdx(Math.min(selectedShaderIdx, Math.max(0, newList.length - 1)));
  };

  const updateShaderType = (idx: number, newType: string) => {
    const def = SHADER_DEFINITIONS.find(d => d.type === newType);
    const params: Record<string, number> = {};
    def?.params.forEach(pd => { params[pd.key] = pd.defaultValue; });
    setShaderList(prev => prev.map((s, i) => i === idx ? { ...s, type: newType, params } : s));
  };

  const updateShaderParam = (idx: number, key: string, value: number) => {
    setShaderList(prev => prev.map((s, i) => i === idx ? { ...s, params: { ...s.params, [key]: value } } : s));
  };

  const moveShader = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= shaderList.length) return;
    const newList = [...shaderList];
    [newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]];
    setShaderList(newList);
    setSelectedShaderIdx(newIdx);
  };

  const selectedShader = shaderList[selectedShaderIdx];
  const selectedShaderDef = selectedShader ? SHADER_DEFINITIONS.find(d => d.type === selectedShader.type) : null;
  const labelStyle: React.CSSProperties = { fontSize: 13, color: '#aaa' };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: '90vw', maxWidth: 1200, height: '85vh', maxHeight: 900, display: 'flex', flexDirection: 'column' }}>
        <div className="image-picker-header">셰이더 이펙트 설정</div>
        <div style={{ flex: 1, overflow: 'hidden', padding: 16, display: 'flex', gap: 16 }}>
          {/* 좌측: 프리뷰 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <ShaderPreviewCanvas imageName={imageName} shaderList={shaderList} size={480} />
          </div>
          {/* 우측: 셰이더 리스트 + 파라미터 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {/* 셰이더 리스트 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#ddd', flex: 1 }}>이펙트 목록</span>
              <button className="db-btn" onClick={addShader}>추가</button>
            </div>
            <div style={{
              border: '1px solid #444', borderRadius: 4, background: '#1e1e1e',
              minHeight: 80, maxHeight: 200, overflowY: 'auto', flexShrink: 0,
            }}>
              {shaderList.length === 0 && (
                <div style={{ color: '#666', fontSize: 13, padding: '20px 12px', textAlign: 'center' }}>
                  셰이더 없음 - 추가 버튼으로 이펙트를 추가하세요
                </div>
              )}
              {shaderList.map((entry, idx) => {
                const def = SHADER_DEFINITIONS.find(d => d.type === entry.type);
                return (
                  <div key={idx}
                    onClick={() => setSelectedShaderIdx(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                      background: idx === selectedShaderIdx ? '#2675bf' : 'transparent',
                      color: idx === selectedShaderIdx ? '#fff' : '#ccc',
                    }}>
                    <span style={{ flex: 1 }}>{idx + 1}. {def?.label ?? entry.type}</span>
                    <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px' }}
                      onClick={e => { e.stopPropagation(); moveShader(idx, -1); }}
                      disabled={idx === 0} title="위로">▲</button>
                    <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px' }}
                      onClick={e => { e.stopPropagation(); moveShader(idx, 1); }}
                      disabled={idx === shaderList.length - 1} title="아래로">▼</button>
                    <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }}
                      onClick={e => { e.stopPropagation(); removeShader(idx); }}
                      title="삭제">✕</button>
                  </div>
                );
              })}
            </div>
            {/* 선택된 셰이더 파라미터 */}
            {selectedShader && selectedShaderDef && (
              <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #444', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ ...labelStyle, fontSize: 14 }}>
                  타입:
                  <select value={selectedShader.type}
                    onChange={e => updateShaderType(selectedShaderIdx, e.target.value)}
                    style={{ ...selectStyle, marginLeft: 8, fontSize: 13 }}>
                    {SHADER_DEFINITIONS.map(sd => (
                      <option key={sd.type} value={sd.type}>{sd.label}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  {selectedShaderDef.params.map(pd => (
                    <label key={pd.key} style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ minWidth: 90, flexShrink: 0 }}>{pd.label}:</span>
                      {pd.type === 'select' && pd.options ? (
                        <select value={selectedShader.params[pd.key] ?? pd.defaultValue}
                          onChange={e => updateShaderParam(selectedShaderIdx, pd.key, Number(e.target.value))}
                          style={{ ...selectStyle, flex: 1 }}>
                          {pd.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input type="range" min={pd.min} max={pd.max} step={pd.step}
                            value={selectedShader.params[pd.key] ?? pd.defaultValue}
                            onChange={e => updateShaderParam(selectedShaderIdx, pd.key, Number(e.target.value))}
                            style={{ flex: 1 }} />
                          <input type="number" min={pd.min} max={pd.max} step={pd.step}
                            value={selectedShader.params[pd.key] ?? pd.defaultValue}
                            onChange={e => updateShaderParam(selectedShaderIdx, pd.key, Number(e.target.value))}
                            style={{ ...selectStyle, width: 60 }} />
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => onOk(shaderList)}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── 그림 표시 (Show Picture, code 231) ───
// parameters: [번호, 이미지명, 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 셰이더데이터?]
export function ShowPictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [imageName, setImageName] = useState<string>((p[1] as string) || '');
  const [origin, setOrigin] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 0);
  const [posX, setPosX] = useState<number>((p[4] as number) || 0);
  const [posY, setPosY] = useState<number>((p[5] as number) || 0);
  const [scaleWidth, setScaleWidth] = useState<number>((p[6] as number) ?? 100);
  const [scaleHeight, setScaleHeight] = useState<number>((p[7] as number) ?? 100);
  const [opacity, setOpacity] = useState<number>((p[8] as number) ?? 255);
  const [blendMode, setBlendMode] = useState<number>((p[9] as number) || 0);

  // 프리셋 위치 데이터 초기화
  const existingPreset = p[11] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
  const [presetX, setPresetX] = useState<number>(existingPreset?.presetX ?? 3);
  const [presetY, setPresetY] = useState<number>(existingPreset?.presetY ?? 3);
  const [presetOffsetX, setPresetOffsetX] = useState<number>(existingPreset?.offsetX ?? 0);
  const [presetOffsetY, setPresetOffsetY] = useState<number>(existingPreset?.offsetY ?? 0);

  // 셰이더 데이터 초기화 (배열 지원)
  const initShaderList = (): ShaderEntry[] => {
    const raw = p[10];
    if (!raw) return [];
    // 배열 형태
    if (Array.isArray(raw)) return (raw as ShaderEntry[]).map(s => ({ ...s, params: { ...s.params } }));
    // 단일 객체 (하위 호환)
    const single = raw as ShaderEntry;
    if (single.enabled) return [{ ...single, params: { ...single.params } }];
    return [];
  };
  const [shaderList, setShaderList] = useState<ShaderEntry[]>(initShaderList);
  const [showShaderDialog, setShowShaderDialog] = useState(false);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>
            번호:
            <input type="number" min={1} max={100} value={pictureNumber}
              onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
          <div style={{ ...labelStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>이미지:</span>
            <ImagePicker type="pictures" value={imageName} onChange={setImageName} />
          </div>
        </div>
      </fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* 위치 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, flex: 1 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              원점:
              <select value={origin} onChange={e => setOrigin(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                <option value={0}>왼쪽 위</option>
                <option value={1}>중앙</option>
              </select>
            </label>

            {/* 직접 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
              직접 지정
            </label>
            {positionType === 0 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <input type="number" min={-9999} max={9999} value={posX}
                  onChange={e => setPosX(Number(e.target.value))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <input type="number" min={-9999} max={9999} value={posY}
                  onChange={e => setPosY(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            )}

            {/* 변수로 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            {positionType === 1 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <VariableSwitchPicker type="variable" value={posX || 1}
                  onChange={setPosX} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <VariableSwitchPicker type="variable" value={posY || 1}
                  onChange={setPosY} style={{ flex: 1 }} />
              </div>
            </div>
            )}

            {/* 프리셋 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 2} onChange={() => setPositionType(2)} />
              프리셋 지정
            </label>
            {positionType === 2 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <select value={presetX} onChange={e => setPresetX(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70 }}>
                  <option value={1}>0%</option>
                  <option value={2}>25%</option>
                  <option value={3}>50%</option>
                  <option value={4}>75%</option>
                  <option value={5}>100%</option>
                </select>
                <span style={{ ...labelStyle, marginLeft: 4 }}>+</span>
                <input type="number" min={-9999} max={9999} value={presetOffsetX}
                  onChange={e => setPresetOffsetX(Number(e.target.value))}
                  style={{ ...selectStyle, width: 60 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <select value={presetY} onChange={e => setPresetY(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70 }}>
                  <option value={1}>0%</option>
                  <option value={2}>25%</option>
                  <option value={3}>50%</option>
                  <option value={4}>75%</option>
                  <option value={5}>100%</option>
                </select>
                <span style={{ ...labelStyle, marginLeft: 4 }}>+</span>
                <input type="number" min={-9999} max={9999} value={presetOffsetY}
                  onChange={e => setPresetOffsetY(Number(e.target.value))}
                  style={{ ...selectStyle, width: 60 }} />
              </div>
            </div>
            )}
          </div>
        </fieldset>

        {/* 배율 + 합성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>배율</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                넓이:
                <input type="number" min={0} max={2000} value={scaleWidth}
                  onChange={e => setScaleWidth(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
              <label style={labelStyle}>
                높이:
                <input type="number" min={0} max={2000} value={scaleHeight}
                  onChange={e => setScaleHeight(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>합성</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                불투명도:
                <input type="number" min={0} max={255} value={opacity}
                  onChange={e => setOpacity(Math.max(0, Math.min(255, Number(e.target.value))))}
                  style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
              </label>
              <label style={labelStyle}>
                합성 방법:
                <select value={blendMode} onChange={e => setBlendMode(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                  <option value={0}>일반</option>
                  <option value={1}>추가 합성</option>
                  <option value={2}>곱하기</option>
                  <option value={3}>스크린</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* 셰이더 이펙트 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>셰이더 이펙트</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="db-btn" onClick={() => setShowShaderDialog(true)}>
            셰이더 설정...
          </button>
          <span style={{ fontSize: 12, color: shaderList.length > 0 ? '#7cb3ff' : '#666' }}>
            {shaderList.length > 0
              ? shaderList.map(s => SHADER_DEFINITIONS.find(d => d.type === s.type)?.label ?? s.type).join(' + ')
              : '없음'}
          </span>
          {shaderList.length > 0 && (
            <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }}
              onClick={() => setShaderList([])}>초기화</button>
          )}
        </div>
      </fieldset>
      {showShaderDialog && (
        <ShaderEditorDialog
          imageName={imageName}
          shaderList={shaderList}
          onOk={(list) => { setShaderList(list); setShowShaderDialog(false); }}
          onCancel={() => setShowShaderDialog(false)}
        />
      )}

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const shaderData = shaderList.length > 0 ? shaderList.map(s => ({ type: s.type, enabled: true, params: { ...s.params } })) : null;
          const presetData = positionType === 2 ? { presetX, presetY, offsetX: presetOffsetX, offsetY: presetOffsetY } : null;
          onOk([pictureNumber, imageName, origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, shaderData, presetData]);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림 이동 (Move Picture, code 232) ───
// parameters: [번호, (unused), 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 지속시간, 완료까지대기]
export function MovePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [origin, setOrigin] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 0);
  const [posX, setPosX] = useState<number>((p[4] as number) || 0);
  const [posY, setPosY] = useState<number>((p[5] as number) || 0);
  const [scaleWidth, setScaleWidth] = useState<number>((p[6] as number) ?? 100);
  const [scaleHeight, setScaleHeight] = useState<number>((p[7] as number) ?? 100);
  const [opacity, setOpacity] = useState<number>((p[8] as number) ?? 255);
  const [blendMode, setBlendMode] = useState<number>((p[9] as number) || 0);
  const [duration, setDuration] = useState<number>((p[10] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>(p[11] !== undefined ? !!p[11] : true);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <label style={labelStyle}>
          번호:
          <input type="number" min={1} max={100} value={pictureNumber}
            onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
        </label>
      </fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* 위치 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, flex: 1 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              원점:
              <select value={origin} onChange={e => setOrigin(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                <option value={0}>왼쪽 위</option>
                <option value={1}>중앙</option>
              </select>
            </label>

            {/* 직접 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
              직접 지정
            </label>
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: positionType === 0 ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <input type="number" min={-9999} max={9999} value={positionType === 0 ? posX : 0}
                  onChange={e => setPosX(Number(e.target.value))}
                  disabled={positionType !== 0} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <input type="number" min={-9999} max={9999} value={positionType === 0 ? posY : 0}
                  onChange={e => setPosY(Number(e.target.value))}
                  disabled={positionType !== 0} style={inputStyle} />
              </div>
            </div>

            {/* 변수로 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: positionType === 1 ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <VariableSwitchPicker type="variable" value={positionType === 1 ? (posX || 1) : 1}
                  onChange={setPosX} disabled={positionType !== 1} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <VariableSwitchPicker type="variable" value={positionType === 1 ? (posY || 1) : 1}
                  onChange={setPosY} disabled={positionType !== 1} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </fieldset>

        {/* 배율 + 합성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>배율</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                넓이:
                <input type="number" min={0} max={2000} value={scaleWidth}
                  onChange={e => setScaleWidth(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
              <label style={labelStyle}>
                높이:
                <input type="number" min={0} max={2000} value={scaleHeight}
                  onChange={e => setScaleHeight(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>합성</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                불투명도:
                <input type="number" min={0} max={255} value={opacity}
                  onChange={e => setOpacity(Math.max(0, Math.min(255, Number(e.target.value))))}
                  style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
              </label>
              <label style={labelStyle}>
                합성 방법:
                <select value={blendMode} onChange={e => setBlendMode(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                  <option value={0}>일반</option>
                  <option value={1}>추가 합성</option>
                  <option value={2}>곱하기</option>
                  <option value={3}>스크린</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, '', origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림 회전 (Rotate Picture, code 233) ───
// parameters: [번호, 속도]
export function RotatePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [speed, setSpeed] = useState<number>((p[1] as number) || 0);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* 그림 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
          <label style={labelStyle}>
            번호:
            <input type="number" min={1} max={100} value={pictureNumber}
              onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
        </fieldset>

        {/* 회전 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>회전</legend>
          <label style={labelStyle}>
            속도:
            <input type="number" min={-90} max={90} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
        </fieldset>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, speed])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 화면의 색조 변경 (Tint Screen, code 223) ───
// parameters: [[R,G,B,Gray], 지속시간, 완료까지대기]
export function TintScreenEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const tone = (p[0] as number[] | undefined) || [0, 0, 0, 0];
  const [red, setRed] = useState<number>(tone[0] || 0);
  const [green, setGreen] = useState<number>(tone[1] || 0);
  const [blue, setBlue] = useState<number>(tone[2] || 0);
  const [gray, setGray] = useState<number>(tone[3] || 0);
  const [duration, setDuration] = useState<number>((p[1] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[2] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  const applyPreset = (name: string) => {
    const [pr, pg, pb, pgray] = TINT_PRESETS[name];
    setRed(pr); setGreen(pg); setBlue(pb); setGray(pgray);
  };

  return (
    <>
      {/* 색조 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>색조</legend>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>빨강:</span>
              <input type="range" min={-255} max={255} value={red}
                onChange={e => setRed(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={red}
                onChange={e => setRed(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>초록:</span>
              <input type="range" min={-255} max={255} value={green}
                onChange={e => setGreen(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={green}
                onChange={e => setGreen(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>파랑:</span>
              <input type="range" min={-255} max={255} value={blue}
                onChange={e => setBlue(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={blue}
                onChange={e => setBlue(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>그레이:</span>
              <input type="range" min={0} max={255} value={gray}
                onChange={e => setGray(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={gray}
                onChange={e => setGray(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
          </div>
          <TintColorPreview r={red} g={green} b={blue} gray={gray} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {Object.keys(TINT_PRESETS).map(name => (
            <button key={name} className="db-btn" style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
              onClick={() => applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([[red, green, blue, gray], duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 화면의 플래시 (Flash Screen, code 224) ───
// parameters: [[R,G,B,A(진한정도)], 지속시간, 완료까지대기]
export function FlashScreenEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const color = (p[0] as number[] | undefined) || [255, 255, 255, 170];
  const [red, setRed] = useState<number>(color[0] ?? 255);
  const [green, setGreen] = useState<number>(color[1] ?? 255);
  const [blue, setBlue] = useState<number>(color[2] ?? 255);
  const [alpha, setAlpha] = useState<number>(color[3] ?? 170);
  const [duration, setDuration] = useState<number>((p[1] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[2] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      {/* 플래쉬 색깔 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>플래쉬 색깔</legend>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>빨강:</span>
              <input type="range" min={0} max={255} value={red}
                onChange={e => setRed(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={red}
                onChange={e => setRed(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>초록:</span>
              <input type="range" min={0} max={255} value={green}
                onChange={e => setGreen(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={green}
                onChange={e => setGreen(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>파랑:</span>
              <input type="range" min={0} max={255} value={blue}
                onChange={e => setBlue(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={blue}
                onChange={e => setBlue(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>진한 정도:</span>
              <input type="range" min={0} max={255} value={alpha}
                onChange={e => setAlpha(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={alpha}
                onChange={e => setAlpha(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
          </div>
          <FlashColorPreview r={red} g={green} b={blue} a={alpha} />
        </div>
      </fieldset>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([[red, green, blue, alpha], duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

function FlashColorPreview({ r, g, b, a }: { r: number; g: number; b: number; a: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    // 무지개 그라데이션 배경 생성
    const imgData = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const hue = (px / w) * 360;
        const lightness = 1 - (py / h);
        const [baseR, baseG, baseB] = hslToRgb(hue, 1, lightness * 0.5 + 0.25);

        // 플래시 색상 오버레이 (alpha 블렌딩)
        const t = a / 255;
        const fr = baseR * (1 - t) + r * t;
        const fg = baseG * (1 - t) + g * t;
        const fb = baseB * (1 - t) + b * t;

        const idx = (py * w + px) * 4;
        imgData.data[idx] = Math.max(0, Math.min(255, fr));
        imgData.data[idx + 1] = Math.max(0, Math.min(255, fg));
        imgData.data[idx + 2] = Math.max(0, Math.min(255, fb));
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [r, g, b, a]);

  return <canvas ref={canvasRef} width={120} height={120} style={{ borderRadius: 4, border: '1px solid #555' }} />;
}

// ─── 화면 흔들리기 (Shake Screen, code 225) ───
// parameters: [강도, 속도, 지속시간, 완료까지대기]
export function ShakeScreenEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [power, setPower] = useState<number>((p[0] as number) ?? 5);
  const [speed, setSpeed] = useState<number>((p[1] as number) ?? 5);
  const [duration, setDuration] = useState<number>((p[2] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[3] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      {/* 흔들리기 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>흔들리기</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>강도:</span>
            <input type="range" min={1} max={9} value={power}
              onChange={e => setPower(Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" min={1} max={9} value={power}
              onChange={e => setPower(Math.max(1, Math.min(9, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60 }} />
          </div>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>속도:</span>
            <input type="range" min={1} max={9} value={speed}
              onChange={e => setSpeed(Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" min={1} max={9} value={speed}
              onChange={e => setSpeed(Math.max(1, Math.min(9, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60 }} />
          </div>
        </div>
      </fieldset>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([power, speed, duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 날씨 효과 설정 (Set Weather Effect, code 236) ───
// parameters: [type, power, duration, waitForCompletion]
// type: 0=없음, 1=비, 2=폭풍, 3=눈
const WEATHER_TYPES = [
  { value: 0, label: '없음' },
  { value: 1, label: '비' },
  { value: 2, label: '폭풍' },
  { value: 3, label: '눈' },
];

export function SetWeatherEffectEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [type, setType] = useState<number>((p[0] as number) ?? 0);
  const [power, setPower] = useState<number>((p[1] as number) ?? 5);
  const [duration, setDuration] = useState<number>((p[2] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[3] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      {/* 날씨 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>날씨</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>유형:</span>
            <select value={type} onChange={e => setType(Number(e.target.value))} style={{ ...selectStyle, flex: 1 }}>
              {WEATHER_TYPES.map(w => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>강도:</span>
            <input type="range" min={1} max={9} value={power}
              onChange={e => setPower(Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" min={1} max={9} value={power}
              onChange={e => setPower(Math.max(1, Math.min(9, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60 }} />
          </div>
        </div>
      </fieldset>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([type, power, duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림의 색조 변경 (Tint Picture, code 234) ───
// parameters: [번호, [R,G,B,Gray], 지속시간, 완료까지대기]
const TINT_PRESETS: Record<string, [number, number, number, number]> = {
  '보통': [0, 0, 0, 0],
  '다크': [-68, -68, -68, 0],
  '세피아': [34, -34, -68, 170],
  '석양': [68, -34, -34, 0],
  '밤': [-68, -68, 0, 68],
};

function TintColorPreview({ r, g, b, gray }: { r: number; g: number; b: number; gray: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    // 무지개 그라데이션 배경 생성
    const imgData = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const hue = (px / w) * 360;
        const lightness = 1 - (py / h);
        const [baseR, baseG, baseB] = hslToRgb(hue, 1, lightness * 0.5 + 0.25);

        // 색조 적용
        let fr = Math.max(0, Math.min(255, baseR + r));
        let fg = Math.max(0, Math.min(255, baseG + g));
        let fb = Math.max(0, Math.min(255, baseB + b));

        // 그레이 필터 적용
        if (gray > 0) {
          const grayVal = fr * 0.299 + fg * 0.587 + fb * 0.114;
          const t = gray / 255;
          fr = fr * (1 - t) + grayVal * t;
          fg = fg * (1 - t) + grayVal * t;
          fb = fb * (1 - t) + grayVal * t;
        }

        const idx = (py * w + px) * 4;
        imgData.data[idx] = Math.max(0, Math.min(255, fr));
        imgData.data[idx + 1] = Math.max(0, Math.min(255, fg));
        imgData.data[idx + 2] = Math.max(0, Math.min(255, fb));
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [r, g, b, gray]);

  return <canvas ref={canvasRef} width={120} height={120} style={{ borderRadius: 4, border: '1px solid #555' }} />;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function TintPictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const tone = (p[1] as number[] | undefined) || [0, 0, 0, 0];
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [red, setRed] = useState<number>(tone[0] || 0);
  const [green, setGreen] = useState<number>(tone[1] || 0);
  const [blue, setBlue] = useState<number>(tone[2] || 0);
  const [gray, setGray] = useState<number>(tone[3] || 0);
  const [duration, setDuration] = useState<number>((p[2] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[3] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  const applyPreset = (name: string) => {
    const [pr, pg, pb, pgray] = TINT_PRESETS[name];
    setRed(pr);
    setGreen(pg);
    setBlue(pb);
    setGray(pgray);
  };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <label style={labelStyle}>
          번호:
          <input type="number" min={1} max={100} value={pictureNumber}
            onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
        </label>
      </fieldset>

      {/* 색조 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>색조</legend>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>빨강:</span>
              <input type="range" min={-255} max={255} value={red}
                onChange={e => setRed(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={red}
                onChange={e => setRed(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>초록:</span>
              <input type="range" min={-255} max={255} value={green}
                onChange={e => setGreen(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={green}
                onChange={e => setGreen(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>파랑:</span>
              <input type="range" min={-255} max={255} value={blue}
                onChange={e => setBlue(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={blue}
                onChange={e => setBlue(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>그레이:</span>
              <input type="range" min={0} max={255} value={gray}
                onChange={e => setGray(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={gray}
                onChange={e => setGray(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
          </div>
          <TintColorPreview r={red} g={green} b={blue} gray={gray} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {Object.keys(TINT_PRESETS).map(name => (
            <button key={name} className="db-btn" style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
              onClick={() => applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, [red, green, blue, gray], duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
