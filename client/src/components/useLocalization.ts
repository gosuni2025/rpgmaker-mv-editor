import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';
import type { L10nConfig, CSVRow, Category, StatsData, UndoEntry, FilterMode } from './localizationTypes';
import { getCsvPath, getStatus } from './localizationTypes';

export function useLocalization() {
  const { t } = useTranslation();
  const showToast = useEditorStore((s) => s.showToast);

  const [config, setConfig] = useState<L10nConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [searchText, setSearchText] = useState('');
  const [editCell, setEditCell] = useState<{ key: string; lang: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showTs, setShowTs] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const editRef = useRef<HTMLTextAreaElement>(null);

  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const [initSource, setInitSource] = useState('ko');
  const [initLangs, setInitLangs] = useState<string[]>(['en']);
  const [newLang, setNewLang] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await apiClient.get<L10nConfig>('/localization/config');
      if (cfg && cfg.sourceLanguage) { setConfig(cfg); return cfg; }
      setConfig(null); return null;
    } catch { setConfig(null); return null; }
  }, []);

  const loadCategories = useCallback(async () => {
    try { setCategories(await apiClient.get<Category[]>('/localization/categories')); }
    catch { setCategories([]); }
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await apiClient.get<StatsData>('/localization/stats')); }
    catch { setStats(null); }
  }, []);

  const loadCSV = useCallback(async (categoryId: string) => {
    try { setRows(await apiClient.get<CSVRow[]>(`/localization/csv/${getCsvPath(categoryId)}`)); }
    catch { setRows([]); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const cfg = await loadConfig();
      if (cfg) await Promise.all([loadCategories(), loadStats()]);
      setLoading(false);
    })();
  }, [loadConfig, loadCategories, loadStats]);

  useEffect(() => {
    if (selectedCategory) loadCSV(selectedCategory);
    setSelectedKeys(new Set());
  }, [selectedCategory, loadCSV]);

  const targetLangs = config ? config.languages.filter(l => l !== config.sourceLanguage) : [];

  const handleInit = async () => {
    const allLangs = [initSource, ...initLangs.filter(l => l !== initSource)];
    await apiClient.post('/localization/init', { sourceLanguage: initSource, languages: allLangs });
    showToast(t('localization.initComplete'));
    const cfg = await loadConfig();
    if (cfg) await Promise.all([loadCategories(), loadStats()]);
  };

  const handleOpenFolder = async () => {
    await apiClient.post('/localization/open-folder', {});
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post<{ diff?: { added: string[]; modified: string[]; deleted: string[] } }>('/localization/sync', {});
      let msg = t('localization.syncComplete');
      if (res.diff && (res.diff.added.length || res.diff.modified.length || res.diff.deleted.length)) {
        const parts: string[] = [];
        if (res.diff.added.length) parts.push(`추가 ${res.diff.added.length}`);
        if (res.diff.modified.length) parts.push(`변경 ${res.diff.modified.length}`);
        if (res.diff.deleted.length) parts.push(`삭제 ${res.diff.deleted.length}`);
        msg += ` (${parts.join(', ')})`;
      }
      showToast(msg);
      await Promise.all([loadCategories(), loadStats()]);
      if (selectedCategory) await loadCSV(selectedCategory);
    } finally { setSyncing(false); }
  };

  const handleCellDoubleClick = (key: string, lang: string, value: string) => {
    setEditCell({ key, lang });
    setEditValue(value);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const handleCellSave = async () => {
    if (!editCell || !selectedCategory) return;
    const csvPath = getCsvPath(selectedCategory);
    const oldRow = rows.find(r => r.key === editCell.key);
    const oldText = oldRow ? (oldRow[editCell.lang] || '') : '';
    const oldTs = oldRow ? (oldRow[editCell.lang + '_ts'] || '0') : '0';
    if (oldText === editValue) { setEditCell(null); return; }
    await apiClient.put('/localization/entry', { csvPath, key: editCell.key, lang: editCell.lang, text: editValue });
    const newTs = String(Math.floor(Date.now() / 1000));
    setUndoStack(prev => [...prev, { csvPath, key: editCell.key, lang: editCell.lang, oldText, newText: editValue, oldTs, newTs }]);
    setRedoStack([]);
    setRows(prev => prev.map(r =>
      r.key === editCell.key ? { ...r, [editCell.lang]: editValue, [editCell.lang + '_ts']: newTs } : r
    ));
    setEditCell(null);
    loadStats();
  };

  const applyUndoRedo = useCallback(async (entry: UndoEntry, text: string, ts: string) => {
    await apiClient.put('/localization/entry', { csvPath: entry.csvPath, key: entry.key, lang: entry.lang, text, ts });
    setRows(prev => prev.map(r =>
      r.key === entry.key ? { ...r, [entry.lang]: text, [entry.lang + '_ts']: ts } : r
    ));
    loadStats();
  }, [loadStats]);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, entry]);
    await applyUndoRedo(entry, entry.oldText, entry.oldTs);
  }, [undoStack, applyUndoRedo]);

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, entry]);
    await applyUndoRedo(entry, entry.newText, entry.newTs);
  }, [redoStack, applyUndoRedo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); e.stopPropagation(); handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); e.stopPropagation(); handleRedo();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleUndo, handleRedo]);

  const handleCopySourceToTarget = async () => {
    if (!config || !selectedCategory || selectedKeys.size === 0) return;
    const csvPath = getCsvPath(selectedCategory);
    const srcLang = config.sourceLanguage;
    const newUndoEntries: UndoEntry[] = [];
    const updatedRows = [...rows];
    for (const key of selectedKeys) {
      const rowIdx = updatedRows.findIndex(r => r.key === key);
      if (rowIdx === -1) continue;
      const row = updatedRows[rowIdx];
      const srcVal = row[srcLang] || '';
      if (!srcVal) continue;
      for (const lang of targetLangs) {
        const oldText = row[lang] || '';
        if (oldText === srcVal) continue;
        const oldTs = row[lang + '_ts'] || '0';
        const newTs = String(Math.floor(Date.now() / 1000));
        await apiClient.put('/localization/entry', { csvPath, key, lang, text: srcVal });
        newUndoEntries.push({ csvPath, key, lang, oldText, newText: srcVal, oldTs, newTs });
        updatedRows[rowIdx] = { ...updatedRows[rowIdx], [lang]: srcVal, [lang + '_ts']: newTs };
      }
    }
    if (newUndoEntries.length > 0) {
      setRows(updatedRows);
      setUndoStack(prev => [...prev, ...newUndoEntries]);
      setRedoStack([]);
      loadStats();
      showToast(t('localization.copySourceDone', { count: selectedKeys.size }));
    }
    setSelectedKeys(new Set());
  };

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const filteredRows = rows.filter(row => {
    const isDeleted = row.deleted === '1';
    if (filter === 'deleted') return isDeleted;
    if (isDeleted) return false;
    if (filter === 'untranslated') return targetLangs.some(l => getStatus(row, l) === 'untranslated');
    if (filter === 'outdated') return targetLangs.some(l => getStatus(row, l) === 'outdated');
    return true;
  }).filter(row => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    if (row.key.toLowerCase().includes(lower)) return true;
    for (const lang of config?.languages || []) {
      if (row[lang] && row[lang].toLowerCase().includes(lower)) return true;
    }
    return false;
  });

  const toggleAllKeys = () => {
    if (selectedKeys.size === filteredRows.length) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(filteredRows.map(r => r.key)));
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCellSave(); }
    else if (e.key === 'Escape') setEditCell(null);
  };

  const groupedCats = {
    database: categories.filter(c => c.type === 'database'),
    terms: categories.filter(c => c.type === 'terms'),
    common_events: categories.filter(c => c.type === 'common_events'),
    maps: categories.filter(c => c.type === 'maps'),
  };

  const getProgressBar = (catId: string): number | null => {
    if (!stats || targetLangs.length === 0) return null;
    const catStats = stats.categories.find(c => c.id === catId);
    if (!catStats) return null;
    if (catStats.total === 0) return 100;
    let upToDate = 0;
    for (const lang of targetLangs) upToDate += (catStats.translated[lang] || 0) - (catStats.outdated[lang] || 0);
    return Math.round((upToDate / (catStats.total * targetLangs.length)) * 100);
  };

  const getTotalProgress = (): number => {
    if (!stats || targetLangs.length === 0 || stats.total.total === 0) return 0;
    let upToDate = 0;
    for (const lang of targetLangs) upToDate += (stats.total.translated[lang] || 0) - (stats.total.outdated[lang] || 0);
    return Math.round((upToDate / (stats.total.total * targetLangs.length)) * 100);
  };

  const addInitLang = () => {
    if (newLang && !initLangs.includes(newLang)) {
      setInitLangs(prev => [...prev, newLang]);
      setNewLang('');
    }
  };

  const removeInitLang = (lang: string) => {
    setInitLangs(prev => prev.filter(x => x !== lang));
  };

  return {
    config, loading, syncing, selectedCategory, setSelectedCategory,
    filter, setFilter, searchText, setSearchText, showTs, setShowTs,
    editCell, editValue, setEditValue, editRef, selectedKeys,
    targetLangs, filteredRows, groupedCats,
    initSource, setInitSource, initLangs, newLang, setNewLang,
    handleInit, handleOpenFolder, handleSync,
    handleCellDoubleClick, handleCellSave, handleCellKeyDown,
    handleCopySourceToTarget, toggleKey, toggleAllKeys,
    getProgressBar, getTotalProgress,
    addInitLang, removeInitLang,
  };
}
