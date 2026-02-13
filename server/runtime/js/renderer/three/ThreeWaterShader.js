//=============================================================================
// ThreeWaterShader.js - 물 타일 커스텀 셰이더 (wave UV 왜곡 + specular 반사)
//=============================================================================
// 물 타일(A1)에 물결 UV 왜곡, 투명도, fragment-only specular 반사 적용.
// ShadowLight 활성 시 onBeforeCompile로 Phong 셰이더에 주입,
// 비활성 시 standalone ShaderMaterial 사용.
//=============================================================================

var ThreeWaterShader = {};

// 전역 시간 (useThreeRenderer에서 매 프레임 업데이트)
ThreeWaterShader._time = 0;
// 물 메시가 존재하는지 여부 (연속 렌더 판단용)
ThreeWaterShader._hasWaterMesh = false;

//-----------------------------------------------------------------------------
// 공통 GLSL: procedural wave normal 생성 함수
//-----------------------------------------------------------------------------

ThreeWaterShader._WAVE_NORMAL_GLSL = [
    'vec3 computeWaveNormal(vec2 worldPos, float time, float freq, float speed) {',
    '    float eps = 0.5;',
    '    float fx = freq;',
    '    float fy = freq * 0.8;',
    '    float sp1 = speed;',
    '    float sp2 = speed * 0.7;',
    '',
    '    // height at current position',
    '    float h = sin(worldPos.y * fx + time * sp1)',
    '          + 0.5 * sin(worldPos.x * fy + time * sp2)',
    '          + 0.3 * sin((worldPos.x + worldPos.y) * fx * 0.6 + time * sp1 * 1.3);',
    '',
    '    // partial derivatives via finite difference',
    '    float hx = sin(worldPos.y * fx + time * sp1)',
    '           + 0.5 * sin((worldPos.x + eps) * fy + time * sp2)',
    '           + 0.3 * sin((worldPos.x + eps + worldPos.y) * fx * 0.6 + time * sp1 * 1.3);',
    '    float hy = sin((worldPos.y + eps) * fx + time * sp1)',
    '           + 0.5 * sin(worldPos.x * fy + time * sp2)',
    '           + 0.3 * sin((worldPos.x + worldPos.y + eps) * fx * 0.6 + time * sp1 * 1.3);',
    '',
    '    float dhdx = (hx - h) / eps;',
    '    float dhdy = (hy - h) / eps;',
    '',
    '    // perturb flat normal (0,0,1) by wave gradient',
    '    return normalize(vec3(-dhdx * 0.15, -dhdy * 0.15, 1.0));',
    '}',
].join('\n');

//-----------------------------------------------------------------------------
// GLSL 코드 조각 (onBeforeCompile용 - Phong material에 주입)
//-----------------------------------------------------------------------------

ThreeWaterShader.VERTEX_PARS = [
    'uniform float uTime;',
    'varying vec2 vWorldPos;',
].join('\n');

ThreeWaterShader.VERTEX_MAIN = [
    'vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);',
    'vWorldPos = worldPos4.xy;',
].join('\n');

ThreeWaterShader.FRAGMENT_PARS = [
    'uniform float uTime;',
    'uniform float uWaveAmplitude;',
    'uniform float uWaveFrequency;',
    'uniform float uWaveSpeed;',
    'uniform float uWaterAlpha;',
    'uniform float uSpecularStrength;',
    'varying vec2 vWorldPos;',
    '',
    'vec2 waterWaveUV(vec2 uv, vec2 worldPos, float time) {',
    '    float waveX = sin(worldPos.y * uWaveFrequency + time * uWaveSpeed) * uWaveAmplitude;',
    '    float waveY = cos(worldPos.x * uWaveFrequency * 0.8 + time * uWaveSpeed * 0.7) * uWaveAmplitude * 0.6;',
    '    return uv + vec2(waveX, waveY);',
    '}',
    '',
    ThreeWaterShader._WAVE_NORMAL_GLSL,
].join('\n');

