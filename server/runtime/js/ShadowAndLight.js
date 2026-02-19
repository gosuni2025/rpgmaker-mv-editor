//=============================================================================
// ShadowAndLight.js - Three.js 3D Shadow & Lighting System
//=============================================================================
// 캐릭터/이벤트 스프라이트에 실제 3D 그림자와 광원 효과를 적용합니다.
//
// - 그림자: DirectionalLight 방향 기반 planar shadow projection
//   (캐릭터 메시를 바닥 평면에 투영한 별도 shadow mesh)
// - 광원: DirectionalLight + AmbientLight + PointLight(캐릭터/이벤트)
//   material을 MeshLambertMaterial로 교체하여 실제 3D 조명을 받음
//   (MeshStandardMaterial은 타일맵 텍스처와 호환 문제가 있어 Lambert 사용)
//
// 게임 옵션에서 ON/OFF 가능
//=============================================================================

(function() {

//=============================================================================
// Three.js ShaderChunk 글로벌 패치: Y-flip 라이팅 수정
//=============================================================================
// Mode3D._positionCamera()에서 projectionMatrix m[5]=-m[5] (Y-flip)를 적용하면
// gl_FrontFacing이 반전됨 → DOUBLE_SIDED 셰이더에서 faceDirection이 잘못 계산되어
// 노멀이 이중 반전되고 빛 방향이 거꾸로 되는 문제 수정.
//
// 해결: faceDirection을 항상 1.0으로 강제하고, Lambert 셰이더의
// gl_FrontFacing 기반 분기를 우회하여 양면 라이팅을 균일하게 적용.
//=============================================================================
if (typeof THREE !== 'undefined' && THREE.ShaderChunk) {
    // 1) normal_fragment_begin: faceDirection을 항상 1.0으로 강제
    (function() {
        var key = 'normal_fragment_begin';
        var chunk = THREE.ShaderChunk[key];
        if (chunk) {
            var orig = 'float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;';
            if (chunk.indexOf(orig) >= 0) {
                THREE.ShaderChunk[key] = chunk.replace(orig, 'float faceDirection = 1.0;');
                console.log('[ShadowLight] ShaderChunk patched: normal_fragment_begin (faceDirection=1.0)');
            }
        }
    })();

    // 2) Lambert pars fragment: dotNL을 abs()로 감싸서 Y-flip에서도 양면 라이팅
    //    (r160에서 Lambert가 fragment-based lighting으로 변경됨, lights_lambert_vertex 제거됨)
    (function() {
        var key = 'lights_lambert_pars_fragment';
        var chunk = THREE.ShaderChunk[key];
        if (chunk) {
            var orig = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
            var patched = 'float dotNL = saturate( abs( dot( geometryNormal, directLight.direction ) ) );';
            if (chunk.indexOf(orig) >= 0) {
                THREE.ShaderChunk[key] = chunk.replace(orig, patched);
                console.log('[ShadowLight] ShaderChunk patched: lights_lambert_pars_fragment (abs dotNL)');
            }
        }
    })();

    // 3) Phong pars fragment: dotNL을 abs()로 감싸서 Y-flip에서도 양면 라이팅
    //    (r160에서 geometry.normal → geometryNormal로 변경됨)
    (function() {
        var key = 'lights_phong_pars_fragment';
        var chunk = THREE.ShaderChunk[key];
        if (chunk) {
            var orig = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
            var patched = 'float dotNL = saturate( abs( dot( geometryNormal, directLight.direction ) ) );';
            if (chunk.indexOf(orig) >= 0) {
                THREE.ShaderChunk[key] = chunk.replace(orig, patched);
                console.log('[ShadowLight] ShaderChunk patched: lights_phong_pars_fragment (abs dotNL)');
            }
        }
    })();
}

//=============================================================================
// ConfigManager - 그림자/광원 설정 추가
//=============================================================================

ConfigManager.shadowLight = true;

var _ConfigManager_makeData = ConfigManager.makeData;
ConfigManager.makeData = function() {
    var config = _ConfigManager_makeData.call(this);
    config.shadowLight = this.shadowLight;
    return config;
};

var _ConfigManager_applyData = ConfigManager.applyData;
ConfigManager.applyData = function(config) {
    _ConfigManager_applyData.call(this, config);
    this.shadowLight = this.readFlag(config, 'shadowLight');
};

//=============================================================================
// ShadowLight 시스템 관리
//=============================================================================

var ShadowLight = {};
window.ShadowLight = ShadowLight;

ShadowLight._active = false;
ShadowLight._spriteset = null;
ShadowLight._scene = null;         // 에디터에서 직접 설정 가능한 scene 레퍼런스

// 3D 조명 오브젝트
ShadowLight._directionalLight = null;
ShadowLight._ambientLight = null;
ShadowLight._pointLights = [];       // 동적 포인트 라이트 풀
ShadowLight._pointLightIndex = 0;    // 현재 프레임 사용 인덱스

// 플레이어 SpotLight (방향성 그림자용)
ShadowLight._playerSpotLight = null;
ShadowLight._playerSpotTarget = null;

// 그림자
ShadowLight._shadowMeshes = [];      // 캐릭터별 shadow mesh
ShadowLight._shadowMaterial = null;

/**
 * Three.js Scene을 찾는 헬퍼
 * Graphics._rendererObj가 없는 에디터 환경에서도 tilemap의 parent chain을 따라 Scene을 찾음
 */
ShadowLight._findScene = function() {
    var rendererObj = Graphics._rendererObj || Graphics._renderer;
    if (rendererObj && rendererObj.scene) return rendererObj.scene;
    // fallback 1: 에디터에서 직접 설정한 scene 레퍼런스
    if (this._scene) return this._scene;
    // fallback 2: spriteset의 tilemap에서 parent chain 따라 올라가기
    if (this._spriteset && this._spriteset._tilemap && this._spriteset._tilemap._threeObj) {
        var obj = this._spriteset._tilemap._threeObj;
        while (obj.parent) obj = obj.parent;
        if (obj.isScene) return obj;
    }
    return null;
};

// 설정
ShadowLight.config = {
    // 광원 설정
    ambientColor: 0x667788,           // 환경광 (어두운 푸른 톤 - 달빛 느낌)
    ambientIntensity: 0.35,
    directionalColor: 0xfff8ee,       // 햇빛 색상 (따뜻한 톤)
    directionalIntensity: 0.3,
    lightDirection: new THREE.Vector3(-1, -1, -2).normalize(), // 광원 방향 (Z 성분 크게)

    // 플레이어 포인트 라이트
    playerLightEnabled: true,
    playerLightColor: 0xa25f06,       // 횃불 색상
    playerLightIntensity: 0.8,
    playerLightDistance: 200,          // 범위 (pixel 단위, decay=0에서 이 범위 밖은 영향 없음)
    playerLightZ: 40,                 // 높이

    // 플레이어 SpotLight (방향성 그림자)
    spotLightEnabled: true,
    spotLightColor: 0xffeedd,         // 손전등 색상 (따뜻한 백색)
    spotLightIntensity: 0.8,
    spotLightDistance: 250,            // 비추는 범위
    spotLightAngle: 0.60,             // 원뿔 반각 (약 34도)
    spotLightPenumbra: 0.9,           // 가장자리 부드러움 (0~1)
    spotLightZ: 120,                  // 높이
    spotLightShadowMapSize: 2048,     // 그림자 맵 해상도
    spotLightTargetDistance: 70,      // target까지의 거리 (플레이어 앞)

    // 오브젝트 레이어 (upperZLayer) 높이
    upperLayerZ: 24,                  // PointLight(z=30)와 가까워지도록 상승

    // 그림자 설정
    shadowOpacity: 0.4,
    shadowColor: 0x000000,
    shadowOffsetScale: 0.6,           // 광원 방향에 따른 오프셋 스케일
    shadowRadius: 1,                  // 실시간 그림자 블러 반경
    shadowMapSize: 2048,              // 디렉셔널 그림자 맵 해상도
    shadowBias: -0.001,
    shadowNear: 1,
    shadowFar: 5000,

    // 프록시 박스 라이팅
    probeEmissiveFactor: 0.3,          // 측면 라이팅 강도 (0~1)
};

//=============================================================================
// Material 교체 시스템
// MeshBasicMaterial -> MeshLambertMaterial (조명 영향을 받도록)
//=============================================================================

ShadowLight._convertedMaterials = new WeakMap();

/**
 * castShadow 메시의 customDepthMaterial.map을 현재 material.map과 동기화
 * (텍스처 로드/교체 후 customDepthMaterial.map이 stale해지는 것 방지)
 */
ShadowLight._syncCustomDepthMaps = function(sprites) {
    if (!sprites) return;
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (!sprite || !sprite._threeObj) continue;
        var obj = sprite._threeObj;
        if (obj.castShadow && obj.customDepthMaterial && sprite._material &&
            sprite._material.map && obj.customDepthMaterial.map !== sprite._material.map) {
            obj.customDepthMaterial.map = sprite._material.map;
            obj.customDepthMaterial.needsUpdate = true;
        }
        // 오브젝트 컨테이너의 자식도 동기화
        if (sprite.children) {
            for (var j = 0; j < sprite.children.length; j++) {
                var child = sprite.children[j];
                if (child && child._threeObj && child._threeObj.castShadow &&
                    child._threeObj.customDepthMaterial && child._material &&
                    child._material.map && child._threeObj.customDepthMaterial.map !== child._material.map) {
                    child._threeObj.customDepthMaterial.map = child._material.map;
                    child._threeObj.customDepthMaterial.needsUpdate = true;
                }
            }
        }
    }
};

/**
 * MeshBasicMaterial을 MeshPhongMaterial로 교체
 * 기존 텍스처, 투명도, 블렌딩 등 속성을 모두 유지
 */
ShadowLight._convertMaterial = function(sprite) {
    if (!sprite || !sprite._material) return;
    if (sprite._material.isMeshPhongMaterial) return;
    if (this._convertedMaterials.has(sprite._material)) return;

    var oldMat = sprite._material;
    var newMat = new THREE.MeshPhongMaterial({
        map: oldMat.map,
        transparent: false,
        alphaTest: 0.5,
        depthTest: true,
        depthWrite: true,
        side: oldMat.side,
        opacity: oldMat.opacity,
        blending: oldMat.blending,
        emissive: new THREE.Color(0x000000),
        specular: new THREE.Color(0x000000),  // 반사광 없음
        shininess: 0,
    });
    newMat.visible = oldMat.visible;
    newMat.needsUpdate = true;

    // 양면 라이팅은 editor-runtime-bootstrap.js에서 ShaderChunk 글로벌 패치로 적용됨

    // Mesh에 새 material 적용
    sprite._threeObj.material = newMat;
    sprite._material = newMat;

    // Shadow Map: 캐릭터가 그림자를 드리우도록 설정
    sprite._threeObj.castShadow = true;
    // customDepthMaterial: alpha-tested shadow silhouette (스프라이트 모양대로 그림자)
    sprite._threeObj.customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: newMat.map,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
    });

    this._convertedMaterials.set(newMat, true);

    // anchorY shader clipping: material 교체 후에도 유지
    if (sprite._needsAnchorClip) {
        newMat.onBeforeCompile = function(shader) {
            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                'varying float vLocalY;\nvoid main() {\n  vLocalY = position.y;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                'varying float vLocalY;\nvoid main() {\n  if (vLocalY > 0.0) discard;'
            );
        };
        newMat.customProgramCacheKey = function() {
            return 'mapobj-clip-anchor-phong';
        };
        newMat.needsUpdate = true;
        // customDepthMaterial에도 clipping 적용 (그림자도 잘리도록)
        if (sprite._threeObj.customDepthMaterial) {
            var depthMat = sprite._threeObj.customDepthMaterial;
            depthMat.onBeforeCompile = function(shader) {
                shader.vertexShader = shader.vertexShader.replace(
                    'void main() {',
                    'varying float vLocalY;\nvoid main() {\n  vLocalY = position.y;'
                );
                shader.fragmentShader = shader.fragmentShader.replace(
                    'void main() {',
                    'varying float vLocalY;\nvoid main() {\n  if (vLocalY > 0.0) discard;'
                );
            };
            depthMat.customProgramCacheKey = function() {
                return 'mapobj-clip-anchor-depth';
            };
            depthMat.needsUpdate = true;
        }
    }
};

//=============================================================================
// 프록시 박스 라이팅: CPU 기반 6방향 법선 라이트 프로빙
// 빌보드 평면은 정면 법선만 있어 측면/후면 조명을 못 받는 문제를 해결.
// 캐릭터 위치에서 가상의 박스 6면 법선으로 라이트 기여도를 CPU에서 계산하고,
// 정면 외 방향의 추가 조명을 material.emissive에 반영한다.
//=============================================================================

ShadowLight._probeNormals = [
    new THREE.Vector3( 1,  0,  0),  // +X (오른쪽)
    new THREE.Vector3(-1,  0,  0),  // -X (왼쪽)
    new THREE.Vector3( 0,  1,  0),  // +Y (아래, 화면 좌표계)
    new THREE.Vector3( 0, -1,  0),  // -Y (위)
    new THREE.Vector3( 0,  0, -1),  // -Z (뒤쪽)
    // +Z (정면)는 Phong이 이미 처리하므로 제외
];

// 재사용할 임시 벡터
ShadowLight._tmpVec3 = new THREE.Vector3();
ShadowLight._tmpVec3b = new THREE.Vector3();
ShadowLight._tmpVec3c = new THREE.Vector3();
ShadowLight._tmpColor = new THREE.Color();
ShadowLight._tmpWorldPos = new THREE.Vector3();
ShadowLight._tmpLocalPos = new THREE.Vector3();
ShadowLight._tmpMatrix4 = new THREE.Matrix4();

/**
 * 캐릭터/오브젝트 스프라이트들의 프록시 박스 라이팅 업데이트
 * @param {Array} sprites - Sprite_Character 또는 오브젝트 스프라이트 배열
 * @param {Boolean} includeChildren - true이면 container의 자식도 처리 (오브젝트용)
 */
