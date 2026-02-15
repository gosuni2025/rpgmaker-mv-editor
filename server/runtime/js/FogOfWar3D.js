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
    '            if (isTopFace) {',
    '                // --- 윗면: 노이즈로 촉수 실루엣 ---',
    '                vec2 worldXY = vWorldPos.xy + scrollOffset;',
    '                float nN = tentacleNoise(worldXY);',
    '                float tH = pow(nN, tentacleSharpness) * dissolveStrength * tileSize / fogHeight * gf;',
    '                if (heightNorm > 1.0 - tH) discard;',
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
    '            if (isTopFace) {',
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
        ? fogOfWar._shaderOverrides.dissolveStrength : 4.0;
    var tentacleSharpness = (fogOfWar._shaderOverrides && fogOfWar._shaderOverrides.tentacleSharpness != null)
        ? fogOfWar._shaderOverrides.tentacleSharpness : 1.8;

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
    this._disposeTentacles();
    this._active = false;
};

//=============================================================================
// 촉수 메쉬 시스템 - 박스 외곽 엣지에서 바깥으로 뻗어나오는 촉수
//=============================================================================

FogOfWar3D._tentacleMesh = null;
FogOfWar3D._tentacleEdges = null;  // 현재 경계 엣지 캐시

// 촉수 버텍스 셰이더: 정점을 outward 방향으로 노이즈만큼 밀어냄
var TENTACLE_VERT = [
    'attribute float aDepth;',       // 0=박스면(밀착), 1=촉수끝(최대돌출)
    'attribute vec2 aOutward;',      // 바깥 방향 (정규화된 XY)
    'attribute float aWallCoord;',   // 벽면 수평 좌표 (노이즈 시드)
    'attribute float aZCoord;',      // 이 정점의 Z 좌표 (0~fogHeight, 노이즈 시드)
    '',
    'varying float vDepth;',
    'varying float vAlpha;',
    'varying vec3 vWorldPos;',
    'varying float vHeightNorm;',    // Z/fogHeight (그라데이션용)
    '',
    'uniform float uTime;',
    'uniform float edgeAnimSpeed;',
    'uniform float dissolveStrength;',
    'uniform float tentacleSharpness;',
    'uniform float fogHeight;',
    'uniform float tentacleMaxDisplace;',
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
    'void main() {',
    '    float timeS = uTime * edgeAnimSpeed;',
    '    // 2D 노이즈: (벽면 수평좌표, Z높이) → 촉수 돌출량',
    '    vec2 noiseCoord = vec2(aWallCoord / 8.0, aZCoord / 12.0);',
    '    float n1 = fbm3(noiseCoord * 1.0 + vec2(timeS * 0.3, timeS * 0.2));',
    '    float n2 = _valueNoise(noiseCoord * 2.5 + vec2(-timeS * 0.4, 17.0));',
    '    float n3 = _valueNoise(noiseCoord * 5.0 + vec2(timeS * 0.5, -31.0));',
    '    float noise = clamp(n1 * 0.5 + n2 * 0.3 + n3 * 0.2 + 0.5, 0.0, 1.0);',
    '',
    '    // 촉수 돌출량: noise^sharpness * strength * maxDisplace',
    '    float tentDisp = pow(noise, tentacleSharpness) * dissolveStrength * tentacleMaxDisplace;',
    '',
    '    // depth별: 0(박스면)은 변형 없음, 1(촉수끝)은 최대',
    '    float displace = aDepth * tentDisp;',
    '',
    '    // outward(XY) 방향으로만 밀어내기',
    '    vec3 displaced = position;',
    '    displaced.xy += aOutward * displace;',
    '',
    '    vDepth = aDepth;',
    '    vAlpha = 1.0 - aDepth;',
    '    vWorldPos = displaced;',
    '    vHeightNorm = clamp(aZCoord / fogHeight, 0.0, 1.0);',
    '',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);',
    '}'
].join('\n');

// 촉수 프래그먼트 셰이더: fog 색상 + 높이별 알파 페이드
var TENTACLE_FRAG = [
    'precision highp float;',
    '',
    'varying float vDepth;',
    'varying float vAlpha;',
    'varying vec3 vWorldPos;',
    'varying float vHeightNorm;',
    '',
    'uniform vec3 fogColor;',
    'uniform vec3 fogColorTop;',
    'uniform float unexploredAlpha;',
    'uniform float heightGradientOn;',
    '',
    'void main() {',
    '    if (vAlpha < 0.01) discard;',
    '    vec3 color = heightGradientOn > 0.5 ? mix(fogColor, fogColorTop, vHeightNorm) : fogColor;',
    '    // 끝(depth=1)으로 갈수록 페이드아웃',
    '    float alpha = unexploredAlpha * pow(vAlpha, 1.5);',
    '    gl_FragColor = vec4(color, alpha);',
    '}'
].join('\n');

