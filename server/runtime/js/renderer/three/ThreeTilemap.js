//=============================================================================
// ThreeTilemap.js - GPU-native tilemap rendering for Three.js backend
//=============================================================================
// ShaderTilemap의 addRect() API를 Three.js로 네이티브 구현.
// Canvas 2D 중간 단계 없이 타일을 직접 GPU 메시로 렌더링.
//
// 구조:
//   ThreeTilemapZLayer (ThreeContainer)
//     └── ThreeTilemapCompositeLayer
//           └── ThreeTilemapRectLayer (addRect 호출 수신)
//                 └── setNumber별 THREE.Mesh (BufferGeometry)
//=============================================================================

//=============================================================================
// ThreeTilemapRectLayer - 핵심 렌더링 클래스
// addRect()로 쿼드 데이터를 축적, syncTransform 시 메시 빌드
//=============================================================================

function ThreeTilemapRectLayer() {
    this._threeObj = new THREE.Group();
    this._threeObj._wrapper = this;

    this._x = 0;
    this._y = 0;
    this._scaleX = 1;
    this._scaleY = 1;
    this._rotation = 0;
    this._pivotX = 0;
    this._pivotY = 0;
    this._alpha = 1;
    this._visible = true;
    this._zIndex = 0;
    this.worldAlpha = 1;
    this.worldVisible = true;
    this.parent = null;
    this.children = [];
    this._filters = null;
    this._transformDirty = true;

    this.scale = { x: 1, y: 1 };
    this.pivot = { x: 0, y: 0 };

    // setNumber → rect data 배열 (-1 = 그림자, 0~13 = 타일셋)
    this._rectData = {};   // { setNumber: { positions: [], uvs: [], count: 0 } }
    this._bitmaps = [];    // 타일셋 텍스처 배열
    this._meshes = {};     // setNumber → THREE.Mesh (캐싱)
    this._needsRebuild = false;
    this._shadowColor = new Float32Array([0, 0, 0, 0.5]);

    // 애니메이션 오프셋 (부모 ShaderTilemap에서 읽음)
    this._tileAnimX = 0;
    this._tileAnimY = 0;

    // animOffset 데이터 (setNumber별)
    this._animData = {};   // { setNumber: [] }  animX, animY per rect
}

Object.defineProperties(ThreeTilemapRectLayer.prototype, {
    x: {
        get: function() { return this._x; },
        set: function(v) { this._x = v; },
        configurable: true
    },
    y: {
        get: function() { return this._y; },
        set: function(v) { this._y = v; },
        configurable: true
    },
    alpha: {
        get: function() { return this._alpha; },
        set: function(v) { this._alpha = v; },
        configurable: true
    },
    visible: {
        get: function() { return this._visible; },
        set: function(v) { this._visible = v; this._threeObj.visible = v; },
        configurable: true
    },
    zIndex: {
        get: function() { return this._zIndex; },
        set: function(v) { this._zIndex = v; },
        configurable: true
    }
});

/**
 * 타일셋 텍스처 바인딩
 */
ThreeTilemapRectLayer.prototype.setBitmaps = function(bitmaps) {
    this._bitmaps = bitmaps || [];
};

/**
 * 모든 쿼드 데이터 초기화
 */
ThreeTilemapRectLayer.prototype.clear = function() {
    for (var key in this._rectData) {
        this._rectData[key].count = 0;
    }
    for (var key in this._animData) {
        this._animData[key].length = 0;
    }
    this._needsRebuild = true;
};

/**
 * 쿼드 추가 (ShaderTilemap API 호환)
 * @param {Number} setNumber - 타일셋 인덱스 (-1 = 그림자)
 * @param {Number} u - 소스 X (픽셀)
 * @param {Number} v - 소스 Y (픽셀)
 * @param {Number} x - 대상 X (픽셀)
 * @param {Number} y - 대상 Y (픽셀)
 * @param {Number} w - 너비
 * @param {Number} h - 높이
 * @param {Number} [animX=0] - 애니메이션 X 배율
 * @param {Number} [animY=0] - 애니메이션 Y 배율
 */
