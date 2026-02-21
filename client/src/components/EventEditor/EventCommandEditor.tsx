import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventCommand, MoveRoute } from '../../types/rpgMakerMV';
import CommandParamEditor from './CommandParamEditor';
import CommandInsertDialog from './CommandInsertDialog';
import MoveRouteDialog from './MoveRouteDialog';
import useEditorStore from '../../store/useEditorStore';
import {
  NO_PARAM_CODES, CONTINUATION_CODES, BLOCK_END_CODES, CHILD_TO_PARENT,
  HAS_PARAM_EDITOR, getDropTargetIndent,
} from './commandConstants';
import type { CommandDisplayContext } from './commandDisplayText';
import { useCommandHistory } from './useCommandHistory';
import { useCommandSelection } from './useCommandSelection';
import { useCommandClipboard } from './useCommandClipboard';
import { useCommandDragDrop } from './useCommandDragDrop';
import { useCommandMove } from './useCommandMove';
import { useCommandFolding } from './useCommandFolding';
import { CommandRow } from './CommandRow';
import { buildInsertedCommands, buildUpdatedCommands, buildIndentedCommands, buildToggleDisabledCommands } from './commandOperations';
import { getCommandDisplay } from './commandDisplayText';
import CommandFindPanel from './CommandFindPanel';
import { type FindOptions, findMatchIndices, replaceInCommand, unfoldForMatches } from './commandSearch';

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

function makeFoldKey(ctx?: EventCommandContext): string | null {
  if (!ctx) return null;
  if (ctx.isCommonEvent && ctx.commonEventId != null) return `ce${ctx.commonEventId}`;
  if (ctx.eventId != null && ctx.pageIndex != null) return `${ctx.eventId}:${ctx.pageIndex}`;
  return null;
}

