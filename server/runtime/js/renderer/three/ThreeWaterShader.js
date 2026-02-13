//=============================================================================
// ThreeWaterShader.js - 물 타일 커스텀 셰이더 (wave + foam + 투명도 + 빛 반사)
//=============================================================================
// 물 타일(A1)에 물결 UV 왜곡, 버텍스 물결, 해안선 거품, 투명도, specular 반사.
// ShadowLight 활성 시 onBeforeCompile로 Phong 셰이더에 주입,
// 비활성 시 standalone ShaderMaterial (자체 Phong 라이팅 포함) 사용.
//=============================================================================

var ThreeWaterShader = {};

// 전역 시간 (useThreeRenderer에서 매 프레임 업데이트)
ThreeWaterShader._time = 0;
// 물 메시가 존재하는지 여부 (연속 렌더 판단용)
ThreeWaterShader._hasWaterMesh = false;

//-----------------------------------------------------------------------------
// 공통 GLSL 함수
//-----------------------------------------------------------------------------

// 물결 높이 함수 (vertex displacement + normal 계산에 공유)
ThreeWaterShader._WAVE_FUNCTIONS = [
    'uniform float uTime;',
    'uniform float uVertexWaveHeight;',
    'uniform float uVertexWaveFreq;',
    'uniform float uVertexWaveSpeed;',
    '',
    'float waveHeight(vec2 wp, float time) {',
    '    float h = sin(wp.x * uVertexWaveFreq + time * uVertexWaveSpeed) * 0.6;',
    '    h += sin(wp.y * uVertexWaveFreq * 0.7 + time * uVertexWaveSpeed * 0.8) * 0.4;',
    '    h += sin((wp.x + wp.y) * uVertexWaveFreq * 0.5 + time * uVertexWaveSpeed * 1.2) * 0.3;',
    '    return h * uVertexWaveHeight;',
    '}',
    '',
    '// wave의 편미분으로 법선 계산',
    'vec3 waveNormal(vec2 wp, float time) {',
    '    float eps = 0.5;',
    '    float hC = waveHeight(wp, time);',
    '    float hR = waveHeight(wp + vec2(eps, 0.0), time);',
    '    float hU = waveHeight(wp + vec2(0.0, eps), time);',
    '    vec3 tangentX = vec3(eps, 0.0, hR - hC);',
    '    vec3 tangentY = vec3(0.0, eps, hU - hC);',
    '    return normalize(cross(tangentX, tangentY));',
    '}',
].join('\n');

//-----------------------------------------------------------------------------
// GLSL 코드 조각 (onBeforeCompile용 - Phong material에 주입)
//-----------------------------------------------------------------------------

ThreeWaterShader.VERTEX_PARS = [
    'attribute float aFoamMask;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
    ThreeWaterShader._WAVE_FUNCTIONS,
].join('\n');

ThreeWaterShader.VERTEX_MAIN = [
    'vFoamMask = aFoamMask;',
    'vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);',
    'vWorldPos = worldPos4.xy;',
    '// Vertex wave displacement (해변 근처에서 감쇠)',
    'float shoreAtten = 1.0 - vFoamMask;',
    'float wH = waveHeight(worldPos4.xy, uTime) * shoreAtten;',
    'transformed.z += wH;',
    '',
    '// Wave normal 계산 (해변 근처 감쇠 반영)',
    'vec3 wN = waveNormal(worldPos4.xy, uTime);',
    'vec3 flatN = vec3(0.0, 0.0, -1.0);',
    'vec3 waveN = vec3(wN.x, wN.y, -abs(wN.z));',
    'objectNormal = mix(waveN, flatN, vFoamMask);',
].join('\n');

