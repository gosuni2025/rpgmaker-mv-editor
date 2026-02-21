import React from 'react';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';

/** 메시 배열 dispose 및 씬에서 제거 */
export function disposeMeshes(rendererObj: any, meshesRef: React.MutableRefObject<any[]>) {
  for (const m of meshesRef.current) {
    rendererObj.scene.remove(m);
    m.geometry?.dispose();
    if (m.material?.map) m.material.map.dispose();
    m.material?.dispose();
  }
  meshesRef.current = [];
}

/** 사각형 테두리(Line) 생성 */
export function createRectBorder(
  THREE: any, cx: number, cy: number, hw: number, hh: number,
  z: number, color: number, renderOrder: number,
) {
  const pts = [
    new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
    new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
    new THREE.Vector3(-hw, -hh, 0),
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineBasicMaterial({
    color, depthTest: false, transparent: true, opacity: 1.0,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  line.position.set(cx, cy, z);
  line.renderOrder = renderOrder;
  line.frustumCulled = false;
  line.userData.editorGrid = true;
  return line;
}

/** 대시선 사각형 테두리(LineDashed) 생성 */
export function createDashedRectBorder(
  THREE: any, cx: number, cy: number, hw: number, hh: number,
  z: number, color: number, renderOrder: number,
  dashSize = 8, gapSize = 4,
) {
  const pts = [
    new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
    new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
    new THREE.Vector3(-hw, -hh, 0),
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineDashedMaterial({
    color, depthTest: false, transparent: true, opacity: 1.0, dashSize, gapSize,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  line.computeLineDistances();
  line.position.set(cx, cy, z);
  line.renderOrder = renderOrder;
  line.frustumCulled = false;
  line.userData.editorGrid = true;
  return line;
}

/** 텍스트 레이블 Mesh 생성. labelH를 함께 반환 */
export function createTextLabel(
  THREE: any, text: string, cx: number, cy: number,
  z: number, renderOrder: number, color: string,
) {
  const cvsW = 320, cvsH = 80;
  const cvs = document.createElement('canvas');
  cvs.width = cvsW; cvs.height = cvsH;
  const ctx = cvs.getContext('2d')!;
  ctx.clearRect(0, 0, cvsW, cvsH);
  ctx.fillStyle = color;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText(text, cvsW / 2, cvsH / 2, cvsW - 8);
  const tex = new THREE.CanvasTexture(cvs);
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  const labelW = TILE_SIZE_PX * 1.5;
  const labelH = labelW * (cvsH / cvsW);
  const labelGeom = new THREE.PlaneGeometry(labelW, labelH);
  const labelMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(labelGeom, labelMat);
  mesh.position.set(cx, cy, z);
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  mesh.userData.editorGrid = true;
  return { mesh, labelH };
}

export type TintFn = (
  ctx: CanvasRenderingContext2D,
  srcX: number, srcY: number, cw: number, ch: number,
  dx: number, dy: number, dw: number, dh: number,
  img: HTMLImageElement,
) => void;

/** 캐릭터 이미지 스프라이트를 비동기로 씬에 추가 */
export function addCharacterSprite(
  THREE: any,
  rendererObjRef: React.MutableRefObject<any>,
  meshesRef: React.MutableRefObject<any[]>,
  charName: string,
  charIndex: number,
  cx: number, cy: number, z: number,
  renderOrder: number,
  onAdded: () => void,
  tint?: TintFn,
) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (!rendererObjRef.current) return;
    const isSingle = charName.startsWith('$');
    const charW = isSingle ? img.width / 3 : img.width / 12;
    const charH = isSingle ? img.height / 4 : img.height / 8;
    const charCol = isSingle ? 0 : charIndex % 4;
    const charRow = isSingle ? 0 : Math.floor(charIndex / 4);
    const srcX = charCol * charW * 3 + 1 * charW;
    const srcY = charRow * charH * 4 + 0 * charH;

    const cvs = document.createElement('canvas');
    cvs.width = TILE_SIZE_PX; cvs.height = TILE_SIZE_PX;
    const ctx = cvs.getContext('2d')!;
    const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
    const dw = charW * scale, dh = charH * scale;
    const dx = (TILE_SIZE_PX - dw) / 2, dy = TILE_SIZE_PX - dh;

    if (tint) {
      tint(ctx, srcX, srcY, charW, charH, dx, dy, dw, dh, img);
    } else {
      ctx.drawImage(img, srcX, srcY, charW, charH, dx, dy, dw, dh);
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.flipY = false;
    tex.minFilter = THREE.LinearFilter;
    const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, cy, z);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    mesh.userData.editorGrid = true;
    rendererObjRef.current.scene.add(mesh);
    meshesRef.current.push(mesh);
    onAdded();
  };
  img.src = `/api/resources/img_characters/${charName}.png`;
}
