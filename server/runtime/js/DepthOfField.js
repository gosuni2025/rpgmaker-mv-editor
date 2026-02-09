//=============================================================================
// DepthOfField.js - Three.js Depth of Field (Bokeh) Post-processing
//=============================================================================
// 3D 모드에서 Bokeh DoF 포스트프로세싱 효과를 적용합니다.
//
// - EffectComposer / RenderPass / BokehPass를 내장 (Three.js r128 호환)
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
ConfigManager.dofFocus = 500;
ConfigManager.dofAperture = 5;    // 실제값 * 1000 (0~100 정수로 관리, 표시: 0.005)
ConfigManager.dofMaxblur = 10;    // 실제값 * 1000 (0~100 정수로 관리, 표시: 0.010)

var _ConfigManager_makeData = ConfigManager.makeData;
ConfigManager.makeData = function() {
    var config = _ConfigManager_makeData.call(this);
    config.depthOfField = this.depthOfField;
    config.dofFocus = this.dofFocus;
    config.dofAperture = this.dofAperture;
    config.dofMaxblur = this.dofMaxblur;
    return config;
};

var _ConfigManager_applyData = ConfigManager.applyData;
ConfigManager.applyData = function(config) {
    _ConfigManager_applyData.call(this, config);
    this.depthOfField = this.readFlag(config, 'depthOfField');
    this.dofFocus = this.readDofValue(config, 'dofFocus', 500);
    this.dofAperture = this.readDofValue(config, 'dofAperture', 5);
    this.dofMaxblur = this.readDofValue(config, 'dofMaxblur', 10);
};

ConfigManager.readDofValue = function(config, name, defaultValue) {
    var value = config[name];
    if (value !== undefined) {
        return Number(value);
    }
    return defaultValue;
};

//=============================================================================
// Window_Options - DoF 옵션 추가
//=============================================================================

// DoF 심볼 정의
var DOF_SYMBOLS = {
    'dofFocus':    { min: 10,  max: 2000, step: 50,  label: '초점 거리', format: function(v) { return v; } },
    'dofAperture': { min: 0,   max: 100,  step: 1,   label: '조리개',    format: function(v) { return (v / 1000).toFixed(3); } },
    'dofMaxblur':  { min: 0,   max: 100,  step: 1,   label: '최대 블러', format: function(v) { return (v / 1000).toFixed(3); } }
};

var _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
Window_Options.prototype.addGeneralOptions = function() {
    _Window_Options_addGeneralOptions.call(this);
    this.addCommand('피사계 심도', 'depthOfField');
    this.addCommand('  초점 거리', 'dofFocus');
    this.addCommand('  조리개', 'dofAperture');
    this.addCommand('  최대 블러', 'dofMaxblur');
};

Window_Options.prototype.isDofSymbol = function(symbol) {
    return !!DOF_SYMBOLS[symbol];
};

var _Window_Options_statusText = Window_Options.prototype.statusText;
Window_Options.prototype.statusText = function(index) {
    var symbol = this.commandSymbol(index);
    if (this.isDofSymbol(symbol)) {
        var value = this.getConfigValue(symbol);
        return DOF_SYMBOLS[symbol].format(value);
    }
    return _Window_Options_statusText.call(this, index);
};

var _Window_Options_processOk = Window_Options.prototype.processOk;
Window_Options.prototype.processOk = function() {
    var index = this.index();
    var symbol = this.commandSymbol(index);
    if (this.isDofSymbol(symbol)) {
        var def = DOF_SYMBOLS[symbol];
        var value = this.getConfigValue(symbol);
        value += def.step;
        if (value > def.max) value = def.min;
        this.changeValue(symbol, value);
    } else {
        _Window_Options_processOk.call(this);
    }
};

var _Window_Options_cursorRight = Window_Options.prototype.cursorRight;
Window_Options.prototype.cursorRight = function(wrap) {
    var index = this.index();
    var symbol = this.commandSymbol(index);
    if (this.isDofSymbol(symbol)) {
        var def = DOF_SYMBOLS[symbol];
        var value = this.getConfigValue(symbol);
        value += def.step;
        value = Math.min(value, def.max);
        this.changeValue(symbol, value);
    } else {
        _Window_Options_cursorRight.call(this, wrap);
    }
};

