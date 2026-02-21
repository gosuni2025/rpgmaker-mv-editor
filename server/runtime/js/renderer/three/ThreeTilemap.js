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

    // 애니메이션 오프셋 (ShaderTilemap._hackRenderer에서 설정)
    this._tileAnimX = 0;
    this._tileAnimY = 0;
    // 이전 프레임의 애니메이션 값 (변경 감지용)
    this._lastTileAnimX = 0;
    this._lastTileAnimY = 0;

    // animOffset 데이터 (setNumber별)
    this._animData = {};   // { setNumber: [] }  animX, animY per rect
    // A1 kind 데이터 (setNumber별)
    this._kindData = {};   // { setNumber: [] }  kind per rect (-1 = not A1)
    // 그리기 z 레이어 데이터 (setNumber별)
    this._drawZData = {};  // { setNumber: [] }  z layer per rect (0~3)
    this._currentDrawZ = 0;
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
    for (var key in this._kindData) {
        this._kindData[key].length = 0;
    }
    for (var key in this._drawZData) {
        this._drawZData[key].length = 0;
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
ThreeTilemapRectLayer.prototype.addRect = function(setNumber, u, v, x, y, w, h, animX, animY, a1Kind) {
    if (!this._rectData[setNumber]) {
        this._rectData[setNumber] = {
            positions: new Float32Array(1000 * 12),  // 1000 quads * 6 vertices * 2 components
            uvs: new Float32Array(1000 * 12),
            count: 0,
            capacity: 1000
        };
        this._animData[setNumber] = [];
        this._kindData[setNumber] = [];
        this._drawZData[setNumber] = [];
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
    // A1 kind 정보 (-1 = A1이 아님)
    this._kindData[setNumber].push(a1Kind != null ? a1Kind : -1);
    // 그리기 z 레이어 (0~3, _paintTiles에서 설정)
    this._drawZData[setNumber].push(this._currentDrawZ || 0);

    data.count++;
    this._needsRebuild = true;
};

/**
 * 축적된 쿼드 데이터로 Three.js 메시 빌드
 */
ThreeTilemapRectLayer.prototype._flush = function() {
    var tileAnimX = this._tileAnimX;
    var tileAnimY = this._tileAnimY;
    var animChanged = (tileAnimX !== this._lastTileAnimX || tileAnimY !== this._lastTileAnimY);

    // 물 메시 uTime은 매 프레임 갱신 (wave 연속 애니메이션)
    if (typeof ThreeWaterShader !== 'undefined') {
        for (var wk in this._meshes) {
            var wm = this._meshes[wk];
            if (wm && wm.userData && wm.userData.isWaterMesh) {
                ThreeWaterShader.updateTime(wm, ThreeWaterShader._time);
            }
        }
    }

    if (!this._needsRebuild && animChanged) {
        // 빠른 경로: 애니메이션 오프셋만 변경 → UV만 갱신
        this._lastTileAnimX = tileAnimX;
        this._lastTileAnimY = tileAnimY;
        this._updateAnimUVs(tileAnimX, tileAnimY);
        return;
    }

    if (!this._needsRebuild) return;
    this._needsRebuild = false;
    this._lastTileAnimX = tileAnimX;
    this._lastTileAnimY = tileAnimY;

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

        // NearestFilter 매 프레임 강제 (다른 곳에서 리셋될 수 있으므로)
        if (!isShadow && texture) {
            if (texture.minFilter !== THREE.NearestFilter ||
                texture.magFilter !== THREE.NearestFilter) {
                texture.minFilter = THREE.NearestFilter;
                texture.magFilter = THREE.NearestFilter;
                texture.generateMipmaps = false;
                texture.anisotropy = 1;
                texture.needsUpdate = true;
            }
        }

        // 물 rect와 일반 rect 분리
        var animOffsets = this._animData[setNumber] || [];
        var hasWater = false;
        var hasNormal = false;
        var _dbgWaterCount = 0;

        if (!isShadow && sn === 0 && typeof ThreeWaterShader !== 'undefined') {
            var kindArr = this._kindData[setNumber] || [];
            for (var ci = 0; ci < data.count; ci++) {
                var cAnimX = animOffsets[ci * 2] || 0;
                var cAnimY = animOffsets[ci * 2 + 1] || 0;
                var ck = kindArr[ci] != null ? kindArr[ci] : -1;
                // enabled=false인 kind는 일반 타일로 취급
                if (ThreeWaterShader.isWaterRect(cAnimX, cAnimY) &&
                    (ck < 0 || ThreeWaterShader.isKindEnabled(ck))) {
                    hasWater = true;
                    _dbgWaterCount++;
                } else {
                    hasNormal = true;
                }
            }
        } else {
            hasNormal = true;
        }

        // --- [진단] 물 타일 감지 결과 (최초 한 번만 출력) ---
        if (!ThreeTilemapRectLayer._dbgWaterChecked) {
            ThreeTilemapRectLayer._dbgWaterChecked = true;
            console.log('[Water診断] updateRect sn=' + sn + ' isShadow=' + isShadow +
                ' total=' + data.count + ' waterCount=' + _dbgWaterCount +
                ' hasWater=' + hasWater + ' hasNormal=' + hasNormal +
                ' ThreeWaterShader정의=' + (typeof ThreeWaterShader !== 'undefined'));
            if (animOffsets.length > 0) {
                console.log('[Water診断] 첫 rect animX=' + (animOffsets[0]||0) + ' animY=' + (animOffsets[1]||0));
            }
        }

        // --- 물 타일 메시 빌드 (일반 메시보다 먼저 → 낮은 renderOrder) ---
        if (hasWater) {
            this._buildWaterMesh(setNumber, data, animOffsets, texture, texW, texH,
                                  tileAnimX, tileAnimY);
        }

        // --- 일반 타일 메시 빌드 (물 메시 위에 렌더링) ---
        // drawZ가 혼합된 setNumber는 drawZ별로 별도 메시로 분리
        // (depthTest:false이므로 renderOrder만으로 순서 결정 → 메시 단위로 분리 필요)
        if (hasNormal) {
            var dzArr = this._drawZData[setNumber] || [];
            var dzSet = {};
            for (var dzi = 0; dzi < dzArr.length; dzi++) {
                dzSet[dzArr[dzi]] = true;
            }
            var uniqueDrawZs = Object.keys(dzSet).map(Number).sort();

            if (uniqueDrawZs.length <= 1) {
                // 단일 drawZ → 기존 방식으로 빌드
                this._buildNormalMesh(setNumber, data, animOffsets, texture, texW, texH,
                                      tileAnimX, tileAnimY, isShadow, hasWater,
                                      undefined, uniqueDrawZs[0] || 0);
            } else {
                // 복수 drawZ → drawZ별 별도 메시
                for (var dzu = 0; dzu < uniqueDrawZs.length; dzu++) {
                    var splitDrawZ = uniqueDrawZs[dzu];
                    this._buildNormalMesh(setNumber + '_z' + splitDrawZ, data, animOffsets,
                                          texture, texW, texH, tileAnimX, tileAnimY,
                                          isShadow, hasWater, splitDrawZ, splitDrawZ);
                }
            }
        }
    }
};

/**
 * 일반(비물) 타일 메시 빌드
 */
ThreeTilemapRectLayer.prototype._buildNormalMesh = function(setNumber, data, animOffsets,
        texture, texW, texH, tileAnimX, tileAnimY, isShadow, hasWater, filterDrawZ, maxDrawZ) {
    var sn = parseInt(setNumber);
    // split 키 (예: '6_z2')인 경우 원본 setNumber에서 drawZ 데이터 참조
    var origSetNumber = String(sn);

    // 물 rect를 제외한 일반 rect만 수집 (enabled=false인 kind는 일반으로 포함)
    // filterDrawZ가 지정되면 해당 drawZ만 포함
    var drawZArr = this._drawZData[origSetNumber] || [];
    var normalIndices = [];
    if (hasWater) {
        var kindArr = this._kindData[origSetNumber] || [];
        for (var ci = 0; ci < data.count; ci++) {
            if (filterDrawZ !== undefined && drawZArr[ci] !== filterDrawZ) continue;
            var cAnimX = animOffsets[ci * 2] || 0;
            var cAnimY = animOffsets[ci * 2 + 1] || 0;
            var ck = kindArr[ci] != null ? kindArr[ci] : -1;
            if (ThreeWaterShader.isWaterRect(cAnimX, cAnimY) &&
                (ck < 0 || ThreeWaterShader.isKindEnabled(ck))) {
                // 활성화된 물 rect → 물 메시에서 처리 → 스킵
            } else {
                normalIndices.push(ci);
            }
        }
    } else {
        for (var ci = 0; ci < data.count; ci++) {
            if (filterDrawZ !== undefined && drawZArr[ci] !== filterDrawZ) continue;
            normalIndices.push(ci);
        }
    }

    var normalCount = normalIndices.length;
    if (normalCount === 0) return;

    var vertCount = normalCount * 6;
    var posArray = new Float32Array(vertCount * 3);
    var normalArray = new Float32Array(vertCount * 3);
    var uvArray = new Float32Array(vertCount * 2);

    for (var ni = 0; ni < normalCount; ni++) {
        var i = normalIndices[ni];
        var srcOff = i * 12;
        var posOff = ni * 18;
        var uvOff = ni * 12;

        var ax = (animOffsets[i * 2] || 0) * tileAnimX;
        var ay = (animOffsets[i * 2 + 1] || 0) * tileAnimY;

        // 그리기 z 레이어 기반 z 오프셋: 높은 drawZ가 카메라에 더 가깝도록 양수
        // z=0→0.00, z=1→+0.001, z=2→+0.002, z=3→+0.003
        var drawZ = drawZArr[i] || 0;
        var elevationEnabled = $dataMap && $dataMap.tileLayerElevation;
        var _is3DZ = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d;
        var _drawZStep = (window.DepthDebugConfig && window.DepthDebugConfig.drawZStep) || 0.001;
        var zOffset = (_is3DZ || elevationEnabled) ? drawZ * _drawZStep : 0;

        for (var j = 0; j < 6; j++) {
            posArray[posOff + j * 3]     = data.positions[srcOff + j * 2];
            posArray[posOff + j * 3 + 1] = data.positions[srcOff + j * 2 + 1];
            posArray[posOff + j * 3 + 2] = zOffset;

            normalArray[posOff + j * 3]     = 0;
            normalArray[posOff + j * 3 + 1] = 0;
            normalArray[posOff + j * 3 + 2] = -1;

            if (!isShadow) {
                uvArray[uvOff + j * 2]     = (data.uvs[srcOff + j * 2] + ax) / texW;
                uvArray[uvOff + j * 2 + 1] = 1.0 - (data.uvs[srcOff + j * 2 + 1] + ay) / texH;
            }
        }
    }

    var needsPhong = !isShadow && (window.ShadowLight && window.ShadowLight._active);
    var mesh = this._meshes[setNumber];

    if (mesh) {
        var geometry = mesh.geometry;
        var posAttr = geometry.attributes.position;
        if (posAttr && posAttr.array.length === posArray.length) {
            posAttr.array.set(posArray);
            posAttr.needsUpdate = true;
        } else {
            geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        }
        var normAttr = geometry.attributes.normal;
        if (normAttr && normAttr.array.length === normalArray.length) {
            normAttr.array.set(normalArray);
            normAttr.needsUpdate = true;
        } else {
            geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
        }
        if (!isShadow) {
            var uvAttr = geometry.attributes.uv;
            if (uvAttr && uvAttr.array.length === uvArray.length) {
                uvAttr.array.set(uvArray);
                uvAttr.needsUpdate = true;
            } else {
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
            }
        }
        // material 타입 전환
        if (!isShadow) {
            var _is3D = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d;
            var _tc = (_is3D && window.DepthDebugConfig) ? window.DepthDebugConfig.tile : null;
            var _dTest = _tc ? _tc.depthTest : false;
            var _dWrite = _tc ? _tc.depthWrite : (_is3D ? true : false);
            var _aTest = _tc ? (_tc.alphaTest ? 0.5 : 0) : (_is3D ? 0.5 : 0);
            var _transp = _aTest > 0 ? false : true;
            var isPhong = mesh.material.isMeshPhongMaterial;
            if (needsPhong && !isPhong) {
                mesh.material.dispose();
                mesh.material = new THREE.MeshPhongMaterial({
                    map: texture,
                    transparent: _transp, alphaTest: _aTest,
                    depthTest: _dTest, depthWrite: _dWrite,
                    side: THREE.DoubleSide,
                    emissive: new THREE.Color(0x000000),
                    specular: new THREE.Color(0x000000), shininess: 0,
                });
                mesh.material.needsUpdate = true;
            } else if (!needsPhong && isPhong) {
                mesh.material.dispose();
                mesh.material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: _transp, alphaTest: _aTest,
                    depthTest: _dTest, depthWrite: _dWrite,
                    side: THREE.DoubleSide,
                });
                mesh.material.needsUpdate = true;
            } else {
                mesh.material.depthTest = _dTest;
                mesh.material.depthWrite = _dWrite;
                mesh.material.transparent = _transp;
                mesh.material.alphaTest = _aTest;
                mesh.material.needsUpdate = true;
            }
        }
        mesh.visible = true;
    } else {
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
        if (!isShadow) {
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
        }

        var material;
        if (isShadow) {
            var sc = this._shadowColor;
            var _sc = (window.DepthDebugConfig) ? window.DepthDebugConfig.shadow : null;
            material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(sc[0], sc[1], sc[2]),
                transparent: true, opacity: sc[3],
                depthTest: _sc ? _sc.depthTest : false, depthWrite: _sc ? _sc.depthWrite : false,
                side: THREE.DoubleSide,
            });
        } else {
            var _is3D = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d;
            var _tc2 = (_is3D && window.DepthDebugConfig) ? window.DepthDebugConfig.tile : null;
            var _dTest2 = _tc2 ? _tc2.depthTest : false;
            var _dWrite2 = _tc2 ? _tc2.depthWrite : (_is3D ? true : false);
            var _aTest2 = _tc2 ? (_tc2.alphaTest ? 0.5 : 0) : (_is3D ? 0.5 : 0);
            var _transp2 = _aTest2 > 0 ? false : true;
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
            texture.generateMipmaps = false;
            texture.anisotropy = 1;
            if (needsPhong) {
                material = new THREE.MeshPhongMaterial({
                    map: texture,
                    transparent: _transp2, alphaTest: _aTest2,
                    depthTest: _dTest2, depthWrite: _dWrite2,
                    side: THREE.DoubleSide,
                    emissive: new THREE.Color(0x000000),
                    specular: new THREE.Color(0x000000), shininess: 0,
                });
            } else {
                material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: _transp2, alphaTest: _aTest2,
                    depthTest: _dTest2, depthWrite: _dWrite2,
                    side: THREE.DoubleSide,
                });
            }
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        if (window.ShadowLight && window.ShadowLight._active && !isShadow) {
            mesh.receiveShadow = true;
            var parentZLayer = this.parent && this.parent.parent;
            if (parentZLayer && parentZLayer.z === 4) {
                mesh.castShadow = true;
                if (texture) {
                    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
                        depthPacking: THREE.RGBADepthPacking,
                        map: texture, alphaTest: 0.5, side: THREE.DoubleSide,
                    });
                }
            }
        }
        this._meshes[setNumber] = mesh;
        this._threeObj.add(mesh);
    }

    // drawZ 기반 renderOrder 정렬에 사용
    mesh.userData.maxDrawZ = (maxDrawZ !== undefined) ? maxDrawZ : 0;

    // 텍스처 교체 (타일셋 로딩 완료 후 바뀔 수 있음)
    if (!isShadow && mesh.material.map !== texture) {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = 1;
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
    }
};

