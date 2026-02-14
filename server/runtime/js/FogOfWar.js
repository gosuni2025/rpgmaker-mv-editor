//=============================================================================
// FogOfWar.js - Fog of War 시스템 (런타임 + 에디터)
//=============================================================================
// 3단계 시야: 미탐험(검은색) → 탐험완료(반투명) → 현재 시야(투명)
// 레이마칭 볼류메트릭 fog: 단일 메쉬에서 fragment shader로 3D 볼륨 안개 렌더링
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
FogOfWar._fogMesh = null;          // 하위 호환
FogOfWar._fogGroup = null;         // THREE.Group (_isFogOfWar 마커)
FogOfWar._time = 0;                // 셰이더 uTime

//=============================================================================
// 셰이더 코드 — 레이마칭 볼류메트릭 fog
//=============================================================================

var VOL_FOG_VERT = [
    'varying vec3 vWorldPos;',
    'void main() {',
    '    vec4 worldPos = modelMatrix * vec4(position, 1.0);',
    '    vWorldPos = worldPos.xyz;',
    '    gl_Position = projectionMatrix * viewMatrix * worldPos;',
    '}'
].join('\n');

var VOL_FOG_FRAG = [
    'precision highp float;',
    '',
    'varying vec3 vWorldPos;',
    '',
    'uniform sampler2D tFog;',
    'uniform vec3 fogColor;',
    'uniform float unexploredAlpha;',
    'uniform float exploredAlpha;',
    'uniform float uTime;',
    'uniform vec2 mapSize;',       // 맵 크기 (타일 단위)
    'uniform vec3 cameraWorldPos;', // 카메라 월드 좌표
    'uniform float fogHeight;',     // fog 볼륨 최대 높이 (픽셀)
    'uniform vec2 mapPixelSize;',   // 맵 크기 (픽셀 단위)
    'uniform vec2 scrollOffset;',   // 맵 스크롤 오프셋 (픽셀)
    '',
    '// --- 노이즈 함수 ---',
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
    'float fbm3(vec2 p) {',
    '    float v = 0.0;',
    '    float amp = 0.5;',
    '    for (int i = 0; i < 3; i++) {',
    '        v += amp * _valueNoise(p);',
    '        p *= 2.03;',
    '        amp *= 0.5;',
    '    }',
    '    return v;',
    '}',
    '',
    '// --- FOW 밀도 샘플 ---',
    '// xy 좌표(픽셀)에서 FOW 밀도 반환 (0=투명, 1=불투명)',
    'float sampleFogDensity(vec2 worldXY) {',
    '    // worldXY는 카메라 중심 기준 좌표 → 맵 좌표로 변환',
    '    // 그룹 위치가 (totalW/2 - ox, totalH/2 - oy)이므로',
    '    // 맵 좌표 = worldXY - 그룹위치 + totalW/2 = worldXY + scrollOffset',
    '    vec2 mapXY = worldXY + scrollOffset;',
    '    vec2 uv = mapXY / mapPixelSize;',
    '',
    '    // 맵 바깥: 미탐험 취급, 거리 기반 페이드',
    '    float dL = max(0.0, -uv.x);',
    '    float dR = max(0.0, uv.x - 1.0);',
    '    float dT = max(0.0, -uv.y);',
    '    float dB = max(0.0, uv.y - 1.0);',
    '    float outsideDist = max(max(dL, dR), max(dT, dB));',
    '',
    '    float visibility = 0.0;',
    '    float explored = 0.0;',
    '    if (outsideDist < 0.001) {',
    '        vec4 s = texture2D(tFog, uv);',
    '        visibility = s.r;',
    '        explored = s.g;',
    '    }',
    '',
    '    // 순수 fog 밀도: 0=완전 투명, 1=완전 불투명',
    '    float fogDensity;',
    '    if (visibility > 0.01) {',
    '        // 시야 내부: 중심(vis=1)→0, 경계(vis→0)→exploredAlpha',
    '        // 시야 경계가 탐험 영역보다 어둡지 않도록 exploredAlpha로 cap',
    '        fogDensity = exploredAlpha * (1.0 - visibility);',
    '    } else if (explored > 0.5) {',
    '        fogDensity = exploredAlpha;',
    '    } else {',
    '        fogDensity = 1.0;',
    '    }',
    '',
    '    // 맵 바깥 페이드',
    '    if (outsideDist > 0.001) {',
    '        float fadeDist = outsideDist * mapSize.x * 0.5;',
    '        fogDensity *= 1.0 - smoothstep(0.0, 1.0, fadeDist);',
    '    }',
    '',
    '    return fogDensity;',
    '}',
    '',
    '// --- 메인 레이마칭 ---',
    'void main() {',
    '    vec3 rayOrigin = cameraWorldPos;',
    '    vec3 rayDir = normalize(vWorldPos - cameraWorldPos);',
    '',
    '    // fog 볼륨: Z = 0 ~ fogHeight',
    '    float tMin = 0.0;',
    '    float tMax = 0.0;',
    '',
    '    // ray와 Z=0, Z=fogHeight 평면의 교점 계산',
    '    if (abs(rayDir.z) < 0.0001) {',
    '        // ray가 거의 수평 — Z가 볼륨 안에 있으면 전체 통과',
    '        if (rayOrigin.z >= 0.0 && rayOrigin.z <= fogHeight) {',
    '            tMin = 0.0;',
    '            // 맵 크기 기반 최대 거리',
    '            tMax = length(mapPixelSize) * 2.0;',
    '        } else {',
    '            discard;',
    '        }',
    '    } else {',
    '        float t0 = (0.0 - rayOrigin.z) / rayDir.z;',       // Z=0 교점
    '        float t1 = (fogHeight - rayOrigin.z) / rayDir.z;',  // Z=fogHeight 교점
    '        tMin = min(t0, t1);',
    '        tMax = max(t0, t1);',
    '        tMin = max(tMin, 0.0);', // 카메라 뒤 클립
    '        if (tMin >= tMax) discard;',
    '    }',
    '',
    '    // 레이마칭 파라미터',
    '    const int MAX_STEPS = 32;',
    '    float stepSize = (tMax - tMin) / float(MAX_STEPS);',
    '',
    '    // Front-to-back 컴포지팅',
    '    float accumulatedAlpha = 0.0;',
    '    float t = tMin;',
    '',
    '    for (int i = 0; i < MAX_STEPS; i++) {',
    '        if (accumulatedAlpha > 0.97) break;',
    '',
    '        vec3 samplePos = rayOrigin + rayDir * t;',
    '',
    '        // FOW 밀도 (XY 평면)',
    '        float baseDensity = sampleFogDensity(samplePos.xy);',
    '',
    '        // 경계 애니메이션: 시야 경계에 시간 기반 노이즈로 출렁임 추가',
    '        // baseDensity가 경계 영역(0.1~0.5)일 때 노이즈로 밀도 변동',
    '        float edgeWave = _valueNoise(samplePos.xy * 0.015 + vec2(uTime * 0.08, uTime * 0.06));',
    '        edgeWave += 0.5 * _valueNoise(samplePos.xy * 0.03 + vec2(-uTime * 0.05, uTime * 0.04));',
    '        float edgeMask = smoothstep(0.0, 0.15, baseDensity) * (1.0 - smoothstep(0.4, 0.7, baseDensity));',
    '        baseDensity += edgeWave * 0.2 * edgeMask;',
    '        baseDensity = clamp(baseDensity, 0.0, 1.0);',
    '',
    '        // 시야 내부는 투명하게: 밀도가 낮은 곳을 급격히 0으로',
    '        baseDensity = smoothstep(0.15, 0.55, baseDensity);',
    '',
    '        // 높이 기반 밀도 프로파일:',
    '        // FOW 밀도에 비례하는 유효 높이 — 경계는 높게, 미탐험은 꽉 차게',
    '        float heightNorm = clamp(samplePos.z / fogHeight, 0.0, 1.0);',
    '        float effectiveHeight = fogHeight * clamp(baseDensity * 1.5, 0.0, 1.0);',
    '        float heightNormEff = (effectiveHeight > 1.0) ? clamp(samplePos.z / effectiveHeight, 0.0, 1.0) : 1.0;',
    '        float heightFalloff = 1.0 - heightNormEff;',
    '        heightFalloff = heightFalloff * heightFalloff;',
    '',
    '        // 3D 노이즈로 불규칙한 밀도 변화',
    '        vec2 noiseCoord = samplePos.xy * 0.004 + vec2(uTime * 0.02, uTime * 0.015);',
    '        noiseCoord += vec2(heightNorm * 5.0);',
    '        float noise = fbm3(noiseCoord);',
    '',
    '        // 최종 밀도',
    '        float density = baseDensity * heightFalloff * (1.0 + noise * 0.5);',
    '        density = clamp(density, 0.0, 1.0);',
    '',
    '        // Beer-Lambert 흡수',
    '        float absorption = density * stepSize * 0.012;',
    '',
    '        // Front-to-back: 남은 투명도만큼 누적',
    '        accumulatedAlpha += (1.0 - accumulatedAlpha) * absorption;',
    '',
    '        t += stepSize;',
    '    }',
    '',
    '    accumulatedAlpha = clamp(accumulatedAlpha, 0.0, 1.0);',
    '    if (accumulatedAlpha < 0.001) discard;',
    '',
    '    gl_FragColor = vec4(fogColor, accumulatedAlpha);',
    '}'
].join('\n');

