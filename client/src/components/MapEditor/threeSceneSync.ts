import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { EditorLights, SkySunLight } from '../../types/rpgMakerMV';
import { sunUVToDirection } from '../../types/rpgMakerMV';
import { createLightMarkerSprite, createLightStemLine } from './threeSpriteFactory';

// Runtime globals (loaded via index.html script tags)
declare const ShadowLight: any;

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

/** Sync editor-defined lights to Three.js scene via ShadowLight runtime */
export function syncEditorLightsToScene(scene: any, editorLights: EditorLights | undefined, mode3d = false) {
  if (!editorLights || !ShadowLight._active) return;
  const THREE = (window as any).THREE;
  if (!THREE) return;

  const globalEnabled = editorLights.enabled !== false;

  // Update ambient light
  if (ShadowLight._ambientLight) {
    const ambEnabled = globalEnabled && editorLights.ambient.enabled !== false;
    ShadowLight._ambientLight.color.set(editorLights.ambient.color);
    ShadowLight._ambientLight.intensity = ambEnabled ? editorLights.ambient.intensity : 0;
  }

  // Update directional light
  if (ShadowLight._directionalLight) {
    const dl = ShadowLight._directionalLight;
    const ed = editorLights.directional;
    const dirEnabled = globalEnabled && ed.enabled === true;
    dl.visible = dirEnabled;
    dl.color.set(ed.color);
    dl.intensity = dirEnabled ? ed.intensity : 0;
    const d = ed.direction;
    // target 기준으로 position 설정
    const tgt = dl.target.position;
    dl.position.set(tgt.x - d[0] * 1000, tgt.y - d[1] * 1000, tgt.z - d[2] * 1000);
    if (ed.castShadow !== undefined) dl.castShadow = dirEnabled && ed.castShadow !== false;
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
    const plEnabled = globalEnabled && pl.enabled !== false;
    ShadowLight._playerLight.color.set(pl.color);
    ShadowLight._playerLight.intensity = plEnabled ? pl.intensity : 0;
    ShadowLight._playerLight.distance = pl.distance;
    ShadowLight.config.playerLightZ = pl.z;
    ShadowLight.config.playerLightColor = parseInt(pl.color.replace('#', ''), 16);
    ShadowLight.config.playerLightIntensity = plEnabled ? pl.intensity : 0;
    ShadowLight.config.playerLightDistance = pl.distance;
    ShadowLight.config.playerLightEnabled = plEnabled;
  }

  // Update spot light
  if (ShadowLight._playerSpotLight && editorLights.spotLight) {
    const sl = editorLights.spotLight;
    const spot = ShadowLight._playerSpotLight;
    spot.visible = globalEnabled && sl.enabled;
    spot.color.set(sl.color);
    spot.intensity = globalEnabled ? sl.intensity : 0;
    spot.distance = sl.distance;
    spot.angle = sl.angle;
    spot.penumbra = sl.penumbra;
    if (sl.shadowMapSize) {
      spot.shadow.mapSize.width = sl.shadowMapSize;
      spot.shadow.mapSize.height = sl.shadowMapSize;
    }
    ShadowLight.config.spotLightEnabled = globalEnabled && sl.enabled;
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
    light.dispose();
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

    // Light marker (both 2D and 3D - always rendered via Three.js)
    const sprite = createLightMarkerSprite(THREE, pl.color);
    sprite.position.set(px, py, pz);
    sprite.userData.editorGrid = true;
    scene.add(sprite);
    ShadowLight._editorLightMarkers.push(sprite);

    // Z > 0 이면 바닥~라이트 연결선
    if (pz > 2) {
      const stem = createLightStemLine(THREE, px, py, pz, pl.color);
      stem.userData.editorGrid = true;
      scene.add(stem);
      ShadowLight._editorLightMarkers.push(stem);
    }
  }
}

/** Sync sky sun lights (additional directional lights from skyBackground.sunLights) */
export function syncSunLightsToScene(scene: any, sunLights: SkySunLight[] | undefined) {
  const THREE = (window as any).THREE;
  if (!THREE) return;

  // 기존 추가 sun directional lights 제거
  if (!ShadowLight._editorSunLights) ShadowLight._editorSunLights = [];
  for (const light of ShadowLight._editorSunLights) {
    if (light.target) scene.remove(light.target);
    scene.remove(light);
    light.dispose();
  }
  ShadowLight._editorSunLights = [];

  if (!sunLights || sunLights.length < 2) return;

  // 2번째 이후 태양 광원을 추가 DirectionalLight로 생성
  // (1번째는 editorLights.directional에 매핑됨)
  const w = window as any;
  const vw2 = (w.Graphics?._width || 816) / 2;
  const vh2 = (w.Graphics?._height || 624) / 2;
  for (let i = 1; i < sunLights.length; i++) {
    const sl = sunLights[i];
    const dir = sunUVToDirection(sl.position[0], sl.position[1]);
    const light = new THREE.DirectionalLight(sl.color, sl.intensity);
    // target 기준으로 position 설정
    light.target.position.set(vw2, vh2, 0);
    light.position.set(vw2 - dir[0] * 1000, vh2 - dir[1] * 1000, -dir[2] * 1000);
    light.castShadow = sl.castShadow !== false;
    if (sl.shadowMapSize) {
      light.shadow.mapSize.width = sl.shadowMapSize;
      light.shadow.mapSize.height = sl.shadowMapSize;
    }
    if (sl.shadowBias !== undefined) light.shadow.bias = sl.shadowBias;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 5000;
    scene.add(light);
    scene.add(light.target);
    ShadowLight._editorSunLights.push(light);
  }
}
