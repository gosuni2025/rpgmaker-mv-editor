/*:
 * @plugindesc 전쟁의 안개 시스템 (3D 볼류메트릭 안개 + 시야 관리)
 * @author RPG Maker MV Web Editor
 *
 * @command Enable
 * @text 전쟁의 안개 활성화
 * @desc 전쟁의 안개를 활성화합니다.
 *
 * @command Disable
 * @text 전쟁의 안개 비활성화
 * @desc 전쟁의 안개를 비활성화합니다.
 *
 * @command Radius
 * @text 시야 반경 설정
 * @desc 플레이어의 시야 반경을 설정합니다.
 *
 * @arg radius
 * @text 반경
 * @type number
 * @min 1
 * @max 30
 * @default 5
 *
 * @command RevealAll
 * @text 전체 공개
 * @desc 맵 전체를 공개합니다.
 *
 * @command HideAll
 * @text 전체 숨김
 * @desc 맵 전체를 숨깁니다.
 *
 * @command RevealRect
 * @text 영역 공개
 * @desc 지정한 사각형 영역을 공개합니다.
 *
 * @arg x
 * @text X 좌표
 * @type number
 * @min 0
 * @default 0
 *
 * @arg y
 * @text Y 좌표
 * @type number
 * @min 0
 * @default 0
 *
 * @arg w
 * @text 너비
 * @type number
 * @min 1
 * @default 1
 *
 * @arg h
 * @text 높이
 * @type number
 * @min 1
 * @default 1
 *
 * @help
 * FogOfWar.js는 에디터 코어 파일로 자동으로 로드됩니다.
 * 플러그인 매니저에서 별도 추가 없이 3D 모드에서 사용 가능합니다.
 */
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
FogOfWar._fogMode = '2d';             // fog 렌더링 모드: '2d' | '3dvolume'
FogOfWar._enabled2D = false;          // 2D 모드에서 FoW 활성화
FogOfWar._enabled3D = false;          // 3D 모드에서 FoW 활성화
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
    'uniform float isOrtho;',            // 1.0: OrthographicCamera, 0.0: PerspectiveCamera
    '// 2D FOW 디버그 조절용',
    'uniform float dissolveStrength;',    // 디졸브 노이즈 강도
    'uniform float fadeSmoothness;',      // 알파 페이드 smoothstep 범위
    'uniform float tentacleSharpness;',    // pow 지수 (높을수록 뾰족한 촉수)
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
    '// NEAREST 샘플링 (render2D에서 경계 판정용)',
    'float sampleExplNearestFog(vec2 uv, vec2 texel) {',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).g;',
    '}',
    'float sampleFadeNearestFog(vec2 uv, vec2 texel) {',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).b;',
    '}',
    'bool isBorderFog(vec2 uv, vec2 texel) {',
    '    return sampleExplNearestFog(uv, texel) < 0.5;',
    '}',
    '',
    '// --- 2D 전용 fog 렌더링 (isOrtho) ---',
    '// 시야 안: 투명, 시야 밖: 불투명. 탐험↔미탐험 경계는 별도 메시가 담당.',
    'void render2D() {',
    '    vec2 mapXY = vWorldPos.xy + scrollOffset;',
    '    vec2 uv = mapXY / mapPixelSize;',
    '',
    '    // 맵 바깥 페이드',
    '    float dL = max(0.0, -uv.x); float dR = max(0.0, uv.x - 1.0);',
    '    float dT = max(0.0, -uv.y); float dB = max(0.0, uv.y - 1.0);',
    '    float outsideDist = max(max(dL, dR), max(dT, dB));',
    '',
    '    float visibility = 0.0; float explored = 0.0;',
    '    if (outsideDist < 0.001) {',
    '        vec4 s = texture2D(tFog, uv);',
    '        visibility = s.r; explored = s.g;',
    '    }',
    '',
    '    // 시야 안: visibility로 부드럽게 투명 전환 (보간 대응)',
    '    if (visibility > 0.99) discard;',
    '',
    '    // 탐험↔미탐험 경계는 edge dissolve 메시가 담당 → discard',
    '    if (outsideDist < 0.001) {',
    '        vec2 texel = 1.0 / mapSize;',
    '        float myE = sampleExplNearestFog(uv, texel);',
    '',
    '        if (myE > 0.5) {',
    '            // 탐험 타일: 4타일 범위 내(8방향)에 미탐험 경계가 있으면 discard',
    '            bool nearBorder = false;',
    '            for (float r = 1.0; r <= 4.0; r += 1.0) {',
    '                if (isBorderFog(uv + vec2(-texel.x * r, 0.0), texel)) nearBorder = true;',
    '                if (isBorderFog(uv + vec2( texel.x * r, 0.0), texel)) nearBorder = true;',
    '                if (isBorderFog(uv + vec2(0.0, -texel.y * r), texel)) nearBorder = true;',
    '                if (isBorderFog(uv + vec2(0.0,  texel.y * r), texel)) nearBorder = true;',
    '                if (isBorderFog(uv + vec2(-texel.x * r, -texel.y * r), texel)) nearBorder = true;',
    '                if (isBorderFog(uv + vec2( texel.x * r, -texel.y * r), texel)) nearBorder = true;',
    '                if (isBorderFog(uv + vec2(-texel.x * r,  texel.y * r), texel)) nearBorder = true;',
    '                if (isBorderFog(uv + vec2( texel.x * r,  texel.y * r), texel)) nearBorder = true;',
    '            }',
    '            if (nearBorder) discard;',
    '        } else {',
    '            // 미탐험 타일: 인접 1타일(8방향)에 탐험 있으면 경계 → discard',
    '            float eL  = sampleExplNearestFog(uv + vec2(-texel.x, 0.0), texel);',
    '            float eR  = sampleExplNearestFog(uv + vec2( texel.x, 0.0), texel);',
    '            float eU  = sampleExplNearestFog(uv + vec2(0.0, -texel.y), texel);',
    '            float eD  = sampleExplNearestFog(uv + vec2(0.0,  texel.y), texel);',
    '            float eLU = sampleExplNearestFog(uv + vec2(-texel.x, -texel.y), texel);',
    '            float eRU = sampleExplNearestFog(uv + vec2( texel.x, -texel.y), texel);',
    '            float eLD = sampleExplNearestFog(uv + vec2(-texel.x,  texel.y), texel);',
    '            float eRD = sampleExplNearestFog(uv + vec2( texel.x,  texel.y), texel);',
    '            if (eL > 0.5 || eR > 0.5 || eU > 0.5 || eD > 0.5',
    '             || eLU > 0.5 || eRU > 0.5 || eLD > 0.5 || eRD > 0.5) discard;',
    '        }',
    '    }',
    '',
    '    // 시야 밖: 탐험 여부에 따라 알파 결정',
    '    float fogAlpha = (explored > 0.5) ? exploredAlpha : unexploredAlpha;',
    '    // visibility 보간값으로 부드럽게 투명 전환',
    '    fogAlpha *= (1.0 - visibility);',
    '',
    '    // 맵 바깥 페이드아웃',
    '    if (outsideDist > 0.001) {',
    '        float fadeDist = outsideDist * mapSize.x * 0.5;',
    '        fogAlpha *= 1.0 - smoothstep(0.0, 1.0, fadeDist);',
    '    }',
    '',
    '    fogAlpha = clamp(fogAlpha, 0.0, 1.0);',
    '    if (fogAlpha < 0.001) discard;',
    '',
    '    vec3 color = fogColor;',
    '',
    '    // 라이트 산란',
    '    if (lightScatterOn > 0.5 && fogAlpha > 0.05) {',
    '        vec3 scatterLight = vec3(0.0);',
    '        for (int li = 0; li < 8; li++) {',
    '            if (li >= numLights) break;',
    '            float dist = length(mapXY - lightPositions[li].xy);',
    '            float atten = 1.0 - smoothstep(0.0, lightDistances[li], dist);',
    '            atten *= atten;',
    '            scatterLight += lightColors[li] * atten;',
    '        }',
    '        color += scatterLight * lightScatterIntensity * fogAlpha;',
    '    }',
    '',
    '    gl_FragColor = vec4(color, fogAlpha);',
    '}',
    '',
    '// --- 3D 볼류메트릭 레이마칭 ---',
    'void render3D() {',
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
    '    vec3 accColor = vec3(0.0);',
    '    float accAlpha = 0.0;',
    '    float t = tMin + stepSize * dither;',
    '',
    '    for (int i = 0; i < MAX_STEPS; i++) {',
    '        if (accAlpha > 0.97) break;',
    '        vec3 samplePos = rayOrigin + rayDir * t;',
    '        float heightNorm = clamp(samplePos.z / fogHeight, 0.0, 1.0);',
    '',
    '        vec3 fogInfo = sampleFogInfo(samplePos.xy);',
    '        float baseDensity = fogInfo.x;',
    '        float visibility = fogInfo.y;',
    '',
    '        // === 소용돌이(vortex) ===',
    '        if (vortexOn > 0.5) {',
    '            vec2 mapXY = samplePos.xy + scrollOffset;',
    '            vec2 toPlayer = mapXY - playerPixelPos;',
    '            float dist = length(toPlayer);',
    '            float angle = atan(toPlayer.y, toPlayer.x);',
    '            float vt = uTime * vortexSpeed;',
    '            float rotAmount = vt * 0.3 / (1.0 + dist * 0.003);',
    '            vec2 rotatedUV = vec2(',
    '                cos(angle + rotAmount) * dist,',
    '                sin(angle + rotAmount) * dist',
    '            ) * 0.005;',
    '            float vortexNoise = _valueNoise(rotatedUV + vec2(heightNorm * 3.0));',
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
    '        float heightFalloff = exp(-heightNorm * 3.0);',
    '        vec2 noiseCoord = samplePos.xy * 0.004 + vec2(uTime * 0.02, uTime * 0.015);',
    '        noiseCoord += vec2(heightNorm * 5.0);',
    '        float noise = fbm3(noiseCoord);',
    '',
    '        float density = baseDensity * heightFalloff * (1.0 + noise * 0.5);',
    '        density = clamp(density, 0.0, 1.0);',
    '',
    '        vec3 stepColor = (heightGradientOn > 0.5)',
    '            ? mix(fogColor, fogColorTop, heightNorm)',
    '            : fogColor;',
    '',
    '        // === God ray ===',
    '        if (godRayOn > 0.5 && visibility > 0.01 && visibility < 0.8) {',
    '            vec2 mapXY = samplePos.xy + scrollOffset;',
    '            vec2 toPlayer = normalize(playerPixelPos - mapXY);',
    '            float rayAngle = atan(toPlayer.y, toPlayer.x);',
    '            float rayNoise = _valueNoise(vec2(rayAngle * 3.0, uTime * 0.1));',
    '            rayNoise = max(0.0, rayNoise);',
    '            float edgeFactor = smoothstep(0.0, 0.3, visibility) * (1.0 - smoothstep(0.3, 0.8, visibility));',
    '            float godRayContrib = rayNoise * edgeFactor * godRayIntensity * (1.0 - heightNorm);',
    '            stepColor += (fogColor + vec3(0.8, 0.7, 0.5)) * 0.5 * godRayContrib;',
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
    '                atten *= atten;',
    '                scatterLight += lightColors[li] * atten;',
    '            }',
    '            stepColor += scatterLight * lightScatterIntensity * density * 2.0;',
    '        }',
    '',
    '        // === 시야 내부 밝기 ===',
    '        if (visibilityBrightness > 0.01 && visibility > 0.3) {',
    '            float glowFactor = visibility * visibilityBrightness * (1.0 - heightNorm * 0.5);',
    '            stepColor += (fogColor * 0.3 + vec3(0.05, 0.04, 0.03)) * glowFactor;',
    '        }',
    '',
    '        float absorb = density * stepSize * absorption;',
    '        accColor += (1.0 - accAlpha) * absorb * stepColor;',
    '        accAlpha += (1.0 - accAlpha) * absorb;',
    '',
    '        t += stepSize;',
    '    }',
    '',
    '    accAlpha = clamp(accAlpha, 0.0, 1.0);',
    '    if (accAlpha < 0.001) discard;',
    '',
    '    vec3 finalColor = (accAlpha > 0.001) ? accColor / accAlpha : fogColor;',
    '    gl_FragColor = vec4(finalColor, accAlpha);',
    '}',
    '',
    'void main() {',
    '    if (isOrtho > 0.5) { render2D(); } else { render3D(); }',
    '}'
].join('\n');

