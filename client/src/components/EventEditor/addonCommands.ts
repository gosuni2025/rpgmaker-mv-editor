/**
 * 애드온 플러그인 커맨드 정의
 * 에디터 전용 플러그인(FogOfWar, ShadowAndLight, PostProcess, Mode3D, PPEffect)의
 * 플러그인 커맨드 메타데이터를 정의하여 전용 파라미터 에디터 UI를 제공한다.
 * 내부적으로는 표준 플러그인 커맨드(코드 356)로 저장되어 RPG Maker MV 호환성 유지.
 */

export interface AddonParam {
  name: string;
  type: 'number' | 'float' | 'boolean' | 'color' | 'pointlight' | 'mapobject' | 'shadertype' | 'shaderparam';
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
  defaultColor?: string;
  /** shader_remove에서 "all" 옵션을 포함할지 여부 */
  allowAll?: boolean;
  /** threshold 파라미터를 가진 트랜지션용 셰이더만 표시 */
  transitionOnly?: boolean;
}

export interface AddonSubCommand {
  id: string;
  label: string;
  params: AddonParam[];
  /** 이 서브커맨드가 보간(duration) 적용을 지원하는지 여부 */
  supportsDuration?: boolean;
}

export interface AddonCommandDef {
  pluginCommand: string;
  label: string;
  subCommands: AddonSubCommand[];
}

import { ADDON_COMMANDS } from './addonCommandData';
export { ADDON_COMMANDS };

/** 플러그인 커맨드 텍스트에서 매칭되는 AddonCommandDef를 찾는다 */
export function matchAddonCommand(text: string): { def: AddonCommandDef; subCmd: AddonSubCommand; paramValues: string[]; duration?: string } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length === 0) return null;

  const cmdName = parts[0];

  // PPEffect는 3단계: PPEffect <effectKey> <action> [value] [duration]
  if (cmdName === 'PPEffect' && parts.length >= 2) {
    const effectKey = parts[1];
    const action = parts[2] || 'on';
    const subId = `${effectKey} ${action}`;
    const def = ADDON_COMMANDS.find(d => d.pluginCommand === 'PPEffect' && d.subCommands.some(s => s.id.startsWith(effectKey + ' ')));
    if (!def) return null;
    const subCmd = def.subCommands.find(s => s.id === subId);
    if (!subCmd) {
      return { def, subCmd: def.subCommands[0], paramValues: parts.slice(2) };
    }
    // params 뒤의 추가 값이 duration일 수 있음
    const rawParams = parts.slice(3);
    const paramCount = subCmd.params.length;
    const paramValues = rawParams.slice(0, paramCount);
    const duration = subCmd.supportsDuration && rawParams.length > paramCount ? rawParams[paramCount] : undefined;
    return { def, subCmd, paramValues, duration };
  }

  // 일반 커맨드: <command> <subCommand> [params...] [duration]
  const def = ADDON_COMMANDS.find(d => d.pluginCommand === cmdName);
  if (!def) return null;

  const subId = parts[1] || '';

  // pointLight 특수 처리: "ShadowLight pointLight <id> <prop> <value> [dur]"
  // → 서브커맨드 id: "pointLight_<prop>", params: [id, value]
  if (subId === 'pointLight' && parts.length >= 4) {
    const lightId = parts[2];
    const prop = parts[3];
    const composedId = `pointLight_${prop}`;
    const subCmd = def.subCommands.find(s => s.id === composedId);
    if (subCmd) {
      const rawParams = parts.slice(4);
      // paramValues: [lightId, value...] — lightId가 첫 번째 파라미터
      const valueParams = rawParams.slice(0, subCmd.params.length - 1);
      const paramValues = [lightId, ...valueParams];
      const totalConsumed = valueParams.length;
      const duration = subCmd.supportsDuration && rawParams.length > totalConsumed ? rawParams[totalConsumed] : undefined;
      return { def, subCmd, paramValues, duration };
    }
  }

  const subCmd = def.subCommands.find(s => s.id === subId);
  if (!subCmd) {
    return { def, subCmd: def.subCommands[0], paramValues: parts.slice(1) };
  }

  const rawParams = parts.slice(2);
  const paramCount = subCmd.params.length;
  const paramValues = rawParams.slice(0, paramCount);
  const duration = subCmd.supportsDuration && rawParams.length > paramCount ? rawParams[paramCount] : undefined;
  return { def, subCmd, paramValues, duration };
}

/** AddonCommandDef + 서브커맨드 + 파라미터 값으로 플러그인 커맨드 텍스트를 조합한다 */
export function buildAddonCommandText(pluginCommand: string, subCommandId: string, paramValues: string[], duration?: string): string {
  // pointLight_<property> 서브커맨드 특수 처리:
  // "ShadowLight pointLight_intensity [lightId, value]" → "ShadowLight pointLight <lightId> intensity <value> [dur]"
  const plMatch = subCommandId.match(/^pointLight_(\w+)$/);
  if (plMatch && paramValues.length >= 2) {
    const prop = plMatch[1];
    const lightId = paramValues[0];
    const restValues = paramValues.slice(1);
    const parts = [pluginCommand, 'pointLight', lightId, prop, ...restValues];
    if (duration && parseFloat(duration) > 0) parts.push(duration);
    return parts.filter(p => p !== '').join(' ');
  }

  const parts = [pluginCommand, subCommandId, ...paramValues];
  // duration이 있고 0이 아닌 경우에만 추가
  if (duration && parseFloat(duration) > 0) {
    parts.push(duration);
  }
  return parts.filter(p => p !== '').join(' ');
}
