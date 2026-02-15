import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { MapInfo } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import MapPropertiesDialog from '../MapEditor/MapPropertiesDialog';
import SampleMapDialog from '../SampleMapDialog';
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

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDoubleClick: (id: number) => void;
  collapsed: Record<number, boolean>;
  onToggle: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, mapId: number) => void;
}

function TreeNode({ node, depth, selectedId, onSelect, onDoubleClick, collapsed, onToggle, onContextMenu }: TreeNodeProps) {
  const isCollapsed = collapsed[node.id];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <>
      <div
        className={`map-tree-node${node.id === selectedId ? ' selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => onDoubleClick(node.id)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node.id); }}
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
  const createMap = useEditorStore((s) => s.createMap);
  const deleteMap = useEditorStore((s) => s.deleteMap);
  const updateMapInfos = useEditorStore((s) => s.updateMapInfos);
  const setShowDatabaseDialog = useEditorStore((s) => s.setShowDatabaseDialog);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [mapPropsId, setMapPropsId] = useState<number | null>(null);
  const [mapPropsName, setMapPropsName] = useState('');
  const [sampleMapTargetId, setSampleMapTargetId] = useState<number | null>(null);

  const tree = useMemo(() => buildTree(maps), [maps]);

  const handleToggle = (id: number) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDoubleClick = useCallback((mapId: number) => {
    const info = maps.find(m => m && m.id === mapId);
    if (info) {
      setMapPropsId(mapId);
      setMapPropsName(info.name);
    }
  }, [maps]);

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

  const handleNewMap = useCallback(async () => {
    const parentId = contextMenu?.mapId || 0;
    closeContextMenu();
    const newId = await createMap({ parentId });
    if (newId) {
      selectMap(newId);
    }
  }, [contextMenu, createMap, selectMap, closeContextMenu]);

  const handleEditMap = useCallback(() => {
    if (!contextMenu) return;
    const info = maps.find(m => m && m.id === contextMenu.mapId);
    if (info) {
      setEditingId(contextMenu.mapId);
      setEditName(info.name);
    }
    closeContextMenu();
  }, [contextMenu, maps, closeContextMenu]);

  const handleMapProperties = useCallback(() => {
    if (!contextMenu) return;
    const info = maps.find(m => m && m.id === contextMenu.mapId);
    if (info) {
      setMapPropsId(contextMenu.mapId);
      setMapPropsName(info.name);
    }
    closeContextMenu();
  }, [contextMenu, maps, closeContextMenu]);

  const handleLoadSampleMap = useCallback(() => {
    if (!contextMenu || contextMenu.mapId <= 0) return;
    setSampleMapTargetId(contextMenu.mapId);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleDeleteMap = useCallback(async () => {
    if (!contextMenu) return;
    const mapId = contextMenu.mapId;
    closeContextMenu();
    if (window.confirm(t('mapTree.confirmDelete', { id: mapId }))) {
      await deleteMap(mapId);
    }
  }, [contextMenu, deleteMap, closeContextMenu, t]);

  const handleRenameSubmit = useCallback(async () => {
    if (editingId === null) return;
    const newMaps = maps.map(m => {
      if (m && m.id === editingId) return { ...m, name: editName };
      return m;
    });
    await updateMapInfos(newMaps);
    setEditingId(null);
  }, [editingId, editName, maps, updateMapInfos]);

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
    <div className="map-tree">
      <div
        className="map-tree-node map-tree-root"
        onClick={() => setRootCollapsed(!rootCollapsed)}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, mapId: 0 }); }}
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
      {!rootCollapsed && tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={1}
          selectedId={currentMapId}
          onSelect={selectMap}
          onDoubleClick={handleDoubleClick}
          collapsed={collapsed}
          onToggle={handleToggle}
          onContextMenu={handleContextMenu}
        />
      ))}

      {editingId !== null && (
        <div className="modal-overlay">
          <div className="map-props-dialog">
            <div className="image-picker-header">{t('mapTree.renameMap')}</div>
            <div className="db-form" style={{ padding: 16 }}>
              <label>
                {t('common.name')}
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); }}
                />
              </label>
            </div>
            <div className="image-picker-footer">
              <button className="db-btn" onClick={handleRenameSubmit}>{t('common.ok')}</button>
              <button className="db-btn" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {mapPropsId !== null && (
        <MapPropertiesDialog
          mapId={mapPropsId}
          mapName={mapPropsName}
          onClose={() => setMapPropsId(null)}
        />
      )}

      {sampleMapTargetId !== null && (
        <SampleMapDialog
          parentId={sampleMapTargetId}
          onClose={() => setSampleMapTargetId(null)}
        />
      )}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="context-menu-item" onClick={handleNewMap}>{t('mapTree.newMap')}</div>
          {contextMenu.mapId > 0 && (
            <>
              <div className="context-menu-item" onClick={handleLoadSampleMap}>{t('mapTree.loadSampleMap')}</div>
              <div className="context-menu-item" onClick={handleMapProperties}>{t('mapTree.mapProperties')}</div>
              <div className="context-menu-item" onClick={handleEditMap}>{t('mapTree.editMapName')}</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={handleDeleteMap}>{t('mapTree.deleteMap')}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
