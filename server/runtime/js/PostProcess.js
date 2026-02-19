//=============================================================================
// PostProcess.js - 포스트 프로세싱 파이프라인 (Bloom, DoF, PP Effects)
//=============================================================================
// 포스트 프로세싱 전체를 관리합니다:
// - SimpleEffectComposer: 커스텀 이펙트 컴포저 (ping-pong 렌더 타겟)
// - BloomPass: 밝은 부분 추출 → 가우시안 블러 → 원본 합성 (2D/3D emissive 지원)
// - TiltShiftPass: 화면 Y좌표 기반 Tilt-Shift DoF (피사계 심도)
// - MapRenderPass / UIRenderPass: 3D 맵/UI 분리 렌더링
// - Simple2DRenderPass / CopyToScreenPass: 2D 모드 렌더링
// - PostProcessEffects 패스 관리 및 맵별 설정 로드
// - 개발 모드 Debug UI
//
// 의존: THREE (global), Mode3D, ConfigManager, Graphics, Spriteset_Map
// 선택적 의존: PostProcessEffects.js, Scene_Map (런타임 게임 플레이어)
//=============================================================================

(function() {

//=============================================================================
// ConfigManager - DoF 설정 추가
//=============================================================================

ConfigManager.depthOfField = false;

var _ConfigManager_makeData = ConfigManager.makeData;
ConfigManager.makeData = function() {
    var config = _ConfigManager_makeData.call(this);
    config.depthOfField = this.depthOfField;
    return config;
};

var _ConfigManager_applyData = ConfigManager.applyData;
ConfigManager.applyData = function(config) {
    _ConfigManager_applyData.call(this, config);
    this.depthOfField = this.readFlag(config, 'depthOfField');
};

//=============================================================================
// PostProcess 시스템 관리
//=============================================================================

var PostProcess = {};
PostProcess._active = false;
PostProcess._composer = null;
PostProcess._tiltShiftPass = null;
PostProcess._debugSection = null;

window.PostProcess = PostProcess;
window.ShaderPass = ShaderPass;
window.FullScreenQuad = FullScreenQuad;
window.MapRenderPass = MapRenderPass;
window.Simple2DRenderPass = Simple2DRenderPass;

PostProcess.config = {
    focusY: 0.55,       // 포커스 중심 Y위치 (0=상단, 1=하단), 캐릭터 약간 아래
    focusRange: 0.1,    // 선명 영역 반폭
    maxblur: 0.05,      // 최대 블러
    blurPower: 1.5      // 블러 증가 커브 (1=선형, 2=이차, 부드러운 전환)
};

PostProcess.bloomConfig = {
    threshold: 0.5,     // 밝기 추출 임계값 (0~1, 낮을수록 더 많은 부분이 bloom)
    strength: 0.8,      // bloom 합성 강도 (0~2)
    radius: 1.0,        // 블러 반경 배율
    downscale: 4        // 블러 텍스처 축소 비율 (높을수록 넓게 번지고 가벼움)
};

//=============================================================================
// Tilt-Shift Shader (화면 Y좌표 기반 DoF)
//=============================================================================

var TiltShiftShader = {
    uniforms: {
        tColor:     { value: null },
        focusY:     { value: 0.55 },   // 포커스 중심 (0=상단, 1=하단), 캐릭터 위치
        focusRange: { value: 0.15 },   // 선명한 영역의 반폭 (UV 단위)
        maxblur:    { value: 0.01 },   // 최대 블러 강도
        blurPower:  { value: 2.0 },    // 블러 증가 커브 (1=선형, 2=이차)
        aspect:     { value: 1.0 }
    },
    vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '    vUv = uv;',
        '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ].join('\n'),
    fragmentShader: [
        'varying vec2 vUv;',
        '',
        'uniform sampler2D tColor;',
        'uniform float focusY;',
        'uniform float focusRange;',
        'uniform float maxblur;',
        'uniform float blurPower;',
        'uniform float aspect;',
        '',
        'void main() {',
        '    vec2 aspectCorrect = vec2(1.0, aspect);',
        '',
        '    // 화면 Y좌표에서 포커스 중심까지의 거리로 블러량 결정',
        '    float dist = abs(vUv.y - focusY);',
        '    float t = max(0.0, dist - focusRange) / (1.0 - focusRange);',
        '    float blur = maxblur * pow(clamp(t, 0.0, 1.0), blurPower);',
        '',
        '    vec2 dofblur = vec2(blur);',
        '    vec2 dofblur9 = dofblur * 0.9;',
        '    vec2 dofblur7 = dofblur * 0.7;',
        '    vec2 dofblur4 = dofblur * 0.4;',
        '',
        '    vec4 col = vec4(0.0);',
        '',
        '    col += texture2D(tColor, vUv);',
        '    col += texture2D(tColor, vUv + (vec2( 0.0,   0.4 ) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.15,  0.37) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.29,  0.29) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2(-0.37,  0.15) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.40,  0.0 ) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.37, -0.15) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.29, -0.29) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2(-0.15, -0.37) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.0,  -0.4 ) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2(-0.15,  0.37) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2(-0.29,  0.29) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.37,  0.15) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2(-0.4,   0.0 ) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2(-0.37, -0.15) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2(-0.29, -0.29) * aspectCorrect) * dofblur);',
        '    col += texture2D(tColor, vUv + (vec2( 0.15, -0.37) * aspectCorrect) * dofblur);',
        '',
        '    col += texture2D(tColor, vUv + (vec2( 0.15,  0.37) * aspectCorrect) * dofblur9);',
        '    col += texture2D(tColor, vUv + (vec2(-0.37,  0.15) * aspectCorrect) * dofblur9);',
        '    col += texture2D(tColor, vUv + (vec2( 0.37, -0.15) * aspectCorrect) * dofblur9);',
        '    col += texture2D(tColor, vUv + (vec2(-0.15, -0.37) * aspectCorrect) * dofblur9);',
        '    col += texture2D(tColor, vUv + (vec2(-0.15,  0.37) * aspectCorrect) * dofblur9);',
        '    col += texture2D(tColor, vUv + (vec2( 0.37,  0.15) * aspectCorrect) * dofblur9);',
        '    col += texture2D(tColor, vUv + (vec2(-0.37, -0.15) * aspectCorrect) * dofblur9);',
        '    col += texture2D(tColor, vUv + (vec2( 0.15, -0.37) * aspectCorrect) * dofblur9);',
        '',
        '    col += texture2D(tColor, vUv + (vec2( 0.29,  0.29) * aspectCorrect) * dofblur7);',
        '    col += texture2D(tColor, vUv + (vec2( 0.40,  0.0 ) * aspectCorrect) * dofblur7);',
        '    col += texture2D(tColor, vUv + (vec2( 0.29, -0.29) * aspectCorrect) * dofblur7);',
        '    col += texture2D(tColor, vUv + (vec2( 0.0,  -0.4 ) * aspectCorrect) * dofblur7);',
        '    col += texture2D(tColor, vUv + (vec2(-0.29,  0.29) * aspectCorrect) * dofblur7);',
        '    col += texture2D(tColor, vUv + (vec2(-0.4,   0.0 ) * aspectCorrect) * dofblur7);',
        '    col += texture2D(tColor, vUv + (vec2(-0.29, -0.29) * aspectCorrect) * dofblur7);',
        '    col += texture2D(tColor, vUv + (vec2( 0.0,   0.4 ) * aspectCorrect) * dofblur7);',
        '',
        '    col += texture2D(tColor, vUv + (vec2( 0.29,  0.29) * aspectCorrect) * dofblur4);',
        '    col += texture2D(tColor, vUv + (vec2( 0.4,   0.0 ) * aspectCorrect) * dofblur4);',
        '    col += texture2D(tColor, vUv + (vec2( 0.29, -0.29) * aspectCorrect) * dofblur4);',
        '    col += texture2D(tColor, vUv + (vec2( 0.0,  -0.4 ) * aspectCorrect) * dofblur4);',
        '    col += texture2D(tColor, vUv + (vec2(-0.29,  0.29) * aspectCorrect) * dofblur4);',
        '    col += texture2D(tColor, vUv + (vec2(-0.4,   0.0 ) * aspectCorrect) * dofblur4);',
        '    col += texture2D(tColor, vUv + (vec2(-0.29, -0.29) * aspectCorrect) * dofblur4);',
        '    col += texture2D(tColor, vUv + (vec2( 0.0,   0.4 ) * aspectCorrect) * dofblur4);',
        '',
        '    gl_FragColor = col / 41.0;',
        '    gl_FragColor.a = 1.0;',
        '}'
    ].join('\n')
};

//=============================================================================
// 내장 EffectComposer (Three.js examples 기반, 간소화)
//=============================================================================

function FullScreenQuad(material) {
    var geometry = new THREE.PlaneGeometry(2, 2);
    this._mesh = new THREE.Mesh(geometry, material);
    this._scene = new THREE.Scene();
    this._scene.add(this._mesh);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}

FullScreenQuad.prototype.render = function(renderer) {
    renderer.render(this._scene, this._camera);
};

FullScreenQuad.prototype.dispose = function() {
    this._mesh.geometry.dispose();
};

Object.defineProperty(FullScreenQuad.prototype, 'material', {
    get: function() { return this._mesh.material; },
    set: function(v) { this._mesh.material = v; }
});

// --- ShaderPass ---
function ShaderPass(shader) {
    this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    this.material = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.enabled = true;
    this.renderToScreen = false;
}

ShaderPass.prototype.setSize = function(/* width, height */) {};

ShaderPass.prototype.render = function(renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */) {
    if (this.uniforms.tColor) this.uniforms.tColor.value = readBuffer.texture;
    if (this.renderToScreen) {
        renderer.setRenderTarget(null);
    } else {
        renderer.setRenderTarget(writeBuffer);
        renderer.clear();
    }
    this.fsQuad.render(renderer);
};

ShaderPass.prototype.dispose = function() {
    this.material.dispose();
    this.fsQuad.dispose();
};

// --- SimpleEffectComposer ---
function SimpleEffectComposer(renderer, renderTarget) {
    this.renderer = renderer;
    var size = renderer.getSize(new THREE.Vector2());
    this._pixelRatio = renderer.getPixelRatio();
    var w = size.x;
    var h = size.y;

    if (renderTarget === undefined) {
        var parameters = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        };
        renderTarget = new THREE.WebGLRenderTarget(w * this._pixelRatio, h * this._pixelRatio, parameters);
        renderTarget.texture.name = 'EffectComposer.rt1';
    }

    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = 'EffectComposer.rt2';

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;

    this.passes = [];
}

SimpleEffectComposer.prototype.addPass = function(pass) {
    this.passes.push(pass);
};

SimpleEffectComposer.prototype.setSize = function(width, height) {
    this.renderTarget1.setSize(width, height);
    this.renderTarget2.setSize(width, height);
    for (var i = 0; i < this.passes.length; i++) {
        this.passes[i].setSize(width, height);
    }
};

SimpleEffectComposer.prototype.swapBuffers = function() {
    var tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
};

SimpleEffectComposer.prototype.render = function(deltaTime) {
    var maskActive = false;
    for (var i = 0; i < this.passes.length; i++) {
        var pass = this.passes[i];
        if (!pass.enabled) continue;
        pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);
        if (pass.needsSwap !== false) {
            this.swapBuffers();
        }
    }
};

