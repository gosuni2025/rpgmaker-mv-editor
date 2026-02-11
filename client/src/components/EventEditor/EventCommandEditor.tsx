import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import CommandParamEditor from './CommandParamEditor';

interface EventCommandEditorProps {
  commands: EventCommand[];
  onChange: (commands: EventCommand[]) => void;
}

const COMMAND_CATEGORIES = {
  'Tab 1 - Messages': [
    { code: 101, name: 'Show Text...' },
    { code: 102, name: 'Show Choices...' },
    { code: 103, name: 'Input Number...' },
    { code: 104, name: 'Select Item...' },
    { code: 105, name: 'Show Scrolling Text...' },
  ],
  'Tab 1 - Flow Control': [
    { code: 111, name: 'Conditional Branch...' },
    { code: 112, name: 'Loop' },
    { code: 113, name: 'Break Loop' },
    { code: 115, name: 'Exit Event Processing' },
    { code: 117, name: 'Common Event...' },
    { code: 118, name: 'Label...' },
    { code: 119, name: 'Jump to Label...' },
    { code: 108, name: 'Comment...' },
  ],
  'Tab 1 - Game Progression': [
    { code: 121, name: 'Control Switches...' },
    { code: 122, name: 'Control Variables...' },
    { code: 123, name: 'Control Self Switch...' },
    { code: 124, name: 'Control Timer...' },
  ],
  'Tab 2 - Party': [
    { code: 125, name: 'Change Gold...' },
    { code: 126, name: 'Change Items...' },
    { code: 127, name: 'Change Weapons...' },
    { code: 128, name: 'Change Armors...' },
    { code: 129, name: 'Change Party Member...' },
  ],
  'Tab 2 - Actor': [
    { code: 311, name: 'Change HP...' },
    { code: 312, name: 'Change MP...' },
    { code: 313, name: 'Change TP...' },
    { code: 314, name: 'Change State...' },
    { code: 315, name: 'Recover All...' },
    { code: 316, name: 'Change EXP...' },
    { code: 317, name: 'Change Level...' },
    { code: 318, name: 'Change Parameter...' },
    { code: 319, name: 'Change Skill...' },
    { code: 320, name: 'Change Equipment...' },
    { code: 321, name: 'Change Name...' },
    { code: 322, name: 'Change Class...' },
  ],
  'Tab 2 - Movement': [
    { code: 201, name: 'Transfer Player...' },
    { code: 202, name: 'Set Vehicle Location...' },
    { code: 203, name: 'Set Event Location...' },
    { code: 204, name: 'Scroll Map...' },
    { code: 205, name: 'Set Movement Route...' },
    { code: 206, name: 'Get On/Off Vehicle' },
  ],
  'Tab 3 - Screen': [
    { code: 221, name: 'Fadeout Screen' },
    { code: 222, name: 'Fadein Screen' },
    { code: 223, name: 'Tint Screen...' },
    { code: 224, name: 'Flash Screen...' },
    { code: 225, name: 'Shake Screen...' },
    { code: 230, name: 'Wait...' },
  ],
  'Tab 3 - Picture/Weather': [
    { code: 231, name: 'Show Picture...' },
    { code: 232, name: 'Move Picture...' },
    { code: 233, name: 'Rotate Picture...' },
    { code: 234, name: 'Tint Picture...' },
    { code: 235, name: 'Erase Picture...' },
    { code: 236, name: 'Set Weather...' },
  ],
  'Tab 3 - Audio/Video': [
    { code: 241, name: 'Play BGM...' },
    { code: 242, name: 'Fadeout BGM...' },
    { code: 243, name: 'Save BGM' },
    { code: 244, name: 'Resume BGM' },
    { code: 245, name: 'Play BGS...' },
    { code: 246, name: 'Fadeout BGS...' },
    { code: 249, name: 'Play ME...' },
    { code: 250, name: 'Play SE...' },
    { code: 251, name: 'Stop SE' },
    { code: 261, name: 'Play Movie...' },
  ],
  'Tab 3 - Scene Control': [
    { code: 301, name: 'Battle Processing...' },
    { code: 302, name: 'Shop Processing...' },
    { code: 303, name: 'Name Input Processing...' },
    { code: 351, name: 'Open Menu Screen' },
    { code: 352, name: 'Open Save Screen' },
    { code: 353, name: 'Game Over' },
    { code: 354, name: 'Return to Title Screen' },
  ],
  'Tab 3 - Advanced': [
    { code: 355, name: 'Script...' },
    { code: 356, name: 'Plugin Command...' },
  ],
};

