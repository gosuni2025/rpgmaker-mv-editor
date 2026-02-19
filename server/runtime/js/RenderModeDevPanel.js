//=============================================================================
// RenderModeDevPanel.js - 렌더 모드 제어 패널 (런타임 dev 패널)
//=============================================================================
// URL에 ?dev=true 시 활성화
// 3D 모드, 그림자/광원, 피사계 심도(DoF) 토글
// 의존: DevPanelUtils.js
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    var PANEL_ID = 'renderModeDevPanel';
    var panel = null;
    var panelCtrl = null;

    // 토글 항목 정의
    var TOGGLES = [
        { key: 'mode3d',        label: '3D 모드',      desc: 'Mode3D 원근 카메라' },
        { key: 'shadowLight',   label: '그림자/광원',  desc: 'ShadowAndLight 조명 시스템' },
        { key: 'depthOfField',  label: '피사계 심도',  desc: 'PostProcess DoF (Tilt-Shift)' },
    ];

    var btnMap = {}; // key -> HTMLButtonElement

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'render-mode-dev-panel';
        panel.style.cssText = [
            'position:fixed', 'top:10px', 'right:10px', 'z-index:99999',
            'background:rgba(0,0,0,0.85)', 'color:#ccc',
            'font:11px/1.3 monospace', 'padding:0',
            'border:1px solid #555', 'border-radius:4px',
            'min-width:180px',
            'pointer-events:auto', 'user-select:none'
        ].join(';');

        // Title bar
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;padding:4px 8px;background:rgba(40,40,40,0.9);border-radius:4px 4px 0 0;cursor:move;';

        var titleText = document.createElement('span');
        titleText.textContent = 'Render Mode';
        titleText.style.cssText = 'color:#f0a050;font-weight:bold;flex:1;';
        titleBar.appendChild(titleText);

        panel.appendChild(titleBar);

        // Body
        var body = document.createElement('div');
        body.style.cssText = 'padding:6px 8px 8px;';

        TOGGLES.forEach(function(item) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';

            var btn = document.createElement('button');
            btn.style.cssText = 'min-width:28px;padding:2px 7px;font:10px monospace;cursor:pointer;border:none;border-radius:2px;color:#fff;background:#555;';
            btn.addEventListener('click', function() {
                var CM = window.ConfigManager;
                if (!CM || CM[item.key] === undefined) return;
                CM[item.key] = !CM[item.key];
                syncBtn(item.key);
            });
            btnMap[item.key] = btn;

            var lbl = document.createElement('span');
            lbl.textContent = item.label;
            lbl.style.cssText = 'color:#ccc;font-size:11px;';
            lbl.title = item.desc;

            row.appendChild(btn);
            row.appendChild(lbl);
            body.appendChild(row);
        });

        panel.appendChild(body);
        document.body.appendChild(panel);

        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
                titleBar: titleBar,
                defaultPosition: 'top-right'
            });
        }
    }

    function syncBtn(key) {
        var CM = window.ConfigManager;
        var btn = btnMap[key];
        if (!btn) return;
        var on = !!(CM && CM[key]);
        btn.textContent = on ? 'ON' : 'OFF';
        btn.style.background = on ? '#1a7a3a' : '#555';
    }

    function syncAll() {
        TOGGLES.forEach(function(item) { syncBtn(item.key); });
    }

    function tick() {
        if (!panel) createPanel();
        syncAll();
        requestAnimationFrame(tick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { requestAnimationFrame(tick); });
    } else {
        requestAnimationFrame(tick);
    }

})();
