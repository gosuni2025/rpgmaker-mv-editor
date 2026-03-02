//=============================================================================
// RendererStatsPanel.js - 렌더러 성능 통계 패널 (UI 에디터 / 인게임 dev 공용)
//=============================================================================
// postMessage { type: 'setStats', show: boolean } 으로 on/off 제어
// localStorage 'rpg-editor-toolbar' → showStats 로 초기 표시 여부 결정
// DevPanelUtils.makeDraggablePanel 의존
//=============================================================================

(function() {
    var STORAGE_KEY = 'rpg-editor-toolbar';
    var PANEL_ID = 'rendererStatsPanel';

    var panel = null;
    var bodyEl = null;
    var rowEls = {}; // label → td element
    var panelCtrl = null;
    var rafId = null;
    var frameTimes = [];
    var lastUpdate = 0;
    var visible = false;

    // 초기 표시 여부: localStorage에서 읽기 (기본 true)
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        visible = raw ? (JSON.parse(raw).showStats !== false) : true;
    } catch (e) { visible = true; }

    // 숫자 포맷 (1234 → 1.2k)
    function fmt(n) {
        if (typeof n !== 'number') return '?';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function mkRow(parent, label, color) {
        var tr = document.createElement('tr');
        var tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        tdLabel.style.cssText = 'color:' + color + ';padding-right:10px;white-space:nowrap;';
        var tdVal = document.createElement('td');
        tdVal.textContent = '-';
        tdVal.style.cssText = 'color:#fff;text-align:right;font-weight:bold;';
        tr.appendChild(tdLabel);
        tr.appendChild(tdVal);
        parent.appendChild(tr);
        return tdVal;
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = [
            'position:fixed', 'top:10px', 'right:10px', 'z-index:99999',
            'background:rgba(0,0,0,0.85)', 'color:#ccc',
            'font:11px/1.4 monospace', 'padding:0',
            'border:1px solid #444', 'border-radius:4px',
            'min-width:110px', 'pointer-events:auto', 'user-select:none'
        ].join(';');

        // Title bar
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:3px 8px;background:rgba(30,30,30,0.95);border-radius:4px 4px 0 0;';
        var titleText = document.createElement('span');
        titleText.textContent = 'Stats';
        titleText.style.cssText = 'color:#4cf;font-weight:bold;flex:1;font-size:11px;';
        titleBar.appendChild(titleText);
        panel.appendChild(titleBar);

        // Body
        bodyEl = document.createElement('div');
        bodyEl.style.cssText = 'padding:5px 10px 7px;';
        var table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;';

        // 구분선용 hr 헬퍼
        function sep() {
            var tr = document.createElement('tr');
            var td = document.createElement('td');
            td.colSpan = 2;
            td.style.cssText = 'padding:2px 0;';
            var hr = document.createElement('hr');
            hr.style.cssText = 'border:none;border-top:1px solid #333;margin:0;';
            td.appendChild(hr);
            tr.appendChild(td);
            table.appendChild(tr);
        }

        rowEls.fps      = mkRow(table, 'FPS',  '#ff4');
        rowEls.renderer = mkRow(table, 'Rndr', '#888');
        sep();
        rowEls.dc       = mkRow(table, 'DC',   '#4cf');
        rowEls.tri      = mkRow(table, 'Tri',  '#4cf');
        rowEls.tex      = mkRow(table, 'Tex',  '#4cf');
        rowEls.geo      = mkRow(table, 'Geo',  '#4cf');
        rowEls.prg      = mkRow(table, 'Prg',  '#4cf');

        bodyEl.appendChild(table);

        // JS Heap (Chrome 전용)
        var memRow = null;
        if (performance.memory) {
            sep();
            rowEls.mem = mkRow(table, 'Mem',  '#fa6');
        }

        panel.appendChild(bodyEl);
        document.body.appendChild(panel);

        // DevPanelUtils로 드래그 가능하게 (있으면)
        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
                titleBar: titleBar,
                defaultPosition: 'top-right',
                defaultCollapsed: false
            });
        }

        if (!visible) panel.style.display = 'none';
    }

    function getRendererType(r) {
        try {
            var gl = r.getContext ? r.getContext() : null;
            if (!gl) return 'Three.js';
            if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) return 'WebGL2';
            if (typeof WebGLRenderingContext !== 'undefined' && gl instanceof WebGLRenderingContext) return 'WebGL';
            var nm = (gl.constructor && gl.constructor.name) || '';
            if (nm.toLowerCase().indexOf('webgpu') !== -1) return 'WebGPU';
        } catch (e) {}
        return 'WebGL';
    }

    function updateStats() {
        var now = performance.now();

        // FPS: 1초 슬라이딩 윈도우
        frameTimes.push(now);
        var cutoff = now - 1000;
        while (frameTimes.length > 0 && frameTimes[0] < cutoff) frameTimes.shift();
        var fps = frameTimes.length;

        // 200ms 마다 DOM 갱신
        if (now - lastUpdate < 200) return;
        lastUpdate = now;

        if (!panel) return;

        rowEls.fps.textContent = fps;

        // Three.js renderer 접근 (Graphics._renderer.renderer)
        var r = null;
        if (typeof Graphics !== 'undefined' && Graphics._renderer && Graphics._renderer.renderer) {
            r = Graphics._renderer.renderer;
        }

        if (!r) {
            rowEls.renderer.textContent = '...';
            rowEls.dc.textContent  = '-';
            rowEls.tri.textContent = '-';
            rowEls.tex.textContent = '-';
            rowEls.geo.textContent = '-';
            rowEls.prg.textContent = '-';
            if (rowEls.mem) rowEls.mem.textContent = '-';
            return;
        }

        rowEls.renderer.textContent = getRendererType(r);

        var info = r.info;
        rowEls.dc.textContent  = info.render  ? fmt(info.render.calls)     : '-';
        rowEls.tri.textContent = info.render  ? fmt(info.render.triangles)  : '-';
        rowEls.tex.textContent = info.memory  ? fmt(info.memory.textures)   : '-';
        rowEls.geo.textContent = info.memory  ? fmt(info.memory.geometries) : '-';
        rowEls.prg.textContent = info.programs ? fmt(info.programs.length)  : '-';

        if (rowEls.mem && performance.memory) {
            rowEls.mem.textContent = Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB';
        }
    }

    function loop() {
        rafId = requestAnimationFrame(loop);
        if (visible && panel) updateStats();
    }

    function showPanel() {
        visible = true;
        if (panel) panel.style.display = '';
    }

    function hidePanel() {
        visible = false;
        if (panel) panel.style.display = 'none';
    }

    // 부모 에디터로부터 토글 메시지 수신
    window.addEventListener('message', function(e) {
        if (!e.data || e.data.type !== 'setStats') return;
        if (e.data.show) showPanel(); else hidePanel();
    });

    // DOMContentLoaded 후 패널 생성 (defer 스크립트는 이미 DOMContentLoaded 이후이지만 안전하게 처리)
    function init() {
        createPanel();
        rafId = requestAnimationFrame(loop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
