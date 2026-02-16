import { useState, useMemo, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { CONTINUATION_CODES } from './commandConstants';

export function useCommandFolding(commands: EventCommand[]) {
  const [foldedSet, setFoldedSet] = useState<Set<number>>(new Set());

  // CONTINUATION_CODES 기반, 뒤에 실제 continuation이 있는 인덱스만
  const foldableIndices = useMemo(() => {
    const result = new Set<number>();
    for (let i = 0; i < commands.length; i++) {
      const contCode = CONTINUATION_CODES[commands[i].code];
      if (contCode !== undefined && i + 1 < commands.length && commands[i + 1].code === contCode) {
        result.add(i);
      }
    }
    return result;
  }, [commands]);

  // 접힌 그룹의 하위 커맨드 인덱스
  const hiddenIndices = useMemo(() => {
    const hidden = new Set<number>();
    for (const foldIdx of foldedSet) {
      if (!foldableIndices.has(foldIdx)) continue;
      const contCode = CONTINUATION_CODES[commands[foldIdx]?.code];
      if (contCode === undefined) continue;
      for (let i = foldIdx + 1; i < commands.length; i++) {
        if (commands[i].code === contCode) {
          hidden.add(i);
        } else {
          break;
        }
      }
    }
    return hidden;
  }, [foldedSet, foldableIndices, commands]);

  // 접힌 줄 수 ("+N줄" 표시용)
  const foldedCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const foldIdx of foldedSet) {
      if (!foldableIndices.has(foldIdx)) continue;
      const contCode = CONTINUATION_CODES[commands[foldIdx]?.code];
      if (contCode === undefined) continue;
      let count = 0;
      for (let i = foldIdx + 1; i < commands.length; i++) {
        if (commands[i].code === contCode) {
          count++;
        } else {
          break;
        }
      }
      if (count > 0) counts.set(foldIdx, count);
    }
    return counts;
  }, [foldedSet, foldableIndices, commands]);

  const toggleFold = useCallback((index: number) => {
    setFoldedSet(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const foldAll = useCallback(() => {
    setFoldedSet(new Set(foldableIndices));
  }, [foldableIndices]);

  const unfoldAll = useCallback(() => {
    setFoldedSet(new Set());
  }, []);

  return {
    foldedSet,
    setFoldedSet,
    foldableIndices,
    hiddenIndices,
    foldedCounts,
    toggleFold,
    foldAll,
    unfoldAll,
  };
}
