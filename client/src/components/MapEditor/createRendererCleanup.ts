import React from 'react';
import { disposeSceneObjects } from './threeSceneSync';
import type { StandaloneBackups } from './setupRendererAndSpriteset';

// Runtime globals (loaded via index.html script tags)
declare const Mode3D: any;
declare const ShadowLight: any;

export function createRendererCleanup(params: {
  rendererObj: any;
  canvas: HTMLCanvasElement;
  unsubscribe: () => void;
  stopLoop: () => void;
  renderRequestedRef: React.MutableRefObject<boolean>;
  meshRefs: {
    regionMeshesRef: React.MutableRefObject<any[]>;
    startPosMeshesRef: React.MutableRefObject<any[]>;
    testStartPosMeshesRef?: React.MutableRefObject<any[]>;
    vehicleStartPosMeshesRef?: React.MutableRefObject<any[]>;
    eventOverlayMeshesRef: React.MutableRefObject<any[]>;
    dragPreviewMeshesRef: React.MutableRefObject<any[]>;
    toolPreviewMeshesRef: React.MutableRefObject<any[]>;
    lightOverlayMeshesRef: React.MutableRefObject<any[]>;
    cursorMeshRef: React.MutableRefObject<any>;
    selectionMeshRef: React.MutableRefObject<any>;
    gridMeshRef: React.MutableRefObject<any>;
  };
  hookRefs: {
    rendererObjRef: React.MutableRefObject<any>;
    tilemapRef: React.MutableRefObject<any>;
    stageRef: React.MutableRefObject<any>;
    spritesetRef: React.MutableRefObject<any>;
    lastMapDataRef: React.MutableRefObject<number[] | null>;
  };
  standalone: boolean;
  backups: StandaloneBackups | null;
}): () => void {
  const { rendererObj, canvas, unsubscribe, stopLoop, renderRequestedRef,
    meshRefs, hookRefs, standalone, backups } = params;
  const w = window as any;

  return () => {
    unsubscribe();
    stopLoop();
    // cancelAnimationFrame이 doFrame 실행을 막으면 renderRequestedRef가 true로 남아
    // 새 setup의 requestRender가 영원히 스킵되는 버그 방지
    renderRequestedRef.current = false;

    if (!standalone) {
      disposeSceneObjects(rendererObj.scene, meshRefs.regionMeshesRef.current);
      meshRefs.regionMeshesRef.current = [];
      disposeSceneObjects(rendererObj.scene, meshRefs.startPosMeshesRef.current);
      meshRefs.startPosMeshesRef.current = [];
      if (meshRefs.testStartPosMeshesRef) {
        disposeSceneObjects(rendererObj.scene, meshRefs.testStartPosMeshesRef.current);
        meshRefs.testStartPosMeshesRef.current = [];
      }
      if (meshRefs.vehicleStartPosMeshesRef) {
        disposeSceneObjects(rendererObj.scene, meshRefs.vehicleStartPosMeshesRef.current);
        meshRefs.vehicleStartPosMeshesRef.current = [];
      }
      disposeSceneObjects(rendererObj.scene, meshRefs.eventOverlayMeshesRef.current);
      meshRefs.eventOverlayMeshesRef.current = [];
      disposeSceneObjects(rendererObj.scene, meshRefs.dragPreviewMeshesRef.current);
      meshRefs.dragPreviewMeshesRef.current = [];
      disposeSceneObjects(rendererObj.scene, meshRefs.toolPreviewMeshesRef.current);
      meshRefs.toolPreviewMeshesRef.current = [];
      disposeSceneObjects(rendererObj.scene, meshRefs.lightOverlayMeshesRef.current);
      meshRefs.lightOverlayMeshesRef.current = [];
      // MapCanvas에서 관리하는 글로벌 메시 배열도 정리
      for (const key of ['_editorSelectionMeshes', '_editorDragMeshes']) {
        const arr = w[key] as any[] | undefined;
        if (arr) {
          for (const m of arr) {
            rendererObj.scene.remove(m);
            m.geometry?.dispose();
            m.material?.dispose();
          }
          arr.length = 0;
        }
      }
      if (meshRefs.cursorMeshRef.current) {
        rendererObj.scene.remove(meshRefs.cursorMeshRef.current);
        meshRefs.cursorMeshRef.current.geometry?.dispose();
        meshRefs.cursorMeshRef.current.material?.dispose();
        meshRefs.cursorMeshRef.current = null;
      }
      if (meshRefs.selectionMeshRef.current) {
        rendererObj.scene.remove(meshRefs.selectionMeshRef.current);
        meshRefs.selectionMeshRef.current.geometry?.dispose();
        meshRefs.selectionMeshRef.current.material?.dispose();
        meshRefs.selectionMeshRef.current = null;
      }
    }

    if (meshRefs.gridMeshRef.current) {
      rendererObj.scene.remove(meshRefs.gridMeshRef.current);
      meshRefs.gridMeshRef.current.geometry.dispose();
      meshRefs.gridMeshRef.current.material.dispose();
      meshRefs.gridMeshRef.current = null;
    }
    if (!standalone) {
      if (ShadowLight._active) {
        ShadowLight._removeLightsFromScene(rendererObj.scene);
        ShadowLight._active = false;
      }
      Mode3D._spriteset = null;
      Mode3D._perspCamera = null;
    }
    if (rendererObj && rendererObj.renderer) {
      const gl = rendererObj.renderer.getContext();
      if (gl) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.scissor(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.disable(gl.SCISSOR_TEST);
      }
      rendererObj.renderer.dispose();
    }
    if (canvas) {
      canvas.style.width = '';
      canvas.style.height = '';
    }
    // standalone 모드: 글로벌 상태 복원
    if (standalone && backups?.dataMap) {
      w.$dataMap = backups.dataMap;
      if (w.$gameMap && backups.mapId != null) {
        w.$gameMap.setup(backups.mapId);
        w.$gameMap._displayX = backups.displayX ?? 0;
        w.$gameMap._displayY = backups.displayY ?? 0;
      }
      // 메인 에디터의 Spriteset_Map 타일맵 repaint 요청
      if (w._editorSpriteset?._tilemap) {
        w._editorSpriteset._tilemap._mapData = backups.dataMap.data;
        w._editorSpriteset._tilemap._needsRepaint = true;
      }
    }
    hookRefs.rendererObjRef.current = null;
    hookRefs.tilemapRef.current = null;
    hookRefs.stageRef.current = null;
    hookRefs.spritesetRef.current = null;
    hookRefs.lastMapDataRef.current = null;
  };
}
