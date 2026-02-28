import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TemplateElementDef } from '../../store/types';

const ELEMENT_COLORS: Record<string, string> = {
  icon:  '#4a90d9',
  label: '#5a9e5a',
  gauge: '#d97a4a',
  image: '#9a4ad9',
  panel: '#888',
};

const SAMPLE_ROWS = [
  { name: '물약',       numberText: '×5',  hp: 80,  mhp: 100 },
  { name: '마법수',     numberText: '×3',  hp: 40,  mhp: 100 },
  { name: '촉진제',     numberText: '×2',  hp: 100, mhp: 100 },
];

const ROW_WIDTH = 816;

function getElWidth(el: TemplateElementDef, rowWidth: number) {
  if (el.width != null) return el.width;
  if (el.type === 'icon') return 32;
  return rowWidth - (el.x || 0);
}
function getElHeight(el: TemplateElementDef, rowHeight: number) {
  if (el.height != null) return el.height;
  if (el.type === 'icon') return 32;
  return rowHeight;
}

/** 샘플 데이터 기반 라벨 미리보기 텍스트 */
function getSampleText(el: TemplateElementDef, sample: typeof SAMPLE_ROWS[0]): string {
  const t = el.text || '';
  if (t.includes('name'))        return sample.name;
  if (t.includes('numberText'))  return sample.numberText;
  return t.replace(/\{[^}]*\}/g, '…');
}

