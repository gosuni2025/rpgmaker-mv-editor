//=============================================================================
// DepthDebugPanel.js - Depth Test 디버그 패널
//=============================================================================
// URL에 ?dev=true 시 활성화
// depthTest/depthWrite/alphaTest + ZLayer/drawZ 오프셋을 실시간 조절
// 의존: DevPanelUtils.js
//=============================================================================

(function() {
    // 전역 설정 (다른 파일에서 참조) — dev 모드 여부와 무관하게 항상 설정
    if (!window.DepthDebugConfig) {
        window.DepthDebugConfig = {
            zLayerStep: 0.01,
            drawZStep: 0.001,
            tile:   { depthTest: false, depthWrite: false, alphaTest: false },
            sprite: { depthTest: false, depthWrite: false, alphaTest: false },
            water:  { depthTest: true,  depthWrite: false, alphaTest: false },
            shadow: { depthTest: false, depthWrite: false, alphaTest: false },
        };
    }

    var STORAGE_KEY = 'depthDebugPanel';

    var STEP_PARAMS = [
        { key: 'zLayerStep', label: 'ZLayer Step', step: 0.01, def: 0.01 },
        { key: 'drawZStep',  label: 'DrawZ Step',  step: 0.01, def: 0.001 },
    ];

    var CATEGORIES = [
        { key: 'tile',   label: 'Tile',   defDepthTest: false, defDepthWrite: false, defAlphaTest: false },
        { key: 'sprite', label: 'Sprite', defDepthTest: false, defDepthWrite: false, defAlphaTest: false },
        { key: 'water',  label: 'Water',  defDepthTest: true,  defDepthWrite: false, defAlphaTest: false },
        { key: 'shadow', label: 'Shadow', defDepthTest: false, defDepthWrite: false, defAlphaTest: false },
    ];

    function saveToStorage() {
        var data = { sliders: {}, categories: {} };
        STEP_PARAMS.forEach(function(p) {
            data.sliders[p.key] = window.DepthDebugConfig[p.key];
        });
        CATEGORIES.forEach(function(c) {
            data.categories[c.key] = window.DepthDebugConfig[c.key];
        });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
    }

    function loadFromStorage() {
        var raw;
        try { raw = localStorage.getItem(STORAGE_KEY); } catch(e) { return; }
        if (!raw) return;
        var data;
        try { data = JSON.parse(raw); } catch(e) { return; }
        if (data.sliders) {
            STEP_PARAMS.forEach(function(p) {
                if (data.sliders[p.key] !== undefined) {
                    window.DepthDebugConfig[p.key] = data.sliders[p.key];
                }
            });
        }
        if (data.categories) {
            CATEGORIES.forEach(function(c) {
                if (data.categories[c.key]) {
                    window.DepthDebugConfig[c.key] = data.categories[c.key];
                }
            });
        }
    }
    loadFromStorage();
    // 이전 버전에서 저장된 음수 값 교정 (zLayerStep, drawZStep은 양수여야 함)
    if (window.DepthDebugConfig.zLayerStep < 0) window.DepthDebugConfig.zLayerStep = 0.01;
    if (window.DepthDebugConfig.drawZStep < 0) window.DepthDebugConfig.drawZStep = 0.001;

    // dev 모드가 아니면 패널 UI는 생성하지 않음
    if (!(new URLSearchParams(window.location.search)).has('dev') && !window._forceDevPanel) return;

    var PANEL_ID = 'depthDebugPanel';
    var panel = null;
    var panelCtrl = null;
    var stepEls = {};
    var checkboxEls = {};

    var BTN_STYLE = 'padding:1px 6px;background:#444;color:#ccc;border:1px solid #666;font:10px monospace;cursor:pointer;border-radius:2px;min-width:20px;text-align:center;';

    function updateStepDisplay(key) {
        var el = stepEls[key];
        if (!el) return;
        el.valueEl.textContent = formatVal(window.DepthDebugConfig[key]);
    }

    function formatVal(val) {
        if (val === 0) return '0';
        var abs = Math.abs(val);
        if (abs < 0.001) return val.toFixed(4);
        if (abs < 0.01) return val.toFixed(3);
        if (abs < 1) return val.toFixed(3);
        return val.toFixed(2);
    }

    function createStepRow(param) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:3px 0;display:flex;align-items:center;gap:4px;';

        var label = document.createElement('span');
        label.textContent = param.label;
        label.style.cssText = 'flex:0 0 80px;font-size:10px;color:#aaa;';
        row.appendChild(label);

        // - 버튼
        var minusBtn = document.createElement('button');
        minusBtn.textContent = '-';
        minusBtn.style.cssText = BTN_STYLE;
        row.appendChild(minusBtn);

        // 값 표시
        var valEl = document.createElement('span');
        valEl.textContent = formatVal(window.DepthDebugConfig[param.key]);
        valEl.style.cssText = 'flex:0 0 60px;font-size:10px;color:#ff8;text-align:center;';
        row.appendChild(valEl);

        // + 버튼
        var plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.style.cssText = BTN_STYLE;
        row.appendChild(plusBtn);

        // 0 리셋 버튼
        var zeroBtn = document.createElement('button');
        zeroBtn.textContent = '0';
        zeroBtn.style.cssText = BTN_STYLE + 'color:#f88;';
        row.appendChild(zeroBtn);

        function applyStep(delta) {
            var val = window.DepthDebugConfig[param.key] + delta;
            val = Math.round(val * 10000) / 10000; // 부동소수점 보정
            window.DepthDebugConfig[param.key] = val;
            valEl.textContent = formatVal(val);
            saveToStorage();
        }

        minusBtn.addEventListener('mouseup', function(e) { e.stopPropagation(); applyStep(-param.step); });
        plusBtn.addEventListener('mouseup', function(e) { e.stopPropagation(); applyStep(param.step); });
        zeroBtn.addEventListener('mouseup', function(e) { e.stopPropagation();
            window.DepthDebugConfig[param.key] = 0;
            valEl.textContent = formatVal(0);
            saveToStorage();
        });

        stepEls[param.key] = { valueEl: valEl };
        return row;
    }

    function createCategoryRow(cat) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:2px 0;display:flex;align-items:center;gap:6px;';

        var label = document.createElement('span');
        label.textContent = cat.label;
        label.style.cssText = 'flex:0 0 50px;font-size:10px;color:#aaa;';
        row.appendChild(label);

        var cfg = window.DepthDebugConfig[cat.key];
        var props = ['depthTest', 'depthWrite', 'alphaTest'];
        var shortLabels = ['dTest', 'dWrite', 'aTest'];

        props.forEach(function(prop, i) {
            var wrap = document.createElement('label');
            wrap.style.cssText = 'display:flex;align-items:center;gap:2px;cursor:pointer;';

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!cfg[prop];
            cb.style.cssText = 'margin:0;cursor:pointer;width:12px;height:12px;';
            cb.addEventListener('change', function() {
                window.DepthDebugConfig[cat.key][prop] = cb.checked;
                saveToStorage();
            });

            var lbl = document.createElement('span');
            lbl.textContent = shortLabels[i];
            lbl.style.cssText = 'font-size:9px;color:#888;';

            wrap.appendChild(cb);
            wrap.appendChild(lbl);
            row.appendChild(wrap);

            if (!checkboxEls[cat.key]) checkboxEls[cat.key] = {};
            checkboxEls[cat.key][prop] = cb;
        });

        return row;
    }

    function createPanel() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'depth-debug-panel';
        panel.style.cssText = [
            'position:fixed', 'top:10px', 'left:10px', 'z-index:99998',
            'background:rgba(0,0,0,0.85)', 'color:#ddd',
            'font:11px/1.4 monospace', 'padding:6px 8px',
            'pointer-events:auto', 'user-select:none',
            'min-width:280px', 'max-width:360px',
            'border:1px solid #555', 'border-radius:4px'
        ].join(';');

        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;';
        var titleText = document.createElement('span');
        titleText.textContent = 'Depth Debug';
        titleText.style.cssText = 'font-size:12px;font-weight:bold;color:#4af;flex:1;';
        titleBar.appendChild(titleText);
        panel.appendChild(titleBar);

        var body = document.createElement('div');

        // Z Offsets 섹션
        var sliderSection = document.createElement('div');
        sliderSection.style.cssText = 'margin-bottom:6px;';
        var sliderTitle = document.createElement('div');
        sliderTitle.textContent = '── Z Offsets ──';
        sliderTitle.style.cssText = 'color:#888;font-size:10px;margin-bottom:4px;';
        sliderSection.appendChild(sliderTitle);
        STEP_PARAMS.forEach(function(p) {
            sliderSection.appendChild(createStepRow(p));
        });
        body.appendChild(sliderSection);

        // Material 토글 섹션
        var catSection = document.createElement('div');
        var catHeader = document.createElement('div');
        catHeader.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';
        var catTitle = document.createElement('span');
        catTitle.textContent = '── Material ──';
        catTitle.style.cssText = 'color:#888;font-size:10px;';
        catHeader.appendChild(catTitle);
        catSection.appendChild(catHeader);

        var colHeader = document.createElement('div');
        colHeader.style.cssText = 'margin:0 0 2px;display:flex;align-items:center;gap:6px;';
        var spacer = document.createElement('span');
        spacer.style.cssText = 'flex:0 0 50px;';
        colHeader.appendChild(spacer);
        ['dTest', 'dWrite', 'aTest'].forEach(function(t) {
            var col = document.createElement('span');
            col.textContent = t;
            col.style.cssText = 'font-size:8px;color:#666;text-align:center;width:46px;';
            colHeader.appendChild(col);
        });
        catSection.appendChild(colHeader);

        CATEGORIES.forEach(function(c) {
            catSection.appendChild(createCategoryRow(c));
        });
        body.appendChild(catSection);

        // 버튼 행
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:6px;display:flex;gap:4px;';

        var resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset All';
        resetBtn.style.cssText = 'flex:1;padding:2px 8px;background:#444;color:#ccc;border:1px solid #666;font:10px monospace;cursor:pointer;border-radius:2px;';
        resetBtn.addEventListener('click', function() {
            STEP_PARAMS.forEach(function(p) {
                window.DepthDebugConfig[p.key] = p.def;
                updateStepDisplay(p.key);
            });
            CATEGORIES.forEach(function(c) {
                window.DepthDebugConfig[c.key] = {
                    depthTest: c.defDepthTest,
                    depthWrite: c.defDepthWrite,
                    alphaTest: c.defAlphaTest,
                };
                if (checkboxEls[c.key]) {
                    checkboxEls[c.key].depthTest.checked = c.defDepthTest;
                    checkboxEls[c.key].depthWrite.checked = c.defDepthWrite;
                    checkboxEls[c.key].alphaTest.checked = c.defAlphaTest;
                }
            });
            saveToStorage();
        });
        btnRow.appendChild(resetBtn);

        var copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.style.cssText = 'flex:1;padding:2px 8px;background:#345;color:#ccc;border:1px solid #666;font:10px monospace;cursor:pointer;border-radius:2px;';
        copyBtn.addEventListener('click', function() {
            var cfg = window.DepthDebugConfig;
            var text = JSON.stringify({
                zLayerStep: cfg.zLayerStep,
                drawZStep: cfg.drawZStep,
                tile: cfg.tile,
                sprite: cfg.sprite,
                water: cfg.water,
                shadow: cfg.shadow,
            }, null, 2);
            navigator.clipboard.writeText(text).then(function() {
                copyBtn.textContent = 'Copied!';
                copyBtn.style.background = '#264';
                setTimeout(function() { copyBtn.textContent = 'Copy'; copyBtn.style.background = '#345'; }, 1200);
            }, function() {
                copyBtn.textContent = 'Failed';
                copyBtn.style.background = '#644';
                setTimeout(function() { copyBtn.textContent = 'Copy'; copyBtn.style.background = '#345'; }, 1200);
            });
        });
        btnRow.appendChild(copyBtn);
        body.appendChild(btnRow);

        panel.appendChild(body);
        // 게임 런타임(TouchInput)이 document에서 mousedown을 캡처하므로
        // 패널 내 이벤트가 게임으로 전파되지 않도록 차단
        panel.addEventListener('mousedown', function(e) { e.stopPropagation(); });
        document.body.appendChild(panel);

        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
                defaultPosition: 'top-left',
                titleBar: titleBar,
                bodyEl: body,
                defaultCollapsed: false,
            });
        }
    }

    window.addEventListener('load', createPanel);
})();
