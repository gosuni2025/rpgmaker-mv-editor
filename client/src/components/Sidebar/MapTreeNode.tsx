import React, { useEffect, useRef } from 'react';
import { highlightMatch } from '../../utils/highlightMatch';
import type { TreeNodeData } from './mapTreeUtils';

export interface DragOverInfo {
  id: number;
  position: 'before' | 'after' | 'into';
}

export interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  selectedId: number | null;
  selectedDisplayName?: string;
  filterQuery?: string;
  onSelect: (id: number, e: React.MouseEvent) => void;
  onDoubleClick: (id: number) => void;
  onFolderToggle: (id: number) => void;
  collapsed: Record<number, boolean>;
  onToggle: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, mapId: number, isFolder: boolean) => void;
  startPositions: Record<number, string[]>;
  multiSelectedIds: Set<number>;
  draggingIds: Set<number>;
  dragOverInfo: DragOverInfo | null;
  onDragStart: (id: number) => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, targetId: number, position: 'before' | 'after' | 'into') => void;
  editingFolderId: number | null;
  editingFolderName: string;
  onEditChange: (name: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
}

export function TreeNode({ node, depth, selectedId, selectedDisplayName, filterQuery, onSelect, onDoubleClick, onFolderToggle, collapsed, onToggle, onContextMenu, startPositions, multiSelectedIds, draggingIds, dragOverInfo, onDragStart, onDragOver, onDragEnd, onDrop, editingFolderId, editingFolderName, onEditChange, onEditCommit, onEditCancel }: TreeNodeProps) {
  const isCollapsed = collapsed[node.id];
  const hasChildren = node.children && node.children.length > 0;
  const badges = !node.isFolder ? startPositions[node.id] : undefined;
  const idStr = String(node.id).padStart(3, '0');
  const isSelected = !node.isFolder && node.id === selectedId;
  const isMultiSelected = multiSelectedIds.has(node.id);
  const isDraggingThis = draggingIds.has(node.id);
  const isOver = dragOverInfo?.id === node.id;
  const overPos = isOver ? dragOverInfo!.position : null;
  const isEditingThis = node.isFolder && editingFolderId === node.id;

  const q = filterQuery || '';

  const editInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isEditingThis) editInputRef.current?.select();
  }, [isEditingThis]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(e, node.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverInfo && dragOverInfo.id === node.id) {
      onDrop(e, node.id, dragOverInfo.position);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (node.isFolder) {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) onFolderToggle(node.id);
      onSelect(node.id, e);
    } else {
      onSelect(node.id, e);
    }
  };

  const folderLabel = node.isFolder ? (
    <span className="map-tree-folder-name">
      {isEditingThis ? (
        <input
          ref={editInputRef}
          className="map-tree-folder-edit"
          value={editingFolderName}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onEditCommit}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter') onEditCommit();
            if (e.key === 'Escape') onEditCancel();
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        highlightMatch(node.name, q)
      )}
    </span>
  ) : null;

  const dn = isSelected ? (selectedDisplayName || node.displayName || '') : (node.displayName || '');
  const mapLabel = !node.isFolder ? (
    <>
      <span style={{ color: '#888' }}>{highlightMatch(`[${idStr}]`, q)}</span>{' '}
      {dn
        ? <>{highlightMatch(node.name || `Map ${node.id}`, q)}<span style={{ color: '#999' }}>({highlightMatch(dn, q)})</span></>
        : highlightMatch(node.name || `Map ${node.id}`, q)
      }
    </>
  ) : null;

  return (
    <>
      <div
        className={`map-tree-node${isSelected ? ' selected' : ''}${isMultiSelected && !isSelected ? ' multi-selected' : ''}${isDraggingThis ? ' map-tree-dragging' : ''}${node.isFolder ? ' map-tree-folder-node' : ''}`}
        data-drag-over={overPos ?? undefined}
        style={{ paddingLeft: 8 + depth * 16 }}
        draggable
        onClick={handleClick}
        onDoubleClick={() => !isEditingThis && onDoubleClick(node.id)}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node.id, node.isFolder ?? false); }}
        onDragStart={(e) => { e.stopPropagation(); onDragStart(node.id); }}
        onDragOver={handleDragOver}
        onDragEnd={onDragEnd}
        onDrop={handleDrop}
      >
        <span
          className="map-tree-toggle"
          onClick={(e) => { e.stopPropagation(); if (hasChildren || node.isFolder) onToggle(node.id); }}
        >
          {node.isFolder
            ? (isCollapsed ? '▶' : '▼')
            : (hasChildren ? (isCollapsed ? '▶' : '▼') : '')}
        </span>
        {node.isFolder && (
          <span className="map-tree-folder-icon">{isCollapsed ? '📁' : '📂'}</span>
        )}
        <span className="map-tree-label">
          {node.isFolder ? folderLabel : mapLabel}
        </span>
        {badges && badges.map((badge) => (
          <span key={badge} className="map-tree-badge" title={badge}>{badge}</span>
        ))}
      </div>
      {!isCollapsed &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            selectedDisplayName={selectedDisplayName}
            filterQuery={filterQuery}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            onFolderToggle={onFolderToggle}
            collapsed={collapsed}
            onToggle={onToggle}
            onContextMenu={onContextMenu}
            startPositions={startPositions}
            multiSelectedIds={multiSelectedIds}
            draggingIds={draggingIds}
            dragOverInfo={dragOverInfo}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            editingFolderId={editingFolderId}
            editingFolderName={editingFolderName}
            onEditChange={onEditChange}
            onEditCommit={onEditCommit}
            onEditCancel={onEditCancel}
          />
        ))
      }
    </>
  );
}