var _Window_Options_cursorLeft = Window_Options.prototype.cursorLeft;
Window_Options.prototype.cursorLeft = function(wrap) {
    var index = this.index();
    var symbol = this.commandSymbol(index);
    if (this.isDofSymbol(symbol)) {
        var def = DOF_SYMBOLS[symbol];
        var value = this.getConfigValue(symbol);
        value -= def.step;
        value = Math.max(value, def.min);
        this.changeValue(symbol, value);
    } else {
        _Window_Options_cursorLeft.call(this, wrap);
    }
};

// DoF 옵션 값 변경 시 DepthOfField.config에 실시간 반영
var _Window_Options_setConfigValue = Window_Options.prototype.setConfigValue;
Window_Options.prototype.setConfigValue = function(symbol, value) {
    _Window_Options_setConfigValue.call(this, symbol, value);
    if (symbol === 'dofFocus') {
        DepthOfField.config.focus = value;
    } else if (symbol === 'dofAperture') {
        DepthOfField.config.aperture = value / 1000;
    } else if (symbol === 'dofMaxblur') {
        DepthOfField.config.maxblur = value / 1000;
    }
};

//=============================================================================
// DepthOfField 시스템 관리
//=============================================================================

var DepthOfField = {};
DepthOfField._active = false;
DepthOfField._composer = null;
DepthOfField._bokehPass = null;
DepthOfField._renderTarget = null;
DepthOfField._debugPanel = null;

window.DepthOfField = DepthOfField;

DepthOfField.config = {
    focus: 500.0,
    aperture: 0.005,
    maxblur: 0.01
};

//=============================================================================
// Bokeh Shader (Three.js examples 기반, r128 호환)
//=============================================================================

var BokehShader = {
    uniforms: {
        tColor:    { value: null },
        tDepth:    { value: null },
        focus:     { value: 500.0 },
        aperture:  { value: 0.005 },
        maxblur:   { value: 0.01 },
        nearClip:  { value: 1.0 },
        farClip:   { value: 1000.0 },
        aspect:    { value: 1.0 }
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
        'uniform sampler2D tDepth;',
        '',
        'uniform float maxblur;',
        'uniform float aperture;',
        'uniform float nearClip;',
        'uniform float farClip;',
        'uniform float focus;',
        'uniform float aspect;',
        '',
        'float getDepth(const in vec2 screenPos) {',
        '    float fragCoordZ = texture2D(tDepth, screenPos).x;',
        '    return fragCoordZ;',
        '}',
        '',
        'float getViewZ(const in float depth) {',
        '    return nearClip * farClip / (farClip - depth * (farClip - nearClip));',
        '}',
        '',
        'void main() {',
        '    vec2 aspectCorrect = vec2(1.0, aspect);',
        '',
        '    float viewZ = getViewZ(getDepth(vUv));',
        '    float factor = (focus + viewZ);',
        '',
        '    vec2 dofblur = vec2(clamp(factor * aperture, -maxblur, maxblur));',
        '',
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
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}

FullScreenQuad.prototype.render = function(renderer) {
    renderer.render(this._mesh, this._camera);
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
    this.needsSwap = false;
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

    // Pass 2: OrthographicCamera - UI
    if (stageObj) {
        for (var i = 0; i < stageObj.children.length; i++) {
            var child = stageObj.children[i];
            child.visible = childVisibility[i];
            if (child === spritesetObj) {
                child.visible = false;
            }
        }
    }

    renderer.autoClear = false;
    renderer.render(scene, this.camera);

    // 가시성 복원
    if (stageObj) {
        for (var i = 0; i < stageObj.children.length; i++) {
            stageObj.children[i].visible = childVisibility[i];
        }
    }
    renderer.autoClear = true;
};

MapRenderPass.prototype.dispose = function() {};

// --- BokehPass ---
function BokehPass(scene, camera, params) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.needsSwap = true;
    this.renderToScreen = false;

    var focus = (params && params.focus !== undefined) ? params.focus : 500.0;
    var aperture = (params && params.aperture !== undefined) ? params.aperture : 0.005;
    var maxblur = (params && params.maxblur !== undefined) ? params.maxblur : 0.01;

    // depth render target
    this.depthTarget = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter
    });
    this.depthTarget.texture.name = 'BokehPass.depth';
    this.depthTarget.depthTexture = new THREE.DepthTexture();
    this.depthTarget.depthTexture.type = THREE.UnsignedShortType;

    // depth material (override)
    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
    this.depthMaterial.blending = THREE.NoBlending;

    // bokeh shader material
    this.uniforms = THREE.UniformsUtils.clone(BokehShader.uniforms);
    this.uniforms.focus.value = focus;
    this.uniforms.aperture.value = aperture;
    this.uniforms.maxblur.value = maxblur;
    this.uniforms.nearClip.value = camera.near;
    this.uniforms.farClip.value = camera.far;
    this.uniforms.aspect.value = camera.aspect || 1.0;

    this.materialBokeh = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: BokehShader.vertexShader,
        fragmentShader: BokehShader.fragmentShader
    });

    this.fsQuad = new FullScreenQuad(this.materialBokeh);
}

