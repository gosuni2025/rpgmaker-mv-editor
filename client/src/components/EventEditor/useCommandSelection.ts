import { useState, useMemo, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { CHILD_TO_PARENT, getCommandGroupRange } from './commandConstants';
import { getDisabledBlockId, findDisabledBlock } from './commandOperations';

export function useCommandSelection(commands: EventCommand[]) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState(-1);

  const primaryIndex = useMemo(() => {
    if (selectedIndices.size === 0) return -1;
    return Math.min(...selectedIndices);
  }, [selectedIndices]);

  // 주석 처리된 블록이면 blockId로 블록 전체 인덱스 반환, 아니면 단일 인덱스
  const getBlockIndices = useCallback((index: number): Set<number> => {
    const cmd = commands[index];
    if (!cmd) return new Set([index]);
    const blockId = getDisabledBlockId(cmd);
    if (blockId) return findDisabledBlock(commands, blockId);
    return new Set([index]);
  }, [commands]);

  const handleRowClick = useCallback((index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex >= 0) {
      // Shift 클릭: 범위 선택 (기존 동작)
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSet = new Set(selectedIndices);
      for (let i = start; i <= end; i++) newSet.add(i);
      setSelectedIndices(newSet);
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd 클릭: 추가/제거 (주석 블록이면 블록 전체)
      const blockIndices = getBlockIndices(index);
      const newSet = new Set(selectedIndices);
      if (newSet.has(index)) {
        for (const bi of blockIndices) newSet.delete(bi);
      } else {
        for (const bi of blockIndices) newSet.add(bi);
      }
      setSelectedIndices(newSet);
      setLastClickedIndex(index);
    } else {
      // 일반 클릭: 주석 블록이면 블록 전체 선택
      const blockIndices = getBlockIndices(index);
      setSelectedIndices(blockIndices);
      setLastClickedIndex(index);
    }
  }, [lastClickedIndex, selectedIndices, getBlockIndices]);

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