// 경계 엣지 탐지: fog 텍스처에서 미탐험↔탐험 경계를 찾아 엣지 목록 반환
// 반환: [{tx, ty, dir}] — dir: 0=+X, 1=-X, 2=+Y, 3=-Y (탐험된 쪽 방향)
FogOfWar3D._detectBorderEdges = function() {
    var fow = window.FogOfWar;
    if (!fow || !fow._exploredData) return [];

    var w = this._mapWidth;
    var h = this._mapHeight;
    var explored = fow._exploredData;  // Uint8Array[w*h]
    var edges = [];

    for (var ty = 0; ty < h; ty++) {
        for (var tx = 0; tx < w; tx++) {
            var idx = ty * w + tx;
            if (explored[idx]) continue;  // 탐험된 타일은 건너뜀

            // 미탐험 타일의 인접 탐험 타일 방향
            if (tx + 1 < w && explored[idx + 1])    edges.push({tx: tx, ty: ty, dir: 0});  // +X
            if (tx - 1 >= 0 && explored[idx - 1])   edges.push({tx: tx, ty: ty, dir: 1});  // -X
            if (ty + 1 < h && explored[idx + w])     edges.push({tx: tx, ty: ty, dir: 2});  // +Y
            if (ty - 1 >= 0 && explored[idx - w])    edges.push({tx: tx, ty: ty, dir: 3});  // -Y
        }
    }
    return edges;
};

