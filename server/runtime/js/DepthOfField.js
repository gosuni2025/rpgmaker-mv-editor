//=============================================================================
// DepthOfField.js - Tilt-Shift DoF Post-processing (옥토패스 트래블러 스타일)
//=============================================================================
// 3D 모드에서 화면 Y좌표 기반 Tilt-Shift DoF 효과를 적용합니다.
// - 화면 상단(원경): 블러 → 포커스 영역(캐릭터): 선명 → 화면 하단(근경): 블러
// - EffectComposer / RenderPass / TiltShiftPass를 내장 (Three.js r128 호환)
// - Mode3D._perspCamera가 활성화된 경우에만 동작
// - 게임 옵션에서 ON/OFF 가능
// - 개발 모드에서 Debug UI로 파라미터 실시간 조절
//
// 의존: THREE (global), Mode3D, ConfigManager, Graphics, Spriteset_Map
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

var _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
Window_Options.prototype.addGeneralOptions = function() {
    _Window_Options_addGeneralOptions.call(this);
    this.addCommand('피사계 심도', 'depthOfField');
};

//=============================================================================
// DepthOfField 시스템 관리
//=============================================================================

var DepthOfField = {};
DepthOfField._active = false;
DepthOfField._composer = null;
DepthOfField._tiltShiftPass = null;
DepthOfField._debugSection = null;

window.DepthOfField = DepthOfField;