SimpleEffectComposer.prototype.dispose = function() {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    for (var i = 0; i < this.passes.length; i++) {
        if (this.passes[i].dispose) this.passes[i].dispose();
    }
};

// --- RenderPass (맵만 PerspectiveCamera로 렌더) ---
function MapRenderPass(scene, camera, perspCamera, spriteset, stage) {
    this.scene = scene;
    this.camera = camera;
    this.perspCamera = perspCamera;
    this.spriteset = spriteset;
    this.stage = stage;
    this.enabled = true;
    this.needsSwap = true;
    this.clear = true;
}

MapRenderPass.prototype.setSize = function() {};

MapRenderPass.prototype.render = function(renderer, writeBuffer /*, readBuffer, deltaTime, maskActive */) {
    renderer.setRenderTarget(writeBuffer);
    if (this.clear) renderer.clear();

    var scene = this.scene;
    var stageObj = this.stage ? this.stage._threeObj : null;

    // Find parallax sky mesh
    var skyMesh = null;
    for (var si = 0; si < scene.children.length; si++) {
        if (scene.children[si]._isParallaxSky) {
            skyMesh = scene.children[si];
            break;
        }
    }

    // Pass 0: Sky (PerspectiveCamera)
    if (skyMesh) {
        // 렌더 직전에 sky mesh 위치를 카메라에 동기화 (update 타이밍 차이로 인한 떨림 방지)
        var cam = this.perspCamera;
        if (skyMesh._isSkyMeshSphere) {
            // 구체형 sky: 카메라가 구 내부에 위치하도록 중심을 카메라에 맞춤
            skyMesh.position.copy(cam.position);
        } else {
            // 평면형 sky: far plane 앞에 배치
            var skyDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
            var skyFarDist = cam.far * 0.8;
            skyMesh.position.copy(cam.position).addScaledVector(skyDir, skyFarDist);
            skyMesh.quaternion.copy(cam.quaternion);
        }

        if (stageObj) stageObj.visible = false;
        skyMesh.visible = true;
        renderer.autoClear = true;
        renderer.render(scene, this.perspCamera);
        skyMesh.visible = false;
        if (stageObj) stageObj.visible = true;
    }

    // Shadow Map: Pass 1에서만 갱신 (Sky/UI pass에서 비는 것 방지)
    // composer 전체가 autoUpdate=false로 실행되므로 여기서 needsUpdate 설정
    renderer.shadowMap.needsUpdate = true;

    // Pass 1: PerspectiveCamera - 맵(Spriteset_Map)만
    // FOW 메쉬를 숨김 — bloom/postprocess 전에 렌더되면 탐험영역의 bloom이 약해짐
    // UIRenderPass에서 FOW를 최종 합성함
    var fowGroup = null, fowGroupWasVisible = false;
    for (var fi = 0; fi < scene.children.length; fi++) {
        if (scene.children[fi]._isFogOfWar) {
            fowGroup = scene.children[fi];
            fowGroupWasVisible = fowGroup.visible;
            fowGroup.visible = false;
            break;
        }
    }

    // Picture는 Pass 1에서 숨기고 UIRenderPass(2D)에서 렌더
    var picContainer = this.spriteset._pictureContainer;
    var picObj = picContainer && picContainer._threeObj;
    var picWasVisible = picObj ? picObj.visible : false;
    if (picObj) picObj.visible = false;
    // ScreenSprite(fade/flash)는 Pass 1에서 숨기고 UIRenderPass에서 별도 렌더
    var fadeSprite = this.spriteset._fadeSprite;
    var fadeObj = fadeSprite && fadeSprite._threeObj;
    var fadeWasVisible = fadeObj ? fadeObj.visible : false;
    if (fadeObj) fadeObj.visible = false;
    var flashSprite = this.spriteset._flashSprite;
    var flashObj = flashSprite && flashSprite._threeObj;
    var flashWasVisible = flashObj ? flashObj.visible : false;
    if (flashObj) flashObj.visible = false;
    // 날씨도 Pass 1에서 숨기고 UIRenderPass에서 렌더
    var weatherSprite = this.spriteset._weather;
    var weatherObj = weatherSprite && weatherSprite._threeObj;
    var weatherWasVisible = weatherObj ? weatherObj.visible : false;
    if (weatherObj) weatherObj.visible = false;
    // 애니메이션 스프라이트를 Pass 1에서 숨김 (UIRenderPass에서 2D HUD로 렌더)
    var animInfo = Mode3D._hideAnimationsForPass1();
    // MapRenderPass에서 수집한 animInfo를 UIRenderPass에서 사용하기 위해 저장
    this._animInfo = animInfo;

    var blackScreenObj = this.spriteset._blackScreen &&
                         this.spriteset._blackScreen._threeObj;
    var blackScreenWasVisible = blackScreenObj ? blackScreenObj.visible : false;
    if (skyMesh && blackScreenObj) {
        blackScreenObj.visible = false;
    }

    var childVisibility = [];
    if (stageObj) {
        for (var i = 0; i < stageObj.children.length; i++) {
            childVisibility.push(stageObj.children[i].visible);
        }
        var spritesetObj = this.spriteset._threeObj;
        for (var i = 0; i < stageObj.children.length; i++) {
            stageObj.children[i].visible = (stageObj.children[i] === spritesetObj);
        }
    }

    renderer.autoClear = !skyMesh;
    renderer.render(scene, this.perspCamera);

    if (blackScreenObj) {
        blackScreenObj.visible = blackScreenWasVisible;
    }
    // FOW 가시성 복원
    if (fowGroup) fowGroup.visible = fowGroupWasVisible;
    // Picture 가시성 복원
    if (picObj) picObj.visible = picWasVisible;
    // fade/flash/weather 가시성 복원
    if (fadeObj) fadeObj.visible = fadeWasVisible;
    if (flashObj) flashObj.visible = flashWasVisible;
    if (weatherObj) weatherObj.visible = weatherWasVisible;

    // 가시성 복원 (UI는 UIRenderPass에서 별도 렌더)
    if (stageObj) {
        for (var i = 0; i < stageObj.children.length; i++) {
            stageObj.children[i].visible = childVisibility[i];
        }
    }
    renderer.autoClear = true;

    // fade/flash/weather info를 UIRenderPass에 전달
    this._fadeInfo = { fadeObj: fadeObj, fadeWasVisible: fadeWasVisible, fadeSprite: fadeSprite,
                       flashObj: flashObj, flashWasVisible: flashWasVisible, flashSprite: flashSprite,
                       weatherObj: weatherObj, weatherWasVisible: weatherWasVisible, weatherSprite: weatherSprite };
};

MapRenderPass.prototype.dispose = function() {};

// --- TiltShiftPass (화면 Y좌표 기반 DoF) ---
function TiltShiftPass(params) {
    this.enabled = true;
    this.needsSwap = true;
    this.renderToScreen = false;

    this.uniforms = THREE.UniformsUtils.clone(TiltShiftShader.uniforms);
    if (params) {
        if (params.focusY !== undefined) this.uniforms.focusY.value = params.focusY;
        if (params.focusRange !== undefined) this.uniforms.focusRange.value = params.focusRange;
        if (params.maxblur !== undefined) this.uniforms.maxblur.value = params.maxblur;
        if (params.blurPower !== undefined) this.uniforms.blurPower.value = params.blurPower;
    }

    this.material = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: TiltShiftShader.vertexShader,
        fragmentShader: TiltShiftShader.fragmentShader
    });

    this.fsQuad = new FullScreenQuad(this.material);
}

TiltShiftPass.prototype.setSize = function(/* width, height */) {};

TiltShiftPass.prototype.render = function(renderer, writeBuffer, readBuffer) {
    this.uniforms.tColor.value = readBuffer.texture;

    if (this.renderToScreen) {
        renderer.setRenderTarget(null);
    } else {
        renderer.setRenderTarget(writeBuffer);
        renderer.clear();
    }
    this.fsQuad.render(renderer);
};

TiltShiftPass.prototype.dispose = function() {
    this.material.dispose();
    this.fsQuad.dispose();
};

// --- BloomPass (밝은 부분 추출 → 가우시안 블러 → 원본 합성) ---
var BloomShader = {
    // 밝기 추출 셰이더 (emissive 텍스처를 추가 입력으로 받아 블룸에 기여)
    brightnessExtract: {
        uniforms: {
            tColor:    { value: null },
            tEmissive: { value: null },
            threshold: { value: 0.7 }
        },
        vertexShader: [
            'varying vec2 vUv;',
            'void main() {',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform sampler2D tColor;',
            'uniform sampler2D tEmissive;',
            'uniform float threshold;',
            'varying vec2 vUv;',
            'void main() {',
            '    vec4 color = texture2D(tColor, vUv);',
            '    vec4 emis = texture2D(tEmissive, vUv);',
            '    float emissiveBias = dot(emis.rgb, vec3(0.299, 0.587, 0.114));',
            '    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114)) + emissiveBias;',
            '    float soft = clamp(brightness - threshold + 0.5, 0.0, 1.0);',
            '    soft = soft * soft * (3.0 - 2.0 * soft);',  // smoothstep-like
            '    float contrib = max(0.0, brightness - threshold) * soft;',
            '    gl_FragColor = vec4(color.rgb * contrib, 1.0);',
            '}'
        ].join('\n')
    },
    // 가우시안 블러 셰이더 (1D, 방향 지정)
    gaussianBlur: {
        uniforms: {
            tColor:    { value: null },
            direction: { value: new THREE.Vector2(1.0, 0.0) },
            resolution: { value: new THREE.Vector2(512, 512) }
        },
        vertexShader: [
            'varying vec2 vUv;',
            'void main() {',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform sampler2D tColor;',
            'uniform vec2 direction;',
            'uniform vec2 resolution;',
            'varying vec2 vUv;',
            'void main() {',
            '    vec2 off1 = vec2(1.411764705882353) * direction / resolution;',
            '    vec2 off2 = vec2(3.2941176470588234) * direction / resolution;',
            '    vec2 off3 = vec2(5.176470588235294) * direction / resolution;',
            '    vec4 color = texture2D(tColor, vUv) * 0.1964825501511404;',
            '    color += texture2D(tColor, vUv + off1) * 0.2969069646728344;',
            '    color += texture2D(tColor, vUv - off1) * 0.2969069646728344;',
            '    color += texture2D(tColor, vUv + off2) * 0.09447039785044732;',
            '    color += texture2D(tColor, vUv - off2) * 0.09447039785044732;',
            '    color += texture2D(tColor, vUv + off3) * 0.010381362401148057;',
            '    color += texture2D(tColor, vUv - off3) * 0.010381362401148057;',
            '    gl_FragColor = color;',
            '}'
        ].join('\n')
    },
    // 합성 셰이더 (원본 + bloom)
    composite: {
        uniforms: {
            tColor:    { value: null },
            tBloom:    { value: null },
            strength:  { value: 0.5 }
        },
        vertexShader: [
            'varying vec2 vUv;',
            'void main() {',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform sampler2D tColor;',
            'uniform sampler2D tBloom;',
            'uniform float strength;',
            'varying vec2 vUv;',
            'void main() {',
            '    vec4 original = texture2D(tColor, vUv);',
            '    vec4 bloom = texture2D(tBloom, vUv);',
            '    gl_FragColor = original + bloom * strength;',
            '    gl_FragColor.a = original.a;',
            '}'
        ].join('\n')
    }
};