ThreeTilemapRectLayer.prototype.addRect = function(setNumber, u, v, x, y, w, h, animX, animY) {
    if (!this._rectData[setNumber]) {
        this._rectData[setNumber] = {
            positions: new Float32Array(1000 * 12),  // 1000 quads * 6 vertices * 2 components
            uvs: new Float32Array(1000 * 12),
            count: 0,
            capacity: 1000
        };
        this._animData[setNumber] = [];
    }

    var data = this._rectData[setNumber];
    var idx = data.count;

    // 용량 확장
    if (idx >= data.capacity) {
        var newCapacity = data.capacity * 2;
        var newPositions = new Float32Array(newCapacity * 6 * 2);
        newPositions.set(data.positions);
        data.positions = newPositions;
        var newUvs = new Float32Array(newCapacity * 6 * 2);
        newUvs.set(data.uvs);
        data.uvs = newUvs;
        data.capacity = newCapacity;
    }

    // 6 vertices (2 triangles) 위치 데이터
    var pi = idx * 12; // 6 vertices * 2 components
    // Triangle 1: top-left, top-right, bottom-left
    data.positions[pi]     = x;
    data.positions[pi + 1] = y;
    data.positions[pi + 2] = x + w;
    data.positions[pi + 3] = y;
    data.positions[pi + 4] = x;
    data.positions[pi + 5] = y + h;
    // Triangle 2: top-right, bottom-right, bottom-left
    data.positions[pi + 6]  = x + w;
    data.positions[pi + 7]  = y;
    data.positions[pi + 8]  = x + w;
    data.positions[pi + 9]  = y + h;
    data.positions[pi + 10] = x;
    data.positions[pi + 11] = y + h;

    // UV 데이터 (픽셀 좌표, 나중에 정규화)
    data.uvs[pi]     = u;
    data.uvs[pi + 1] = v;
    data.uvs[pi + 2] = u + w;
    data.uvs[pi + 3] = v;
    data.uvs[pi + 4] = u;
    data.uvs[pi + 5] = v + h;
    data.uvs[pi + 6]  = u + w;
    data.uvs[pi + 7]  = v;
    data.uvs[pi + 8]  = u + w;
    data.uvs[pi + 9]  = v + h;
    data.uvs[pi + 10] = u;
    data.uvs[pi + 11] = v + h;

    // 애니메이션 오프셋
    this._animData[setNumber].push(animX || 0, animY || 0);

    data.count++;
    this._needsRebuild = true;
};

/**
 * 축적된 쿼드 데이터로 Three.js 메시 빌드
 */