export default function UIEditorTemplateCanvas() {
  const { templates, selectedTemplateId, updateTemplate, saveTemplates } = useEditorStore(s => ({
    templates:          s.templates,
    selectedTemplateId: s.selectedTemplateId,
    updateTemplate:     s.updateTemplate,
    saveTemplates:      s.saveTemplates,
  }));

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedElId, setSelectedElId]   = useState<string | null>(null);
  const [dragState, setDragState]         = useState<{
    elId: string; startX: number; startY: number; origX: number; origY: number;
  } | null>(null);

  const template  = selectedTemplateId ? templates.templates[selectedTemplateId] : null;

  const handleElMouseDown = useCallback((e: React.MouseEvent, el: TemplateElementDef) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedElId(el.id);
    setDragState({ elId: el.id, startX: e.clientX, startY: e.clientY, origX: el.x || 0, origY: el.y || 0 });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !template) return;
    const dx = Math.round(e.clientX - dragState.startX);
    const dy = Math.round(e.clientY - dragState.startY);
    const newX = Math.max(0, dragState.origX + dx);
    const newY = Math.max(0, dragState.origY + dy);
    const children = template.root.children || [];
    const newChildren = children.map(el =>
      el.id === dragState.elId ? { ...el, x: newX, y: newY } : el
    );
    updateTemplate(template.id, { root: { ...template.root, children: newChildren } });
  }, [dragState, template, updateTemplate]);

  const handleMouseUp = useCallback(() => {
    if (dragState) saveTemplates();
    setDragState(null);
  }, [dragState, saveTemplates]);

  if (!template) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14 }}>
        ← 사이드바에서 템플릿을 선택하거나 새로 만드세요
      </div>
    );
  }

  const elements  = template.root.children || [];
  const rowHeight = template.rowHeight || 36;
  const selectedEl = elements.find(e => e.id === selectedElId);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'auto', background: '#1e1e1e', padding: 24, userSelect: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 헤더 */}
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 20, display: 'flex', gap: 20 }}>
        <span>템플릿: <b style={{ color: '#ddd' }}>{template.displayName}</b></span>
        <span style={{ color: '#666' }}>id: {template.id}</span>
        <span>rowHeight: <b style={{ color: '#ddd' }}>{rowHeight}px</b></span>
        <span>width: <b style={{ color: '#ddd' }}>{ROW_WIDTH}px</b></span>
      </div>

      {/* ── 미리보기 (샘플 데이터) ── */}
      <div style={{ color: '#666', fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>PREVIEW</div>
      <div style={{ marginBottom: 28, border: '1px solid #333' }}>
        {SAMPLE_ROWS.map((sample, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              width: ROW_WIDTH, height: rowHeight,
              background: rowIdx % 2 === 0 ? '#1a1a2a' : '#161622',
              position: 'relative', overflow: 'hidden',
              borderBottom: rowIdx < SAMPLE_ROWS.length - 1 ? '1px solid #252535' : 'none',
            }}
          >
            {elements.map(el => {
              const elH = getElHeight(el, rowHeight);
              const isRight = el.align === 'right';
              return (
                <div key={el.id} style={{
                  position: 'absolute',
                  left: isRight ? undefined : (el.x || 0),
                  right: isRight ? 4 : undefined,
                  top: el.y || 0,
                  height: elH,
                  display: 'flex', alignItems: 'center',
                  fontSize: 14, color: '#ccc',
                  pointerEvents: 'none',
                }}>
                  {el.type === 'icon' && (
                    <div style={{
                      width: 32, height: 32,
                      background: '#223',
                      border: '1px solid #336',
                      borderRadius: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: '#557',
                    }}>
                      ICO
                    </div>
                  )}
                  {el.type === 'label' && getSampleText(el, sample)}
                  {el.type === 'gauge' && (
                    <div style={{ width: el.width || 80, height: el.height || 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${sample.hp / sample.mhp * 100}%`, height: '100%', background: '#2a8' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── 편집 레이어 ── */}
      <div style={{ color: '#666', fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>EDIT LAYER  <span style={{ color: '#444' }}>— 드래그로 위치 조정</span></div>
      <div
        style={{
          width: ROW_WIDTH, height: rowHeight,
          background: '#111',
          position: 'relative',
          border: '1px solid #555',
        }}
        onClick={() => setSelectedElId(null)}
      >
        {/* 눈금 (40px 간격) */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(90deg, #1e1e1e 0, #1e1e1e 1px, transparent 1px, transparent 40px)',
          opacity: 0.8,
        }} />
        {/* 중앙선 */}
        <div style={{ position: 'absolute', left: ROW_WIDTH / 2, top: 0, bottom: 0, borderLeft: '1px dashed #2a2a4a', pointerEvents: 'none' }} />

        {elements.map(el => {
          const isSelected = selectedElId === el.id;
          const elW = getElWidth(el, ROW_WIDTH);
          const elH = getElHeight(el, rowHeight);
          const color = ELEMENT_COLORS[el.type] || '#888';

          return (
            <div
              key={el.id}
              onMouseDown={(e) => handleElMouseDown(e, el)}
              title={`${el.type}: x=${el.x || 0}, y=${el.y || 0}`}
              style={{
                position: 'absolute',
                left: el.x || 0,
                top: el.y || 0,
                width: elW,
                height: elH,
                background: color + '1a',
                border: `1px solid ${color}${isSelected ? '' : '55'}`,
                outline: isSelected ? `2px solid ${color}` : 'none',
                outlineOffset: 1,
                cursor: dragState?.elId === el.id ? 'grabbing' : 'grab',
                boxSizing: 'border-box',
                display: 'flex', alignItems: 'center',
                padding: '0 4px', overflow: 'hidden',
              }}
            >
              <span style={{ fontSize: 10, color: color + 'cc', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                {el.type === 'icon'  ? `◼ icon (${typeof el.bind === 'string' ? el.bind : ''})` :
                 el.type === 'label' ? `T  ${el.text || ''}` :
                 el.type === 'gauge' ? `▬ gauge` :
                 el.type}
              </span>
            </div>
          );
        })}
      </div>

      {/* 선택 엘리먼트 상태 표시 */}
      {selectedEl ? (
        <div style={{
          marginTop: 10, padding: '6px 12px',
          background: '#252525', border: `1px solid ${ELEMENT_COLORS[selectedEl.type] || '#555'}44`,
          borderRadius: 3, fontSize: 12, color: '#bbb', display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <span style={{ color: ELEMENT_COLORS[selectedEl.type] }}>■ {selectedEl.type}</span>
          <span>x: <b style={{ color: '#fff' }}>{selectedEl.x || 0}</b></span>
          <span>y: <b style={{ color: '#fff' }}>{selectedEl.y || 0}</b></span>
          {selectedEl.width != null && <span>w: <b style={{ color: '#fff' }}>{selectedEl.width}</b></span>}
          {selectedEl.type === 'label' && <span>text: <b style={{ color: '#aef' }}>{selectedEl.text}</b></span>}
          {selectedEl.type === 'label' && <span>align: <b style={{ color: '#fff' }}>{selectedEl.align || 'left'}</b></span>}
          {selectedEl.type === 'icon'  && <span>bind: <b style={{ color: '#aef' }}>{typeof selectedEl.bind === 'string' ? selectedEl.bind : ''}</b></span>}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 11, color: '#444' }}>
          엘리먼트를 클릭해서 선택, 드래그해서 위치 조정
        </div>
      )}

      {elements.length === 0 && (
        <div style={{ marginTop: 32, color: '#555', fontSize: 13, textAlign: 'center' }}>
          왼쪽 패널에서 + icon / + label / + gauge 버튼으로 엘리먼트를 추가하세요
        </div>
      )}
    </div>
  );
}
