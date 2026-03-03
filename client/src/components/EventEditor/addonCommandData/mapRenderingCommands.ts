import type { AddonCommandDef } from '../addonCommands';

export const MAP_RENDERING_COMMANDS: AddonCommandDef[] = [
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
      {
        id: 'FogColor',
        label: 'addonCommands.fogOfWar_FogColor',
        params: [
          { name: 'color', type: 'color', label: 'addonCommands.param_color', defaultColor: '#000000' },
        ],
      },
      {
        id: 'TentacleSharpness',
        label: 'addonCommands.fogOfWar_TentacleSharpness',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0.5, max: 20, step: 0.5, default: 3.0 },
        ],
      },
      {
        id: 'TentacleLength',
        label: 'addonCommands.fogOfWar_TentacleLength',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0.1, max: 10, step: 0.1, default: 2.0 },
        ],
      },
      {
        id: 'TentacleSpeed',
        label: 'addonCommands.fogOfWar_TentacleSpeed',
        params: [
          { name: 'value', type: 'float', label: 'addonCommands.param_value', min: 0, max: 10, step: 0.1, default: 1.0 },
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
];
