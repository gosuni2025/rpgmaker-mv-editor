import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
<<<<<<< HEAD
import apiClient from '../api/client';
import type { L10nConfig, CSVRow, Category, StatsData, UndoEntry, FilterMode } from './localizationTypes';
import { LANGUAGE_NAMES, getCsvPath, formatTs, getStatus } from './localizationTypes';
=======
import { LANGUAGE_NAMES, formatTs, getStatus } from './localizationTypes';
import type { FilterMode } from './localizationTypes';
import HelpButton from './common/HelpButton';
import { useLocalization } from './useLocalization';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
import './LocalizationDialog.css';

export default function LocalizationDialog() {
  const { t } = useTranslation();
<<<<<<< HEAD
  const setShowLocalizationDialog = useEditorStore((s) => s.setShowLocalizationDialog);
  useEscClose(useCallback(() => setShowLocalizationDialog(false), [setShowLocalizationDialog]));
  const showToast = useEditorStore((s) => s.showToast);
=======
  const setShow = useEditorStore((s) => s.setShowLocalizationDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

  const lc = useLocalization();

  if (lc.loading) {
    return (
      <div className="db-dialog-overlay">
        <div className="db-dialog l10n-dialog">
          <div className="db-dialog-header">
            <span>{t('localization.title')}</span>
            <button className="db-dialog-close" onClick={() => setShow(false)}>×</button>
          </div>
          <div className="db-dialog-body" style={{ padding: 20 }}>{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (!lc.config) {
    return (
      <div className="db-dialog-overlay">
        <div className="db-dialog l10n-dialog l10n-init-dialog">
          <div className="db-dialog-header">
            <span>{t('localization.title')}</span>
            <button className="db-dialog-close" onClick={() => setShow(false)}>×</button>
          </div>
          <div className="db-dialog-body l10n-init-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <p style={{ margin: 0, color: '#aaa' }}>{t('localization.initDescription')}</p>
              <HelpButton text={t('localization.helpInit' as any)} />
            </div>
            <div className="l10n-init-form">
              <label>
                {t('localization.sourceLanguage')}
                <select value={lc.initSource} onChange={e => lc.setInitSource(e.target.value)}>
                  {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </label>
              <div className="l10n-init-targets">
                <label>{t('localization.targetLanguages')}</label>
                <div className="l10n-lang-chips">
                  {lc.initLangs.map(l => (
                    <span key={l} className="l10n-lang-chip">
                      {LANGUAGE_NAMES[l] || l}
                      <button onClick={() => lc.removeInitLang(l)}>×</button>
                    </span>
                  ))}
                </div>
                <div className="l10n-add-lang">
                  <select value={lc.newLang} onChange={e => lc.setNewLang(e.target.value)}>
                    <option value="">--</option>
                    {Object.entries(LANGUAGE_NAMES)
                      .filter(([code]) => code !== lc.initSource && !lc.initLangs.includes(code))
                      .map(([code, name]) => (
                        <option key={code} value={code}>{name} ({code})</option>
                      ))}
                  </select>
                  <button className="db-btn" onClick={lc.addInitLang}>{t('localization.addLanguage')}</button>
                </div>
              </div>
              <button className="db-btn l10n-init-btn" onClick={lc.handleInit} disabled={lc.initLangs.length === 0}>
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
          <button className="db-dialog-close" onClick={() => setShow(false)}>×</button>
        </div>
        <div className="db-dialog-body l10n-main-body">
          {/* Left: category tree */}
          <div className="l10n-sidebar">
            {Object.entries(lc.groupedCats).map(([groupType, cats]) => {
              if (cats.length === 0) return null;
              return (
                <div key={groupType} className="l10n-cat-group">
                  <div className="l10n-cat-group-label">
                    {t(`localization.category.${groupType}` as any)}
                  </div>
                  {cats.map(cat => {
                    const pct = lc.getProgressBar(cat.id);
                    return (
                      <div key={cat.id}
                        className={`l10n-cat-item${lc.selectedCategory === cat.id ? ' selected' : ''}`}
                        onClick={() => lc.setSelectedCategory(cat.id)}>
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
              <button className="db-btn" onClick={lc.handleSync} disabled={lc.syncing}>
                {lc.syncing ? '...' : t('localization.sync')}
              </button>
              <HelpButton text={t('localization.helpSync' as any)} />
              <button className="db-btn" onClick={lc.handleOpenFolder}>
                {t('localization.openFolder' as any)}
              </button>
              <HelpButton text={t('localization.helpOpenFolder' as any)} />
              <button className="db-btn" onClick={lc.handleCopySourceToTarget}
                disabled={lc.selectedKeys.size === 0} title={t('localization.copySourceTooltip' as any)}>
                {t('localization.copySource' as any)}
                {lc.selectedKeys.size > 0 && ` (${lc.selectedKeys.size})`}
              </button>
              <label className="l10n-ts-toggle">
                <input type="checkbox" checked={lc.showTs} onChange={e => lc.setShowTs(e.target.checked)} />
                {t('localization.showTs' as any)}
              </label>
              <div className="l10n-filters">
                {(['all', 'untranslated', 'outdated', 'deleted'] as FilterMode[]).map(f => (
                  <button key={f}
                    className={`db-btn l10n-filter-btn${lc.filter === f ? ' active' : ''}`}
                    onClick={() => lc.setFilter(f)}>
                    {t(`localization.filter${f.charAt(0).toUpperCase() + f.slice(1)}` as any)}
                  </button>
                ))}
                <HelpButton text={t('localization.helpFilter' as any)} />
              </div>
              <input className="l10n-search" type="text" placeholder={t('localization.search')}
                value={lc.searchText} onChange={e => lc.setSearchText(e.target.value)} />
              <div className="l10n-progress-bar">
                {(() => {
                  const pct = lc.getTotalProgress();
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

            {!lc.selectedCategory ? (
              <div className="l10n-placeholder">{t('localization.noData')}</div>
            ) : (
              <div className="l10n-table-wrapper">
                <table className="l10n-table">
                  <thead>
                    <tr>
                      <th className="l10n-col-check">
                        <input type="checkbox"
                          checked={lc.filteredRows.length > 0 && lc.selectedKeys.size === lc.filteredRows.length}
                          onChange={lc.toggleAllKeys} />
                      </th>
                      <th className="l10n-col-key">{t('localization.key')}</th>
                      {lc.showTs && <th className="l10n-col-ts">ts</th>}
                      <th className="l10n-col-src">{LANGUAGE_NAMES[lc.config.sourceLanguage] || lc.config.sourceLanguage}</th>
                      {lc.showTs && <th className="l10n-col-ts">{lc.config.sourceLanguage}_ts</th>}
                      {lc.targetLangs.map(lang => (
                        <React.Fragment key={lang}>
                          <th className="l10n-col-lang">{LANGUAGE_NAMES[lang] || lang}</th>
                          {lc.showTs && <th className="l10n-col-ts">{lang}_ts</th>}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lc.filteredRows.map(row => (
                      <tr key={row.key} className={row.deleted === '1' ? 'l10n-row-deleted' : ''}>
                        <td className="l10n-col-check">
                          <input type="checkbox" checked={lc.selectedKeys.has(row.key)}
                            onChange={() => lc.toggleKey(row.key)} />
                        </td>
                        <td className="l10n-col-key l10n-key-cell">{row.key}</td>
                        {lc.showTs && <td className="l10n-col-ts">{formatTs(row.ts)}</td>}
                        <td className="l10n-col-src">{row[lc.config.sourceLanguage]}</td>
                        {lc.showTs && <td className="l10n-col-ts">{formatTs(row[lc.config.sourceLanguage + '_ts'])}</td>}
                        {lc.targetLangs.map(lang => {
                          const status = getStatus(row, lang);
                          const isEditing = lc.editCell?.key === row.key && lc.editCell?.lang === lang;
                          return (
                            <React.Fragment key={lang}>
                              <td className={`l10n-col-lang l10n-cell-${status}`}
                                onClick={() => lc.handleCellDoubleClick(row.key, lang, row[lang] || '')}>
                                {isEditing ? (
                                  <textarea ref={lc.editRef} className="l10n-edit-textarea"
                                    value={lc.editValue} onChange={e => lc.setEditValue(e.target.value)}
                                    onBlur={lc.handleCellSave} onKeyDown={lc.handleCellKeyDown} />
                                ) : (
                                  <span>{row[lang] || ''}</span>
                                )}
                                <span className={`l10n-status-dot l10n-dot-${status}`} />
                              </td>
                              {lc.showTs && <td className="l10n-col-ts">{formatTs(row[lang + '_ts'])}</td>}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    {lc.filteredRows.length === 0 && (
                      <tr><td colSpan={3 + lc.targetLangs.length + (lc.showTs ? 2 + lc.targetLangs.length : 0)} className="l10n-empty">
                        {t('localization.noData')}
                      </td></tr>
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
