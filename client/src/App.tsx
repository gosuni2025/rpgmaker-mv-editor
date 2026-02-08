import React, { useEffect } from 'react';
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
  const setShowOpenProjectDialog = useEditorStore((s) => s.setShowOpenProjectDialog);
  const openProject = useEditorStore((s) => s.openProject);
  const restoreLastProject = useEditorStore((s) => s.restoreLastProject);

  useEffect(() => {
    restoreLastProject();
  }, [restoreLastProject]);

  const handleOpenProject = async (path: string) => {
    setShowOpenProjectDialog(false);
    await openProject(path);
    const name = useEditorStore.getState().projectName;
    addRecentProject(path, name || '');
  };

  return (
    <div className="app-layout">
      <MenuBar />

      <div className="sidebar">
        <ResizablePanel defaultWidth={260} minWidth={150} maxWidth={500}>
          <div className="sidebar-split">
            {editMode === 'map' && <TilesetPalette />}
            <div className="sidebar-bottom">
              <div className="sidebar-header">Maps</div>
              <MapTree />
            </div>
          </div>
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
    </div>
  );
}
