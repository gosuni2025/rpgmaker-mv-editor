import express, { Request, Response } from 'express';
import * as l10n from '../services/localizationManager';

const router = express.Router();

// GET /api/localization/config
router.get('/config', (_req: Request, res: Response) => {
  try {
    const config = l10n.getConfig();
    res.json(config || { initialized: false });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/localization/config
router.put('/config', (req: Request, res: Response) => {
  try {
    l10n.saveConfig(req.body);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/localization/init
router.post('/init', (req: Request, res: Response) => {
  try {
    const { sourceLanguage, languages } = req.body;
    l10n.initLocalization(sourceLanguage, languages);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/localization/csv/* — read CSV data
router.get('/csv/*', (req: Request, res: Response) => {
  try {
    const csvPath = (req.params as any)[0];
    const rows = l10n.readCSVFile(csvPath);
    res.json(rows);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/localization/csv/* — write CSV data
router.put('/csv/*', (req: Request, res: Response) => {
  try {
    const csvPath = (req.params as any)[0];
    const config = l10n.getConfig();
    if (!config) return res.status(400).json({ error: 'Not initialized' });
    l10n.writeCSVFile(csvPath, req.body, config);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/localization/entry — update single entry
router.put('/entry', (req: Request, res: Response) => {
  try {
    const { csvPath, key, lang, text } = req.body;
    l10n.updateEntry(csvPath, key, lang, text);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/localization/sync
router.post('/sync', (_req: Request, res: Response) => {
  try {
    const result = l10n.syncAll();
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/localization/stats
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = l10n.getStats();
    res.json(stats);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/localization/categories
router.get('/categories', (_req: Request, res: Response) => {
  try {
    const categories = l10n.getCategories();
    res.json(categories);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
