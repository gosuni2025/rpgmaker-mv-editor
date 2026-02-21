import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import { GeneralPanel, AppearancePanel, MapEditorPanel, AutoSavePanel, PathsPanel } from './OptionsCategoryPanels';
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

  const projectPath = useEditorStore((s) => s.projectPath);
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
  const [localImagePrefetch, setLocalImagePrefetch] = useState(true);
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
    if (projectPath) {
      apiClient.get<{ imagePrefetchSubdirs?: boolean }>('/project-settings')
        .then(ps => setLocalImagePrefetch(ps.imagePrefetchSubdirs !== false))
        .catch(() => {});
    }
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
    if (projectPath) {
      apiClient.put('/project-settings', { imagePrefetchSubdirs: localImagePrefetch }).catch(() => {});
    }
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

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'general':
        return <GeneralPanel localLang={localLang} setLocalLang={setLocalLang} localMaxUndo={localMaxUndo} setLocalMaxUndo={setLocalMaxUndo} />;
      case 'appearance':
        return <AppearancePanel localColor={localColor} setLocalColor={setLocalColor} />;
      case 'mapEditor':
        return <MapEditorPanel localZoomStep={localZoomStep} setLocalZoomStep={setLocalZoomStep}
          localImagePrefetch={localImagePrefetch} setLocalImagePrefetch={setLocalImagePrefetch}
          hasProject={!!projectPath} />;
      case 'autoSave':
        return <AutoSavePanel localAutoSave={localAutoSave} setLocalAutoSave={setLocalAutoSave} gitStatus={gitStatus} />;
      case 'paths':
        return <PathsPanel localSteamPath={localSteamPath} setLocalSteamPath={setLocalSteamPath} detectedSteamPath={detectedSteamPath} />;
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
