import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { EditorView } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import type { ScriptSample } from './scriptSamples';
import { SCRIPT_SAMPLES, SAMPLE_GROUPS } from './scriptSamples';
import useEscClose from '../../hooks/useEscClose';
import './ScriptSampleDialog.css';

interface Props {
  /**
   * 표시할 샘플 목록.
   * 미지정 시 SCRIPT_SAMPLES (일반 스크립트용) 전체 사용.
   */
  samples?: ScriptSample[];
  /**
   * 삽입 버튼/더블클릭/Enter 시 호출.
   * comment: 샘플 첫 줄의 // 주석에서 추출한 문자열 (없으면 '').
   */
  onInsert: (code: string, comment: string) => void;
  onClose: () => void;
}

/**
 * 스크립트 샘플 팝업 (공용)
 * - 왼쪽: 검색 + 그룹별 항목 목록 (키보드 위아래 이동)
 * - 오른쪽: CodeMirror 코드 미리보기 (read-only)
 */
export function ScriptSampleDialog({ samples, onInsert, onClose }: Props) {
  useEscClose(onClose);

  const allSamples = samples ?? SCRIPT_SAMPLES;

  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewViewRef = useRef<EditorView | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // 검색 필터
  const filtered: ScriptSample[] = useMemo(() => {
    if (!search.trim()) return allSamples;
    const q = search.toLowerCase();
    return allSamples.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  }, [allSamples, search]);

  const safeIdx = Math.max(0, Math.min(selectedIdx, filtered.length - 1));
  const selected = filtered[safeIdx] ?? null;

  // 검색어 바뀌면 인덱스 리셋
  useEffect(() => { setSelectedIdx(0); }, [search]);

  // 선택 항목이 보이도록 스크롤
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${safeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [safeIdx]);

  // CodeMirror 미리보기 - 선택 코드 변경 시 교체
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    const code = selected?.code ?? '';

    if (previewViewRef.current) {
      // destroy 후 재생성 (oneDark 확장 재적용 보장)
      previewViewRef.current.destroy();
      previewViewRef.current = null;
    }

    if (!code) return;

    const view = new EditorView({
      doc: code,
      extensions: [
        javascript(),
        oneDark,
        EditorView.editable.of(false),
        EditorView.lineWrapping,
      ],
      parent: container,
    });
    previewViewRef.current = view;

    return () => {
      view.destroy();
      previewViewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.code]);

  // 마운트 시 검색창 포커스
  useEffect(() => { searchRef.current?.focus(); }, []);

  // 삽입 처리 - 첫 줄 `// 주석` 분리
  const handleInsert = useCallback(() => {
    if (!selected) return;
    const lines = selected.code.split('\n');
    let comment = '';
    let code = selected.code;
    if (lines[0].startsWith('//')) {
      comment = lines[0].replace(/^\/\/\s*/, '');
      code = lines.slice(1).join('\n').trim();
    }
    onInsert(code, comment);
  }, [selected, onInsert]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert();
    }
  }, [filtered.length, handleInsert]);

  // 그룹별 렌더링
  const renderList = () => {
    if (search.trim()) {
      // 검색 시 그룹 헤더 유지
      const groupMap = new Map<string, { sample: ScriptSample; idx: number }[]>();
      filtered.forEach((s, i) => {
        if (!groupMap.has(s.group)) groupMap.set(s.group, []);
        groupMap.get(s.group)!.push({ sample: s, idx: i });
      });
      if (groupMap.size === 0) {
        return <div className="script-sample-empty">검색 결과 없음</div>;
      }
      return Array.from(groupMap.entries()).map(([group, items]) => (
        <div key={group} className="script-sample-group">
          <div className="script-sample-group-header">{group}</div>
          {items.map(({ sample, idx }) => (
            <div
              key={sample.label}
              data-idx={idx}
              className={`script-sample-item${idx === safeIdx ? ' selected' : ''}`}
              onClick={() => setSelectedIdx(idx)}
              onDoubleClick={() => { setSelectedIdx(idx); handleInsert(); }}
            >
              {sample.label}
            </div>
          ))}
        </div>
      ));
    }

    // 전체 목록 (고정 그룹 순서)
    const groupOrder = (() => {
      const seen = new Set<string>();
      const arr: string[] = [];
      for (const s of allSamples) {
        if (!seen.has(s.group)) { seen.add(s.group); arr.push(s.group); }
      }
      return arr;
    })();

    let globalIdx = 0;
    return groupOrder.map(group => {
      const items = allSamples.filter(s => s.group === group);
      return (
        <div key={group} className="script-sample-group">
          <div className="script-sample-group-header">{group}</div>
          {items.map(s => {
            const idx = globalIdx++;
            return (
              <div
                key={s.label}
                data-idx={idx}
                className={`script-sample-item${idx === safeIdx ? ' selected' : ''}`}
                onClick={() => setSelectedIdx(idx)}
                onDoubleClick={() => { setSelectedIdx(idx); handleInsert(); }}
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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="script-sample-dialog"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 헤더 */}
        <div className="script-sample-header">
          <span>스크립트 샘플</span>
          <button className="script-sample-close-btn" onClick={onClose}>×</button>
        </div>

        {/* 본문 */}
        <div className="script-sample-body">
          {/* 왼쪽: 검색 + 목록 */}
          <div className="script-sample-list-panel">
            <input
              ref={searchRef}
              type="text"
              className="script-sample-search"
              placeholder="검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="script-sample-list" ref={listRef}>
              {renderList()}
            </div>
          </div>

          {/* 오른쪽: CodeMirror 미리보기 */}
          <div className="script-sample-preview">
            {selected ? (
              <>
                <div className="script-sample-preview-title">
                  <span className="script-sample-preview-group">{selected.group}</span>
                  <span className="script-sample-preview-sep"> / </span>
                  {selected.label}
                </div>
                <div ref={previewRef} className="script-sample-preview-cm" />
              </>
            ) : (
              <div className="script-sample-preview-empty">항목을 선택하세요</div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="script-sample-footer">
          <span className="script-sample-hint">Enter 또는 더블클릭으로 삽입</span>
          <button className="db-btn" onClick={handleInsert} disabled={!selected}>삽입</button>
          <button className="db-btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