ThreeWaterShader.FRAGMENT_PARS = [
    'uniform float uTime;',
    'uniform float uWaveAmplitude;',
    'uniform float uWaveFrequency;',
    'uniform float uWaveSpeed;',
    'uniform vec3 uFoamColor;',
    'uniform float uFoamAlpha;',
    'uniform float uWaterAlpha;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
    '',
    'vec2 waterWaveUV(vec2 uv, vec2 worldPos, float time) {',
    '    float waveX = sin(worldPos.y * uWaveFrequency + time * uWaveSpeed) * uWaveAmplitude;',
    '    float waveY = cos(worldPos.x * uWaveFrequency * 0.8 + time * uWaveSpeed * 0.7) * uWaveAmplitude * 0.6;',
    '    return uv + vec2(waveX, waveY);',
    '}',
    '',
    'float foamPattern(vec2 worldPos, float time) {',
    '    float f1 = sin(worldPos.x * 0.15 + time * 1.5) * 0.5 + 0.5;',
    '    float f2 = cos(worldPos.y * 0.12 + time * 1.2) * 0.5 + 0.5;',
    '    float f3 = sin((worldPos.x + worldPos.y) * 0.1 + time * 0.8) * 0.5 + 0.5;',
    '    float foam = f1 * f2 * f3;',
    '    foam *= smoothstep(0.15, 0.55, foam);',
    '    return foam;',
    '}',
].join('\n');

// 물 타일용 fragment 로직 (#include <map_fragment> 뒤에 삽입)
ThreeWaterShader.FRAGMENT_MAIN = [
    '{',
    '    vec2 waveUV = waterWaveUV(vUv, vWorldPos, uTime);',
    '    vec4 waveTexColor = texture2D(map, waveUV);',
    '    diffuseColor = waveTexColor;',
    '}',
    'if (vFoamMask > 0.01) {',
    '    float foam = foamPattern(vWorldPos, uTime);',
    '    diffuseColor.rgb = mix(diffuseColor.rgb, uFoamColor, foam * uFoamAlpha * vFoamMask);',
    '}',
    'diffuseColor.a *= uWaterAlpha;',
].join('\n');

// 폭포 타일용 fragment 로직
ThreeWaterShader.WATERFALL_FRAGMENT_MAIN = [
    '{',
    '    float wfWaveX = sin(vWorldPos.y * 6.0 + uTime * 3.0) * 0.004;',
    '    float wfWaveY = cos(vWorldPos.x * 3.0 + uTime * 2.5) * 0.003;',
    '    vec2 wfUV = vUv + vec2(wfWaveX, wfWaveY);',
    '    vec4 wfTexColor = texture2D(map, wfUV);',
    '    diffuseColor = wfTexColor;',
    '}',
    'if (vFoamMask > 0.01) {',
    '    float splash = sin(vWorldPos.y * 0.2 + uTime * 4.0) * 0.5 + 0.5;',
    '    splash *= cos(vWorldPos.x * 0.3 + uTime * 2.0) * 0.5 + 0.5;',
    '    splash = smoothstep(0.3, 0.7, splash);',
    '    diffuseColor.rgb = mix(diffuseColor.rgb, uFoamColor, splash * uFoamAlpha * 0.6);',
    '}',
    'diffuseColor.a *= min(uWaterAlpha + 0.1, 1.0);',
].join('\n');

//-----------------------------------------------------------------------------
// Standalone ShaderMaterial (ShadowLight 비활성 시)
// 자체 Phong 라이팅으로 specular 반사 지원
//-----------------------------------------------------------------------------

ThreeWaterShader._STANDALONE_VERTEX = [
    'attribute float aFoamMask;',
    'varying vec2 vUv;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
    'varying vec3 vNormalW;',
    'varying vec3 vViewDir;',
    '',
    ThreeWaterShader._WAVE_FUNCTIONS,
    '',
    'void main() {',
    '    vUv = uv;',
    '    vFoamMask = aFoamMask;',
    '    vec4 worldPos4 = modelMatrix * vec4(position, 1.0);',
    '    vWorldPos = worldPos4.xy;',
    '',
    '    // Vertex wave displacement (해변 근처에서 감쇠)',
    '    vec3 displaced = position;',
    '    float shoreAtten = 1.0 - aFoamMask;',
    '    displaced.z += waveHeight(worldPos4.xy, uTime) * shoreAtten;',
    '',
    '    // Wave normal (world space, 해변 근처 감쇠 반영)',
    '    vec3 wN = waveNormal(worldPos4.xy, uTime);',
    '    vec3 flatN = vec3(0.0, 0.0, -1.0);',
    '    vec3 waveN = vec3(wN.x, wN.y, -abs(wN.z));',
    '    vNormalW = mix(waveN, flatN, aFoamMask);',
    '',
    '    // View direction (카메라 → 정점)',
    '    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);',
    '    vViewDir = normalize(-mvPos.xyz);',
    '',
    '    gl_Position = projectionMatrix * mvPos;',
    '}',
].join('\n');

