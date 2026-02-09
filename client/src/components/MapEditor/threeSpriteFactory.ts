/** Create a canvas-based SpriteMaterial for light marker */
export function createLightMarkerSprite(THREE: any, color: string): any {
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
export function createLightStemLine(THREE: any, px: number, py: number, z: number, color: string): any {
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

/** Create a flat colored quad (PlaneGeometry) at tile position */
export function createTileQuad(THREE: any, x: number, y: number, tileSize: number, color: number, opacity: number, renderOrder: number): any {
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
export function createTileOutline(THREE: any, x: number, y: number, tileSize: number, color: number, lineWidth: number, renderOrder: number): any {
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
