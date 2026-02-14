import React, { useRef, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { syncEditorLightsToScene, syncSunLightsToScene, disposeSceneObjects } from './threeSceneSync';
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
declare const ThreeWaterShader: any;

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
  const eventOverlayMeshesRef = useRef<any[]>([]);
  const cursorMeshRef = useRef<any>(null);
  const selectionMeshRef = useRef<any>(null);
  const dragPreviewMeshesRef = useRef<any[]>([]);
  const toolPreviewMeshesRef = useRef<any[]>([]);
  const lightOverlayMeshesRef = useRef<any[]>([]);

  // =========================================================================
  // Spriteset_Map 기반 Three.js 렌더링 setup & render loop
  // =========================================================================
  // standalone 모드에서 사용할 실제 맵 데이터/ID
  const effectiveMap = standalone ? standalone.mapData : currentMap;
  const effectiveMapId = standalone ? standalone.mapId : currentMapId;

  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas || !effectiveMap || !(window as any)._editorRuntimeReady) return;
    if (!effectiveMapId) return;

    let disposed = false;
    let animFrameId: number | null = null;

    // standalone 모드: 글로벌 상태 백업
    const w = window as any;
    let backupDataMap: any;
    let backupMapId: number | undefined;
    let backupDisplayX: number | undefined;
    let backupDisplayY: number | undefined;
    let backupGraphicsW: number | undefined;
    let backupGraphicsH: number | undefined;
    if (standalone) {
      backupDataMap = w.$dataMap;
      backupMapId = w.$gameMap?._mapId;
      backupDisplayX = w.$gameMap?._displayX;
      backupDisplayY = w.$gameMap?._displayY;
    }

    const setup = async () => {
      await initGameGlobals();
      if (disposed) return;

      const { width, height, data } = effectiveMap;
      const mapPxW = width * TILE_SIZE_PX;
      const mapPxH = height * TILE_SIZE_PX;

      // standalone 모드: Graphics 백업 후 임시 설정
      if (standalone) {
        backupGraphicsW = Graphics._width;
        backupGraphicsH = Graphics._height;
      }

      Graphics._width = mapPxW;
      Graphics._height = mapPxH;
      Graphics.width = mapPxW;
      Graphics.height = mapPxH;
      Graphics.boxWidth = mapPxW;
      Graphics.boxHeight = mapPxH;

      if (!standalone) {
        canvas.style.width = '';
        canvas.style.height = '';
      }
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
      if (!standalone) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
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
      if (!standalone) {
        w._editorRendererObj = rendererObj;
      }

      if (standalone) {
        // standalone 모드: 간소화된 $dataMap 설정
        w.$dataMap = {
          ...effectiveMap,
          data: [...data],
          events: effectiveMap.events || [],
          parallaxName: '',
          parallaxShow: false,
        };
      } else {
        w.$dataMap = {
          ...effectiveMap,
          data: [...data],
          tilesetId: effectiveMap.tilesetId,
          width,
          height,
          scrollType: effectiveMap.scrollType || 0,
          events: effectiveMap.events || [],
          parallaxName: effectiveMap.parallaxName || '',
          parallaxShow: effectiveMap.parallaxShow || false,
          parallaxLoopX: effectiveMap.parallaxLoopX || false,
          parallaxLoopY: effectiveMap.parallaxLoopY || false,
          parallaxSx: effectiveMap.parallaxSx || 0,
          parallaxSy: effectiveMap.parallaxSy || 0,
          skyBackground: effectiveMap.skyBackground || null,
        };
      }

      w.$gameMap.setup(effectiveMapId);
      w.$gameMap._displayX = 0;
      w.$gameMap._displayY = 0;
      w.$gamePlayer.setTransparent(true);

      // animTileSettings 초기화 (맵 로드 시)
      if (typeof ThreeWaterShader !== 'undefined') {
        ThreeWaterShader.setAllKindSettings(effectiveMap.animTileSettings || {});
      }

      // bloomConfig 초기화 (맵 로드 시)
      const DOF = (window as any).PostProcess;
      if (DOF) {
        const bc = effectiveMap.bloomConfig;
        DOF.bloomConfig.threshold = bc?.threshold ?? 0.5;
        DOF.bloomConfig.strength = bc?.strength ?? 0.8;
        DOF.bloomConfig.radius = bc?.radius ?? 1.0;
        DOF.bloomConfig.downscale = bc?.downscale ?? 4;
        if (DOF._bloomPass) {
          DOF._bloomPass.enabled = bc ? bc.enabled !== false : true;
        }
      }

      // ShadowLight._scene을 Spriteset_Map 생성 전에 설정해야
      // _activateShadowLight → _findScene()이 새 씬을 찾을 수 있음
      ShadowLight._scene = rendererObj.scene;

      // standalone 모드: 조명/3D 플러그인 비활성화 (프리뷰에 불필요)
      let backupShadowLight: boolean | undefined;
      let backupMode3d: boolean | undefined;
      if (standalone && w.ConfigManager) {
        backupShadowLight = w.ConfigManager.shadowLight;
        backupMode3d = w.ConfigManager.mode3d;
        w.ConfigManager.shadowLight = false;
        w.ConfigManager.mode3d = false;
      }

      const stage = new ThreeContainer();
      stageRef.current = stage;

      const spriteset = new Spriteset_Map();
      spritesetRef.current = spriteset;

      // standalone 모드: 조명/3D 설정 복원
      if (standalone && w.ConfigManager) {
        w.ConfigManager.shadowLight = backupShadowLight;
        w.ConfigManager.mode3d = backupMode3d;
      }
      if (!standalone) {
        w._editorSpriteset = spriteset;
      }

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

      // standalone 모드: Graphics 즉시 복원 (메인 에디터 영향 방지)
      if (standalone && backupGraphicsW != null) {
        Graphics._width = backupGraphicsW;
        Graphics._height = backupGraphicsH!;
        Graphics.width = backupGraphicsW;
        Graphics.height = backupGraphicsH!;
        Graphics.boxWidth = backupGraphicsW;
        Graphics.boxHeight = backupGraphicsH!;
      }

      if (!standalone) {
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

        if (!standalone) {
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
        }

        const strategy = RendererStrategy.getStrategy();
        strategy.render(rendererObj, stage);
      }

      function requestRender(_frames = 1) {
        // 연속 animationLoop가 돌고 있으므로 플래그만 설정
        renderRequestedRef.current = true;
      }

      let initFrameCount = 0;
      let shadowSynced = false;
      let lastAnimFrame = -1;
      let skySphereRef: any = null;
      function animationLoop() {
        if (disposed) return;
        animFrameId = requestAnimationFrame(animationLoop);

        if (!spriteset._tilemap || !spriteset._tilemap.isReady()) return;

        // 초기 프레임: 타일맵 강제 repaint
        if (initFrameCount < 10) {
          spriteset._tilemap._needsRepaint = true;
          initFrameCount++;
        }

        if (standalone) {
          // standalone 모드: 간소화된 렌더 루프 (spriteset.update + render만)
          try { spriteset.update(); } catch (_e) {}
          const strategy = RendererStrategy.getStrategy();
          strategy.render(rendererObj, stage);
          return;
        }

        // ShadowLight 초기화 대기
        const _SL = w.ShadowLight;
        const shadowPending = _SL && w.ConfigManager?.shadowLight && !_SL._active;
        if (shadowPending && initFrameCount < 60) {
          spriteset._tilemap._needsRepaint = true;
          initFrameCount++;
        }
        if (!shadowSynced && _SL && _SL._active && w.ConfigManager?.shadowLight) {
          shadowSynced = true;
          const es = useEditorStore.getState();
          syncEditorLightsToScene(rendererObj.scene, es.currentMap?.editorLights, es.mode3d);
        }

        // 2D 모드에서 스카이 스피어 숨기기 (비동기 로딩 후 추가될 수 있으므로 렌더 루프에서 체크)
        const curMode3d = !!w.ConfigManager?.mode3d;
        if (!skySphereRef || !skySphereRef.parent) {
          // 아직 캐시 안 됐거나 씬에서 제거됐으면 다시 찾기
          skySphereRef = null;
          rendererObj.scene.traverse((obj: any) => {
            if (obj._isParallaxSky) skySphereRef = obj;
          });
        }
        if (skySphereRef) skySphereRef.visible = curMode3d;

        // spriteset.update()로 Tilemap.animationCount 증가
        try {
          spriteset.update();
        } catch (_e) {}

        // 물 타일 애니메이션: animationFrame이 변경되었으면 repaint
        const tilemap = spriteset._tilemap;
        if (tilemap.animationFrame !== lastAnimFrame) {
          lastAnimFrame = tilemap.animationFrame;
          tilemap._needsRepaint = true;
        }

        // 물 셰이더 시간 업데이트 + 물 메시 uTime 갱신 + 라이트 방향 동기화
        if (typeof ThreeWaterShader !== 'undefined') {
          ThreeWaterShader._time += 1 / 60;
          ThreeWaterShader.updateAllWaterMeshes(tilemap, ThreeWaterShader._time);
          ThreeWaterShader.syncLightDirection(tilemap);
        }

        // 물 타일이 있는 맵이면 매 프레임 렌더 (wave 연속 애니메이션)
        const hasWaterShader = typeof ThreeWaterShader !== 'undefined' && ThreeWaterShader._hasWaterMesh;

        // repaint가 필요한 경우에만 렌더링
        if (tilemap._needsRepaint || renderRequestedRef.current || hasWaterShader) {
          renderRequestedRef.current = false;
          renderOnce();
        }
      }
      animationLoop();
      rendererReadyRef.current += 1;
      setRendererReady(rendererReadyRef.current);

      // standalone 모드에서는 스토어 구독 불필요
      const unsubscribe = standalone ? () => {} : useEditorStore.subscribe((state, prevState) => {
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
          // skySphereRef 캐시 무효화 (렌더 루프에서 재탐색)
          skySphereRef = null;
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
        if (state.postProcessConfig !== prevState.postProcessConfig) {
          const DOF = (window as any).PostProcess;
          if (DOF && DOF.applyPostProcessConfig) {
            DOF.applyPostProcessConfig(state.postProcessConfig);
          }
          requestRender();
        }
        if (state.currentMap?.editorLights !== prevState.currentMap?.editorLights) {
          w.$dataMap.editorLights = state.currentMap?.editorLights;
          if (state.shadowLight) {
            syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
          }
          requestRender();
        }
        if (state.currentMap?.animTileSettings !== prevState.currentMap?.animTileSettings) {
          if (typeof ThreeWaterShader !== 'undefined') {
            ThreeWaterShader.setAllKindSettings(state.currentMap?.animTileSettings || {});
            // 메시 재빌드 (uniform 반영)
            if (spriteset._tilemap) spriteset._tilemap._needsRepaint = true;
          }
          requestRender(3);
        }
        if (state.currentMap?.bloomConfig !== prevState.currentMap?.bloomConfig) {
          const DOF = (window as any).PostProcess;
          if (DOF) {
            const bc = state.currentMap?.bloomConfig;
            const def = { enabled: true, threshold: 0.5, strength: 0.8, radius: 1.0, downscale: 4 };
            DOF.bloomConfig.threshold = bc?.threshold ?? def.threshold;
            DOF.bloomConfig.strength = bc?.strength ?? def.strength;
            DOF.bloomConfig.radius = bc?.radius ?? def.radius;
            DOF.bloomConfig.downscale = bc?.downscale ?? def.downscale;
            if (DOF._bloomPass) {
              DOF._bloomPass.enabled = bc ? bc.enabled !== false : true;
            }
          }
          requestRender();
        }
        if (state.currentMap?.skyBackground !== prevState.currentMap?.skyBackground) {
          w.$dataMap.skyBackground = state.currentMap?.skyBackground || null;
          if (w._skyBoxApplySettings) {
            w._skyBoxApplySettings(state.currentMap?.skyBackground);
          }
          // 추가 sun directional lights 동기화
          if (state.shadowLight) {
            syncSunLightsToScene(rendererObj.scene, state.currentMap?.skyBackground?.sunLights);
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

        if (!standalone) {
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
        }

        if (gridMeshRef.current) {
          rendererObj.scene.remove(gridMeshRef.current);
          gridMeshRef.current.geometry.dispose();
          gridMeshRef.current.material.dispose();
          gridMeshRef.current = null;
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
        if (standalone && backupDataMap) {
          w.$dataMap = backupDataMap;
          if (w.$gameMap && backupMapId != null) {
            w.$gameMap.setup(backupMapId);
            w.$gameMap._displayX = backupDisplayX ?? 0;
            w.$gameMap._displayY = backupDisplayY ?? 0;
          }
          // 메인 에디터의 Spriteset_Map 타일맵 repaint 요청
          if (w._editorSpriteset?._tilemap) {
            w._editorSpriteset._tilemap._mapData = backupDataMap.data;
            w._editorSpriteset._tilemap._needsRepaint = true;
          }
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

  // Delegated overlay hooks (standalone 모드에서는 스킵)
  const skipOverlays = !!standalone;
  useRegionOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  usePlayerStartOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useEventOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);
  useDragPreviewOverlay(overlayRefs, skipOverlays ? [] : dragPreviews);
  useLightOverlay(overlayRefs, skipOverlays ? 0 : rendererReady);

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