function BloomPass(params) {
    this.enabled = true;
    this.needsSwap = true;
    this.renderToScreen = false;

    params = params || {};
    this._threshold = params.threshold !== undefined ? params.threshold : 0.7;
    this._strength = params.strength !== undefined ? params.strength : 0.5;
    this._radius = params.radius !== undefined ? params.radius : 1.0;
    this._downscale = params.downscale !== undefined ? params.downscale : 4;

    // 밝기 추출 material
    this._extractUniforms = THREE.UniformsUtils.clone(BloomShader.brightnessExtract.uniforms);
    this._extractUniforms.threshold.value = this._threshold;
    this._extractMaterial = new THREE.ShaderMaterial({
        uniforms: this._extractUniforms,
        vertexShader: BloomShader.brightnessExtract.vertexShader,
        fragmentShader: BloomShader.brightnessExtract.fragmentShader
    });

    // 블러 materials (수평/수직)
    this._blurHUniforms = THREE.UniformsUtils.clone(BloomShader.gaussianBlur.uniforms);
    this._blurHUniforms.direction.value.set(this._radius, 0.0);
    this._blurHMaterial = new THREE.ShaderMaterial({
        uniforms: this._blurHUniforms,
        vertexShader: BloomShader.gaussianBlur.vertexShader,
        fragmentShader: BloomShader.gaussianBlur.fragmentShader
    });

    this._blurVUniforms = THREE.UniformsUtils.clone(BloomShader.gaussianBlur.uniforms);
    this._blurVUniforms.direction.value.set(0.0, this._radius);
    this._blurVMaterial = new THREE.ShaderMaterial({
        uniforms: this._blurVUniforms,
        vertexShader: BloomShader.gaussianBlur.vertexShader,
        fragmentShader: BloomShader.gaussianBlur.fragmentShader
    });

    // 합성 material
    this._compositeUniforms = THREE.UniformsUtils.clone(BloomShader.composite.uniforms);
    this._compositeUniforms.strength.value = this._strength;
    this._compositeMaterial = new THREE.ShaderMaterial({
        uniforms: this._compositeUniforms,
        vertexShader: BloomShader.composite.vertexShader,
        fragmentShader: BloomShader.composite.fragmentShader
    });

    this._fsQuad = new FullScreenQuad(null);

    // 축소 렌더 타겟 (setSize에서 생성)
    this._bloomRT1 = null;
    this._bloomRT2 = null;
    this._width = 0;
    this._height = 0;

    // 2D emissive 오버레이용 캔버스 & 텍스처
    this._emissiveCanvas = document.createElement('canvas');
    this._emissiveCtx = this._emissiveCanvas.getContext('2d');
    this._emissiveTexture = new THREE.CanvasTexture(this._emissiveCanvas);
    this._emissiveTexture.minFilter = THREE.LinearFilter;
    this._emissiveTexture.magFilter = THREE.LinearFilter;
    this._emissiveDirty = true;

    // 3D emissive 렌더링용 씬 & 렌더 타겟
    this._emissive3DScene = new THREE.Scene();
    this._emissive3DScene.background = new THREE.Color(0x000000);
    this._emissiveRT = null;  // setSize에서 생성
    this._emissiveMeshPool = [];  // 재사용 메쉬 풀
    this._emissiveMeshCount = 0;  // 현재 사용 중인 메쉬 수
    this._emissiveGeometry = new THREE.PlaneGeometry(48, 48);  // 타일 1개 크기
}

BloomPass.prototype.setSize = function(width, height) {
    var bw = Math.max(1, Math.floor(width / this._downscale));
    var bh = Math.max(1, Math.floor(height / this._downscale));
    var params = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    if (this._width !== bw || this._height !== bh) {
        this._width = bw;
        this._height = bh;
        if (this._bloomRT1) this._bloomRT1.dispose();
        if (this._bloomRT2) this._bloomRT2.dispose();
        this._bloomRT1 = new THREE.WebGLRenderTarget(bw, bh, params);
        this._bloomRT2 = new THREE.WebGLRenderTarget(bw, bh, params);
        this._blurHUniforms.resolution.value.set(bw, bh);
        this._blurVUniforms.resolution.value.set(bw, bh);
    }
    // 3D emissive 렌더 타겟 (원본 해상도)
    if (!this._emissiveRT || this._emissiveRT.width !== width || this._emissiveRT.height !== height) {
        if (this._emissiveRT) this._emissiveRT.dispose();
        this._emissiveRT = new THREE.WebGLRenderTarget(width, height, params);
    }
};

BloomPass.prototype._updateEmissiveTexture = function(width, height) {
    // 2D emissive 오버레이: emissive가 있는 A1 타일에 발광색을 캔버스에 그림
    var canvas = this._emissiveCanvas;
    var ctx = this._emissiveCtx;
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);

    // emissive 설정 수집
    var settings = null;
    if (typeof ThreeWaterShader !== 'undefined') {
        settings = ThreeWaterShader._kindSettings;
        if ((!settings || Object.keys(settings).length === 0) &&
            typeof $dataMap !== 'undefined' && $dataMap && $dataMap.animTileSettings) {
            settings = $dataMap.animTileSettings;
        }
    }
    if (!settings) return false;

    var emissiveKinds = {};
    var hasAny = false;
    for (var k in settings) {
        if (settings[k] && settings[k].emissive > 0) {
            emissiveKinds[k] = settings[k];
            hasAny = true;
        }
    }
    if (!hasAny) return false;

    var gameMap = typeof $gameMap !== 'undefined' ? $gameMap : null;
    var dataMap = typeof $dataMap !== 'undefined' ? $dataMap : null;
    if (!gameMap || !dataMap || !dataMap.data) return false;

    var tw = 48, th = 48;
    var mapW = dataMap.width, mapH = dataMap.height;
    var displayX = gameMap._displayX, displayY = gameMap._displayY;
    var screenTilesX = Math.ceil(width / tw) + 2;
    var screenTilesY = Math.ceil(height / th) + 2;
    var startTileX = Math.floor(displayX);
    var startTileY = Math.floor(displayY);
    var offsetX = -(displayX - startTileX) * tw;
    var offsetY = -(displayY - startTileY) * th;

    var drawn = false;
    for (var dy = -1; dy < screenTilesY; dy++) {
        for (var dx = -1; dx < screenTilesX; dx++) {
            var mx = (startTileX + dx) % mapW;
            var my = (startTileY + dy) % mapH;
            if (mx < 0) mx += mapW;
            if (my < 0) my += mapH;

            var tileId = dataMap.data[(0 * mapH + my) * mapW + mx];
            if (tileId < 2048 || tileId >= 2816) continue;

            var kind = Math.floor((tileId - 2048) / 48);
            var s = emissiveKinds[kind];
            if (!s) continue;

            var sx = offsetX + dx * tw;
            var sy = offsetY + dy * th;
            var color = s.emissiveColor || '#ffffff';
            var r = parseInt(color.substr(1, 2), 16) / 255;
            var g = parseInt(color.substr(3, 2), 16) / 255;
            var b = parseInt(color.substr(5, 2), 16) / 255;
            // emissive 값을 bloom 오버레이 강도로 사용
            // 텍스처 자체는 밝게 하지 않고 bloom에서만 빛이 퍼지도록 함
            var intensity = s.emissive;

            ctx.fillStyle = 'rgba(' +
                Math.round(r * intensity * 255) + ',' +
                Math.round(g * intensity * 255) + ',' +
                Math.round(b * intensity * 255) + ', 1)';
            ctx.fillRect(sx, sy, tw, th);
            drawn = true;
        }
    }
    if (drawn) {
        this._emissiveTexture.needsUpdate = true;
    }
    return drawn;
};

