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
FogOfWar._fogHeight = 300;         // fog 볼륨 높이 (픽셀)
FogOfWar._lineOfSight = true;      // Line of Sight 활성화
FogOfWar._absorption = 0.012;      // Beer-Lambert 흡수율
FogOfWar._visibilityBrightness = 0.0; // 시야 내부 밝기 보정 (0=기본, 양수=더 밝게)
FogOfWar._edgeAnimation = true;    // 경계 애니메이션 활성화
FogOfWar._edgeAnimationSpeed = 1.0; // 경계 애니메이션 속도 배율
FogOfWar._fogColorTop = { r: 0.15, g: 0.15, b: 0.2 }; // 안개 상단 색상
FogOfWar._heightGradient = true;   // 높이 그라데이션 활성화
FogOfWar._godRay = true;           // God ray (경계 라이트 림) 활성화
FogOfWar._godRayIntensity = 0.4;   // God ray 강도
FogOfWar._vortex = true;           // 소용돌이 활성화
FogOfWar._vortexSpeed = 1.0;       // 소용돌이 속도
FogOfWar._lightScattering = true;  // 라이트 산란 활성화
FogOfWar._lightScatterIntensity = 1.0; // 라이트 산란 강도
FogOfWar._playerPos = new (typeof THREE !== 'undefined' ? THREE.Vector2 : Object)(0, 0); // 플레이어 타일 좌표

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
    'uniform vec3 fogColorTop;',         // 안개 상단 색상 (높이 그라데이션)
    'uniform float unexploredAlpha;',
    'uniform float exploredAlpha;',
    'uniform float uTime;',
    'uniform vec2 mapSize;',
    'uniform vec3 cameraWorldPos;',
    'uniform float fogHeight;',
    'uniform vec2 mapPixelSize;',
    'uniform vec2 scrollOffset;',
    'uniform float absorption;',
    'uniform float visibilityBrightness;',
    'uniform float edgeAnimOn;',
    'uniform float edgeAnimSpeed;',
    'uniform float heightGradientOn;',   // 높이 그라데이션 on/off
    'uniform float godRayOn;',           // God ray on/off
    'uniform float godRayIntensity;',    // God ray 강도
    'uniform float vortexOn;',           // 소용돌이 on/off
    'uniform float vortexSpeed;',        // 소용돌이 속도
    'uniform vec2 playerPixelPos;',      // 플레이어 월드 픽셀 좌표
    // 라이트 산란: 최대 8개 포인트 라이트
    'uniform float lightScatterOn;',
    'uniform float lightScatterIntensity;',
    'uniform int numLights;',
    'uniform vec3 lightPositions[8];',   // xyz (맵 로컬 좌표 픽셀)
    'uniform vec3 lightColors[8];',      // rgb (0~1)
    'uniform float lightDistances[8];',  // 영향 거리 (픽셀)
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
    '    float v = 0.0; float amp = 0.5;',
    '    for (int i = 0; i < 3; i++) { v += amp * _valueNoise(p); p *= 2.03; amp *= 0.5; }',
    '    return v;',
    '}',
    '',
    '// --- FOW 밀도 + 가시성 샘플 ---',
    'vec3 sampleFogInfo(vec2 worldXY) {',
    '    vec2 mapXY = worldXY + scrollOffset;',
    '    vec2 uv = mapXY / mapPixelSize;',
    '    float dL = max(0.0, -uv.x); float dR = max(0.0, uv.x - 1.0);',
    '    float dT = max(0.0, -uv.y); float dB = max(0.0, uv.y - 1.0);',
    '    float outsideDist = max(max(dL, dR), max(dT, dB));',
    '    float visibility = 0.0; float explored = 0.0;',
    '    if (outsideDist < 0.001) {',
    '        vec4 s = texture2D(tFog, uv);',
    '        visibility = s.r; explored = s.g;',
    '    }',
    '    float fogDensity;',
    '    if (visibility > 0.01) {',
    '        float adjustedVis = clamp(visibility + visibilityBrightness * visibility, 0.0, 1.0);',
    '        fogDensity = exploredAlpha * (1.0 - adjustedVis);',
    '    } else if (explored > 0.5) {',
    '        fogDensity = exploredAlpha;',
    '    } else {',
    '        fogDensity = 1.0;',
    '    }',
    '    if (outsideDist > 0.001) {',
    '        float fadeDist = outsideDist * mapSize.x * 0.5;',
    '        fogDensity *= 1.0 - smoothstep(0.0, 1.0, fadeDist);',
    '    }',
    '    return vec3(fogDensity, visibility, explored);',
    '}',
    '',
    '// --- 메인 레이마칭 ---',
    'void main() {',
    '    vec3 rayOrigin = cameraWorldPos;',
    '    vec3 rayDir = normalize(vWorldPos - cameraWorldPos);',
    '',
    '    float tMin = 0.0; float tMax = 0.0;',
    '    if (abs(rayDir.z) < 0.0001) {',
    '        if (rayOrigin.z >= 0.0 && rayOrigin.z <= fogHeight) {',
    '            tMin = 0.0; tMax = length(mapPixelSize) * 2.0;',
    '        } else { discard; }',
    '    } else {',
    '        float t0 = (0.0 - rayOrigin.z) / rayDir.z;',
    '        float t1 = (fogHeight - rayOrigin.z) / rayDir.z;',
    '        tMin = min(t0, t1); tMax = max(t0, t1);',
    '        tMin = max(tMin, 0.0);',
    '        if (tMin >= tMax) discard;',
    '    }',
    '',
    '    const int MAX_STEPS = 48;',
    '    float stepSize = (tMax - tMin) / float(MAX_STEPS);',
    '    float dither = fract(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) * 43758.5453);',
    '',
    '    // 누적 변수',
    '    vec3 accColor = vec3(0.0);',    // 누적 색상 (fog + light scattering)
    '    float accAlpha = 0.0;',
    '    float t = tMin + stepSize * dither;',
    '',
    '    for (int i = 0; i < MAX_STEPS; i++) {',
    '        if (accAlpha > 0.97) break;',
    '        vec3 samplePos = rayOrigin + rayDir * t;',
    '        float heightNorm = clamp(samplePos.z / fogHeight, 0.0, 1.0);',
    '',
    '        // FOW 밀도 + 가시성',
    '        vec3 fogInfo = sampleFogInfo(samplePos.xy);',
    '        float baseDensity = fogInfo.x;',
    '        float visibility = fogInfo.y;',
    '',
    '        // === 소용돌이(vortex) ===',
    '        // 플레이어 위치 기준 극좌표로 회전하는 노이즈',
    '        if (vortexOn > 0.5) {',
    '            vec2 mapXY = samplePos.xy + scrollOffset;',
    '            vec2 toPlayer = mapXY - playerPixelPos;',
    '            float dist = length(toPlayer);',
    '            float angle = atan(toPlayer.y, toPlayer.x);',
    '            float vt = uTime * vortexSpeed;',
    '            // 거리에 따라 회전량 변경 (가까울수록 빠르게)',
    '            float rotAmount = vt * 0.3 / (1.0 + dist * 0.003);',
    '            vec2 rotatedUV = vec2(',
    '                cos(angle + rotAmount) * dist,',
    '                sin(angle + rotAmount) * dist',
    '            ) * 0.005;',
    '            float vortexNoise = _valueNoise(rotatedUV + vec2(heightNorm * 3.0));',
    '            // 경계 영역에서만 소용돌이 적용',
    '            float vortexMask = smoothstep(0.05, 0.2, baseDensity) * (1.0 - smoothstep(0.5, 0.8, baseDensity));',
    '            baseDensity += vortexNoise * 0.15 * vortexMask;',
    '            baseDensity = clamp(baseDensity, 0.0, 1.0);',
    '        }',
    '',
    '        // === 경계 애니메이션 ===',
    '        float timeS = uTime * edgeAnimSpeed;',
    '        float edgeWave = _valueNoise(samplePos.xy * 0.015 + vec2(timeS * 0.08, timeS * 0.06));',
    '        edgeWave += 0.5 * _valueNoise(samplePos.xy * 0.03 + vec2(-timeS * 0.05, timeS * 0.04));',
    '        float edgeMask = smoothstep(0.0, 0.15, baseDensity) * (1.0 - smoothstep(0.4, 0.7, baseDensity));',
    '        baseDensity += edgeWave * 0.2 * edgeMask * edgeAnimOn;',
    '        baseDensity = clamp(baseDensity, 0.0, 1.0);',
    '',
    '        baseDensity = smoothstep(0.15, 0.55, baseDensity);',
    '',
    '        // 높이 감쇠',
    '        float heightFalloff = exp(-heightNorm * 3.0);',
    '',
    '        // 3D 볼륨 노이즈',
    '        vec2 noiseCoord = samplePos.xy * 0.004 + vec2(uTime * 0.02, uTime * 0.015);',
    '        noiseCoord += vec2(heightNorm * 5.0);',
    '        float noise = fbm3(noiseCoord);',
    '',
    '        float density = baseDensity * heightFalloff * (1.0 + noise * 0.5);',
    '        density = clamp(density, 0.0, 1.0);',
    '',
    '        // === 높이 그라데이션 색상 ===',
    '        vec3 stepColor = (heightGradientOn > 0.5)',
    '            ? mix(fogColor, fogColorTop, heightNorm)',
    '            : fogColor;',
    '',
    '        // === God ray (시야 경계 라이트 림) ===',
    '        if (godRayOn > 0.5 && visibility > 0.01 && visibility < 0.8) {',
    '            // 시야 경계에서 플레이어 방향으로 방사형 빛줄기',
    '            vec2 mapXY = samplePos.xy + scrollOffset;',
    '            vec2 toPlayer = normalize(playerPixelPos - mapXY);',
    '            float rayAngle = atan(toPlayer.y, toPlayer.x);',
    '            // 방사형 노이즈로 빛줄기 패턴',
    '            float rayNoise = _valueNoise(vec2(rayAngle * 3.0, uTime * 0.1));',
    '            rayNoise = max(0.0, rayNoise);',
    '            // 경계 영역에서만 빛줄기 (중심~경계 사이)',
    '            float edgeFactor = smoothstep(0.0, 0.3, visibility) * (1.0 - smoothstep(0.3, 0.8, visibility));',
    '            float godRayContrib = rayNoise * edgeFactor * godRayIntensity * (1.0 - heightNorm);',
    '            // 밝은 색으로 빛줄기 추가',
    '            stepColor += vec3(0.8, 0.7, 0.5) * godRayContrib;',
    '        }',
    '',
    '        // === 라이트 산란 ===',
    '        if (lightScatterOn > 0.5 && density > 0.01) {',
    '            vec2 mapXY = samplePos.xy + scrollOffset;',
    '            vec3 scatterLight = vec3(0.0);',
    '            for (int li = 0; li < 8; li++) {',
    '                if (li >= numLights) break;',
    '                vec3 lp = lightPositions[li];',
    '                float dist = length(mapXY - lp.xy);',
    '                float zDist = abs(samplePos.z - lp.z);',
    '                float totalDist = sqrt(dist * dist + zDist * zDist);',
    '                float atten = 1.0 - smoothstep(0.0, lightDistances[li], totalDist);',
    '                atten *= atten;', // quadratic falloff
    '                scatterLight += lightColors[li] * atten;',
    '            }',
    '            // Mie-like forward scattering: density가 높을수록 산란 강해짐',
    '            stepColor += scatterLight * lightScatterIntensity * density * 2.0;',
    '        }',
    '',
    '        // === 시야 내부 밝기 (ambient glow) ===',
    '        if (visibilityBrightness > 0.01 && visibility > 0.3) {',
    '            // 시야 내부에 은은한 밝은 빛 추가 (fog 색상에 additive)',
    '            float glowFactor = visibility * visibilityBrightness * (1.0 - heightNorm * 0.5);',
    '            stepColor += vec3(0.15, 0.12, 0.08) * glowFactor;',
    '        }',
    '',
    '        // Beer-Lambert 흡수',
    '        float absorb = density * stepSize * absorption;',
    '        // Front-to-back: 색상도 함께 누적',
    '        accColor += (1.0 - accAlpha) * absorb * stepColor;',
    '        accAlpha += (1.0 - accAlpha) * absorb;',
    '',
    '        t += stepSize;',
    '    }',
    '',
    '    accAlpha = clamp(accAlpha, 0.0, 1.0);',
    '    if (accAlpha < 0.001) discard;',
    '',
    '    // 최종 색상 정규화',
    '    vec3 finalColor = (accAlpha > 0.001) ? accColor / accAlpha : fogColor;',
    '    gl_FragColor = vec4(finalColor, accAlpha);',
    '}'
].join('\n');

