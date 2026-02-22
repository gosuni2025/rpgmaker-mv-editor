import React, { useRef, useState, useCallback } from 'react';
import TilesetPalette from './Sidebar/TilesetPalette';
import MapTree from './Sidebar/MapTree';
import ObjectListPanel from './Sidebar/ObjectListPanel';
import CameraZoneListPanel from './Sidebar/CameraZoneListPanel';
import EventList from './EventEditor/EventList';

export default function SidebarSplit({ editMode }: { editMode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (ev.clientY - rect.top) / rect.height;
      setSplitRatio(Math.max(0.15, Math.min(0.85, ratio)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // 전용 패널만 전체 표시하는 모드들
  if (editMode === 'event') {
    return (
      <div className="sidebar-split" ref={containerRef}>
        <div className="sidebar-bottom" style={{ flex: 1 }}>
          <EventList />
        </div>
      </div>
    );
  }
  if (editMode === 'object') {
    return (
      <div className="sidebar-split" ref={containerRef}>
        <div className="sidebar-bottom" style={{ flex: 1 }}>
          <ObjectListPanel />
        </div>
      </div>
    );
  }
  if (editMode === 'cameraZone') {
    return (
      <div className="sidebar-split" ref={containerRef}>
        <div className="sidebar-bottom" style={{ flex: 1 }}>
          <CameraZoneListPanel />
        </div>
      </div>
    );
  }
  if (editMode === 'light') {
    return (
      <div className="sidebar-split" ref={containerRef}>
        <div className="sidebar-bottom" style={{ flex: 1 }}>
          <TilesetPalette />
        </div>
      </div>
    );
  }
  if (editMode === 'passage') {
    return (
      <div className="sidebar-split" ref={containerRef} />
    );
  }

  return (
    <div className="sidebar-split" ref={containerRef}>
      <div className="sidebar-top" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
        <TilesetPalette />
      </div>
      <div className="sidebar-split-handle" onMouseDown={handleMouseDown} />
      <div className="sidebar-bottom" style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }}>
        <MapTree />
      </div>
    </div>
  );
}
