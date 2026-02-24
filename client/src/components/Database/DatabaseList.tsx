import React, { useState, useRef, useCallback } from 'react';
import { useListKeyNav } from '../../hooks/useListKeyNav';

export interface DatabaseListItem {
  id: number;
  name: string;
}

interface DatabaseListProps<T extends DatabaseListItem> {
  items: (T | null)[] | undefined;
  selectedId: number;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onDelete?: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onReorder?: (fromId: number, toId: number) => void;
  title?: string;
}

export default function DatabaseList<T extends DatabaseListItem>({
  items,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onReorder,
  title,
}: DatabaseListProps<T>) {
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below' | null>(null);
  const dragSourceId = useRef<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const filteredItems = items?.filter(Boolean) as T[] | undefined;

  const { handleKeyDown } = useListKeyNav({
    items: filteredItems ?? [],
    selectedKey: selectedId,
    getKey: (item: T) => item.id,
    onSelect,
    listRef: listContainerRef,
  });

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    dragSourceId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    (e.currentTarget as HTMLElement).classList.add('dragging');
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('dragging');
    dragSourceId.current = null;
    setDragOverId(null);
    setDragOverPos(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (dragSourceId.current === null || dragSourceId.current === id) {
      setDragOverId(null);
      setDragOverPos(null);
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';
    setDragOverId(id);
    setDragOverPos(pos);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
    setDragOverPos(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const fromId = dragSourceId.current;
    if (fromId === null || fromId === targetId || !onReorder) return;

    // dragOverPos에 따라 targetId 조정
    if (!filteredItems) return;
    const targetIdx = filteredItems.findIndex(item => item.id === targetId);
    if (targetIdx < 0) return;

    // above이면 targetId 앞에, below이면 targetId 뒤에 삽입
    // onReorder(fromId, toId)에서 toId는 "이 아이템 앞에 삽입"할 위치의 id
    if (dragOverPos === 'below') {
      const nextItem = filteredItems[targetIdx + 1];
      onReorder(fromId, nextItem ? nextItem.id : -1); // -1 = 맨 뒤
    } else {
      onReorder(fromId, targetId);
    }

    setDragOverId(null);
    setDragOverPos(null);
    dragSourceId.current = null;
  }, [onReorder, filteredItems, dragOverPos]);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault();
    onSelect(id);

    const menu = document.createElement('div');
    menu.className = 'db-list-context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const makeItem = (label: string, action: () => void, disabled = false) => {
      const item = document.createElement('div');
      item.className = 'db-list-context-menu-item' + (disabled ? ' disabled' : '');
      item.textContent = label;
      if (!disabled) {
        item.addEventListener('click', () => {
          action();
          cleanup();
        });
      }
      return item;
    };

    const cleanup = () => {
      menu.remove();
      document.removeEventListener('click', cleanup);
      document.removeEventListener('contextmenu', cleanup);
    };

    if (onDuplicate) {
      menu.appendChild(makeItem('복제', () => onDuplicate(id)));
    }
    if (onDelete) {
      const canDelete = filteredItems ? filteredItems.length > 1 : false;
      menu.appendChild(makeItem('삭제', () => onDelete(id), !canDelete));
    }

    if (menu.children.length === 0) return;

    document.body.appendChild(menu);
    requestAnimationFrame(() => {
      document.addEventListener('click', cleanup);
      document.addEventListener('contextmenu', cleanup);
    });
  }, [onSelect, onDuplicate, onDelete, filteredItems]);

  return (
    <div className="db-list" ref={listContainerRef} tabIndex={0} onKeyDown={handleKeyDown} style={{ outline: 'none' }}>
      <div className="db-list-header">
        {title && <span>{title}</span>}
        <button className="db-btn-small" onClick={onAdd} title="추가">+</button>
        {onDuplicate && (
          <button
            className="db-btn-small"
            onClick={() => onDuplicate(selectedId)}
            title="복제"
          >⧉</button>
        )}
        {onDelete && (
          <button
            className="db-btn-small"
            onClick={() => onDelete(selectedId)}
            title="삭제"
            disabled={!filteredItems || filteredItems.length <= 1}
          >-</button>
        )}
      </div>
      {filteredItems?.map((item) => (
        <div
          key={item.id}
          className={
            `db-list-item${item.id === selectedId ? ' selected' : ''}` +
            (dragOverId === item.id && dragOverPos === 'above' ? ' drag-over-above' : '') +
            (dragOverId === item.id && dragOverPos === 'below' ? ' drag-over-below' : '')
          }
          onClick={() => onSelect(item.id)}
          onContextMenu={(e) => handleContextMenu(e, item.id)}
          draggable={!!onReorder}
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item.id)}
        >
          {String(item.id).padStart(4, '0')}: {item.name}
        </div>
      ))}
    </div>
  );
}
