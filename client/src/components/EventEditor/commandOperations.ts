import type { EventCommand } from '../../types/rpgMakerMV';
import { CONTINUATION_CODES, BLOCK_END_CODES } from './commandConstants';

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
