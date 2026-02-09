import React, { useRef, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { editorRender, syncEditorLightsToScene, disposeSceneObjects } from './threeSceneSync';
import apiClient from '../../api/client';

// Runtime globals (loaded via index.html script tags)
declare const ThreeContainer: any;
declare const RendererStrategy: any;
declare const Graphics: any;
declare const Mode3D: any;
declare const ShadowLight: any;
declare const DataManager: any;
declare const ImageManager: any;
declare const Spriteset_Map: any;

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
}

/** 게임 런타임 전역 데이터($data*, $game*) 초기화 */
async function initGameGlobals() {
  const w = window as any;
  // 이미 초기화되었으면 스킵
  if (w._editorGameInitialized) return;

  try {
    // $dataSystem 로드
    const sys = await apiClient.get<any>('/database/system');
    w.$dataSystem = sys;

    // $dataTilesets 로드
    const tilesets = await apiClient.get<any>('/database/tilesets');
    w.$dataTilesets = tilesets;

    // $dataActors 로드 (Game_Actors에서 필요)
    const actors = await apiClient.get<any>('/database/actors');
    w.$dataActors = actors;

    // $dataCommonEvents 로드
    try {
      const ce = await apiClient.get<any>('/database/commonEvents');
      w.$dataCommonEvents = ce;
    } catch { w.$dataCommonEvents = []; }

    // 기타 $data* 초기화 (Game 객체 생성에 필요한 최소값)
    if (!w.$dataClasses) w.$dataClasses = [null];
    if (!w.$dataSkills) w.$dataSkills = [null];
    if (!w.$dataItems) w.$dataItems = [null];
    if (!w.$dataWeapons) w.$dataWeapons = [null];
    if (!w.$dataArmors) w.$dataArmors = [null];
    if (!w.$dataEnemies) w.$dataEnemies = [null];
    if (!w.$dataTroops) w.$dataTroops = [null];
    if (!w.$dataStates) w.$dataStates = [null];
    if (!w.$dataAnimations) w.$dataAnimations = [null];
    if (!w.$dataMapInfos) w.$dataMapInfos = [null];

    // 게임 객체 생성
    DataManager.createGameObjects();

    w._editorGameInitialized = true;
    console.log('[Editor] Game globals initialized');
  } catch (e) {
    console.error('[Editor] Failed to initialize game globals:', e);
  }
}