//=============================================================================
// 설정 상수
//=============================================================================

var FOG_HEIGHT = 300;    // fog 볼륨 최대 높이 (픽셀)
var FOG_PADDING = 960;   // 맵 바깥으로 확장하는 패딩 (20타일, 각 변)

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
    this._blockMapDirty = true;
};

FogOfWar.dispose = function() {
    this._disposeMesh();
    if (this._fogTexture) {
        this._fogTexture.dispose();
        this._fogTexture = null;
    }
    this._visibilityData = null;
    this._exploredData = null;
    this._blockMap = null;
    this._blockMapDirty = true;
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

    // 장애물 맵 캐시 (통행불가 타일 = 시야 차단)
    this._buildBlockMap();

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
                // Line of Sight 체크: 플레이어→타일 경로에 벽이 있으면 차단
                if (!this._hasLineOfSight(playerTileX, playerTileY, tx, ty)) continue;

                var idx = ty * w + tx;
                var dist = Math.sqrt(distSq);
                var t = dist / radius;
                vis[idx] = 1.0 - t * t; // quadratic falloff
                explored[idx] = 1;
            }
        }
    }

    this._updateTexture();
};

//=============================================================================
// Line of Sight — 장애물 맵 + Bresenham 라인 캐스팅
//=============================================================================

