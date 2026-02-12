export interface L10nConfig {
  sourceLanguage: string;
  languages: string[];
  initialized?: boolean;
}

export interface CSVRow {
  [key: string]: string;
}

export interface Category {
  id: string;
  name: string;
  type: string;
}

export interface CategoryStats {
  id: string;
  name: string;
  total: number;
  translated: Record<string, number>;
  outdated: Record<string, number>;
}

export interface StatsData {
  categories: CategoryStats[];
  total: { total: number; translated: Record<string, number>; outdated: Record<string, number> };
}

export interface UndoEntry {
  csvPath: string;
  key: string;
  lang: string;
  oldText: string;
  newText: string;
  oldTs: string;
  newTs: string;
}

export type FilterMode = 'all' | 'untranslated' | 'outdated' | 'deleted';

export const LANGUAGE_NAMES: Record<string, string> = {
  ko: '한국어', en: 'English', ja: '日本語', zh: '中文', fr: 'Français',
  de: 'Deutsch', es: 'Español', pt: 'Português', ru: 'Русский', it: 'Italiano',
};

export function getCsvPath(categoryId: string): string {
  if (categoryId === 'terms') return 'terms.csv';
  if (categoryId === 'common_events') return 'common_events.csv';
  return categoryId + '.csv';
}

export function formatTs(ts: string | undefined): string {
  if (!ts || ts === '0') return '-';
  const d = new Date(parseInt(ts, 10) * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getStatus(row: CSVRow, lang: string): 'translated' | 'outdated' | 'untranslated' {
  const langTs = parseInt(row[lang + '_ts'] || '0', 10);
  const ts = parseInt(row.ts || '0', 10);
  if (!row[lang] || !row[lang].trim() || langTs === 0) return 'untranslated';
  if (ts > langTs) return 'outdated';
  return 'translated';
}
