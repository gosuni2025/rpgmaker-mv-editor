import React, { useRef, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { requestRenderFrames } from './initGameGlobals';
import { setupRendererAndSpriteset } from './setupRendererAndSpriteset';
import { createAnimationLoop } from './createAnimationLoop';
import { createStoreSubscription } from './createStoreSubscription';
import { createRendererCleanup } from './createRendererCleanup';
import {
  useRegionOverlay,
  usePlayerStartOverlay,
  useVehicleStartOverlay,
  useTestStartOverlay,
  useEventOverlay,
  useDragPreviewOverlay,
  useLightOverlay,
  useFogOfWarOverlay,
  useFogOfWar3DVolumeOverlay,
  useTileIdDebugOverlay,
  usePassageOverlay,
  usePassageSelectionOverlay,
  usePassagePastePreviewOverlay,
<<<<<<< HEAD
} from './useRendererOverlays';
=======
} from './overlays';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

export { requestRenderFrames } from './initGameGlobals';

export interface StandaloneMapOptions {
  mapId: number;
  mapData: any;
  simple?: boolean; // true면 오버레이/스토어 구독 생략
}

export interface ThreeRendererRefs {
  rendererObjRef: React.MutableRefObject<any>;
  tilemapRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  spritesetRef: React.MutableRefObject<any>;
  gridMeshRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
  lastMapDataRef: React.MutableRefObject<number[] | null>;
  regionMeshesRef: React.MutableRefObject<any[]>;
  objectMeshesRef: React.MutableRefObject<any[]>;
  cursorMeshRef: React.MutableRefObject<any>;
  selectionMeshRef: React.MutableRefObject<any>;
  dragPreviewMeshesRef: React.MutableRefObject<any[]>;
  toolPreviewMeshesRef: React.MutableRefObject<any[]>;
  startPosMeshesRef: React.MutableRefObject<any[]>;
  testStartPosMeshesRef: React.MutableRefObject<any[]>;
  vehicleStartPosMeshesRef: React.MutableRefObject<any[]>;
  rendererReady: number;
}

export interface DragPreviewInfo {
  type: 'event' | 'light' | 'object';
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export function useThreeRenderer(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  showGrid: boolean,
  dragPreviews: DragPreviewInfo[],
  standalone?: StandaloneMapOptions,
  showTileId?: boolean,
): ThreeRendererRefs {
  const currentMap = useEditorStore((s) => standalone ? null : s.currentMap);
  const tilesetInfo = useEditorStore((s) => standalone ? null : s.tilesetInfo);
  const mode3d = useEditorStore((s) => standalone ? false : s.mode3d);
  const currentMapId = useEditorStore((s) => standalone ? null : s.currentMapId);

  // Track renderer readiness so overlay useEffects re-run after async setup
  // Using a counter instead of boolean to ensure re-render even when cleanup(false)
  // and setup(true) are batched by React into the same render cycle.
  const [rendererReady, setRendererReady] = useState(0);
  const rendererReadyRef = useRef(0);

  // Three.js renderer refs
  const rendererObjRef = useRef<any>(null);
  const tilemapRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const spritesetRef = useRef<any>(null);
  const lastMapDataRef = useRef<number[] | null>(null);
  const renderRequestedRef = useRef(false);
  const gridMeshRef = useRef<any>(null);
  // Overlay refs
  const regionMeshesRef = useRef<any[]>([]);
  const objectMeshesRef = useRef<any[]>([]);
  const startPosMeshesRef = useRef<any[]>([]);
  const testStartPosMeshesRef = useRef<any[]>([]);
  const vehicleStartPosMeshesRef = useRef<any[]>([]);
  const eventOverlayMeshesRef = useRef<any[]>([]);
  const cursorMeshRef = useRef<any>(null);
  const selectionMeshRef = useRef<any>(null);
  const dragPreviewMeshesRef = useRef<any[]>([]);
  const toolPreviewMeshesRef = useRef<any[]>([]);
  const lightOverlayMeshesRef = useRef<any[]>([]);
  const fogOfWarMeshRef = useRef<any>(null);
  const tileIdDebugMeshesRef = useRef<any[]>([]);
  const passageMeshesRef = useRef<any[]>([]);

  // =========================================================================
  // Spriteset_Map 기반 Three.js 렌더링 setup & render loop
  // =========================================================================
  const effectiveMap = standalone ? standalone.mapData : currentMap;
  const effectiveMapId = standalone ? standalone.mapId : currentMapId;

  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas || !effectiveMap || !(window as any)._editorRuntimeReady) return;
    if (!effectiveMapId) return;

    let disposed = false;

