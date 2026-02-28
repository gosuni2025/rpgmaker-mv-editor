import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { WidgetDef, WidgetType } from '../../store/uiEditorTypes';
import { hasDescendantWithId, dragState } from './UIEditorSceneUtils';
import { deleteBtnStyle } from './UIEditorSceneStyles';

const WIDGET_TYPE_COLORS: Record<WidgetType, string> = {
  background: '#3a5a3a',
  panel: '#4a6fa5', label: '#5a8a5a', textArea: '#3a7a5a', image: '#8a5a8a',
  gauge: '#8a4a3a', separator: '#555',
  button: '#2675bf', list: '#2a7a3a', rowSelector: '#7a3a7a', options: '#7a5a2a',
  minimap: '#2a6a7a', scene: '#7a6a2a',
};

const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  background: 'BG',
  panel: 'PANEL', label: 'LABEL', textArea: 'TEXT', image: 'IMG',
  gauge: 'GAUGE', separator: 'SEP',
  button: 'BTN', list: 'LIST', rowSelector: 'SELECT', options: 'OPTS',
  minimap: 'MAP', scene: 'SCENE',
};

export { WIDGET_TYPE_COLORS, WIDGET_TYPE_LABELS };

export function WidgetTreeNode({
  widget, depth, sceneId, selectedId, onSelect, onRemove, onReorder,
  initialExpanded,
}: {
  widget: WidgetDef; depth: number; sceneId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (dragId: string, targetId: string, pos: 'before' | 'inside') => void;
  initialExpanded?: boolean;
}) {
  const isSelected = widget.id === selectedId;
  const children: WidgetDef[] = widget.children || [];
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = React.useState(
    widget.id === 'root' ? true : (initialExpanded ?? true)
  );
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = React.useState<'before' | 'inside' | null>(null);

  // 자손이 선택되면 자동 펼침
  React.useEffect(() => {
    if (hasChildren && selectedId && hasDescendantWithId(widget, selectedId)) {
      setExpanded(true);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택되면 트리에서 보이도록 스크롤
  React.useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const canContain = true; // 모든 위젯이 자식을 가질 수 있음
  const canDrag = widget.id !== 'root';
  // onDragLeave 레이스 컨디션 방지: dropPos를 ref에도 저장하여 onDrop에서 최신값 사용
  const dropPosRef = React.useRef<'before' | 'inside' | null>(null);

  const setDropPosAndRef = (pos: 'before' | 'inside' | null) => {
    dropPosRef.current = pos;
    setDropPos(pos);
  };

  return (
    <div>
      {/* before 드롭 인디케이터 */}
      {dropPos === 'before' && (
        <div style={{ height: 2, background: '#2675bf', marginLeft: depth * 12 + 4, borderRadius: 1 }} />
      )}
      <div
        ref={rowRef}
        draggable={canDrag}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: depth * 12 + 4, paddingRight: 4,
          paddingTop: 3, paddingBottom: 3,
          background: isSelected ? '#2675bf33' : dropPos === 'inside' ? '#2675bf22' : 'transparent',
          cursor: canDrag ? 'grab' : 'pointer', borderRadius: 2,
          outline: dropPos === 'inside' ? '1px solid #2675bf88' : 'none',
        }}
        onClick={() => onSelect(widget.id)}
        onDragStart={(e) => {
          if (!canDrag) { e.preventDefault(); return; }
          dragState.widgetId = widget.id;
          // 드래그 위젯의 모든 자손 ID를 미리 계산 (순환 참조 방지용)
          function collectDescendantIds(w: WidgetDef, acc: Set<string>) {
            for (const c of w.children || []) { acc.add(c.id); collectDescendantIds(c, acc); }
          }
          dragState.descendantIds = new Set<string>();
          collectDescendantIds(widget, dragState.descendantIds);
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          dragState.widgetId = null;
          setDropPosAndRef(null);
        }}
        onDragOver={(e) => {
          const did = dragState.widgetId;
          if (!did) return;
          if (did === widget.id) return;
          // 드래그 위젯의 자손 안으로 넣는 것만 금지 (순환 참조). 조상으로 이동은 허용.
          if (dragState.descendantIds.has(widget.id)) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const relY = e.clientY - rect.top;
          const newPos = (canContain && relY > rect.height * 0.35) ? 'inside' : 'before';
          if (dropPosRef.current !== newPos) setDropPosAndRef(newPos);
        }}
        onDragLeave={(e) => {
          const isInside = rowRef.current && rowRef.current.contains(e.relatedTarget as Node);
          if (isInside) return;
          setDropPosAndRef(null);
        }}
        onDrop={(e) => {
          const did = dragState.widgetId;
          if (!did || did === widget.id || dragState.descendantIds.has(widget.id)) {
            setDropPosAndRef(null);
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          const pos = dropPosRef.current ?? 'before';
          setDropPosAndRef(null);
          dragState.widgetId = null;
          onReorder(did, widget.id, pos);
        }}
      >
        {hasChildren ? (
          <span
            style={{
              fontSize: 11, color: '#bbb', cursor: 'pointer',
              width: 14, textAlign: 'center', flexShrink: 0,
              display: 'inline-block',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.1s',
              userSelect: 'none',
            }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {'\u25B6'}
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 9, padding: '1px 3px', borderRadius: 2,
          background: WIDGET_TYPE_COLORS[widget.type] || '#555', color: '#fff',
          flexShrink: 0,
        }}>
          {WIDGET_TYPE_LABELS[widget.type]}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {widget.id}
          {'text' in widget && (widget as any).text ? (
            <span style={{ color: '#888', fontSize: 10, marginLeft: 4 }}>"{(widget as any).text.slice(0, 15)}"</span>
          ) : null}
        </span>
        {widget.id !== 'root' && (
          <button style={{ ...deleteBtnStyle, fontSize: 9, padding: '1px 4px' }}
            onClick={(e) => { e.stopPropagation(); onRemove(widget.id); }}>
            ×
          </button>
        )}
      </div>
      {hasChildren && expanded && children.map((child) => (
        <WidgetTreeNode
          key={child.id} widget={child} depth={depth + 1}
          sceneId={sceneId} selectedId={selectedId}
          onSelect={onSelect} onRemove={onRemove} onReorder={onReorder}
          initialExpanded={initialExpanded}
        />
      ))}
    </div>
  );
}

export function AddWidgetMenu({ sceneId, parentId, onClose }: { sceneId: string; parentId: string; onClose: () => void }) {
  const addWidget = useEditorStore((s) => s.addWidget);
  const pushCustomSceneUndo = useEditorStore((s) => s.pushCustomSceneUndo);
  const setCustomSceneSelectedWidget = useEditorStore((s) => s.setCustomSceneSelectedWidget);

  const handleAdd = (type: WidgetType) => {
    const id = `${type}_${Date.now()}`;
    let def: WidgetDef;
    switch (type) {
      case 'panel': def = { id, type, x: 0, y: 0, width: 300, height: 200, windowed: true, children: [] }; break;
      case 'label': def = { id, type, x: 0, y: 0, width: 200, height: 36, text: '텍스트' }; break;
      case 'textArea': def = { id, type, x: 0, y: 0, width: 300, height: 80, text: '텍스트' }; break;
      case 'image': def = { id, type, x: 0, y: 0, width: 100, height: 100, imageSource: 'file', imageName: '' }; break;
      case 'gauge': def = { id, type, x: 0, y: 0, width: 200, height: 36, gaugeType: 'hp', actorIndex: 0 }; break;
      case 'background': def = { id, type, x: 0, y: 0, width: 816, height: 624 }; break;
      case 'separator': def = { id, type, x: 0, y: 0, width: 200, height: 4 }; break;
      case 'button': def = { id, type, x: 0, y: 0, width: 200, height: 52, label: '버튼', action: { action: 'popScene' } }; break;
      case 'list': def = { id, type, x: 0, y: 0, width: 200, items: [], handlers: {} }; break;
      case 'rowSelector': def = { id, type, x: 0, y: 0, width: 576, height: 624, numRows: 'party' as const, transparent: true, padding: 0 }; break;
      case 'options': def = { id, type, x: 0, y: 0, width: 400, options: [
        { name: '항상 대시', symbol: 'alwaysDash' },
        { name: '커맨드 기억', symbol: 'commandRemember' },
        { name: 'BGM 볼륨', symbol: 'bgmVolume' },
        { name: 'BGS 볼륨', symbol: 'bgsVolume' },
        { name: 'ME 볼륨', symbol: 'meVolume' },
        { name: 'SE 볼륨', symbol: 'seVolume' },
      ] }; break;
      case 'minimap': def = { id, type, x: 0, y: 0, width: 192, height: 192 }; break;
      default: return;
    }
    pushCustomSceneUndo();
    addWidget(sceneId, parentId, def);
    setCustomSceneSelectedWidget(id);
    onClose();
  };

  const types: WidgetType[] = ['background', 'panel', 'label', 'textArea', 'image', 'gauge', 'separator', 'button', 'list', 'rowSelector', 'options', 'minimap'];
  const typeLabels: Record<WidgetType, string> = {
    background: '배경 (맵 스크린샷)',
    panel: '패널', label: '레이블', textArea: '텍스트 영역 (멀티라인)', image: '이미지',
    gauge: '게이지', separator: '구분선',
    button: '버튼', list: '리스트', rowSelector: '행 선택',
    options: '옵션(블랙박스)',
    minimap: '미니맵 (Minimap 플러그인 필요)',
    scene: '씬 (하위 씬 임베드)',
  };

  return (
    <div style={{
      position: 'absolute', background: '#2a2a2a', border: '1px solid #555',
      borderRadius: 4, padding: 4, zIndex: 100, minWidth: 120,
    }}>
      {types.map((t) => (
        <div key={t} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ddd', borderRadius: 2 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a3a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          onClick={() => handleAdd(t)}>
          <span style={{
            fontSize: 9, padding: '1px 3px', borderRadius: 2, marginRight: 6,
            background: WIDGET_TYPE_COLORS[t] || '#555', color: '#fff',
          }}>{WIDGET_TYPE_LABELS[t]}</span>
          {typeLabels[t]}
        </div>
      ))}
    </div>
  );
}
