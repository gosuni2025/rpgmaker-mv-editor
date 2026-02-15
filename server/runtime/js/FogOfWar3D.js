//=============================================================================
// FogOfWar3D.js - 3D Fog of War (InstancedMesh 박스 방식)
//=============================================================================
// FogOfWar.js의 가시성 데이터(_fogTexture)를 읽기 전용으로 참조하여
// InstancedMesh로 타일마다 세로 박스를 세워 3D fog를 표현한다.
//
// FogOfWar.js는 수정하지 않음. 완전 독립 모듈.
// 의존: THREE (global), FogOfWar (global, 읽기 전용 참조)
//=============================================================================

(function() {

var FogOfWar3D = {};
window.FogOfWar3D = FogOfWar3D;

FogOfWar3D._active = false;
FogOfWar3D._instancedMesh = null;
FogOfWar3D._mapWidth = 0;
FogOfWar3D._mapHeight = 0;
FogOfWar3D._fogHeight = 144;       // 박스 높이 (px) = 3타일(48*3)
FogOfWar3D._time = 0;

//=============================================================================
// 쉐이더 코드
//=============================================================================

var BOX_FOG_VERT = [
    'varying vec2 vTileUV;',
    'varying vec3 vWorldPos;',
    'varying float vWorldZ;',         // 월드 Z (0=바닥, fogHeight=꼭대기)
    'varying float vVisibility;',
    'varying vec3 vLocalPos;',        // 로컬 좌표 (-0.5~0.5)
    'varying vec3 vNormal;',          // face normal
    '',
    'uniform vec2 mapSize;',           // mapWidth, mapHeight (타일 수)
    'uniform float tileSize;',         // 48.0
    'uniform float fogHeight;',        // 박스 높이 (px)
    'uniform sampler2D tFog;',         // 가시성 텍스처
    '',
    'void main() {',
    '    // instanceMatrix에서 월드 위치 추출',
    '    vec3 instancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
    '',
    '    // 타일 UV: 인스턴스 중심 위치로부터 타일 좌표 계산',
    '    vTileUV = vec2(instancePos.x / (mapSize.x * tileSize), instancePos.y / (mapSize.y * tileSize));',
    '',
    '    // fog 텍스처에서 가시성 샘플링',
    '    vec4 fogSample = texture2D(tFog, vTileUV);',
    '    float visibility = fogSample.r;',
    '    vVisibility = visibility;',
    '',
    '    // 로컬 좌표와 normal 전달',
    '    vLocalPos = position;',           // BoxGeometry의 position: xyz 각각 -0.5~0.5
    '    vNormal = normal;',               // BoxGeometry의 face normal
    '',
    '    // 박스 높이를 그대로 유지 (fragment shader에서 처리)',
    '    vec4 worldPos = instanceMatrix * vec4(position, 1.0);',
    '    vWorldPos = worldPos.xyz;',
    '',
    '    // 월드 Z: 바닥=0, 꼭대기=fogHeight',
    '    vWorldZ = (position.z + 0.5) * fogHeight;',
    '',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos.xyz, 1.0);',
    '}'
].join('\n');

var BOX_FOG_FRAG = [
    'precision highp float;',
    '',
    'varying vec2 vTileUV;',
    'varying vec3 vWorldPos;',
    'varying float vWorldZ;',
    'varying float vVisibility;',
    'varying vec3 vLocalPos;',
    'varying vec3 vNormal;',
    '',
    'uniform sampler2D tFog;',
    'uniform vec3 fogColor;',
    'uniform vec3 fogColorTop;',
    'uniform float unexploredAlpha;',
    'uniform float exploredAlpha;',
    'uniform float uTime;',
    'uniform vec2 mapSize;',
    'uniform float tileSize;',
    'uniform float fogHeight;',
    'uniform vec2 scrollOffset;',
    'uniform float heightFalloff;',
    'uniform float edgeAnimOn;',
    'uniform float edgeAnimSpeed;',
    'uniform float heightGradientOn;',
    'uniform float dissolveStrength;',
    'uniform float tentacleSharpness;',
    'uniform float fadeSmoothness;',
    '',
    '// --- 노이즈 함수 (2D FOW와 동일) ---',
    'vec2 _hash22(vec2 p) {',
    '    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
    '    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);',
    '}',
    'float _valueNoise(vec2 p) {',
    '    vec2 i = floor(p); vec2 f = fract(p);',
    '    vec2 u = f * f * (3.0 - 2.0 * f);',
    '    float a = dot(_hash22(i), f);',
    '    float b = dot(_hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));',
    '    float c = dot(_hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));',
    '    float d = dot(_hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));',
    '    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'float fbm3(vec2 p) {',
    '    float v = 0.0; float amp = 0.5;',
    '    for (int i = 0; i < 3; i++) { v += amp * _valueNoise(p); p *= 2.03; amp *= 0.5; }',
    '    return v;',
    '}',
    '',
    '// 3-layer noise: 월드 좌표 입력 → 0~1 정규화 노이즈',
    'float tentacleNoise(vec2 wpos) {',
    '    float timeS = uTime * edgeAnimSpeed;',
    '    float n1 = fbm3(wpos * 0.025 + vec2(timeS * 0.06, timeS * 0.04));',
    '    float n2 = _valueNoise(wpos * 0.07 + vec2(-timeS * 0.08, timeS * 0.05));',
    '    float n3 = _valueNoise(wpos * 0.15 + vec2(timeS * 0.12, -timeS * 0.07));',
    '    float noise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;',
    '    return clamp(noise + 0.5, 0.0, 1.0);',
    '}',
    '',
    '// NEAREST 샘플링 헬퍼',
    'vec2 snapUV(vec2 uv) {',
    '    vec2 texel = 1.0 / mapSize;',
    '    return (floor(uv / texel) + 0.5) * texel;',
    '}',
    'float sampleExplNearest(vec2 uv) {',
    '    return texture2D(tFog, snapUV(uv)).g;',
    '}',
    'float sampleGrowNearest(vec2 uv) {',
    '    return texture2D(tFog, snapUV(uv)).a;',
    '}',
    'float sampleFadeNearest(vec2 uv) {',
    '    return texture2D(tFog, snapUV(uv)).b;',
    '}',
    '',
    'void main() {',
    '    // 1. tFog 샘플링 (타일 중심 기준)',
    '    vec4 fogSample = texture2D(tFog, snapUV(vTileUV));',
    '    float visibility = fogSample.r;',
    '    float explored = fogSample.g;',
    '',
    '    // 2. 완전 가시 타일은 discard',
    '    if (visibility > 0.99) discard;',
    '',
    '    // 3. face 분류: normal 기반',
    '    //    윗면: normal.z > 0.5, 바닥면: normal.z < -0.5',
    '    //    옆면: abs(normal.x) > 0.5 또는 abs(normal.y) > 0.5',
    '    float heightNorm = clamp(vWorldZ / fogHeight, 0.0, 1.0);',
    '    bool isTopFace = vNormal.z > 0.5;',
    '    bool isBottomFace = vNormal.z < -0.5;',
    '    bool isSideFace = !isTopFace && !isBottomFace;',
    '',
    '    vec2 texel = 1.0 / mapSize;',
    '    float myExpl = sampleExplNearest(vTileUV);',
    '',
    '    // 인접 타일 탐험 상태',
    '    float eL = sampleExplNearest(vTileUV + vec2(-texel.x, 0.0));',   // -X 방향
    '    float eR = sampleExplNearest(vTileUV + vec2( texel.x, 0.0));',   // +X 방향
    '    float eU = sampleExplNearest(vTileUV + vec2(0.0, -texel.y));',   // -Y 방향
    '    float eD = sampleExplNearest(vTileUV + vec2(0.0,  texel.y));',   // +Y 방향
    '',
    '    if (myExpl < 0.5) {',
    '        // === 미탐험 타일 ===',
    '        bool border = (eL > 0.5 || eR > 0.5 || eU > 0.5 || eD > 0.5);',
    '',
    '        if (border && edgeAnimOn > 0.5) {',
    '            float gf = sampleGrowNearest(vTileUV);',
    '',
    '            if (isSideFace) {',
    '                // --- 옆면: 경계 방향에 해당하는 면에만 촉수 ---',
    '                // 이 면이 탐험 영역 쪽을 바라보는지 확인',
    '                bool facingExplored = false;',
    '                if (vNormal.x < -0.5 && eL > 0.5) facingExplored = true;',
    '                if (vNormal.x >  0.5 && eR > 0.5) facingExplored = true;',
    '                if (vNormal.y < -0.5 && eU > 0.5) facingExplored = true;',
    '                if (vNormal.y >  0.5 && eD > 0.5) facingExplored = true;',
    '',
    '                if (facingExplored) {',
    '                    // 옆면의 수평 좌표: normal 방향에 따라 다름',
    '                    // normal.x != 0 → Y축과 Z축이 면의 좌표',
    '                    // normal.y != 0 → X축과 Z축이 면의 좌표',
    '                    float wallU;',
    '                    if (abs(vNormal.x) > 0.5) {',
    '                        wallU = vLocalPos.y + 0.5;',   // 0~1 범위
    '                    } else {',
    '                        wallU = vLocalPos.x + 0.5;',   // 0~1 범위
    '                    }',
    '',
    '                    // 월드 좌표 기반 노이즈 (옆면 수평위치 + 높이 기반)',
    '                    vec2 wallWorld;',
    '                    if (abs(vNormal.x) > 0.5) {',
    '                        wallWorld = vec2(vWorldPos.y, vWorldZ) + scrollOffset;',
    '                    } else {',
    '                        wallWorld = vec2(vWorldPos.x, vWorldZ) + scrollOffset;',
    '                    }',
    '                    float nN = tentacleNoise(wallWorld);',
    '                    float tH = pow(nN, tentacleSharpness) * dissolveStrength * tileSize / fogHeight * gf;',
    '',
    '                    // 촉수 cutoff: 꼭대기에서 아래로 뻗어나옴',
    '                    float cutoff = 1.0 - tH;',
    '                    if (heightNorm > cutoff) discard;',
    '                }',
    '                // 경계 방향 아닌 옆면: fog 본체 → 그대로 렌더',
    '',
    '            } else if (isTopFace) {',
    '                // --- 윗면: 기존 로직 ---',
    '                vec2 worldXY = vWorldPos.xy + scrollOffset;',
    '                float nN = tentacleNoise(worldXY);',
    '                float tH = pow(nN, tentacleSharpness) * dissolveStrength * tileSize / fogHeight * gf;',
    '                float cutoff = 1.0 - tH;',
    '                if (heightNorm > cutoff) discard;',
    '            }',
    '            // 바닥면: 항상 렌더',
    '',
    '        } else if (!border) {',
    '            // 비경계 미탐험: heightFalloff로 상단 페이드',
    '            float hFade = 1.0 - smoothstep(0.0, 1.0, pow(heightNorm, 1.0 / max(heightFalloff, 0.1)));',
    '            if (hFade < 0.01) discard;',
    '        }',
    '',
    '        // 미탐험: 불투명 fog',
    '        vec3 color = heightGradientOn > 0.5 ? mix(fogColor, fogColorTop, heightNorm) : fogColor;',
    '        gl_FragColor = vec4(color, unexploredAlpha);',
    '',
    '    } else {',
    '        // === 탐험된 타일 ===',
    '        bool border = (eL < 0.5 || eR < 0.5 || eU < 0.5 || eD < 0.5);',
    '',
    '        if (border && edgeAnimOn > 0.5) {',
    '            float tf = sampleFadeNearest(vTileUV);',
    '',
    '            if (isSideFace) {',
    '                // --- 탐험 경계 옆면: 미탐험 쪽을 바라보는 면에서 촉수 ---',
    '                bool facingUnexplored = false;',
    '                if (vNormal.x < -0.5 && eL < 0.5) facingUnexplored = true;',
    '                if (vNormal.x >  0.5 && eR < 0.5) facingUnexplored = true;',
    '                if (vNormal.y < -0.5 && eU < 0.5) facingUnexplored = true;',
    '                if (vNormal.y >  0.5 && eD < 0.5) facingUnexplored = true;',
    '',
    '                if (facingUnexplored && tf > 0.001) {',
    '                    vec2 wallWorld;',
    '                    if (abs(vNormal.x) > 0.5) {',
    '                        wallWorld = vec2(vWorldPos.y, vWorldZ) + scrollOffset;',
    '                    } else {',
    '                        wallWorld = vec2(vWorldPos.x, vWorldZ) + scrollOffset;',
    '                    }',
    '                    float nN = tentacleNoise(wallWorld);',
    '                    float tH = pow(nN, tentacleSharpness) * dissolveStrength * tileSize / fogHeight * tf;',
    '',
    '                    // 바닥에서 솟아오르는 촉수',
    '                    if (heightNorm < tH) {',
    '                        vec3 color = heightGradientOn > 0.5 ? mix(fogColor, fogColorTop, heightNorm) : fogColor;',
    '                        gl_FragColor = vec4(color, unexploredAlpha);',
    '                        return;',
    '                    }',
    '                }',
    '',
    '            } else if (isTopFace) {',
    '                // --- 탐험 경계 윗면: 바닥에서 솟아오르는 촉수 ---',
    '                vec2 worldXY = vWorldPos.xy + scrollOffset;',
    '                float nN = tentacleNoise(worldXY);',
    '                float tH = pow(nN, tentacleSharpness) * dissolveStrength * tileSize / fogHeight * tf;',
    '                if (heightNorm < tH) {',
    '                    vec3 color = heightGradientOn > 0.5 ? mix(fogColor, fogColorTop, heightNorm) : fogColor;',
    '                    gl_FragColor = vec4(color, unexploredAlpha);',
    '                    return;',
    '                }',
    '            }',
    '        }',
    '',
    '        // 탐험된 타일: 3D 박스를 그리지 않음 (2D FOW가 처리)',
    '        discard;',
    '    }',
    '}'
].join('\n');

//=============================================================================
// 메쉬 생성 / 파괴
//=============================================================================

FogOfWar3D._createMesh = function(mapWidth, mapHeight, config) {
    this._disposeMesh();

    if (!window.FogOfWar || !window.FogOfWar._fogTexture) return null;

    this._mapWidth = mapWidth;
    this._mapHeight = mapHeight;
    this._active = true;

    var fogOfWar = window.FogOfWar;

    // config로부터 파라미터 추출
    var fogColor = fogOfWar._fogColor;
    var fogColorTop = fogOfWar._fogColorTop;
    var unexploredAlpha = fogOfWar._unexploredAlpha;
    var exploredAlpha = fogOfWar._exploredAlpha;
    var edgeAnimation = fogOfWar._edgeAnimation;
    var edgeAnimationSpeed = fogOfWar._edgeAnimationSpeed;
    var heightGradient = fogOfWar._heightGradient;

    var tileSize = 48;
    var fogHeight = config && config.fogHeight3D != null ? config.fogHeight3D : this._fogHeight;
    var heightFalloff = config && config.heightFalloff != null ? config.heightFalloff : 1.5;
    var dissolveStrength = (fogOfWar._shaderOverrides && fogOfWar._shaderOverrides.dissolveStrength != null)
        ? fogOfWar._shaderOverrides.dissolveStrength : 2.0;
    var tentacleSharpness = (fogOfWar._shaderOverrides && fogOfWar._shaderOverrides.tentacleSharpness != null)
        ? fogOfWar._shaderOverrides.tentacleSharpness : 3.0;

    this._fogHeight = fogHeight;

    var totalInstances = mapWidth * mapHeight;

    // BoxGeometry: 1타일 x 1타일 x fogHeight
    var geometry = new THREE.BoxGeometry(tileSize, tileSize, fogHeight);

    var fadeSmoothness = (fogOfWar._shaderOverrides && fogOfWar._shaderOverrides.fadeSmoothness != null)
        ? fogOfWar._shaderOverrides.fadeSmoothness : 0.3;

    // ShaderMaterial
    var material = new THREE.ShaderMaterial({
        uniforms: {
            tFog:               { value: fogOfWar._fogTexture },
            fogColor:           { value: new THREE.Vector3(fogColor.r, fogColor.g, fogColor.b) },
            fogColorTop:        { value: new THREE.Vector3(fogColorTop.r, fogColorTop.g, fogColorTop.b) },
            unexploredAlpha:    { value: unexploredAlpha },
            exploredAlpha:      { value: exploredAlpha },
            uTime:              { value: 0 },
            mapSize:            { value: new THREE.Vector2(mapWidth, mapHeight) },
            tileSize:           { value: tileSize },
            fogHeight:          { value: fogHeight },
            scrollOffset:       { value: new THREE.Vector2(0, 0) },
            heightFalloff:      { value: heightFalloff },
            edgeAnimOn:         { value: edgeAnimation ? 1.0 : 0.0 },
            edgeAnimSpeed:      { value: edgeAnimationSpeed },
            heightGradientOn:   { value: heightGradient ? 1.0 : 0.0 },
            dissolveStrength:   { value: dissolveStrength },
            tentacleSharpness:  { value: tentacleSharpness },
            fadeSmoothness:     { value: fadeSmoothness }
        },
        vertexShader: BOX_FOG_VERT,
        fragmentShader: BOX_FOG_FRAG,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // InstancedMesh 생성
    var instancedMesh = new THREE.InstancedMesh(geometry, material, totalInstances);
    instancedMesh.frustumCulled = false;
    instancedMesh.renderOrder = 9990;
    instancedMesh.userData.editorGrid = true;
    instancedMesh._isFogOfWar3D = true;

    // 각 타일에 인스턴스 배치
    var dummy = new THREE.Object3D();
    for (var ty = 0; ty < mapHeight; ty++) {
        for (var tx = 0; tx < mapWidth; tx++) {
            var idx = ty * mapWidth + tx;
            // 박스 중심 좌표: 바닥이 Z=0이 되도록 fogHeight/2만큼 위로 올림
            dummy.position.set(
                tx * tileSize + tileSize / 2,
                ty * tileSize + tileSize / 2,
                fogHeight / 2
            );
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(idx, dummy.matrix);
        }
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    this._instancedMesh = instancedMesh;
    this._time = 0;

    return instancedMesh;
};

FogOfWar3D._disposeMesh = function() {
    if (this._instancedMesh) {
        if (this._instancedMesh.parent) {
            this._instancedMesh.parent.remove(this._instancedMesh);
        }
        this._instancedMesh.geometry.dispose();
        this._instancedMesh.material.dispose();
        this._instancedMesh = null;
    }
    this._active = false;
};

//=============================================================================
// 매 프레임 유니폼 갱신
//=============================================================================

FogOfWar3D._updateUniforms = function(dt) {
    if (!this._instancedMesh || !this._active) return;

    var fogOfWar = window.FogOfWar;
    if (!fogOfWar || !fogOfWar._fogTexture) return;

    this._time += dt || (1.0 / 60.0);

    var u = this._instancedMesh.material.uniforms;
    u.tFog.value = fogOfWar._fogTexture;
    u.uTime.value = this._time;

    // FogOfWar의 현재 설정값 동기화
    u.fogColor.value.set(fogOfWar._fogColor.r, fogOfWar._fogColor.g, fogOfWar._fogColor.b);
    u.fogColorTop.value.set(fogOfWar._fogColorTop.r, fogOfWar._fogColorTop.g, fogOfWar._fogColorTop.b);
    u.unexploredAlpha.value = fogOfWar._unexploredAlpha;
    u.exploredAlpha.value = fogOfWar._exploredAlpha;
    u.edgeAnimOn.value = fogOfWar._edgeAnimation ? 1.0 : 0.0;
    u.edgeAnimSpeed.value = fogOfWar._edgeAnimationSpeed;
    u.heightGradientOn.value = fogOfWar._heightGradient ? 1.0 : 0.0;

    // 셰이더 오버라이드
    var so = fogOfWar._shaderOverrides || {};
    u.dissolveStrength.value = so.dissolveStrength != null ? so.dissolveStrength : 2.0;
    u.tentacleSharpness.value = so.tentacleSharpness != null ? so.tentacleSharpness : 3.0;
    u.fadeSmoothness.value = so.fadeSmoothness != null ? so.fadeSmoothness : 0.3;

    // 스크롤 오프셋
    var ox = 0, oy = 0;
    if (typeof $gameMap !== 'undefined' && $gameMap) {
        ox = $gameMap.displayX() * 48;
        oy = $gameMap.displayY() * 48;
    }
    u.scrollOffset.value.set(ox, oy);
};

//=============================================================================
// 런타임 후킹 - fogMode='3dbox'일 때 볼류메트릭 대신 3D 박스 사용
//=============================================================================

FogOfWar3D._lastTime = 0;

var VALID_FOG_MODES = { '': true, '2d': true, '3dbox': true, 'volumetric': true };

// 현재 맵의 fogMode 조회 (유효하지 않은 값이면 에러)
FogOfWar3D._getFogMode = function() {
    if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.fogOfWar) {
        var mode = $dataMap.fogOfWar.fogMode || '';
        if (!VALID_FOG_MODES[mode]) {
            console.error('[FogOfWar3D] Unknown fogMode: "' + mode + '". Valid: 2d, 3dbox, volumetric');
        }
        return mode;
    }
    return '';
};

// 에디터 모드에서는 에디터 오버레이 훅이 처리하므로 런타임 후킹 불필요
if (!window._editorRuntimeReady) {

    var FOW = window.FogOfWar;

    // FogOfWar._createMesh 래핑: fogMode='3dbox'면 볼류메트릭 생성을 차단
    if (FOW && FOW._createMesh) {
        var _origCreateMesh = FOW._createMesh;
        FOW._createMesh = function() {
            if (FogOfWar3D._getFogMode() === '3dbox') {
                // 볼류메트릭 생성 차단
                return null;
            }
            return _origCreateMesh.apply(this, arguments);
        };
    }

    // FogOfWar.dispose 래핑: 3D 박스 메쉬도 함께 정리
    if (FOW && FOW.dispose) {
        var _origDispose = FOW.dispose;
        FOW.dispose = function() {
            FogOfWar3D._disposeMesh();
            return _origDispose.apply(this, arguments);
        };
    }

    // PostProcess._updateUniforms 후킹: 3D 박스 메쉬 생성 및 매 프레임 갱신
    if (typeof PostProcess !== 'undefined') {
        var _FogOfWar3D_origUpdateUniforms = PostProcess._updateUniforms;
        PostProcess._updateUniforms = function() {
            _FogOfWar3D_origUpdateUniforms.call(this);

            if (!FOW || !FOW._active) return;
            if (FogOfWar3D._getFogMode() !== '3dbox') {
                // 3D 박스 모드 아님: 메쉬가 있으면 제거
                if (FogOfWar3D._active) FogOfWar3D._disposeMesh();
                return;
            }

            // 3D 박스 메쉬 lazy 생성
            if (!FogOfWar3D._instancedMesh && FOW._fogTexture) {
                var scene = null;
                if (this._renderPass) {
                    scene = this._renderPass.scene;
                } else if (PostProcess._2dRenderPass && PostProcess._2dRenderPass._rendererObj) {
                    scene = PostProcess._2dRenderPass._rendererObj.scene;
                }
                if (scene) {
                    var mesh = FogOfWar3D._createMesh(FOW._mapWidth, FOW._mapHeight, $dataMap.fogOfWar);
                    if (mesh) scene.add(mesh);
                }
            }

            // 매 프레임 유니폼 갱신
            if (FogOfWar3D._active) {
                var now = performance.now() / 1000;
                var dt = FogOfWar3D._lastTime > 0 ? Math.min(now - FogOfWar3D._lastTime, 0.1) : 0.016;
                FogOfWar3D._lastTime = now;
                FogOfWar3D._updateUniforms(dt);
            }
        };
    }
}

})();
