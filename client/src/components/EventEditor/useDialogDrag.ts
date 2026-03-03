import { useState, useRef, useCallback } from 'react';

export interface DialogPos {
  x: number;
  y: number;
}

export function useDialogDrag(dialogRef: React.RefObject<HTMLDivElement | null>) {
  const [dialogPos, setDialogPos] = useState<DialogPos | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = dialogRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setDialogPos({ x: dragRef.current.origX + ev.clientX - dragRef.current.startX, y: dragRef.current.origY + ev.clientY - dragRef.current.startY });
    };
    const handleMouseUp = () => { dragRef.current = null; document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dialogRef]);

  return { dialogPos, handleTitleMouseDown };
}
