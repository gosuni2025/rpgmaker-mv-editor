//=============================================================================
// FogOfWar.js - Fog of War 시스템 (런타임 + 에디터)
//=============================================================================
// 3단계 시야: 미탐험(검은색) → 탐험완료(반투명) → 현재 시야(투명)
// 볼륨감 있는 안개: 다층 평면 + 안개벽 + 파티클 + 디졸브 노이즈
//
// 의존: THREE (global), PostProcess.js, $gameMap, $gamePlayer
//=============================================================================

(function() {

//=============================================================================
// FogOfWar 전역 객체
//=============================================================================

var FogOfWar = {};
window.FogOfWar = FogOfWar;

FogOfWar._active = false;
FogOfWar._fogTexture = null;       // DataTexture (mapWidth x mapHeight, RGBA)
FogOfWar._visibilityData = null;   // Float32Array — 현재 프레임 가시성 (0~1)
FogOfWar._exploredData = null;     // Uint8Array — 탐험 기록 (0 or 1)
FogOfWar._mapWidth = 0;
FogOfWar._mapHeight = 0;
FogOfWar._radius = 5;              // 시야 반경 (타일)
FogOfWar._fogColor = { r: 0, g: 0, b: 0 };
FogOfWar._unexploredAlpha = 1.0;   // 미탐험 불투명도
FogOfWar._exploredAlpha = 0.6;     // 탐험완료 불투명도
FogOfWar._prevPlayerX = -1;
FogOfWar._prevPlayerY = -1;
FogOfWar._fogMesh = null;          // 하위 호환: _fogGroup의 참조
FogOfWar._fogGroup = null;         // THREE.Group (다층 평면 + 벽 + 파티클)
FogOfWar._fogLayers = [];          // 다층 평면 메쉬 배열
FogOfWar._wallMesh = null;         // 안개벽 InstancedMesh
FogOfWar._particleSystem = null;   // 파티클 THREE.Points
FogOfWar._time = 0;                // 셰이더 uTime

//=============================================================================
// 셰이더 코드
//=============================================================================

// 공통 노이즈 함수 (GLSL 삽입)
var NOISE_GLSL = [
    '// Value noise (hash-based, no texture needed)',
    'vec2 _hash22(vec2 p) {',
    '    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
    '    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);',
    '}',
    'float _valueNoise(vec2 p) {',
    '    vec2 i = floor(p);',
    '    vec2 f = fract(p);',
    '    vec2 u = f * f * (3.0 - 2.0 * f);',
    '    float a = dot(_hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));',
    '    float b = dot(_hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));',
    '    float c = dot(_hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));',
    '    float d = dot(_hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));',
    '    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'float fbm2(vec2 p) {',
    '    float v = 0.0;',
    '    v += 0.5 * _valueNoise(p); p *= 2.01;',
    '    v += 0.25 * _valueNoise(p);',
    '    return v;',
    '}',
    ''
].join('\n');

// 다층 평면 vertex shader
var FOG_LAYER_VERT = [
    'uniform float uvScale;',
    'varying vec2 vUv;',
    'void main() {',
    '    // uvScale < 1.0이면 UV 살짝 확대 (상위 레이어 확산 효과)',
    '    vUv = 0.5 + (uv - 0.5) * uvScale;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');

// 다층 평면 fragment shader (디졸브 노이즈 포함)
var FOG_LAYER_FRAG = [
    'varying vec2 vUv;',
    'uniform sampler2D tFog;',
    'uniform vec3 fogColor;',
    'uniform float unexploredAlpha;',
    'uniform float exploredAlpha;',
    'uniform float alphaMultiplier;',
    'uniform float uTime;',
    'uniform vec2 mapSize;',
    '',
    NOISE_GLSL,
    '',
    'void main() {',
    '    vec4 fogSample = texture2D(tFog, vUv);',
    '    float visibility = fogSample.r;',
    '    float explored = fogSample.g;',
    '',
    '    float fogAlpha;',
    '    if (visibility > 0.01) {',
    '        fogAlpha = mix(exploredAlpha, 0.0, visibility);',
    '    } else if (explored > 0.5) {',
    '        fogAlpha = exploredAlpha;',
    '    } else {',
    '        fogAlpha = unexploredAlpha;',
    '    }',
    '',
    '    // 디졸브 노이즈: 경계 영역에서만 적용',
    '    float edgeFactor = smoothstep(0.0, 0.15, fogAlpha) * (1.0 - smoothstep(0.85, 1.0, fogAlpha));',
    '    if (edgeFactor > 0.01) {',
    '        vec2 noiseUV = vUv * mapSize * 0.15 + uTime * 0.03;',
    '        float noise = fbm2(noiseUV);',
    '        fogAlpha += noise * 0.3 * edgeFactor;',
    '        fogAlpha = clamp(fogAlpha, 0.0, 1.0);',
    '    }',
    '',
    '    fogAlpha *= alphaMultiplier;',
    '    if (fogAlpha < 0.001) discard;',
    '    gl_FragColor = vec4(fogColor, fogAlpha);',
    '}'
].join('\n');

// 안개벽 vertex shader
var WALL_VERT = [
    'attribute float aWallAlpha;',
    'varying float vWallAlpha;',
    'varying vec2 vWallUv;',
    'void main() {',
    '    vWallUv = uv;',
    '    vWallAlpha = aWallAlpha;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');

// 안개벽 fragment shader
var WALL_FRAG = [
    'uniform vec3 fogColor;',
    'uniform float unexploredAlpha;',
    'uniform float uTime;',
    'varying float vWallAlpha;',
    'varying vec2 vWallUv;',
    '',
    NOISE_GLSL,
    '',
    'void main() {',
    '    // 아래쪽 불투명, 위로 갈수록 페이드아웃',
    '    float heightFade = 1.0 - vWallUv.y;',
    '    heightFade = heightFade * heightFade;',
    '',
    '    // 미세 wave',
    '    float wave = sin(vWallUv.x * 6.2832 + uTime * 0.5) * 0.05;',
    '    heightFade = clamp(heightFade + wave, 0.0, 1.0);',
    '',
    '    float alpha = unexploredAlpha * heightFade * vWallAlpha;',
    '    if (alpha < 0.001) discard;',
    '    gl_FragColor = vec4(fogColor, alpha);',
    '}'
].join('\n');

// 파티클 vertex shader
var PARTICLE_VERT = [
    'attribute float aSize;',
    'attribute float aAlpha;',
    'attribute float aPhase;',
    'uniform float uTime;',
    'varying float vAlpha;',
    'void main() {',
    '    vAlpha = aAlpha * (0.5 + 0.5 * sin(uTime * 0.8 + aPhase));',
    '    vec3 pos = position;',
    '    pos.x += sin(uTime * 0.3 + aPhase) * 8.0;',
    '    pos.y += cos(uTime * 0.2 + aPhase * 1.3) * 6.0;',
    '    pos.z += sin(uTime * 0.15 + aPhase * 0.7) * 4.0;',
    '    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);',
    '    gl_PointSize = aSize * (300.0 / -mvPos.z);',
    '    gl_Position = projectionMatrix * mvPos;',
    '}'
].join('\n');

// 파티클 fragment shader
var PARTICLE_FRAG = [
    'uniform vec3 fogColor;',
    'varying float vAlpha;',
    'void main() {',
    '    vec2 uv = gl_PointCoord * 2.0 - 1.0;',
    '    float d = dot(uv, uv);',
    '    if (d > 1.0) discard;',
    '    float softMask = 1.0 - d;',
    '    softMask *= softMask;',
    '    float alpha = vAlpha * softMask;',
    '    if (alpha < 0.001) discard;',
    '    gl_FragColor = vec4(fogColor, alpha);',
    '}'
].join('\n');

//=============================================================================
// 레이어 설정
//=============================================================================

var LAYER_CONFIG = [
    { localZ: 3.0, alphaMultiplier: 1.0, uvScale: 1.0 },
    { localZ: 4.5, alphaMultiplier: 0.4, uvScale: 0.98 },
    { localZ: 6.0, alphaMultiplier: 0.2, uvScale: 0.96 }
];

var WALL_HEIGHT = 96;  // 안개벽 높이 (픽셀, 2타일)
var MAX_WALLS = 4096;   // 최대 안개벽 인스턴스 수
var PARTICLE_DENSITY = 0.5;  // 타일당 파티클 수
var MAX_PARTICLES = 8192;

//=============================================================================
// 초기화 / 해제
//=============================================================================

FogOfWar.setup = function(mapWidth, mapHeight, config) {
    this._mapWidth = mapWidth;
    this._mapHeight = mapHeight;
    this._active = true;

    if (config) {
        this._radius = config.radius != null ? config.radius : 5;
        if (config.fogColor) {
            var c = this._parseColor(config.fogColor);
            this._fogColor = c;
        }
        this._unexploredAlpha = config.unexploredAlpha != null ? config.unexploredAlpha : 1.0;
        this._exploredAlpha = config.exploredAlpha != null ? config.exploredAlpha : 0.6;
    }

    // 가시성 / 탐험 버퍼
    var size = mapWidth * mapHeight;
    this._visibilityData = new Float32Array(size);
    this._exploredData = new Uint8Array(size);

    // fog 텍스처: RG 채널 (R=visibility, G=explored)
    var texData = new Uint8Array(size * 4);
    this._fogTexture = new THREE.DataTexture(texData, mapWidth, mapHeight, THREE.RGBAFormat);
    this._fogTexture.magFilter = THREE.LinearFilter;
    this._fogTexture.minFilter = THREE.LinearFilter;
    this._fogTexture.needsUpdate = true;

    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
    this._time = 0;
};

FogOfWar.dispose = function() {
    this._disposeMesh();
    if (this._fogTexture) {
        this._fogTexture.dispose();
        this._fogTexture = null;
    }
    this._visibilityData = null;
    this._exploredData = null;
    this._active = false;
    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
    this._time = 0;
};

FogOfWar._parseColor = function(hex) {
    if (typeof hex === 'string' && hex.charAt(0) === '#') {
        var v = parseInt(hex.substring(1), 16);
        return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
    }
    if (typeof hex === 'object' && hex !== null) {
        return { r: hex.r || 0, g: hex.g || 0, b: hex.b || 0 };
    }
    return { r: 0, g: 0, b: 0 };
};

//=============================================================================
// 가시성 계산 (CPU, 프레임당)
//=============================================================================

FogOfWar.updateVisibility = function(playerTileX, playerTileY) {
    if (!this._active || !this._visibilityData) return;

    // 플레이어가 이동하지 않았으면 스킵
    if (playerTileX === this._prevPlayerX && playerTileY === this._prevPlayerY) return;
    this._prevPlayerX = playerTileX;
    this._prevPlayerY = playerTileY;

    var w = this._mapWidth;
    var h = this._mapHeight;
    var radius = this._radius;
    var radiusSq = radius * radius;
    var vis = this._visibilityData;
    var explored = this._exploredData;

    // 가시성 초기화
    for (var i = 0; i < vis.length; i++) vis[i] = 0;

    // 원형 반경 계산
    var minX = Math.max(0, Math.floor(playerTileX - radius));
    var maxX = Math.min(w - 1, Math.ceil(playerTileX + radius));
    var minY = Math.max(0, Math.floor(playerTileY - radius));
    var maxY = Math.min(h - 1, Math.ceil(playerTileY + radius));

    for (var ty = minY; ty <= maxY; ty++) {
        for (var tx = minX; tx <= maxX; tx++) {
            var dx = tx - playerTileX;
            var dy = ty - playerTileY;
            var distSq = dx * dx + dy * dy;
            if (distSq <= radiusSq) {
                var idx = ty * w + tx;
                // 부드러운 경계: 거리에 따라 0~1
                var dist = Math.sqrt(distSq);
                var t = dist / radius;
                vis[idx] = 1.0 - t * t; // quadratic falloff
                explored[idx] = 1;
            }
        }
    }

    this._updateTexture();
    this._updateWalls();
    this._updateParticles();
};

// 에디터 미리보기용: 특정 좌표 기준 가시성
FogOfWar.updateVisibilityAt = function(tileX, tileY) {
    this.updateVisibility(tileX, tileY);
};

FogOfWar._updateTexture = function() {
    if (!this._fogTexture) return;

    var data = this._fogTexture.image.data;
    var w = this._mapWidth;
    var h = this._mapHeight;
    var vis = this._visibilityData;
    var explored = this._exploredData;

    for (var i = 0; i < w * h; i++) {
        var pi = i * 4;
        data[pi + 0] = Math.round(vis[i] * 255);     // R = visibility
        data[pi + 1] = explored[i] * 255;              // G = explored
        data[pi + 2] = 0;
        data[pi + 3] = 255;
    }

    this._fogTexture.needsUpdate = true;
};

//=============================================================================
// 전체 공개 / 전체 숨김
//=============================================================================

FogOfWar.revealAll = function() {
    if (!this._visibilityData) return;
    for (var i = 0; i < this._visibilityData.length; i++) {
        this._visibilityData[i] = 1.0;
        this._exploredData[i] = 1;
    }
    this._updateTexture();
    this._updateWalls();
    this._updateParticles();
};

FogOfWar.hideAll = function() {
    if (!this._visibilityData) return;
    for (var i = 0; i < this._visibilityData.length; i++) {
        this._visibilityData[i] = 0;
        this._exploredData[i] = 0;
    }
    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
    this._updateTexture();
    this._updateWalls();
    this._updateParticles();
};

FogOfWar.revealRect = function(x, y, w, h) {
    if (!this._visibilityData) return;
    var mw = this._mapWidth;
    var mh = this._mapHeight;
    for (var ty = y; ty < y + h && ty < mh; ty++) {
        for (var tx = x; tx < x + w && tx < mw; tx++) {
            if (tx >= 0 && ty >= 0) {
                var idx = ty * mw + tx;
                this._visibilityData[idx] = 1.0;
                this._exploredData[idx] = 1;
            }
        }
    }
    this._updateTexture();
    this._updateWalls();
    this._updateParticles();
};

//=============================================================================
// 3D 메쉬 기반 FOW — 볼륨감 있는 안개
//=============================================================================

FogOfWar._createMesh = function() {
    if (this._fogGroup) this._disposeMesh();
    if (!this._fogTexture) return null;

    var totalW = this._mapWidth * 48;
    var totalH = this._mapHeight * 48;
    var fogColorVec = new THREE.Vector3(this._fogColor.r, this._fogColor.g, this._fogColor.b);

    var group = new THREE.Group();
    group._isFogOfWar = true;
    group.renderOrder = 9990;
    group.frustumCulled = false;

    // --- 다층 평면 x3 ---
    this._fogLayers = [];
    for (var li = 0; li < LAYER_CONFIG.length; li++) {
        var cfg = LAYER_CONFIG[li];
        var material = new THREE.ShaderMaterial({
            uniforms: {
                tFog:            { value: this._fogTexture },
                fogColor:        { value: fogColorVec.clone() },
                unexploredAlpha: { value: this._unexploredAlpha },
                exploredAlpha:   { value: this._exploredAlpha },
                alphaMultiplier: { value: cfg.alphaMultiplier },
                uvScale:         { value: cfg.uvScale },
                uTime:           { value: 0 },
                mapSize:         { value: new THREE.Vector2(this._mapWidth, this._mapHeight) }
            },
            vertexShader: FOG_LAYER_VERT,
            fragmentShader: FOG_LAYER_FRAG,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        var geometry = new THREE.PlaneGeometry(totalW, totalH);
        var mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = cfg.localZ;
        mesh.renderOrder = 9990 + li;
        mesh.frustumCulled = false;
        group.add(mesh);
        this._fogLayers.push(mesh);
    }

    // --- 안개벽 (InstancedMesh) ---
    this._createWallMesh(group, totalW, totalH, fogColorVec);

    // --- 파티클 시스템 ---
    this._createParticleSystem(group, fogColorVec);

    this._fogGroup = group;
    this._fogMesh = group;  // 하위 호환

    return group;
};

FogOfWar._createWallMesh = function(group, totalW, totalH, fogColorVec) {
    var wallGeo = new THREE.PlaneGeometry(48, WALL_HEIGHT);
    var wallMat = new THREE.ShaderMaterial({
        uniforms: {
            fogColor:        { value: fogColorVec.clone() },
            unexploredAlpha: { value: this._unexploredAlpha },
            uTime:           { value: 0 }
        },
        vertexShader: WALL_VERT,
        fragmentShader: WALL_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    var wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, MAX_WALLS);
    wallMesh.count = 0;
    wallMesh.renderOrder = 9994;
    wallMesh.frustumCulled = false;

    // 인스턴스별 알파 속성
    var alphas = new Float32Array(MAX_WALLS);
    wallGeo.setAttribute('aWallAlpha', new THREE.InstancedBufferAttribute(alphas, 1));

    group.add(wallMesh);
    this._wallMesh = wallMesh;
};

FogOfWar._createParticleSystem = function(group, fogColorVec) {
    var maxP = MAX_PARTICLES;
    var positions = new Float32Array(maxP * 3);
    var sizes = new Float32Array(maxP);
    var alphas = new Float32Array(maxP);
    var phases = new Float32Array(maxP);

    var bufGeo = new THREE.BufferGeometry();
    bufGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bufGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    bufGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    bufGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    var particleMat = new THREE.ShaderMaterial({
        uniforms: {
            fogColor: { value: fogColorVec.clone() },
            uTime:    { value: 0 }
        },
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });

    var points = new THREE.Points(bufGeo, particleMat);
    points.renderOrder = 9995;
    points.frustumCulled = false;

    group.add(points);
    this._particleSystem = points;
    this._particleCount = 0;
};

//=============================================================================
// 안개벽 갱신
//=============================================================================

FogOfWar._updateWalls = function() {
    if (!this._wallMesh || !this._exploredData) return;

    var w = this._mapWidth;
    var h = this._mapHeight;
    var totalW = w * 48;
    var totalH = h * 48;
    var halfW = totalW / 2;
    var halfH = totalH / 2;
    var explored = this._exploredData;
    var vis = this._visibilityData;
    var count = 0;
    var dummy = new THREE.Object3D();
    var alphaAttr = this._wallMesh.geometry.getAttribute('aWallAlpha');

    // 탐험된 타일에서 미탐험 타일 방향으로 벽 배치
    // 방향: [dx, dy, rotY]
    var dirs = [
        [0, -1, 0],           // 북 (위쪽 변)
        [0, 1, Math.PI],      // 남 (아래쪽 변)
        [-1, 0, Math.PI / 2], // 서 (왼쪽 변)
        [1, 0, -Math.PI / 2]  // 동 (오른쪽 변)
    ];

    for (var ty = 0; ty < h && count < MAX_WALLS; ty++) {
        for (var tx = 0; tx < w && count < MAX_WALLS; tx++) {
            var idx = ty * w + tx;
            // 미탐험 타일만
            if (explored[idx] !== 0) continue;

            for (var di = 0; di < 4; di++) {
                if (count >= MAX_WALLS) break;
                var nx = tx + dirs[di][0];
                var ny = ty + dirs[di][1];
                // 인접 타일이 맵 밖이면 스킵
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                var nIdx = ny * w + nx;
                // 인접 타일이 탐험됨 → 이 변에 벽 배치
                if (explored[nIdx] === 0) continue;

                // 벽 위치: 타일 경계 중앙 (그룹 로컬 좌표로 변환)
                var wallX = tx * 48 + 24 + dirs[di][0] * 24 - halfW;
                var wallY = ty * 48 + 24 + dirs[di][1] * 24 - halfH;
                var wallZ = WALL_HEIGHT / 2;

                dummy.position.set(wallX, wallY, wallZ);
                dummy.rotation.set(0, dirs[di][2], 0);
                dummy.updateMatrix();

                this._wallMesh.setMatrixAt(count, dummy.matrix);
                // 인접 타일의 가시성에 따라 벽 알파 조절
                alphaAttr.array[count] = Math.max(0.3, 1.0 - vis[nIdx] * 0.7);
                count++;
            }
        }
    }

    this._wallMesh.count = count;
    this._wallMesh.instanceMatrix.needsUpdate = true;
    alphaAttr.needsUpdate = true;
};

//=============================================================================
// 파티클 갱신
//=============================================================================

FogOfWar._updateParticles = function() {
    if (!this._particleSystem || !this._exploredData) return;

    var w = this._mapWidth;
    var h = this._mapHeight;
    var halfW = (w * 48) / 2;
    var halfH = (h * 48) / 2;
    var explored = this._exploredData;
    var posAttr = this._particleSystem.geometry.getAttribute('position');
    var sizeAttr = this._particleSystem.geometry.getAttribute('aSize');
    var alphaAttr = this._particleSystem.geometry.getAttribute('aAlpha');
    var phaseAttr = this._particleSystem.geometry.getAttribute('aPhase');
    var count = 0;

    // 간단한 pseudo-random (seedable)
    var seed = 12345;
    function rand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
    }

    for (var ty = 0; ty < h && count < MAX_PARTICLES; ty++) {
        for (var tx = 0; tx < w && count < MAX_PARTICLES; tx++) {
            var idx = ty * w + tx;
            if (explored[idx] !== 0) continue;
            // 밀도 필터
            seed = tx * 73856093 + ty * 19349663;  // 타일별 고정 시드
            if (rand() > PARTICLE_DENSITY) continue;

            var px = tx * 48 + rand() * 48 - halfW;
            var py = ty * 48 + rand() * 48 - halfH;
            var pz = 3.0 + rand() * 5.0;

            posAttr.array[count * 3] = px;
            posAttr.array[count * 3 + 1] = py;
            posAttr.array[count * 3 + 2] = pz;
            sizeAttr.array[count] = 8 + rand() * 16;
            alphaAttr.array[count] = 0.15 + rand() * 0.25;
            phaseAttr.array[count] = rand() * Math.PI * 2;
            count++;
        }
    }

    // 사용하지 않는 파티클 숨기기
    for (var i = count; i < this._particleCount; i++) {
        alphaAttr.array[i] = 0;
    }

    this._particleCount = count;
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    phaseAttr.needsUpdate = true;

    // drawRange 설정
    this._particleSystem.geometry.setDrawRange(0, count);
};

//=============================================================================
// 메쉬 정리
//=============================================================================

FogOfWar._disposeMesh = function() {
    if (this._fogGroup) {
        if (this._fogGroup.parent) {
            this._fogGroup.parent.remove(this._fogGroup);
        }
        // 자식 메쉬/재질/지오메트리 정리
        this._fogGroup.traverse(function(child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this._fogGroup = null;
        this._fogMesh = null;
        this._fogLayers = [];
        this._wallMesh = null;
        this._particleSystem = null;
        this._particleCount = 0;
    }
};

//=============================================================================
// 매 프레임 위치/유니폼 갱신
//=============================================================================

FogOfWar._updateMeshPosition = function() {
    if (!this._fogGroup || !this._active) return;

    var totalW = this._mapWidth * 48;
    var totalH = this._mapHeight * 48;

    // 맵 스크롤 오프셋
    var ox = 0, oy = 0;
    if (typeof $gameMap !== 'undefined' && $gameMap) {
        ox = $gameMap.displayX() * 48;
        oy = $gameMap.displayY() * 48;
    }

    // 그룹 전체 이동 (각 레이어의 Z는 그룹 내 로컬 좌표)
    this._fogGroup.position.set(totalW / 2 - ox, totalH / 2 - oy, 0);
};

FogOfWar._updateMeshUniforms = function() {
    if (!this._fogGroup || !this._active) return;

    // 시간 업데이트
    this._time += 1.0 / 60.0;

    var fogColorVec = new THREE.Vector3(this._fogColor.r, this._fogColor.g, this._fogColor.b);

    // 다층 평면 유니폼
    for (var li = 0; li < this._fogLayers.length; li++) {
        var u = this._fogLayers[li].material.uniforms;
        u.tFog.value = this._fogTexture;
        u.fogColor.value.copy(fogColorVec);
        u.unexploredAlpha.value = this._unexploredAlpha;
        u.exploredAlpha.value = this._exploredAlpha;
        u.uTime.value = this._time;
    }

    // 안개벽 유니폼
    if (this._wallMesh) {
        var wu = this._wallMesh.material.uniforms;
        wu.fogColor.value.copy(fogColorVec);
        wu.unexploredAlpha.value = this._unexploredAlpha;
        wu.uTime.value = this._time;
    }

    // 파티클 유니폼
    if (this._particleSystem) {
        var pu = this._particleSystem.material.uniforms;
        pu.fogColor.value.copy(fogColorVec);
        pu.uTime.value = this._time;
    }
};

//=============================================================================
// PostProcess 후킹 - 3D 메쉬 통합
//=============================================================================

// _updateUniforms에 FOW 업데이트 추가
var _PostProcess_updateUniforms = PostProcess._updateUniforms;
PostProcess._updateUniforms = function() {
    _PostProcess_updateUniforms.call(this);

    if (!FogOfWar._active) return;

    // 메쉬가 아직 생성되지 않았으면 scene에 lazy 추가
    if (!FogOfWar._fogGroup && FogOfWar._fogTexture) {
        var scene = this._renderPass ? this._renderPass.scene : null;
        if (scene) {
            var mesh = FogOfWar._createMesh();
            if (mesh) {
                scene.add(mesh);
            }
        }
    }

    if (FogOfWar._fogGroup) {
        // 플레이어 가시성 갱신
        if (typeof $gamePlayer !== 'undefined' && $gamePlayer) {
            FogOfWar.updateVisibility($gamePlayer.x, $gamePlayer.y);
        }
        FogOfWar._updateMeshPosition();
        FogOfWar._updateMeshUniforms();
    }
};

//=============================================================================
// _applyMapSettings 후킹 - 맵별 FOW 설정 로드
//=============================================================================

var _PostProcess_applyMapSettings = PostProcess._applyMapSettings;
PostProcess._applyMapSettings = function() {
    _PostProcess_applyMapSettings.call(this);

    // 에디터 모드에서는 런타임 FOW를 적용하지 않음 (오버레이 메쉬로 미리보기)
    if (window._editorRuntimeReady) return;

    if (!$dataMap) return;

    var fow = $dataMap.fogOfWar;
    if (fow && fow.enabled) {
        FogOfWar.setup($dataMap.width, $dataMap.height, fow);
        // 메쉬 생성은 _updateUniforms에서 lazy하게 수행 (scene 참조 보장)
    } else {
        FogOfWar.dispose();
    }
};

//=============================================================================
// Plugin Command 지원
//=============================================================================

if (typeof Game_Interpreter !== 'undefined') {
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'FogOfWar') {
            var sub = args[0];
            if (sub === 'Enable') {
                if (!FogOfWar._active && $dataMap) {
                    FogOfWar.setup($dataMap.width, $dataMap.height, $dataMap.fogOfWar || {});
                    // 메쉬 생성은 _updateUniforms에서 lazy하게 수행
                }
            } else if (sub === 'Disable') {
                FogOfWar.dispose();
            } else if (sub === 'Radius') {
                FogOfWar._radius = parseInt(args[1]) || 5;
                FogOfWar._prevPlayerX = -1; // 강제 재계산
            } else if (sub === 'RevealAll') {
                FogOfWar.revealAll();
            } else if (sub === 'HideAll') {
                FogOfWar.hideAll();
            } else if (sub === 'RevealRect') {
                var rx = parseInt(args[1]) || 0;
                var ry = parseInt(args[2]) || 0;
                var rw = parseInt(args[3]) || 1;
                var rh = parseInt(args[4]) || 1;
                FogOfWar.revealRect(rx, ry, rw, rh);
            }
        }
    };
}

})();