//=============================================================================
// 설정 상수
//=============================================================================

var FOG_PADDING = 2400;  // 맵 바깥으로 확장하는 패딩 (50타일, 각 변)

//=============================================================================
// 초기화 / 해제
//=============================================================================

FogOfWar.setup = function(mapWidth, mapHeight, config) {
    this._mapWidth = mapWidth;
    this._mapHeight = mapHeight;
    this._active = true;

    if (config) {
        var newMode = config.fogMode || '2d';
        // fogMode가 변경되면 메시 재생성 필요
        if (this._fogMode !== newMode && this._fogGroup) {
            this._disposeMesh();
        }
        this._fogMode = newMode;
        this._radius = config.radius != null ? config.radius : 5;
        if (config.fogColor) {
            var c = this._parseColor(config.fogColor);
            this._fogColor = c;
        }
        this._unexploredAlpha = config.unexploredAlpha != null ? config.unexploredAlpha : 1.0;
        this._exploredAlpha = config.exploredAlpha != null ? config.exploredAlpha : 0.6;
        this._fogHeight = config.fogHeight != null ? config.fogHeight : 300;
        this._lineOfSight = config.lineOfSight != null ? config.lineOfSight : true;
        this._lineOfSight3D = config.lineOfSight3D != null ? config.lineOfSight3D : false;
        this._eyeHeight = config.eyeHeight != null ? config.eyeHeight : 1.5;
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
        this._fogTransitionSpeed = config.fogTransitionSpeed != null ? config.fogTransitionSpeed : 5.0;
        this._tentacleFadeDuration = config.tentacleFadeDuration != null ? config.tentacleFadeDuration : 1.0;
        this._tentacleGrowDuration = config.tentacleGrowDuration != null ? config.tentacleGrowDuration : 0.5;
        // 2D 셰이더 파라미터를 _shaderOverrides로 적용
        if (config.dissolveStrength != null) {
            this._shaderOverrides = this._shaderOverrides || {};
            this._shaderOverrides.dissolveStrength = config.dissolveStrength;
        }
        if (config.fadeSmoothness != null) {
            this._shaderOverrides = this._shaderOverrides || {};
            this._shaderOverrides.fadeSmoothness = config.fadeSmoothness;
        }
        if (config.tentacleSharpness != null) {
            this._shaderOverrides = this._shaderOverrides || {};
            this._shaderOverrides.tentacleSharpness = config.tentacleSharpness;
        }
    }

    // 가시성 / 탐험 버퍼 (목표값 — 즉시 갱신)
    var size = mapWidth * mapHeight;
    this._visibilityData = new Float32Array(size);
    this._exploredData = new Uint8Array(size);

    // 표시용 버퍼 (lerp로 부드럽게 전환)
    this._displayVis = new Float32Array(size);
    this._displayExpl = new Float32Array(size);
    this._tentacleFade = new Float32Array(size); // 사라짐 페이드 (1→0: 촉수 사라짐)
    this._growFade = new Float32Array(size);     // 생성 페이드 (0→1: 촉수 자라남)
    this._borderState = new Uint8Array(size);    // 이전 프레임의 경계 상태 (0/1)
    if (!this._fogTransitionSpeed) this._fogTransitionSpeed = 5.0;
    if (!this._tentacleFadeDuration) this._tentacleFadeDuration = 1.0;
    if (!this._tentacleGrowDuration) this._tentacleGrowDuration = 0.5;

    // fog 텍스처: RG 채널 (R=visibility, G=explored)
    var texData = new Uint8Array(size * 4);
    this._fogTexture = new THREE.DataTexture(texData, mapWidth, mapHeight, THREE.RGBAFormat);
    this._fogTexture.magFilter = THREE.LinearFilter;
    this._fogTexture.minFilter = THREE.LinearFilter;
    this._fogTexture.needsUpdate = true;

    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
    this._time = 0;
    this._lastTime = 0;
    this._blockMapDirty = true;
};

