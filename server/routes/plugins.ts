import express, { Request, Response } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { exec } from 'child_process';
import projectManager from '../services/projectManager';

const router = express.Router();
const runtimePath = path.join(__dirname, '..', 'runtime');

function pluginFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

interface PluginParamMeta {
  name: string;
  text?: string;       // @text 표시명
  desc: string;
  type: string;       // string, number, boolean, select, file, combo, note, etc.
  default: string;
  options: { label: string; value: string }[];  // for select/combo @option entries
  dir: string;         // for file type @dir
  min?: string;
  max?: string;
  parent?: string;     // for nested @parent
}

interface PluginArgMeta {
  name: string;
  text: string;
  type: string;
  default: string;
  options: { label: string; value: string }[];
  min?: string;
  max?: string;
  desc?: string;
}

interface PluginCommandMeta {
  name: string;
  text: string;
  desc: string;
  args: PluginArgMeta[];
}

interface PluginMetadata {
  pluginname: string;
  plugindesc: string;
  author: string;
  help: string;
  params: PluginParamMeta[];
  commands?: PluginCommandMeta[];
  plugincommand?: string;   // @plugincommand — 실제 커맨드 prefix (파일명과 다를 경우 명시)
  dependencies?: string[];  // e.g. ['EXT']
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
  let plugincommand = '';
  const params: PluginParamMeta[] = [];
  const commands: PluginCommandMeta[] = [];
  let currentParam: PluginParamMeta | null = null;
  let currentCommand: PluginCommandMeta | null = null;
  let currentArg: PluginArgMeta | null = null;
  // pending option label: @option sets label, @value sets value
  let pendingOptionLabel: string | null = null;
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
      } else if (tag === 'plugincommand') {
        plugincommand = value;
        inHelp = false;
      } else if (tag === 'help') {
        help = value;
        inHelp = true;
      } else if (tag === 'command') {
        inHelp = false;
        // flush pending state
        if (pendingOptionLabel !== null && currentArg) {
          currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = null;
        }
        if (currentArg && currentCommand) { currentCommand.args.push(currentArg); currentArg = null; }
        if (currentParam) { params.push(currentParam); currentParam = null; }
        if (currentCommand) commands.push(currentCommand);
        currentCommand = { name: value, text: '', desc: '', args: [] };
      } else if (tag === 'arg') {
        inHelp = false;
        if (pendingOptionLabel !== null && currentArg) {
          currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = null;
        }
        if (currentArg && currentCommand) currentCommand.args.push(currentArg);
        currentArg = { name: value, text: '', type: 'string', default: '', options: [] };
      } else if (currentArg) {
        inHelp = false;
        if (tag === 'text') { currentArg.text = value; }
        else if (tag === 'type') { currentArg.type = value; }
        else if (tag === 'default') { currentArg.default = value; }
        else if (tag === 'option') {
          if (pendingOptionLabel !== null) currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = value;
        } else if (tag === 'value') {
          if (pendingOptionLabel !== null) { currentArg.options.push({ label: pendingOptionLabel, value }); pendingOptionLabel = null; }
        } else if (tag === 'min') { currentArg.min = value; }
        else if (tag === 'max') { currentArg.max = value; }
        else if (tag === 'desc') { currentArg.desc = value; }
      } else if (currentCommand) {
        inHelp = false;
        if (tag === 'text') { currentCommand.text = value; }
        else if (tag === 'desc') { currentCommand.desc = value; }
      } else if (tag === 'param') {
        inHelp = false;
        if (pendingOptionLabel !== null && currentParam) {
          currentParam.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = null;
        }
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
        if (tag === 'text') {
          currentParam.text = value;
        } else if (tag === 'desc') {
          currentParam.desc = value;
        } else if (tag === 'type') {
          currentParam.type = value;
        } else if (tag === 'default') {
          currentParam.default = value;
        } else if (tag === 'option') {
          if (pendingOptionLabel !== null) currentParam.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = value;
        } else if (tag === 'value') {
          if (pendingOptionLabel !== null) { currentParam.options.push({ label: pendingOptionLabel, value }); pendingOptionLabel = null; }
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
  // flush remaining state
  if (pendingOptionLabel !== null) {
    if (currentArg) currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
    else if (currentParam) currentParam.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
  }
  if (currentArg && currentCommand) currentCommand.args.push(currentArg);
  if (currentParam) params.push(currentParam);
  if (currentCommand) commands.push(currentCommand);

  // 코드 본체(주석 블록 이후)에서 의존성 감지
  const deps: string[] = [];
  const codeBody = content.replace(/\/\*[\s\S]*?\*\//g, ''); // 주석 블록 제거
  if (/\bTHREE\b/.test(codeBody) || /\bMode3D\b/.test(codeBody)) deps.push('EXT');

  return {
    pluginname, plugindesc, author, help: help.trim(), params,
    ...(commands.length > 0 ? { commands } : {}),
    ...(plugincommand ? { plugincommand } : {}),
    ...(deps.length > 0 ? { dependencies: deps } : {}),
  };
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
    const plugins = req.body as { name: string; status: boolean; description: string; parameters: Record<string, string> }[];
    const lines = plugins.map(p => JSON.stringify(p));
    const content = `// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =\n[\n${lines.join(',\n')}\n];\n`;
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

// POST /api/plugins/open-vscode - Open plugin file in VSCode
// Body: { name: string }
// 프로젝트 js/plugins/<name>.js 를 우선하고, 없으면 에디터 런타임 plugins/<name>.js 를 연다.
router.post('/open-vscode', (req: Request, res: Response) => {
  try {
    const name = (req.body?.name as string || '').replace(/[^\w-]/g, '');
    if (!name) return res.status(400).json({ error: 'name required' });

    const projectFile = path.join(projectManager.getJsPath(), 'plugins', `${name}.js`);
    const runtimeFile = path.join(runtimePath, 'js', 'plugins', `${name}.js`);
    const filePath = fs.existsSync(projectFile) ? projectFile : runtimeFile;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Plugin file not found: ${name}.js` });
    }

    const cmd = process.platform === 'darwin'
      ? `open -a "Visual Studio Code" "${filePath}"`
      : `code "${filePath}"`;
    exec(cmd, (err) => {
      if (err) {
        // fallback: try plain `code` command on macOS too
        exec(`code "${filePath}"`);
      }
    });
    res.json({ success: true, path: filePath });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Resolve a project-relative text file path safely
function resolveCreditFilePath(filePath: string): string | null {
  const basePath = projectManager.currentPath;
  if (!basePath) return null;
  const rel = filePath || 'data/Credits.txt';
  const resolved = path.resolve(path.join(basePath, rel));
  if (!resolved.startsWith(path.resolve(basePath))) return null; // path traversal guard
  return resolved;
}

// GET /api/plugins/credit-text?path=data/Credits.txt - Read credit text file
router.get('/credit-text', (req: Request, res: Response) => {
  try {
    const filePath = resolveCreditFilePath((req.query.path as string) || 'data/Credits.txt');
    if (!filePath) return res.status(403).json({ error: 'Access denied' });
    if (!fs.existsSync(filePath)) {
      return res.type('text/plain').send('');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/plugins/credit-text?path=data/Credits.txt - Save credit text file
router.put('/credit-text', express.text({ type: '*/*' }), (req: Request, res: Response) => {
  try {
    const filePath = resolveCreditFilePath((req.query.path as string) || 'data/Credits.txt');
    if (!filePath) return res.status(403).json({ error: 'Access denied' });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, req.body, 'utf8');
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/plugins/credit-text/open-folder?path=data/Credits.txt - Open containing folder
router.post('/credit-text/open-folder', (req: Request, res: Response) => {
  try {
    const filePath = resolveCreditFilePath((req.query.path as string) || 'data/Credits.txt');
    if (!filePath) return res.status(403).json({ error: 'Access denied' });
    const dirPath = fs.existsSync(filePath) ? path.dirname(filePath) : path.dirname(filePath);
    const cmd = process.platform === 'darwin' ? `open "${dirPath}"`
      : process.platform === 'win32' ? `explorer "${dirPath}"`
      : `xdg-open "${dirPath}"`;
    exec(cmd);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/plugins/browse-dir?dir=img/skybox - List subdirectories within a project directory
router.get('/browse-dir', (req: Request, res: Response) => {
  try {
    const dir = (req.query.dir as string) || '';
    const basePath = projectManager.currentPath!;
    const targetPath = path.join(basePath, dir);

    // Security: prevent path traversal
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(basePath))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(targetPath)) {
      return res.json({ dirs: [] });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();
    res.json({ dirs });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/plugins/browse-files?dir=img/skybox&ext=png - List files within a project directory
router.get('/browse-files', (req: Request, res: Response) => {
  try {
    const dir = (req.query.dir as string) || '';
    const ext = (req.query.ext as string) || '';
    const basePath = projectManager.currentPath!;
    const targetPath = path.join(basePath, dir);

    // Security: prevent path traversal
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(basePath))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(targetPath)) {
      return res.json({ files: [] });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    let files = entries
      .filter(e => e.isFile() && !e.name.startsWith('.'))
      .map(e => e.name);

    if (ext) {
      const exts = ext.split(',').map(e => '.' + e.toLowerCase());
      files = files.filter(f => exts.some(e => f.toLowerCase().endsWith(e)));
    }

    res.json({ files: files.sort() });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/plugins/core-metadata - Parse metadata from editor core JS files (non-plugin folder)
// These are files like FogOfWar.js, Mode3D.js, ShadowAndLight.js, PostProcess.js, rpg_sprites.js
// that implement plugin commands but live in runtime/js/ root, not in a plugins/ folder.
router.get('/core-metadata', (_req: Request, res: Response) => {
  try {
    const coreDir = path.join(runtimePath, 'js');
    // Only scan files directly in the runtime/js/ root (not subfolders)
    const coreFiles = fs.readdirSync(coreDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.js'))
      .map(e => e.name);

    const result: Record<string, PluginMetadata> = {};

    for (const file of coreFiles) {
      const content = fs.readFileSync(path.join(coreDir, file), 'utf8');
      // Only include files that have a /*: block with @command tags
      const meta = parsePluginMetadata(content);
      if (meta.commands && meta.commands.length > 0) {
        const name = file.replace('.js', '');
        result[name] = meta;
      }
    }

    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/plugins/editor-plugins - List editor-provided plugins with update status
router.get('/editor-plugins', (req: Request, res: Response) => {
  try {
    const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');
    if (!fs.existsSync(editorPluginsDir)) return res.json([]);

    const projectPluginsDir = path.join(projectManager.getJsPath(), 'plugins');
    const epFiles = fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'));
    const result: { name: string; hasUpdate: boolean }[] = [];

    for (const epFile of epFiles) {
      const name = epFile.replace('.js', '');
      const editorFile = path.join(editorPluginsDir, epFile);
      const projectFile = path.join(projectPluginsDir, epFile);
      let hasUpdate = false;
      if (fs.existsSync(projectFile)) {
        hasUpdate = pluginFileHash(editorFile) !== pluginFileHash(projectFile);
      } else {
        hasUpdate = true; // not yet copied
      }
      result.push({ name, hasUpdate });
    }

    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/plugins/upgrade - Upgrade an editor plugin to latest version
router.post('/upgrade', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const editorFile = path.join(runtimePath, 'js', 'plugins', `${name}.js`);
    if (!fs.existsSync(editorFile)) {
      return res.status(404).json({ error: `Editor plugin not found: ${name}` });
    }

    const projectPluginsDir = path.join(projectManager.getJsPath(), 'plugins');
    fs.mkdirSync(projectPluginsDir, { recursive: true });
    const dest = path.join(projectPluginsDir, `${name}.js`);
    fs.copyFileSync(editorFile, dest);

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
