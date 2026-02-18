import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { MapInfo } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import SampleMapDialog from '../SampleMapDialog';
import MapPropertiesDialog from '../MapEditor/MapPropertiesDialog';
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

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let ti = 0;
  for (let qi = 0; qi < lowerQuery.length; qi++) {
    const idx = lowerText.indexOf(lowerQuery[qi], ti);
    if (idx < 0) return false;
    ti = idx + 1;
  }
  return true;
}

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

  return roots;
}

function filterTree(nodes: TreeNodeData[], query: string): TreeNodeData[] {
  if (!query) return nodes;
  const result: TreeNodeData[] = [];
  for (const node of nodes) {
    const filteredChildren = filterTree(node.children, query);
    const selfMatch = fuzzyMatch(node.name || `Map ${node.id}`, query);
    if (selfMatch || filteredChildren.length > 0) {
      result.push({ ...node, children: selfMatch && filteredChildren.length === 0 ? [] : filteredChildren.length > 0 ? filteredChildren : [] });
    }
  }
  return result;
}

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDoubleClick: (id: number) => void;
  collapsed: Record<number, boolean>;
  onToggle: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, mapId: number) => void;
  startPositions: Record<number, string[]>;
}

function TreeNode({ node, depth, selectedId, onSelect, onDoubleClick, collapsed, onToggle, onContextMenu, startPositions }: TreeNodeProps) {
  const isCollapsed = collapsed[node.id];
  const hasChildren = node.children && node.children.length > 0;
  const badges = startPositions[node.id];

  return (
    <>
      <div
        className={`map-tree-node${node.id === selectedId ? ' selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => onDoubleClick(node.id)}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node.id); }}
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
        <span className="map-tree-label">{node.name || `Map ${node.id}`}</span>
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
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            collapsed={collapsed}
            onToggle={onToggle}
            onContextMenu={onContextMenu}
            startPositions={startPositions}
          />
        ))
      }
    </>
  );
}

export default function MapTree() {
  const { t } = useTranslation();
  const maps = useEditorStore((s) => s.maps);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const selectMap = useEditorStore((s) => s.selectMap);
  const deleteMap = useEditorStore((s) => s.deleteMap);
  const renameMap = useEditorStore((s) => s.renameMap);
  const systemData = useEditorStore((s) => s.systemData);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sampleMapTargetId, setSampleMapTargetId] = useState<number | null>(null);
  const [mapPropertiesId, setMapPropertiesId] = useState<number | null>(null);
  // 신규 맵 생성 모드: parentId를 담아두고 MapPropertiesDialog를 신규 모드로 열기
  const [newMapParentId, setNewMapParentId] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedMapId, setCopiedMapId] = useState<number | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const loadMaps = useEditorStore((s) => s.loadMaps);

  // 이름 변경 다이얼로그 state
  const [renameMapId, setRenameMapId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const tree = useMemo(() => buildTree(maps), [maps]);
  const filteredTree = useMemo(() => filterTree(tree, filterQuery), [tree, filterQuery]);

  // Build a map of mapId -> badge labels for start positions
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

  const handleDoubleClick = useCallback((mapId: number) => {
    const mapInfo = maps.find(m => m && m.id === mapId);
    if (!mapInfo) return;
    setRenameDraft(mapInfo.name || `Map ${mapId}`);
    setRenameMapId(mapId);
  }, [maps]);

  const handleRenameConfirm = useCallback(async () => {
    if (renameMapId == null) return;
    const trimmed = renameDraft.trim();
    if (trimmed) {
      await renameMap(renameMapId, trimmed);
    }
    setRenameMapId(null);
  }, [renameMapId, renameDraft, renameMap]);

  const handleRenameCancel = useCallback(() => {
    setRenameMapId(null);
  }, []);

  // 이름 변경 다이얼로그 열릴 때 input 포커스
  useEffect(() => {
    if (renameMapId != null) {
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [renameMapId]);

  const handleContextMenu = useCallback((e: React.MouseEvent, mapId: number) => {
    setContextMenu({ x: e.clientX, y: e.clientY, mapId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
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

  // 복사 기능
  const handleCopyMap = useCallback(() => {
    const targetId = contextMenu?.mapId ?? currentMapId;
    if (targetId && targetId > 0) {
      setCopiedMapId(targetId);
    }
    closeContextMenu();
  }, [contextMenu, currentMapId, closeContextMenu]);

  // 붙여넣기 기능
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
      // 검색 입력 중에는 단축키 무시
      if (document.activeElement === searchInputRef.current) return;
      
      if (e.key === 'Delete' && currentMapId != null && currentMapId !== 0) {
        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();
        handleDeleteMapById(currentMapId);
      }
      // Ctrl+C: 맵 복사
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && currentMapId != null && currentMapId !== 0) {
        e.preventDefault();
        setCopiedMapId(currentMapId);
      }
      // Ctrl+V: 맵 붙여넣기
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedMapId != null) {
        e.preventDefault();
        handlePasteMap();
      }
    }} onContextMenu={(e) => {
      // 빈 공간 우클릭 시 루트 레벨 컨텍스트 메뉴 표시
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
          <div className="map-tree-search">
            <input
              ref={searchInputRef}
              type="text"
              className="map-tree-search-input"
              placeholder={t('mapTree.searchPlaceholder', '맵 검색...')}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFilterQuery('');
                  searchInputRef.current?.blur();
                }
                e.stopPropagation();
              }}
            />
            {filterQuery && (
              <span className="map-tree-search-clear" onClick={() => { setFilterQuery(''); searchInputRef.current?.focus(); }}>×</span>
            )}
          </div>
          {filteredTree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={1}
              selectedId={currentMapId}
              onSelect={selectMap}
              onDoubleClick={handleDoubleClick}
              collapsed={filterQuery ? {} : collapsed}
              onToggle={handleToggle}
              onContextMenu={handleContextMenu}
              startPositions={startPositions}
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

      {renameMapId != null && (
        <div className="modal-overlay" onClick={handleRenameCancel}>
          <div className="modal-dialog" style={{ width: 320 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">{t('mapTree.renameMap', '맵 이름 변경')}</div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <input
                ref={renameInputRef}
                type="text"
                className="db-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleRenameConfirm(); }
                  if (e.key === 'Escape') handleRenameCancel();
                }}
              />
            </div>
            <div className="modal-footer">
              <button className="db-btn db-btn-primary" onClick={handleRenameConfirm}>{t('common.ok', '확인')}</button>
              <button className="db-btn" onClick={handleRenameCancel}>{t('common.cancel', '취소')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
