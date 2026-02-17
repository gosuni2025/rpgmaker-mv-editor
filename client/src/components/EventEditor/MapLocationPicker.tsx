import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { selectStyle } from './messageEditors';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import { useThreeRenderer } from '../MapEditor/useThreeRenderer';
import type { EditorPointLight } from '../../types/rpgMakerMV';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

const TILE_SIZE = 48;

interface BaseProps {
  mapId: number; x: number; y: number;
  onCancel: () => void;
  fixedMap?: boolean;
  eventMarker?: { x: number; y: number; label: string };
}

interface LocationMode extends BaseProps {
  mode?: 'location';
  onOk: (mapId: number, x: number, y: number) => void;
  onSelectLight?: never;
  selectedLightId?: never;
}

interface PointLightMode extends BaseProps {
  mode: 'pointlight';
  onOk?: never;
  onSelectLight: (lightId: number) => void;
  selectedLightId?: number;
}

type MapLocationPickerProps = LocationMode | PointLightMode;

/** 맵 위치 선택 다이얼로그 - 왼쪽 맵 목록 + 오른쪽 2D 맵 프리뷰 */
export function MapLocationPicker(props: MapLocationPickerProps) {
  const { mapId, x, y, onCancel, fixedMap, eventMarker, mode } = props;
  const { t } = useTranslation();
  const maps = useEditorStore(s => s.maps);
  const currentMap = useEditorStore(s => s.currentMap);
  const [selectedMapId, setSelectedMapId] = useState(mapId);
  const [selectedX, setSelectedX] = useState(x);
  const [selectedY, setSelectedY] = useState(y);
  const [selectedLightId, setSelectedLightId] = useState<number | null>(
    mode === 'pointlight' ? (props.selectedLightId ?? null) : null
  );
  const [canvasScale, setCanvasScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [mapData, setMapData] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  const isPointLightMode = mode === 'pointlight';

  // 포인트라이트 & 이벤트 목록 (pointlight 모드에서 사용)
  const pointLights: EditorPointLight[] = isPointLightMode
    ? (currentMap?.editorLights?.points ?? [])
    : [];

  const mapEvents = useMemo(() => {
    if (!isPointLightMode || !currentMap?.events) return [];
    return currentMap.events
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map(e => ({ id: e.id, name: e.name, x: e.x, y: e.y }));
  }, [isPointLightMode, currentMap]);

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

  const filteredMapList = useMemo(() => {
    if (!mapSearchQuery) return mapList;
    return mapList.filter(m => fuzzyMatch(`${String(m.id).padStart(3, '0')}: ${m.name}`, mapSearchQuery));
  }, [mapList, mapSearchQuery]);

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

  // 맵 캔버스 클릭 → 좌표 지정 or 포인트라이트 선택
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const tileX = Math.floor(px / TILE_SIZE);
    const tileY = Math.floor(py / TILE_SIZE);

    if (isPointLightMode) {
      // 가장 가까운 포인트라이트 선택
      let closest: number | null = null;
      let closestDist = Infinity;
      for (const pl of pointLights) {
        const dist = Math.abs(pl.x - tileX) + Math.abs(pl.y - tileY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = pl.id;
        }
      }
      if (closest !== null && closestDist <= 3) {
        setSelectedLightId(closest);
      }
    } else {
      if (tileX >= 0 && tileX < mapData.width && tileY >= 0 && tileY < mapData.height) {
        setSelectedX(tileX);
        setSelectedY(tileY);
      }
    }
  }, [mapData, isPointLightMode, pointLights]);

  // 캔버스 래퍼 스타일 (줌 + 팬)
  const canvasWrapperStyle = useMemo((): React.CSSProperties => {
    if (!mapData) return { position: 'relative', display: 'inline-block' };
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
    return {
      cursor: 'crosshair',
      display: 'block',
      width: mapData.width * TILE_SIZE * canvasScale,
      height: mapData.height * TILE_SIZE * canvasScale,
    };
  }, [mapData, canvasScale]);

  // 마커 오버레이 (선택한 좌표 표시)
  const markerStyle = useMemo((): React.CSSProperties | null => {
    if (isPointLightMode || !mapData || !canvasScale) return null;
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
  }, [isPointLightMode, selectedX, selectedY, canvasScale, mapData]);

  // 이벤트 위치 마커 오버레이
  const eventMarkerStyle = useMemo((): React.CSSProperties | null => {
    if (!eventMarker || !mapData || !canvasScale) return null;
    const s = canvasScale;
    return {
      position: 'absolute',
      left: eventMarker.x * TILE_SIZE * s,
      top: eventMarker.y * TILE_SIZE * s,
      width: TILE_SIZE * s,
      height: TILE_SIZE * s,
      border: '2px solid #4af',
      background: 'rgba(68, 170, 255, 0.25)',
      pointerEvents: 'none',
      boxSizing: 'border-box',
    };
  }, [eventMarker, canvasScale, mapData]);

  // 포인트라이트 모드 마커 렌더링
  const renderPointLightMarkers = () => {
    if (!isPointLightMode || !mapData || !canvasScale) return null;
    const s = canvasScale;
    return (
      <>
        {/* 이벤트 위치 마커 */}
        {mapEvents.map(ev => (
          <div key={`ev-${ev.id}`} style={{
            position: 'absolute',
            left: ev.x * TILE_SIZE * s,
            top: ev.y * TILE_SIZE * s,
            width: TILE_SIZE * s,
            height: TILE_SIZE * s,
            border: '1px solid rgba(68, 170, 255, 0.5)',
            background: 'rgba(68, 170, 255, 0.15)',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}>
            <span style={{
              position: 'absolute', top: -14, left: 0, whiteSpace: 'nowrap',
              fontSize: 9, color: '#4af', textShadow: '0 0 3px #000',
              pointerEvents: 'none',
            }}>{ev.name || `EV${String(ev.id).padStart(3, '0')}`}</span>
          </div>
        ))}
        {/* 포인트라이트 마커 */}
        {pointLights.map(pl => {
          const isSelected = pl.id === selectedLightId;
          return (
            <div key={`pl-${pl.id}`} style={{
              position: 'absolute',
              left: pl.x * TILE_SIZE * s + TILE_SIZE * s / 2 - 6 * s,
              top: pl.y * TILE_SIZE * s + TILE_SIZE * s / 2 - 6 * s,
              width: 12 * s,
              height: 12 * s,
              borderRadius: '50%',
              background: pl.color,
              border: isSelected ? '2px solid #ff0' : '1px solid rgba(255,255,255,0.6)',
              boxShadow: isSelected ? '0 0 8px #ff0' : `0 0 ${Math.min(pl.distance * s * 0.1, 20)}px ${pl.color}`,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}>
              <span style={{
                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                whiteSpace: 'nowrap', fontSize: 9, color: '#ffa',
                textShadow: '0 0 3px #000',
                pointerEvents: 'none',
              }}>#{pl.id} ({pl.x},{pl.y})</span>
            </div>
          );
        })}
      </>
    );
  };

  // 포인트라이트 모드: 사이드바에 목록 표시
  const renderPointLightList = () => {
    if (!isPointLightMode) return null;
    return (
      <div style={{ width: 200, minWidth: 200, borderRight: '1px solid #444', overflowY: 'auto' }}>
        <div style={{ padding: '4px 8px', fontSize: 11, color: '#888', borderBottom: '1px solid #333' }}>
          {t('addonCommands.pointLightList')}
        </div>
        {pointLights.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: '#666', textAlign: 'center' }}>
            {t('addonCommands.noPointLights')}
          </div>
        ) : (
          pointLights.map(pl => (
            <div
              key={pl.id}
              onClick={() => setSelectedLightId(pl.id)}
              onDoubleClick={() => props.onSelectLight(pl.id)}
              style={{
                padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ddd',
                background: pl.id === selectedLightId ? '#2675bf' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: pl.color, border: '1px solid #888', flexShrink: 0,
              }} />
              <span>#{pl.id} ({pl.x}, {pl.y})</span>
              <span style={{ color: '#888', fontSize: 10, marginLeft: 'auto' }}>
                I:{pl.intensity}
              </span>
            </div>
          ))
        )}
        {/* 이벤트 목록 */}
        {mapEvents.length > 0 && (
          <>
            <div style={{ padding: '4px 8px', fontSize: 11, color: '#888', borderBottom: '1px solid #333', borderTop: '1px solid #333', marginTop: 4 }}>
              {t('addonCommands.eventList')}
            </div>
            {mapEvents.map(ev => (
              <div key={`ev-${ev.id}`} style={{
                padding: '3px 8px', fontSize: 11, color: '#8ac',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ color: '#4af', fontSize: 10 }}>EV</span>
                <span>{ev.name || `EV${String(ev.id).padStart(3, '0')}`}</span>
                <span style={{ color: '#666', fontSize: 10, marginLeft: 'auto' }}>({ev.x},{ev.y})</span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  const handleOk = () => {
    if (isPointLightMode) {
      if (selectedLightId != null) props.onSelectLight(selectedLightId);
    } else {
      props.onOk(selectedMapId, selectedX, selectedY);
    }
  };

  const showMapList = !fixedMap && !isPointLightMode;

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: '90vw', maxWidth: 1200, height: '85vh', maxHeight: 900 }}>
        <div className="image-picker-header">
          {isPointLightMode ? t('addonCommands.selectPointLight') : (fixedMap ? '위치' : '맵 선택')}
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 왼쪽: 맵 목록 또는 포인트라이트 목록 */}
          {showMapList && <div style={{ width: 200, minWidth: 200, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #444' }}>
              <input
                type="text"
                placeholder="검색 (초성 지원)"
                value={mapSearchQuery}
                onChange={e => setMapSearchQuery(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '3px 6px', background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, color: '#ddd', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredMapList.map(m => (
                <div key={m.id} style={{
                  padding: '3px 8px', paddingLeft: mapSearchQuery ? 8 : 8 + m.indent * 16,
                  cursor: 'pointer', fontSize: 12, color: '#ddd',
                  background: m.id === selectedMapId ? '#2675bf' : 'transparent',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                  onClick={() => setSelectedMapId(m.id)}
                >
                  {String(m.id).padStart(3, '0')}: {m.name}
                </div>
              ))}
            </div>
          </div>}
          {renderPointLightList()}
          {/* 오른쪽: 맵 프리뷰 (휠 줌, 미들 클릭 팬) */}
          <div ref={previewContainerRef}
            onMouseDown={handleMouseDown}
            style={{ flex: 1, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
            <div style={canvasWrapperStyle}>
              <canvas ref={canvasRef} onClick={handleCanvasClick}
                style={canvasStyle} />
              {markerStyle && <div style={markerStyle} />}
              {eventMarkerStyle && eventMarker && (
                <div style={eventMarkerStyle}>
                  <span style={{
                    position: 'absolute', top: -18, left: 0, whiteSpace: 'nowrap',
                    fontSize: 11, color: '#4af', textShadow: '0 0 3px #000, 0 0 3px #000',
                    pointerEvents: 'none',
                  }}>{eventMarker.label}</span>
                </div>
              )}
              {renderPointLightMarkers()}
            </div>
          </div>
        </div>
        {/* 하단: 좌표 + 버튼 */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #444', display: 'flex', alignItems: 'center', gap: 12 }}>
          {isPointLightMode ? (
            <span style={{ fontSize: 12, color: '#aaa' }}>
              {selectedLightId != null
                ? `${t('addonCommands.selected')}: #${selectedLightId}`
                : t('addonCommands.selectPointLightHint')}
            </span>
          ) : (
            <>
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
            </>
          )}
          <div style={{ flex: 1 }} />
          <button className="db-btn" onClick={handleOk}
            disabled={isPointLightMode && selectedLightId == null}>OK</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
