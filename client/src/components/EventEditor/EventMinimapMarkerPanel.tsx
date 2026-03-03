import React from 'react';
import type { MinimapMarkerData, MinimapMarkerShape } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import ExtBadge from '../common/ExtBadge';

interface EventMinimapMarkerPanelProps {
  minimapMarker: MinimapMarkerData | null;
  setMinimapMarker: React.Dispatch<React.SetStateAction<MinimapMarkerData | null>>;
}

export default function EventMinimapMarkerPanel({ minimapMarker, setMinimapMarker }: EventMinimapMarkerPanelProps) {
  return (
    <div className="event-editor-name-label event-editor-minimap-label">
      미니맵:
      <label className="event-editor-npc-show-check">
        <input type="checkbox" checked={minimapMarker?.enabled ?? false} onChange={e => {
          setMinimapMarker(prev => e.target.checked
            ? { enabled: true, color: prev?.color ?? '#ffcc00', shape: prev?.shape ?? 'circle', iconIndex: prev?.iconIndex }
            : prev ? { ...prev, enabled: false } : null);
        }} />
        표시
        <ExtBadge inline />
      </label>
      {minimapMarker?.enabled && (<>
        <input type="color" value={minimapMarker.color} title="마커 색상"
          style={{ width: 28, height: 20, padding: 1, cursor: 'pointer', border: '1px solid #555' }}
          onChange={e => setMinimapMarker(prev => prev ? { ...prev, color: e.target.value } : null)} />
        <select value={minimapMarker.iconIndex !== undefined ? '__icon__' : (minimapMarker.shape ?? 'circle')}
          className="event-editor-input" style={{ width: 90 }}
          onChange={e => {
            const v = e.target.value;
            if (v === '__icon__') {
              setMinimapMarker(prev => prev ? { ...prev, iconIndex: prev.iconIndex ?? 0 } : null);
            } else {
              setMinimapMarker(prev => prev ? { ...prev, shape: v as MinimapMarkerShape, iconIndex: undefined } : null);
            }
          }}>
          <option value="circle">원형</option>
          <option value="square">사각형</option>
          <option value="diamond">다이아몬드</option>
          <option value="star">별</option>
          <option value="triangle">삼각형</option>
          <option value="cross">십자</option>
          <option value="heart">하트</option>
          <option value="__icon__">아이콘</option>
        </select>
        {minimapMarker.iconIndex !== undefined && (
          <IconPicker value={minimapMarker.iconIndex}
            onChange={idx => setMinimapMarker(prev => prev ? { ...prev, iconIndex: idx } : null)} />
        )}
      </>)}
    </div>
  );
}
