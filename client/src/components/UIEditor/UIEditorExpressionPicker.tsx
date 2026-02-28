import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ExpressionMode, ExpressionTemplateGroup } from './UIEditorExpressionTemplates';
import { BUILTIN_TEMPLATE_GROUPS, fetchPluginTemplateGroups } from './UIEditorExpressionTemplates';

interface ExpressionPickerProps {
  /** 현재 입력 필드의 모드 — 관련 템플릿을 우선 표시 */
  mode: ExpressionMode;
  /** 팝업 닫기 */
  onClose: () => void;
  /** 템플릿 선택 — code를 삽입 */
  onInsert: (code: string) => void;
}

const MODE_LABELS: Record<ExpressionMode, string> = {
  text: '텍스트 템플릿',
  bitmap: 'Bitmap 표현식',
  srcRect: 'srcRect 표현식',
  js: 'JS 표현식',
};

const MODE_TAG_COLORS: Record<ExpressionMode, string> = {
  text:    '#3a7a5a',
  bitmap:  '#7a3a7a',
  srcRect: '#7a5a2a',
  js:      '#2a5a8a',
};

export function ExpressionPickerButton({
  mode, onInsert, style,
}: {
  mode: ExpressionMode;
  onInsert: (code: string) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        title={`템플릿 픽커 (${MODE_LABELS[mode]})`}
        style={{
          fontSize: 11, padding: '1px 5px', cursor: 'pointer',
          background: '#2a3a4a', border: '1px solid #4a6a8a', borderRadius: 3,
          color: '#8ac', userSelect: 'none', lineHeight: '18px', flexShrink: 0,
          ...style,
        }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      >
        {'{}'}
      </button>
      {open && (
        <ExpressionPickerPopup
          mode={mode}
          onClose={() => setOpen(false)}
          onInsert={(code) => { onInsert(code); setOpen(false); }}
        />
      )}
    </>
  );
}

function ExpressionPickerPopup({ mode, onClose, onInsert }: ExpressionPickerProps) {
  const [search, setSearch] = useState('');
  const [allGroups, setAllGroups] = useState<ExpressionTemplateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // 내장 + 플러그인 템플릿 합치기
  useEffect(() => {
    fetchPluginTemplateGroups().then((pluginGroups) => {
      setAllGroups([...BUILTIN_TEMPLATE_GROUPS, ...pluginGroups]);
    });
  }, []);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 현재 mode와 관련된 그룹 먼저, 나머지는 그다음
  const sorted = [...allGroups].sort((a, b) => {
    const aRel = a.items.some(i => i.modes.includes(mode));
    const bRel = b.items.some(i => i.modes.includes(mode));
    return (bRel ? 1 : 0) - (aRel ? 1 : 0);
  });

  // 검색 필터
  const filteredGroups = sorted.map(g => ({
    ...g,
    items: g.items.filter(item =>
      !search ||
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      (item.desc || '').toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(g => g.items.length > 0);

  // 선택된 그룹만 보기
  const displayGroups = selectedGroup
    ? filteredGroups.filter(g => (g.id || g.group) === selectedGroup)
    : filteredGroups;

  const handleCopy = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#222', border: '1px solid #555', borderRadius: 6,
        width: 580, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '8px 12px',
          borderBottom: '1px solid #444', gap: 8,
        }}>
          <span style={{ color: '#ccc', fontSize: 13, fontWeight: 'bold', flex: 1 }}>
            표현식 템플릿
          </span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 3,
            background: MODE_TAG_COLORS[mode], color: '#fff',
          }}>
            {MODE_LABELS[mode]}
          </span>
          <button
            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
            onClick={onClose}
          >×</button>
        </div>

        {/* 검색 */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #333' }}>
          <input
            autoFocus
            placeholder="검색 (레이블, 코드, 설명)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', background: '#333', border: '1px solid #555',
              borderRadius: 3, color: '#ddd', padding: '4px 8px', fontSize: 12,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 카테고리 탭 */}
        <div style={{
          display: 'flex', gap: 4, padding: '6px 12px', flexWrap: 'wrap',
          borderBottom: '1px solid #333', flexShrink: 0,
        }}>
          <button
            style={tabBtnStyle(selectedGroup === null)}
            onClick={() => setSelectedGroup(null)}
          >전체</button>
          {allGroups.map(g => {
            const key = g.id || g.group;
            const hasMatch = filteredGroups.some(fg => (fg.id || fg.group) === key);
            const isRel = g.items.some(i => i.modes.includes(mode));
            return (
              <button
                key={key}
                style={{
                  ...tabBtnStyle(selectedGroup === key),
                  opacity: hasMatch ? 1 : 0.35,
                  borderColor: isRel ? '#4a8a6a' : undefined,
                }}
                onClick={() => setSelectedGroup(selectedGroup === key ? null : key)}
              >
                {g.pluginLabel ? `[플러그인] ${g.group}` : g.group}
              </button>
            );
          })}
        </div>

        {/* 아이템 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {displayGroups.length === 0 && (
            <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
              검색 결과 없음
            </div>
          )}
          {displayGroups.map(g => (
            <div key={g.id || g.group} style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, color: '#888', textTransform: 'uppercase',
                letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {g.group}
                {g.pluginLabel && (
                  <span style={{ fontSize: 9, padding: '1px 4px', background: '#3a4a5a', borderRadius: 2, color: '#8ac', textTransform: 'none' }}>
                    {g.pluginLabel}
                  </span>
                )}
              </div>
              {g.items.map((item, i) => {
                const isCurrentMode = item.modes.includes(mode);
                const isCopied = copied === item.code;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '5px 8px', marginBottom: 2, borderRadius: 4,
                      background: isCurrentMode ? '#2a3a2a' : '#252525',
                      border: `1px solid ${isCurrentMode ? '#3a5a3a' : '#333'}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, color: '#ddd', fontWeight: 500 }}>
                          {item.label}
                        </span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {item.modes.map(m => (
                            <span key={m} style={{
                              fontSize: 8, padding: '0 3px', borderRadius: 2,
                              background: MODE_TAG_COLORS[m], color: '#fff', opacity: m === mode ? 1 : 0.5,
                            }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <code style={{
                        fontSize: 10, color: '#8cf', background: '#1a2a3a',
                        padding: '2px 5px', borderRadius: 2, display: 'block',
                        wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                        maxHeight: 60, overflow: 'hidden',
                      }}>
                        {item.code}
                      </code>
                      {item.desc && (
                        <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{item.desc}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                      <button
                        style={actionBtnStyle('#2675bf')}
                        onClick={() => onInsert(item.code)}
                        title="현재 필드에 삽입"
                      >
                        삽입
                      </button>
                      <button
                        style={actionBtnStyle(isCopied ? '#3a8a4a' : '#555')}
                        onClick={() => handleCopy(item.code)}
                        title="클립보드에 복사"
                      >
                        {isCopied ? '✓' : '복사'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 도움말 */}
        <div style={{
          padding: '6px 12px', borderTop: '1px solid #333',
          fontSize: 10, color: '#666', lineHeight: 1.4,
        }}>
          플러그인 파일에 <code style={{ color: '#8ac' }}>/* @UITemplates [...] */</code> 블록을 추가하면 자동으로 목록에 포함됩니다.
        </div>
      </div>
    </div>
  );
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 10, padding: '2px 7px', cursor: 'pointer', borderRadius: 3,
    background: active ? '#2675bf' : '#333',
    border: `1px solid ${active ? '#2675bf' : '#555'}`,
    color: active ? '#fff' : '#bbb',
  };
}

function actionBtnStyle(bg: string): React.CSSProperties {
  return {
    fontSize: 10, padding: '2px 6px', cursor: 'pointer', borderRadius: 3,
    background: bg, border: 'none', color: '#fff',
  };
}
