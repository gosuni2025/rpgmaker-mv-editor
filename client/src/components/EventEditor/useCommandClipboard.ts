import { useState, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { expandSelectionToGroups } from './commandConstants';

// 내부 클립보드 (컴포넌트 외부에 두어 리렌더 없이 유지)
let commandClipboard: EventCommand[] = [];

// OS 클립보드 식별용 래퍼
const CLIPBOARD_MARKER = 'RPGMV_EVENT_COMMANDS';
interface ClipboardPayload {
  _type: typeof CLIPBOARD_MARKER;
  commands: EventCommand[];
}

function writeCommandsToClipboard(cmds: EventCommand[]) {
  const payload: ClipboardPayload = { _type: CLIPBOARD_MARKER, commands: cmds };
  navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
}

function parseClipboardText(text: string): EventCommand[] | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed._type === CLIPBOARD_MARKER && Array.isArray(parsed.commands)) {
      return parsed.commands;
    }
  } catch { /* ignore */ }
  return null;
}

export function useCommandClipboard(
  commands: EventCommand[],
  selectedIndices: Set<number>,
  primaryIndex: number,
  changeWithHistory: (cmds: EventCommand[]) => void,
  setSelectedIndices: (s: Set<number>) => void,
  setLastClickedIndex: (i: number) => void,
) {
  const [hasClipboard, setHasClipboard] = useState(commandClipboard.length > 0);

  const copySelected = useCallback(() => {
    if (selectedIndices.size === 0) return;
    const ranges = expandSelectionToGroups(commands, selectedIndices);
    const copied: EventCommand[] = [];
    for (const [start, end] of ranges) {
      for (let i = start; i <= end; i++) {
        copied.push(JSON.parse(JSON.stringify(commands[i])));
      }
    }
    commandClipboard = copied;
    setHasClipboard(true);
    writeCommandsToClipboard(copied);
  }, [commands, selectedIndices]);

  const doPaste = useCallback((source: EventCommand[]) => {
    if (source.length === 0) return;
    const insertAt = primaryIndex >= 0 ? primaryIndex : commands.length - 1;
    const baseIndent = commands[insertAt]?.indent || 0;
    const clipMinIndent = Math.min(...source.map(c => c.indent));
    const indentDelta = baseIndent - clipMinIndent;
    const adjusted = source.map(c => ({
      ...c,
      indent: c.indent + indentDelta,
      parameters: JSON.parse(JSON.stringify(c.parameters)),
    }));
    const newCommands = [...commands];
    newCommands.splice(insertAt, 0, ...adjusted);
    changeWithHistory(newCommands);
    const newSelection = new Set<number>();
    for (let i = insertAt; i < insertAt + adjusted.length; i++) newSelection.add(i);
    setSelectedIndices(newSelection);
    setLastClickedIndex(insertAt);
  }, [commands, primaryIndex, changeWithHistory, setSelectedIndices, setLastClickedIndex]);

  const pasteAtSelection = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseClipboardText(text);
      if (parsed && parsed.length > 0) {
        commandClipboard = parsed;
        setHasClipboard(true);
        doPaste(parsed);
        return;
      }
    } catch { /* 권한 거부 등 */ }
    doPaste(commandClipboard);
  }, [doPaste]);

  const deleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) return;
    const ranges = expandSelectionToGroups(commands, selectedIndices);
    const toRemove = new Set<number>();
    for (const [start, end] of ranges) {
      for (let i = start; i <= end; i++) toRemove.add(i);
    }
    const lastIdx = commands.length - 1;
    if (commands[lastIdx]?.code === 0) toRemove.delete(lastIdx);
    if (toRemove.size === 0) return;
    const newCommands = commands.filter((_, i) => !toRemove.has(i));
    changeWithHistory(newCommands);
    const minRemoved = Math.min(...toRemove);
    setSelectedIndices(new Set([Math.min(minRemoved, newCommands.length - 1)]));
    setLastClickedIndex(Math.min(minRemoved, newCommands.length - 1));
  }, [commands, selectedIndices, changeWithHistory, setSelectedIndices, setLastClickedIndex]);

  return {
    copySelected,
    pasteAtSelection,
    deleteSelected,
    hasClipboard,
  };
}
