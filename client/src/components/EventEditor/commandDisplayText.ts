import type { EventCommand } from '../../types/rpgMakerMV';
import { FORMATTERS } from './commandFormatters';

export interface CommandDisplayContext {
  t: (key: string) => string;
  systemData: any;
  maps: any;
  currentMap: any;
}

export function getCommandDisplay(cmd: EventCommand, ctx: CommandDisplayContext): string {
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