BokehPass.prototype.setSize = function(width, height) {
    this.depthTarget.setSize(width, height);
};

BokehPass.prototype.render = function(renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */) {
    var scene = this.scene;
    var camera = this.camera;

    // depth pass - scene의 모든 오브젝트를 depthMaterial로 렌더
    var oldOverride = scene.overrideMaterial;
    scene.overrideMaterial = this.depthMaterial;
    renderer.setRenderTarget(this.depthTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = oldOverride;

    // bokeh pass
    this.uniforms.tColor.value = readBuffer.texture;
    this.uniforms.tDepth.value = this.depthTarget.depthTexture;
    this.uniforms.nearClip.value = camera.near;
    this.uniforms.farClip.value = camera.far;
    this.uniforms.aspect.value = (camera.aspect || 1.0);

    if (this.renderToScreen) {
        renderer.setRenderTarget(null);
    } else {
        renderer.setRenderTarget(writeBuffer);
        renderer.clear();
    }
    this.fsQuad.render(renderer);
};

BokehPass.prototype.dispose = function() {
    this.depthTarget.dispose();
    this.materialBokeh.dispose();
    this.fsQuad.dispose();
};

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

    // BokehPass
    var bokehPass = new BokehPass(scene, Mode3D._perspCamera, {
        focus: this.config.focus,
        aperture: this.config.aperture,
        maxblur: this.config.maxblur
    });
    bokehPass.renderToScreen = true;
    composer.addPass(bokehPass);

    this._composer = composer;
    this._bokehPass = bokehPass;
    this._renderPass = renderPass;
    this._lastStage = stage;
};

DepthOfField._disposeComposer = function() {
    if (this._composer) {
        this._composer.dispose();
        this._composer = null;
        this._bokehPass = null;
        this._renderPass = null;
        this._lastStage = null;
    }
};

DepthOfField._updateUniforms = function() {
    if (!this._bokehPass) return;
    this._bokehPass.uniforms.focus.value = this.config.focus;
    this._bokehPass.uniforms.aperture.value = this.config.aperture;
    this._bokehPass.uniforms.maxblur.value = this.config.maxblur;
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

        // PerspectiveCamera 위치 갱신
        Mode3D._positionCamera(Mode3D._perspCamera, w, h);
        Mode3D._applyBillboards();
        Mode3D._enforceNearestFilter(scene);

        // RenderPass에 최신 참조 반영
        DepthOfField._renderPass.perspCamera = Mode3D._perspCamera;
        DepthOfField._renderPass.spriteset = Mode3D._spriteset;
        DepthOfField._renderPass.stage = stage;
        DepthOfField._renderPass.scene = scene;
        DepthOfField._renderPass.camera = camera;

        // BokehPass의 카메라도 갱신
        DepthOfField._bokehPass.camera = Mode3D._perspCamera;

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

        // 렌더!
        DepthOfField._composer.render();

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

// ConfigManager → DepthOfField.config 동기화
DepthOfField._syncConfigFromManager = function() {
    this.config.focus = ConfigManager.dofFocus;
    this.config.aperture = ConfigManager.dofAperture / 1000;
    this.config.maxblur = ConfigManager.dofMaxblur / 1000;
};

var _Spriteset_Map_update_dof = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update_dof.call(this);

    var shouldBeActive = ConfigManager.mode3d && ConfigManager.depthOfField;

    if (shouldBeActive && !DepthOfField._active) {
        DepthOfField._active = true;
        DepthOfField._syncConfigFromManager();
        DepthOfField._createDebugUI();
    } else if (!shouldBeActive && DepthOfField._active) {
        DepthOfField._active = false;
        DepthOfField._removeDebugUI();
        DepthOfField._disposeComposer();
    }
};

