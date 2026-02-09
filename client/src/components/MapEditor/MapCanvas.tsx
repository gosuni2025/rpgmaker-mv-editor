import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import type { RPGEvent, EventPage, MapData } from '../../types/rpgMakerMV';
import { posToTile, TILE_SIZE_PX, isAutotile, isTileA5, getAutotileKindExported, makeAutotileId, computeAutoShapeForPosition } from '../../utils/tileHelper';
import EventDetail from '../EventEditor/EventDetail';

// Runtime globals (loaded via index.html script tags)
declare const ShaderTilemap: any;
declare const ThreeContainer: any;
declare const RendererStrategy: any;
declare const RendererFactory: any;
declare const Graphics: any;
declare const Mode3D: any;
declare const ShadowLight: any;
declare const ConfigManager: any;

interface EventContextMenu {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  eventId: number | null;
}

/** Create a runtime Bitmap from a loaded HTMLImageElement */
function createBitmapFromImage(img: HTMLImageElement): any {
  const BitmapClass = (window as any).Bitmap;
  const bmp = Object.create(BitmapClass.prototype);
  bmp._defer = false;
  bmp._image = null;
  bmp._url = '';
  bmp._paintOpacity = 255;
  bmp._smooth = false;
  bmp._loadListeners = [];
  bmp._loadingState = 'loaded';
  bmp._decodeAfterRequest = false;
  bmp.cacheEntry = null;
  bmp.fontFace = 'GameFont';
  bmp.fontSize = 28;
  bmp.fontItalic = false;
  bmp.textColor = '#ffffff';
  bmp.outlineColor = 'rgba(0, 0, 0, 0.5)';
  bmp.outlineWidth = 4;
  bmp._dirty = false;

  // Create canvas and draw image onto it
  bmp.__canvas = document.createElement('canvas');
  bmp.__canvas.width = img.width;
  bmp.__canvas.height = img.height;
  bmp.__context = bmp.__canvas.getContext('2d', { willReadFrequently: true });
  bmp.__context.drawImage(img, 0, 0);

  // Create Three.js base texture from the canvas
  bmp.__baseTexture = RendererFactory.createBaseTexture(bmp.__canvas);
  bmp.__baseTexture.mipmap = false;
  bmp.__baseTexture.width = img.width;
  bmp.__baseTexture.height = img.height;
  RendererFactory.setScaleMode(bmp.__baseTexture, RendererFactory.SCALE_MODE_NEAREST);

  return bmp;
}

