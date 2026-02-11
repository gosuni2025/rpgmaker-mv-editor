import fs from 'fs';
import path from 'path';
import projectManager from './projectManager';
import { parseCSV, stringifyCSV, CSVRow } from './csvUtils';

export interface L10nConfig {
  sourceLanguage: string;
  languages: string[];
}

interface EventCommand {
  code: number;
  indent: number;
  parameters: unknown[];
}

// Text command codes that should be localized
const TEXT_CODES = new Set([101, 401, 102, 105, 405, 321, 325]);

export interface L10nSyncDiff {
  added: string[];    // new keys
  modified: string[]; // source text changed keys
  deleted: string[];  // newly deleted keys
}

export function getLanguagesDir(): string {
  return path.join(projectManager.currentPath!, 'languages');
}

function getConfigPath(): string {
  return path.join(getLanguagesDir(), 'config.json');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getConfig(): L10nConfig | null {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function saveConfig(config: L10nConfig): void {
  ensureDir(getLanguagesDir());
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
}

export function readCSVFile(relativePath: string): CSVRow[] {
  const p = path.join(getLanguagesDir(), relativePath);
  if (!fs.existsSync(p)) return [];
  return parseCSV(fs.readFileSync(p, 'utf8'));
}

export function writeCSVFile(relativePath: string, rows: CSVRow[], config: L10nConfig): void {
  const p = path.join(getLanguagesDir(), relativePath);
  ensureDir(path.dirname(p));
  const headers = buildHeaders(config);
  fs.writeFileSync(p, stringifyCSV(rows, headers), 'utf8');
}

function buildHeaders(config: L10nConfig): string[] {
  const headers = ['key', 'ts', 'deleted', config.sourceLanguage, config.sourceLanguage + '_ts'];
  for (const lang of config.languages) {
    if (lang !== config.sourceLanguage) {
      headers.push(lang, lang + '_ts');
    }
  }
  return headers;
}

// --- Key extraction ---

interface ExtractedEntry {
  key: string;
  text: string;
}

function extractTextFromCommands(commands: EventCommand[], prefix: string): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];
  let i = 0;
  while (i < commands.length) {
    const cmd = commands[i];
    if (cmd.code === 101) {
      // Show Text: 101 header, followed by 401 continuation lines
      const lines: string[] = [];
      let j = i + 1;
      while (j < commands.length && commands[j].code === 401) {
        lines.push(commands[j].parameters[0] as string);
        j++;
      }
      if (lines.length > 0) {
        entries.push({ key: `${prefix}.cmd${i}`, text: lines.join('\n') });
      }
      i = j;
    } else if (cmd.code === 102) {
      // Show Choices
      const choices = cmd.parameters[0] as string[];
      for (let c = 0; c < choices.length; c++) {
        entries.push({ key: `${prefix}.cmd${i}.ch${c}`, text: choices[c] });
      }
      i++;
    } else if (cmd.code === 105) {
      // Show Scrolling Text: 105 header, followed by 405 continuation lines
      const lines: string[] = [];
      let j = i + 1;
      while (j < commands.length && commands[j].code === 405) {
        lines.push(commands[j].parameters[0] as string);
        j++;
      }
      if (lines.length > 0) {
        entries.push({ key: `${prefix}.cmd${i}`, text: lines.join('\n') });
      }
      i = j;
    } else if (cmd.code === 321) {
      // Change Name
      if (cmd.parameters[1]) {
        entries.push({ key: `${prefix}.cmd${i}`, text: cmd.parameters[1] as string });
      }
      i++;
    } else if (cmd.code === 325) {
      // Change Nickname
      if (cmd.parameters[1]) {
        entries.push({ key: `${prefix}.cmd${i}`, text: cmd.parameters[1] as string });
      }
      i++;
    } else {
      i++;
    }
  }
  return entries;
}

export function extractMapKeys(mapId: number): ExtractedEntry[] {
  const filename = `Map${String(mapId).padStart(3, '0')}.json`;
  let mapData: any;
  try {
    mapData = projectManager.readJSON(filename);
  } catch {
    return [];
  }
  const events: any[] = mapData.events || [];
  const entries: ExtractedEntry[] = [];
  for (const ev of events) {
    if (!ev) continue;
    const pages: any[] = ev.pages || [];
    for (let p = 0; p < pages.length; p++) {
      const page = pages[p];
      const cmds: EventCommand[] = page.list || [];
      const prefix = `ev${ev.id}.page${p + 1}`;
      entries.push(...extractTextFromCommands(cmds, prefix));
    }
  }
  return entries;
}

