import React, { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';
import useEditorStore from './store/useEditorStore';
import MenuBar from './components/MenuBar/MenuBar';
import MapTree from './components/Sidebar/MapTree';
import TilesetPalette from './components/Sidebar/TilesetPalette';
import ResizablePanel from './components/common/ResizablePanel';
import StatusBar from './components/common/StatusBar';
import DatabaseDialog from './components/Database/DatabaseDialog';
import OpenProjectDialog from './components/OpenProjectDialog';
import { addRecentProject } from './components/OpenProjectDialog';
import MapCanvas from './components/MapEditor/MapCanvas';
import DrawToolbar from './components/MapEditor/DrawToolbar';
import NewProjectDialog from './components/NewProjectDialog';
import DeployDialog from './components/DeployDialog';
import FindDialog from './components/FindDialog';
import PluginManagerDialog from './components/PluginManagerDialog';
import SoundTestDialog from './components/SoundTestDialog';
import EventSearchDialog from './components/EventSearchDialog';
import ResourceManagerDialog from './components/ResourceManagerDialog';
import CharacterGeneratorDialog from './components/CharacterGeneratorDialog';
import AutotileDebugDialog from './components/AutotileDebugDialog';
import LightInspector from './components/Sidebar/LightInspector';
import ObjectInspector from './components/Sidebar/ObjectInspector';
import useFileWatcher from './hooks/useFileWatcher';

function SidebarSplit({ editMode }: { editMode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (ev.clientY - rect.top) / rect.height;
      setSplitRatio(Math.max(0.15, Math.min(0.85, ratio)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const showTileset = editMode === 'map' || editMode === 'object' || editMode === 'light';

  return (
    <div className="sidebar-split" ref={containerRef}>
      {showTileset && (
        <div className="sidebar-top" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
          <TilesetPalette />
        </div>
      )}
      {showTileset && (
        <div className="sidebar-split-handle" onMouseDown={handleMouseDown} />
      )}
      <div className="sidebar-bottom" style={showTileset ? { flex: `0 0 ${(1 - splitRatio) * 100}%` } : { flex: 1 }}>
        <MapTree />
      </div>
    </div>
  );
}

export default function App() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const currentMap = useEditorStore((s) => s.currentMap);
  const editMode = useEditorStore((s) => s.editMode);
  const showDatabaseDialog = useEditorStore((s) => s.showDatabaseDialog);
  const showOpenProjectDialog = useEditorStore((s) => s.showOpenProjectDialog);
  const showNewProjectDialog = useEditorStore((s) => s.showNewProjectDialog);
  const showDeployDialog = useEditorStore((s) => s.showDeployDialog);
  const showFindDialog = useEditorStore((s) => s.showFindDialog);
  const showPluginManagerDialog = useEditorStore((s) => s.showPluginManagerDialog);
  const showSoundTestDialog = useEditorStore((s) => s.showSoundTestDialog);
  const showEventSearchDialog = useEditorStore((s) => s.showEventSearchDialog);
  const showResourceManagerDialog = useEditorStore((s) => s.showResourceManagerDialog);
  const showCharacterGeneratorDialog = useEditorStore((s) => s.showCharacterGeneratorDialog);
  const toastMessage = useEditorStore((s) => s.toastMessage);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const [showAutotileDebug, setShowAutotileDebug] = useState(false);
  useFileWatcher();
  const setShowOpenProjectDialog = useEditorStore((s) => s.setShowOpenProjectDialog);
  const openProject = useEditorStore((s) => s.openProject);
  const restoreLastProject = useEditorStore((s) => s.restoreLastProject);

  useEffect(() => {
    restoreLastProject();
  }, [restoreLastProject]);

  useEffect(() => {
    const handler = () => setShowAutotileDebug(true);
    window.addEventListener('editor-autotile-debug', handler);
    return () => window.removeEventListener('editor-autotile-debug', handler);
  }, []);

  const handleOpenProject = async (path: string) => {
    setShowOpenProjectDialog(false);
    await openProject(path);
    const name = useEditorStore.getState().projectName;
    addRecentProject(path, name || '');
  };

  return (
    <div className={`app-layout${(lightEditMode || editMode === 'object') ? ' with-inspector' : ''}`}>
      <MenuBar />

      <div className="sidebar">
        <ResizablePanel defaultWidth={260} minWidth={150} maxWidth={500}>
          <SidebarSplit editMode={editMode} />
        </ResizablePanel>
      </div>

      <div className="main-area">
        {!projectPath ? (
          <div className="main-placeholder">
            <h2>RPG Maker MV Editor</h2>
            <p>파일 &gt; 프로젝트 열기로 프로젝트를 열어주세요</p>
          </div>
        ) : !currentMap ? (
          <div className="main-placeholder">
            <p>맵을 선택해주세요</p>
          </div>
        ) : (
          <div className="map-editor-area">
            <DrawToolbar />
            <MapCanvas />
          </div>
        )}
      </div>

      {(lightEditMode || editMode === 'object') && (
        <div className="inspector-area">
          {editMode === 'object' ? <ObjectInspector /> : <LightInspector />}
        </div>
      )}

      <StatusBar />

      {showOpenProjectDialog && (
        <OpenProjectDialog
          onOpen={handleOpenProject}
          onClose={() => setShowOpenProjectDialog(false)}
        />
      )}
      {showNewProjectDialog && <NewProjectDialog />}
      {showDatabaseDialog && <DatabaseDialog />}
      {showDeployDialog && <DeployDialog />}
      {showFindDialog && <FindDialog />}
      {showPluginManagerDialog && <PluginManagerDialog />}
      {showSoundTestDialog && <SoundTestDialog />}
      {showEventSearchDialog && <EventSearchDialog />}
      {showResourceManagerDialog && <ResourceManagerDialog />}
      {showCharacterGeneratorDialog && <CharacterGeneratorDialog />}
      <AutotileDebugDialog open={showAutotileDebug} onClose={() => setShowAutotileDebug(false)} />
      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
}
