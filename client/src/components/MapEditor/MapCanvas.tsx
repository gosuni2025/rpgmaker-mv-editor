import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import type { RPGEvent, EventPage, MapData, EditorLights, MapObject } from '../../types/rpgMakerMV';
import { posToTile, TILE_SIZE_PX, isAutotile, isTileA5, getAutotileKindExported, makeAutotileId, computeAutoShapeForPosition, getTileRenderInfo } from '../../utils/tileHelper';
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

/** Create a canvas-based SpriteMaterial for 💡 marker */
function createLightMarkerSprite(THREE: any, color: string): any {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💡', 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, side: THREE.DoubleSide });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(32, 32, 1);
  sprite.renderOrder = 999;
  return sprite;
}

/** Create a dashed line from ground to light Z position */
function createLightStemLine(THREE: any, px: number, py: number, z: number, color: string): any {
  const material = new THREE.LineDashedMaterial({
    color: color,
    dashSize: 4,
    gapSize: 4,
    opacity: 0.6,
    transparent: true,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(px, py, 0),
    new THREE.Vector3(px, py, z),
  ]);
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  line.renderOrder = 998;
  return line;
}

/** Create a textured PlaneGeometry mesh for a tile from a tileset image.
 *  Used for rendering map objects (billboard tiles) in 3D mode. */
