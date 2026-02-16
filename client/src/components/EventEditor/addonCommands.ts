/**
 * 애드온 플러그인 커맨드 정의
 * 에디터 전용 플러그인(FogOfWar, ShadowAndLight, PostProcess, Mode3D, PPEffect)의
 * 플러그인 커맨드 메타데이터를 정의하여 전용 파라미터 에디터 UI를 제공한다.
 * 내부적으로는 표준 플러그인 커맨드(코드 356)로 저장되어 RPG Maker MV 호환성 유지.
 */

export interface AddonParam {
  name: string;
  type: 'number' | 'float' | 'boolean' | 'color';
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
  defaultColor?: string;
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
      },
      {
        id: 'ambientColor',
        label: 'addonCommands.shadowLight_ambientColor',
        params: [
          { name: 'color', type: 'color', label: 'addonCommands.param_color', defaultColor: '#667788' },
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
];

/** 플러그인 커맨드 텍스트에서 매칭되는 AddonCommandDef를 찾는다 */
export function matchAddonCommand(text: string): { def: AddonCommandDef; subCmd: AddonSubCommand; paramValues: string[] } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length === 0) return null;

  const cmdName = parts[0];

  // PPEffect는 3단계: PPEffect <effectKey> <action> [value]
  if (cmdName === 'PPEffect' && parts.length >= 2) {
    const effectKey = parts[1];
    const action = parts[2] || 'on';
    const subId = `${effectKey} ${action}`;
    // effectKey로 해당 def 찾기
    const def = ADDON_COMMANDS.find(d => d.pluginCommand === 'PPEffect' && d.subCommands.some(s => s.id.startsWith(effectKey + ' ')));
    if (!def) return null;
    const subCmd = def.subCommands.find(s => s.id === subId);
    if (!subCmd) {
      return { def, subCmd: def.subCommands[0], paramValues: parts.slice(2) };
    }
    return { def, subCmd, paramValues: parts.slice(3) };
  }

  // 일반 커맨드: <command> <subCommand> [params...]
  const def = ADDON_COMMANDS.find(d => d.pluginCommand === cmdName);
  if (!def) return null;

  const subId = parts[1] || '';
  const subCmd = def.subCommands.find(s => s.id === subId);
  if (!subCmd) {
    return { def, subCmd: def.subCommands[0], paramValues: parts.slice(1) };
  }

  return { def, subCmd, paramValues: parts.slice(2) };
}

/** AddonCommandDef + 서브커맨드 + 파라미터 값으로 플러그인 커맨드 텍스트를 조합한다 */
export function buildAddonCommandText(pluginCommand: string, subCommandId: string, paramValues: string[]): string {
  const parts = [pluginCommand, subCommandId, ...paramValues];
  return parts.filter(p => p !== '').join(' ');
}