//=============================================================================
// Debug UI - ShadowLight Debug 패턴과 동일한 스타일
//=============================================================================

DepthOfField._createDebugUI = function() {
    if (this._debugPanel) return;

    var panel = document.createElement('div');
    panel.id = 'dof-debug-panel';
    // ShadowLight Debug 패널이 오른쪽 상단이므로, 그 아래에 위치
    panel.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;background:rgba(0,0,0,0.85);color:#eee;font:12px monospace;padding:10px;border-radius:6px;min-width:240px;pointer-events:auto;';

    var title = document.createElement('div');
    title.textContent = 'DoF Debug';
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#88ccff;';
    panel.appendChild(title);

    var self = this;
    var controls = [
        { label: 'Focus', key: 'focus', min: 0, max: 2000, step: 10, decimals: 0 },
        { label: 'Aperture', key: 'aperture', min: 0, max: 0.1, step: 0.0005, decimals: 4 },
        { label: 'Max Blur', key: 'maxblur', min: 0, max: 0.1, step: 0.001, decimals: 3 }
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
            // ConfigManager에도 동기화
            if (c.key === 'focus') ConfigManager.dofFocus = v;
            else if (c.key === 'aperture') ConfigManager.dofAperture = Math.round(v * 1000);
            else if (c.key === 'maxblur') ConfigManager.dofMaxblur = Math.round(v * 1000);
        });

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(val);
        panel.appendChild(row);
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
    panel.appendChild(toggleRow);

    // 현재값 복사 버튼
    var copyBtn = document.createElement('button');
    copyBtn.textContent = '현재값 복사';
    copyBtn.style.cssText = 'margin-top:8px;width:100%;padding:4px 8px;font:11px monospace;background:#446;color:#eee;border:1px solid #668;border-radius:3px;cursor:pointer;';
    copyBtn.addEventListener('click', function() {
        var cfg = self.config;
        var text = [
            'focus: ' + cfg.focus,
            'aperture: ' + cfg.aperture,
            'maxblur: ' + cfg.maxblur
        ].join('\n');

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
                copyBtn.textContent = '복사 완료!';
                setTimeout(function() { copyBtn.textContent = '현재값 복사'; }, 1500);
            });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = '복사 완료!';
            setTimeout(function() { copyBtn.textContent = '현재값 복사'; }, 1500);
        }
    });
    copyBtn.addEventListener('mouseover', function() { copyBtn.style.background = '#557'; });
    copyBtn.addEventListener('mouseout', function() { copyBtn.style.background = '#446'; });
    panel.appendChild(copyBtn);

    document.body.appendChild(panel);
    this._debugPanel = panel;
};

DepthOfField._removeDebugUI = function() {
    if (this._debugPanel) {
        this._debugPanel.remove();
        this._debugPanel = null;
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
        if (args[0] === 'focus' && args[1]) {
            DepthOfField.config.focus = parseFloat(args[1]);
        }
        if (args[0] === 'aperture' && args[1]) {
            DepthOfField.config.aperture = parseFloat(args[1]);
        }
        if (args[0] === 'maxblur' && args[1]) {
            DepthOfField.config.maxblur = parseFloat(args[1]);
        }
    }
};

})();
