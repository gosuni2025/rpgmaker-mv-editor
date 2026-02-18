import { useState, useRef, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { CHILD_TO_PARENT, getCommandGroupRange, isValidDropTarget, getDropTargetIndent } from './commandConstants';

export function useCommandDragDrop(
  commands: EventCommand[],
  changeWithHistory: (cmds: EventCommand[]) => void,
  setSelectedIndices: (s: Set<number>) => void,
  setLastClickedIndex: (i: number) => void,
) {
  const [dragGroupRange, setDragGroupRange] = useState<[number, number] | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragStartY = useRef<number>(0);
  const listRef = useRef<HTMLDivElement>(null);

  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const range = getCommandGroupRange(commands, index);
    setDragGroupRange(range);
    setSelectedIndices(new Set([index]));
    setLastClickedIndex(index);
    dragStartY.current = e.clientY;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!listRef.current) return;
      const listRect = listRef.current.getBoundingClientRect();
      const rows = listRef.current.querySelectorAll('.event-command-row');
      const mouseY = ev.clientY;

      const scrollMargin = 30;
      if (mouseY < listRect.top + scrollMargin) {
        listRef.current.scrollTop -= 6;
      } else if (mouseY > listRect.bottom - scrollMargin) {
        listRef.current.scrollTop += 6;
      }

      let closestCmdIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as HTMLElement;
        const cmdIdx = parseInt(row.dataset.cmdIndex || '0', 10);
        const rect = row.getBoundingClientRect();
        const topDist = Math.abs(mouseY - rect.top);
        const bottomDist = Math.abs(mouseY - rect.bottom);
        if (topDist < closestDist) {
          closestDist = topDist;
          closestCmdIdx = cmdIdx;
        }
        if (bottomDist < closestDist) {
          closestDist = bottomDist;
          closestCmdIdx = cmdIdx + 1;
        }
      }
      setDropTargetIndex(closestCmdIdx);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';

      setDragGroupRange(prev => {
        setDropTargetIndex(prevDrop => {
          if (prev && prevDrop !== null) {
            const [start, end] = prev;
            if (isValidDropTarget(commands, prevDrop, start, end) &&
                !(prevDrop >= start && prevDrop <= end + 1)) {
              const groupLen = end - start + 1;
              const group = commands.slice(start, end + 1);

              // 드롭 위치의 indent 계산 (드래그 소스 제거 전 기준)
              const targetIndent = getDropTargetIndent(commands, prevDrop);
              const sourceMinIndent = Math.min(...group.map(c => c.indent));
              const indentDelta = targetIndent - sourceMinIndent;

              // indent 조정 적용
              const adjustedGroup = indentDelta !== 0
                ? group.map(c => ({ ...c, indent: c.indent + indentDelta }))
                : group;

              const rest = [...commands.slice(0, start), ...commands.slice(end + 1)];
              const insertAt = prevDrop > end ? prevDrop - groupLen : prevDrop;
              rest.splice(insertAt, 0, ...adjustedGroup);
              changeWithHistory(rest);
              setSelectedIndices(new Set([insertAt]));
              setLastClickedIndex(insertAt);
            }
          }
          return null;
        });
        return null;
      });
    };

    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [commands, changeWithHistory, setSelectedIndices, setLastClickedIndex]);

  const isDraggable = useCallback((index: number): boolean => {
    const cmd = commands[index];
    if (cmd.code === 0 && index === commands.length - 1) return false;
    if (CHILD_TO_PARENT[cmd.code]) return false;
    return true;
  }, [commands]);

  return {
    dragGroupRange,
    dropTargetIndex,
    handleDragHandleMouseDown,
    isDraggable,
    listRef,
  };
}