/**
 * 물 타일 메시 빌드 (wave UV 왜곡 셰이더 적용)
 */
ThreeTilemapRectLayer.prototype._buildWaterMesh = function(setNumber, data, animOffsets,
        texture, texW, texH, tileAnimX, tileAnimY) {
    // kind별로 그룹핑하여 분리
    var kindGroups = {};  // { 'water_K': { indices: [], isWaterfall: false, kinds: [K] } }
    var kindArr = this._kindData[setNumber] || [];

    for (var ci = 0; ci < data.count; ci++) {
        var cAnimX = animOffsets[ci * 2] || 0;
        var cAnimY = animOffsets[ci * 2 + 1] || 0;
        if (!ThreeWaterShader.isWaterRect(cAnimX, cAnimY)) continue;

        // enabled=false인 kind는 물 셰이더 제외 (일반 메시로 렌더)
        var kind = kindArr[ci] != null ? kindArr[ci] : -1;
        if (kind >= 0 && !ThreeWaterShader.isKindEnabled(kind)) continue;

        var isWaterfall = ThreeWaterShader.isWaterfallRect(cAnimX, cAnimY);
        var groupKey = (isWaterfall ? 'wf' : 'w') + '_' + kind;

        if (!kindGroups[groupKey]) {
            kindGroups[groupKey] = { indices: [], isWaterfall: isWaterfall, kinds: kind >= 0 ? [kind] : [] };
        }
        kindGroups[groupKey].indices.push(ci);
        if (kind >= 0 && kindGroups[groupKey].kinds.indexOf(kind) < 0) {
            kindGroups[groupKey].kinds.push(kind);
        }
    }

    // --- [진단] 그룹핑 결과 ---
    var _gkList = Object.keys(kindGroups).map(function(k) {
        return k + '(' + kindGroups[k].indices.length + ')';
    }).join(', ');
    console.log('[Water診断] _buildWaterMesh 그룹: ' + (_gkList || '없음') +
        ' tileAnim=' + tileAnimX + 'x' + tileAnimY);

    for (var gk in kindGroups) {
        var group = kindGroups[gk];
        if (group.indices.length > 0) {
            this._buildWaterTypeMesh(setNumber, setNumber + '_' + gk, group.indices, data, animOffsets,
                                      texture, texW, texH, tileAnimX, tileAnimY,
                                      group.isWaterfall, group.kinds);
        }
    }
};

