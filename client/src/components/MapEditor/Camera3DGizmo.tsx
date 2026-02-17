import React, { useRef, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './Camera3DGizmo.css';

const GIZMO_SIZE = 80;
const AXIS_LEN = 30;

interface AxisInfo {
  label: string;
  color: string;
  dir: [number, number, number]; // world direction
}

const AXES: AxisInfo[] = [
  { label: 'X', color: '#e44', dir: [1, 0, 0] },
  { label: 'Y', color: '#4a4', dir: [0, 1, 0] },
  { label: 'Z', color: '#48f', dir: [0, 0, 1] },
];

export default function Camera3DGizmo() {
  const mode3d = useEditorStore((s) => s.mode3d);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tiltDeg: 0, yawDeg: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const Mode3D = (window as any).Mode3D;
    if (!Mode3D) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = GIZMO_SIZE * dpr;
    canvas.height = GIZMO_SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, GIZMO_SIZE, GIZMO_SIZE);

    const cx = GIZMO_SIZE / 2;
    const cy = GIZMO_SIZE / 2;

    const tilt = (Mode3D._tiltDeg || 60) * Math.PI / 180;
    const yaw = (Mode3D._yawDeg || 0) * Math.PI / 180;

    // Rotation matrix: yaw around Y, then tilt around X
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    // Project 3D world axis to 2D gizmo view
    // Camera looks at -Z in eye space, X=right, Y=up
    // World: X=right, Y=down(screen), Z=up(towards camera)
    const project = (wx: number, wy: number, wz: number): [number, number, number] => {
      // Rotate by yaw around Z-up axis (in Mode3D, yaw rotates around Y-world)
      const x1 = wx * cosY - wz * sinY;
      const z1 = wx * sinY + wz * cosY;
      const y1 = wy;
      // Rotate by tilt (camera tilt from above)
      const y2 = y1 * cosT - z1 * sinT;
      const z2 = y1 * sinT + z1 * cosT;
      // Screen: x=right, y=down
      return [x1, -y2, z2];
    };

    // Sort axes by depth (z) for proper drawing order
    const projected = AXES.map((axis, i) => {
      const [sx, sy, sz] = project(axis.dir[0] * AXIS_LEN, axis.dir[1] * AXIS_LEN, axis.dir[2] * AXIS_LEN);
      return { ...axis, sx, sy, sz, idx: i };
    });
    projected.sort((a, b) => a.sz - b.sz); // draw far axes first

    // Draw background circle
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,40,40,0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,100,100,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw axes
    for (const axis of projected) {
      const endX = cx + axis.sx;
      const endY = cy + axis.sy;
      const alpha = 0.4 + 0.6 * ((axis.sz + AXIS_LEN) / (2 * AXIS_LEN));

      // Line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = axis.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label circle
      ctx.beginPath();
      ctx.arc(endX, endY, 9, 0, Math.PI * 2);
      ctx.fillStyle = axis.color;
      ctx.fill();

      // Label text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axis.label, endX, endY);
      ctx.globalAlpha = 1;
    }
  }, []);

  // Animation loop for gizmo
  useEffect(() => {
    if (!mode3d) return;
    let animId: number;
    const loop = () => {
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [mode3d, draw]);

  // Drag to rotate on gizmo
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const Mode3D = (window as any).Mode3D;
    if (!Mode3D) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      tiltDeg: Mode3D._tiltDeg, yawDeg: Mode3D._yawDeg,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      const sensitivity = 0.5;
      Mode3D._yawDeg = dragStart.current.yawDeg + dx * sensitivity;
      Mode3D._yawRad = Mode3D._yawDeg * Math.PI / 180;
      Mode3D._tiltDeg = Math.max(5, Math.min(89, dragStart.current.tiltDeg - dy * sensitivity));
      Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180;
    };

    const handleUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, []);

  const handleReset = useCallback(() => {
    const Mode3D = (window as any).Mode3D;
    if (!Mode3D) return;
    Mode3D._tiltDeg = 60;
    Mode3D._tiltRad = 60 * Math.PI / 180;
    Mode3D._yawDeg = 0;
    Mode3D._yawRad = 0;
    Mode3D._editorPanX = 0;
    Mode3D._editorPanY = 0;
    Mode3D._editorPanZ = 0;
  }, []);

  if (!mode3d) return null;

  return (
    <div className="camera-3d-gizmo-wrapper">
      <div className="camera-3d-gizmo-container">
        <canvas
          ref={canvasRef}
          className="camera-3d-gizmo-canvas"
          style={{ width: GIZMO_SIZE, height: GIZMO_SIZE }}
          onMouseDown={handleMouseDown}
        />
        <button
          className="camera-3d-reset-btn"
          onClick={handleReset}
          title="카메라 리셋"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
