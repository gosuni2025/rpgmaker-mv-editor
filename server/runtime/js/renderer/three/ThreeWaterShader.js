//=============================================================================
// ThreeWaterShader.js - 물 타일 커스텀 셰이더 (wave + foam + 투명도)
//=============================================================================
// 물 타일(A1)에 물결 UV 왜곡, 해안선 거품, 물 아래 투명 효과 적용.
// ShadowLight 활성 시 onBeforeCompile로 Phong 셰이더에 주입,
// 비활성 시 standalone ShaderMaterial 사용.
//=============================================================================

var ThreeWaterShader = {};

// 전역 시간 (useThreeRenderer에서 매 프레임 업데이트)
ThreeWaterShader._time = 0;
// 물 메시가 존재하는지 여부 (연속 렌더 판단용)
ThreeWaterShader._hasWaterMesh = false;

//-----------------------------------------------------------------------------
// GLSL 코드 조각 (onBeforeCompile용 - Phong material에 주입)
//-----------------------------------------------------------------------------

// Vertex shader에 추가할 declarations
ThreeWaterShader.VERTEX_PARS = [
    'attribute float aFoamMask;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
].join('\n');

// Vertex shader main에 추가할 코드
ThreeWaterShader.VERTEX_MAIN = [
    'vFoamMask = aFoamMask;',
    'vWorldPos = (modelMatrix * vec4(position, 1.0)).xy;',
].join('\n');

// Fragment shader에 추가할 declarations
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
    'if (vFoamMask > 0.5) {',
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
    'if (vFoamMask > 0.5) {',
    '    float splash = sin(vWorldPos.y * 0.2 + uTime * 4.0) * 0.5 + 0.5;',
    '    splash *= cos(vWorldPos.x * 0.3 + uTime * 2.0) * 0.5 + 0.5;',
    '    splash = smoothstep(0.3, 0.7, splash);',
    '    diffuseColor.rgb = mix(diffuseColor.rgb, uFoamColor, splash * uFoamAlpha * 0.6);',
    '}',
    'diffuseColor.a *= min(uWaterAlpha + 0.1, 1.0);',
].join('\n');

//-----------------------------------------------------------------------------
// Standalone ShaderMaterial (ShadowLight 비활성 시)
//-----------------------------------------------------------------------------

ThreeWaterShader._STANDALONE_VERTEX = [
    'attribute float aFoamMask;',
    'varying vec2 vUv;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
    '',
    'void main() {',
    '    vUv = uv;',
    '    vFoamMask = aFoamMask;',
    '    vWorldPos = (modelMatrix * vec4(position, 1.0)).xy;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
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
    'varying vec2 vUv;',
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
    '',
    'void main() {',
    '    vec2 waveUV = waterWaveUV(vUv, vWorldPos, uTime);',
    '    vec4 color = texture2D(map, waveUV);',
    '    if (vFoamMask > 0.5) {',
    '        float foam = foamPattern(vWorldPos, uTime);',
    '        color.rgb = mix(color.rgb, uFoamColor, foam * uFoamAlpha * vFoamMask);',
    '    }',
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
    'varying vec2 vUv;',
    'varying float vFoamMask;',
    'varying vec2 vWorldPos;',
    '',
    'void main() {',
    '    float wfWaveX = sin(vWorldPos.y * 6.0 + uTime * 3.0) * 0.004;',
    '    float wfWaveY = cos(vWorldPos.x * 3.0 + uTime * 2.5) * 0.003;',
    '    vec2 wfUV = vUv + vec2(wfWaveX, wfWaveY);',
    '    vec4 color = texture2D(map, wfUV);',
    '    if (vFoamMask > 0.5) {',
    '        float splash = sin(vWorldPos.y * 0.2 + uTime * 4.0) * 0.5 + 0.5;',
    '        splash *= cos(vWorldPos.x * 0.3 + uTime * 2.0) * 0.5 + 0.5;',
    '        splash = smoothstep(0.3, 0.7, splash);',
    '        color.rgb = mix(color.rgb, uFoamColor, splash * uFoamAlpha * 0.6);',
    '    }',
    '    color.a *= min(uWaterAlpha + 0.1, 1.0);',
    '    if (color.a < 0.01) discard;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

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

    var material = new THREE.ShaderMaterial({
        uniforms: {
            map:             { value: texture || null },
            uTime:           { value: 0.0 },
            uWaveAmplitude:  { value: 0.006 },
            uWaveFrequency:  { value: 4.0 },
            uWaveSpeed:      { value: 2.0 },
            uFoamColor:      { value: new THREE.Vector3(1.0, 1.0, 1.0) },
            uFoamAlpha:      { value: 0.35 },
            uWaterAlpha:     { value: 0.85 },
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

    material.userData.waterUniforms = {
        uTime:           { value: 0.0 },
        uWaveAmplitude:  { value: 0.006 },
        uWaveFrequency:  { value: 4.0 },
        uWaveSpeed:      { value: 2.0 },
        uFoamColor:      { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uFoamAlpha:      { value: 0.35 },
        uWaterAlpha:     { value: 0.85 },
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