export default function MapCanvas() {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastTile = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const pendingChanges = useRef<TileChange[]>([]);
  const shadowPaintMode = useRef<boolean>(true);
  const shadowPainted = useRef<Set<string>>(new Set());

  // Three.js renderer refs
  const rendererObjRef = useRef<any>(null);
  const tilemapRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const lastMapDataRef = useRef<number[] | null>(null);
  const renderRequestedRef = useRef(false);
  const parallaxMeshRef = useRef<any>(null);
  const parallaxNameRef = useRef<string>('');

  const currentMap = useEditorStore((s) => s.currentMap);
  const tilesetInfo = useEditorStore((s) => s.tilesetInfo);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const selectedTiles = useEditorStore((s) => s.selectedTiles);
  const selectedTilesWidth = useEditorStore((s) => s.selectedTilesWidth);
  const selectedTilesHeight = useEditorStore((s) => s.selectedTilesHeight);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const updateMapTile = useEditorStore((s) => s.updateMapTile);
  const updateMapTiles = useEditorStore((s) => s.updateMapTiles);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const setCursorTile = useEditorStore((s) => s.setCursorTile);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const mode3d = useEditorStore((s) => s.mode3d);
  const shadowLight = useEditorStore((s) => s.shadowLight);

  const [showGrid, setShowGrid] = useState(true);
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [charImages, setCharImages] = useState<Record<string, HTMLImageElement>>({});
  const [eventCtxMenu, setEventCtxMenu] = useState<EventContextMenu | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const pasteEvent = useEditorStore((s) => s.pasteEvent);
  const clipboard = useEditorStore((s) => s.clipboard);

  const selectedEventId = useEditorStore((s) => s.selectedEventId);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const systemData = useEditorStore((s) => s.systemData);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);

  // Event drag state
  const isDraggingEvent = useRef(false);
  const draggedEventId = useRef<number | null>(null);
  const dragEventOrigin = useRef<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [playerCharImg, setPlayerCharImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setShowGrid((e as CustomEvent<boolean>).detail);
    window.addEventListener('editor-toggle-grid', handler);
    return () => window.removeEventListener('editor-toggle-grid', handler);
  }, []);

  // Handle Delete key for events
  useEffect(() => {
    const handleDelete = () => {
      if (editMode === 'event' && selectedEventId != null) {
        deleteEvent(selectedEventId);
      }
    };
    window.addEventListener('editor-delete', handleDelete);
    return () => window.removeEventListener('editor-delete', handleDelete);
  }, [editMode, selectedEventId, deleteEvent]);

  // Handle Copy/Paste for events
  useEffect(() => {
    const handleCopy = () => {
      if (editMode === 'event' && selectedEventId != null) {
        copyEvent(selectedEventId);
      }
    };
    const handlePaste = () => {
      if (editMode === 'event' && clipboard?.type === 'event') {
        const ev = currentMap?.events?.find(e => e && e.id === selectedEventId);
        if (ev) {
          pasteEvent(ev.x, ev.y + 1);
        }
      }
    };
    window.addEventListener('editor-copy', handleCopy);
    window.addEventListener('editor-paste', handlePaste);
    return () => {
      window.removeEventListener('editor-copy', handleCopy);
      window.removeEventListener('editor-paste', handlePaste);
    };
  }, [editMode, selectedEventId, copyEvent, pasteEvent, clipboard, currentMap]);

  // Load tileset images
  useEffect(() => {
    if (!currentMap || !currentMap.tilesetNames) {
      setTilesetImages({});
      return;
    }

    const names = currentMap.tilesetNames;
    const loaded: Record<number, HTMLImageElement> = {};
    let cancelled = false;

    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let remaining = 0;

    indices.forEach((idx) => {
      const name = names[idx];
      if (!name) return;
      remaining++;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[idx] = img;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.src = `/api/resources/img_tilesets/${name}.png`;
    });

    if (remaining === 0) setTilesetImages({});

    return () => {
      cancelled = true;
    };
  }, [currentMap?.tilesetId, currentMap?.tilesetNames]);

  // Load character images used by events
  useEffect(() => {
    if (!currentMap || !currentMap.events) {
      setCharImages({});
      return;
    }
    const names = new Set<string>();
    for (const ev of currentMap.events) {
      if (!ev || !ev.pages) continue;
      for (const page of ev.pages) {
        if (page.image && page.image.characterName) {
          names.add(page.image.characterName);
        }
      }
    }
    if (names.size === 0) {
      setCharImages({});
      return;
    }
    let cancelled = false;
    const loaded: Record<string, HTMLImageElement> = {};
    let remaining = names.size;
    for (const name of names) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[name] = img;
        remaining--;
        if (remaining <= 0) setCharImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setCharImages({ ...loaded });
      };
      img.src = `/api/resources/img_characters/${name}.png`;
    }
    return () => { cancelled = true; };
  }, [currentMap?.events]);

  // Load player character image
  useEffect(() => {
    if (!playerCharacterName) {
      setPlayerCharImg(null);
      return;
    }
    if (charImages[playerCharacterName]) {
      setPlayerCharImg(charImages[playerCharacterName]);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setPlayerCharImg(img); };
    img.onerror = () => { if (!cancelled) setPlayerCharImg(null); };
    img.src = `/api/resources/img_characters/${playerCharacterName}.png`;
    return () => { cancelled = true; };
  }, [playerCharacterName, charImages]);

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

    // Set Graphics dimensions directly (bypass setter to avoid _updateAllElements)
    Graphics._width = mapPxW;
    Graphics._height = mapPxH;

    // Set canvas size
    canvas.width = mapPxW;
    canvas.height = mapPxH;

    // Create renderer manually with preserveDrawingBuffer for on-demand rendering
    const strategy = RendererStrategy.getStrategy();
    const THREE = (window as any).THREE;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(mapPxW, mapPxH);
    renderer.setClearColor(0x000000, 1);
    renderer.sortObjects = true;
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

    // Create stage container
    const stage = new ThreeContainer();
    stageRef.current = stage;

    // Create ShaderTilemap
    const tilemap = new ShaderTilemap();
    tilemap._margin = 0;
    tilemap._width = mapPxW;
    tilemap._height = mapPxH;
    // Initialize animation state (update() is not called in editor mode,
    // but _hackRenderer reads animationFrame during updateTransform)
    tilemap.animationCount = 0;
    tilemap.animationFrame = 0;
    tilemapRef.current = tilemap;

    // Set map data
    tilemap.setData(width, height, [...data]);
    lastMapDataRef.current = data;

    // Set tileset flags
    if (tilesetInfo && tilesetInfo.flags) {
      tilemap.flags = tilesetInfo.flags;
    }

    // Create Bitmap objects from loaded images
    const bitmaps: any[] = [];
    for (let i = 0; i < 9; i++) {
      if (tilesetImages[i]) {
        bitmaps[i] = createBitmapFromImage(tilesetImages[i]);
      } else {
        // Create placeholder bitmap using Object.create to avoid bootstrap
        // constructor's own properties shadowing rpg_core.js prototype getters
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

    // Force layer creation and refresh
    tilemap._createLayers();
    tilemap.refreshTileset();
    tilemap._needsRepaint = true;

    // Add tilemap to stage, stage to scene
    stage.addChild(tilemap);
    rendererObj.scene.add(stage._threeObj);

    // Set Mode3D spriteset reference (for 2-pass 3D rendering)
    Mode3D._spriteset = tilemap;

    // Parallax background setup
    function updateParallaxBackground(parallaxName: string, show: boolean) {
      // Remove existing parallax mesh
      if (parallaxMeshRef.current) {
        rendererObj.scene.remove(parallaxMeshRef.current);
        if (parallaxMeshRef.current.material.map) {
          parallaxMeshRef.current.material.map.dispose();
        }
        parallaxMeshRef.current.material.dispose();
        parallaxMeshRef.current.geometry.dispose();
        parallaxMeshRef.current = null;
      }
      parallaxNameRef.current = parallaxName;

      if (!parallaxName || !show) return;

      const img = new Image();
      img.onload = () => {
        if (!rendererObjRef.current) return;
        // Check if parallax name hasn't changed while loading
        if (parallaxNameRef.current !== parallaxName) return;

        const tex = new THREE.TextureLoader().load(img.src);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        // Tile the texture to fill the entire map area
        tex.repeat.set(mapPxW / img.width, mapPxH / img.height);
        tex.image = img;
        tex.needsUpdate = true;

        const geo = new THREE.PlaneGeometry(mapPxW, mapPxH);
        const mat = new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        // Position at center of map, behind tilemap (z=-1)
        mesh.position.set(mapPxW / 2, mapPxH / 2, -1);
        mesh.renderOrder = -1;
        rendererObj.scene.add(mesh);
        parallaxMeshRef.current = mesh;

        requestRender();
      };
      img.src = `/api/resources/parallaxes/${parallaxName}.png`;
    }

    // Initial parallax
    updateParallaxBackground(currentMap.parallaxName, currentMap.parallaxShow);

    // On-demand render function
    function renderOnce() {
      if (!rendererObjRef.current) return;
      // Sync map data if changed
      const latestMap = useEditorStore.getState().currentMap;
      if (latestMap && latestMap.data !== lastMapDataRef.current) {
        tilemap._mapData = [...latestMap.data];
        tilemap._needsRepaint = true;
        lastMapDataRef.current = latestMap.data;
      }
      // Reset draw order counter
      rendererObj._drawOrderCounter = 0;
      // Update transforms on stage (recurses into tilemap)
      stage.updateTransform();
      // Sync hierarchy for render order
      strategy._syncHierarchy(rendererObj, stage);

      const is3D = ConfigManager.mode3d && Mode3D._spriteset;
      if (is3D) {
        // 3D 2-pass rendering
        if (!Mode3D._perspCamera) {
          Mode3D._perspCamera = Mode3D._createPerspCamera(mapPxW, mapPxH);
        }
        Mode3D._positionCamera(Mode3D._perspCamera, mapPxW, mapPxH);
        Mode3D._enforceNearestFilter(rendererObj.scene);
        rendererObj.renderer.render(rendererObj.scene, Mode3D._perspCamera);
      } else {
        rendererObj.renderer.render(rendererObj.scene, rendererObj.camera);
      }
    }

    // Debounced render via rAF to coalesce multiple store updates
    function requestRender() {
      if (renderRequestedRef.current) return;
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        renderOnce();
      });
    }

    // Initial render
    renderOnce();

    // Subscribe to store changes for on-demand re-render
    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      if (state.currentMap !== prevState.currentMap) {
        requestRender();
        // Check if parallax settings changed
        const curMap = state.currentMap;
        const prevMap = prevState.currentMap;
        if (curMap && prevMap &&
            (curMap.parallaxName !== prevMap.parallaxName || curMap.parallaxShow !== prevMap.parallaxShow)) {
          updateParallaxBackground(curMap.parallaxName, curMap.parallaxShow);
        }
      }
      // 3D mode toggle
      if (state.mode3d !== prevState.mode3d) {
        if (!state.mode3d) {
          Mode3D._perspCamera = null;
        }
        tilemap._needsRepaint = true;
        requestRender();
      }
      // Lighting toggle
      if (state.shadowLight !== prevState.shadowLight) {
        if (state.shadowLight) {
          ShadowLight._active = true;
          ShadowLight._addLightsToScene(rendererObj.scene);
        } else {
          ShadowLight._active = false;
          ShadowLight._removeLightsFromScene(rendererObj.scene);
        }
        ShadowLight._resetTilemapMeshes(tilemap);
        tilemap._needsRepaint = true;
        requestRender();
      }
    });

    return () => {
      unsubscribe();
      // Cleanup parallax
      if (parallaxMeshRef.current) {
        rendererObj.scene.remove(parallaxMeshRef.current);
        if (parallaxMeshRef.current.material.map) {
          parallaxMeshRef.current.material.map.dispose();
        }
        parallaxMeshRef.current.material.dispose();
        parallaxMeshRef.current.geometry.dispose();
        parallaxMeshRef.current = null;
      }
      parallaxNameRef.current = '';
      // Cleanup lighting
      if (ShadowLight._active) {
        ShadowLight._removeLightsFromScene(rendererObj.scene);
        ShadowLight._active = false;
      }
      Mode3D._spriteset = null;
      Mode3D._perspCamera = null;
      // Cleanup renderer
      if (rendererObj && rendererObj.renderer) {
        rendererObj.renderer.dispose();
      }
      rendererObjRef.current = null;
      tilemapRef.current = null;
      stageRef.current = null;
      lastMapDataRef.current = null;
    };
  }, [currentMap?.tilesetId, currentMap?.width, currentMap?.height, tilesetImages, tilesetInfo]);

  // =========================================================================
  // Overlay canvas rendering (grid, regions, events, player)
  // =========================================================================
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    if (!currentMap) {
      overlay.width = 400;
      overlay.height = 300;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No map selected', overlay.width / 2, overlay.height / 2);
      return;
    }

    const { width, height, data, events } = currentMap;
    const cw = width * TILE_SIZE_PX;
    const ch = height * TILE_SIZE_PX;

    // Ensure overlay is correct size
    if (overlay.width !== cw || overlay.height !== ch) {
      overlay.width = cw;
      overlay.height = ch;
    }

    ctx.clearRect(0, 0, cw, ch);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE_PX + 0.5, 0);
        ctx.lineTo(x * TILE_SIZE_PX + 0.5, ch);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE_PX + 0.5);
        ctx.lineTo(cw, y * TILE_SIZE_PX + 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE_PX + 1.5, 0);
        ctx.lineTo(x * TILE_SIZE_PX + 1.5, ch);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE_PX + 1.5);
        ctx.lineTo(cw, y * TILE_SIZE_PX + 1.5);
        ctx.stroke();
      }
    }

    // Region overlay (layer 5)
    if (currentLayer === 5) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const regionId = data[(5 * height + y) * width + x];
          if (regionId === 0) continue;
          const rx = x * TILE_SIZE_PX;
          const ry = y * TILE_SIZE_PX;
          const hue = (regionId * 137) % 360;
          ctx.fillStyle = `hsla(${hue}, 60%, 40%, 0.5)`;
          ctx.fillRect(rx, ry, TILE_SIZE_PX, TILE_SIZE_PX);
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 2;
          ctx.fillText(String(regionId), rx + TILE_SIZE_PX / 2, ry + TILE_SIZE_PX / 2);
          ctx.restore();
        }
      }
    }

    // Events
    if (events) {
      const showEventDetails = editMode === 'event';
      events.forEach((ev) => {
        if (!ev || ev.id === 0) return;
        const ex = ev.x * TILE_SIZE_PX;
        const ey = ev.y * TILE_SIZE_PX;

        let drewImage = false;
        if (ev.pages && ev.pages.length > 0) {
          const page = ev.pages[0];
          const img = page.image;
          if (img && img.characterName && charImages[img.characterName]) {
            const charImg = charImages[img.characterName];
            const isSingle = img.characterName.startsWith('$');
            const charW = isSingle ? charImg.width / 3 : charImg.width / 12;
            const charH = isSingle ? charImg.height / 4 : charImg.height / 8;
            const charCol = isSingle ? 0 : img.characterIndex % 4;
            const charRow = isSingle ? 0 : Math.floor(img.characterIndex / 4);
            const dirRow = img.direction === 8 ? 3 : img.direction === 6 ? 2 : img.direction === 4 ? 1 : 0;
            const pattern = img.pattern || 1;
            const sx = charCol * charW * 3 + pattern * charW;
            const sy = charRow * charH * 4 + dirRow * charH;
            const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
            const dw = charW * scale;
            const dh = charH * scale;
            const dx = ex + (TILE_SIZE_PX - dw) / 2;
            const dy = ey + (TILE_SIZE_PX - dh);
            ctx.drawImage(charImg, sx, sy, charW, charH, dx, dy, dw, dh);
            drewImage = true;
          }
        }

        if (showEventDetails) {
          if (!drewImage) {
            ctx.fillStyle = 'rgba(0,120,212,0.35)';
            ctx.fillRect(ex, ey, TILE_SIZE_PX, TILE_SIZE_PX);
          }
          ctx.strokeStyle = '#0078d4';
          ctx.lineWidth = 2;
          ctx.strokeRect(ex + 1, ey + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);

          if (ev.name) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 2;
            ctx.fillText(ev.name, ex + TILE_SIZE_PX / 2, ey + 2, TILE_SIZE_PX - 4);
            ctx.restore();
          }
        } else if (!drewImage) {
          ctx.fillStyle = 'rgba(0,120,212,0.25)';
          ctx.fillRect(ex, ey, TILE_SIZE_PX, TILE_SIZE_PX);
        }
      });
    }

    // Player start position
    if (systemData && currentMapId === systemData.startMapId) {
      const px = systemData.startX * TILE_SIZE_PX;
      const py = systemData.startY * TILE_SIZE_PX;

      ctx.save();
      if (playerCharImg) {
        const isSingle = playerCharacterName?.startsWith('$');
        const charW = isSingle ? playerCharImg.width / 3 : playerCharImg.width / 12;
        const charH = isSingle ? playerCharImg.height / 4 : playerCharImg.height / 8;
        const charCol = isSingle ? 0 : playerCharacterIndex % 4;
        const charRow = isSingle ? 0 : Math.floor(playerCharacterIndex / 4);
        const srcX = charCol * charW * 3 + 1 * charW;
        const srcY = charRow * charH * 4 + 0 * charH;
        const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
        const dw = charW * scale;
        const dh = charH * scale;
        const dx = px + (TILE_SIZE_PX - dw) / 2;
        const dy = py + (TILE_SIZE_PX - dh);
        ctx.drawImage(playerCharImg, srcX, srcY, charW, charH, dx, dy, dw, dh);
      }
      ctx.strokeStyle = '#0078ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1.5, py + 1.5, TILE_SIZE_PX - 3, TILE_SIZE_PX - 3);
      ctx.restore();
    }

    // Drag preview
    if (dragPreview && isDraggingEvent.current) {
      const dx = dragPreview.x * TILE_SIZE_PX;
      const dy = dragPreview.y * TILE_SIZE_PX;
      ctx.fillStyle = 'rgba(0,180,80,0.4)';
      ctx.fillRect(dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
    }
  }, [currentMap, charImages, showGrid, editMode, currentLayer, systemData, currentMapId, playerCharImg, playerCharacterName, playerCharacterIndex, dragPreview]);

  // =========================================================================
  // Coordinate conversion
  // =========================================================================
  const canvasToTile = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / zoomLevel;
    const cy = (e.clientY - rect.top) / zoomLevel;
    return posToTile(cx, cy);
  }, [zoomLevel]);

  const canvasToSubTile = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / zoomLevel;
    const cy = (e.clientY - rect.top) / zoomLevel;
    const tile = posToTile(cx, cy);
    if (!tile) return null;
    const subX = cx - tile.x * TILE_SIZE_PX;
    const subY = cy - tile.y * TILE_SIZE_PX;
    return { ...tile, subX, subY };
  }, [zoomLevel]);

  // =========================================================================
  // Tool logic (unchanged from original)
  // =========================================================================
  const placeAutotileAt = useCallback(
    (x: number, y: number, z: number, tileId: number, data: number[], width: number, height: number, changes: TileChange[], updates: { x: number; y: number; z: number; tileId: number }[]) => {
      const idx = (z * height + y) * width + x;
      const oldId = data[idx];
      data[idx] = tileId;

      if (isAutotile(tileId) && !isTileA5(tileId)) {
        const kind = getAutotileKindExported(tileId);
        const shape = computeAutoShapeForPosition(data, width, height, x, y, z, tileId);
        const correctId = makeAutotileId(kind, shape);
        data[idx] = correctId;
        if (correctId !== oldId) {
          changes.push({ x, y, z, oldTileId: oldId, newTileId: correctId });
          updates.push({ x, y, z, tileId: correctId });
        }
      } else {
        if (tileId !== oldId) {
          changes.push({ x, y, z, oldTileId: oldId, newTileId: tileId });
          updates.push({ x, y, z, tileId });
        }
      }

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = (z * height + ny) * width + nx;
          const nTileId = data[nIdx];
          if (!isAutotile(nTileId) || isTileA5(nTileId)) continue;
          const nKind = getAutotileKindExported(nTileId);
          const nShape = computeAutoShapeForPosition(data, width, height, nx, ny, z, nTileId);
          const nCorrectId = makeAutotileId(nKind, nShape);
          if (nCorrectId !== nTileId) {
            const nOldId = nTileId;
            data[nIdx] = nCorrectId;
            changes.push({ x: nx, y: ny, z, oldTileId: nOldId, newTileId: nCorrectId });
            updates.push({ x: nx, y: ny, z, tileId: nCorrectId });
          }
        }
      }
    },
    []
  );

  const placeTileWithUndo = useCallback(
    (tilePos: { x: number; y: number } | null) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap || !tilePos) return;
      const { x, y } = tilePos;
      if (x < 0 || x >= latestMap.width || y < 0 || y >= latestMap.height) return;

      const { selectedTiles: sTiles, selectedTilesWidth: stW, selectedTilesHeight: stH } = useEditorStore.getState();
      const isMulti = sTiles && (stW > 1 || stH > 1);

      if (currentLayer === 5) {
        if (selectedTool === 'fill') {
          floodFill(x, y);
          return;
        }
        if (isMulti && selectedTool === 'pen') {
          for (let row = 0; row < stH; row++) {
            for (let col = 0; col < stW; col++) {
              const tx = x + col, ty = y + row;
              if (tx >= latestMap.width || ty >= latestMap.height) continue;
              const z = 5;
              const idx = (z * latestMap.height + ty) * latestMap.width + tx;
              const oldTileId = latestMap.data[idx];
              const newTileId = sTiles[row][col];
              if (oldTileId !== newTileId) {
                pendingChanges.current.push({ x: tx, y: ty, z, oldTileId, newTileId });
              }
            }
          }
          const updates = pendingChanges.current.filter((_, i) => i >= pendingChanges.current.length - stW * stH).map(c => ({ x: c.x, y: c.y, z: c.z, tileId: c.newTileId }));
          if (updates.length > 0) updateMapTiles(updates);
          return;
        }
        const z = 5;
        const idx = (z * latestMap.height + y) * latestMap.width + x;
        const oldTileId = latestMap.data[idx];
        const newTileId = selectedTool === 'eraser' ? 0 : selectedTileId;
        if (oldTileId === newTileId) return;
        pendingChanges.current.push({ x, y, z, oldTileId, newTileId });
        updateMapTiles([{ x, y, z, tileId: newTileId }]);
        return;
      }

      if (selectedTool === 'eraser') {
        const changes: TileChange[] = [];
        const updates: { x: number; y: number; z: number; tileId: number }[] = [];
        const data = [...latestMap.data];
        placeAutotileAt(x, y, currentLayer, 0, data, latestMap.width, latestMap.height, changes, updates);
        if (updates.length > 0) {
          pendingChanges.current.push(...changes);
          updateMapTiles(updates);
        }
      } else if (selectedTool === 'pen') {
        if (isMulti) {
          const changes: TileChange[] = [];
          const updates: { x: number; y: number; z: number; tileId: number }[] = [];
          const data = [...latestMap.data];
          for (let row = 0; row < stH; row++) {
            for (let col = 0; col < stW; col++) {
              const tx = x + col, ty = y + row;
              if (tx < 0 || tx >= latestMap.width || ty < 0 || ty >= latestMap.height) continue;
              placeAutotileAt(tx, ty, currentLayer, sTiles[row][col], data, latestMap.width, latestMap.height, changes, updates);
            }
          }
          if (updates.length > 0) {
            pendingChanges.current.push(...changes);
            updateMapTiles(updates);
          }
        } else {
          const changes: TileChange[] = [];
          const updates: { x: number; y: number; z: number; tileId: number }[] = [];
          const data = [...latestMap.data];
          placeAutotileAt(x, y, currentLayer, selectedTileId, data, latestMap.width, latestMap.height, changes, updates);
          if (updates.length > 0) {
            pendingChanges.current.push(...changes);
            updateMapTiles(updates);
          }
        }
      } else if (selectedTool === 'fill') {
        floodFill(x, y);
      }
    },
    [selectedTool, selectedTileId, currentLayer, updateMapTiles, placeAutotileAt]
  );

  const floodFill = useCallback(
    (startX: number, startY: number) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const { width, height } = latestMap;
      const z = currentLayer;
      const data = [...latestMap.data];
      const targetId = data[(z * height + startY) * width + startX];

      if (z === 5) {
        if (targetId === selectedTileId) return;
        const visited = new Set<string>();
        const queue = [{ x: startX, y: startY }];
        const changes: TileChange[] = [];
        const updates: { x: number; y: number; z: number; tileId: number }[] = [];
        while (queue.length > 0) {
          const { x, y } = queue.shift()!;
          const key = `${x},${y}`;
          if (visited.has(key)) continue;
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const idx = (z * height + y) * width + x;
          if (data[idx] !== targetId) continue;
          visited.add(key);
          changes.push({ x, y, z, oldTileId: targetId, newTileId: selectedTileId });
          updates.push({ x, y, z, tileId: selectedTileId });
          data[idx] = selectedTileId;
          queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
        }
        if (updates.length > 0) {
          updateMapTiles(updates);
          pushUndo(changes);
        }
        return;
      }

      const targetIsAutotile = isAutotile(targetId) && !isTileA5(targetId);
      const targetKind = targetIsAutotile ? getAutotileKindExported(targetId) : -1;
      const newIsAutotile = isAutotile(selectedTileId) && !isTileA5(selectedTileId);
      const newKind = newIsAutotile ? getAutotileKindExported(selectedTileId) : -1;
      if (targetIsAutotile && newIsAutotile && targetKind === newKind) return;
      if (!targetIsAutotile && !newIsAutotile && targetId === selectedTileId) return;

      const visited = new Set<string>();
      const queue = [{ x: startX, y: startY }];
      const filledPositions: { x: number; y: number }[] = [];

      while (queue.length > 0) {
        const { x, y } = queue.shift()!;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const idx = (z * height + y) * width + x;
        const curId = data[idx];
        const curIsAuto = isAutotile(curId) && !isTileA5(curId);
        const match = targetIsAutotile
          ? (curIsAuto && getAutotileKindExported(curId) === targetKind)
          : (curId === targetId);
        if (!match) continue;
        visited.add(key);
        filledPositions.push({ x, y });
        queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
      }

      if (filledPositions.length === 0) return;

      const changes: TileChange[] = [];
      const updates: { x: number; y: number; z: number; tileId: number }[] = [];

      for (const { x, y } of filledPositions) {
        const idx = (z * height + y) * width + x;
        data[idx] = selectedTileId;
      }

      const toRecalc = new Set<string>();
      for (const { x, y } of filledPositions) {
        toRecalc.add(`${x},${y}`);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              toRecalc.add(`${nx},${ny}`);
            }
          }
        }
      }

      const oldData = latestMap.data;
      for (const posKey of toRecalc) {
        const [px, py] = posKey.split(',').map(Number);
        const idx = (z * height + py) * width + px;
        const tileId = data[idx];
        if (isAutotile(tileId) && !isTileA5(tileId)) {
          const kind = getAutotileKindExported(tileId);
          const shape = computeAutoShapeForPosition(data, width, height, px, py, z, tileId);
          const correctId = makeAutotileId(kind, shape);
          data[idx] = correctId;
        }
        if (data[idx] !== oldData[idx]) {
          changes.push({ x: px, y: py, z, oldTileId: oldData[idx], newTileId: data[idx] });
          updates.push({ x: px, y: py, z, tileId: data[idx] });
        }
      }

      if (updates.length > 0) {
        updateMapTiles(updates);
        pushUndo(changes);
      }
    },
    [currentLayer, selectedTileId, updateMapTiles, pushUndo]
  );

  const applyShadow = useCallback(
    (tileX: number, tileY: number, subX: number, subY: number, isFirst: boolean) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const z = 4;
      const idx = (z * latestMap.height + tileY) * latestMap.width + tileX;
      const oldBits = latestMap.data[idx] || 0;
      const qx = subX < TILE_SIZE_PX / 2 ? 0 : 1;
      const qy = subY < TILE_SIZE_PX / 2 ? 0 : 1;
      const quarter = qy * 2 + qx;
      const key = `${tileX},${tileY},${quarter}`;

      if (isFirst) {
        shadowPaintMode.current = !(oldBits & (1 << quarter));
        shadowPainted.current.clear();
      }

      if (shadowPainted.current.has(key)) return;
      shadowPainted.current.add(key);

      let newBits: number;
      if (shadowPaintMode.current) {
        newBits = oldBits | (1 << quarter);
      } else {
        newBits = oldBits & ~(1 << quarter);
      }
      if (oldBits === newBits) return;
      const change: TileChange = { x: tileX, y: tileY, z, oldTileId: oldBits, newTileId: newBits };
      updateMapTile(tileX, tileY, z, newBits);
      pendingChanges.current.push(change);
    },
    [updateMapTile]
  );

  const batchPlaceWithAutotile = useCallback(
    (positions: { x: number; y: number }[], tileId: number) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap || positions.length === 0) return;
      const { width, height } = latestMap;
      const z = currentLayer;

      const { selectedTiles: sTiles, selectedTilesWidth: stW, selectedTilesHeight: stH } = useEditorStore.getState();
      const isMulti = sTiles && (stW > 1 || stH > 1);

      const getTileForPos = (x: number, y: number): number => {
        if (!isMulti) return tileId;
        const col = ((x % stW) + stW) % stW;
        const row = ((y % stH) + stH) % stH;
        return sTiles[row][col];
      };

      if (z === 5) {
        const changes: TileChange[] = [];
        const updates: { x: number; y: number; z: number; tileId: number }[] = [];
        for (const { x, y } of positions) {
          const idx = (z * height + y) * width + x;
          const oldId = latestMap.data[idx];
          const newId = getTileForPos(x, y);
          if (oldId !== newId) {
            changes.push({ x, y, z, oldTileId: oldId, newTileId: newId });
            updates.push({ x, y, z, tileId: newId });
          }
        }
        if (updates.length > 0) {
          updateMapTiles(updates);
          pushUndo(changes);
        }
        return;
      }

      const data = [...latestMap.data];
      const oldData = latestMap.data;

      for (const { x, y } of positions) {
        const idx = (z * height + y) * width + x;
        data[idx] = getTileForPos(x, y);
      }

      const toRecalc = new Set<string>();
      for (const { x, y } of positions) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              toRecalc.add(`${nx},${ny}`);
            }
          }
        }
      }

      for (const posKey of toRecalc) {
        const [px, py] = posKey.split(',').map(Number);
        const idx = (z * height + py) * width + px;
        const tid = data[idx];
        if (isAutotile(tid) && !isTileA5(tid)) {
          const kind = getAutotileKindExported(tid);
          const shape = computeAutoShapeForPosition(data, width, height, px, py, z, tid);
          data[idx] = makeAutotileId(kind, shape);
        }
      }

      const changes: TileChange[] = [];
      const updates: { x: number; y: number; z: number; tileId: number }[] = [];
      for (const posKey of toRecalc) {
        const [px, py] = posKey.split(',').map(Number);
        const idx = (z * height + py) * width + px;
        if (data[idx] !== oldData[idx]) {
          changes.push({ x: px, y: py, z, oldTileId: oldData[idx], newTileId: data[idx] });
          updates.push({ x: px, y: py, z, tileId: data[idx] });
        }
      }

      if (updates.length > 0) {
        updateMapTiles(updates);
        pushUndo(changes);
      }
    },
    [currentLayer, updateMapTiles, pushUndo]
  );

  const drawRectangle = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const minX = Math.max(0, Math.min(start.x, end.x));
      const maxX = Math.min(latestMap.width - 1, Math.max(start.x, end.x));
      const minY = Math.max(0, Math.min(start.y, end.y));
      const maxY = Math.min(latestMap.height - 1, Math.max(start.y, end.y));

      const positions: { x: number; y: number }[] = [];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          positions.push({ x, y });
        }
      }
      batchPlaceWithAutotile(positions, selectedTileId);
    },
    [selectedTileId, batchPlaceWithAutotile]
  );

  const drawEllipse = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2;
      const ry = (maxY - minY) / 2;

      const positions: { x: number; y: number }[] = [];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (x < 0 || x >= latestMap.width || y < 0 || y >= latestMap.height) continue;
          const dx = (x - cx) / (rx || 0.5);
          const dy = (y - cy) / (ry || 0.5);
          if (dx * dx + dy * dy <= 1) {
            positions.push({ x, y });
          }
        }
      }
      batchPlaceWithAutotile(positions, selectedTileId);
    },
    [selectedTileId, batchPlaceWithAutotile]
  );

  const drawOverlayPreview = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      if (selectedTool === 'rectangle') {
        ctx.fillStyle = 'rgba(0,120,212,0.3)';
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        const rx = minX * TILE_SIZE_PX;
        const ry = minY * TILE_SIZE_PX;
        const rw = (maxX - minX + 1) * TILE_SIZE_PX;
        const rh = (maxY - minY + 1) * TILE_SIZE_PX;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (selectedTool === 'ellipse') {
        const ecx = ((minX + maxX + 1) / 2) * TILE_SIZE_PX;
        const ecy = ((minY + maxY + 1) / 2) * TILE_SIZE_PX;
        const erx = ((maxX - minX + 1) / 2) * TILE_SIZE_PX;
        const ery = ((maxY - minY + 1) / 2) * TILE_SIZE_PX;
        ctx.fillStyle = 'rgba(0,120,212,0.3)';
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, erx, ery, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    },
    [selectedTool]
  );

  const clearOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  // =========================================================================
  // Mouse event handlers (unchanged logic)
  // =========================================================================
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const tile = canvasToTile(e);
      if (!tile) return;

      if (e.button === 2 && editMode === 'map') {
        const latestMap = useEditorStore.getState().currentMap;
        if (!latestMap) return;
        if (selectedTool === 'shadow') {
          const z = 4;
          const idx = (z * latestMap.height + tile.y) * latestMap.width + tile.x;
          const oldBits = latestMap.data[idx];
          if (oldBits !== 0) {
            pushUndo([{ x: tile.x, y: tile.y, z, oldTileId: oldBits, newTileId: 0 }]);
            updateMapTiles([{ x: tile.x, y: tile.y, z, tileId: 0 }]);
          }
        } else {
          const z = currentLayer;
          const idx = (z * latestMap.height + tile.y) * latestMap.width + tile.x;
          const oldTileId = latestMap.data[idx];
          if (oldTileId !== 0) {
            pushUndo([{ x: tile.x, y: tile.y, z, oldTileId, newTileId: 0 }]);
            updateMapTiles([{ x: tile.x, y: tile.y, z, tileId: 0 }]);
          }
        }
        return;
      }

      if (e.button !== 0) return;

      if (editMode === 'event') {
        if (currentMap && currentMap.events) {
          const ev = currentMap.events.find(
            (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
          );
          setSelectedEventId(ev ? ev.id : null);
          if (ev) {
            isDraggingEvent.current = true;
            draggedEventId.current = ev.id;
            dragEventOrigin.current = { x: tile.x, y: tile.y };
            setDragPreview(null);
          }
        }
        return;
      }

      isDrawing.current = true;
      lastTile.current = tile;
      pendingChanges.current = [];

      if (selectedTool === 'shadow') {
        const sub = canvasToSubTile(e);
        if (sub) {
          applyShadow(sub.x, sub.y, sub.subX, sub.subY, true);
        }
      } else if (selectedTool === 'rectangle' || selectedTool === 'ellipse') {
        dragStart.current = tile;
      } else {
        placeTileWithUndo(tile);
      }
    },
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, editMode, currentMap, setSelectedEventId, currentLayer, pushUndo, updateMapTiles]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const tile = canvasToTile(e);
      if (tile) {
        setCursorTile(tile.x, tile.y);
      }

      if (isDraggingEvent.current && tile && dragEventOrigin.current) {
        if (tile.x !== dragEventOrigin.current.x || tile.y !== dragEventOrigin.current.y) {
          setDragPreview({ x: tile.x, y: tile.y });
        } else {
          setDragPreview(null);
        }
        return;
      }

      if (!isDrawing.current || !tile) return;

      if (selectedTool === 'rectangle' || selectedTool === 'ellipse') {
        if (dragStart.current) {
          drawOverlayPreview(dragStart.current, tile);
        }
        return;
      }

      if (selectedTool === 'shadow') {
        const sub = canvasToSubTile(e);
        if (sub) {
          applyShadow(sub.x, sub.y, sub.subX, sub.subY, false);
        }
        return;
      }

      if (lastTile.current && tile.x === lastTile.current.x && tile.y === lastTile.current.y) return;
      lastTile.current = tile;
      if (selectedTool === 'pen' || selectedTool === 'eraser') {
        placeTileWithUndo(tile);
      }
    },
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, setCursorTile, drawOverlayPreview]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isDraggingEvent.current && draggedEventId.current != null) {
        const tile = canvasToTile(e);
        const origin = dragEventOrigin.current;
        if (tile && origin && (tile.x !== origin.x || tile.y !== origin.y)) {
          const latestMap = useEditorStore.getState().currentMap;
          if (latestMap && latestMap.events) {
            const occupied = latestMap.events.some(ev => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y);
            if (!occupied) {
              const events = latestMap.events.map(ev => {
                if (ev && ev.id === draggedEventId.current) {
                  return { ...ev, x: tile.x, y: tile.y };
                }
                return ev;
              });
              useEditorStore.setState({ currentMap: { ...latestMap, events } as MapData & { tilesetNames?: string[] } });
            }
          }
        }
        isDraggingEvent.current = false;
        draggedEventId.current = null;
        dragEventOrigin.current = null;
        setDragPreview(null);
        return;
      }

      if (isDrawing.current) {
        if (selectedTool === 'rectangle' && dragStart.current) {
          const tile = canvasToTile(e);
          if (tile) drawRectangle(dragStart.current, tile);
          clearOverlay();
        } else if (selectedTool === 'ellipse' && dragStart.current) {
          const tile = canvasToTile(e);
          if (tile) drawEllipse(dragStart.current, tile);
          clearOverlay();
        } else if (pendingChanges.current.length > 0) {
          pushUndo(pendingChanges.current);
        }
      }
      isDrawing.current = false;
      lastTile.current = null;
      dragStart.current = null;
      pendingChanges.current = [];
    },
    [selectedTool, canvasToTile, drawRectangle, drawEllipse, clearOverlay, pushUndo]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (editMode !== 'event') return;
      const tile = canvasToTile(e);
      if (!tile || !currentMap || !currentMap.events) return;
      const ev = currentMap.events.find(
        (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
      );
      if (ev) {
        setSelectedEventId(ev.id);
        setEditingEventId(ev.id);
      } else {
        createNewEvent(tile.x, tile.y);
      }
    },
    [editMode, canvasToTile, currentMap, setSelectedEventId]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      if (editMode === 'event') {
        const tile = canvasToTile(e);
        if (!tile || !currentMap) return;
        const ev = currentMap.events?.find(
          (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
        );
        setEventCtxMenu({
          x: e.clientX,
          y: e.clientY,
          tileX: tile.x,
          tileY: tile.y,
          eventId: ev ? ev.id : null,
        });
      }
    },
    [editMode, canvasToTile, currentMap]
  );

  const createNewEvent = useCallback((x: number, y: number) => {
    if (!currentMap) return;
    const events = [...(currentMap.events || [])];
    const maxId = events.reduce((max: number, e) => (e && e.id > max ? e.id : max), 0);
    const defaultPage: EventPage = {
      conditions: {
        actorId: 1, actorValid: false, itemId: 1, itemValid: false,
        selfSwitchCh: 'A', selfSwitchValid: false,
        switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
        variableId: 1, variableValid: false, variableValue: 0,
      },
      directionFix: false,
      image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
      list: [{ code: 0, indent: 0, parameters: [] }],
      moveFrequency: 3,
      moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false },
      moveSpeed: 3,
      moveType: 0,
      priorityType: 1,
      stepAnime: false,
      through: false,
      trigger: 0,
      walkAnime: true,
    };
    const newEvent: RPGEvent = {
      id: maxId + 1,
      name: `EV${String(maxId + 1).padStart(3, '0')}`,
      x, y,
      note: '',
      pages: [defaultPage],
    };
    while (events.length <= maxId + 1) events.push(null);
    events[maxId + 1] = newEvent;
    useEditorStore.setState({ currentMap: { ...currentMap, events } as MapData & { tilesetNames?: string[] } });
    setSelectedEventId(maxId + 1);
    setEditingEventId(maxId + 1);
  }, [currentMap, setSelectedEventId]);

  const closeEventCtxMenu = useCallback(() => setEventCtxMenu(null), []);

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div style={styles.container} onClick={closeEventCtxMenu}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
      }}>
        <canvas
          ref={webglCanvasRef}
          style={styles.canvas}
        />
        <canvas
          ref={overlayRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => {
            if (isDraggingEvent.current) {
              isDraggingEvent.current = false;
              draggedEventId.current = null;
              dragEventOrigin.current = null;
              setDragPreview(null);
            }
            handleMouseUp(e);
          }}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{
            ...styles.canvas,
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: editMode === 'event' ? 'pointer' : 'crosshair',
          }}
        />
      </div>

      {eventCtxMenu && (
        <div className="context-menu" style={{ left: eventCtxMenu.x, top: eventCtxMenu.y }} onClick={e => e.stopPropagation()}>
          {eventCtxMenu.eventId == null && (
            <div className="context-menu-item" onClick={() => { createNewEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>New Event...</div>
          )}
          {eventCtxMenu.eventId != null && (
            <>
              <div className="context-menu-item" onClick={() => { setEditingEventId(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Edit...</div>
              <div className="context-menu-item" onClick={() => { copyEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Copy</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { deleteEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Delete</div>
            </>
          )}
          {clipboard?.type === 'event' && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { pasteEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>Paste</div>
            </>
          )}
        </div>
      )}

      {editingEventId != null && (
        <EventDetail eventId={editingEventId} onClose={() => setEditingEventId(null)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflow: 'auto',
    background: '#1a1a1a',
    border: '1px solid #555',
  },
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
};
