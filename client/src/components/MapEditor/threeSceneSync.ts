import React from 'react';
import { TILE_SIZE_PX, getTileRenderInfo } from '../../utils/tileHelper';
import type { EditorLights } from '../../types/rpgMakerMV';
import { createLightMarkerSprite, createLightStemLine, createCharSprite, createTileQuad, createTileOutline, createTextSprite } from './threeSpriteFactory';

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
  console.log('[MapCanvas] editorRender called');
  const is3D = ConfigManager.mode3d && Mode3D._spriteset;
  if (is3D) {
    if (!Mode3D._perspCamera) {
      Mode3D._perspCamera = Mode3D._createPerspCamera(rendererObj._width, rendererObj._height);
    }
    Mode3D._positionCamera(Mode3D._perspCamera, rendererObj._width, rendererObj._height);
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
    ShadowLight._directionalLight.color.set(editorLights.directional.color);
    ShadowLight._directionalLight.intensity = editorLights.directional.intensity;
    const d = editorLights.directional.direction;
    ShadowLight._directionalLight.position.set(-d[0] * 1000, -d[1] * 1000, -d[2] * 1000);
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

    // 3D 💡 스프라이트 마커 (3D 모드에서만 - 2D 모드에서는 오버레이 캔버스에서 렌더링)
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

/** Sync 3D overlay objects (events, player, regions, map objects) into Three.js scene */
export function sync3DOverlays(
  scene: any,
  eventSpritesRef: React.MutableRefObject<any[]>,
  playerSpriteRef: React.MutableRefObject<any>,
  regionMeshesRef: React.MutableRefObject<any[]>,
  objectMeshesRef: React.MutableRefObject<any[]>,
  currentMap: any,
  charImages: Record<string, HTMLImageElement>,
  editMode: string,
  currentLayer: number,
  systemData: any,
  currentMapId: number | null,
  playerCharImg: HTMLImageElement | null,
  playerCharacterName: string | null,
  playerCharacterIndex: number,
  tilesetImages: Record<number, HTMLImageElement>,
  selectedObjectId: number | null,
) {
  const THREE = (window as any).THREE;
  if (!THREE) return;

  // --- Cleanup existing sprites/meshes ---
  disposeSceneObjects(scene, eventSpritesRef.current);
  eventSpritesRef.current = [];

  if (playerSpriteRef.current) {
    disposeSceneObjects(scene, playerSpriteRef.current);
    playerSpriteRef.current = null;
  }

  disposeSceneObjects(scene, regionMeshesRef.current);
  regionMeshesRef.current = [];

  disposeSceneObjects(scene, objectMeshesRef.current);
  objectMeshesRef.current = [];

  if (!currentMap) return;
  const { width, height, data, events } = currentMap;

  // --- Region overlay (layer 5) ---
  if (currentLayer === 5) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const regionId = data[(5 * height + y) * width + x];
        if (regionId === 0) continue;
        const hue = (regionId * 137) % 360;
        const color = new THREE.Color(`hsl(${hue}, 60%, 40%)`);
        const quad = createTileQuad(THREE, x, y, TILE_SIZE_PX, color.getHex(), 0.5, 850);
        scene.add(quad);
        regionMeshesRef.current.push(quad);

        // Region number label
        const label = createTextSprite(THREE, String(regionId), 12, '#fff');
        label.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4);
        scene.add(label);
        regionMeshesRef.current.push(label);
      }
    }
  }

  // --- Events ---
  if (events) {
    const showEventDetails = editMode === 'event';
    events.forEach((ev: any) => {
      if (!ev || ev.id === 0) return;
      const ex = ev.x;
      const ey = ev.y;

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

          const sprite = createCharSprite(THREE, charImg, sx, sy, charW, charH, TILE_SIZE_PX);
          // Billboard tilt (rotate mesh to face camera)
          sprite.rotation.x = -Mode3D._tiltRad;

          const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
          const dh = charH * scale;
          // Position: center-bottom aligned like 2D version
          // z=48 for shadow map depth separation from tilemap (z=0)
          sprite.position.set(
            ex * TILE_SIZE_PX + TILE_SIZE_PX / 2,
            ey * TILE_SIZE_PX + TILE_SIZE_PX - dh / 2,
            48
          );
          scene.add(sprite);
          eventSpritesRef.current.push(sprite);
          drewImage = true;
        }
      }

      if (showEventDetails) {
        if (!drewImage) {
          // Blue fill quad
          const quad = createTileQuad(THREE, ex, ey, TILE_SIZE_PX, 0x0078d4, 0.35, 890);
          scene.add(quad);
          eventSpritesRef.current.push(quad);
        }
        // Blue outline
        const outline = createTileOutline(THREE, ex, ey, TILE_SIZE_PX, 0x0078d4, 2, 895);
        scene.add(outline);
        eventSpritesRef.current.push(outline);

        // Name label
        if (ev.name) {
          const label = createTextSprite(THREE, ev.name, 12, '#fff');
          label.position.set(ex * TILE_SIZE_PX + TILE_SIZE_PX / 2, ey * TILE_SIZE_PX + 8, 5);
          scene.add(label);
          eventSpritesRef.current.push(label);
        }
      } else if (!drewImage) {
        const quad = createTileQuad(THREE, ex, ey, TILE_SIZE_PX, 0x0078d4, 0.25, 890);
        scene.add(quad);
        eventSpritesRef.current.push(quad);
      }
    });
  }

  // --- Player start position ---
  if (systemData && currentMapId === systemData.startMapId) {
    const px = systemData.startX;
    const py = systemData.startY;
    const objs: any[] = [];

    if (playerCharImg) {
      const isSingle = playerCharacterName?.startsWith('$');
      const charW = isSingle ? playerCharImg.width / 3 : playerCharImg.width / 12;
      const charH = isSingle ? playerCharImg.height / 4 : playerCharImg.height / 8;
      const charCol = isSingle ? 0 : playerCharacterIndex % 4;
      const charRow = isSingle ? 0 : Math.floor(playerCharacterIndex / 4);
      const srcX = charCol * charW * 3 + 1 * charW;
      const srcY = charRow * charH * 4 + 0 * charH;

      const sprite = createCharSprite(THREE, playerCharImg, srcX, srcY, charW, charH, TILE_SIZE_PX);
      sprite.rotation.x = -Mode3D._tiltRad;
      const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
      const dh = charH * scale;
      // z=48 for shadow map depth separation from tilemap (z=0)
      sprite.position.set(
        px * TILE_SIZE_PX + TILE_SIZE_PX / 2,
        py * TILE_SIZE_PX + TILE_SIZE_PX - dh / 2,
        48
      );
      scene.add(sprite);
      objs.push(sprite);
    }

    // Blue outline for player start
    const outline = createTileOutline(THREE, px, py, TILE_SIZE_PX, 0x0078ff, 3, 895);
    scene.add(outline);
    objs.push(outline);

    playerSpriteRef.current = objs;
  }

  // --- Map objects (tile-based, billboard in 3D) ---
  if (currentMap.objects) {
    const isObjectMode = editMode === 'object';
    const HALF = TILE_SIZE_PX / 2;
    const tilt = -Mode3D._tiltRad;
    for (const mapObj of currentMap.objects) {
      // Build a single billboard canvas for the entire object
      const objPxW = mapObj.width * TILE_SIZE_PX;
      const objPxH = mapObj.height * TILE_SIZE_PX;
      const canvas = document.createElement('canvas');
      canvas.width = objPxW;
      canvas.height = objPxH;
      const ctx = canvas.getContext('2d')!;
      // Mode3D Y-flip 카메라 보정: 캔버스를 미리 뒤집어 그림
      ctx.translate(0, objPxH);
      ctx.scale(1, -1);
      let hasTile = false;
      for (let row = 0; row < mapObj.height; row++) {
        for (let col = 0; col < mapObj.width; col++) {
          const tileId = mapObj.tileIds[row]?.[col];
          if (!tileId || tileId === 0) continue;
          const info = getTileRenderInfo(tileId);
          if (!info) continue;
          const dx = col * TILE_SIZE_PX;
          const dy = row * TILE_SIZE_PX;
          if (info.type === 'normal') {
            const img = tilesetImages[info.sheet];
            if (img) { ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, dx, dy, TILE_SIZE_PX, TILE_SIZE_PX); hasTile = true; }
          } else if (info.type === 'autotile') {
            for (let q = 0; q < 4; q++) {
              const quarter = info.quarters[q];
              const img = tilesetImages[quarter.sheet];
              if (!img) continue;
              ctx.drawImage(img, quarter.sx, quarter.sy, HALF, HALF, dx + (q % 2) * HALF, dy + Math.floor(q / 2) * HALF, HALF, HALF);
              hasTile = true;
            }
          }
        }
      }
      if (hasTile) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;
        const geometry = new THREE.PlaneGeometry(objPxW, objPxH);
        const material = new THREE.MeshBasicMaterial({ map: texture, depthTest: false, transparent: true, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 880;
        mesh.frustumCulled = false;
        // Billboard rotation
        mesh.rotation.x = tilt;
        // Position: anchor at bottom-center of the object's footprint
        const footX = mapObj.x * TILE_SIZE_PX + objPxW / 2;
        const footY = mapObj.y * TILE_SIZE_PX + TILE_SIZE_PX;
        const halfH = objPxH / 2;
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        mesh.position.set(footX, footY - halfH * cosT, halfH * (-sinT));
        scene.add(mesh);
        objectMeshesRef.current.push(mesh);
      }
      if (isObjectMode) {
        const bx = mapObj.x;
        const by = mapObj.y - mapObj.height + 1;
        const bw = mapObj.width;
        const bh = mapObj.height;
        const isSelected = selectedObjectId === mapObj.id;
        const outlineColor = isSelected ? 0x00ff66 : 0x00cc66;
        // Passability X markers
        if (mapObj.passability) {
          const pad = 4;
          const xMat = new THREE.LineBasicMaterial({ color: 0xff3c3c, depthTest: false, transparent: true, opacity: 0.8 });
          for (let row = 0; row < mapObj.height; row++) {
            for (let col = 0; col < mapObj.width; col++) {
              if (mapObj.passability[row]?.[col] === false) {
                const tx = (mapObj.x + col) * TILE_SIZE_PX;
                const ty = (mapObj.y - mapObj.height + 1 + row) * TILE_SIZE_PX;
                const xPts = [
                  new THREE.Vector3(tx + pad, ty + pad, 0),
                  new THREE.Vector3(tx + TILE_SIZE_PX - pad, ty + TILE_SIZE_PX - pad, 0),
                ];
                const xPts2 = [
                  new THREE.Vector3(tx + TILE_SIZE_PX - pad, ty + pad, 0),
                  new THREE.Vector3(tx + pad, ty + TILE_SIZE_PX - pad, 0),
                ];
                const l1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(xPts), xMat);
                const l2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(xPts2), xMat);
                l1.renderOrder = 896; l1.frustumCulled = false;
                l2.renderOrder = 896; l2.frustumCulled = false;
                scene.add(l1); scene.add(l2);
                objectMeshesRef.current.push(l1, l2);
              }
            }
          }
        }
        const hw = bw * TILE_SIZE_PX / 2;
        const hh = bh * TILE_SIZE_PX / 2;
        const pts = [
          new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
          new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
          new THREE.Vector3(-hw, -hh, 0),
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: outlineColor, depthTest: false, transparent: true });
        const line = new THREE.Line(geom, mat);
        line.position.set(bx * TILE_SIZE_PX + hw, by * TILE_SIZE_PX + hh, 4);
        line.renderOrder = 895;
        line.frustumCulled = false;
        scene.add(line);
        objectMeshesRef.current.push(line);
        if (mapObj.name) {
          const label = createTextSprite(THREE, mapObj.name, 10, '#fff');
          label.position.set(bx * TILE_SIZE_PX + hw, by * TILE_SIZE_PX + 8, 5);
          scene.add(label);
          objectMeshesRef.current.push(label);
        }
      }
    }
  }
}