DepthOfField.config = {
    focusY: 0.55,       // 포커스 중심 Y위치 (0=상단, 1=하단), 캐릭터 약간 아래
    focusRange: 0.1,    // 선명 영역 반폭
    maxblur: 0.05,      // 최대 블러
    blurPower: 1.5      // 블러 증가 커브 (1=선형, 2=이차, 부드러운 전환)
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
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
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

    // 가시성 복원 (UI는 UIRenderPass에서 별도 렌더)
    if (stageObj) {
        for (var i = 0; i < stageObj.children.length; i++) {
            stageObj.children[i].visible = childVisibility[i];
        }
    }
    renderer.autoClear = true;
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

// --- UIRenderPass (블러 후 UI를 선명하게 합성) ---
function UIRenderPass(scene, camera, spriteset, stage) {
    this.scene = scene;
    this.camera = camera;
    this.spriteset = spriteset;
    this.stage = stage;
    this.enabled = true;
    this.needsSwap = false;
    this.renderToScreen = true;
}

UIRenderPass.prototype.setSize = function() {};

UIRenderPass.prototype.render = function(renderer /*, writeBuffer, readBuffer */) {
    var scene = this.scene;
    var stageObj = this.stage ? this.stage._threeObj : null;
    if (!stageObj) return;

    // spriteset(맵)을 숨기고 UI만 표시
    var spritesetObj = this.spriteset._threeObj;
    var childVisibility = [];
    for (var i = 0; i < stageObj.children.length; i++) {
        childVisibility.push(stageObj.children[i].visible);
        stageObj.children[i].visible = (stageObj.children[i] !== spritesetObj) && childVisibility[i];
    }

    // 하늘도 숨김
    var skyWasVisible = false;
    for (var si = 0; si < scene.children.length; si++) {
        if (scene.children[si]._isParallaxSky) {
            skyWasVisible = scene.children[si].visible;
            scene.children[si].visible = false;
            break;
        }
    }

    // 블러된 맵 위에 UI를 합성 (clear 하지 않음)
    var prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.render(scene, this.camera);
    renderer.autoClear = prevAutoClear;

    // 가시성 복원
    for (var i = 0; i < stageObj.children.length; i++) {
        stageObj.children[i].visible = childVisibility[i];
    }
    for (var si = 0; si < scene.children.length; si++) {
        if (scene.children[si]._isParallaxSky) {
            scene.children[si].visible = skyWasVisible;
            break;
        }
    }
};

UIRenderPass.prototype.dispose = function() {};

//=============================================================================
// DepthOfField - Composer 생성/파괴
//=============================================================================

DepthOfField._createComposer = function(rendererObj, stage) {
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
    var uiPass = new UIRenderPass(scene, camera, Mode3D._spriteset, stage);
    composer.addPass(uiPass);

    this._composer = composer;
    this._tiltShiftPass = tiltShiftPass;
    this._renderPass = renderPass;
    this._uiPass = uiPass;
    this._lastStage = stage;
};

DepthOfField._disposeComposer = function() {
    if (this._composer) {
        this._composer.dispose();
        this._composer = null;
        this._tiltShiftPass = null;
        this._renderPass = null;
        this._uiPass = null;
        this._lastStage = null;
    }
    // lerp 상태 초기화
    this._currentFocusY = null;
    this._currentFocusRange = null;
    this._currentMaxBlur = null;
    this._currentBlurPower = null;
};

// 카메라존 DoF lerp 상태
DepthOfField._currentFocusY = null;
DepthOfField._currentFocusRange = null;
DepthOfField._currentMaxBlur = null;
DepthOfField._currentBlurPower = null;

DepthOfField._updateUniforms = function() {
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

//=============================================================================
// ThreeRendererStrategy.render 오버라이드 - DoF 적용
// Mode3D.js에서 이미 오버라이드한 render를 다시 오버라이드
//=============================================================================

var _ThreeStrategy = RendererStrategy._strategies['threejs'];
var _prevRender = _ThreeStrategy.render;

_ThreeStrategy.render = function(rendererObj, stage) {
    if (!rendererObj || !stage) return;

    var is3D = ConfigManager.mode3d && Mode3D._spriteset;
    var isDoF = is3D && ConfigManager.depthOfField;

    if (isDoF) {
        // Composer가 없거나 stage가 바뀌면 재생성
        if (!DepthOfField._composer || DepthOfField._lastStage !== stage) {
            // 먼저 기존 Mode3D 준비 작업을 해야 함
            var w = rendererObj._width;
            var h = rendererObj._height;
            if (!Mode3D._perspCamera) {
                Mode3D._perspCamera = Mode3D._createPerspCamera(w, h);
            }
            DepthOfField._createComposer(rendererObj, stage);
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
        DepthOfField._renderPass.perspCamera = Mode3D._perspCamera;
        DepthOfField._renderPass.spriteset = Mode3D._spriteset;
        DepthOfField._renderPass.stage = stage;
        DepthOfField._renderPass.scene = scene;
        DepthOfField._renderPass.camera = camera;

        // UIRenderPass에 최신 참조 반영
        DepthOfField._uiPass.spriteset = Mode3D._spriteset;
        DepthOfField._uiPass.stage = stage;
        DepthOfField._uiPass.scene = scene;
        DepthOfField._uiPass.camera = camera;

        // uniform 갱신
        DepthOfField._updateUniforms();

        // Composer 크기 동기화
        var composerNeedsResize = (
            DepthOfField._composer.renderTarget1.width !== w ||
            DepthOfField._composer.renderTarget1.height !== h
        );
        if (composerNeedsResize) {
            DepthOfField._composer.setSize(w, h);
        }

        // Shadow Map: multi-pass 렌더링에서 shadow map은 MapRenderPass의
        // Pass 1에서만 갱신되도록 autoUpdate=false로 감싸기
        var prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;

        // 렌더!
        DepthOfField._composer.render();

        renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
        Mode3D._active = true;
    } else {
        // DoF 비활성 → 기존 렌더 경로
        if (DepthOfField._composer) {
            DepthOfField._disposeComposer();
        }
        _prevRender.call(this, rendererObj, stage);
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
    var shouldBeActive = ConfigManager.mode3d && ConfigManager.depthOfField;

    if (shouldShowDebug && !DepthOfField._debugSection) {
        DepthOfField._createDebugUI();
    } else if (!shouldShowDebug && DepthOfField._debugSection) {
        DepthOfField._removeDebugUI();
    }

    if (shouldBeActive && !DepthOfField._active) {
        DepthOfField._active = true;
    } else if (!shouldBeActive && DepthOfField._active) {
        DepthOfField._active = false;
        DepthOfField._disposeComposer();
    }
};

//=============================================================================
// Debug UI - ShadowLight Debug 패턴과 동일한 스타일
//=============================================================================

DepthOfField._createDebugUI = function() {
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

DepthOfField._removeDebugUI = function() {
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

    if (command === 'DoF' || command === 'DepthOfField') {
        if (args[0] === 'on') ConfigManager.depthOfField = true;
        if (args[0] === 'off') ConfigManager.depthOfField = false;
        if (args[0] === 'focusY' && args[1]) {
            DepthOfField.config.focusY = parseFloat(args[1]);
        }
        if (args[0] === 'focusRange' && args[1]) {
            DepthOfField.config.focusRange = parseFloat(args[1]);
        }
        if (args[0] === 'maxblur' && args[1]) {
            DepthOfField.config.maxblur = parseFloat(args[1]);
        }
        if (args[0] === 'blurPower' && args[1]) {
            DepthOfField.config.blurPower = parseFloat(args[1]);
        }
    }
};

})();
