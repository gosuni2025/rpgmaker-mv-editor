import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AutoSaveSettings {
  enabled: boolean;
  intervalMinutes: number;
  gitCommit: boolean;
  gitAddAll: boolean;
}

export interface NetlifySettings {
  apiKey: string;
  siteId: string;
}

export interface EditorSettings {
  steamPath: string;
  language: string;
  transparentColor: { r: number; g: number; b: number };
  maxUndo: number;
  zoomStep: number;
  autoSave: AutoSaveSettings;
  netlify: NetlifySettings;
}

const SETTINGS_DIR = path.join(os.homedir(), '.rpg-editor');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULT_SETTINGS: EditorSettings = {
  steamPath: '',
  language: 'ko',
  transparentColor: { r: 255, g: 255, b: 255 },
  maxUndo: 20,
  zoomStep: 10,
  autoSave: {
    enabled: true,
    intervalMinutes: 5,
    gitCommit: true,
    gitAddAll: true,
  },
  netlify: {
    apiKey: '',
    siteId: '',
  },
};

function load(): EditorSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function save(settings: EditorSettings): void {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

let cached: EditorSettings = load();

const settingsManager = {
  get(): EditorSettings {
    return { ...cached };
  },

  update(partial: Partial<EditorSettings>): EditorSettings {
    cached = { ...cached, ...partial };
    save(cached);
    return { ...cached };
  },

  /** 설정된 Steam 경로 또는 자동 탐색 결과 반환 */
  getSteamPath(): string | null {
    if (cached.steamPath && fs.existsSync(cached.steamPath)) {
      return cached.steamPath;
    }
    // 자동 탐색
    const candidates = [
      path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/RPG Maker MV'),
      path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/RPG Maker MV/RPG Maker MV.app/Contents/MacOS'),
      path.join(os.homedir(), '.steam/steam/steamapps/common/RPG Maker MV'),
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\RPG Maker MV',
      'C:\\Program Files\\Steam\\steamapps\\common\\RPG Maker MV',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  },

  /** Steam RPG Maker MV 하위의 Generator 경로 반환 */
  getGeneratorPath(): string | null {
    const steamPath = this.getSteamPath();
    if (!steamPath) return null;
    // Generator 폴더 찾기
    const candidates = [
      path.join(steamPath, 'Generator'),
      path.join(steamPath, 'RPG Maker MV.app/Contents/MacOS/Generator'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, 'gradients.png'))) {
        return p;
      }
    }
    // steamPath 자체가 Generator를 직접 포함하는 경우
    if (fs.existsSync(path.join(steamPath, 'gradients.png'))) {
      return steamPath;
    }
    return null;
  },
};

export default settingsManager;