export function extractCommonEventKeys(): ExtractedEntry[] {
  let data: any[];
  try {
    data = projectManager.readJSON('CommonEvents.json') as any[];
  } catch {
    return [];
  }
  const entries: ExtractedEntry[] = [];
  for (const ce of data) {
    if (!ce) continue;
    const cmds: EventCommand[] = ce.list || [];
    const prefix = `ce${ce.id}`;
    entries.push(...extractTextFromCommands(cmds, prefix));
  }
  return entries;
}

const DB_TYPES: Record<string, { file: string; fields: string[] }> = {
  actors: { file: 'Actors.json', fields: ['name', 'nickname', 'profile'] },
  classes: { file: 'Classes.json', fields: ['name'] },
  skills: { file: 'Skills.json', fields: ['name', 'description', 'message1', 'message2'] },
  items: { file: 'Items.json', fields: ['name', 'description'] },
  weapons: { file: 'Weapons.json', fields: ['name', 'description'] },
  armors: { file: 'Armors.json', fields: ['name', 'description'] },
  enemies: { file: 'Enemies.json', fields: ['name'] },
  states: { file: 'States.json', fields: ['name', 'message1', 'message2', 'message3', 'message4'] },
};

export function extractDBKeys(type: string): ExtractedEntry[] {
  const info = DB_TYPES[type];
  if (!info) return [];
  let data: any[];
  try {
    data = projectManager.readJSON(info.file) as any[];
  } catch {
    return [];
  }
  const entries: ExtractedEntry[] = [];
  for (const item of data) {
    if (!item) continue;
    for (const field of info.fields) {
      const val = item[field];
      if (val && typeof val === 'string' && val.trim()) {
        entries.push({ key: `${item.id}.${field}`, text: val });
      }
    }
  }
  return entries;
}

export function extractTermsKeys(): ExtractedEntry[] {
  let system: any;
  try {
    system = projectManager.readJSON('System.json');
  } catch {
    return [];
  }
  const terms = system.terms;
  if (!terms) return [];
  const entries: ExtractedEntry[] = [];

  // basic, commands, params: arrays
  for (const section of ['basic', 'commands', 'params']) {
    const arr = terms[section];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && typeof arr[i] === 'string' && arr[i].trim()) {
        entries.push({ key: `${section}.${i}`, text: arr[i] });
      }
    }
  }

  // messages: object
  const msgs = terms.messages;
  if (msgs && typeof msgs === 'object') {
    for (const [k, v] of Object.entries(msgs)) {
      if (v && typeof v === 'string' && (v as string).trim()) {
        entries.push({ key: `messages.${k}`, text: v as string });
      }
    }
  }
  return entries;
}

// --- Sync logic ---

function syncEntries(existing: CSVRow[], extracted: ExtractedEntry[], config: L10nConfig): { rows: CSVRow[]; diff: L10nSyncDiff } {
  const now = String(Math.floor(Date.now() / 1000));
  const existingMap = new Map<string, CSVRow>();
  for (const row of existing) {
    existingMap.set(row.key, row);
  }

  const diff: L10nSyncDiff = { added: [], modified: [], deleted: [] };
  const result: CSVRow[] = [];

  // Process extracted entries (new + existing)
  for (const entry of extracted) {
    const old = existingMap.get(entry.key);
    if (old) {
      const srcLang = config.sourceLanguage;
      // Un-delete if previously deleted
      if (old.deleted === '1') {
        old.deleted = '';
      }
      if (old[srcLang] !== entry.text) {
        // Source text changed — update ts
        old[srcLang] = entry.text;
        old.ts = now;
        old[srcLang + '_ts'] = now;
        diff.modified.push(entry.key);
      }
      result.push(old);
      existingMap.delete(entry.key);
    } else {
      // New entry
      const row: CSVRow = { key: entry.key, ts: now, deleted: '' };
      row[config.sourceLanguage] = entry.text;
      row[config.sourceLanguage + '_ts'] = now;
      for (const lang of config.languages) {
        if (lang !== config.sourceLanguage) {
          row[lang] = '';
          row[lang + '_ts'] = '0';
        }
      }
      result.push(row);
      diff.added.push(entry.key);
    }
  }

  // Mark remaining existing entries as deleted (keep translations)
  for (const [, row] of existingMap) {
    if (row.deleted !== '1') {
      row.deleted = '1';
      diff.deleted.push(row.key);
    }
    result.push(row);
  }

  return { rows: result, diff };
}

