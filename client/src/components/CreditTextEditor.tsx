import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';

interface Props {
  textFilePath?: string;
}

export default function CreditTextEditor({ textFilePath = 'data/Credits.txt' }: Props) {
  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await fetch(`/api/plugins/credit-text?path=${encodeURIComponent(textFilePath)}`);
        const content = await res.text();
        setText(content);
        setOriginalText(content);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [textFilePath]);

  const isDirty = text !== originalText;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await fetch(`/api/plugins/credit-text?path=${encodeURIComponent(textFilePath)}`, {
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
      await apiClient.post(`/plugins/credit-text/open-folder?path=${encodeURIComponent(textFilePath)}`, {});
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <div style={{ color: '#888', fontSize: 12, padding: '4px 0' }}>로딩 중...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      <div className="db-form-section">크레딧 텍스트 ({textFilePath})</div>
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
