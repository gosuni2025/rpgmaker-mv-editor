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
    'varying float vHeightNorm;',
    'varying vec2 vTileUV;',
    'varying vec3 vWorldPos;',
    'varying vec3 vLocalPos;',
    '',
    'uniform vec2 mapSize;',           // mapWidth, mapHeight (타일 수)
    'uniform float tileSize;',         // 48.0
    '',
    'void main() {',
    '    // instanceMatrix에서 월드 위치 추출',
    '    vec3 instancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
    '',
    '    vLocalPos = position;',
    '    // position.z: -0.5 ~ 0.5 (BoxGeometry 기준)',
    '    // 박스는 Z축으로 fogHeight 크기 → 바닥(0)~꼭대기(1)',
    '    vHeightNorm = position.z + 0.5;',
    '',
    '    // 타일 UV: 인스턴스 중심 위치로부터 타일 좌표 계산',
    '    vTileUV = vec2(instancePos.x / (mapSize.x * tileSize), instancePos.y / (mapSize.y * tileSize));',
    '',
    '    vec4 worldPos = instanceMatrix * vec4(position, 1.0);',
    '    vWorldPos = worldPos.xyz;',
    '',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos.xyz, 1.0);',
    '}'
].join('\n');

var BOX_FOG_FRAG = [
    'precision highp float;',
    '',
    'varying float vHeightNorm;',
    'varying vec2 vTileUV;',
    'varying vec3 vWorldPos;',
    'varying vec3 vLocalPos;',
    '',
    'uniform sampler2D tFog;',
    'uniform vec3 fogColor;',
    'uniform vec3 fogColorTop;',
    'uniform float unexploredAlpha;',
    'uniform float exploredAlpha;',
    'uniform float uTime;',
    'uniform vec2 mapSize;',
    'uniform float tileSize;',
    'uniform vec2 scrollOffset;',
    'uniform vec2 mapPixelSize;',
    'uniform float heightFalloff;',     // 높이 감쇠 계수
    'uniform float edgeAnimOn;',
    'uniform float edgeAnimSpeed;',
    'uniform float heightGradientOn;',
    'uniform float dissolveStrength;',
    'uniform float tentacleSharpness;',
    '',
    '// --- 노이즈 함수 ---',
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
    '// NEAREST 샘플링',
    'float sampleExplNearest(vec2 uv) {',
    '    vec2 texel = 1.0 / mapSize;',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).g;',
    '}',
    'float sampleGrowNearest(vec2 uv) {',
    '    vec2 texel = 1.0 / mapSize;',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).a;',
    '}',
    'float sampleFadeNearest(vec2 uv) {',
    '    vec2 texel = 1.0 / mapSize;',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).b;',
    '}',
    '',
    'void main() {',
    '    // 1. tFog 샘플링',
    '    vec4 fogSample = texture2D(tFog, vTileUV);',
    '    float visibility = fogSample.r;',
    '    float explored = fogSample.g;',
    '    float tentacleFade = fogSample.b;',
    '    float growFade = fogSample.a;',
    '',
    '    // 2. 현재 시야 (vis > 0.99): 완전 투명 → discard',
    '    if (visibility > 0.99) discard;',
    '',
    '    // 3. 기본 알파 계산',
    '    float baseAlpha;',
    '    if (explored < 0.5) {',
    '        // 미탐험: unexploredAlpha',
    '        baseAlpha = unexploredAlpha;',
    '    } else {',
    '        // 탐험완료: exploredAlpha, visibility에 따라 감소',
    '        baseAlpha = exploredAlpha * (1.0 - visibility);',
    '    }',
    '',
    '    if (baseAlpha < 0.001) discard;',
    '',
    '    // 4. 높이 감쇠',
    '    float hFade = exp(-vHeightNorm * heightFalloff);',
    '    baseAlpha *= hFade;',
    '',
    '    // 5. 경계 촉수 효과 (3D에서만 — 윗면에서 들쭉날쭉한 실루엣)',
    '    vec2 texel = 1.0 / mapSize;',
    '    float myExpl = sampleExplNearest(vTileUV);',
    '',
    '    // 경계 타일 판정: 인접 타일 explored 상태 확인',
    '    bool isBorderTile = false;',
    '    if (myExpl < 0.5) {',
    '        // 미탐험 타일: 인접 8방향에 탐험 있으면 경계',
    '        float eL = sampleExplNearest(vTileUV + vec2(-texel.x, 0.0));',
    '        float eR = sampleExplNearest(vTileUV + vec2( texel.x, 0.0));',
    '        float eU = sampleExplNearest(vTileUV + vec2(0.0, -texel.y));',
    '        float eD = sampleExplNearest(vTileUV + vec2(0.0,  texel.y));',
    '        if (eL > 0.5 || eR > 0.5 || eU > 0.5 || eD > 0.5) isBorderTile = true;',
    '    } else {',
    '        // 탐험 타일: 인접에 미탐험 있으면 경계',
    '        float eL = sampleExplNearest(vTileUV + vec2(-texel.x, 0.0));',
    '        float eR = sampleExplNearest(vTileUV + vec2( texel.x, 0.0));',
    '        float eU = sampleExplNearest(vTileUV + vec2(0.0, -texel.y));',
    '        float eD = sampleExplNearest(vTileUV + vec2(0.0,  texel.y));',
    '        if (eL < 0.5 || eR < 0.5 || eU < 0.5 || eD < 0.5) isBorderTile = true;',
    '    }',
    '',
    '    // 촉수: 경계 타일에서 높이 방향 노이즈',
    '    if (isBorderTile) {',
    '        vec2 worldXY = vWorldPos.xy + scrollOffset;',
    '        float timeS = uTime * edgeAnimSpeed;',
    '',
    '        float n = fbm3(worldXY * 0.025 + vec2(timeS * 0.06, timeS * 0.04));',
    '        float nNorm = clamp(n + 0.5, 0.0, 1.0);',
    '        float tentacleHeight = pow(nNorm, tentacleSharpness) * dissolveStrength;',
    '',
    '        // fade 연동',
    '        float fadeFactor;',
    '        if (myExpl < 0.5) {',
    '            fadeFactor = growFade;',  // 미탐험: 촉수 자라남
    '        } else {',
    '            fadeFactor = tentacleFade;',  // 탐험: 촉수 사라짐
    '        }',
    '        tentacleHeight *= fadeFactor;',
    '',
    '        // 촉수 높이를 정규화 (0~1 범위에서 동작)',
    '        float normalizedTentacleH = tentacleHeight / 3.0;', // dissolveStrength 기본 2.0, 최대 ~3타일
    '',
    '        // 현재 높이가 촉수 높이 이내면 fog, 아니면 discard',
    '        if (vHeightNorm > normalizedTentacleH && edgeAnimOn > 0.5) {',
    '            discard;',
    '        }',
    '    }',
    '',
    '    // 6. 높이 그라데이션 색상',
    '    vec3 color;',
    '    if (heightGradientOn > 0.5) {',
    '        color = mix(fogColor, fogColorTop, vHeightNorm);',
    '    } else {',
    '        color = fogColor;',
    '    }',
    '',
    '    // 7. 경계 노이즈 색상 변조 (옵셔널)',
    '    if (edgeAnimOn > 0.5) {',
    '        float timeS = uTime * edgeAnimSpeed;',
    '        float wave = _valueNoise(vWorldPos.xy * 0.015 + vec2(timeS * 0.08, timeS * 0.06));',
    '        float edgeMask = smoothstep(0.0, 0.15, baseAlpha) * (1.0 - smoothstep(0.4, 0.7, baseAlpha));',
    '        baseAlpha += wave * 0.1 * edgeMask;',
    '        baseAlpha = clamp(baseAlpha, 0.0, 1.0);',
    '    }',
    '',
    '    if (baseAlpha < 0.001) discard;',
    '',
    '    gl_FragColor = vec4(color, baseAlpha);',
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
    var heightFalloff = config && config.heightFalloff != null ? config.heightFalloff : 3.0;
    var dissolveStrength = (fogOfWar._shaderOverrides && fogOfWar._shaderOverrides.dissolveStrength != null)
        ? fogOfWar._shaderOverrides.dissolveStrength : 2.0;
    var tentacleSharpness = (fogOfWar._shaderOverrides && fogOfWar._shaderOverrides.tentacleSharpness != null)
        ? fogOfWar._shaderOverrides.tentacleSharpness : 3.0;

    this._fogHeight = fogHeight;

    var totalInstances = mapWidth * mapHeight;

    // BoxGeometry: 1타일 x 1타일 x fogHeight
    var geometry = new THREE.BoxGeometry(tileSize, tileSize, fogHeight);

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
            scrollOffset:       { value: new THREE.Vector2(0, 0) },
            mapPixelSize:       { value: new THREE.Vector2(mapWidth * tileSize, mapHeight * tileSize) },
            heightFalloff:      { value: heightFalloff },
            edgeAnimOn:         { value: edgeAnimation ? 1.0 : 0.0 },
            edgeAnimSpeed:      { value: edgeAnimationSpeed },
            heightGradientOn:   { value: heightGradient ? 1.0 : 0.0 },
            dissolveStrength:   { value: dissolveStrength },
            tentacleSharpness:  { value: tentacleSharpness }
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