// 3D emissive 렌더링: PerspectiveCamera로 emissive 타일을 렌더 타겟에 렌더
BloomPass.prototype._updateEmissiveTexture3D = function(renderer, width, height) {
    // emissive 설정 수집
    var settings = null;
    if (typeof ThreeWaterShader !== 'undefined') {
        settings = ThreeWaterShader._kindSettings;
        if ((!settings || Object.keys(settings).length === 0) &&
            typeof $dataMap !== 'undefined' && $dataMap && $dataMap.animTileSettings) {
            settings = $dataMap.animTileSettings;
        }
    }
    if (!settings) return false;

    var emissiveKinds = {};
    var hasAny = false;
    for (var k in settings) {
        if (settings[k] && settings[k].emissive > 0) {
            emissiveKinds[k] = settings[k];
            hasAny = true;
        }
    }
    if (!hasAny) return false;

    var gameMap = typeof $gameMap !== 'undefined' ? $gameMap : null;
    var dataMap = typeof $dataMap !== 'undefined' ? $dataMap : null;
    if (!gameMap || !dataMap || !dataMap.data) return false;

    var tw = 48, th = 48;
    var mapW = dataMap.width, mapH = dataMap.height;
    var displayX = gameMap._displayX, displayY = gameMap._displayY;
    var screenTilesX = Math.ceil(width / tw) + 2;
    var screenTilesY = Math.ceil(height / th) + 2;
    var startTileX = Math.floor(displayX);
    var startTileY = Math.floor(displayY);
    // displayX/Y 서브 타일 오프셋 (tilemap과 동일한 좌표계)
    var offsetFracX = (displayX - startTileX) * tw;
    var offsetFracY = (displayY - startTileY) * th;

    // 메쉬 재사용 카운터 리셋
    this._emissiveMeshCount = 0;
    var drawn = false;

    for (var dy = -1; dy < screenTilesY; dy++) {
        for (var dx = -1; dx < screenTilesX; dx++) {
            var mx = (startTileX + dx) % mapW;
            var my = (startTileY + dy) % mapH;
            if (mx < 0) mx += mapW;
            if (my < 0) my += mapH;

            var tileId = dataMap.data[(0 * mapH + my) * mapW + mx];
            if (tileId < 2048 || tileId >= 2816) continue;

            var kind = Math.floor((tileId - 2048) / 48);
            var s = emissiveKinds[kind];
            if (!s) continue;

            // 스크린 픽셀 좌표 (tilemap 렌더링과 동일한 좌표계)
            // dx * tw - offsetFracX는 화면상의 타일 위치
            var wx = dx * tw - offsetFracX + tw / 2;
            var wy = dy * th - offsetFracY + th / 2;

            var color = s.emissiveColor || '#ffffff';
            var r = parseInt(color.substr(1, 2), 16) / 255;
            var g = parseInt(color.substr(3, 2), 16) / 255;
            var b = parseInt(color.substr(5, 2), 16) / 255;
            var intensity = s.emissive;

            // 메쉬 풀에서 가져오거나 새로 생성
            var mesh;
            if (this._emissiveMeshCount < this._emissiveMeshPool.length) {
                mesh = this._emissiveMeshPool[this._emissiveMeshCount];
                mesh.visible = true;
            } else {
                var mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
                mesh = new THREE.Mesh(this._emissiveGeometry, mat);
                mesh.frustumCulled = false;
                this._emissive3DScene.add(mesh);
                this._emissiveMeshPool.push(mesh);
            }

            mesh.material.color.setRGB(r * intensity, g * intensity, b * intensity);
            mesh.position.set(wx, wy, 0);
            mesh.rotation.set(0, 0, 0);
            this._emissiveMeshCount++;
            drawn = true;
        }
    }

    // 사용되지 않는 메쉬 숨기기
    for (var i = this._emissiveMeshCount; i < this._emissiveMeshPool.length; i++) {
        this._emissiveMeshPool[i].visible = false;
    }

    if (!drawn) return false;

    // PerspectiveCamera로 emissive 씬 렌더링
    if (!this._emissiveRT) return false;
    var perspCamera = Mode3D._perspCamera;
    if (!perspCamera) return false;

    var prevTarget = renderer.getRenderTarget();
    var prevAutoClear = renderer.autoClear;
    renderer.setRenderTarget(this._emissiveRT);
    renderer.autoClear = true;
    renderer.clear();
    renderer.render(this._emissive3DScene, perspCamera);
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;

    return true;
};

BloomPass.prototype.render = function(renderer, writeBuffer, readBuffer) {
    // 축소 RT가 없으면 초기화
    if (!this._bloomRT1) {
        var sz = readBuffer ? new THREE.Vector2(readBuffer.width, readBuffer.height) : renderer.getSize(new THREE.Vector2());
        this.setSize(sz.x, sz.y);
    }

    // emissive 오버레이 업데이트
    // 3D 모드: PerspectiveCamera로 렌더 → 카메라 회전 반영
    // 2D 모드: 기존 2D 캔버스 방식
    var hasEmissive;
    var emissiveTex = null;
    var is3D = typeof Mode3D !== 'undefined' && Mode3D._active;
    if (is3D) {
        hasEmissive = this._updateEmissiveTexture3D(renderer, readBuffer.width, readBuffer.height);
        if (hasEmissive) emissiveTex = this._emissiveRT.texture;
    } else {
        hasEmissive = this._updateEmissiveTexture(readBuffer.width, readBuffer.height);
        if (hasEmissive) emissiveTex = this._emissiveTexture;
    }

    // 1단계: 밝기 추출 (원본 + emissive → bloomRT1)
    this._extractUniforms.tColor.value = readBuffer.texture;
    this._extractUniforms.tEmissive.value = emissiveTex;
    this._extractUniforms.threshold.value = this._threshold;
    this._fsQuad.material = this._extractMaterial;
    renderer.setRenderTarget(this._bloomRT1);
    renderer.clear();
    this._fsQuad.render(renderer);

    // 2단계: 수평 블러 (bloomRT1 → bloomRT2)
    this._blurHUniforms.tColor.value = this._bloomRT1.texture;
    this._blurHUniforms.direction.value.set(this._radius, 0.0);
    this._fsQuad.material = this._blurHMaterial;
    renderer.setRenderTarget(this._bloomRT2);
    renderer.clear();
    this._fsQuad.render(renderer);

    // 3단계: 수직 블러 (bloomRT2 → bloomRT1)
    this._blurVUniforms.tColor.value = this._bloomRT2.texture;
    this._blurVUniforms.direction.value.set(0.0, this._radius);
    this._fsQuad.material = this._blurVMaterial;
    renderer.setRenderTarget(this._bloomRT1);
    renderer.clear();
    this._fsQuad.render(renderer);

    // 추가 블러 반복 (더 넓은 bloom)
    for (var i = 0; i < 2; i++) {
        this._blurHUniforms.tColor.value = this._bloomRT1.texture;
        this._fsQuad.material = this._blurHMaterial;
        renderer.setRenderTarget(this._bloomRT2);
        renderer.clear();
        this._fsQuad.render(renderer);

        this._blurVUniforms.tColor.value = this._bloomRT2.texture;
        this._fsQuad.material = this._blurVMaterial;
        renderer.setRenderTarget(this._bloomRT1);
        renderer.clear();
        this._fsQuad.render(renderer);
    }

    // 4단계: 합성 (원본 + bloom → writeBuffer 또는 화면)
    this._compositeUniforms.tColor.value = readBuffer.texture;
    this._compositeUniforms.tBloom.value = this._bloomRT1.texture;
    this._compositeUniforms.strength.value = this._strength;
    this._fsQuad.material = this._compositeMaterial;

    if (this.renderToScreen) {
        renderer.setRenderTarget(null);
    } else {
        renderer.setRenderTarget(writeBuffer);
        renderer.clear();
    }
    this._fsQuad.render(renderer);
};

BloomPass.prototype.dispose = function() {
    this._extractMaterial.dispose();
    this._blurHMaterial.dispose();
    this._blurVMaterial.dispose();
    this._compositeMaterial.dispose();
    this._fsQuad.dispose();
    if (this._bloomRT1) this._bloomRT1.dispose();
    if (this._bloomRT2) this._bloomRT2.dispose();
    if (this._emissiveTexture) this._emissiveTexture.dispose();
    if (this._emissiveRT) this._emissiveRT.dispose();
    if (this._emissiveGeometry) this._emissiveGeometry.dispose();
    for (var i = 0; i < this._emissiveMeshPool.length; i++) {
        this._emissiveMeshPool[i].material.dispose();
    }
};

// --- UIRenderPass (블러 후 UI를 선명하게 합성) ---
function UIRenderPass(scene, camera, spriteset, stage, perspCamera) {
    this.scene = scene;
    this.camera = camera;
    this.spriteset = spriteset;
    this.stage = stage;
    this.perspCamera = perspCamera;
    this.enabled = true;
    this.needsSwap = false;
    this.renderToScreen = true;

    // readBuffer(맵+bloom+tiltshift 결과)를 화면에 복사하기 위한 copy material
    this._copyMaterial = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv); }',
        depthTest: false,
        depthWrite: false
    });
    this._copyQuad = new FullScreenQuad(this._copyMaterial);
}

UIRenderPass.prototype.setSize = function() {};

