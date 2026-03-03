import React from 'react';
import { GAME_W, GAME_H, type WidgetAbsPos } from './UIEditorCanvasUtils';
import type { WidgetDef } from '../../store/uiEditorTypes';

const NAV_COLORS = { navUp: '#4af', navDown: '#f84', navLeft: '#4f4', navRight: '#fa4' } as const;
type NavKey = keyof typeof NAV_COLORS;

interface UIEditorNavVisualProps {
  widgetById: Map<string, WidgetDef>;
  widgetPositions: Map<string, WidgetAbsPos>;
}

export default function UIEditorNavVisual({ widgetById, widgetPositions }: UIEditorNavVisualProps) {
  const arrows: React.ReactNode[] = [];
  widgetById.forEach((w, srcId) => {
    const srcPos = widgetPositions.get(srcId);
    if (!srcPos) return;
    const sx = srcPos.absX + srcPos.width / 2;
    const sy = srcPos.absY + (srcPos.height ?? 40) / 2;
    (Object.keys(NAV_COLORS) as NavKey[]).forEach((key) => {
      const tgtRaw = (w as any)[key] as string | undefined;
      if (!tgtRaw) return;
      // 풀 경로("navTest/root/main_panel/btn_close") → 마지막 세그먼트("btn_close")
      const tgtId = tgtRaw.includes('/') ? tgtRaw.split('/').pop()! : tgtRaw;
      const tgtPos = widgetPositions.get(tgtId);
      if (!tgtPos) return;
      const tx = tgtPos.absX + tgtPos.width / 2;
      const ty = tgtPos.absY + (tgtPos.height ?? 40) / 2;
      const color = NAV_COLORS[key];
      const markerId = `nav-arrow-${key}`;

      const dx = tx - sx, dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;

      // 끝점 여백 (위젯 중심에서 margin만큼 후퇴)
      const margin = 10;
      const ux = dx / len, uy = dy / len;
      const x1 = sx + ux * margin, y1 = sy + uy * margin;
      const x2 = tx - ux * margin, y2 = ty - uy * margin;

      // 진행 방향 오른쪽 수직 단위벡터 (시계방향 90°)
      const rpx = uy, rpy = -ux;
      // 곡률 offset: 거리에 비례하되 최소 20, 최대 45
      const curve = Math.min(45, Math.max(20, len * 0.22));
      const cx = (x1 + x2) / 2 + rpx * curve;
      const cy = (y1 + y2) / 2 + rpy * curve;

      arrows.push(
        <path key={`${srcId}-${key}`}
          d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
          stroke={color} strokeWidth={1.5} opacity={0.85} fill="none"
          markerEnd={`url(#${markerId})`}
        />
      );
    });
  });

  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: GAME_W, height: GAME_H, pointerEvents: 'none', overflow: 'visible' }}
      viewBox={`0 0 ${GAME_W} ${GAME_H}`}
    >
      <defs>
        {(Object.keys(NAV_COLORS) as NavKey[]).map((key) => (
          <marker key={key} id={`nav-arrow-${key}`} markerWidth="7" markerHeight="7" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill={NAV_COLORS[key]} />
          </marker>
        ))}
      </defs>
      {arrows}
    </svg>
  );
}
