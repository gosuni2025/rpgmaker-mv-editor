import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import CreditTextEditor from './CreditTextEditor';
import AnimationPickerDialog from './EventEditor/AnimationPickerDialog';
import { DataListPicker } from './EventEditor/dataListPicker';
import './ProjectSettingsDialog.css';
import {
  DB_TYPE_MAP,
  PluginParam, PluginEntry, ServerPluginEntry, PluginsResponse,
  PluginParamMeta, PluginMetadata, ProjectSettings, EditorPluginInfo,
  FilePickerDialog, DirPickerDialog, TextFilePickerDialog,
} from './PluginManagerHelpers';

export default function PluginManagerDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowPluginManagerDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));

  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, PluginMetadata>>({});
  const [editorPlugins, setEditorPlugins] = useState<EditorPluginInfo[]>([]);
  const [settings, setSettings] = useState<ProjectSettings>({
    touchUI: true, screenWidth: 816, screenHeight: 624, fps: 60,
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [editingParamIndex, setEditingParamIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const locale = i18n.language || 'ko';

  // Picker dialog states
  const [pickerType, setPickerType] = useState<'animation' | 'datalist' | 'file' | 'dir' | 'textfile' | null>(null);
  const [pickerParamIndex, setPickerParamIndex] = useState<number>(-1);
  const [dataListItems, setDataListItems] = useState<string[]>([]);
  const [dataListTitle, setDataListTitle] = useState('');
  const [browseDir, setBrowseDir] = useState('');
  const [browseFiles, setBrowseFiles] = useState<string[]>([]);
  const [browseDirs, setBrowseDirs] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [res, meta, settingsData, editorPluginsData] = await Promise.all([
          apiClient.get<PluginsResponse>('/plugins'),
          apiClient.get<Record<string, PluginMetadata>>(`/plugins/metadata?locale=${locale}`),
          apiClient.get<ProjectSettings>('/project-settings'),
          apiClient.get<EditorPluginInfo[]>('/plugins/editor-plugins'),
        ]);
        const entries: PluginEntry[] = (res.list || []).map((p: ServerPluginEntry) => {
          const existingParams = Object.entries(p.parameters || {}).map(([k, v]) => ({ name: k, value: String(v) }));
          const pluginMeta = meta[p.name];
          if (pluginMeta?.params) {
            const existingNames = new Set(existingParams.map(ep => ep.name));
            for (const pm of pluginMeta.params) {
              if (!existingNames.has(pm.name)) {
                existingParams.push({ name: pm.name, value: pm.default });
              }
            }
          }
          return {
            name: p.name,
            status: p.status,
            description: p.description || '',
            parameters: existingParams,
          };
        });
        setPlugins(entries);
        setAvailableFiles(res.files || []);
        setMetadata(meta);
        setEditorPlugins(editorPluginsData || []);
        setSettings(settingsData);
        if (entries.length > 0) setSelectedIndex(0);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [locale]);

  const selectedPlugin = selectedIndex >= 0 && selectedIndex < plugins.length ? plugins[selectedIndex] : null;
  const selectedMeta = selectedPlugin ? metadata[selectedPlugin.name] : null;

  const usedPluginNames = useMemo(() => new Set(plugins.map(p => p.name)), [plugins]);

  const editorPluginMap = useMemo(() => {
    const map = new Map<string, EditorPluginInfo>();
    for (const ep of editorPlugins) map.set(ep.name, ep);
    return map;
  }, [editorPlugins]);

  const updateSetting = <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const toggleStatus = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const changePluginName = (index: number, newName: string) => {
    const updated = [...plugins];
    const meta = metadata[newName];
    const params: PluginParam[] = meta?.params
      ? meta.params.map(pm => ({ name: pm.name, value: pm.default }))
      : [];
    updated[index] = { ...updated[index], name: newName, description: meta?.plugindesc || '', parameters: params };
    setPlugins(updated);
    setDirty(true);
  };

  const movePlugin = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const newIndex = selectedIndex + direction;
    if (newIndex < 0 || newIndex >= plugins.length) return;
    const updated = [...plugins];
    [updated[selectedIndex], updated[newIndex]] = [updated[newIndex], updated[selectedIndex]];
    setPlugins(updated);
    setSelectedIndex(newIndex);
    setDirty(true);
  };

  const addPlugin = () => {
    const updated = [...plugins, { name: '', status: true, description: '', parameters: [] }];
    setPlugins(updated);
    setSelectedIndex(updated.length - 1);
    setDirty(true);
  };

  const removePlugin = () => {
    if (selectedIndex < 0 || selectedIndex >= plugins.length) return;
    const updated = plugins.filter((_, i) => i !== selectedIndex);
    setPlugins(updated);
    if (updated.length > 0) {
      setSelectedIndex(Math.min(selectedIndex, updated.length - 1));
    } else {
      setSelectedIndex(-1);
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

  const handleUpgradePlugin = async (pluginName: string) => {
    try {
      await apiClient.post('/plugins/upgrade', { name: pluginName });
      // Refresh editor plugins info
      const updated = await apiClient.get<EditorPluginInfo[]>('/plugins/editor-plugins');
      setEditorPlugins(updated || []);
      // Also refresh metadata in case the plugin description changed
      const meta = await apiClient.get<Record<string, PluginMetadata>>(`/plugins/metadata?locale=${locale}`);
      setMetadata(meta);
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

  const openPicker = async (paramMeta: PluginParamMeta, paramIndex: number) => {
    const type = paramMeta.type.toLowerCase();

    if (type === 'animation') {
      setPickerParamIndex(paramIndex);
      setPickerType('animation');
      return;
    }

    if (type === 'file') {
      const dir = paramMeta.dir || 'img/';
      setBrowseDir(dir);
      try {
        const res = await apiClient.get<{ files: string[] }>(`/plugins/browse-files?dir=${encodeURIComponent(dir)}`);
        setBrowseFiles(res.files || []);
      } catch {
        setBrowseFiles([]);
      }
      setPickerParamIndex(paramIndex);
      setPickerType('file');
      return;
    }

    if (type === 'dir') {
      const dir = paramMeta.dir || 'img/';
      setBrowseDir(dir);
      try {
        const res = await apiClient.get<{ dirs: string[] }>(`/plugins/browse-dir?dir=${encodeURIComponent(dir)}`);
        setBrowseDirs(res.dirs || []);
      } catch {
        setBrowseDirs([]);
      }
      setPickerParamIndex(paramIndex);
      setPickerType('dir');
      return;
    }

    if (type === 'textfile') {
      const dir = paramMeta.dir || 'data';
      setBrowseDir(dir);
      try {
        const res = await apiClient.get<{ files: string[] }>(`/plugins/browse-files?dir=${encodeURIComponent(dir)}&ext=txt`);
        setBrowseFiles(res.files || []);
      } catch {
        setBrowseFiles([]);
      }
      setPickerParamIndex(paramIndex);
      setPickerType('textfile');
      return;
    }

    const dbConfig = DB_TYPE_MAP[type];
    if (dbConfig) {
      try {
        // switches and variables come from System.json
        if (type === 'switch' || type === 'variable') {
          const system = await apiClient.get<any>('/database/system');
          const list = type === 'switch' ? system.switches : system.variables;
          setDataListItems(list || []);
        } else {
          const data = await apiClient.get<(any | null)[]>(`/database/${dbConfig.endpoint}`);
          const names = data.map((item: any) => item?.name || '');
          setDataListItems(names);
        }
        setDataListTitle(dbConfig.title);
        setPickerParamIndex(paramIndex);
        setPickerType('datalist');
      } catch {
        // silently fail
      }
      return;
    }
  };

  /** Check if a param type should show a picker button */
  const hasPickerButton = (paramMeta: PluginParamMeta | undefined): boolean => {
    if (!paramMeta) return false;
    const type = paramMeta.type.toLowerCase();
    return type === 'animation' || type === 'file' || type === 'dir' || type === 'textfile' || type in DB_TYPE_MAP;
  };

  /** Parse a CSS color string to hex (#rrggbb) for <input type="color"> */
  const colorToHex = (color: string): string => {
    if (!color) return '#000000';
    const s = color.trim();
    // Already hex
    if (s.startsWith('#')) {
      const h = s.slice(1);
      if (h.length === 3) return '#' + h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      if (h.length >= 6) return '#' + h.slice(0, 6);
      return s;
    }
    // rgba(r,g,b,a) or rgb(r,g,b)
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      const r = Math.min(255, Number(m[1]));
      const g = Math.min(255, Number(m[2]));
      const b = Math.min(255, Number(m[3]));
      return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    }
    return '#000000';
  };

  /** Update hex portion of a color value, preserving rgba format if original was rgba */
  const updateColorHex = (original: string, newHex: string): string => {
    const r = parseInt(newHex.slice(1, 3), 16);
    const g = parseInt(newHex.slice(3, 5), 16);
    const b = parseInt(newHex.slice(5, 7), 16);
    // If original was rgba(), preserve alpha
    const rgbaMatch = original.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
    if (rgbaMatch) {
      return `rgba(${r}, ${g}, ${b}, ${rgbaMatch[1]})`;
    }
    // If original was rgb(), keep as rgb
    if (/^rgb\(/.test(original.trim())) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return newHex;
  };

  const renderParamInput = (plugin: PluginEntry, pluginIndex: number, paramMeta: PluginParamMeta | undefined, paramIndex: number) => {
    const param = plugin.parameters[paramIndex];
    if (!param) return null;
    const value = param.value;

    if (paramMeta?.type === 'color') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="color"
            value={colorToHex(value)}
            onChange={(e) => updateParam(pluginIndex, paramIndex, updateColorHex(value, e.target.value))}
            style={{ width: 28, height: 22, padding: 0, border: '1px solid #555', cursor: 'pointer', flexShrink: 0 }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
            onBlur={() => setEditingParamIndex(-1)}
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>
      );
    }

    if (paramMeta?.type === 'boolean') {
      return (
        <select
          value={value === 'true' || value === 'ON' || value === 'on' ? 'true' : 'false'}
          onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (paramMeta && (paramMeta.type === 'select' || paramMeta.type === 'combo' || paramMeta.options.length > 0)) {
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

    if (paramMeta?.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          min={paramMeta.min}
          max={paramMeta.max}
          onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
          onBlur={() => setEditingParamIndex(-1)}
          autoFocus
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
        onBlur={() => setEditingParamIndex(-1)}
        autoFocus
      />
    );
  };

  // Build ordered param list: metadata params first, then raw params
  const getOrderedParams = (plugin: PluginEntry) => {
    const meta = metadata[plugin.name];
    const metaParams = meta?.params ?? [];
    const result: { paramIndex: number; meta?: PluginParamMeta }[] = [];

    for (const pm of metaParams) {
      const paramIndex = plugin.parameters.findIndex(p => p.name === pm.name);
      if (paramIndex >= 0) {
        result.push({ paramIndex, meta: pm });
      }
    }

    // Raw params without metadata
    const metaNames = new Set(metaParams.map(pm => pm.name));
    plugin.parameters.forEach((p, i) => {
      if (!metaNames.has(p.name)) {
        result.push({ paramIndex: i });
      }
    });

    return result;
  };

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 1100, height: 700 }}>
        <div className="db-dialog-header">{t('pluginManager.title')}</div>
        <div className="db-dialog-body" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="pm-placeholder">{t('pluginManager.loading')}</div>
          ) : (
            <div className="pm-layout">
              {/* 1st column: Plugin list */}
              <div className="pm-plugin-list">
                <div className="pm-plugin-list-items">
                  {plugins.map((plugin, index) => (
                    <div
                      key={index}
                      className={`pm-plugin-item${selectedIndex === index ? ' active' : ''}`}
                      onClick={() => { setSelectedIndex(index); setEditingParamIndex(-1); }}
                    >
                      <input
                        type="checkbox"
                        checked={plugin.status}
                        onClick={(e) => toggleStatus(index, e)}
                        onChange={() => {}}
                      />
                      <span className="pm-plugin-item-name">
                        {metadata[plugin.name]?.pluginname || plugin.name || t('pluginManager.noPlugins')}
                      </span>
                      {editorPluginMap.has(plugin.name) && (
                        <span className={`pm-plugin-badge editor${editorPluginMap.get(plugin.name)!.hasUpdate ? ' has-update' : ''}`} title={editorPluginMap.get(plugin.name)!.hasUpdate ? '업그레이드 가능' : '에디터 기본 제공'}>
                          에디터
                        </span>
                      )}
                      {metadata[plugin.name]?.dependencies?.map(dep => (
                        <span key={dep} className="pm-plugin-badge" title={`${dep} 필요`}>
                          {dep}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="pm-plugin-buttons">
                  <button className="db-btn-small" onClick={() => movePlugin(-1)} disabled={selectedIndex <= 0} title={t('pluginManager.moveUp')}>↑</button>
                  <button className="db-btn-small" onClick={() => movePlugin(1)} disabled={selectedIndex < 0 || selectedIndex >= plugins.length - 1} title={t('pluginManager.moveDown')}>↓</button>
                  <button className="db-btn-small" onClick={addPlugin} title={t('common.add')}>+</button>
                  <button className="db-btn-small" onClick={removePlugin} disabled={selectedIndex < 0} title={t('common.delete')}>✕</button>
                </div>
                <div className="pm-open-folder-btn">
                  <button className="db-btn-small" onClick={handleOpenPluginFolder}>
                    {t('pluginManager.openFolder')}
                  </button>
                </div>
              </div>

              {/* 2nd column: Basic settings */}
              <div className="pm-basic-settings">
                {selectedPlugin ? (
                  <>
                    <div className="pm-field-row">
                      <span className="pm-field-label">{t('pluginManager.name')}:</span>
                      <div className="pm-field-value">
                        <select
                          value={selectedPlugin.name}
                          onChange={(e) => changePluginName(selectedIndex, e.target.value)}
                        >
                          <option value="">({t('pluginManager.selectPlugin')})</option>
                          {availableFiles.map(f => (
                            <option key={f} value={f} disabled={f !== selectedPlugin.name && usedPluginNames.has(f)}>
                              {metadata[f]?.pluginname ? `${metadata[f].pluginname} (${f})` : f}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pm-field-row">
                      <span className="pm-field-label">{t('pluginManager.status')}:</span>
                      <div className="pm-field-value">
                        <select
                          value={selectedPlugin.status ? 'ON' : 'OFF'}
                          onChange={(e) => {
                            const updated = [...plugins];
                            updated[selectedIndex] = { ...updated[selectedIndex], status: e.target.value === 'ON' };
                            setPlugins(updated);
                            setDirty(true);
                          }}
                        >
                          <option value="ON">ON</option>
                          <option value="OFF">OFF</option>
                        </select>
                      </div>
                    </div>

                    {selectedMeta?.plugindesc && (
                      <>
                        <div className="pm-section-label">{t('pluginManager.descriptionLabel')}:</div>
                        <div className="pm-description">{selectedMeta.plugindesc}</div>
                      </>
                    )}

                    {selectedMeta?.author && (
                      <>
                        <div className="pm-section-label">{t('pluginManager.author')}:</div>
                        <div className="pm-author">{selectedMeta.author}</div>
                      </>
                    )}

                    {selectedPlugin && editorPluginMap.has(selectedPlugin.name) && (
                      <div className="pm-editor-plugin-info">
                        <div className="pm-editor-plugin-label">에디터 기본 제공 플러그인</div>
                        {editorPluginMap.get(selectedPlugin.name)!.hasUpdate && (
                          <button className="db-btn pm-upgrade-btn" onClick={() => handleUpgradePlugin(selectedPlugin.name)}>
                            업그레이드
                          </button>
                        )}
                      </div>
                    )}

                    {selectedMeta?.help && (
                      <>
                        <div className="pm-section-label">{t('pluginManager.help')}:</div>
                        <div className="pm-help-box">{selectedMeta.help}</div>
                      </>
                    )}

                  </>
                ) : (
                  <div className="pm-placeholder">{t('pluginManager.selectPlugin')}</div>
                )}
              </div>

              {/* 3rd column: Parameters */}
              <div className="pm-params-panel">
                <div className="pm-params-header">{t('pluginManager.parameters')}</div>
                <div className="pm-params-body">
                  {selectedPlugin && selectedPlugin.name ? (
                    (() => {
                      const orderedParams = getOrderedParams(selectedPlugin);
                      if (orderedParams.length === 0) {
                        return <div className="pm-no-params">{t('projectSettings.noParams')}</div>;
                      }
                      return (
                        <table className="pm-param-table">
                          <thead>
                            <tr>
                              <th>{t('pluginManager.paramName')}</th>
                              <th>{t('pluginManager.paramValue')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderedParams.map(({ paramIndex, meta: paramMeta }) => {
                              const param = selectedPlugin.parameters[paramIndex];
                              if (!param) return null;
                              const isEditing = editingParamIndex === paramIndex;
                              const isBoolOrSelect = paramMeta && (paramMeta.type === 'boolean' || paramMeta.type === 'select' || paramMeta.type === 'combo' || paramMeta.type === 'color' || paramMeta.options.length > 0);
                              const showPicker = hasPickerButton(paramMeta);
                              const isTextFile = paramMeta?.type === 'textfile';
                              return (
                                <React.Fragment key={param.name}>
                                  <tr
                                    className={isEditing ? 'active' : ''}
                                    title={paramMeta?.desc || param.name}
                                  >
                                    <td className="pm-param-name">{param.name}</td>
                                    <td className="pm-param-value-cell">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          {isEditing || isBoolOrSelect ? (
                                            renderParamInput(selectedPlugin, selectedIndex, paramMeta, paramIndex)
                                          ) : (
                                            <div
                                              className="pm-param-value-display"
                                              onClick={() => setEditingParamIndex(paramIndex)}
                                            >
                                              {param.value || '\u00A0'}
                                            </div>
                                          )}
                                        </div>
                                        {showPicker && (
                                          <button
                                            className="db-btn-small"
                                            style={{ padding: '1px 4px', fontSize: 11, flexShrink: 0 }}
                                            onClick={() => openPicker(paramMeta!, paramIndex)}
                                            title={paramMeta?.type}
                                          >...</button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                  {isTextFile && param.value && (
                                    <tr>
                                      <td colSpan={2} style={{ padding: '4px 8px 8px 8px' }}>
                                        <CreditTextEditor textFilePath={param.value} />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()
                  ) : (
                    <div className="pm-no-params">{t('pluginManager.selectPlugin')}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {error && <div style={{ padding: '4px 16px', color: '#e55', fontSize: 12 }}>{error}</div>}

        {/* Picker dialogs */}
        {pickerType === 'animation' && selectedPlugin && pickerParamIndex >= 0 && (
          <AnimationPickerDialog
            value={Number(selectedPlugin.parameters[pickerParamIndex]?.value) || 0}
            onChange={(id) => {
              updateParam(selectedIndex, pickerParamIndex, String(id));
            }}
            onClose={() => setPickerType(null)}
          />
        )}

        {pickerType === 'datalist' && selectedPlugin && pickerParamIndex >= 0 && (
          <DataListPicker
            items={dataListItems}
            value={Number(selectedPlugin.parameters[pickerParamIndex]?.value) || 0}
            onChange={(id) => {
              updateParam(selectedIndex, pickerParamIndex, String(id));
            }}
            onClose={() => setPickerType(null)}
            title={dataListTitle}
          />
        )}

        {pickerType === 'file' && selectedPlugin && pickerParamIndex >= 0 && (
          <FilePickerDialog
            dir={browseDir}
            files={browseFiles}
            value={selectedPlugin.parameters[pickerParamIndex]?.value || ''}
            onChange={(name) => {
              updateParam(selectedIndex, pickerParamIndex, name);
              setPickerType(null);
            }}
            onClose={() => setPickerType(null)}
          />
        )}

        {pickerType === 'dir' && selectedPlugin && pickerParamIndex >= 0 && (
          <DirPickerDialog
            parentDir={browseDir}
            dirs={browseDirs}
            value={selectedPlugin.parameters[pickerParamIndex]?.value || ''}
            onChange={(name) => {
              updateParam(selectedIndex, pickerParamIndex, name);
              setPickerType(null);
            }}
            onClose={() => setPickerType(null)}
          />
        )}

        {pickerType === 'textfile' && selectedPlugin && pickerParamIndex >= 0 && (
          <TextFilePickerDialog
            dir={browseDir}
            files={browseFiles}
            value={selectedPlugin.parameters[pickerParamIndex]?.value || ''}
            onChange={(filePath) => {
              updateParam(selectedIndex, pickerParamIndex, filePath);
              setPickerType(null);
            }}
            onClose={() => setPickerType(null)}
          />
        )}

        <div className="db-dialog-footer">
          <div className="pm-footer-settings">
            <div className="pm-footer-settings-group">
              <span>{t('pluginManager.screen')}:</span>
              <input type="number" value={settings.screenWidth} min={1} style={{ width: 55 }}
                onChange={(e) => updateSetting('screenWidth', Number(e.target.value) || 816)} />
              <span>x</span>
              <input type="number" value={settings.screenHeight} min={1} style={{ width: 55 }}
                onChange={(e) => updateSetting('screenHeight', Number(e.target.value) || 624)} />
            </div>
            <div className="pm-footer-settings-group">
              <span>FPS:</span>
              <input type="number" value={settings.fps} min={1} max={120} style={{ width: 45 }}
                onChange={(e) => updateSetting('fps', Math.max(1, Math.min(120, Number(e.target.value) || 60)))} />
            </div>
            <label>
              <input
                type="checkbox"
                checked={settings.touchUI}
                onChange={(e) => updateSetting('touchUI', e.target.checked)}
              />
              TouchUI
            </label>
          </div>
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
