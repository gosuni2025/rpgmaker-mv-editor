import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import useEscClose from '../hooks/useEscClose';

interface JsonParamEditorProps {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}

export default function JsonParamEditor({ value, onChange, onClose }: JsonParamEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [error, setError] = useState('');

  useEscClose(onClose);

  useEffect(() => {
    if (!editorRef.current) return;
    // pretty-print 초기값
    let initial = value;
    try { initial = JSON.stringify(JSON.parse(value), null, 2); } catch {}

    const view = new EditorView({
      doc: initial,
      extensions: [
        basicSetup,
        json(),
        oneDark,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const text = update.state.doc.toString();
            try { JSON.parse(text); setError(''); } catch (e) { setError((e as Error).message); }
          }
        }),
        EditorView.theme({ '&': { height: '320px' }, '.cm-scroller': { overflow: 'auto' } }),
      ],
      parent: editorRef.current,
    });
    viewRef.current = view;

    // 초기 검증
    try { JSON.parse(initial); setError(''); } catch (e) { setError((e as Error).message); }

    return () => { view.destroy(); viewRef.current = null; };
  }, []);  // mount once

  const handleApply = useCallback(() => {
    const text = viewRef.current?.state.doc.toString() ?? '';
    try {
      JSON.parse(text);
      onChange(text);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [onChange, onClose]);

  return createPortal(
    <div className="db-dialog-overlay" onClick={onClose}>
      <div className="db-dialog" style={{ width: 560, height: 'auto', maxHeight: '80vh' }}
           onClick={e => e.stopPropagation()}>
        <div className="db-dialog-header">
          <h2>JSON 편집</h2>
          <button className="db-dialog-close" onClick={onClose}>&times;</button>
        </div>
        <div className="db-dialog-body" style={{ flexDirection: 'column', padding: 8, overflow: 'hidden' }}>
          <div ref={editorRef} style={{ flex: 1, overflow: 'hidden', border: '1px solid #555', borderRadius: 3 }} />
          {error && <div style={{ color: '#e55', fontSize: 11, marginTop: 4, padding: '0 4px' }}>⚠ {error}</div>}
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={onClose}>취소</button>
          <button className="db-btn" style={!error ? { background: '#0078d4', borderColor: '#0078d4', color: '#fff' } : { opacity: 0.5 }}
                  onClick={handleApply} disabled={!!error}>적용</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
