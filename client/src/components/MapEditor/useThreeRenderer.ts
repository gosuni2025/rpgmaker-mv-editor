import React, { useRef, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { editorRender, syncEditorLightsToScene, sync3DOverlays, disposeSceneObjects } from './threeSceneSync';
import { createBitmapFromImage } from './threeSpriteFactory';

// Runtime globals (loaded via index.html script tags)
declare const ShaderTilemap: any;
declare const ThreeContainer: any;
declare const RendererStrategy: any;
declare const RendererFactory: any;
declare const Graphics: any;
declare const Mode3D: any;
declare const ShadowLight: any;

export interface ThreeRendererRefs {
  rendererObjRef: React.MutableRefObject<any>;
  tilemapRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  gridMeshRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
  lastMapDataRef: React.MutableRefObject<number[] | null>;
  eventSpritesRef: React.MutableRefObject<any[]>;
  playerSpriteRef: React.MutableRefObject<any>;
  regionMeshesRef: React.MutableRefObject<any[]>;
  objectMeshesRef: React.MutableRefObject<any[]>;
  cursorMeshRef: React.MutableRefObject<any>;
  selectionMeshRef: React.MutableRefObject<any>;
}

export function useThreeRenderer(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  tilesetImages: Record<number, HTMLImageElement>,
  charImages: Record<string, HTMLImageElement>,
  playerCharImg: HTMLImageElement | null,
  showGrid: boolean,
): ThreeRendererRefs {
  const currentMap = useEditorStore((s) => s.currentMap);
  const tilesetInfo = useEditorStore((s) => s.tilesetInfo);
  const mode3d = useEditorStore((s) => s.mode3d);
  const editMode = useEditorStore((s) => s.editMode);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);

  // Three.js renderer refs
  const rendererObjRef = useRef<any>(null);
  const tilemapRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const lastMapDataRef = useRef<number[] | null>(null);
  const renderRequestedRef = useRef(false);
  const gridMeshRef = useRef<any>(null);
  // 3D overlay refs
  const eventSpritesRef = useRef<any[]>([]);
  const playerSpriteRef = useRef<any>(null);
  const regionMeshesRef = useRef<any[]>([]);
  const objectMeshesRef = useRef<any[]>([]);
  const cursorMeshRef = useRef<any>(null);
  const selectionMeshRef = useRef<any>(null);

  // =========================================================================
  // Three.js ShaderTilemap setup & render loop
  // =========================================================================
  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas || !currentMap || !(window as any)._editorRuntimeReady) return;
    if (Object.keys(tilesetImages).length === 0) return;

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

    const strategy = RendererStrategy.getStrategy();
    const THREE = (window as any).THREE;
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
    (window as any)._editorRendererObj = rendererObj;

    const stage = new ThreeContainer();
    stageRef.current = stage;

    const tilemap = new ShaderTilemap();
    tilemap._margin = 0;
    tilemap._width = mapPxW;
    tilemap._height = mapPxH;
    tilemap.animationCount = 0;
    tilemap.animationFrame = 0;
    tilemapRef.current = tilemap;

    tilemap.setData(width, height, [...data]);
    lastMapDataRef.current = data;

    if (tilesetInfo && tilesetInfo.flags) {
      tilemap.flags = tilesetInfo.flags;
    }

    const bitmaps: any[] = [];
    for (let i = 0; i < 9; i++) {
      if (tilesetImages[i]) {
        bitmaps[i] = createBitmapFromImage(tilesetImages[i]);
      } else {
        const BitmapClass = (window as any).Bitmap;
        const placeholder = Object.create(BitmapClass.prototype);
        placeholder._defer = false;
        placeholder._image = null;
        placeholder._url = '';
        placeholder._paintOpacity = 255;
        placeholder._smooth = false;
        placeholder._loadListeners = [];
        placeholder._loadingState = 'loaded';
        placeholder._decodeAfterRequest = false;
        placeholder.cacheEntry = null;
        placeholder._dirty = false;
        placeholder.__canvas = document.createElement('canvas');
        placeholder.__canvas.width = 1;
        placeholder.__canvas.height = 1;
        placeholder.__context = placeholder.__canvas.getContext('2d');
        placeholder.__baseTexture = RendererFactory.createBaseTexture(placeholder.__canvas);
        placeholder.__baseTexture.mipmap = false;
        placeholder.__baseTexture.width = 1;
        placeholder.__baseTexture.height = 1;
        bitmaps[i] = placeholder;
      }
    }
    tilemap.bitmaps = bitmaps;

    tilemap._createLayers();
    tilemap.refreshTileset();
    tilemap._needsRepaint = true;

    stage.addChild(tilemap);
    rendererObj.scene.add(stage._threeObj);

    Mode3D._spriteset = tilemap;

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

    function renderOnce() {
      console.log('[Shadow] renderOnce ENTRY');
      if (!rendererObjRef.current) return;
      const latestMap = useEditorStore.getState().currentMap;
      if (latestMap && (latestMap.width * TILE_SIZE_PX !== mapPxW || latestMap.height * TILE_SIZE_PX !== mapPxH)) return;
      if (latestMap && latestMap.data !== lastMapDataRef.current) {
        tilemap._mapData = [...latestMap.data];
        tilemap._needsRepaint = true;
        lastMapDataRef.current = latestMap.data;
      }
      rendererObj._drawOrderCounter = 0;
      stage.updateTransform();
      strategy._syncHierarchy(rendererObj, stage);

      const _SL = (window as any).ShadowLight;
      if (_SL?._active) {
        rendererObj.renderer.shadowMap.needsUpdate = true;
      }
      console.log('[Shadow] renderOnce called, SL active=' + !!(_SL?._active) + ', shadowMapEnabled=' + rendererObj.renderer.shadowMap.enabled);
      editorRender(rendererObj, stage);

      // Shadow debug log (one-shot)
      if (_SL?._active && !(renderOnce as any)._shadowLogged) {
        (renderOnce as any)._shadowLogged = true;
        const r = rendererObj.renderer;
        const dl = _SL._directionalLight;
        const gl = r.getContext();
        let castCount = 0, recvCount = 0;
        rendererObj.scene.traverse((o: any) => {
          if (o.isMesh && o.castShadow) castCount++;
          if (o.isMesh && o.receiveShadow) recvCount++;
        });
        let shadowPixelInfo = 'no shadow map';
        if (dl?.shadow?.map) {
          try {
            const props = r.properties.get(dl.shadow.map);
            if (props?.__webglFramebuffer) {
              const curFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);
              gl.bindFramebuffer(gl.FRAMEBUFFER, props.__webglFramebuffer);
              let nonMax = 0;
              for (let sx = 0; sx < 2048; sx += 64) {
                for (let sy = 0; sy < 2048; sy += 64) {
                  const p = new Uint8Array(4);
                  gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
                  if (p[0] < 255 || p[1] < 255 || p[2] < 255) nonMax++;
                }
              }
              gl.bindFramebuffer(gl.FRAMEBUFFER, curFB);
              shadowPixelInfo = `${nonMax} non-max pixels out of ${32*32} samples`;
            }
          } catch (e) { shadowPixelInfo = 'read error: ' + (e as any).message; }
        }
        const sc = dl?.shadow?.camera;
        console.log(`[Shadow Debug] enabled=${r.shadowMap.enabled} cast=${castCount} recv=${recvCount} shadowMap=${shadowPixelInfo} lightIntensity=${dl?.intensity} bias=${dl?.shadow?.bias} shadowCam=[${sc?.left},${sc?.right},${sc?.top},${sc?.bottom}] near=${sc?.near} far=${sc?.far}`);
        console.log(`[Shadow Debug] lightPos=(${dl?.position?.x},${dl?.position?.y},${dl?.position?.z}) targetPos=(${dl?.target?.position?.x},${dl?.target?.position?.y},${dl?.target?.position?.z})`);
        rendererObj.scene.traverse((o: any) => {
          if (o.isMesh && o.castShadow) {
            console.log(`[Shadow Cast] pos=(${Math.round(o.position.x)},${Math.round(o.position.y)},${Math.round(o.position.z)}) transparent=${o.material.transparent} alphaTest=${o.material.alphaTest} customDepth=${!!o.customDepthMaterial}`);
          }
          if (o.isMesh && o.receiveShadow) {
            const norm = o.geometry?.attributes?.normal;
            const nz = norm ? norm.getZ(0) : 'N/A';
            console.log(`[Shadow Recv] mat=${o.material.type} transparent=${o.material.transparent} depthWrite=${o.material.depthWrite} depthTest=${o.material.depthTest} normalZ=${nz} side=${o.material.side}`);
          }
        });
      }
    }

    function requestRender() {
      if (renderRequestedRef.current) return;
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        renderOnce();
      });
    }

    renderOnce();

    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      if (state.currentMap !== prevState.currentMap) {
        requestRender();
      }
      if (state.mode3d !== prevState.mode3d) {
        if (!state.mode3d) {
          Mode3D._perspCamera = null;
        }
        if (state.shadowLight && state.currentMap?.editorLights) {
          syncEditorLightsToScene(rendererObj.scene, state.currentMap.editorLights, state.mode3d);
        }
        tilemap._needsRepaint = true;
        requestRender();
      }
      if (state.shadowLight !== prevState.shadowLight) {
        if (state.shadowLight) {
          ShadowLight._active = true;
          ShadowLight._addLightsToScene(rendererObj.scene);
          syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
        } else {
          ShadowLight._active = false;
          ShadowLight._removeLightsFromScene(rendererObj.scene);
        }
        const updateSpriteShadow = (mesh: any) => {
          if (!mesh?.isMesh) return;
          const active = state.shadowLight;
          if (active) {
            if (!mesh.material?.isMeshPhongMaterial) {
              const oldMat = mesh.material;
              mesh.material = new THREE.MeshPhongMaterial({
                map: oldMat.map, transparent: false, alphaTest: 0.5, depthTest: true, depthWrite: true,
                side: THREE.DoubleSide, emissive: new THREE.Color(0x000000),
                specular: new THREE.Color(0x000000), shininess: 0,
              });
              mesh.material.visible = oldMat.visible;
              mesh.material.needsUpdate = true;
              oldMat.dispose();
            }
            mesh.castShadow = true;
            if (!mesh.customDepthMaterial) {
              mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking,
                map: mesh.material.map,
                alphaTest: 0.5,
                side: THREE.DoubleSide,
              });
            }
            if (mesh.position.z < 48) {
              mesh._shadowOrigZ = mesh.position.z;
              mesh.position.z = 48;
            }
          } else {
            if (mesh.material?.isMeshPhongMaterial) {
              const oldMat = mesh.material;
              mesh.material = new THREE.MeshBasicMaterial({
                map: oldMat.map, transparent: true, depthTest: false,
                side: THREE.DoubleSide,
              });
              mesh.material.visible = oldMat.visible;
              mesh.material.needsUpdate = true;
              oldMat.dispose();
            }
            mesh.castShadow = false;
            mesh.customDepthMaterial = null;
            if (mesh._shadowOrigZ !== undefined) {
              mesh.position.z = mesh._shadowOrigZ;
              delete mesh._shadowOrigZ;
            }
          }
        };
        for (const obj of eventSpritesRef.current) {
          updateSpriteShadow(obj);
        }
        if (playerSpriteRef.current) {
          for (const obj of playerSpriteRef.current) {
            updateSpriteShadow(obj);
          }
        }
        ShadowLight._resetTilemapMeshes(tilemap);
        tilemap._needsRepaint = true;
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

    return () => {
      unsubscribe();
      disposeSceneObjects(rendererObj.scene, eventSpritesRef.current);
      eventSpritesRef.current = [];
      if (playerSpriteRef.current) {
        disposeSceneObjects(rendererObj.scene, playerSpriteRef.current);
        playerSpriteRef.current = null;
      }
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
      lastMapDataRef.current = null;
    };
  }, [currentMap?.tilesetId, currentMap?.width, currentMap?.height, tilesetImages, tilesetInfo]);

  // =========================================================================
  // 3D overlay sync
  // =========================================================================
  useEffect(() => {
    if (!mode3d) return;
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;

    sync3DOverlays(
      rendererObj.scene,
      eventSpritesRef, playerSpriteRef, regionMeshesRef, objectMeshesRef,
      currentMap, charImages, editMode, currentLayer,
      systemData, currentMapId, playerCharImg,
      playerCharacterName, playerCharacterIndex,
      tilesetImages, selectedObjectId,
    );

    requestAnimationFrame(() => {
      if (!rendererObjRef.current || !stageRef.current) return;
      const rObj = rendererObjRef.current;
      const strategy = (window as any).RendererStrategy?.getStrategy();
      rObj._drawOrderCounter = 0;
      stageRef.current.updateTransform();
      if (strategy) strategy._syncHierarchy(rObj, stageRef.current);
      editorRender(rObj, stageRef.current);
      renderRequestedRef.current = false;
    });
  }, [mode3d, currentMap, charImages, editMode, currentLayer, systemData, currentMapId, playerCharImg, playerCharacterName, playerCharacterIndex, tilesetImages, selectedObjectId]);

  // Cleanup 3D overlays when switching out of 3D mode
  useEffect(() => {
    if (mode3d) return;
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;
    disposeSceneObjects(rendererObj.scene, eventSpritesRef.current);
    eventSpritesRef.current = [];
    if (playerSpriteRef.current) {
      disposeSceneObjects(rendererObj.scene, playerSpriteRef.current);
      playerSpriteRef.current = null;
    }
    disposeSceneObjects(rendererObj.scene, regionMeshesRef.current);
    regionMeshesRef.current = [];
    disposeSceneObjects(rendererObj.scene, objectMeshesRef.current);
    objectMeshesRef.current = [];
  }, [mode3d]);

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
    rendererObjRef, tilemapRef, stageRef, gridMeshRef,
    renderRequestedRef, lastMapDataRef,
    eventSpritesRef, playerSpriteRef, regionMeshesRef, objectMeshesRef,
    cursorMeshRef, selectionMeshRef,
  };
}
