//=============================================================================
// MemoryDevPanel.js - JS Heap 메모리 모니터 (런타임 dev 패널)
//=============================================================================
// URL에 ?dev=true 시 활성화
// 실시간 메모리 그래프 + 진단 리포트
// 의존: DevPanelUtils.js
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    var perf = performance;
    if (!perf.memory) return; // Chrome 전용 API

    var PANEL_ID = 'memoryDevPanel';
    var MAX_SAMPLES = 300;
    var SAMPLE_INTERVAL = 1000;
    var memHistory = [];
    var panel = null;
    var panelCtrl = null;
    var canvas = null;
    var ctx = null;
    var summaryEl = null;
    var reportEl = null;
    var reportVisible = false;

    function formatBytes(bytes) {
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    function formatBytesDelta(bytes) {
        var sign = bytes >= 0 ? '+' : '';
        if (Math.abs(bytes) < 1024) return sign + bytes + ' B';
        if (Math.abs(bytes) < 1024 * 1024) return sign + (bytes / 1024).toFixed(1) + ' KB';
        return sign + (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function sample() {
        memHistory.push({
            time: Date.now(),
            used: perf.memory.usedJSHeapSize,
            total: perf.memory.totalJSHeapSize
        });
        if (memHistory.length > MAX_SAMPLES) memHistory.shift();
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'memory-dev-panel';
        panel.style.cssText = [
            'position:fixed', 'bottom:10px', 'right:10px', 'z-index:99999',
            'background:rgba(0,0,0,0.85)', 'color:#ccc',
            'font:11px/1.3 monospace', 'padding:0',
            'border:1px solid #555', 'border-radius:4px',
            'min-width:280px', 'max-width:400px',
            'pointer-events:auto', 'user-select:none'
        ].join(';');

        // Title bar
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:rgba(40,40,40,0.9);border-radius:4px 4px 0 0;';

        var titleText = document.createElement('span');
        titleText.textContent = 'JS Heap Monitor';
        titleText.style.cssText = 'color:#4fc3f7;font-weight:bold;flex:1;';
        titleBar.appendChild(titleText);

        var reportBtn = document.createElement('button');
        reportBtn.textContent = 'Report';
        reportBtn.style.cssText = 'background:#444;color:#ccc;border:1px solid #666;padding:1px 6px;font:10px monospace;cursor:pointer;border-radius:2px;margin-left:4px;';
        reportBtn.addEventListener('mouseenter', function() { reportBtn.style.background = '#555'; });
        reportBtn.addEventListener('mouseleave', function() { reportBtn.style.background = '#444'; });
        reportBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleReport();
        });
        titleBar.appendChild(reportBtn);

        panel.appendChild(titleBar);

        // Body wrapper
        var body = document.createElement('div');
        body.style.cssText = 'padding:4px 8px 6px;';

        // Summary line
        summaryEl = document.createElement('div');
        summaryEl.style.cssText = 'margin-bottom:4px;font-size:11px;';
        body.appendChild(summaryEl);

        // Canvas
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;height:80px;display:block;border-radius:2px;background:#1e1e1e;';
        body.appendChild(canvas);
        ctx = canvas.getContext('2d');

        // Report textarea (hidden)
        reportEl = document.createElement('textarea');
        reportEl.style.cssText = 'display:none;width:100%;height:200px;margin-top:4px;background:#1a1a1a;color:#ccc;border:1px solid #444;font:10px/1.3 monospace;padding:4px;resize:vertical;border-radius:2px;box-sizing:border-box;';
        reportEl.readOnly = true;
        reportEl.spellcheck = false;
        body.appendChild(reportEl);

        panel.appendChild(body);
        document.body.appendChild(panel);

        // DevPanelUtils
        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
                titleBar: titleBar,
                defaultPosition: 'bottom-right'
            });
        }
    }

    function toggleReport() {
        reportVisible = !reportVisible;
        if (reportVisible) {
            reportEl.style.display = 'block';
            reportEl.value = generateReport();
        } else {
            reportEl.style.display = 'none';
        }
    }

    function generateReport() {
        var lines = [];
        var ts = new Date().toISOString();
        lines.push('=== Memory Diagnostic Report ===');
        lines.push('Time: ' + ts);
        lines.push('');

        // JS Heap
        lines.push('[JS Heap]');
        lines.push('  Used:  ' + formatBytes(perf.memory.usedJSHeapSize));
        lines.push('  Total: ' + formatBytes(perf.memory.totalJSHeapSize));
        lines.push('  Limit: ' + formatBytes(perf.memory.jsHeapSizeLimit));
        lines.push('');

        // Trend
        if (memHistory.length > 1) {
            var first = memHistory[0];
            var last = memHistory[memHistory.length - 1];
            var elapsed = ((last.time - first.time) / 1000).toFixed(0);
            var delta = last.used - first.used;
            var rate = delta / ((last.time - first.time) / 1000);
            lines.push('[Trend] ' + elapsed + 's tracked');
            lines.push('  Start: ' + formatBytes(first.used) + ' -> Now: ' + formatBytes(last.used));
            lines.push('  Delta: ' + formatBytesDelta(delta) + '  (' + formatBytesDelta(rate) + '/s)');
            var idx30 = Math.max(0, memHistory.length - 31);
            var d30 = last.used - memHistory[idx30].used;
            lines.push('  Last 30s: ' + formatBytesDelta(d30));
            lines.push('');
        }

        // Three.js scene
        var scene = null;
        if (typeof Graphics !== 'undefined' && Graphics._renderer && Graphics._renderer.scene) {
            scene = Graphics._renderer.scene;
        }
        if (scene) {
            var counts = {};
            var totalObjects = 0;
            scene.traverse(function(obj) {
                totalObjects++;
                var type = (obj.constructor && obj.constructor.name) || obj.type || 'Unknown';
                counts[type] = (counts[type] || 0) + 1;
            });
            lines.push('[Three.js Scene]');
            lines.push('  Total objects: ' + totalObjects);
            var sorted = Object.keys(counts).map(function(k) { return [k, counts[k]]; })
                .sort(function(a, b) { return b[1] - a[1]; });
            for (var i = 0; i < Math.min(sorted.length, 10); i++) {
                lines.push('  ' + sorted[i][0] + ': ' + sorted[i][1]);
            }
            lines.push('');
        }

        // WebGL renderer
        if (typeof Graphics !== 'undefined' && Graphics._renderer && Graphics._renderer.renderer) {
            var info = Graphics._renderer.renderer.info;
            if (info) {
                lines.push('[WebGL Renderer]');
                lines.push('  Geometries: ' + (info.memory ? info.memory.geometries : '?'));
                lines.push('  Textures: ' + (info.memory ? info.memory.textures : '?'));
                lines.push('  Programs: ' + (info.programs ? info.programs.length : '?'));
                lines.push('  Draw calls: ' + (info.render ? info.render.calls : '?'));
                lines.push('  Triangles: ' + (info.render ? info.render.triangles : '?'));
                lines.push('');
            }
        }

        // ImageManager cache
        if (window.ImageManager) {
            lines.push('[ImageManager Cache]');
            if (ImageManager._imageCache && ImageManager._imageCache._items) {
                var items = ImageManager._imageCache._items;
                var keys = Object.keys(items);
                var totalPixels = 0;
                for (var j = 0; j < keys.length; j++) {
                    var bmp = items[keys[j]] && items[keys[j]].bitmap;
                    if (bmp) totalPixels += (bmp.width || 0) * (bmp.height || 0);
                }
                lines.push('  Items: ' + keys.length + ', ~' + formatBytes(totalPixels * 4));
            }
            if (ImageManager.cache && ImageManager.cache._inner) {
                lines.push('  CacheMap: ' + Object.keys(ImageManager.cache._inner).length);
            }
            lines.push('');
        }

        // $dataMap
        if (window.$dataMap) {
            lines.push('[Map Data]');
            lines.push('  data length: ' + ($dataMap.data ? $dataMap.data.length : 0));
            lines.push('  events: ' + ($dataMap.events ? $dataMap.events.length : 0));
            lines.push('  size: ' + $dataMap.width + 'x' + $dataMap.height);
            lines.push('');
        }

        // History CSV
        lines.push('[History CSV (last 60s)]');
        lines.push('  sec, used_mb, total_mb');
        var recent = Math.max(0, memHistory.length - 61);
        var ref = memHistory.length > 0 ? memHistory[memHistory.length - 1].time : 0;
        for (var k = recent; k < memHistory.length; k++) {
            var s = memHistory[k];
            lines.push('  ' + ((s.time - ref) / 1000).toFixed(0) + ', ' + (s.used / 1048576).toFixed(2) + ', ' + (s.total / 1048576).toFixed(2));
        }

        return lines.join('\n');
    }

    function drawGraph() {
        if (!canvas || !ctx) return;

        var dpr = window.devicePixelRatio || 1;
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        var samples = memHistory;
        if (samples.length < 2) {
            ctx.fillStyle = '#999';
            ctx.font = '11px monospace';
            ctx.fillText('Collecting data...', 10, h / 2);
            return;
        }

        var minUsed = Infinity, maxUsed = 0;
        var minTotal = Infinity, maxTotal = 0;
        for (var i = 0; i < samples.length; i++) {
            if (samples[i].used < minUsed) minUsed = samples[i].used;
            if (samples[i].used > maxUsed) maxUsed = samples[i].used;
            if (samples[i].total < minTotal) minTotal = samples[i].total;
            if (samples[i].total > maxTotal) maxTotal = samples[i].total;
        }

        var yMin = Math.min(minUsed, minTotal) * 0.95;
        var yMax = Math.max(maxUsed, maxTotal) * 1.05;
        var yRange = yMax - yMin || 1;

        var pad = { top: 14, bottom: 14, left: 44, right: 8 };
        var gw = w - pad.left - pad.right;
        var gh = h - pad.top - pad.bottom;

        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, w, h);

        // Y axis
        ctx.strokeStyle = '#333';
        ctx.fillStyle = '#666';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        for (var yi = 0; yi <= 3; yi++) {
            var val = yMin + (yRange * yi) / 3;
            var y = pad.top + gh - (gh * yi) / 3;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
            ctx.fillText(formatBytes(val), pad.left - 3, y + 3);
        }

        // X axis labels
        ctx.textAlign = 'center';
        var tStart = samples[0].time;
        var tEnd = samples[samples.length - 1].time;
        var tRange = tEnd - tStart || 1;

        // Total heap line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100,100,255,0.4)';
        ctx.lineWidth = 1;
        for (var ti = 0; ti < samples.length; ti++) {
            var x1 = pad.left + (gw * (samples[ti].time - tStart)) / tRange;
            var y1 = pad.top + gh - (gh * (samples[ti].total - yMin)) / yRange;
            if (ti === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
        }
        ctx.stroke();

        // Used heap line
        ctx.beginPath();
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 1.5;
        for (var ui = 0; ui < samples.length; ui++) {
            var x2 = pad.left + (gw * (samples[ui].time - tStart)) / tRange;
            var y2 = pad.top + gh - (gh * (samples[ui].used - yMin)) / yRange;
            if (ui === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        // Fill under used
        var lastX = pad.left + (gw * (samples[samples.length - 1].time - tStart)) / tRange;
        ctx.lineTo(lastX, pad.top + gh);
        ctx.lineTo(pad.left, pad.top + gh);
        ctx.closePath();
        ctx.fillStyle = 'rgba(79,195,247,0.08)';
        ctx.fill();

        // Legend
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#4fc3f7';
        ctx.fillText('Used', pad.left + 2, 10);
        ctx.fillStyle = 'rgba(100,100,255,0.7)';
        ctx.fillText('Total', pad.left + 40, 10);
    }

    function updateSummary() {
        if (!summaryEl) return;
        if (memHistory.length < 1) {
            summaryEl.textContent = 'Collecting...';
            return;
        }
        var cur = memHistory[memHistory.length - 1];
        var prev30 = memHistory[Math.max(0, memHistory.length - 31)];
        var delta = cur.used - prev30.used;
        var deltaColor = delta > 0 ? '#ff8a80' : '#69f0ae';
        var deltaStr = formatBytesDelta(delta);

        summaryEl.innerHTML =
            '<span style="color:#4fc3f7">' + formatBytes(cur.used) + '</span>' +
            ' / ' + formatBytes(cur.total) +
            '  <span style="color:' + deltaColor + '">\u039430s: ' + deltaStr + '</span>' +
            '  <span style="color:#666">Limit: ' + formatBytes(perf.memory.jsHeapSizeLimit) + '</span>';
    }

    function update() {
        sample();
        if (!panel) createPanel();
        updateSummary();
        drawGraph();
        if (reportVisible) {
            reportEl.value = generateReport();
        }
    }

    // Start sampling & rendering
    sample();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            createPanel();
            setInterval(update, SAMPLE_INTERVAL);
        });
    } else {
        createPanel();
        setInterval(update, SAMPLE_INTERVAL);
    }
})();
