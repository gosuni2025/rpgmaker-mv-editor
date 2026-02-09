import React, { useRef, useEffect } from 'react';
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
  const cursorMeshRef = useRef<any>(null);
  const selectionMeshRef = useRef<any>(null);
  const dragPreviewMeshesRef = useRef<any[]>([]);
  const toolPreviewMeshesRef = useRef<any[]>([]);

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

      ShadowLight._scene = rendererObj.scene;
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
      stage._threeObj.add(gridLines);  // stageObj의 자식 → 2D/3D 동일 패스에서 렌더
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
      function waitAndRender() {
        if (disposed) return;
        if (spriteset._tilemap && spriteset._tilemap.isReady()) {
          spriteset._tilemap._needsRepaint = true;
          renderOnce();
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
        disposeSceneObjects(rendererObj.scene, regionMeshesRef.current);
        regionMeshesRef.current = [];
        disposeSceneObjects(rendererObj.scene, dragPreviewMeshesRef.current);
        dragPreviewMeshesRef.current = [];
        disposeSceneObjects(rendererObj.scene, toolPreviewMeshesRef.current);
        toolPreviewMeshesRef.current = [];
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

    if (currentLayer !== 5 || mode3d) {
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
        rendererObj.scene.add(labelMesh);
        regionMeshesRef.current.push(labelMesh);
      }
    }
    requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef);
  }, [currentMap, currentLayer, mode3d]);

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

  return {
    rendererObjRef, tilemapRef, stageRef, spritesetRef, gridMeshRef,
    renderRequestedRef, lastMapDataRef,
    regionMeshesRef, objectMeshesRef,
    cursorMeshRef, selectionMeshRef,
    dragPreviewMeshesRef, toolPreviewMeshesRef,
  };
}