ShadowLight._updateProxyBoxLighting = function(sprites, includeChildren) {
    if (!sprites) return;

    // 이미 관리 중인 라이트 레퍼런스를 직접 사용 (scene.traverse 비용 회피)
    var lights = [];
    if (this._directionalLight && this._directionalLight.visible) {
        lights.push(this._directionalLight);
    }
    if (this._playerSpotLight && this._playerSpotLight.visible) {
        lights.push(this._playerSpotLight);
    }
    for (var pi = 0; pi < this._pointLights.length; pi++) {
        if (this._pointLights[pi].visible) {
            lights.push(this._pointLights[pi]);
        }
    }
    if (lights.length === 0) return;

    var normals = this._probeNormals;
    var allNormals = this._probeNormalsAll;
    var tmpDir = this._tmpVec3;
    var tmpColor = this._tmpColor;
    var isDevMode = this._debugProbeVisible;

    // 대상 스프라이트 수집 (오브젝트는 container + 자식도 포함)
    var targets = [];
    for (var si = 0; si < sprites.length; si++) {
        var s = sprites[si];
        if (!s) continue;
        if (s._material && s._material.isMeshPhongMaterial) targets.push(s);
        if (includeChildren && s.children) {
            for (var ci = 0; ci < s.children.length; ci++) {
                var ch = s.children[ci];
                if (ch && ch._material && ch._material.isMeshPhongMaterial) targets.push(ch);
            }
        }
    }

    for (var i = 0; i < targets.length; i++) {
        var sprite = targets[i];
        if (!sprite._threeObj || !sprite._threeObj.visible) continue;

        // 캐릭터 월드 위치 - _threeObj의 실제 matrixWorld에서 추출
        var threeObj = sprite._threeObj;
        threeObj.updateWorldMatrix(true, false);
        var worldPos = this._tmpWorldPos;
        worldPos.setFromMatrixPosition(threeObj.matrixWorld);

        // geometry vertices에 anchor 오프셋이 bake되어 있음
        // worldPos는 anchor 기준점이므로, geometry 중심으로 보정
        var fw = sprite._frameWidth || 48;
        var fh = sprite._frameHeight || 48;
        var ax = sprite._anchorX || 0;
        var ay = sprite._anchorY || 0;
        // geometry 중심 오프셋 (로컬): centerX = (0.5 - ax) * fw, centerY = (0.5 - ay) * fh
        var localCenterX = (0.5 - ax) * fw;
        var localCenterY = (0.5 - ay) * fh;

        // billboard rotation(rotation.x = -tiltRad)에 의해 Y가 Y/Z로 분해됨
        var rotX = threeObj.rotation.x; // billboard tilt
        var charX = worldPos.x + localCenterX;
        var charY = worldPos.y + localCenterY * Math.cos(rotX);
        var charZ = worldPos.z + localCenterY * Math.sin(rotX);

        // 6방향 라이트 기여도 (디버그용은 6방향 전부, emissive용은 5방향)
        var perNormal = isDevMode ? [0,0,0,0,0,0] : null;
        var extraR = 0, extraG = 0, extraB = 0;

        for (var li = 0; li < lights.length; li++) {
            var light = lights[li];
            var lightColor = light.color;
            var intensity = light.intensity;
            if (intensity <= 0) continue;

            // 라이트에서 캐릭터로의 방향 벡터
            if (light.isDirectionalLight) {
                // DirectionalLight: 방향은 position에서 target으로
                tmpDir.copy(light.position).sub(light.target.position).normalize();
            } else if (light.isPointLight || light.isSpotLight) {
                tmpDir.set(
                    light.position.x - charX,
                    light.position.y - charY,
                    light.position.z - charZ
                );
                var dist = tmpDir.length();
                if (dist < 0.001) continue;
                tmpDir.divideScalar(dist);

                // 거리 감쇠 (decay=0일 때 linear falloff)
                if (light.distance > 0) {
                    if (dist > light.distance) continue;
                    var decay = light.decay || 0;
                    if (decay === 0) {
                        intensity *= Math.max(0, 1.0 - dist / light.distance);
                    } else {
                        intensity *= Math.pow(Math.max(0, 1.0 - dist / light.distance), decay);
                    }
                }

                // SpotLight 원뿔 감쇠
                if (light.isSpotLight && light.target) {
                    var spotAxis = ShadowLight._tmpVec3b
                        .subVectors(light.target.position, light.position).normalize();
                    var toChar = ShadowLight._tmpVec3c.set(
                        charX - light.position.x,
                        charY - light.position.y,
                        charZ - light.position.z
                    ).normalize();
                    var angleCos = spotAxis.dot(toChar);
                    var coneCos = Math.cos(light.angle);
                    if (angleCos < coneCos) continue;
                    var penumbraCos = Math.cos(light.angle * (1 - light.penumbra));
                    var spotAttenuation = (angleCos - coneCos) / Math.max(penumbraCos - coneCos, 0.001);
                    spotAttenuation = Math.min(1.0, spotAttenuation);
                    intensity *= spotAttenuation;
                }
            } else {
                continue;
            }

            if (intensity <= 0.001) continue;

            // 라이트의 밝기 (색상 × 강도)
            var lum = (lightColor.r + lightColor.g + lightColor.b) / 3.0 * intensity;

            // 5방향 법선에 대한 라이트 기여도 (emissive용)
            for (var n = 0; n < normals.length; n++) {
                var dotNL = normals[n].dot(tmpDir);
                if (dotNL > 0) {
                    extraR += lightColor.r * intensity * dotNL;
                    extraG += lightColor.g * intensity * dotNL;
                    extraB += lightColor.b * intensity * dotNL;
                    if (isDevMode) {
                        perNormal[n] += lum * dotNL;
                    }
                }
            }
            // 디버그: +Z(정면) 기여도도 계산
            if (isDevMode) {
                var dotFront = allNormals[5].dot(tmpDir);
                if (dotFront > 0) perNormal[5] += lum * dotFront;
            }
        }

        // 추가 조명을 emissive에 반영 (감쇠 계수로 강도 조절)
        var factor = this.config.probeEmissiveFactor;
        sprite._material.emissive.setRGB(
            Math.min(1.0, extraR * factor),
            Math.min(1.0, extraG * factor),
            Math.min(1.0, extraB * factor)
        );

        // 디버그 시각화 업데이트
        // 오브젝트의 자식 tileSprite는 부모 컨테이너 기준으로 한 번만 표시
        if (isDevMode) {
            var isObjChild = sprite.parent && sprite.parent._mapObjX !== undefined;
            if (!isObjChild) {
                // 캐릭터 스프라이트 또는 컨테이너 자체
                this._updateProbeDebugVis(sprite, charX, charY, charZ, perNormal);
            } else if (!this._probeDebugData || !this._probeDebugData.has(sprite.parent)) {
                // 오브젝트 자식 중 첫 번째만 컨테이너 키로 디버그 표시
                this._updateProbeDebugVis(sprite.parent, charX, charY, charZ, perNormal);
            }
        }
    }

    // 디버그 모드가 꺼졌으면 시각화 제거
    if (!isDevMode && this._probeDebugGroup) {
        this._removeProbeDebugVis();
    }
};

//=============================================================================
// 프록시 박스 디버그 시각화
// 개발 모드에서 각 캐릭터의 가상 콜라이더 박스(와이어프레임)와
// 6방향 법선 화살표(라이트 기여도에 따라 밝기 변화)를 3D 씬에 표시
//=============================================================================

// +Z(정면)를 포함한 전체 6방향 법선 (디버그 시각화용)
ShadowLight._probeNormalsAll = [
    new THREE.Vector3( 1,  0,  0),  // +X (오른쪽)
    new THREE.Vector3(-1,  0,  0),  // -X (왼쪽)
    new THREE.Vector3( 0,  1,  0),  // +Y (아래)
    new THREE.Vector3( 0, -1,  0),  // -Y (위)
    new THREE.Vector3( 0,  0, -1),  // -Z (뒤쪽)
    new THREE.Vector3( 0,  0,  1),  // +Z (정면)
];

// 법선별 색상 (기본색, 밝기에 따라 스케일)
ShadowLight._probeColors = [
    0xff0000,  // +X 빨강
    0x00ff00,  // -X 초록
    0x0000ff,  // +Y 파랑
    0xffff00,  // -Y 노랑
    0xff00ff,  // -Z 마젠타
    0x00ffff,  // +Z 시안
];

ShadowLight._probeDebugGroup = null;  // 씬에 추가된 디버그 그룹
ShadowLight._probeDebugData = null;   // sprite → { box, arrows[] } 매핑
ShadowLight._debugProbeVisible = false;

// 에디터(React) 쪽에서 참조할 수 있도록 전역 플래그 노출
// window._probeDebugActive === true이면 에디터 마우스 입력 차단
Object.defineProperty(window, '_probeDebugActive', {
    get: function() { return ShadowLight._debugProbeVisible; },
    configurable: true,
});

// 에디터(React)의 mousemove에서 호출할 수 있도록 전역 함수 노출
window._probeDebugHover = function(clientX, clientY, target) {
    ShadowLight._onProbeHoverXY(clientX, clientY, target);
};
window._probeDebugLeave = function() {
    ShadowLight._removeProbeTooltip();
    if (ShadowLight._probeSelectedBox) {
        ShadowLight._setBoxHighlight(ShadowLight._probeSelectedBox, false);
        ShadowLight._probeSelectedBox = null;
    }
};

/**
 * 디버그 시각화를 위한 그룹과 캐시 초기화
 */
ShadowLight._ensureProbeDebugGroup = function() {
    if (this._probeDebugGroup) return;
    this._probeDebugGroup = new THREE.Group();
    this._probeDebugGroup.name = 'ProbeBoxDebug';
    this._probeDebugGroup.frustumCulled = false;
    this._probeDebugData = new Map();
    // spritesetObj에 추가해야 Pass 2(2D 오버레이)에서 같이 숨겨짐
    // scene에 직접 추가하면 Pass 1(3D) + Pass 2(2D) 양쪽에서 렌더됨
    var ss = this._spriteset;
    if (ss && ss._threeObj) {
        ss._threeObj.add(this._probeDebugGroup);
    } else {
        var scene = this._findScene();
        if (scene) scene.add(this._probeDebugGroup);
    }
    // 클릭으로 박스 정보 확인할 수 있도록 핸들러 설치
    this._installProbeClickHandler();
};

/**
 * 특정 스프라이트의 디버그 메시 생성 (와이어프레임 박스 + 법선 화살표 6개)
 */
ShadowLight._createProbeDebugMeshes = function(sprite) {
    this._ensureProbeDebugGroup();

    var group = new THREE.Group();
    group.frustumCulled = false;

    // 와이어프레임 박스 (캐릭터 크기에 맞춤)
    var boxGeo = new THREE.BoxGeometry(1, 1, 1);
    var boxMat = new THREE.MeshBasicMaterial({
        color: 0x44ff44,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        depthTest: false,
    });
    var boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.frustumCulled = false;
    boxMesh.renderOrder = 9998;
    group.add(boxMesh);

    // raycasting용 투명 solid 박스 (호버 감지용, 화면에는 거의 안 보임)
    var hitGeo = new THREE.BoxGeometry(1, 1, 1);
    var hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,       // 완전 투명이지만 raycasting은 가능
        depthWrite: false,
        depthTest: false,
    });
    var hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.frustumCulled = false;
    hitMesh.userData._probeSprite = sprite; // 스프라이트 참조 저장
    group.add(hitMesh);

    // 6방향 법선 화살표 (Line으로 구현)
    var arrows = [];
    var allNormals = this._probeNormalsAll;
    var colors = this._probeColors;
    for (var n = 0; n < 6; n++) {
        // 화살표 라인: 중심 → 법선 방향
        var lineGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(6); // 2개 정점 × 3
        lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        var lineMat = new THREE.LineBasicMaterial({
            color: colors[n],
            linewidth: 2,
            transparent: true,
            opacity: 0.3,
            depthTest: false,
        });
        var line = new THREE.Line(lineGeo, lineMat);
        line.frustumCulled = false;
        line.renderOrder = 9999;
        group.add(line);

        // 화살표 끝 구체 (기여도에 따라 크기/밝기 변화)
        var sphereGeo = new THREE.SphereGeometry(2, 6, 4);
        var sphereMat = new THREE.MeshBasicMaterial({
            color: colors[n],
            transparent: true,
            opacity: 0.3,
            depthTest: false,
        });
        var sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.frustumCulled = false;
        sphere.renderOrder = 9999;
        group.add(sphere);

        arrows.push({ line: line, sphere: sphere, mat: lineMat, sphereMat: sphereMat });
    }

    // 이름 라벨 (CanvasTexture → PlaneGeometry Mesh)
    var name = this._getSpriteName(sprite);
    var labelMesh = this._createLabelMesh(name);
    labelMesh.frustumCulled = false;
    labelMesh.renderOrder = 10000;
    group.add(labelMesh);

    this._probeDebugGroup.add(group);

    var data = { group: group, box: boxMesh, hitBox: hitMesh, arrows: arrows, label: labelMesh };
    this._probeDebugData.set(sprite, data);
    return data;
};

/**
 * 텍스트 라벨 Mesh 생성 (CanvasTexture + PlaneGeometry)
 * Mode3D의 Y-flip 환경에서 정상 표시되도록 Y 반전 적용
 */
ShadowLight._createLabelMesh = function(text) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var fontSize = 14;
    ctx.font = 'bold ' + fontSize + 'px monospace';
    var metrics = ctx.measureText(text);
    var tw = Math.ceil(metrics.width) + 8;
    var th = fontSize + 6;
    canvas.width = tw;
    canvas.height = th;

    // Y-flip: Mode3D의 m[5]=-m[5] 보정
    ctx.save();
    ctx.translate(0, th);
    ctx.scale(1, -1);

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, tw, th);
    ctx.font = 'bold ' + fontSize + 'px monospace';
    ctx.fillStyle = '#66ffcc';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 4, th / 2);
    ctx.restore();

    var tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    var mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    var geo = new THREE.PlaneGeometry(tw, th);
    var mesh = new THREE.Mesh(geo, mat);
    return mesh;
};

/**
 * 특정 스프라이트의 디버그 시각화 업데이트
 * @param {Object} sprite - 캐릭터 스프라이트
 * @param {Number} cx, cy, cz - 프로빙 중심 좌표
 * @param {Array} perNormal - 6방향 라이트 기여도 배열
 */
ShadowLight._updateProbeDebugVis = function(sprite, cx, cy, cz, perNormal) {
    var data = this._probeDebugData ? this._probeDebugData.get(sprite) : null;
    if (!data) {
        data = this._createProbeDebugMeshes(sprite);
    }

    // 월드 좌표를 디버그 그룹 부모의 로컬 좌표로 변환
    var localPos = this._tmpLocalPos.set(cx, cy, cz);
    if (this._probeDebugGroup && this._probeDebugGroup.parent) {
        var parentInv = this._tmpMatrix4;
        this._probeDebugGroup.parent.updateWorldMatrix(true, false);
        parentInv.copy(this._probeDebugGroup.parent.matrixWorld).invert();
        localPos.applyMatrix4(parentInv);
    }
    var lx = localPos.x, ly = localPos.y, lz = localPos.z;

    // 실제 geometry 크기 기반 박스
    var fw = sprite._frameWidth || 48;
    var fh = sprite._frameHeight || 48;
    var boxW = fw;       // 실제 프레임 폭
    var boxH = fh;       // 실제 프레임 높이
    var boxD = fw * 0.5; // 깊이는 폭의 절반

    // 와이어프레임 박스 위치/크기 (axis-aligned, rotation 없음)
    // 프록시 박스는 가상 볼륨이므로 지면에 서있는 형태로 표시
    data.box.position.set(lx, ly, lz);
    data.box.scale.set(boxW, boxH, boxD);
    data.box.rotation.set(0, 0, 0);

    // raycasting용 hitBox도 동기화
    if (data.hitBox) {
        data.hitBox.position.set(lx, ly, lz);
        data.hitBox.scale.set(boxW, boxH, boxD);
        data.hitBox.rotation.set(0, 0, 0);
    }

    // 이름 라벨 위치: 박스 위쪽에 배치
    if (data.label) {
        // Y-down 좌표계이므로 위 = 음수 방향
        data.label.position.set(lx, ly - boxH * 0.5 - 12, lz);
    }

    // 법선 화살표 업데이트
    var allNormals = this._probeNormalsAll;
    var arrowLen = 30; // 화살표 기본 길이

    for (var n = 0; n < 6; n++) {
        var arrow = data.arrows[n];
        var normal = allNormals[n];
        var contribution = perNormal[n] || 0;

        // 기여도에 따른 시각 효과
        var brightness = Math.min(1.0, contribution);
        var arrowScale = arrowLen + brightness * 20; // 기여도 높으면 화살표 길어짐

        // 라인 정점 업데이트: 중심 → 법선 방향
        var posAttr = arrow.line.geometry.attributes.position;
        posAttr.setXYZ(0, lx, ly, lz);
        posAttr.setXYZ(1,
            lx + normal.x * arrowScale,
            ly + normal.y * arrowScale,
            lz + normal.z * arrowScale
        );
        posAttr.needsUpdate = true;

        // 끝점 구체
        arrow.sphere.position.set(
            lx + normal.x * arrowScale,
            ly + normal.y * arrowScale,
            lz + normal.z * arrowScale
        );
        // 기여도에 따라 구체 크기/투명도 조절
        var sphereSize = 1.5 + brightness * 4;
        arrow.sphere.scale.setScalar(sphereSize);
        arrow.sphereMat.opacity = 0.2 + brightness * 0.8;
        arrow.mat.opacity = 0.2 + brightness * 0.8;
    }
};

/**
 * 모든 디버그 시각화 제거
 */
