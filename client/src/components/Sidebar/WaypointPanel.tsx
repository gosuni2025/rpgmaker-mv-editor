import React from 'react';
import type { WaypointSession } from '../../utils/astar';

interface WaypointPanelProps {
  session: WaypointSession;
  onUpdateField: <K extends keyof WaypointSession>(key: K, value: WaypointSession[K]) => void;
  onDeleteWaypoint: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WaypointPanel({ session, onUpdateField, onDeleteWaypoint, onCancel, onConfirm }: WaypointPanelProps) {
  return (
    <div className="waypoint-panel">
      <div className="waypoint-panel-title">
        <span>웨이포인트 편집</span>
        <span style={{ fontSize: 10, color: '#aaa', fontWeight: 'normal' }}>
          {session.type === 'autonomous' ? '자율이동' : '이동루트 커맨드'}
        </span>
      </div>

      <div className="waypoint-panel-option">
        <label className="waypoint-checkbox">
          <input
            type="checkbox"
            checked={session.allowDiagonal}
            onChange={e => onUpdateField('allowDiagonal', e.target.checked)}
          />
          대각선 이동 허용
        </label>
        <label className="waypoint-checkbox" style={{ marginTop: 4 }}>
          <input
            type="checkbox"
            checked={session.avoidEvents}
            onChange={e => onUpdateField('avoidEvents', e.target.checked)}
          />
          이벤트 위치 회피
        </label>
        <label className="waypoint-checkbox" style={{ marginTop: 4 }}>
          <input
            type="checkbox"
            checked={session.ignorePassability}
            onChange={e => onUpdateField('ignorePassability', e.target.checked)}
          />
          이동 불가 타일 무시
        </label>
      </div>

      <div className="waypoint-list">
        {session.waypoints.length === 0 ? (
          <div className="waypoint-empty">맵을 클릭해 경유지/목적지를 추가하세요</div>
        ) : (
          session.waypoints.map((wp, i) => (
            <div key={wp.id} className="waypoint-item">
              <span className="waypoint-item-label">
                {i === session.waypoints.length - 1
                  ? <span style={{ color: '#f77' }}>목적지</span>
                  : <span style={{ color: '#fa0' }}>경유 {i + 1}</span>
                }
              </span>
              <span className="waypoint-item-pos">({wp.x}, {wp.y})</span>
              <button className="waypoint-delete-btn" onClick={() => onDeleteWaypoint(wp.id)} title="삭제">✕</button>
            </div>
          ))
        )}
      </div>

      <div className="waypoint-panel-hint">
        드래그로 위치 조정 가능 · 마지막 웨이포인트가 최종 목적지
      </div>

      <div className="waypoint-panel-buttons">
        <button className="db-btn" onClick={onCancel}>취소</button>
        <button
          className="db-btn db-btn-primary"
          onClick={onConfirm}
          disabled={session.waypoints.length === 0}
        >
          확정
        </button>
      </div>
    </div>
  );
}
