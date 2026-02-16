//=============================================================================
// FogOfWarDevPanel.js - FOW 디버그 패널 (런타임, 2D + 3D)
//=============================================================================
// URL에 ?dev=true 시 활성화
// FOW 셰이더 파라미터를 실시간으로 조절 가능
// 의존: DevPanelUtils.js, FogOfWar.js
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev') && !window._forceDevPanel) return;

    var PANEL_ID = 'fogOfWarDevPanel';
    var panel = null;
    var panelCtrl = null;

    // ── 공통 파라미터 ──
    var COMMON_PARAMS = [
        { key: 'radius',             label: 'Radius',            min: 1,    max: 30,   step: 1,    def: 5 },
        { key: 'exploredAlpha',      label: 'Explored Alpha',    min: 0,    max: 1,    step: 0.05, def: 0.6 },
        { key: 'unexploredAlpha',    label: 'Unexplored Alpha',  min: 0,    max: 1,    step: 0.05, def: 1.0 },
        { key: 'lineOfSight',        label: 'Line of Sight',     min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'fogTransitionSpeed', label: 'Transition Spd',    min: 1,    max: 20,   step: 0.5,  def: 5.0 },
    ];

    // ── 2D 셰이더 파라미터 ──
    var PARAMS_2D_SHADER = [
        { key: 'dissolveStrength',   label: 'Tentacle Len',      min: 0,    max: 4.0,  step: 0.1,  def: 2.0,  shader: true },
        { key: 'fadeSmoothness',     label: 'Fade Range',        min: 0.05, max: 1.0,  step: 0.05, def: 0.3,  shader: true },
        { key: 'tentacleSharpness',  label: 'Sharpness',         min: 1.0,  max: 6.0,  step: 0.1,  def: 3.0,  shader: true },
        { key: 'edgeAnimation',      label: 'Edge Animation',    min: 0,    max: 1,    step: 1,    def: 1,    type: 'bool' },
        { key: 'edgeAnimationSpeed', label: 'Edge Anim Speed',   min: 0,    max: 5,    step: 0.1,  def: 1.0 },
    ];

    // ── 촉수 타이밍 파라미터 ──
    var PARAMS_TENTACLE = [
        { key: 'tentacleFadeDuration', label: 'Fade Duration',   min: 0.1,  max: 5.0,  step: 0.1,  def: 1.0 },
        { key: 'tentacleGrowDuration', label: 'Grow Duration',   min: 0.1,  max: 5.0,  step: 0.1,  def: 0.5 },
    ];

    // ── 3D 볼류메트릭 파라미터 ──
    var PARAMS_3D = [
        { key: 'fogHeight',            label: 'Fog Height',       min: 50,   max: 1000, step: 10,   def: 300 },
        { key: 'absorption',           label: 'Absorption',       min: 0.001,max: 0.1,  step: 0.001,def: 0.012 },
        { key: 'visibilityBrightness', label: 'Vis Brightness',   min: 0,    max: 1,    step: 0.05, def: 0.0 },
        { key: 'heightGradient',       label: 'Height Gradient',  min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'lineOfSight3D',        label: 'LoS 3D',           min: 0,    max: 1,    step: 1,    def: 0,   type: 'bool' },
        { key: 'eyeHeight',            label: 'Eye Height',       min: 0.5,  max: 5.0,  step: 0.1,  def: 1.5 },
        { key: 'godRay',               label: 'God Ray',          min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'godRayIntensity',      label: 'GodRay Intensity', min: 0,    max: 2,    step: 0.1,  def: 0.4 },
        { key: 'vortex',               label: 'Vortex',           min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'vortexSpeed',          label: 'Vortex Speed',     min: 0,    max: 5,    step: 0.1,  def: 1.0 },
        { key: 'lightScattering',      label: 'Light Scatter',    min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'lightScatterIntensity',label: 'Scatter Intensity',min: 0,    max: 3,    step: 0.1,  def: 1.0 },
    ];

    // 모든 파라미터 합치기 (슬라이더 생성/리셋용)
    var ALL_PARAMS = COMMON_PARAMS.concat(PARAMS_2D_SHADER).concat(PARAMS_TENTACLE).concat(PARAMS_3D);

    // 내부 키 → FogOfWar 프로퍼티 이름 매핑 (shader가 아닌 것만)
    var KEY_MAP = {
        radius: '_radius',
        exploredAlpha: '_exploredAlpha',
        unexploredAlpha: '_unexploredAlpha',
        lineOfSight: '_lineOfSight',
        fogTransitionSpeed: '_fogTransitionSpeed',
        edgeAnimation: '_edgeAnimation',
        edgeAnimationSpeed: '_edgeAnimationSpeed',
        tentacleFadeDuration: '_tentacleFadeDuration',
        tentacleGrowDuration: '_tentacleGrowDuration',
        // 3D
        lineOfSight3D: '_lineOfSight3D',
        eyeHeight: '_eyeHeight',
        fogHeight: '_fogHeight',
        absorption: '_absorption',
        visibilityBrightness: '_visibilityBrightness',
        heightGradient: '_heightGradient',
        godRay: '_godRay',
        godRayIntensity: '_godRayIntensity',
        vortex: '_vortex',
        vortexSpeed: '_vortexSpeed',
        lightScattering: '_lightScattering',
        lightScatterIntensity: '_lightScatterIntensity',
    };

    // 셰이더 오버라이드 저장소
    if (!window.FogOfWar) return;
    var FOW = window.FogOfWar;
    FOW._shaderOverrides = FOW._shaderOverrides || {};
    PARAMS_2D_SHADER.forEach(function(p) {
        if (p.shader && FOW._shaderOverrides[p.key] === undefined) {
            FOW._shaderOverrides[p.key] = p.def;
        }
    });

    var sliderEls = {}; // key → { slider, valueEl }
    var STORAGE_KEY = 'fowDevPanel';

    function saveToStorage() {
        var data = {};
        ALL_PARAMS.forEach(function(p) {
            if (p.shader) {
                data[p.key] = FOW._shaderOverrides[p.key];
            } else {
                var prop = KEY_MAP[p.key];
                if (prop && FOW[prop] !== undefined) {
                    data[p.key] = p.type === 'bool' ? (FOW[prop] ? 1 : 0) : FOW[prop];
                }
            }
        });
        data.fogColor = colorToHex(FOW._fogColor);
        data.fogColorTop = colorToHex(FOW._fogColorTop);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
    }

    function loadFromStorage() {
        var raw;
        try { raw = localStorage.getItem(STORAGE_KEY); } catch(e) { return; }
        if (!raw) return;
        var data;
        try { data = JSON.parse(raw); } catch(e) { return; }

        ALL_PARAMS.forEach(function(p) {
            if (data[p.key] === undefined) return;
            var val = data[p.key];
            applyParam(p, val);
            updateSlider(p.key, val);
        });
        if (data.fogColor) {
            FOW._fogColor = FOW._parseColor(data.fogColor);
            updateSlider('fogColor', data.fogColor);
        }
        if (data.fogColorTop) {
            FOW._fogColorTop = FOW._parseColor(data.fogColorTop);
            updateSlider('fogColorTop', data.fogColorTop);
        }
    }

    // RGB {r,g,b} (0~1) → '#rrggbb' 변환
    function colorToHex(c) {
        if (!c) return '#000000';
        var r = Math.round((c.r || 0) * 255);
        var g = Math.round((c.g || 0) * 255);
        var b = Math.round((c.b || 0) * 255);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // 현재 FOW 상태 → FogOfWarConfig 객체 생성
    function buildConfigObject() {
        var config = {
            enabled: true,
            radius: FOW._radius,
            fogColor: colorToHex(FOW._fogColor),
            unexploredAlpha: FOW._unexploredAlpha,
            exploredAlpha: FOW._exploredAlpha,
            lineOfSight: FOW._lineOfSight,
            edgeAnimation: FOW._edgeAnimation,
            edgeAnimationSpeed: FOW._edgeAnimationSpeed,
            fogTransitionSpeed: FOW._fogTransitionSpeed,
            tentacleFadeDuration: FOW._tentacleFadeDuration,
            tentacleGrowDuration: FOW._tentacleGrowDuration,
            // 3D
            lineOfSight3D: FOW._lineOfSight3D,
            eyeHeight: FOW._eyeHeight,
            fogHeight: FOW._fogHeight,
            absorption: FOW._absorption,
            visibilityBrightness: FOW._visibilityBrightness,
            fogColorTop: colorToHex(FOW._fogColorTop),
            heightGradient: FOW._heightGradient,
            godRay: FOW._godRay,
            godRayIntensity: FOW._godRayIntensity,
            vortex: FOW._vortex,
            vortexSpeed: FOW._vortexSpeed,
            lightScattering: FOW._lightScattering,
            lightScatterIntensity: FOW._lightScatterIntensity,
        };
        // 2D 셰이더 오버라이드 값 추가
        if (FOW._shaderOverrides) {
            PARAMS_2D_SHADER.forEach(function(p) {
                if (p.shader && FOW._shaderOverrides[p.key] !== undefined) {
                    config[p.key] = FOW._shaderOverrides[p.key];
                }
            });
        }
        return config;
    }

    function showCopyFeedback(btn, success) {
        var orig = btn.textContent;
        btn.textContent = success ? 'Copied!' : 'Failed';
        btn.style.background = success ? '#264' : '#644';
        setTimeout(function() {
            btn.textContent = orig;
            btn.style.background = '#345';
        }, 1200);
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'fow-dev-panel';
        panel.style.cssText = [
            'position:fixed', 'top:10px', 'right:10px', 'z-index:99998',
            'background:rgba(0,0,0,0.85)', 'color:#ddd',
            'font:11px/1.4 monospace', 'padding:6px 8px',
            'max-height:90vh', 'overflow-y:auto',
            'pointer-events:auto', 'user-select:none',
            'min-width:220px', 'max-width:280px',
            'border:1px solid #555', 'border-radius:4px',
            'scrollbar-width:thin', 'scrollbar-color:#555 transparent'
        ].join(';');

        // 타이틀
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;';
        var titleText = document.createElement('span');
        titleText.textContent = 'FOW Debug';
        titleText.style.cssText = 'font-size:12px;font-weight:bold;color:#f80;flex:1;';
        titleBar.appendChild(titleText);

        // FOW 모드 배지
        var modeBadge = document.createElement('span');
        modeBadge.id = 'fow-mode-badge';
        modeBadge.style.cssText = 'font-size:10px;font-weight:bold;padding:1px 6px;border-radius:3px;margin-left:4px;';
        titleBar.appendChild(modeBadge);
        panel.appendChild(titleBar);

        // 모드 배지 갱신 함수: mode3d 상태에 따라 자동 판단
        function updateModeBadge() {
            var is3d = window.Mode3D && window.Mode3D._active;
            var mode = is3d ? '3D' : '2D';
            var color = is3d ? '#f6a' : '#4a9';
            modeBadge.textContent = mode;
            modeBadge.style.background = color;
            modeBadge.style.color = '#000';
        }
        updateModeBadge();
        setInterval(updateModeBadge, 500);

        // 바디
        var body = document.createElement('div');
        body.id = 'fow-dev-body';

        // --- 안개 색상 ---
        addSection(body, '── Color ──');
        var fogColorRow = document.createElement('div');
        fogColorRow.style.cssText = 'margin:2px 0;display:flex;align-items:center;gap:4px;';
        var fogColorLabel = document.createElement('span');
        fogColorLabel.textContent = 'Fog Color';
        fogColorLabel.style.cssText = 'flex:0 0 100px;font-size:10px;color:#aaa;';
        fogColorRow.appendChild(fogColorLabel);
        var fogColorInput = document.createElement('input');
        fogColorInput.type = 'color';
        fogColorInput.value = colorToHex(FOW._fogColor);
        fogColorInput.style.cssText = 'flex:1;height:20px;cursor:pointer;background:transparent;border:1px solid #555;';
        fogColorInput.addEventListener('input', function() {
            var c = FOW._parseColor(fogColorInput.value);
            FOW._fogColor = c;
            saveToStorage();
        });
        fogColorRow.appendChild(fogColorInput);
        body.appendChild(fogColorRow);
        sliderEls['fogColor'] = { slider: fogColorInput, valueEl: null, type: 'color' };

        // --- 공통 파라미터 ---
        addSection(body, '── Common ──');
        addParamRows(body, COMMON_PARAMS, applyParam);

        // --- 2D 셰이더 ---
        addSection(body, '── 2D Shader ──', '#6af');
        addParamRows(body, PARAMS_2D_SHADER, applyParam);

        // --- 촉수 타이밍 ---
        addSection(body, '── Tentacle Timing ──', '#af6');
        addParamRows(body, PARAMS_TENTACLE, applyParam);

        // --- 3D 볼류메트릭 ---
        addSection(body, '── 3D Volumetric ──', '#f8a');
        // fogColorTop 색상 피커
        var fogColorTopRow = document.createElement('div');
        fogColorTopRow.style.cssText = 'margin:2px 0;display:flex;align-items:center;gap:4px;';
        var fogColorTopLabel = document.createElement('span');
        fogColorTopLabel.textContent = 'Fog Color Top';
        fogColorTopLabel.style.cssText = 'flex:0 0 100px;font-size:10px;color:#aaa;';
        fogColorTopRow.appendChild(fogColorTopLabel);
        var fogColorTopInput = document.createElement('input');
        fogColorTopInput.type = 'color';
        fogColorTopInput.value = colorToHex(FOW._fogColorTop);
        fogColorTopInput.style.cssText = 'flex:1;height:20px;cursor:pointer;background:transparent;border:1px solid #555;';
        fogColorTopInput.addEventListener('input', function() {
            FOW._fogColorTop = FOW._parseColor(fogColorTopInput.value);
            saveToStorage();
        });
        fogColorTopRow.appendChild(fogColorTopInput);
        body.appendChild(fogColorTopRow);
        sliderEls['fogColorTop'] = { slider: fogColorTopInput, valueEl: null, type: 'color' };
        addParamRows(body, PARAMS_3D, applyParam);

        // 버튼 컨테이너
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:8px;display:flex;gap:4px;';

        // Reset 버튼
        var resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset All';
        resetBtn.style.cssText = 'flex:1;padding:2px 8px;background:#444;color:#ccc;border:1px solid #666;font:10px monospace;cursor:pointer;border-radius:2px;';
        resetBtn.addEventListener('click', function() {
            ALL_PARAMS.forEach(function(p) {
                if (p.shader) {
                    FOW._shaderOverrides[p.key] = p.def;
                } else {
                    var prop = KEY_MAP[p.key];
                    if (prop) {
                        FOW[prop] = p.type === 'bool' ? !!p.def : p.def;
                    }
                }
                updateSlider(p.key, p.def);
            });
            FOW._prevPlayerX = -1;
            saveToStorage();
        });
        btnRow.appendChild(resetBtn);

        // Copy Values 버튼
        var copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy Values';
        copyBtn.style.cssText = 'flex:1;padding:2px 8px;background:#345;color:#ccc;border:1px solid #668;font:10px monospace;cursor:pointer;border-radius:2px;';
        copyBtn.addEventListener('click', function() {
            var config = buildConfigObject();
            var json = JSON.stringify(config, null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(json).then(function() {
                    showCopyFeedback(copyBtn, true);
                }, function() {
                    showCopyFeedback(copyBtn, false);
                });
            } else {
                // fallback
                var ta = document.createElement('textarea');
                ta.value = json;
                ta.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); showCopyFeedback(copyBtn, true); }
                catch(e) { showCopyFeedback(copyBtn, false); }
                document.body.removeChild(ta);
            }
        });
        btnRow.appendChild(copyBtn);

        body.appendChild(btnRow);

        // 디버그: BlockMap 확인 버튼
        var debugRow = document.createElement('div');
        debugRow.style.cssText = 'margin-top:4px;display:flex;gap:4px;';
        var blockMapBtn = document.createElement('button');
        blockMapBtn.textContent = 'Log BlockMap';
        blockMapBtn.style.cssText = 'flex:1;padding:2px 8px;background:#533;color:#ccc;border:1px solid #866;font:10px monospace;cursor:pointer;border-radius:2px;';
        blockMapBtn.addEventListener('click', function() {
            FOW._buildBlockMap();
            var bm = FOW._blockMap;
            var w = FOW._mapWidth;
            var h = FOW._mapHeight;
            var blocked = 0;
            if (bm) {
                for (var i = 0; i < bm.length; i++) if (bm[i]) blocked++;
            }
            console.log('[FOW] BlockMap: ' + w + 'x' + h + ', blocked=' + blocked + '/' + (w * h) +
                        ', LoS=' + FOW._lineOfSight + ', dirty=' + FOW._blockMapDirty);
            if (bm && w > 0 && h > 0) {
                var lines = [];
                for (var y = 0; y < Math.min(h, 40); y++) {
                    var line = '';
                    for (var x = 0; x < Math.min(w, 60); x++) {
                        line += bm[y * w + x] ? '#' : '.';
                    }
                    lines.push(line);
                }
                console.log('[FOW] BlockMap visual:\n' + lines.join('\n'));
            }
        });
        debugRow.appendChild(blockMapBtn);
        body.appendChild(debugRow);

        // LoS 디버그 오버레이 토글
        var losRow = document.createElement('div');
        losRow.style.cssText = 'margin-top:4px;display:flex;align-items:center;gap:4px;';
        var losCb = document.createElement('input');
        losCb.type = 'checkbox';
        losCb.checked = false;
        losCb.style.cssText = 'margin:0;cursor:pointer;';
        losCb.addEventListener('change', function() {
            FOW.toggleLosDebug(losCb.checked);
        });
        losRow.appendChild(losCb);
        var losLabel = document.createElement('span');
        losLabel.textContent = 'LoS Debug Overlay';
        losLabel.style.cssText = 'font-size:10px;color:#f66;cursor:pointer;';
        losLabel.addEventListener('click', function() {
            losCb.checked = !losCb.checked;
            FOW.toggleLosDebug(losCb.checked);
        });
        losRow.appendChild(losLabel);
        body.appendChild(losRow);

        panel.appendChild(body);
        document.body.appendChild(panel);

        // DevPanelUtils로 드래그/접기 추가
        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
                defaultPosition: 'top-right',
                titleBar: titleBar,
                bodyEl: body,
                defaultCollapsed: false
            });
        }

        // 초기값 동기화 후 로컬스토리지에서 복원
        syncFromFOW();
        loadFromStorage();
    }

    function addSection(parent, text, color) {
        var el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = 'color:' + (color || '#888') + ';font-size:10px;margin:8px 0 2px;';
        parent.appendChild(el);
    }

    function addParamRows(parent, params, onChange) {
        params.forEach(function(p) {
            var row = createSliderRow(p, function(val) { onChange(p, val); });
            parent.appendChild(row);
        });
    }

    function applyParam(p, val) {
        if (p.shader) {
            FOW._shaderOverrides[p.key] = val;
        } else {
            var prop = KEY_MAP[p.key];
            if (prop) {
                if (p.type === 'bool') {
                    FOW[prop] = !!val;
                } else {
                    FOW[prop] = val;
                }
                if (p.key === 'radius' || p.key === 'lineOfSight') {
                    FOW._prevPlayerX = -1;
                }
            }
        }
        saveToStorage();
    }

    function createSliderRow(param, onChange) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:2px 0;display:flex;align-items:center;gap:4px;';

        var label = document.createElement('span');
        label.textContent = param.label;
        label.style.cssText = 'flex:0 0 100px;font-size:10px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        label.title = param.key;
        row.appendChild(label);

        if (param.type === 'bool') {
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!param.def;
            cb.style.cssText = 'margin:0;cursor:pointer;';
            cb.addEventListener('change', function() {
                onChange(cb.checked ? 1 : 0);
            });
            row.appendChild(cb);

            sliderEls[param.key] = { slider: cb, valueEl: null, type: 'bool' };
        } else {
            var slider = document.createElement('input');
            slider.type = 'range';
            slider.min = param.min;
            slider.max = param.max;
            slider.step = param.step;
            slider.value = param.def;
            slider.style.cssText = 'flex:1;height:14px;cursor:pointer;accent-color:#f80;';
            row.appendChild(slider);

            var valEl = document.createElement('span');
            valEl.textContent = param.def;
            valEl.style.cssText = 'flex:0 0 36px;font-size:10px;color:#ff8;text-align:right;';
            row.appendChild(valEl);

            slider.addEventListener('input', function() {
                var val = parseFloat(slider.value);
                valEl.textContent = val % 1 === 0 ? val : val.toFixed(param.step < 0.01 ? 3 : 2);
                onChange(val);
            });

            sliderEls[param.key] = { slider: slider, valueEl: valEl, type: 'slider' };
        }

        return row;
    }

    function updateSlider(key, val) {
        var el = sliderEls[key];
        if (!el) return;
        if (el.type === 'color') {
            el.slider.value = val;
        } else if (el.type === 'bool') {
            el.slider.checked = !!val;
        } else {
            el.slider.value = val;
            if (el.valueEl) {
                el.valueEl.textContent = val % 1 === 0 ? val : val.toFixed(2);
            }
        }
    }

    function syncFromFOW() {
        ALL_PARAMS.forEach(function(p) {
            if (p.shader) {
                if (FOW._shaderOverrides && FOW._shaderOverrides[p.key] !== undefined) {
                    updateSlider(p.key, FOW._shaderOverrides[p.key]);
                }
            } else {
                var prop = KEY_MAP[p.key];
                if (prop && FOW[prop] !== undefined) {
                    var val = p.type === 'bool' ? (FOW[prop] ? 1 : 0) : FOW[prop];
                    updateSlider(p.key, val);
                }
            }
        });
        updateSlider('fogColor', colorToHex(FOW._fogColor));
        updateSlider('fogColorTop', colorToHex(FOW._fogColorTop));
    }

    // FogOfWar.setup() 후킹: setup이 config 값으로 초기화한 뒤
    // localStorage에 저장된 디버그 패널 값을 다시 덮어씀
    var _origSetup = FOW.setup;
    FOW.setup = function() {
        _origSetup.apply(this, arguments);
        if (panel) {
            loadFromStorage();
        }
    };

    // DOMContentLoaded 후 생성
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createPanel);
    } else {
        createPanel();
    }
})();