//=============================================================================
// 설정 상수
//=============================================================================

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
        this._fogHeight = config.fogHeight != null ? config.fogHeight : 300;
        this._lineOfSight = config.lineOfSight != null ? config.lineOfSight : true;
        this._absorption = config.absorption != null ? config.absorption : 0.012;
        this._visibilityBrightness = config.visibilityBrightness != null ? config.visibilityBrightness : 0.0;
        this._edgeAnimation = config.edgeAnimation != null ? config.edgeAnimation : true;
        this._edgeAnimationSpeed = config.edgeAnimationSpeed != null ? config.edgeAnimationSpeed : 1.0;
        if (config.fogColorTop) {
            this._fogColorTop = this._parseColor(config.fogColorTop);
        }
        this._heightGradient = config.heightGradient != null ? config.heightGradient : true;
        this._godRay = config.godRay != null ? config.godRay : true;
        this._godRayIntensity = config.godRayIntensity != null ? config.godRayIntensity : 0.4;
        this._vortex = config.vortex != null ? config.vortex : true;
        this._vortexSpeed = config.vortexSpeed != null ? config.vortexSpeed : 1.0;
        this._lightScattering = config.lightScattering != null ? config.lightScattering : true;
        this._lightScatterIntensity = config.lightScatterIntensity != null ? config.lightScatterIntensity : 1.0;
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
    if (this._lineOfSight) this._buildBlockMap();

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
                if (this._lineOfSight && !this._hasLineOfSight(playerTileX, playerTileY, tx, ty)) continue;

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
            fogHeight:       { value: this._fogHeight },
            mapPixelSize:    { value: new THREE.Vector2(totalW, totalH) },
            scrollOffset:    { value: new THREE.Vector2(0, 0) },
            absorption:      { value: this._absorption },
            visibilityBrightness: { value: this._visibilityBrightness },
            edgeAnimOn:      { value: this._edgeAnimation ? 1.0 : 0.0 },
            edgeAnimSpeed:   { value: this._edgeAnimationSpeed },
            fogColorTop:     { value: new THREE.Vector3(this._fogColorTop.r, this._fogColorTop.g, this._fogColorTop.b) },
            heightGradientOn:{ value: this._heightGradient ? 1.0 : 0.0 },
            godRayOn:        { value: this._godRay ? 1.0 : 0.0 },
            godRayIntensity: { value: this._godRayIntensity },
            vortexOn:        { value: this._vortex ? 1.0 : 0.0 },
            vortexSpeed:     { value: this._vortexSpeed },
            playerPixelPos:  { value: new THREE.Vector2(0, 0) },
            lightScatterOn:  { value: this._lightScattering ? 1.0 : 0.0 },
            lightScatterIntensity: { value: this._lightScatterIntensity },
            numLights:       { value: 0 },
            lightPositions:  { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
            lightColors:     { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
            lightDistances:  { value: [0, 0, 0, 0, 0, 0, 0, 0] }
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
    u.fogHeight.value = this._fogHeight;
    u.absorption.value = this._absorption;
    u.visibilityBrightness.value = this._visibilityBrightness;
    u.edgeAnimOn.value = this._edgeAnimation ? 1.0 : 0.0;
    u.edgeAnimSpeed.value = this._edgeAnimationSpeed;
    u.fogColorTop.value.set(this._fogColorTop.r, this._fogColorTop.g, this._fogColorTop.b);
    u.heightGradientOn.value = this._heightGradient ? 1.0 : 0.0;
    u.godRayOn.value = this._godRay ? 1.0 : 0.0;
    u.godRayIntensity.value = this._godRayIntensity;
    u.vortexOn.value = this._vortex ? 1.0 : 0.0;
    u.vortexSpeed.value = this._vortexSpeed;
    u.lightScatterOn.value = this._lightScattering ? 1.0 : 0.0;
    u.lightScatterIntensity.value = this._lightScatterIntensity;

    // 카메라 월드 좌표 업데이트
    if (typeof Mode3D !== 'undefined' && Mode3D._perspCamera && Mode3D._active) {
        u.cameraWorldPos.value.copy(Mode3D._perspCamera.position);
    } else {
        // 2D 모드: 맵 중앙 위에서 직교로 내려다보는 가상 카메라
        var totalW = this._mapWidth * 48;
        var totalH = this._mapHeight * 48;
        var camOx = 0, camOy = 0;
        if (typeof $gameMap !== 'undefined' && $gameMap) {
            camOx = $gameMap.displayX() * 48;
            camOy = $gameMap.displayY() * 48;
        }
        u.cameraWorldPos.value.set(totalW / 2 - camOx, totalH / 2 - camOy, this._fogHeight + 100);
    }

    // 스크롤 오프셋 업데이트
    var ox = 0, oy = 0;
    if (typeof $gameMap !== 'undefined' && $gameMap) {
        ox = $gameMap.displayX() * 48;
        oy = $gameMap.displayY() * 48;
    }
    u.scrollOffset.value.set(ox, oy);

    // 플레이어 픽셀 좌표 업데이트
    if (typeof $gamePlayer !== 'undefined' && $gamePlayer) {
        u.playerPixelPos.value.set(
            ($gamePlayer._realX + 0.5) * 48,
            ($gamePlayer._realY + 0.5) * 48
        );
    }

    // 라이트 산란: $dataMap.editorLights.points에서 포인트 라이트 수집
    this._updateLightUniforms(u);
};

FogOfWar._updateLightUniforms = function(u) {
    if (!this._lightScattering) {
        u.numLights.value = 0;
        return;
    }

    var lights = [];
    // $dataMap.editorLights.points에서 포인트 라이트 수집
    if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.editorLights && $dataMap.editorLights.points) {
        var pts = $dataMap.editorLights.points;
        for (var i = 0; i < pts.length && lights.length < 8; i++) {
            var p = pts[i];
            if (!p) continue;
            var c = this._parseColor(p.color || '#ffffff');
            lights.push({
                x: (p.x + 0.5) * 48,
                y: (p.y + 0.5) * 48,
                z: p.z || 40,
                r: c.r, g: c.g, b: c.b,
                intensity: p.intensity || 1.0,
                distance: p.distance || 200
            });
        }
    }

    // 플레이어 라이트 추가 (editorLights.playerLight)
    if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.editorLights && $dataMap.editorLights.playerLight) {
        var pl = $dataMap.editorLights.playerLight;
        if (lights.length < 8 && typeof $gamePlayer !== 'undefined' && $gamePlayer) {
            var pc = this._parseColor(pl.color || '#a25f06');
            lights.push({
                x: ($gamePlayer._realX + 0.5) * 48,
                y: ($gamePlayer._realY + 0.5) * 48,
                z: pl.z || 40,
                r: pc.r, g: pc.g, b: pc.b,
                intensity: pl.intensity || 0.8,
                distance: pl.distance || 200
            });
        }
    }

    u.numLights.value = lights.length;
    for (var i = 0; i < 8; i++) {
        if (i < lights.length) {
            var l = lights[i];
            u.lightPositions.value[i].set(l.x, l.y, l.z);
            u.lightColors.value[i].set(l.r * l.intensity, l.g * l.intensity, l.b * l.intensity);
            u.lightDistances.value[i] = l.distance;
        }
    }
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
        var scene = null;
        if (this._renderPass) {
            scene = this._renderPass.scene;
        } else if (PostProcess._2dRenderPass && PostProcess._2dRenderPass._rendererObj) {
            scene = PostProcess._2dRenderPass._rendererObj.scene;
        }
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
