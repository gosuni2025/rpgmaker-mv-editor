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

<<<<<<< HEAD
// PPEffect 이펙트별 서브커맨드 생성 헬퍼
function ppEffect(effectKey: string, label: string, params: AddonParam[]): AddonCommandDef {
  const subCommands: AddonSubCommand[] = [
    { id: `${effectKey} on`, label: 'addonCommands.ppEffect_on', params: [] },
    { id: `${effectKey} off`, label: 'addonCommands.ppEffect_off', params: [] },
  ];
  for (const p of params) {
    subCommands.push({
      id: `${effectKey} ${p.name}`,
      label: p.label,
      params: [{ ...p, label: 'addonCommands.param_value' }],
      supportsDuration: true,
    });
  }
  return { pluginCommand: 'PPEffect', label, subCommands };
}

export const ADDON_COMMANDS: AddonCommandDef[] = [
  // --- 맵/렌더링 ---
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
          { name: 'intensity', type: 'float', label: 'addonCommands.param_intensity', min: 0, max: 2, step: 0.1, default: 0.35 },
        ],
        supportsDuration: true,
      },
      {
        id: 'ambientColor',
        label: 'addonCommands.shadowLight_ambientColor',
        params: [
          { name: 'color', type: 'color', label: 'addonCommands.param_color', defaultColor: '#667788' },
        ],
        supportsDuration: true,
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
      {
        id: 'pointLight_intensity',
        label: 'addonCommands.shadowLight_pointLight_intensity',
        params: [
          { name: 'lightId', type: 'pointlight', label: 'addonCommands.param_pointLight' },
          { name: 'intensity', type: 'float', label: 'addonCommands.param_intensity', min: 0, max: 5, step: 0.1, default: 1 },
        ],
        supportsDuration: true,
      },
      {
        id: 'pointLight_color',
        label: 'addonCommands.shadowLight_pointLight_color',
        params: [
          { name: 'lightId', type: 'pointlight', label: 'addonCommands.param_pointLight' },
          { name: 'color', type: 'color', label: 'addonCommands.param_color', defaultColor: '#ffcc88' },
        ],
      },
      {
        id: 'pointLight_distance',
        label: 'addonCommands.shadowLight_pointLight_distance',
        params: [
          { name: 'lightId', type: 'pointlight', label: 'addonCommands.param_pointLight' },
          { name: 'distance', type: 'float', label: 'addonCommands.param_distance', min: 0, max: 1000, step: 10, default: 150 },
        ],
        supportsDuration: true,
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
        supportsDuration: true,
      },
      {
        id: 'focusRange',
        label: 'addonCommands.postProcess_focusRange',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 1, step: 0.05, default: 0.3 },
        ],
        supportsDuration: true,
      },
      {
        id: 'maxblur',
        label: 'addonCommands.postProcess_maxblur',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 0.1, step: 0.005, default: 0.02 },
        ],
        supportsDuration: true,
      },
      {
        id: 'blurPower',
        label: 'addonCommands.postProcess_blurPower',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 10, step: 0.5, default: 2 },
        ],
        supportsDuration: true,
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
        supportsDuration: true,
      },
      {
        id: 'yaw',
        label: 'addonCommands.mode3d_yaw',
        params: [
          { name: 'deg', type: 'float', label: 'addonCommands.param_degrees', min: -180, max: 180, step: 1, default: 0 },
        ],
        supportsDuration: true,
      },
    ],
  },

  // --- PPEffect (포스트 프로세스 이펙트) ---
  ppEffect('vignette', 'addonCommands.pp_vignette', [
    { name: 'intensity', type: 'float', label: 'addonCommands.pp_vignette_intensity', min: 0, max: 2, step: 0.05, default: 0.5 },
    { name: 'softness', type: 'float', label: 'addonCommands.pp_vignette_softness', min: 0, max: 0.5, step: 0.05, default: 0.3 },
    { name: 'radius', type: 'float', label: 'addonCommands.pp_vignette_radius', min: 0, max: 0.7, step: 0.05, default: 0.4 },
  ]),
  ppEffect('colorGrading', 'addonCommands.pp_colorGrading', [
    { name: 'brightness', type: 'float', label: 'addonCommands.pp_colorGrading_brightness', min: -0.5, max: 0.5, step: 0.01, default: 0 },
    { name: 'contrast', type: 'float', label: 'addonCommands.pp_colorGrading_contrast', min: 0.5, max: 2, step: 0.05, default: 1 },
    { name: 'saturation', type: 'float', label: 'addonCommands.pp_colorGrading_saturation', min: 0, max: 3, step: 0.05, default: 1 },
    { name: 'temperature', type: 'float', label: 'addonCommands.pp_colorGrading_temperature', min: -1, max: 1, step: 0.05, default: 0 },
    { name: 'tint', type: 'float', label: 'addonCommands.pp_colorGrading_tint', min: -1, max: 1, step: 0.05, default: 0 },
    { name: 'gamma', type: 'float', label: 'addonCommands.pp_colorGrading_gamma', min: 0.5, max: 2.5, step: 0.05, default: 1 },
  ]),
  ppEffect('chromatic', 'addonCommands.pp_chromatic', [
    { name: 'strength', type: 'float', label: 'addonCommands.pp_chromatic_strength', min: 0, max: 0.05, step: 0.001, default: 0.005 },
    { name: 'radial', type: 'float', label: 'addonCommands.pp_chromatic_radial', min: 0, max: 3, step: 0.1, default: 1 },
  ]),
  ppEffect('filmGrain', 'addonCommands.pp_filmGrain', [
    { name: 'intensity', type: 'float', label: 'addonCommands.pp_filmGrain_intensity', min: 0, max: 0.5, step: 0.01, default: 0.1 },
    { name: 'size', type: 'float', label: 'addonCommands.pp_filmGrain_size', min: 0.5, max: 4, step: 0.1, default: 1 },
  ]),
  ppEffect('toneMapping', 'addonCommands.pp_toneMapping', [
    { name: 'exposure', type: 'float', label: 'addonCommands.pp_toneMapping_exposure', min: 0.1, max: 3, step: 0.05, default: 1 },
    { name: 'mode', type: 'number', label: 'addonCommands.pp_toneMapping_mode', min: 0, max: 2, step: 1, default: 0 },
  ]),
  ppEffect('fog', 'addonCommands.pp_fog', [
    { name: 'density', type: 'float', label: 'addonCommands.pp_fog_density', min: 0, max: 1, step: 0.05, default: 0.3 },
    { name: 'start', type: 'float', label: 'addonCommands.pp_fog_start', min: 0, max: 1, step: 0.05, default: 0 },
    { name: 'end', type: 'float', label: 'addonCommands.pp_fog_end', min: 0, max: 1, step: 0.05, default: 1 },
  ]),
  ppEffect('godRays', 'addonCommands.pp_godRays', [
    { name: 'lightPosX', type: 'float', label: 'addonCommands.pp_godRays_lightPosX', min: 0, max: 1, step: 0.01, default: 0.5 },
    { name: 'lightPosY', type: 'float', label: 'addonCommands.pp_godRays_lightPosY', min: 0, max: 1, step: 0.01, default: 0 },
    { name: 'exposure', type: 'float', label: 'addonCommands.pp_godRays_exposure', min: 0, max: 1, step: 0.01, default: 0.3 },
    { name: 'decay', type: 'float', label: 'addonCommands.pp_godRays_decay', min: 0.8, max: 1, step: 0.005, default: 0.95 },
    { name: 'density', type: 'float', label: 'addonCommands.pp_godRays_density', min: 0, max: 2, step: 0.05, default: 0.8 },
    { name: 'weight', type: 'float', label: 'addonCommands.pp_godRays_weight', min: 0, max: 1, step: 0.05, default: 0.4 },
  ]),
  ppEffect('radialBlur', 'addonCommands.pp_radialBlur', [
    { name: 'centerX', type: 'float', label: 'addonCommands.pp_radialBlur_centerX', min: 0, max: 1, step: 0.01, default: 0.5 },
    { name: 'centerY', type: 'float', label: 'addonCommands.pp_radialBlur_centerY', min: 0, max: 1, step: 0.01, default: 0.5 },
    { name: 'strength', type: 'float', label: 'addonCommands.pp_radialBlur_strength', min: 0, max: 0.5, step: 0.01, default: 0.1 },
  ]),
  ppEffect('waveDistortion', 'addonCommands.pp_waveDistortion', [
    { name: 'amplitude', type: 'float', label: 'addonCommands.pp_waveDistortion_amplitude', min: 0, max: 0.1, step: 0.005, default: 0.03 },
    { name: 'waveWidth', type: 'float', label: 'addonCommands.pp_waveDistortion_waveWidth', min: 0, max: 0.5, step: 0.01, default: 0.15 },
    { name: 'speed', type: 'float', label: 'addonCommands.pp_waveDistortion_speed', min: 0, max: 5, step: 0.1, default: 1.5 },
  ]),
  ppEffect('anamorphic', 'addonCommands.pp_anamorphic', [
    { name: 'threshold', type: 'float', label: 'addonCommands.pp_anamorphic_threshold', min: 0, max: 1, step: 0.05, default: 0.7 },
    { name: 'intensity', type: 'float', label: 'addonCommands.pp_anamorphic_intensity', min: 0, max: 2, step: 0.05, default: 0.5 },
    { name: 'streakLength', type: 'float', label: 'addonCommands.pp_anamorphic_streakLength', min: 0, max: 2, step: 0.05, default: 0.5 },
  ]),
  ppEffect('motionBlur', 'addonCommands.pp_motionBlur', [
    { name: 'velocityX', type: 'float', label: 'addonCommands.pp_motionBlur_velocityX', min: -0.05, max: 0.05, step: 0.001, default: 0 },
    { name: 'velocityY', type: 'float', label: 'addonCommands.pp_motionBlur_velocityY', min: -0.05, max: 0.05, step: 0.001, default: 0 },
  ]),
  ppEffect('pixelation', 'addonCommands.pp_pixelation', [
    { name: 'pixelSize', type: 'number', label: 'addonCommands.pp_pixelation_pixelSize', min: 1, max: 32, step: 1, default: 4 },
  ]),
  ppEffect('colorInversion', 'addonCommands.pp_colorInversion', [
    { name: 'strength', type: 'float', label: 'addonCommands.pp_colorInversion_strength', min: 0, max: 1, step: 0.05, default: 1 },
  ]),
  ppEffect('edgeDetection', 'addonCommands.pp_edgeDetection', [
    { name: 'strength', type: 'float', label: 'addonCommands.pp_edgeDetection_strength', min: 0, max: 3, step: 0.1, default: 1 },
    { name: 'threshold', type: 'float', label: 'addonCommands.pp_edgeDetection_threshold', min: 0, max: 0.5, step: 0.01, default: 0.1 },
    { name: 'overlay', type: 'float', label: 'addonCommands.pp_edgeDetection_overlay', min: 0, max: 1, step: 0.1, default: 1 },
  ]),
  ppEffect('ssao', 'addonCommands.pp_ssao', [
    { name: 'radius', type: 'float', label: 'addonCommands.pp_ssao_radius', min: 1, max: 20, step: 0.5, default: 5 },
    { name: 'intensity', type: 'float', label: 'addonCommands.pp_ssao_intensity', min: 0, max: 2, step: 0.05, default: 0.5 },
    { name: 'bias', type: 'float', label: 'addonCommands.pp_ssao_bias', min: 0, max: 0.2, step: 0.005, default: 0.05 },
  ]),

  // --- 맵 오브젝트 제어 ---
  {
    pluginCommand: 'MapObject',
    label: 'addonCommands.mapObject',
    subCommands: [
      {
        id: 'show',
        label: 'addonCommands.mapObject_show',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
        ],
      },
      {
        id: 'hide',
        label: 'addonCommands.mapObject_hide',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
        ],
      },
      {
        id: 'showWithShader',
        label: 'addonCommands.mapObject_showWithShader',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'shaderType', type: 'shadertype' as const, label: 'addonCommands.param_shaderType', transitionOnly: true },
        ],
        supportsDuration: true,
      },
      {
        id: 'hideWithShader',
        label: 'addonCommands.mapObject_hideWithShader',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'shaderType', type: 'shadertype' as const, label: 'addonCommands.param_shaderType', transitionOnly: true },
        ],
        supportsDuration: true,
      },
      {
        id: 'move',
        label: 'addonCommands.mapObject_move',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'x', type: 'number', label: 'X', min: 0, default: 0 },
          { name: 'y', type: 'number', label: 'Y', min: 0, default: 0 },
        ],
        supportsDuration: true,
      },
      {
        id: 'scale',
        label: 'addonCommands.mapObject_scale',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0.1, max: 10, step: 0.1, default: 1 },
        ],
        supportsDuration: true,
      },
      {
        id: 'zHeight',
        label: 'addonCommands.mapObject_zHeight',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 200, step: 1, default: 0 },
        ],
        supportsDuration: true,
      },
      {
        id: 'anchorY',
        label: 'addonCommands.mapObject_anchorY',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 1, step: 0.05, default: 1 },
        ],
        supportsDuration: true,
      },
      {
        id: 'passability',
        label: 'addonCommands.mapObject_passability',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'value', type: 'boolean', label: 'addonCommands.param_onOff', default: 1 },
        ],
      },
      {
        id: 'shader_add',
        label: 'addonCommands.mapObject_shader_add',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'shaderType', type: 'shadertype' as const, label: 'addonCommands.param_shaderType' },
        ],
      },
      {
        id: 'shader_remove',
        label: 'addonCommands.mapObject_shader_remove',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'shaderType', type: 'shadertype' as const, label: 'addonCommands.param_shaderType', allowAll: true },
        ],
      },
      {
        id: 'shader_param',
        label: 'addonCommands.mapObject_shader_param',
        params: [
          { name: 'objectId', type: 'mapobject' as const, label: 'addonCommands.param_object' },
          { name: 'shaderType', type: 'shadertype' as const, label: 'addonCommands.param_shaderType' },
          { name: 'paramKey', type: 'shaderparam' as const, label: 'addonCommands.param_shaderParam' },
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: -100, max: 100, step: 0.01, default: 0 },
        ],
        supportsDuration: true,
      },
    ],
  },
];
=======
import { ADDON_COMMANDS } from './addonCommandData';
export { ADDON_COMMANDS };
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

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
