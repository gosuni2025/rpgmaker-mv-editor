import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  parseExtendedText, htmlDivToRaw, segsToHTML,
  EXTENDED_TAG_DEFS, getTagDef, TagDef,
} from './extendedTextDefs';
import { ExtTextHelpPanel } from './ExtTextHelpPanel';
import './EnhancedTextEditor.css';

// ─── 인라인 이스케이프 삽입 목록 ───
const ESCAPE_INSERTS: { label: string; text: string }[] = [
  { label: '대기(.)', text: '\\.' },
  { label: '대기(|)', text: '\\|' },
  { label: '클릭대기', text: '\\!' },
  { label: '크기+', text: '\\{' },
  { label: '크기-', text: '\\}' },
  { label: '색상\\C[n]', text: '\\C[0]' },
  { label: '아이콘\\I[n]', text: '\\I[1]' },
  { label: '변수\\V[n]', text: '\\V[1]' },
  { label: '이름\\N[n]', text: '\\N[1]' },
];

interface BlockInfo {
  el: HTMLElement;
  tag: string;
  params: Record<string, string>;
  content: string;
}

interface EnhancedTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  inline?: boolean; // single-line 모드
}

export function EnhancedTextEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  inline = false,
}: EnhancedTextEditorProps) {
  const [mode, setMode] = useState<'visual' | 'raw'>('visual');
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showEscMenu, setShowEscMenu] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockInfo | null>(null);
  const [propValues, setPropValues] = useState<Record<string, string>>({});
  const [propContent, setPropContent] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const escMenuRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const savedRange = useRef<Range | null>(null);

  // ─── raw → HTML 변환 후 div에 주입 ───
  const applyValueToEditor = useCallback((raw: string) => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    editorRef.current.innerHTML = segsToHTML(parseExtendedText(raw));
    isInternalUpdate.current = false;
  }, []);

  // visual 모드로 전환 시 현재 value를 div에 적용
  useEffect(() => {
    if (mode === 'visual') {
      applyValueToEditor(value);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // value가 외부에서 변경될 때 (raw 모드에서 돌아온 경우 등) visual 모드 갱신
  // 단, 에디터 내부 input으로 인한 변경은 재갱신 안 함
  const lastValueRef = useRef(value);
  useEffect(() => {
    if (mode === 'visual' && value !== lastValueRef.current) {
      lastValueRef.current = value;
      applyValueToEditor(value);
    }
  }, [value, mode, applyValueToEditor]);

  // ─── div → raw 변환 후 onChange 호출 ───
  const syncToParent = useCallback(() => {
    if (!editorRef.current || isInternalUpdate.current) return;
    const raw = htmlDivToRaw(editorRef.current);
    lastValueRef.current = raw;
    onChange(raw);
  }, [onChange]);

  // ─── 커서 위치 저장/복원 ───
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    if (!savedRange.current || !editorRef.current) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    editorRef.current.focus();
  };

  // ─── 텍스트/HTML 커서 위치에 삽입 ───
  const insertAtCursor = useCallback((html: string) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (!range) return;
    // 선택 영역 삭제
    range.deleteContents();
    const fragment = document.createRange().createContextualFragment(html);
    range.insertNode(fragment);
    // 커서를 삽입된 내용 뒤로 이동
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    syncToParent();
  }, [syncToParent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 선택된 텍스트를 블록으로 래핑 ───
  const wrapSelectionInBlock = useCallback((def: TagDef) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const selectedText = range ? range.toString() : '';

    // 기본 파라미터
    const defaultParams: Record<string, string> = {};
    for (const p of def.params) {
      defaultParams[p.key] = String(p.defaultValue);
    }

    const blockHTML = buildBlockHTML(def, defaultParams, selectedText);

    if (range && !range.collapsed) {
      range.deleteContents();
      const frag = document.createRange().createContextualFragment(blockHTML);
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      insertAtCursor(blockHTML);
    }
    syncToParent();
    setShowBlockMenu(false);
  }, [insertAtCursor, syncToParent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 블록 HTML 생성 ───
  function buildBlockHTML(def: TagDef, params: Record<string, string>, content: string): string {
    const color = def.badgeColor;
    const paramsJSON = JSON.stringify(params).replace(/"/g, '&quot;');
    return (
      `<span class="ete-block" ` +
      `data-ete-tag="${def.tag}" ` +
      `data-ete-params="${paramsJSON}" ` +
      `data-ete-content="${content.replace(/"/g, '&quot;')}" ` +
      `contenteditable="false" ` +
      `style="border-color:${color}">` +
      `<span class="ete-block-label" style="background:${color}">${def.label}</span>` +
      `<span class="ete-block-preview">${content || ' '}</span>` +
      `<span class="ete-block-del" data-del="1">✕</span>` +
      `</span>`
    );
  }

  // ─── 블록 클릭 처리 ───
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 삭제 버튼
    const delBtn = target.closest('[data-del]') as HTMLElement | null;
    if (delBtn) {
      const blockEl = delBtn.closest('[data-ete-tag]') as HTMLElement | null;
      if (blockEl) {
        blockEl.remove();
        syncToParent();
        setSelectedBlock(null);
        return;
      }
    }
    // 블록 선택
    const blockEl = target.closest('[data-ete-tag]') as HTMLElement | null;
    if (blockEl) {
      e.preventDefault();
      const tag = blockEl.dataset.eteTag!;
      const params = JSON.parse(blockEl.dataset.eteParams ?? '{}') as Record<string, string>;
      const content = blockEl.dataset.eteContent ?? '';
      setSelectedBlock({ el: blockEl, tag, params, content });
      setPropValues({ ...params });
      setPropContent(content);
      // 이전에 선택된 블록 강조 제거
      editorRef.current?.querySelectorAll('.ete-block.selected').forEach(el => el.classList.remove('selected'));
      blockEl.classList.add('selected');
    } else {
      setSelectedBlock(null);
      editorRef.current?.querySelectorAll('.ete-block.selected').forEach(el => el.classList.remove('selected'));
    }
  }, [syncToParent]);

  // ─── 프로퍼티 패널 적용 ───
  const applyProps = useCallback(() => {
    if (!selectedBlock) return;
    const { el, tag } = selectedBlock;
    const def = getTagDef(tag);
    if (!def) return;
    // 블록 HTML 재생성
    el.dataset.eteParams = JSON.stringify(propValues);
    el.dataset.eteContent = propContent;
    const previewEl = el.querySelector('.ete-block-preview');
    if (previewEl) previewEl.textContent = propContent || ' ';
    syncToParent();
    setSelectedBlock(prev => prev ? { ...prev, params: propValues, content: propContent } : null);
  }, [selectedBlock, propValues, propContent, syncToParent]);

  // ─── 외부 클릭으로 드롭다운 닫기 ───
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (blockMenuRef.current && !blockMenuRef.current.contains(e.target as Node)) {
        setShowBlockMenu(false);
      }
      if (escMenuRef.current && !escMenuRef.current.contains(e.target as Node)) {
        setShowEscMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const editorMinHeight = inline ? undefined : `${rows * 1.6 + 0.5}em`;

  return (
    <div className="ete-root">
      {/* 탭 바 */}
      <div className="ete-tabs">
        <button className={`ete-tab ${mode === 'visual' ? 'active' : ''}`} onClick={() => setMode('visual')}>기본</button>
        <button className={`ete-tab ${mode === 'raw' ? 'active' : ''}`} onClick={() => setMode('raw')}>Raw</button>
      </div>

      {mode === 'visual' && (
        <>
          {/* 툴바 */}
          <div className="ete-toolbar">
            {/* 이스케이프 삽입 드롭다운 */}
            <div className="ete-dropdown-wrap" ref={escMenuRef}>
              <button
                className="ete-toolbar-btn"
                onMouseDown={e => { e.preventDefault(); saveSelection(); setShowEscMenu(s => !s); setShowBlockMenu(false); }}
              >
                제어 문자 ▾
              </button>
              {showEscMenu && (
                <div className="ete-dropdown-menu">
                  {ESCAPE_INSERTS.map(ei => (
                    <div
                      key={ei.text}
                      className="ete-dropdown-item"
                      onMouseDown={e => {
                        e.preventDefault();
                        insertAtCursor(
                          `<span class="ete-escape" data-ete-escape="${ei.text.replace(/"/g, '&quot;')}" contenteditable="false">${ei.text}</span>`
                        );
                        setShowEscMenu(false);
                      }}
                    >
                      <span className="ete-escape" style={{ pointerEvents: 'none' }}>{ei.text}</span>
                      <span style={{ color: '#888', fontSize: 11 }}>{ei.label.replace(/\\.*/, '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ete-toolbar-sep" />

            {/* 블록으로 만들기 드롭다운 */}
            <div className="ete-dropdown-wrap" ref={blockMenuRef}>
              <button
                className="ete-toolbar-btn"
                onMouseDown={e => { e.preventDefault(); saveSelection(); setShowBlockMenu(s => !s); setShowEscMenu(false); }}
              >
                효과 적용 ▾
              </button>
              {showBlockMenu && (
                <div className="ete-dropdown-menu">
                  {(['visual', 'animation', 'timing'] as const).map(cat => {
                    const defs = EXTENDED_TAG_DEFS.filter(d => d.category === cat);
                    if (!defs.length) return null;
                    const catLabel = { visual: '비주얼', animation: '애니메이션', timing: '타이밍' }[cat];
                    return (
                      <React.Fragment key={cat}>
                        <div className="ete-dropdown-group-label">{catLabel}</div>
                        {defs.map(def => (
                          <div
                            key={def.tag}
                            className="ete-dropdown-item"
                            onMouseDown={e => { e.preventDefault(); wrapSelectionInBlock(def); }}
                          >
                            <span className="ete-dropdown-badge" style={{ background: def.badgeColor }}>{def.label}</span>
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 에디터 본체 + 프로퍼티 패널 */}
          <div className="ete-body">
            <div
              ref={editorRef}
              className={`ete-editor-area${inline ? ' single-line' : ''}`}
              contentEditable
              suppressContentEditableWarning
              style={{ minHeight: editorMinHeight }}
              data-placeholder={placeholder}
              onInput={syncToParent}
              onClick={handleEditorClick}
              onKeyDown={e => {
                if (inline && e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              onBlur={syncToParent}
            />

            {/* 프로퍼티 패널 */}
            {selectedBlock ? (
              <div className="ete-props-panel">
                <h4 style={{ borderLeftColor: getTagDef(selectedBlock.tag)?.badgeColor }}>
                  {getTagDef(selectedBlock.tag)?.label ?? selectedBlock.tag}
                </h4>
                {/* 내용 편집 */}
                <div className="ete-props-content-row">
                  <div className="ete-props-label">내용 텍스트</div>
                  <textarea
                    className="ete-props-content-input"
                    rows={2}
                    value={propContent}
                    onChange={e => setPropContent(e.target.value)}
                  />
                </div>
                {/* 파라미터 편집 */}
                {(getTagDef(selectedBlock.tag)?.params ?? []).map(param => (
                  <div key={param.key} className="ete-props-row">
                    <label className="ete-props-label">{param.label}</label>
                    {param.type === 'color' ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="color"
                          value={propValues[param.key] ?? String(param.defaultValue)}
                          onChange={e => setPropValues(pv => ({ ...pv, [param.key]: e.target.value }))}
                          style={{ width: 36, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                        />
                        <input
                          type="text"
                          className="ete-props-input"
                          value={propValues[param.key] ?? String(param.defaultValue)}
                          onChange={e => setPropValues(pv => ({ ...pv, [param.key]: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                      </div>
                    ) : param.type === 'select' ? (
                      <select
                        className="ete-props-input"
                        value={propValues[param.key] ?? String(param.defaultValue)}
                        onChange={e => setPropValues(pv => ({ ...pv, [param.key]: e.target.value }))}
                      >
                        {param.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        className="ete-props-input"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={propValues[param.key] ?? String(param.defaultValue)}
                        onChange={e => setPropValues(pv => ({ ...pv, [param.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
                <button className="ete-props-apply-btn" onClick={applyProps}>적용</button>
              </div>
            ) : (
              <div className="ete-props-panel">
                <div className="ete-props-empty">
                  텍스트를 선택 후<br />
                  "효과 적용"을 누르거나<br />
                  블록을 클릭하세요
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'raw' && (
        <textarea
          className="ete-raw-textarea"
          value={value}
          rows={inline ? 1 : rows}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ fontFamily: 'monospace' }}
        />
      )}

      <ExtTextHelpPanel />
    </div>
  );
}

export default EnhancedTextEditor;