// Commands that have no parameters and can be inserted directly
const NO_PARAM_CODES = new Set([112, 113, 115, 206, 221, 222, 243, 244, 251, 351, 352, 353, 354]);

// 단순 연속형: 주 명령어 뒤에 바로 따라오는 부속 코드
const CONTINUATION_CODES: Record<number, number> = {
  101: 401,  // Show Text → 텍스트 줄
  105: 405,  // Show Scrolling Text → 텍스트 줄
  108: 408,  // Comment → 주석 줄
  355: 655,  // Script → 스크립트 줄
  302: 605,  // Shop Processing → 상점 아이템 줄
};

// 블록 구조형: 주 명령어 ~ 종료 마커까지 (같은 indent)
const BLOCK_END_CODES: Record<number, number[]> = {
  111: [412],       // Conditional Branch → End (411 Else는 중간)
  112: [413],       // Loop → Repeat Above
  102: [404],       // Show Choices → End
  301: [604],       // Battle Processing → End (601 Win, 602 Escape, 603 Lose)
};

// 부속 코드 → 주 명령어 매핑 (부속 코드 클릭 시 그룹의 주 명령어를 찾기 위함)
const CHILD_TO_PARENT: Record<number, number[]> = {
  401: [101], 405: [105], 408: [108], 655: [355], 605: [302],
  402: [102], 403: [102], 404: [102],
  411: [111], 412: [111],
  413: [112],
  601: [301], 602: [301], 603: [301], 604: [301],
};

/**
 * 주어진 인덱스의 명령어가 속한 그룹의 시작~끝 범위를 반환.
 * [start, end] (inclusive)
 */
function getCommandGroupRange(commands: EventCommand[], index: number): [number, number] {
  if (index < 0 || index >= commands.length) return [index, index];
  const cmd = commands[index];

  // 부속 코드를 선택한 경우: 부모(주 명령어)를 위쪽으로 찾아가서 그 그룹 전체를 반환
  if (CHILD_TO_PARENT[cmd.code]) {
    const parentCodes = CHILD_TO_PARENT[cmd.code];
    // 단순 연속형 부속 코드(401, 405, 408, 655, 605)는 해당 줄만 삭제
    const isContinuation = [401, 405, 408, 655, 605].includes(cmd.code);
    if (isContinuation) {
      return [index, index];
    }
    // 블록 구조형 부속 코드(402, 411, 412, 413 등)는 부모를 찾아 전체 블록 삭제
    for (let i = index - 1; i >= 0; i--) {
      if (parentCodes.includes(commands[i].code) && commands[i].indent === cmd.indent) {
        return getCommandGroupRange(commands, i);
      }
    }
    // 부모를 못 찾으면 해당 줄만
    return [index, index];
  }

  // 단순 연속형 주 명령어: 바로 뒤 부속 코드들까지 포함
  const contCode = CONTINUATION_CODES[cmd.code];
  if (contCode !== undefined) {
    let end = index;
    for (let i = index + 1; i < commands.length; i++) {
      if (commands[i].code === contCode) {
        end = i;
      } else {
        break;
      }
    }
    return [index, end];
  }

  // 블록 구조형 주 명령어: 같은 indent의 종료 마커까지
  const endCodes = BLOCK_END_CODES[cmd.code];
  if (endCodes) {
    const baseIndent = cmd.indent;
    let depth = 0;
    for (let i = index + 1; i < commands.length; i++) {
      const c = commands[i];
      // 같은 종류의 블록이 중첩될 수 있으므로 depth 추적
      if (c.code === cmd.code && c.indent === baseIndent) {
        depth++;
      }
      if (endCodes.includes(c.code) && c.indent === baseIndent) {
        if (depth === 0) {
          return [index, i];
        }
        depth--;
      }
    }
    // 종료 마커를 못 찾으면 주 명령어만
    return [index, index];
  }

  // 일반 명령어: 해당 줄만
  return [index, index];
}

// Commands that need a parameter editor
const HAS_PARAM_EDITOR = new Set([
  101, 102, 105, 108, 117, 118, 119, 121, 122, 123, 124, 125, 126, 127, 128, 129,
  201, 230, 241, 242, 245, 246, 249, 250, 321, 325, 355, 356,
]);

const MAX_UNDO = 100;

