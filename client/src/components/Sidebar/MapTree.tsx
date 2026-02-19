import React, { useState, useMemo, useCallback, useEffect } from 'react';
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

/** 검색어와 일치하는 부분을 <mark>로 감싸 반환 (대소문자 무시, 연속 substring) */

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  selectedId: number | null;
  selectedDisplayName?: string;
  filterQuery?: string;
  onSelect: (id: number) => void;
  onDoubleClick: (id: number) => void;
  collapsed: Record<number, boolean>;
  onToggle: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, mapId: number) => void;
  startPositions: Record<number, string[]>;
}

function TreeNode({ node, depth, selectedId, selectedDisplayName, filterQuery, onSelect, onDoubleClick, collapsed, onToggle, onContextMenu, startPositions }: TreeNodeProps) {
  const isCollapsed = collapsed[node.id];
  const hasChildren = node.children && node.children.length > 0;
  const badges = startPositions[node.id];
  const idStr = String(node.id).padStart(3, '0');
  const idPrefix = `[${idStr}]`;
  const baseName = node.name || `Map ${node.id}`;
  const isSelected = node.id === selectedId;
  // 선택된 맵은 currentMap의 displayName(최신 편집값) 우선, 아니면 MapInfo에 캐싱된 displayName 사용
  const dn = isSelected ? (selectedDisplayName || node.displayName || '') : (node.displayName || '');

  // 검색어 강조: 각 파트를 분리하여 개별 강조
  const q = filterQuery || '';
  const labelNode = dn ? (
    <>{highlightMatch(baseName, q)}<span style={{ color: '#999' }}>({highlightMatch(dn, q)})</span></>
  ) : highlightMatch(baseName, q);

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
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectMap = useEditorStore((s) => s.selectMap);
  const deleteMap = useEditorStore((s) => s.deleteMap);
  const systemData = useEditorStore((s) => s.systemData);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sampleMapTargetId, setSampleMapTargetId] = useState<number | null>(null);
  const [mapPropertiesId, setMapPropertiesId] = useState<number | null>(null);
  // 신규 맵 생성 모드: parentId를 담아두고 MapPropertiesDialog를 신규 모드로 열기
  const [newMapParentId, setNewMapParentId] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedMapId, setCopiedMapId] = useState<number | null>(null);
  const loadMaps = useEditorStore((s) => s.loadMaps);

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

  // 더블클릭: 맵 속성 다이얼로그(편집 모드) 열기
  const handleDoubleClick = useCallback((mapId: number) => {
    setMapPropertiesId(mapId);
  }, []);

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
      if ((document.activeElement as HTMLElement)?.classList.contains('fuzzy-search-input')) return;
      
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
    </div>
  );
}