UIRenderPass.prototype.render = function(renderer, writeBuffer, readBuffer) {
    var scene = this.scene;
    var stageObj = this.stage ? this.stage._threeObj : null;
    if (!stageObj) return;

    // Picture를 spritesetObj에서 stageObj로 옮겨서 2D 렌더
    var spritesetObj = this.spriteset._threeObj;
    var picContainer = this.spriteset._pictureContainer;
    var picObj = picContainer && picContainer._threeObj;
    var picWasVisible = picObj ? picObj.visible : false;
    if (picObj) {
        spritesetObj.remove(picObj);
        stageObj.add(picObj);
        picObj.visible = picWasVisible;
    }

    // fade/flash/weather를 spritesetObj에서 stageObj로 옮겨서 2D 렌더
    var mapRenderPassForFade = null;
    if (PostProcess._composer) {
        for (var fi = 0; fi < PostProcess._composer.passes.length; fi++) {
            if (PostProcess._composer.passes[fi]._fadeInfo) {
                mapRenderPassForFade = PostProcess._composer.passes[fi];
                break;
            }
        }
    }
    var fadeInfo = mapRenderPassForFade ? mapRenderPassForFade._fadeInfo : null;
    var fadeObj = fadeInfo ? fadeInfo.fadeObj : null;
    var flashObj = fadeInfo ? fadeInfo.flashObj : null;
    var weatherObj = fadeInfo ? fadeInfo.weatherObj : null;
    if (fadeObj && fadeInfo.fadeWasVisible && fadeInfo.fadeSprite.alpha > 0) {
        spritesetObj.remove(fadeObj);
        stageObj.add(fadeObj);
        fadeObj.visible = true;
    }
    if (flashObj && fadeInfo.flashWasVisible && fadeInfo.flashSprite.alpha > 0) {
        spritesetObj.remove(flashObj);
        stageObj.add(flashObj);
        flashObj.visible = true;
    }
    if (weatherObj && fadeInfo.weatherWasVisible) {
        spritesetObj.remove(weatherObj);
        stageObj.add(weatherObj);
        weatherObj.visible = true;
    }

    // 애니메이션을 stageObj로 이동 (2D HUD로 렌더)
    // MapRenderPass에서 저장한 animInfo를 가져옴
    var mapRenderPass = null;
    if (PostProcess._composer) {
        for (var pi = 0; pi < PostProcess._composer.passes.length; pi++) {
            if (PostProcess._composer.passes[pi]._animInfo) {
                mapRenderPass = PostProcess._composer.passes[pi];
                break;
            }
        }
    }
    var animInfo = mapRenderPass ? mapRenderPass._animInfo : null;
    if (animInfo) {
        Mode3D._moveAnimationsToHUD(animInfo, stageObj);
    }

    // spriteset(맵)을 숨기고 UI만 표시
    var childVisibility = [];
    for (var i = 0; i < stageObj.children.length; i++) {
        var child = stageObj.children[i];
        childVisibility.push(child.visible);
        if (child === spritesetObj) {
            child.visible = false;
        } else if (child === picObj) {
            // picObj는 이미 visible 설정됨, 그대로 유지
        } else {
            child.visible = childVisibility[i];
        }
    }

    // 하늘, FOW, editorGrid 메쉬 숨김 (UIRenderPass는 2D OrthographicCamera이므로)
    var skyWasVisible = false;
    var fowWasVisible = false;
    var fowMesh = null;
    var gridVisibility = [];
    for (var si = 0; si < scene.children.length; si++) {
        if (scene.children[si]._isParallaxSky) {
            skyWasVisible = scene.children[si].visible;
            scene.children[si].visible = false;
        }
        if (scene.children[si]._isFogOfWar) {
            fowMesh = scene.children[si];
            fowWasVisible = fowMesh.visible;
            fowMesh.visible = false;
        }
        if (scene.children[si].userData && scene.children[si].userData.editorGrid) {
            gridVisibility.push({ idx: si, visible: scene.children[si].visible });
            scene.children[si].visible = false;
        }
    }

    // readBuffer(맵+bloom+tiltshift 결과)를 화면에 복사
    var prevAutoClear = renderer.autoClear;
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    this._copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this._copyQuad.render(renderer);

    // FOW를 bloom 후, UI 전에 합성 — bloom을 가리지 않으면서 UI 아래에 렌더
    renderer.autoClear = false;
    if (fowMesh && fowWasVisible && this.perspCamera) {
        fowMesh.visible = true;
        var sceneChildVis = [];
        for (var sci = 0; sci < scene.children.length; sci++) {
            sceneChildVis.push(scene.children[sci].visible);
            scene.children[sci].visible = !!scene.children[sci]._isFogOfWar;
        }
        renderer.render(scene, this.perspCamera);
        for (var sci = 0; sci < scene.children.length; sci++) {
            scene.children[sci].visible = sceneChildVis[sci];
        }
        fowMesh.visible = false;
    }

    // 블러된 맵 + FOW 위에 UI를 합성 (clear 하지 않음)
    renderer.render(scene, this.camera);

    renderer.autoClear = prevAutoClear;

    // Picture를 원래 spritesetObj로 복원
    if (picObj) {
        stageObj.remove(picObj);
        spritesetObj.add(picObj);
        picObj.visible = picWasVisible;
    }

    // fade/flash/weather를 원래 spritesetObj로 복원
    if (fadeObj && fadeObj.parent === stageObj) {
        stageObj.remove(fadeObj);
        spritesetObj.add(fadeObj);
        fadeObj.visible = fadeInfo.fadeWasVisible;
    }
    if (flashObj && flashObj.parent === stageObj) {
        stageObj.remove(flashObj);
        spritesetObj.add(flashObj);
        flashObj.visible = fadeInfo.flashWasVisible;
    }
    if (weatherObj && weatherObj.parent === stageObj) {
        stageObj.remove(weatherObj);
        spritesetObj.add(weatherObj);
        weatherObj.visible = fadeInfo.weatherWasVisible;
    }
    if (mapRenderPassForFade) mapRenderPassForFade._fadeInfo = null;

    // 애니메이션을 원래 위치로 복원
    if (animInfo) {
        Mode3D._restoreAnimations(animInfo);
        if (mapRenderPass) mapRenderPass._animInfo = null;
    }

    // 가시성 복원
    for (var i = 0; i < stageObj.children.length; i++) {
        if (i < childVisibility.length) {
            stageObj.children[i].visible = childVisibility[i];
        }
    }
    for (var si = 0; si < scene.children.length; si++) {
        if (scene.children[si]._isParallaxSky) {
            scene.children[si].visible = skyWasVisible;
        }
        if (scene.children[si]._isFogOfWar) {
            scene.children[si].visible = fowWasVisible;
        }
    }
    for (var gi = 0; gi < gridVisibility.length; gi++) {
        scene.children[gridVisibility[gi].idx].visible = gridVisibility[gi].visible;
    }
};

UIRenderPass.prototype.dispose = function() {};

// --- Simple2DRenderPass (2D 모드용: UI를 숨기고 맵만 writeBuffer에 렌더) ---
function Simple2DRenderPass(prevRender, strategy) {
    this.enabled = true;
    this.needsSwap = true;
    this.clear = true;
    this._prevRender = prevRender;
    this._strategy = strategy;
    this._uiInfo = null;
}

Simple2DRenderPass.prototype.setSize = function() {};

Simple2DRenderPass.prototype.render = function(renderer, writeBuffer /*, readBuffer, deltaTime, maskActive */) {
    var rendererObj = this._rendererObj;
    var stage = this._stage;
    if (!rendererObj || !stage) return;

    // UI 요소를 숨겨서 맵만 렌더 (블룸이 UI에 먹지 않도록)
    var spriteset = Mode3D._spriteset || (stage.children && stage.children[0]);
    var uiInfo = null;
    if (spriteset) {
        var picContainer = spriteset._pictureContainer;
        var picObj = picContainer && picContainer._threeObj;
        var picWasVisible = picObj ? picObj.visible : false;
        if (picObj) picObj.visible = false;

        var fadeSprite = spriteset._fadeSprite;
        var fadeObj = fadeSprite && fadeSprite._threeObj;
        var fadeWasVisible = fadeObj ? fadeObj.visible : false;
        if (fadeObj) fadeObj.visible = false;

        var flashSprite = spriteset._flashSprite;
        var flashObj = flashSprite && flashSprite._threeObj;
        var flashWasVisible = flashObj ? flashObj.visible : false;
        if (flashObj) flashObj.visible = false;

        uiInfo = {
            spriteset: spriteset,
            picObj: picObj, picWasVisible: picWasVisible,
            fadeObj: fadeObj, fadeWasVisible: fadeWasVisible,
            flashObj: flashObj, flashWasVisible: flashWasVisible
        };
    }

    // _prevRender (Mode3D render)는 2D 모드에서 renderer.render(scene, camera) 호출
    // setRenderTarget(writeBuffer)를 미리 설정하면 그쪽에 렌더됨
    // 하지만 _prevRender 내부에서 setRenderTarget(null)이 호출될 수 있으므로
    // null → writeBuffer로 리다이렉트
    var origSetRT = renderer.setRenderTarget.bind(renderer);
    var wb = writeBuffer;
    renderer.setRenderTarget = function(target) {
        origSetRT(target === null ? wb : target);
    };

    // FOW 메쉬 숨김 (bloom 전에 렌더되지 않도록)
    var scene2d = rendererObj.scene;
    var fowMesh2dRender = null, fowWasVisible2dRender = false;
    if (scene2d) {
        for (var fi = 0; fi < scene2d.children.length; fi++) {
            if (scene2d.children[fi]._isFogOfWar) {
                fowMesh2dRender = scene2d.children[fi];
                fowWasVisible2dRender = fowMesh2dRender.visible;
                fowMesh2dRender.visible = false;
                break;
            }
        }
    }

    renderer.setRenderTarget(writeBuffer);
    if (this.clear) renderer.clear();

    this._prevRender.call(this._strategy, rendererObj, stage);

    renderer.setRenderTarget = origSetRT;

    // FOW 가시성 복원
    if (fowMesh2dRender) fowMesh2dRender.visible = fowWasVisible2dRender;

    // UI 가시성 복원
    if (uiInfo) {
        if (uiInfo.picObj) uiInfo.picObj.visible = uiInfo.picWasVisible;
        if (uiInfo.fadeObj) uiInfo.fadeObj.visible = uiInfo.fadeWasVisible;
        if (uiInfo.flashObj) uiInfo.flashObj.visible = uiInfo.flashWasVisible;
    }
    this._uiInfo = uiInfo;
};

Simple2DRenderPass.prototype.dispose = function() {};

// --- Simple2DUIRenderPass (블룸 적용된 맵을 화면에 복사 + UI 합성) ---
function Simple2DUIRenderPass(prevRender, strategy) {
    this.enabled = true;
    this.needsSwap = false;
    this.renderToScreen = true;
    this._prevRender = prevRender;
    this._strategy = strategy;

    this._copyMaterial = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: [
            'varying vec2 vUv;',
            'void main() {',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform sampler2D tDiffuse;',
            'varying vec2 vUv;',
            'void main() {',
            '    gl_FragColor = texture2D(tDiffuse, vUv);',
            '}'
        ].join('\n')
    });
    this._copyQuad = new FullScreenQuad(this._copyMaterial);
}

Simple2DUIRenderPass.prototype.setSize = function() {};