ThreeTilemapRectLayer.prototype._flush = function() {
    if (!this._needsRebuild) return;
    this._needsRebuild = false;

    // 부모에서 애니메이션 오프셋 가져오기
    var tileAnimX = 0, tileAnimY = 0;
    var p = this.parent;
    while (p) {
        if (p._tileAnimX !== undefined) {
            tileAnimX = p._tileAnimX;
            tileAnimY = p._tileAnimY;
            break;
        }
        p = p.parent;
    }

    // 기존 메시 숨기기
    for (var key in this._meshes) {
        this._meshes[key].visible = false;
    }

    for (var setNumber in this._rectData) {
        var data = this._rectData[setNumber];
        if (data.count === 0) continue;

        var sn = parseInt(setNumber);
        var isShadow = (sn === -1);

        // 텍스처 가져오기
        var texture = null;
        var texW = 1, texH = 1;
        if (!isShadow && this._bitmaps[sn]) {
            var bmp = this._bitmaps[sn];
            // PIXI 호환 텍스처 래퍼에서 Three.js 텍스처 추출
            if (bmp.baseTexture && bmp.baseTexture._threeTexture) {
                texture = bmp.baseTexture._threeTexture;
            } else if (bmp._threeTexture) {
                texture = bmp._threeTexture;
            } else if (bmp instanceof THREE.Texture) {
                texture = bmp;
            }
            if (texture && texture.image) {
                texW = texture.image.width || 1;
                texH = texture.image.height || 1;
            }
        }

        if (!isShadow && !texture) continue;

        // UV 정규화 + 애니메이션 적용
        var vertCount = data.count * 6;
        var posArray = new Float32Array(vertCount * 3);
        var uvArray = new Float32Array(vertCount * 2);
        var animOffsets = this._animData[setNumber] || [];

        for (var i = 0; i < data.count; i++) {
            var srcOff = i * 12;
            var posOff = i * 18; // 6 verts * 3 components
            var uvOff = i * 12;  // 6 verts * 2 components

            // 이 쿼드의 애니메이션 오프셋
            var ax = (animOffsets[i * 2] || 0) * tileAnimX;
            var ay = (animOffsets[i * 2 + 1] || 0) * tileAnimY;

            for (var j = 0; j < 6; j++) {
                // Position: x, y, z=0
                posArray[posOff + j * 3]     = data.positions[srcOff + j * 2];
                posArray[posOff + j * 3 + 1] = data.positions[srcOff + j * 2 + 1];
                posArray[posOff + j * 3 + 2] = 0;

                if (!isShadow) {
                    // UV: 픽셀→정규화, 애니메이션 오프셋 적용, flipY
                    uvArray[uvOff + j * 2]     = (data.uvs[srcOff + j * 2] + ax) / texW;
                    uvArray[uvOff + j * 2 + 1] = 1.0 - (data.uvs[srcOff + j * 2 + 1] + ay) / texH;
                }
            }
        }

        // BufferGeometry 빌드
        var geometry;
        var mesh = this._meshes[setNumber];

        if (mesh) {
            // 기존 geometry 재사용 (attribute 교체)
            geometry = mesh.geometry;
            geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
            if (!isShadow) {
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
            }
            geometry.attributes.position.needsUpdate = true;
            if (!isShadow && geometry.attributes.uv) {
                geometry.attributes.uv.needsUpdate = true;
            }
            mesh.visible = true;
        } else {
            // 새 geometry + mesh 생성
            geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
            if (!isShadow) {
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
            }

            var material;
            if (isShadow) {
                var sc = this._shadowColor;
                material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(sc[0], sc[1], sc[2]),
                    transparent: true,
                    opacity: sc[3],
                    depthTest: false,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
            } else {
                // NearestFilter 강제
                texture.minFilter = THREE.NearestFilter;
                texture.magFilter = THREE.NearestFilter;
                texture.generateMipmaps = false;
                texture.anisotropy = 1;

                material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    depthTest: false,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
            }

            mesh = new THREE.Mesh(geometry, material);
            this._meshes[setNumber] = mesh;
            this._threeObj.add(mesh);
        }

        // 텍스처 교체 (타일셋 로딩 완료 후 바뀔 수 있음)
        if (!isShadow && mesh.material.map !== texture) {
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
            texture.generateMipmaps = false;
            texture.anisotropy = 1;
            mesh.material.map = texture;
            mesh.material.needsUpdate = true;
        }
    }
};

ThreeTilemapRectLayer.prototype.syncTransform = function() {
    var obj = this._threeObj;
    obj.position.x = this._x;
    obj.position.y = this._y;
    obj.position.z = this._zIndex;
    obj.visible = this._visible;
    this._flush();
};

ThreeTilemapRectLayer.prototype.updateTransform = function(parentAlpha) {
    if (parentAlpha === undefined) parentAlpha = 1;
    this.worldAlpha = this._alpha * parentAlpha;
    this.worldVisible = this._visible;
    this.syncTransform();
};

// PIXI compat stubs
ThreeTilemapRectLayer.prototype.addChild = function() {};
ThreeTilemapRectLayer.prototype.removeChild = function() {};
ThreeTilemapRectLayer.prototype.removeChildren = function() { return []; };
ThreeTilemapRectLayer.prototype.getBounds = function() { return { x: 0, y: 0, width: 0, height: 0 }; };
ThreeTilemapRectLayer.prototype.renderWebGL = function() {};
ThreeTilemapRectLayer.prototype.renderCanvas = function() {};
ThreeTilemapRectLayer.prototype.destroy = function() {
    for (var key in this._meshes) {
        var m = this._meshes[key];
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
    }
    this._meshes = {};
    this._rectData = {};
    this._threeObj = null;
};


//=============================================================================
// ThreeTilemapCompositeLayer - CompositeRectTileLayer 호환
// children[0] = RectLayer, setBitmaps/shadowColor 관리
//=============================================================================

function ThreeTilemapCompositeLayer() {
    this._threeObj = new THREE.Group();
    this._threeObj._wrapper = this;

    this._x = 0;
    this._y = 0;
    this._alpha = 1;
    this._visible = true;
    this._zIndex = 0;
    this.worldAlpha = 1;
    this.worldVisible = true;
    this.parent = null;
    this._transformDirty = true;
    this._filters = null;

    this.scale = { x: 1, y: 1 };
    this.pivot = { x: 0, y: 0 };

    // RectLayer를 children[0]으로
    var rectLayer = new ThreeTilemapRectLayer();
    this.children = [rectLayer];
    rectLayer.parent = this;
    this._threeObj.add(rectLayer._threeObj);
}