// 물 타일용 fragment 로직 (#include <map_fragment> 뒤에 삽입)
ThreeWaterShader.FRAGMENT_MAIN = [
    '{',
    '    vec2 waveUV = waterWaveUV(vUv, vWorldPos, uTime);',
    '    vec4 waveTexColor = texture2D(map, waveUV);',
    '    diffuseColor = waveTexColor;',
    '}',
    'diffuseColor.a *= uWaterAlpha;',
].join('\n');

// normal 수정 (#include <normal_fragment_maps> 뒤에 삽입)
ThreeWaterShader.NORMAL_OVERRIDE = [
    '{',
    '    vec3 waveN = computeWaveNormal(vWorldPos, uTime, uWaveFrequency, uWaveSpeed);',
    '    // Phong에서 normal은 view space → wave normal도 view space로 변환',
    '    normal = normalize(normalMatrix * waveN);',
    '}',
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
    'diffuseColor.a *= min(uWaterAlpha + 0.1, 1.0);',
].join('\n');

// 폭포 normal 수정 (미세 변동)
ThreeWaterShader.WATERFALL_NORMAL_OVERRIDE = [
    '{',
    '    vec3 wfN = computeWaveNormal(vWorldPos, uTime, 6.0, 3.0);',
    '    normal = normalize(normalMatrix * wfN);',
    '}',
].join('\n');

//-----------------------------------------------------------------------------
// Standalone ShaderMaterial (ShadowLight 비활성 시)
//-----------------------------------------------------------------------------

ThreeWaterShader._STANDALONE_VERTEX = [
    'varying vec2 vUv;',
    'varying vec2 vWorldPos;',
    'varying vec3 vViewDir;',
    'uniform float uTime;',
    '',
    'void main() {',
    '    vUv = uv;',
    '    vec4 worldPos4 = modelMatrix * vec4(position, 1.0);',
    '    vWorldPos = worldPos4.xy;',
    '    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
    '    vViewDir = normalize(-mvPos.xyz);',
    '    gl_Position = projectionMatrix * mvPos;',
    '}',
].join('\n');

ThreeWaterShader._STANDALONE_FRAGMENT_WATER = [
    'uniform sampler2D map;',
    'uniform float uTime;',
    'uniform float uWaveAmplitude;',
    'uniform float uWaveFrequency;',
    'uniform float uWaveSpeed;',
    'uniform float uWaterAlpha;',
    'uniform float uSpecularStrength;',
    'uniform float uShininess;',
    'uniform vec3 uSpecularColor;',
    'uniform vec3 uLightDir;',
    'varying vec2 vUv;',
    'varying vec2 vWorldPos;',
    'varying vec3 vViewDir;',
    '',
    'vec2 waterWaveUV(vec2 uv, vec2 worldPos, float time) {',
    '    float waveX = sin(worldPos.y * uWaveFrequency + time * uWaveSpeed) * uWaveAmplitude;',
    '    float waveY = cos(worldPos.x * uWaveFrequency * 0.8 + time * uWaveSpeed * 0.7) * uWaveAmplitude * 0.6;',
    '    return uv + vec2(waveX, waveY);',
    '}',
    '',
    ThreeWaterShader._WAVE_NORMAL_GLSL,
    '',
    'void main() {',
    '    vec2 waveUV = waterWaveUV(vUv, vWorldPos, uTime);',
    '    vec4 color = texture2D(map, waveUV);',
    '    color.a *= uWaterAlpha;',
    '    if (color.a < 0.01) discard;',
    '',
    '    // Fragment-only specular: Blinn-Phong',
    '    vec3 waveN = computeWaveNormal(vWorldPos, uTime, uWaveFrequency, uWaveSpeed);',
    '    // world→view normal (normalMatrix는 없으므로 직접 계산)',
    '    vec3 N = normalize(waveN);',
    '    vec3 L = normalize(uLightDir);',
    '    vec3 V = normalize(vViewDir);',
    '    vec3 H = normalize(L + V);',
    '    float spec = pow(max(dot(N, H), 0.0), uShininess);',
    '    color.rgb += uSpecularColor * spec * uSpecularStrength;',
    '',
    '    gl_FragColor = color;',
    '}',
].join('\n');

