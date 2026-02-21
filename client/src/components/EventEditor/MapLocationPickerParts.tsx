import React from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorPointLight } from '../../types/rpgMakerMV';

const TILE_SIZE = 48;

interface MapEvent {
  id: number; name: string; x: number; y: number;
}

// --- PointLightMarkers: 맵 위에 포인트라이트 & 이벤트 마커 표시 ---

interface PointLightMarkersProps {
  pointLights: EditorPointLight[];
  mapEvents: MapEvent[];
  selectedLightId: number | null;
  canvasScale: number;
}

export function PointLightMarkers({ pointLights, mapEvents, selectedLightId, canvasScale: s }: PointLightMarkersProps) {
  return (
    <>
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
}

// --- PointLightList: 포인트라이트 사이드바 목록 ---

interface PointLightListProps {
  pointLights: EditorPointLight[];
  mapEvents: MapEvent[];
  selectedLightId: number | null;
  onSelect: (id: number) => void;
  onDoubleClick: (id: number) => void;
}

export function PointLightList({ pointLights, mapEvents, selectedLightId, onSelect, onDoubleClick }: PointLightListProps) {
  const { t } = useTranslation();
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
            onClick={() => onSelect(pl.id)}
            onDoubleClick={() => onDoubleClick(pl.id)}
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
}
