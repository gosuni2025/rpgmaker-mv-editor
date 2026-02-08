import React, { useState, useEffect } from 'react';
import useEditorStore from '../store/useEditorStore';
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

export default function PluginManagerDialog() {
  const setShow = useEditorStore((s) => s.setShowPluginManagerDialog);
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<PluginsResponse>('/plugins');
        // Convert server format { name, status, description, parameters: Record<string,string> }
        // to client format { name, status, description, parameters: PluginParam[] }
        const entries: PluginEntry[] = (res.list || []).map((p: ServerPluginEntry) => ({
          name: p.name,
          status: p.status,
          description: p.description || '',
          parameters: Object.entries(p.parameters || {}).map(([k, v]) => ({ name: k, value: String(v) })),
        }));
        setPlugins(entries);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, []);

  const selected = plugins[selectedIndex] ?? null;

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
    <div className="db-dialog-overlay" onClick={() => setShow(false)}>
      <div className="db-dialog" style={{ width: 700, height: 500 }} onClick={e => e.stopPropagation()}>
        <div className="db-dialog-header">플러그인 관리</div>
        <div className="db-dialog-body">
          {loading ? (
            <div className="db-loading">불러오는 중...</div>
          ) : (
            <>
              <div style={{ width: 220, minWidth: 220, display: 'flex', flexDirection: 'column', borderRight: '1px solid #555' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {plugins.map((p, i) => (
                    <div key={`${p.name}-${i}`}
                      className={`db-list-item${i === selectedIndex ? ' selected' : ''}`}
                      onClick={() => setSelectedIndex(i)}>
                      <span style={{ color: p.status ? '#6c6' : '#888', marginRight: 6, fontSize: 10 }}>
                        {p.status ? 'ON' : 'OFF'}
                      </span>
                      {p.name}
                    </div>
                  ))}
                  {plugins.length === 0 && (
                    <div style={{ padding: 12, color: '#666', fontSize: 12 }}>플러그인 없음</div>
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
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 'bold' }}>{selected.name}</span>
                      <button className="db-btn-small" onClick={() => toggleStatus(selectedIndex)}
                        style={selected.status ? { color: '#6c6' } : { color: '#888' }}>
                        {selected.status ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa', whiteSpace: 'pre-wrap' }}>
                      {selected.description || '설명 없음'}
                    </div>
                    {selected.parameters.length > 0 && (
                      <>
                        <div className="db-form-section">파라미터</div>
                        {selected.parameters.map((param, pi) => (
                          <label key={param.name}>
                            <span>{param.name}</span>
                            <input type="text" value={param.value}
                              onChange={e => updateParam(pi, e.target.value)} />
                          </label>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <div className="db-placeholder">플러그인을 선택하세요</div>
                )}
              </div>
            </>
          )}
        </div>
        {error && <div style={{ padding: '4px 16px', color: '#e55', fontSize: 12 }}>{error}</div>}
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleSave} disabled={saving || !dirty}
            style={dirty ? { background: '#0078d4', borderColor: '#0078d4' } : {}}>
            {saving ? '저장 중...' : '저장'}
          </button>
          <button className="db-btn" onClick={() => setShow(false)}>닫기</button>
        </div>
      </div>
    </div>
  );
}