FogOfWar._blockMap = null;     // Uint8Array — 장애물 맵 (0=통과 가능, 1=차단)
FogOfWar._blockMapDirty = true;

// 장애물 맵 구축: 통행 불가 타일을 시야 차단 장애물로 등록
FogOfWar._buildBlockMap = function() {
    if (!this._blockMapDirty && this._blockMap) return;

    var w = this._mapWidth;
    var h = this._mapHeight;
    if (!this._blockMap || this._blockMap.length !== w * h) {
        this._blockMap = new Uint8Array(w * h);
    }

    var blockMap = this._blockMap;
    for (var i = 0; i < blockMap.length; i++) blockMap[i] = 0;

    // $gameMap.checkPassage를 사용하여 통행불가 타일 감지
    if (typeof $gameMap !== 'undefined' && $gameMap && $gameMap.tilesetFlags) {
        var flags = $gameMap.tilesetFlags();
        for (var ty = 0; ty < h; ty++) {
            for (var tx = 0; tx < w; tx++) {
                // checkPassage(x, y, 0x0f) === false → 모든 방향 통행 불가 = 벽
                if (!$gameMap.checkPassage(tx, ty, 0x0f)) {
                    blockMap[ty * w + tx] = 1;
                }
            }
        }
    }

    this._blockMapDirty = false;
};

// Bresenham 라인: (x0,y0) → (x1,y1) 경로에 장애물이 있으면 false
// 시작점과 끝점은 검사하지 않음 (플레이어가 벽 안에 있거나, 벽 자체를 볼 수 있어야 함)
FogOfWar._hasLineOfSight = function(x0, y0, x1, y1) {
    if (!this._blockMap) return true;

    var w = this._mapWidth;
    var blockMap = this._blockMap;

    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;

    var cx = x0, cy = y0;

    while (cx !== x1 || cy !== y1) {
        var e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            cx += sx;
        }
        if (e2 < dx) {
            err += dx;
            cy += sy;
        }

        // 끝점에 도달하면 중단 (끝점의 벽은 보이게)
        if (cx === x1 && cy === y1) break;

        // 경로상의 타일이 벽이면 차단
        if (cx >= 0 && cx < w && cy >= 0 && cy < this._mapHeight) {
            if (blockMap[cy * w + cx] === 1) return false;
        }
    }

    return true;
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
};