ShadowLight._removeProbeDebugVis = function() {
    if (!this._probeDebugGroup) return;
    if (this._probeDebugGroup.parent) {
        this._probeDebugGroup.parent.remove(this._probeDebugGroup);
    }
    // geometry/material dispose
    this._probeDebugGroup.traverse(function(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
    this._probeDebugGroup = null;
    this._probeDebugData = null;
    // 클릭 핸들러 제거
    this._removeProbeClickHandler();
};

//=============================================================================
// 프록시 박스 클릭 감지 - 디버그 박스 클릭 시 스프라이트 정보 표시
//=============================================================================

ShadowLight._probeRaycaster = new THREE.Raycaster();
ShadowLight._probeMouseVec = new THREE.Vector2();
ShadowLight._probeClickBound = null;  // 바인딩된 핸들러 참조
ShadowLight._probeTooltip = null;     // 툴팁 DOM 엘리먼트
ShadowLight._probeSelectedBox = null; // 선택된 박스 데이터

/**
 * 스프라이트에서 표시할 이름/정보 추출
 */
ShadowLight._getSpriteName = function(sprite) {
    if (!sprite) return '(unknown)';

    // Sprite_Character: _character 프로퍼티 확인
    var ch = sprite._character;
    if (ch) {
        // 플레이어
        if (ch === $gamePlayer) {
            return 'Player (' + (ch.characterName() || 'tile') + ')';
        }
        // 동료
        if (ch.constructor && ch.constructor.name === 'Game_Follower') {
            return 'Follower (' + (ch.characterName() || 'tile') + ')';
        }
        // 탈것
        if (ch.constructor && ch.constructor.name === 'Game_Vehicle') {
            return 'Vehicle (' + (ch.characterName() || 'tile') + ')';
        }
        // 이벤트
        if (typeof ch.eventId === 'function' && ch.eventId() > 0) {
            var evData = ch.event ? ch.event() : null;
            var evName = evData ? evData.name : '';
            return 'Event #' + ch.eventId() + (evName ? ' "' + evName + '"' : '') +
                   ' (' + (ch.characterName() || 'tile') + ')';
        }
        // 기타 캐릭터
        return 'Character (' + (ch.characterName() || 'tile') + ')';
    }

    // 오브젝트 스프라이트: $dataMap.objects에서 매칭
    if ($dataMap && $dataMap.objects) {
        // 부모 컨테이너가 _mapObjX를 가지면 오브젝트
        var container = sprite;
        if (sprite.parent && sprite.parent._mapObjX !== undefined) {
            container = sprite.parent;
        }
        if (container._mapObjX !== undefined) {
            for (var i = 0; i < $dataMap.objects.length; i++) {
                var obj = $dataMap.objects[i];
                if (obj && obj.x === container._mapObjX && obj.y === container._mapObjY) {
                    return 'Object #' + (obj.id || i) + (obj.name ? ' "' + obj.name + '"' : '') +
                           ' (' + obj.x + ',' + obj.y + ')';
                }
            }
            return 'Object (' + container._mapObjX + ',' + container._mapObjY + ')';
        }
    }

    // 타일셋 이미지명 등 fallback
    if (sprite._characterName) {
        return sprite._characterName;
    }
    return '(sprite)';
};

/**
 * 프록시 박스 클릭 핸들러 설치
 */
ShadowLight._installProbeClickHandler = function() {
    if (this._probeClickBound) return; // 이미 설치됨
    var self = this;
    this._probeClickBound = function(e) {
        self._onProbeHover(e);
    };
    // 프록시 박스 시각화 중엔 게임 입력(TouchInput) 차단
    this._probeMouseBlockBound = function(e) {
        if (self._debugProbeVisible) {
            e.stopPropagation();
        }
    };
    // 에디터의 실제 WebGL 캔버스 찾기
    var canvas = null;
    if (window._editorRendererObj && window._editorRendererObj.renderer) {
        canvas = window._editorRendererObj.renderer.domElement;
    }
    if (!canvas && Graphics._renderer) {
        canvas = Graphics._renderer.domElement;
    }
    if (!canvas) {
        canvas = document.querySelector('canvas');
    }
    if (canvas) {
        canvas.addEventListener('mousemove', this._probeClickBound);
        canvas.addEventListener('mouseleave', function() {
            self._removeProbeTooltip();
            if (self._probeSelectedBox) {
                self._setBoxHighlight(self._probeSelectedBox, false);
                self._probeSelectedBox = null;
            }
        });
        // capture: true로 document의 mousedown/touchstart보다 먼저 잡아서 전파 차단
        canvas.addEventListener('mousedown', this._probeMouseBlockBound, true);
        canvas.addEventListener('touchstart', this._probeMouseBlockBound, true);
        this._probeClickCanvas = canvas;
    }
};

/**
 * 프록시 박스 클릭 핸들러 제거
 */
ShadowLight._removeProbeClickHandler = function() {
    if (this._probeClickCanvas) {
        if (this._probeClickBound) {
            this._probeClickCanvas.removeEventListener('mousemove', this._probeClickBound);
        }
        if (this._probeMouseBlockBound) {
            this._probeClickCanvas.removeEventListener('mousedown', this._probeMouseBlockBound, true);
            this._probeClickCanvas.removeEventListener('touchstart', this._probeMouseBlockBound, true);
        }
    }
    this._probeClickBound = null;
    this._probeMouseBlockBound = null;
    this._probeClickCanvas = null;
    this._removeProbeTooltip();
    this._probeSelectedBox = null;
};

/**
 * 마우스 호버 시 raycasting으로 디버그 박스 감지 (throttle 적용)
 */
ShadowLight._probeHoverLastTime = 0;
ShadowLight._onProbeHover = function(e) {
    this._onProbeHoverXY(e.clientX, e.clientY, e.target);
};

/**
 * clientX/clientY 기반 호버 처리 (native event, React 양쪽에서 호출 가능)
 */
ShadowLight._onProbeHoverXY = function(clientX, clientY, target) {
    if (!this._debugProbeVisible || !this._probeDebugGroup) return;

    // 50ms throttle
    var now = performance.now();
    if (now - this._probeHoverLastTime < 50) return;
    this._probeHoverLastTime = now;

    var camera = window.Mode3D ? Mode3D._perspCamera : null;
    if (!camera) return;

    // target이 canvas가 아닐 수 있으므로, 렌더러에서 직접 canvas를 가져옴
    var canvas = target;
    if (!canvas || !canvas.getBoundingClientRect) {
        if (window._editorRendererObj && window._editorRendererObj.renderer) {
            canvas = window._editorRendererObj.renderer.domElement;
        }
    }
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();
    var mouse = this._probeMouseVec;
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    // Mode3D는 projectionMatrix의 m[5]를 반전 (Y-flip) → NDC Y축도 반전됨
    mouse.y = ((clientY - rect.top) / rect.height) * 2 - 1;

    var raycaster = this._probeRaycaster;
    raycaster.setFromCamera(mouse, camera);

    // hitBox들만 수집 (userData._probeSprite가 있는 메시)
    // matrixWorld 갱신 보장
    this._probeDebugGroup.updateWorldMatrix(true, true);
    var hitTargets = [];
    this._probeDebugGroup.traverse(function(obj) {
        if (obj.isMesh && obj.userData._probeSprite) {
            hitTargets.push(obj);
        }
    });
    if (hitTargets.length === 0) return;

    var intersects = raycaster.intersectObjects(hitTargets, false);

    if (intersects.length > 0) {
        var hitObj = intersects[0].object;
        var sprite = hitObj.userData._probeSprite;

        // 같은 박스 위에 있으면 툴팁 위치만 업데이트
        if (this._probeSelectedBox !== hitObj) {
            if (this._probeSelectedBox) {
                this._setBoxHighlight(this._probeSelectedBox, false);
            }
            this._probeSelectedBox = hitObj;
            this._setBoxHighlight(hitObj, true);
        }

        var name = this._getSpriteName(sprite);

        // emissive 값 읽기
        var emissiveStr = '';
        if (sprite._material && sprite._material.emissive) {
            var em = sprite._material.emissive;
            emissiveStr = 'Emissive: (' +
                em.r.toFixed(3) + ', ' +
                em.g.toFixed(3) + ', ' +
                em.b.toFixed(3) + ')';
        }

        // 프레임 크기
        var sizeStr = (sprite._frameWidth || '?') + 'x' + (sprite._frameHeight || '?');

        this._showProbeTooltip(e.clientX, e.clientY, name, sizeStr, emissiveStr);
    } else {
        if (this._probeSelectedBox) {
            this._setBoxHighlight(this._probeSelectedBox, false);
            this._probeSelectedBox = null;
        }
        this._removeProbeTooltip();
    }
};

/**
 * 디버그 박스 하이라이트 설정/해제
 */
ShadowLight._setBoxHighlight = function(hitMesh, highlight) {
    // hitMesh의 형제인 wireframe boxMesh 찾기
    if (!hitMesh || !hitMesh.parent) return;
    var siblings = hitMesh.parent.children;
    for (var i = 0; i < siblings.length; i++) {
        var sib = siblings[i];
        if (sib.isMesh && sib.material && sib.material.wireframe) {
            if (highlight) {
                sib.material.color.setHex(0xffffff);
                sib.material.opacity = 1.0;
            } else {
                sib.material.color.setHex(0x44ff44);
                sib.material.opacity = 0.6;
            }
            break;
        }
    }
};

/**
 * 프록시 박스 정보 툴팁 표시
 */
ShadowLight._showProbeTooltip = function(x, y, name, size, emissive) {
    if (!this._probeTooltip) {
        var tip = document.createElement('div');
        tip.style.cssText =
            'position:fixed;z-index:100000;pointer-events:none;' +
            'background:rgba(0,0,0,0.85);color:#eee;' +
            'border:1px solid #66ffcc;border-radius:4px;' +
            'padding:6px 10px;font-size:12px;font-family:monospace;' +
            'line-height:1.5;white-space:nowrap;' +
            'box-shadow:0 2px 8px rgba(0,0,0,0.5);';
        document.body.appendChild(tip);
        this._probeTooltip = tip;
    }
    var tip = this._probeTooltip;

    var html = '<div style="color:#66ffcc;font-weight:bold;margin-bottom:2px;">' +
               name.replace(/</g, '&lt;') + '</div>';
    html += '<div style="color:#aaa;">Size: ' + size + '</div>';
    if (emissive) {
        html += '<div style="color:#aaa;">' + emissive + '</div>';
    }
    tip.innerHTML = html;
    tip.style.display = 'block';

    // 화면 밖으로 나가지 않게 위치 조정
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    var left = x + 12;
    var top = y - th - 8;
    if (left + tw > window.innerWidth) left = x - tw - 12;
    if (top < 0) top = y + 16;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
};

/**
 * 프록시 박스 툴팁 제거
 */
ShadowLight._removeProbeTooltip = function() {
    if (this._probeTooltip) {
        this._probeTooltip.remove();
        this._probeTooltip = null;
    }
};

/**
 * MeshLambertMaterial을 MeshBasicMaterial로 되돌리기
 */
ShadowLight._revertMaterial = function(sprite) {
    if (!sprite || !sprite._material) return;
    if (!sprite._material.isMeshPhongMaterial) return;

    var oldMat = sprite._material;
    var newMat = new THREE.MeshBasicMaterial({
        map: oldMat.map,
        transparent: oldMat.transparent,
        depthTest: false,
        depthWrite: false,
        side: oldMat.side,
        opacity: oldMat.opacity,
        blending: oldMat.blending,
    });
    newMat.visible = oldMat.visible;
    newMat.needsUpdate = true;

    sprite._threeObj.material = newMat;
    sprite._material = newMat;
    sprite._threeObj.castShadow = false;
    sprite._threeObj.customDepthMaterial = null;
};

//=============================================================================
// 타일맵 메시 재생성
// 기존 메시를 삭제하여 _flush에서 올바른 material로 다시 생성하도록 강제
//=============================================================================

/**
 * 타일맵 메시를 모두 삭제하여 _flush에서 올바른 material로 재생성하도록 강제
 * (ThreeTilemap._flush에서 ShadowLight._active 여부에 따라 material 결정)
 */
ShadowLight._resetTilemapMeshes = function(tilemap) {
    if (!tilemap) return;
    var zLayers = [tilemap.lowerZLayer, tilemap.upperZLayer];
    for (var z = 0; z < zLayers.length; z++) {
        var zLayer = zLayers[z];
        if (!zLayer || !zLayer.children) continue;
        for (var c = 0; c < zLayer.children.length; c++) {
            var composite = zLayer.children[c];
            if (!composite || !composite.children) continue;
            for (var r = 0; r < composite.children.length; r++) {
                var rectLayer = composite.children[r];
                if (!rectLayer || !rectLayer._meshes) continue;
                // 기존 메시 제거
                for (var key in rectLayer._meshes) {
                    var mesh = rectLayer._meshes[key];
                    if (mesh) {
                        if (mesh.geometry) mesh.geometry.dispose();
                        if (mesh.material) mesh.material.dispose();
                        rectLayer._threeObj.remove(mesh);
                    }
                }
                rectLayer._meshes = {};
                rectLayer._needsRebuild = true;
            }
        }
    }
};

// _revertTilemapMaterials도 _resetTilemapMeshes로 통합 (메시 재생성 방식)
ShadowLight._revertTilemapMaterials = function(tilemap) {
    this._resetTilemapMeshes(tilemap);
};

//=============================================================================
// skyBackground.sunLights UV → 방향 벡터 변환
//=============================================================================
function sunUVToDirection(u, v) {
    var phi = u * 2 * Math.PI;
    var theta = v * Math.PI;
    // SphereGeometry 로컬 좌표 (DoubleSide 내부 좌우반전 보상: -cos → +cos)
    var lx =  Math.cos(phi) * Math.sin(theta);
    var ly =  Math.cos(theta);
    var lz =  Math.sin(phi) * Math.sin(theta);
    // SkyBox.js rotation.x = PI/2 적용: (lx, ly, lz) → (lx, -lz, ly)
    return { x: lx, y: -lz, z: ly };
}

//=============================================================================
// Scene에 조명 추가/제거
//=============================================================================

ShadowLight._addLightsToScene = function(scene) {
    if (this._ambientLight) return; // 이미 추가됨

    // localStorage에서 인스펙터 config 복구 (사용자가 마지막으로 조절한 값)
    var CONFIG_STORAGE_KEY = 'devPanel_mapInspector_config';
    try {
        var savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (savedConfig) {
            var parsed = JSON.parse(savedConfig);
            for (var k in parsed) {
                if (parsed.hasOwnProperty(k) && this.config.hasOwnProperty(k)) {
                    // lightDirection은 THREE.Vector3로 복원
                    if (k === 'lightDirection' && parsed[k] && typeof parsed[k] === 'object') {
                        var d = parsed[k];
                        this.config[k] = new THREE.Vector3(d.x || 0, d.y || 0, d.z || 0);
                    } else {
                        this.config[k] = parsed[k];
                    }
                }
            }
        }
    } catch (e) {}

    // editorLights 맵별 설정 (에디터에서 저장한 커스텀 데이터)
    var elRaw = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
    var elGlobalOff = elRaw && elRaw.enabled === false;
    var el = (elRaw && !elGlobalOff) ? elRaw : null;

    // 디버그 패널 우선 적용 플래그 로드
    var ambientOverride = false;
    var directionalOverride = false;
    try { ambientOverride = localStorage.getItem('devPanel_ambientOverride') === 'true'; } catch (e) {}
    try { directionalOverride = localStorage.getItem('devPanel_directionalOverride') === 'true'; } catch (e) {}
    var playerLightOverride = false;
    try { playerLightOverride = localStorage.getItem('devPanel_playerLightOverride') === 'true'; } catch (e) {}
    var spotLightOverride = false;
    try { spotLightOverride = localStorage.getItem('devPanel_spotLightOverride') === 'true'; } catch (e) {}
    this._debugAmbientOverride = ambientOverride;
    this._debugDirectionalOverride = directionalOverride;
    this._debugPlayerLightOverride = playerLightOverride;
    this._debugSpotLightOverride = spotLightOverride;

    // AmbientLight - 전체적인 환경광
    // 글로벌 OFF → ambient=1 흰색 (조명 없는 상태), 디버그 우선 ON → config, OFF → editorLights
    var useElAmbient = !elGlobalOff && el && !ambientOverride;
    var ambColor, ambIntensity, ambEnabled;
    if (elGlobalOff) {
        ambColor = 0xffffff;
        ambIntensity = 1.0;
        ambEnabled = true;
    } else if (useElAmbient) {
        ambColor = parseInt(el.ambient.color.replace('#', ''), 16);
        ambIntensity = el.ambient.intensity;
        ambEnabled = el.ambient.enabled !== false;
    } else {
        ambColor = this.config.ambientColor;
        ambIntensity = this.config.ambientIntensity;
        ambEnabled = true;
    }
    // config에 동기화 (디버그 패널 초기값과 일치시킴)
    if (useElAmbient) {
        this.config.ambientColor = ambColor;
        this.config.ambientIntensity = ambIntensity;
    }
    this._ambientLight = new THREE.AmbientLight(ambColor, ambEnabled ? ambIntensity : 0);
    scene.add(this._ambientLight);

    // DirectionalLight - 태양/달빛 (그림자 방향 결정)
    // 글로벌 OFF → directional 비활성, 디버그 우선 ON → config, OFF → editorLights
    var useElDir = !elGlobalOff && el && !directionalOverride;
    var dirEnabled = elGlobalOff ? false : (useElDir ? (el.directional.enabled === true) : true);
    var dirColor = useElDir ? parseInt(el.directional.color.replace('#', ''), 16) : this.config.directionalColor;
    var dirIntensity = useElDir ? el.directional.intensity : this.config.directionalIntensity;
    // config에 동기화
    if (useElDir) {
        this.config.directionalColor = dirColor;
        this.config.directionalIntensity = dirIntensity;
    }
    this._directionalLight = new THREE.DirectionalLight(dirColor, dirEnabled ? dirIntensity : 0);
    this._directionalLight.visible = dirEnabled;
    // 위치는 방향의 반대 (광원이 오는 방향)
    var dir;
    if (useElDir && el.directional.direction) {
        dir = new THREE.Vector3(el.directional.direction[0], el.directional.direction[1], el.directional.direction[2]).normalize();
    } else {
        dir = this.config.lightDirection;
    }
    this._directionalLight.position.set(-dir.x * 1000, -dir.y * 1000, -dir.z * 1000);

    // Shadow Map 설정
    this._directionalLight.castShadow = dirEnabled;
    this._directionalLight.shadow.mapSize.width = 2048;
    this._directionalLight.shadow.mapSize.height = 2048;
    // OrthographicCamera 범위: 화면 좌표계 전체를 커버
    // 스프라이트는 화면 좌표(0~width, 0~height)에 있으므로 화면 크기면 충분
    var shadowCamSize = Math.max(
        (typeof Graphics !== 'undefined' ? Graphics._width : 1000),
        (typeof Graphics !== 'undefined' ? Graphics._height : 1000)
    );
    var halfSize = shadowCamSize / 2 + 100; // 약간 여유
    this._directionalLight.shadow.camera.left = -halfSize;
    this._directionalLight.shadow.camera.right = halfSize;
    this._directionalLight.shadow.camera.top = halfSize;
    this._directionalLight.shadow.camera.bottom = -halfSize;
    this._directionalLight.shadow.camera.near = 1;
    this._directionalLight.shadow.camera.far = 5000;
    this._directionalLight.shadow.bias = -0.001;
    this._directionalLight.shadow.radius = this.config.shadowRadius;

    // target을 화면 중심으로 설정 (스프라이트가 화면 좌표계에 있으므로)
    var vw2 = (typeof Graphics !== 'undefined' ? Graphics._width : 816) / 2;
    var vh2 = (typeof Graphics !== 'undefined' ? Graphics._height : 624) / 2;
    this._directionalLight.target.position.set(vw2, vh2, 0);

    // target을 scene에 추가해야 DirectionalLight 방향이 올바르게 동작
    scene.add(this._directionalLight);
    scene.add(this._directionalLight.target);

    // editorLights에서 playerLight config 동기화
    // 글로벌 OFF → player/spot light 비활성
    if (elGlobalOff) {
        this.config.playerLightEnabled = false;
        this.config.spotLightEnabled = false;
    } else if (el && el.playerLight && !playerLightOverride) {
        var pl = el.playerLight;
        this.config.playerLightEnabled = pl.enabled !== false;
        if (pl.color) this.config.playerLightColor = parseInt(pl.color.replace('#', ''), 16);
        if (pl.intensity != null) this.config.playerLightIntensity = pl.intensity;
        if (pl.distance != null) this.config.playerLightDistance = pl.distance;
        if (pl.z != null) this.config.playerLightZ = pl.z;
    }
    // editorLights에서 spotLight config 동기화 (디버그 우선 OFF일 때만)
    if (!elGlobalOff && el && el.spotLight && !spotLightOverride) {
        var sl = el.spotLight;
        if (sl.enabled != null) this.config.spotLightEnabled = sl.enabled;
        if (sl.color) this.config.spotLightColor = parseInt(sl.color.replace('#', ''), 16);
        if (sl.intensity != null) this.config.spotLightIntensity = sl.intensity;
        if (sl.distance != null) this.config.spotLightDistance = sl.distance;
        if (sl.angle != null) this.config.spotLightAngle = sl.angle;
        if (sl.penumbra != null) this.config.spotLightPenumbra = sl.penumbra;
        if (sl.z != null) this.config.spotLightZ = sl.z;
        if (sl.shadowMapSize != null) this.config.spotLightShadowMapSize = sl.shadowMapSize;
        if (sl.targetDistance != null) this.config.spotLightTargetDistance = sl.targetDistance;
    }

    // SpotLight - 플레이어 방향성 그림자 (항상 생성, visible로 제어)
    this._playerSpotLight = new THREE.SpotLight(
        this.config.spotLightColor,
        this.config.spotLightIntensity,
        this.config.spotLightDistance,
        this.config.spotLightAngle,
        this.config.spotLightPenumbra,
        0  // decay=0
    );
    this._playerSpotLight.castShadow = true;
    this._playerSpotLight.shadow.mapSize.width = this.config.spotLightShadowMapSize;
    this._playerSpotLight.shadow.mapSize.height = this.config.spotLightShadowMapSize;
    this._playerSpotLight.shadow.camera.near = 1;
    this._playerSpotLight.shadow.camera.far = this.config.spotLightDistance + 100;
    this._playerSpotLight.shadow.bias = -0.002;
    this._playerSpotLight.shadow.radius = this.config.shadowRadius;
    this._playerSpotLight.visible = this.config.spotLightEnabled;

    // SpotLight target (플레이어 앞 방향)
    this._playerSpotTarget = new THREE.Object3D();
    this._playerSpotLight.target = this._playerSpotTarget;

    scene.add(this._playerSpotLight);
    scene.add(this._playerSpotTarget);

    // skyBackground sunLights → 별도 디렉셔널 라이트로 생성
    // editorLights.directional(메인 디렉셔널)과는 별개.
    // sunLights는 모두 새 DirectionalLight로 만들고 스카이 회전에 따라 회전.
    this._sunLights = [];
    this._sunLightsData = null;
    var skyBg = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.skyBackground : null;
    if (skyBg && skyBg.sunLights && skyBg.sunLights.length > 0) {
        // sunLights가 있으면 메인 디렉셔널을 비활성화 (중복 방지)
        if (this._directionalLight) {
            this._directionalLight.visible = false;
        }
        this._sunLightsData = skyBg.sunLights;
        for (var si = 0; si < skyBg.sunLights.length; si++) {
            var sl = skyBg.sunLights[si];
            var sunDir = sunUVToDirection(sl.position[0], sl.position[1]);
            var sunColor = parseInt(sl.color.replace('#', ''), 16);
            var sunLight = new THREE.DirectionalLight(sunColor, sl.intensity);
            // target 기준으로 position 설정: position = target - dir * distance
            sunLight.target.position.set(vw2, vh2, 0);
            sunLight.position.set(
                vw2 - sunDir.x * 1000,
                vh2 - sunDir.y * 1000,
                0   - sunDir.z * 1000
            );
            sunLight.castShadow = sl.castShadow !== false;
            var sunMapSize = sl.shadowMapSize || 2048;
            sunLight.shadow.mapSize.width = sunMapSize;
            sunLight.shadow.mapSize.height = sunMapSize;
            sunLight.shadow.camera.left = -halfSize;
            sunLight.shadow.camera.right = halfSize;
            sunLight.shadow.camera.top = halfSize;
            sunLight.shadow.camera.bottom = -halfSize;
            sunLight.shadow.camera.near = 1;
            sunLight.shadow.camera.far = 5000;
            sunLight.shadow.bias = sl.shadowBias != null ? sl.shadowBias : -0.001;
            sunLight.shadow.radius = this.config.shadowRadius;
            scene.add(sunLight);
            scene.add(sunLight.target);
            this._sunLights.push(sunLight);
        }
    }

};

//=============================================================================
// 카메라 존 환경광 lerp 보간
// 매 프레임 호출하여 _ambientLight의 intensity/color를
// 활성 카메라 존의 값으로 부드럽게 전환
//=============================================================================

ShadowLight._currentAmbientIntensity = null;
ShadowLight._currentAmbientR = null;
ShadowLight._currentAmbientG = null;
ShadowLight._currentAmbientB = null;

ShadowLight._updateCameraZoneAmbient = function() {
    if (!this._ambientLight) return;
    if (window.__editorMode) return;

    // 디버그 패널 우선 적용 시 → 패널 config 값 직접 사용, lerp 스킵
    if (this._debugAmbientOverride) {
        this._ambientLight.intensity = this.config.ambientIntensity;
        this._ambientLight.color.setHex(this.config.ambientColor);
        this._currentAmbientIntensity = null; // 해제 시 lerp 재초기화 위해
        return;
    }

    // 맵 데이터 기반: editorLights에서 글로벌 ambient 값 가져오기
    var elRaw = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
    var elGlobalOff = elRaw && elRaw.enabled === false;
    var el = (elRaw && !elGlobalOff) ? elRaw : null;
    var baseIntensity, baseColor;
    var ambEnabled = true;
    if (elGlobalOff) {
        // 광원 시스템 OFF → 조명 없는 상태 (ambient=1, 흰색)
        baseIntensity = 1.0;
        baseColor = 0xffffff;
    } else if (el && el.ambient) {
        ambEnabled = el.ambient.enabled !== false;
        baseIntensity = el.ambient.intensity;
        baseColor = parseInt(el.ambient.color.replace('#', ''), 16);
    } else {
        baseIntensity = this.config.ambientIntensity;
        baseColor = this.config.ambientColor;
    }

    // 타겟 값 결정: 활성 카메라존 → 맵 editorLights 글로벌
    var targetIntensity = ambEnabled ? baseIntensity : 0;
    var targetR = ((baseColor >> 16) & 0xFF) / 255;
    var targetG = ((baseColor >> 8) & 0xFF) / 255;
    var targetB = (baseColor & 0xFF) / 255;
    var transitionSpeed = 1.0;

    if ($gameMap && $gameMap._activeCameraZoneId != null) {
        var zone = $gameMap.getCameraZoneById($gameMap._activeCameraZoneId);
        if (zone && zone.ambientIntensity != null) {
            targetIntensity = zone.ambientIntensity;
            if (zone.ambientColor) {
                var hex = parseInt(zone.ambientColor.replace('#', ''), 16);
                targetR = ((hex >> 16) & 0xFF) / 255;
                targetG = ((hex >> 8) & 0xFF) / 255;
                targetB = (hex & 0xFF) / 255;
            }
        }
        if (zone) transitionSpeed = zone.transitionSpeed || 1.0;
    }

    // 초기화 (최초 호출 시)
    if (this._currentAmbientIntensity === null) {
        this._currentAmbientIntensity = targetIntensity;
        this._currentAmbientR = targetR;
        this._currentAmbientG = targetG;
        this._currentAmbientB = targetB;
    }

    // lerp로 부드럽게 전환
    var lerpRate = 0.1 * transitionSpeed;
    lerpRate = Math.min(lerpRate, 1.0);

    this._currentAmbientIntensity += (targetIntensity - this._currentAmbientIntensity) * lerpRate;
    this._currentAmbientR += (targetR - this._currentAmbientR) * lerpRate;
    this._currentAmbientG += (targetG - this._currentAmbientG) * lerpRate;
    this._currentAmbientB += (targetB - this._currentAmbientB) * lerpRate;

    // 수렴 체크
    if (Math.abs(targetIntensity - this._currentAmbientIntensity) < 0.001) this._currentAmbientIntensity = targetIntensity;
    if (Math.abs(targetR - this._currentAmbientR) < 0.001) this._currentAmbientR = targetR;
    if (Math.abs(targetG - this._currentAmbientG) < 0.001) this._currentAmbientG = targetG;
    if (Math.abs(targetB - this._currentAmbientB) < 0.001) this._currentAmbientB = targetB;

    // 적용
    this._ambientLight.intensity = this._currentAmbientIntensity;
    this._ambientLight.color.setRGB(this._currentAmbientR, this._currentAmbientG, this._currentAmbientB);
};

//=============================================================================
// 매 프레임 sunLights 방향 업데이트 (스카이 스피어 회전 반영)
// SkyBox.js 플러그인이 _skyMesh.rotation.y를 매 프레임 누적시키므로,
// sunLights의 UV 좌표에 해당 회전을 적용하여 디렉셔널 라이트 방향을 갱신한다.
//=============================================================================
ShadowLight._updateSunLightDirections = function() {
    if (!this._sunLightsData || !this._directionalLight) return;

    // _isParallaxSky 메시의 quaternion에서 회전 변화량 추출
    // 초기 상태: Euler(π/2, 0, 0) → 현재: Euler(π/2, skyRotY, 0)
    // 변화량 = currentQuat * inverse(initialQuat) → direction에 적용
    var scene = this._findScene();
    if (!scene) return;
    var skyMesh = null;
    for (var i = 0; i < scene.children.length; i++) {
        if (scene.children[i]._isParallaxSky) {
            skyMesh = scene.children[i];
            break;
        }
    }
    if (!skyMesh) return;

    // 초기 quaternion 캐시 (rotation.x=π/2, y=0, z=0)
    if (!this._skyInitQuat) {
        this._skyInitQuat = new THREE.Quaternion();
        this._skyInitQuat.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ'));
    }

    // 변화량 quaternion = inverse(initial) * current
    var currentQuat = skyMesh.quaternion;
    var invInitial = this._skyInitQuat.clone().invert();
    var deltaQuat = new THREE.Quaternion().multiplyQuaternions(invInitial, currentQuat);

    // sunLights target을 화면 중심에 추적 (메인 디렉셔널과 동일)
    var vw = (typeof Graphics !== 'undefined' ? Graphics._width : 816);
    var vh = (typeof Graphics !== 'undefined' ? Graphics._height : 624);
    var cx = vw / 2;
    var cy = vh / 2;

    // _sunLights 배열과 1:1 대응 (메인 디렉셔널은 건드리지 않음)
    for (var si = 0; si < this._sunLightsData.length; si++) {
        if (!this._sunLights[si]) continue;
        var sl = this._sunLightsData[si];
        var dir = sunUVToDirection(sl.position[0], sl.position[1]);
        var dirVec = new THREE.Vector3(dir.x, dir.y, dir.z);
        dirVec.applyQuaternion(deltaQuat);
        // target 추적 + target 기준으로 position 설정
        this._sunLights[si].target.position.set(cx, cy, 0);
        this._sunLights[si].target.updateMatrixWorld();
        this._sunLights[si].position.set(
            cx - dirVec.x * 1000,
            cy - dirVec.y * 1000,
            -dirVec.z * 1000
        );
    }

    // 디버그 화살표 + 라벨 업데이트 (_sunLights와 1:1)
    if (this._debugLightArrowsVisible && this._debugLightArrows && this._debugLightArrows.length > 0) {
        var vw2 = (typeof Graphics !== 'undefined' ? Graphics._width : 816) / 2;
        var vh2 = (typeof Graphics !== 'undefined' ? Graphics._height : 624) / 2;
        var target3 = new THREE.Vector3(vw2, vh2, 0);
        var arrowLen = 400;

        for (var ai = 0; ai < this._sunLights.length && ai < this._debugLightArrows.length; ai++) {
            var sPos = this._sunLights[ai].position;
            var sDir = new THREE.Vector3().subVectors(target3, sPos).normalize();
            var sStart = new THREE.Vector3().copy(target3).addScaledVector(sDir, -arrowLen);
            // 화살표 위치/회전
            var sGrp = this._debugLightArrows[ai];
            var sQuat = new THREE.Quaternion();
            sQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sDir);
            sGrp.quaternion.copy(sQuat);
            sGrp.position.copy(sStart);
            // 라벨 위치
            if (this._debugLightLabels && this._debugLightLabels[ai]) {
                this._debugLightLabels[ai].position.copy(sStart).addScaledVector(sDir, -30);
            }
        }
    }
};

ShadowLight._removeLightsFromScene = function(scene) {
    if (this._ambientLight) {
        scene.remove(this._ambientLight);
        this._ambientLight = null;
    }
    if (this._directionalLight) {
        scene.remove(this._directionalLight.target);
        scene.remove(this._directionalLight);
        this._directionalLight = null;
    }
    // SpotLight 제거
    if (this._playerSpotLight) {
        if (this._playerSpotTarget) scene.remove(this._playerSpotTarget);
        scene.remove(this._playerSpotLight);
        this._playerSpotLight = null;
        this._playerSpotTarget = null;
    }
    // sunLights 제거
    if (this._sunLights) {
        for (var i = 0; i < this._sunLights.length; i++) {
            scene.remove(this._sunLights[i].target);
            scene.remove(this._sunLights[i]);
        }
        this._sunLights = [];
    }
    // 디버그 화살표 제거
    this._removeLightArrows();
    // 포인트 라이트 제거
    for (var i = 0; i < this._pointLights.length; i++) {
        if (this._pointLights[i].parent) {
            this._pointLights[i].parent.remove(this._pointLights[i]);
        }
    }
    this._pointLights = [];
};

//=============================================================================
// 광원 방향 디버그 화살표 생성/제거 (디버그 패널에서 토글)
//=============================================================================
ShadowLight._createThickArrow = function(from, to, color) {
    var group = new THREE.Group();
    var dir = new THREE.Vector3().subVectors(to, from);
    var totalLen = dir.length();
    dir.normalize();
    var shaftLen = totalLen * 0.75;
    var headLen = totalLen * 0.25;
    var mat = new THREE.MeshBasicMaterial({ color: color, depthTest: false, transparent: true, opacity: 0.85 });

    var shaftGeo = new THREE.CylinderGeometry(6, 6, shaftLen, 8);
    shaftGeo.translate(0, shaftLen / 2, 0);
    group.add(new THREE.Mesh(shaftGeo, mat));

    var coneGeo = new THREE.ConeGeometry(18, headLen, 8);
    coneGeo.translate(0, shaftLen + headLen / 2, 0);
    group.add(new THREE.Mesh(coneGeo, mat));

    var quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.quaternion.copy(quat);
    group.position.copy(from);
    group.traverse(function(child) { child.frustumCulled = false; });
    group.renderOrder = 9999;
    return group;
};

ShadowLight._showLightArrows = function() {
    this._removeLightArrows();
    var scene = this._findScene();
    if (!scene) return;
    this._debugLightArrows = [];     // 화살표 Group만 (sunLights와 1:1)
    this._debugLightLabels = [];     // 라벨 Mesh들 (제거용)
    this._debugLightArrowsVisible = true;

    var vw2 = (typeof Graphics !== 'undefined' ? Graphics._width : 816) / 2;
    var vh2 = (typeof Graphics !== 'undefined' ? Graphics._height : 624) / 2;
    var target3 = new THREE.Vector3(vw2, vh2, 0);
    var arrowLen = 400;
    var colors = [0xffff00, 0xff4444, 0x44ff44, 0x4444ff, 0xff44ff];

    // sunLights만 화살표 표시 (메인 디렉셔널은 sunLights 있을 때 비활성)
    for (var i = 0; i < this._sunLights.length; i++) {
        var light = this._sunLights[i];
        var label = 'sunLights[' + i + ']';
        var lPos = light.position;
        var lDir = new THREE.Vector3().subVectors(target3, lPos).normalize();
        var start = new THREE.Vector3().copy(target3).addScaledVector(lDir, -arrowLen);
        var arrow = this._createThickArrow(start, target3, colors[i % colors.length]);
        scene.add(arrow);
        this._debugLightArrows.push(arrow);

        // 텍스트 라벨 (Mode3D Y-반전 보정)
        var canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 64;
        var ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, 512, 64);
        ctx.fillStyle = '#' + (colors[i % colors.length]).toString(16).padStart(6, '0');
        ctx.font = 'bold 28px monospace';
        ctx.fillText(label, 8, 42);
        ctx.restore();
        var tex = new THREE.CanvasTexture(canvas);
        var labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide });
        var labelGeo = new THREE.PlaneGeometry(200, 25);
        var labelMesh = new THREE.Mesh(labelGeo, labelMat);
        labelMesh.position.copy(start).addScaledVector(lDir, -30);
        labelMesh.frustumCulled = false;
        labelMesh.renderOrder = 10000;
        labelMesh.lookAt(labelMesh.position.x, labelMesh.position.y, labelMesh.position.z - 100);
        scene.add(labelMesh);
        this._debugLightLabels.push(labelMesh);

        console.log('[ShadowLight] Arrow #' + i + ':', label,
            '| visible:', light.visible,
            '| intensity:', light.intensity,
            '| pos:', lPos.toArray().map(function(v){return Math.round(v)}));
    }
};