export function syncMapCSV(mapId: number): { count: number; diff: L10nSyncDiff } {
  const config = getConfig();
  if (!config) throw new Error('Localization not initialized');
  const csvPath = `maps/map${String(mapId).padStart(3, '0')}.csv`;
  const existing = readCSVFile(csvPath);
  const extracted = extractMapKeys(mapId);
  if (extracted.length === 0 && existing.length === 0) return { count: 0, diff: { added: [], modified: [], deleted: [] } };
  const { rows: synced, diff } = syncEntries(existing, extracted, config);
  writeCSVFile(csvPath, synced, config);
  return { count: synced.length, diff };
}

export function syncDBCSV(type: string): { count: number; diff: L10nSyncDiff } {
  const config = getConfig();
  if (!config) throw new Error('Localization not initialized');
  const csvPath = `database/${type}.csv`;
  const existing = readCSVFile(csvPath);
  const extracted = extractDBKeys(type);
  if (extracted.length === 0 && existing.length === 0) return { count: 0, diff: { added: [], modified: [], deleted: [] } };
  const { rows: synced, diff } = syncEntries(existing, extracted, config);
  writeCSVFile(csvPath, synced, config);
  return { count: synced.length, diff };
}

export function syncTermsCSV(): { count: number; diff: L10nSyncDiff } {
  const config = getConfig();
  if (!config) throw new Error('Localization not initialized');
  const csvPath = 'terms.csv';
  const existing = readCSVFile(csvPath);
  const extracted = extractTermsKeys();
  if (extracted.length === 0 && existing.length === 0) return { count: 0, diff: { added: [], modified: [], deleted: [] } };
  const { rows: synced, diff } = syncEntries(existing, extracted, config);
  writeCSVFile(csvPath, synced, config);
  return { count: synced.length, diff };
}

export function syncCommonEventsCSV(): { count: number; diff: L10nSyncDiff } {
  const config = getConfig();
  if (!config) throw new Error('Localization not initialized');
  const csvPath = 'common_events.csv';
  const existing = readCSVFile(csvPath);
  const extracted = extractCommonEventKeys();
  if (extracted.length === 0 && existing.length === 0) return { count: 0, diff: { added: [], modified: [], deleted: [] } };
  const { rows: synced, diff } = syncEntries(existing, extracted, config);
  writeCSVFile(csvPath, synced, config);
  return { count: synced.length, diff };
}

export function syncAll(): { maps: number; db: Record<string, number>; terms: number; commonEvents: number; diff: L10nSyncDiff } {
  const config = getConfig();
  if (!config) throw new Error('Localization not initialized');

  const totalDiff: L10nSyncDiff = { added: [], modified: [], deleted: [] };
  const mergeDiff = (d: L10nSyncDiff) => {
    totalDiff.added.push(...d.added);
    totalDiff.modified.push(...d.modified);
    totalDiff.deleted.push(...d.deleted);
  };

  // Sync all maps
  let mapInfos: any[];
  try {
    mapInfos = projectManager.readJSON('MapInfos.json') as any[];
  } catch {
    mapInfos = [];
  }
  let mapCount = 0;
  for (const info of mapInfos) {
    if (!info) continue;
    const { count, diff } = syncMapCSV(info.id);
    mapCount += count;
    mergeDiff(diff);
  }

  // Sync DB types
  const dbCounts: Record<string, number> = {};
  for (const type of Object.keys(DB_TYPES)) {
    const { count, diff } = syncDBCSV(type);
    dbCounts[type] = count;
    mergeDiff(diff);
  }

  // Sync terms
  const { count: termsCount, diff: termsDiff } = syncTermsCSV();
  mergeDiff(termsDiff);

  // Sync common events
  const { count: ceCount, diff: ceDiff } = syncCommonEventsCSV();
  mergeDiff(ceDiff);

  return { maps: mapCount, db: dbCounts, terms: termsCount, commonEvents: ceCount, diff: totalDiff };
}

// --- Stats ---

export interface L10nStats {
  categories: CategoryStats[];
  total: { total: number; translated: Record<string, number>; outdated: Record<string, number> };
}

export interface CategoryStats {
  id: string;
  name: string;
  total: number;
  translated: Record<string, number>;
  outdated: Record<string, number>;
}

function computeRowStats(rows: CSVRow[], config: L10nConfig): { total: number; translated: Record<string, number>; outdated: Record<string, number> } {
  const translated: Record<string, number> = {};
  const outdated: Record<string, number> = {};
  for (const lang of config.languages) {
    if (lang === config.sourceLanguage) continue;
    translated[lang] = 0;
    outdated[lang] = 0;
  }
  let activeCount = 0;
  for (const row of rows) {
    if (row.deleted === '1') continue;
    activeCount++;
    for (const lang of config.languages) {
      if (lang === config.sourceLanguage) continue;
      const langTs = parseInt(row[lang + '_ts'] || '0', 10);
      const ts = parseInt(row.ts || '0', 10);
      if (row[lang] && row[lang].trim() && langTs > 0) {
        translated[lang]++;
        if (ts > langTs) {
          outdated[lang]++;
        }
      }
    }
  }
  return { total: activeCount, translated, outdated };
}

