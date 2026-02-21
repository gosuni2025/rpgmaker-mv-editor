import { useRef, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';

export function use3DCameraControls(
  containerRef: React.RefObject<HTMLDivElement | null>,
): { panning: boolean } {
  const [panning, setPanning] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);

  const isRotating3D = useRef(false);
  const isPanning3D = useRef(false);
  const isOrbiting3D = useRef(false);
  const cam3DStart = useRef({ x: 0, y: 0, tiltDeg: 0, yawDeg: 0, panX: 0, panY: 0, panZ: 0, rightVec: [1, 0, 0] as number[], upVec: [0, 0, 1] as number[] });
  const flyKeys = useRef<Set<string>>(new Set());
  const flyAnimRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const Mode3D = (window as any).Mode3D;

    const getCamVectors = () => {
      const tilt = Mode3D?._tiltRad || 0;
      const yaw = Mode3D?._yawRad || 0;
      const cosTilt = Math.cos(tilt);
      const sinTilt = Math.sin(tilt);
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const fwd = [-cosTilt * sinYaw, -sinTilt, -cosTilt * cosYaw];
      const right = [cosYaw, 0, -sinYaw];
      const up = [sinYaw * sinTilt, -cosTilt, cosYaw * sinTilt];
      return { fwd, right, up };
    };

    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest?.('.db-dialog-overlay')) return;
      e.preventDefault();

      const is3D = useEditorStore.getState().mode3d;

      if (is3D && Mode3D) {
        const moveSpeed = 80;
        const dir = e.deltaY < 0 ? 1 : -1;
        const { fwd } = getCamVectors();
        Mode3D._editorPanX = (Mode3D._editorPanX || 0) + fwd[0] * dir * moveSpeed;
        Mode3D._editorPanY = (Mode3D._editorPanY || 0) + fwd[1] * dir * moveSpeed;
        Mode3D._editorPanZ = (Mode3D._editorPanZ || 0) + fwd[2] * dir * moveSpeed;
        return;
      }

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const oldZoom = useEditorStore.getState().zoomLevel;

      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();

      const newZoom = useEditorStore.getState().zoomLevel;
      if (newZoom === oldZoom) return;

      const contentX = (el.scrollLeft + mouseX) / oldZoom;
      const contentY = (el.scrollTop + mouseY) / oldZoom;
      el.scrollLeft = contentX * newZoom - mouseX;
      el.scrollTop = contentY * newZoom - mouseY;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    const startFlyLoop = () => {
      if (flyAnimRef.current) return;
      let lastTime = performance.now();
      const loop = () => {
        if (!isRotating3D.current || !Mode3D) {
          flyAnimRef.current = 0;
          return;
        }
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        const speed = 400;

        const { fwd, right } = getCamVectors();

        let dx = 0, dy = 0, dz = 0;
        if (flyKeys.current.has('w')) { dx += fwd[0]; dy += fwd[1]; dz += fwd[2]; }
        if (flyKeys.current.has('s')) { dx -= fwd[0]; dy -= fwd[1]; dz -= fwd[2]; }
        if (flyKeys.current.has('a')) { dx -= right[0]; dy -= right[1]; dz -= right[2]; }
        if (flyKeys.current.has('d')) { dx += right[0]; dy += right[1]; dz += right[2]; }
        if (flyKeys.current.has('e')) { dz += 1; }
        if (flyKeys.current.has('q')) { dz -= 1; }

        if (dx !== 0 || dy !== 0 || dz !== 0) {
          Mode3D._editorPanX = (Mode3D._editorPanX || 0) + dx * speed * dt;
          Mode3D._editorPanY = (Mode3D._editorPanY || 0) + dy * speed * dt;
          Mode3D._editorPanZ = (Mode3D._editorPanZ || 0) + dz * speed * dt;
        }
        flyAnimRef.current = requestAnimationFrame(loop);
      };
      flyAnimRef.current = requestAnimationFrame(loop);
    };

    const stopFlyLoop = () => {
      if (flyAnimRef.current) {
        cancelAnimationFrame(flyAnimRef.current);
        flyAnimRef.current = 0;
      }
      flyKeys.current.clear();
    };

    const codeToFlyKey: Record<string, string> = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e',
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRotating3D.current) return;
      const k = codeToFlyKey[e.code];
      if (k) {
        e.preventDefault();
        flyKeys.current.add(k);
        startFlyLoop();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = codeToFlyKey[e.code];
      if (k) flyKeys.current.delete(k);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const is3D = useEditorStore.getState().mode3d;

      if (e.button === 2 && is3D && Mode3D) {
        e.preventDefault();
        isRotating3D.current = true;
        isPanning.current = true;
        setPanning(true);
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: Mode3D._tiltDeg, yawDeg: Mode3D._yawDeg,
          panX: 0, panY: 0, panZ: 0,
          rightVec: [1, 0, 0], upVec: [0, 0, 1],
        };
        return;
      }

      if (e.button === 1 && is3D && Mode3D) {
        e.preventDefault();
        isPanning3D.current = true;
        isPanning.current = true;
        setPanning(true);
        const { right, up } = getCamVectors();
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: 0, yawDeg: 0,
          panX: Mode3D._editorPanX || 0,
          panY: Mode3D._editorPanY || 0,
          panZ: Mode3D._editorPanZ || 0,
          rightVec: right, upVec: up,
        };
        return;
      }

      if (e.button === 0 && e.altKey && is3D && Mode3D) {
        e.preventDefault();
        isOrbiting3D.current = true;
        isPanning.current = true;
        setPanning(true);
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: Mode3D._tiltDeg, yawDeg: Mode3D._yawDeg,
          panX: 0, panY: 0, panZ: 0,
          rightVec: [1, 0, 0], upVec: [0, 0, 1],
        };
        return;
      }

      if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        setPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isRotating3D.current && Mode3D) {
        const dx = e.clientX - cam3DStart.current.x;
        const dy = e.clientY - cam3DStart.current.y;
        const sensitivity = 0.3;
        Mode3D._yawDeg = cam3DStart.current.yawDeg + dx * sensitivity;
        Mode3D._yawRad = Mode3D._yawDeg * Math.PI / 180;
        Mode3D._tiltDeg = Math.max(5, Math.min(89, cam3DStart.current.tiltDeg - dy * sensitivity));
        Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180;
        return;
      }

      if (isOrbiting3D.current && Mode3D) {
        const dx = e.clientX - cam3DStart.current.x;
        const dy = e.clientY - cam3DStart.current.y;
        const sensitivity = 0.3;
        Mode3D._yawDeg = cam3DStart.current.yawDeg + dx * sensitivity;
        Mode3D._yawRad = Mode3D._yawDeg * Math.PI / 180;
        Mode3D._tiltDeg = Math.max(5, Math.min(89, cam3DStart.current.tiltDeg - dy * sensitivity));
        Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180;
        return;
      }

      if (isPanning3D.current && Mode3D) {
        const dx = e.clientX - cam3DStart.current.x;
        const dy = e.clientY - cam3DStart.current.y;
        const panSpeed = 2.0;
        const [rx, ry, rz] = cam3DStart.current.rightVec;
        const [ux, uy, uz] = cam3DStart.current.upVec;
        Mode3D._editorPanX = cam3DStart.current.panX - (dx * rx - dy * ux) * panSpeed;
        Mode3D._editorPanY = cam3DStart.current.panY - (dx * ry - dy * uy) * panSpeed;
        Mode3D._editorPanZ = cam3DStart.current.panZ - (dx * rz - dy * uz) * panSpeed;
        return;
      }

      if (!isPanning.current) return;
      el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
      el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2 && isRotating3D.current) {
        isRotating3D.current = false;
        isPanning.current = false;
        setPanning(false);
        stopFlyLoop();
        return;
      }
      if (e.button === 1 && isPanning3D.current) {
        isPanning3D.current = false;
        isPanning.current = false;
        setPanning(false);
        return;
      }
      if (e.button === 0 && isOrbiting3D.current) {
        isOrbiting3D.current = false;
        isPanning.current = false;
        setPanning(false);
        return;
      }
      if (e.button !== 1 || !isPanning.current) return;
      isPanning.current = false;
      setPanning(false);
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isRotating3D.current || useEditorStore.getState().mode3d) {
        e.preventDefault();
      }
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopFlyLoop();
    };
  }, [zoomIn, zoomOut]);

  return { panning };
}
