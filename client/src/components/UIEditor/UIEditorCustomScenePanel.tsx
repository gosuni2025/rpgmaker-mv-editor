import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { CustomSceneDef, CustomSceneDefV2 } from '../../store/uiEditorTypes';
import { isV2Scene, convertLegacyToV2 } from './UIEditorSceneUtils';
import { V2ScenePanel } from './UIEditorV2ScenePanel';
import { LegacyScenePanel } from './UIEditorLegacyPanels';

// Re-export for external consumers
export { WidgetInspector } from './UIEditorWidgetInspector';

export default function UIEditorCustomScenePanel({ sceneId }: { sceneId: string }) {
  const customScenes = useEditorStore((s) => s.customScenes);
  const updateSceneRoot = useEditorStore((s) => s.updateSceneRoot);
  const updateNavigation = useEditorStore((s) => s.updateNavigation);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);

  const scene = customScenes.scenes[sceneId] as CustomSceneDefV2 | undefined;
  if (!scene) return <div style={{ padding: 12, color: '#888' }}>씬을 찾을 수 없습니다</div>;

  if (isV2Scene(scene)) {
    return <V2ScenePanel sceneId={sceneId} scene={scene} />;
  }

  return (
    <LegacyScenePanel sceneId={sceneId} onConvert={() => {
      const v2Data = convertLegacyToV2(scene as CustomSceneDef);
      updateSceneRoot(sceneId, v2Data.root!);
      if (v2Data.navigation) {
        updateNavigation(sceneId, v2Data.navigation);
      }
      saveCustomScenes();
    }} />
  );
}
