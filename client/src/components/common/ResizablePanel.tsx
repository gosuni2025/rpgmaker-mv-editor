import React, { useState, useCallback, useEffect, useRef } from 'react';
import './ResizablePanel.css';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side?: 'right' | 'left';
}

export default function ResizablePanel({ children, defaultWidth = 220, minWidth = 100, maxWidth = 500, side = 'right' }: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    setDragging(true);
  }, [width]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const adjust = side === 'left' ? -delta : delta;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + adjust));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, minWidth, maxWidth, side]);

  const handleStyle = side === 'left'
    ? { left: 0, right: 'auto' }
    : {};

  return (
    <div className="resizable-panel" style={{ width }}>
      {side === 'left' && (
        <div
          className={`resize-handle${dragging ? ' active' : ''}`}
          style={handleStyle}
          onMouseDown={handleMouseDown}
        />
      )}
      <div className="resizable-panel-content">
        {children}
      </div>
      {side === 'right' && (
        <div
          className={`resize-handle${dragging ? ' active' : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
}
