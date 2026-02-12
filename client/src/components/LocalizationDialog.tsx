import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';
import type { L10nConfig, CSVRow, Category, StatsData, UndoEntry, FilterMode } from './localizationTypes';
import { LANGUAGE_NAMES, getCsvPath, formatTs, getStatus } from './localizationTypes';
import './LocalizationDialog.css';

function HelpButton({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={ref}
        className="l10n-help-btn"
        onClick={() => setShow(!show)}
        onBlur={() => setShow(false)}
      >?</button>
      {show && (
        <div className="l10n-help-tooltip">
          {text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </span>
  );
}

export default function LocalizationDialog() {
  const { t } = useTranslation();
  const setShowLocalizationDialog = useEditorStore((s) => s.setShowLocalizationDialog);
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

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  // Init form state
  const [initSource, setInitSource] = useState('ko');
  const [initLangs, setInitLangs] = useState<string[]>(['en']);
  const [newLang, setNewLang] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await apiClient.get<L10nConfig>('/localization/config');
      if (cfg && cfg.sourceLanguage) {
        setConfig(cfg);
        return cfg;
      }
      setConfig(null);
      return null;
    } catch {
      setConfig(null);
      return null;
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await apiClient.get<Category[]>('/localization/categories');
      setCategories(cats);
    } catch {
      setCategories([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await apiClient.get<StatsData>('/localization/stats');
      setStats(s);
    } catch {
      setStats(null);
    }
  }, []);

  const loadCSV = useCallback(async (categoryId: string) => {
    try {
      const csvPath = getCsvPath(categoryId);
      const data = await apiClient.get<CSVRow[]>(`/localization/csv/${csvPath}`);
      setRows(data);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const cfg = await loadConfig();
      if (cfg) {
        await Promise.all([loadCategories(), loadStats()]);
      }
      setLoading(false);
    })();
  }, [loadConfig, loadCategories, loadStats]);

  useEffect(() => {
    if (selectedCategory) loadCSV(selectedCategory);
    setSelectedKeys(new Set());
  }, [selectedCategory, loadCSV]);

  const handleInit = async () => {
    const allLangs = [initSource, ...initLangs.filter(l => l !== initSource)];
    await apiClient.post('/localization/init', { sourceLanguage: initSource, languages: allLangs });
    showToast(t('localization.initComplete'));
    const cfg = await loadConfig();
    if (cfg) {
      await Promise.all([loadCategories(), loadStats()]);
    }
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
    } finally {
      setSyncing(false);
    }
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
    await apiClient.put('/localization/entry', {
      csvPath, key: editCell.key, lang: editCell.lang, text: editValue,
    });
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
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
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
        updatedRows[rowIdx] = {
          ...updatedRows[rowIdx],
          [lang]: srcVal,
          [lang + '_ts']: newTs,
        };
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllKeys = () => {
    if (selectedKeys.size === filteredRows.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredRows.map(r => r.key)));
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditCell(null);
    }
  };

  const targetLangs = config ? config.languages.filter(l => l !== config.sourceLanguage) : [];

  const filteredRows = rows.filter(row => {
    const isDeleted = row.deleted === '1';
    if (filter === 'deleted') return isDeleted;
    if (isDeleted) return false;
    if (filter === 'untranslated') {
      return targetLangs.some(l => getStatus(row, l) === 'untranslated');
    }
    if (filter === 'outdated') {
      return targetLangs.some(l => getStatus(row, l) === 'outdated');
    }
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

  // Group categories by type
  const groupedCats = {
    database: categories.filter(c => c.type === 'database'),
    terms: categories.filter(c => c.type === 'terms'),
    common_events: categories.filter(c => c.type === 'common_events'),
    maps: categories.filter(c => c.type === 'maps'),
  };

  const getProgressBar = (catId: string) => {
    if (!stats || targetLangs.length === 0) return null;
    const catStats = stats.categories.find(c => c.id === catId);
    if (!catStats) return null;
    if (catStats.total === 0) return 100;
    let upToDate = 0;
    for (const lang of targetLangs) {
      upToDate += (catStats.translated[lang] || 0) - (catStats.outdated[lang] || 0);
    }
    const pct = Math.round((upToDate / (catStats.total * targetLangs.length)) * 100);
    return pct;
  };

  const getTotalProgress = () => {
    if (!stats || targetLangs.length === 0 || stats.total.total === 0) return 0;
    let upToDate = 0;
    for (const lang of targetLangs) {
      upToDate += (stats.total.translated[lang] || 0) - (stats.total.outdated[lang] || 0);
    }
    return Math.round((upToDate / (stats.total.total * targetLangs.length)) * 100);
  };

  if (loading) {
    return (
      <div className="db-dialog-overlay">
        <div className="db-dialog l10n-dialog">
          <div className="db-dialog-header">
            <span>{t('localization.title')}</span>
            <button className="db-dialog-close" onClick={() => setShowLocalizationDialog(false)}>×</button>
          </div>
          <div className="db-dialog-body" style={{ padding: 20 }}>{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  // Init panel
  if (!config) {
    return (
      <div className="db-dialog-overlay">
        <div className="db-dialog l10n-dialog l10n-init-dialog">
          <div className="db-dialog-header">
            <span>{t('localization.title')}</span>
            <button className="db-dialog-close" onClick={() => setShowLocalizationDialog(false)}>×</button>
          </div>
          <div className="db-dialog-body l10n-init-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <p style={{ margin: 0, color: '#aaa' }}>{t('localization.initDescription')}</p>
              <HelpButton text={t('localization.helpInit' as any)} />
            </div>
            <div className="l10n-init-form">
              <label>
                {t('localization.sourceLanguage')}
                <select value={initSource} onChange={e => setInitSource(e.target.value)}>
                  {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </label>
              <div className="l10n-init-targets">
                <label>{t('localization.targetLanguages')}</label>
                <div className="l10n-lang-chips">
                  {initLangs.map(l => (
                    <span key={l} className="l10n-lang-chip">
                      {LANGUAGE_NAMES[l] || l}
                      <button onClick={() => setInitLangs(prev => prev.filter(x => x !== l))}>×</button>
                    </span>
                  ))}
                </div>
                <div className="l10n-add-lang">
                  <select value={newLang} onChange={e => setNewLang(e.target.value)}>
                    <option value="">--</option>
                    {Object.entries(LANGUAGE_NAMES)
                      .filter(([code]) => code !== initSource && !initLangs.includes(code))
                      .map(([code, name]) => (
                        <option key={code} value={code}>{name} ({code})</option>
                      ))}
                  </select>
                  <button className="db-btn" onClick={() => {
                    if (newLang && !initLangs.includes(newLang)) {
                      setInitLangs(prev => [...prev, newLang]);
                      setNewLang('');
                    }
                  }}>{t('localization.addLanguage')}</button>
                </div>
              </div>
              <button className="db-btn l10n-init-btn" onClick={handleInit} disabled={initLangs.length === 0}>
                {t('localization.init')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog l10n-dialog l10n-main-dialog">
        <div className="db-dialog-header">
          <span>{t('localization.title')}</span>
          <button className="db-dialog-close" onClick={() => setShowLocalizationDialog(false)}>×</button>
        </div>
        <div className="db-dialog-body l10n-main-body">
          {/* Left: category tree */}
          <div className="l10n-sidebar">
            {Object.entries(groupedCats).map(([groupType, cats]) => {
              if (cats.length === 0) return null;
              return (
                <div key={groupType} className="l10n-cat-group">
                  <div className="l10n-cat-group-label">
                    {t(`localization.category.${groupType}` as any)}
                  </div>
                  {cats.map(cat => {
                    const pct = getProgressBar(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className={`l10n-cat-item${selectedCategory === cat.id ? ' selected' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        <span className="l10n-cat-name">{cat.name}</span>
                        {pct !== null && <span className={`l10n-cat-pct${pct >= 100 ? ' complete' : ''}`}>{pct}%</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Right: toolbar + table */}
          <div className="l10n-content">
            <div className="l10n-toolbar">
              <button className="db-btn" onClick={handleSync} disabled={syncing}>
                {syncing ? '...' : t('localization.sync')}
              </button>
              <HelpButton text={t('localization.helpSync' as any)} />
              <button className="db-btn" onClick={handleOpenFolder}>
                {t('localization.openFolder' as any)}
              </button>
              <HelpButton text={t('localization.helpOpenFolder' as any)} />
              <button
                className="db-btn"
                onClick={handleCopySourceToTarget}
                disabled={selectedKeys.size === 0}
                title={t('localization.copySourceTooltip' as any)}
              >
                {t('localization.copySource' as any)}
                {selectedKeys.size > 0 && ` (${selectedKeys.size})`}
              </button>
              <label className="l10n-ts-toggle">
                <input type="checkbox" checked={showTs} onChange={e => setShowTs(e.target.checked)} />
                {t('localization.showTs' as any)}
              </label>
              <div className="l10n-filters">
                {(['all', 'untranslated', 'outdated', 'deleted'] as FilterMode[]).map(f => (
                  <button
                    key={f}
                    className={`db-btn l10n-filter-btn${filter === f ? ' active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {t(`localization.filter${f.charAt(0).toUpperCase() + f.slice(1)}` as any)}
                  </button>
                ))}
                <HelpButton text={t('localization.helpFilter' as any)} />
              </div>
              <input
                className="l10n-search"
                type="text"
                placeholder={t('localization.search')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
              <div className="l10n-progress-bar">
                {(() => {
                  const pct = getTotalProgress();
                  const isComplete = pct >= 100;
                  return <>
                    <span className={isComplete ? 'l10n-progress-complete' : ''}>{t('localization.progress')}: {pct}%</span>
                    <div className="l10n-progress-track">
                      <div className={`l10n-progress-fill${isComplete ? ' complete' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                  </>;
                })()}
                <HelpButton text={t('localization.helpEdit' as any)} />
              </div>
            </div>

            {!selectedCategory ? (
              <div className="l10n-placeholder">{t('localization.noData')}</div>
            ) : (
              <div className="l10n-table-wrapper">
                <table className="l10n-table">
                  <thead>
                    <tr>
                      <th className="l10n-col-check">
                        <input
                          type="checkbox"
                          checked={filteredRows.length > 0 && selectedKeys.size === filteredRows.length}
                          onChange={toggleAllKeys}
                        />
                      </th>
                      <th className="l10n-col-key">{t('localization.key')}</th>
                      {showTs && <th className="l10n-col-ts">ts</th>}
                      <th className="l10n-col-src">{LANGUAGE_NAMES[config.sourceLanguage] || config.sourceLanguage}</th>
                      {showTs && <th className="l10n-col-ts">{config.sourceLanguage}_ts</th>}
                      {targetLangs.map(lang => (
                        <React.Fragment key={lang}>
                          <th className="l10n-col-lang">{LANGUAGE_NAMES[lang] || lang}</th>
                          {showTs && <th className="l10n-col-ts">{lang}_ts</th>}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => (
                      <tr key={row.key} className={row.deleted === '1' ? 'l10n-row-deleted' : ''}>
                        <td className="l10n-col-check">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(row.key)}
                            onChange={() => toggleKey(row.key)}
                          />
                        </td>
                        <td className="l10n-col-key l10n-key-cell">{row.key}</td>
                        {showTs && <td className="l10n-col-ts">{formatTs(row.ts)}</td>}
                        <td className="l10n-col-src">{row[config.sourceLanguage]}</td>
                        {showTs && <td className="l10n-col-ts">{formatTs(row[config.sourceLanguage + '_ts'])}</td>}
                        {targetLangs.map(lang => {
                          const status = getStatus(row, lang);
                          const isEditing = editCell?.key === row.key && editCell?.lang === lang;
                          return (
                            <React.Fragment key={lang}>
                              <td
                                className={`l10n-col-lang l10n-cell-${status}`}
                                onClick={() => handleCellDoubleClick(row.key, lang, row[lang] || '')}
                              >
                                {isEditing ? (
                                  <textarea
                                    ref={editRef}
                                    className="l10n-edit-textarea"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={handleCellSave}
                                    onKeyDown={handleCellKeyDown}
                                  />
                                ) : (
                                  <span>{row[lang] || ''}</span>
                                )}
                                <span className={`l10n-status-dot l10n-dot-${status}`} />
                              </td>
                              {showTs && <td className="l10n-col-ts">{formatTs(row[lang + '_ts'])}</td>}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr><td colSpan={3 + targetLangs.length + (showTs ? 2 + targetLangs.length : 0)} className="l10n-empty">{t('localization.noData')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
