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
// 촉수 메쉬 시스템 - 윗면 경계에서 위로 솟아오르는 개별 촉수 줄기(strand)
//=============================================================================

FogOfWar3D._tentacleMesh = null;
FogOfWar3D._tentacleEdges = null;  // 현재 경계 엣지 캐시

// 촉수 버텍스 셰이더: 각 줄기가 노이즈로 유기적으로 휘어지는 리본
var TENTACLE_VERT = [
    'attribute float aHeightT;',     // 0=바닥(박스 꼭대기), 1=촉수 끝
    'attribute float aRibbonSide;',  // -1=왼쪽, +1=오른쪽 (리본 폭)
    'attribute vec2 aSeedXY;',       // 촉수 시작점 월드 XY (노이즈 시드)
    'attribute float aBaseZ;',       // 시작 Z (fogHeight)
    'attribute float aTentacleHeight;', // 이 촉수의 높이
    '',
    'varying float vHeightT;',
    'varying float vAlpha;',
    'varying vec3 vWorldPos;',
    'varying float vHeightNorm;',
    '',
    'uniform float uTime;',
    'uniform float edgeAnimSpeed;',
    'uniform float fogHeight;',
    'uniform float tentacleMaxLength;',
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
    '    float t = aHeightT;',  // 0~1 along strand
    '',
    '    // 촉수 줄기의 XY 오프셋: 높이에 따라 점점 크게 휘어짐',
    '    // 저주파(큰 곡선) + 고주파(잔물결) 조합',
    '    vec2 seed = aSeedXY / 48.0;',  // 타일 단위로 정규화
    '',
    '    // X방향 휘어짐',
    '    float curveLowX = fbm3(seed * 1.5 + vec2(timeS * 0.08, t * 2.0));',
    '    float curveHighX = _valueNoise(seed * 3.0 + vec2(-timeS * 0.15, t * 4.0 + 7.0));',
    '    float offsetX = (curveLowX * 0.7 + curveHighX * 0.3) * t * t * tentacleMaxLength * 0.8;',
    '',
    '    // Y방향 휘어짐 (다른 시드)',
    '    float curveLowY = fbm3(seed * 1.5 + vec2(t * 2.0 + 13.0, timeS * 0.1));',
    '    float curveHighY = _valueNoise(seed * 3.0 + vec2(t * 4.0 - 5.0, timeS * 0.12));',
    '    float offsetY = (curveLowY * 0.7 + curveHighY * 0.3) * t * t * tentacleMaxLength * 0.8;',
    '',
    '    // Z = 위로 솟아오름 (바닥=aBaseZ, 끝=aBaseZ+tentacleHeight)',
    '    float z = aBaseZ + t * aTentacleHeight;',
    '',
    '    // 리본 폭: 바닥에서 넓고 끝에서 좁아짐',
    '    float ribbonWidth = mix(6.0, 0.5, t * t);',
    '',
    '    // 리본 측면 방향: 줄기 접선에 수직인 방향 (근사)',
    '    // 접선 = d(offset)/dt 의 수직 → 간단히 90도 회전',
    '    float dOx = curveLowX + curveHighX * 0.5;',
    '    float dOy = curveLowY + curveHighY * 0.5;',
    '    float len = max(length(vec2(dOx, dOy)), 0.01);',
    '    vec2 normal2d = vec2(-dOy, dOx) / len;',
    '',
    '    // 최종 위치',
    '    vec3 pos = vec3(',
    '        aSeedXY.x + offsetX + aRibbonSide * normal2d.x * ribbonWidth,',
    '        aSeedXY.y + offsetY + aRibbonSide * normal2d.y * ribbonWidth,',
    '        z',
    '    );',
    '',
    '    vHeightT = t;',
    '    vAlpha = 1.0 - t;',
    '    vWorldPos = pos;',
    '    vHeightNorm = clamp(z / (fogHeight + tentacleMaxLength), 0.0, 1.0);',
    '',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);',
    '}'
].join('\n');

// 촉수 프래그먼트 셰이더
var TENTACLE_FRAG = [
    'precision highp float;',
    '',
    'varying float vHeightT;',
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
    '    float alpha = unexploredAlpha * pow(vAlpha, 1.5);',
    '    if (alpha < 0.01) discard;',
    '    vec3 color = heightGradientOn > 0.5 ? mix(fogColor, fogColorTop, vHeightNorm) : fogColor;',
    '    gl_FragColor = vec4(color, alpha);',
    '}'
].join('\n');

