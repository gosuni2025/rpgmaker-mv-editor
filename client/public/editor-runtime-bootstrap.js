//=============================================================================
// editor-runtime-bootstrap.js
// 에디터에서 게임 런타임을 사용하기 위한 글로벌 스텁 설정
// index.html에서 런타임 JS 로드 전에 실행되어야 함
//
// rpg_managers.js, rpg_objects.js, rpg_sprites.js가 실제 로드되므로
// ImageManager, DataManager, Game_Map, Spriteset_Map 등은 스텁 불필요.
// 런타임보다 먼저 필요한 최소한의 글로벌만 설정.
//=============================================================================

// --- 에디터 모드 플래그 (ShadowLight 디버그 UI 억제용) ---
window.__editorMode = true;

// --- Point class (rpg_core.js Tilemap에서 사용) ---
if (typeof Point === 'undefined') {
    function Point(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    Point.prototype.constructor = Point;
    window.Point = Point;
}

// --- Number.prototype.mod (rpg_core.js Tilemap._readMapData에서 사용) ---
if (!Number.prototype.mod) {
    Number.prototype.mod = function(n) {
        return ((this % n) + n) % n;
    };
}

// --- Graphics stub ---
window.Graphics = window.Graphics || {
    width: 816,
    height: 624,
    _width: 816,
    _height: 624,
    _renderer: null,
    _canvas: null,
    boxWidth: 816,
    boxHeight: 624,
    frameCount: 0,
    _skipCount: 0,
    _realScale: 1,
    scale: 1,
    isWebGL: function() { return true; },
    hasWebGL: function() { return true; },
    initialize: function() {},
    render: function() {},
    startLoading: function() {},
    endLoading: function() {},
    updateLoading: function() {},
    printError: function(name, msg) { console.error('[Graphics]', name, msg); },
    showFps: function() {},
    tickStart: function() {},
    tickEnd: function() {},
    setVideoVolume: function() {},
    setLoadingImage: function() {},
    _setupCssFontLoading: function() {},
};

// --- ConfigManager stub ---
window.ConfigManager = window.ConfigManager || {
    mode3d: false,
    shadowLight: false,
    depthOfField: false,
    masterVolume: 1,
    bgmVolume: 100,
    bgsVolume: 100,
    meVolume: 100,
    seVolume: 100,
    alwaysDash: false,
    commandRemember: false,
    readFlag: function() { return true; },
    save: function() {},
    load: function() {},
    makeData: function() { return {}; },
    applyData: function() {},
};

// --- PluginManager stub ---
window.PluginManager = window.PluginManager || {
    _scripts: [],
    _parameters: {},
    parameters: function(name) {
        return this._parameters[name] || {};
    },
    setup: function() {},
    setParameters: function() {},
    loadScript: function() {},
    onError: function() {},
    checkErrors: function() {},
};

// --- SceneManager stub ---
window.SceneManager = window.SceneManager || {
    _scene: null,
    _stopped: true,
    _screenWidth: 816,
    _screenHeight: 624,
    _boxWidth: 816,
    _boxHeight: 624,
    preferableRendererType: function() { return 'webgl'; },
    shouldUseCanvasRenderer: function() { return false; },
    initialize: function() {},
    run: function() {},
    goto: function() {},
    isSceneChanging: function() { return false; },
    isCurrentSceneBusy: function() { return false; },
    isNextScene: function() { return false; },
    catchException: function() {},
    onError: function() {},
    onKeyDown: function() {},
    changeScene: function() {},
    updateScene: function() {},
    renderScene: function() {},
    onSceneCreate: function() {},
    onSceneStart: function() {},
    onSceneLoading: function() {},
    snap: function() { return {}; },
    snapForBackground: function() {},
    backgroundBitmap: function() { return null; },
    resume: function() {},
    setupErrorHandlers: function() {},
    requestUpdate: function() {},
    update: function() {},
    terminate: function() {},
    checkFileAccess: function() {},
    initGraphics: function() {},
    initAudio: function() {},
    initInput: function() {},
    initNwjs: function() {},
};

// --- SoundManager stub ---
window.SoundManager = window.SoundManager || {
    preloadImportantSounds: function() {},
    playSystemSound: function() {},
    playCursor: function() {},
    playOk: function() {},
    playCancel: function() {},
    playBuzzer: function() {},
    playEquip: function() {},
    playSave: function() {},
    playLoad: function() {},
    playBattleStart: function() {},
    playEscape: function() {},
    playEnemyAttack: function() {},
    playEnemyDamage: function() {},
    playEnemyCollapse: function() {},
    playBossCollapse1: function() {},
    playBossCollapse2: function() {},
    playActorDamage: function() {},
    playActorCollapse: function() {},
    playRecovery: function() {},
    playMiss: function() {},
    playEvasion: function() {},
    playMagicEvasion: function() {},
    playReflection: function() {},
    playShop: function() {},
    playUseItem: function() {},
    playUseSkill: function() {},
};

// --- AudioManager stub ---
window.AudioManager = window.AudioManager || {
    _masterVolume: 1,
    _bgmVolume: 100,
    _bgsVolume: 100,
    _meVolume: 100,
    _seVolume: 100,
    _currentBgm: null,
    _currentBgs: null,
    playBgm: function() {},
    stopBgm: function() {},
    playBgs: function() {},
    stopBgs: function() {},
    playMe: function() {},
    stopMe: function() {},
    playSe: function() {},
    stopSe: function() {},
    playStaticSe: function() {},
    stopAll: function() {},
    saveBgm: function() { return null; },
    replayBgm: function() {},
    isCurrentBgm: function() { return false; },
    updateBgmParameters: function() {},
    updateCurrentBgm: function() {},
    fadeOutBgm: function() {},
    fadeOutBgs: function() {},
    fadeInBgm: function() {},
    fadeInBgs: function() {},
    masterVolume: 1,
    bgmVolume: 100,
    bgsVolume: 100,
    meVolume: 100,
    seVolume: 100,
    updateBufferParameters: function() {},
    checkErrors: function() {},
    createBuffer: function() { return null; },
    _bgmBuffer: null,
    _bgsBuffer: null,
    _meBuffer: null,
    _seBuffers: [],
    _staticBuffers: [],
};

// --- BattleManager stub (rpg_objects.js Game_Troop 등에서 참조 가능) ---
window.BattleManager = window.BattleManager || {
    setup: function() {},
    initMembers: function() {},
    isBattleTest: function() { return false; },
    startBattle: function() {},
    displayStartMessages: function() {},
    _canEscape: false,
    _canLose: false,
    _phase: '',
    _inputting: false,
};

// --- StorageManager stub ---
window.StorageManager = window.StorageManager || {
    save: function() {},
    load: function() { return null; },
    exists: function() { return false; },
    remove: function() {},
    backup: function() {},
    backupExists: function() { return false; },
    cleanBackup: function() {},
    isLocalMode: function() { return false; },
    webStorageKey: function() { return ''; },
    localFileDirectoryPath: function() { return ''; },
    localFilePath: function() { return ''; },
};

// --- $data* 전역 변수 초기화 (rpg_managers.js에서 var 선언되므로 여기서 미리 window에 설정) ---
window.$dataActors = null;
window.$dataClasses = null;
window.$dataSkills = null;
window.$dataItems = null;
window.$dataWeapons = null;
window.$dataArmors = null;
window.$dataEnemies = null;
window.$dataTroops = null;
window.$dataStates = null;
window.$dataAnimations = null;
window.$dataTilesets = null;
window.$dataCommonEvents = null;
window.$dataSystem = null;
window.$dataMapInfos = null;
window.$dataMap = null;

// --- Window_Options stub (Mode3D.js, ShadowAndLight.js에서 프로토타입 확장) ---
if (typeof Window_Options === 'undefined') {
    function Window_Options() {}
    Window_Options.prototype.addGeneralOptions = function() {};
    Window_Options.prototype.addCommand = function() {};
    Window_Options.prototype.statusText = function() { return ''; };
    Window_Options.prototype.processOk = function() {};
    Window_Options.prototype.cursorRight = function() {};
    Window_Options.prototype.cursorLeft = function() {};
    Window_Options.prototype.setConfigValue = function(symbol, value) { ConfigManager[symbol] = value; };
    window.Window_Options = Window_Options;
}

// --- Window_Base stub ---
if (typeof Window_Base === 'undefined') {
    function Window_Base() {}
    window.Window_Base = Window_Base;
}

// --- Scene_Map stub (Mode3D.js, ShadowAndLight.js에서 프로토타입 확장) ---
if (typeof Scene_Map === 'undefined') {
    function Scene_Map() {}
    Scene_Map.prototype.terminate = function() {};
    window.Scene_Map = Scene_Map;
}

// 런타임 로드 완료 플래그
window._editorRuntimeReady = false;

// --- Three.js ShaderChunk 글로벌 패치: Y-flip 라이팅 수정 ---
// Y-flip(m[5]=-m[5])으로 인해 gl_FrontFacing이 반전 → DOUBLE_SIDED에서
// faceDirection=-1 → 노멀이 뒤집혀 빛 방향이 거꾸로 되는 문제 수정.
//
// 해결: normal_fragment_begin에서 faceDirection을 항상 1.0으로 강제.
// 우리 엔진은 이미 geometry 노멀을 Z=-1로 수동 설정하여 y-flip에 대응하므로
// gl_FrontFacing 기반 뒤집기가 필요 없음 (오히려 이중 반전이 됨).
if (typeof THREE !== 'undefined' && THREE.ShaderChunk) {
    // 1) normal_fragment_begin: faceDirection을 항상 1.0으로 강제
    var normalChunkKey = 'normal_fragment_begin';
    if (THREE.ShaderChunk[normalChunkKey]) {
        var normalOrig = 'float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;';
        var normalPatch = 'float faceDirection = 1.0;';
        if (THREE.ShaderChunk[normalChunkKey].indexOf(normalOrig) >= 0) {
            THREE.ShaderChunk[normalChunkKey] = THREE.ShaderChunk[normalChunkKey].replace(normalOrig, normalPatch);
            console.log('[Editor] ShaderChunk patched: normal_fragment_begin (faceDirection=1.0)');
        }
    }
    // 2) Lambert vertex shader: vLightBack을 vLightFront와 동일하게
    //    (fragment에서 gl_FrontFacing으로 vLightBack을 선택하더라도 동일한 값)
    var lambertChunkKey = 'lights_lambert_vertex';
    if (THREE.ShaderChunk[lambertChunkKey]) {
        var lambOriginal = 'vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;';
        var lambPatched = 'vLightBack += saturate( dotNL ) * directLightColor_Diffuse;';
        var chunk = THREE.ShaderChunk[lambertChunkKey];
        while (chunk.indexOf(lambOriginal) >= 0) {
            chunk = chunk.replace(lambOriginal, lambPatched);
        }
        if (chunk !== THREE.ShaderChunk[lambertChunkKey]) {
            THREE.ShaderChunk[lambertChunkKey] = chunk;
            console.log('[Editor] ShaderChunk patched: lights_lambert_vertex (bilateral)');
        }
    }
    // 3) Lambert fragment: gl_FrontFacing 선택도 항상 Front를 사용하도록
    var lambFragKey = 'meshlambert_frag';
    if (THREE.ShaderChunk[lambFragKey]) {
        // Direct diffuse
        var lfOrig1 = 'reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;';
        var lfPatch1 = 'reflectedLight.directDiffuse = vLightFront;';
        // Indirect diffuse
        var lfOrig2 = 'reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;';
        var lfPatch2 = 'reflectedLight.indirectDiffuse += vIndirectFront;';
        var lfChunk = THREE.ShaderChunk[lambFragKey];
        if (lfChunk.indexOf(lfOrig1) >= 0 || lfChunk.indexOf(lfOrig2) >= 0) {
            lfChunk = lfChunk.replace(lfOrig1, lfPatch1).replace(lfOrig2, lfPatch2);
            THREE.ShaderChunk[lambFragKey] = lfChunk;
            console.log('[Editor] ShaderChunk patched: meshlambert_frag (bypass gl_FrontFacing)');
        }
    }
}

// --- ImageManager 캐시 주기적 정리 ---
// 에디터에서는 SceneManager가 스텁이므로 CacheMap.update()가 호출되지 않음.
// ImageCacheManager 플러그인이 없을 때만 실행 (있으면 해당 플러그인이 캐시를 제어).
(function() {
    var cacheCleanupStarted = false;
    function startCacheCleanup() {
        if (cacheCleanupStarted) return;
        if (!window.ImageManager || !window.ImageManager.cache) return;
        // ImageCacheManager 플러그인이 설치된 경우 건너뜀
        if (window._imageCacheManagerActive) return;
        cacheCleanupStarted = true;

        setInterval(function() {
            // CacheMap TTL 체크
            if (window.ImageManager.cache && window.ImageManager.cache.update) {
                window.ImageManager.cache.update(1, 1);
            }
            if (window.ImageManager._imageCache && window.ImageManager._imageCache._truncateCache) {
                window.ImageManager._imageCache._truncateCache();
            }
        }, 30000); // 30초마다
        console.log('[Editor] ImageManager cache cleanup started (30s interval)');
    }
    // 런타임 로드 후 시작되도록 지연
    var checkInterval = setInterval(function() {
        if (window.ImageManager && window.ImageManager.cache) {
            clearInterval(checkInterval);
            startCacheCleanup();
        }
    }, 1000);
})();

console.log('[Editor] Runtime bootstrap globals initialized');
