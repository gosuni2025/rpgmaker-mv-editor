import { useState, useMemo, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { CONTINUATION_CODES, BLOCK_END_CODES } from './commandConstants';

export function useCommandFolding(commands: EventCommand[]) {
  const [foldedSet, setFoldedSet] = useState<Set<number>>(new Set());

  // CONTINUATION_CODES + BLOCK_END_CODES 기반, 접을 수 있는 인덱스
  const foldableIndices = useMemo(() => {
    const result = new Set<number>();
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      // 단순 연속형: 뒤에 실제 continuation이 있는 경우만
      const contCode = CONTINUATION_CODES[cmd.code];
      if (contCode !== undefined && i + 1 < commands.length && commands[i + 1].code === contCode) {
        result.add(i);
        continue;
      }
      // 블록 구조형: 종료 마커가 존재하는 경우
      const endCodes = BLOCK_END_CODES[cmd.code];
      if (endCodes) {
        const baseIndent = cmd.indent;
        let depth = 0;
        for (let j = i + 1; j < commands.length; j++) {
          if (commands[j].code === cmd.code && commands[j].indent === baseIndent) {
            depth++;
          }
          if (endCodes.includes(commands[j].code) && commands[j].indent === baseIndent) {
            if (depth === 0) {
              result.add(i);
              break;
            }
            depth--;
          }
        }
      }
    }
    return result;
  }, [commands]);

  // 접힌 그룹의 하위 커맨드 인덱스
  const hiddenIndices = useMemo(() => {
    const hidden = new Set<number>();
    for (const foldIdx of foldedSet) {
      if (!foldableIndices.has(foldIdx)) continue;
      const cmd = commands[foldIdx];
      if (!cmd) continue;

      // 단순 연속형
      const contCode = CONTINUATION_CODES[cmd.code];
      if (contCode !== undefined) {
        for (let i = foldIdx + 1; i < commands.length; i++) {
          if (commands[i].code === contCode) {
            hidden.add(i);
          } else {
            break;
          }
        }
        continue;
      }

      // 블록 구조형: 주 명령어 다음부터 종료 마커(포함)까지 숨김
      const endCodes = BLOCK_END_CODES[cmd.code];
      if (endCodes) {
        const baseIndent = cmd.indent;
        let depth = 0;
        for (let i = foldIdx + 1; i < commands.length; i++) {
          if (commands[i].code === cmd.code && commands[i].indent === baseIndent) {
            depth++;
          }
          hidden.add(i);
          if (endCodes.includes(commands[i].code) && commands[i].indent === baseIndent) {
            if (depth === 0) break;
            depth--;
          }
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
      const cmd = commands[foldIdx];
      if (!cmd) continue;

      const contCode = CONTINUATION_CODES[cmd.code];
      if (contCode !== undefined) {
        let count = 0;
        for (let i = foldIdx + 1; i < commands.length; i++) {
          if (commands[i].code === contCode) count++;
          else break;
        }
        if (count > 0) counts.set(foldIdx, count);
        continue;
      }

      const endCodes = BLOCK_END_CODES[cmd.code];
      if (endCodes) {
        const baseIndent = cmd.indent;
        let depth = 0;
        let count = 0;
        for (let i = foldIdx + 1; i < commands.length; i++) {
          if (commands[i].code === cmd.code && commands[i].indent === baseIndent) {
            depth++;
          }
          count++;
          if (endCodes.includes(commands[i].code) && commands[i].indent === baseIndent) {
            if (depth === 0) break;
            depth--;
          }
        }
        if (count > 0) counts.set(foldIdx, count);
      }
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
