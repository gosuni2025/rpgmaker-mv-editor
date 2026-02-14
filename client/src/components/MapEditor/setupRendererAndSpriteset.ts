import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { initGameGlobals } from './initGameGlobals';
import { syncEditorLightsToScene } from './threeSceneSync';

// Runtime globals (loaded via index.html script tags)
declare const Graphics: any;
declare const ShadowLight: any;
declare const Spriteset_Map: any;
declare const ThreeContainer: any;
declare const ThreeWaterShader: any;

export interface StandaloneBackups {
  dataMap: any;
  mapId: number | undefined;
  displayX: number | undefined;
  displayY: number | undefined;
  graphicsW: number | undefined;
  graphicsH: number | undefined;
}

export interface SetupResult {
  rendererObj: any;
  spriteset: any;
  stage: any;
  gridLines: any;
  mapPxW: number;
  mapPxH: number;
  backups: StandaloneBackups | null;
}

export async function setupRendererAndSpriteset(params: {
  canvas: HTMLCanvasElement;
  effectiveMap: any;
  effectiveMapId: number;
  standalone: boolean;
  isDisposed: () => boolean;
}): Promise<SetupResult | null> {
  const { canvas, effectiveMap, effectiveMapId, standalone, isDisposed } = params;
  const w = window as any;

  await initGameGlobals();
  if (isDisposed()) return null;

  const { width, height, data } = effectiveMap;
  const mapPxW = width * TILE_SIZE_PX;
  const mapPxH = height * TILE_SIZE_PX;

  // standalone 모드: 글로벌 상태 백업
  let backups: StandaloneBackups | null = null;
  if (standalone) {
    backups = {
      dataMap: w.$dataMap,
      mapId: w.$gameMap?._mapId,
      displayX: w.$gameMap?._displayX,
      displayY: w.$gameMap?._displayY,
      graphicsW: undefined,
      graphicsH: undefined,
    };
    backups.graphicsW = Graphics._width;
    backups.graphicsH = Graphics._height;
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
  if (!standalone) {
    w._editorRendererObj = rendererObj;
  }

  // $dataMap 설정
  if (standalone) {
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

  // animTileSettings 초기화
  if (typeof ThreeWaterShader !== 'undefined') {
    ThreeWaterShader.setAllKindSettings(effectiveMap.animTileSettings || {});
  }

  // 날씨 초기화
  {
    const wt = effectiveMap.weatherType ?? 0;
    const wp = effectiveMap.weatherPower ?? 0;
    const weatherNames = ['none', 'rain', 'storm', 'snow'];
    w.$gameScreen.changeWeather(weatherNames[wt] || 'none', wp, 0);
  }

  // bloomConfig 초기화
  const DOF = w.PostProcess;
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

  // ShadowLight._scene 설정 (Spriteset_Map 생성 전 필수)
  ShadowLight._scene = rendererObj.scene;

  // standalone 모드: 조명/3D 플러그인 일시 비활성화
  let backupShadowLight: boolean | undefined;
  let backupMode3d: boolean | undefined;
  if (standalone && w.ConfigManager) {
    backupShadowLight = w.ConfigManager.shadowLight;
    backupMode3d = w.ConfigManager.mode3d;
    w.ConfigManager.shadowLight = false;
    w.ConfigManager.mode3d = false;
  }

  const stage = new ThreeContainer();
  const spriteset = new Spriteset_Map();

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

  if (spriteset._tilemap) {
    spriteset._tilemap._margin = 0;
    spriteset._tilemap._width = mapPxW;
    spriteset._tilemap._height = mapPxH;
    spriteset._tilemap._needsRepaint = true;
  }

  stage.addChild(spriteset);
  rendererObj.scene.add(stage._threeObj);

  // standalone 모드: Graphics 즉시 복원 (메인 에디터 영향 방지)
  if (standalone && backups && backups.graphicsW != null) {
    Graphics._width = backups.graphicsW;
    Graphics._height = backups.graphicsH!;
    Graphics.width = backups.graphicsW;
    Graphics.height = backups.graphicsH!;
    Graphics.boxWidth = backups.graphicsW;
    Graphics.boxHeight = backups.graphicsH!;
  }

  if (!standalone) {
    const editorState = useEditorStore.getState();
    // 플러그인이 ConfigManager 값을 덮어쓸 수 있으므로, 런타임 값을 UI 상태에 동기화
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

  // 그리드 메시 생성
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
  gridLines.userData.editorGrid = true;
  rendererObj.scene.add(gridLines);

  return { rendererObj, spriteset, stage, gridLines, mapPxW, mapPxH, backups };
}