export function getStats(): L10nStats {
  const config = getConfig();
  if (!config) throw new Error('Localization not initialized');

  const categories: CategoryStats[] = [];
  let totalEntries = 0;
  const totalTranslated: Record<string, number> = {};
  const totalOutdated: Record<string, number> = {};
  for (const lang of config.languages) {
    if (lang === config.sourceLanguage) continue;
    totalTranslated[lang] = 0;
    totalOutdated[lang] = 0;
  }

  // DB categories
  for (const type of Object.keys(DB_TYPES)) {
    const rows = readCSVFile(`database/${type}.csv`);
    const stats = computeRowStats(rows, config);
    categories.push({ id: `database/${type}`, name: type, ...stats });
    totalEntries += stats.total;
    for (const lang of Object.keys(stats.translated)) {
      totalTranslated[lang] += stats.translated[lang];
      totalOutdated[lang] += stats.outdated[lang];
    }
  }

  // Terms
  const termsRows = readCSVFile('terms.csv');
  const termsStats = computeRowStats(termsRows, config);
  categories.push({ id: 'terms', name: 'terms', ...termsStats });
  totalEntries += termsStats.total;
  for (const lang of Object.keys(termsStats.translated)) {
    totalTranslated[lang] += termsStats.translated[lang];
    totalOutdated[lang] += termsStats.outdated[lang];
  }

  // Common events
  const ceRows = readCSVFile('common_events.csv');
  const ceStats = computeRowStats(ceRows, config);
  categories.push({ id: 'common_events', name: 'common_events', ...ceStats });
  totalEntries += ceStats.total;
  for (const lang of Object.keys(ceStats.translated)) {
    totalTranslated[lang] += ceStats.translated[lang];
    totalOutdated[lang] += ceStats.outdated[lang];
  }

  // Maps
  const langDir = getLanguagesDir();
  const mapsDir = path.join(langDir, 'maps');
  if (fs.existsSync(mapsDir)) {
    const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.csv')).sort();
    for (const file of files) {
      const rows = readCSVFile(`maps/${file}`);
      const stats = computeRowStats(rows, config);
      const mapName = file.replace('.csv', '');
      categories.push({ id: `maps/${mapName}`, name: mapName, ...stats });
      totalEntries += stats.total;
      for (const lang of Object.keys(stats.translated)) {
        totalTranslated[lang] += stats.translated[lang];
        totalOutdated[lang] += stats.outdated[lang];
      }
    }
  }

  return {
    categories,
    total: { total: totalEntries, translated: totalTranslated, outdated: totalOutdated },
  };
}

// --- Categories list ---

export function getCategories(): { id: string; name: string; type: string }[] {
  const config = getConfig();
  if (!config) return [];
  const categories: { id: string; name: string; type: string }[] = [];

  // DB
  for (const type of Object.keys(DB_TYPES)) {
    categories.push({ id: `database/${type}`, name: type, type: 'database' });
  }

  // Terms
  categories.push({ id: 'terms', name: 'terms', type: 'terms' });

  // Common events
  categories.push({ id: 'common_events', name: 'common_events', type: 'common_events' });

  // Maps
  const langDir = getLanguagesDir();
  const mapsDir = path.join(langDir, 'maps');
  if (fs.existsSync(mapsDir)) {
    const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.csv')).sort();
    for (const file of files) {
      const name = file.replace('.csv', '');
      categories.push({ id: `maps/${name}`, name, type: 'maps' });
    }
  }

  return categories;
}

// --- Single entry update ---

export function updateEntry(csvPath: string, key: string, lang: string, text: string): void {
  const config = getConfig();
  if (!config) throw new Error('Localization not initialized');
  const rows = readCSVFile(csvPath);
  const row = rows.find(r => r.key === key);
  if (!row) throw new Error(`Key not found: ${key}`);
  const now = String(Math.floor(Date.now() / 1000));
  row[lang] = text;
  row[lang + '_ts'] = now;
  writeCSVFile(csvPath, rows, config);
}

// --- Init ---

export function initLocalization(sourceLanguage: string, languages: string[]): void {
  const config: L10nConfig = { sourceLanguage, languages };
  saveConfig(config);
  ensureDir(path.join(getLanguagesDir(), 'database'));
  ensureDir(path.join(getLanguagesDir(), 'maps'));
  syncAll();
}
