//=============================================================================
// FogOfWar3DVolume.js - 저해상도 RT 레이마칭 + 업샘플링 3D 볼류메트릭 안개
//=============================================================================
// 2-pass 방식:
//   Pass 1: 화면의 1/N 해상도 RenderTarget에 볼류메트릭 ray-march
//           (씬의 3D 메시를 저해상도로 렌더)
//   Pass 2: 풀 해상도 스크린 quad에서 업샘플
// FogOfWar._fogTexture (visibility/explored)를 그대로 재사용
//=============================================================================

(function() {

var FogOfWar3DVolume = {};
window.FogOfWar3DVolume = FogOfWar3DVolume;

FogOfWar3DVolume._active = false;
FogOfWar3DVolume._lowResRT = null;
FogOfWar3DVolume._fogMesh = null;
FogOfWar3DVolume._fogScene = null;
FogOfWar3DVolume._upsampleMesh = null;
FogOfWar3DVolume._upsampleMaterial = null;
FogOfWar3DVolume._resolution = 4;
FogOfWar3DVolume._fogHeight = 200;
FogOfWar3DVolume._absorption = 0.018;
FogOfWar3DVolume._fogColor = null;
FogOfWar3DVolume._fogColorTop = null;
FogOfWar3DVolume._time = 0;
FogOfWar3DVolume._screenWidth = 0;
FogOfWar3DVolume._screenHeight = 0;
FogOfWar3DVolume._mapWidth = 0;
FogOfWar3DVolume._mapHeight = 0;
FogOfWar3DVolume._dirty = true;  // fog 텍스처가 변경되었는지 추적

//=============================================================================
// ray-march 셰이더 (최적화: 8 스텝, 단일 노이즈)
//=============================================================================

var VOL_VERT = [
    'varying vec3 vWorldPos;',
    'void main() {',
    '    vec4 worldPos = modelMatrix * vec4(position, 1.0);',
    '    vWorldPos = worldPos.xyz;',
    '    gl_Position = projectionMatrix * viewMatrix * worldPos;',
    '}'
].join('\n');

var VOL_FRAG = [
    'precision mediump float;',
    '',
    'varying vec3 vWorldPos;',
    '',
    'uniform sampler2D tFog;',
    'uniform vec3 fogColor;',
    'uniform vec3 fogColorTop;',
    'uniform float unexploredAlpha;',
    'uniform float exploredAlpha;',
    'uniform float fogHeight;',
    'uniform float absorption;',
    'uniform float uTime;',
    'uniform vec2 mapSize;',
    'uniform vec2 mapPixelSize;',
    'uniform vec2 scrollOffset;',
    'uniform vec3 cameraWorldPos;',
    'uniform float edgeAnimOn;',
    'uniform float edgeAnimSpeed;',
    '',
    'float hash(vec2 p) {',
    '    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    'float valueNoise(vec2 p) {',
    '    vec2 i = floor(p);',
    '    vec2 f = fract(p);',
    '    f = f * f * (3.0 - 2.0 * f);',
    '    float a = hash(i);',
    '    float b = hash(i + vec2(1.0, 0.0));',
    '    float c = hash(i + vec2(0.0, 1.0));',
    '    float d = hash(i + vec2(1.0, 1.0));',
    '    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    '',
    'vec2 sampleFogDensity(vec2 worldXY) {',
    '    vec2 mapXY = worldXY + scrollOffset;',
    '    vec2 uv = mapXY / mapPixelSize;',
    '    if (uv.x < -0.01 || uv.x > 1.01 || uv.y < -0.01 || uv.y > 1.01) return vec2(0.0);',
    '    vec4 s = texture2D(tFog, clamp(uv, 0.0, 1.0));',
    '    float visibility = s.r;',
    '    float explored = s.g;',
    '    float fogDensity;',
    '    if (visibility > 0.5) {',
    '        fogDensity = 0.0;',
    '    } else if (visibility > 0.01) {',
    '        fogDensity = smoothstep(0.5, 0.0, visibility);',
    '    } else if (explored > 0.5) {',
    '        fogDensity = exploredAlpha;',
    '    } else {',
    '        fogDensity = unexploredAlpha;',
    '    }',
    '    return vec2(fogDensity, visibility);',
    '}',
    '',
    'void main() {',
    '    vec3 rayOrigin = cameraWorldPos;',
    '    vec3 rayDir = normalize(vWorldPos - cameraWorldPos);',
    '',
    '    float invDirZ = 1.0 / (abs(rayDir.z) < 0.0001 ? 0.0001 : rayDir.z);',
    '    float t0 = -rayOrigin.z * invDirZ;',
    '    float t1 = (fogHeight - rayOrigin.z) * invDirZ;',
    '    float tMin = max(min(t0, t1), 0.0);',
    '    float tMax = max(t0, t1);',
    '    if (tMin >= tMax) discard;',
    '    tMax = min(tMax, tMin + fogHeight * 3.0);',
    '',
    '    const int MAX_STEPS = 6;',
    '    float stepSize = (tMax - tMin) / 6.0;',
    '    float dither = fract(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) * 43758.5453);',
    '',
    '    vec3 accColor = vec3(0.0);',
    '    float accAlpha = 0.0;',
    '    float t = tMin + stepSize * dither;',
    '',
    '    for (int i = 0; i < MAX_STEPS; i++) {',
    '        if (accAlpha > 0.95) break;',
    '        vec3 samplePos = rayOrigin + rayDir * t;',
    '        float heightNorm = clamp(samplePos.z / fogHeight, 0.0, 1.0);',
    '',
    '        vec2 fogInfo = sampleFogDensity(samplePos.xy);',
    '        float baseDensity = fogInfo.x;',
    '',
    '        if (edgeAnimOn > 0.5 && baseDensity > 0.01 && baseDensity < 0.95) {',
    '            float timeS = uTime * edgeAnimSpeed;',
    '            float edgeWave = valueNoise(samplePos.xy * 0.015 + vec2(timeS * 0.08, timeS * 0.06));',
    '            baseDensity += edgeWave * 0.2 * smoothstep(0.0, 0.15, baseDensity) * (1.0 - smoothstep(0.4, 0.7, baseDensity));',
    '            baseDensity = clamp(baseDensity, 0.0, 1.0);',
    '        }',
    '',
    '        baseDensity = smoothstep(0.05, 0.4, baseDensity);',
    '',
    '        float heightFalloff = 1.0 - heightNorm * heightNorm;',
    '        float noise = valueNoise(samplePos.xy * 0.004 + vec2(uTime * 0.02 + heightNorm * 5.0, uTime * 0.015));',
    '',
    '        float density = baseDensity * heightFalloff * (0.8 + noise * 0.4);',
    '',
    '        float absorb = density * stepSize * absorption;',
    '        vec3 stepColor = mix(fogColor, fogColorTop, heightNorm);',
    '        accColor += (1.0 - accAlpha) * absorb * stepColor;',
    '        accAlpha += (1.0 - accAlpha) * absorb;',
    '',
    '        t += stepSize;',
    '    }',
    '',
    '    accAlpha = clamp(accAlpha, 0.0, 1.0);',
    '    if (accAlpha < 0.001) discard;',
    '',
    '    vec3 finalColor = accColor / max(accAlpha, 0.001);',
    '    gl_FragColor = vec4(finalColor, accAlpha);',
    '}'
].join('\n');

//=============================================================================
// 업샘플 셰이더 (5-tap cross bilateral)
//=============================================================================

var UPSAMPLE_VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '    vUv = uv;',
    '    gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
].join('\n');

var UPSAMPLE_FRAG = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D tLowRes;',
    'uniform vec2 texelSize;',
    '',
    'void main() {',
    '    vec4 center = texture2D(tLowRes, vUv);',
    '    vec4 l = texture2D(tLowRes, vUv + vec2(-texelSize.x, 0.0));',
    '    vec4 r = texture2D(tLowRes, vUv + vec2( texelSize.x, 0.0));',
    '    vec4 u = texture2D(tLowRes, vUv + vec2(0.0,  texelSize.y));',
    '    vec4 d = texture2D(tLowRes, vUv + vec2(0.0, -texelSize.y));',
    '',
    '    float ca = center.a;',
    '    float wl = exp(-abs(l.a - ca) * 50.0) * 0.5;',
    '    float wr = exp(-abs(r.a - ca) * 50.0) * 0.5;',
    '    float wu = exp(-abs(u.a - ca) * 50.0) * 0.5;',
    '    float wd = exp(-abs(d.a - ca) * 50.0) * 0.5;',
    '    float wc = 1.0;',
    '    float wSum = wc + wl + wr + wu + wd;',
    '    vec4 result = (center * wc + l * wl + r * wr + u * wu + d * wd) / wSum;',
    '    if (result.a < 0.001) discard;',
    '    gl_FragColor = result;',
    '}'
].join('\n');

var FOG_PADDING = 960;

//=============================================================================
// 초기화
//=============================================================================

FogOfWar3DVolume.setup = function(mapWidth, mapHeight, screenWidth, screenHeight, config) {
    this._mapWidth = mapWidth;
    this._mapHeight = mapHeight;
    this._screenWidth = screenWidth;
    this._screenHeight = screenHeight;

    if (!this._fogColor) this._fogColor = new THREE.Vector3(0, 0, 0);
    if (!this._fogColorTop) this._fogColorTop = new THREE.Vector3(0.1, 0.1, 0.15);

    if (config) {
        this._resolution = config.resolution || 4;
        this._fogHeight = config.fogHeight || 200;
        this._absorption = config.absorption || 0.015;
        if (config.fogColor) {
            var c = config.fogColor;
            this._fogColor.set(c.r || 0, c.g || 0, c.b || 0);
        }
        if (config.fogColorTop) {
            var ct = config.fogColorTop;
            this._fogColorTop.set(ct.r || 0.1, ct.g || 0.1, ct.b || 0.15);
        }
    }

    this._createFogMesh(mapWidth, mapHeight);
    this._createRenderTargets(screenWidth, screenHeight);
    this._active = true;
    this._dirty = true;
};

//=============================================================================
// fog 메시 생성 (별도 씬에서 저해상도로 렌더)
//=============================================================================

FogOfWar3DVolume._createFogMesh = function(mapWidth, mapHeight) {
    var totalW = mapWidth * 48;
    var totalH = mapHeight * 48;
    var boxW = totalW + FOG_PADDING * 2;
    var boxH = totalH + FOG_PADDING * 2;
    var boxD = this._fogHeight;

    var fogColorVec = this._fogColor;
    var fogColorTopVec = this._fogColorTop;

    this._fogMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tFog:            { value: null },
            fogColor:        { value: fogColorVec },
            fogColorTop:     { value: fogColorTopVec },
            unexploredAlpha: { value: 1.0 },
            exploredAlpha:   { value: 0.6 },
            fogHeight:       { value: this._fogHeight },
            absorption:      { value: this._absorption },
            uTime:           { value: 0 },
            mapSize:         { value: new THREE.Vector2(mapWidth, mapHeight) },
            mapPixelSize:    { value: new THREE.Vector2(totalW, totalH) },
            scrollOffset:    { value: new THREE.Vector2(0, 0) },
            cameraWorldPos:  { value: new THREE.Vector3(0, 0, 500) },
            edgeAnimOn:      { value: 1.0 },
            edgeAnimSpeed:   { value: 1.0 }
        },
        vertexShader: VOL_VERT,
        fragmentShader: VOL_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.BackSide
    });

    var geo = new THREE.BoxGeometry(boxW, boxH, boxD);
    this._fogMesh = new THREE.Mesh(geo, this._fogMaterial);
    this._fogMesh.position.set(totalW / 2, totalH / 2, boxD / 2);
    this._fogMesh.frustumCulled = false;

    this._fogScene = new THREE.Scene();
    this._fogScene.add(this._fogMesh);
};

