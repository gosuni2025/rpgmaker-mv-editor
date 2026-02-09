import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { EditorLights } from '../../types/rpgMakerMV';
import { createLightMarkerSprite, createLightStemLine } from './threeSpriteFactory';

// Runtime globals (loaded via index.html script tags)
declare const ConfigManager: any;
declare const Mode3D: any;
declare const ShadowLight: any;
declare const DepthOfField: any;

/** Dispose a Three.js mesh/line/sprite and remove from scene */
export function disposeSceneObject(scene: any, obj: any): void {
  scene.remove(obj);
  if (obj.material?.map) obj.material.map.dispose();
  if (obj.material) obj.material.dispose();
  if (obj.geometry) obj.geometry.dispose();
}

/** Dispose an array of scene objects and clear the array */
export function disposeSceneObjects(scene: any, objects: any[]): void {
  for (const obj of objects) {
    disposeSceneObject(scene, obj);
  }
  objects.length = 0;
}

/** 에디터에서 3D+DoF가 활성화된 경우 composer를 통해 렌더, 아닌 경우 직접 렌더 */
export function editorRender(rendererObj: any, stage: any) {
  const is3D = ConfigManager.mode3d && Mode3D._spriteset;
  if (is3D) {
    if (!Mode3D._perspCamera) {
      Mode3D._perspCamera = Mode3D._createPerspCamera(rendererObj._width, rendererObj._height);
    }
    Mode3D._positionCamera(Mode3D._perspCamera, rendererObj._width, rendererObj._height);
    Mode3D._applyBillboards();
    Mode3D._enforceNearestFilter(rendererObj.scene);

    // DoF 활성 시 composer 사용
    if (ConfigManager.depthOfField && typeof DepthOfField !== 'undefined') {
      if (!DepthOfField._composer || DepthOfField._lastStage !== stage) {
        DepthOfField._createComposer(rendererObj, stage);
      }
      // RenderPass에 최신 참조 반영
      DepthOfField._renderPass.perspCamera = Mode3D._perspCamera;
      DepthOfField._renderPass.spriteset = Mode3D._spriteset;
      DepthOfField._renderPass.stage = stage;
      DepthOfField._renderPass.scene = rendererObj.scene;
      DepthOfField._renderPass.camera = rendererObj.camera;
      // UIRenderPass에 최신 참조 반영
      DepthOfField._uiPass.spriteset = Mode3D._spriteset;
      DepthOfField._uiPass.stage = stage;
      DepthOfField._uiPass.scene = rendererObj.scene;
      DepthOfField._uiPass.camera = rendererObj.camera;
      DepthOfField._updateUniforms();
      // Composer 크기 동기화
      const w = rendererObj._width;
      const h = rendererObj._height;
      if (DepthOfField._composer.renderTarget1.width !== w ||
          DepthOfField._composer.renderTarget1.height !== h) {
        DepthOfField._composer.setSize(w, h);
      }
      DepthOfField._composer.render();
    } else {
      if (DepthOfField?._composer) DepthOfField._disposeComposer();
      rendererObj.renderer.render(rendererObj.scene, Mode3D._perspCamera);
    }
  } else {
    if (DepthOfField?._composer) DepthOfField._disposeComposer();
    rendererObj.renderer.render(rendererObj.scene, rendererObj.camera);
  }
}