ShadowLight._removeLightArrows = function() {
    var scene = this._findScene();
    if (!scene) return;
    var dispose = function(grp) {
        scene.remove(grp);
        grp.traverse(function(child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    };
    if (this._debugLightArrows) {
        for (var i = 0; i < this._debugLightArrows.length; i++) dispose(this._debugLightArrows[i]);
    }
    if (this._debugLightLabels) {
        for (var j = 0; j < this._debugLightLabels.length; j++) dispose(this._debugLightLabels[j]);
    }
    this._debugLightArrows = [];
    this._debugLightLabels = [];
    this._debugLightArrowsVisible = false;
};

//=============================================================================
// PointLight 풀 관리
//=============================================================================

ShadowLight._getPointLight = function() {
    var idx = this._pointLightIndex;
    if (idx >= this._pointLights.length) {
        var light = new THREE.PointLight(0xffffff, 0, 200, 0);  // decay=0: distance 기반 linear cutoff (1/d² 물리 감쇠 아님)
        this._pointLights.push(light);
    }
    var light = this._pointLights[idx];
    // scene에 직접 추가 (타일맵과 동일한 좌표계에서 작동하도록)
    var scene = this._findScene();
    if (scene && light.parent !== scene) {
        if (light.parent) light.parent.remove(light);
        scene.add(light);
    }
    light.visible = true;
    this._pointLightIndex++;
    return light;
};

ShadowLight._lastPointLightCount = 0;

ShadowLight._hideUnusedPointLights = function() {
    for (var i = this._pointLightIndex; i < this._pointLights.length; i++) {
        this._pointLights[i].visible = false;
    }
    this._pointLightIndex = 0;
};

//=============================================================================
// Planar Shadow Projection
// 광원 방향에 따라 캐릭터 형태를 바닥에 투영한 shadow mesh
//=============================================================================

ShadowLight._ensureShadowMaterial = function() {
    if (this._shadowMaterial) return;
    this._shadowMaterial = new THREE.MeshBasicMaterial({
        color: this.config.shadowColor,
        transparent: true,
        opacity: this.config.shadowOpacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
};

/**
 * 캐릭터 스프라이트용 shadow mesh 생성
 * - 원본 스프라이트와 같은 PlaneGeometry를 복제하여 바닥에 눕힘
 * - 광원 방향으로 비스듬히 투영 (shear transform)
 */
ShadowLight._createShadowMesh = function() {
    this._ensureShadowMaterial();
    var geo = new THREE.PlaneGeometry(1, 1);
    var mesh = new THREE.Mesh(geo, this._shadowMaterial);
    mesh.renderOrder = 1; // 타일맵보다 나중에 렌더링하여 보이도록
    return mesh;
};

/**
 * shadow mesh를 캐릭터 스프라이트 위치에 맞게 업데이트
 * @param {THREE.Mesh} shadowMesh
 * @param {ThreeSprite} charSprite - 캐릭터 스프라이트 래퍼
 */
ShadowLight._updateShadowMesh = function(shadowMesh, charSprite) {
    var spriteObj = charSprite._threeObj;
    if (!spriteObj || !spriteObj.visible) {
        shadowMesh.visible = false;
        return;
    }

    // 씬 그래프에 아직 추가되지 않았으면 추가
    // (_threeObj.parent는 _syncHierarchy 이후에야 설정됨)
    if (!shadowMesh.parent && spriteObj.parent) {
        spriteObj.parent.add(shadowMesh);
    }
    if (!shadowMesh.parent) {
        shadowMesh.visible = false;
        return;
    }

    var fw = charSprite._frameWidth;
    var fh = charSprite._frameHeight;
    if (fw <= 0 || fh <= 0) {
        shadowMesh.visible = false;
        return;
    }

    shadowMesh.visible = true;

    // 광원 방향에서 그림자 오프셋 계산 (XY 평면 투영)
    var dir = this.config.lightDirection;
    var offsetX = -dir.x / Math.abs(dir.z || 0.01) * fh * this.config.shadowOffsetScale;
    var offsetY = -dir.y / Math.abs(dir.z || 0.01) * fh * this.config.shadowOffsetScale * 0.3;

    // shadow mesh 위치 = 캐릭터 발밑 + 광원 오프셋
    shadowMesh.position.x = spriteObj.position.x + offsetX * 0.3;
    shadowMesh.position.y = spriteObj.position.y + offsetY;
    shadowMesh.position.z = spriteObj.position.z - 0.5; // 캐릭터보다 약간 뒤에

    // shadow mesh 크기: 캐릭터 너비 유지, 높이는 압축 (바닥에 눕히기)
    shadowMesh.scale.x = spriteObj.scale.x;
    shadowMesh.scale.y = spriteObj.scale.y * 0.4; // 납작하게

    // shadow mesh 기하: 캐릭터 기하를 기반으로 shear
    var posAttr = shadowMesh.geometry.attributes.position;
    var anchorX = charSprite._anchorX;
    var anchorY = charSprite._anchorY;

    var left   = -anchorX * fw;
    var right  = (1 - anchorX) * fw;
    // 그림자는 발밑에서 펼쳐짐
    var shadowTop = -fh * 0.15;      // 살짝 위
    var shadowBottom = fh * 0.25;    // 발 아래로

    // shear: 위쪽 정점을 광원 반대쪽으로 밀기
    var shearX = offsetX * 0.5;

    posAttr.setXY(0, left + shearX,  shadowTop);     // top-left (sheared)
    posAttr.setXY(1, right + shearX, shadowTop);     // top-right (sheared)
    posAttr.setXY(2, left,           shadowBottom);   // bottom-left (바닥)
    posAttr.setXY(3, right,          shadowBottom);   // bottom-right (바닥)
    posAttr.needsUpdate = true;

    // UV: 캐릭터와 동일한 UV (실루엣 형태)
    var srcUV = charSprite._geometry.attributes.uv;
    var dstUV = shadowMesh.geometry.attributes.uv;
    if (srcUV && dstUV) {
        for (var i = 0; i < 4; i++) {
            dstUV.setXY(i, srcUV.getX(i), srcUV.getY(i));
        }
        dstUV.needsUpdate = true;
    }

    // 텍스처: 캐릭터와 같은 텍스처 사용 (알파 채널로 실루엣)
    if (charSprite._material.map !== shadowMesh.material.map) {
        // 개별 material 사용 (텍스처 다를 수 있으므로)
        shadowMesh.material = this._shadowMaterial.clone();
        shadowMesh.material.map = charSprite._material.map;
        shadowMesh.material.needsUpdate = true;
    }

    // opacity: 캐릭터 투명도에 비례
    shadowMesh.material.opacity = this.config.shadowOpacity *
        (charSprite.worldAlpha || 1);
};

//=============================================================================
// Spriteset_Map 통합
//=============================================================================

var _Spriteset_Map_initialize = Spriteset_Map.prototype.initialize;
Spriteset_Map.prototype.initialize = function() {
    _Spriteset_Map_initialize.call(this);
    ShadowLight._spriteset = this;
};

var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
Spriteset_Map.prototype.createCharacters = function() {
    _Spriteset_Map_createCharacters.call(this);
    // 각 캐릭터 스프라이트에 shadow mesh 생성
    // 주의: 이 시점에서는 _threeObj.parent가 아직 null이므로
    // 씬 그래프 추가는 update 루프에서 수행
    this._shadowMeshes = [];
    for (var i = 0; i < this._characterSprites.length; i++) {
        var shadowMesh = ShadowLight._createShadowMesh();
        this._shadowMeshes.push(shadowMesh);
    }
};

var _Spriteset_Map_update = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update.call(this);
    this._updateShadowLight();
};

Spriteset_Map.prototype._updateShadowLight = function() {
    var enabled = ConfigManager.shadowLight;

    // editorLights.enabled === false이면 ShadowLight 비활성화 (MeshBasicMaterial 복원)
    var elRaw = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
    var elGlobalOff = elRaw && elRaw.enabled === false;
    if (elGlobalOff) enabled = false;

    if (enabled && !ShadowLight._active) {
        // 활성화
        this._activateShadowLight();
        // scene을 못 찾으면 다음 프레임에서 재시도
        ShadowLight._active = !!ShadowLight._ambientLight;
    } else if (!enabled && ShadowLight._active) {
        // 비활성화
        this._deactivateShadowLight();
        ShadowLight._active = false;
    }

    if (!enabled) return;

    // DirectionalLight shadow camera를 화면 중심으로 추적
    if (ShadowLight._directionalLight) {
        var vw = Graphics._width || 816;
        var vh = Graphics._height || 624;
        var cx = vw / 2;
        var cy = vh / 2;
        var dir = ShadowLight.config.lightDirection;
        ShadowLight._directionalLight.position.set(
            cx - dir.x * 1000,
            cy - dir.y * 1000,
            -dir.z * 1000
        );
        ShadowLight._directionalLight.target.position.set(cx, cy, 0);
        ShadowLight._directionalLight.target.updateMatrixWorld();
        ShadowLight._directionalLight.shadow.camera.updateProjectionMatrix();
    }

    // customDepthMaterial.map 동기화 (텍스처 로드 후 stale 방지)
    ShadowLight._syncCustomDepthMaps(this._characterSprites);
    ShadowLight._syncCustomDepthMaps(this._objectSprites);

    // shadow mesh 업데이트
    if (this._shadowMeshes) {
        for (var i = 0; i < this._characterSprites.length; i++) {
            if (i < this._shadowMeshes.length) {
                ShadowLight._updateShadowMesh(
                    this._shadowMeshes[i],
                    this._characterSprites[i]
                );
            }
        }
    }

    // 플레이어 포인트 라이트
    this._updatePointLights();

    // 프록시 박스 라이팅: 정면 외 5방향의 추가 조명을 emissive에 반영
    // (PointLight 위치 갱신 후에 호출해야 정확한 계산)
    ShadowLight._updateProxyBoxLighting(this._characterSprites);
    // 오브젝트 스프라이트에도 적용 (container + 자식 tileSprite)
    ShadowLight._updateProxyBoxLighting(this._objectSprites, true);

    // 카메라 존 환경광 lerp 보간
    ShadowLight._updateCameraZoneAmbient();

    // sunLights 방향을 스카이 스피어 회전에 동기화
    ShadowLight._updateSunLightDirections();
};

Spriteset_Map.prototype._activateShadowLight = function() {
    var scene = ShadowLight._findScene();
    if (scene) {
        ShadowLight._addLightsToScene(scene);
    }
    // 캐릭터 스프라이트 material 교체
    if (this._characterSprites) {
        for (var i = 0; i < this._characterSprites.length; i++) {
            ShadowLight._convertMaterial(this._characterSprites[i]);
        }
    }
    // 오브젝트 스프라이트 material 교체 (container + 자식 tileSprite)
    if (this._objectSprites) {
        for (var i = 0; i < this._objectSprites.length; i++) {
            var container = this._objectSprites[i];
            ShadowLight._convertMaterial(container);
            if (container.children) {
                for (var j = 0; j < container.children.length; j++) {
                    ShadowLight._convertMaterial(container.children[j]);
                }
            }
        }
    }

    // 타일맵 메시 재생성 (MeshPhongMaterial로 새로 생성되도록)
    ShadowLight._resetTilemapMeshes(this._tilemap);

    // upperZLayer를 z 방향으로 상승시켜 PointLight 조명 효과 개선
    // tileLayerElevation이 비활성화면 상승하지 않음
    if (this._tilemap && this._tilemap.upperZLayer) {
        var elevationEnabled = $dataMap && $dataMap.tileLayerElevation;
        this._tilemap.upperZLayer._zIndex = elevationEnabled ? ShadowLight.config.upperLayerZ : 0;
    }

    // 디버그 UI 생성 (에디터 모드가 아니고, ?dev=true 일 때만)
    if (!window.__editorMode && /[?&]dev=true/.test(window.location.search)) {
        ShadowLight._createDebugUI();
    }

    // shadow mesh는 _updateShadowMesh에서 parent 설정 및 표시됨
};

Spriteset_Map.prototype._deactivateShadowLight = function() {
    ShadowLight._removeProbeDebugVis();
    ShadowLight._removeDebugUI();
    var scene = ShadowLight._findScene();
    if (scene) {
        ShadowLight._removeLightsFromScene(scene);
    }
    // material 복원
    if (this._characterSprites) {
        for (var i = 0; i < this._characterSprites.length; i++) {
            ShadowLight._revertMaterial(this._characterSprites[i]);
        }
    }
    // 오브젝트 스프라이트 material 복원
    if (this._objectSprites) {
        for (var i = 0; i < this._objectSprites.length; i++) {
            var container = this._objectSprites[i];
            ShadowLight._revertMaterial(container);
            if (container.children) {
                for (var j = 0; j < container.children.length; j++) {
                    ShadowLight._revertMaterial(container.children[j]);
                }
            }
        }
    }

    // 타일맵 material 복원
    ShadowLight._revertTilemapMaterials(this._tilemap);

    // upperZLayer z 위치 복원
    if (this._tilemap && this._tilemap.upperZLayer) {
        var elevationEnabled = $dataMap && $dataMap.tileLayerElevation;
        this._tilemap.upperZLayer._zIndex = elevationEnabled ? 4 : 0;
        this._tilemap.upperZLayer._threeObj.position.z = elevationEnabled ? 4 : 0;
    }

    // shadow mesh 숨기기 및 씬 그래프에서 제거
    if (this._shadowMeshes) {
        for (var i = 0; i < this._shadowMeshes.length; i++) {
            this._shadowMeshes[i].visible = false;
            if (this._shadowMeshes[i].parent) {
                this._shadowMeshes[i].parent.remove(this._shadowMeshes[i]);
            }
        }
    }
};

/**
 * wrapper hierarchy의 _x, _y를 부모 체인 따라 합산하여 월드 좌표 계산
 * (Three.js의 matrixWorld는 syncTransform 이전에 호출하면 부정확)
 */
ShadowLight._getWrapperWorldPos = function(wrapper) {
    var wx = 0, wy = 0;
    var cur = wrapper;
    while (cur) {
        wx += (cur._x || 0);
        wy += (cur._y || 0);
        cur = cur.parent;
    }
    return { x: wx, y: wy };
};

/**
 * RPG Maker MV direction을 XY 오프셋으로 변환
 * 2=아래(Y+), 4=왼쪽(X-), 6=오른쪽(X+), 8=위(Y-)
 */
ShadowLight._directionToOffset = function(d, dist) {
    switch (d) {
        case 2:  return { x: 0, y: dist };    // 아래
        case 4:  return { x: -dist, y: 0 };   // 왼쪽
        case 6:  return { x: dist, y: 0 };    // 오른쪽
        case 8:  return { x: 0, y: -dist };   // 위
        default: return { x: 0, y: dist };     // 기본: 아래
    }
};

Spriteset_Map.prototype._updatePointLights = function() {
    ShadowLight._pointLightIndex = 0;

    // 플레이어 라이트 (PointLight - 횃불 효과, 플레이어가 보일 때만)
    var playerWp = null;
    var plEnabled = ShadowLight.config.playerLightEnabled !== false;
    if ($gamePlayer) {
        var playerSprite = this._getPlayerSprite();
        if (playerSprite) {
            playerWp = ShadowLight._getWrapperWorldPos(playerSprite);
        }
        // playerLightEnabled === false이면 스킵
        if (!$gamePlayer.isTransparent() && playerWp && plEnabled && ShadowLight._debugPlayerLightOverride) {
            var light = ShadowLight._getPointLight();
            var plCfg = ShadowLight.config;
            light.color.setHex(plCfg.playerLightColor);
            light.intensity = plCfg.playerLightIntensity;
            light.distance = plCfg.playerLightDistance;
            light.decay = ShadowLight._debugDecay !== undefined ? ShadowLight._debugDecay : 0;
            light.position.set(playerWp.x, playerWp.y - 24, plCfg.playerLightZ);
        }
    }

    // SpotLight 위치/방향 업데이트
    // 디버그 우선 OFF → 스포트라이트 비활성, ON → 패널(config) 값 사용
    var spotEnabled = ShadowLight._debugSpotLightOverride;
    if (ShadowLight._playerSpotLight && spotEnabled && playerWp &&
        $gamePlayer && !$gamePlayer.isTransparent()) {
        var spot = ShadowLight._playerSpotLight;
        spot.visible = true;
        var cfg = ShadowLight.config;
        spot.color.setHex(cfg.spotLightColor);
        spot.intensity = cfg.spotLightIntensity;
        spot.distance = cfg.spotLightDistance;
        spot.angle = cfg.spotLightAngle;
        spot.penumbra = cfg.spotLightPenumbra;
        spot.decay = ShadowLight._debugDecay !== undefined ? ShadowLight._debugDecay : 0;

        // SpotLight를 플레이어 위치 위에 배치
        spot.position.set(playerWp.x, playerWp.y - 24, cfg.spotLightZ);

        // target을 플레이어가 바라보는 방향으로 설정
        var dir = $gamePlayer.direction();
        var spotTDist = cfg.spotLightTargetDistance;
        var off = ShadowLight._directionToOffset(dir, spotTDist);
        ShadowLight._playerSpotTarget.position.set(
            playerWp.x + off.x,
            playerWp.y - 24 + off.y,
            0  // 바닥 레벨
        );
        ShadowLight._playerSpotTarget.updateMatrixWorld();
    }

    // SpotLight가 비활성이면 숨기기
    if (ShadowLight._playerSpotLight && (!spotEnabled || !playerWp)) {
        ShadowLight._playerSpotLight.visible = false;
    }

    // 이벤트 라이트 (<light> 노트 태그)
    var events = $gameMap.events();
    for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (!ev || ev.isTransparent()) continue;
        var note = ev.event() ? ev.event().note || '' : '';
        var lightMatch = note.match(/<light(?:\s*:\s*(\d+)(?:\s*,\s*#?([0-9a-fA-F]{6}))?)?>/i);
        if (lightMatch) {
            var evSprite = this._getEventSprite(ev);
            if (evSprite) {
                var light = ShadowLight._getPointLight();
                var dist = lightMatch[1] ? parseInt(lightMatch[1]) : 150;
                var color = lightMatch[2] ? parseInt(lightMatch[2], 16) : 0xffcc88;
                light.color.setHex(color);
                light.intensity = 1.0;
                light.distance = dist;
                light.decay = ShadowLight._debugDecay !== undefined ? ShadowLight._debugDecay : 0;
                var wp = ShadowLight._getWrapperWorldPos(evSprite);
                light.position.set(wp.x, wp.y - 24, ShadowLight.config.playerLightZ);
            }
        }
    }

    // 에디터에서 배치한 포인트 라이트 ($dataMap.editorLights.points)
    var elRaw2 = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
    var el = (elRaw2 && elRaw2.enabled !== false) ? elRaw2 : null;
    if (el && el.points) {
        var tw = $gameMap.tileWidth();
        var th = $gameMap.tileHeight();
        for (var j = 0; j < el.points.length; j++) {
            var pl = el.points[j];
            var light = ShadowLight._getPointLight();
            light.color.setHex(parseInt(pl.color.replace('#', ''), 16));
            light.intensity = pl.intensity;
            light.distance = pl.distance;
            light.decay = pl.decay || 0;
            // 타일 좌표 → 화면 좌표 (스크롤 반영)
            var sx = Math.round($gameMap.adjustX(pl.x) * tw + tw / 2);
            var sy = Math.round($gameMap.adjustY(pl.y) * th + th / 2);
            light.position.set(sx, sy, pl.z || ShadowLight.config.playerLightZ);
        }
    }

    // PointLight 개수 변경 시 타일맵 material 셰이더 재컴파일
    // (_hideUnusedPointLights가 _pointLightIndex를 0으로 리셋하므로 먼저 저장)
    var activeCount = ShadowLight._pointLightIndex;
    ShadowLight._hideUnusedPointLights();

    if (activeCount !== ShadowLight._lastPointLightCount) {
        ShadowLight._lastPointLightCount = activeCount;
        ShadowLight._invalidateTilemapMaterials(this._tilemap);
    }
};

/**
 * 타일맵 MeshLambertMaterial의 needsUpdate를 설정하여 셰이더 재컴파일 트리거
 * (scene의 라이트 구성이 변경되면 셰이더에 새 라이트를 반영해야 함)
 */
ShadowLight._invalidateTilemapMaterials = function(tilemap) {
    if (!tilemap) return;
    var zLayers = [tilemap.lowerZLayer, tilemap.upperZLayer];
    for (var z = 0; z < zLayers.length; z++) {
        var zLayer = zLayers[z];
        if (!zLayer || !zLayer.children) continue;
        for (var c = 0; c < zLayer.children.length; c++) {
            var composite = zLayer.children[c];
            if (!composite || !composite.children) continue;
            for (var r = 0; r < composite.children.length; r++) {
                var rectLayer = composite.children[r];
                if (!rectLayer || !rectLayer._meshes) continue;
                for (var key in rectLayer._meshes) {
                    var mesh = rectLayer._meshes[key];
                    if (mesh && mesh.material && mesh.material.isMeshPhongMaterial) {
                        mesh.material.needsUpdate = true;
                    }
                }
            }
        }
    }
};

Spriteset_Map.prototype._getPlayerSprite = function() {
    if (!this._characterSprites) return null;
    for (var i = 0; i < this._characterSprites.length; i++) {
        if (this._characterSprites[i]._character === $gamePlayer) {
            return this._characterSprites[i];
        }
    }
    return null;
};

Spriteset_Map.prototype._getEventSprite = function(event) {
    if (!this._characterSprites) return null;
    for (var i = 0; i < this._characterSprites.length; i++) {
        if (this._characterSprites[i]._character === event) {
            return this._characterSprites[i];
        }
    }
    return null;
};

//=============================================================================
// Sprite_Character - 새로 생성된 캐릭터도 material 교체
//=============================================================================

var _Sprite_Character_updateBitmap = Sprite_Character.prototype.updateBitmap;
Sprite_Character.prototype.updateBitmap = function() {
    _Sprite_Character_updateBitmap.call(this);
    if (!ShadowLight._active || !this._material) return;
    // material이 교체되면 다시 변환
    if (!this._material.isMeshPhongMaterial) {
        ShadowLight._convertMaterial(this);
    }
    // customDepthMaterial.map을 현재 material.map과 동기화
    // (텍스처 로드/변경 시 customDepthMaterial.map이 stale해지는 것 방지)
    if (this._threeObj && this._threeObj.customDepthMaterial &&
        this._material.map && this._threeObj.customDepthMaterial.map !== this._material.map) {
        this._threeObj.customDepthMaterial.map = this._material.map;
        this._threeObj.customDepthMaterial.needsUpdate = true;
    }
};

//=============================================================================
// Graphics - rendererObj 참조 저장
//=============================================================================

var _Graphics_createRenderer = Graphics._createRenderer;
Graphics._createRenderer = function() {
    _Graphics_createRenderer.call(this);
    // rendererObj 참조를 저장 (scene 접근용)
    Graphics._rendererObj = this._renderer;
};

//=============================================================================
// 디버그 UI - 화면 오른쪽 상단에 라이팅 파라미터 실시간 조절
//=============================================================================

ShadowLight._createDebugUI = function() {
    if (this._debugPanel) return;

    var PANEL_ID = 'mapInspector';
    var SECTION_STORAGE_KEY = 'devPanel_mapInspector_sections';
    var CONFIG_STORAGE_KEY = 'devPanel_mapInspector_config';

    // Load/save section collapsed states
    var sectionStates = {};
    try {
        var raw = localStorage.getItem(SECTION_STORAGE_KEY);
        if (raw) sectionStates = JSON.parse(raw);
    } catch (e) {}
    function saveSectionStates() {
        try { localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sectionStates)); } catch (e) {}
    }

    // config 변경 시 localStorage에 저장 (새로고침 후 복구용)
    var self = this;
    function saveConfigToStorage() {
        try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(self.config)); } catch (e) {}
    }

    var panel = document.createElement('div');
    panel.id = 'sl-debug-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:rgba(0,0,0,0.85);color:#eee;font:12px monospace;padding:10px;border-radius:6px;min-width:220px;pointer-events:auto;';

    var title = document.createElement('div');
    title.textContent = '맵 인스펙터';
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#ffcc88;display:flex;align-items:center;';
    panel.appendChild(title);

    var sectionStyle = 'border-top:1px solid #444;padding-top:6px;margin-top:6px;';

    // 정수 색상값을 #rrggbb 문자열로 변환하는 헬퍼
    function intToHex(colorInt) {
        if (typeof colorInt === 'string') return colorInt;
        return '#' + ('000000' + (colorInt >>> 0).toString(16)).slice(-6);
    }

    // 슬라이더 행 생성 헬퍼
    function addSliderRow(parent, c) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';

        var lbl = document.createElement('span');
        lbl.textContent = c.label;
        lbl.style.cssText = 'width:70px;font-size:11px;';

        var slider = document.createElement('input');
        slider.type = 'range';
        slider.min = c.min;
        slider.max = c.max;
        slider.step = c.step;
        slider.value = self.config[c.key];
        slider.style.cssText = 'width:90px;height:14px;';

        var val = document.createElement('span');
        val.textContent = parseFloat(self.config[c.key]).toFixed(1);
        val.style.cssText = 'width:40px;font-size:11px;text-align:right;';

        slider.addEventListener('input', function() {
            var v = parseFloat(slider.value);
            self.config[c.key] = v;
            val.textContent = v.toFixed(c.step < 1 ? (c.step < 0.01 ? 4 : 2) : 0);
            if (c.key === 'ambientIntensity' && self._ambientLight) {
                self._ambientLight.intensity = v;
            }
            if (c.key === 'directionalIntensity' && self._directionalLight) {
                self._directionalLight.intensity = v;
            }
            if (c.key === 'shadowBias' && self._directionalLight) {
                self._directionalLight.shadow.bias = v;
            }
            if (c.key === 'shadowNear' && self._directionalLight) {
                self._directionalLight.shadow.camera.near = v;
                self._directionalLight.shadow.camera.updateProjectionMatrix();
            }
            if (c.key === 'shadowFar' && self._directionalLight) {
                self._directionalLight.shadow.camera.far = v;
                self._directionalLight.shadow.camera.updateProjectionMatrix();
            }
            if (c.key === 'upperLayerZ') {
                var ss = self._spriteset;
                if (ss && ss._tilemap && ss._tilemap.upperZLayer) {
                    ss._tilemap.upperZLayer._zIndex = v;
                }
            }
            if (c.key === 'shadowOpacity') {
                var ss = self._spriteset;
                if (ss && ss._shadowMeshes) {
                    ss._shadowMeshes.forEach(function(m) {
                        if (m.material) m.material.opacity = v;
                    });
                }
            }
            if (c.key === 'shadowRadius') {
                if (self._directionalLight) {
                    self._directionalLight.shadow.radius = v;
                }
                if (self._playerSpotLight) {
                    self._playerSpotLight.shadow.radius = v;
                }
            }
            saveConfigToStorage();
        });

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(val);
        parent.appendChild(row);
    }

    // 컬러 피커 행 생성 헬퍼
    function addColorRow(parent, cc) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';

        var lbl = document.createElement('span');
        lbl.textContent = cc.label;
        lbl.style.cssText = 'width:70px;font-size:11px;';

        var initColor = intToHex(self.config[cc.key]);
        var colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = initColor;
        colorInput.style.cssText = 'width:40px;height:20px;border:1px solid #555;background:#333;cursor:pointer;';

        var hexVal = document.createElement('span');
        hexVal.textContent = initColor;
        hexVal.style.cssText = 'font-size:11px;color:#aaa;';

        colorInput.addEventListener('input', function() {
            var hex = colorInput.value;
            var colorInt = parseInt(hex.replace('#', ''), 16);
            self.config[cc.key] = colorInt;
            hexVal.textContent = hex;
            if (cc.key === 'playerLightColor') {
                if (self._lightPool) {
                    self._lightPool.forEach(function(l) {
                        if (l.parent) l.color.setHex(colorInt);
                    });
                }
            }
            if (cc.key === 'ambientColor' && self._ambientLight) {
                self._ambientLight.color.setHex(colorInt);
            }
            if (cc.key === 'directionalColor' && self._directionalLight) {
                self._directionalLight.color.setHex(colorInt);
            }
            if (cc.key === 'spotLightColor' && self._playerSpotLight) {
                self._playerSpotLight.color.setHex(colorInt);
            }
            if (cc.key === 'shadowColor') {
                if (self._shadowMaterial) self._shadowMaterial.color.setHex(colorInt);
                // clone된 개별 shadow mesh material도 업데이트
                var ss = self._spriteset;
                if (ss && ss._shadowMeshes) {
                    ss._shadowMeshes.forEach(function(m) {
                        if (m.material) m.material.color.setHex(colorInt);
                    });
                }
            }
            saveConfigToStorage();
        });

        row.appendChild(lbl);
        row.appendChild(colorInput);
        row.appendChild(hexVal);
        parent.appendChild(row);
    }

    // 접기/펼치기 가능한 섹션 생성 헬퍼 (localStorage 저장)
    // defaultCollapsed: 초기 접힘 상태 (기본 false = 펼침)
    function createSection(parent, label, color, defaultCollapsed) {
        var sectionKey = label; // use label as key
        var isCollapsed = sectionStates.hasOwnProperty(sectionKey) ? sectionStates[sectionKey] : defaultCollapsed;

        var wrapper = document.createElement('div');
        wrapper.style.cssText = sectionStyle;

        var header = document.createElement('div');
        header.style.cssText = 'font-weight:bold;font-size:11px;color:' + color + ';cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px;';
        var arrow = document.createElement('span');
        arrow.textContent = isCollapsed ? '\u25B6' : '\u25BC';
        arrow.style.cssText = 'font-size:9px;width:10px;';
        var labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        header.appendChild(arrow);
        header.appendChild(labelSpan);
        wrapper.appendChild(header);

        var body = document.createElement('div');
        body.style.display = isCollapsed ? 'none' : '';
        wrapper.appendChild(body);

        header.addEventListener('click', function() {
            var isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            arrow.textContent = isHidden ? '\u25BC' : '\u25B6';
            sectionStates[sectionKey] = !isHidden;
            saveSectionStates();
        });

        parent.appendChild(wrapper);
        return body;
    }

    // ── 카메라 섹션 ──
    var camBody = createSection(panel, '카메라', '#88ff88', false);

    // Tilt (기울기 각도)
    (function() {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
        var lbl = document.createElement('span');
        lbl.textContent = 'Tilt';
        lbl.style.cssText = 'width:70px;font-size:11px;';
        var slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 80;
        slider.step = 1;
        slider.value = window.Mode3D ? Mode3D._tiltDeg : 60;
        slider.style.cssText = 'width:90px;height:14px;';
        var val = document.createElement('span');
        val.textContent = slider.value + '°';
        val.style.cssText = 'width:40px;font-size:11px;text-align:right;';
        slider.addEventListener('input', function() {
            var v = parseFloat(slider.value);
            val.textContent = v + '°';
            if (window.Mode3D) {
                Mode3D._tiltDeg = v;
                Mode3D._tiltRad = v * Math.PI / 180;
            }
        });
        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(val);
        camBody.appendChild(row);
    })();

    // FOV (시야각)
    (function() {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
        var lbl = document.createElement('span');
        lbl.textContent = 'FOV';
        lbl.style.cssText = 'width:70px;font-size:11px;';
        var slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 20;
        slider.max = 120;
        slider.step = 1;
        slider.value = (window.Mode3D && Mode3D._perspCamera) ? Mode3D._perspCamera.fov : 60;
        slider.style.cssText = 'width:90px;height:14px;';
        var val = document.createElement('span');
        val.textContent = slider.value + '°';
        val.style.cssText = 'width:40px;font-size:11px;text-align:right;';
        slider.addEventListener('input', function() {
            var v = parseFloat(slider.value);
            val.textContent = v + '°';
            if (window.Mode3D && Mode3D._perspCamera) {
                Mode3D._perspCamera.fov = v;
                Mode3D._perspCamera.updateProjectionMatrix();
            }
        });
        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(val);
        camBody.appendChild(row);
    })();

    // Extra Rows (3D 모드 여분 타일 행)
    (function() {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
        var lbl = document.createElement('span');
        lbl.textContent = 'ExtraRows';
        lbl.style.cssText = 'width:70px;font-size:11px;';
        var slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 20;
        slider.step = 1;
        slider.value = window.Mode3D ? (Mode3D._extraRows || 6) : 6;
        slider.style.cssText = 'width:90px;height:14px;';
        var val = document.createElement('span');
        val.textContent = slider.value;
        val.style.cssText = 'width:40px;font-size:11px;text-align:right;';
        slider.addEventListener('input', function() {
            var v = parseInt(slider.value);
            val.textContent = v;
            if (window.Mode3D) {
                Mode3D._extraRows = v;
            }
        });
        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(val);
        camBody.appendChild(row);
    })();

    // ── 환경광 섹션 ──
    var envBody = createSection(panel, '환경광', '#88ccff', false);

    // 디버그 패널 우선 적용 체크박스 (환경광)
    var AMBIENT_OVERRIDE_KEY = 'devPanel_ambientOverride';
    var ambientOverrideRow = document.createElement('div');
    ambientOverrideRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var ambientOverrideLbl = document.createElement('span');
    ambientOverrideLbl.textContent = '디버그 우선';
    ambientOverrideLbl.style.cssText = 'width:70px;font-size:11px;color:#f8a;';
    var ambientOverrideCheck = document.createElement('input');
    ambientOverrideCheck.type = 'checkbox';
    try { ambientOverrideCheck.checked = localStorage.getItem(AMBIENT_OVERRIDE_KEY) === 'true'; } catch (e) {}
    self._debugAmbientOverride = ambientOverrideCheck.checked;
    ambientOverrideCheck.addEventListener('change', function() {
        self._debugAmbientOverride = ambientOverrideCheck.checked;
        try { localStorage.setItem(AMBIENT_OVERRIDE_KEY, ambientOverrideCheck.checked ? 'true' : 'false'); } catch (e) {}
        if (!ambientOverrideCheck.checked && self._ambientLight) {
            // 끄면 맵 데이터로 즉시 복원
            self._currentAmbientIntensity = null; // lerp 재초기화
        }
    });
    ambientOverrideRow.appendChild(ambientOverrideLbl);
    ambientOverrideRow.appendChild(ambientOverrideCheck);
    var ambientOverrideHint = document.createElement('span');
    ambientOverrideHint.textContent = 'ON: 패널 값 사용';
    ambientOverrideHint.style.cssText = 'font-size:10px;color:#888;';
    ambientOverrideRow.appendChild(ambientOverrideHint);
    envBody.appendChild(ambientOverrideRow);

    addSliderRow(envBody, { label: 'Ambient', key: 'ambientIntensity', min: 0, max: 3, step: 0.05 });
    addColorRow(envBody, { label: 'Ambient Color', key: 'ambientColor' });

    // ── 디렉셔널 라이트 섹션 ──
    var dirBody = createSection(panel, '방향 조명', '#aaddff', true);

    // 디버그 패널 우선 적용 체크박스 (디렉셔널)
    var DIR_OVERRIDE_KEY = 'devPanel_directionalOverride';
    var dirOverrideRow = document.createElement('div');
    dirOverrideRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var dirOverrideLbl = document.createElement('span');
    dirOverrideLbl.textContent = '디버그 우선';
    dirOverrideLbl.style.cssText = 'width:70px;font-size:11px;color:#f8a;';
    var dirOverrideCheck = document.createElement('input');
    dirOverrideCheck.type = 'checkbox';
    try { dirOverrideCheck.checked = localStorage.getItem(DIR_OVERRIDE_KEY) === 'true'; } catch (e) {}
    self._debugDirectionalOverride = dirOverrideCheck.checked;
    dirOverrideCheck.addEventListener('change', function() {
        self._debugDirectionalOverride = dirOverrideCheck.checked;
        try { localStorage.setItem(DIR_OVERRIDE_KEY, dirOverrideCheck.checked ? 'true' : 'false'); } catch (e) {}
    });
    dirOverrideRow.appendChild(dirOverrideLbl);
    dirOverrideRow.appendChild(dirOverrideCheck);
    var dirOverrideHint = document.createElement('span');
    dirOverrideHint.textContent = 'ON: 패널 값 사용';
    dirOverrideHint.style.cssText = 'font-size:10px;color:#888;';
    dirOverrideRow.appendChild(dirOverrideHint);
    dirBody.appendChild(dirOverrideRow);

    addSliderRow(dirBody, { label: 'Dir Int', key: 'directionalIntensity', min: 0, max: 3, step: 0.05 });
    addColorRow(dirBody, { label: 'Dir Color', key: 'directionalColor' });

    // Direction X/Y/Z 슬라이더
    ['x', 'y', 'z'].forEach(function(axis, idx) {
        var dirRow = document.createElement('div');
        dirRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
        var dirLbl = document.createElement('span');
        dirLbl.textContent = 'Dir ' + axis.toUpperCase();
        dirLbl.style.cssText = 'width:70px;font-size:11px;';
        var dirSlider = document.createElement('input');
        dirSlider.type = 'range';
        dirSlider.min = -5;
        dirSlider.max = 5;
        dirSlider.step = 0.1;
        dirSlider.value = self.config.lightDirection ? self.config.lightDirection.toArray()[idx] : [-1,-1,-2][idx];
        dirSlider.style.cssText = 'width:90px;height:14px;';
        var dirVal = document.createElement('span');
        dirVal.textContent = parseFloat(dirSlider.value).toFixed(1);
        dirVal.style.cssText = 'width:40px;font-size:11px;text-align:right;';
        dirSlider.addEventListener('input', function() {
            var v = parseFloat(dirSlider.value);
            dirVal.textContent = v.toFixed(1);
            var cur = self.config.lightDirection.toArray();
            cur[idx] = v;
            self.config.lightDirection = new THREE.Vector3(cur[0], cur[1], cur[2]).normalize();
            if (self._directionalLight) {
                var dir = self.config.lightDirection;
                self._directionalLight.position.set(-dir.x * 1000, -dir.y * 1000, -dir.z * 1000);
            }
            saveConfigToStorage();
        });
        dirRow.appendChild(dirLbl);
        dirRow.appendChild(dirSlider);
        dirRow.appendChild(dirVal);
        dirBody.appendChild(dirRow);
    });

    // Shadow castShadow 토글
    var shadowCastRow = document.createElement('div');
    shadowCastRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var shadowCastLbl = document.createElement('span');
    shadowCastLbl.textContent = 'Shadow';
    shadowCastLbl.style.cssText = 'width:70px;font-size:11px;';
    var shadowCastCheck = document.createElement('input');
    shadowCastCheck.type = 'checkbox';
    shadowCastCheck.checked = true;
    shadowCastCheck.addEventListener('change', function() {
        if (self._directionalLight) self._directionalLight.castShadow = shadowCastCheck.checked;
    });
    shadowCastRow.appendChild(shadowCastLbl);
    shadowCastRow.appendChild(shadowCastCheck);
    dirBody.appendChild(shadowCastRow);

    // Shadow Map Size 셀렉트
    var smapRow = document.createElement('div');
    smapRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var smapLbl = document.createElement('span');
    smapLbl.textContent = 'ShadowMap';
    smapLbl.style.cssText = 'width:70px;font-size:11px;';
    var smapSelect = document.createElement('select');
    smapSelect.style.cssText = 'font:11px monospace;background:#333;color:#eee;border:1px solid #555;';
    [512, 1024, 2048, 4096].forEach(function(sz) {
        var opt = document.createElement('option');
        opt.value = sz;
        opt.textContent = sz + '';
        smapSelect.appendChild(opt);
    });
    smapSelect.value = self.config.shadowMapSize || 2048;
    smapSelect.addEventListener('change', function() {
        var sz = parseInt(smapSelect.value);
        self.config.shadowMapSize = sz;
        if (self._directionalLight) {
            self._directionalLight.shadow.mapSize.width = sz;
            self._directionalLight.shadow.mapSize.height = sz;
            self._directionalLight.shadow.map = null; // 다시 생성되도록
        }
        saveConfigToStorage();
    });
    smapRow.appendChild(smapLbl);
    smapRow.appendChild(smapSelect);
    dirBody.appendChild(smapRow);

    addSliderRow(dirBody, { label: 'Bias', key: 'shadowBias', min: -0.01, max: 0.01, step: 0.0001 });
    addSliderRow(dirBody, { label: 'Near', key: 'shadowNear', min: 0.1, max: 100, step: 1 });
    addSliderRow(dirBody, { label: 'Far', key: 'shadowFar', min: 100, max: 20000, step: 100 });

    // ── 그림자 설정 섹션 ──
    var shadowBody = createSection(panel, '그림자 설정', '#cc99ff', true);
    addSliderRow(shadowBody, { label: 'Radius', key: 'shadowRadius', min: 0, max: 10, step: 0.5 });
    addSliderRow(shadowBody, { label: 'UpperZ', key: 'upperLayerZ', min: 0, max: 100, step: 1 });

    // ── 플레이어 라이트 섹션 ──
    var playerBody = createSection(panel, '플레이어 조명', '#ffcc66', false);

    // 디버그 패널 우선 적용 체크박스 (플레이어 라이트)
    var PLAYER_OVERRIDE_KEY = 'devPanel_playerLightOverride';
    var playerOverrideRow = document.createElement('div');
    playerOverrideRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var playerOverrideLbl = document.createElement('span');
    playerOverrideLbl.textContent = '디버그 우선';
    playerOverrideLbl.style.cssText = 'width:70px;font-size:11px;color:#f8a;';
    var playerOverrideCheck = document.createElement('input');
    playerOverrideCheck.type = 'checkbox';
    try { playerOverrideCheck.checked = localStorage.getItem(PLAYER_OVERRIDE_KEY) === 'true'; } catch (e) {}
    self._debugPlayerLightOverride = playerOverrideCheck.checked;
    playerOverrideCheck.addEventListener('change', function() {
        self._debugPlayerLightOverride = playerOverrideCheck.checked;
        try { localStorage.setItem(PLAYER_OVERRIDE_KEY, playerOverrideCheck.checked ? 'true' : 'false'); } catch (e) {}
    });
    playerOverrideRow.appendChild(playerOverrideLbl);
    playerOverrideRow.appendChild(playerOverrideCheck);
    var playerOverrideHint = document.createElement('span');
    playerOverrideHint.textContent = 'ON: 활성화';
    playerOverrideHint.style.cssText = 'font-size:10px;color:#888;';
    playerOverrideRow.appendChild(playerOverrideHint);
    playerBody.appendChild(playerOverrideRow);

    addSliderRow(playerBody, { label: 'Intensity', key: 'playerLightIntensity', min: 0, max: 5, step: 0.1 });
    addSliderRow(playerBody, { label: 'Distance', key: 'playerLightDistance', min: 50, max: 2000, step: 50 });
    addSliderRow(playerBody, { label: 'Light Z', key: 'playerLightZ', min: 0, max: 500, step: 10 });
    addColorRow(playerBody, { label: 'Light Color', key: 'playerLightColor' });

    // Decay 토글
    var decayRow = document.createElement('div');
    decayRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var decayLbl = document.createElement('span');
    decayLbl.textContent = 'Decay';
    decayLbl.style.cssText = 'width:70px;font-size:11px;';
    var decaySelect = document.createElement('select');
    decaySelect.style.cssText = 'font:11px monospace;background:#333;color:#eee;border:1px solid #555;';
    [0, 1, 2].forEach(function(d) {
        var opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        decaySelect.appendChild(opt);
    });
    decaySelect.value = '0';
    self._debugDecay = 0;
    decaySelect.addEventListener('change', function() {
        self._debugDecay = parseInt(decaySelect.value);
    });
    decayRow.appendChild(decayLbl);
    decayRow.appendChild(decaySelect);
    playerBody.appendChild(decayRow);

    // ── 스포트라이트 섹션 ──
    var spotBody = createSection(panel, '집중 조명', '#ff9966', true);

    // 디버그 패널 우선 적용 체크박스 (스포트라이트)
    var SPOT_OVERRIDE_KEY = 'devPanel_spotLightOverride';
    var spotOverrideRow = document.createElement('div');
    spotOverrideRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var spotOverrideLbl = document.createElement('span');
    spotOverrideLbl.textContent = '디버그 우선';
    spotOverrideLbl.style.cssText = 'width:70px;font-size:11px;color:#f8a;';
    var spotOverrideCheck = document.createElement('input');
    spotOverrideCheck.type = 'checkbox';
    try { spotOverrideCheck.checked = localStorage.getItem(SPOT_OVERRIDE_KEY) === 'true'; } catch (e) {}
    self._debugSpotLightOverride = spotOverrideCheck.checked;
    spotOverrideCheck.addEventListener('change', function() {
        self._debugSpotLightOverride = spotOverrideCheck.checked;
        try { localStorage.setItem(SPOT_OVERRIDE_KEY, spotOverrideCheck.checked ? 'true' : 'false'); } catch (e) {}
    });
    spotOverrideRow.appendChild(spotOverrideLbl);
    spotOverrideRow.appendChild(spotOverrideCheck);
    var spotOverrideHint = document.createElement('span');
    spotOverrideHint.textContent = 'ON: 활성화';
    spotOverrideHint.style.cssText = 'font-size:10px;color:#888;';
    spotOverrideRow.appendChild(spotOverrideHint);
    spotBody.appendChild(spotOverrideRow);

    addSliderRow(spotBody, { label: 'Spot Int', key: 'spotLightIntensity', min: 0, max: 10, step: 0.1 });
    addSliderRow(spotBody, { label: 'Spot Dist', key: 'spotLightDistance', min: 50, max: 1000, step: 50 });
    addSliderRow(spotBody, { label: 'Spot Angle', key: 'spotLightAngle', min: 0.1, max: 1.5, step: 0.05 });
    addSliderRow(spotBody, { label: 'Spot Pen', key: 'spotLightPenumbra', min: 0, max: 1, step: 0.05 });
    addSliderRow(spotBody, { label: 'Spot Z', key: 'spotLightZ', min: 10, max: 500, step: 10 });
    addSliderRow(spotBody, { label: 'Spot TDist', key: 'spotLightTargetDistance', min: 30, max: 500, step: 10 });
    addColorRow(spotBody, { label: 'Spot Color', key: 'spotLightColor' });

    // SpotLight Shadow Map Size 셀렉트
    var spotSmapRow = document.createElement('div');
    spotSmapRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var spotSmapLbl = document.createElement('span');
    spotSmapLbl.textContent = 'Spot SMap';
    spotSmapLbl.style.cssText = 'width:70px;font-size:11px;';
    var spotSmapSelect = document.createElement('select');
    spotSmapSelect.style.cssText = 'font:11px monospace;background:#333;color:#eee;border:1px solid #555;';
    [512, 1024, 2048, 4096].forEach(function(sz) {
        var opt = document.createElement('option');
        opt.value = sz;
        opt.textContent = sz + '';
        spotSmapSelect.appendChild(opt);
    });
    spotSmapSelect.value = self.config.spotLightShadowMapSize || 2048;
    spotSmapSelect.addEventListener('change', function() {
        var sz = parseInt(spotSmapSelect.value);
        self.config.spotLightShadowMapSize = sz;
        if (self._playerSpotLight) {
            self._playerSpotLight.shadow.mapSize.width = sz;
            self._playerSpotLight.shadow.mapSize.height = sz;
            self._playerSpotLight.shadow.map = null;
        }
        saveConfigToStorage();
    });
    spotSmapRow.appendChild(spotSmapLbl);
    spotSmapRow.appendChild(spotSmapSelect);
    spotBody.appendChild(spotSmapRow);

    // 광원 현재값 복사 버튼
    var copyBtn = document.createElement('button');
    copyBtn.textContent = '현재값 복사';
    copyBtn.style.cssText = 'margin-top:8px;width:100%;padding:4px 8px;font:11px monospace;background:#446;color:#eee;border:1px solid #668;border-radius:3px;cursor:pointer;';
    copyBtn.addEventListener('click', function() {
        var cfg = self.config;
        var dirArr = cfg.lightDirection ? cfg.lightDirection.toArray() : [-1,-1,-2];
        var camFov = (window.Mode3D && Mode3D._perspCamera) ? Mode3D._perspCamera.fov : 60;
        var text = [
            '--- 카메라 ---',
            'tiltDeg: ' + (window.Mode3D ? Mode3D._tiltDeg : 60),
            'fov: ' + camFov,
            'extraRows: ' + (window.Mode3D ? Mode3D._extraRows : 6),
            '--- 환경광 ---',
            'ambientIntensity: ' + cfg.ambientIntensity,
            'ambientColor: 0x' + ('000000' + ((cfg.ambientColor || 0xffffff) >>> 0).toString(16)).slice(-6),
            '--- 방향 조명 ---',
            'directionalIntensity: ' + cfg.directionalIntensity,
            'directionalColor: 0x' + ('000000' + ((cfg.directionalColor || 0xffffff) >>> 0).toString(16)).slice(-6),
            'lightDirection: [' + dirArr[0].toFixed(2) + ', ' + dirArr[1].toFixed(2) + ', ' + dirArr[2].toFixed(2) + ']',
            'shadowMapSize: ' + cfg.shadowMapSize,
            'shadowBias: ' + cfg.shadowBias,
            'shadowNear: ' + cfg.shadowNear,
            'shadowFar: ' + cfg.shadowFar,
            '--- 그림자 설정 ---',
            'shadowRadius: ' + cfg.shadowRadius,
            'upperLayerZ: ' + cfg.upperLayerZ,
            '--- 플레이어 조명 ---',
            'playerLightIntensity: ' + cfg.playerLightIntensity,
            'playerLightDistance: ' + cfg.playerLightDistance,
            'playerLightZ: ' + cfg.playerLightZ,
            'playerLightColor: 0x' + ('000000' + ((cfg.playerLightColor || 0xffffff) >>> 0).toString(16)).slice(-6),
            'decay: ' + (self._debugDecay !== undefined ? self._debugDecay : 0),
            '--- 집중 조명 ---',
            'spotLightEnabled: ' + cfg.spotLightEnabled,
            'spotLightIntensity: ' + cfg.spotLightIntensity,
            'spotLightDistance: ' + cfg.spotLightDistance,
            'spotLightAngle: ' + cfg.spotLightAngle.toFixed(2),
            'spotLightPenumbra: ' + cfg.spotLightPenumbra,
            'spotLightColor: 0x' + ('000000' + ((cfg.spotLightColor || 0xffffff) >>> 0).toString(16)).slice(-6),
            'spotLightZ: ' + cfg.spotLightZ,
            'spotLightTargetDistance: ' + cfg.spotLightTargetDistance,
            'spotLightShadowMapSize: ' + cfg.spotLightShadowMapSize,
        ].join('\n');

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
                copyBtn.textContent = '복사 완료!';
                setTimeout(function() { copyBtn.textContent = '현재값 복사'; }, 1500);
            });
        } else {
            // fallback
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = '복사 완료!';
            setTimeout(function() { copyBtn.textContent = '현재값 복사'; }, 1500);
        }
    });
    copyBtn.addEventListener('mouseover', function() { copyBtn.style.background = '#557'; });
    copyBtn.addEventListener('mouseout', function() { copyBtn.style.background = '#446'; });
    panel.appendChild(copyBtn);

    // ── 프록시 박스 디버그 섹션 ──
    var probeBody = createSection(panel, '프록시 박스 라이팅', '#66ffcc', true);

    // 프록시 박스 시각화 토글
    var probeRow = document.createElement('div');
    probeRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var probeLbl = document.createElement('span');
    probeLbl.textContent = '시각화';
    probeLbl.style.cssText = 'width:70px;font-size:11px;';
    var probeCheck = document.createElement('input');
    probeCheck.type = 'checkbox';
    probeCheck.checked = false;
    probeCheck.addEventListener('change', function() {
        self._debugProbeVisible = probeCheck.checked;
        if (!probeCheck.checked) {
            self._removeProbeDebugVis();
        }
    });
    probeRow.appendChild(probeLbl);
    probeRow.appendChild(probeCheck);
    probeBody.appendChild(probeRow);

    // emissive factor 슬라이더
    addSliderRow(probeBody, { label: 'Factor', key: 'probeEmissiveFactor', min: 0, max: 1, step: 0.05 });

    // 범례
    var legendDiv = document.createElement('div');
    legendDiv.style.cssText = 'margin:6px 0;font-size:10px;line-height:1.6;';
    legendDiv.innerHTML = [
        '<span style="color:#ff4444">\u25CF</span> +X (우) ',
        '<span style="color:#44ff44">\u25CF</span> -X (좌) ',
        '<span style="color:#4444ff">\u25CF</span> +Y (하)<br>',
        '<span style="color:#ffff44">\u25CF</span> -Y (상) ',
        '<span style="color:#ff44ff">\u25CF</span> -Z (후) ',
        '<span style="color:#44ffff">\u25CF</span> +Z (전)',
    ].join('');
    probeBody.appendChild(legendDiv);

    // ── 스카이박스 섹션 ──
    var skyBody = createSection(panel, '스카이박스', '#ffb74d', true);
    (function() {
        var skyGrid = document.createElement('div');
        skyGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px;max-height:240px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#555 transparent;padding:2px;';
        skyBody.appendChild(skyGrid);

        // img/skybox 폴더에서 이미지 목록 로드
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/resources/img_skybox', true);
        xhr.onload = function() {
            if (xhr.status !== 200) return;
            var files = JSON.parse(xhr.responseText);
            var pngs = files.filter(function(f) { return /\.(png|jpe?g|webp)$/i.test(f); }).sort();
            pngs.forEach(function(filename) {
                var thumb = document.createElement('div');
                thumb.style.cssText = 'cursor:pointer;border:2px solid transparent;border-radius:3px;overflow:hidden;height:48px;';
                var img = document.createElement('img');
                img.src = 'img/skybox/' + filename;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                img.title = filename.replace(/\.[^.]+$/, '');
                thumb.appendChild(img);
                thumb.addEventListener('mouseenter', function() { if (!thumb._active) thumb.style.borderColor = '#ffb74d'; });
                thumb.addEventListener('mouseleave', function() { if (!thumb._active) thumb.style.borderColor = 'transparent'; });
                thumb.addEventListener('click', function() {
                    var items = skyGrid.querySelectorAll('div');
                    for (var i = 0; i < items.length; i++) { items[i].style.borderColor = 'transparent'; items[i]._active = false; }
                    thumb.style.borderColor = '#ffb74d';
                    thumb._active = true;
                    // _isParallaxSky 메시 찾아서 텍스처 교체
                    var scene = Graphics._renderer && Graphics._renderer.scene;
                    if (!scene) return;
                    var skyMesh = null;
                    scene.traverse(function(obj) { if (obj._isParallaxSky) skyMesh = obj; });
                    if (!skyMesh) return;
                    var loader = new THREE.TextureLoader();
                    loader.load('img/skybox/' + filename, function(tex) {
                        tex.colorSpace = THREE.SRGBColorSpace;
                        tex.flipY = false;
                        if (skyMesh.material.map) skyMesh.material.map.dispose();
                        skyMesh.material.map = tex;
                        skyMesh.material.needsUpdate = true;
                    });
                });
                skyGrid.appendChild(thumb);
            });
        };
        xhr.send();
    })();

    // 스카이박스 회전 속도 슬라이더
    (function() {
        var rotRow = document.createElement('div');
        rotRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';

        var rotLabel = document.createElement('span');
        rotLabel.textContent = '회전';
        rotLabel.style.cssText = 'color:#ccc;font-size:11px;min-width:28px;';
        rotRow.appendChild(rotLabel);

        var rotSlider = document.createElement('input');
        rotSlider.type = 'range';
        rotSlider.min = '-0.2';
        rotSlider.max = '0.2';
        rotSlider.step = '0.005';
        rotSlider.value = window._skyBoxGetRotationSpeed ? window._skyBoxGetRotationSpeed() : 0.02;
        rotSlider.style.cssText = 'flex:1;height:14px;accent-color:#ffb74d;';
        rotRow.appendChild(rotSlider);

        var rotValue = document.createElement('span');
        rotValue.textContent = parseFloat(rotSlider.value).toFixed(3);
        rotValue.style.cssText = 'color:#ffb74d;font-size:11px;min-width:40px;text-align:right;';
        rotRow.appendChild(rotValue);

        rotSlider.addEventListener('input', function() {
            var speed = parseFloat(rotSlider.value);
            rotValue.textContent = speed.toFixed(3);
            if (window._skyBoxSetRotationSpeed) window._skyBoxSetRotationSpeed(speed);
        });

        // 더블클릭으로 0 리셋
        rotSlider.addEventListener('dblclick', function() {
            rotSlider.value = '0';
            rotValue.textContent = '0.000';
            if (window._skyBoxSetRotationSpeed) window._skyBoxSetRotationSpeed(0);
        });

        skyBody.appendChild(rotRow);
    })();

    // 광원 방향 화살표 토글
    (function() {
        var arrowRow = document.createElement('div');
        arrowRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px;';

        var arrowCb = document.createElement('input');
        arrowCb.type = 'checkbox';
        arrowCb.checked = false;
        arrowCb.style.cssText = 'accent-color:#ffb74d;margin:0;';
        arrowRow.appendChild(arrowCb);

        var arrowLabel = document.createElement('span');
        arrowLabel.textContent = '방향 조명 화살표';
        arrowLabel.style.cssText = 'color:#ccc;font-size:11px;';
        arrowRow.appendChild(arrowLabel);

        arrowCb.addEventListener('change', function() {
            if (arrowCb.checked) {
                ShadowLight._showLightArrows();
            } else {
                ShadowLight._removeLightArrows();
            }
        });

        skyBody.appendChild(arrowRow);
    })();

    // DoF 섹션 삽입 포인트 (PostProcess.js가 여기에 섹션을 추가함)
    var dofContainer = document.createElement('div');
    dofContainer.id = 'sl-debug-dof-container';
    panel.appendChild(dofContainer);

    document.body.appendChild(panel);
    this._debugPanel = panel;

    // Apply DevPanelUtils (draggable + collapse + localStorage)
    if (window.DevPanelUtils) {
        this._debugPanelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
            titleBar: title,
            defaultPosition: 'top-right'
        });
    }
};

