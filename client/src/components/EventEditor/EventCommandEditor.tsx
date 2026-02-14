import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventCommand, MoveRoute } from '../../types/rpgMakerMV';
import CommandParamEditor from './CommandParamEditor';
import CommandInsertDialog from './CommandInsertDialog';
import MoveRouteDialog from './MoveRouteDialog';
import useEditorStore from '../../store/useEditorStore';
import {
  NO_PARAM_CODES, CONTINUATION_CODES, BLOCK_END_CODES, CHILD_TO_PARENT,
  HAS_PARAM_EDITOR,
} from './commandConstants';
import type { CommandDisplayContext } from './commandDisplayText';
import { useCommandHistory } from './useCommandHistory';
import { useCommandSelection } from './useCommandSelection';
import { useCommandClipboard } from './useCommandClipboard';
import { useCommandDragDrop } from './useCommandDragDrop';
import { useCommandMove } from './useCommandMove';
import { CommandRow } from './CommandRow';

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

export default function EventCommandEditor({ commands, onChange, context }: EventCommandEditorProps) {
  const { t } = useTranslation();
  const systemData = useEditorStore(s => s.systemData);
  const maps = useEditorStore(s => s.maps);
  const currentMap = useEditorStore(s => s.currentMap);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showMoveRoute, setShowMoveRoute] = useState<{ editing?: number; characterId: number; moveRoute: MoveRoute } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const { changeWithHistory, undo: rawUndo, redo: rawRedo, canUndo, canRedo } = useCommandHistory(commands, onChange);
  const { selectedIndices, setSelectedIndices, lastClickedIndex, setLastClickedIndex, primaryIndex, handleRowClick, groupStart, groupEnd } = useCommandSelection(commands);

  const undo = useCallback(() => {
    rawUndo();
    setSelectedIndices(new Set());
    setLastClickedIndex(-1);
  }, [rawUndo, setSelectedIndices, setLastClickedIndex]);

  const redo = useCallback(() => {
    rawRedo();
    setSelectedIndices(new Set());
    setLastClickedIndex(-1);
  }, [rawRedo, setSelectedIndices, setLastClickedIndex]);

  const { copySelected, pasteAtSelection, deleteSelected, hasClipboard } = useCommandClipboard(
    commands, selectedIndices, primaryIndex, changeWithHistory, setSelectedIndices, setLastClickedIndex,
  );
  const { dragGroupRange, dropTargetIndex, handleDragHandleMouseDown, isDraggable, listRef } = useCommandDragDrop(
    commands, changeWithHistory, setSelectedIndices, setLastClickedIndex,
  );
  const { moveSelected, canMoveUp, canMoveDown } = useCommandMove(
    commands, selectedIndices, changeWithHistory, setSelectedIndices, setLastClickedIndex,
  );

  const mapEventList = useMemo(() => {
    if (!currentMap?.events) return [];
    return currentMap.events
      .filter((e: any) => e != null)
      .map((e: any) => ({ id: e.id, name: e.name || '' }));
  }, [currentMap]);

  // 마운트 시 자동 포커스
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // 키보드 핸들러
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAddDialog || pendingCode !== null || editingIndex !== null || showMoveRoute !== null) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        copySelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        pasteAtSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault(); e.stopPropagation();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault(); e.stopPropagation();
        const all = new Set<number>();
        for (let i = 0; i < commands.length - 1; i++) all.add(i);
        setSelectedIndices(all);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIndices.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        if (primaryIndex >= 0 && primaryIndex < commands.length) {
          handleDoubleClick(primaryIndex);
        } else {
          setShowAddDialog(true);
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [copySelected, pasteAtSelection, undo, redo, deleteSelected, showAddDialog, pendingCode, editingIndex, showMoveRoute, selectedIndices, commands, setSelectedIndices, primaryIndex]);

  // 컨테이너에 포커스가 없어도 스페이스 키로 명령어 추가/편집 가능하게
  useEffect(() => {
    if (showAddDialog || pendingCode !== null || editingIndex !== null || showMoveRoute !== null) return;

    const handleGlobalSpace = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (containerRef.current?.contains(e.target as Node)) return; // 이미 container에서 처리됨
      e.preventDefault();
      containerRef.current?.focus();
      if (primaryIndex >= 0 && primaryIndex < commands.length) {
        const cmd = commands[primaryIndex];
        if (cmd.code === 0) {
          setShowAddDialog(true);
        } else {
          // 포커스를 컨테이너로 옮기고, 더블클릭 동작은 container keydown에서 처리
          handleDoubleClick(primaryIndex);
        }
      } else {
        setShowAddDialog(true);
      }
    };

    document.addEventListener('keydown', handleGlobalSpace);
    return () => document.removeEventListener('keydown', handleGlobalSpace);
  }, [showAddDialog, pendingCode, editingIndex, showMoveRoute, primaryIndex, commands]);

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
      newCommands.splice(insertAt, 0,
        { code: 102, indent, parameters: [['예', '아니오'], -2, 0, 2, 0] },
        { code: 402, indent, parameters: [0, '예'] },
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 402, indent, parameters: [1, '아니오'] },
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 404, indent, parameters: [] },
      );
    } else if (code === 301 && extraCommands && extraCommands.length > 0) {
      const extras = extraCommands.map(ec => ({
        ...ec,
        indent: ec.indent === 0 ? indent : indent + ec.indent,
      }));
      newCommands.splice(insertAt, 0, newCmd, ...extras);
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
    if (code === 205) {
      setShowAddDialog(false);
      const defaultRoute: MoveRoute = { list: [{ code: 0 }], repeat: false, skippable: false, wait: true };
      setShowMoveRoute({ characterId: -1, moveRoute: defaultRoute });
      return;
    }
    if (NO_PARAM_CODES.has(code)) {
      insertCommandWithParams(code, []);
    } else if (HAS_PARAM_EDITOR.has(code)) {
      setShowAddDialog(false);
      setPendingCode(code);
    } else {
      insertCommandWithParams(code, []);
    }
  };

  const updateCommandParams = (index: number, params: unknown[], extra?: EventCommand[]) => {
    const newCommands = [...commands];
    const cmd = newCommands[index];
    newCommands[index] = { ...cmd, parameters: params };

    // 전투 처리 (301) - 도망/패배 분기 추가/제거
    if (cmd.code === 301 && extra) {
      const wantEscape = extra.some(ec => ec.code === 602);
      const wantLose = extra.some(ec => ec.code === 603);
      const baseIndent = cmd.indent;
      let blockEndIndex = -1;
      let hasEscape = false, escapeIndex = -1;
      let hasLose = false, loseIndex = -1;

      for (let i = index + 1; i < newCommands.length; i++) {
        if (newCommands[i].indent !== baseIndent) continue;
        if (newCommands[i].code === 602) { hasEscape = true; escapeIndex = i; }
        if (newCommands[i].code === 603) { hasLose = true; loseIndex = i; }
        if (newCommands[i].code === 604) { blockEndIndex = i; break; }
      }

      if (blockEndIndex >= 0) {
        // 패배 분기 추가/제거 (먼저 처리 - 인덱스가 뒤쪽이므로)
        if (wantLose && !hasLose) {
          newCommands.splice(blockEndIndex, 0,
            { code: 603, indent: baseIndent, parameters: [] },
            { code: 0, indent: baseIndent + 1, parameters: [] },
          );
          blockEndIndex += 2;
        } else if (!wantLose && hasLose && loseIndex >= 0) {
          // 패배 분기와 그 내부 커맨드 삭제 (603 ~ 604 직전까지)
          let loseEnd = blockEndIndex;
          // 패배 분기 뒤에 604가 바로 오는지, 아니면 그 사이에 커맨드가 있는지
          for (let i = loseIndex + 1; i < newCommands.length; i++) {
            if (newCommands[i].code === 604 && newCommands[i].indent === baseIndent) {
              loseEnd = i;
              break;
            }
          }
          newCommands.splice(loseIndex, loseEnd - loseIndex);
          blockEndIndex -= (loseEnd - loseIndex);
          // escapeIndex 조정
          if (escapeIndex > loseIndex) escapeIndex -= (loseEnd - loseIndex);
        }

        // 도망 분기 추가/제거
        // 도망 분기는 604 직전에 삽입 (패배 분기가 있으면 그 앞에)
        if (wantEscape && !hasEscape) {
          // 603 앞 또는 604 앞에 삽입
          let insertBefore = blockEndIndex;
          for (let i = index + 1; i < newCommands.length; i++) {
            if ((newCommands[i].code === 603 || newCommands[i].code === 604) && newCommands[i].indent === baseIndent) {
              insertBefore = i;
              break;
            }
          }
          newCommands.splice(insertBefore, 0,
            { code: 602, indent: baseIndent, parameters: [] },
            { code: 0, indent: baseIndent + 1, parameters: [] },
          );
        } else if (!wantEscape && hasEscape && escapeIndex >= 0) {
          // 도망 분기와 그 내부 커맨드 삭제
          let escapeEnd = escapeIndex + 1;
          for (let i = escapeIndex + 1; i < newCommands.length; i++) {
            if ((newCommands[i].code === 603 || newCommands[i].code === 604) && newCommands[i].indent === baseIndent) {
              escapeEnd = i;
              break;
            }
          }
          newCommands.splice(escapeIndex, escapeEnd - escapeIndex);
        }
      }

      changeWithHistory(newCommands);
      setEditingIndex(null);
      return;
    }

    if (cmd.code === 111 && extra) {
      const wantElse = extra.some(ec => ec.code === 411);
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
        newCommands.splice(blockEndIndex, 0,
          { code: 411, indent: baseIndent, parameters: [] },
          { code: 0, indent: baseIndent + 1, parameters: [] },
        );
      } else if (!wantElse && hasExistingElse && elseIndex >= 0 && blockEndIndex >= 0) {
        newCommands.splice(elseIndex, blockEndIndex - elseIndex);
      }
      changeWithHistory(newCommands);
      setEditingIndex(null);
      return;
    }

    if (extra) {
      const contCode = CONTINUATION_CODES[cmd.code];
      if (contCode !== undefined) {
        let removeEnd = index;
        for (let i = index + 1; i < newCommands.length; i++) {
          if (newCommands[i].code === contCode) removeEnd = i;
          else break;
        }
        const removeCount = removeEnd - index;
        if (removeCount > 0) {
          newCommands.splice(index + 1, removeCount);
        }
        const insertExtra = extra.map(e => ({ ...e, indent: cmd.indent }));
        newCommands.splice(index + 1, 0, ...insertExtra);
      } else {
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
    if (cmd.code === 205) {
      const charId = (cmd.parameters?.[0] as number) ?? -1;
      const route = (cmd.parameters?.[1] as MoveRoute) ?? { list: [{ code: 0 }], repeat: false, skippable: false, wait: true };
      setShowMoveRoute({ editing: index, characterId: charId, moveRoute: route });
      return;
    }
    if (HAS_PARAM_EDITOR.has(cmd.code)) {
      setEditingIndex(index);
      return;
    }
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

  const commandDisplayCtx: CommandDisplayContext = { t, systemData, maps, currentMap };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }} ref={containerRef} tabIndex={-1}>
      <div className="event-commands-list" ref={listRef} onClick={() => containerRef.current?.focus()}>
        {commands.map((cmd, i) => {
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
              <CommandRow
                cmd={cmd}
                index={i}
                isSelected={isSelected}
                isDragging={isDragging}
                isGroupHL={isGroupHL}
                isGroupFirst={isGroupFirst}
                isGroupLast={isGroupLast}
                inGroup={inGroup}
                draggable={draggable}
                displayCtx={commandDisplayCtx}
                onRowClick={handleRowClick}
                onDoubleClick={handleDoubleClick}
                onDragHandleMouseDown={handleDragHandleMouseDown}
                context={context}
                commands={commands}
              />
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
        <button className="db-btn-small" onClick={undo} disabled={!canUndo} title="Ctrl+Z">{t('common.undo')}</button>
        <button className="db-btn-small" onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">{t('common.redo')}</button>
      </div>

      {showAddDialog && (
        <CommandInsertDialog
          onSelect={handleCommandSelect}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {pendingCode !== null && (
        <CommandParamEditor
          code={pendingCode}
          onOk={(params, extra) => insertCommandWithParams(pendingCode, params, extra)}
          onCancel={() => setPendingCode(null)}
        />
      )}

      {editingIndex !== null && (() => {
        const editCmd = commands[editingIndex];
        const contCode = CONTINUATION_CODES[editCmd.code];
        const follows: EventCommand[] = [];
        if (contCode !== undefined) {
          for (let i = editingIndex + 1; i < commands.length; i++) {
            if (commands[i].code === contCode) follows.push(commands[i]);
            else break;
          }
        }
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

      {showMoveRoute && (
        <MoveRouteDialog
          moveRoute={showMoveRoute.moveRoute}
          characterId={showMoveRoute.characterId}
          mapEvents={mapEventList}
          onOk={() => {}}
          onOkWithCharacter={(charId, route) => {
            if (showMoveRoute.editing !== undefined) {
              updateCommandParams(showMoveRoute.editing, [charId, route]);
            } else {
              insertCommandWithParams(205, [charId, route]);
            }
            setShowMoveRoute(null);
          }}
          onCancel={() => setShowMoveRoute(null)}
        />
      )}
    </div>
  );
}
