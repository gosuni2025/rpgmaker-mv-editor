import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  parseExtendedText, htmlDivToRaw, segsToHTML,
  buildBlockChipHTML, entriesToRaw,
  EXTENDED_TAG_DEFS, getTagDef, TagDef, TagEntry, TagParam,
} from './extendedTextDefs';
import { ExtTextHelpPanel } from './ExtTextHelpPanel';
<<<<<<< HEAD
=======
import { BlockPropsPanel } from './BlockPropsPanel';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
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
  tags: TagEntry[];
  content: string;
}

interface EnhancedTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  inline?: boolean;
}

export function EnhancedTextEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  inline = false,
}: EnhancedTextEditorProps) {
<<<<<<< HEAD
  const [mode, setMode] = useState<'visual' | 'raw'>('visual');
=======
  const [mode, setMode] = useState<'visual' | 'raw'>(() =>
    (localStorage.getItem('ete-tab') as 'visual' | 'raw') || 'visual'
  );
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showEscMenu, setShowEscMenu] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockInfo | null>(null);
  // 프로퍼티 패널 상태: TagEntry 배열 + content
  const [propTags, setPropTags] = useState<TagEntry[]>([]);
  const [propContent, setPropContent] = useState('');
<<<<<<< HEAD
  const [showAddTagMenu, setShowAddTagMenu] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const escMenuRef = useRef<HTMLDivElement>(null);
  const addTagMenuRef = useRef<HTMLDivElement>(null);