// 경계 타일 탐지: 미탐험 타일 중 인접에 탐험된 타일이 있는 것
// 반환: [{tx, ty}] (중복 없음)
FogOfWar3D._detectBorderTiles = function() {
    var fow = window.FogOfWar;
    if (!fow || !fow._exploredData) return [];

    var w = this._mapWidth;
    var h = this._mapHeight;
    var explored = fow._exploredData;
    var tiles = [];

    for (var ty = 0; ty < h; ty++) {
        for (var tx = 0; tx < w; tx++) {
            var idx = ty * w + tx;
            if (explored[idx]) continue;

            // 4방향 중 하나라도 탐험되었으면 경계
            if ((tx + 1 < w && explored[idx + 1]) ||
                (tx - 1 >= 0 && explored[idx - 1]) ||
                (ty + 1 < h && explored[idx + w]) ||
                (ty - 1 >= 0 && explored[idx - w])) {
                tiles.push({tx: tx, ty: ty});
            }
        }
    }
    return tiles;
};

// 촉수 줄기(strand) 리본 메쉬 빌드
// 각 경계 타일 위에 여러 촉수 줄기를 배치
FogOfWar3D._buildTentacleMesh = function(borderTiles) {
    if (borderTiles.length === 0) return null;

    var tileSize = 48;
    var fogHeight = this._fogHeight;
    var strandsPerTile = 5;   // 타일당 촉수 수
    var segsPerStrand = 12;   // 높이 세그먼트 수

    // 각 줄기: (segsPerStrand+1) * 2 정점 (좌/우 리본), segsPerStrand * 2 삼각형
    var vertsPerStrand = (segsPerStrand + 1) * 2;
    var trisPerStrand = segsPerStrand * 2;
    var totalStrands = borderTiles.length * strandsPerTile;
    var totalVerts = totalStrands * vertsPerStrand;
    var totalTris = totalStrands * trisPerStrand;

    var positions = new Float32Array(totalVerts * 3);   // 더미, 셰이더에서 덮어씀
    var aHeightT = new Float32Array(totalVerts);
    var aRibbonSide = new Float32Array(totalVerts);
    var aSeedXY = new Float32Array(totalVerts * 2);
    var aBaseZ = new Float32Array(totalVerts);
    var aTentacleHeight = new Float32Array(totalVerts);
    var indices = new Uint32Array(totalTris * 3);

    var vi = 0;
    var ii = 0;

    // 간단한 해시 함수 (결정적 랜덤)
    function hash(a, b) {
        var h = (a * 73856093) ^ (b * 19349663);
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = (h >> 16) ^ h;
        return (h & 0x7fffffff) / 0x7fffffff;
    }

    for (var ti = 0; ti < borderTiles.length; ti++) {
        var tile = borderTiles[ti];
        var tileCX = tile.tx * tileSize + tileSize / 2;
        var tileCY = tile.ty * tileSize + tileSize / 2;

        for (var si = 0; si < strandsPerTile; si++) {
            // 촉수 시작점: 타일 내 랜덤 위치
            var r1 = hash(tile.tx * 7 + si * 31, tile.ty * 13 + si * 47);
            var r2 = hash(tile.tx * 17 + si * 53, tile.ty * 23 + si * 61);
            var r3 = hash(tile.tx * 37 + si * 71, tile.ty * 43 + si * 83);
            var seedX = tile.tx * tileSize + r1 * tileSize;
            var seedY = tile.ty * tileSize + r2 * tileSize;
            var tentH = fogHeight * (0.3 + r3 * 0.7);  // 촉수 높이: fogHeight의 30~100%

            var baseVi = vi;

            // 정점 생성: 높이 세그먼트 × 좌우 2
            for (var hi = 0; hi <= segsPerStrand; hi++) {
                var t = hi / segsPerStrand;
                for (var side = 0; side < 2; side++) {
                    var ribbonS = side === 0 ? -1.0 : 1.0;

                    var vIdx = vi * 3;
                    // 더미 position (셰이더에서 덮어씀)
                    positions[vIdx] = seedX;
                    positions[vIdx + 1] = seedY;
                    positions[vIdx + 2] = fogHeight + t * tentH;

                    aHeightT[vi] = t;
                    aRibbonSide[vi] = ribbonS;
                    aSeedXY[vi * 2] = seedX;
                    aSeedXY[vi * 2 + 1] = seedY;
                    aBaseZ[vi] = fogHeight;
                    aTentacleHeight[vi] = tentH;

                    vi++;
                }
            }

            // 인덱스: 삼각형 스트립 (좌-우 쌍으로)
            for (var hi = 0; hi < segsPerStrand; hi++) {
                var v0 = baseVi + hi * 2;      // 현재 높이 왼쪽
                var v1 = v0 + 1;               // 현재 높이 오른쪽
                var v2 = v0 + 2;               // 다음 높이 왼쪽
                var v3 = v0 + 3;               // 다음 높이 오른쪽
                indices[ii++] = v0; indices[ii++] = v2; indices[ii++] = v1;
                indices[ii++] = v1; indices[ii++] = v2; indices[ii++] = v3;
            }
        }
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, vi * 3), 3));
    geometry.setAttribute('aHeightT', new THREE.BufferAttribute(aHeightT.subarray(0, vi), 1));
    geometry.setAttribute('aRibbonSide', new THREE.BufferAttribute(aRibbonSide.subarray(0, vi), 1));
    geometry.setAttribute('aSeedXY', new THREE.BufferAttribute(aSeedXY.subarray(0, vi * 2), 2));
    geometry.setAttribute('aBaseZ', new THREE.BufferAttribute(aBaseZ.subarray(0, vi), 1));
    geometry.setAttribute('aTentacleHeight', new THREE.BufferAttribute(aTentacleHeight.subarray(0, vi), 1));
    geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, ii), 1));

    return geometry;
};

