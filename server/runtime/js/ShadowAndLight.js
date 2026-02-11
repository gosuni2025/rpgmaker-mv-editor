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

    // 2) Lambert vertex shader: vLightBack을 vLightFront와 동일하게
    (function() {
        var key = 'lights_lambert_vertex';
        var chunk = THREE.ShaderChunk[key];
        if (chunk) {
            var orig = 'saturate( -dotNL )';
            var patched = 'saturate( dotNL )';
            var newChunk = chunk.split(orig).join(patched);
            if (newChunk !== chunk) {
                THREE.ShaderChunk[key] = newChunk;
                console.log('[ShadowLight] ShaderChunk patched: lights_lambert_vertex (bilateral)');
            }
        }
    })();

    // 3) Lambert fragment: gl_FrontFacing 선택을 항상 Front로 고정
    (function() {
        var key = 'meshlambert_frag';
        var chunk = THREE.ShaderChunk[key];
        if (chunk) {
            var changed = false;
            var o1 = 'reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;';
            var o2 = 'reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;';
            if (chunk.indexOf(o1) >= 0) {
                chunk = chunk.replace(o1, 'reflectedLight.directDiffuse = vLightFront;');
                changed = true;
            }
            if (chunk.indexOf(o2) >= 0) {
                chunk = chunk.replace(o2, 'reflectedLight.indirectDiffuse += vIndirectFront;');
                changed = true;
            }
            if (changed) {
                THREE.ShaderChunk[key] = chunk;
                console.log('[ShadowLight] ShaderChunk patched: meshlambert_frag (bypass gl_FrontFacing)');
            }
        }
    })();

    // 4) Phong fragment: normal_fragment_begin 패치로 커버되지만,
    //    lights_phong_pars_fragment의 dotNL도 abs()로 감싸서 안전하게 처리
    (function() {
        var key = 'lights_phong_pars_fragment';
        var chunk = THREE.ShaderChunk[key];
        if (chunk) {
            var orig = 'float dotNL = saturate( dot( geometry.normal, directLight.direction ) );';
            var patched = 'float dotNL = saturate( abs( dot( geometry.normal, directLight.direction ) ) );';
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
// Window_Options - "그림자/광원" 옵션 추가
//=============================================================================

var _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
Window_Options.prototype.addGeneralOptions = function() {
    _Window_Options_addGeneralOptions.call(this);
    this.addCommand('그림자/광원', 'shadowLight');
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

/**
 * 캐릭터 스프라이트들의 프록시 박스 라이팅 업데이트
 * @param {Array} sprites - Sprite_Character 배열
 */
ShadowLight._updateProxyBoxLighting = function(sprites) {
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

    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (!sprite || !sprite._material || !sprite._material.isMeshPhongMaterial) continue;
        if (!sprite._threeObj || !sprite._threeObj.visible) continue;

        // 캐릭터 월드 위치
        var wp = this._getWrapperWorldPos(sprite);
        var charX = wp.x;
        var charY = wp.y - 24; // 스프라이트 중심 높이 보정
        var charZ = 20;        // 캐릭터 높이 (지면 위)

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
        if (isDevMode) {
            this._updateProbeDebugVis(sprite, charX, charY, charZ, perNormal);
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

/**
 * 디버그 시각화를 위한 그룹과 캐시 초기화
 */
ShadowLight._ensureProbeDebugGroup = function() {
    if (this._probeDebugGroup) return;
    this._probeDebugGroup = new THREE.Group();
    this._probeDebugGroup.name = 'ProbeBoxDebug';
    this._probeDebugGroup.frustumCulled = false;
    this._probeDebugData = new Map();
    var scene = this._findScene();
    if (scene) scene.add(this._probeDebugGroup);
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

    this._probeDebugGroup.add(group);

    var data = { group: group, box: boxMesh, arrows: arrows };
    this._probeDebugData.set(sprite, data);
    return data;
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

    // 캐릭터 프레임 크기
    var fw = sprite._frameWidth || 48;
    var fh = sprite._frameHeight || 48;
    var boxW = fw * 0.6;  // 박스 폭 (캐릭터보다 약간 작게)
    var boxH = fh * 0.8;  // 박스 높이
    var boxD = fw * 0.4;  // 박스 깊이

    // 와이어프레임 박스 위치/크기
    data.box.position.set(cx, cy, cz);
    data.box.scale.set(boxW, boxH, boxD);

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
        posAttr.setXYZ(0, cx, cy, cz);
        posAttr.setXYZ(1,
            cx + normal.x * arrowScale,
            cy + normal.y * arrowScale,
            cz + normal.z * arrowScale
        );
        posAttr.needsUpdate = true;

        // 끝점 구체
        arrow.sphere.position.set(
            cx + normal.x * arrowScale,
            cy + normal.y * arrowScale,
            cz + normal.z * arrowScale
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
    var scene = this._findScene();
    if (scene) scene.remove(this._probeDebugGroup);
    // geometry/material dispose
    this._probeDebugGroup.traverse(function(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
    this._probeDebugGroup = null;
    this._probeDebugData = null;
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
// Scene에 조명 추가/제거
//=============================================================================

ShadowLight._addLightsToScene = function(scene) {
    if (this._ambientLight) return; // 이미 추가됨

    // editorLights 맵별 설정 (에디터에서 저장한 커스텀 데이터)
    var el = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;

    // AmbientLight - 전체적인 환경광
    var ambColor = el ? parseInt(el.ambient.color.replace('#', ''), 16) : this.config.ambientColor;
    var ambIntensity = el ? el.ambient.intensity : this.config.ambientIntensity;
    // config에 동기화 (디버그 패널 초기값과 일치시킴)
    if (el) {
        this.config.ambientColor = ambColor;
        this.config.ambientIntensity = ambIntensity;
    }
    this._ambientLight = new THREE.AmbientLight(ambColor, ambIntensity);
    scene.add(this._ambientLight);

    // DirectionalLight - 태양/달빛 (그림자 방향 결정)
    var dirColor = el ? parseInt(el.directional.color.replace('#', ''), 16) : this.config.directionalColor;
    var dirIntensity = el ? el.directional.intensity : this.config.directionalIntensity;
    // config에 동기화
    if (el) {
        this.config.directionalColor = dirColor;
        this.config.directionalIntensity = dirIntensity;
    }
    this._directionalLight = new THREE.DirectionalLight(dirColor, dirIntensity);
    // 위치는 방향의 반대 (광원이 오는 방향)
    var dir;
    if (el && el.directional.direction) {
        dir = new THREE.Vector3(el.directional.direction[0], el.directional.direction[1], el.directional.direction[2]).normalize();
    } else {
        dir = this.config.lightDirection;
    }
    this._directionalLight.position.set(-dir.x * 1000, -dir.y * 1000, -dir.z * 1000);

    // Shadow Map 설정
    this._directionalLight.castShadow = true;
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
    // 포인트 라이트 제거
    for (var i = 0; i < this._pointLights.length; i++) {
        if (this._pointLights[i].parent) {
            this._pointLights[i].parent.remove(this._pointLights[i]);
        }
    }
    this._pointLights = [];
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
    if (this._tilemap && this._tilemap.upperZLayer) {
        this._tilemap.upperZLayer._zIndex = ShadowLight.config.upperLayerZ;
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
        this._tilemap.upperZLayer._threeObj.position.z = 4; // 원래 zIndex
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
    if ($gamePlayer) {
        var playerSprite = this._getPlayerSprite();
        if (playerSprite) {
            playerWp = ShadowLight._getWrapperWorldPos(playerSprite);
        }
        if (!$gamePlayer.isTransparent() && playerWp) {
            var light = ShadowLight._getPointLight();
            light.color.setHex(ShadowLight.config.playerLightColor);
            light.intensity = ShadowLight.config.playerLightIntensity;
            light.distance = ShadowLight.config.playerLightDistance;
            light.decay = ShadowLight._debugDecay !== undefined ? ShadowLight._debugDecay : 0;
            light.position.set(playerWp.x, playerWp.y - 24, ShadowLight.config.playerLightZ);
        }
    }

    // SpotLight 위치/방향 업데이트
    if (ShadowLight._playerSpotLight && ShadowLight.config.spotLightEnabled && playerWp &&
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
        var off = ShadowLight._directionToOffset(dir, cfg.spotLightTargetDistance);
        ShadowLight._playerSpotTarget.position.set(
            playerWp.x + off.x,
            playerWp.y - 24 + off.y,
            0  // 바닥 레벨
        );
        ShadowLight._playerSpotTarget.updateMatrixWorld();
    }

    // SpotLight가 비활성이면 숨기기
    if (ShadowLight._playerSpotLight && (!ShadowLight.config.spotLightEnabled || !playerWp)) {
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
    var el = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
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

    var panel = document.createElement('div');
    panel.id = 'sl-debug-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:rgba(0,0,0,0.85);color:#eee;font:12px monospace;padding:10px;border-radius:6px;min-width:220px;pointer-events:auto;';

    var title = document.createElement('div');
    title.textContent = '맵 인스펙터';
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#ffcc88;';
    panel.appendChild(title);

    var self = this;
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
        });

        row.appendChild(lbl);
        row.appendChild(colorInput);
        row.appendChild(hexVal);
        parent.appendChild(row);
    }

    // 접기/펼치기 가능한 섹션 생성 헬퍼
    // collapsed: 초기 접힘 상태 (기본 false = 펼침)
    function createSection(parent, label, color, collapsed) {
        var wrapper = document.createElement('div');
        wrapper.style.cssText = sectionStyle;

        var header = document.createElement('div');
        header.style.cssText = 'font-weight:bold;font-size:11px;color:' + color + ';cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px;';
        var arrow = document.createElement('span');
        arrow.textContent = collapsed ? '\u25B6' : '\u25BC';
        arrow.style.cssText = 'font-size:9px;width:10px;';
        var labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        header.appendChild(arrow);
        header.appendChild(labelSpan);
        wrapper.appendChild(header);

        var body = document.createElement('div');
        body.style.display = collapsed ? 'none' : '';
        wrapper.appendChild(body);

        header.addEventListener('click', function() {
            var isHidden = body.style.display === 'none';
            body.style.display = isHidden ? '' : 'none';
            arrow.textContent = isHidden ? '\u25BC' : '\u25B6';
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
    addSliderRow(envBody, { label: 'Ambient', key: 'ambientIntensity', min: 0, max: 3, step: 0.05 });
    addColorRow(envBody, { label: 'Ambient Color', key: 'ambientColor' });

    // ── 디렉셔널 라이트 섹션 ──
    var dirBody = createSection(panel, '디렉셔널 라이트', '#aaddff', true);
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
    var playerBody = createSection(panel, '플레이어 라이트', '#ffcc66', false);
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
    var spotBody = createSection(panel, '스포트라이트', '#ff9966', true);

    // SpotLight ON/OFF 토글
    var spotRow = document.createElement('div');
    spotRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var spotLbl = document.createElement('span');
    spotLbl.textContent = 'Enabled';
    spotLbl.style.cssText = 'width:70px;font-size:11px;';
    var spotCheck = document.createElement('input');
    spotCheck.type = 'checkbox';
    spotCheck.checked = self.config.spotLightEnabled;
    spotCheck.addEventListener('change', function() {
        self.config.spotLightEnabled = spotCheck.checked;
        if (self._playerSpotLight) {
            self._playerSpotLight.visible = spotCheck.checked;
        }
    });
    spotRow.appendChild(spotLbl);
    spotRow.appendChild(spotCheck);
    spotBody.appendChild(spotRow);

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
            '--- 디렉셔널 라이트 ---',
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
            '--- 플레이어 라이트 ---',
            'playerLightIntensity: ' + cfg.playerLightIntensity,
            'playerLightDistance: ' + cfg.playerLightDistance,
            'playerLightZ: ' + cfg.playerLightZ,
            'playerLightColor: 0x' + ('000000' + ((cfg.playerLightColor || 0xffffff) >>> 0).toString(16)).slice(-6),
            'decay: ' + (self._debugDecay !== undefined ? self._debugDecay : 0),
            '--- 스포트라이트 ---',
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

    // DoF 섹션 삽입 포인트 (DepthOfField가 여기에 섹션을 추가함)
    var dofContainer = document.createElement('div');
    dofContainer.id = 'sl-debug-dof-container';
    panel.appendChild(dofContainer);

    document.body.appendChild(panel);
    this._debugPanel = panel;
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
            ShadowLight.config.ambientIntensity = parseFloat(args[1]);
            if (ShadowLight._ambientLight) {
                ShadowLight._ambientLight.intensity = parseFloat(args[1]);
            }
        }
        if (args[0] === 'direction' && args.length >= 4) {
            ShadowLight.config.lightDirection = new THREE.Vector3(
                parseFloat(args[1]), parseFloat(args[2]), parseFloat(args[3])
            ).normalize();
        }
    }
};

})();
