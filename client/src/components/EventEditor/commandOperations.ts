import type { EventCommand } from '../../types/rpgMakerMV';
import { CONTINUATION_CODES, BLOCK_END_CODES, expandSelectionToGroups } from './commandConstants';

/**
 * 주석 처리된 커맨드 식별자 prefix.
 * code:108/408의 parameters[0]이 이 prefix로 시작하면 주석 처리된 커맨드.
 */
export const DISABLED_CMD_PREFIX = '//CMD:';

export function isDisabledComment(cmd: EventCommand): boolean {
  return (cmd.code === 108 || cmd.code === 408) &&
    typeof cmd.parameters[0] === 'string' &&
    (cmd.parameters[0] as string).startsWith(DISABLED_CMD_PREFIX);
}

export function deserializeDisabledCommand(cmd: EventCommand): EventCommand {
  const text = cmd.parameters[0] as string;
  return JSON.parse(text.slice(DISABLED_CMD_PREFIX.length)) as EventCommand;
}

function serializeToDisabledComment(cmd: EventCommand): EventCommand {
  return {
    code: 108,
    indent: cmd.indent,
    parameters: [DISABLED_CMD_PREFIX + JSON.stringify({ code: cmd.code, indent: cmd.indent, parameters: cmd.parameters })],
  };
}

/**
 * 선택된 커맨드들을 주석 처리(code:108 Comment로 변환)하거나 복원(역직렬화).
 * - 선택된 커맨드가 모두 주석 처리 상태 → 복원
 * - 아니면 → 그룹 단위로 확장하여 Comment로 변환 (블록 구조 안전 처리)
 * code:0 (종료 마커)는 항상 제외.
 */
export function buildToggleDisabledCommands(
  commands: EventCommand[], indices: Set<number>,
): EventCommand[] {
  const effective = [...indices].filter(i => commands[i] && commands[i].code !== 0);
  if (effective.length === 0) return commands;

  const allDisabled = effective.every(i => isDisabledComment(commands[i]));

  if (allDisabled) {
    // 복원: 선택된 주석 커맨드를 역직렬화
    return commands.map((cmd, i) => {
      if (!indices.has(i) || cmd.code === 0) return cmd;
      return isDisabledComment(cmd) ? deserializeDisabledCommand(cmd) : cmd;
    });
  }

  // 주석 처리: 블록 구조를 포함해 그룹 단위로 범위 확장 후 변환
  const expandedRanges = expandSelectionToGroups(commands, indices);
  const expandedIndices = new Set<number>();
  for (const [start, end] of expandedRanges) {
    for (let i = start; i <= end; i++) expandedIndices.add(i);
  }

  return commands.map((cmd, i) => {
    if (!expandedIndices.has(i) || cmd.code === 0) return cmd;
    return serializeToDisabledComment(cmd);
  });
}

/**
 * Change indent of selected commands by delta (+1 or -1). Minimum indent is 0.
 */
export function buildIndentedCommands(
  commands: EventCommand[], indices: Set<number>, delta: number,
): EventCommand[] {
  return commands.map((cmd, i) => {
    if (!indices.has(i)) return cmd;
    const newIndent = Math.max(0, cmd.indent + delta);
    return { ...cmd, indent: newIndent };
  });
}

/**
 * Insert a new command with block structure handling (if/loop/choice/battle).
 */
export function buildInsertedCommands(
  commands: EventCommand[], insertAt: number, code: number, params: unknown[], extraCommands?: EventCommand[],
): EventCommand[] {
  const indent = commands[insertAt]?.indent || 0;
  const newCmd: EventCommand = { code, indent, parameters: params };
  const result = [...commands];

  if (code === 111) {
    const wantElse = extraCommands?.some(ec => ec.code === 411);
    if (wantElse) {
      result.splice(insertAt, 0, newCmd,
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 411, indent, parameters: [] },
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 412, indent, parameters: [] });
    } else {
      result.splice(insertAt, 0, newCmd, { code: 0, indent: indent + 1, parameters: [] }, { code: 412, indent, parameters: [] });
    }
  } else if (code === 112) {
    result.splice(insertAt, 0, newCmd, { code: 0, indent: indent + 1, parameters: [] }, { code: 413, indent, parameters: [] });
  } else if (code === 102 && extraCommands && extraCommands.length > 0) {
    const extras = extraCommands.map(ec => ({ ...ec, indent: ec.indent === 0 ? indent : indent + ec.indent }));
    result.splice(insertAt, 0, newCmd, ...extras);
  } else if (code === 102) {
    result.splice(insertAt, 0,
      { code: 102, indent, parameters: [['예', '아니오'], -2, 0, 2, 0] },
      { code: 402, indent, parameters: [0, '예'] },
      { code: 0, indent: indent + 1, parameters: [] },
      { code: 402, indent, parameters: [1, '아니오'] },
      { code: 0, indent: indent + 1, parameters: [] },
      { code: 404, indent, parameters: [] },
    );
  } else if ((code === 301 || extraCommands) && extraCommands && extraCommands.length > 0) {
    const extras = extraCommands.map(ec => ({
      ...ec,
      indent: code === 301 ? (ec.indent === 0 ? indent : indent + ec.indent) : indent,
    }));
    result.splice(insertAt, 0, newCmd, ...extras);
  } else {
    result.splice(insertAt, 0, newCmd);
  }
  return result;
}