// 드래그 중인 그룹이 이동할 수 없는 위치인지 판별 (블록 내부 부속 코드 사이로 끼어드는 것 방지)
function isValidDropTarget(commands: EventCommand[], targetIndex: number, dragStart: number, dragEnd: number): boolean {
  // 마지막 빈 명령어(code 0) 뒤로는 이동 불가
  if (targetIndex >= commands.length) return false;
  // 자기 자신 범위 안으로 이동하는 건 무의미
  if (targetIndex >= dragStart && targetIndex <= dragEnd + 1) return true;
  return true;
}

export default function EventCommandEditor({ commands, onChange }: EventCommandEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // 드래그 상태
  const [dragGroupRange, setDragGroupRange] = useState<[number, number] | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragStartY = useRef<number>(0);
  const listRef = useRef<HTMLDivElement>(null);

  const undoStack = useRef<EventCommand[][]>([]);
  const redoStack = useRef<EventCommand[][]>([]);

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
    setSelectedIndex(-1);
  }, [commands, onChange]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(commands);
    const next = redoStack.current.pop()!;
    onChange(next);
    setSelectedIndex(-1);
  }, [commands, onChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const [groupStart, groupEnd] = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= commands.length) return [-1, -1];
    return getCommandGroupRange(commands, selectedIndex);
  }, [selectedIndex, commands]);

  const insertCommandWithParams = (code: number, params: unknown[], extraCommands?: EventCommand[]) => {
    const insertAt = selectedIndex >= 0 ? selectedIndex : commands.length - 1;
    const indent = commands[insertAt]?.indent || 0;
    const newCmd: EventCommand = { code, indent, parameters: params };

    const newCommands = [...commands];
    if (code === 111) {
      newCommands.splice(insertAt, 0, newCmd, { code: 0, indent: indent + 1, parameters: [] }, { code: 412, indent, parameters: [] });
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

  const updateCommandParams = (index: number, params: unknown[]) => {
    const newCommands = [...commands];
    newCommands[index] = { ...newCommands[index], parameters: params };
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
    }
  };

  // --- 드래그 앤 드롭 로직 ---
  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const range = getCommandGroupRange(commands, index);
    setDragGroupRange(range);
    setSelectedIndex(index);
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
              setSelectedIndex(insertAt);
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

  const deleteCommand = () => {
    if (selectedIndex < 0 || selectedIndex >= commands.length) return;
    const cmd = commands[selectedIndex];
    if (cmd.code === 0 && selectedIndex === commands.length - 1) return;
    const [start, end] = getCommandGroupRange(commands, selectedIndex);
    const newCommands = commands.filter((_, i) => i < start || i > end);
    changeWithHistory(newCommands);
    setSelectedIndex(Math.min(start, newCommands.length - 1));
  };

  const getCommandDisplay = (cmd: EventCommand): string => {
    const code = cmd.code;
    if (code === 0) return '';
    const DESCS: Record<number, string> = {
      101: 'Show Text', 102: 'Show Choices', 103: 'Input Number', 104: 'Select Item',
      105: 'Show Scrolling Text', 108: 'Comment', 111: 'If', 112: 'Loop',
      113: 'Break Loop', 115: 'Exit Event', 117: 'Common Event', 118: 'Label',
      119: 'Jump to Label', 121: 'Control Switches', 122: 'Control Variables',
      123: 'Control Self Switch', 124: 'Control Timer', 125: 'Change Gold',
      126: 'Change Items', 127: 'Change Weapons', 128: 'Change Armors',
      129: 'Change Party Member', 201: 'Transfer Player', 202: 'Set Vehicle Location',
      203: 'Set Event Location', 204: 'Scroll Map', 205: 'Set Movement Route',
      206: 'Get On/Off Vehicle', 211: 'Change Transparency', 212: 'Show Animation',
      213: 'Show Balloon Icon', 214: 'Erase Event', 221: 'Fadeout Screen',
      222: 'Fadein Screen', 223: 'Tint Screen', 224: 'Flash Screen',
      225: 'Shake Screen', 230: 'Wait', 231: 'Show Picture', 232: 'Move Picture',
      233: 'Rotate Picture', 234: 'Tint Picture', 235: 'Erase Picture',
      236: 'Set Weather', 241: 'Play BGM', 242: 'Fadeout BGM', 243: 'Save BGM',
      244: 'Resume BGM', 245: 'Play BGS', 246: 'Fadeout BGS', 249: 'Play ME',
      250: 'Play SE', 251: 'Stop SE', 261: 'Play Movie', 281: 'Change Map Name Display',
      282: 'Change Tileset', 283: 'Change Battle Back', 284: 'Change Parallax',
      285: 'Get Location Info', 301: 'Battle Processing', 302: 'Shop Processing',
      303: 'Name Input Processing', 311: 'Change HP', 312: 'Change MP',
      313: 'Change TP', 314: 'Change State', 315: 'Recover All',
      316: 'Change EXP', 317: 'Change Level', 318: 'Change Parameter',
      319: 'Change Skill', 320: 'Change Equipment', 321: 'Change Name',
      322: 'Change Class', 323: 'Change Actor Images', 324: 'Change Vehicle Image',
      325: 'Change Nickname', 326: 'Change Profile', 331: 'Change Enemy HP',
      332: 'Change Enemy MP', 333: 'Change Enemy TP', 334: 'Change Enemy State',
      335: 'Enemy Recover All', 336: 'Enemy Appear', 337: 'Enemy Transform',
      338: 'Show Battle Animation', 339: 'Force Action', 340: 'Abort Battle',
      351: 'Open Menu Screen', 352: 'Open Save Screen', 353: 'Game Over',
      354: 'Return to Title Screen', 355: 'Script', 356: 'Plugin Command',
      401: ':', 402: 'When', 403: 'When Cancel', 404: 'End', 405: ':',
      408: ':', 411: 'Else', 412: 'End', 413: 'Repeat Above',
      601: 'If Win', 602: 'If Escape', 603: 'If Lose', 604: 'End',
      655: ':',
    };
    let text = DESCS[code] || `@${code}`;
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="db-form-section">Event Commands</div>
      <div className="event-commands-list" ref={listRef}>
        {commands.map((cmd, i) => {
          const display = getCommandDisplay(cmd);
          const draggable = isDraggable(i);
          const isDragging = dragGroupRange !== null && i >= dragGroupRange[0] && i <= dragGroupRange[1];
          return (
            <React.Fragment key={i}>
              {dropTargetIndex === i && dragGroupRange && !(i >= dragGroupRange[0] && i <= dragGroupRange[1] + 1) && (
                <div className="event-command-drop-indicator" />
              )}
              <div
                className={`event-command-row${i === selectedIndex ? ' selected' : ''}${i >= groupStart && i <= groupEnd && i !== selectedIndex ? ' group-highlight' : ''}${isDragging ? ' dragging' : ''}`}
                style={{ paddingLeft: draggable ? cmd.indent * 20 : 8 + cmd.indent * 20 }}
                onClick={() => setSelectedIndex(i)}
                onDoubleClick={() => handleDoubleClick(i)}
              >
                {draggable && (
                  <span
                    className="drag-handle"
                    onMouseDown={e => handleDragHandleMouseDown(e, i)}
                    title="드래그하여 이동"
                  >
                    ⠿
                  </span>
                )}
                {display || <span style={{ color: '#555' }}>&loz;</span>}
              </div>
            </React.Fragment>
          );
        })}
        {dropTargetIndex === commands.length && dragGroupRange && (
          <div className="event-command-drop-indicator" />
        )}
      </div>
      <div className="event-commands-toolbar">
        <button className="db-btn-small" onClick={() => setShowAddDialog(true)}>Add</button>
        <button className="db-btn-small" onClick={deleteCommand} disabled={selectedIndex < 0}>Delete</button>
        <span style={{ flex: 1 }} />
        <button className="db-btn-small" onClick={undo} disabled={undoStack.current.length === 0} title="Ctrl+Z">Undo</button>
        <button className="db-btn-small" onClick={redo} disabled={redoStack.current.length === 0} title="Ctrl+Shift+Z">Redo</button>
      </div>

      {showAddDialog && (
        <div className="modal-overlay" onClick={() => setShowAddDialog(false)}>
          <div className="image-picker-dialog" onClick={e => e.stopPropagation()} style={{ width: 'calc(100vw - 40px)', height: 'calc(100vh - 40px)' }}>
            <div className="image-picker-header">Insert Command</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {Object.entries(COMMAND_CATEGORIES).map(([category, cmds]) => (
                <div key={category}>
                  <div style={{ fontWeight: 'bold', fontSize: 12, color: '#4ea6f5', padding: '8px 8px 4px', borderBottom: '1px solid #444', background: '#333' }}>{category}</div>
                  <div className="insert-command-grid">
                    {cmds.map(c => (
                      <div
                        key={c.code}
                        className="insert-command-item"
                        onClick={() => handleCommandSelect(c.code)}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="image-picker-footer">
              <button className="db-btn" onClick={() => setShowAddDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
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
      {editingIndex !== null && (
        <CommandParamEditor
          code={commands[editingIndex].code}
          command={commands[editingIndex]}
          onOk={(params) => updateCommandParams(editingIndex, params)}
          onCancel={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
