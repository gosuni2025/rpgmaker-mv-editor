import type { AddonCommandDef } from '../addonCommands';
import { MAP_RENDERING_COMMANDS } from './mapRenderingCommands';
import { PP_EFFECT_COMMANDS } from './ppEffectCommands';
import { MAP_OBJECT_COMMANDS } from './mapObjectCommands';

export const ADDON_COMMANDS: AddonCommandDef[] = [
  ...MAP_RENDERING_COMMANDS,
  ...PP_EFFECT_COMMANDS,
  ...MAP_OBJECT_COMMANDS,
];