ThreeWaterShader._STANDALONE_FRAGMENT_WATER = [
    'uniform sampler2D map;',
    'uniform float uTime;',
    'uniform float uWaveAmplitude;',
    'uniform float uWaveFrequency;',
    'uniform float uWaveSpeed;',
    'uniform vec3 uFoamColor;',
    'uniform float uFoamAlpha;',
    'uniform float uWaterAlpha;',
    'uniform vec3 uSpecularColor;',
    'uniform float uShininess;',
    'uniform vec3 uLightDir;',
    'varying vec2 vUv;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
    'varying vec3 vNormalW;',
    'varying vec3 vViewDir;',
    '',
    'vec2 waterWaveUV(vec2 uv, vec2 worldPos, float time) {',
    '    float waveX = sin(worldPos.y * uWaveFrequency + time * uWaveSpeed) * uWaveAmplitude;',
    '    float waveY = cos(worldPos.x * uWaveFrequency * 0.8 + time * uWaveSpeed * 0.7) * uWaveAmplitude * 0.6;',
    '    return uv + vec2(waveX, waveY);',
    '}',
    '',
    'float foamPattern(vec2 worldPos, float time) {',
    '    float f1 = sin(worldPos.x * 0.15 + time * 1.5) * 0.5 + 0.5;',
    '    float f2 = cos(worldPos.y * 0.12 + time * 1.2) * 0.5 + 0.5;',
    '    float f3 = sin((worldPos.x + worldPos.y) * 0.1 + time * 0.8) * 0.5 + 0.5;',
    '    float foam = f1 * f2 * f3;',
    '    foam *= smoothstep(0.15, 0.55, foam);',
    '    return foam;',
    '}',
    '',
    'void main() {',
    '    vec2 waveUV = waterWaveUV(vUv, vWorldPos, uTime);',
    '    vec4 color = texture2D(map, waveUV);',
    '',
    '    // Foam',
    '    if (vFoamMask > 0.01) {',
    '        float foam = foamPattern(vWorldPos, uTime);',
    '        color.rgb = mix(color.rgb, uFoamColor, foam * uFoamAlpha * vFoamMask);',
    '    }',
    '',
    '    // 간단한 Phong specular 반사',
    '    vec3 N = normalize(vNormalW);',
    '    vec3 L = normalize(uLightDir);',
    '    vec3 V = normalize(vViewDir);',
    '    vec3 R = reflect(-L, N);',
    '    float spec = pow(max(dot(R, V), 0.0), uShininess);',
    '    color.rgb += uSpecularColor * spec;',
    '',
    '    color.a *= uWaterAlpha;',
    '    if (color.a < 0.01) discard;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

ThreeWaterShader._STANDALONE_FRAGMENT_WATERFALL = [
    'uniform sampler2D map;',
    'uniform float uTime;',
    'uniform float uWaveAmplitude;',
    'uniform float uWaveFrequency;',
    'uniform float uWaveSpeed;',
    'uniform vec3 uFoamColor;',
    'uniform float uFoamAlpha;',
    'uniform float uWaterAlpha;',
    'uniform vec3 uSpecularColor;',
    'uniform float uShininess;',
    'uniform vec3 uLightDir;',
    'varying vec2 vUv;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
    'varying vec3 vNormalW;',
    'varying vec3 vViewDir;',
    '',
    'void main() {',
    '    float wfWaveX = sin(vWorldPos.y * 6.0 + uTime * 3.0) * 0.004;',
    '    float wfWaveY = cos(vWorldPos.x * 3.0 + uTime * 2.5) * 0.003;',
    '    vec2 wfUV = vUv + vec2(wfWaveX, wfWaveY);',
    '    vec4 color = texture2D(map, wfUV);',
    '',
    '    if (vFoamMask > 0.01) {',
    '        float splash = sin(vWorldPos.y * 0.2 + uTime * 4.0) * 0.5 + 0.5;',
    '        splash *= cos(vWorldPos.x * 0.3 + uTime * 2.0) * 0.5 + 0.5;',
    '        splash = smoothstep(0.3, 0.7, splash);',
    '        color.rgb = mix(color.rgb, uFoamColor, splash * uFoamAlpha * 0.6);',
    '    }',
    '',
    '    // Specular',
    '    vec3 N = normalize(vNormalW);',
    '    vec3 L = normalize(uLightDir);',
    '    vec3 V = normalize(vViewDir);',
    '    vec3 R = reflect(-L, N);',
    '    float spec = pow(max(dot(R, V), 0.0), uShininess);',
    '    color.rgb += uSpecularColor * spec * 0.5;',
    '',
    '    color.a *= min(uWaterAlpha + 0.1, 1.0);',
    '    if (color.a < 0.01) discard;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

//-----------------------------------------------------------------------------
// Uniform 기본값
//-----------------------------------------------------------------------------

ThreeWaterShader.DEFAULT_UNIFORMS = {
    uTime:              0.0,
    uWaveAmplitude:     0.006,
    uWaveFrequency:     4.0,
    uWaveSpeed:         2.0,
    uFoamColor:         [1.0, 1.0, 1.0],
    uFoamAlpha:         0.55,
    uWaterAlpha:        0.85,
    uVertexWaveHeight:  3.0,    // 버텍스 물결 높이 (픽셀)
    uVertexWaveFreq:    0.08,   // 버텍스 물결 주파수
    uVertexWaveSpeed:   2.0,    // 버텍스 물결 속도
    uSpecularColor:     [0.8, 0.9, 1.0],  // specular 반사 색상 (하늘빛)
    uShininess:         32.0,   // specular 선명도
    uLightDir:          [0.3, -0.5, -1.0], // 기본 조명 방향 (위에서 비스듬히)
};

//-----------------------------------------------------------------------------
// Material 생성
//-----------------------------------------------------------------------------

/**
 * 물 타일용 ShaderMaterial 생성 (ShadowLight 비활성 시)
 */
ThreeWaterShader.createStandaloneMaterial = function(texture, isWaterfall) {
    var fragShader = isWaterfall ?
        this._STANDALONE_FRAGMENT_WATERFALL :
        this._STANDALONE_FRAGMENT_WATER;
    var d = this.DEFAULT_UNIFORMS;

    var material = new THREE.ShaderMaterial({
        uniforms: {
            map:                { value: texture || null },
            uTime:              { value: d.uTime },
            uWaveAmplitude:     { value: d.uWaveAmplitude },
            uWaveFrequency:     { value: d.uWaveFrequency },
            uWaveSpeed:         { value: d.uWaveSpeed },
            uFoamColor:         { value: new THREE.Vector3(d.uFoamColor[0], d.uFoamColor[1], d.uFoamColor[2]) },
            uFoamAlpha:         { value: d.uFoamAlpha },
            uWaterAlpha:        { value: d.uWaterAlpha },
            uVertexWaveHeight:  { value: d.uVertexWaveHeight },
            uVertexWaveFreq:    { value: d.uVertexWaveFreq },
            uVertexWaveSpeed:   { value: d.uVertexWaveSpeed },
            uSpecularColor:     { value: new THREE.Vector3(d.uSpecularColor[0], d.uSpecularColor[1], d.uSpecularColor[2]) },
            uShininess:         { value: d.uShininess },
            uLightDir:          { value: new THREE.Vector3(d.uLightDir[0], d.uLightDir[1], d.uLightDir[2]) },
        },
        vertexShader: this._STANDALONE_VERTEX,
        fragmentShader: fragShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    return material;
};

/**
 * Phong material에 물 셰이더 주입 (ShadowLight 활성 시)
 */
ThreeWaterShader.applyToPhongMaterial = function(material, isWaterfall) {
    var fragMain = isWaterfall ? this.WATERFALL_FRAGMENT_MAIN : this.FRAGMENT_MAIN;
    var d = this.DEFAULT_UNIFORMS;

    material.userData.waterUniforms = {
        uTime:              { value: d.uTime },
        uWaveAmplitude:     { value: d.uWaveAmplitude },
        uWaveFrequency:     { value: d.uWaveFrequency },
        uWaveSpeed:         { value: d.uWaveSpeed },
        uFoamColor:         { value: new THREE.Vector3(d.uFoamColor[0], d.uFoamColor[1], d.uFoamColor[2]) },
        uFoamAlpha:         { value: d.uFoamAlpha },
        uWaterAlpha:        { value: d.uWaterAlpha },
        uVertexWaveHeight:  { value: d.uVertexWaveHeight },
        uVertexWaveFreq:    { value: d.uVertexWaveFreq },
        uVertexWaveSpeed:   { value: d.uVertexWaveSpeed },
    };

    material.onBeforeCompile = function(shader) {
        // Uniforms 주입
        for (var key in material.userData.waterUniforms) {
            shader.uniforms[key] = material.userData.waterUniforms[key];
        }

        // Vertex shader 수정
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            '#include <common>\n' + ThreeWaterShader.VERTEX_PARS
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n' + ThreeWaterShader.VERTEX_MAIN
        );

        // Fragment shader 수정
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            '#include <common>\n' + ThreeWaterShader.FRAGMENT_PARS
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            '#include <map_fragment>\n' + fragMain
        );
    };

    material.userData.isWaterMaterial = true;
};

/**
 * 물 메시의 uTime uniform 업데이트
 */
ThreeWaterShader.updateTime = function(mesh, time) {
    if (!mesh || !mesh.material) return;

    if (mesh.material.isShaderMaterial) {
        if (mesh.material.uniforms && mesh.material.uniforms.uTime) {
            mesh.material.uniforms.uTime.value = time;
        }
    } else if (mesh.material.userData && mesh.material.userData.waterUniforms) {
        mesh.material.userData.waterUniforms.uTime.value = time;
    }
};

/**
 * Standalone material의 조명 방향을 ShadowLight directionalLight에서 동기화
 */
ThreeWaterShader.syncLightDirection = function(mesh) {
    if (!mesh || !mesh.material || !mesh.material.isShaderMaterial) return;
    if (!mesh.material.uniforms || !mesh.material.uniforms.uLightDir) return;

    // ShadowLight의 directionalLight가 있으면 그 방향을 사용
    if (window.ShadowLight && window.ShadowLight._directionalLight) {
        var pos = window.ShadowLight._directionalLight.position;
        mesh.material.uniforms.uLightDir.value.set(pos.x, pos.y, pos.z).normalize();
    }
};

/**
 * tilemap의 모든 물 메시의 uTime uniform을 일괄 갱신
 * useThreeRenderer의 렌더 루프에서 매 프레임 호출
 */
ThreeWaterShader.updateAllWaterMeshes = function(tilemap, time) {
    if (!tilemap) return;
    this._hasWaterMesh = false;
    // ShaderTilemap → ZLayer(children) → CompositeLayer(children) → RectLayer(children)
    var zLayers = tilemap.children || [];
    for (var zi = 0; zi < zLayers.length; zi++) {
        var composites = zLayers[zi].children || [];
        for (var ci = 0; ci < composites.length; ci++) {
            var rectLayers = composites[ci].children || [];
            for (var ri = 0; ri < rectLayers.length; ri++) {
                var rl = rectLayers[ri];
                if (!rl._meshes) continue;
                for (var key in rl._meshes) {
                    var mesh = rl._meshes[key];
                    if (mesh && mesh.userData && mesh.userData.isWaterMesh) {
                        this.updateTime(mesh, time);
                        this.syncLightDirection(mesh);
                        this._hasWaterMesh = true;
                    }
                }
            }
        }
    }
};

/**
 * 물 타일 여부 확인 (animX > 0 또는 animY > 0)
 */
ThreeWaterShader.isWaterRect = function(animX, animY) {
    return (animX > 0 || animY > 0);
};

/**
 * 폭포 타일 여부 확인 (animY > 0)
 */
ThreeWaterShader.isWaterfallRect = function(animX, animY) {
    return (animY > 0);
};

window.ThreeWaterShader = ThreeWaterShader;