/**
 * Update command params with battle(301) / conditional(111) branch handling.
 */
export function buildUpdatedCommands(
  commands: EventCommand[], index: number, params: unknown[], extra?: EventCommand[],
): EventCommand[] {
  const result = [...commands];
  const cmd = result[index];
  result[index] = { ...cmd, parameters: params };

  if (cmd.code === 301 && extra) {
    updateBattleBranches(result, index, cmd.indent, extra);
    return result;
  }

  if (cmd.code === 111 && extra) {
    updateConditionalElse(result, index, cmd.indent, extra);
    return result;
  }

  if (extra) {
    updateContinuationOrBlock(result, index, cmd, extra);
  }
  return result;
}

function updateBattleBranches(cmds: EventCommand[], index: number, baseIndent: number, extra: EventCommand[]) {
  const wantEscape = extra.some(ec => ec.code === 602);
  const wantLose = extra.some(ec => ec.code === 603);
  let blockEndIndex = -1, hasEscape = false, escapeIndex = -1, hasLose = false, loseIndex = -1;

  for (let i = index + 1; i < cmds.length; i++) {
    if (cmds[i].indent !== baseIndent) continue;
    if (cmds[i].code === 602) { hasEscape = true; escapeIndex = i; }
    if (cmds[i].code === 603) { hasLose = true; loseIndex = i; }
    if (cmds[i].code === 604) { blockEndIndex = i; break; }
  }

  if (blockEndIndex < 0) return;

  // Lose branch (handle first since it's further in the array)
  if (wantLose && !hasLose) {
    cmds.splice(blockEndIndex, 0,
      { code: 603, indent: baseIndent, parameters: [] },
      { code: 0, indent: baseIndent + 1, parameters: [] });
    blockEndIndex += 2;
  } else if (!wantLose && hasLose && loseIndex >= 0) {
    let loseEnd = blockEndIndex;
    for (let i = loseIndex + 1; i < cmds.length; i++) {
      if (cmds[i].code === 604 && cmds[i].indent === baseIndent) { loseEnd = i; break; }
    }
    cmds.splice(loseIndex, loseEnd - loseIndex);
    blockEndIndex -= (loseEnd - loseIndex);
    if (escapeIndex > loseIndex) escapeIndex -= (loseEnd - loseIndex);
  }

  // Escape branch
  if (wantEscape && !hasEscape) {
    let insertBefore = blockEndIndex;
    for (let i = index + 1; i < cmds.length; i++) {
      if ((cmds[i].code === 603 || cmds[i].code === 604) && cmds[i].indent === baseIndent) { insertBefore = i; break; }
    }
    cmds.splice(insertBefore, 0,
      { code: 602, indent: baseIndent, parameters: [] },
      { code: 0, indent: baseIndent + 1, parameters: [] });
  } else if (!wantEscape && hasEscape && escapeIndex >= 0) {
    let escapeEnd = escapeIndex + 1;
    for (let i = escapeIndex + 1; i < cmds.length; i++) {
      if ((cmds[i].code === 603 || cmds[i].code === 604) && cmds[i].indent === baseIndent) { escapeEnd = i; break; }
    }
    cmds.splice(escapeIndex, escapeEnd - escapeIndex);
  }
}

function updateConditionalElse(cmds: EventCommand[], index: number, baseIndent: number, extra: EventCommand[]) {
  const wantElse = extra.some(ec => ec.code === 411);
  let hasExistingElse = false, elseIndex = -1, blockEndIndex = -1;
  for (let i = index + 1; i < cmds.length; i++) {
    if (cmds[i].code === 411 && cmds[i].indent === baseIndent) { hasExistingElse = true; elseIndex = i; }
    if (cmds[i].code === 412 && cmds[i].indent === baseIndent) { blockEndIndex = i; break; }
  }
  if (wantElse && !hasExistingElse && blockEndIndex >= 0) {
    cmds.splice(blockEndIndex, 0,
      { code: 411, indent: baseIndent, parameters: [] },
      { code: 0, indent: baseIndent + 1, parameters: [] });
  } else if (!wantElse && hasExistingElse && elseIndex >= 0 && blockEndIndex >= 0) {
    cmds.splice(elseIndex, blockEndIndex - elseIndex);
  }
}

function updateContinuationOrBlock(cmds: EventCommand[], index: number, cmd: EventCommand, extra: EventCommand[]) {
  const contCode = CONTINUATION_CODES[cmd.code];
  if (contCode !== undefined) {
    let removeEnd = index;
    for (let i = index + 1; i < cmds.length; i++) {
      if (cmds[i].code === contCode) removeEnd = i;
      else break;
    }
    const removeCount = removeEnd - index;
    if (removeCount > 0) cmds.splice(index + 1, removeCount);
    cmds.splice(index + 1, 0, ...extra.map(e => ({ ...e, indent: cmd.indent })));
  } else {
    const endCodes = BLOCK_END_CODES[cmd.code];
    if (endCodes) {
      let blockEnd = index;
      for (let i = index + 1; i < cmds.length; i++) {
        if (endCodes.includes(cmds[i].code) && cmds[i].indent === cmd.indent) { blockEnd = i; break; }
      }
      const removeCount = blockEnd - index;
      if (removeCount > 0) cmds.splice(index + 1, removeCount);
      cmds.splice(index + 1, 0, ...extra.map(e => ({ ...e, indent: e.indent + cmd.indent })));
    }
  }
}