=======
  const editorRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const escMenuRef = useRef<HTMLDivElement>(null);
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  const isInternalUpdate = useRef(false);
  const savedRange = useRef<Range | null>(null);

  // ─── raw → HTML 변환 후 div에 주입 ───
  const applyValueToEditor = useCallback((raw: string) => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    editorRef.current.innerHTML = segsToHTML(parseExtendedText(raw));
    isInternalUpdate.current = false;
  }, []);

  useEffect(() => {
    if (mode === 'visual') {
      applyValueToEditor(value);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

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
    range.deleteContents();
    const fragment = document.createRange().createContextualFragment(html);
    range.insertNode(fragment);
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

    const defaultParams: Record<string, string> = {};
    for (const p of def.params) {
      defaultParams[p.key] = String(p.defaultValue);
    }
    const tags: TagEntry[] = [{ tag: def.tag, params: defaultParams }];
    const blockHTML = buildBlockChipHTML(tags, selectedText);

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

  // ─── 블록 클릭 처리 ───
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 삭제 버튼
    const delBtn = target.closest('[data-del]') as HTMLElement | null;
    if (delBtn) {
      const blockEl = delBtn.closest('[data-ete-tags],[data-ete-tag]') as HTMLElement | null;
      if (blockEl) {
        blockEl.remove();
        syncToParent();
        setSelectedBlock(null);
        return;
      }
    }
    // 블록 선택
    const blockEl = target.closest('[data-ete-tags],[data-ete-tag]') as HTMLElement | null;
    if (blockEl) {
      e.preventDefault();
      let tags: TagEntry[];
      if (blockEl.dataset.eteTags) {
        tags = JSON.parse(blockEl.dataset.eteTags) as TagEntry[];
      } else {
        // 하위 호환: 기존 단일 태그
        tags = [{ tag: blockEl.dataset.eteTag!, params: JSON.parse(blockEl.dataset.eteParams ?? '{}') as Record<string, string> }];
      }
      const content = blockEl.dataset.eteContent ?? '';
      setSelectedBlock({ el: blockEl, tags, content });
      setPropTags(tags.map(e => ({ ...e, params: { ...e.params } })));
      setPropContent(content);
      editorRef.current?.querySelectorAll('.ete-block.selected').forEach(el => el.classList.remove('selected'));
      blockEl.classList.add('selected');
      // e.preventDefault()가 contentEditable 포커스를 막으므로 명시적 복구
      requestAnimationFrame(() => editorRef.current?.focus());
    } else {
      // 빈 공간 클릭: 커서 위치를 저장해두고 setState(패널 리렌더링) 후 복구
      const sel = window.getSelection();
      const savedSel = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      setSelectedBlock(null);
      editorRef.current?.querySelectorAll('.ete-block.selected').forEach(el => el.classList.remove('selected'));
      // 프로퍼티 패널 DOM 교체로 포커스가 body로 이동할 수 있으므로 복구
      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        if (savedSel) {
          const sel2 = window.getSelection();
          if (sel2) {
            sel2.removeAllRanges();
            try { sel2.addRange(savedSel); } catch { /* 범위가 이미 무효화된 경우 무시 */ }
          }
        }
      });
    }
  }, [syncToParent]);

  // ─── 프로퍼티 패널 적용 ───
  const applyProps = useCallback(() => {
    if (!selectedBlock || propTags.length === 0) return;
    const { el } = selectedBlock;
    const newHTML = buildBlockChipHTML(propTags, propContent);
    const frag = document.createRange().createContextualFragment(newHTML);
    el.parentNode?.replaceChild(frag, el);
    setSelectedBlock(null);
    syncToParent();
    // 패널 DOM 교체 후 에디터 포커스 복구
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [selectedBlock, propTags, propContent, syncToParent]);

  // ─── 외부 클릭으로 드롭다운 닫기 ───
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (blockMenuRef.current && !blockMenuRef.current.contains(e.target as Node)) {
        setShowBlockMenu(false);
      }
      if (escMenuRef.current && !escMenuRef.current.contains(e.target as Node)) {
        setShowEscMenu(false);
      }
<<<<<<< HEAD
      if (addTagMenuRef.current && !addTagMenuRef.current.contains(e.target as Node)) {
        setShowAddTagMenu(false);
      }
=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

<<<<<<< HEAD
  // ─── 파라미터 입력 렌더링 헬퍼 ───
  function renderParamInput(param: TagParam, value: string, onChangeFn: (val: string) => void) {
    if (param.type === 'color') {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="color"
            value={value}
            onChange={e => onChangeFn(e.target.value)}
            style={{ width: 32, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
          />
          <input
            type="text"
            className="ete-props-input"
            value={value}
            onChange={e => onChangeFn(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      );
    }
    if (param.type === 'select') {
      return (
        <select
          className="ete-props-input"
          value={value}
          onChange={e => onChangeFn(e.target.value)}
        >
          {param.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="number"
        className="ete-props-input"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={e => onChangeFn(e.target.value)}
      />
    );
  }

=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  const editorMinHeight = inline ? undefined : `${rows * 1.6 + 0.5}em`;

  return (
    <div className="ete-root">
      {/* 탭 바 */}
      <div className="ete-tabs">
<<<<<<< HEAD
        <button className={`ete-tab ${mode === 'visual' ? 'active' : ''}`} onClick={() => setMode('visual')}>
          확장 블럭 <span className="ext-badge">EXT</span>
        </button>
        <button className={`ete-tab ${mode === 'raw' ? 'active' : ''}`} onClick={() => setMode('raw')}>Raw</button>
=======
        <button className={`ete-tab ${mode === 'visual' ? 'active' : ''}`} onClick={() => { setMode('visual'); localStorage.setItem('ete-tab', 'visual'); }}>
          확장 블럭 <span className="ext-badge">EXT</span>
        </button>
        <button className={`ete-tab ${mode === 'raw' ? 'active' : ''}`} onClick={() => { setMode('raw'); localStorage.setItem('ete-tab', 'raw'); }}>Raw</button>
        <span className="ete-tab-hint">텍스트를 드래그 선택 후 "효과 적용" 버튼으로 효과 적용</span>
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
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
                // ArrowLeft: contenteditable="false" 블록 직후 커서에서 ← 키를 누르면
                // 브라우저가 블록 전체를 건너뛰어 이전 줄로 점프하는 기본 동작 보정.
                // 대신 블록 앞으로만 커서를 이동한다.
                if (e.key === 'ArrowLeft') {
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
                    const range = sel.getRangeAt(0);
                    const container = range.startContainer;
                    const offset = range.startOffset;
                    let prevSibling: Node | null = null;
                    if (container.nodeType === Node.TEXT_NODE && offset === 0) {
                      prevSibling = container.previousSibling;
                    } else if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
                      prevSibling = (container as Element).childNodes[offset - 1];
                    }
                    if (prevSibling instanceof HTMLElement && prevSibling.classList.contains('ete-block')) {
                      e.preventDefault();
                      const newRange = document.createRange();
                      newRange.setStartBefore(prevSibling);
                      newRange.collapse(true);
                      sel.removeAllRanges();
                      sel.addRange(newRange);
                    }
                  }
                }
              }}
              onBlur={syncToParent}
            />

            {/* 프로퍼티 패널 */}
            {selectedBlock ? (
<<<<<<< HEAD
              <div
                className="ete-props-panel"
                onMouseDown={e => {
                  // input/textarea/select/color picker는 포커스 허용, 나머지는 에디터 포커스 유지
                  const tag = (e.target as HTMLElement).tagName;
                  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
                    e.preventDefault();
                  }
                }}
              >
                {/* 태그별 섹션 */}
                {propTags.map((entry, idx) => {
                  const def = getTagDef(entry.tag);
                  if (!def) return null;
                  return (
                    <div key={idx} className="ete-props-tag-section">
                      <div className="ete-props-tag-header">
                        <span className="ete-block-label" style={{ background: def.badgeColor, borderRadius: 3 }}>
                          {def.label}
                        </span>
                        <button
                          className="ete-props-tag-del"
                          title="이 효과 제거"
                          onClick={() => setPropTags(prev => prev.filter((_, i) => i !== idx))}
                        >✕</button>
                      </div>
                      {def.params.map(param => (
                        <div key={param.key} className="ete-props-row">
                          <label className="ete-props-label">{param.label}</label>
                          {renderParamInput(
                            param,
                            entry.params[param.key] ?? String(param.defaultValue),
                            val => setPropTags(prev => prev.map((e, i) =>
                              i === idx ? { ...e, params: { ...e.params, [param.key]: val } } : e
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* 내용 텍스트 */}
                <div className="ete-props-content-row">
                  <div className="ete-props-label">내용 텍스트</div>
                  <textarea
                    className="ete-props-content-input"
                    rows={2}
                    value={propContent}
                    onChange={e => setPropContent(e.target.value)}
                  />
                </div>

                {/* 효과 추가 드롭다운 */}
                <div className="ete-dropdown-wrap ete-props-add-wrap" ref={addTagMenuRef}>
                  <button
                    className="ete-props-add-btn"
                    onMouseDown={e => { e.preventDefault(); setShowAddTagMenu(s => !s); }}
                  >
                    + 효과 추가
                  </button>
                  {showAddTagMenu && (
                    <div className="ete-dropdown-menu" style={{ bottom: 'calc(100% + 2px)', top: 'auto', left: 0 }}>
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
                                onMouseDown={e => {
                                  e.preventDefault();
                                  const defaultParams: Record<string, string> = {};
                                  for (const p of def.params) defaultParams[p.key] = String(p.defaultValue);
                                  setPropTags(prev => [...prev, { tag: def.tag, params: defaultParams }]);
                                  setShowAddTagMenu(false);
                                }}
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

                <button className="ete-props-apply-btn" onClick={applyProps}>적용</button>
              </div>
=======
              <BlockPropsPanel
                propTags={propTags}
                propContent={propContent}
                setPropTags={setPropTags}
                setPropContent={setPropContent}
                onApply={applyProps}
              />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
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