// 촉수 메쉬 생성: 각 경계 엣지의 옆면에 3D 격자(벽면수평 × 높이 × 돌출깊이) 배치
// 벽면 수평(wSegs)을 세분화하여 타일 너비를 따라 노이즈 변화 생성
FogOfWar3D._buildTentacleMesh = function(edges) {
    if (edges.length === 0) return null;

    var tileSize = 48;
    var fogHeight = this._fogHeight;
    var wSegs = 6;   // 벽면 수평 세그먼트 수 (타일 1개 너비를 6등분)
    var zSegs = 12;  // 높이(Z) 세그먼트 수
    var dSegs = 4;   // 깊이(돌출) 세그먼트 수

    // 각 엣지: (wSegs+1) × (zSegs+1) × (dSegs+1) 정점
    var vertsPerEdge = (wSegs + 1) * (zSegs + 1) * (dSegs + 1);
    // 각 셀: wSegs × zSegs × dSegs 큐보이드, 각 큐보이드의 면은...
    // 실제로는 벽면(w×z) × 깊이(d) 형태의 볼륨
    // 삼각형: 각 (w,z) 셀의 depth 방향 face + 각 (w,d) 셀의 z 방향 face + 각 (z,d) 셀의 w 방향 face
    // → 너무 복잡. 대신 벽면(w×z) 격자를 depth별로 복제하는 방식 유지
    // 인접 depth 레이어 간 연결은 vertex shader에서 displace로 처리되므로,
    // 실제 렌더할 면은 가장 바깥 면(depth 방향에서 보이는 면)
    // → 간단하게: 각 depth 슬라이스마다 (w×z) quad strip 생성
    // 하지만 양면 렌더링이므로, (w×z×d) 격자로 만들고 모든 face 렌더

    // 간소화: 벽면 수평×높이 격자를 depth 방향으로 확장
    // 삼각형 수: wSegs*zSegs*2 면 × (dSegs+1)... 아니, 3D 격자의 모든 면을 만드는건 과하다
    // 대신: (w × z) 격자를 각 depth 레벨로 만들되, 인접 depth 간 연결
    // → 총 삼각형 = (wSegs * zSegs * dSegs) * 2 (w-z 면만, depth 방향)
    //              + (wSegs * dSegs * zSegs) * 2 가 아니라...
    //
    // 가장 단순하고 효과적인 방식: 벽면(w×z) 평면을 depth별로 만들어 연결
    // 각 (wi, zi) 칸에서 depth 방향의 quad strip
    // 삼각형 수: z-d면(w방향) + w-d면(z방향) + w-z면(d방향, 바깥면만)
    var trisPerEdge = wSegs * (zSegs * dSegs * 2)    // z-d 면 (촉수 옆 프로파일)
                    + zSegs * (wSegs * dSegs * 2)     // w-d 면 (촉수 상하 캡)
                    + wSegs * zSegs * 2;               // w-z 면 (최외곽 d=dSegs, 촉수 바깥면)
    var totalVerts = edges.length * vertsPerEdge;
    var totalTris = edges.length * trisPerEdge;

    var positions = new Float32Array(totalVerts * 3);
    var aDepth = new Float32Array(totalVerts);
    var aOutward = new Float32Array(totalVerts * 2);
    var aWallCoord = new Float32Array(totalVerts);
    var aZCoord = new Float32Array(totalVerts);
    var indices = new Uint32Array(totalTris * 3);

    var vi = 0;
    var ii = 0;

    var DIR_OUTWARD = [
        [1, 0],   // dir=0 (+X): 면은 Y축 방향으로 뻗음
        [-1, 0],  // dir=1 (-X): 면은 Y축 방향으로 뻗음
        [0, 1],   // dir=2 (+Y): 면은 X축 방향으로 뻗음
        [0, -1]   // dir=3 (-Y): 면은 X축 방향으로 뻗음
    ];

    // 벽면 탄젠트 (수평 방향): outward에 수직인 방향
    var DIR_TANGENT = [
        [0, 1],   // dir=0 (+X): 벽면은 Y 방향
        [0, 1],   // dir=1 (-X): 벽면은 Y 방향
        [1, 0],   // dir=2 (+Y): 벽면은 X 방향
        [1, 0]    // dir=3 (-Y): 벽면은 X 방향
    ];

    for (var e = 0; e < edges.length; e++) {
        var edge = edges[e];
        var tileLeft = edge.tx * tileSize;
        var tileBottom = edge.ty * tileSize;
        var outX = DIR_OUTWARD[edge.dir][0];
        var outY = DIR_OUTWARD[edge.dir][1];
        var tanX = DIR_TANGENT[edge.dir][0];
        var tanY = DIR_TANGENT[edge.dir][1];

        // 박스 면의 시작점 (벽면의 왼쪽/아래 끝)
        // +X면: x = tileRight, y = tileBottom ~ tileTop
        // -X면: x = tileLeft, y = tileBottom ~ tileTop
        // +Y면: y = tileTop, x = tileLeft ~ tileRight
        // -Y면: y = tileBottom, x = tileLeft ~ tileRight
        var startX, startY;
        if (edge.dir === 0) { startX = tileLeft + tileSize; startY = tileBottom; }
        else if (edge.dir === 1) { startX = tileLeft; startY = tileBottom; }
        else if (edge.dir === 2) { startX = tileLeft; startY = tileBottom + tileSize; }
        else { startX = tileLeft; startY = tileBottom; }

        var baseVi = vi;

        // 정점 생성: w × z × d 격자
        for (var wi = 0; wi <= wSegs; wi++) {
            var wNorm = wi / wSegs;
            // 벽면 수평 위치 (탄젠트 방향으로 이동)
            var wallX = startX + tanX * wNorm * tileSize;
            var wallY = startY + tanY * wNorm * tileSize;
            // wallCoord: 실제 월드 좌표 (노이즈 시드)
            var wCoord = (edge.dir === 0 || edge.dir === 1) ? wallY : wallX;

            for (var zi = 0; zi <= zSegs; zi++) {
                var zVal = (zi / zSegs) * fogHeight;

                for (var di = 0; di <= dSegs; di++) {
                    var dNorm = di / dSegs;

                    var vIdx = vi * 3;
                    positions[vIdx] = wallX;
                    positions[vIdx + 1] = wallY;
                    positions[vIdx + 2] = zVal;

                    aDepth[vi] = dNorm;
                    aOutward[vi * 2] = outX;
                    aOutward[vi * 2 + 1] = outY;
                    aWallCoord[vi] = wCoord;
                    aZCoord[vi] = zVal;

                    vi++;
                }
            }
        }

        // 인덱스 생성: 3종류의 면
        var stride_w = (zSegs + 1) * (dSegs + 1);
        var stride_z = (dSegs + 1);

        // helper: 정점 인덱스 계산
        // v(wi, zi, di) = baseVi + wi*stride_w + zi*stride_z + di

        // 1) z-d 면: 벽면 수평 방향(w)에서 보이는 촉수 프로파일
        //    각 wi 슬라이스에서 (zi, di) 격자의 quad
        for (var wi = 0; wi < wSegs; wi++) {
            for (var zi = 0; zi < zSegs; zi++) {
                for (var di = 0; di < dSegs; di++) {
                    var a = baseVi + wi * stride_w + zi * stride_z + di;
                    var b = a + 1;              // di+1
                    var c = a + stride_z;       // zi+1
                    var d = c + 1;              // zi+1, di+1
                    indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
                    indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
                }
            }
        }

        // 2) w-d 면: 높이(z) 방향에서 보이는 촉수 상하 캡
        //    각 zi 슬라이스에서 (wi, di) 격자의 quad
        for (var zi = 0; zi < zSegs; zi++) {
            for (var wi = 0; wi < wSegs; wi++) {
                for (var di = 0; di < dSegs; di++) {
                    var a = baseVi + wi * stride_w + zi * stride_z + di;
                    var b = a + 1;                  // di+1
                    var c = a + stride_w;            // wi+1
                    var d = c + 1;                   // wi+1, di+1
                    indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
                    indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
                }
            }
        }

        // 3) w-z 면 (최외곽 d=dSegs만): 촉수 바깥 표면
        var di_outer = dSegs;
        for (var wi = 0; wi < wSegs; wi++) {
            for (var zi = 0; zi < zSegs; zi++) {
                var a = baseVi + wi * stride_w + zi * stride_z + di_outer;
                var b = a + stride_z;            // zi+1
                var c = a + stride_w;            // wi+1
                var d = c + stride_z;            // wi+1, zi+1
                indices[ii++] = a; indices[ii++] = b; indices[ii++] = c;
                indices[ii++] = c; indices[ii++] = b; indices[ii++] = d;
            }
        }
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, vi * 3), 3));
    geometry.setAttribute('aDepth', new THREE.BufferAttribute(aDepth.subarray(0, vi), 1));
    geometry.setAttribute('aOutward', new THREE.BufferAttribute(aOutward.subarray(0, vi * 2), 2));
    geometry.setAttribute('aWallCoord', new THREE.BufferAttribute(aWallCoord.subarray(0, vi), 1));
    geometry.setAttribute('aZCoord', new THREE.BufferAttribute(aZCoord.subarray(0, vi), 1));
    geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, ii), 1));

    return geometry;
};

