import express from 'express';
import projectManager from '../services/projectManager';
import * as l10n from '../services/localizationManager';
import { asyncHandler } from '../utils/asyncHandler';

const TYPE_MAP: Record<string, string> = {
  actors: 'Actors.json',
  classes: 'Classes.json',
  skills: 'Skills.json',
  items: 'Items.json',
  weapons: 'Weapons.json',
  armors: 'Armors.json',
  enemies: 'Enemies.json',
  troops: 'Troops.json',
  states: 'States.json',
  animations: 'Animations.json',
  tilesets: 'Tilesets.json',
  commonEvents: 'CommonEvents.json',
  system: 'System.json',
  mapInfos: 'MapInfos.json',
  quests: 'Quests.json'
};

function resolveFilename(type: string): string | null {
  return TYPE_MAP[type] || null;
}

const router = express.Router();

router.get('/:type', asyncHandler((req, res) => {
  const type = req.params.type as string;
  const filename = resolveFilename(type);
  if (!filename) {
    return res.status(400).json({ error: `Unknown database type: ${type}` }) as any;
  }
  const data = projectManager.readJSON(filename);
  res.json(data);
}));

// DB types that have localization sync support
const L10N_DB_TYPES = new Set(['actors', 'classes', 'skills', 'items', 'weapons', 'armors', 'enemies', 'states']);

router.put('/:type', asyncHandler((req, res) => {
  const type = req.params.type as string;
  const filename = resolveFilename(type);
  if (!filename) {
    return res.status(400).json({ error: `Unknown database type: ${type}` }) as any;
  }
  projectManager.writeJSON(filename, req.body);

  // Auto-sync localization CSV if initialized
  let l10nDiff = null;
  try {
    const config = l10n.getConfig();
    if (config) {
      let diff = null;
      if (L10N_DB_TYPES.has(type)) {
        diff = l10n.syncDBCSV(type).diff;
      } else if (type === 'system') {
        diff = l10n.syncTermsCSV().diff;
      } else if (type === 'commonEvents') {
        diff = l10n.syncCommonEventsCSV().diff;
      }
      if (diff && (diff.added.length || diff.modified.length || diff.deleted.length)) {
        l10nDiff = diff;
      }
    }
  } catch { /* localization sync failure should not block save */ }

  res.json({ success: true, l10nDiff });
}));

export default router;
