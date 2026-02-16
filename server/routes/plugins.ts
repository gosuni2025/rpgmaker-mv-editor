import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import projectManager from '../services/projectManager';

const router = express.Router();

interface PluginParamMeta {
  name: string;
  desc: string;
  type: string;       // string, number, boolean, select, file, combo, note, etc.
  default: string;
  options: string[];   // for select/combo @option entries
  dir: string;         // for file type @dir
  min?: string;
  max?: string;
  parent?: string;     // for nested @parent
}

interface PluginMetadata {
  pluginname: string;
  plugindesc: string;
  author: string;
  help: string;
  params: PluginParamMeta[];
}

function parsePluginMetadata(content: string, locale?: string): PluginMetadata {
  let block: string | null = null;

  // Try locale-specific block first (e.g. /*:ko ... */)
  if (locale) {
    const localeRegex = new RegExp(`\\/\\*:${locale}\\s*\\n([\\s\\S]*?)\\*\\/`);
    const localeMatch = content.match(localeRegex);
    if (localeMatch) block = localeMatch[1];
  }

  // Fall back to default /*: ... */ block
  if (!block) {
    const defaultMatch = content.match(/\/\*:\s*\n([\s\S]*?)\*\//);
    if (!defaultMatch) return { pluginname: '', plugindesc: '', author: '', help: '', params: [] };
    block = defaultMatch[1];
  }
  const lines = block.split('\n').map(l => l.replace(/^\s*\*\s?/, ''));

  let pluginname = '';
  let plugindesc = '';
  let author = '';
  let help = '';
  const params: PluginParamMeta[] = [];
  let currentParam: PluginParamMeta | null = null;
  let inHelp = false;

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)\s*(.*)/);
    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      const value = tagMatch[2].trim();

      if (tag === 'pluginname') {
        pluginname = value;
        inHelp = false;
      } else if (tag === 'plugindesc') {
        plugindesc = value;
        inHelp = false;
      } else if (tag === 'author') {
        author = value;
        inHelp = false;
      } else if (tag === 'help') {
        help = value;
        inHelp = true;
      } else if (tag === 'param') {
        inHelp = false;
        if (currentParam) params.push(currentParam);
        currentParam = {
          name: value,
          desc: '',
          type: 'string',
          default: '',
          options: [],
          dir: '',
        };
      } else if (currentParam) {
        inHelp = false;
        if (tag === 'desc') {
          currentParam.desc = value;
        } else if (tag === 'type') {
          currentParam.type = value;
        } else if (tag === 'default') {
          currentParam.default = value;
        } else if (tag === 'option') {
          currentParam.options.push(value);
        } else if (tag === 'dir') {
          currentParam.dir = value;
        } else if (tag === 'min') {
          currentParam.min = value;
        } else if (tag === 'max') {
          currentParam.max = value;
        } else if (tag === 'parent') {
          currentParam.parent = value;
        }
      } else if (inHelp) {
        help += '\n' + line;
      }
    } else if (inHelp) {
      help += '\n' + line;
    } else if (currentParam && !line.startsWith('@')) {
      // Multi-line desc continuation
      if (currentParam.desc && line.trim()) {
        currentParam.desc += ' ' + line.trim();
      }
    }
  }
  if (currentParam) params.push(currentParam);

  return { pluginname, plugindesc, author, help: help.trim(), params };
}

// GET /api/plugins - List plugins and their status
router.get('/', (req: Request, res: Response) => {
  try {
    const pluginsDir = path.join(projectManager.getJsPath(), 'plugins');
    if (!fs.existsSync(pluginsDir)) return res.json({ plugins: [], list: [] });

    // Read plugins.js for enabled list
    const pluginsJsPath = path.join(projectManager.getJsPath(), 'plugins.js');
    let pluginList: { name: string; status: boolean; description: string; parameters: Record<string, string> }[] = [];
    if (fs.existsSync(pluginsJsPath)) {
      const content = fs.readFileSync(pluginsJsPath, 'utf8');
      const match = content.match(/\$plugins\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        try { pluginList = JSON.parse(match[1]); } catch {}
      }
    }

    // List all .js files in plugins/
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));

    res.json({ files, list: pluginList });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/plugins/metadata - Parse plugin file comments for param metadata
// Query params: ?locale=ko (optional, for localized metadata)
router.get('/metadata', (req: Request, res: Response) => {
  try {
    const pluginsDir = path.join(projectManager.getJsPath(), 'plugins');
    if (!fs.existsSync(pluginsDir)) return res.json({});

    const locale = req.query.locale as string | undefined;
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
    const result: Record<string, PluginMetadata> = {};

    for (const file of files) {
      const name = file.replace('.js', '');
      const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
      result[name] = parsePluginMetadata(content, locale);
    }

    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/plugins - Save plugin list
router.put('/', (req: Request, res: Response) => {
  try {
    const pluginsJsPath = path.join(projectManager.getJsPath(), 'plugins.js');
    const content = `// Generated by RPG Maker MV Editor\nvar $plugins = ${JSON.stringify(req.body, null, 2)};\n`;
    fs.writeFileSync(pluginsJsPath, content, 'utf8');
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/plugins/open-folder - Open plugins folder in OS file explorer
router.post('/open-folder', (_req: Request, res: Response) => {
  try {
    const pluginsDir = path.join(projectManager.getJsPath(), 'plugins');
    const cmd = process.platform === 'darwin' ? `open "${pluginsDir}"`
      : process.platform === 'win32' ? `explorer "${pluginsDir}"`
      : `xdg-open "${pluginsDir}"`;
    exec(cmd);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/plugins/credit-text - Read Credits.txt
router.get('/credit-text', (req: Request, res: Response) => {
  try {
    const creditsPath = path.join(projectManager.getDataPath(), 'Credits.txt');
    if (!fs.existsSync(creditsPath)) {
      return res.type('text/plain').send('');
    }
    const content = fs.readFileSync(creditsPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/plugins/credit-text - Save Credits.txt
router.put('/credit-text', express.text({ type: '*/*' }), (req: Request, res: Response) => {
  try {
    const creditsPath = path.join(projectManager.getDataPath(), 'Credits.txt');
    fs.writeFileSync(creditsPath, req.body, 'utf8');
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/plugins/credit-text/open-folder - Open data folder in OS file explorer
router.post('/credit-text/open-folder', (_req: Request, res: Response) => {
  try {
    const dataPath = projectManager.getDataPath();
    const cmd = process.platform === 'darwin' ? `open "${dataPath}"`
      : process.platform === 'win32' ? `explorer "${dataPath}"`
      : `xdg-open "${dataPath}"`;
    exec(cmd);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