Object.defineProperties(ThreeTilemapCompositeLayer.prototype, {
    x: {
        get: function() { return this._x; },
        set: function(v) { this._x = v; },
        configurable: true
    },
    y: {
        get: function() { return this._y; },
        set: function(v) { this._y = v; },
        configurable: true
    },
    alpha: {
        get: function() { return this._alpha; },
        set: function(v) { this._alpha = v; },
        configurable: true
    },
    visible: {
        get: function() { return this._visible; },
        set: function(v) { this._visible = v; this._threeObj.visible = v; },
        configurable: true
    },
    zIndex: {
        get: function() { return this._zIndex; },
        set: function(v) { this._zIndex = v; },
        configurable: true
    },
    shadowColor: {
        get: function() { return this.children[0]._shadowColor; },
        set: function(v) { this.children[0]._shadowColor = v; },
        configurable: true
    }
});

ThreeTilemapCompositeLayer.prototype.setBitmaps = function(bitmaps) {
    this.children[0].setBitmaps(bitmaps);
};

ThreeTilemapCompositeLayer.prototype.clear = function() {
    this.children[0].clear();
};

ThreeTilemapCompositeLayer.prototype.syncTransform = function() {
    var obj = this._threeObj;
    obj.position.x = this._x;
    obj.position.y = this._y;
    obj.position.z = this._zIndex;
    obj.visible = this._visible;
};

ThreeTilemapCompositeLayer.prototype.updateTransform = function(parentAlpha) {
    if (parentAlpha === undefined) parentAlpha = 1;
    this.worldAlpha = this._alpha * parentAlpha;
    this.worldVisible = this._visible;
    this.syncTransform();
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i].updateTransform) {
            this.children[i].updateTransform(this.worldAlpha);
        }
    }
};

// Stubs
ThreeTilemapCompositeLayer.prototype.addChild = function(child) {
    child.parent = this;
    this.children.push(child);
    if (child._threeObj) this._threeObj.add(child._threeObj);
    return child;
};
ThreeTilemapCompositeLayer.prototype.removeChild = function(child) {
    var idx = this.children.indexOf(child);
    if (idx >= 0) {
        this.children.splice(idx, 1);
        child.parent = null;
        if (child._threeObj) this._threeObj.remove(child._threeObj);
    }
    return child;
};
ThreeTilemapCompositeLayer.prototype.removeChildren = function() {
    var removed = this.children.slice();
    for (var i = 0; i < removed.length; i++) {
        removed[i].parent = null;
        if (removed[i]._threeObj) this._threeObj.remove(removed[i]._threeObj);
    }
    this.children.length = 0;
    return removed;
};
ThreeTilemapCompositeLayer.prototype.getBounds = function() { return { x: 0, y: 0, width: 0, height: 0 }; };
ThreeTilemapCompositeLayer.prototype.renderWebGL = function() {};
ThreeTilemapCompositeLayer.prototype.renderCanvas = function() {};
ThreeTilemapCompositeLayer.prototype.destroy = function() {
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i].destroy) this.children[i].destroy();
    }
    this.children.length = 0;
    this._threeObj = null;
};


//=============================================================================
// ThreeTilemapZLayer - ZLayer 호환 (ThreeContainer 기반)
// position.x/y로 스크롤 오프셋, z로 레이어 순서
//=============================================================================

function ThreeTilemapZLayer(zIndex) {
    this._threeObj = new THREE.Group();
    this._threeObj._wrapper = this;

    this._x = 0;
    this._y = 0;
    this._scaleX = 1;
    this._scaleY = 1;
    this._rotation = 0;
    this._pivotX = 0;
    this._pivotY = 0;
    this._alpha = 1;
    this._visible = true;
    this._zIndex = zIndex || 0;
    this.z = zIndex || 0;
    this.worldAlpha = 1;
    this.worldVisible = true;
    this.parent = null;
    this.children = [];
    this._filters = null;
    this._transformDirty = true;
    this.interactive = false;

    this.scale = this._createScaleProxy();
    this.pivot = this._createPivotProxy();

    // CompositeLayer 생성
    this._compositeLayer = new ThreeTilemapCompositeLayer();
    this.addChild(this._compositeLayer);
}

