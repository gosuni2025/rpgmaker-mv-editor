import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEscClose from '../../hooks/useEscClose';
import './IconPicker.css';

interface IconPickerProps {
  value: number;
  onChange: (iconIndex: number) => void;
}

const ICON_SIZE = 32;
const ICONS_PER_ROW = 16;

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  useEscClose(useCallback(() => { if (open) setOpen(false); }, [open]));
  const [iconSheet, setIconSheet] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

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

  useEffect(() => {
    if (!open || !iconSheet || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = iconSheet.width;
    canvasRef.current.height = iconSheet.height;
    ctx.drawImage(iconSheet, 0, 0);
    // Highlight selected
    const sx = (value % ICONS_PER_ROW) * ICON_SIZE;
    const sy = Math.floor(value / ICONS_PER_ROW) * ICON_SIZE;
    ctx.strokeStyle = '#2675bf';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, ICON_SIZE, ICON_SIZE);
  }, [open, iconSheet, value]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / ICON_SIZE);
    const y = Math.floor((e.clientY - rect.top) / ICON_SIZE);
    const idx = y * ICONS_PER_ROW + x;
    onChange(idx);
    setOpen(false);
  };

  return (
    <div className="icon-picker">
      <div className="icon-picker-preview" onClick={() => setOpen(!open)}>
        <canvas ref={previewRef} width={ICON_SIZE} height={ICON_SIZE} />
        <span>#{value}</span>
      </div>
      {open && (
        <div className="icon-picker-popup">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ cursor: 'pointer' }}
          />
        </div>
      )}
    </div>
  );
}
