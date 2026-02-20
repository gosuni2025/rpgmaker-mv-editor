import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import './OptionsDialog.css';

interface AutoSaveSettings {
  enabled: boolean;
  intervalMinutes: number;
  gitCommit: boolean;
  gitAddAll: boolean;
}

interface SettingsResponse {
  steamPath: string;
  language: string;
  transparentColor: { r: number; g: number; b: number };
  maxUndo: number;
  zoomStep: number;
  detectedSteamPath: string | null;
  autoSave?: AutoSaveSettings;
}

interface GitStatusResponse {
  gitAvailable: boolean;
  isGitRepo: boolean;
}

type CategoryId = 'general' | 'appearance' | 'mapEditor' | 'autoSave' | 'paths';

interface CategoryDef {
  id: CategoryId;
  labelKey: string;
  searchLabels: string[];
}

export default function OptionsDialog() {
  const { t } = useTranslation();
  const transparentColor = useEditorStore((s) => s.transparentColor);
  const setTransparentColor = useEditorStore((s) => s.setTransparentColor);
  const maxUndo = useEditorStore((s) => s.maxUndo);
  const setMaxUndo = useEditorStore((s) => s.setMaxUndo);
  const zoomStep = useEditorStore((s) => s.zoomStep);
  const setZoomStep = useEditorStore((s) => s.setZoomStep);
  const setShowOptionsDialog = useEditorStore((s) => s.setShowOptionsDialog);
  useEscClose(useCallback(() => setShowOptionsDialog(false), [setShowOptionsDialog]));

  const [localColor, setLocalColor] = useState(transparentColor);
  const [localLang, setLocalLang] = useState(i18n.language);
  const [localMaxUndo, setLocalMaxUndo] = useState(maxUndo);
  const [localZoomStep, setLocalZoomStep] = useState(zoomStep);
  const [localSteamPath, setLocalSteamPath] = useState('');
  const [detectedSteamPath, setDetectedSteamPath] = useState<string | null>(null);
  const [localAutoSave, setLocalAutoSave] = useState<AutoSaveSettings>({
    enabled: true,
    intervalMinutes: 5,
    gitCommit: true,
    gitAddAll: true,
  });
  const [gitStatus, setGitStatus] = useState<GitStatusResponse>({ gitAvailable: false, isGitRepo: false });
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    apiClient.get<SettingsResponse>('/settings').then((data) => {
      setLocalSteamPath(data.steamPath || '');
      setDetectedSteamPath(data.detectedSteamPath);
      if (data.autoSave) {
        setLocalAutoSave(data.autoSave);
      }
    }).catch(() => {});
    apiClient.get<GitStatusResponse>('/project/git-status').then(setGitStatus).catch(() => {});
  }, []);

  const categories: CategoryDef[] = useMemo(() => [
    {
      id: 'general',
      labelKey: 'options.categories.general',
      searchLabels: [
        t('options.categories.general'),
        t('options.language'),
        t('options.undoHistory'),
        t('options.maxUndoCount'),
      ],
    },
    {
      id: 'appearance',
      labelKey: 'options.categories.appearance',
      searchLabels: [
        t('options.categories.appearance'),
        t('options.transparentColor'),
        t('options.red'),
        t('options.green'),
        t('options.blue'),
      ],
    },
    {
      id: 'mapEditor',
      labelKey: 'options.categories.mapEditor',
      searchLabels: [
        t('options.categories.mapEditor'),
        t('options.zoomStep'),
        t('options.zoomStepPercent'),
      ],
    },
    {
      id: 'autoSave',
      labelKey: 'options.categories.autoSave',
      searchLabels: [
        t('options.categories.autoSave'),
        t('options.autoSaveEnabled'),
        t('options.autoSaveInterval'),
        'Git',
      ],
    },
    {
      id: 'paths',
      labelKey: 'options.categories.paths',
      searchLabels: [
        t('options.categories.paths'),
        t('options.steamPath'),
        'Steam',
        'RPG Maker MV',
      ],
    },
  ], [t]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((cat) =>
      cat.searchLabels.some((label) => label.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  // 검색으로 인해 현재 활성 카테고리가 필터링되면 첫 번째 카테고리로 전환
  useEffect(() => {
    if (filteredCategories.length > 0 && !filteredCategories.find((c) => c.id === activeCategory)) {
      setActiveCategory(filteredCategories[0].id);
    }
  }, [filteredCategories, activeCategory]);

  const applySettings = async () => {
    setTransparentColor(localColor);
    setMaxUndo(localMaxUndo);
    setZoomStep(localZoomStep);
    if (localLang !== i18n.language) {
      i18n.changeLanguage(localLang);
    }
    try {
      const result = await apiClient.put<SettingsResponse>('/settings', {
        steamPath: localSteamPath,
        language: localLang,
        transparentColor: localColor,
        maxUndo: localMaxUndo,
        zoomStep: localZoomStep,
        autoSave: localAutoSave,
      });
      setDetectedSteamPath(result.detectedSteamPath);
      // Notify auto-save hook of settings change
      window.dispatchEvent(new Event('autosave-settings-changed'));
    } catch {}
  };

  const handleOK = async () => {
    await applySettings();
    setShowOptionsDialog(false);
  };

  const handleCancel = () => {
    setShowOptionsDialog(false);
  };

  const handleApply = () => {
    applySettings();
  };

  const checkerPreview = (color: { r: number; g: number; b: number }) => {
    const c1 = `rgb(${color.r}, ${color.g}, ${color.b})`;
    const c2 = `rgb(${Math.max(0, color.r - 48)}, ${Math.max(0, color.g - 48)}, ${Math.max(0, color.b - 48)})`;
    return {
      backgroundColor: c1,
      backgroundImage: `
        linear-gradient(45deg, ${c2} 25%, transparent 25%),
        linear-gradient(-45deg, ${c2} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${c2} 75%),
        linear-gradient(-45deg, transparent 75%, ${c2} 75%)
      `,
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      width: 80,
      height: 80,
      border: '1px solid #555',
      borderRadius: 3,
    };
  };

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'general':
        return (
          <>
            <div className="options-content-title">{t('options.categories.general')}</div>
            {/* Language */}
            <div className="db-form-section">{t('options.language')}</div>
            <div className="db-form" style={{ gap: 8 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <select
                  value={localLang}
                  onChange={(e) => { setLocalLang(e.target.value); i18n.changeLanguage(e.target.value); }}
                  style={{ width: 200 }}
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                </select>
              </label>
            </div>
            {/* Undo History */}
            <div className="db-form-section">{t('options.undoHistory')}</div>
            <div className="db-form" style={{ gap: 8 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span>{t('options.maxUndoCount')}</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={localMaxUndo}
                  onChange={(e) => setLocalMaxUndo(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                  style={{ width: 80 }}
                />
              </label>
            </div>
          </>
        );
      case 'appearance':
        return (
          <>
            <div className="options-content-title">{t('options.categories.appearance')}</div>
            {/* Transparent Color */}
            <div className="db-form-section">{t('options.transparentColor')}</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div className="db-form" style={{ flex: 1, gap: 8 }}>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 48 }}>{t('options.red')}</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={localColor.r}
                    onChange={(e) => setLocalColor({ ...localColor, r: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={localColor.r}
                    onChange={(e) => setLocalColor({ ...localColor, r: Math.min(255, Math.max(0, Number(e.target.value))) })}
                    style={{ width: 56 }}
                  />
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 48 }}>{t('options.green')}</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={localColor.g}
                    onChange={(e) => setLocalColor({ ...localColor, g: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={localColor.g}
                    onChange={(e) => setLocalColor({ ...localColor, g: Math.min(255, Math.max(0, Number(e.target.value))) })}
                    style={{ width: 56 }}
                  />
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 48 }}>{t('options.blue')}</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={localColor.b}
                    onChange={(e) => setLocalColor({ ...localColor, b: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={localColor.b}
                    onChange={(e) => setLocalColor({ ...localColor, b: Math.min(255, Math.max(0, Number(e.target.value))) })}
                    style={{ width: 56 }}
                  />
                </label>
              </div>
              <div style={checkerPreview(localColor)} />
            </div>
          </>
        );
      case 'mapEditor':
        return (
          <>
            <div className="options-content-title">{t('options.categories.mapEditor')}</div>
            {/* Zoom Step */}
            <div className="db-form-section">{t('options.zoomStep')}</div>
            <div className="db-form" style={{ gap: 8 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span>{t('options.zoomStepPercent')}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={localZoomStep}
                  onChange={(e) => setLocalZoomStep(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  style={{ width: 80 }}
                />
                <span>%</span>
              </label>
            </div>
          </>
        );
      case 'autoSave':
        return (
          <>
            <div className="options-content-title">{t('options.categories.autoSave')}</div>
            {/* Auto Save */}
            <div className="db-form-section">{t('options.autoSaveSection')}</div>
            <div className="db-form" style={{ gap: 8 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={localAutoSave.enabled}
                  onChange={(e) => setLocalAutoSave({ ...localAutoSave, enabled: e.target.checked })}
                />
                <span>{t('options.autoSaveEnabled')}</span>
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 24 }}>
                <span>{t('options.autoSaveInterval')}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={localAutoSave.intervalMinutes}
                  onChange={(e) => setLocalAutoSave({ ...localAutoSave, intervalMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                  style={{ width: 60 }}
                  disabled={!localAutoSave.enabled}
                />
                <span>{t('options.minutes')}</span>
              </label>
            </div>
            {/* Git */}
            <div className="db-form-section" style={{ marginTop: 16 }}>Git</div>
            {!gitStatus.gitAvailable ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: 8 }}>
                  {t('options.gitNotInstalled')}
                </div>
                <a
                  href="https://git-scm.com/downloads"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4ea1f3' }}
                >
                  {t('options.gitDownloadLink')}
                </a>
              </div>
            ) : (
              <div className="db-form" style={{ gap: 8 }}>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={localAutoSave.gitCommit}
                    onChange={(e) => setLocalAutoSave({ ...localAutoSave, gitCommit: e.target.checked })}
                    disabled={!localAutoSave.enabled}
                  />
                  <span>{t('options.gitAutoCommit')}</span>
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 24 }}>
                  <input
                    type="checkbox"
                    checked={localAutoSave.gitAddAll}
                    onChange={(e) => setLocalAutoSave({ ...localAutoSave, gitAddAll: e.target.checked })}
                    disabled={!localAutoSave.enabled || !localAutoSave.gitCommit}
                  />
                  <span>{t('options.gitAddAll')}</span>
                </label>
                {!gitStatus.isGitRepo && localAutoSave.gitCommit && (
                  <div style={{ color: '#f0ad4e', fontSize: 12, marginLeft: 24 }}>
                    {t('options.gitWillInit')}
                  </div>
                )}
              </div>
            )}
          </>
        );
      case 'paths':
        return (
          <>
            <div className="options-content-title">{t('options.categories.paths')}</div>
            {/* RPG Maker MV Steam Path */}
            <div className="db-form-section">{t('options.steamPath')}</div>
            <div className="db-form" style={{ gap: 8 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  value={localSteamPath}
                  onChange={(e) => setLocalSteamPath(e.target.value)}
                  placeholder={detectedSteamPath || t('options.steamPathPlaceholder')}
                  style={{ flex: 1 }}
                />
              </label>
              {detectedSteamPath && !localSteamPath && (
                <div style={{ color: '#8c8', fontSize: 12 }}>
                  {t('options.steamPathDetected')}: {detectedSteamPath}
                </div>
              )}
              {localSteamPath && (
                <div style={{ fontSize: 12 }}>
                  <button
                    className="db-btn"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setLocalSteamPath('')}
                  >
                    {t('options.steamPathClear')}
                  </button>
                </div>
              )}
              <div style={{ color: '#999', fontSize: 11 }}>
                {t('options.steamPathHelp')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  className="db-btn"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => apiClient.post('/settings/open-folder', {}).catch(() => {})}
                >
                  {t('options.steamOpenFolder')}
                </button>
                <button
                  className="db-btn"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => setLocalSteamPath('C:\\Program Files (x86)\\Steam\\steamapps\\common\\RPG Maker MV')}
                >
                  {t('options.steamFillWindows')}
                </button>
                <button
                  className="db-btn"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => setLocalSteamPath('~/Library/Application Support/Steam/steamapps/common/RPG Maker MV')}
                >
                  {t('options.steamFillMac')}
                </button>
                <button
                  className="db-btn"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => setLocalSteamPath('~/.steam/steam/steamapps/common/RPG Maker MV')}
                >
                  {t('options.steamFillLinux')}
                </button>
                <button
                  className="db-btn"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => window.open('/api/settings', '_blank')}
                >
                  {t('options.steamOpenSettings')}
                </button>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 700, height: 500 }}>
        <div className="db-dialog-header">{t('options.title')}</div>
        <div className="db-dialog-body" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="options-layout">
            {/* Left sidebar */}
            <div className="options-sidebar">
              <div className="options-search">
                <input
                  type="text"
                  placeholder={t('options.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="options-category-list">
                {filteredCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`options-category-item${activeCategory === cat.id ? ' active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {t(cat.labelKey)}
                  </div>
                ))}
              </div>
            </div>
            {/* Right content */}
            <div className="options-content">
              {renderCategoryContent()}
            </div>
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOK}>{t('common.ok')}</button>
          <button className="db-btn" onClick={handleCancel}>{t('common.cancel')}</button>
          <button className="db-btn" onClick={handleApply}>{t('common.apply')}</button>
        </div>
      </div>
    </div>
  );
}