FogOfWar.dispose = function() {
    // 3D Volume 모드 정리
    if (window.FogOfWar3DVolume && window.FogOfWar3DVolume._active) {
        window.FogOfWar3DVolume.dispose();
    }
    this._disposeMesh();
    if (this._fogTexture) {
        this._fogTexture.dispose();
        this._fogTexture = null;
    }
    this._visibilityData = null;
    this._exploredData = null;
    this._displayVis = null;
    this._displayExpl = null;
    this._tentacleFade = null;
    this._growFade = null;
    this._borderState = null;
    this._blockMap = null;
    this._blockMapDirty = true;
    this._heightMap = null;
    this._customHeightMap = false;
    this._active = false;
    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
    this._time = 0;
    this._lastTime = 0;
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
    if (this._lineOfSight) {
        this._buildBlockMap();
        if (this._lineOfSight3D) this._buildHeightMap();
    }

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
                // Line of Sight 체크
                if (this._lineOfSight) {
                    if (this._lineOfSight3D) {
                        if (!this._hasLineOfSight3D(playerTileX, playerTileY, tx, ty)) continue;
                    } else {
                        if (!this._hasLineOfSight(playerTileX, playerTileY, tx, ty)) continue;
                    }
                }

                var idx = ty * w + tx;
                var dist = Math.sqrt(distSq);
                var t = dist / radius;
                vis[idx] = Math.max(1.0 - t, 0.0); // linear falloff (넓은 경계 그라데이션)
                explored[idx] = 1;
            }
        }
    }

    // 시야 인접도 계산: vis=0인 타일 중 인접에 vis>0이 있으면 경계
    this._computeEdgeData();

    // 텍스처는 _lerpDisplay()에서 매 프레임 갱신
};

//=============================================================================
// 시야 블러 데이터: vis를 확산시켜 B채널에 기록 (경계 그라데이션용)
//=============================================================================

FogOfWar._blurData = null;

FogOfWar._computeEdgeData = function() {
    var w = this._mapWidth;
    var h = this._mapHeight;
    var vis = this._visibilityData;
    var size = w * h;

    if (!this._blurData || this._blurData.length !== size) {
        this._blurData = new Float32Array(size);
    }
    var blur = this._blurData;

    // 경계 타일 판정: vis=0인 타일 중 인접 4방향에 vis>0인 타일이 있으면 경계
    // B채널에는 인접 최대 vis 값을 기록 (1타일 폭만)
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var idx = y * w + x;
            if (vis[idx] > 0) {
                // 시야 안 타일: B채널 불필요 (render2D에서 discard됨)
                blur[idx] = 0;
                continue;
            }
            // vis=0 타일: 인접 8방향(4방향+대각선)의 최대 vis 확인
            var maxNeighbor = 0;
            if (x > 0)                 maxNeighbor = Math.max(maxNeighbor, vis[idx - 1]);
            if (x < w - 1)             maxNeighbor = Math.max(maxNeighbor, vis[idx + 1]);
            if (y > 0)                 maxNeighbor = Math.max(maxNeighbor, vis[idx - w]);
            if (y < h - 1)             maxNeighbor = Math.max(maxNeighbor, vis[idx + w]);
            if (x > 0 && y > 0)       maxNeighbor = Math.max(maxNeighbor, vis[idx - w - 1]);
            if (x < w-1 && y > 0)     maxNeighbor = Math.max(maxNeighbor, vis[idx - w + 1]);
            if (x > 0 && y < h-1)     maxNeighbor = Math.max(maxNeighbor, vis[idx + w - 1]);
            if (x < w-1 && y < h-1)   maxNeighbor = Math.max(maxNeighbor, vis[idx + w + 1]);
            blur[idx] = maxNeighbor;
        }
    }
};

//=============================================================================
// Line of Sight — 장애물 맵 + Bresenham 라인 캐스팅
//=============================================================================

FogOfWar._blockMap = null;     // Uint8Array — 장애물 맵 (0=통과 가능, 1=차단)
FogOfWar._blockMapDirty = true;
FogOfWar._heightMap = null;    // Float32Array — 타일별 높이 (0=바닥, 1~N=벽 높이)
FogOfWar._eyeHeight = 1.5;    // 플레이어 눈높이 (타일 단위)
FogOfWar._lineOfSight3D = false; // 3D LoS 활성화 여부

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

    // 타일셋 데이터가 아직 로드되지 않았으면 dirty 유지 (다음 프레임에 재시도)
    if (typeof $gameMap === 'undefined' || !$gameMap || !$gameMap.tilesetFlags) {
        return; // _blockMapDirty 유지
    }
    var flags = $gameMap.tilesetFlags();
    if (!flags || flags.length === 0) {
        return; // 타일셋 플래그가 아직 없으면 dirty 유지
    }

    for (var ty = 0; ty < h; ty++) {
        for (var tx = 0; tx < w; tx++) {
            // layeredTiles: 타일 레이어만 (이벤트 제외)
            var tiles = $gameMap.layeredTiles(tx, ty);
            var blocked = false;
            for (var ti = 0; ti < tiles.length; ti++) {
                var flag = flags[tiles[ti]];
                if (flag === undefined) continue;
                if ((flag & 0x10) !== 0) continue; // 통행에 영향 없는 타일
                if ((flag & 0x0f) === 0x0f) { blocked = true; break; } // 모든 방향 불가
            }
            if (blocked) blockMap[ty * w + tx] = 1;
        }
    }

    this._blockMapDirty = false;
};

//=============================================================================
// 높이맵 구축: 타일 유형에 따라 높이를 자동 부여
//=============================================================================

FogOfWar._buildHeightMap = function() {
    var w = this._mapWidth;
    var h = this._mapHeight;
    if (!this._heightMap || this._heightMap.length !== w * h) {
        this._heightMap = new Float32Array(w * h);
    }
    var heightMap = this._heightMap;

    // 외부에서 커스텀 높이맵을 제공한 경우 그대로 사용
    if (this._customHeightMap) return;

    for (var i = 0; i < heightMap.length; i++) heightMap[i] = 0;

    // $gameMap이 없으면 blockMap 기반 폴백
    if (typeof $gameMap === 'undefined' || !$gameMap || !$gameMap.tilesetFlags) {
        if (this._blockMap) {
            for (var i = 0; i < heightMap.length; i++) {
                heightMap[i] = this._blockMap[i] ? 2.0 : 0.0;
            }
        }
        return;
    }

    var flags = $gameMap.tilesetFlags();
    if (!flags || flags.length === 0) {
        if (this._blockMap) {
            for (var i = 0; i < heightMap.length; i++) {
                heightMap[i] = this._blockMap[i] ? 2.0 : 0.0;
            }
        }
        return;
    }

    for (var ty = 0; ty < h; ty++) {
        for (var tx = 0; tx < w; tx++) {
            var tiles = $gameMap.layeredTiles(tx, ty);
            var maxH = 0;
            for (var ti = 0; ti < tiles.length; ti++) {
                var tileId = tiles[ti];
                if (tileId === 0) continue;
                var flag = flags[tileId];
                if (flag === undefined) continue;
                if ((flag & 0x10) !== 0) continue; // 통행 영향 없음

                // 타일 유형별 높이 결정
                var tileH = 0;
                if ((flag & 0x0f) === 0x0f) {
                    // 모든 방향 통행 불가 = 벽
                    if (tileId >= 4352 && tileId < 5888) {
                        tileH = 3.0; // A3: 건물 외벽 (높음)
                    } else if (tileId >= 5888 && tileId < 8192) {
                        tileH = 2.5; // A4: 건물 벽/지형
                    } else {
                        tileH = 2.0; // 기타 벽
                    }
                } else if ((flag & 0x0f) !== 0) {
                    // 일부 방향만 통행 불가 = 낮은 장애물 (울타리 등)
                    tileH = 1.0;
                }
                maxH = Math.max(maxH, tileH);
            }
            heightMap[ty * w + tx] = maxH;
        }
    }
};

