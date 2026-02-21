import { useRef, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { SCROLL_POSITIONS_STORAGE_KEY } from '../../store/types';

export function useMapScrollPersistence(
  containerRef: React.RefObject<HTMLDivElement | null>,
  currentMapId: number | null,
) {
  const prevMapIdRef = useRef<number | null>(null);

  // 맵 변경 시: 이전 맵 스크롤 저장 + 새 맵 스크롤 복원
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !currentMapId) return;

    if (prevMapIdRef.current !== null && prevMapIdRef.current !== currentMapId) {
      try {
        const raw = localStorage.getItem(SCROLL_POSITIONS_STORAGE_KEY);
        const positions = raw ? JSON.parse(raw) : {};
        positions[prevMapIdRef.current] = { left: el.scrollLeft, top: el.scrollTop };
        localStorage.setItem(SCROLL_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
      } catch {}
    }

    prevMapIdRef.current = currentMapId;

    try {
      const raw = localStorage.getItem(SCROLL_POSITIONS_STORAGE_KEY);
      if (raw) {
        const positions = JSON.parse(raw);
        const saved = positions[currentMapId];
        if (saved) {
          requestAnimationFrame(() => {
            el.scrollLeft = saved.left ?? 0;
            el.scrollTop = saved.top ?? 0;
          });
        } else { el.scrollLeft = 0; el.scrollTop = 0; }
      } else { el.scrollLeft = 0; el.scrollTop = 0; }
    } catch {}
  }, [currentMapId]);

  // 스크롤 시 현재 맵의 위치 저장 (debounce)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const mapId = currentMapId;
      if (!mapId) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const raw = localStorage.getItem(SCROLL_POSITIONS_STORAGE_KEY);
          const positions = raw ? JSON.parse(raw) : {};
          positions[mapId] = { left: el.scrollLeft, top: el.scrollTop };
          localStorage.setItem(SCROLL_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
        } catch {}
      }, 300);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, [currentMapId]);

  // 이벤트 목록에서 클릭 시 해당 타일로 스크롤
  useEffect(() => {
    const onScrollToTile = (e: Event) => {
      const el = containerRef.current;
      if (!el) return;
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      const zoom = useEditorStore.getState().zoomLevel;
      const tilePx = TILE_SIZE_PX * zoom;
      el.scrollLeft = Math.max(0, x * tilePx - el.clientWidth / 2 + tilePx / 2);
      el.scrollTop = Math.max(0, y * tilePx - el.clientHeight / 2 + tilePx / 2);
    };
    window.addEventListener('scroll-to-tile', onScrollToTile);
    return () => window.removeEventListener('scroll-to-tile', onScrollToTile);
  }, []);
}