//=============================================================================
// RT + 업샘플 quad 생성
//=============================================================================

FogOfWar3DVolume._createRenderTargets = function(screenWidth, screenHeight) {
    var lowW = Math.max(1, Math.floor(screenWidth / this._resolution));
    var lowH = Math.max(1, Math.floor(screenHeight / this._resolution));

    if (this._lowResRT) this._lowResRT.dispose();
    this._lowResRT = new THREE.WebGLRenderTarget(lowW, lowH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
    });

    if (this._upsampleMaterial) this._upsampleMaterial.dispose();
    this._upsampleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tLowRes:   { value: this._lowResRT.texture },
            texelSize: { value: new THREE.Vector2(1.0 / lowW, 1.0 / lowH) }
        },
        vertexShader: UPSAMPLE_VERT,
        fragmentShader: UPSAMPLE_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });

    if (!this._upsampleQuad) {
        var quadGeo = new THREE.PlaneGeometry(2, 2);
        this._upsampleQuad = new THREE.Mesh(quadGeo, this._upsampleMaterial);
    } else {
        this._upsampleQuad.material = this._upsampleMaterial;
    }

    if (!this._upsampleScene) {
        this._upsampleScene = new THREE.Scene();
        this._upsampleScene.add(this._upsampleQuad);
    }
    if (!this._upsampleCamera) {
        this._upsampleCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
};