Simple2DUIRenderPass.prototype.render = function(renderer, writeBuffer, readBuffer) {
    var rendererObj = this._rendererObj;
    var stage = this._stage;

    // 1) 블룸 적용된 맵을 화면에 복사
    this._copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    this._copyQuad.render(renderer);

    // 2) UI만 맵 위에 합성
    var renderPass = PostProcess._2dRenderPass;
    var uiInfo = renderPass ? renderPass._uiInfo : null;
    if (!uiInfo || !uiInfo.spriteset || !rendererObj || !stage) return;

    var scene = rendererObj.scene;
    var camera = rendererObj.camera;
    var spriteset = uiInfo.spriteset;
    var spritesetObj = spriteset._threeObj;
    var stageObj = stage._threeObj;
    if (!stageObj || !spritesetObj) return;

    // spriteset(맵)을 숨기고 UI만 표시
    var childVisibility = [];
    for (var i = 0; i < stageObj.children.length; i++) {
        childVisibility.push(stageObj.children[i].visible);
        if (stageObj.children[i] === spritesetObj) {
            stageObj.children[i].visible = false;
        }
    }

    // Picture를 stageObj로 이동
    var picObj = uiInfo.picObj;
    if (picObj && uiInfo.picWasVisible) {
        spritesetObj.remove(picObj);
        stageObj.add(picObj);
        picObj.visible = true;
    }

    // Fade/Flash를 stageObj로 이동
    var fadeObj = uiInfo.fadeObj;
    if (fadeObj && uiInfo.fadeWasVisible) {
        spritesetObj.remove(fadeObj);
        stageObj.add(fadeObj);
        fadeObj.visible = true;
    }
    var flashObj = uiInfo.flashObj;
    if (flashObj && uiInfo.flashWasVisible) {
        spritesetObj.remove(flashObj);
        stageObj.add(flashObj);
        flashObj.visible = true;
    }

    // FOW 메쉬 숨김 (2D UI 패스에서 중복 렌더 방지)
    var fowMesh2d = null, fowWasVisible2d = false;
    for (var si = 0; si < scene.children.length; si++) {
        if (scene.children[si]._isFogOfWar) {
            fowMesh2d = scene.children[si];
            fowWasVisible2d = fowMesh2d.visible;
            fowMesh2d.visible = false;
            break;
        }
    }

    // FOW를 bloom 후, UI 전에 합성
    renderer.autoClear = false;
    if (fowMesh2d && fowWasVisible2d) {
        fowMesh2d.visible = true;
        var skyVis2d = [];
        for (var sci = 0; sci < scene.children.length; sci++) {
            skyVis2d.push(scene.children[sci].visible);
            scene.children[sci].visible = !!scene.children[sci]._isFogOfWar;
        }
        renderer.render(scene, camera);
        for (var sci = 0; sci < scene.children.length; sci++) {
            scene.children[sci].visible = skyVis2d[sci];
        }
        fowMesh2d.visible = false;
    }

    // UI 렌더 (블룸 맵 + FOW 위에 합성)
    renderer.render(scene, camera);

    // FOW 메쉬 가시성 복원
    if (fowMesh2d) fowMesh2d.visible = fowWasVisible2d;

    // 복원: Picture, Fade, Flash를 spritesetObj로 되돌림
    if (picObj && picObj.parent === stageObj) {
        stageObj.remove(picObj);
        spritesetObj.add(picObj);
        picObj.visible = uiInfo.picWasVisible;
    }
    if (fadeObj && fadeObj.parent === stageObj) {
        stageObj.remove(fadeObj);
        spritesetObj.add(fadeObj);
        fadeObj.visible = uiInfo.fadeWasVisible;
    }
    if (flashObj && flashObj.parent === stageObj) {
        stageObj.remove(flashObj);
        spritesetObj.add(flashObj);
        flashObj.visible = uiInfo.flashWasVisible;
    }

    // stageObj 가시성 복원
    for (var i = 0; i < stageObj.children.length; i++) {
        if (i < childVisibility.length) {
            stageObj.children[i].visible = childVisibility[i];
        }
    }
    renderer.autoClear = true;
};

Simple2DUIRenderPass.prototype.dispose = function() {
    this._copyMaterial.dispose();
    this._copyQuad.dispose();
};

//=============================================================================
// PostProcess - Composer 생성/파괴
//=============================================================================

PostProcess._createComposer = function(rendererObj, stage) {
    if (this._composer) this._disposeComposer();

    var renderer = rendererObj.renderer;
    var scene = rendererObj.scene;
    var camera = rendererObj.camera;
    var w = rendererObj._width;
    var h = rendererObj._height;

    var composer = new SimpleEffectComposer(renderer);
    composer.setSize(w, h);

    // RenderPass: Mode3D 2-pass 렌더링
    var renderPass = new MapRenderPass(
        scene, camera, Mode3D._perspCamera, Mode3D._spriteset, stage
    );
    composer.addPass(renderPass);

    // BloomPass - 물/용암 emissive에서 빛이 번지는 효과
    var bloomPass = new BloomPass({
        threshold: this.bloomConfig.threshold,
        strength: this.bloomConfig.strength,
        radius: this.bloomConfig.radius,
        downscale: this.bloomConfig.downscale
    });
    // $dataMap.bloomConfig.enabled 반영 (composer 재생성 시에도 설정 유지)
    if ($dataMap && $dataMap.bloomConfig) {
        bloomPass.enabled = $dataMap.bloomConfig.enabled !== false;
    }
    composer.addPass(bloomPass);

    // PostProcessEffects 패스들 생성 및 추가
    var ppPasses = PostProcess._createPPPasses(composer);

    // TiltShiftPass (화면 Y좌표 기반 DoF) - 맵에만 블러
    var tiltShiftPass = new TiltShiftPass({
        focusY: this.config.focusY,
        focusRange: this.config.focusRange,
        maxblur: this.config.maxblur,
        blurPower: this.config.blurPower
    });
    tiltShiftPass.renderToScreen = true;
    composer.addPass(tiltShiftPass);

    // UIRenderPass - 블러된 맵 위에 UI를 선명하게 합성
    var uiPass = new UIRenderPass(scene, camera, Mode3D._spriteset, stage, Mode3D._perspCamera);
    composer.addPass(uiPass);

    this._composer = composer;
    this._tiltShiftPass = tiltShiftPass;
    this._bloomPass = bloomPass;
    this._renderPass = renderPass;
    this._uiPass = uiPass;
    this._ppPasses = ppPasses;
    this._lastStage = stage;
    this._composerMode = '3d';

    // composer 재생성 후 맵별 설정 재적용
    this._applyMapSettings();
};

PostProcess._createComposer2D = function(rendererObj, stage) {
    if (this._composer) this._disposeComposer();

    var renderer = rendererObj.renderer;
    var w = rendererObj._width;
    var h = rendererObj._height;

    var composer = new SimpleEffectComposer(renderer);
    composer.setSize(w, h);

    // Simple2DRenderPass: 기존 2D 렌더를 텍스처에 캡처
    var renderPass = new Simple2DRenderPass(_prevRender, _ThreeStrategy);
    composer.addPass(renderPass);

    // BloomPass
    var bloomPass = new BloomPass({
        threshold: this.bloomConfig.threshold,
        strength: this.bloomConfig.strength,
        radius: this.bloomConfig.radius,
        downscale: this.bloomConfig.downscale
    });
    // $dataMap.bloomConfig.enabled 반영 (composer 재생성 시에도 설정 유지)
    if ($dataMap && $dataMap.bloomConfig) {
        bloomPass.enabled = $dataMap.bloomConfig.enabled !== false;
    }
    composer.addPass(bloomPass);

    // PostProcessEffects 패스들 생성 및 추가
    var ppPasses = PostProcess._createPPPasses(composer);

    // Simple2DUIRenderPass - 블룸 적용된 맵을 화면에 복사 + UI 합성
    var uiPass = new Simple2DUIRenderPass(_prevRender, _ThreeStrategy);
    composer.addPass(uiPass);

    this._composer = composer;
    this._tiltShiftPass = null;
    this._bloomPass = bloomPass;
    this._renderPass = null;
    this._uiPass = null;
    this._2dRenderPass = renderPass;
    this._2dUIRenderPass = uiPass;
    this._ppPasses = ppPasses;
    this._lastStage = stage;
    this._composerMode = '2d';

    // composer 재생성 후 맵별 설정 재적용
    this._applyMapSettings();
};

// PostProcessEffects 패스 일괄 생성 헬퍼
PostProcess._createPPPasses = function(composer) {
    var ppPasses = {};
    if (window.PostProcessEffects) {
        var PPE = window.PostProcessEffects;
        var list = PPE.EFFECT_LIST;
        for (var i = 0; i < list.length; i++) {
            var entry = list[i];
            var pass = PPE[entry.create]();
            pass.enabled = false;
            composer.addPass(pass);
            ppPasses[entry.key] = pass;
        }
    }
    return ppPasses;
};

// 에디터에서 postProcessConfig를 받아 패스 활성/비활성 + 파라미터 적용
PostProcess.applyPostProcessConfig = function(config) {
    if (!this._ppPasses) return;
    var PPE = window.PostProcessEffects;
    if (!PPE) return;

    var anyEnabled = false;
    for (var key in this._ppPasses) {
        var pass = this._ppPasses[key];
        var effectCfg = config && config[key];
        if (effectCfg && effectCfg.enabled) {
            pass.enabled = true;
            anyEnabled = true;
            // 파라미터 적용
            var params = PPE.EFFECT_PARAMS[key];
            if (params) {
                for (var pi = 0; pi < params.length; pi++) {
                    var p = params[pi];
                    var val = effectCfg[p.key];
                    if (val != null) {
                        PPE.applyParam(key, pass, p.key, val);
                    }
                }
            }
        } else {
            pass.enabled = false;
        }
    }

    // filmGrain, waveDistortion: uTime 업데이트 필요
    this._ppNeedsTimeUpdate = anyEnabled;

    // godRays base lightPos 갱신 플래그
    if (this._ppPasses.godRays) {
        this._ppPasses.godRays._baseDirty = true;
    }

    // 3D: renderToScreen 재조정
    this._updateRenderToScreen();
};

// renderToScreen 플래그를 올바르게 재조정
PostProcess._updateRenderToScreen = function() {
    if (!this._composer) return;
    var passes = this._composer.passes;
    // 마지막으로 활성화된 "화면 출력" 패스를 찾아 renderToScreen 설정
    // UIRenderPass(3D) 또는 Simple2DUIRenderPass(2D)가 항상 마지막
    // 그 사이의 PP 패스들은 needsSwap=true로 ping-pong

    // bloom의 renderToScreen을 false로 (PP 패스가 뒤에 올 수 있으므로)
    if (this._bloomPass) {
        this._bloomPass.renderToScreen = false;
    }

    if (this._composerMode === '3d') {
        // 3D: TiltShift/UIPass가 최종 출력
        // TiltShift는 DoF 활성 시에만 renderToScreen
        var isDoF = ConfigManager.depthOfField;

        // PP 패스 중 마지막으로 활성화된 것을 찾기
        var lastEnabledPP = null;
        for (var key in this._ppPasses) {
            if (this._ppPasses[key].enabled) lastEnabledPP = this._ppPasses[key];
        }

        if (this._tiltShiftPass) {
            // DoF가 활성이면 tiltShift가 PP보다 앞에 있으므로 renderToScreen 아님
            // PP 패스들은 bloom → PP → tiltShift → UI 순서
            // 실제로 패스 순서: render → bloom → [PP passes] → tiltShift → UI
            this._tiltShiftPass.renderToScreen = false;
            this._tiltShiftPass.enabled = isDoF;
        }
        // UI pass가 항상 최종 출력 (renderToScreen=true, needsSwap=false)
    } else if (this._composerMode === '2d') {
        // 2D: Simple2DUIRenderPass가 최종 출력
        if (this._2dUIRenderPass) {
            this._2dUIRenderPass.renderToScreen = true;
        }
    }
};