// 커스텀 높이맵 설정 (테스트용)
FogOfWar.setCustomHeightMap = function(heightMapArray) {
    var w = this._mapWidth;
    var h = this._mapHeight;
    if (!this._heightMap || this._heightMap.length !== w * h) {
        this._heightMap = new Float32Array(w * h);
    }
    for (var i = 0; i < Math.min(heightMapArray.length, w * h); i++) {
        this._heightMap[i] = heightMapArray[i];
    }
    this._customHeightMap = true;
    // blockMap도 동기화 (높이 > 0이면 blocked)
    if (!this._blockMap || this._blockMap.length !== w * h) {
        this._blockMap = new Uint8Array(w * h);
    }
    for (var i = 0; i < w * h; i++) {
        this._blockMap[i] = this._heightMap[i] > 0 ? 1 : 0;
    }
};

//=============================================================================
// 3D Line of Sight — 높이맵 기반 레이캐스팅
// 플레이어 눈높이에서 타겟 타일까지 시선을 추적, 중간 타일의 높이가
// 시선 직선보다 높으면 차단
//=============================================================================

FogOfWar._hasLineOfSight3D = function(x0, y0, x1, y1) {
    if (!this._heightMap) return this._hasLineOfSight(x0, y0, x1, y1);

    var w = this._mapWidth;
    var heightMap = this._heightMap;
    var eyeH = this._eyeHeight;

    // 시작점 높이: 플레이어 발밑 타일 높이 + 눈높이
    var startH = eyeH; // 플레이어는 바닥에 서있다고 가정 (높이 0 타일)

    // 끝점 높이: 타겟 타일의 높이 (벽이면 꼭대기를 볼 수 있음)
    var targetTileH = 0;
    if (x1 >= 0 && x1 < w && y1 >= 0 && y1 < this._mapHeight) {
        targetTileH = heightMap[y1 * w + x1];
    }
    // 타겟이 벽이면 벽의 중간 높이를 목표로 (벽 자체는 보임)
    var endH = targetTileH > 0 ? targetTileH * 0.5 : 0;

    // Bresenham 라인을 따라가며 3D 시선 체크
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;

    var cx = x0, cy = y0;
    var totalDist = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    if (totalDist < 0.001) return true;

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

        if (cx < 0 || cx >= w || cy < 0 || cy >= this._mapHeight) continue;

        // 끝점 도달
        if (cx === x1 && cy === y1) {
            // 타겟이 벽이면: 벽 자체는 보인다
            return true;
        }

        // 현재 위치까지의 거리 비율로 시선 높이 계산 (선형 보간)
        var curDist = Math.sqrt((cx - x0) * (cx - x0) + (cy - y0) * (cy - y0));
        var t = curDist / totalDist;
        var lineH = startH + (endH - startH) * t; // 시선의 높이

        // 이 타일의 높이가 시선보다 높으면 차단
        var tileH = heightMap[cy * w + cx];
        if (tileH > lineH) {
            return false;
        }
    }

    return true;
};

// Bresenham 라인: (x0,y0) → (x1,y1) 경로에 장애물이 있으면 false
// 시작점은 검사하지 않음 (플레이어가 벽 안에 있을 수 있음)
// 끝점이 벽이면: 벽 자체는 보이지만, 그 뒤(=끝점이 벽 뒤 타일)는 차단
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
    var hitWall = false; // 경로에서 벽을 만났는지

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

        // 경로상의 타일이 벽이면 차단
        if (cx >= 0 && cx < w && cy >= 0 && cy < this._mapHeight) {
            if (blockMap[cy * w + cx] === 1) {
                // 끝점이 벽 자체: 벽은 보이므로 true 반환
                if (cx === x1 && cy === y1) return true;
                // 경로 중간에 벽: 차단
                return false;
            }
        }

        // 끝점에 도달
        if (cx === x1 && cy === y1) break;
    }

    return true;
};

// 에디터 미리보기용: 특정 좌표 기준 가시성
FogOfWar.updateVisibilityAt = function(tileX, tileY) {
    this.updateVisibility(tileX, tileY);
};

// 매 프레임 호출: 표시 버퍼를 목표값으로 부드럽게 보간
FogOfWar._lerpDisplay = function(dt) {
    if (!this._displayVis || !this._visibilityData) return false;

    var vis = this._visibilityData;
    var expl = this._exploredData;
    var dVis = this._displayVis;
    var dExpl = this._displayExpl;
    var fade = this._tentacleFade;
    var grow = this._growFade;
    var borderState = this._borderState;
    var speed = this._fogTransitionSpeed;
    var alpha = 1.0 - Math.exp(-speed * dt);  // 지수 감쇄 보간
    // 시간 기반 선형 보간: dt / duration 만큼 진행
    var fadeStep = this._tentacleFadeDuration > 0 ? dt / this._tentacleFadeDuration : 1.0;
    var growStep = this._tentacleGrowDuration > 0 ? dt / this._tentacleGrowDuration : 1.0;
    var w = this._mapWidth;
    var h = this._mapHeight;
    var size = w * h;
    var changed = false;

    for (var i = 0; i < size; i++) {
        // visibility 보간
        var targetV = vis[i];
        var curV = dVis[i];
        if (curV !== targetV) {
            var newV = curV + (targetV - curV) * alpha;
            if (Math.abs(newV - targetV) < 0.005) newV = targetV;
            dVis[i] = newV;
            changed = true;
        }
        // explored는 즉시 반영
        if (dExpl[i] !== expl[i]) {
            // 미탐험→탐험 전환: tentacleFade를 1.0으로 설정
            if (expl[i] > dExpl[i]) {
                fade[i] = 1.0;
            }
            dExpl[i] = expl[i];
            changed = true;
        }
        // tentacleFade: 1.0 → 0.0 (선형, duration 초에 걸쳐 완료)
        if (fade[i] > 0.0) {
            fade[i] = Math.max(0.0, fade[i] - fadeStep);
            changed = true;
        }
        // growFade: 0.0 → 1.0 (선형, duration 초에 걸쳐 완료)
        if (grow[i] < 1.0) {
            grow[i] = Math.min(1.0, grow[i] + growStep);
            changed = true;
        }
    }

    // 경계 상태 갱신: 미탐험 타일이 새로 경계가 되면 growFade=0 시작
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var idx = y * w + x;
            if (expl[idx] > 0) {
                // 탐험된 타일은 경계 아님
                borderState[idx] = 0;
                continue;
            }
            // 미탐험 타일: 인접 8방향에 탐험이 있으면 경계
            var isBorder = false;
            if (x > 0 && expl[idx - 1] > 0) isBorder = true;
            else if (x < w - 1 && expl[idx + 1] > 0) isBorder = true;
            else if (y > 0 && expl[idx - w] > 0) isBorder = true;
            else if (y < h - 1 && expl[idx + w] > 0) isBorder = true;
            else if (x > 0 && y > 0 && expl[idx - w - 1] > 0) isBorder = true;
            else if (x < w - 1 && y > 0 && expl[idx - w + 1] > 0) isBorder = true;
            else if (x > 0 && y < h - 1 && expl[idx + w - 1] > 0) isBorder = true;
            else if (x < w - 1 && y < h - 1 && expl[idx + w + 1] > 0) isBorder = true;

            if (isBorder) {
                if (borderState[idx] === 0) {
                    // 새로 경계가 됨 → growFade를 0.2로 시작 (촉수 20% 길이부터 표시)
                    grow[idx] = 0.2;
                    changed = true;
                }
                borderState[idx] = 1;
            } else {
                borderState[idx] = 0;
            }
        }
    }

    return changed;
};

FogOfWar._updateTexture = function() {
    if (!this._fogTexture) return;

    var data = this._fogTexture.image.data;
    var w = this._mapWidth;
    var h = this._mapHeight;
    var vis = this._displayVis || this._visibilityData;
    var explored = this._displayExpl || this._exploredData;

    var fade = this._tentacleFade;
    var grow = this._growFade;

    for (var i = 0; i < w * h; i++) {
        var pi = i * 4;
        data[pi + 0] = Math.round(vis[i] * 255);     // R = visibility (보간됨)
        data[pi + 1] = Math.round(explored[i] * 255); // G = explored
        data[pi + 2] = fade ? Math.round(fade[i] * 255) : 0; // B = tentacle fade (사라짐)
        data[pi + 3] = grow ? Math.round(grow[i] * 255) : 255; // A = grow fade (생성)
    }

    this._fogTexture.needsUpdate = true;
};

