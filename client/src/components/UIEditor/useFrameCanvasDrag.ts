import { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { DISPLAY_SCALE, type DragState, getHit, getCursor, clamp } from './UIEditorFrameCanvasUtils';

type ActiveTab = 'frame' | 'cursor' | 'gauge';

export function getActiveTab(subMode: string): ActiveTab {
  if (subMode === 'cursor') return 'cursor';
  if (subMode === 'gauge') return 'gauge';
  return 'frame';
}

export function useFrameCanvasDrag(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  imgRef: React.MutableRefObject<HTMLImageElement | null>,
  dragRef: React.MutableRefObject<DragState>,
  hoverHitRef: React.MutableRefObject<DragState>,
  altKeyRef: React.MutableRefObject<boolean>,
  redraw: () => void,
) {
  const toImageCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      ix: (clientX - rect.left) * (canvas.width / rect.width) / DISPLAY_SCALE,
      iy: (clientY - rect.top)  * (canvas.height / rect.height) / DISPLAY_SCALE,
    };
  }, []);

  const saveToServer = useCallback(async (fields: Record<string, number | boolean>) => {
    const { projectPath: pp, uiSelectedSkin: skin } = useEditorStore.getState();
    if (!pp || !skin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(skin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const s = useEditorStore.getState();

    let hit: DragState;
    if (altKeyRef.current) {
      // Alt 모드: fill 영역 내부면 fill 이동, 아니면 frame 이동
      const inFill = coords.ix >= s.uiSkinFillX && coords.ix <= s.uiSkinFillX + s.uiSkinFillW
                  && coords.iy >= s.uiSkinFillY && coords.iy <= s.uiSkinFillY + s.uiSkinFillH;
      if (inFill) {
        hit = { type: 'fill_move', ox: coords.ix - s.uiSkinFillX, oy: coords.iy - s.uiSkinFillY, startFX: s.uiSkinFillX, startFY: s.uiSkinFillY };
      } else {
        hit = { type: 'frame_move', ox: coords.ix - s.uiSkinFrameX, oy: coords.iy - s.uiSkinFrameY, startFX: s.uiSkinFrameX, startFY: s.uiSkinFrameY };
      }
    } else {
      hit = getHit(coords.ix, coords.iy, s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH, s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH, s.uiSkinCursorX, s.uiSkinCursorY, s.uiSkinCursorW, s.uiSkinCursorH, s.uiSkinCornerSize, getActiveTab(s.uiEditSubMode), s.uiSkinGaugeBgX, s.uiSkinGaugeBgY, s.uiSkinGaugeBgW, s.uiSkinGaugeBgH, s.uiSkinGaugeFillX, s.uiSkinGaugeFillY, s.uiSkinGaugeFillW, s.uiSkinGaugeFillH);
      if (!hit) {
        // 게이지 탭에서 빈 곳 클릭: 드래그로 새 영역 생성
        if (getActiveTab(s.uiEditSubMode) === 'gauge') {
          const noBg = s.uiSkinGaugeBgW === 0 || s.uiSkinGaugeBgH === 0;
          const noFill = s.uiSkinGaugeFillW === 0 || s.uiSkinGaugeFillH === 0;
          if (noBg) {
            hit = { type: 'gauge_bg_create', startX: Math.round(coords.ix), startY: Math.round(coords.iy) };
          } else if (noFill) {
            hit = { type: 'gauge_fill_create', startX: Math.round(coords.ix), startY: Math.round(coords.iy) };
          }
        }
        if (!hit) return;
      }
    }

    e.preventDefault();
    useEditorStore.getState().pushUiSkinUndo();
    dragRef.current = hit;
    document.body.style.cursor = altKeyRef.current ? 'grabbing' : getCursor(hit);

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const c = toImageCoords(ev.clientX, ev.clientY);
      if (!c) return;
      const st = useEditorStore.getState();
      const iw = imgRef.current?.naturalWidth ?? 192;
      const ih = imgRef.current?.naturalHeight ?? 192;

      if (drag.type === 'slice') {
        const { uiSkinFrameX: fx, uiSkinFrameY: fy, uiSkinFrameW: fw, uiSkinFrameH: fh } = st;
        const maxCs = Math.floor(Math.min(fw, fh) / 2) - 1;
        const raw = drag.axis === 'x'
          ? (drag.nearFirst ? c.ix - fx : fw - (c.ix - fx))
          : (drag.nearFirst ? c.iy - fy : fh - (c.iy - fy));
        st.setUiSkinCornerSize(clamp(Math.round(raw), 1, Math.max(1, maxCs)));
      } else if (drag.type === 'frame_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinFrameW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinFrameH);
        st.setUiSkinFrame(nx, ny, st.uiSkinFrameW, st.uiSkinFrameH);
      } else if (drag.type === 'frame_resize') {
        const { startFX, startFY, startFW, startFH, edge } = drag;
        const MIN_SZ = 10;
        if (edge === 'right')  st.setUiSkinFrame(startFX, startFY, clamp(Math.round(c.ix - startFX), MIN_SZ, iw - startFX), startFH);
        if (edge === 'bottom') st.setUiSkinFrame(startFX, startFY, startFW, clamp(Math.round(c.iy - startFY), MIN_SZ, ih - startFY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startFX + startFW - MIN_SZ);
          st.setUiSkinFrame(newX, startFY, startFX + startFW - newX, startFH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startFY + startFH - MIN_SZ);
          st.setUiSkinFrame(startFX, newY, startFW, startFY + startFH - newY);
        }
      } else if (drag.type === 'fill_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinFillW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinFillH);
        st.setUiSkinFill(nx, ny, st.uiSkinFillW, st.uiSkinFillH);
      } else if (drag.type === 'fill_resize') {
        const { startFX, startFY, startFW, startFH, edge } = drag;
        const MIN_SZ = 8;
        if (edge === 'right')  st.setUiSkinFill(startFX, startFY, clamp(Math.round(c.ix - startFX), MIN_SZ, iw - startFX), startFH);
        if (edge === 'bottom') st.setUiSkinFill(startFX, startFY, startFW, clamp(Math.round(c.iy - startFY), MIN_SZ, ih - startFY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startFX + startFW - MIN_SZ);
          st.setUiSkinFill(newX, startFY, startFX + startFW - newX, startFH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startFY + startFH - MIN_SZ);
          st.setUiSkinFill(startFX, newY, startFW, startFY + startFH - newY);
        }
      } else if (drag.type === 'cursor_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinCursorW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinCursorH);
        st.setUiSkinCursor(nx, ny, st.uiSkinCursorW, st.uiSkinCursorH);
      } else if (drag.type === 'cursor_resize') {
        const { startCX, startCY, startCW, startCH, edge } = drag;
        const MIN_SZ = 4;
        if (edge === 'right')  st.setUiSkinCursor(startCX, startCY, clamp(Math.round(c.ix - startCX), MIN_SZ, iw - startCX), startCH);
        if (edge === 'bottom') st.setUiSkinCursor(startCX, startCY, startCW, clamp(Math.round(c.iy - startCY), MIN_SZ, ih - startCY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startCX + startCW - MIN_SZ);
          st.setUiSkinCursor(newX, startCY, startCX + startCW - newX, startCH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startCY + startCH - MIN_SZ);
          st.setUiSkinCursor(startCX, newY, startCW, startCY + startCH - newY);
        }
      } else if (drag.type === 'gauge_bg_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinGaugeBgW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinGaugeBgH);
        st.setUiSkinGaugeBg(nx, ny, st.uiSkinGaugeBgW, st.uiSkinGaugeBgH);
      } else if (drag.type === 'gauge_bg_resize') {
        const { startX, startY, startW, startH, edge } = drag;
        const MIN_SZ = 2;
        if (edge === 'right')  st.setUiSkinGaugeBg(startX, startY, clamp(Math.round(c.ix - startX), MIN_SZ, iw - startX), startH);
        if (edge === 'bottom') st.setUiSkinGaugeBg(startX, startY, startW, clamp(Math.round(c.iy - startY), MIN_SZ, ih - startY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startX + startW - MIN_SZ);
          st.setUiSkinGaugeBg(newX, startY, startX + startW - newX, startH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startY + startH - MIN_SZ);
          st.setUiSkinGaugeBg(startX, newY, startW, startY + startH - newY);
        }
      } else if (drag.type === 'gauge_fill_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinGaugeFillW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinGaugeFillH);
        st.setUiSkinGaugeFill(nx, ny, st.uiSkinGaugeFillW, st.uiSkinGaugeFillH);
      } else if (drag.type === 'gauge_fill_resize') {
        const { startX, startY, startW, startH, edge } = drag;
        const MIN_SZ = 2;
        if (edge === 'right')  st.setUiSkinGaugeFill(startX, startY, clamp(Math.round(c.ix - startX), MIN_SZ, iw - startX), startH);
        if (edge === 'bottom') st.setUiSkinGaugeFill(startX, startY, startW, clamp(Math.round(c.iy - startY), MIN_SZ, ih - startY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startX + startW - MIN_SZ);
          st.setUiSkinGaugeFill(newX, startY, startX + startW - newX, startH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startY + startH - MIN_SZ);
          st.setUiSkinGaugeFill(startX, newY, startW, startY + startH - newY);
        }
      } else if (drag.type === 'gauge_bg_create') {
        const x = clamp(Math.min(drag.startX, Math.round(c.ix)), 0, iw);
        const y = clamp(Math.min(drag.startY, Math.round(c.iy)), 0, ih);
        const w = clamp(Math.abs(Math.round(c.ix) - drag.startX), 1, iw - x);
        const h = clamp(Math.abs(Math.round(c.iy) - drag.startY), 1, ih - y);
        st.setUiSkinGaugeBg(x, y, w, h);
      } else if (drag.type === 'gauge_fill_create') {
        const x = clamp(Math.min(drag.startX, Math.round(c.ix)), 0, iw);
        const y = clamp(Math.min(drag.startY, Math.round(c.iy)), 0, ih);
        const w = clamp(Math.abs(Math.round(c.ix) - drag.startX), 1, iw - x);
        const h = clamp(Math.abs(Math.round(c.iy) - drag.startY), 1, ih - y);
        st.setUiSkinGaugeFill(x, y, w, h);
      }
    };

    const onUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      if (canvasRef.current) canvasRef.current.style.cursor = altKeyRef.current ? 'grab' : 'default';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const st = useEditorStore.getState();
      if (drag.type === 'slice') {
        await saveToServer({ cornerSize: st.uiSkinCornerSize });
      } else if (drag.type === 'fill_move' || drag.type === 'fill_resize') {
        await saveToServer({ fillX: st.uiSkinFillX, fillY: st.uiSkinFillY, fillW: st.uiSkinFillW, fillH: st.uiSkinFillH });
      } else if (drag.type === 'cursor_move' || drag.type === 'cursor_resize') {
        await saveToServer({ cursorX: st.uiSkinCursorX, cursorY: st.uiSkinCursorY, cursorW: st.uiSkinCursorW, cursorH: st.uiSkinCursorH });
      } else if (drag.type === 'gauge_bg_move' || drag.type === 'gauge_bg_resize') {
        await saveToServer({ gaugeBgX: st.uiSkinGaugeBgX, gaugeBgY: st.uiSkinGaugeBgY, gaugeBgW: st.uiSkinGaugeBgW, gaugeBgH: st.uiSkinGaugeBgH });
      } else if (drag.type === 'gauge_fill_move' || drag.type === 'gauge_fill_resize' || drag.type === 'gauge_fill_create') {
        await saveToServer({ gaugeFillX: st.uiSkinGaugeFillX, gaugeFillY: st.uiSkinGaugeFillY, gaugeFillW: st.uiSkinGaugeFillW, gaugeFillH: st.uiSkinGaugeFillH });
      } else if (drag.type === 'gauge_bg_create') {
        await saveToServer({ gaugeBgX: st.uiSkinGaugeBgX, gaugeBgY: st.uiSkinGaugeBgY, gaugeBgW: st.uiSkinGaugeBgW, gaugeBgH: st.uiSkinGaugeBgH });
      } else {
        await saveToServer({ frameX: st.uiSkinFrameX, frameY: st.uiSkinFrameY, frameW: st.uiSkinFrameW, frameH: st.uiSkinFrameH });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [toImageCoords, saveToServer]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (altKeyRef.current) {
      canvas.style.cursor = 'grab';
      if (hoverHitRef.current?.type === 'slice') { hoverHitRef.current = null; redraw(); }
      return;
    }

    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const s = useEditorStore.getState();
    const hit = getHit(coords.ix, coords.iy, s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH, s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH, s.uiSkinCursorX, s.uiSkinCursorY, s.uiSkinCursorW, s.uiSkinCursorH, s.uiSkinCornerSize, getActiveTab(s.uiEditSubMode), s.uiSkinGaugeBgX, s.uiSkinGaugeBgY, s.uiSkinGaugeBgW, s.uiSkinGaugeBgH, s.uiSkinGaugeFillX, s.uiSkinGaugeFillY, s.uiSkinGaugeFillW, s.uiSkinGaugeFillH);
    // 게이지 탭: 빈 공간 hover 시 crosshair로 "드래그로 생성 가능" 표시
    if (!hit && getActiveTab(s.uiEditSubMode) === 'gauge') {
      const noBg = s.uiSkinGaugeBgW === 0 || s.uiSkinGaugeBgH === 0;
      const noFill = s.uiSkinGaugeFillW === 0 || s.uiSkinGaugeFillH === 0;
      canvas.style.cursor = (noBg || noFill) ? 'crosshair' : 'default';
    } else {
      canvas.style.cursor = getCursor(hit);
    }

    // slice 호버 하이라이트 갱신
    const prevIsSlice = hoverHitRef.current?.type === 'slice';
    const nextIsSlice = hit?.type === 'slice';
    const changed = prevIsSlice !== nextIsSlice ||
      (nextIsSlice && (
        (hit as Extract<DragState, { type: 'slice' }>).axis !== (hoverHitRef.current as Extract<DragState, { type: 'slice' }>).axis ||
        (hit as Extract<DragState, { type: 'slice' }>).nearFirst !== (hoverHitRef.current as Extract<DragState, { type: 'slice' }>).nearFirst
      ));
    hoverHitRef.current = hit;
    if (changed) redraw();
  }, [toImageCoords, redraw]);

  return { handleMouseDown, handleCanvasMouseMove };
}
