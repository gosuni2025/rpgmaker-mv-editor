import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { SCRIPT_SAMPLES, SAMPLE_GROUPS, type ScriptSample } from './scriptSamples';
import './ScriptSampleDialog.css';

interface Props {
  onInsert: (code: string) => void;
  onClose: () => void;
}

export function ScriptSampleDialog({ onInsert, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewViewRef = useRef<EditorView | null>(null);

  const filtered: ScriptSample[] = search
    ? SCRIPT_SAMPLES.filter(s =>
        s.label.toLowerCase().includes(search.toLowerCase()) ||
        s.group.toLowerCase().includes(search.toLowerCase())
      )
    : SCRIPT_SAMPLES;

  const safeIdx = Math.max(0, Math.min(selectedIdx, filtered.length - 1));
  const selected = filtered[safeIdx] ?? null;

  // CodeMirror 미리보기
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    if (previewViewRef.current) {
      previewViewRef.current.destroy();
      previewViewRef.current = null;
    }
    if (!selected) return;
    const view = new EditorView({
      doc: selected.code,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.editable.of(false),
      ],
      parent: container,
    });
    previewViewRef.current = view;
    return () => {
      view.destroy();
      previewViewRef.current = null;
    };
  }, [selected?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 항목 스크롤
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>('.script-sample-item.selected');
    el?.scrollIntoView({ block: 'nearest' });
  }, [safeIdx]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setSelectedIdx(0);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selected) onInsert(selected.code);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered.length, selected, onInsert, onClose]);

  const renderList = () => {
    if (search) {
      return filtered.map((s, i) => (
        <div
          key={`${s.group}\0${s.label}`}
          className={`script-sample-item${i === safeIdx ? ' selected' : ''}`}
          onClick={() => setSelectedIdx(i)}
          onDoubleClick={() => onInsert(s.code)}
        >
          <span className="script-sample-item-sub">{s.group}</span>
          <span>{s.label}</span>
        </div>
      ));
    }

    let globalIdx = 0;
    return SAMPLE_GROUPS.map(group => {
      const items = SCRIPT_SAMPLES.filter(s => s.group === group);
      return (
        <div key={group} className="script-sample-group">
          <div className="script-sample-group-header">{group}</div>
          {items.map(s => {
            const idx = globalIdx++;
            return (
              <div
                key={s.label}
                className={`script-sample-item${idx === safeIdx ? ' selected' : ''}`}
                onClick={() => setSelectedIdx(idx)}
                onDoubleClick={() => onInsert(s.code)}
              >
                {s.label}
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="script-sample-overlay" onKeyDown={handleKeyDown}>
      <div className="script-sample-dialog">
        <div className="script-sample-header">
          <span>샘플 삽입</span>
        </div>
        <div className="script-sample-body">
          {/* 왼쪽: 검색 + 목록 */}
          <div className="script-sample-list-panel">
            <input
              type="text"
              className="script-sample-search"
              placeholder="검색..."
              value={search}
              onChange={handleSearch}
              autoFocus
            />
            <div className="script-sample-list" ref={listRef}>
              {renderList()}
            </div>
          </div>

          {/* 오른쪽: CodeMirror 미리보기 */}
          <div className="script-sample-preview">
            {selected ? (
              <div ref={previewRef} className="script-sample-preview-cm" />
            ) : (
              <div className="script-sample-preview-empty">항목을 선택하세요</div>
            )}
          </div>
        </div>
        <div className="script-sample-footer">
          <span className="script-sample-hint">더블클릭 또는 Enter로 삽입</span>
          <button
            className="db-btn"
            onClick={() => selected && onInsert(selected.code)}
            disabled={!selected}
          >
            삽입
          </button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
