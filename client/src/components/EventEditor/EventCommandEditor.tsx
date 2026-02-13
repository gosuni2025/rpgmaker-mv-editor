import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventCommand } from '../../types/rpgMakerMV';
import CommandParamEditor from './CommandParamEditor';
import CommandInsertDialog from './CommandInsertDialog';
import TranslateButton from '../common/TranslateButton';
import useEditorStore from '../../store/useEditorStore';
import {
  NO_PARAM_CODES, CONTINUATION_CODES, BLOCK_END_CODES, CHILD_TO_PARENT,
  HAS_PARAM_EDITOR, getCommandGroupRange, expandSelectionToGroups, isValidDropTarget,
} from './commandConstants';

export interface EventCommandContext {
  mapId?: number;
  eventId?: number;
  pageIndex?: number;
  isCommonEvent?: boolean;
  commonEventId?: number;
}

interface EventCommandEditorProps {
  commands: EventCommand[];
  onChange: (commands: EventCommand[]) => void;
  context?: EventCommandContext;
}

const MAX_UNDO = 100;

// 내부 클립보드 (컴포넌트 외부에 두어 리렌더 없이 유지)
let commandClipboard: EventCommand[] = [];

export default function EventCommandEditor({ commands, onChange, context }: EventCommandEditorProps) {
  const { t } = useTranslation();
  const systemData = useEditorStore(s => s.systemData);
  const maps = useEditorStore(s => s.maps);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState(-1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hasClipboard, setHasClipboard] = useState(commandClipboard.length > 0);

  // 드래그 상태
  const [dragGroupRange, setDragGroupRange] = useState<[number, number] | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragStartY = useRef<number>(0);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const undoStack = useRef<EventCommand[][]>([]);
  const redoStack = useRef<EventCommand[][]>([]);

  // 단일 선택 편의: 선택된 항목 중 가장 작은 인덱스 (삽입 위치 등에 사용)
  const primaryIndex = useMemo(() => {
    if (selectedIndices.size === 0) return -1;
    return Math.min(...selectedIndices);
  }, [selectedIndices]);

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
    setSelectedIndices(new Set());
    setLastClickedIndex(-1);
  }, [commands, onChange]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(commands);
    const next = redoStack.current.pop()!;
    onChange(next);
    setSelectedIndices(new Set());
    setLastClickedIndex(-1);
  }, [commands, onChange]);

  const deleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) return;
    // 그룹 단위로 확장
    const ranges = expandSelectionToGroups(commands, selectedIndices);
    const toRemove = new Set<number>();
    for (const [start, end] of ranges) {
      for (let i = start; i <= end; i++) toRemove.add(i);
    }
    // 마지막 빈 명령어는 삭제 방지
    const lastIdx = commands.length - 1;
    if (commands[lastIdx]?.code === 0) toRemove.delete(lastIdx);

    if (toRemove.size === 0) return;
    const newCommands = commands.filter((_, i) => !toRemove.has(i));
    changeWithHistory(newCommands);
    const minRemoved = Math.min(...toRemove);
    setSelectedIndices(new Set([Math.min(minRemoved, newCommands.length - 1)]));
    setLastClickedIndex(Math.min(minRemoved, newCommands.length - 1));
  }, [commands, selectedIndices, changeWithHistory]);

  // --- 복사 / 붙여넣기 ---
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
  }, [commands, selectedIndices]);

  const pasteAtSelection = useCallback(() => {
    if (commandClipboard.length === 0) return;
    const insertAt = primaryIndex >= 0 ? primaryIndex : commands.length - 1;
    const baseIndent = commands[insertAt]?.indent || 0;
    // 클립보드 커맨드의 indent를 삽입 위치 기준으로 보정
    const clipMinIndent = Math.min(...commandClipboard.map(c => c.indent));
    const indentDelta = baseIndent - clipMinIndent;
    const adjusted = commandClipboard.map(c => ({
      ...c,
      indent: c.indent + indentDelta,
      parameters: JSON.parse(JSON.stringify(c.parameters)),
    }));
    const newCommands = [...commands];
    newCommands.splice(insertAt, 0, ...adjusted);
    changeWithHistory(newCommands);
    // 붙여넣은 범위를 선택
    const newSelection = new Set<number>();
    for (let i = insertAt; i < insertAt + adjusted.length; i++) newSelection.add(i);
    setSelectedIndices(newSelection);
    setLastClickedIndex(insertAt);
  }, [commands, primaryIndex, changeWithHistory]);

  // 커맨드 목록 내부에서만 Cmd+C/V 처리 (이벤트 커맨드 에디터에 포커스 있을 때)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 모달 열려있으면 무시
      if (showAddDialog || pendingCode !== null || editingIndex !== null) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        copySelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        pasteAtSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        e.stopPropagation();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        // 전체 선택 (마지막 빈 명령어 제외)
        const all = new Set<number>();
        for (let i = 0; i < commands.length - 1; i++) all.add(i);
        setSelectedIndices(all);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIndices.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [copySelected, pasteAtSelection, undo, redo, deleteSelected, showAddDialog, pendingCode, editingIndex, selectedIndices, commands]);

  // 그룹 하이라이트는 단일 선택 시에만
  const [groupStart, groupEnd] = useMemo(() => {
    if (selectedIndices.size !== 1) return [-1, -1];
    let idx = [...selectedIndices][0];
    if (idx < 0 || idx >= commands.length) return [-1, -1];
    // 연속형 부속 코드(401 등)를 선택한 경우 부모 커맨드를 찾아서 그 전체 그룹 범위 반환
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

  const handleRowClick = useCallback((index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex >= 0) {
      // Shift+클릭: 마지막 클릭 위치부터 현재까지 범위 선택
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSet = new Set(selectedIndices);
      for (let i = start; i <= end; i++) newSet.add(i);
      setSelectedIndices(newSet);
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl+클릭: 토글
      const newSet = new Set(selectedIndices);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      setSelectedIndices(newSet);
      setLastClickedIndex(index);
    } else {
      // 일반 클릭: 단일 선택
      setSelectedIndices(new Set([index]));
      setLastClickedIndex(index);
    }
  }, [lastClickedIndex, selectedIndices]);

  const insertCommandWithParams = (code: number, params: unknown[], extraCommands?: EventCommand[]) => {
    const insertAt = primaryIndex >= 0 ? primaryIndex : commands.length - 1;
    const indent = commands[insertAt]?.indent || 0;
    const newCmd: EventCommand = { code, indent, parameters: params };

    const newCommands = [...commands];
    if (code === 111) {
      const wantElse = extraCommands?.some(ec => ec.code === 411);
      if (wantElse) {
        newCommands.splice(insertAt, 0, newCmd,
          { code: 0, indent: indent + 1, parameters: [] },
          { code: 411, indent, parameters: [] },
          { code: 0, indent: indent + 1, parameters: [] },
          { code: 412, indent, parameters: [] });
      } else {
        newCommands.splice(insertAt, 0, newCmd, { code: 0, indent: indent + 1, parameters: [] }, { code: 412, indent, parameters: [] });
      }
    } else if (code === 112) {
      newCommands.splice(insertAt, 0, newCmd, { code: 0, indent: indent + 1, parameters: [] }, { code: 413, indent, parameters: [] });
    } else if (code === 102 && extraCommands && extraCommands.length > 0) {
      const extras = extraCommands.map(ec => ({
        ...ec,
        indent: ec.indent === 0 ? indent : indent + ec.indent,
      }));
      newCommands.splice(insertAt, 0, newCmd, ...extras);
    } else if (code === 102) {
      // fallback (에디터 없이 삽입 시)
      newCommands.splice(insertAt, 0,
        { code: 102, indent, parameters: [['예', '아니오'], -2, 0, 2, 0] },
        { code: 402, indent, parameters: [0, '예'] },
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 402, indent, parameters: [1, '아니오'] },
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 404, indent, parameters: [] },
      );
    } else if (extraCommands && extraCommands.length > 0) {
      const extras = extraCommands.map(ec => ({ ...ec, indent }));
      newCommands.splice(insertAt, 0, newCmd, ...extras);
    } else {
      newCommands.splice(insertAt, 0, newCmd);
    }
    changeWithHistory(newCommands);
    setShowAddDialog(false);
    setPendingCode(null);
  };

  const handleCommandSelect = (code: number) => {
    if (NO_PARAM_CODES.has(code)) {
      insertCommandWithParams(code, []);
    } else if (HAS_PARAM_EDITOR.has(code)) {
      setShowAddDialog(false);
      setPendingCode(code);
    } else {
      // No editor yet — insert with empty params
      insertCommandWithParams(code, []);
    }
  };

  const updateCommandParams = (index: number, params: unknown[], extra?: EventCommand[]) => {
    const newCommands = [...commands];
    const cmd = newCommands[index];
    newCommands[index] = { ...cmd, parameters: params };

    // 조건 분기(111) Else 추가/제거 특별 처리
    if (cmd.code === 111 && extra) {
      const wantElse = extra.some(ec => ec.code === 411);
      // 현재 Else(411)가 있는지 확인
      let hasExistingElse = false;
      let elseIndex = -1;
      let blockEndIndex = -1;
      const baseIndent = cmd.indent;
      for (let i = index + 1; i < newCommands.length; i++) {
        if (newCommands[i].code === 411 && newCommands[i].indent === baseIndent) {
          hasExistingElse = true;
          elseIndex = i;
        }
        if (newCommands[i].code === 412 && newCommands[i].indent === baseIndent) {
          blockEndIndex = i;
          break;
        }
      }
      if (wantElse && !hasExistingElse && blockEndIndex >= 0) {
        // Else 블록 추가 (412 바로 앞에)
        newCommands.splice(blockEndIndex, 0,
          { code: 411, indent: baseIndent, parameters: [] },
          { code: 0, indent: baseIndent + 1, parameters: [] },
        );
      } else if (!wantElse && hasExistingElse && elseIndex >= 0 && blockEndIndex >= 0) {
        // Else 블록 제거 (411부터 412 직전까지)
        newCommands.splice(elseIndex, blockEndIndex - elseIndex);
      }
      changeWithHistory(newCommands);
      setEditingIndex(null);
      return;
    }

    // 후속 라인(continuation) 교체: 기존 후속 라인 제거 후 새 extra 삽입
    if (extra) {
      const contCode = CONTINUATION_CODES[cmd.code];
      if (contCode !== undefined) {
        // 연속형: 기존 후속 코드 라인 제거
        let removeEnd = index;
        for (let i = index + 1; i < newCommands.length; i++) {
          if (newCommands[i].code === contCode) removeEnd = i;
          else break;
        }
        const removeCount = removeEnd - index;
        if (removeCount > 0) {
          newCommands.splice(index + 1, removeCount);
        }
        // 새 후속 라인 삽입 (indent는 원본 커맨드와 동일)
        const insertExtra = extra.map(e => ({ ...e, indent: cmd.indent }));
        newCommands.splice(index + 1, 0, ...insertExtra);
      } else {
        // 블록 구조형(102 Show Choices 등): 기존 블록 전체 교체
        const endCodes = BLOCK_END_CODES[cmd.code];
        if (endCodes) {
          let blockEnd = index;
          for (let i = index + 1; i < newCommands.length; i++) {
            if (endCodes.includes(newCommands[i].code) && newCommands[i].indent === cmd.indent) {
              blockEnd = i;
              break;
            }
          }
          const removeCount = blockEnd - index;
          if (removeCount > 0) {
            newCommands.splice(index + 1, removeCount);
          }
          const insertExtra = extra.map(e => ({ ...e, indent: e.indent + cmd.indent }));
          newCommands.splice(index + 1, 0, ...insertExtra);
        }
      }
    }

    changeWithHistory(newCommands);
    setEditingIndex(null);
  };

  const handleDoubleClick = (index: number) => {
    const cmd = commands[index];
    if (cmd.code === 0) {
      setShowAddDialog(true);
      return;
    }
    // For commands with param editors, open the editor
    if (HAS_PARAM_EDITOR.has(cmd.code)) {
      setEditingIndex(index);
      return;
    }
    // 부속 코드 더블클릭 시 부모 커맨드의 에디터를 열기
    const parentCodes = CHILD_TO_PARENT[cmd.code];
    if (parentCodes) {
      for (let i = index - 1; i >= 0; i--) {
        if (parentCodes.includes(commands[i].code) && commands[i].indent === cmd.indent) {
          if (HAS_PARAM_EDITOR.has(commands[i].code)) {
            setEditingIndex(i);
          }
          return;
        }
      }
    }
  };

  // --- 드래그 앤 드롭 로직 ---
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

      // 자동 스크롤
      const scrollMargin = 30;
      if (mouseY < listRect.top + scrollMargin) {
        listRef.current.scrollTop -= 6;
      } else if (mouseY > listRect.bottom - scrollMargin) {
        listRef.current.scrollTop += 6;
      }

      // 마우스 위치에 가장 가까운 행 경계 찾기
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < rows.length; i++) {
        const rect = rows[i].getBoundingClientRect();
        const topDist = Math.abs(mouseY - rect.top);
        const bottomDist = Math.abs(mouseY - rect.bottom);
        if (topDist < closestDist) {
          closestDist = topDist;
          closestIdx = i;
        }
        if (bottomDist < closestDist) {
          closestDist = bottomDist;
          closestIdx = i + 1;
        }
      }
      setDropTargetIndex(closestIdx);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';

      // 실제 이동 수행
      setDragGroupRange(prev => {
        setDropTargetIndex(prevDrop => {
          if (prev && prevDrop !== null) {
            const [start, end] = prev;
            if (isValidDropTarget(commands, prevDrop, start, end) &&
                !(prevDrop >= start && prevDrop <= end + 1)) {
              const groupLen = end - start + 1;
              const group = commands.slice(start, end + 1);
              const rest = [...commands.slice(0, start), ...commands.slice(end + 1)];
              const insertAt = prevDrop > end ? prevDrop - groupLen : prevDrop;
              rest.splice(insertAt, 0, ...group);
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
  }, [commands, changeWithHistory]);

  // 드래그 가능 여부 판별: 마지막 빈 명령어(종료 마커)와 블록 부속 코드는 드래그 불가
  const isDraggable = useCallback((index: number): boolean => {
    const cmd = commands[index];
    // 맨 마지막 빈 명령어는 드래그 불가
    if (cmd.code === 0 && index === commands.length - 1) return false;
    // 블록 부속 코드(402, 403, 404, 411, 412, 413, 601~604)는 단독 드래그 불가
    if (CHILD_TO_PARENT[cmd.code] && ![401, 405, 408, 655, 605].includes(cmd.code)) return false;
    return true;
  }, [commands]);

  // --- 위/아래 이동 ---
  // 이동용 그룹 범위: 해당 인덱스가 속한 "최상위 이동 단위"의 범위를 반환
  // getCommandGroupRange와 달리, 부속 코드도 그 부모 블록 전체를 이동 단위로 취급
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
      // 바로 위 커맨드의 이동 그룹 범위를 구함
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
      // 바로 아래 커맨드의 이동 그룹 범위를 구함
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
  }, [commands, selectedIndices, changeWithHistory, getMoveGroupRange]);

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

  const formatSwitchId = (id: number) => `#${String(id).padStart(4, '0')}`;

  const formatConditionalBranch = (params: unknown[]): string => {
    const condType = params[0] as number;
    const fmtId = (id: number) => String(id).padStart(4, '0');
    const compOps = ['=', '≥', '≤', '>', '<', '≠'];
    switch (condType) {
      case 0: { // 스위치
        const id = params[1] as number;
        const name = systemData?.switches?.[id];
        return `스위치 ${fmtId(id)}${name ? ' ' + name : ''} == ${(params[2] as number) === 0 ? 'ON' : 'OFF'}`;
      }
      case 1: { // 변수
        const id = params[1] as number;
        const name = systemData?.variables?.[id];
        const op = compOps[params[4] as number] || '=';
        const operandType = params[2] as number;
        let operand: string;
        if (operandType === 0) {
          operand = String(params[3] as number);
        } else {
          const vid = params[3] as number;
          const vname = systemData?.variables?.[vid];
          operand = `변수 ${fmtId(vid)}${vname ? ' ' + vname : ''}`;
        }
        return `변수 ${fmtId(id)}${name ? ' ' + name : ''} ${op} ${operand}`;
      }
      case 2: // 셀프 스위치
        return `셀프 스위치 ${params[1]} == ${(params[2] as number) === 0 ? 'ON' : 'OFF'}`;
      case 3: { // 타이머
        const sec = params[1] as number;
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        return `타이머 ${(params[2] as number) === 0 ? '≥' : '≤'} ${min}분 ${s}초`;
      }
      case 4: { // 액터
        const subType = params[2] as number;
        const subLabels = ['파티에 있다', '이름이', '직업이', '스킬을', '무기를', '방어구를', '스테이트가'];
        const label = subLabels[subType] || '';
        const param = subType === 0 ? '' : ` ${params[3]}`;
        return `액터 ${fmtId(params[1] as number)} ${label}${param}`;
      }
      case 5: { // 적
        const sub = params[2] as number;
        return sub === 0
          ? `적 #${(params[1] as number) + 1} 나타남`
          : `적 #${(params[1] as number) + 1} 스탯 ${fmtId(params[3] as number)}`;
      }
      case 6: { // 캐릭터
        const dirs: Record<number, string> = { 2: '아래', 4: '왼쪽', 6: '오른쪽', 8: '위' };
        const charLabel = (params[1] as number) === -1 ? '플레이어' : (params[1] as number) === 0 ? '이 이벤트' : `이벤트 ${params[1]}`;
        return `${charLabel} 마주하고 있음 ${dirs[params[2] as number] || params[2]}`;
      }
      case 7: { // 소지금
        const goldOps = ['≥', '≤', '<'];
        return `소지금 ${goldOps[params[2] as number] || '≥'} ${params[1]}`;
      }
      case 8: return `아이템 ${fmtId(params[1] as number)} 소지`;
      case 9: return `무기 ${fmtId(params[1] as number)} 소지${params[2] ? ' (장비 포함)' : ''}`;
      case 10: return `방어구 ${fmtId(params[1] as number)} 소지${params[2] ? ' (장비 포함)' : ''}`;
      case 11: return `버튼 [${params[1]}] 눌려있다`;
      case 12: return `스크립트: ${params[1]}`;
      case 13: {
        const vehicles = ['보트', '대형선', '비행선'];
        return `${vehicles[params[1] as number] || '차량'} 운행되었습니다`;
      }
      default: return JSON.stringify(params);
    }
  };

  const getCommandDisplay = (cmd: EventCommand): string => {
    const code = cmd.code;
    if (code === 0) return '';
    const displayKey = `eventCommands.display.${code}`;
    const desc = t(displayKey);
    let text = desc !== displayKey ? desc : `@${code}`;

    // 조건 분기 전용 포맷
    if (code === 111 && cmd.parameters && cmd.parameters.length >= 2) {
      return text + ': ' + formatConditionalBranch(cmd.parameters);
    }
    if (code === 411) return t('eventCommands.display.411');
    if (code === 412) return t('eventCommands.display.412');

    // 장소 이동 전용 포맷
    if (code === 201 && cmd.parameters && cmd.parameters.length >= 4) {
      const designationType = cmd.parameters[0] as number;
      const dirLabels: Record<number, string> = { 0: '유지', 2: '아래', 4: '왼쪽', 6: '오른쪽', 8: '위' };
      const fadeLabels: Record<number, string> = { 0: '검게', 1: '희게', 2: '없음' };
      const dir = dirLabels[cmd.parameters[4] as number] || '유지';
      const fade = fadeLabels[cmd.parameters[5] as number] || '검게';
      if (designationType === 0) {
        const mId = cmd.parameters[1] as number;
        const mx = cmd.parameters[2] as number;
        const my = cmd.parameters[3] as number;
        const mapName = maps?.[mId]?.name || '';
        text += `: ${mapName}(${mId},[${mx},${my}]), 방향:${dir}, 페이드:${fade}`;
      } else {
        const mVar = cmd.parameters[1] as number;
        const xVar = cmd.parameters[2] as number;
        const yVar = cmd.parameters[3] as number;
        text += `: {맵:V[${mVar}],X:V[${xVar}],Y:V[${yVar}]}, 방향:${dir}, 페이드:${fade}`;
      }
      return text;
    }

    // 탈 것 위치 설정 전용 포맷
    if (code === 202 && cmd.parameters && cmd.parameters.length >= 5) {
      const vehicleNames = ['보트', '선박', '비행선'];
      const vehicle = vehicleNames[cmd.parameters[0] as number] || '보트';
      const designationType = cmd.parameters[1] as number;
      if (designationType === 0) {
        const mId = cmd.parameters[2] as number;
        const mx = cmd.parameters[3] as number;
        const my = cmd.parameters[4] as number;
        const mapName = maps?.[mId]?.name || '';
        text += `: ${vehicle}, ${mapName}(${mId},[${mx},${my}])`;
      } else {
        const mVar = cmd.parameters[2] as number;
        const xVar = cmd.parameters[3] as number;
        const yVar = cmd.parameters[4] as number;
        text += `: ${vehicle}, {맵:V[${mVar}],X:V[${xVar}],Y:V[${yVar}]}`;
      }
      return text;
    }

    // 스위치 조작 전용 포맷
    if (code === 121 && cmd.parameters && cmd.parameters.length >= 3) {
      const startId = cmd.parameters[0] as number;
      const endId = cmd.parameters[1] as number;
      const op = cmd.parameters[2] as number === 0 ? 'ON' : 'OFF';
      if (startId === endId) {
        const name = systemData?.switches?.[startId];
        text += `: ${formatSwitchId(startId)}${name ? ' ' + name : ''} = ${op}`;
      } else {
        text += `: ${formatSwitchId(startId)}..${formatSwitchId(endId)} = ${op}`;
      }
      return text;
    }

    if (cmd.parameters && cmd.parameters.length > 0) {
      const params = cmd.parameters.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(', ');
      if (params.length > 60) {
        text += `: ${params.substring(0, 60)}...`;
      } else {
        text += `: ${params}`;
      }
    }
    return text;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }} ref={containerRef} tabIndex={-1}>
      <div className="event-commands-list" ref={listRef}>
        {commands.map((cmd, i) => {
          const display = getCommandDisplay(cmd);
          const draggable = isDraggable(i);
          const isDragging = dragGroupRange !== null && i >= dragGroupRange[0] && i <= dragGroupRange[1];
          const isSelected = selectedIndices.has(i);
          const hasGroup = groupStart !== groupEnd;
          const inGroup = hasGroup && selectedIndices.size === 1 && i >= groupStart && i <= groupEnd;
          const isGroupHL = inGroup && !isSelected;
          const isGroupFirst = inGroup && i === groupStart;
          const isGroupLast = inGroup && i === groupEnd;
          return (
            <React.Fragment key={i}>
              {dropTargetIndex === i && dragGroupRange && !(i >= dragGroupRange[0] && i <= dragGroupRange[1] + 1) && (
                <div className="event-command-drop-indicator" />
              )}
              <div
                className={`event-command-row${isSelected ? ' selected' : ''}${isGroupHL ? ' group-highlight' : ''}${isDragging ? ' dragging' : ''}${isGroupFirst ? ' group-first' : ''}${isGroupLast ? ' group-last' : ''}${inGroup ? ' group-member' : ''}`}
                style={{ paddingLeft: draggable ? cmd.indent * 20 : 8 + cmd.indent * 20 }}
                onClick={e => handleRowClick(i, e)}
                onDoubleClick={() => handleDoubleClick(i)}
              >
                {draggable && (
                  <span
                    className="drag-handle"
                    onMouseDown={e => handleDragHandleMouseDown(e, i)}
                    title={t('eventCommands.dragToMove')}
                  >
                    ⠿
                  </span>
                )}
                {display ? (
                  (cmd.code === 108 || cmd.code === 408) ? <span style={{ color: '#4ec94e' }}>{display}</span> : display
                ) : <span style={{ color: '#555' }}>&loz;</span>}
                {context && [101, 102, 105, 320, 324, 325].includes(cmd.code) && (() => {
                  const prefix = context.isCommonEvent
                    ? `ce${context.commonEventId}`
                    : `ev${context.eventId}.page${(context.pageIndex || 0) + 1}`;
                  const csvPath = context.isCommonEvent ? 'common_events.csv' : `maps/map${String(context.mapId).padStart(3, '0')}.csv`;
                  let sourceText = '';
                  if (cmd.code === 101 || cmd.code === 105) {
                    const lines: string[] = [];
                    const followCode = cmd.code === 101 ? 401 : 405;
                    for (let j = i + 1; j < commands.length && commands[j].code === followCode; j++) {
                      lines.push(commands[j].parameters[0] as string);
                    }
                    sourceText = lines.join('\n');
                  } else if (cmd.code === 102) {
                    sourceText = ((cmd.parameters[0] as string[]) || []).join(', ');
                  } else if (cmd.code === 320 || cmd.code === 324 || cmd.code === 325) {
                    sourceText = (cmd.parameters[1] as string) || '';
                  }
                  return sourceText ? (
                    <TranslateButton csvPath={csvPath} entryKey={`${prefix}.cmd${i}`} sourceText={sourceText} />
                  ) : null;
                })()}
              </div>
            </React.Fragment>
          );
        })}
        {dropTargetIndex === commands.length && dragGroupRange && (
          <div className="event-command-drop-indicator" />
        )}
      </div>
      <div className="event-commands-toolbar">
        <button className="db-btn-small" onClick={() => setShowAddDialog(true)}>{t('common.add')}</button>
        <button className="db-btn-small" onClick={deleteSelected} disabled={selectedIndices.size === 0}>{t('common.delete')}</button>
        <span className="event-commands-toolbar-sep" />
        <button className="db-btn-small" onClick={copySelected} disabled={selectedIndices.size === 0} title="Cmd+C">{t('common.copy')}</button>
        <button className="db-btn-small" onClick={pasteAtSelection} disabled={!hasClipboard} title="Cmd+V">{t('common.paste')}</button>
        <span className="event-commands-toolbar-sep" />
        <button className="db-btn-small" onClick={() => moveSelected('up')} disabled={!canMoveUp} title={t('eventCommands.moveUp')}>▲</button>
        <button className="db-btn-small" onClick={() => moveSelected('down')} disabled={!canMoveDown} title={t('eventCommands.moveDown')}>▼</button>
        <span style={{ flex: 1 }} />
        <button className="db-btn-small" onClick={undo} disabled={undoStack.current.length === 0} title="Ctrl+Z">{t('common.undo')}</button>
        <button className="db-btn-small" onClick={redo} disabled={redoStack.current.length === 0} title="Ctrl+Shift+Z">{t('common.redo')}</button>
      </div>

      {showAddDialog && (
        <CommandInsertDialog
          onSelect={handleCommandSelect}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {/* Parameter editor for new commands */}
      {pendingCode !== null && (
        <CommandParamEditor
          code={pendingCode}
          onOk={(params, extra) => insertCommandWithParams(pendingCode, params, extra)}
          onCancel={() => setPendingCode(null)}
        />
      )}

      {/* Parameter editor for editing existing commands */}
      {editingIndex !== null && (() => {
        const editCmd = commands[editingIndex];
        // 후속 라인 수집
        const contCode = CONTINUATION_CODES[editCmd.code];
        const follows: EventCommand[] = [];
        if (contCode !== undefined) {
          for (let i = editingIndex + 1; i < commands.length; i++) {
            if (commands[i].code === contCode) follows.push(commands[i]);
            else break;
          }
        }
        // 조건 분기(111) 편집 시 Else 존재 여부 확인
        let editHasElse: boolean | undefined;
        if (editCmd.code === 111) {
          editHasElse = false;
          for (let i = editingIndex + 1; i < commands.length; i++) {
            if (commands[i].code === 411 && commands[i].indent === editCmd.indent) {
              editHasElse = true;
              break;
            }
            if (commands[i].code === 412 && commands[i].indent === editCmd.indent) break;
          }
        }
        return (
          <CommandParamEditor
            key={editingIndex}
            code={editCmd.code}
            command={editCmd}
            followCommands={follows}
            hasElse={editHasElse}
            onOk={(params, extra) => updateCommandParams(editingIndex, params, extra)}
            onCancel={() => setEditingIndex(null)}
          />
        );
      })()}
    </div>
  );
}
