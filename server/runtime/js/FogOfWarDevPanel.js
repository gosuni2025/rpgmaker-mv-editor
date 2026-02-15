//=============================================================================
// FogOfWarDevPanel.js - FOW 디버그 패널 (런타임)
//=============================================================================
// URL에 ?dev=true 시 활성화
// FOW 셰이더 파라미터를 실시간으로 조절 가능
// 의존: DevPanelUtils.js, FogOfWar.js
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    var PANEL_ID = 'fogOfWarDevPanel';
    var panel = null;
    var panelCtrl = null;

    // ── 공통 파라미터 (2D & 3D) ──
    var COMMON_PARAMS = [
        { key: 'radius',             label: 'Radius',            min: 1,    max: 30,   step: 1,    def: 5 },
        { key: 'exploredAlpha',      label: 'Explored Alpha',    min: 0,    max: 1,    step: 0.05, def: 0.6 },
        { key: 'unexploredAlpha',    label: 'Unexplored Alpha',  min: 0,    max: 1,    step: 0.05, def: 1.0 },
        { key: 'lineOfSight',        label: 'Line of Sight',     min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'edgeAnimation',      label: 'Edge Animation',    min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'edgeAnimationSpeed', label: 'Edge Anim Speed',   min: 0,    max: 5,    step: 0.1,  def: 1.0 },
        { key: 'lightScattering',    label: 'Light Scatter',     min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'lightScatterIntensity', label: 'Scatter Intensity', min: 0, max: 3,    step: 0.1,  def: 1.0 },
        { key: 'fogTransitionSpeed',  label: 'Transition Spd',   min: 1,    max: 20,   step: 0.5,  def: 5.0 },
    ];

    // ── 2D 전용 파라미터 ──
    var PARAMS_2D = [
        { key: 'dissolveStrength',   label: 'Dissolve Amt',      min: 0,    max: 3.0,  step: 0.05, def: 0.8,  shader: true },
        { key: 'fadeSmoothness',     label: 'Fade Range',        min: 0.05, max: 1.0,  step: 0.05, def: 0.5,  shader: true },
        { key: 'nearVisWeight',      label: 'Edge Width',        min: 0.1,  max: 1.5,  step: 0.05, def: 0.7,  shader: true },
        { key: 'edgeOffset',         label: 'Edge Offset',       min: 0,    max: 1.5,  step: 0.05, def: 0.5,  shader: true },
    ];

    // ── 3D 전용 파라미터 ──
    var PARAMS_3D = [
        { key: 'visibilityBrightness', label: 'Vis Brightness',  min: 0,    max: 1,    step: 0.05, def: 0.0 },
        { key: 'godRay',             label: 'God Ray',           min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'godRayIntensity',    label: 'God Ray Intensity', min: 0,    max: 2,    step: 0.05, def: 0.4 },
        { key: 'vortex',             label: 'Vortex',            min: 0,    max: 1,    step: 1,    def: 1,   type: 'bool' },
        { key: 'vortexSpeed',        label: 'Vortex Speed',      min: 0,    max: 5,    step: 0.1,  def: 1.0 },
        { key: 'absorption',         label: 'Absorption',        min: 0,    max: 0.1,  step: 0.001, def: 0.012 },
        { key: 'fogHeight',          label: 'Fog Height',        min: 50,   max: 1000, step: 10,   def: 300 },
    ];

    // 모든 파라미터 합치기 (슬라이더 생성/리셋용)
    var ALL_PARAMS = COMMON_PARAMS.concat(PARAMS_2D).concat(PARAMS_3D);

    // 내부 키 → FogOfWar 프로퍼티 이름 매핑 (shader가 아닌 것만)
    var KEY_MAP = {
        radius: '_radius',
        exploredAlpha: '_exploredAlpha',
        unexploredAlpha: '_unexploredAlpha',
        visibilityBrightness: '_visibilityBrightness',
        edgeAnimationSpeed: '_edgeAnimationSpeed',
        lineOfSight: '_lineOfSight',
        edgeAnimation: '_edgeAnimation',
        lightScattering: '_lightScattering',
        lightScatterIntensity: '_lightScatterIntensity',
        godRay: '_godRay',
        godRayIntensity: '_godRayIntensity',
        vortex: '_vortex',
        vortexSpeed: '_vortexSpeed',
        fogTransitionSpeed: '_fogTransitionSpeed',
        absorption: '_absorption',
        fogHeight: '_fogHeight',
    };

    // 셰이더 오버라이드 저장소
    if (!window.FogOfWar) return;
    var FOW = window.FogOfWar;
    FOW._shaderOverrides = FOW._shaderOverrides || {};
    PARAMS_2D.forEach(function(p) {
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
        panel.appendChild(titleBar);

        // 바디
        var body = document.createElement('div');
        body.id = 'fow-dev-body';

        // --- 공통 파라미터 ---
        addSection(body, '── Common (2D & 3D) ──');
        addParamRows(body, COMMON_PARAMS, applyParam);

        // --- 2D 전용 ---
        addSection(body, '── 2D Only ──', '#6af');
        addParamRows(body, PARAMS_2D, applyParam);

        // --- 3D 전용 ---
        addSection(body, '── 3D Only ──', '#fa6');
        addParamRows(body, PARAMS_3D, applyParam);

        // Reset 버튼
        var resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset All';
        resetBtn.style.cssText = 'margin-top:8px;padding:2px 8px;background:#444;color:#ccc;border:1px solid #666;font:10px monospace;cursor:pointer;border-radius:2px;width:100%;';
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
        body.appendChild(resetBtn);

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
        if (el.type === 'bool') {
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
    }

    // DOMContentLoaded 후 생성
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createPanel);
    } else {
        createPanel();
    }
})();
