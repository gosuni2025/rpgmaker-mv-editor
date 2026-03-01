import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { MapInfo } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import SampleMapDialog from '../SampleMapDialog';
import MapPropertiesDialog from '../MapEditor/MapPropertiesDialog';
import { highlightMatch } from '../../utils/highlightMatch';
import { fuzzyMatch } from '../../utils/fuzzySearch';
import FuzzySearchInput from '../common/FuzzySearchInput';
import './Sidebar.css';
import './MapTree.css';

interface TreeNodeData extends MapInfo {
  children: TreeNodeData[];
}

interface ContextMenuState {
  x: number;
  y: number;
  mapId: number;
}

interface DragOverInfo {
  id: number;
  position: 'before' | 'after' | 'into';
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

function buildTree(maps: (MapInfo | null)[]): TreeNodeData[] {
  if (!maps || maps.length === 0) return [];

  const byId: Record<number, TreeNodeData> = {};
  const roots: TreeNodeData[] = [];

  maps.forEach((m) => {
    if (!m) return;
    byId[m.id] = { ...m, children: [] };
  });

  maps.forEach((m) => {
    if (!m) return;
    const node = byId[m.id];
    if (m.parentId && byId[m.parentId]) {
      byId[m.parentId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByOrder = (nodes: TreeNodeData[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach(n => sortByOrder(n.children));
  };
  sortByOrder(roots);

  return roots;
}

function filterTree(nodes: TreeNodeData[], query: string): TreeNodeData[] {
  if (!query) return nodes;
  const result: TreeNodeData[] = [];
  for (const node of nodes) {
    const filteredChildren = filterTree(node.children, query);
    const idStr = String(node.id).padStart(3, '0');
    const selfMatch = fuzzyMatch(node.name || `Map ${node.id}`, query)
      || fuzzyMatch(idStr, query)
      || (!!node.displayName && fuzzyMatch(node.displayName, query));
    if (selfMatch || filteredChildren.length > 0) {
      result.push({ ...node, children: selfMatch && filteredChildren.length === 0 ? [] : filteredChildren.length > 0 ? filteredChildren : [] });
    }
  }
  return result;
}

/** DFS 평탄화: 드래그 범위 선택(Shift+click) 기준용 */
function flattenTree(nodes: TreeNodeData[], collapsed: Record<number, boolean>): number[] {
  const result: number[] = [];
  const visit = (node: TreeNodeData) => {
    result.push(node.id);
    if (!collapsed[node.id] && node.children.length > 0) {
      node.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return result;
}

// ── Drag-drop helpers ─────────────────────────────────────────────────────────

function isDescendant(maps: (MapInfo | null)[], nodeId: number, potentialAncestorId: number): boolean {
  let current = maps.find(m => m?.id === nodeId);
  while (current && current.parentId !== 0) {
    if (current.parentId === potentialAncestorId) return true;
    current = maps.find(m => m?.id === current!.parentId);
  }
  return false;
}

function recompactSiblings(maps: (MapInfo | null)[], parentId: number, excludeId: number) {
  const siblings = maps
    .filter(m => m && m.parentId === parentId && m.id !== excludeId)
    .sort((a, b) => a!.order - b!.order);
  siblings.forEach((m, idx) => { if (m) m.order = idx; });
}

function applyDrop(
  maps: (MapInfo | null)[],
  draggingId: number,
  targetId: number,
  position: 'before' | 'after' | 'into'
): (MapInfo | null)[] {
  if (draggingId === targetId) return maps;

  const newMaps = maps.map(m => m ? { ...m } : null);
  const dragging = newMaps.find(m => m?.id === draggingId);
  const target = newMaps.find(m => m?.id === targetId);
  if (!dragging || !target) return maps;

  const newParentId = position === 'into' ? targetId : target.parentId;
  if (isDescendant(newMaps, newParentId, draggingId) || newParentId === draggingId) return maps;

  const oldParentId = dragging.parentId;

  if (position === 'into') {
    const existingChildren = newMaps.filter(m => m && m.parentId === targetId && m.id !== draggingId);
    const maxOrder = existingChildren.length > 0 ? Math.max(...existingChildren.map(m => m!.order)) : -1;
    dragging.parentId = targetId;
    dragging.order = maxOrder + 1;
    recompactSiblings(newMaps, oldParentId, draggingId);
  } else {
    const newSiblings = newMaps
      .filter(m => m && m.parentId === newParentId && m.id !== draggingId)
      .sort((a, b) => a!.order - b!.order);

    const targetIdx = newSiblings.findIndex(m => m!.id === targetId);
    if (targetIdx === -1) return maps;

    dragging.parentId = newParentId;
    newSiblings.splice(position === 'before' ? targetIdx : targetIdx + 1, 0, dragging);
    newSiblings.forEach((m, idx) => { if (m) m.order = idx; });

    if (oldParentId !== newParentId) {
      recompactSiblings(newMaps, oldParentId, draggingId);
    }
  }

  return newMaps;
}

/** 여러 맵을 동시에 이동. DFS 순서 기준으로 처리 */
function applyMultiDrop(
  maps: (MapInfo | null)[],
  draggingIds: number[],
  targetId: number,
  position: 'before' | 'after' | 'into',
  flatOrder: number[]
): (MapInfo | null)[] {
  // 드래그 대상 중 targetId나 그 조상을 제외
  const validIds = draggingIds.filter(id => {
    if (id === targetId) return false;
    if (isDescendant(maps, targetId, id)) return false; // target이 id의 자손이면 제외
    return true;
  });
  if (validIds.length === 0) return maps;
  if (validIds.length === 1) return applyDrop(maps, validIds[0], targetId, position);

  // flatOrder 기준으로 정렬
  const sorted = [...validIds].sort((a, b) => {
    const ia = flatOrder.indexOf(a);
    const ib = flatOrder.indexOf(b);
    return ia - ib;
  });

  let current = maps;
  if (position === 'before') {
    // 순서대로 각각 targetId 앞에 삽입 → [A, B, C, target, ...]
    for (const id of sorted) {
      current = applyDrop(current, id, targetId, 'before');
    }
  } else if (position === 'after') {
    // 역순으로 각각 targetId 뒤에 삽입 → [target, A, B, C, ...]
    for (const id of [...sorted].reverse()) {
      current = applyDrop(current, id, targetId, 'after');
    }
  } else {
    // 순서대로 target의 자식으로 추가
    for (const id of sorted) {
      current = applyDrop(current, id, targetId, 'into');
    }
  }

  return current;
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  selectedId: number | null;
  selectedDisplayName?: string;
  filterQuery?: string;
  onSelect: (id: number, e: React.MouseEvent) => void;
  onDoubleClick: (id: number) => void;
  collapsed: Record<number, boolean>;
  onToggle: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, mapId: number) => void;
  startPositions: Record<number, string[]>;
  multiSelectedIds: Set<number>;
  draggingIds: Set<number>;
  dragOverInfo: DragOverInfo | null;
  onDragStart: (id: number) => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, targetId: number, position: 'before' | 'after' | 'into') => void;
}

function TreeNode({ node, depth, selectedId, selectedDisplayName, filterQuery, onSelect, onDoubleClick, collapsed, onToggle, onContextMenu, startPositions, multiSelectedIds, draggingIds, dragOverInfo, onDragStart, onDragOver, onDragEnd, onDrop }: TreeNodeProps) {
  const isCollapsed = collapsed[node.id];
  const hasChildren = node.children && node.children.length > 0;
  const badges = startPositions[node.id];
  const idStr = String(node.id).padStart(3, '0');
  const idPrefix = `[${idStr}]`;
  const baseName = node.name || `Map ${node.id}`;
  const isSelected = node.id === selectedId;
  const isMultiSelected = multiSelectedIds.has(node.id);
  const isDraggingThis = draggingIds.has(node.id);
  const isOver = dragOverInfo?.id === node.id;
  const overPos = isOver ? dragOverInfo!.position : null;
  const dn = isSelected ? (selectedDisplayName || node.displayName || '') : (node.displayName || '');

  const q = filterQuery || '';
  const labelNode = dn ? (
    <>{highlightMatch(baseName, q)}<span style={{ color: '#999' }}>({highlightMatch(dn, q)})</span></>
  ) : highlightMatch(baseName, q);

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

  return (
    <>
      <div
        className={`map-tree-node${isSelected ? ' selected' : ''}${isMultiSelected && !isSelected ? ' multi-selected' : ''}${isDraggingThis ? ' map-tree-dragging' : ''}`}
        data-drag-over={overPos ?? undefined}
        style={{ paddingLeft: 8 + depth * 16 }}
        draggable
        onClick={(e) => onSelect(node.id, e)}
        onDoubleClick={() => onDoubleClick(node.id)}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node.id); }}
        onDragStart={(e) => { e.stopPropagation(); onDragStart(node.id); }}
        onDragOver={handleDragOver}
        onDragEnd={onDragEnd}
        onDrop={handleDrop}
      >
        <span
          className="map-tree-toggle"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
        >
          {hasChildren ? (isCollapsed ? '▶' : '▼') : ''}
        </span>
        <span className="map-tree-label">
          <span style={{ color: '#888' }}>{highlightMatch(idPrefix, q)}</span>{' '}{labelNode}
        </span>
        {badges && badges.map((badge) => (
          <span key={badge} className="map-tree-badge" title={badge}>{badge}</span>
        ))}
      </div>
      {hasChildren && !isCollapsed &&
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
          />
        ))
      }
    </>
  );
}

// ── MapTree ───────────────────────────────────────────────────────────────────

export default function MapTree() {
  const { t } = useTranslation();
  const maps = useEditorStore((s) => s.maps);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectMap = useEditorStore((s) => s.selectMap);
  const clearCurrentMap = useEditorStore((s) => s.clearCurrentMap);
  const deleteMap = useEditorStore((s) => s.deleteMap);
  const updateMapInfos = useEditorStore((s) => s.updateMapInfos);
  const systemData = useEditorStore((s) => s.systemData);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sampleMapTargetId, setSampleMapTargetId] = useState<number | null>(null);
  const [mapPropertiesId, setMapPropertiesId] = useState<number | null>(null);
  const [newMapParentId, setNewMapParentId] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedMapId, setCopiedMapId] = useState<number | null>(null);
  const loadMaps = useEditorStore((s) => s.loadMaps);

  // Multi-select state
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<number>>(new Set());
  const lastClickedIdRef = useRef<number | null>(null);

  // Drag state
  const [draggingIds, setDraggingIds] = useState<Set<number>>(new Set());
  const [dragOverInfo, setDragOverInfo] = useState<DragOverInfo | null>(null);
  const draggingIdsRef = useRef<Set<number>>(new Set());

  const tree = useMemo(() => buildTree(maps), [maps]);
  const filteredTree = useMemo(() => filterTree(tree, filterQuery), [tree, filterQuery]);
  const flatOrder = useMemo(() => flattenTree(filteredTree, collapsed), [filteredTree, collapsed]);

  const startPositions = useMemo(() => {
    const result: Record<number, string[]> = {};
    if (!systemData) return result;
    const add = (mapId: number, label: string) => {
      if (!mapId) return;
      if (!result[mapId]) result[mapId] = [];
      result[mapId].push(label);
    };
    if (systemData.startMapId) add(systemData.startMapId, t('mapTree.badgePlayer', '플레이어 시작점'));
    if (systemData.boat?.startMapId) add(systemData.boat.startMapId, t('mapTree.badgeBoat', '보트'));
    if (systemData.ship?.startMapId) add(systemData.ship.startMapId, t('mapTree.badgeShip', '선박'));
    if (systemData.airship?.startMapId) add(systemData.airship.startMapId, t('mapTree.badgeAirship', '비행선'));
    return result;
  }, [systemData, t]);

  const handleToggle = (id: number) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 맵 선택 (Ctrl+click: 토글, Shift+click: 범위, 일반: 단일)
  const handleSelect = useCallback((id: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // 토글
      setMultiSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        if (next.size > 1) {
          clearCurrentMap();
        } else if (next.size === 1) {
          const [singleId] = next;
          selectMap(singleId);
        }
        return next;
      });
      lastClickedIdRef.current = id;
    } else if (e.shiftKey && lastClickedIdRef.current !== null) {
      // 범위 선택
      const fromIdx = flatOrder.indexOf(lastClickedIdRef.current);
      const toIdx = flatOrder.indexOf(id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        const rangeIds = new Set(flatOrder.slice(start, end + 1));
        setMultiSelectedIds(rangeIds);
        if (rangeIds.size > 1) {
          clearCurrentMap();
        } else {
          selectMap(id);
        }
      }
    } else {
      // 단일 선택
      setMultiSelectedIds(new Set());
      lastClickedIdRef.current = id;
      selectMap(id);
    }
  }, [flatOrder, selectMap, clearCurrentMap]);

  const handleDoubleClick = useCallback((mapId: number) => {
    setMapPropertiesId(mapId);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, mapId: number) => {
    setContextMenu({ x: e.clientX, y: e.clientY, mapId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.context-menu')) return;
      closeContextMenu();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [contextMenu, closeContextMenu]);

  const handleNewMap = useCallback(() => {
    const parentId = contextMenu?.mapId ?? 0;
    closeContextMenu();
    setNewMapParentId(parentId);
  }, [contextMenu, closeContextMenu]);

  const handleMapProperties = useCallback(() => {
    if (!contextMenu) return;
    setMapPropertiesId(contextMenu.mapId);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleLoadSampleMap = useCallback(() => {
    if (!contextMenu) return;
    setSampleMapTargetId(contextMenu.mapId);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleDeleteMapById = useCallback(async (mapId: number) => {
    if (mapId === 0) return;
    const hasChildren = maps.some(m => m && m.parentId === mapId);
    const mapName = maps.find(m => m && m.id === mapId)?.name ?? '';
    const msg = hasChildren
      ? t('mapTree.confirmDeleteWithChildren', { name: mapName, id: mapId })
      : t('mapTree.confirmDelete', { name: mapName, id: mapId });
    if (window.confirm(msg)) {
      await deleteMap(mapId);
    }
  }, [deleteMap, maps, t]);

  const handleDeleteMap = useCallback(async () => {
    if (!contextMenu) return;
    const mapId = contextMenu.mapId;
    closeContextMenu();
    await handleDeleteMapById(mapId);
  }, [contextMenu, closeContextMenu, handleDeleteMapById]);

  const handleCopyMap = useCallback(() => {
    const targetId = contextMenu?.mapId ?? currentMapId;
    if (targetId && targetId > 0) {
      setCopiedMapId(targetId);
    }
    closeContextMenu();
  }, [contextMenu, currentMapId, closeContextMenu]);

  const handlePasteMap = useCallback(async () => {
    if (!copiedMapId) return;
    closeContextMenu();
    try {
      const result = await apiClient.post<{ id: number }>(`/maps/${copiedMapId}/duplicate`, {});
      if (result.id) {
        await loadMaps();
        selectMap(result.id);
      }
    } catch (err) {
      console.error('Failed to paste map:', err);
    }
  }, [copiedMapId, loadMaps, selectMap, closeContextMenu]);

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((id: number) => {
    // 드래그하는 노드가 멀티선택에 포함되어 있으면 전체 선택 이동
    const ids = multiSelectedIds.has(id) && multiSelectedIds.size > 1
      ? new Set(multiSelectedIds)
      : new Set([id]);
    setDraggingIds(ids);
    draggingIdsRef.current = ids;
  }, [multiSelectedIds]);

  const handleDragOver = useCallback((e: React.DragEvent, id: number) => {
    if (draggingIdsRef.current.has(id)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const position: 'before' | 'after' | 'into' = ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'into';
    setDragOverInfo(prev => {
      if (prev?.id === id && prev?.position === position) return prev;
      return { id, position };
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingIds(new Set());
    setDragOverInfo(null);
    draggingIdsRef.current = new Set();
  }, []);

  const handleDrop = useCallback(async (_e: React.DragEvent, targetId: number, position: 'before' | 'after' | 'into') => {
    const srcIds = draggingIdsRef.current;
    setDraggingIds(new Set());
    setDragOverInfo(null);
    draggingIdsRef.current = new Set();

    if (srcIds.size === 0) return;

    const srcArr = Array.from(srcIds);
    const newMaps = srcArr.length === 1
      ? applyDrop(maps, srcArr[0], targetId, position)
      : applyMultiDrop(maps, srcArr, targetId, position, flatOrder);

    if (newMaps === maps) return;

    try {
      await updateMapInfos(newMaps);
      if (position === 'into') {
        setCollapsed(prev => ({ ...prev, [targetId]: false }));
      }
      setMultiSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to reorder maps:', err);
    }
  }, [maps, updateMapInfos, flatOrder]);

  const projectName = useEditorStore((s) => s.projectName);
  const [rootCollapsed, setRootCollapsed] = useState(false);

  if (!maps || maps.length === 0) {
    return (
      <div
        className="map-tree"
        style={{ padding: '8px', color: '#666' }}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, mapId: 0 }); }}
      >
        {t('mapTree.openProject')}
      </div>
    );
  }

  return (
    <div className="map-tree" tabIndex={-1} onKeyDown={(e) => {
      if ((document.activeElement as HTMLElement)?.classList.contains('fuzzy-search-input')) return;

      if (e.key === 'Escape') {
        setMultiSelectedIds(new Set());
      }
      if (e.key === 'Delete' && currentMapId != null && currentMapId !== 0) {
        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();
        handleDeleteMapById(currentMapId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && currentMapId != null && currentMapId !== 0) {
        e.preventDefault();
        setCopiedMapId(currentMapId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedMapId != null) {
        e.preventDefault();
        handlePasteMap();
      }
    }} onContextMenu={(e) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, mapId: 0 });
    }}>
      <div
        className="map-tree-node map-tree-root"
        onClick={() => setRootCollapsed(!rootCollapsed)}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, mapId: 0 }); }}
      >
        <span className="map-tree-toggle">{rootCollapsed ? '▶' : '▼'}</span>
        <span className="map-tree-label">{projectName || t('mapTree.project')}</span>
        <span
          className="map-tree-folder-btn"
          title={t('menu.openFolder')}
          onClick={(e) => { e.stopPropagation(); apiClient.post('/project/open-folder', { subfolder: 'data' }).catch(() => {}); }}
        >
          📂
        </span>
      </div>
      {!rootCollapsed && (
        <>
          <FuzzySearchInput
            value={filterQuery}
            onChange={setFilterQuery}
            placeholder={t('mapTree.searchPlaceholder', '맵 검색...')}
          />
          {filteredTree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={1}
              selectedId={currentMapId}
              selectedDisplayName={currentMap?.displayName || undefined}
              filterQuery={filterQuery}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              collapsed={filterQuery ? {} : collapsed}
              onToggle={handleToggle}
              onContextMenu={handleContextMenu}
              startPositions={startPositions}
              multiSelectedIds={multiSelectedIds}
              draggingIds={filterQuery ? new Set() : draggingIds}
              dragOverInfo={filterQuery ? null : dragOverInfo}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            />
          ))}
        </>
      )}

      {sampleMapTargetId !== null && (
        <SampleMapDialog
          parentId={sampleMapTargetId}
          onClose={() => setSampleMapTargetId(null)}
        />
      )}

      {mapPropertiesId !== null && (
        <MapPropertiesDialog
          mapId={mapPropertiesId}
          onClose={() => setMapPropertiesId(null)}
        />
      )}

      {newMapParentId !== null && (
        <MapPropertiesDialog
          parentId={newMapParentId}
          onClose={() => setNewMapParentId(null)}
        />
      )}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="context-menu-item" onClick={handleNewMap}>{t('mapTree.newMap')}</div>
          <div className="context-menu-item" onClick={handleLoadSampleMap}>{t('mapTree.loadSampleMap')}</div>
          {contextMenu.mapId > 0 && (
            <>
              <div className="context-menu-item" onClick={handleMapProperties}>{t('mapTree.mapProperties')}</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={handleCopyMap}>
                {t('mapTree.copyMap', '맵 복사')}
                <span className="context-menu-shortcut">Ctrl+C</span>
              </div>
              <div
                className={`context-menu-item${!copiedMapId ? ' disabled' : ''}`}
                onClick={copiedMapId ? handlePasteMap : undefined}
              >
                {t('mapTree.pasteMap', '맵 붙여넣기')}
                <span className="context-menu-shortcut">Ctrl+V</span>
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={handleDeleteMap}>{t('mapTree.deleteMap')}</div>
            </>
          )}
          {contextMenu.mapId === 0 && copiedMapId && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={handlePasteMap}>
                {t('mapTree.pasteMap', '맵 붙여넣기')}
                <span className="context-menu-shortcut">Ctrl+V</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