ThreeWaterShader._STANDALONE_FRAGMENT_WATERFALL = [
    'uniform sampler2D map;',
    'uniform float uTime;',
    'uniform float uWaterAlpha;',
    'uniform float uSpecularStrength;',
    'uniform float uShininess;',
    'uniform vec3 uSpecularColor;',
    'uniform vec3 uLightDir;',
    'varying vec2 vUv;',
    'varying vec2 vWorldPos;',
    'varying vec3 vViewDir;',
    '',
    ThreeWaterShader._WAVE_NORMAL_GLSL,
    '',
    'void main() {',
    '    float wfWaveX = sin(vWorldPos.y * 6.0 + uTime * 3.0) * 0.004;',
    '    float wfWaveY = cos(vWorldPos.x * 3.0 + uTime * 2.5) * 0.003;',
    '    vec2 wfUV = vUv + vec2(wfWaveX, wfWaveY);',
    '    vec4 color = texture2D(map, wfUV);',
    '    color.a *= min(uWaterAlpha + 0.1, 1.0);',
    '    if (color.a < 0.01) discard;',
    '',
    '    // Waterfall specular (softer)',
    '    vec3 wfN = computeWaveNormal(vWorldPos, uTime, 6.0, 3.0);',
    '    vec3 N = normalize(wfN);',
    '    vec3 L = normalize(uLightDir);',
    '    vec3 V = normalize(vViewDir);',
    '    vec3 H = normalize(L + V);',
    '    float spec = pow(max(dot(N, H), 0.0), uShininess);',
    '    color.rgb += uSpecularColor * spec * uSpecularStrength * 0.5;',
    '',
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
    uWaterAlpha:        0.85,
    uSpecularStrength:  0.8,
    uShininess:         64.0,
    uSpecularColor:     [1.0, 1.0, 1.0],
    uLightDir:          [0.0, 0.0, 1.0],
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
            uWaterAlpha:        { value: d.uWaterAlpha },
            uSpecularStrength:  { value: d.uSpecularStrength },
            uShininess:         { value: d.uShininess },
            uSpecularColor:     { value: new THREE.Vector3(d.uSpecularColor[0], d.uSpecularColor[1], d.uSpecularColor[2]) },
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
    var normalOverride = isWaterfall ? this.WATERFALL_NORMAL_OVERRIDE : this.NORMAL_OVERRIDE;
    var d = this.DEFAULT_UNIFORMS;

    material.userData.waterUniforms = {
        uTime:              { value: d.uTime },
        uWaveAmplitude:     { value: d.uWaveAmplitude },
        uWaveFrequency:     { value: d.uWaveFrequency },
        uWaveSpeed:         { value: d.uWaveSpeed },
        uWaterAlpha:        { value: d.uWaterAlpha },
        uSpecularStrength:  { value: d.uSpecularStrength },
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
        // Wave normal 주입 → Phong specular가 이 normal을 자동으로 사용
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normal_fragment_maps>',
            '#include <normal_fragment_maps>\n' + normalOverride
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
                        this._hasWaterMesh = true;
                    }
                }
            }
        }
    }
};

/**
 * Standalone 물 메시의 lightDir uniform을 ShadowLight의 directionalLight에서 동기화
 */
ThreeWaterShader.syncLightDirection = function(tilemap) {
    if (!tilemap) return;
    var dirLight = null;
    if (window.ShadowLight && window.ShadowLight._directionalLight) {
        dirLight = window.ShadowLight._directionalLight;
    }
    // ShadowLight 없으면 기본 light direction 사용 (위에서 비추는 방향)
    var lx = 0, ly = 0, lz = 1;
    if (dirLight) {
        // directionalLight.position → light direction
        var pos = dirLight.position;
        var len = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        if (len > 0) {
            lx = pos.x / len;
            ly = pos.y / len;
            lz = pos.z / len;
        }
    }

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
                    if (mesh && mesh.userData && mesh.userData.isWaterMesh &&
                        mesh.material && mesh.material.isShaderMaterial &&
                        mesh.material.uniforms && mesh.material.uniforms.uLightDir) {
                        mesh.material.uniforms.uLightDir.value.set(lx, ly, lz);
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
