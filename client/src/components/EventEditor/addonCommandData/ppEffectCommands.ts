import type { AddonParam, AddonSubCommand, AddonCommandDef } from '../addonCommands';

// PPEffect 이펙트별 서브커맨드 생성 헬퍼
function ppEffect(effectKey: string, label: string, params: AddonParam[]): AddonCommandDef {
  const subCommands: AddonSubCommand[] = [
    { id: `${effectKey} on`, label: 'addonCommands.ppEffect_on', params: [], supportsDuration: true },
    { id: `${effectKey} off`, label: 'addonCommands.ppEffect_off', params: [], supportsDuration: true },
  ];
  for (const p of params) {
    subCommands.push({
      id: `${effectKey} ${p.name}`,
      label: p.label,
      params: [{ ...p, label: 'addonCommands.param_value' }],
      supportsDuration: true,
    });
  }
  subCommands.push({
    id: `${effectKey} applyOverUI`,
    label: 'addonCommands.ppEffect_applyOverUI',
    params: [{ name: 'value', type: 'boolean', label: 'addonCommands.param_value' }],
    supportsDuration: false,
  });
  return { pluginCommand: 'PPEffect', label, subCommands };
}

export const PP_EFFECT_COMMANDS: AddonCommandDef[] = [
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
  ppEffect('heatHaze', 'addonCommands.pp_heatHaze', [
    { name: 'amplitude', type: 'float', label: 'addonCommands.pp_heatHaze_amplitude', min: 0, max: 0.02, step: 0.001, default: 0.003 },
    { name: 'frequencyX', type: 'float', label: 'addonCommands.pp_heatHaze_frequencyX', min: 1, max: 40, step: 1, default: 15 },
    { name: 'frequencyY', type: 'float', label: 'addonCommands.pp_heatHaze_frequencyY', min: 1, max: 40, step: 1, default: 10 },
    { name: 'speed', type: 'float', label: 'addonCommands.pp_heatHaze_speed', min: 0, max: 5, step: 0.1, default: 1 },
  ]),
  ppEffect('scanlines', 'addonCommands.pp_scanlines', [
    { name: 'intensity', type: 'float', label: 'addonCommands.pp_scanlines_intensity', min: 0, max: 1, step: 0.05, default: 0.4 },
    { name: 'density', type: 'float', label: 'addonCommands.pp_scanlines_density', min: 0.02, max: 1, step: 0.02, default: 1 },
    { name: 'speed', type: 'float', label: 'addonCommands.pp_scanlines_speed', min: 0, max: 0.1, step: 0.005, default: 0 },
  ]),
  ppEffect('posterize', 'addonCommands.pp_posterize', [
    { name: 'steps', type: 'float', label: 'addonCommands.pp_posterize_steps', min: 2, max: 32, step: 1, default: 8 },
    { name: 'blend', type: 'float', label: 'addonCommands.pp_posterize_blend', min: 0, max: 1, step: 0.05, default: 1 },
  ]),
  ppEffect('barrelDistort', 'addonCommands.pp_barrelDistort', [
    { name: 'curvature', type: 'float', label: 'addonCommands.pp_barrelDistort_curvature', min: 0, max: 0.3, step: 0.01, default: 0.08 },
  ]),
  ppEffect('crtPhosphor', 'addonCommands.pp_crtPhosphor', [
    { name: 'type',     type: 'float', label: 'addonCommands.pp_crtPhosphor_type',     min: 0, max: 1,   step: 1,    default: 0 },
    { name: 'strength', type: 'float', label: 'addonCommands.pp_crtPhosphor_strength', min: 0, max: 1,   step: 0.05, default: 0.3 },
    { name: 'scale',    type: 'float', label: 'addonCommands.pp_crtPhosphor_scale',    min: 0.5, max: 4, step: 0.25, default: 1 },
  ]),
  ppEffect('crtGlare', 'addonCommands.pp_crtGlare', [
    { name: 'posX',      type: 'float', label: 'addonCommands.pp_crtGlare_posX',      min: 0, max: 1,   step: 0.01,  default: 0.15 },
    { name: 'posY',      type: 'float', label: 'addonCommands.pp_crtGlare_posY',      min: 0, max: 1,   step: 0.01,  default: 0.18 },
    { name: 'intensity', type: 'float', label: 'addonCommands.pp_crtGlare_intensity', min: 0, max: 1,   step: 0.05,  default: 0.25 },
  ]),
  ppEffect('crtGlow', 'addonCommands.pp_crtGlow', [
    { name: 'intensity', type: 'float', label: 'addonCommands.pp_crtGlow_intensity',  min: 0, max: 2,  step: 0.05, default: 0.5 },
    { name: 'threshold', type: 'float', label: 'addonCommands.pp_crtGlow_threshold', min: 0, max: 1,  step: 0.05, default: 0.6 },
  ]),
  ppEffect('crtNoise', 'addonCommands.pp_crtNoise', [
    { name: 'jitter', type: 'float', label: 'addonCommands.pp_crtNoise_jitter', min: 0, max: 0.02, step: 0.001, default: 0.003 },
    { name: 'noise',  type: 'float', label: 'addonCommands.pp_crtNoise_noise',  min: 0, max: 0.2,  step: 0.01,  default: 0.04 },
  ]),
  ppEffect('crtCorner', 'addonCommands.pp_crtCorner', [
    { name: 'radius', type: 'float', label: 'addonCommands.pp_crtCorner_radius', min: 0, max: 0.2, step: 0.01, default: 0.05 },
  ]),
];
