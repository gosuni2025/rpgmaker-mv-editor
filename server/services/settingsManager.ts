import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface AutoSaveSettings {
  enabled: boolean;
  intervalMinutes: number;
  gitCommit: boolean;
  gitAddAll: boolean;
}

export interface NetlifySettings {
  apiKey: string;
  siteId: string;
  siteUrl: string;
}

export interface GhPagesSettings {
  remote: string; // 푸시할 git remote 이름 (예: 'pages')
}

export interface AutoSaveSettings {
  enabled: boolean;
  intervalMinutes: number;
  gitCommit: boolean;
  gitAddAll: boolean;
}

export interface EditorSettings {
  steamPath: string;
  language: string;
  transparentColor: { r: number; g: number; b: number };
  maxUndo: number;
  zoomStep: number;
  autoSave: AutoSaveSettings;
<<<<<<< HEAD
=======
  netlify: NetlifySettings;
  ghPages: GhPagesSettings;
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
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
<<<<<<< HEAD
=======
  netlify: {
    apiKey: '',
    siteId: '',
    siteUrl: '',
  },
  ghPages: {
    remote: 'pages',
  },
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
};

// ─── API Key 암호화 (AES-256-CBC, 이 PC에서만 복호화 가능) ───────────────────
const CIPHER_ALGO = 'aes-256-cbc';
const ENC_PREFIX = 'enc1:'; // 버전 prefix, 추후 마이그레이션 대비

/** 머신 고유 정보로부터 256-bit 암호화 키 생성 */
function getEncKey(): Buffer {
  const machineId = [os.hostname(), process.platform, os.homedir()].join('|');
  return crypto.createHash('sha256').update('rpgmv-editor:' + machineId).digest();
}

function encrypt(plain: string): string {
  if (!plain) return plain;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(CIPHER_ALGO, getEncKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ENC_PREFIX + iv.toString('hex') + ':' + enc.toString('base64');
  } catch {
    return plain; // 암호화 실패 시 평문 유지 (fallback)
  }
}

function decrypt(stored: string): string {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored; // 기존 평문 호환
  try {
    const rest = stored.slice(ENC_PREFIX.length);
    const colonIdx = rest.indexOf(':');
    if (colonIdx < 0) return '';
    const iv = Buffer.from(rest.slice(0, colonIdx), 'hex');
    const enc = Buffer.from(rest.slice(colonIdx + 1), 'base64');
    const decipher = crypto.createDecipheriv(CIPHER_ALGO, getEncKey(), iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return ''; // 복호화 실패 (다른 PC 등) → 빈 값 반환
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function load(): EditorSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<EditorSettings>;
      // apiKey 복호화 (메모리에는 항상 평문 유지)
      if (parsed.netlify?.apiKey) {
        parsed.netlify = { ...parsed.netlify, apiKey: decrypt(parsed.netlify.apiKey) };
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function save(settings: EditorSettings): void {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
  // apiKey는 암호화해서 저장 (디스크에는 암호화된 값만)
  const toSave: EditorSettings = { ...settings };
  if (toSave.netlify?.apiKey) {
    toSave.netlify = { ...toSave.netlify, apiKey: encrypt(toSave.netlify.apiKey) };
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toSave, null, 2), 'utf8');
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
    const candidates = [
      path.join(steamPath, 'Generator'),
      path.join(steamPath, 'RPG Maker MV.app/Contents/MacOS/Generator'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, 'gradients.png'))) {
        return p;
      }
    }
    if (fs.existsSync(path.join(steamPath, 'gradients.png'))) {
      return steamPath;
    }
    return null;
  },
};

export default settingsManager;