export default function EventCommandEditor({ commands, onChange, context }: EventCommandEditorProps) {
  const { t } = useTranslation();
  const systemData = useEditorStore(s => s.systemData);
  const maps = useEditorStore(s => s.maps);
  const currentMap = useEditorStore(s => s.currentMap);

  const [showFind, setShowFind] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findOpts, setFindOpts] = useState<FindOptions>({ caseSensitive: false, wholeWord: false, regex: false });
  const [findMatchList, setFindMatchList] = useState<number[]>([]);
  const [findCurrentIdx, setFindCurrentIdx] = useState(0);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<number | null>(null);
  const [pendingInitialParam, setPendingInitialParam] = useState<string | undefined>(undefined);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showMoveRoute, setShowMoveRoute] = useState<{ editing?: number; characterId: number; moveRoute: MoveRoute } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const { changeWithHistory, undo: rawUndo, redo: rawRedo, canUndo, canRedo } = useCommandHistory(commands, onChange);
  const { selectedIndices, setSelectedIndices, lastClickedIndex, setLastClickedIndex, primaryIndex, handleRowClick, groupStart, groupEnd } = useCommandSelection(commands);

  const undo = useCallback(() => { rawUndo(); setSelectedIndices(new Set()); setLastClickedIndex(-1); }, [rawUndo, setSelectedIndices, setLastClickedIndex]);
  const redo = useCallback(() => { rawRedo(); setSelectedIndices(new Set()); setLastClickedIndex(-1); }, [rawRedo, setSelectedIndices, setLastClickedIndex]);

  const { copySelected, pasteAtSelection, deleteSelected, hasClipboard } = useCommandClipboard(
    commands, selectedIndices, primaryIndex, changeWithHistory, setSelectedIndices, setLastClickedIndex,
  );
  const { foldedSet, setFoldedSet, foldableIndices, hiddenIndices, foldedCounts, toggleFold, foldAll, unfoldAll } = useCommandFolding(commands);
  const { dragGroupRange, dropTargetIndex, handleDragHandleMouseDown, isDraggable, listRef } = useCommandDragDrop(
    commands, changeWithHistory, setSelectedIndices, setLastClickedIndex, foldedSet, setFoldedSet,
  );
  const { moveSelected, canMoveUp, canMoveDown } = useCommandMove(
    commands, selectedIndices, changeWithHistory, setSelectedIndices, setLastClickedIndex,
  );

  const indentSelected = useCallback((delta: number) => {
    if (selectedIndices.size === 0) return;
    changeWithHistory(buildIndentedCommands(commands, selectedIndices, delta));
  }, [commands, selectedIndices, changeWithHistory]);

  const toggleDisabled = useCallback(() => {
    if (selectedIndices.size === 0) return;
    changeWithHistory(buildToggleDisabledCommands(commands, selectedIndices));
  }, [commands, selectedIndices, changeWithHistory]);

  // Fold state restore/save
  const foldKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const foldKey = makeFoldKey(context);
    if (!foldKey || foldKey === foldKeyRef.current) return;
    foldKeyRef.current = foldKey;
    const foldState = (currentMap as any)?.eventFoldState;
    setFoldedSet(foldState?.[foldKey] ? new Set(foldState[foldKey] as number[]) : new Set());
  }, [context, currentMap, setFoldedSet]);

  const prevFoldedRef = useRef<string>('');
  useEffect(() => {
    const foldKey = makeFoldKey(context);
    if (!foldKey || !currentMap) return;
    const foldedArr = [...foldedSet].sort((a, b) => a - b);
    const serialized = JSON.stringify(foldedArr);
    if (serialized === prevFoldedRef.current) return;
    prevFoldedRef.current = serialized;
    const prevState = (currentMap as any).eventFoldState || {};
    const newState = { ...prevState };
    if (foldedArr.length > 0) newState[foldKey] = foldedArr; else delete newState[foldKey];
    if (JSON.stringify(newState) !== JSON.stringify(prevState)) {
      useEditorStore.setState({ currentMap: { ...currentMap, eventFoldState: Object.keys(newState).length > 0 ? newState : undefined } as any });
    }
  }, [foldedSet, context, currentMap]);

  const mapEventList = useMemo(() => {
    if (!currentMap?.events) return [];
    return currentMap.events.filter((e: any) => e != null).map((e: any) => ({ id: e.id, name: e.name || '' }));
  }, [currentMap]);

  useEffect(() => { containerRef.current?.focus(); }, []);

  // Keyboard handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAddDialog || pendingCode !== null || editingIndex !== null || showMoveRoute !== null) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'c' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); copySelected(); }
      else if (mod && e.key === 'v' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); pasteAtSelection(); }
      else if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); undo(); }
      else if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); redo(); }
      else if (mod && e.key === 'y') { e.preventDefault(); e.stopPropagation(); redo(); }
      else if (mod && e.key === 'a') { e.preventDefault(); e.stopPropagation(); const all = new Set<number>(); for (let i = 0; i < commands.length - 1; i++) all.add(i); setSelectedIndices(all); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndices.size > 0) { e.preventDefault(); deleteSelected(); }
      else if (e.key === 'Tab' && selectedIndices.size > 0) { e.preventDefault(); e.stopPropagation(); indentSelected(e.shiftKey ? -1 : 1); }
      else if (mod && e.key === '/') { e.preventDefault(); e.stopPropagation(); toggleDisabled(); }
      else if (mod && e.key === 'f') { e.preventDefault(); e.stopPropagation(); setShowFind(true); setShowFindReplace(false); }
      else if (mod && e.key === 'h') { e.preventDefault(); e.stopPropagation(); setShowFind(true); setShowFindReplace(true); }
      else if (e.key === ' ') { e.preventDefault(); primaryIndex >= 0 && primaryIndex < commands.length ? handleDoubleClick(primaryIndex) : setShowAddDialog(true); }
    };
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [copySelected, pasteAtSelection, undo, redo, deleteSelected, indentSelected, toggleDisabled, showAddDialog, pendingCode, editingIndex, showMoveRoute, selectedIndices, commands, setSelectedIndices, primaryIndex, showFind]);

  // Global space key
  useEffect(() => {
    if (showAddDialog || pendingCode !== null || editingIndex !== null || showMoveRoute !== null) return;
    const handleGlobalSpace = (e: KeyboardEvent) => {
      if (e.key !== ' ') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (containerRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      containerRef.current?.focus();
      if (primaryIndex >= 0 && primaryIndex < commands.length) {
        commands[primaryIndex].code === 0 ? setShowAddDialog(true) : handleDoubleClick(primaryIndex);
      } else {
        setShowAddDialog(true);
      }
    };
    document.addEventListener('keydown', handleGlobalSpace);
    return () => document.removeEventListener('keydown', handleGlobalSpace);
  }, [showAddDialog, pendingCode, editingIndex, showMoveRoute, primaryIndex, commands]);

  const insertCommandWithParams = (code: number, params: unknown[], extraCommands?: EventCommand[]) => {
    const insertAt = primaryIndex >= 0 ? primaryIndex : commands.length - 1;
    changeWithHistory(buildInsertedCommands(commands, insertAt, code, params, extraCommands));
    setShowAddDialog(false);
    setPendingCode(null);
  };

  const handleCommandSelect = (code: number, initialParam?: string) => {
    if (code === 205) {
      setShowAddDialog(false);
      setShowMoveRoute({ characterId: -1, moveRoute: { list: [{ code: 0 }], repeat: false, skippable: false, wait: true } });
      return;
    }
    if (initialParam) { setShowAddDialog(false); setPendingCode(code); setPendingInitialParam(initialParam); return; }
    if (NO_PARAM_CODES.has(code)) { insertCommandWithParams(code, []); }
    else if (HAS_PARAM_EDITOR.has(code)) { setShowAddDialog(false); setPendingCode(code); setPendingInitialParam(undefined); }
    else { insertCommandWithParams(code, []); }
  };

  const updateCommandParams = (index: number, params: unknown[], extra?: EventCommand[]) => {
    changeWithHistory(buildUpdatedCommands(commands, index, params, extra));
    setEditingIndex(null);
  };

  const handleDoubleClick = (index: number) => {
    const cmd = commands[index];
    if (cmd.code === 0) { setShowAddDialog(true); return; }
    if (cmd.code === 205) {
      const charId = (cmd.parameters?.[0] as number) ?? -1;
      const route = (cmd.parameters?.[1] as MoveRoute) ?? { list: [{ code: 0 }], repeat: false, skippable: false, wait: true };
      setShowMoveRoute({ editing: index, characterId: charId, moveRoute: route });
      return;
    }
    if (HAS_PARAM_EDITOR.has(cmd.code)) { setEditingIndex(index); return; }
    const parentCodes = CHILD_TO_PARENT[cmd.code];
    if (parentCodes) {
      for (let i = index - 1; i >= 0; i--) {
        if (parentCodes.includes(commands[i].code) && commands[i].indent === cmd.indent) {
          if (HAS_PARAM_EDITOR.has(commands[i].code)) setEditingIndex(i);
          return;
        }
      }
    }
  };

  const commandDisplayCtx: CommandDisplayContext = { t, systemData, maps, currentMap };

  // 검색용 display text (메모이즈)
  const displayTexts = useMemo(
    () => commands.map(cmd => getCommandDisplay(cmd, commandDisplayCtx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commands, t, systemData, maps, currentMap],
  );

  // 찾기 매치 목록 갱신 + 폴딩 내 매치 자동 해제
  useEffect(() => {
    if (!showFind) { setFindMatchList([]); setFindCurrentIdx(0); return; }
    const matches = findMatchIndices(commands, displayTexts, findQuery, findOpts);
    setFindMatchList(matches);
    setFindCurrentIdx(0);
    if (matches.length > 0) {
      setFoldedSet(prev => unfoldForMatches(commands, prev, foldableIndices, matches));
    }
  }, [showFind, findQuery, findOpts, commands, displayTexts, foldableIndices]);

  // 현재 매치로 스크롤
  useEffect(() => {
    if (findMatchList.length === 0) return;
    const cmdIdx = findMatchList[findCurrentIdx];
    if (cmdIdx === undefined) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${cmdIdx}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [findCurrentIdx, findMatchList]);

  const findNext = useCallback(() => {
    if (findMatchList.length === 0) return;
    setFindCurrentIdx(i => (i + 1) % findMatchList.length);
  }, [findMatchList.length]);

  const findPrev = useCallback(() => {
    if (findMatchList.length === 0) return;
    setFindCurrentIdx(i => (i - 1 + findMatchList.length) % findMatchList.length);
  }, [findMatchList.length]);

  const handleFindReplace = useCallback((replacement: string) => {
    if (findMatchList.length === 0) return;
    const cmdIdx = findMatchList[findCurrentIdx];
    changeWithHistory(commands.map((cmd, i) =>
      i === cmdIdx ? replaceInCommand(cmd, findQuery, replacement, findOpts) : cmd,
    ));
  }, [findMatchList, findCurrentIdx, commands, findQuery, findOpts, changeWithHistory]);

  const handleReplaceAll = useCallback((replacement: string) => {
    if (findMatchList.length === 0) return;
    const matchSet = new Set(findMatchList);
    changeWithHistory(commands.map((cmd, i) =>
      matchSet.has(i) ? replaceInCommand(cmd, findQuery, replacement, findOpts) : cmd,
    ));
  }, [findMatchList, commands, findQuery, findOpts, changeWithHistory]);

  const findMatchSet = useMemo(() => new Set(findMatchList), [findMatchList]);
  const currentMatchCmdIdx = findMatchList[findCurrentIdx] ?? -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }} ref={containerRef} tabIndex={-1}>
      <div className="event-commands-list" ref={listRef} onClick={() => containerRef.current?.focus()}>
        {commands.map((cmd, i) => {
          if (hiddenIndices.has(i)) return null;
          const isDragging = dragGroupRange !== null && i >= dragGroupRange[0] && i <= dragGroupRange[1];
          const isSelected = selectedIndices.has(i);
          const hasGroup = groupStart !== groupEnd;
          const inGroup = hasGroup && selectedIndices.size === 1 && i >= groupStart && i <= groupEnd;
          return (
            <React.Fragment key={i}>
              {dropTargetIndex === i && dragGroupRange && !(i >= dragGroupRange[0] && i <= dragGroupRange[1] + 1) && (
                <div className="event-command-drop-indicator" style={{ marginLeft: getDropTargetIndent(commands, i) * 20 }} />
              )}
              <CommandRow cmd={cmd} index={i} isSelected={isSelected} isDragging={isDragging}
                isGroupHL={inGroup && !isSelected} isGroupFirst={inGroup && i === groupStart} isGroupLast={inGroup && i === groupEnd}
                inGroup={inGroup} draggable={isDraggable(i)} displayCtx={commandDisplayCtx}
                onRowClick={handleRowClick} onDoubleClick={handleDoubleClick} onDragHandleMouseDown={handleDragHandleMouseDown}
                context={context} commands={commands}
                isFoldable={foldableIndices.has(i)} isFolded={foldedSet.has(i) && foldableIndices.has(i)}
                foldedCount={foldedCounts.get(i)} onToggleFold={toggleFold}
                isMatch={findMatchSet.has(i)} isCurrentMatch={i === currentMatchCmdIdx} />
            </React.Fragment>
          );
        })}
        {dropTargetIndex === commands.length && dragGroupRange && (
          <div className="event-command-drop-indicator" style={{ marginLeft: getDropTargetIndent(commands, commands.length - 1) * 20 }} />
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
        <span className="event-commands-toolbar-sep" />
        <button className="db-btn-small" onClick={() => indentSelected(-1)} disabled={selectedIndices.size === 0} title="인덴트 감소 (Shift+Tab)">←</button>
        <button className="db-btn-small" onClick={() => indentSelected(1)} disabled={selectedIndices.size === 0} title="인덴트 증가 (Tab)">→</button>
        <span className="event-commands-toolbar-sep" />
        <button className="db-btn-small" onClick={toggleDisabled} disabled={selectedIndices.size === 0}>{t('eventCommands.toggleDisabledShort')} (Ctrl+/)</button>
        {foldableIndices.size > 0 && (
          <>
            <span className="event-commands-toolbar-sep" />
            <button className="db-btn-small" onClick={foldAll} title={t('eventCommands.foldAll')}>{t('eventCommands.foldAll')}</button>
            <button className="db-btn-small" onClick={unfoldAll} title={t('eventCommands.unfoldAll')}>{t('eventCommands.unfoldAll')}</button>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button className="db-btn-small" onClick={undo} disabled={!canUndo} title="Ctrl+Z">{t('common.undo')}</button>
        <button className="db-btn-small" onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">{t('common.redo')}</button>
      </div>

      {showFind && (
        <CommandFindPanel
          matchCount={findMatchList.length}
          currentMatchIndex={findCurrentIdx}
          showReplace={showFindReplace}
          onQueryChange={(q, opts) => { setFindQuery(q); setFindOpts(opts); }}
          onReplace={handleFindReplace}
          onReplaceAll={handleReplaceAll}
          onNext={findNext}
          onPrev={findPrev}
          onToggleReplace={() => setShowFindReplace(r => !r)}
          onClose={() => setShowFind(false)}
        />
      )}

      {showAddDialog && <CommandInsertDialog onSelect={handleCommandSelect} onCancel={() => setShowAddDialog(false)} />}

      {pendingCode !== null && (
        <CommandParamEditor code={pendingCode} initialParam={pendingInitialParam}
          onOk={(params, extra) => insertCommandWithParams(pendingCode, params, extra)}
          onCancel={() => { setPendingCode(null); setPendingInitialParam(undefined); }} />
      )}

      {editingIndex !== null && (() => {
        const editCmd = commands[editingIndex];
        const contCode = CONTINUATION_CODES[editCmd.code];
        const follows: EventCommand[] = [];
        if (contCode !== undefined) {
          for (let i = editingIndex + 1; i < commands.length; i++) {
            if (commands[i].code === contCode) follows.push(commands[i]); else break;
          }
        }
        let editHasElse: boolean | undefined;
        if (editCmd.code === 111) {
          editHasElse = false;
          for (let i = editingIndex + 1; i < commands.length; i++) {
            if (commands[i].code === 411 && commands[i].indent === editCmd.indent) { editHasElse = true; break; }
            if (commands[i].code === 412 && commands[i].indent === editCmd.indent) break;
          }
        }
        return (
          <CommandParamEditor key={editingIndex} code={editCmd.code} command={editCmd} followCommands={follows} hasElse={editHasElse}
            onOk={(params, extra) => updateCommandParams(editingIndex, params, extra)} onCancel={() => setEditingIndex(null)} />
        );
      })()}

      {showMoveRoute && (
        <MoveRouteDialog moveRoute={showMoveRoute.moveRoute} characterId={showMoveRoute.characterId} mapEvents={mapEventList}
          onOk={() => {}} onOkWithCharacter={(charId, route) => {
            showMoveRoute.editing !== undefined ? updateCommandParams(showMoveRoute.editing, [charId, route]) : insertCommandWithParams(205, [charId, route]);
            setShowMoveRoute(null);
          }} onCancel={() => setShowMoveRoute(null)} />
      )}
    </div>
  );
}
