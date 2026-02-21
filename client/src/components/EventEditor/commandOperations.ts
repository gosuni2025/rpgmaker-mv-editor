import type { EventCommand } from '../../types/rpgMakerMV';
import { CONTINUATION_CODES, BLOCK_END_CODES, expandSelectionToGroups } from './commandConstants';

/**
 * 주석 처리된 커맨드 식별자 prefix.
 * code:108/408의 parameters[0]이 이 prefix로 시작하면 주석 처리된 커맨드.
 */
export const DISABLED_CMD_PREFIX = '//CMD:';

interface DisabledCmdPayload {
  blockId: string;
  code: number;
  indent: number;
  parameters: unknown[];
}

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function isDisabledComment(cmd: EventCommand): boolean {
  return (cmd.code === 108 || cmd.code === 408) &&
    typeof cmd.parameters[0] === 'string' &&
    (cmd.parameters[0] as string).startsWith(DISABLED_CMD_PREFIX);
}

/** payload 파싱. blockId가 없는 레거시 형식도 처리. */
function parseDisabledPayload(cmd: EventCommand): DisabledCmdPayload | null {
  if (!isDisabledComment(cmd)) return null;
  try {
    const raw = JSON.parse((cmd.parameters[0] as string).slice(DISABLED_CMD_PREFIX.length));
    if (raw.blockId) return raw as DisabledCmdPayload;
    // 레거시: blockId 없음 → 임시 ID 부여
    return { blockId: '', code: raw.code, indent: raw.indent, parameters: raw.parameters };
  } catch { return null; }
}

export function getDisabledBlockId(cmd: EventCommand): string | null {
  const p = parseDisabledPayload(cmd);
  return p?.blockId || null;
}

export function deserializeDisabledCommand(cmd: EventCommand): EventCommand {
  const p = parseDisabledPayload(cmd);
  if (!p) return cmd;
  return { code: p.code, indent: p.indent, parameters: p.parameters };
}

/** 같은 blockId를 가진 모든 인덱스 반환 */
export function findDisabledBlock(commands: EventCommand[], blockId: string): Set<number> {
  const result = new Set<number>();
  if (!blockId) return result;
  for (let i = 0; i < commands.length; i++) {
    if (getDisabledBlockId(commands[i]) === blockId) result.add(i);
  }
  return result;
}

function serializeToDisabledComment(cmd: EventCommand, blockId: string): EventCommand {
  const payload: DisabledCmdPayload = { blockId, code: cmd.code, indent: cmd.indent, parameters: cmd.parameters };
  return {
    code: 108,
    indent: cmd.indent,
    parameters: [DISABLED_CMD_PREFIX + JSON.stringify(payload)],
  };
}

/**
 * 선택된 커맨드들을 주석 처리(code:108 Comment로 변환)하거나 복원(역직렬화).
 * - 선택된 커맨드가 모두 주석 처리 상태 → blockId 기반으로 블록 전체 복원
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
    // 선택된 커맨드들의 blockId 수집
    const blockIds = new Set<string>();
    const soloIndices = new Set<number>(); // blockId 없는 레거시 커맨드
    for (const i of effective) {
      const bid = getDisabledBlockId(commands[i]);
      if (bid) blockIds.add(bid);
      else soloIndices.add(i);
    }
    // 동일 blockId를 가진 커맨드 전체로 복원 대상 확장
    const toRestore = new Set<number>(soloIndices);
    for (let i = 0; i < commands.length; i++) {
      const bid = getDisabledBlockId(commands[i]);
      if (bid && blockIds.has(bid)) toRestore.add(i);
    }
    return commands.map((cmd, i) => {
      if (!toRestore.has(i)) return cmd;
      return isDisabledComment(cmd) ? deserializeDisabledCommand(cmd) : cmd;
    });
  }

  // 주석 처리: 블록 구조를 포함해 그룹 단위로 범위 확장, 각 연속 범위에 독립 blockId 부여
  const expandedRanges = expandSelectionToGroups(commands, indices);
  const expandedMap = new Map<number, string>(); // index → blockId
  for (const [start, end] of expandedRanges) {
    const bid = generateBlockId();
    for (let i = start; i <= end; i++) expandedMap.set(i, bid);
  }

  return commands.map((cmd, i) => {
    const bid = expandedMap.get(i);
    if (!bid || cmd.code === 0) return cmd;
    return serializeToDisabledComment(cmd, bid);
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
