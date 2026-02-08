import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';

const router = express.Router();

// POST /api/events/search - Search events across all maps
router.post('/search', (req: Request, res: Response) => {
  try {
    const { query, type } = req.body; // type: 'name' | 'switch' | 'variable'
    const dataPath = projectManager.getDataPath();
    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number; name: string })[];
    const results: { mapId: number; mapName: string; eventId: number; eventName: string; pageIndex?: number }[] = [];

    for (const info of mapInfos) {
      if (!info) continue;
      const mapFile = `Map${String(info.id).padStart(3, '0')}.json`;
      const mapPath = path.join(dataPath, mapFile);
      if (!fs.existsSync(mapPath)) continue;

      const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      if (!mapData.events) continue;

      for (const event of mapData.events) {
        if (!event) continue;

        if (type === 'name' && event.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({ mapId: info.id, mapName: info.name, eventId: event.id, eventName: event.name });
        } else if (type === 'switch' || type === 'variable') {
          const searchId = Number(query);
          if (!event.pages) continue;
          for (let pi = 0; pi < event.pages.length; pi++) {
            const page = event.pages[pi];
            const cmds = JSON.stringify(page.list || []);
            // Search for switch/variable references in event commands
            if (cmds.includes(`${searchId}`)) {
              results.push({ mapId: info.id, mapName: info.name, eventId: event.id, eventName: event.name, pageIndex: pi });
              break;
            }
          }
        }
      }
    }

    res.json(results);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
