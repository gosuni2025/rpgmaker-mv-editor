import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import CreditTextEditor from './CreditTextEditor';
import './ProjectSettingsDialog.css';

interface PluginParam {
  name: string;
  value: string;
}

interface PluginEntry {
  name: string;
  status: boolean;
  description: string;
  parameters: PluginParam[];
}

interface ServerPluginEntry {
  name: string;
  status: boolean;
  description: string;
  parameters: Record<string, string>;
}

interface PluginsResponse {
  files: string[];
  list: ServerPluginEntry[];
}

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

interface ProjectSettings {
  touchUI: boolean;
  screenWidth: number;
  screenHeight: number;
  fps: number;
}

type CategoryId = 'general' | 'screen' | string;

export default function PluginManagerDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowPluginManagerDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));

  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [metadata, setMetadata] = useState<Record<string, PluginMetadata>>({});
  const [settings, setSettings] = useState<ProjectSettings>({
    touchUI: true, screenWidth: 816, screenHeight: 624, fps: 60,
  });
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const locale = i18n.language || 'ko';

  useEffect(() => {
    (async () => {
      try {
        const [res, meta, settingsData] = await Promise.all([
          apiClient.get<PluginsResponse>('/plugins'),
          apiClient.get<Record<string, PluginMetadata>>(`/plugins/metadata?locale=${locale}`),
          apiClient.get<ProjectSettings>('/project-settings'),
        ]);
        const entries: PluginEntry[] = (res.list || []).map((p: ServerPluginEntry) => ({
          name: p.name,
          status: p.status,
          description: p.description || '',
          parameters: Object.entries(p.parameters || {}).map(([k, v]) => ({ name: k, value: String(v) })),
        }));
        setPlugins(entries);
        setMetadata(meta);
        setSettings(settingsData);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [locale]);

  const pluginCategories = useMemo(() =>
    plugins.map((p, i) => ({
      id: `plugin:${i}`,
      pluginIndex: i,
      label: metadata[p.name]?.pluginname || p.name,
    })),
    [plugins, metadata]
  );

  const updateSetting = <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const toggleStatus = (index: number) => {
    const updated = [...plugins];
    updated[index] = { ...updated[index], status: !updated[index].status };
    setPlugins(updated);
    setDirty(true);
  };

  const updateParam = (pluginIndex: number, paramIndex: number, value: string) => {
    const updated = [...plugins];
    const params = [...updated[pluginIndex].parameters];
    params[paramIndex] = { ...params[paramIndex], value };
    updated[pluginIndex] = { ...updated[pluginIndex], parameters: params };
    setPlugins(updated);
    setDirty(true);
  };

  const movePlugin = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= plugins.length) return;
    const updated = [...plugins];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setPlugins(updated);
    setActiveCategory(`plugin:${newIndex}`);
    setDirty(true);
  };

  const removePlugin = (index: number) => {
    if (plugins.length === 0) return;
    const updated = plugins.filter((_, i) => i !== index);
    setPlugins(updated);
    if (updated.length > 0) {
      setActiveCategory(`plugin:${Math.min(index, updated.length - 1)}`);
    } else {
      setActiveCategory('general');
    }
    setDirty(true);
  };

  const handleOpenPluginFolder = async () => {
    try {
      await apiClient.post('/plugins/open-folder', {});
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const serverList = plugins.map(p => ({
        name: p.name,
        status: p.status,
        description: p.description,
        parameters: Object.fromEntries(p.parameters.map(pp => [pp.name, pp.value])),
      }));
      await Promise.all([
        apiClient.put('/plugins', serverList),
        apiClient.put('/project-settings', settings),
      ]);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const renderParamInput = (plugin: PluginEntry, pluginIndex: number, paramMeta: PluginParamMeta, paramIndex: number) => {
    const value = plugin.parameters[paramIndex]?.value ?? paramMeta.default;

    if (paramMeta.type === 'boolean') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value === 'true' || value === 'ON' || value === 'on'}
            onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.checked ? 'true' : 'false')}
          />
        </label>
      );
    }

    if (paramMeta.type === 'select' || paramMeta.type === 'combo' || paramMeta.options.length > 0) {
      return (
        <select
          value={value}
          onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
        >
          {paramMeta.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
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
          onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
      />
    );
  };

  const renderContent = () => {
    if (loading) return <div style={{ color: '#888' }}>{t('pluginManager.loading')}</div>;

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
              <input type="number" value={settings.screenWidth} min={1} style={{ width: 100 }}
                onChange={(e) => updateSetting('screenWidth', Number(e.target.value) || 816)} />
            </div>
          </div>
          <div className="ps-param-row">
            <span className="ps-param-label">{t('projectSettings.screenHeight')}</span>
            <div className="ps-param-input">
              <input type="number" value={settings.screenHeight} min={1} style={{ width: 100 }}
                onChange={(e) => updateSetting('screenHeight', Number(e.target.value) || 624)} />
            </div>
          </div>
          <div className="ps-param-row">
            <span className="ps-param-label">{t('projectSettings.fps')}</span>
            <div className="ps-param-input">
              <input type="number" value={settings.fps} min={1} max={120} style={{ width: 100 }}
                onChange={(e) => updateSetting('fps', Math.max(1, Math.min(120, Number(e.target.value) || 60)))} />
            </div>
          </div>
        </>
      );
    }

    // Plugin category
    if (activeCategory.startsWith('plugin:')) {
      const pluginIndex = parseInt(activeCategory.slice(7), 10);
      const plugin = plugins[pluginIndex];
      if (!plugin) return null;

      const meta = metadata[plugin.name];
      const params = meta?.params ?? [];

      return (
        <>
          <div className="ps-content-title">{meta?.pluginname || plugin.name}</div>
          {meta?.pluginname && (
            <div style={{ fontSize: 11, color: '#777', marginTop: -8 }}>{plugin.name}</div>
          )}
          {meta?.plugindesc && (
            <div style={{ fontSize: 12, color: '#999' }}>{meta.plugindesc}</div>
          )}

          <div className="ps-plugin-toggle">
            <label>
              <input type="checkbox" checked={plugin.status}
                onChange={() => toggleStatus(pluginIndex)} />
              {t('projectSettings.pluginEnabled')}
            </label>
            <div style={{ flex: 1 }} />
            <button className="db-btn-small" onClick={() => movePlugin(pluginIndex, -1)} title="위로">↑</button>
            <button className="db-btn-small" onClick={() => movePlugin(pluginIndex, 1)} title="아래로">↓</button>
            <button className="db-btn-small" onClick={() => removePlugin(pluginIndex)} title="삭제">✕</button>
          </div>

          {params.length === 0 && plugin.parameters.length === 0 && (
            <div style={{ color: '#888', fontSize: 13 }}>{t('projectSettings.noParams')}</div>
          )}

          {params.map((paramMeta, pi) => {
            const paramIndex = plugin.parameters.findIndex(p => p.name === paramMeta.name);
            if (paramIndex < 0) return null;
            return (
              <div key={paramMeta.name}>
                <div className="ps-param-row">
                  <span className="ps-param-label" title={paramMeta.name}>{paramMeta.name}</span>
                  <div className="ps-param-input">
                    {renderParamInput(plugin, pluginIndex, paramMeta, paramIndex)}
                  </div>
                </div>
                {paramMeta.desc && (
                  <div className="ps-param-desc">{paramMeta.desc}</div>
                )}
              </div>
            );
          })}

          {/* Raw params without metadata */}
          {plugin.parameters
            .filter(p => !params.some(pm => pm.name === p.name))
            .map(param => {
              const paramIndex = plugin.parameters.indexOf(param);
              return (
                <div key={param.name} className="ps-param-row">
                  <span className="ps-param-label" title={param.name}>{param.name}</span>
                  <div className="ps-param-input">
                    <input type="text" value={param.value}
                      onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)} />
                  </div>
                </div>
              );
            })
          }

          {plugin.name === 'TitleCredit' && <CreditTextEditor />}
        </>
      );
    }

    return null;
  };

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 750, height: 550 }}>
        <div className="db-dialog-header">{t('pluginManager.title')}</div>
        <div className="db-dialog-body" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ps-layout">
            {/* Left sidebar */}
            <div className="ps-sidebar">
              <div className="ps-category-list">
                <div className={`ps-category-item${activeCategory === 'general' ? ' active' : ''}`}
                  onClick={() => setActiveCategory('general')}>
                  {t('projectSettings.categories.general')}
                </div>
                <div className={`ps-category-item${activeCategory === 'screen' ? ' active' : ''}`}
                  onClick={() => setActiveCategory('screen')}>
                  {t('projectSettings.categories.screen')}
                </div>

                {pluginCategories.length > 0 && (
                  <>
                    <div className="ps-category-separator" />
                    <div className="ps-category-header">{t('projectSettings.pluginsSeparator')}</div>
                    {pluginCategories.map((cat) => {
                      const plugin = plugins[cat.pluginIndex];
                      return (
                        <div key={cat.id}
                          className={`ps-category-item${activeCategory === cat.id ? ' active' : ''}`}
                          onClick={() => setActiveCategory(cat.id)}
                          title={plugin?.name}>
                          <span style={{ color: plugin?.status ? '#6c6' : '#888', marginRight: 6, fontSize: 10 }}>
                            {plugin?.status ? 'ON' : 'OFF'}
                          </span>
                          {cat.label}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <div style={{ padding: 6, borderTop: '1px solid #555' }}>
                <button className="db-btn-small" onClick={handleOpenPluginFolder} style={{ width: '100%' }}>
                  플러그인 폴더 열기
                </button>
              </div>
            </div>

            {/* Right content */}
            <div className="ps-content">
              {renderContent()}
            </div>
          </div>
        </div>
        {error && <div style={{ padding: '4px 16px', color: '#e55', fontSize: 12 }}>{error}</div>}
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleSave} disabled={saving || !dirty}
            style={dirty ? { background: '#0078d4', borderColor: '#0078d4' } : {}}>
            {saving ? t('pluginManager.saving') : t('common.save')}
          </button>
          <button className="db-btn" onClick={() => setShow(false)}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
