import type { EventCommand } from '../../types/rpgMakerMV';
import { CONTINUATION_CODES, BLOCK_END_CODES } from './commandConstants';

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
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

/** displayTexts[i] 또는 parameters의 string에서 검색 */
export function findMatchIndices(
  commands: EventCommand[], displayTexts: string[], query: string, opts: FindOptions,
): number[] {
  const re = buildRegex(query, opts);
  if (!re) return [];
  const result: number[] = [];
  for (let i = 0; i < commands.length; i++) {
    if (commands[i].code === 0) continue;
    re.lastIndex = 0;
    if (re.test(displayTexts[i] ?? '')) { result.push(i); continue; }
    const strs = getParamStrings(commands[i]);
    if (strs.some(s => { re.lastIndex = 0; return re.test(s); })) result.push(i);
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

export interface TextSegment {
  text: string;
  isMatch: boolean;
}

/** 텍스트를 매치/비매치 세그먼트로 분리 (CommandRow 인라인 하이라이트용) */
export function splitByQuery(text: string, query: string, opts: FindOptions): TextSegment[] {
  const re = buildRegex(query, opts);
  if (!re || !text) return [{ text, isMatch: false }];
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) segments.push({ text: text.slice(lastIndex, m.index), isMatch: false });
    if (m[0].length > 0) segments.push({ text: m[0], isMatch: true });
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) { re.lastIndex++; } // 빈 매치 무한루프 방지
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
  matchIndices: number[],
): Set<number> {
  if (matchIndices.length === 0 || foldedSet.size === 0) return foldedSet;
  const matchSet = new Set(matchIndices);
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