//=============================================================================
// 3D 메쉬 — 볼류메트릭 fog (단일 평면 + 레이마칭 셰이더)
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

    // 큰 평면 (맵 + 패딩): fog 볼륨의 "바닥"으로 사용
    // 셰이더가 레이마칭을 하므로 Z 위치는 fog 볼륨 꼭대기(fogHeight)에 배치
    // → 카메라에서 이 평면을 볼 때 fragment shader가 ray를 아래로 마칭
    var planeW = totalW + FOG_PADDING * 2;
    var planeH = totalH + FOG_PADDING * 2;

    var material = new THREE.ShaderMaterial({
        uniforms: {
            tFog:            { value: this._fogTexture },
            fogColor:        { value: fogColorVec },
            unexploredAlpha: { value: this._unexploredAlpha },
            exploredAlpha:   { value: this._exploredAlpha },
            uTime:           { value: 0 },
            mapSize:         { value: new THREE.Vector2(this._mapWidth, this._mapHeight) },
            cameraWorldPos:  { value: new THREE.Vector3(0, 0, 0) },
            fogHeight:       { value: FOG_HEIGHT },
            mapPixelSize:    { value: new THREE.Vector2(totalW, totalH) },
            scrollOffset:    { value: new THREE.Vector2(0, 0) }
        },
        vertexShader: VOL_FOG_VERT,
        fragmentShader: VOL_FOG_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    var geometry = new THREE.PlaneGeometry(planeW, planeH);
    var mesh = new THREE.Mesh(geometry, material);
    // 평면을 Z=0(바닥)에 배치 — 카메라가 위에서 아래를 내려다보므로 바닥 평면이 보임
    // 레이마칭 셰이더가 ray-volume intersection으로 Z=0~fogHeight 볼륨 전체를 통과
    mesh.position.z = 0;
    mesh.renderOrder = 9990;
    mesh.frustumCulled = false;

    group.add(mesh);

    this._fogGroup = group;
    this._fogMesh = group;  // 하위 호환

    return group;
};

//=============================================================================
// 메쉬 정리
//=============================================================================

FogOfWar._disposeMesh = function() {
    if (this._fogGroup) {
        if (this._fogGroup.parent) {
            this._fogGroup.parent.remove(this._fogGroup);
        }
        this._fogGroup.traverse(function(child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this._fogGroup = null;
        this._fogMesh = null;
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

    // 그룹 위치: 맵 중앙 - 스크롤 오프셋
    this._fogGroup.position.set(totalW / 2 - ox, totalH / 2 - oy, 0);
};

FogOfWar._updateMeshUniforms = function() {
    if (!this._fogGroup || !this._active) return;

    this._time += 1.0 / 60.0;

    var fogColorVec = new THREE.Vector3(this._fogColor.r, this._fogColor.g, this._fogColor.b);

    // 단일 메쉬의 유니폼 갱신
    var fogMesh = this._fogGroup.children[0];
    if (!fogMesh) return;

    var u = fogMesh.material.uniforms;
    u.tFog.value = this._fogTexture;
    u.fogColor.value.copy(fogColorVec);
    u.unexploredAlpha.value = this._unexploredAlpha;
    u.exploredAlpha.value = this._exploredAlpha;
    u.uTime.value = this._time;

    // 카메라 월드 좌표 업데이트
    if (typeof Mode3D !== 'undefined' && Mode3D._perspCamera) {
        u.cameraWorldPos.value.copy(Mode3D._perspCamera.position);
    }

    // 스크롤 오프셋 업데이트
    var ox = 0, oy = 0;
    if (typeof $gameMap !== 'undefined' && $gameMap) {
        ox = $gameMap.displayX() * 48;
        oy = $gameMap.displayY() * 48;
    }
    u.scrollOffset.value.set(ox, oy);
};

//=============================================================================
// PostProcess 후킹 - 3D 메쉬 통합
//=============================================================================

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
                }
            } else if (sub === 'Disable') {
                FogOfWar.dispose();
            } else if (sub === 'Radius') {
                FogOfWar._radius = parseInt(args[1]) || 5;
                FogOfWar._prevPlayerX = -1;
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