/**
 * 물/폭포 타일 메시 빌드 (공통)
 */
ThreeTilemapRectLayer.prototype._buildWaterTypeMesh = function(setNumber, meshKey, indices, data, animOffsets,
        texture, texW, texH, tileAnimX, tileAnimY, isWaterfall, a1Kinds) {
    var count = indices.length;
    // --- [진단] ---
    console.log('[Water診断] _buildWaterTypeMesh: key=' + meshKey +
        ' count=' + count + ' isWaterfall=' + isWaterfall +
        ' ShadowLight.active=' + (window.ShadowLight ? window.ShadowLight._active : 'undefined') +
        ' texture=' + (texture ? (texture.image ? 'OK' : 'noImage') : 'NULL') +
        ' texSize=' + texW + 'x' + texH);
    var vertCount = count * 6;
    var posArray = new Float32Array(vertCount * 3);
    var normalArray = new Float32Array(vertCount * 3);
    var uvArray = new Float32Array(vertCount * 2);
    var uvBoundsArray = new Float32Array(vertCount * 4); // vec4(uMin, vMin, uMax, vMax)

    for (var ni = 0; ni < count; ni++) {
        var i = indices[ni];
        var srcOff = i * 12;
        var posOff = ni * 18;
        var uvOff = ni * 12;
        var boundsOff = ni * 24; // 6 verts * 4 components

        var ax = (animOffsets[i * 2] || 0) * tileAnimX;
        var ay = (animOffsets[i * 2 + 1] || 0) * tileAnimY;

        // 쿼드의 UV 바운드 계산 (6개 버텍스 중 min/max)
        var uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
        for (var j = 0; j < 6; j++) {
            var u = (data.uvs[srcOff + j * 2] + ax) / texW;
            var v = 1.0 - (data.uvs[srcOff + j * 2 + 1] + ay) / texH;
            uvArray[uvOff + j * 2] = u;
            uvArray[uvOff + j * 2 + 1] = v;
            if (u < uMin) uMin = u;
            if (u > uMax) uMax = u;
            if (v < vMin) vMin = v;
            if (v > vMax) vMax = v;
        }
        // 텍셀 절반만큼 안쪽으로 수축하여 인접 타일 샘플링 방지
        var halfTexelU = 0.5 / texW;
        var halfTexelV = 0.5 / texH;
        uMin += halfTexelU;
        uMax -= halfTexelU;
        vMin += halfTexelV;
        vMax -= halfTexelV;
        // 모든 버텍스에 동일한 바운드 할당
        // 물 타일은 drawZ 기반 z 오프셋 적용 (높은 drawZ가 카메라에 더 가깝도록 양수)
        var drawZArr = this._drawZData[setNumber] || [];
        var drawZ = drawZArr[i] || 0;
        var elevationEnabled = $dataMap && $dataMap.tileLayerElevation;
        var _is3DZ = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d;
        var _drawZStep = (window.DepthDebugConfig && window.DepthDebugConfig.drawZStep) || 0.001;
        var zOffset = (_is3DZ || elevationEnabled) ? drawZ * _drawZStep : 0;
        for (var j = 0; j < 6; j++) {
            posArray[posOff + j * 3]     = data.positions[srcOff + j * 2];
            posArray[posOff + j * 3 + 1] = data.positions[srcOff + j * 2 + 1];
            posArray[posOff + j * 3 + 2] = zOffset;

            normalArray[posOff + j * 3]     = 0;
            normalArray[posOff + j * 3 + 1] = 0;
            normalArray[posOff + j * 3 + 2] = -1;

            uvBoundsArray[boundsOff + j * 4]     = uMin;
            uvBoundsArray[boundsOff + j * 4 + 1] = vMin;
            uvBoundsArray[boundsOff + j * 4 + 2] = uMax;
            uvBoundsArray[boundsOff + j * 4 + 3] = vMax;
        }
    }

    var needsPhong = (window.ShadowLight && window.ShadowLight._active);
    var mesh = this._meshes[meshKey];
    // kind별 설정 조회
    var kindSettings = null;
    if (a1Kinds && a1Kinds.length > 0 && a1Kinds[0] >= 0) {
        kindSettings = ThreeWaterShader.getUniformsForKind(a1Kinds[0]);
    }

    if (mesh) {
        var geometry = mesh.geometry;
        // geometry attribute 갱신
        var posAttr = geometry.attributes.position;
        if (posAttr && posAttr.array.length === posArray.length) {
            posAttr.array.set(posArray);
            posAttr.needsUpdate = true;
        } else {
            geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        }
        var normAttr = geometry.attributes.normal;
        if (normAttr && normAttr.array.length === normalArray.length) {
            normAttr.array.set(normalArray);
            normAttr.needsUpdate = true;
        } else {
            geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
        }
        var uvAttr = geometry.attributes.uv;
        if (uvAttr && uvAttr.array.length === uvArray.length) {
            uvAttr.array.set(uvArray);
            uvAttr.needsUpdate = true;
        } else {
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
        }
        var boundsAttr = geometry.attributes.aUvBounds;
        if (boundsAttr && boundsAttr.array.length === uvBoundsArray.length) {
            boundsAttr.array.set(uvBoundsArray);
            boundsAttr.needsUpdate = true;
        } else {
            geometry.setAttribute('aUvBounds', new THREE.BufferAttribute(uvBoundsArray, 4));
        }

        // material 타입 전환 (ShadowLight 상태에 따라)
        // DepthDebugConfig.water는 3D 모드에서만 적용 (2D 모드는 기본값: transparent=true, depthTest=false)
        var _isWater3D = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d;
        var _wc = (_isWater3D && window.DepthDebugConfig) ? window.DepthDebugConfig.water : null;
        var _wDT = _wc ? _wc.depthTest : false;
        var _wDW = _wc ? _wc.depthWrite : false;
        var _wAT = (_wc && _wc.alphaTest) ? 0.5 : 0;
        var _wTr = _wAT > 0 ? false : true;
        var isPhong = mesh.material.isMeshPhongMaterial;
        var isShader = mesh.material.isShaderMaterial;
        if (needsPhong && !isPhong) {
            mesh.material.dispose();
            var mat = new THREE.MeshPhongMaterial({
                map: texture,
                transparent: _wTr, alphaTest: _wAT,
                depthTest: _wDT, depthWrite: _wDW,
                side: THREE.DoubleSide,
                emissive: new THREE.Color(0x000000),
                specular: new THREE.Color(0x000000), shininess: 0,
            });
            ThreeWaterShader.applyToPhongMaterial(mat, isWaterfall, kindSettings);
            mesh.material = mat;
            mesh.material.needsUpdate = true;
        } else if (!needsPhong && (isPhong || !isShader)) {
            mesh.material.dispose();
            mesh.material = ThreeWaterShader.createStandaloneMaterial(texture, isWaterfall, kindSettings);
            mesh.material.needsUpdate = true;
        }

        mesh.visible = true;
    } else {
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
        geometry.setAttribute('aUvBounds', new THREE.BufferAttribute(uvBoundsArray, 4));

        var material;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = 1;

        // DepthDebugConfig.water는 3D 모드에서만 적용 (2D 모드는 기본값: transparent=true, depthTest=false)
        var _isWater3D2 = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d;
        var _wc2 = (_isWater3D2 && window.DepthDebugConfig) ? window.DepthDebugConfig.water : null;
        var _wDT2 = _wc2 ? _wc2.depthTest : false;
        var _wDW2 = _wc2 ? _wc2.depthWrite : false;
        var _wAT2 = (_wc2 && _wc2.alphaTest) ? 0.5 : 0;
        var _wTr2 = _wAT2 > 0 ? false : true;
        if (needsPhong) {
            material = new THREE.MeshPhongMaterial({
                map: texture,
                transparent: _wTr2, alphaTest: _wAT2,
                depthTest: _wDT2, depthWrite: _wDW2,
                side: THREE.DoubleSide,
                emissive: new THREE.Color(0x000000),
                specular: new THREE.Color(0x000000), shininess: 0,
            });
            ThreeWaterShader.applyToPhongMaterial(material, isWaterfall, kindSettings);
        } else {
            material = ThreeWaterShader.createStandaloneMaterial(texture, isWaterfall, kindSettings);
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = -1;  // 물은 다른 타일보다 먼저 렌더 (투명도 때문)
        // 물 타일은 receiveShadow 비활성 (shadow acne로 검은 구멍 아티팩트 방지)
        this._meshes[meshKey] = mesh;
        this._threeObj.add(mesh);
        console.log('[Water診断] 새 메시 생성: key=' + meshKey +
            ' matType=' + (material.isShaderMaterial ? 'ShaderMaterial' : material.type) +
            ' transparent=' + material.transparent + ' depthTest=' + material.depthTest +
            ' alphaTest=' + material.alphaTest + ' renderOrder=' + mesh.renderOrder +
            ' mapUniform=' + (material.isShaderMaterial && material.uniforms && material.uniforms.map ?
                (material.uniforms.map.value ? 'SET' : 'NULL') : 'N/A'));
    }

    // 텍스처 교체
    if (mesh.material.isShaderMaterial) {
        if (mesh.material.uniforms.map && mesh.material.uniforms.map.value !== texture) {
            mesh.material.uniforms.map.value = texture;
            mesh.material.needsUpdate = true;
        }
    } else if (mesh.material.map !== texture) {
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = 1;
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
    }

    // uTime uniform 업데이트
    ThreeWaterShader.updateTime(mesh, ThreeWaterShader._time);
    // 물 메시 키 저장 (renderLoop에서 time 업데이트용)
    mesh.userData.isWaterMesh = true;
    mesh.userData.isWaterfall = isWaterfall;
    mesh.userData.a1Kinds = a1Kinds || [];
    ThreeWaterShader._hasWaterMesh = true;
};

/**
 * 애니메이션 오프셋 변경 시 UV attribute만 갱신 (전체 재빌드 없이)
 */
ThreeTilemapRectLayer.prototype._updateAnimUVs = function(tileAnimX, tileAnimY) {
    for (var setNumber in this._rectData) {
        var data = this._rectData[setNumber];
        if (data.count === 0) continue;

        var sn = parseInt(setNumber);
        if (sn === -1) continue; // 그림자는 애니메이션 없음

        var animOffsets = this._animData[setNumber] || [];

        // 물 rect가 있는 경우 분리 처리
        var hasWater = false;
        var kindArr = this._kindData[setNumber] || [];
        if (sn === 0 && typeof ThreeWaterShader !== 'undefined') {
            for (var ci = 0; ci < data.count; ci++) {
                var ck = kindArr[ci] != null ? kindArr[ci] : -1;
                if (ThreeWaterShader.isWaterRect(animOffsets[ci * 2] || 0, animOffsets[ci * 2 + 1] || 0) &&
                    (ck < 0 || ThreeWaterShader.isKindEnabled(ck))) {
                    hasWater = true;
                    break;
                }
            }
        }

        // 텍스처 크기 가져오기 (일반 메시에서)
        var texW = 1, texH = 1;
        var normalMesh = this._meshes[setNumber];
        if (normalMesh && normalMesh.material) {
            var tex = normalMesh.material.map || (normalMesh.material.uniforms && normalMesh.material.uniforms.map && normalMesh.material.uniforms.map.value);
            if (tex && tex.image) {
                texW = tex.image.width || 1;
                texH = tex.image.height || 1;
            }
        }

        // 일반 메시 UV 업데이트
        if (normalMesh && normalMesh.geometry) {
            var uvAttr = normalMesh.geometry.attributes.uv;
            if (uvAttr) {
                var uvArray = uvAttr.array;
                if (hasWater) {
                    // 물 rect를 제외한 인덱스로 UV 갱신 (enabled=false인 kind는 일반으로 포함)
                    var ni = 0;
                    for (var i = 0; i < data.count; i++) {
                        var cka = kindArr[i] != null ? kindArr[i] : -1;
                        if (ThreeWaterShader.isWaterRect(animOffsets[i * 2] || 0, animOffsets[i * 2 + 1] || 0) &&
                            (cka < 0 || ThreeWaterShader.isKindEnabled(cka))) continue;
                        var srcOff = i * 12;
                        var uvOff = ni * 12;
                        var ax = (animOffsets[i * 2] || 0) * tileAnimX;
                        var ay = (animOffsets[i * 2 + 1] || 0) * tileAnimY;
                        for (var j = 0; j < 6; j++) {
                            uvArray[uvOff + j * 2]     = (data.uvs[srcOff + j * 2] + ax) / texW;
                            uvArray[uvOff + j * 2 + 1] = 1.0 - (data.uvs[srcOff + j * 2 + 1] + ay) / texH;
                        }
                        ni++;
                    }
                } else {
                    for (var i = 0; i < data.count; i++) {
                        var srcOff = i * 12;
                        var uvOff = i * 12;
                        var ax = (animOffsets[i * 2] || 0) * tileAnimX;
                        var ay = (animOffsets[i * 2 + 1] || 0) * tileAnimY;
                        for (var j = 0; j < 6; j++) {
                            uvArray[uvOff + j * 2]     = (data.uvs[srcOff + j * 2] + ax) / texW;
                            uvArray[uvOff + j * 2 + 1] = 1.0 - (data.uvs[srcOff + j * 2 + 1] + ay) / texH;
                        }
                    }
                }
                uvAttr.needsUpdate = true;
            }
        }

        // 물 메시 UV 업데이트 (kind별 분리된 메시)
        if (hasWater) {
            var kindArr = this._kindData[setNumber] || [];
            // kind별 그룹 키 목록 수집
            for (var mkey in this._meshes) {
                // setNumber + '_w_' 또는 '_wf_' 패턴 매칭
                var prefix = setNumber + '_';
                if (mkey.indexOf(prefix + 'w_') !== 0 && mkey.indexOf(prefix + 'wf_') !== 0) continue;
                var wMesh = this._meshes[mkey];
                if (!wMesh || !wMesh.geometry) continue;
                var wUvAttr = wMesh.geometry.attributes.uv;
                if (!wUvAttr) continue;

                var wTex = wMesh.material.map || (wMesh.material.uniforms && wMesh.material.uniforms.map && wMesh.material.uniforms.map.value);
                if (wTex && wTex.image) {
                    texW = wTex.image.width || 1;
                    texH = wTex.image.height || 1;
                }

                var meshKinds = wMesh.userData.a1Kinds || [];
                var meshIsWF = wMesh.userData.isWaterfall;
                var wUvArray = wUvAttr.array;
                var wBoundsAttr = wMesh.geometry.attributes.aUvBounds;
                var wBoundsArray = wBoundsAttr ? wBoundsAttr.array : null;
                var halfTexelU = 0.5 / texW;
                var halfTexelV = 0.5 / texH;
                var wi = 0;
                for (var i = 0; i < data.count; i++) {
                    var cAx = animOffsets[i * 2] || 0;
                    var cAy = animOffsets[i * 2 + 1] || 0;
                    if (!ThreeWaterShader.isWaterRect(cAx, cAy)) continue;
                    var isThisWF = ThreeWaterShader.isWaterfallRect(cAx, cAy);
                    if (isThisWF !== meshIsWF) continue;
                    var ck = kindArr[i] != null ? kindArr[i] : -1;
                    if (meshKinds.length > 0 && meshKinds.indexOf(ck) < 0) continue;

                    var srcOff = i * 12;
                    var uvOff = wi * 12;
                    var boundsOff = wi * 24;
                    var ax = cAx * tileAnimX;
                    var ay = cAy * tileAnimY;
                    var uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
                    for (var j = 0; j < 6; j++) {
                        var u = (data.uvs[srcOff + j * 2] + ax) / texW;
                        var v = 1.0 - (data.uvs[srcOff + j * 2 + 1] + ay) / texH;
                        wUvArray[uvOff + j * 2]     = u;
                        wUvArray[uvOff + j * 2 + 1] = v;
                        if (u < uMin) uMin = u;
                        if (u > uMax) uMax = u;
                        if (v < vMin) vMin = v;
                        if (v > vMax) vMax = v;
                    }
                    if (wBoundsArray) {
                        uMin += halfTexelU; uMax -= halfTexelU;
                        vMin += halfTexelV; vMax -= halfTexelV;
                        for (var j = 0; j < 6; j++) {
                            wBoundsArray[boundsOff + j * 4]     = uMin;
                            wBoundsArray[boundsOff + j * 4 + 1] = vMin;
                            wBoundsArray[boundsOff + j * 4 + 2] = uMax;
                            wBoundsArray[boundsOff + j * 4 + 3] = vMax;
                        }
                    }
                    wi++;
                }
                wUvAttr.needsUpdate = true;
                if (wBoundsAttr) wBoundsAttr.needsUpdate = true;
                ThreeWaterShader.updateTime(wMesh, ThreeWaterShader._time);
            }
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
    var elevationEnabled = $dataMap && $dataMap.tileLayerElevation;
    obj.position.z = elevationEnabled ? this._zIndex : 0;
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