FogOfWar3D._createTentacleMaterial = function() {
    var fogOfWar = window.FogOfWar;
    var fogColor = fogOfWar._fogColor;
    var fogColorTop = fogOfWar._fogColorTop;

    return new THREE.ShaderMaterial({
        uniforms: {
            uTime:              { value: this._time },
            edgeAnimSpeed:      { value: fogOfWar._edgeAnimationSpeed },
            fogHeight:          { value: this._fogHeight },
            tentacleMaxLength:  { value: this._fogHeight * 0.6 },
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
};

FogOfWar3D._createTentacles = function(scene) {
    this._disposeTentacles();

    var borderTiles = this._detectBorderTiles();
    if (borderTiles.length === 0) return;

    var geometry = this._buildTentacleMesh(borderTiles);
    if (!geometry) return;

    var material = this._createTentacleMaterial();

    var mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 9991;
    mesh._isFogOfWar3DTentacle = true;

    this._tentacleMesh = mesh;
    this._tentacleEdges = borderTiles;
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
    u.fogHeight.value = this._fogHeight;
    u.tentacleMaxLength.value = this._fogHeight * 0.6;
    u.fogColor.value.set(fogOfWar._fogColor.r, fogOfWar._fogColor.g, fogOfWar._fogColor.b);
    u.fogColorTop.value.set(fogOfWar._fogColorTop.r, fogOfWar._fogColorTop.g, fogOfWar._fogColorTop.b);
    u.unexploredAlpha.value = fogOfWar._unexploredAlpha;
    u.heightGradientOn.value = fogOfWar._heightGradient ? 1.0 : 0.0;
};

// 경계가 변했는지 확인하고 메쉬 재생성
FogOfWar3D._refreshTentaclesIfNeeded = function(scene) {
    var newTiles = this._detectBorderTiles();
    var oldTiles = this._tentacleEdges;

    // 간단 비교
    var needRebuild = !oldTiles || newTiles.length !== oldTiles.length;

    if (!needRebuild && oldTiles) {
        for (var i = 0; i < newTiles.length; i++) {
            if (newTiles[i].tx !== oldTiles[i].tx ||
                newTiles[i].ty !== oldTiles[i].ty) {
                needRebuild = true;
                break;
            }
        }
    }

    if (needRebuild) {
        this._disposeTentacles();
        if (newTiles.length > 0) {
            var geometry = this._buildTentacleMesh(newTiles);
            if (!geometry) return;

            var material = this._createTentacleMaterial();

            var mesh = new THREE.Mesh(geometry, material);
            mesh.frustumCulled = false;
            mesh.renderOrder = 9991;
            mesh._isFogOfWar3DTentacle = true;

            this._tentacleMesh = mesh;
            this._tentacleEdges = newTiles;
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
