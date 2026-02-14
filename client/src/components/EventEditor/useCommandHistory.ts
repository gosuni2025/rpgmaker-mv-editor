import { useRef, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';

const MAX_UNDO = 100;

export function useCommandHistory(commands: EventCommand[], onChange: (commands: EventCommand[]) => void) {
  const undoStack = useRef<EventCommand[][]>([]);
  const redoStack = useRef<EventCommand[][]>([]);

  const changeWithHistory = useCallback((newCommands: EventCommand[]) => {
    undoStack.current.push(commands);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    onChange(newCommands);
  }, [commands, onChange]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push(commands);
    const prev = undoStack.current.pop()!;
    onChange(prev);
  }, [commands, onChange]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(commands);
    const next = redoStack.current.pop()!;
    onChange(next);
  }, [commands, onChange]);

  return {
    changeWithHistory,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