PostProcess._disposeComposer = function() {
    if (this._composer) {
        this._composer.dispose();
        this._composer = null;
        this._tiltShiftPass = null;
        this._bloomPass = null;
        this._renderPass = null;
        this._uiPass = null;
        this._2dRenderPass = null;
        this._2dUIRenderPass = null;
        this._ppPasses = null;
        this._ppNeedsTimeUpdate = false;
        this._lastStage = null;
        this._composerMode = null;
    }
    // lerp 상태 초기화
    this._currentFocusY = null;
    this._currentFocusRange = null;
    this._currentMaxBlur = null;
    this._currentBlurPower = null;
};

// 카메라존 DoF lerp 상태
PostProcess._currentFocusY = null;
PostProcess._currentFocusRange = null;
PostProcess._currentMaxBlur = null;
PostProcess._currentBlurPower = null;

PostProcess._updateUniforms = function() {
    // Bloom uniform 실시간 갱신 (DoF 비활성이어도 bloom은 동작)
    if (this._bloomPass) {
        this._bloomPass._threshold = this.bloomConfig.threshold;
        this._bloomPass._strength = this.bloomConfig.strength;
        this._bloomPass._radius = this.bloomConfig.radius;
        this._bloomPass._blurHUniforms.direction.value.set(this.bloomConfig.radius, 0.0);
        this._bloomPass._blurVUniforms.direction.value.set(0.0, this.bloomConfig.radius);
    }

    // GodRays lightPos를 카메라 yaw에 따라 회전
    this._updateGodRaysLightPos();

    if (!this._tiltShiftPass) return;

    // 타겟 DoF 값 결정: 활성 카메라존 → 글로벌 config
    var targetFocusY = this.config.focusY;
    var targetFocusRange = this.config.focusRange;
    var targetMaxBlur = this.config.maxblur;
    var targetBlurPower = this.config.blurPower;
    var transitionSpeed = 1.0;

    if ($gameMap && $gameMap._activeCameraZoneId != null) {
        var zone = $gameMap.getCameraZoneById($gameMap._activeCameraZoneId);
        if (zone && zone.dofEnabled) {
            targetFocusY = zone.dofFocusY != null ? zone.dofFocusY : this.config.focusY;
            targetFocusRange = zone.dofFocusRange != null ? zone.dofFocusRange : this.config.focusRange;
            targetMaxBlur = zone.dofMaxBlur != null ? zone.dofMaxBlur : this.config.maxblur;
            targetBlurPower = zone.dofBlurPower != null ? zone.dofBlurPower : this.config.blurPower;
        }
        if (zone) transitionSpeed = zone.transitionSpeed || 1.0;
    }

    // 초기화 (최초 호출 시)
    if (this._currentFocusY === null) {
        this._currentFocusY = targetFocusY;
        this._currentFocusRange = targetFocusRange;
        this._currentMaxBlur = targetMaxBlur;
        this._currentBlurPower = targetBlurPower;
    }

    // lerp로 부드럽게 전환
    var lerpRate = 0.1 * transitionSpeed;
    lerpRate = Math.min(lerpRate, 1.0);
    this._currentFocusY += (targetFocusY - this._currentFocusY) * lerpRate;
    this._currentFocusRange += (targetFocusRange - this._currentFocusRange) * lerpRate;
    this._currentMaxBlur += (targetMaxBlur - this._currentMaxBlur) * lerpRate;
    this._currentBlurPower += (targetBlurPower - this._currentBlurPower) * lerpRate;

    this._tiltShiftPass.uniforms.focusY.value = this._currentFocusY;
    this._tiltShiftPass.uniforms.focusRange.value = this._currentFocusRange;
    this._tiltShiftPass.uniforms.maxblur.value = this._currentMaxBlur;
    this._tiltShiftPass.uniforms.blurPower.value = this._currentBlurPower;
    this._tiltShiftPass.uniforms.aspect.value =
        Graphics.height / Graphics.width;
};

PostProcess._updateGodRaysLightPos = function() {
    if (!this._ppPasses || !this._ppPasses.godRays || !this._ppPasses.godRays.enabled) {
        return;
    }
    var yaw = (typeof Mode3D !== 'undefined') ? (Mode3D._yawRad || 0) : 0;

    var pass = this._ppPasses.godRays;

    // 원본 lightPos가 변경되었으면 base 갱신 (맵 전환 등)
    if (pass._baseLightPosX == null || pass._baseDirty) {
        pass._baseLightPosX = pass.uniforms.uLightPos.value.x;
        pass._baseLightPosY = pass.uniforms.uLightPos.value.y;
        pass._baseDirty = false;
    }

    if (yaw === 0) return;

    // 화면 중심(0.5, 0.5) 기준으로 yaw만큼 회전
    var cx = 0.5, cy = 0.5;
    var dx = pass._baseLightPosX - cx;
    var dy = pass._baseLightPosY - cy;
    var cosY = Math.cos(-yaw);
    var sinY = Math.sin(-yaw);
    pass.uniforms.uLightPos.value.x = cx + dx * cosY - dy * sinY;
    pass.uniforms.uLightPos.value.y = cy + dx * sinY + dy * cosY;
};

//=============================================================================
// ThreeRendererStrategy.render 오버라이드 - DoF 적용
// Mode3D.js에서 이미 오버라이드한 render를 다시 오버라이드
//=============================================================================

var _ThreeStrategy = RendererStrategy._strategies['threejs'];
var _prevRender = _ThreeStrategy.render;

_ThreeStrategy.render = function(rendererObj, stage) {
    if (!rendererObj || !stage) return;

    var is3D = ConfigManager.mode3d && Mode3D._spriteset;

    if (is3D) {
        // 3D 모드에서는 3D composer 사용 (bloom + DoF 등 후처리)
        // Composer가 없거나 모드가 다르거나 stage가 바뀌면 재생성
        if (!PostProcess._composer || PostProcess._composerMode !== '3d' || PostProcess._lastStage !== stage) {
            var w = rendererObj._width;
            var h = rendererObj._height;
            if (!Mode3D._perspCamera) {
                Mode3D._perspCamera = Mode3D._createPerspCamera(w, h);
            }
            PostProcess._createComposer(rendererObj, stage);
        }

        // DoF(TiltShift)는 설정에 따라 활성/비활성 + renderToScreen 재조정
        PostProcess._updateRenderToScreen();

        // PP 패스 시간 업데이트 (filmGrain, waveDistortion 등)
        if (PostProcess._ppNeedsTimeUpdate && PostProcess._ppPasses) {
            var ppTime = (typeof ThreeWaterShader !== 'undefined') ? ThreeWaterShader._time : (Date.now() / 1000);
            var pp = PostProcess._ppPasses;
            if (pp.filmGrain && pp.filmGrain.enabled) pp.filmGrain.uniforms.uTime.value = ppTime;
            if (pp.waveDistortion && pp.waveDistortion.enabled) pp.waveDistortion.uniforms.uTime.value = ppTime;
        }

        var scene = rendererObj.scene;
        var renderer = rendererObj.renderer;
        var camera = rendererObj.camera;
        var w = rendererObj._width;
        var h = rendererObj._height;

        rendererObj._drawOrderCounter = 0;

        // stage를 scene에 연결
        if (stage._threeObj && stage._threeObj.parent !== scene) {
            if (scene._stageObj) scene.remove(scene._stageObj);
            scene.add(stage._threeObj);
            scene._stageObj = stage._threeObj;
        }

        // updateTransform + hierarchy sync
        if (stage.updateTransform) stage.updateTransform();
        this._syncHierarchy(rendererObj, stage);

        // 카메라 존 파라미터(tilt/fov/yaw/zoom) lerp 업데이트 후 위치 갱신
        Mode3D._updateCameraZoneParams();
        Mode3D._positionCamera(Mode3D._perspCamera, w, h);
        Mode3D._applyBillboards();
        Mode3D._enforceNearestFilter(scene);

        // RenderPass에 최신 참조 반영
        PostProcess._renderPass.perspCamera = Mode3D._perspCamera;
        PostProcess._renderPass.spriteset = Mode3D._spriteset;
        PostProcess._renderPass.stage = stage;
        PostProcess._renderPass.scene = scene;
        PostProcess._renderPass.camera = camera;

        // UIRenderPass에 최신 참조 반영
        PostProcess._uiPass.spriteset = Mode3D._spriteset;
        PostProcess._uiPass.stage = stage;
        PostProcess._uiPass.scene = scene;
        PostProcess._uiPass.camera = camera;

        // uniform 갱신
        PostProcess._updateUniforms();

        // Composer 크기 동기화
        var composerNeedsResize = (
            PostProcess._composer.renderTarget1.width !== w ||
            PostProcess._composer.renderTarget1.height !== h
        );
        if (composerNeedsResize) {
            PostProcess._composer.setSize(w, h);
        }

        // Shadow Map: multi-pass 렌더링에서 shadow map은 MapRenderPass의
        // Pass 1에서만 갱신되도록 autoUpdate=false로 감싸기
        var prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;

        // 렌더!
        PostProcess._composer.render();

        renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
        Mode3D._active = true;
    } else {
        // 2D 모드 → bloom만 적용하는 2D composer 사용
        if (!PostProcess._composer || PostProcess._composerMode !== '2d' || PostProcess._lastStage !== stage) {
            PostProcess._createComposer2D(rendererObj, stage);
        }

        // 2D RenderPass / UIRenderPass에 최신 참조 전달
        PostProcess._2dRenderPass._rendererObj = rendererObj;
        PostProcess._2dRenderPass._stage = stage;
        if (PostProcess._2dUIRenderPass) {
            PostProcess._2dUIRenderPass._rendererObj = rendererObj;
            PostProcess._2dUIRenderPass._stage = stage;
        }

        // renderToScreen 재조정
        PostProcess._updateRenderToScreen();

        // bloom uniform 갱신
        PostProcess._updateUniforms();

        // PP 패스 시간 업데이트
        if (PostProcess._ppNeedsTimeUpdate && PostProcess._ppPasses) {
            var ppTime = (typeof ThreeWaterShader !== 'undefined') ? ThreeWaterShader._time : (Date.now() / 1000);
            var pp = PostProcess._ppPasses;
            if (pp.filmGrain && pp.filmGrain.enabled) pp.filmGrain.uniforms.uTime.value = ppTime;
            if (pp.waveDistortion && pp.waveDistortion.enabled) pp.waveDistortion.uniforms.uTime.value = ppTime;
        }

        // Composer 크기 동기화
        var w = rendererObj._width;
        var h = rendererObj._height;
        var composerNeedsResize = (
            PostProcess._composer.renderTarget1.width !== w ||
            PostProcess._composer.renderTarget1.height !== h
        );
        if (composerNeedsResize) {
            PostProcess._composer.setSize(w, h);
        }

        PostProcess._composer.render();
    }
};