//=============================================================================
// 전체 공개 / 전체 숨김
//=============================================================================

// 표시 버퍼를 목표값에 즉시 동기화 (revealAll/hideAll 등 즉시 효과용)
FogOfWar._syncDisplay = function() {
    if (!this._displayVis || !this._visibilityData) return;
    this._displayVis.set(this._visibilityData);
    for (var i = 0; i < this._exploredData.length; i++) {
        this._displayExpl[i] = this._exploredData[i];
    }
    // fade 버퍼 리셋
    if (this._tentacleFade) {
        for (var i = 0; i < this._tentacleFade.length; i++) {
            this._tentacleFade[i] = 0;
        }
    }
    if (this._growFade) {
        for (var i = 0; i < this._growFade.length; i++) {
            this._growFade[i] = 1.0; // 즉시 완전 표시
        }
    }
    if (this._borderState) {
        for (var i = 0; i < this._borderState.length; i++) {
            this._borderState[i] = 0;
        }
    }
};

FogOfWar.revealAll = function() {
    if (!this._visibilityData) return;
    for (var i = 0; i < this._visibilityData.length; i++) {
        this._visibilityData[i] = 1.0;
        this._exploredData[i] = 1;
    }
    this._syncDisplay();
    this._updateTexture();
};

FogOfWar.hideAll = function() {
    if (!this._visibilityData) return;
    for (var i = 0; i < this._visibilityData.length; i++) {
        this._visibilityData[i] = 0;
        this._exploredData[i] = 0;
    }
    this._syncDisplay();
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
    this._syncDisplay();
    this._updateTexture();
};

//=============================================================================
// 2D 경계 디졸브 셰이더 — fog 메시 위에 덮어서 경계면 디졸브 처리
// 탐험(explored>0)↔미탐험(explored=0) 경계에서 디졸브 처리
//=============================================================================

