import React, { useRef, useEffect } from 'react';
import { EXTENDED_TAG_DEFS, TagDef } from './extendedTextDefs';

export const ESCAPE_INSERTS: { label: string; text: string }[] = [
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

interface TextEditorToolbarProps {
  showEscMenu: boolean;
  setShowEscMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  showBlockMenu: boolean;
  setShowBlockMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  onSaveSelection: () => void;
  onInsertEscape: (html: string) => void;
  onWrapInBlock: (def: TagDef) => void;
  onOpenIconModal: () => void;
  onOpenImagePicker: () => void;
}

export function TextEditorToolbar({
  showEscMenu,
  setShowEscMenu,
  showBlockMenu,
  setShowBlockMenu,
  onSaveSelection,
  onInsertEscape,
  onWrapInBlock,
  onOpenIconModal,
  onOpenImagePicker,
}: TextEditorToolbarProps) {
  const escMenuRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (escMenuRef.current && !escMenuRef.current.contains(e.target as Node)) {
        setShowEscMenu(false);
      }
      if (blockMenuRef.current && !blockMenuRef.current.contains(e.target as Node)) {
        setShowBlockMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setShowEscMenu, setShowBlockMenu]);

  return (
    <div className="ete-toolbar">
      {/* 이스케이프 삽입 드롭다운 */}
      <div className="ete-dropdown-wrap" ref={escMenuRef}>
        <button
          className="ete-toolbar-btn"
          onMouseDown={e => { e.preventDefault(); onSaveSelection(); setShowEscMenu(s => !s); setShowBlockMenu(false); }}
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
                  onInsertEscape(
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
        onMouseDown={e => { e.preventDefault(); onSaveSelection(); onOpenIconModal(); setShowBlockMenu(false); setShowEscMenu(false); }}
        title="커서 위치에 아이콘 삽입"
      >
        아이콘
      </button>
      <button
        className="ete-toolbar-btn"
        onMouseDown={e => { e.preventDefault(); onSaveSelection(); onOpenImagePicker(); setShowBlockMenu(false); setShowEscMenu(false); }}
        title="커서 위치에 이미지 삽입"
      >
        이미지
      </button>

      <div className="ete-toolbar-sep" />

      {/* 블록으로 만들기 드롭다운 */}
      <div className="ete-dropdown-wrap" ref={blockMenuRef}>
        <button
          className="ete-toolbar-btn"
          onMouseDown={e => { e.preventDefault(); onSaveSelection(); setShowBlockMenu(s => !s); setShowEscMenu(false); }}
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
                      onMouseDown={e => { e.preventDefault(); onWrapInBlock(def); }}
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
  );
}
