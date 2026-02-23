import React, { useState, useEffect, useMemo } from 'react';
import i18n from '../i18n';
import apiClient from '../api/client';
import {
  DB_TYPE_MAP,
  PluginParam, PluginEntry, ServerPluginEntry, PluginsResponse,
  PluginParamMeta, PluginMetadata, ProjectSettings, EditorPluginInfo,
} from './PluginManagerHelpers';

export function usePluginManager() {
  const locale = i18n.language || 'ko';

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
              if (!existingNames.has(pm.name)) existingParams.push({ name: pm.name, value: pm.default });
            }
          }
          return { name: p.name, status: p.status, description: p.description || '', parameters: existingParams };
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

  const setPluginStatus = (index: number, status: boolean) => {
    const updated = [...plugins];
    updated[index] = { ...updated[index], status };
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
    setSelectedIndex(updated.length > 0 ? Math.min(selectedIndex, updated.length - 1) : -1);
    setDirty(true);
  };

  const handleOpenPluginFolder = async () => {
    try { await apiClient.post('/plugins/open-folder', {}); }
    catch (e) { setError((e as Error).message); }
  };

  const handleOpenInVSCode = async (pluginName: string) => {
    try { await apiClient.post('/plugins/open-vscode', { name: pluginName }); }
    catch (e) { setError((e as Error).message); }
  };

  const handleUpgradePlugin = async (pluginName: string) => {
    try {
      await apiClient.post('/plugins/upgrade', { name: pluginName });
      const updated = await apiClient.get<EditorPluginInfo[]>('/plugins/editor-plugins');
      setEditorPlugins(updated || []);
      const meta = await apiClient.get<Record<string, PluginMetadata>>(`/plugins/metadata?locale=${locale}`);
      setMetadata(meta);
    } catch (e) { setError((e as Error).message); }
  };

  // 에디터 플러그인을 프로젝트에 설치 (파일 복사 + plugins.js 목록에 추가)
  const installEditorPlugin = async (pluginName: string) => {
    try {
      await apiClient.post('/plugins/upgrade', { name: pluginName });
      const [updatedEp, meta] = await Promise.all([
        apiClient.get<EditorPluginInfo[]>('/plugins/editor-plugins'),
        apiClient.get<Record<string, PluginMetadata>>(`/plugins/metadata?locale=${locale}`),
      ]);
      setEditorPlugins(updatedEp || []);
      setMetadata(meta);
      const pluginMeta = meta[pluginName];
      const params = pluginMeta?.params
        ? pluginMeta.params.map(pm => ({ name: pm.name, value: pm.default }))
        : [];
      const newEntry = { name: pluginName, status: true, description: pluginMeta?.plugindesc || '', parameters: params };
      const updated = [...plugins, newEntry];
      setPlugins(updated);
      setSelectedIndex(updated.length - 1);
      setDirty(true);
    } catch (e) { setError((e as Error).message); }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const serverList = plugins.map(p => ({
        name: p.name, status: p.status, description: p.description,
        parameters: Object.fromEntries(p.parameters.map(pp => [pp.name, pp.value])),
      }));
      await Promise.all([
        apiClient.put('/plugins', serverList),
        apiClient.put('/project-settings', settings),
      ]);
      setDirty(false);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const openPicker = async (paramMeta: PluginParamMeta, paramIndex: number) => {
    const type = paramMeta.type.toLowerCase();

    if (type === 'animation') {
      setPickerParamIndex(paramIndex);
      setPickerType('animation');
      return;
    }
    if (type === 'file' || type === 'textfile') {
      const dir = paramMeta.dir || (type === 'textfile' ? 'data' : 'img/');
      setBrowseDir(dir);
      const ext = type === 'textfile' ? '&ext=txt' : '';
      try {
        const res = await apiClient.get<{ files: string[] }>(`/plugins/browse-files?dir=${encodeURIComponent(dir)}${ext}`);
        setBrowseFiles(res.files || []);
      } catch { setBrowseFiles([]); }
      setPickerParamIndex(paramIndex);
      setPickerType(type);
      return;
    }
    if (type === 'dir') {
      const dir = paramMeta.dir || 'img/';
      setBrowseDir(dir);
      try {
        const res = await apiClient.get<{ dirs: string[] }>(`/plugins/browse-dir?dir=${encodeURIComponent(dir)}`);
        setBrowseDirs(res.dirs || []);
      } catch { setBrowseDirs([]); }
      setPickerParamIndex(paramIndex);
      setPickerType('dir');
      return;
    }
    const dbConfig = DB_TYPE_MAP[type];
    if (dbConfig) {
      try {
        if (type === 'switch' || type === 'variable') {
          const system = await apiClient.get<any>('/database/system');
          setDataListItems(type === 'switch' ? system.switches : system.variables);
        } else {
          const data = await apiClient.get<(any | null)[]>(`/database/${dbConfig.endpoint}`);
          setDataListItems(data.map((item: any) => item?.name || ''));
        }
        setDataListTitle(dbConfig.title);
        setPickerParamIndex(paramIndex);
        setPickerType('datalist');
      } catch { /* silently fail */ }
    }
  };

  const hasPickerButton = (paramMeta: PluginParamMeta | undefined): boolean => {
    if (!paramMeta) return false;
    const type = paramMeta.type.toLowerCase();
    return type === 'animation' || type === 'file' || type === 'dir' || type === 'textfile' || type in DB_TYPE_MAP;
  };

  return {
    plugins, availableFiles, metadata, settings, selectedIndex, setSelectedIndex,
    editingParamIndex, setEditingParamIndex, loading, saving, error, dirty,
    selectedPlugin, selectedMeta, usedPluginNames, editorPluginMap, editorPlugins,
    pickerType, setPickerType, pickerParamIndex, dataListItems, dataListTitle,
    browseDir, browseFiles, browseDirs,
    updateSetting, toggleStatus, setPluginStatus, updateParam, changePluginName,
    movePlugin, addPlugin, removePlugin,
    handleOpenPluginFolder, handleOpenInVSCode, handleUpgradePlugin, handleSave,
    openPicker, hasPickerButton,
    installEditorPlugin,

    openParamFolder: async (dir: string) => {
      // "img/system/" → "img_system" 형태로 변환하여 /api/resources/:type/open-folder 호출
      const type = dir.replace(/\/+$/, '').replace(/\//g, '_');
      try {
        await apiClient.post(`/resources/${type}/open-folder`, {});
      } catch (err) {
        console.error('Open folder failed:', err);
      }
    },
  };
}