FogOfWar3D._createTentacles = function(scene) {
    this._disposeTentacles();

    var edges = this._detectBorderEdges();
    if (edges.length === 0) return;

    var geometry = this._buildTentacleMesh(edges);
    if (!geometry) return;

    var fogOfWar = window.FogOfWar;
    var fogColor = fogOfWar._fogColor;
    var fogColorTop = fogOfWar._fogColorTop;

    var so = fogOfWar._shaderOverrides || {};
    var tentacleMaxDisplace = 24;  // 촉수 최대 돌출 거리 (px)

    var material = new THREE.ShaderMaterial({
        uniforms: {
            uTime:              { value: this._time },
            edgeAnimSpeed:      { value: fogOfWar._edgeAnimationSpeed },
            dissolveStrength:   { value: so.dissolveStrength != null ? so.dissolveStrength : 4.0 },
            tentacleSharpness:  { value: so.tentacleSharpness != null ? so.tentacleSharpness : 1.8 },
            fogHeight:          { value: this._fogHeight },
            tentacleMaxDisplace: { value: tentacleMaxDisplace },
            fogColor:           { value: new THREE.Vector3(fogColor.r, fogColor.g, fogColor.b) },
            fogColorTop:        { value: new THREE.Vector3(fogColorTop.r, fogColorTop.g, fogColorTop.b) },
            unexploredAlpha:    { value: fogOfWar._unexploredAlpha },
            heightGradientOn:   { value: fogOfWar._heightGradient ? 1.0 : 0.0 }
        },
        vertexShader: TENTACLE_VERT,
        fragmentShader: TENTACLE_FRAG,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 9991;
    mesh._isFogOfWar3DTentacle = true;

    this._tentacleMesh = mesh;
    this._tentacleEdges = edges;
    scene.add(mesh);
};

FogOfWar3D._disposeTentacles = function() {
    if (this._tentacleMesh) {
        if (this._tentacleMesh.parent) {
            this._tentacleMesh.parent.remove(this._tentacleMesh);
        }
        this._tentacleMesh.geometry.dispose();
        this._tentacleMesh.material.dispose();
        this._tentacleMesh = null;
    }
    this._tentacleEdges = null;
};

FogOfWar3D._updateTentacleUniforms = function() {
    if (!this._tentacleMesh) return;

    var fogOfWar = window.FogOfWar;
    if (!fogOfWar) return;

    var u = this._tentacleMesh.material.uniforms;
    u.uTime.value = this._time;
    u.edgeAnimSpeed.value = fogOfWar._edgeAnimationSpeed;
    u.fogColor.value.set(fogOfWar._fogColor.r, fogOfWar._fogColor.g, fogOfWar._fogColor.b);
    u.fogColorTop.value.set(fogOfWar._fogColorTop.r, fogOfWar._fogColorTop.g, fogOfWar._fogColorTop.b);
    u.unexploredAlpha.value = fogOfWar._unexploredAlpha;
    u.heightGradientOn.value = fogOfWar._heightGradient ? 1.0 : 0.0;

    var so = fogOfWar._shaderOverrides || {};
    u.dissolveStrength.value = so.dissolveStrength != null ? so.dissolveStrength : 4.0;
    u.tentacleSharpness.value = so.tentacleSharpness != null ? so.tentacleSharpness : 1.8;
};

// 경계가 변했는지 확인하고 메쉬 재생성
FogOfWar3D._refreshTentaclesIfNeeded = function(scene) {
    var newEdges = this._detectBorderEdges();
    var oldEdges = this._tentacleEdges;

    // 간단 비교: 엣지 수가 다르면 재생성
    var needRebuild = !oldEdges || newEdges.length !== oldEdges.length;

    if (!needRebuild && oldEdges) {
        // 내용 비교
        for (var i = 0; i < newEdges.length; i++) {
            if (newEdges[i].tx !== oldEdges[i].tx ||
                newEdges[i].ty !== oldEdges[i].ty ||
                newEdges[i].dir !== oldEdges[i].dir) {
                needRebuild = true;
                break;
            }
        }
    }

    if (needRebuild) {
        this._disposeTentacles();
        if (newEdges.length > 0) {
            var geometry = this._buildTentacleMesh(newEdges);
            if (!geometry) return;

            var fogOfWar = window.FogOfWar;
            var fogColor = fogOfWar._fogColor;
            var fogColorTop = fogOfWar._fogColorTop;
            var so = fogOfWar._shaderOverrides || {};

            var material = new THREE.ShaderMaterial({
                uniforms: {
                    uTime:              { value: this._time },
                    edgeAnimSpeed:      { value: fogOfWar._edgeAnimationSpeed },
                    dissolveStrength:   { value: so.dissolveStrength != null ? so.dissolveStrength : 4.0 },
                    tentacleSharpness:  { value: so.tentacleSharpness != null ? so.tentacleSharpness : 1.8 },
                    fogHeight:          { value: this._fogHeight },
                    tentacleMaxDisplace: { value: 24 },
                    fogColor:           { value: new THREE.Vector3(fogColor.r, fogColor.g, fogColor.b) },
                    fogColorTop:        { value: new THREE.Vector3(fogColorTop.r, fogColorTop.g, fogColorTop.b) },
                    unexploredAlpha:    { value: fogOfWar._unexploredAlpha },
                    heightGradientOn:   { value: fogOfWar._heightGradient ? 1.0 : 0.0 }
                },
                vertexShader: TENTACLE_VERT,
                fragmentShader: TENTACLE_FRAG,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                side: THREE.DoubleSide
            });

            var mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            mesh.renderOrder = 9991;
            mesh._isFogOfWar3DTentacle = true;

            this._tentacleMesh = mesh;
            this._tentacleEdges = newEdges;
            scene.add(mesh);
        }
    }
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
    u.dissolveStrength.value = so.dissolveStrength != null ? so.dissolveStrength : 4.0;
    u.tentacleSharpness.value = so.tentacleSharpness != null ? so.tentacleSharpness : 1.8;
    u.fadeSmoothness.value = so.fadeSmoothness != null ? so.fadeSmoothness : 0.3;

    // 스크롤 오프셋
    var ox = 0, oy = 0;
    if (typeof $gameMap !== 'undefined' && $gameMap) {
        ox = $gameMap.displayX() * 48;
        oy = $gameMap.displayY() * 48;
    }
    u.scrollOffset.value.set(ox, oy);

    // 촉수 유니폼 갱신
    this._updateTentacleUniforms();
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

                // 촉수 메쉬 갱신 (경계 변화 감지)
                var scene = null;
                if (this._renderPass) {
                    scene = this._renderPass.scene;
                } else if (PostProcess._2dRenderPass && PostProcess._2dRenderPass._rendererObj) {
                    scene = PostProcess._2dRenderPass._rendererObj.scene;
                }
                if (scene) {
                    FogOfWar3D._refreshTentaclesIfNeeded(scene);
                }
            }
        };
    }
}

})();