//=============================================================================
// Spriteset_Map - DoF 활성화/비활성화 감지
//=============================================================================

var _Spriteset_Map_update_dof = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update_dof.call(this);

    // 3D 모드이면 Debug UI 표시 (DoF ON/OFF와 무관)
    var shouldShowDebug = ConfigManager.mode3d;

    if (shouldShowDebug && !PostProcess._debugSection) {
        PostProcess._createDebugUI();
    } else if (!shouldShowDebug && PostProcess._debugSection) {
        PostProcess._removeDebugUI();
    }
};

//=============================================================================
// Scene_Map.onMapLoaded - 맵 데이터에서 bloomConfig, postProcessConfig 로드
//=============================================================================

if (typeof Scene_Map !== 'undefined') {
    var _Scene_Map_onMapLoaded_dof = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded_dof.call(this);
        PostProcess._applyMapSettings();
    };
}

PostProcess._applyMapSettings = function() {
    if (!$dataMap) return;

    // bloomConfig 적용
    var bc = $dataMap.bloomConfig;
    if (bc) {
        this.bloomConfig.threshold = bc.threshold != null ? bc.threshold : 0.5;
        this.bloomConfig.strength = bc.strength != null ? bc.strength : 0.8;
        this.bloomConfig.radius = bc.radius != null ? bc.radius : 1.0;
        this.bloomConfig.downscale = bc.downscale != null ? bc.downscale : 4;
        if (this._bloomPass) {
            this._bloomPass.enabled = bc.enabled !== false;
        }
    } else {
        // 기본값 복원
        this.bloomConfig.threshold = 0.5;
        this.bloomConfig.strength = 0.8;
        this.bloomConfig.radius = 1.0;
        this.bloomConfig.downscale = 4;
        if (this._bloomPass) {
            this._bloomPass.enabled = true;
        }
    }

    // postProcessConfig 적용
    var ppc = $dataMap.postProcessConfig;
    if (ppc) {
        this.applyPostProcessConfig(ppc);
    } else {
        // 모든 PP 패스 비활성화
        this.applyPostProcessConfig({});
    }
};

//=============================================================================
// Debug UI - ShadowLight Debug 패턴과 동일한 스타일
//=============================================================================

PostProcess._createDebugUI = function() {
    if (this._debugSection) return;

    // ShadowLight 패널의 DoF 컨테이너에 삽입
    var container = document.getElementById('sl-debug-dof-container');
    if (!container) return; // ShadowLight 패널이 아직 없으면 대기

    var self = this;
    var sectionStyle = 'border-top:1px solid #444;padding-top:6px;margin-top:6px;';

    // 접기/펼치기 가능한 DoF 섹션
    var wrapper = document.createElement('div');
    wrapper.style.cssText = sectionStyle;

    var header = document.createElement('div');
    header.style.cssText = 'font-weight:bold;font-size:11px;color:#88ccff;cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px;';
    var arrow = document.createElement('span');
    arrow.textContent = '\u25B6'; // 초기 접힘
    arrow.style.cssText = 'font-size:9px;width:10px;';
    var labelSpan = document.createElement('span');
    labelSpan.textContent = 'DoF (피사계 심도)';
    header.appendChild(arrow);
    header.appendChild(labelSpan);
    wrapper.appendChild(header);

    var body = document.createElement('div');
    body.style.display = 'none'; // 초기 접힘

    header.addEventListener('click', function() {
        var isHidden = body.style.display === 'none';
        body.style.display = isHidden ? '' : 'none';
        arrow.textContent = isHidden ? '\u25BC' : '\u25B6';
    });

    var controls = [
        { label: 'Focus Y', key: 'focusY', min: 0, max: 1, step: 0.01, decimals: 2 },
        { label: 'Focus Range', key: 'focusRange', min: 0, max: 0.5, step: 0.01, decimals: 2 },
        { label: 'Max Blur', key: 'maxblur', min: 0, max: 0.2, step: 0.005, decimals: 3 },
        { label: 'Blur Power', key: 'blurPower', min: 0.5, max: 5, step: 0.1, decimals: 1 }
    ];

    controls.forEach(function(c) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';

        var lbl = document.createElement('span');
        lbl.textContent = c.label;
        lbl.style.cssText = 'width:70px;font-size:11px;';

        var slider = document.createElement('input');
        slider.type = 'range';
        slider.min = c.min;
        slider.max = c.max;
        slider.step = c.step;
        slider.value = self.config[c.key];
        slider.style.cssText = 'width:100px;height:14px;';

        var val = document.createElement('span');
        val.textContent = parseFloat(self.config[c.key]).toFixed(c.decimals);
        val.style.cssText = 'width:50px;font-size:11px;text-align:right;';

        slider.addEventListener('input', function() {
            var v = parseFloat(slider.value);
            self.config[c.key] = v;
            val.textContent = v.toFixed(c.decimals);
        });

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(val);
        body.appendChild(row);
    });

    // ON/OFF 토글
    var toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'margin:8px 0 4px;display:flex;align-items:center;gap:6px;';
    var toggleLbl = document.createElement('span');
    toggleLbl.textContent = '활성화';
    toggleLbl.style.cssText = 'width:70px;font-size:11px;';
    var toggleCb = document.createElement('input');
    toggleCb.type = 'checkbox';
    toggleCb.checked = ConfigManager.depthOfField;
    toggleCb.addEventListener('change', function() {
        ConfigManager.depthOfField = toggleCb.checked;
    });
    toggleRow.appendChild(toggleLbl);
    toggleRow.appendChild(toggleCb);
    body.appendChild(toggleRow);

    // DoF 현재값 복사 버튼
    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'DoF 현재값 복사';
    copyBtn.style.cssText = 'margin-top:8px;width:100%;padding:4px 8px;font:11px monospace;background:#446;color:#eee;border:1px solid #668;border-radius:3px;cursor:pointer;';
    copyBtn.addEventListener('click', function() {
        var cfg = self.config;
        var text = [
            'focusY: ' + cfg.focusY,
            'focusRange: ' + cfg.focusRange,
            'maxblur: ' + cfg.maxblur,
            'blurPower: ' + cfg.blurPower
        ].join('\n');

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
                copyBtn.textContent = '복사 완료!';
                setTimeout(function() { copyBtn.textContent = 'DoF 현재값 복사'; }, 1500);
            });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = '복사 완료!';
            setTimeout(function() { copyBtn.textContent = 'DoF 현재값 복사'; }, 1500);
        }
    });
    copyBtn.addEventListener('mouseover', function() { copyBtn.style.background = '#557'; });
    copyBtn.addEventListener('mouseout', function() { copyBtn.style.background = '#446'; });
    body.appendChild(copyBtn);

    wrapper.appendChild(body);
    container.appendChild(wrapper);
    this._debugSection = wrapper;
};

PostProcess._removeDebugUI = function() {
    if (this._debugSection) {
        this._debugSection.remove();
        this._debugSection = null;
    }
};

//=============================================================================
// Plugin Commands
//=============================================================================

var _Game_Interpreter_pluginCommand_dof = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand_dof.call(this, command, args);

    if (command === 'DoF' || command === 'DepthOfField' || command === 'PostProcess') {
        if (args[0] === 'on') ConfigManager.depthOfField = true;
        if (args[0] === 'off') ConfigManager.depthOfField = false;
        var ppKeyMap = { focusY: '_currentFocusY', focusRange: '_currentFocusRange', maxblur: '_currentMaxBlur', blurPower: '_currentBlurPower' };
        var ppKeys = ['focusY', 'focusRange', 'maxblur', 'blurPower'];
        for (var pi = 0; pi < ppKeys.length; pi++) {
            if (args[0] === ppKeys[pi] && args[1]) {
                var ppVal = parseFloat(args[1]);
                var ppDur = args[2] ? parseFloat(args[2]) : 0;
                var currentKey = ppKeyMap[ppKeys[pi]];
                if (ppDur > 0 && window.PluginTween) {
                    (function(cfgKey, curKey) {
                        PluginTween.add({
                            target: PostProcess.config, key: cfgKey, to: ppVal, duration: ppDur,
                            onUpdate: function(v) {
                                // _updateUniforms의 lerp를 바이패스하기 위해 _current 값도 동기화
                                PostProcess[curKey] = v;
                            }
                        });
                    })(ppKeys[pi], currentKey);
                } else {
                    PostProcess.config[ppKeys[pi]] = ppVal;
                    PostProcess[currentKey] = ppVal;
                }
            }
        }
    }

    // PPEffect <effectKey> <on|off|paramKey> [value] [duration]
    if (command === 'PPEffect') {
        var effectKey = args[0];
        var action = args[1];
        var PPE = window.PostProcessEffects;
        if (effectKey && action && PostProcess._ppPasses && PostProcess._ppPasses[effectKey]) {
            var pass = PostProcess._ppPasses[effectKey];
            if (action === 'on') {
                pass.enabled = true;
                PostProcess._updateRenderToScreen();
            } else if (action === 'off') {
                pass.enabled = false;
                PostProcess._updateRenderToScreen();
            } else if (args[2] != null && PPE) {
                var ppEffVal = parseFloat(args[2]);
                var ppEffDur = args[3] ? parseFloat(args[3]) : 0;
                if (ppEffDur > 0 && window.PluginTween) {
                    // 프록시 객체로 매 프레임 applyParam 호출
                    var _ek = effectKey, _act = action, _pass = pass;
                    if (!PostProcess._ppTweenProxies) PostProcess._ppTweenProxies = {};
                    var proxyKey = _ek + '_' + _act;
                    if (!PostProcess._ppTweenProxies[proxyKey]) {
                        // 현재 유니폼 값을 시작값으로 사용
                        var curVal = 0;
                        var map = PPE._UNIFORM_MAP[_ek];
                        if (map && map[_act] && _pass.uniforms[map[_act]]) {
                            var u = _pass.uniforms[map[_act]];
                            if (u.value && u.value.isVector2) {
                                curVal = (_act.endsWith('X') || _act === 'lightPosX' || _act === 'centerX') ? u.value.x : u.value.y;
                            } else {
                                curVal = u.value;
                            }
                        }
                        PostProcess._ppTweenProxies[proxyKey] = { value: curVal };
                    }
                    var proxy = PostProcess._ppTweenProxies[proxyKey];
                    PluginTween.add({
                        target: proxy, key: 'value', to: ppEffVal, duration: ppEffDur,
                        onUpdate: function(v) { PPE.applyParam(_ek, _pass, _act, v); }
                    });
                } else {
                    PPE.applyParam(effectKey, pass, action, ppEffVal);
                }
            }
        }
    }
};

})();