var EDGE_DISSOLVE_FRAG = [
    'precision highp float;',
    'varying vec3 vWorldPos;',
    '',
    'uniform sampler2D tFog;',
    'uniform vec3 fogColor;',
    'uniform float uTime;',
    'uniform vec2 mapSize;',
    'uniform vec2 mapPixelSize;',
    'uniform vec2 scrollOffset;',
    'uniform float edgeAnimOn;',
    'uniform float edgeAnimSpeed;',
    'uniform float dissolveStrength;',
    'uniform float fadeSmoothness;',
    'uniform float tentacleSharpness;', // pow 지수 (높을수록 뾰족한 촉수)
    'uniform float exploredAlpha;',
    'uniform float unexploredAlpha;',
    '',
    // 노이즈 함수 (fog 셰이더와 동일)
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
    '// texel 중심 좌표로 NEAREST 샘플링 (bilinear 보간 회피)',
    'float sampleVisNearest(vec2 uv, vec2 texel) {',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).r;',
    '}',
    'float sampleExplNearest(vec2 uv, vec2 texel) {',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).g;',
    '}',
    '// B채널: tentacle fade — bilinear 보간으로 읽어서 격자 방지',
    'float sampleFadeBilinear(vec2 uv) {',
    '    return texture2D(tFog, uv).b;',
    '}',
    '// B채널: tentacle fade — nearest (경계 판정용)',
    'float sampleFadeNearest(vec2 uv, vec2 texel) {',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).b;',
    '}',
    '// A채널: grow fade — nearest (미탐험 타일의 생성 페이드)',
    'float sampleGrowNearest(vec2 uv, vec2 texel) {',
    '    vec2 snapped = (floor(uv / texel) + 0.5) * texel;',
    '    return texture2D(tFog, snapped).a;',
    '}',
    '// 경계 판정: 미탐험 타일만 경계 (탐험된 타일의 fade는 무시)',
    'bool isBorder(vec2 uv, vec2 texel) {',
    '    return sampleExplNearest(uv, texel) < 0.5;',
    '}',
    '// 경계 타일의 fade값',
    '// 미탐험: growFade (0→1, 생성 시 서서히 증가)',
    '// fade 중(사라짐): tentacleFade (1→0, 서서히 감소)',
    'float borderFade(vec2 uv, vec2 texel) {',
    '    if (sampleExplNearest(uv, texel) < 0.5) return sampleGrowNearest(uv, texel);',
    '    return sampleFadeNearest(uv, texel);',
    '}',
    '',
    'void main() {',
    '    vec2 mapXY = vWorldPos.xy + scrollOffset;',
    '    vec2 uv = mapXY / mapPixelSize;',
    '',
    '    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;',
    '',
    '    vec2 texel = 1.0 / mapSize;',
    '',
    '    // 현재 타일의 explored 상태',
    '    float myExpl = sampleExplNearest(uv, texel);',
    '    float myFade = sampleFadeBilinear(uv);',
    '',
    '    // 미탐험 타일: 인접에 탐험이 있으면 경계 → unexploredAlpha로 채움',
    '    if (myExpl < 0.5) {',
    '        float eL = sampleExplNearest(uv + vec2(-texel.x, 0.0), texel);',
    '        float eR = sampleExplNearest(uv + vec2( texel.x, 0.0), texel);',
    '        float eU = sampleExplNearest(uv + vec2(0.0, -texel.y), texel);',
    '        float eD = sampleExplNearest(uv + vec2(0.0,  texel.y), texel);',
    '        float eLU = sampleExplNearest(uv + vec2(-texel.x, -texel.y), texel);',
    '        float eRU = sampleExplNearest(uv + vec2( texel.x, -texel.y), texel);',
    '        float eLD = sampleExplNearest(uv + vec2(-texel.x,  texel.y), texel);',
    '        float eRD = sampleExplNearest(uv + vec2( texel.x,  texel.y), texel);',
    '        bool hasExpl = (eL > 0.5 || eR > 0.5 || eU > 0.5 || eD > 0.5',
    '                     || eLU > 0.5 || eRU > 0.5 || eLD > 0.5 || eRD > 0.5);',
    '        if (!hasExpl) discard;',
    '        gl_FragColor = vec4(fogColor, unexploredAlpha);',
    '        return;',
    '    }',
    '',
    '    // 타일 내 위치',
    '    vec2 tp = fract(uv * mapSize);',
    '',
    '    // 경계 탐색: 가장 가까운 경계까지의 거리와 그 경계의 fade 값',
    '    float distToBorder = 99.0;',
    '    float closestBf = 1.0;',  // 가장 가까운 경계의 borderFade 값
    '    bool foundBorder = false;',
    '    float diag = 1.414;',
    '    for (float r = 1.0; r <= 4.0; r += 1.0) {',
    '        vec2 uvL = uv + vec2(-texel.x * r, 0.0);',
    '        vec2 uvR = uv + vec2( texel.x * r, 0.0);',
    '        vec2 uvU = uv + vec2(0.0, -texel.y * r);',
    '        vec2 uvD = uv + vec2(0.0,  texel.y * r);',
    '        // 4방향',
    '        if (isBorder(uvL, texel)) { float d = (r - 1.0) + tp.x; float bf = borderFade(uvL, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '        if (isBorder(uvR, texel)) { float d = (r - 1.0) + (1.0 - tp.x); float bf = borderFade(uvR, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '        if (isBorder(uvU, texel)) { float d = (r - 1.0) + tp.y; float bf = borderFade(uvU, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '        if (isBorder(uvD, texel)) { float d = (r - 1.0) + (1.0 - tp.y); float bf = borderFade(uvD, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '        // 대각선',
    '        vec2 uvLU = uv + vec2(-texel.x * r, -texel.y * r);',
    '        vec2 uvRU = uv + vec2( texel.x * r, -texel.y * r);',
    '        vec2 uvLD = uv + vec2(-texel.x * r,  texel.y * r);',
    '        vec2 uvRD = uv + vec2( texel.x * r,  texel.y * r);',
    '        if (isBorder(uvLU, texel)) { float d = (r - 1.0) * diag + length(tp); float bf = borderFade(uvLU, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '        if (isBorder(uvRU, texel)) { float d = (r - 1.0) * diag + length(vec2(1.0 - tp.x, tp.y)); float bf = borderFade(uvRU, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '        if (isBorder(uvLD, texel)) { float d = (r - 1.0) * diag + length(vec2(tp.x, 1.0 - tp.y)); float bf = borderFade(uvLD, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '        if (isBorder(uvRD, texel)) { float d = (r - 1.0) * diag + length(vec2(1.0 - tp.x, 1.0 - tp.y)); float bf = borderFade(uvRD, texel); if (d < distToBorder) { distToBorder = d; closestBf = bf; } foundBorder = true; }',
    '    }',
    '',
    '    // 촉수 노이즈 계산 (경계 유무에 관계없이 사용)',
    '    float timeS = uTime * edgeAnimSpeed;',
    '    float n1 = fbm3(mapXY * 0.025 + vec2(timeS * 0.06, timeS * 0.04));',
    '    float n2 = _valueNoise(mapXY * 0.07 + vec2(-timeS * 0.08, timeS * 0.05));',
    '    float n3 = _valueNoise(mapXY * 0.15 + vec2(timeS * 0.12, -timeS * 0.07));',
    '    float noise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;',
    '    float nNorm = clamp(noise + 0.5, 0.0, 1.0);',
    '    float fullLength = pow(nNorm, tentacleSharpness) * dissolveStrength;',
    '',
    '    if (!foundBorder) discard;',
    '',
    '    // 현재 픽셀의 visibility (bilinear 보간됨)',
    '    float myVis = texture2D(tFog, uv).r;',
    '    if (myVis > 0.99) discard;',
    '',
    '    float fadeFactor = closestBf;',
    '    float tentacleLength = fullLength * fadeFactor;',
    '    float inTentacle = tentacleLength - distToBorder;',
    '',
    '    float alpha;',
    '    if (inTentacle > 0.0) {',
    '        alpha = smoothstep(0.0, fadeSmoothness, inTentacle);',
    '        alpha *= smoothstep(0.0, 0.25, nNorm);',
    '        alpha *= unexploredAlpha;',
    '    } else {',
    '        // 촉수 바깥: fog 영역 — render2D와 동일하게 visibility 반영',
    '        alpha = exploredAlpha * (1.0 - myVis);',
    '    }',
    '',
    '    if (alpha < 0.001) discard;',
    '    gl_FragColor = vec4(fogColor, alpha);',
    '}'
].join('\n');

//=============================================================================
// 경량 3D Volume 셰이더 (8스텝, 단일 노이즈, god ray/vortex 없음)
//=============================================================================

var VOL_LIGHT_FRAG = [
    'precision mediump float;',
    'varying vec3 vWorldPos;',
    '',
    'uniform sampler2D tFog;',
    'uniform vec3 fogColor;',
    'uniform vec3 fogColorTop;',
    'uniform float unexploredAlpha;',
    'uniform float exploredAlpha;',
    'uniform float fogHeight;',
    'uniform float absorption;',
    'uniform vec2 mapPixelSize;',
    'uniform vec2 scrollOffset;',
    'uniform vec3 cameraWorldPos;',
    'uniform float isOrtho;',
    '',
    'void main() {',
    // 단일 texture fetch — fog 밀도 계산
    '    vec2 mapXY = vWorldPos.xy + scrollOffset;',
    '    vec2 uv = mapXY / mapPixelSize;',
    '    float dL = max(0.0, -uv.x); float dR = max(0.0, uv.x - 1.0);',
    '    float dT = max(0.0, -uv.y); float dB = max(0.0, uv.y - 1.0);',
    '    float outsideDist = max(max(dL, dR), max(dT, dB));',
    '    float visibility = 0.0; float explored = 0.0;',
    '    if (outsideDist < 0.001) {',
    '        vec4 s = texture2D(tFog, uv);',
    '        visibility = s.r; explored = s.g;',
    '    }',
    '    float baseDensity = mix(unexploredAlpha, exploredAlpha, explored);',
    '    float fogDensity = baseDensity * (1.0 - smoothstep(0.0, 0.6, visibility));',
    '    if (outsideDist > 0.001) {',
    '        fogDensity *= 1.0 - smoothstep(0.0, 2400.0, outsideDist * mapPixelSize.x);',
    '    }',
    '    if (fogDensity < 0.001) discard;',
    '',
    // Beer-Lambert: 카메라 시선이 안개 볼륨을 통과하는 경로 길이로 알파 계산
    '    float alpha;',
    '    if (isOrtho > 0.5) {',
    '        alpha = 1.0 - exp(-fogDensity * fogHeight * absorption);',
    '    } else {',
    '        vec3 rayDir = normalize(vWorldPos - cameraWorldPos);',
    '        float pathLen = fogHeight / max(abs(rayDir.z), 0.05);',
    '        alpha = 1.0 - exp(-fogDensity * pathLen * absorption);',
    '    }',
    '    alpha = clamp(alpha, 0.0, 1.0);',
    '    if (alpha < 0.001) discard;',
    '',
    // 높이 기반 색상 블렌딩
    '    float hBlend = isOrtho > 0.5 ? 0.5 : clamp(cameraWorldPos.z / fogHeight, 0.0, 1.0) * 0.5;',
    '    vec3 col = mix(fogColor, fogColorTop, hBlend);',
    '    float d = (fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)) * 52.9829189) - 0.5) / 128.0;',
    '    gl_FragColor = vec4(col + d, alpha + d);',
    '}'
].join('\n');

//=============================================================================
// 3D 메쉬 — 볼류메트릭 fog (단일 평면 + 레이마칭 셰이더)
//=============================================================================

FogOfWar._createMesh = function() {
    if (this._fogGroup) this._disposeMesh();
    if (!this._fogTexture) return null;

    // 3D Volume 모드: 경량 셰이더 메시 사용
    if (this._fogMode === '3dvolume') {
        return this._createMeshVolume();
    }

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
            isOrtho:         { value: 0.0 },
            dissolveStrength:{ value: 2.0 },
            fadeSmoothness:  { value: 0.3 },
            tentacleSharpness:{ value: 3.0 },
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

    // --- 2D 경계 디졸브 메시 (fog 위에 덮음) ---
    var edgeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tFog:            { value: this._fogTexture },
            fogColor:        { value: fogColorVec },
            exploredAlpha:   { value: this._exploredAlpha },
            unexploredAlpha: { value: this._unexploredAlpha },
            uTime:           { value: 0 },
            mapSize:         { value: material.uniforms.mapSize.value },
            mapPixelSize:    { value: material.uniforms.mapPixelSize.value },
            scrollOffset:    { value: material.uniforms.scrollOffset.value },
            edgeAnimOn:      { value: this._edgeAnimation ? 1.0 : 0.0 },
            edgeAnimSpeed:   { value: this._edgeAnimationSpeed },
            dissolveStrength:   { value: 2.0 },
            fadeSmoothness:     { value: 0.3 },
            tentacleSharpness:  { value: 3.0 }
        },
        vertexShader: VOL_FOG_VERT,
        fragmentShader: EDGE_DISSOLVE_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    var edgeGeometry = new THREE.PlaneGeometry(planeW, planeH);
    var edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edgeMesh.position.z = 0.1;  // fog 바로 위
    edgeMesh.renderOrder = 9991; // fog(9990)보다 나중에 렌더
    edgeMesh.frustumCulled = false;
    edgeMesh._isEdgeDissolve = true;

    group.add(edgeMesh);

    this._fogGroup = group;
    this._fogMesh = group;  // 하위 호환
    this._edgeMesh = edgeMesh;

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
        this._fogVolumeMesh = null;
        this._edgeMesh = null;
        this._losDebugMesh = null;
        if (this._losDebugTex) { this._losDebugTex.dispose(); this._losDebugTex = null; }
        this._losDebugCanvas = null;
    }
};

//=============================================================================
// 3D Volume 모드 전용 메쉬 생성 (경량 8스텝 레이마칭)
//=============================================================================

FogOfWar._createMeshVolume = function() {
    if (this._fogGroup) this._disposeMesh();
    if (!this._fogTexture) return null;

    var totalW = this._mapWidth * 48;
    var totalH = this._mapHeight * 48;
    var fogColorVec = new THREE.Vector3(this._fogColor.r, this._fogColor.g, this._fogColor.b);
    var fogColorTopVec = this._heightGradient
        ? new THREE.Vector3(this._fogColorTop.r, this._fogColorTop.g, this._fogColorTop.b)
        : fogColorVec.clone();

    var group = new THREE.Group();
    group._isFogOfWar = true;
    group.renderOrder = 9990;
    group.frustumCulled = false;

    var planeW = totalW + FOG_PADDING * 2;
    var planeH = totalH + FOG_PADDING * 2;

    var material = new THREE.ShaderMaterial({
        uniforms: {
            tFog:            { value: this._fogTexture },
            fogColor:        { value: fogColorVec },
            fogColorTop:     { value: fogColorTopVec },
            unexploredAlpha: { value: this._unexploredAlpha },
            exploredAlpha:   { value: this._exploredAlpha },
            cameraWorldPos:  { value: new THREE.Vector3(0, 0, 0) },
            fogHeight:       { value: this._fogHeight },
            mapPixelSize:    { value: new THREE.Vector2(totalW, totalH) },
            scrollOffset:    { value: new THREE.Vector2(0, 0) },
            absorption:      { value: this._absorption },
            isOrtho:         { value: 0.0 }
        },
        vertexShader: VOL_FOG_VERT,
        fragmentShader: VOL_LIGHT_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    var geometry = new THREE.PlaneGeometry(planeW, planeH);
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = 0;
    mesh.renderOrder = 9990;
    mesh.frustumCulled = false;

    group.add(mesh);

    this._fogGroup = group;
    this._fogMesh = group;
    this._fogVolumeMesh = null;
    this._edgeMesh = null;  // 3dvolume 모드는 경계 디졸브 메시 없음

    return group;
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
    if (u.uTime) u.uTime.value = this._time;
    u.fogHeight.value = this._fogHeight;
    u.absorption.value = this._absorption;
    if (u.edgeAnimOn) u.edgeAnimOn.value = this._edgeAnimation ? 1.0 : 0.0;
    if (u.edgeAnimSpeed) u.edgeAnimSpeed.value = this._edgeAnimationSpeed;

    // 3dvolume 모드는 경량 셰이더 — 추가 유니폼이 다름
    if (this._fogMode === '3dvolume') {
        if (u.fogColorTop) {
            var topC = this._heightGradient ? this._fogColorTop : this._fogColor;
            u.fogColorTop.value.set(topC.r, topC.g, topC.b);
        }
    } else {
        if (u.visibilityBrightness) u.visibilityBrightness.value = this._visibilityBrightness;
        u.fogColorTop.value.set(this._fogColorTop.r, this._fogColorTop.g, this._fogColorTop.b);
        if (u.heightGradientOn) u.heightGradientOn.value = this._heightGradient ? 1.0 : 0.0;
        if (u.godRayOn) u.godRayOn.value = this._godRay ? 1.0 : 0.0;
        if (u.godRayIntensity) u.godRayIntensity.value = this._godRayIntensity;
        if (u.vortexOn) u.vortexOn.value = this._vortex ? 1.0 : 0.0;
        if (u.vortexSpeed) u.vortexSpeed.value = this._vortexSpeed;
        if (u.lightScatterOn) u.lightScatterOn.value = this._lightScattering ? 1.0 : 0.0;
        if (u.lightScatterIntensity) u.lightScatterIntensity.value = this._lightScatterIntensity;

        // 셰이더 디버그 오버라이드
        var so = this._shaderOverrides || {};
        if (u.dissolveStrength) u.dissolveStrength.value = so.dissolveStrength != null ? so.dissolveStrength : 2.0;
        if (u.fadeSmoothness) u.fadeSmoothness.value = so.fadeSmoothness != null ? so.fadeSmoothness : 0.3;
        if (u.tentacleSharpness) u.tentacleSharpness.value = so.tentacleSharpness != null ? so.tentacleSharpness : 3.0;
    }

    // 카메라 월드 좌표 및 isOrtho 업데이트
    var is3D = typeof Mode3D !== 'undefined' && Mode3D._perspCamera && Mode3D._active;
    if (is3D) {
        u.cameraWorldPos.value.copy(Mode3D._perspCamera.position);
        u.isOrtho.value = 0.0;
    } else {
        // 2D 모드: OrthographicCamera → isOrtho 셰이더 분기 사용
        u.cameraWorldPos.value.set(0, 0, this._fogHeight + 100);
        u.isOrtho.value = 1.0;
    }

    // 경계 디졸브 메시: 2D 모드에서만 표시 (3dvolume 모드에서도 숨김)
    if (this._edgeMesh) {
        this._edgeMesh.visible = !is3D && this._fogMode !== '3dvolume';
    }

    // 스크롤 오프셋 업데이트
    var ox = 0, oy = 0;
    if (typeof $gameMap !== 'undefined' && $gameMap) {
        ox = $gameMap.displayX() * 48;
        oy = $gameMap.displayY() * 48;
    }
    u.scrollOffset.value.set(ox, oy);

    // 3dvolume 모드는 경계 디졸브/플레이어 좌표/라이트 산란 없음
    if (this._fogMode !== '3dvolume') {
        // 경계 디졸브 메시 uniform 갱신
        if (this._edgeMesh && this._edgeMesh.material) {
            var eu = this._edgeMesh.material.uniforms;
            eu.tFog.value = this._fogTexture;
            eu.fogColor.value.copy(fogColorVec);
            eu.exploredAlpha.value = this._exploredAlpha;
            eu.unexploredAlpha.value = this._unexploredAlpha;
            eu.uTime.value = this._time;
            eu.edgeAnimOn.value = this._edgeAnimation ? 1.0 : 0.0;
            eu.edgeAnimSpeed.value = this._edgeAnimationSpeed;
            eu.dissolveStrength.value = so.dissolveStrength != null ? so.dissolveStrength : 2.0;
            eu.fadeSmoothness.value = so.fadeSmoothness != null ? so.fadeSmoothness : 0.3;
            eu.tentacleSharpness.value = so.tentacleSharpness != null ? so.tentacleSharpness : 3.0;
        }

        // 플레이어 픽셀 좌표 업데이트
        if (typeof $gamePlayer !== 'undefined' && $gamePlayer) {
            u.playerPixelPos.value.set(
                ($gamePlayer._realX + 0.5) * 48,
                ($gamePlayer._realY + 0.5) * 48
            );
        }

        // 라이트 산란: $dataMap.editorLights.points에서 포인트 라이트 수집
        this._updateLightUniforms(u);
    }
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

// --- 프로파일러 ---
var _fowProf = {
    frameCount: 0,
    total: 0, postProcess: 0, visibility: 0, lerp: 0, texture: 0, meshPos: 0, meshUni: 0, losDbg: 0,
    drawCalls: 0, triangles: 0,
    log: function() {
        if (this.frameCount < 120) return;
        var n = this.frameCount;
        // draw call / triangles
        var dcInfo = '';
        if (this.drawCalls > 0) {
            dcInfo = '  draws=' + (this.drawCalls/n).toFixed(0) + '  tris=' + (this.triangles/n).toFixed(0);
        }
        // console.log('[FoW Prof] total=' + (this.total/n).toFixed(2) +
        //     'ms  postProc=' + (this.postProcess/n).toFixed(2) +
        //     '  vis=' + (this.visibility/n).toFixed(2) +
        //     '  lerp=' + (this.lerp/n).toFixed(2) +
        //     '  tex=' + (this.texture/n).toFixed(2) +
        //     '  meshPos=' + (this.meshPos/n).toFixed(2) +
        //     '  meshUni=' + (this.meshUni/n).toFixed(2) +
        //     '  losDbg=' + (this.losDbg/n).toFixed(2) +
        //     dcInfo +
        //     '  fogMode=' + (FogOfWar._fogMode || '?'));
        this.frameCount = 0;
        this.total = this.postProcess = this.visibility = this.lerp = this.texture = this.meshPos = this.meshUni = this.losDbg = 0;
        this.drawCalls = this.triangles = 0;
    }
};

var _PostProcess_updateUniforms = PostProcess._updateUniforms;
PostProcess._updateUniforms = function() {
    var _t0 = performance.now();
    _PostProcess_updateUniforms.call(this);
    var _t1 = performance.now();
    _fowProf.postProcess += _t1 - _t0;

    if (!FogOfWar._active) {
        _fowProf.total += _t1 - _t0;
        _fowProf.frameCount++;
        _fowProf.log();
        return;
    }

    // enabled2D/enabled3D에 따라 현재 모드에서 FoW를 숨김
    var _is3D = typeof Mode3D !== 'undefined' && Mode3D._active;
    if ((_is3D && !FogOfWar._enabled3D) || (!_is3D && !FogOfWar._enabled2D)) {
        if (FogOfWar._fogGroup) FogOfWar._fogGroup.visible = false;
        _fowProf.total += performance.now() - _t0;
        _fowProf.frameCount++;
        _fowProf.log();
        return;
    }
    if (FogOfWar._fogGroup) FogOfWar._fogGroup.visible = true;

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
        var _t2 = performance.now();
        if (typeof $gamePlayer !== 'undefined' && $gamePlayer) {
            FogOfWar.updateVisibility($gamePlayer.x, $gamePlayer.y);
        }
        var _t3 = performance.now();
        _fowProf.visibility += _t3 - _t2;

        var now = performance.now() / 1000;
        var dt = FogOfWar._lastTime > 0 ? Math.min(now - FogOfWar._lastTime, 0.1) : 0.016;
        FogOfWar._lastTime = now;
        var _t4 = performance.now();
        var changed = FogOfWar._lerpDisplay(dt);
        var _t5 = performance.now();
        _fowProf.lerp += _t5 - _t4;

        if (changed || FogOfWar._fogTexture.needsUpdate) {
            FogOfWar._updateTexture();
        }
        var _t6 = performance.now();
        _fowProf.texture += _t6 - _t5;

        FogOfWar._updateMeshPosition();
        var _t7 = performance.now();
        _fowProf.meshPos += _t7 - _t6;

        FogOfWar._updateMeshUniforms();
        var _t8 = performance.now();
        _fowProf.meshUni += _t8 - _t7;
    }

    var _t9 = performance.now();
    FogOfWar._updateLosDebug();
    var _t10 = performance.now();
    _fowProf.losDbg += _t10 - _t9;

    // draw call 카운트
    try {
        var rdr = Graphics._renderer && Graphics._renderer.renderer;
        if (rdr && rdr.info) {
            _fowProf.drawCalls += rdr.info.render.calls;
            _fowProf.triangles += rdr.info.render.triangles;
        }
    } catch(e) {}

    _fowProf.total += _t10 - _t0;
    _fowProf.frameCount++;
    _fowProf.log();
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
    if (fow && (fow.enabled2D || fow.enabled3D)) {
        FogOfWar.setup($dataMap.width, $dataMap.height, fow);
        FogOfWar._enabled2D = !!fow.enabled2D;
        FogOfWar._enabled3D = !!fow.enabled3D;
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
                // 현재 모드(2D/3D)에 따라 enabled 플래그 설정
                var _is3D = typeof Mode3D !== 'undefined' && Mode3D._active;
                if (_is3D) {
                    FogOfWar._enabled3D = true;
                } else {
                    FogOfWar._enabled2D = true;
                }
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
            } else if (sub === 'FogColor') {
                // FogOfWar FogColor #rrggbb
                var hexStr = (args[1] || '#000000').replace('#', '');
                var hexVal = parseInt(hexStr, 16);
                var cr = ((hexVal >> 16) & 0xFF) / 255;
                var cg = ((hexVal >> 8) & 0xFF) / 255;
                var cb = (hexVal & 0xFF) / 255;
                FogOfWar._fogColor = { r: cr, g: cg, b: cb };
                // 메시가 이미 생성되어 있으면 uniform 즉시 적용
                if (FogOfWar._fogGroup) {
                    FogOfWar._fogGroup.traverse(function(child) {
                        if (child.isMesh && child.material && child.material.uniforms && child.material.uniforms.fogColor) {
                            child.material.uniforms.fogColor.value.set(cr, cg, cb);
                        }
                    });
                }
            } else if (sub === 'TentacleSharpness') {
                // FogOfWar TentacleSharpness <value>  (기본 3.0, 높을수록 뾰족)
                var tsVal = parseFloat(args[1]);
                if (!isNaN(tsVal)) {
                    FogOfWar._shaderOverrides = FogOfWar._shaderOverrides || {};
                    FogOfWar._shaderOverrides.tentacleSharpness = tsVal;
                    if (FogOfWar._fogGroup) {
                        FogOfWar._fogGroup.traverse(function(child) {
                            if (child.isMesh && child.material && child.material.uniforms && child.material.uniforms.tentacleSharpness) {
                                child.material.uniforms.tentacleSharpness.value = tsVal;
                            }
                        });
                    }
                }
            }
        }
    };
}

//=============================================================================
// LoS 디버그 오버레이: 타일 위에 가시성/blockMap 상태 표시
//=============================================================================

FogOfWar._losDebugEnabled = false;
FogOfWar._losDebugMesh = null;
FogOfWar._losDebugTex = null;
FogOfWar._losDebugCanvas = null;

FogOfWar.toggleLosDebug = function(on) {
    this._losDebugEnabled = on;
    if (!on && this._losDebugMesh) {
        this._losDebugMesh.visible = false;
    }
};

FogOfWar._updateLosDebug = function() {
    if (!this._losDebugEnabled || !this._active || !this._fogGroup) return;

    var w = this._mapWidth;
    var h = this._mapHeight;
    if (!w || !h) return;

    var totalW = w * 48;
    var totalH = h * 48;

    // 오프스크린 캔버스 생성/갱신
    if (!this._losDebugCanvas || this._losDebugCanvas.width !== totalW || this._losDebugCanvas.height !== totalH) {
        this._losDebugCanvas = document.createElement('canvas');
        this._losDebugCanvas.width = totalW;
        this._losDebugCanvas.height = totalH;
    }
    var canvas = this._losDebugCanvas;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, totalW, totalH);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var vis = this._visibilityData;
    var expl = this._exploredData;
    var blockMap = this._blockMap;

    for (var ty = 0; ty < h; ty++) {
        for (var tx = 0; tx < w; tx++) {
            var idx = ty * w + tx;
            var px = tx * 48 + 24;
            var py = ty * 48 + 24;

            var isBlocked = blockMap ? blockMap[idx] : 0;
            var v = vis ? vis[idx] : 0;
            var e = expl ? expl[idx] : 0;

            // 배경
            if (isBlocked) {
                ctx.fillStyle = 'rgba(255,60,60,0.35)';
                ctx.fillRect(tx * 48 + 1, ty * 48 + 1, 46, 46);
            }

            // 텍스트
            if (isBlocked) {
                ctx.fillStyle = '#f44';
                ctx.fillText('WALL', px, py - 10);
            }
            if (v > 0) {
                ctx.fillStyle = '#4f4';
                ctx.fillText('V:' + v.toFixed(1), px, py + (isBlocked ? 4 : -2));
            }
            if (e > 0) {
                ctx.fillStyle = '#88f';
                ctx.fillText('E', px, py + (isBlocked ? 16 : 12));
            } else {
                ctx.fillStyle = '#f88';
                ctx.fillText('?', px, py + (isBlocked ? 16 : 12));
            }
        }
    }

    // Three.js 메쉬 생성 또는 텍스처 갱신
    if (!this._losDebugMesh) {
        this._losDebugTex = new THREE.CanvasTexture(canvas);
        this._losDebugTex.magFilter = THREE.NearestFilter;
        this._losDebugTex.minFilter = THREE.LinearFilter;

        var mat = new THREE.MeshBasicMaterial({
            map: this._losDebugTex,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        var geom = new THREE.PlaneGeometry(totalW, totalH);
        this._losDebugMesh = new THREE.Mesh(geom, mat);
        this._losDebugMesh.position.z = 0.3;  // FOW 메쉬(0, 0.1)보다 위
        this._losDebugMesh.renderOrder = 9995;
        this._losDebugMesh.frustumCulled = false;
        this._fogGroup.add(this._losDebugMesh);
    } else {
        this._losDebugTex.image = canvas;
        this._losDebugTex.needsUpdate = true;
        this._losDebugMesh.visible = true;
    }
};

})();
