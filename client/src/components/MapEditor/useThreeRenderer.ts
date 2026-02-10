import React, { useRef, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { syncEditorLightsToScene, disposeSceneObjects } from './threeSceneSync';
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

/** Request a render frame (shared helper for all overlay effects) */
function requestRenderFrames(
  rendererObjRef: React.MutableRefObject<any>,
  stageRef: React.MutableRefObject<any>,
  renderRequestedRef: React.MutableRefObject<boolean>,
  frames = 1,
) {
  if (renderRequestedRef.current) return;
  renderRequestedRef.current = true;
  let remaining = frames;
  function doFrame() {
    renderRequestedRef.current = false;
    if (!rendererObjRef.current || !stageRef.current) return;
    const strategy = (window as any).RendererStrategy?.getStrategy();
    if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
    remaining--;
    if (remaining > 0) {
      renderRequestedRef.current = true;
      requestAnimationFrame(doFrame);
    }
  }
  requestAnimationFrame(doFrame);
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
}

export interface DragPreviewInfo {
  type: 'event' | 'light' | 'object';
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** 게임 런타임 전역 데이터($data*, $game*) 초기화 */
async function initGameGlobals() {
  const w = window as any;
  if (w._editorGameInitialized) return;

  try {
    const sys = await apiClient.get<any>('/database/system');
    w.$dataSystem = sys;
    const tilesets = await apiClient.get<any>('/database/tilesets');
    w.$dataTilesets = tilesets;
    const actors = await apiClient.get<any>('/database/actors');
    w.$dataActors = actors;
    try {
      const ce = await apiClient.get<any>('/database/commonEvents');
      w.$dataCommonEvents = ce;
    } catch { w.$dataCommonEvents = []; }

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

    DataManager.createGameObjects();
    w._editorGameInitialized = true;
    console.log('[Editor] Game globals initialized');
  } catch (e) {
    console.error('[Editor] Failed to initialize game globals:', e);
  }
}

export function useThreeRenderer(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  showGrid: boolean,
  dragPreviews: DragPreviewInfo[],
): ThreeRendererRefs {
  const currentMap = useEditorStore((s) => s.currentMap);
  const tilesetInfo = useEditorStore((s) => s.tilesetInfo);
  const mode3d = useEditorStore((s) => s.mode3d);
  const editMode = useEditorStore((s) => s.editMode);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);

  // Track renderer readiness so overlay useEffects re-run after async setup
  const [rendererReady, setRendererReady] = useState(false);

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
      if (editorState.shadowLight) {
        w.ConfigManager.shadowLight = true;
        syncEditorLightsToScene(rendererObj.scene, editorState.currentMap?.editorLights, editorState.mode3d);
      }
      if (editorState.mode3d) {
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
      setRendererReady(true);

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
        if (state.shadowLight && state.currentMap?.editorLights !== prevState.currentMap?.editorLights) {
          syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
          requestRender();
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
      setRendererReady(false);
      if ((rendererObjRef as any)._cleanup) {
        (rendererObjRef as any)._cleanup();
      }
    };
  }, [currentMap?.tilesetId, currentMap?.width, currentMap?.height, currentMapId, tilesetInfo]);

  // Re-render on container scroll (fixes black areas when scrolling large maps)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !rendererReady) return;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const doRender = () => {
      requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
    };
    const handleScroll = () => {
      doRender();
      // 스크롤 종료 후에도 확실히 최종 프레임 렌더링
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(doRender, 50);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [rendererReady]);

  // Sync grid mesh visibility
  useEffect(() => {
    const gridMesh = gridMeshRef.current;
    if (!gridMesh) return;
    gridMesh.visible = showGrid;
    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [showGrid, mode3d]);

  // Sync region overlay (Three.js meshes)
  useEffect(() => {
    const rendererObj = rendererObjRef.current;
    if (!rendererObj || !currentMap) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing region meshes
    for (const m of regionMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    regionMeshesRef.current = [];

    if (currentLayer !== 5) {
      requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
      return;
    }

    const { width, height, data } = currentMap;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const regionId = data[(5 * height + y) * width + x];
        if (regionId === 0) continue;
        const hue = (regionId * 137) % 360;
        const color = new THREE.Color(`hsl(${hue}, 60%, 40%)`);
        // Region fill quad
        const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const mat = new THREE.MeshBasicMaterial({
          color, opacity: 0.5, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4);
        mesh.renderOrder = 9998;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        regionMeshesRef.current.push(mesh);

        // Region ID text label
        const cvs = document.createElement('canvas');
        cvs.width = 48; cvs.height = 48;
        const ctx = cvs.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(String(regionId), 24, 24);
        const tex = new THREE.CanvasTexture(cvs);
        const labelGeom = new THREE.PlaneGeometry(TILE_SIZE_PX * 0.6, TILE_SIZE_PX * 0.6);
        const labelMat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const labelMesh = new THREE.Mesh(labelGeom, labelMat);
        labelMesh.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4.5);
        labelMesh.renderOrder = 9999;
        labelMesh.frustumCulled = false;
        labelMesh.userData.editorGrid = true;
        rendererObj.scene.add(labelMesh);
        regionMeshesRef.current.push(labelMesh);
      }
    }
    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [currentMap, currentLayer, mode3d, rendererReady]);

  // Player start position overlay (blue border + character image)
  useEffect(() => {
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
    for (const m of startPosMeshesRef.current) {
      rendererObj.scene.remove(m);
      if (m.material?.map) m.material.map.dispose();
      m.geometry?.dispose();
      m.material?.dispose();
    }
    startPosMeshesRef.current = [];

    if (!systemData || currentMapId !== systemData.startMapId) {
      requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
      return;
    }

    const px = systemData.startX * TILE_SIZE_PX;
    const py = systemData.startY * TILE_SIZE_PX;
    const cx = px + TILE_SIZE_PX / 2;
    const cy = py + TILE_SIZE_PX / 2;

    // Blue border
    const hw = TILE_SIZE_PX / 2 - 1.5;
    const hh = TILE_SIZE_PX / 2 - 1.5;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0078ff, depthTest: false, transparent: true, opacity: 1.0, linewidth: 3,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.position.set(cx, cy, 5.2);
    line.renderOrder = 9995;
    line.frustumCulled = false;
    rendererObj.scene.add(line);
    startPosMeshesRef.current.push(line);

    // Character image (loaded async via CanvasTexture)
    if (playerCharacterName) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!rendererObjRef.current) return;
        const isSingle = playerCharacterName.startsWith('$');
        const charW = isSingle ? img.width / 3 : img.width / 12;
        const charH = isSingle ? img.height / 4 : img.height / 8;
        const charCol = isSingle ? 0 : playerCharacterIndex % 4;
        const charRow = isSingle ? 0 : Math.floor(playerCharacterIndex / 4);
        // Direction: down (row 0), pattern 1 (middle)
        const srcX = charCol * charW * 3 + 1 * charW;
        const srcY = charRow * charH * 4 + 0 * charH;

        const cvs = document.createElement('canvas');
        cvs.width = TILE_SIZE_PX;
        cvs.height = TILE_SIZE_PX;
        const ctx = cvs.getContext('2d')!;
        const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
        const dw = charW * scale;
        const dh = charH * scale;
        const dx = (TILE_SIZE_PX - dw) / 2;
        const dy = TILE_SIZE_PX - dh;
        ctx.drawImage(img, srcX, srcY, charW, charH, dx, dy, dw, dh);

        const tex = new THREE.CanvasTexture(cvs);
        tex.flipY = false;
        tex.minFilter = THREE.LinearFilter;
        const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, 5.1);
        mesh.renderOrder = 9994;
        mesh.frustumCulled = false;
        rendererObj.scene.add(mesh);
        startPosMeshesRef.current.push(mesh);
        requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
      };
      img.src = `/api/resources/img_characters/${playerCharacterName}.png`;
    }

    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [systemData, currentMapId, playerCharacterName, playerCharacterIndex, rendererReady]);

  // Sync event overlay (border + name) in event edit mode
  // 캐릭터 스프라이트의 _threeObj에 자식으로 추가 → 3D 빌보드 자동 적용
  useEffect(() => {
    const spriteset = spritesetRef.current;
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose: 이전 오버레이 제거 (부모에서 remove)
    for (const m of eventOverlayMeshesRef.current) {
      if (m.parent) m.parent.remove(m);
      if (m.material?.map) m.material.map.dispose();
      m.geometry?.dispose();
      m.material?.dispose();
    }
    eventOverlayMeshesRef.current = [];

    if (editMode !== 'event' || !currentMap?.events || !spriteset?._characterSprites) {
      requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
      return;
    }

    // eventId → Sprite_Character 맵 구축
    const charSprites = spriteset._characterSprites as any[];
    const eventSpriteMap = new Map<number, any>();
    for (const cs of charSprites) {
      if (cs._character && cs._character._eventId) {
        eventSpriteMap.set(cs._character._eventId, cs);
      }
    }

    const events = currentMap.events;
    for (let i = 1; i < events.length; i++) {
      const ev = events[i];
      if (!ev) continue;

      const sprite = eventSpriteMap.get(ev.id);
      // 스프라이트의 _threeObj가 있으면 거기에 자식으로 추가
      const parentObj = sprite?._threeObj;

      // 이미지가 없는 이벤트: 반투명 파란 배경 (scene에 직접 추가)
      const hasImage = ev.pages && ev.pages[0]?.image && (
        ev.pages[0].image.characterName || ev.pages[0].image.tileId > 0
      );
      if (!hasImage) {
        const fillGeom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const fillMat = new THREE.MeshBasicMaterial({
          color: 0x0078d4, opacity: 0.35, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const fillMesh = new THREE.Mesh(fillGeom, fillMat);
        const ex = ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const ey = ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        fillMesh.position.set(ex, ey, 5.5);
        fillMesh.renderOrder = 9990;
        fillMesh.frustumCulled = false;
        fillMesh.userData.editorGrid = true;
        rendererObj.scene.add(fillMesh);
        eventOverlayMeshesRef.current.push(fillMesh);
      }

      // 파란색 테두리 (scene에 직접 - 타일 기준 위치)
      const tileX = ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const tileY = ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const hw = TILE_SIZE_PX / 2 - 1;
      const hh = TILE_SIZE_PX / 2 - 1;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x0078d4, depthTest: false, transparent: true, opacity: 1.0,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.position.set(tileX, tileY, 5.8);
      line.renderOrder = 9991;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rendererObj.scene.add(line);
      eventOverlayMeshesRef.current.push(line);

      // 이벤트 이름 라벨 → 스프라이트의 _threeObj 자식으로 추가
      const displayName = ev.name || `EV${String(ev.id).padStart(3, '0')}`;
      const cvsW = 320;
      const cvsH = 80;
      const cvs = document.createElement('canvas');
      cvs.width = cvsW;
      cvs.height = cvsH;
      const ctx = cvs.getContext('2d')!;
      ctx.clearRect(0, 0, cvsW, cvsH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(displayName, cvsW / 2, cvsH / 2, cvsW - 8);
      const tex = new THREE.CanvasTexture(cvs);
      tex.flipY = false;
      tex.minFilter = THREE.LinearFilter;
      const labelW = TILE_SIZE_PX * 1.5;
      const labelH = labelW * (cvsH / cvsW);
      const labelGeom = new THREE.PlaneGeometry(labelW, labelH);
      const labelMat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(labelGeom, labelMat);
      labelMesh.renderOrder = 9992;
      labelMesh.frustumCulled = false;
      labelMesh.userData.editorGrid = true;

      if (parentObj) {
        // 스프라이트 자식: 로컬 좌표 (0,0이 스프라이트 위치)
        // 스프라이트 높이의 위쪽에 배치 (anchor.y=1 기준이므로 위로 올림)
        const spriteH = sprite._threeObj.scale.y || TILE_SIZE_PX;
        labelMesh.position.set(0, -spriteH - labelH / 2 - 2, 1);
        parentObj.add(labelMesh);
      } else {
        // 스프라이트 없으면 scene에 직접
        labelMesh.position.set(tileX, ev.y * TILE_SIZE_PX - labelH / 2 - 2, 5.9);
        rendererObj.scene.add(labelMesh);
      }
      eventOverlayMeshesRef.current.push(labelMesh);
    }

    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [editMode, currentMap?.events, rendererReady]);

  // Sync drag previews (event/light/object drag) via Three.js
  useEffect(() => {
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
    for (const m of dragPreviewMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    dragPreviewMeshesRef.current = [];

    for (const dp of dragPreviews) {
      let fillColor: number, strokeColor: number;
      let dpW = 1, dpH = 1;
      if (dp.type === 'event') {
        fillColor = 0x00b450; strokeColor = 0x00ff00;
      } else if (dp.type === 'light') {
        fillColor = 0xffcc88; strokeColor = 0xffcc88;
      } else {
        fillColor = 0x00ff66; strokeColor = 0x00ff66;
        dpW = dp.width || 1;
        dpH = dp.height || 1;
      }

      // Fill quad
      const geom = new THREE.PlaneGeometry(TILE_SIZE_PX * dpW, TILE_SIZE_PX * dpH);
      const mat = new THREE.MeshBasicMaterial({
        color: fillColor, opacity: 0.4, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      const cx = dp.x * TILE_SIZE_PX + TILE_SIZE_PX * dpW / 2;
      const cy = dp.type === 'object'
        ? (dp.y - dpH + 1) * TILE_SIZE_PX + TILE_SIZE_PX * dpH / 2
        : dp.y * TILE_SIZE_PX + TILE_SIZE_PX * dpH / 2;
      mesh.position.set(cx, cy, 6);
      mesh.renderOrder = 10000;
      mesh.frustumCulled = false;
      rendererObj.scene.add(mesh);
      dragPreviewMeshesRef.current.push(mesh);

      // Stroke outline
      const hw = TILE_SIZE_PX * dpW / 2;
      const hh = TILE_SIZE_PX * dpH / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: strokeColor, depthTest: false, transparent: true, opacity: 1.0,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.position.set(cx, cy, 6.5);
      line.renderOrder = 10001;
      line.frustumCulled = false;
      rendererObj.scene.add(line);
      dragPreviewMeshesRef.current.push(line);
    }

    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [dragPreviews]);

  // Sync light edit overlay (range circle, selection highlight, ground dot)
  useEffect(() => {
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
    for (const m of lightOverlayMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    lightOverlayMeshesRef.current = [];

    if (!lightEditMode || !currentMap?.editorLights?.points) {
      requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
      return;
    }

    const points = currentMap.editorLights.points;
    for (const pl of points) {
      const px = pl.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const py = pl.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const isSelected = selectedLightId === pl.id;

      // 1. 범위 원 (distance circle)
      const segments = 64;
      const circleGeom = new THREE.RingGeometry(pl.distance - 1, pl.distance, segments);
      const color = new THREE.Color(pl.color);
      const circleMat = new THREE.MeshBasicMaterial({
        color, opacity: 0.2, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const circle = new THREE.Mesh(circleGeom, circleMat);
      circle.position.set(px, py, 3);
      circle.renderOrder = 9980;
      circle.frustumCulled = false;
      circle.userData.editorGrid = true;
      rendererObj.scene.add(circle);
      lightOverlayMeshesRef.current.push(circle);

      // 범위 원 내부 채우기
      const fillGeom = new THREE.CircleGeometry(pl.distance, segments);
      const fillMat = new THREE.MeshBasicMaterial({
        color, opacity: 0.08, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const fill = new THREE.Mesh(fillGeom, fillMat);
      fill.position.set(px, py, 2.9);
      fill.renderOrder = 9979;
      fill.frustumCulled = false;
      fill.userData.editorGrid = true;
      rendererObj.scene.add(fill);
      lightOverlayMeshesRef.current.push(fill);

      // 2. 선택/비선택 강조 (colored circle at light position)
      const radius = isSelected ? 12 : 9;
      const markerGeom = new THREE.CircleGeometry(radius, 32);
      const markerMat = new THREE.MeshBasicMaterial({
        color, opacity: 0.9, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(px, py, 5.5);
      marker.renderOrder = 9985;
      marker.frustumCulled = false;
      marker.userData.editorGrid = true;
      rendererObj.scene.add(marker);
      lightOverlayMeshesRef.current.push(marker);

      // 선택 테두리
      const ringGeom = new THREE.RingGeometry(radius - 1.5, radius + 1.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffffff : 0x000000,
        opacity: isSelected ? 1.0 : 0.6,
        transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(px, py, 5.6);
      ring.renderOrder = 9986;
      ring.frustumCulled = false;
      ring.userData.editorGrid = true;
      rendererObj.scene.add(ring);
      lightOverlayMeshesRef.current.push(ring);

      // 3. 바닥 위치 점 (ground dot) - Z가 높을 때
      const pz = pl.z ?? 30;
      if (pz > 2) {
        const dotGeom = new THREE.CircleGeometry(3, 16);
        const dotMat = new THREE.MeshBasicMaterial({
          color, opacity: 0.5, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const dot = new THREE.Mesh(dotGeom, dotMat);
        dot.position.set(px, py, 0.5);
        dot.renderOrder = 9981;
        dot.frustumCulled = false;
        dot.userData.editorGrid = true;
        rendererObj.scene.add(dot);
        lightOverlayMeshesRef.current.push(dot);
      }
    }

    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [lightEditMode, selectedLightId, currentMap?.editorLights]);

  return {
    rendererObjRef, tilemapRef, stageRef, spritesetRef, gridMeshRef,
    renderRequestedRef, lastMapDataRef,
    regionMeshesRef, objectMeshesRef,
    cursorMeshRef, selectionMeshRef,
    dragPreviewMeshesRef, toolPreviewMeshesRef,
  };
}