function createTileSprite(THREE: any, img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, drawW: number, drawH: number): any {
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(0, sh);
  ctx.scale(1, -1);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  const geometry = new THREE.PlaneGeometry(drawW, drawH);
  const material = new THREE.MeshBasicMaterial({ map: texture, depthTest: false, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 880;
  mesh.frustumCulled = false;
  return mesh;
}

/** Create a textured PlaneGeometry mesh for a character image region.
 *  Uses Mesh instead of Sprite because Mode3D's Y-flipped projection matrix
 *  breaks THREE.Sprite rendering. */
function createCharSprite(THREE: any, img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, tileSize: number): any {
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  // Flip vertically to compensate for Mode3D's Y-inverted projection matrix
  ctx.translate(0, sh);
  ctx.scale(1, -1);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  const scale = Math.min(tileSize / sw, tileSize / sh);
  const w = sw * scale;
  const h = sh * scale;
  const geometry = new THREE.PlaneGeometry(w, h);
  // ShadowLight 활성 시 MeshPhongMaterial + castShadow 사용
  const isShadowActive = (window as any).ShadowLight?._active;
  const material = isShadowActive
    ? new THREE.MeshPhongMaterial({
        map: texture, depthTest: true, depthWrite: true, transparent: true, side: THREE.DoubleSide,
        emissive: new THREE.Color(0x111111), specular: new THREE.Color(0x000000), shininess: 0,
        alphaTest: 0.5,
      })
    : new THREE.MeshBasicMaterial({ map: texture, depthTest: false, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 900;
  mesh.frustumCulled = false;
  if (isShadowActive) {
    mesh.castShadow = true;
    // customDepthMaterial for correct alpha-tested shadow silhouette
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
  }
  return mesh;
}

/** Create a flat colored quad (PlaneGeometry) at tile position */
function createTileQuad(THREE: any, x: number, y: number, tileSize: number, color: number, opacity: number, renderOrder: number): any {
  const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
  const material = new THREE.MeshBasicMaterial({
    color, opacity, transparent: true, depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 2);
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

/** Create a wireframe rectangle at tile position */
function createTileOutline(THREE: any, x: number, y: number, tileSize: number, color: number, lineWidth: number, renderOrder: number): any {
  const hw = tileSize / 2;
  const pts = [
    new THREE.Vector3(-hw, -hw, 0), new THREE.Vector3(hw, -hw, 0),
    new THREE.Vector3(hw, hw, 0), new THREE.Vector3(-hw, hw, 0),
    new THREE.Vector3(-hw, -hw, 0),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(pts);
  const material = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 1.0 });
  const line = new THREE.Line(geometry, material);
  line.position.set(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 3);
  line.renderOrder = renderOrder;
  line.frustumCulled = false;
  return line;
}

/** Create a text label as PlaneGeometry mesh (Sprite broken with Y-flipped projection) */
function createTextSprite(THREE: any, text: string, fontSize: number, color: string): any {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  // Flip vertically to compensate for Mode3D's Y-inverted projection matrix
  ctx.translate(0, 32);
  ctx.scale(1, -1);
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 2;
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 16, 124);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const geometry = new THREE.PlaneGeometry(64, 16);
  const material = new THREE.MeshBasicMaterial({ map: texture, depthTest: false, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 910;
  mesh.frustumCulled = false;
  return mesh;
}

/** Sync editor-defined lights to Three.js scene via ShadowLight runtime */
function syncEditorLightsToScene(scene: any, editorLights: EditorLights | undefined, mode3d = false) {
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
function sync3DOverlays(
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

  // --- Cleanup existing event sprites ---
  for (const obj of eventSpritesRef.current) {
    scene.remove(obj);
    if (obj.material?.map) obj.material.map.dispose();
    if (obj.material) obj.material.dispose();
    if (obj.geometry) obj.geometry.dispose();
  }
  eventSpritesRef.current = [];

  // --- Cleanup existing player sprite ---
  if (playerSpriteRef.current) {
    for (const obj of playerSpriteRef.current) {
      scene.remove(obj);
      if (obj.material?.map) obj.material.map.dispose();
      if (obj.material) obj.material.dispose();
      if (obj.geometry) obj.geometry.dispose();
    }
    playerSpriteRef.current = null;
  }

  // --- Cleanup existing region meshes ---
  for (const obj of regionMeshesRef.current) {
    scene.remove(obj);
    if (obj.material?.map) obj.material.map.dispose();
    if (obj.material) obj.material.dispose();
    if (obj.geometry) obj.geometry.dispose();
  }
  regionMeshesRef.current = [];

  // --- Cleanup existing object meshes ---
  for (const obj of objectMeshesRef.current) {
    scene.remove(obj);
    if (obj.material?.map) obj.material.map.dispose();
    if (obj.material) obj.material.dispose();
    if (obj.geometry) obj.geometry.dispose();
  }
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
          const dw = charW * scale;
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
      // Y-flip for Mode3D's inverted projection
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
  const containerRef = useRef<HTMLDivElement>(null);
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
  const parallaxDivRef = useRef<HTMLDivElement>(null);
  const gridMeshRef = useRef<any>(null);
  // 3D overlay refs (events, player, regions, objects, selection/cursor rendered in Three.js scene)
  const eventSpritesRef = useRef<any[]>([]);
  const playerSpriteRef = useRef<any>(null);
  const regionMeshesRef = useRef<any[]>([]);
  const objectMeshesRef = useRef<any[]>([]);
  const cursorMeshRef = useRef<any>(null);
  const selectionMeshRef = useRef<any>(null);

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
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const updateMapTile = useEditorStore((s) => s.updateMapTile);
  const updateMapTiles = useEditorStore((s) => s.updateMapTiles);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const setCursorTile = useEditorStore((s) => s.setCursorTile);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const mode3d = useEditorStore((s) => s.mode3d);
  const shadowLight = useEditorStore((s) => s.shadowLight);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const addPointLight = useEditorStore((s) => s.addPointLight);
  const updatePointLight = useEditorStore((s) => s.updatePointLight);
  const deletePointLight = useEditorStore((s) => s.deletePointLight);
  const resizeMap = useEditorStore((s) => s.resizeMap);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const addObject = useEditorStore((s) => s.addObject);
  const updateObject = useEditorStore((s) => s.updateObject);
  const deleteObject = useEditorStore((s) => s.deleteObject);

  // Map boundary resize drag state
  type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;
  const isResizing = useRef(false);
  const resizeEdge = useRef<ResizeEdge>(null);
  const resizeStartPx = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeOrigSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [resizePreview, setResizePreview] = useState<{ dLeft: number; dTop: number; dRight: number; dBottom: number } | null>(null);
  const resizePreviewRef = useRef<{ dLeft: number; dTop: number; dRight: number; dBottom: number } | null>(null);
  const updateResizePreview = useCallback((val: { dLeft: number; dTop: number; dRight: number; dBottom: number } | null) => {
    resizePreviewRef.current = val;
    setResizePreview(val);
  }, []);
  const [resizeCursor, setResizeCursor] = useState<string | null>(null);

  // Light drag state
  const isDraggingLight = useRef(false);
  const draggedLightId = useRef<number | null>(null);
  const dragLightOrigin = useRef<{ x: number; y: number } | null>(null);
  const [lightDragPreview, setLightDragPreview] = useState<{ x: number; y: number } | null>(null);

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
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);

  // Event drag state
  const isDraggingEvent = useRef(false);
  const draggedEventId = useRef<number | null>(null);
  const dragEventOrigin = useRef<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [playerCharImg, setPlayerCharImg] = useState<HTMLImageElement | null>(null);

  // Object drag state
  const isDraggingObject = useRef(false);
  const draggedObjectId = useRef<number | null>(null);
  const dragObjectOrigin = useRef<{ x: number; y: number } | null>(null);
  const [objectDragPreview, setObjectDragPreview] = useState<{ x: number; y: number } | null>(null);

  // 미들 클릭 드래그 패닝
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [panning, setPanning] = useState(false);

  // 마우스 휠로 줌 인/아웃
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    // 미들 클릭 패닝
    const handlePanStart = (e: MouseEvent) => {
      if (e.button !== 1) return; // 미들 클릭만
      e.preventDefault();
      isPanning.current = true;
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    };
    const handlePanMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
      el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
    };
    const handlePanEnd = (e: MouseEvent) => {
      if (e.button !== 1 || !isPanning.current) return;
      isPanning.current = false;
      setPanning(false);
    };

    el.addEventListener('mousedown', handlePanStart);
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handlePanStart);
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
    };
  }, [zoomIn, zoomOut]);

  useEffect(() => {
    const handler = (e: Event) => setShowGrid((e as CustomEvent<boolean>).detail);
    window.addEventListener('editor-toggle-grid', handler);
    return () => window.removeEventListener('editor-toggle-grid', handler);
  }, []);

  // Sync 3D grid mesh visibility with showGrid and mode3d state
  useEffect(() => {
    const gridMesh = gridMeshRef.current;
    if (!gridMesh) return;
    gridMesh.visible = showGrid && mode3d;
    // Trigger re-render
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
      const is3D = ConfigManager.mode3d && Mode3D._spriteset;
      if (is3D) {
        if (!Mode3D._perspCamera) {
          Mode3D._perspCamera = Mode3D._createPerspCamera(rendererObj._width, rendererObj._height);
        }
        Mode3D._positionCamera(Mode3D._perspCamera, rendererObj._width, rendererObj._height);
        Mode3D._enforceNearestFilter(rendererObj.scene);
        rendererObj.renderer.render(rendererObj.scene, Mode3D._perspCamera);
      } else {
        rendererObj.renderer.render(rendererObj.scene, rendererObj.camera);
      }
    });
  }, [showGrid, mode3d]);

  // Handle Delete key for events, lights, and objects
  useEffect(() => {
    const handleDelete = () => {
      if (lightEditMode && selectedLightId != null) {
        deletePointLight(selectedLightId);
        setSelectedLightId(null);
        return;
      }
      if (editMode === 'object' && selectedObjectId != null) {
        deleteObject(selectedObjectId);
        return;
      }
      if (editMode === 'event' && selectedEventId != null) {
        deleteEvent(selectedEventId);
      }
    };
    window.addEventListener('editor-delete', handleDelete);
    return () => window.removeEventListener('editor-delete', handleDelete);
  }, [editMode, selectedEventId, deleteEvent, lightEditMode, selectedLightId, deletePointLight, setSelectedLightId, selectedObjectId, deleteObject]);

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
    Graphics.width = mapPxW;
    Graphics.height = mapPxH;
    Graphics.boxWidth = mapPxW;
    Graphics.boxHeight = mapPxH;

    // Reset any inline styles from previous Three.js setSize, then set canvas size
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.width = mapPxW;
    canvas.height = mapPxH;

    // Create renderer manually with preserveDrawingBuffer for on-demand rendering
    const strategy = RendererStrategy.getStrategy();
    const THREE = (window as any).THREE;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(mapPxW, mapPxH, false);
    renderer.setScissor(0, 0, mapPxW, mapPxH);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.sortObjects = true;
    // Enable shadow map for real-time shadow casting
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

    // Create 3D grid mesh (LineSegments) for perspective-correct grid overlay
    const gridVertices: number[] = [];
    // Vertical lines
    for (let x = 0; x <= width; x++) {
      gridVertices.push(x * TILE_SIZE_PX, 0, 0);
      gridVertices.push(x * TILE_SIZE_PX, mapPxH, 0);
    }
    // Horizontal lines
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
    // Place grid slightly above tilemap to avoid z-fighting
    gridLines.position.z = 5;
    gridLines.visible = false; // managed by showGrid state
    rendererObj.scene.add(gridLines);
    gridMeshRef.current = gridLines;

    // On-demand render function
    function renderOnce() {
      if (!rendererObjRef.current) return;
      // Skip render if map size changed (useEffect will re-create renderer with new size)
      const latestMap = useEditorStore.getState().currentMap;
      if (latestMap && (latestMap.width * TILE_SIZE_PX !== mapPxW || latestMap.height * TILE_SIZE_PX !== mapPxH)) return;
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
      }
      // 3D mode toggle
      if (state.mode3d !== prevState.mode3d) {
        if (!state.mode3d) {
          Mode3D._perspCamera = null;
        }
        // mode3d 변경 시 라이트 마커 재동기화 (3D↔2D 마커 전환)
        if (state.shadowLight && state.currentMap?.editorLights) {
          syncEditorLightsToScene(rendererObj.scene, state.currentMap.editorLights, state.mode3d);
        }
        tilemap._needsRepaint = true;
        requestRender();
      }
      // Lighting toggle
      if (state.shadowLight !== prevState.shadowLight) {
        if (state.shadowLight) {
          ShadowLight._active = true;
          ShadowLight._addLightsToScene(rendererObj.scene);
          // Apply editor lights after adding scene lights
          syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
        } else {
          ShadowLight._active = false;
          ShadowLight._removeLightsFromScene(rendererObj.scene);
        }
        // Update editor overlay sprites for shadow casting
        const updateSpriteShadow = (mesh: any) => {
          if (!mesh?.isMesh) return;
          const active = state.shadowLight;
          if (active) {
            if (!mesh.material?.isMeshPhongMaterial) {
              const oldMat = mesh.material;
              mesh.material = new THREE.MeshPhongMaterial({
                map: oldMat.map, transparent: true, depthTest: true, depthWrite: true,
                side: THREE.DoubleSide, emissive: new THREE.Color(0x111111),
                specular: new THREE.Color(0x000000), shininess: 0, alphaTest: 0.5,
              });
              mesh.material.visible = oldMat.visible;
              mesh.material.needsUpdate = true;
              oldMat.dispose();
            }
            mesh.castShadow = true;
            // customDepthMaterial for alpha-tested shadow silhouette
            if (!mesh.customDepthMaterial) {
              mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking,
                map: mesh.material.map,
                alphaTest: 0.5,
                side: THREE.DoubleSide,
              });
            }
            // z=48 for shadow map depth separation
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
            // z 복원
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
      // Editor lights changed (property edits, add/remove)
      if (state.shadowLight && state.currentMap?.editorLights !== prevState.currentMap?.editorLights) {
        syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
        requestRender();
      }
      // DoF toggle
      if (state.depthOfField !== prevState.depthOfField) {
        requestRender();
      }
      // DoF settings changed
      if (state.currentMap?.editorDoF !== prevState.currentMap?.editorDoF) {
        requestRender();
      }
    });

    return () => {
      unsubscribe();
      // Cleanup 3D overlay sprites
      for (const obj of eventSpritesRef.current) {
        rendererObj.scene.remove(obj);
        if (obj.material?.map) obj.material.map.dispose();
        if (obj.material) obj.material.dispose();
        if (obj.geometry) obj.geometry.dispose();
      }
      eventSpritesRef.current = [];
      if (playerSpriteRef.current) {
        for (const obj of playerSpriteRef.current) {
          rendererObj.scene.remove(obj);
          if (obj.material?.map) obj.material.map.dispose();
          if (obj.material) obj.material.dispose();
          if (obj.geometry) obj.geometry.dispose();
        }
        playerSpriteRef.current = null;
      }
      for (const obj of regionMeshesRef.current) {
        rendererObj.scene.remove(obj);
        if (obj.material?.map) obj.material.map.dispose();
        if (obj.material) obj.material.dispose();
        if (obj.geometry) obj.geometry.dispose();
      }
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
      // Cleanup grid mesh
      if (gridMeshRef.current) {
        rendererObj.scene.remove(gridMeshRef.current);
        gridMeshRef.current.geometry.dispose();
        gridMeshRef.current.material.dispose();
        gridMeshRef.current = null;
      }
      // Cleanup lighting
      if (ShadowLight._active) {
        ShadowLight._removeLightsFromScene(rendererObj.scene);
        ShadowLight._active = false;
      }
      Mode3D._spriteset = null;
      Mode3D._perspCamera = null;
      // Cleanup renderer
      if (rendererObj && rendererObj.renderer) {
        // Reset GL state before disposing to avoid stale state on canvas reuse
        const gl = rendererObj.renderer.getContext();
        if (gl) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.scissor(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.disable(gl.SCISSOR_TEST);
        }
        rendererObj.renderer.dispose();
      }
      // Reset canvas inline styles that may have been set by Three.js
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
  // 3D overlay sync (events, player, regions in Three.js scene)
  // =========================================================================
  useEffect(() => {
    if (!mode3d) return;
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;

    sync3DOverlays(
      rendererObj.scene,
      eventSpritesRef,
      playerSpriteRef,
      regionMeshesRef,
      objectMeshesRef,
      currentMap,
      charImages,
      editMode,
      currentLayer,
      systemData,
      currentMapId,
      playerCharImg,
      playerCharacterName,
      playerCharacterIndex,
      tilesetImages,
      selectedObjectId,
    );

    // Trigger re-render (always schedule, even if one is pending)
    requestAnimationFrame(() => {
      if (!rendererObjRef.current || !stageRef.current) return;
      const rObj = rendererObjRef.current;
      const strategy = (window as any).RendererStrategy?.getStrategy();
      rObj._drawOrderCounter = 0;
      stageRef.current.updateTransform();
      if (strategy) strategy._syncHierarchy(rObj, stageRef.current);
      if (ConfigManager.mode3d && Mode3D._spriteset) {
        if (!Mode3D._perspCamera) {
          Mode3D._perspCamera = Mode3D._createPerspCamera(rObj._width, rObj._height);
        }
        Mode3D._positionCamera(Mode3D._perspCamera, rObj._width, rObj._height);
        rObj.renderer.render(rObj.scene, Mode3D._perspCamera);
      } else {
        rObj.renderer.render(rObj.scene, rObj.camera);
      }
      renderRequestedRef.current = false;
    });
  }, [mode3d, currentMap, charImages, editMode, currentLayer, systemData, currentMapId, playerCharImg, playerCharacterName, playerCharacterIndex, tilesetImages, selectedObjectId]);

  // Cleanup 3D overlays when switching out of 3D mode
  useEffect(() => {
    if (mode3d) return;
    const rendererObj = rendererObjRef.current;
    if (!rendererObj) return;
    // Remove 3D overlay objects when mode3d is off
    for (const obj of eventSpritesRef.current) {
      rendererObj.scene.remove(obj);
      if (obj.material?.map) obj.material.map.dispose();
      if (obj.material) obj.material.dispose();
      if (obj.geometry) obj.geometry.dispose();
    }
    eventSpritesRef.current = [];
    if (playerSpriteRef.current) {
      for (const obj of playerSpriteRef.current) {
        rendererObj.scene.remove(obj);
        if (obj.material?.map) obj.material.map.dispose();
        if (obj.material) obj.material.dispose();
        if (obj.geometry) obj.geometry.dispose();
      }
      playerSpriteRef.current = null;
    }
    for (const obj of regionMeshesRef.current) {
      rendererObj.scene.remove(obj);
      if (obj.material?.map) obj.material.map.dispose();
      if (obj.material) obj.material.dispose();
      if (obj.geometry) obj.geometry.dispose();
    }
    regionMeshesRef.current = [];
    for (const obj of objectMeshesRef.current) {
      rendererObj.scene.remove(obj);
      if (obj.material?.map) obj.material.map.dispose();
      if (obj.material) obj.material.dispose();
      if (obj.geometry) obj.geometry.dispose();
    }
    objectMeshesRef.current = [];
  }, [mode3d]);

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

    // Grid (skip in 3D mode - grid is rendered as Three.js mesh)
    if (showGrid && !mode3d) {
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

    // Region overlay (layer 5) - skip in 3D mode (rendered in Three.js scene)
    if (currentLayer === 5 && !mode3d) {
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

    // Events - skip in 3D mode (rendered in Three.js scene)
    if (events && !mode3d) {
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

    // Objects overlay
    if (currentMap?.objects && !mode3d) {
      const isObjectMode = editMode === 'object';
      for (const obj of currentMap.objects) {
        for (let row = 0; row < obj.height; row++) {
          for (let col = 0; col < obj.width; col++) {
            const tileId = obj.tileIds[row]?.[col];
            if (!tileId || tileId === 0) continue;
            const drawX = (obj.x + col) * TILE_SIZE_PX;
            const drawY = (obj.y - obj.height + 1 + row) * TILE_SIZE_PX;
            const info = getTileRenderInfo(tileId);
            if (!info) continue;
            if (info.type === 'normal') {
              const img = tilesetImages[info.sheet];
              if (img) {
                ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, drawX, drawY, TILE_SIZE_PX, TILE_SIZE_PX);
              }
            } else if (info.type === 'autotile') {
              const HALF = TILE_SIZE_PX / 2;
              for (let q = 0; q < 4; q++) {
                const quarter = info.quarters[q];
                const img = tilesetImages[quarter.sheet];
                if (!img) continue;
                const qx = drawX + (q % 2) * HALF;
                const qy = drawY + Math.floor(q / 2) * HALF;
                ctx.drawImage(img, quarter.sx, quarter.sy, HALF, HALF, qx, qy, HALF, HALF);
              }
            }
          }
        }
        if (isObjectMode) {
          const bx = obj.x * TILE_SIZE_PX;
          const by = (obj.y - obj.height + 1) * TILE_SIZE_PX;
          const bw = obj.width * TILE_SIZE_PX;
          const bh = obj.height * TILE_SIZE_PX;
          const isSelected = selectedObjectId === obj.id;
          // Draw passability X markers on impassable tiles
          if (obj.passability) {
            for (let row = 0; row < obj.height; row++) {
              for (let col = 0; col < obj.width; col++) {
                if (obj.passability[row]?.[col] === false) {
                  const tx = (obj.x + col) * TILE_SIZE_PX;
                  const ty = (obj.y - obj.height + 1 + row) * TILE_SIZE_PX;
                  const pad = 4;
                  ctx.save();
                  ctx.strokeStyle = 'rgba(255,60,60,0.8)';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(tx + pad, ty + pad);
                  ctx.lineTo(tx + TILE_SIZE_PX - pad, ty + TILE_SIZE_PX - pad);
                  ctx.moveTo(tx + TILE_SIZE_PX - pad, ty + pad);
                  ctx.lineTo(tx + pad, ty + TILE_SIZE_PX - pad);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            }
          }
          ctx.strokeStyle = isSelected ? '#00ff66' : '#00cc66';
          ctx.lineWidth = isSelected ? 3 : 1;
          ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
          if (obj.name) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 2;
            ctx.fillText(obj.name, bx + bw / 2, by + 2, bw - 4);
            ctx.restore();
          }
        }
      }
      if (objectDragPreview && isDraggingObject.current && draggedObjectId.current != null) {
        const obj = currentMap.objects.find(o => o.id === draggedObjectId.current);
        if (obj) {
          const px = objectDragPreview.x * TILE_SIZE_PX;
          const py = (objectDragPreview.y - obj.height + 1) * TILE_SIZE_PX;
          // Draw tile images at preview position with transparency
          ctx.save();
          ctx.globalAlpha = 0.6;
          for (let row = 0; row < obj.height; row++) {
            for (let col = 0; col < obj.width; col++) {
              const tileId = obj.tileIds[row]?.[col];
              if (!tileId || tileId === 0) continue;
              const drawX = px + col * TILE_SIZE_PX;
              const drawY = py + row * TILE_SIZE_PX;
              const info = getTileRenderInfo(tileId);
              if (!info) continue;
              if (info.type === 'normal') {
                const img = tilesetImages[info.sheet];
                if (img) ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, drawX, drawY, TILE_SIZE_PX, TILE_SIZE_PX);
              } else if (info.type === 'autotile') {
                const HALF = TILE_SIZE_PX / 2;
                for (let q = 0; q < 4; q++) {
                  const quarter = info.quarters[q];
                  const img = tilesetImages[quarter.sheet];
                  if (!img) continue;
                  ctx.drawImage(img, quarter.sx, quarter.sy, HALF, HALF, drawX + (q % 2) * HALF, drawY + Math.floor(q / 2) * HALF, HALF, HALF);
                }
              }
            }
          }
          ctx.restore();
          ctx.strokeStyle = '#00ff66';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, obj.width * TILE_SIZE_PX, obj.height * TILE_SIZE_PX);
        }
      }
    }

    // Player start position - skip in 3D mode (rendered in Three.js scene)
    if (systemData && currentMapId === systemData.startMapId && !mode3d) {
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

    // Light markers (visible when shadowLight is ON, 2D overlay only in non-3D mode)
    if (shadowLight && !mode3d && currentMap?.editorLights?.points) {
      for (const light of currentMap.editorLights.points) {
        const lx = light.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const lyBase = light.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const zOffset = (light.z ?? 0) * 0.5; // Z높이를 시각적 오프셋으로
        const ly = lyBase - zOffset;

        if (lightEditMode) {
          // Z 오프셋이 있으면 바닥 위치와 점선 연결
          if (zOffset > 2) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = light.color + '80';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lx, lyBase);
            ctx.lineTo(lx, ly);
            ctx.stroke();
            ctx.setLineDash([]);
            // 바닥 마커
            ctx.beginPath();
            ctx.arc(lx, lyBase, 3, 0, Math.PI * 2);
            ctx.fillStyle = light.color + '60';
            ctx.fill();
          }

          // L탭: 영향 반경 + 선택 하이라이트 표시
          ctx.beginPath();
          ctx.arc(lx, ly, light.distance, 0, Math.PI * 2);
          ctx.strokeStyle = light.color + '30';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = light.color + '10';
          ctx.fill();

          const isSelected = selectedLightId === light.id;
          ctx.beginPath();
          ctx.arc(lx, ly, isSelected ? 12 : 9, 0, Math.PI * 2);
          ctx.fillStyle = light.color;
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#fff' : '#000';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        }

        // 💡 아이콘 (항상 표시)
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText('💡', lx, ly);
        ctx.shadowBlur = 0;
      }
    }

    // Light drag preview
    if (lightDragPreview && isDraggingLight.current) {
      const dx = lightDragPreview.x * TILE_SIZE_PX;
      const dy = lightDragPreview.y * TILE_SIZE_PX;
      ctx.fillStyle = 'rgba(255,204,136,0.4)';
      ctx.fillRect(dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
      ctx.strokeStyle = '#ffcc88';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
    }

    // Drag preview (events)
    if (dragPreview && isDraggingEvent.current) {
      const dx = dragPreview.x * TILE_SIZE_PX;
      const dy = dragPreview.y * TILE_SIZE_PX;
      ctx.fillStyle = 'rgba(0,180,80,0.4)';
      ctx.fillRect(dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
    }
  }, [currentMap, charImages, showGrid, editMode, currentLayer, systemData, currentMapId, playerCharImg, playerCharacterName, playerCharacterIndex, dragPreview, mode3d, shadowLight, lightEditMode, selectedLightId, lightDragPreview]);

  // =========================================================================
  // Coordinate conversion
  // =========================================================================
  const canvasToTile = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) / zoomLevel;
    const screenY = (e.clientY - rect.top) / zoomLevel;

    // 3D mode: use Mode3D.screenToWorld for perspective-correct tile coordinates
    if (mode3d && ConfigManager.mode3d && Mode3D._perspCamera) {
      const world = Mode3D.screenToWorld(screenX, screenY);
      if (world) {
        const tileX = Math.floor(world.x / TILE_SIZE_PX);
        const tileY = Math.floor(world.y / TILE_SIZE_PX);
        if (!currentMap) return null;
        if (tileX < 0 || tileX >= currentMap.width || tileY < 0 || tileY >= currentMap.height) return null;
        return { x: tileX, y: tileY };
      }
      return null;
    }

    return posToTile(screenX, screenY);
  }, [zoomLevel, mode3d, currentMap]);

  const canvasToSubTile = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) / zoomLevel;
    const screenY = (e.clientY - rect.top) / zoomLevel;

    if (mode3d && ConfigManager.mode3d && Mode3D._perspCamera) {
      const world = Mode3D.screenToWorld(screenX, screenY);
      if (!world || !currentMap) return null;
      const tileX = Math.floor(world.x / TILE_SIZE_PX);
      const tileY = Math.floor(world.y / TILE_SIZE_PX);
      if (tileX < 0 || tileX >= currentMap.width || tileY < 0 || tileY >= currentMap.height) return null;
      const subX = world.x - tileX * TILE_SIZE_PX;
      const subY = world.y - tileY * TILE_SIZE_PX;
      return { x: tileX, y: tileY, subX, subY };
    }

    const tile = posToTile(screenX, screenY);
    if (!tile) return null;
    const subX = screenX - tile.x * TILE_SIZE_PX;
    const subY = screenY - tile.y * TILE_SIZE_PX;
    return { ...tile, subX, subY };
  }, [zoomLevel, mode3d, currentMap]);

  // =========================================================================
  // Map boundary resize detection
  // =========================================================================
  const EDGE_THRESHOLD = 16; // px (in map-space, before zoom) - detect inside the map boundary
  const detectEdge = useCallback((e: React.MouseEvent<HTMLElement>): ResizeEdge => {
    if (!currentMap || mode3d) return null;
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoomLevel;
    const py = (e.clientY - rect.top) / zoomLevel;
    const mapW = currentMap.width * TILE_SIZE_PX;
    const mapH = currentMap.height * TILE_SIZE_PX;
    const t = EDGE_THRESHOLD;

    // Detect edges from inside the map boundary only (canvas doesn't extend beyond map)
    const nearN = py >= 0 && py <= t;
    const nearS = py >= mapH - t && py <= mapH;
    const nearW = px >= 0 && px <= t;
    const nearE = px >= mapW - t && px <= mapW;

    if (nearN && nearW) return 'nw';
    if (nearN && nearE) return 'ne';
    if (nearS && nearW) return 'sw';
    if (nearS && nearE) return 'se';
    if (nearN && px > t && px < mapW - t) return 'n';
    if (nearS && px > t && px < mapW - t) return 's';
    if (nearW && py > t && py < mapH - t) return 'w';
    if (nearE && py > t && py < mapH - t) return 'e';
    return null;
  }, [currentMap, zoomLevel, mode3d]);

  const edgeToCursor = (edge: ResizeEdge): string | null => {
    switch (edge) {
      case 'n': case 's': return 'ns-resize';
      case 'e': case 'w': return 'ew-resize';
      case 'ne': case 'sw': return 'nesw-resize';
      case 'nw': case 'se': return 'nwse-resize';
      default: return null;
    }
  };

  const getCanvasPx = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoomLevel, y: (e.clientY - rect.top) / zoomLevel };
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
  // Resize drag uses window-level listeners so dragging outside canvas still works
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !resizeEdge.current) return;
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoomLevel;
    const py = (e.clientY - rect.top) / zoomLevel;
    const dx = px - resizeStartPx.current.x;
    const dy = py - resizeStartPx.current.y;
    const edge = resizeEdge.current;
    const dtX = Math.round(dx / TILE_SIZE_PX);
    const dtY = Math.round(dy / TILE_SIZE_PX);
    let dLeft = 0, dTop = 0, dRight = 0, dBottom = 0;
    if (edge.includes('e')) dRight = dtX;
    if (edge.includes('w')) dLeft = dtX;
    if (edge.includes('s')) dBottom = dtY;
    if (edge.includes('n')) dTop = dtY;
    const origW = resizeOrigSize.current.w;
    const origH = resizeOrigSize.current.h;
    const newW = origW + dRight - dLeft;
    const newH = origH + dBottom - dTop;
    if (newW < 1) { if (dRight !== 0) dRight = 1 - origW + dLeft; else dLeft = origW + dRight - 1; }
    if (newH < 1) { if (dBottom !== 0) dBottom = 1 - origH + dTop; else dTop = origH + dBottom - 1; }
    if (newW > 256) { if (dRight !== 0) dRight = 256 - origW + dLeft; else dLeft = origW + dRight - 256; }
    if (newH > 256) { if (dBottom !== 0) dBottom = 256 - origH + dTop; else dTop = origH + dBottom - 256; }
    updateResizePreview({ dLeft, dTop, dRight, dBottom });
  }, [zoomLevel, updateResizePreview]);

  const handleResizeUp = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    resizeEdge.current = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeUp);
    const preview = resizePreviewRef.current;
    if (preview) {
      const { dLeft, dTop, dRight, dBottom } = preview;
      if (dLeft !== 0 || dTop !== 0 || dRight !== 0 || dBottom !== 0) {
        const origW = resizeOrigSize.current.w;
        const origH = resizeOrigSize.current.h;
        const newW = origW + dRight - dLeft;
        const newH = origH + dBottom - dTop;
        resizeMap(newW, newH, -dLeft, -dTop);
      }
    }
    updateResizePreview(null);
  }, [handleResizeMove, resizeMap, updateResizePreview]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
  }, [handleResizeMove, handleResizeUp]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Map boundary resize: start resize if on edge
      if (e.button === 0 && editMode === 'map' && !mode3d) {
        const edge = detectEdge(e);
        if (edge) {
          const px = getCanvasPx(e);
          if (px && currentMap) {
            isResizing.current = true;
            resizeEdge.current = edge;
            resizeStartPx.current = px;
            resizeOrigSize.current = { w: currentMap.width, h: currentMap.height };
            updateResizePreview({ dLeft: 0, dTop: 0, dRight: 0, dBottom: 0 });
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeUp);
            e.preventDefault();
            return;
          }
        }
      }

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

      // Light edit mode: place or select lights
      if (lightEditMode && selectedLightType === 'point') {
        const lights = currentMap?.editorLights?.points || [];
        const hitLight = lights.find(l => {
          if (l.x === tile.x && l.y === tile.y) return true;
          // Z 오프셋에 의한 시각적 위치도 히트 가능
          const zOffset = (l.z ?? 0) * 0.5;
          const visualY = l.y * TILE_SIZE_PX + TILE_SIZE_PX / 2 - zOffset;
          const visualTileY = Math.floor(visualY / TILE_SIZE_PX);
          return l.x === tile.x && visualTileY === tile.y;
        });
        if (hitLight) {
          setSelectedLightId(hitLight.id);
          isDraggingLight.current = true;
          draggedLightId.current = hitLight.id;
          dragLightOrigin.current = { x: tile.x, y: tile.y };
          setLightDragPreview(null);
        } else {
          addPointLight(tile.x, tile.y);
        }
        return;
      }

      if (editMode === 'object') {
        const objects = currentMap?.objects || [];
        const hitObj = objects.find(o =>
          tile.x >= o.x && tile.x < o.x + o.width &&
          tile.y >= o.y - o.height + 1 && tile.y <= o.y
        );
        if (hitObj) {
          setSelectedObjectId(hitObj.id);
          isDraggingObject.current = true;
          draggedObjectId.current = hitObj.id;
          dragObjectOrigin.current = { x: tile.x, y: tile.y };
          setObjectDragPreview(null);
        } else {
          addObject(tile.x, tile.y);
        }
        return;
      }

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
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, editMode, currentMap, setSelectedEventId, currentLayer, pushUndo, updateMapTiles, lightEditMode, selectedLightType, setSelectedLightId, addPointLight, mode3d, detectEdge, getCanvasPx, handleResizeMove, handleResizeUp, updateResizePreview]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Map boundary resize is handled by window-level listeners (handleResizeMove)
      if (isResizing.current) return;

      // Edge cursor detection (non-dragging)
      if (editMode === 'map' && !mode3d && !isDrawing.current && !isDraggingEvent.current && !isDraggingLight.current) {
        const edge = detectEdge(e);
        setResizeCursor(edgeToCursor(edge));
      }

      const tile = canvasToTile(e);
      if (tile) {
        setCursorTile(tile.x, tile.y);
      }

      // Light dragging
      if (isDraggingLight.current && tile && dragLightOrigin.current) {
        if (tile.x !== dragLightOrigin.current.x || tile.y !== dragLightOrigin.current.y) {
          setLightDragPreview({ x: tile.x, y: tile.y });
        } else {
          setLightDragPreview(null);
        }
        return;
      }

      // Object dragging
      if (isDraggingObject.current && tile && dragObjectOrigin.current) {
        if (tile.x !== dragObjectOrigin.current.x || tile.y !== dragObjectOrigin.current.y) {
          const obj = currentMap?.objects?.find(o => o.id === draggedObjectId.current);
          if (obj) {
            const dx = tile.x - dragObjectOrigin.current.x;
            const dy = tile.y - dragObjectOrigin.current.y;
            setObjectDragPreview({ x: obj.x + dx, y: obj.y + dy });
          }
        } else {
          setObjectDragPreview(null);
        }
        return;
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
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, setCursorTile, drawOverlayPreview, getCanvasPx, detectEdge, editMode, mode3d]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Map boundary resize is handled by window-level listener (handleResizeUp)
      if (isResizing.current) return;

      // Light drag commit
      if (isDraggingLight.current && draggedLightId.current != null) {
        const tile = canvasToTile(e);
        const origin = dragLightOrigin.current;
        if (tile && origin && (tile.x !== origin.x || tile.y !== origin.y)) {
          updatePointLight(draggedLightId.current, { x: tile.x, y: tile.y });
        }
        isDraggingLight.current = false;
        draggedLightId.current = null;
        dragLightOrigin.current = null;
        setLightDragPreview(null);
        return;
      }

      // Object drag commit
      if (isDraggingObject.current && draggedObjectId.current != null) {
        if (objectDragPreview) {
          updateObject(draggedObjectId.current, { x: objectDragPreview.x, y: objectDragPreview.y });
        }
        isDraggingObject.current = false;
        draggedObjectId.current = null;
        dragObjectOrigin.current = null;
        setObjectDragPreview(null);
        return;
      }

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
    [selectedTool, canvasToTile, drawRectangle, drawEllipse, clearOverlay, pushUndo, updatePointLight, resizeMap, resizePreview]
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
  const parallaxName = currentMap?.parallaxName || '';
  const parallaxShow = currentMap?.parallaxShow ?? false;
  const mapPxW = (currentMap?.width || 0) * TILE_SIZE_PX;
  const mapPxH = (currentMap?.height || 0) * TILE_SIZE_PX;

  return (
    <div ref={containerRef} style={{ ...styles.container, cursor: panning ? 'grabbing' : undefined }} onClick={closeEventCtxMenu}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
      }}>
        {parallaxName && parallaxShow && (
          <div
            ref={parallaxDivRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: mapPxW,
              height: mapPxH,
              backgroundImage: `url(/api/resources/parallaxes/${parallaxName}.png)`,
              backgroundRepeat: 'repeat',
              backgroundSize: 'auto',
              zIndex: 0,
            }}
          />
        )}
        <canvas
          ref={webglCanvasRef}
          onMouseDown={mode3d ? handleMouseDown : undefined}
          onMouseMove={mode3d ? handleMouseMove : undefined}
          onMouseUp={mode3d ? handleMouseUp : undefined}
          onMouseLeave={mode3d ? (e) => {
            if (isDraggingEvent.current) {
              isDraggingEvent.current = false;
              draggedEventId.current = null;
              dragEventOrigin.current = null;
              setDragPreview(null);
            }
            handleMouseUp(e);
          } : undefined}
          onDoubleClick={mode3d ? handleDoubleClick : undefined}
          onContextMenu={mode3d ? handleContextMenu : undefined}
          style={{
            ...styles.canvas,
            position: 'relative',
            zIndex: 1,
            cursor: panning ? 'grabbing' : mode3d ? (editMode === 'event' ? 'pointer' : 'crosshair') : undefined,
          }}
        />
        <canvas
          ref={overlayRef}
          onMouseDown={mode3d ? undefined : handleMouseDown}
          onMouseMove={mode3d ? undefined : handleMouseMove}
          onMouseUp={mode3d ? undefined : handleMouseUp}
          onMouseLeave={mode3d ? undefined : (e) => {
            // Resize drag continues via window-level listeners, don't cancel here
            setResizeCursor(null);
            if (isResizing.current) return; // Don't trigger other cleanup during resize
            if (isDraggingEvent.current) {
              isDraggingEvent.current = false;
              draggedEventId.current = null;
              dragEventOrigin.current = null;
              setDragPreview(null);
            }
            handleMouseUp(e);
          }}
          onDoubleClick={mode3d ? undefined : handleDoubleClick}
          onContextMenu={mode3d ? undefined : handleContextMenu}
          style={{
            ...styles.canvas,
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: mode3d ? -1 : 2,
            cursor: panning ? 'grabbing' : resizeCursor || (editMode === 'event' ? 'pointer' : 'crosshair'),
            pointerEvents: mode3d ? 'none' : 'auto',
            display: mode3d ? 'none' : 'block',
          }}
        />
        {/* Resize preview overlay */}
        {resizePreview && currentMap && (() => {
          const { dLeft, dTop, dRight, dBottom } = resizePreview;
          const origW = resizeOrigSize.current.w;
          const origH = resizeOrigSize.current.h;
          const newW = origW + dRight - dLeft;
          const newH = origH + dBottom - dTop;
          const previewLeft = dLeft * TILE_SIZE_PX;
          const previewTop = dTop * TILE_SIZE_PX;
          const previewW = newW * TILE_SIZE_PX;
          const previewH = newH * TILE_SIZE_PX;
          return (
            <>
              <div style={{
                position: 'absolute',
                left: previewLeft,
                top: previewTop,
                width: previewW,
                height: previewH,
                border: '2px dashed #4af',
                pointerEvents: 'none',
                zIndex: 3,
                boxSizing: 'border-box',
              }} />
              <div style={{
                position: 'absolute',
                left: previewLeft + previewW / 2,
                top: previewTop - 20,
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                color: '#4af',
                padding: '2px 8px',
                borderRadius: 3,
                fontSize: 12,
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 4,
                whiteSpace: 'nowrap',
              }}>
                {origW}x{origH} → {newW}x{newH}
              </div>
            </>
          );
        })()}
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
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { if (currentMapId) setPlayerStartPosition(currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>시작 위치 설정</div>
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
