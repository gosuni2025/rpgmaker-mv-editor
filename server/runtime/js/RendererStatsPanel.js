//=============================================================================
// RendererStatsPanel.js - 렌더러 stats를 부모 에디터로 postMessage 전송
//=============================================================================
// 부모(에디터)가 { type: 'setStats', show: boolean } 을 보내면 전송 on/off
// stats는 { type: 'statsUpdate', data: {...} } 형태로 부모에 전달
//=============================================================================

(function() {
    var STORAGE_KEY = 'rpg-editor-toolbar';
    var rafId = null;
    var frameTimes = [];
    var lastSend = 0;
    var active = false;

    // 초기 활성 여부: localStorage
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        active = raw ? (JSON.parse(raw).showStats !== false) : true;
    } catch (e) { active = true; }

    function fmt(n) {
        if (typeof n !== 'number') return null;
        return n;
    }

    function getRendererType(r) {
        try {
            var gl = r.getContext ? r.getContext() : null;
            if (!gl) return 'Three.js';
            if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) return 'WebGL2';
            if (typeof WebGLRenderingContext !== 'undefined' && gl instanceof WebGLRenderingContext) return 'WebGL';
        } catch (e) {}
        return 'WebGL';
    }

    function sendStats() {
        var now = performance.now();

        // FPS: 1초 슬라이딩 윈도우
        frameTimes.push(now);
        var cutoff = now - 1000;
        while (frameTimes.length > 0 && frameTimes[0] < cutoff) frameTimes.shift();
        var fps = frameTimes.length;

        // 200ms마다 전송
        if (now - lastSend < 200) return;
        lastSend = now;

        var data = { fps: fps, renderer: '...', dc: null, tri: null, tex: null, geo: null, prg: null, mem: null };

        var r = null;
        if (typeof Graphics !== 'undefined' && Graphics._renderer && Graphics._renderer.renderer) {
            r = Graphics._renderer.renderer;
        }

        if (r) {
            data.renderer = getRendererType(r);
            var info = r.info;
            if (info.render)  { data.dc = fmt(info.render.calls); data.tri = fmt(info.render.triangles); }
            if (info.memory)  { data.tex = fmt(info.memory.textures); data.geo = fmt(info.memory.geometries); }
            if (info.programs){ data.prg = fmt(info.programs.length); }
        }

        if (performance.memory) {
            data.mem = Math.round(performance.memory.usedJSHeapSize / 1048576);
        }

        window.parent.postMessage({ type: 'statsUpdate', data: data }, '*');
    }

    function loop() {
        rafId = requestAnimationFrame(loop);
        if (active) sendStats();
    }

    // 부모로부터 on/off 제어
    window.addEventListener('message', function(e) {
        if (!e.data || e.data.type !== 'setStats') return;
        active = e.data.show;
        if (!active) {
            // 비활성화 시 빈 데이터 전송하여 에디터 패널 초기화
            window.parent.postMessage({ type: 'statsUpdate', data: null }, '*');
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { rafId = requestAnimationFrame(loop); });
    } else {
        rafId = requestAnimationFrame(loop);
    }
})();