ShadowLight._removeDebugUI = function() {
    if (this._debugPanel) {
        this._debugPanel.remove();
        this._debugPanel = null;
    }
};

//=============================================================================
// Plugin Commands
//=============================================================================

var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command === 'ShadowLight') {
        if (args[0] === 'on') ConfigManager.shadowLight = true;
        if (args[0] === 'off') ConfigManager.shadowLight = false;
        if (args[0] === 'ambient' && args[1]) {
            var ambVal = parseFloat(args[1]);
            var ambDur = args[2] ? parseFloat(args[2]) : 0;
            // editorLights.ambient도 함께 업데이트 (_updateCameraZoneAmbient가 이 값을 target으로 사용)
            var _el = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
            if (ambDur > 0 && window.PluginTween) {
                PluginTween.add({
                    target: ShadowLight.config, key: 'ambientIntensity', to: ambVal, duration: ambDur,
                    onUpdate: function(v) {
                        if (_el && _el.ambient) _el.ambient.intensity = v;
                        ShadowLight._currentAmbientIntensity = v;
                        if (ShadowLight._ambientLight) ShadowLight._ambientLight.intensity = v;
                    }
                });
            } else {
                ShadowLight.config.ambientIntensity = ambVal;
                if (_el && _el.ambient) _el.ambient.intensity = ambVal;
                ShadowLight._currentAmbientIntensity = ambVal;
                if (ShadowLight._ambientLight) ShadowLight._ambientLight.intensity = ambVal;
            }
        }
        if (args[0] === 'ambientColor' && args[1]) {
            var hex = parseInt(args[1].replace('#', ''), 16);
            var colorDur = args[2] ? parseFloat(args[2]) : 0;
            // editorLights.ambient도 함께 업데이트 (_updateCameraZoneAmbient가 이 값을 target으로 사용)
            var _el2 = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
            if (!isNaN(hex)) {
                if (colorDur > 0 && window.PluginTween) {
                    PluginTween.addColor({
                        target: ShadowLight.config, key: 'ambientColor', to: hex, duration: colorDur,
                        onUpdate: function(v) {
                            // editorLights.ambient.color도 동기화
                            if (_el2 && _el2.ambient) _el2.ambient.color = '#' + ('000000' + (v >>> 0).toString(16)).slice(-6);
                            var r = ((v >> 16) & 0xFF) / 255;
                            var g = ((v >> 8) & 0xFF) / 255;
                            var b = (v & 0xFF) / 255;
                            ShadowLight._currentAmbientR = r;
                            ShadowLight._currentAmbientG = g;
                            ShadowLight._currentAmbientB = b;
                            if (ShadowLight._ambientLight) ShadowLight._ambientLight.color.setHex(v);
                        }
                    });
                } else {
                    ShadowLight.config.ambientColor = hex;
                    if (_el2 && _el2.ambient) _el2.ambient.color = '#' + ('000000' + (hex >>> 0).toString(16)).slice(-6);
                    var r2 = ((hex >> 16) & 0xFF) / 255;
                    var g2 = ((hex >> 8) & 0xFF) / 255;
                    var b2 = (hex & 0xFF) / 255;
                    ShadowLight._currentAmbientR = r2;
                    ShadowLight._currentAmbientG = g2;
                    ShadowLight._currentAmbientB = b2;
                    if (ShadowLight._ambientLight) ShadowLight._ambientLight.color.setHex(hex);
                }
            }
        }
        if (args[0] === 'direction' && args.length >= 4) {
            ShadowLight.config.lightDirection = new THREE.Vector3(
                parseFloat(args[1]), parseFloat(args[2]), parseFloat(args[3])
            ).normalize();
        }
        // ShadowLight pointLight <id> <property> <value> [duration]
        if (args[0] === 'pointLight' && args[1] && args[2]) {
            var plId = parseInt(args[1]);
            var plProp = args[2];
            var plVal = args[3];
            var plDur = args[4] ? parseFloat(args[4]) : 0;
            var el = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
            if (el && el.points) {
                var plObj = null;
                for (var pli = 0; pli < el.points.length; pli++) {
                    if (el.points[pli].id === plId) { plObj = el.points[pli]; break; }
                }
                if (plObj) {
                    if (plProp === 'color' && plVal) {
                        var plHex = parseInt(plVal.replace('#', ''), 16);
                        if (!isNaN(plHex)) plObj.color = '#' + plHex.toString(16).padStart(6, '0');
                    } else if (plProp === 'intensity' || plProp === 'distance' || plProp === 'decay' || plProp === 'z') {
                        var numVal = parseFloat(plVal);
                        if (plDur > 0 && window.PluginTween) {
                            PluginTween.add({ target: plObj, key: plProp, to: numVal, duration: plDur });
                        } else {
                            plObj[plProp] = numVal;
                        }
                    }
                }
            }
        }
    }
};

})();