/** Sync editor-defined lights to Three.js scene via ShadowLight runtime */
export function syncEditorLightsToScene(scene: any, editorLights: EditorLights | undefined, mode3d = false) {
  if (!editorLights || !ShadowLight._active) return;
  const THREE = (window as any).THREE;
  if (!THREE) return;

  // Update ambient light
  if (ShadowLight._ambientLight) {
    ShadowLight._ambientLight.color.set(editorLights.ambient.color);
    ShadowLight._ambientLight.intensity = editorLights.ambient.intensity;
  }

  // Update directional light
  if (ShadowLight._directionalLight) {
    const dl = ShadowLight._directionalLight;
    const ed = editorLights.directional;
    dl.color.set(ed.color);
    dl.intensity = ed.intensity;
    const d = ed.direction;
    dl.position.set(-d[0] * 1000, -d[1] * 1000, -d[2] * 1000);
    if (ed.castShadow !== undefined) dl.castShadow = ed.castShadow;
    if (ed.shadowMapSize !== undefined) {
      dl.shadow.mapSize.width = ed.shadowMapSize;
      dl.shadow.mapSize.height = ed.shadowMapSize;
    }
    if (ed.shadowBias !== undefined) dl.shadow.bias = ed.shadowBias;
    if (ed.shadowNear !== undefined) dl.shadow.camera.near = ed.shadowNear;
    if (ed.shadowFar !== undefined) dl.shadow.camera.far = ed.shadowFar;
  }

  // Update player light
  if (ShadowLight._playerLight && editorLights.playerLight) {
    const pl = editorLights.playerLight;
    ShadowLight._playerLight.color.set(pl.color);
    ShadowLight._playerLight.intensity = pl.intensity;
    ShadowLight._playerLight.distance = pl.distance;
    ShadowLight.config.playerLightZ = pl.z;
    ShadowLight.config.playerLightColor = parseInt(pl.color.replace('#', ''), 16);
    ShadowLight.config.playerLightIntensity = pl.intensity;
    ShadowLight.config.playerLightDistance = pl.distance;
  }

  // Update spot light
  if (ShadowLight._playerSpotLight && editorLights.spotLight) {
    const sl = editorLights.spotLight;
    const spot = ShadowLight._playerSpotLight;
    spot.visible = sl.enabled;
    spot.color.set(sl.color);
    spot.intensity = sl.intensity;
    spot.distance = sl.distance;
    spot.angle = sl.angle;
    spot.penumbra = sl.penumbra;
    if (sl.shadowMapSize) {
      spot.shadow.mapSize.width = sl.shadowMapSize;
      spot.shadow.mapSize.height = sl.shadowMapSize;
    }
    ShadowLight.config.spotLightEnabled = sl.enabled;
    ShadowLight.config.spotLightColor = parseInt(sl.color.replace('#', ''), 16);
    ShadowLight.config.spotLightIntensity = sl.intensity;
    ShadowLight.config.spotLightDistance = sl.distance;
    ShadowLight.config.spotLightAngle = sl.angle;
    ShadowLight.config.spotLightPenumbra = sl.penumbra;
    ShadowLight.config.spotLightZ = sl.z;
    ShadowLight.config.spotLightTargetDistance = sl.targetDistance;
  }

  // Update shadow settings
  if (editorLights.shadow) {
    const ss = editorLights.shadow;
    ShadowLight.config.shadowOpacity = ss.opacity;
    ShadowLight.config.shadowColor = parseInt(ss.color.replace('#', ''), 16);
    ShadowLight.config.shadowOffsetScale = ss.offsetScale;
  }

  // Remove existing editor point lights + markers from scene
  if (!ShadowLight._editorPointLights) ShadowLight._editorPointLights = [];
  for (const light of ShadowLight._editorPointLights) {
    scene.remove(light);
  }
  ShadowLight._editorPointLights = [];

  if (!ShadowLight._editorLightMarkers) ShadowLight._editorLightMarkers = [];
  for (const marker of ShadowLight._editorLightMarkers) {
    scene.remove(marker);
    if (marker.material?.map) marker.material.map.dispose();
    if (marker.material) marker.material.dispose();
    if (marker.geometry) marker.geometry.dispose();
  }
  ShadowLight._editorLightMarkers = [];

  // Add point lights + 3D markers from editor data
  for (const pl of editorLights.points) {
    const light = new THREE.PointLight(pl.color, pl.intensity, pl.distance, pl.decay);
    const px = pl.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
    const py = pl.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
    const pz = pl.z ?? ShadowLight.config?.playerLightZ ?? 30;
    light.position.set(px, py, pz);
    scene.add(light);
    ShadowLight._editorPointLights.push(light);

    // 3D marker (3D 모드에서만 - 2D 모드에서는 오버레이 캔버스에서 렌더링)
    if (mode3d) {
      const sprite = createLightMarkerSprite(THREE, pl.color);
      sprite.position.set(px, py, pz);
      scene.add(sprite);
      ShadowLight._editorLightMarkers.push(sprite);

      // Z > 0 이면 바닥~라이트 연결선
      if (pz > 2) {
        const stem = createLightStemLine(THREE, px, py, pz, pl.color);
        scene.add(stem);
        ShadowLight._editorLightMarkers.push(stem);
      }
    }
  }
}
