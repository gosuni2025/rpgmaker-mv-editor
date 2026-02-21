import { useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { use3DCameraControls } from './use3DCameraControls';
import { useEditorCommands } from './useEditorCommands';

interface KeyboardShortcutsResult {
  showGrid: boolean;
  showTileId: boolean;
  altPressed: boolean;
  panning: boolean;
}

export function useKeyboardShortcuts(
  containerRef: React.RefObject<HTMLDivElement | null>,
): KeyboardShortcutsResult {
  const [altPressed, setAltPressed] = useState(false);
  const showGrid = useEditorStore((s) => s.showGrid);
  const [showTileId, setShowTileId] = useState(false);

  // 3D camera controls (wheel zoom, mouse drag, WASD/QE)
  const { panning } = use3DCameraControls(containerRef);

  // Editor commands (Delete, Copy/Cut/Paste, SelectAll, Deselect, Escape)
  useEditorCommands();

  // Alt key state for eyedropper cursor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPressed(true); };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPressed(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Tile ID debug toggle
  useEffect(() => {
    const handler = (e: Event) => setShowTileId((e as CustomEvent<boolean>).detail);
    window.addEventListener('editor-toggle-tileid', handler);
    return () => window.removeEventListener('editor-toggle-tileid', handler);
  }, []);

  return { showGrid, showTileId, altPressed, panning };
}
