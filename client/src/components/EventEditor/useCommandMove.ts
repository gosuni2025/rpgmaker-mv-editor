import { useCallback, useMemo } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { CHILD_TO_PARENT, getCommandGroupRange, expandSelectionToGroups } from './commandConstants';

export function useCommandMove(
  commands: EventCommand[],
  selectedIndices: Set<number>,
  changeWithHistory: (cmds: EventCommand[]) => void,
  setSelectedIndices: (s: Set<number>) => void,
  setLastClickedIndex: (i: number) => void,
) {
  // 이동용 그룹 범위: 해당 인덱스가 속한 "최상위 이동 단위"의 범위를 반환
  const getMoveGroupRange = useCallback((index: number): [number, number] => {
    if (index < 0 || index >= commands.length) return [index, index];
    const cmd = commands[index];
    // 블록 부속 코드 → 부모 블록 전체
    if (CHILD_TO_PARENT[cmd.code] && ![401, 405, 408, 655, 605].includes(cmd.code)) {
      const parentCodes = CHILD_TO_PARENT[cmd.code];
      for (let i = index - 1; i >= 0; i--) {
        if (parentCodes.includes(commands[i].code) && commands[i].indent === cmd.indent) {
          return getCommandGroupRange(commands, i);
        }
      }
    }
    // 연속 부속 코드(401 등) → 부모+연속라인 전체
    if ([401, 405, 408, 655, 605].includes(cmd.code)) {
      const parentCodes = CHILD_TO_PARENT[cmd.code];
      for (let i = index - 1; i >= 0; i--) {
        if (parentCodes && parentCodes.includes(commands[i].code)) {
          return getCommandGroupRange(commands, i);
        }
        if (commands[i].code !== cmd.code) break;
      }
    }
    return getCommandGroupRange(commands, index);
  }, [commands]);

  const moveSelected = useCallback((direction: 'up' | 'down') => {
    if (selectedIndices.size === 0) return;
    const ranges = expandSelectionToGroups(commands, selectedIndices);
    const allMin = ranges[0][0];
    const allMax = ranges[ranges.length - 1][1];
    const movingIndices = new Set<number>();
    for (const [s, e] of ranges) {
      for (let i = s; i <= e; i++) movingIndices.add(i);
    }

    if (direction === 'up') {
      if (allMin <= 0) return;
      const aboveRange = getMoveGroupRange(allMin - 1);
      const targetIdx = aboveRange[0];
      const newCommands = [...commands];
      const moving = [...movingIndices].sort((a, b) => a - b).map(i => newCommands[i]);
      const rest = newCommands.filter((_, i) => !movingIndices.has(i));
      const insertAt = targetIdx;
      rest.splice(insertAt, 0, ...moving);
      changeWithHistory(rest);
      const newSel = new Set<number>();
      for (let i = insertAt; i < insertAt + moving.length; i++) newSel.add(i);
      setSelectedIndices(newSel);
      setLastClickedIndex(insertAt);
    } else {
      if (allMax >= commands.length - 2) return;
      const belowRange = getMoveGroupRange(allMax + 1);
      const targetEnd = belowRange[1];
      const newCommands = [...commands];
      const moving = [...movingIndices].sort((a, b) => a - b).map(i => newCommands[i]);
      const rest = newCommands.filter((_, i) => !movingIndices.has(i));
      const insertAt = targetEnd - moving.length + 1;
      rest.splice(insertAt, 0, ...moving);
      changeWithHistory(rest);
      const newSel = new Set<number>();
      for (let i = insertAt; i < insertAt + moving.length; i++) newSel.add(i);
      setSelectedIndices(newSel);
      setLastClickedIndex(insertAt);
    }
  }, [commands, selectedIndices, changeWithHistory, getMoveGroupRange, setSelectedIndices, setLastClickedIndex]);

  const canMoveUp = useMemo(() => {
    if (selectedIndices.size === 0) return false;
    const ranges = expandSelectionToGroups(commands, selectedIndices);
    return ranges[0][0] > 0;
  }, [commands, selectedIndices]);

  const canMoveDown = useMemo(() => {
    if (selectedIndices.size === 0) return false;
    const ranges = expandSelectionToGroups(commands, selectedIndices);
    return ranges[ranges.length - 1][1] < commands.length - 2;
  }, [commands, selectedIndices]);

  return { moveSelected, canMoveUp, canMoveDown };
}
