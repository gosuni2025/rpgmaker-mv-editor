import React, { useRef, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { syncEditorLightsToScene, disposeSceneObjects } from './threeSceneSync';
import { initGameGlobals, requestRenderFrames } from './initGameGlobals';
import {
  useRegionOverlay,
  usePlayerStartOverlay,
  useEventOverlay,
  useDragPreviewOverlay,
  useLightOverlay,
} from './useRendererOverlays';

// Runtime globals (loaded via index.html script tags)
declare const ThreeContainer: any;
declare const RendererStrategy: any;
declare const Graphics: any;
declare const Mode3D: any;
declare const ShadowLight: any;
declare const Spriteset_Map: any;

export { requestRenderFrames } from './initGameGlobals';

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
): ThreeRendererRefs {
  const currentMap = useEditorStore((s) => s.currentMap);
  const tilesetInfo = useEditorStore((s) => s.tilesetInfo);
  const mode3d = useEditorStore((s) => s.mode3d);
  const currentMapId = useEditorStore((s) => s.currentMapId);

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
  const eventOverlayMeshesRef = useRef<any[]>([]);
  const cursorMeshRef = useRef<any>(null);
  const selectionMeshRef = useRef<any>(null);
  const dragPreviewMeshesRef = useRef<any[]>([]);
  const toolPreviewMeshesRef = useRef<any[]>([]);
  const lightOverlayMeshesRef = useRef<any[]>([]);

  // =========================================================================
  // Spriteset_Map 기반 Three.js 렌더링 setup & render loop
  // =========================================================================
  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas || !currentMap || !(window as any)._editorRuntimeReady) return;
    if (!currentMapId) return;

    let disposed = false;
    let animFrameId: number | null = null;

    const setup = async () => {
      await initGameGlobals();
      if (disposed) return;

      const w = window as any;
      const { width, height, data } = currentMap;
      const mapPxW = width * TILE_SIZE_PX;
      const mapPxH = height * TILE_SIZE_PX;

      Graphics._width = mapPxW;
      Graphics._height = mapPxH;
      Graphics.width = mapPxW;
      Graphics.height = mapPxH;
      Graphics.boxWidth = mapPxW;
      Graphics.boxHeight = mapPxH;

      canvas.style.width = '';
      canvas.style.height = '';
      canvas.width = mapPxW;
      canvas.height = mapPxH;

      const THREE = w.THREE;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      renderer.state.reset();
      renderer.setSize(mapPxW, mapPxH, false);
      renderer.setClearColor(0x000000, 0);
      renderer.sortObjects = true;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, mapPxW, 0, mapPxH, -10000, 10000);
      camera.position.z = 100;
      const rendererObj = {
        renderer, scene, camera,
        _width: mapPxW, _height: mapPxH,
        view: renderer.domElement,
        gl: renderer.getContext(),
        textureGC: { maxIdle: 3600, run: () => {} },
        plugins: {},
        _drawOrderCounter: 0,
      };
      rendererObjRef.current = rendererObj;
      w._editorRendererObj = rendererObj;

      w.$dataMap = {
        ...currentMap,
        data: [...data],
        tilesetId: currentMap.tilesetId,
        width,
        height,
        scrollType: currentMap.scrollType || 0,
        events: currentMap.events || [],
        parallaxName: currentMap.parallaxName || '',
        parallaxShow: currentMap.parallaxShow || false,
        parallaxLoopX: currentMap.parallaxLoopX || false,
        parallaxLoopY: currentMap.parallaxLoopY || false,
        parallaxSx: currentMap.parallaxSx || 0,
        parallaxSy: currentMap.parallaxSy || 0,
        skyBackground: currentMap.skyBackground || null,
      };

      w.$gameMap.setup(currentMapId);
      w.$gameMap._displayX = 0;
      w.$gameMap._displayY = 0;
      w.$gamePlayer.setTransparent(true);

      // ShadowLight._scene을 Spriteset_Map 생성 전에 설정해야
      // _activateShadowLight → _findScene()이 새 씬을 찾을 수 있음
      ShadowLight._scene = rendererObj.scene;

      const stage = new ThreeContainer();
      stageRef.current = stage;

      const spriteset = new Spriteset_Map();
      spritesetRef.current = spriteset;
      w._editorSpriteset = spriteset;

      if (spriteset._blackScreen) spriteset._blackScreen.opacity = 0;
      if (spriteset._fadeSprite) spriteset._fadeSprite.opacity = 0;

      tilemapRef.current = spriteset._tilemap;
      lastMapDataRef.current = data;

      if (spriteset._tilemap) {
        spriteset._tilemap._margin = 0;
        spriteset._tilemap._width = mapPxW;
        spriteset._tilemap._height = mapPxH;
        spriteset._tilemap._needsRepaint = true;
      }

      stage.addChild(spriteset);
      rendererObj.scene.add(stage._threeObj);

      const editorState = useEditorStore.getState();
      // 플러그인이 ConfigManager 값을 덮어쓸 수 있으므로, 런타임의 실제 값을 UI 상태에 동기화
      const runtimeShadowLight = !!w.ConfigManager?.shadowLight;
      const runtimeMode3d = !!w.ConfigManager?.mode3d;
      if (runtimeShadowLight !== editorState.shadowLight) {
        useEditorStore.setState({ shadowLight: runtimeShadowLight });
      }
      if (runtimeMode3d !== editorState.mode3d) {
        useEditorStore.setState({ mode3d: runtimeMode3d });
      }
      if (runtimeShadowLight) {
        syncEditorLightsToScene(rendererObj.scene, editorState.currentMap?.editorLights, runtimeMode3d);
      }
      if (runtimeMode3d) {
        w.ConfigManager.mode3d = true;
      }

      // Create grid mesh (used in both 2D and 3D)
      const gridVertices: number[] = [];
      for (let x = 0; x <= width; x++) {
        gridVertices.push(x * TILE_SIZE_PX, 0, 0);
        gridVertices.push(x * TILE_SIZE_PX, mapPxH, 0);
      }
      for (let y = 0; y <= height; y++) {
        gridVertices.push(0, y * TILE_SIZE_PX, 0);
        gridVertices.push(mapPxW, y * TILE_SIZE_PX, 0);
      }
      const gridGeometry = new THREE.BufferGeometry();
      gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridVertices, 3));
      const gridMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
        depthTest: false,
      });
      const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
      gridLines.renderOrder = 9999;
      gridLines.position.z = 5;
      gridLines.visible = true;
      gridLines.frustumCulled = false;
      gridLines.userData.editorGrid = true;  // Mode3D에서 Pass별 visibility 제어용
      rendererObj.scene.add(gridLines);
      gridMeshRef.current = gridLines;

      // --- 렌더 루프 ---
      function renderOnce() {
        if (!rendererObjRef.current || disposed) return;
        const latestMap = useEditorStore.getState().currentMap;
        if (latestMap && (latestMap.width * TILE_SIZE_PX !== mapPxW || latestMap.height * TILE_SIZE_PX !== mapPxH)) return;

        if (latestMap && latestMap.data !== lastMapDataRef.current) {
          w.$dataMap.data = [...latestMap.data];
          if (spriteset._tilemap) {
            spriteset._tilemap._mapData = w.$dataMap.data;
            spriteset._tilemap._needsRepaint = true;
          }
          lastMapDataRef.current = latestMap.data;
        }

        try {
          spriteset.update();
        } catch (_e) {
          // update 중 에러는 무시
        }

        const strategy = RendererStrategy.getStrategy();
        strategy.render(rendererObj, stage);
      }

      function requestRender(frames = 1) {
        if (renderRequestedRef.current) return;
        renderRequestedRef.current = true;
        let remaining = frames;
        function doFrame() {
          renderRequestedRef.current = false;
          renderOnce();
          remaining--;
          if (remaining > 0 && !disposed) {
            renderRequestedRef.current = true;
            animFrameId = requestAnimationFrame(doFrame);
          }
        }
        animFrameId = requestAnimationFrame(doFrame);
      }

      let initFrameCount = 0;
      let shadowSynced = false;
      function waitAndRender() {
        if (disposed) return;
        if (spriteset._tilemap && spriteset._tilemap.isReady()) {
          spriteset._tilemap._needsRepaint = true;
          renderOnce();
          initFrameCount++;
          const _SL = w.ShadowLight;
          const shadowPending = _SL && w.ConfigManager?.shadowLight && !_SL._active;
          // ShadowLight가 활성화된 직후 에디터 라이트 동기화
          if (!shadowSynced && _SL && _SL._active && w.ConfigManager?.shadowLight) {
            shadowSynced = true;
            const es = useEditorStore.getState();
            syncEditorLightsToScene(rendererObj.scene, es.currentMap?.editorLights, es.mode3d);
          }
          if (initFrameCount < 10 || (shadowPending && initFrameCount < 60)) {
            animFrameId = requestAnimationFrame(waitAndRender);
          }
        } else {
          animFrameId = requestAnimationFrame(waitAndRender);
        }
      }
      waitAndRender();
      rendererReadyRef.current += 1;
      setRendererReady(rendererReadyRef.current);

      const unsubscribe = useEditorStore.subscribe((state, prevState) => {
        if (state.currentMap !== prevState.currentMap) {
          if (state.currentMap && prevState.currentMap &&
              state.currentMap.events !== prevState.currentMap.events) {
            w.$dataMap.events = state.currentMap.events || [];
            try {
              w.$gameMap.setupEvents();
              if (spriteset._characterSprites) {
                for (const cs of spriteset._characterSprites) {
                  if (spriteset._tilemap) spriteset._tilemap.removeChild(cs);
                }
              }
              spriteset.createCharacters();
              // 캐릭터 이미지 비동기 로드 후 렌더링 재요청
              if (spriteset._characterSprites) {
                for (const cs of spriteset._characterSprites) {
                  const charName = typeof cs._character?.characterName === 'function'
                    ? cs._character.characterName() : cs._character?.characterName;
                  if (charName && w.ImageManager?.loadCharacter) {
                    const bmp = w.ImageManager.loadCharacter(charName);
                    if (bmp && !bmp.isReady()) {
                      bmp.addLoadListener(() => {
                        renderRequestedRef.current = false;
                        requestRender(5);
                      });
                    }
                  }
                }
              }
            } catch (_e) {
              console.warn('[Editor] Failed to recreate characters:', _e);
            }
          }
          if (state.currentMap && prevState.currentMap &&
              state.currentMap.objects !== prevState.currentMap.objects) {
            w.$dataMap.objects = state.currentMap.objects || [];
            try {
              // 기존 오브젝트 스프라이트 제거
              if (spriteset._objectSprites) {
                for (const os of spriteset._objectSprites) {
                  if (spriteset._tilemap) spriteset._tilemap.removeChild(os);
                }
              }
              spriteset.createMapObjects();
            } catch (_e) {
              console.warn('[Editor] Failed to recreate map objects:', _e);
            }
          }
          requestRender(3);
        }
        if (state.mode3d !== prevState.mode3d) {
          if (!state.mode3d) {
            Mode3D._perspCamera = null;
          }
          if (state.shadowLight && state.currentMap?.editorLights) {
            syncEditorLightsToScene(rendererObj.scene, state.currentMap.editorLights, state.mode3d);
          }
          if (spriteset._tilemap) spriteset._tilemap._needsRepaint = true;
          requestRender(5);
        }
        if (state.shadowLight !== prevState.shadowLight) {
          w.ConfigManager.shadowLight = state.shadowLight;
          if (!state.shadowLight) {
            spriteset._deactivateShadowLight();
            ShadowLight._active = false;
            if (spriteset._tilemap) {
              spriteset._tilemap._needsRepaint = true;
            }
          } else {
            ShadowLight._active = false;
            syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
          }
          requestRender(5);
        }
        if (state.depthOfField !== prevState.depthOfField) {
          requestRender();
        }
        if (state.currentMap?.editorLights !== prevState.currentMap?.editorLights) {
          w.$dataMap.editorLights = state.currentMap?.editorLights;
          if (state.shadowLight) {
            syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
          }
          requestRender();
        }
        if (state.currentMap?.skyBackground !== prevState.currentMap?.skyBackground) {
          w.$dataMap.skyBackground = state.currentMap?.skyBackground || null;
          if (w._skyBoxApplySettings) {
            w._skyBoxApplySettings(state.currentMap?.skyBackground);
          }
          requestRender(5);
        }
      });

      (rendererObjRef as any)._cleanup = () => {
        unsubscribe();
        disposed = true;
        if (animFrameId != null) cancelAnimationFrame(animFrameId);
        // cancelAnimationFrame이 doFrame 실행을 막으면 renderRequestedRef가 true로 남아
        // 새 setup의 requestRender가 영원히 스킵되는 버그 방지
        renderRequestedRef.current = false;
        disposeSceneObjects(rendererObj.scene, regionMeshesRef.current);
        regionMeshesRef.current = [];
        disposeSceneObjects(rendererObj.scene, startPosMeshesRef.current);
        startPosMeshesRef.current = [];
        disposeSceneObjects(rendererObj.scene, eventOverlayMeshesRef.current);
        eventOverlayMeshesRef.current = [];
        disposeSceneObjects(rendererObj.scene, dragPreviewMeshesRef.current);
        dragPreviewMeshesRef.current = [];
        disposeSceneObjects(rendererObj.scene, toolPreviewMeshesRef.current);
        toolPreviewMeshesRef.current = [];
        disposeSceneObjects(rendererObj.scene, lightOverlayMeshesRef.current);
        lightOverlayMeshesRef.current = [];
        // MapCanvas에서 관리하는 글로벌 메시 배열도 정리
        const w = window as any;
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
        if (cursorMeshRef.current) {
          rendererObj.scene.remove(cursorMeshRef.current);
          cursorMeshRef.current.geometry?.dispose();
          cursorMeshRef.current.material?.dispose();
          cursorMeshRef.current = null;
        }
        if (selectionMeshRef.current) {
          rendererObj.scene.remove(selectionMeshRef.current);
          selectionMeshRef.current.geometry?.dispose();
          selectionMeshRef.current.material?.dispose();
          selectionMeshRef.current = null;
        }
        if (gridMeshRef.current) {
          rendererObj.scene.remove(gridMeshRef.current);
          gridMeshRef.current.geometry.dispose();
          gridMeshRef.current.material.dispose();
          gridMeshRef.current = null;
        }
        if (ShadowLight._active) {
          ShadowLight._removeLightsFromScene(rendererObj.scene);
          ShadowLight._active = false;
        }
        Mode3D._spriteset = null;
        Mode3D._perspCamera = null;
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
        rendererObjRef.current = null;
        tilemapRef.current = null;
        stageRef.current = null;
        spritesetRef.current = null;
        lastMapDataRef.current = null;
      };
    };

    setup();

    return () => {
      setRendererReady(0);
      if ((rendererObjRef as any)._cleanup) {
        (rendererObjRef as any)._cleanup();
      }
    };
  }, [currentMap?.tilesetId, currentMap?.width, currentMap?.height, currentMapId, tilesetInfo]);

  // Sync grid mesh visibility
  useEffect(() => {
    const gridMesh = gridMeshRef.current;
    if (!gridMesh) return;
    gridMesh.visible = showGrid;
    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [showGrid, mode3d]);

  // Overlay refs for sub-hooks
  const overlayRefs = React.useMemo(() => ({
    rendererObjRef,
    stageRef,
    spritesetRef,
    renderRequestedRef,
    regionMeshesRef,
    startPosMeshesRef,
    eventOverlayMeshesRef,
    dragPreviewMeshesRef,
    lightOverlayMeshesRef,
  }), []);

  // Delegated overlay hooks
  useRegionOverlay(overlayRefs, rendererReady);
  usePlayerStartOverlay(overlayRefs, rendererReady);
  useEventOverlay(overlayRefs, rendererReady);
  useDragPreviewOverlay(overlayRefs, dragPreviews);
  useLightOverlay(overlayRefs, rendererReady);

  return {
    rendererObjRef, tilemapRef, stageRef, spritesetRef, gridMeshRef,
    renderRequestedRef, lastMapDataRef,
    regionMeshesRef, objectMeshesRef,
    cursorMeshRef, selectionMeshRef,
    dragPreviewMeshesRef, toolPreviewMeshesRef,
    startPosMeshesRef,
    rendererReady,
  };
}
