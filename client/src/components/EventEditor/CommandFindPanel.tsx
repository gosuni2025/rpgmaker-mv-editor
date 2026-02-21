import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { FindOptions } from './commandSearch';
import './CommandFindPanel.css';

interface CommandFindPanelProps {
  matchCount: number;
  currentMatchIndex: number;
  showReplace: boolean;
  onQueryChange: (query: string, opts: FindOptions) => void;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleReplace: () => void;
  onClose: () => void;
}

export default function CommandFindPanel({
  matchCount, currentMatchIndex, showReplace,
  onQueryChange, onReplace, onReplaceAll,
  onNext, onPrev, onToggleReplace, onClose,
}: CommandFindPanelProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [opts, setOpts] = useState<FindOptions>({ caseSensitive: false, wholeWord: false, regex: false });
  const queryRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => { queryRef.current?.focus(); }, []);

  useEffect(() => { onQueryChange(query, opts); }, [query, opts]);

  const toggleOpt = useCallback((key: keyof FindOptions) => {
    setOpts(o => ({ ...o, [key]: !o[key] }));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key === 'Enter') {
        const inQuery = document.activeElement === queryRef.current;
        const inReplace = document.activeElement === replaceRef.current;
        if (inQuery) { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
        if (inReplace) { e.preventDefault(); onReplace(replacement); }
      }
      if (e.key === 'F3') { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose, onNext, onPrev, onReplace, replacement]);

  const countLabel = query
    ? matchCount > 0 ? `${currentMatchIndex + 1} / ${matchCount}` : '결과 없음'
    : '';

  return (
    <div className="cmd-find-panel" onMouseDown={e => e.stopPropagation()}>
      <div className="cmd-find-row">
        <button className="cmd-find-toggle" onClick={onToggleReplace} title="바꾸기 토글">
          {showReplace ? '▼' : '▶'}
        </button>
        <div className="cmd-find-input-wrap">
          <input
            ref={queryRef}
            className="cmd-find-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="찾기"
          />
          <button className={`cmd-find-opt${opts.caseSensitive ? ' active' : ''}`} title="대소문자 구분" onClick={() => toggleOpt('caseSensitive')}>Aa</button>
          <button className={`cmd-find-opt${opts.wholeWord ? ' active' : ''}`} title="단어 단위" onClick={() => toggleOpt('wholeWord')}>W</button>
          <button className={`cmd-find-opt${opts.regex ? ' active' : ''}`} title="정규식" onClick={() => toggleOpt('regex')}>.*</button>
        </div>
        <span className={`cmd-find-count${query && matchCount === 0 ? ' no-match' : ''}`}>{countLabel}</span>
        <button className="cmd-find-nav" onClick={onPrev} disabled={matchCount === 0} title="이전 (Shift+Enter)">↑</button>
        <button className="cmd-find-nav" onClick={onNext} disabled={matchCount === 0} title="다음 (Enter)">↓</button>
        <button className="cmd-find-close" onClick={onClose}>✕</button>
      </div>
      {showReplace && (
        <div className="cmd-find-row">
          <div className="cmd-find-toggle-spacer" />
          <div className="cmd-find-input-wrap">
            <input
              ref={replaceRef}
              className="cmd-find-input"
              value={replacement}
              onChange={e => setReplacement(e.target.value)}
              placeholder="바꾸기"
            />
          </div>
          <button className="cmd-find-nav" onClick={() => onReplace(replacement)} disabled={matchCount === 0}>바꾸기</button>
          <button className="cmd-find-nav" onClick={() => onReplaceAll(replacement)} disabled={matchCount === 0}>모두</button>
        </div>
      )}
    </div>
  );
}
