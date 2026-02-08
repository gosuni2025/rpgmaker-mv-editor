import express, { Request, Response } from 'express';
import projectManager from '../services/projectManager';

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
  mapInfos: 'MapInfos.json'
};

function resolveFilename(type: string): string | null {
  return TYPE_MAP[type] || null;
}

const router = express.Router();

router.get('/:type', (req: Request<{ type: string }>, res: Response) => {
  try {
    const filename = resolveFilename(req.params.type);
    if (!filename) {
      return res.status(400).json({ error: `Unknown database type: ${req.params.type}` });
    }
    const data = projectManager.readJSON(filename);
    res.json(data);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:type', (req: Request<{ type: string }>, res: Response) => {
  try {
    const filename = resolveFilename(req.params.type);
    if (!filename) {
      return res.status(400).json({ error: `Unknown database type: ${req.params.type}` });
    }
    projectManager.writeJSON(filename, req.body);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
