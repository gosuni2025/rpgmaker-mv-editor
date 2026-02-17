import React, { useRef, useCallback } from 'react';

interface DragLabelProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  step?: number;
  min?: number;
  max?: number;
  speed?: number; // 드래그 감도 배율 (기본 1)
}

/**
 * 유니티 스타일 드래그 가능한 레이블.
 * 레이블을 좌우 드래그하면 값이 증가/감소됨.
 * 커서가 ↔ 로 변경되어 드래그 가능함을 표시.
 */
export default function DragLabel({ label, value, onChange, onDragStart, onDragEnd, step = 1, min, max, speed = 1 }: DragLabelProps) {
  const startX = useRef(0);
  const startValue = useRef(0);
  const dragging = useRef(false);

  const clamp = useCallback((v: number) => {
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  }, [min, max]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startValue.current = value;
    dragging.current = true;
    onDragStart?.();

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - startX.current;
      const delta = dx * step * speed;
      // step에 맞게 반올림
      const decimals = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
      const newVal = parseFloat((startValue.current + delta).toFixed(decimals));
      onChange(clamp(newVal));
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onDragEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [value, step, speed, onChange, onDragStart, onDragEnd, clamp]);

  return (
    <span
      className="light-inspector-label draggable"
      onMouseDown={handleMouseDown}
    >
      {label}
    </span>
  );
}
