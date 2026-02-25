import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useEscClose from '../../hooks/useEscClose';
import './IconPicker.css';

interface IconPickerProps {
  value: number;
  onChange: (iconIndex: number) => void;
  initialOpen?: boolean;
  onClose?: () => void;
  hidePreview?: boolean;
}

const ICON_SIZE = 32;
const ICONS_PER_ROW = 16;

export default function IconPicker({ value, onChange, initialOpen, onClose, hidePreview }: IconPickerProps) {
  const [open, setOpen] = useState(initialOpen ?? false);
  const handleClose = useCallback(() => { setOpen(false); onClose?.(); }, [onClose]);
  useEscClose(useCallback(() => { if (open) handleClose(); }, [open, handleClose]));
  const [iconSheet, setIconSheet] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [scale, setScale] = useState(2);

  useEffect(() => {
    const img = new Image();
    img.src = '/api/resources/img_system/IconSet.png';
    img.onload = () => setIconSheet(img);
  }, []);

  useEffect(() => {
    if (!iconSheet || !previewRef.current) return;
    const ctx = previewRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    const sx = (value % ICONS_PER_ROW) * ICON_SIZE;
    const sy = Math.floor(value / ICONS_PER_ROW) * ICON_SIZE;
    ctx.drawImage(iconSheet, sx, sy, ICON_SIZE, ICON_SIZE, 0, 0, ICON_SIZE, ICON_SIZE);
  }, [iconSheet, value]);

  const drawSheet = useCallback(() => {
    if (!iconSheet || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const w = iconSheet.width * scale;
    const h = iconSheet.height * scale;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(iconSheet, 0, 0, w, h);

    const cellSize = ICON_SIZE * scale;

    // Highlight selected
    const sx = (value % ICONS_PER_ROW) * cellSize;
    const sy = Math.floor(value / ICONS_PER_ROW) * cellSize;
    ctx.strokeStyle = '#2675bf';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2);

    // Highlight hover
    if (hoverIdx !== null && hoverIdx !== value) {
      const hx = (hoverIdx % ICONS_PER_ROW) * cellSize;
      const hy = Math.floor(hoverIdx / ICONS_PER_ROW) * cellSize;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 1, hy + 1, cellSize - 2, cellSize - 2);
    }
  }, [iconSheet, value, scale, hoverIdx]);

  useEffect(() => {
    if (open) drawSheet();
  }, [open, drawSheet]);

  const getIdxFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cellSize = ICON_SIZE * scale;
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    return y * ICONS_PER_ROW + x;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const idx = getIdxFromEvent(e);
    onChange(idx);
    handleClose();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const idx = getIdxFromEvent(e);
    setHoverIdx(idx);
  };

  const displayIdx = hoverIdx !== null ? hoverIdx : value;

  return (
    <div className="icon-picker">
      {!hidePreview && (
        <div className="icon-picker-preview" onClick={() => open ? handleClose() : setOpen(true)}>
          <canvas ref={previewRef} width={ICON_SIZE} height={ICON_SIZE} />
          <span>#{value}</span>
        </div>
      )}
      {open && createPortal(
        <div className="icon-picker-overlay" onClick={handleClose}>
          <div className="icon-picker-dialog" onClick={e => e.stopPropagation()}>
            <div className="icon-picker-dialog-header">
              <span>아이콘 선택 #{displayIdx}</span>
              <button className="db-dialog-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="icon-picker-dialog-body">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
