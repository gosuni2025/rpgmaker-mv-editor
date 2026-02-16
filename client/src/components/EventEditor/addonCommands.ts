/**
 * 애드온 플러그인 커맨드 정의
 * 에디터 전용 플러그인(FogOfWar, ShadowAndLight, PostProcess, Mode3D)의
 * 플러그인 커맨드 메타데이터를 정의하여 전용 파라미터 에디터 UI를 제공한다.
 * 내부적으로는 표준 플러그인 커맨드(코드 356)로 저장되어 RPG Maker MV 호환성 유지.
 */

export interface AddonParam {
  name: string;
  type: 'number' | 'float' | 'boolean';
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export interface AddonSubCommand {
  id: string;
  label: string;
  params: AddonParam[];
}

export interface AddonCommandDef {
  pluginCommand: string;
  label: string;
  subCommands: AddonSubCommand[];
}

export const ADDON_COMMANDS: AddonCommandDef[] = [
  {
    pluginCommand: 'FogOfWar',
    label: 'addonCommands.fogOfWar',
    subCommands: [
      { id: 'Enable', label: 'addonCommands.fogOfWar_Enable', params: [] },
      { id: 'Disable', label: 'addonCommands.fogOfWar_Disable', params: [] },
      {
        id: 'Radius',
        label: 'addonCommands.fogOfWar_Radius',
        params: [
          { name: 'radius', type: 'number', label: 'addonCommands.param_radius', min: 1, max: 30, default: 5 },
        ],
      },
      { id: 'RevealAll', label: 'addonCommands.fogOfWar_RevealAll', params: [] },
      { id: 'HideAll', label: 'addonCommands.fogOfWar_HideAll', params: [] },
      {
        id: 'RevealRect',
        label: 'addonCommands.fogOfWar_RevealRect',
        params: [
          { name: 'x', type: 'number', label: 'X', min: 0, default: 0 },
          { name: 'y', type: 'number', label: 'Y', min: 0, default: 0 },
          { name: 'w', type: 'number', label: 'addonCommands.param_width', min: 1, default: 1 },
          { name: 'h', type: 'number', label: 'addonCommands.param_height', min: 1, default: 1 },
        ],
      },
    ],
  },
  {
    pluginCommand: 'ShadowLight',
    label: 'addonCommands.shadowLight',
    subCommands: [
      { id: 'on', label: 'addonCommands.shadowLight_on', params: [] },
      { id: 'off', label: 'addonCommands.shadowLight_off', params: [] },
      {
        id: 'ambient',
        label: 'addonCommands.shadowLight_ambient',
        params: [
          { name: 'intensity', type: 'float', label: 'addonCommands.param_intensity', min: 0, max: 2, step: 0.1, default: 0.5 },
        ],
      },
      {
        id: 'direction',
        label: 'addonCommands.shadowLight_direction',
        params: [
          { name: 'x', type: 'float', label: 'X', min: -1, max: 1, step: 0.1, default: -1 },
          { name: 'y', type: 'float', label: 'Y', min: -1, max: 1, step: 0.1, default: -1 },
          { name: 'z', type: 'float', label: 'Z', min: -1, max: 1, step: 0.1, default: 0.5 },
        ],
      },
    ],
  },
  {
    pluginCommand: 'PostProcess',
    label: 'addonCommands.postProcess',
    subCommands: [
      { id: 'on', label: 'addonCommands.postProcess_on', params: [] },
      { id: 'off', label: 'addonCommands.postProcess_off', params: [] },
      {
        id: 'focusY',
        label: 'addonCommands.postProcess_focusY',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 1, step: 0.05, default: 0.5 },
        ],
      },
      {
        id: 'focusRange',
        label: 'addonCommands.postProcess_focusRange',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 1, step: 0.05, default: 0.3 },
        ],
      },
      {
        id: 'maxblur',
        label: 'addonCommands.postProcess_maxblur',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 0.1, step: 0.005, default: 0.02 },
        ],
      },
      {
        id: 'blurPower',
        label: 'addonCommands.postProcess_blurPower',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 10, step: 0.5, default: 2 },
        ],
      },
    ],
  },
  {
    pluginCommand: 'Mode3D',
    label: 'addonCommands.mode3d',
    subCommands: [
      { id: 'on', label: 'addonCommands.mode3d_on', params: [] },
      { id: 'off', label: 'addonCommands.mode3d_off', params: [] },
      {
        id: 'tilt',
        label: 'addonCommands.mode3d_tilt',
        params: [
          { name: 'deg', type: 'float', label: 'addonCommands.param_degrees', min: 0, max: 90, step: 1, default: 60 },
        ],
      },
      {
        id: 'yaw',
        label: 'addonCommands.mode3d_yaw',
        params: [
          { name: 'deg', type: 'float', label: 'addonCommands.param_degrees', min: -180, max: 180, step: 1, default: 0 },
        ],
      },
    ],
  },
];

/** 플러그인 커맨드 텍스트에서 매칭되는 AddonCommandDef를 찾는다 */
export function matchAddonCommand(text: string): { def: AddonCommandDef; subCmd: AddonSubCommand; paramValues: string[] } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length === 0) return null;

  const cmdName = parts[0];
  const def = ADDON_COMMANDS.find(d => d.pluginCommand === cmdName);
  if (!def) return null;

  const subId = parts[1] || '';
  const subCmd = def.subCommands.find(s => s.id === subId);
  if (!subCmd) {
    // 서브커맨드 없이 커맨드명만 있는 경우 → 첫 번째 서브커맨드로 기본 매칭
    return { def, subCmd: def.subCommands[0], paramValues: parts.slice(1) };
  }

  return { def, subCmd, paramValues: parts.slice(2) };
}

/** AddonCommandDef + 서브커맨드 + 파라미터 값으로 플러그인 커맨드 텍스트를 조합한다 */
export function buildAddonCommandText(pluginCommand: string, subCommandId: string, paramValues: string[]): string {
  const parts = [pluginCommand, subCommandId, ...paramValues];
  return parts.filter(p => p !== '').join(' ');
}
