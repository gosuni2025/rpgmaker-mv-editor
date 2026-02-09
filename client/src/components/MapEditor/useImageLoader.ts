import { useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';

interface ImageLoaderResult {
  tilesetImages: Record<number, HTMLImageElement>;
  charImages: Record<string, HTMLImageElement>;
  playerCharImg: HTMLImageElement | null;
}

export function useImageLoader(): ImageLoaderResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [charImages, setCharImages] = useState<Record<string, HTMLImageElement>>({});
  const [playerCharImg, setPlayerCharImg] = useState<HTMLImageElement | null>(null);

  // Load tileset images
  useEffect(() => {
    if (!currentMap || !currentMap.tilesetNames) {
      setTilesetImages({});
      return;
    }

    const names = currentMap.tilesetNames;
    const loaded: Record<number, HTMLImageElement> = {};
    let cancelled = false;

    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let remaining = 0;

    indices.forEach((idx) => {
      const name = names[idx];
      if (!name) return;
      remaining++;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[idx] = img;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.src = `/api/resources/img_tilesets/${name}.png`;
    });

    if (remaining === 0) setTilesetImages({});

    return () => {
      cancelled = true;
    };
  }, [currentMap?.tilesetId, currentMap?.tilesetNames]);

  // Load character images used by events
  useEffect(() => {
    if (!currentMap || !currentMap.events) {
      setCharImages({});
      return;
    }
    const names = new Set<string>();
    for (const ev of currentMap.events) {
      if (!ev || !ev.pages) continue;
      for (const page of ev.pages) {
        if (page.image && page.image.characterName) {
          names.add(page.image.characterName);
        }
      }
    }
    if (names.size === 0) {
      setCharImages({});
      return;
    }
    let cancelled = false;
    const loaded: Record<string, HTMLImageElement> = {};
    let remaining = names.size;
    for (const name of names) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[name] = img;
        remaining--;
        if (remaining <= 0) setCharImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setCharImages({ ...loaded });
      };
      img.src = `/api/resources/img_characters/${name}.png`;
    }
    return () => { cancelled = true; };
  }, [currentMap?.events]);

  // Load player character image
  useEffect(() => {
    if (!playerCharacterName) {
      setPlayerCharImg(null);
      return;
    }
    if (charImages[playerCharacterName]) {
      setPlayerCharImg(charImages[playerCharacterName]);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setPlayerCharImg(img); };
    img.onerror = () => { if (!cancelled) setPlayerCharImg(null); };
    img.src = `/api/resources/img_characters/${playerCharacterName}.png`;
    return () => { cancelled = true; };
  }, [playerCharacterName, charImages]);

  return { tilesetImages, charImages, playerCharImg };
}
