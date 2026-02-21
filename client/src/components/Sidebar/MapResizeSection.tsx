import React, { useState, useEffect, useCallback } from 'react';

interface MapResizeSectionProps {
  currentMapId: number | null;
  width: number;
  height: number;
  resizeMap: (newW: number, newH: number, addLeft: number, addTop: number) => void;
}

export function MapResizeSection({ currentMapId, width, height, resizeMap }: MapResizeSectionProps) {
  const [addLeft, setAddLeft] = useState(0);
  const [addTop, setAddTop] = useState(0);
  const [addRight, setAddRight] = useState(0);
  const [addBottom, setAddBottom] = useState(0);

  useEffect(() => {
    setAddLeft(0);
    setAddTop(0);
    setAddRight(0);
    setAddBottom(0);
  }, [currentMapId]);

  const handleApplyResize = useCallback(() => {
    if (addLeft === 0 && addTop === 0 && addRight === 0 && addBottom === 0) return;
    const newW = Math.max(1, Math.min(256, width + addLeft + addRight));
    const newH = Math.max(1, Math.min(256, height + addTop + addBottom));
    resizeMap(newW, newH, addLeft, addTop);
    setAddLeft(0);
    setAddTop(0);
    setAddRight(0);
    setAddBottom(0);
  }, [width, height, addLeft, addTop, addRight, addBottom, resizeMap]);

  const hasChange = addLeft !== 0 || addTop !== 0 || addRight !== 0 || addBottom !== 0;
  const newW = Math.max(1, Math.min(256, width + addLeft + addRight));
  const newH = Math.max(1, Math.min(256, height + addTop + addBottom));

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleApplyResize(); };

  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">맵 크기 조절</div>
      <div className="light-inspector-row">
        <span className="light-inspector-label">크기</span>
        <span style={{ fontSize: 12, color: '#ddd' }}>{width} x {height}</span>
      </div>

      <div className="map-resize-grid">
        <div className="map-resize-row">
          <div className="map-resize-cell" />
          <div className="map-resize-cell center">
            <label className="map-resize-label">위</label>
            <input type="number" className="map-resize-input" value={addTop}
              onChange={(e) => setAddTop(Number(e.target.value) || 0)} onKeyDown={onEnter} />
          </div>
          <div className="map-resize-cell" />
        </div>
        <div className="map-resize-row">
          <div className="map-resize-cell center">
            <label className="map-resize-label">좌</label>
            <input type="number" className="map-resize-input" value={addLeft}
              onChange={(e) => setAddLeft(Number(e.target.value) || 0)} onKeyDown={onEnter} />
          </div>
          <div className="map-resize-cell center map-resize-center">
            {hasChange ? (
              <span className="map-resize-preview">{newW} x {newH}</span>
            ) : (
              <span className="map-resize-current">{width} x {height}</span>
            )}
          </div>
          <div className="map-resize-cell center">
            <label className="map-resize-label">우</label>
            <input type="number" className="map-resize-input" value={addRight}
              onChange={(e) => setAddRight(Number(e.target.value) || 0)} onKeyDown={onEnter} />
          </div>
        </div>
        <div className="map-resize-row">
          <div className="map-resize-cell" />
          <div className="map-resize-cell center">
            <label className="map-resize-label">아래</label>
            <input type="number" className="map-resize-input" value={addBottom}
              onChange={(e) => setAddBottom(Number(e.target.value) || 0)} onKeyDown={onEnter} />
          </div>
          <div className="map-resize-cell" />
        </div>
      </div>

      {hasChange && (
        <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
          <button className="map-inspector-apply-btn" onClick={handleApplyResize}>
            적용 ({width}x{height} → {newW}x{newH})
          </button>
          <button className="map-inspector-cancel-btn"
            onClick={() => { setAddLeft(0); setAddTop(0); setAddRight(0); setAddBottom(0); }}>
            취소
          </button>
        </div>
      )}
    </div>
  );
}
