import React from 'react';
import { TILE_SIZE_PX } from '../../utils/tileHelper';

export interface OverlayRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
}

/**
 * Helper: dispose all meshes in a global array and clear it
 */
export function disposeMeshes(scene: any, globalKey: string) {
  if (!(window as any)[globalKey]) (window as any)[globalKey] = [];
  const existing = (window as any)[globalKey] as any[];
  for (const m of existing) {
    scene.remove(m);
    m.geometry?.dispose();
    m.material?.dispose();
  }
  existing.length = 0;
  return existing;
}

/**
 * Helper: trigger a render frame
 */
export function triggerRender(
  renderRequestedRef: React.MutableRefObject<boolean>,
  rendererObjRef: React.MutableRefObject<any>,
  stageRef: React.MutableRefObject<any>,
) {
  if (!renderRequestedRef.current) {
    renderRequestedRef.current = true;
    requestAnimationFrame(() => {
      renderRequestedRef.current = false;
      if (!rendererObjRef.current || !stageRef.current) return;
      const strategy = (window as any).RendererStrategy?.getStrategy();
      if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
    });
  }
}

/**
 * Helper: create entity highlight (fill + border) at tile position
 */
export function createHighlightMesh(
  THREE: any, scene: any, meshes: any[],
  cx: number, cy: number, w: number, h: number,
  fillColor: number, strokeColor: number,
  fillZ: number, lineZ: number,
  fillOrder: number, lineOrder: number,
  fillOpacity = 0.3,
) {
  const geom = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    color: fillColor, opacity: fillOpacity, transparent: true,
    depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(cx, cy, fillZ);
  mesh.renderOrder = fillOrder;
  mesh.frustumCulled = false;
  mesh.userData.editorGrid = true;
  scene.add(mesh);
  meshes.push(mesh);

  const hw = w / 2, hh = h / 2;
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
  line.position.set(cx, cy, lineZ);
  line.renderOrder = lineOrder;
  line.frustumCulled = false;
  line.userData.editorGrid = true;
  scene.add(line);
  meshes.push(line);
}

/**
 * Helper: create drag selection area (dashed rect)
 */
export function createDragSelectionArea(
  THREE: any, scene: any, meshes: any[],
  start: { x: number; y: number }, end: { x: number; y: number },
  color: number,
) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  const rw = (maxX - minX + 1) * TILE_SIZE_PX;
  const rh = (maxY - minY + 1) * TILE_SIZE_PX;
  const cx = minX * TILE_SIZE_PX + rw / 2;
  const cy = minY * TILE_SIZE_PX + rh / 2;

  const geom = new THREE.PlaneGeometry(rw, rh);
  const mat = new THREE.MeshBasicMaterial({
    color, opacity: 0.15, transparent: true,
    depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(cx, cy, 6.5);
  mesh.renderOrder = 10004;
  mesh.frustumCulled = false;
  mesh.userData.editorGrid = true;
  scene.add(mesh);
  meshes.push(mesh);

  const hw = rw / 2, hh = rh / 2;
  const pts = [
    new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
    new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
    new THREE.Vector3(-hw, -hh, 0),
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineDashedMaterial({
    color, depthTest: false, transparent: true,
    opacity: 1.0, dashSize: 6, gapSize: 4,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  line.computeLineDistances();
  line.position.set(cx, cy, 6.8);
  line.renderOrder = 10005;
  line.frustumCulled = false;
  line.userData.editorGrid = true;
  scene.add(line);
  meshes.push(line);
}

/**
 * Helper: create paste preview boxes
 */
export function createPastePreview(
  THREE: any, scene: any, meshes: any[],
  items: { x: number; y: number; width?: number; height?: number }[],
  fillColor: number, strokeColor: number,
  isObject?: boolean,
) {
  for (const item of items) {
    const w = (item.width || 1) * TILE_SIZE_PX;
    const h = (item.height || 1) * TILE_SIZE_PX;
    const cx = item.x * TILE_SIZE_PX + w / 2;
    const cy = isObject
      ? (item.y - (item.height || 1) + 1) * TILE_SIZE_PX + h / 2
      : item.y * TILE_SIZE_PX + h / 2;

    const geom = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: fillColor, opacity: 0.4, transparent: true,
      depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, cy, 6);
    mesh.renderOrder = 10000;
    mesh.frustumCulled = false;
    mesh.userData.editorGrid = true;
    scene.add(mesh);
    meshes.push(mesh);

    const hw = w / 2, hh = h / 2;
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
    line.userData.editorGrid = true;
    scene.add(line);
    meshes.push(line);
  }
}

/**
 * 통행 표시용 Canvas 텍스처 캐시 (O: 통행가능, X: 통행불가)
 */
const _passabilityTexCache: { o?: any; x?: any } = {};
export function getPassabilityTexture(THREE: any, passable: boolean) {
  const key = passable ? 'o' : 'x';
  if (_passabilityTexCache[key]) return _passabilityTexCache[key];

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  if (passable) {
    // O 표시 (초록)
    ctx.strokeStyle = '#22cc44';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // X 표시 (빨강)
    ctx.strokeStyle = '#ee3333';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const m = 5;
    ctx.beginPath();
    ctx.moveTo(m, m);
    ctx.lineTo(size - m, size - m);
    ctx.moveTo(size - m, m);
    ctx.lineTo(m, size - m);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  _passabilityTexCache[key] = tex;
  return tex;
}
