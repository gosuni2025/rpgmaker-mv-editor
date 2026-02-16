import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import './ProjectSettingsDialog.css';

interface PluginParamMeta {
  name: string;
  desc: string;
  type: string;
  default: string;
  options: string[];
  dir: string;
  min?: string;
  max?: string;
  parent?: string;
}

interface PluginMetadata {
  pluginname: string;
  plugindesc: string;
  author: string;
  help: string;
  params: PluginParamMeta[];
}

interface PluginEntry {
  name: string;
  status: boolean;
  description: string;
  parameters: Record<string, string>;
}

interface ProjectSettings {
  touchUI: boolean;
  screenWidth: number;
  screenHeight: number;
  fps: number;
}

type CategoryId = 'general' | 'screen' | string;

export default function ProjectSettingsDialog() {
  const { t } = useTranslation();
  const setShowProjectSettingsDialog = useEditorStore((s) => s.setShowProjectSettingsDialog);
  useEscClose(useCallback(() => setShowProjectSettingsDialog(false), [setShowProjectSettingsDialog]));

  const [settings, setSettings] = useState<ProjectSettings>({
    touchUI: true,
    screenWidth: 816,
    screenHeight: 624,
    fps: 60,
  });
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [metadata, setMetadata] = useState<Record<string, PluginMetadata>>({});
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load data
  useEffect(() => {
    Promise.all([
      apiClient.get<ProjectSettings>('/project-settings'),
      apiClient.get<{ files: string[]; list: PluginEntry[] }>('/plugins'),
      apiClient.get<Record<string, PluginMetadata>>(`/plugins/metadata?locale=${i18n.language || 'ko'}`),
    ]).then(([settingsData, pluginsData, metaData]) => {
      setSettings(settingsData);
      setPlugins(pluginsData.list);
      setMetadata(metaData);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const activePlugins = useMemo(() =>
    plugins.filter((p) => p.status),
    [plugins]
  );

  const allCategories = useMemo(() => {
    const cats: { id: CategoryId; label: string; isPlugin?: boolean }[] = [
      { id: 'general', label: t('projectSettings.categories.general') },
      { id: 'screen', label: t('projectSettings.categories.screen') },
    ];
    for (const plugin of activePlugins) {
      const meta = metadata[plugin.name];
      cats.push({
        id: `plugin:${plugin.name}`,
        label: meta?.pluginname || plugin.name,
        isPlugin: true,
      });
    }
    return cats;
  }, [activePlugins, metadata, t]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const q = searchQuery.toLowerCase();
    return allCategories.filter((cat) => cat.label.toLowerCase().includes(q));
  }, [allCategories, searchQuery]);

  useEffect(() => {
    if (filteredCategories.length > 0 && !filteredCategories.find((c) => c.id === activeCategory)) {
      setActiveCategory(filteredCategories[0].id);
    }
  }, [filteredCategories, activeCategory]);

  const updateSetting = <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updatePluginParam = (pluginName: string, paramName: string, value: string) => {
    setPlugins((prev) =>
      prev.map((p) =>
        p.name === pluginName
          ? { ...p, parameters: { ...p.parameters, [paramName]: value } }
          : p
      )
    );
  };

  const togglePluginStatus = (pluginName: string) => {
    setPlugins((prev) =>
      prev.map((p) =>
        p.name === pluginName ? { ...p, status: !p.status } : p
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiClient.put('/project-settings', settings),
        apiClient.put('/plugins', plugins),
      ]);
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleOK = async () => {
    await handleSave();
    setShowProjectSettingsDialog(false);
  };

  const handleCancel = () => {
    setShowProjectSettingsDialog(false);
  };

  const renderParamInput = (plugin: PluginEntry, paramMeta: PluginParamMeta) => {
    const value = plugin.parameters[paramMeta.name] ?? paramMeta.default;

    if (paramMeta.type === 'boolean') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value === 'true' || value === 'ON' || value === 'on'}
            onChange={(e) =>
              updatePluginParam(plugin.name, paramMeta.name, e.target.checked ? 'true' : 'false')
            }
          />
        </label>
      );
    }

    if (paramMeta.type === 'select' || paramMeta.type === 'combo' || paramMeta.options.length > 0) {
      return (
        <select
          value={value}
          onChange={(e) => updatePluginParam(plugin.name, paramMeta.name, e.target.value)}
        >
          {paramMeta.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
          {/* If current value is not in options, add it */}
          {value && !paramMeta.options.includes(value) && (
            <option value={value}>{value}</option>
          )}
        </select>
      );
    }

    if (paramMeta.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          min={paramMeta.min}
          max={paramMeta.max}
          onChange={(e) => updatePluginParam(plugin.name, paramMeta.name, e.target.value)}
        />
      );
    }

    // Default: text input
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => updatePluginParam(plugin.name, paramMeta.name, e.target.value)}
      />
    );
  };

  const renderContent = () => {
    if (!loaded) return <div style={{ color: '#888' }}>{t('common.loading')}</div>;

    if (activeCategory === 'general') {
      return (
        <>
          <div className="ps-content-title">{t('projectSettings.categories.general')}</div>
          <div className="ps-param-row">
            <span className="ps-param-label">{t('projectSettings.touchUI')}</span>
            <div className="ps-param-input">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.touchUI}
                  onChange={(e) => updateSetting('touchUI', e.target.checked)}
                />
              </label>
            </div>
          </div>
        </>
      );
    }

    if (activeCategory === 'screen') {
      return (
        <>
          <div className="ps-content-title">{t('projectSettings.categories.screen')}</div>
          <div className="ps-param-row">
            <span className="ps-param-label">{t('projectSettings.screenWidth')}</span>
            <div className="ps-param-input">
              <input
                type="number"
                value={settings.screenWidth}
                min={1}
                onChange={(e) => updateSetting('screenWidth', Number(e.target.value) || 816)}
                style={{ width: 100 }}
              />
            </div>
          </div>
          <div className="ps-param-row">
            <span className="ps-param-label">{t('projectSettings.screenHeight')}</span>
            <div className="ps-param-input">
              <input
                type="number"
                value={settings.screenHeight}
                min={1}
                onChange={(e) => updateSetting('screenHeight', Number(e.target.value) || 624)}
                style={{ width: 100 }}
              />
            </div>
          </div>
          <div className="ps-param-row">
            <span className="ps-param-label">{t('projectSettings.fps')}</span>
            <div className="ps-param-input">
              <input
                type="number"
                value={settings.fps}
                min={1}
                max={120}
                onChange={(e) => updateSetting('fps', Math.max(1, Math.min(120, Number(e.target.value) || 60)))}
                style={{ width: 100 }}
              />
            </div>
          </div>
        </>
      );
    }

    // Plugin category
    if (activeCategory.startsWith('plugin:')) {
      const pluginName = activeCategory.slice(7);
      const plugin = plugins.find((p) => p.name === pluginName);
      if (!plugin) return null;

      const meta = metadata[pluginName];
      const params = meta?.params ?? [];
      // For params without metadata, show raw key-value
      const paramNames = new Set(params.map((p) => p.name));
      const rawParams = Object.entries(plugin.parameters).filter(
        ([key]) => !paramNames.has(key)
      );

      return (
        <>
          <div className="ps-content-title">{meta?.pluginname || pluginName}</div>
          {meta?.plugindesc && (
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{meta.plugindesc}</div>
          )}

          <div className="ps-plugin-toggle">
            <label>
              <input
                type="checkbox"
                checked={plugin.status}
                onChange={() => togglePluginStatus(pluginName)}
              />
              {t('projectSettings.pluginEnabled')}
            </label>
          </div>

          {params.length === 0 && rawParams.length === 0 && (
            <div style={{ color: '#888', fontSize: 13 }}>{t('projectSettings.noParams')}</div>
          )}

          {params.map((paramMeta) => (
            <div key={paramMeta.name}>
              <div className="ps-param-row">
                <span className="ps-param-label" title={paramMeta.name}>{paramMeta.name}</span>
                <div className="ps-param-input">
                  {renderParamInput(plugin, paramMeta)}
                </div>
              </div>
              {paramMeta.desc && (
                <div className="ps-param-desc">{paramMeta.desc}</div>
              )}
            </div>
          ))}

          {rawParams.map(([key, val]) => (
            <div key={key} className="ps-param-row">
              <span className="ps-param-label" title={key}>{key}</span>
              <div className="ps-param-input">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => updatePluginParam(pluginName, key, e.target.value)}
                />
              </div>
            </div>
          ))}
        </>
      );
    }

    return null;
  };

  const builtinCategories = filteredCategories.filter((c) => !c.isPlugin);
  const pluginCategories = filteredCategories.filter((c) => c.isPlugin);

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 750, height: 550 }}>
        <div className="db-dialog-header">{t('projectSettings.title')}</div>
        <div className="db-dialog-body" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ps-layout">
            {/* Left sidebar */}
            <div className="ps-sidebar">
              <div className="ps-search">
                <input
                  type="text"
                  placeholder={t('options.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="ps-category-list">
                {builtinCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`ps-category-item${activeCategory === cat.id ? ' active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.label}
                  </div>
                ))}
                {pluginCategories.length > 0 && (
                  <>
                    <div className="ps-category-separator" />
                    <div className="ps-category-header">{t('projectSettings.pluginsSeparator')}</div>
                    {pluginCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className={`ps-category-item${activeCategory === cat.id ? ' active' : ''}`}
                        onClick={() => setActiveCategory(cat.id)}
                      >
                        {cat.label}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            {/* Right content */}
            <div className="ps-content">
              {renderContent()}
            </div>
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOK} disabled={saving}>
            {t('common.ok')}
          </button>
          <button className="db-btn" onClick={handleCancel}>{t('common.cancel')}</button>
          <button className="db-btn" onClick={handleSave} disabled={saving}>
            {t('common.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
