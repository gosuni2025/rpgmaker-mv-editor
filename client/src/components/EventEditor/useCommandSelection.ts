import { useState, useMemo, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { CHILD_TO_PARENT, getCommandGroupRange } from './commandConstants';

export function useCommandSelection(commands: EventCommand[]) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState(-1);

  const primaryIndex = useMemo(() => {
    if (selectedIndices.size === 0) return -1;
    return Math.min(...selectedIndices);
  }, [selectedIndices]);

  const handleRowClick = useCallback((index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex >= 0) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSet = new Set(selectedIndices);
      for (let i = start; i <= end; i++) newSet.add(i);
      setSelectedIndices(newSet);
    } else if (e.metaKey || e.ctrlKey) {
      const newSet = new Set(selectedIndices);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      setSelectedIndices(newSet);
      setLastClickedIndex(index);
    } else {
      setSelectedIndices(new Set([index]));
      setLastClickedIndex(index);
    }
  }, [lastClickedIndex, selectedIndices]);

  // 그룹 하이라이트는 단일 선택 시에만
  const [groupStart, groupEnd] = useMemo(() => {
    if (selectedIndices.size !== 1) return [-1, -1];
    let idx = [...selectedIndices][0];
    if (idx < 0 || idx >= commands.length) return [-1, -1];
    const cmd = commands[idx];
    if (CHILD_TO_PARENT[cmd.code]) {
      const parentCodes = CHILD_TO_PARENT[cmd.code];
      for (let i = idx - 1; i >= 0; i--) {
        if (parentCodes.includes(commands[i].code) && commands[i].indent === cmd.indent) {
          idx = i;
          break;
        }
      }
    }
    return getCommandGroupRange(commands, idx);
  }, [selectedIndices, commands]);

  return {
    selectedIndices,
    setSelectedIndices,
    lastClickedIndex,
    setLastClickedIndex,
    primaryIndex,
    handleRowClick,
    groupStart,
    groupEnd,
  };
}