export function useThreeRenderer(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  showGrid: boolean,
): ThreeRendererRefs {
  const currentMap = useEditorStore((s) => s.currentMap);
  const tilesetInfo = useEditorStore((s) => s.tilesetInfo);
  const mode3d = useEditorStore((s) => s.mode3d);
  const editMode = useEditorStore((s) => s.editMode);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);

  // Three.js renderer refs
  const rendererObjRef = useRef<any>(null);
  const tilemapRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const spritesetRef = useRef<any>(null);
  const lastMapDataRef = useRef<number[] | null>(null);
  const renderRequestedRef = useRef(false);
  const gridMeshRef = useRef<any>(null);
  // 3D overlay refs
  const regionMeshesRef = useRef<any[]>([]);
  const objectMeshesRef = useRef<any[]>([]);
  const cursorMeshRef = useRef<any>(null);
  const selectionMeshRef = useRef<any>(null);

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
      // 게임 전역 초기화
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

      // --- $dataMap 설정 (에디터의 맵 데이터를 직접 참조) ---
      w.$dataMap = {
        ...currentMap,
        data: [...data],
        // Game_Map.setup에 필요한 필드
        tilesetId: currentMap.tilesetId,
        width: width,
        height: height,
        scrollType: currentMap.scrollType || 0,
        events: currentMap.events || [],
        parallaxName: currentMap.parallaxName || '',
        parallaxShow: currentMap.parallaxShow || false,
        parallaxLoopX: currentMap.parallaxLoopX || false,
        parallaxLoopY: currentMap.parallaxLoopY || false,
        parallaxSx: currentMap.parallaxSx || 0,
        parallaxSy: currentMap.parallaxSy || 0,
      };

      // $gameMap.setup() 호출
      w.$gameMap.setup(currentMapId);
      // 디스플레이 위치를 0,0으로 (에디터에서는 스크롤 없이 전체 맵 표시)
      w.$gameMap._displayX = 0;
      w.$gameMap._displayY = 0;
      // 에디터에서는 플레이어를 투명 처리 (ShadowLight 플레이어 라이트도 비활성화됨)
      w.$gamePlayer.setTransparent(true);

      // --- Spriteset_Map 생성 ---
      const stage = new ThreeContainer();
      stageRef.current = stage;

      const spriteset = new Spriteset_Map();
      spritesetRef.current = spriteset;
      w._editorSpriteset = spriteset;

      // Spriteset_Base가 생성하는 _blackScreen(opacity=255)과 _fadeSprite를 투명화
      // (게임에서는 Scene_Map이 페이드 인 처리하지만 에디터에서는 즉시 표시)
      if (spriteset._blackScreen) spriteset._blackScreen.opacity = 0;
      if (spriteset._fadeSprite) spriteset._fadeSprite.opacity = 0;

      // Spriteset_Map 내부의 tilemap 참조 저장
      tilemapRef.current = spriteset._tilemap;
      lastMapDataRef.current = data;

      // tilemap 마진을 0으로 (에디터에서는 전체 맵 표시)
      if (spriteset._tilemap) {
        spriteset._tilemap._margin = 0;
        spriteset._tilemap._width = mapPxW;
        spriteset._tilemap._height = mapPxH;
        spriteset._tilemap._needsRepaint = true;
      }

      // Mode3D._spriteset은 Spriteset_Map.initialize에서 자동 설정됨 (= this)
      // 별도 설정 불필요

      // stage에 spriteset 추가
      stage.addChild(spriteset);
      rendererObj.scene.add(stage._threeObj);

      // 초기 shadowLight 상태 동기화
      // scene 레퍼런스를 ShadowLight에 알려주어 _findScene()에서 사용
      ShadowLight._scene = rendererObj.scene;
      const editorState = useEditorStore.getState();
      if (editorState.shadowLight) {
        w.ConfigManager.shadowLight = true;
        // _active는 설정하지 않음 → _updateShadowLight에서 전체 _activateShadowLight 수행
        syncEditorLightsToScene(rendererObj.scene, editorState.currentMap?.editorLights, editorState.mode3d);
      }
      if (editorState.mode3d) {
        w.ConfigManager.mode3d = true;
      }

      // Create 3D grid mesh
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
      gridLines.visible = false;
      rendererObj.scene.add(gridLines);
      gridMeshRef.current = gridLines;

      // --- 렌더 루프 ---
      function renderOnce() {
        if (!rendererObjRef.current || disposed) return;
        const latestMap = useEditorStore.getState().currentMap;
        if (latestMap && (latestMap.width * TILE_SIZE_PX !== mapPxW || latestMap.height * TILE_SIZE_PX !== mapPxH)) return;

        // 맵 데이터 변경 동기화
        if (latestMap && latestMap.data !== lastMapDataRef.current) {
          w.$dataMap.data = [...latestMap.data];
          if (spriteset._tilemap) {
            spriteset._tilemap._mapData = w.$dataMap.data;
            spriteset._tilemap._needsRepaint = true;
          }
          lastMapDataRef.current = latestMap.data;
        }

        // Spriteset_Map update (캐릭터 위치, 타일셋 변경 등)
        try {
          spriteset.update();
        } catch (e) {
          // update 중 에러는 무시 (에디터 환경에서 일부 게임 로직은 불필요)
        }

        rendererObj._drawOrderCounter = 0;
        stage.updateTransform();
        const strategy = RendererStrategy.getStrategy();
        strategy._syncHierarchy(rendererObj, stage);

        const _SL = w.ShadowLight;
        if (_SL?._active) {
          rendererObj.renderer.shadowMap.needsUpdate = true;
        }
        editorRender(rendererObj, stage);
      }

      function requestRender() {
        if (renderRequestedRef.current) return;
        renderRequestedRef.current = true;
        animFrameId = requestAnimationFrame(() => {
          renderRequestedRef.current = false;
          renderOnce();
        });
      }

      // 초기 렌더링 (비트맵 로드 대기 + 메시 생성까지 반복)
      let initFrameCount = 0;
      function waitAndRender() {
        if (disposed) return;
        if (spriteset._tilemap && spriteset._tilemap.isReady()) {
          spriteset._tilemap._needsRepaint = true;
          renderOnce();
          // 타일맵 메시가 생성될 때까지 몇 프레임 더 렌더 (paint→flush 파이프라인)
          // ShadowLight 활성화도 씬 트리 연결 후에야 가능하므로 추가 재시도
          initFrameCount++;
          const _SL = w.ShadowLight;
          const shadowPending = _SL && w.ConfigManager?.shadowLight && !_SL._active;
          if (initFrameCount < 10 || (shadowPending && initFrameCount < 60)) {
            animFrameId = requestAnimationFrame(waitAndRender);
          }
        } else {
          animFrameId = requestAnimationFrame(waitAndRender);
        }
      }
      waitAndRender();

      // Store 변경 구독
      const unsubscribe = useEditorStore.subscribe((state, prevState) => {
        if (state.currentMap !== prevState.currentMap) {
          // 이벤트 변경 시 캐릭터 스프라이트 재생성
          if (state.currentMap && prevState.currentMap &&
              state.currentMap.events !== prevState.currentMap.events) {
            w.$dataMap.events = state.currentMap.events || [];
            try {
              w.$gameMap.setupEvents();
              // 기존 캐릭터 스프라이트 제거 후 재생성
              if (spriteset._characterSprites) {
                for (const cs of spriteset._characterSprites) {
                  if (spriteset._tilemap) spriteset._tilemap.removeChild(cs);
                }
              }
              spriteset.createCharacters();
            } catch (e) {
              console.warn('[Editor] Failed to recreate characters:', e);
            }
          }
          requestRender();
        }
        if (state.mode3d !== prevState.mode3d) {
          if (!state.mode3d) {
            Mode3D._perspCamera = null;
          }
          if (state.shadowLight && state.currentMap?.editorLights) {
            syncEditorLightsToScene(rendererObj.scene, state.currentMap.editorLights, state.mode3d);
          }
          if (spriteset._tilemap) spriteset._tilemap._needsRepaint = true;
          requestRender();
        }
        if (state.shadowLight !== prevState.shadowLight) {
          // ConfigManager 동기화 후 _updateShadowLight가 전체 활성화/비활성화 수행
          // (활성화: _activateShadowLight → 라이트 추가 + material 교체 + shadow mesh 등)
          w.ConfigManager.shadowLight = state.shadowLight;
          if (!state.shadowLight) {
            // 비활성화는 즉시 수행
            ShadowLight._active = false;
            ShadowLight._removeLightsFromScene(rendererObj.scene);
            if (spriteset._tilemap) {
              ShadowLight._resetTilemapMeshes(spriteset._tilemap);
              spriteset._tilemap._needsRepaint = true;
            }
          } else {
            // 활성화는 _active를 false로 두어 다음 renderOnce → spriteset.update()에서
            // _updateShadowLight → _activateShadowLight 전체 경로가 실행되도록 함
            ShadowLight._active = false;
            syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
          }
          requestRender();
        }
        if (state.depthOfField !== prevState.depthOfField) {
          requestRender();
        }
        if (state.shadowLight && state.currentMap?.editorLights !== prevState.currentMap?.editorLights) {
          syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
          requestRender();
        }
      });

      // cleanup 함수를 ref에 저장
      (rendererObjRef as any)._cleanup = () => {
        unsubscribe();
        disposed = true;
        if (animFrameId != null) cancelAnimationFrame(animFrameId);
        disposeSceneObjects(rendererObj.scene, regionMeshesRef.current);
        regionMeshesRef.current = [];
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
      if ((rendererObjRef as any)._cleanup) {
        (rendererObjRef as any)._cleanup();
      }
    };
  }, [currentMap?.tilesetId, currentMap?.width, currentMap?.height, currentMapId, tilesetInfo]);

  // Sync 3D grid mesh visibility
  useEffect(() => {
    const gridMesh = gridMeshRef.current;
    if (!gridMesh) return;
    gridMesh.visible = showGrid && mode3d;
    if (renderRequestedRef.current) return;
    renderRequestedRef.current = true;
    requestAnimationFrame(() => {
      renderRequestedRef.current = false;
      if (!rendererObjRef.current || !stageRef.current) return;
      const rendererObj = rendererObjRef.current;
      const strategy = (window as any).RendererStrategy?.getStrategy();
      rendererObj._drawOrderCounter = 0;
      stageRef.current.updateTransform();
      if (strategy) strategy._syncHierarchy(rendererObj, stageRef.current);
      editorRender(rendererObj, stageRef.current);
    });
  }, [showGrid, mode3d]);

  return {
    rendererObjRef, tilemapRef, stageRef, spritesetRef, gridMeshRef,
    renderRequestedRef, lastMapDataRef,
    regionMeshesRef, objectMeshesRef,
    cursorMeshRef, selectionMeshRef,
  };
}
