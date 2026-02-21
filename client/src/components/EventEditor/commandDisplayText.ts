import type { EventCommand } from '../../types/rpgMakerMV';
import { FORMATTERS } from './commandFormatters';
import { isDisabledComment, deserializeDisabledCommand } from './commandOperations';
import { CONTINUATION_CODES, BLOCK_END_CODES } from './commandConstants';

export interface CommandDisplayContext {
  t: (key: string) => string;
  systemData: any;
  maps: any;
  currentMap: any;
}

function clip(s: string, max = 24): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * 접혔을 때 헤더 행에 표시할 내용 미리보기 문자열.
 * 연속형: "첫줄 … 끝줄" / 블록형: 내부 첫 번째 실질 커맨드 텍스트
 */
export function getFoldPreview(
  cmd: EventCommand, index: number, commands: EventCommand[], ctx: CommandDisplayContext,
): string {
  const contCode = CONTINUATION_CODES[cmd.code];
  if (contCode !== undefined) {
    const lines: string[] = [];
    for (let i = index + 1; i < commands.length; i++) {
      if (commands[i].code !== contCode) break;
      const p = commands[i].parameters[0];
      if (typeof p === 'string' && p) lines.push(p);
    }
    if (lines.length === 0) return '';
    if (lines.length === 1) return `"${clip(lines[0])}"`;
    return `"${clip(lines[0])}" … "${clip(lines[lines.length - 1])}"`;
  }

  const endCodes = BLOCK_END_CODES[cmd.code];
  if (endCodes) {
    const SKIP = new Set([411, 412, 413, 404, 601, 602, 603, 604]);
    for (let i = index + 1; i < commands.length; i++) {
      const c = commands[i];
      if (c.code === 0 || SKIP.has(c.code)) continue;
      if (endCodes.includes(c.code) && c.indent === cmd.indent) break;
      const text = getCommandDisplay(c, ctx);
      if (text) return clip(text, 36);
    }
  }
  return '';
}

export function getCommandDisplay(cmd: EventCommand, ctx: CommandDisplayContext): string {
  // 주석 처리된 커맨드: 원본 커맨드를 역직렬화해서 표시
  if (isDisabledComment(cmd)) {
    return getCommandDisplay(deserializeDisabledCommand(cmd), ctx);
  }

  const code = cmd.code;
  if (code === 0) return '';

  const displayKey = `eventCommands.display.${code}`;
  const desc = ctx.t(displayKey);
  let text = desc !== displayKey ? desc : `@${code}`;

  if (code === 411) return ctx.t('eventCommands.display.411');
  if (code === 412) return ctx.t('eventCommands.display.412');

  // 등록된 포매터 사용
  const entry = FORMATTERS.get(code);
  if (entry && cmd.parameters && cmd.parameters.length >= entry.minParams) {
    return entry.fn(cmd, text, ctx);
  }

  // 기본 포맷: 파라미터 표시
  if (cmd.parameters && cmd.parameters.length > 0) {
    const params = cmd.parameters.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(', ');
    text += params.length > 60 ? `: ${params.substring(0, 60)}...` : `: ${params}`;
  }
  return text;
}
