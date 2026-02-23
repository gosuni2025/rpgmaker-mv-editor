import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  parseExtendedText, htmlDivToRaw, segsToHTML,
  buildBlockChipHTML, entriesToRaw,
  EXTENDED_TAG_DEFS, getTagDef, TagDef, TagEntry, TagParam,
} from './extendedTextDefs';
import { ExtTextHelpPanel } from './ExtTextHelpPanel';
import { BlockPropsPanel } from './BlockPropsPanel';
import IconPicker from '../common/IconPicker';
import ImagePicker from '../common/ImagePicker';
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
  const [mode, setMode] = useState<'visual' | 'raw'>(() =>
    (localStorage.getItem('ete-tab') as 'visual' | 'raw') || 'visual'
  );
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showEscMenu, setShowEscMenu] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockInfo | null>(null);
  // 아이콘/이미지 삽입 모달
  const [showIconModal, setShowIconModal] = useState(false);
  const [iconInsertIdx, setIconInsertIdx] = useState(0);
  const [imagePickerKey, setImagePickerKey] = useState(0);
  // 프로퍼티 패널 상태: TagEntry 배열 + content
  const [propTags, setPropTags] = useState<TagEntry[]>([]);
  const [propContent, setPropContent] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const escMenuRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const savedRange = useRef<Range | null>(null);
  const dragBlockRef = useRef<HTMLElement | null>(null);
  const justDroppedRef = useRef(false);
  // 커스텀 undo/redo 스택 (native execCommand undo 대신 사용)
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const prevHTMLRef = useRef<string>('');

  // ─── raw → HTML 변환 후 div에 주입 ───
  const applyValueToEditor = useCallback((raw: string) => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    editorRef.current.innerHTML = segsToHTML(parseExtendedText(raw));
    prevHTMLRef.current = editorRef.current.innerHTML; // 외부 변경은 undo 기준점 갱신
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

  // ─── div → raw 변환 후 onChange 호출 + undo 스택 기록 ───
  const syncToParent = useCallback(() => {
    if (!editorRef.current || isInternalUpdate.current) return;
    const currentHTML = editorRef.current.innerHTML;
    // 실제 변경이 있을 때만 undo 스택에 이전 상태 저장
    if (currentHTML !== prevHTMLRef.current) {
      undoStackRef.current.push(prevHTMLRef.current);
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current = [];
      prevHTMLRef.current = currentHTML;
    }
    const raw = htmlDivToRaw(editorRef.current);
    lastValueRef.current = raw;
    onChange(raw);
  }, [onChange]);

  // ─── 에디터 내 bare <br> 앞에 개행 마커 스팬 추가 ───
  const refreshNLMarkers = useCallback(() => {
    if (!editorRef.current) return;
    // editorRef.current의 직계 자식인 <br>에만 적용 (Chrome이 생성하는 div 내부 sentinel <br> 제외)
    const children = Array.from(editorRef.current.childNodes);
    let inserted = false;
    children.forEach((node) => {
      if (node instanceof HTMLElement && node.tagName === 'BR') {
        const prev = node.previousSibling;
        const prevEl = prev instanceof HTMLElement ? prev : null;
        if (!prevEl || !prevEl.classList.contains('ete-nl-mark')) {
          const span = document.createElement('span');
          span.className = 'ete-nl-mark';
          span.contentEditable = 'false';
          span.textContent = '↵';
          editorRef.current!.insertBefore(span, node);
          inserted = true;
        }
      }
    });
    // 마커 삽입이 있었어도 raw 값은 변하지 않으므로 syncToParent 불필요
    if (inserted) isInternalUpdate.current = false;
  }, []);

  // ─── 입력 이벤트: sync + 개행 마커 갱신 ───
  const handleInput = useCallback(() => {
    syncToParent();
    requestAnimationFrame(refreshNLMarkers);
  }, [syncToParent, refreshNLMarkers]);

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

  // ─── HTML 스냅샷 복원 (undo/redo 공통) ───
  const restoreHTML = useCallback((html: string) => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    editorRef.current.innerHTML = html;
    prevHTMLRef.current = html;
    isInternalUpdate.current = false;
    const raw = htmlDivToRaw(editorRef.current);
    lastValueRef.current = raw;
    onChange(raw);
    editorRef.current.focus();
  }, [onChange]);

  // ─── DOM 선택 영역 → raw 문자열 ───
  function selectionToRaw(): string | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const frag = sel.getRangeAt(0).cloneContents();
    const tmp = document.createElement('div');
    tmp.appendChild(frag);
    return htmlDivToRaw(tmp);
  }

  // ─── 텍스트/HTML 커서 위치에 삽입 (execCommand로 undo 히스토리에 기록) ───
  const insertAtCursor = useCallback((html: string) => {
    restoreSelection();
    if (!editorRef.current) return;
    editorRef.current.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, html);
    syncToParent();
  }, [syncToParent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 선택된 텍스트를 블록으로 래핑 ───
  const wrapSelectionInBlock = useCallback((def: TagDef) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    // range.toString()은 DOM 텍스트만 반환 → 아이콘/이스케이프 등이 깨짐
    // cloneContents() → htmlDivToRaw()로 Raw 형식을 올바르게 추출
    let selectedText = '';
    if (range) {
      const frag = range.cloneContents();
      const tmp = document.createElement('div');
      tmp.appendChild(frag);
      selectedText = htmlDivToRaw(tmp);
    }

    const defaultParams: Record<string, string> = {};
    for (const p of def.params) {
      defaultParams[p.key] = String(p.defaultValue);
    }
    const tags: TagEntry[] = [{ tag: def.tag, params: defaultParams }];
    const blockHTML = buildBlockChipHTML(tags, selectedText);

    editorRef.current.focus();
    if (range) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, blockHTML);
    syncToParent();
    setShowBlockMenu(false);
  }, [syncToParent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 드래그 앤 드롭 ───
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const blockEl = (e.target as HTMLElement).closest('[data-ete-tags],[data-ete-tag]') as HTMLElement | null;
    if (!blockEl) { e.preventDefault(); return; }
    dragBlockRef.current = blockEl;
    blockEl.classList.add('ete-block-dragging');
    e.dataTransfer.effectAllowed = 'move';
    if (blockEl.dataset.eteTags) {
      const tags = JSON.parse(blockEl.dataset.eteTags) as TagEntry[];
      const content = blockEl.dataset.eteContent ?? '';
      e.dataTransfer.setData('text/plain', entriesToRaw(tags, content));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragBlockRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockEl = dragBlockRef.current;
    dragBlockRef.current = null;
    if (!blockEl || !editorRef.current) return;
    blockEl.classList.remove('ete-block-dragging');

    // 삽입 위치 계산
    const doc = document as any;
    let range: Range | null = null;
    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
    }
    if (!range || blockEl.contains(range.commonAncestorContainer)) return;

    // DOM 직접 조작으로 블록 이동 (커스텀 undo 스택이 처리)
    blockEl.remove();
    range.insertNode(blockEl);

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r2 = document.createRange();
      r2.setStartAfter(blockEl);
      r2.collapse(true);
      sel.addRange(r2);
    }

    justDroppedRef.current = true;
    setTimeout(() => { justDroppedRef.current = false; }, 100);
    syncToParent();
  }, [syncToParent]);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    if (dragBlockRef.current) {
      dragBlockRef.current.classList.remove('ete-block-dragging');
      dragBlockRef.current = null;
    }
  }, []);

  // ─── 클립보드 (복사/잘라내기/붙여넣기) ───
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    const raw = selectionToRaw();
    if (raw !== null) {
      e.clipboardData.setData('text/plain', raw);
      e.preventDefault();
      return;
    }
    if (selectedBlock) {
      e.clipboardData.setData('text/plain', entriesToRaw(selectedBlock.tags, selectedBlock.content));
      e.preventDefault();
    }
  }, [selectedBlock]);

  const handleCut = useCallback((e: React.ClipboardEvent) => {
    const raw = selectionToRaw();
    if (raw !== null) {
      e.clipboardData.setData('text/plain', raw);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('delete', false);
      syncToParent();
      e.preventDefault();
      return;
    }
    if (selectedBlock) {
      e.clipboardData.setData('text/plain', entriesToRaw(selectedBlock.tags, selectedBlock.content));
      selectedBlock.el.remove();
      setSelectedBlock(null);
      syncToParent();
      e.preventDefault();
    }
  }, [selectedBlock, syncToParent]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const segs = parseExtendedText(text);
    if (segs.some(s => s.type === 'block')) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('insertHTML', false, segsToHTML(segs));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('insertText', false, text);
    }
    syncToParent();
  }, [syncToParent]);

  // ─── 블록 클릭 처리 ───
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (justDroppedRef.current) return;
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

  // ─── 아이콘 삽입 ───
  const insertIconBlock = useCallback((idx: number) => {
    const html = buildBlockChipHTML([{ tag: 'icon', params: { index: String(idx) } }], '');
    restoreSelection(); // 모달 열기 전 저장한 커서 위치 복원
    if (!editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, html);
    syncToParent();
    setShowIconModal(false);
  }, [iconInsertIdx, syncToParent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 이미지 삽입 ───
  const insertImageBlock = useCallback((src: string, meta?: { fetchType: string }) => {
    if (!src) return;
    // fetchType이 'img'이면 img/ 루트 기준 경로로 처리
    const imgtype = meta?.fetchType === 'img' ? 'img' : 'pictures';
    const html = buildBlockChipHTML([{ tag: 'picture', params: { src, imgtype } }], '');
    restoreSelection(); // 다이얼로그 열기 전 저장한 커서 위치 복원
    if (!editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, html);
    syncToParent();
  }, [syncToParent]);

  // ─── 프로퍼티 패널 적용 (execCommand로 undo 히스토리에 기록) ───
  const applyProps = useCallback(() => {
    if (!selectedBlock || propTags.length === 0) return;
    const { el } = selectedBlock;
    const newHTML = buildBlockChipHTML(propTags, propContent);

    if (editorRef.current && editorRef.current.contains(el)) {
      editorRef.current.focus();
      const range = document.createRange();
      range.selectNode(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      // execCommand를 사용해 브라우저 네이티브 undo 히스토리에 기록 (cmd+z로 되돌리기 가능)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('insertHTML', false, newHTML);
    } else {
      const frag = document.createRange().createContextualFragment(newHTML);
      el.parentNode?.replaceChild(frag, el);
    }
    setSelectedBlock(null);
    syncToParent();
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
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const editorMinHeight = inline ? undefined : `${rows * 1.6 + 0.5}em`;

  return (
    <div className="ete-root">
      {/* 탭 바 */}
      <div className="ete-tabs">
        <button className={`ete-tab ${mode === 'visual' ? 'active' : ''}`} onClick={() => { setMode('visual'); localStorage.setItem('ete-tab', 'visual'); }}>
          확장 블럭 <span className="ext-badge">EXT</span>
        </button>
        <button className={`ete-tab ${mode === 'raw' ? 'active' : ''}`} onClick={() => { setMode('raw'); localStorage.setItem('ete-tab', 'raw'); }}>Raw</button>
        <span className="ete-tab-hint">텍스트를 드래그 선택 후 "효과 적용" 버튼으로 효과 적용</span>
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

            {/* 아이콘/이미지 삽입 */}
            <button
              className="ete-toolbar-btn"
              onMouseDown={e => { e.preventDefault(); saveSelection(); setShowIconModal(true); setShowBlockMenu(false); setShowEscMenu(false); }}
              title="커서 위치에 아이콘 삽입"
            >
              아이콘
            </button>
            <button
              className="ete-toolbar-btn"
              onMouseDown={e => { e.preventDefault(); saveSelection(); setImagePickerKey(k => k + 1); setShowBlockMenu(false); setShowEscMenu(false); }}
              title="커서 위치에 이미지 삽입"
            >
              이미지
            </button>

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
              onInput={handleInput}
              onClick={handleEditorClick}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onKeyDown={e => {
                if (inline && e.key === 'Enter') {
                  e.preventDefault();
                }
                // 커스텀 undo (cmd+z) — native execCommand undo 대신 HTML 스냅샷 스택 사용
                if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
                  e.preventDefault();
                  if (undoStackRef.current.length > 0) {
                    redoStackRef.current.push(prevHTMLRef.current);
                    restoreHTML(undoStackRef.current.pop()!);
                  }
                  return;
                }
                // 커스텀 redo (cmd+shift+z 또는 cmd+y)
                if ((e.metaKey || e.ctrlKey) && (e.shiftKey ? e.key === 'z' : e.key === 'y')) {
                  e.preventDefault();
                  if (redoStackRef.current.length > 0) {
                    undoStackRef.current.push(prevHTMLRef.current);
                    restoreHTML(redoStackRef.current.pop()!);
                  }
                  return;
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
              <BlockPropsPanel
                propTags={propTags}
                propContent={propContent}
                setPropTags={setPropTags}
                setPropContent={setPropContent}
                onApply={applyProps}
              />
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

      {/* 아이콘 삽입 — 버튼 클릭 시 IconPicker를 재마운트하여 그리드 바로 열기 */}
      {showIconModal && (
        <IconPicker
          value={iconInsertIdx}
          initialOpen={true}
          hidePreview={true}
          onChange={(idx) => { insertIconBlock(idx); }}
          onClose={() => setShowIconModal(false)}
        />
      )}

      {/* 이미지 삽입 — ImagePicker를 key로 재마운트하여 다이얼로그 바로 열기 */}
      {imagePickerKey > 0 && (
        <div style={{ display: 'none' }}>
          <ImagePicker
            key={imagePickerKey}
            type="pictures"
            value=""
            defaultOpen
            onChange={(src, meta) => { if (src) insertImageBlock(src, meta); }}
          />
        </div>
      )}
    </div>
  );
}

export default EnhancedTextEditor;
