import React, { useRef, useCallback, useState } from 'react';

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
 * 유니티 스타일 드래그 가능한 레이블 + 숫자 input.
 * 레이블 드래그로 값 조절, input 클릭으로 직접 타이핑 가능.
 */
export default function DragLabel({ label, value, onChange, onDragStart, onDragEnd, step = 1, min, max, speed = 1 }: DragLabelProps) {
  const startX = useRef(0);
  const startValue = useRef(0);
  const dragging = useRef(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const clampVal = useCallback((v: number) => {
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  }, [min, max]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startValue.current = value;
    dragging.current = false;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current;
      if (!dragging.current && Math.abs(dx) > 2) {
        dragging.current = true;
        onDragStart?.();
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
      }
      if (!dragging.current) return;
      const delta = dx * step * speed;
      const decimals = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
      const newVal = parseFloat((startValue.current + delta).toFixed(decimals));
      onChange(clampVal(newVal));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (dragging.current) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onDragEnd?.();
      } else {
        // 드래그 없이 클릭 → 편집 모드
        setInputVal(String(value));
        setEditing(true);
        setTimeout(() => { inputRef.current?.select(); }, 0);
      }
      dragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [value, step, speed, onChange, onDragStart, onDragEnd, clampVal]);

  const commitEdit = useCallback(() => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) onChange(clampVal(parsed));
    setEditing(false);
    onDragEnd?.();
  }, [inputVal, onChange, onDragEnd, clampVal]);

  return (
    <div className="drag-label-row">
      <span
        className="light-inspector-label draggable"
        onMouseDown={handleMouseDown}
        title="드래그로 조절, 클릭으로 직접 입력"
      >
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          className="drag-label-input"
          type="number"
          value={inputVal}
          step={step}
          min={min}
          max={max}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span
          className="drag-label-value"
          onMouseDown={handleMouseDown}
        >
          {Number.isInteger(value) ? value : value.toFixed(step < 1 ? Math.ceil(-Math.log10(step)) : 2)}
        </span>
      )}
    </div>
  );
}
