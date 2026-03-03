import type { AddonCommandDef } from '../addonCommands';

export const MAP_OBJECT_COMMANDS: AddonCommandDef[] = [
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