    const doSetup = async () => {
      const result = await setupRendererAndSpriteset({
        canvas,
        effectiveMap,
        effectiveMapId,
        standalone: !!standalone,
        isDisposed: () => disposed,
      });
      if (!result || disposed) return;

      const { rendererObj, spriteset, stage, gridLines, mapPxW, mapPxH, backups } = result;

      // Assign refs
      rendererObjRef.current = rendererObj;
      spritesetRef.current = spriteset;
      stageRef.current = stage;
      tilemapRef.current = spriteset._tilemap;
      lastMapDataRef.current = effectiveMap.data;
      gridMeshRef.current = gridLines;

      // Animation loop
      const loop = createAnimationLoop({
        rendererObj, spriteset, stage, mapPxW, mapPxH,
        renderRequestedRef, lastMapDataRef,
        standalone: !!standalone,
      });
      loop.start();

      rendererReadyRef.current += 1;
      setRendererReady(rendererReadyRef.current);

      // Store subscription (standalone 모드에서는 불필요)
      const unsubscribe = standalone
        ? () => {}
        : createStoreSubscription({
            rendererObj,
            spriteset,
            requestRender: () => { renderRequestedRef.current = true; },
          });

      // Cleanup function
      (rendererObjRef as any)._cleanup = createRendererCleanup({
        rendererObj, canvas, unsubscribe,
        stopLoop: loop.stop,
        renderRequestedRef,
        meshRefs: {
          regionMeshesRef, startPosMeshesRef, testStartPosMeshesRef, vehicleStartPosMeshesRef,
          eventOverlayMeshesRef,
          dragPreviewMeshesRef, toolPreviewMeshesRef, lightOverlayMeshesRef,
          cursorMeshRef, selectionMeshRef, gridMeshRef,
        },
        hookRefs: {
          rendererObjRef, tilemapRef, stageRef, spritesetRef, lastMapDataRef,
        },
        standalone: !!standalone,
        backups,
      });
    };

    doSetup();

    return () => {
      disposed = true;
      setRendererReady(0);
      if ((rendererObjRef as any)._cleanup) {
        (rendererObjRef as any)._cleanup();
      }
    };
  }, [standalone ? standalone.mapId : currentMap?.tilesetId,
      standalone ? standalone.mapData : currentMap?.width,
      standalone ? null : currentMap?.height,
      standalone ? null : currentMapId,
      standalone ? null : tilesetInfo]);

  // Sync grid mesh visibility
  useEffect(() => {
    const gridMesh = gridMeshRef.current;
    if (!gridMesh) return;
    gridMesh.visible = showGrid;
    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [showGrid, mode3d]);

  // 이미지 변경 감지: 타일맵 repaint 및 렌더링 갱신
  useEffect(() => {
    if (!rendererReady || standalone) return;

    const handleImageReloaded = (e: Event) => {
      const { folder } = (e as CustomEvent).detail as { file: string; folder: string };
      const spriteset = spritesetRef.current;
      if (!spriteset) return;

      if (folder === 'tilesets' && spriteset._tilemap) {
        // ShaderTilemap: _baseTexture→Three.js 텍스처 변환을 다시 수행
        if (typeof spriteset._tilemap.refreshTileset === 'function') {
          spriteset._tilemap.refreshTileset();
        }
        spriteset._tilemap._needsRepaint = true;
      }

      renderRequestedRef.current = true;
    };

    window.addEventListener('imageReloaded', handleImageReloaded);
    return () => window.removeEventListener('imageReloaded', handleImageReloaded);
  }, [rendererReady, standalone]);

  // Overlay refs for sub-hooks
  const overlayRefs = React.useMemo(() => ({
    rendererObjRef,
    stageRef,
    spritesetRef,
    renderRequestedRef,
    regionMeshesRef,
    startPosMeshesRef,
    testStartPosMeshesRef,
    vehicleStartPosMeshesRef,
    eventOverlayMeshesRef,
    dragPreviewMeshesRef,
    lightOverlayMeshesRef,
    fogOfWarMeshRef,
    tileIdDebugMeshesRef,
    passageMeshesRef,
  }), []);

  // Delegated overlay hooks (standalone 모드에서는 스킵)
  const skipOverlays = !!standalone;
  useRegionOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  usePlayerStartOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useVehicleStartOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useTestStartOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useEventOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useDragPreviewOverlay(overlayRefs, skipOverlays ? [] : dragPreviews);
  useLightOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useFogOfWarOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useFogOfWar3DVolumeOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useTileIdDebugOverlay(overlayRefs, skipOverlays ? false : !!showTileId, skipOverlays ? 0 : rendererReady);
  usePassageOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  usePassageSelectionOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  usePassagePastePreviewOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);

  return {
    rendererObjRef, tilemapRef, stageRef, spritesetRef, gridMeshRef,
    renderRequestedRef, lastMapDataRef,
    regionMeshesRef, objectMeshesRef,
    cursorMeshRef, selectionMeshRef,
    dragPreviewMeshesRef, toolPreviewMeshesRef,
    startPosMeshesRef,
    testStartPosMeshesRef,
    vehicleStartPosMeshesRef,
    rendererReady,
  };
}
