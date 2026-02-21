import type { EventCommand } from '../../types/rpgMakerMV';
import { CONTINUATION_CODES, BLOCK_END_CODES } from './commandConstants';

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface TextSegment {
  text: string;
  isMatch: boolean;
  localMatchIndex?: number; // isMatch일 때 커맨드 내 몇 번째 매치인지
}

export interface MatchLocation {
  cmdIndex: number;    // 커맨드 인덱스
  matchIndex: number;  // 해당 커맨드 내 매치 순서 (0-based)
}

function buildRegex(query: string, opts: FindOptions): RegExp | null {
  if (!query) return null;
  try {
    const flags = 'g' + (opts.caseSensitive ? '' : 'i');
    const pattern = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wrapped = opts.wholeWord ? `\\b${pattern}\\b` : pattern;
    return new RegExp(wrapped, flags);
  } catch { return null; }
}

function getParamStrings(cmd: EventCommand): string[] {
  const result: string[] = [];
  for (const p of cmd.parameters) {
    if (typeof p === 'string') result.push(p);
    else if (Array.isArray(p)) {
      for (const item of p) {
        if (typeof item === 'string') result.push(item);
      }
    }
  }
  return result;
}

/** 전체 매치 목록을 단어 단위로 반환 (라인이 아닌 출현 횟수 기준) */
export function findAllMatches(
  commands: EventCommand[], displayTexts: string[], query: string, opts: FindOptions,
): MatchLocation[] {
  const re = buildRegex(query, opts);
  if (!re) return [];
  const result: MatchLocation[] = [];
  for (let i = 0; i < commands.length; i++) {
    if (commands[i].code === 0) continue;
    const text = displayTexts[i] ?? '';
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let localMatchIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length > 0) result.push({ cmdIndex: i, matchIndex: localMatchIndex++ });
      else re.lastIndex++;
    }
  }
  return result;
}

/** 커맨드 parameters의 string 값들에서 치환 */
export function replaceInCommand(
  cmd: EventCommand, query: string, replacement: string, opts: FindOptions,
): EventCommand {
  const re = buildRegex(query, opts);
  if (!re) return cmd;
  const replaceStr = (s: string): string => { re.lastIndex = 0; return s.replace(re, replacement); };
  const newParams = cmd.parameters.map(p => {
    if (typeof p === 'string') return replaceStr(p);
    if (Array.isArray(p)) return p.map(item => typeof item === 'string' ? replaceStr(item) : item);
    return p;
  });
  return { ...cmd, parameters: newParams };
}

/** 텍스트를 매치/비매치 세그먼트로 분리 (CommandRow 인라인 하이라이트용) */
export function splitByQuery(text: string, query: string, opts: FindOptions, startMatchIndex = 0): TextSegment[] {
  const re = buildRegex(query, opts);
  if (!re || !text) return [{ text, isMatch: false }];
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  re.lastIndex = 0;
  let matchCount = startMatchIndex;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) segments.push({ text: text.slice(lastIndex, m.index), isMatch: false });
    if (m[0].length > 0) segments.push({ text: m[0], isMatch: true, localMatchIndex: matchCount++ });
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) { re.lastIndex++; }
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isMatch: false });
  return segments;
}

/**
 * 매치 인덱스 중 폴딩으로 숨겨진 것이 있으면 해당 fold를 해제한 새 foldedSet 반환.
 * 매치가 없는 폴딩은 그대로 유지.
 */
export function unfoldForMatches(
  commands: EventCommand[],
  foldedSet: Set<number>,
  foldableIndices: Set<number>,
  matchCmdIndices: number[],
): Set<number> {
  if (matchCmdIndices.length === 0 || foldedSet.size === 0) return foldedSet;
  const matchSet = new Set(matchCmdIndices);
  const toRemove = new Set<number>();

  for (const foldIdx of foldedSet) {
    if (!foldableIndices.has(foldIdx)) continue;
    const cmd = commands[foldIdx];
    if (!cmd) continue;

    const contCode = CONTINUATION_CODES[cmd.code];
    if (contCode !== undefined) {
      for (let i = foldIdx + 1; i < commands.length; i++) {
        if (commands[i].code === contCode) {
          if (matchSet.has(i)) { toRemove.add(foldIdx); break; }
        } else break;
      }
      continue;
    }

    const endCodes = BLOCK_END_CODES[cmd.code];
    if (endCodes) {
      const baseIndent = cmd.indent;
      let depth = 0;
      for (let i = foldIdx + 1; i < commands.length; i++) {
        if (commands[i].code === cmd.code && commands[i].indent === baseIndent) depth++;
        if (matchSet.has(i)) { toRemove.add(foldIdx); break; }
        if (endCodes.includes(commands[i].code) && commands[i].indent === baseIndent) {
          if (depth === 0) break;
          depth--;
        }
      }
    }
  }

  if (toRemove.size === 0) return foldedSet;
  const newSet = new Set(foldedSet);
  for (const f of toRemove) newSet.delete(f);
  return newSet;
}
