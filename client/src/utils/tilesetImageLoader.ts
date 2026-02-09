/**
 * 타일셋 이미지 배열(index 0~8)을 병렬 로드하는 유틸리티.
 * 반환값: cleanup 함수 (useEffect cleanup에 사용)
 */
export function loadTilesetImages(
  names: (string | null)[],
  onLoaded: (images: Record<number, HTMLImageElement>) => void,
): () => void {
  const loaded: Record<number, HTMLImageElement> = {};
  let cancelled = false;
  let remaining = 0;

  for (let idx = 0; idx <= 8; idx++) {
    const name = names[idx];
    if (!name) continue;
    remaining++;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      loaded[idx] = img;
      remaining--;
      if (remaining <= 0) onLoaded({ ...loaded });
    };
    img.onerror = () => {
      if (cancelled) return;
      remaining--;
      if (remaining <= 0) onLoaded({ ...loaded });
    };
    img.src = `/api/resources/img_tilesets/${name}.png`;
  }

  if (remaining === 0) onLoaded({});

  return () => { cancelled = true; };
}