//=============================================================================
// 더티 플래그 — 외부에서 fog 텍스처가 변경되면 호출
//=============================================================================

FogOfWar3DVolume.markDirty = function() {
    this._dirty = true;
};

//=============================================================================
// 렌더링 (매 프레임 호출, dirty 시에만 실제 렌더)
//=============================================================================

FogOfWar3DVolume.render = function(renderer, camera, dt) {
    if (!this._active || !this._lowResRT || !this._fogMaterial) return;
    if (!FogOfWar || !FogOfWar._fogTexture) return;

    this._time += dt;

    // edgeAnimation이 켜져있으면 항상 dirty (애니메이션)
    var hasEdgeAnim = FogOfWar._edgeAnimation;
    var needsRender = this._dirty || hasEdgeAnim;
    if (!needsRender) {
        // dirty 아니고 edgeAnim도 없으면 — 이전 RT 결과만 합성 (단, 한 번도 렌더 안 됐으면 스킵)
        if (this._lastRendered && this._upsampleScene && this._upsampleCamera) {
            var prevAC = renderer.autoClear;
            renderer.autoClear = false;
            renderer.render(this._upsampleScene, this._upsampleCamera);
            renderer.autoClear = prevAC;
        }
        return;
    }
    this._lastRendered = true;
    this._dirty = false;

    // fogHeight 변경 시 Box Z 스케일 동적 업데이트
    if (this._fogMesh && this._fogMesh.geometry.parameters) {
        var origHeight = this._fogMesh.geometry.parameters.depth;
        if (origHeight > 0 && origHeight !== this._fogHeight) {
            var scaleZ = this._fogHeight / origHeight;
            this._fogMesh.scale.z = scaleZ;
            this._fogMesh.position.z = this._fogHeight / 2;
        }
    }

    // fog 메시 유니폼 갱신
    var u = this._fogMaterial.uniforms;
    u.tFog.value = FogOfWar._fogTexture;
    u.unexploredAlpha.value = FogOfWar._unexploredAlpha;
    u.exploredAlpha.value = FogOfWar._exploredAlpha;
    u.fogHeight.value = this._fogHeight;
    u.absorption.value = this._absorption;
    u.uTime.value = this._time;
    u.scrollOffset.value.set(0, 0);
    u.cameraWorldPos.value.copy(camera.position);
    u.edgeAnimOn.value = hasEdgeAnim ? 1.0 : 0.0;
    u.edgeAnimSpeed.value = FogOfWar._edgeAnimationSpeed || 1.0;

    // Pass 1: fog 씬을 저해상도 RT에 렌더
    var prevRT = renderer.getRenderTarget();
    var prevClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(this._lowResRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this._fogScene, camera);

    // Pass 2: 업샘플 quad를 메인 프레임버퍼에 합성
    renderer.setRenderTarget(prevRT);
    var prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this._upsampleScene, this._upsampleCamera);
    renderer.autoClear = prevAutoClear;
    renderer.setClearAlpha(prevClearAlpha);
};

//=============================================================================
// 리사이즈
//=============================================================================

FogOfWar3DVolume.resize = function(screenWidth, screenHeight) {
    this._screenWidth = screenWidth;
    this._screenHeight = screenHeight;
    if (this._active) {
        this._createRenderTargets(screenWidth, screenHeight);
        this._dirty = true;
    }
};

//=============================================================================
// 정리
//=============================================================================

FogOfWar3DVolume.dispose = function() {
    if (this._fogMesh) {
        this._fogMesh.geometry.dispose();
        this._fogMesh = null;
    }
    if (this._fogMaterial) {
        this._fogMaterial.dispose();
        this._fogMaterial = null;
    }
    this._fogScene = null;

    if (this._lowResRT) {
        this._lowResRT.dispose();
        this._lowResRT = null;
    }
    if (this._upsampleMaterial) {
        this._upsampleMaterial.dispose();
        this._upsampleMaterial = null;
    }
    if (this._upsampleQuad) {
        this._upsampleQuad.geometry.dispose();
        this._upsampleQuad = null;
    }
    this._upsampleScene = null;
    this._upsampleCamera = null;

    this._active = false;
    this._time = 0;
    this._dirty = true;
    this._lastRendered = false;
};

})();