ThreeTilemapZLayer.prototype._createScaleProxy = ThreeContainer.prototype._createScaleProxy;
ThreeTilemapZLayer.prototype._createPivotProxy = ThreeContainer.prototype._createPivotProxy;

Object.defineProperties(ThreeTilemapZLayer.prototype, {
    x: {
        get: function() { return this._x; },
        set: function(v) { this._x = v; this._transformDirty = true; },
        configurable: true
    },
    y: {
        get: function() { return this._y; },
        set: function(v) { this._y = v; this._transformDirty = true; },
        configurable: true
    },
    rotation: {
        get: function() { return this._rotation; },
        set: function(v) { this._rotation = v; this._transformDirty = true; },
        configurable: true
    },
    alpha: {
        get: function() { return this._alpha; },
        set: function(v) { this._alpha = v; },
        configurable: true
    },
    visible: {
        get: function() { return this._visible; },
        set: function(v) { this._visible = v; this._threeObj.visible = v; },
        configurable: true
    },
    zIndex: {
        get: function() { return this._zIndex; },
        set: function(v) { this._zIndex = v; this._transformDirty = true; },
        configurable: true
    },
    filters: {
        get: function() { return this._filters; },
        set: function(v) { this._filters = v; },
        configurable: true
    }
});

// position proxy (ShaderTilemap이 zLayer.position.x = ... 으로 접근)
Object.defineProperty(ThreeTilemapZLayer.prototype, 'position', {
    get: function() {
        var self = this;
        return {
            get x() { return self._x; },
            set x(v) { self._x = v; self._transformDirty = true; },
            get y() { return self._y; },
            set y(v) { self._y = v; self._transformDirty = true; }
        };
    },
    configurable: true
});

ThreeTilemapZLayer.prototype.clear = function() {
    this._compositeLayer.clear();
};

ThreeTilemapZLayer.prototype.syncTransform = function() {
    var obj = this._threeObj;
    obj.position.x = this._x - this._pivotX;
    obj.position.y = this._y - this._pivotY;
    obj.position.z = this._zIndex;
    obj.scale.x = this._scaleX;
    obj.scale.y = this._scaleY;
    obj.rotation.z = -this._rotation;
    obj.visible = this._visible;
};

ThreeTilemapZLayer.prototype.updateTransform = function(parentAlpha) {
    if (parentAlpha === undefined) parentAlpha = 1;
    this.worldAlpha = this._alpha * parentAlpha;
    this.worldVisible = this._visible;
    this.syncTransform();
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i].updateTransform) {
            this.children[i].updateTransform(this.worldAlpha);
        }
    }
};

// Child management (ThreeContainer 호환)
ThreeTilemapZLayer.prototype.addChild = function(child) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    if (child._threeObj) this._threeObj.add(child._threeObj);
    return child;
};

ThreeTilemapZLayer.prototype.addChildAt = function(child, index) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.splice(index, 0, child);
    if (child._threeObj) this._threeObj.add(child._threeObj);
    return child;
};

ThreeTilemapZLayer.prototype.removeChild = function(child) {
    var idx = this.children.indexOf(child);
    if (idx >= 0) {
        this.children.splice(idx, 1);
        child.parent = null;
        if (child._threeObj) this._threeObj.remove(child._threeObj);
    }
    return child;
};

ThreeTilemapZLayer.prototype.removeChildren = function() {
    var removed = this.children.slice();
    for (var i = 0; i < removed.length; i++) {
        removed[i].parent = null;
        if (removed[i]._threeObj) this._threeObj.remove(removed[i]._threeObj);
    }
    this.children.length = 0;
    return removed;
};

ThreeTilemapZLayer.prototype.getChildIndex = function(child) {
    return this.children.indexOf(child);
};

ThreeTilemapZLayer.prototype.setChildIndex = function(child, index) {
    var cur = this.children.indexOf(child);
    if (cur >= 0) {
        this.children.splice(cur, 1);
        this.children.splice(index, 0, child);
    }
};

ThreeTilemapZLayer.prototype.getBounds = function() {
    return { x: this._x, y: this._y, width: 0, height: 0 };
};

ThreeTilemapZLayer.prototype.renderWebGL = function() {};
ThreeTilemapZLayer.prototype.renderCanvas = function() {};

ThreeTilemapZLayer.prototype.destroy = function() {
    if (this.parent) this.parent.removeChild(this);
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i].destroy) this.children[i].destroy();
    }
    this.children.length = 0;
    this._threeObj = null;
};
