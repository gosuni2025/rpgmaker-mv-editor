import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';

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

interface PluginMetadata {
  pluginname: string;
  plugindesc: string;
  author: string;
  help: string;
  params: { name: string; desc: string; type: string; default: string; options: string[]; dir: string }[];
}

function CreditTextEditor() {
  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/plugins/credit-text');
        const content = await res.text();
        setText(content);
        setOriginalText(content);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = text !== originalText;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await fetch('/api/plugins/credit-text', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });
      setOriginalText(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await apiClient.post('/plugins/credit-text/open-folder', {});
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <div style={{ color: '#888', fontSize: 12, padding: '4px 0' }}>로딩 중...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      <div className="db-form-section">크레딧 텍스트 (data/Credits.txt)</div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        style={{
          width: '100%',
          height: 150,
          fontFamily: 'monospace',
          fontSize: 12,
          background: '#1e1e1e',
          color: '#ddd',
          border: '1px solid #555',
          padding: 6,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      {error && <div style={{ color: '#e55', fontSize: 11 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="db-btn-small" onClick={handleSave} disabled={saving || !isDirty}
          style={isDirty ? { background: '#0078d4', borderColor: '#0078d4', color: '#fff' } : {}}>
          {saving ? '저장 중...' : '저장'}
        </button>
        <button className="db-btn-small" onClick={handleOpenFolder}>폴더 열기</button>
      </div>
    </div>
  );
}

export default function PluginManagerDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowPluginManagerDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [metadata, setMetadata] = useState<Record<string, PluginMetadata>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const locale = i18n.language || 'ko';

  useEffect(() => {
    (async () => {
      try {
        const [res, meta] = await Promise.all([
          apiClient.get<PluginsResponse>('/plugins'),
          apiClient.get<Record<string, PluginMetadata>>(`/plugins/metadata?locale=${locale}`),
        ]);
        const entries: PluginEntry[] = (res.list || []).map((p: ServerPluginEntry) => ({
          name: p.name,
          status: p.status,
          description: p.description || '',
          parameters: Object.entries(p.parameters || {}).map(([k, v]) => ({ name: k, value: String(v) })),
        }));
        setPlugins(entries);
        setMetadata(meta);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [locale]);

  const selected = plugins[selectedIndex] ?? null;
  const isTitleCredit = selected?.name === 'TitleCredit';

  const toggleStatus = (index: number) => {
    const updated = [...plugins];
    updated[index] = { ...updated[index], status: !updated[index].status };
    setPlugins(updated);
    setDirty(true);
  };

  const updateParam = (paramIndex: number, value: string) => {
    if (!selected) return;
    const updated = [...plugins];
    const params = [...updated[selectedIndex].parameters];
    params[paramIndex] = { ...params[paramIndex], value };
    updated[selectedIndex] = { ...updated[selectedIndex], parameters: params };
    setPlugins(updated);
    setDirty(true);
  };

  const movePlugin = (direction: -1 | 1) => {
    const newIndex = selectedIndex + direction;
    if (newIndex < 0 || newIndex >= plugins.length) return;
    const updated = [...plugins];
    [updated[selectedIndex], updated[newIndex]] = [updated[newIndex], updated[selectedIndex]];
    setPlugins(updated);
    setSelectedIndex(newIndex);
    setDirty(true);
  };

  const removePlugin = () => {
    if (plugins.length === 0) return;
    const updated = plugins.filter((_, i) => i !== selectedIndex);
    setPlugins(updated);
    setSelectedIndex(Math.min(selectedIndex, updated.length - 1));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Convert back to server format: parameters as Record<string,string>
      const serverList = plugins.map(p => ({
        name: p.name,
        status: p.status,
        description: p.description,
        parameters: Object.fromEntries(p.parameters.map(pp => [pp.name, pp.value])),
      }));
      await apiClient.put('/plugins', serverList);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 700, height: 500 }}>
        <div className="db-dialog-header">{t('pluginManager.title')}</div>
        <div className="db-dialog-body">
          {loading ? (
            <div className="db-loading">{t('pluginManager.loading')}</div>
          ) : (
            <>
              <div style={{ width: 220, minWidth: 220, display: 'flex', flexDirection: 'column', borderRight: '1px solid #555' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {plugins.map((p, i) => {
                    const meta = metadata[p.name];
                    const displayName = meta?.pluginname || p.name;
                    return (
                      <div key={`${p.name}-${i}`}
                        className={`db-list-item${i === selectedIndex ? ' selected' : ''}`}
                        onClick={() => setSelectedIndex(i)}
                        title={meta?.pluginname ? p.name : undefined}>
                        <span style={{ color: p.status ? '#6c6' : '#888', marginRight: 6, fontSize: 10 }}>
                          {p.status ? 'ON' : 'OFF'}
                        </span>
                        {displayName}
                      </div>
                    );
                  })}
                  {plugins.length === 0 && (
                    <div style={{ padding: 12, color: '#666', fontSize: 12 }}>{t('pluginManager.noPlugins')}</div>
                  )}
                </div>
                <div style={{ padding: 6, borderTop: '1px solid #555', display: 'flex', gap: 4 }}>
                  <button className="db-btn-small" onClick={() => movePlugin(-1)} title="위로">↑</button>
                  <button className="db-btn-small" onClick={() => movePlugin(1)} title="아래로">↓</button>
                  <button className="db-btn-small" onClick={removePlugin} title="삭제">✕</button>
                </div>
              </div>

              <div className="db-form" style={{ flex: 1 }}>
                {selected ? (
                  (() => {
                    const selMeta = metadata[selected.name];
                    const selDisplayName = selMeta?.pluginname || selected.name;
                    const selDesc = selMeta?.plugindesc || selected.description;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 'bold' }}>{selDisplayName}</span>
                          <button className="db-btn-small" onClick={() => toggleStatus(selectedIndex)}
                            style={selected.status ? { color: '#6c6' } : { color: '#888' }}>
                            {selected.status ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        {selMeta?.pluginname && (
                          <div style={{ fontSize: 11, color: '#777' }}>{selected.name}</div>
                        )}
                        <div style={{ fontSize: 12, color: '#aaa', whiteSpace: 'pre-wrap' }}>
                          {selDesc || t('pluginManager.noDescription')}
                        </div>
                        {selected.parameters.length > 0 && (
                          <>
                            <div className="db-form-section">{t('pluginManager.parameters')}</div>
                            {selected.parameters.map((param, pi) => {
                              const paramMeta = selMeta?.params.find(pm => pm.name === param.name);
                              return (
                                <label key={param.name} title={paramMeta?.desc || undefined}>
                                  <span>{param.name}</span>
                                  <input type="text" value={param.value}
                                    onChange={e => updateParam(pi, e.target.value)} />
                                </label>
                              );
                            })}
                          </>
                        )}
                        {isTitleCredit && <CreditTextEditor />}
                      </>
                    );
                  })()
                ) : (
                  <div className="db-placeholder">{t('pluginManager.selectPlugin')}</div>
                )}
              </div>
            </>
          )}
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
