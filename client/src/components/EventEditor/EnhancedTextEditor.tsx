import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  parseExtendedText, htmlDivToRaw, segsToHTML,
  buildBlockChipHTML, TagDef, TagEntry,
} from './extendedTextDefs';
import { ExtTextHelpPanel } from './ExtTextHelpPanel';
import { BlockPropsPanel } from './BlockPropsPanel';
import { TextEditorToolbar } from './TextEditorToolbar';
import { useEditorDragDrop } from './useEditorDragDrop';
import { useEditorClipboard } from './useEditorClipboard';
import IconPicker from '../common/IconPicker';
import ImagePicker from '../common/ImagePicker';
import './EnhancedTextEditor.css';

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
  const [showIconModal, setShowIconModal] = useState(false);
  const [iconInsertIdx, setIconInsertIdx] = useState(0);
  const [imagePickerKey, setImagePickerKey] = useState(0);
  const [propTags, setPropTags] = useState<TagEntry[]>([]);
  const [propContent, setPropContent] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const savedRange = useRef<Range | null>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const prevHTMLRef = useRef<string>('');

  // ─── raw → HTML 변환 후 div에 주입 ───
  const applyValueToEditor = useCallback((raw: string) => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    editorRef.current.innerHTML = segsToHTML(parseExtendedText(raw));
    prevHTMLRef.current = editorRef.current.innerHTML;
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
    if (inserted) isInternalUpdate.current = false;
  }, []);

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

  // ─── HTML 스냅샷 복원 (undo/redo) ───
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

  // ─── 텍스트/HTML 커서 위치에 삽입 ───
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

  // ─── 드래그앤드롭 훅 ───
  const { justDroppedRef, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useEditorDragDrop({ onDrop: syncToParent });

  // ─── 클립보드 훅 ───
  const { handleCopy, handleCut, handlePaste } = useEditorClipboard({
    selectedBlock,
    onSync: syncToParent,
    onBlockRemoved: () => setSelectedBlock(null),
  });

  // ─── 블록 클릭 처리 ───
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (justDroppedRef.current) return;
    const target = e.target as HTMLElement;
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
    const blockEl = target.closest('[data-ete-tags],[data-ete-tag]') as HTMLElement | null;
    if (blockEl) {
      e.preventDefault();
      let tags: TagEntry[];
      if (blockEl.dataset.eteTags) {
        tags = JSON.parse(blockEl.dataset.eteTags) as TagEntry[];
      } else {
        tags = [{ tag: blockEl.dataset.eteTag!, params: JSON.parse(blockEl.dataset.eteParams ?? '{}') as Record<string, string> }];
      }
      const content = blockEl.dataset.eteContent ?? '';
      setSelectedBlock({ el: blockEl, tags, content });
      setPropTags(tags.map(e => ({ ...e, params: { ...e.params } })));
      setPropContent(content);
      editorRef.current?.querySelectorAll('.ete-block.selected').forEach(el => el.classList.remove('selected'));
      blockEl.classList.add('selected');
      requestAnimationFrame(() => editorRef.current?.focus());
    } else {
      const sel = window.getSelection();
      const savedSel = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      setSelectedBlock(null);
      editorRef.current?.querySelectorAll('.ete-block.selected').forEach(el => el.classList.remove('selected'));
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
  }, [syncToParent, justDroppedRef]);

  // ─── 아이콘 삽입 ───
  const insertIconBlock = useCallback((idx: number) => {
    const html = buildBlockChipHTML([{ tag: 'icon', params: { index: String(idx) } }], '');
    restoreSelection();
    if (!editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, html);
    syncToParent();
    setShowIconModal(false);
  }, [iconInsertIdx, syncToParent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 이미지 삽입 ───
  const insertImageBlock = useCallback((src: string, meta?: { fetchType: string }) => {
    if (!src) return;
    const imgtype = meta?.fetchType === 'img' ? 'img' : 'pictures';
    const html = buildBlockChipHTML([{ tag: 'picture', params: { src, imgtype } }], '');
    restoreSelection();
    if (!editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, html);
    syncToParent();
  }, [syncToParent]);

  // ─── 프로퍼티 패널 적용 ───
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
          <TextEditorToolbar
            showEscMenu={showEscMenu}
            setShowEscMenu={setShowEscMenu}
            showBlockMenu={showBlockMenu}
            setShowBlockMenu={setShowBlockMenu}
            onSaveSelection={saveSelection}
            onInsertEscape={insertAtCursor}
            onWrapInBlock={wrapSelectionInBlock}
            onOpenIconModal={() => setShowIconModal(true)}
            onOpenImagePicker={() => setImagePickerKey(k => k + 1)}
          />

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
                if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
                  e.preventDefault();
                  if (undoStackRef.current.length > 0) {
                    redoStackRef.current.push(prevHTMLRef.current);
                    restoreHTML(undoStackRef.current.pop()!);
                  }
                  return;
                }
                if ((e.metaKey || e.ctrlKey) && (e.shiftKey ? e.key === 'z' : e.key === 'y')) {
                  e.preventDefault();
                  if (redoStackRef.current.length > 0) {
                    undoStackRef.current.push(prevHTMLRef.current);
                    restoreHTML(redoStackRef.current.pop()!);
                  }
                  return;
                }
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

      {showIconModal && (
        <IconPicker
          value={iconInsertIdx}
          initialOpen={true}
          hidePreview={true}
          onChange={(idx) => { insertIconBlock(idx); }}
          onClose={() => setShowIconModal(false)}
        />
      )}

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
