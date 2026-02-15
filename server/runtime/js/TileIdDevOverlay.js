//=============================================================================
// TileIdDevOverlay.js - Tile ID debug overlay for playtest
//=============================================================================
// Activated when URL contains ?dev=true
// Shows grid lines + tile info tooltip on mouse hover
// Uses a separate HTML canvas overlay (no 3D scene dependency)
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev') && !window._forceDevPanel) return;

    var PANEL_ID = 'tileIdOverlay';
    var TILE_SIZE = 48;

    // Tile ID ranges
    var TILE_ID_A1 = 2048;
    var TILE_ID_A2 = 2816;
    var TILE_ID_A3 = 4352;
    var TILE_ID_A4 = 5888;
    var TILE_ID_A5 = 1536;
    var TILE_ID_MAX = 8192;

    // State
    var enabled = false;
    var lastMapId = null;
    var panel = null;
    var panelCtrl = null;

    // Overlay canvas
    var overlayCanvas = null;
    var overlayCtx = null;

    // Hover state
    var hoverTileX = -1;
    var hoverTileY = -1;
    var mouseScreenX = -1;
    var mouseScreenY = -1;

    // Layer colors
    var LAYER_CSS = ['#4fc3f7', '#81c784', '#ffb74d', '#f06292'];

    function describeTileId(tileId) {
        if (tileId === 0) return '';
        if (tileId >= TILE_ID_A1 && tileId < TILE_ID_A2) {
            var kind = Math.floor((tileId - TILE_ID_A1) / 48);
            var shape = (tileId - TILE_ID_A1) % 48;
            return 'A1 k' + kind + ' s' + shape;
        }
        if (tileId >= TILE_ID_A2 && tileId < TILE_ID_A3) {
            var kind = Math.floor((tileId - TILE_ID_A2) / 48);
            var shape = (tileId - TILE_ID_A2) % 48;
            return 'A2 k' + kind + ' s' + shape;
        }
        if (tileId >= TILE_ID_A3 && tileId < TILE_ID_A4) {
            var kind = Math.floor((tileId - TILE_ID_A3) / 48);
            var shape = (tileId - TILE_ID_A3) % 48;
            return 'A3 k' + kind + ' s' + shape;
        }
        if (tileId >= TILE_ID_A4 && tileId < TILE_ID_MAX) {
            var kind = Math.floor((tileId - TILE_ID_A4) / 48);
            var shape = (tileId - TILE_ID_A4) % 48;
            return 'A4 k' + kind + ' s' + shape;
        }
        if (tileId >= TILE_ID_A5 && tileId < TILE_ID_A1) {
            return 'A5 #' + (tileId - TILE_ID_A5);
        }
        if (tileId < 256) return 'B #' + tileId;
        if (tileId < 512) return 'C #' + (tileId - 256);
        if (tileId < 768) return 'D #' + (tileId - 512);
        if (tileId < 1024) return 'E #' + (tileId - 768);
        return '#' + tileId;
    }

    // ---- Overlay canvas (sits above game canvases) ----
    function ensureOverlayCanvas() {
        if (overlayCanvas) return;
        overlayCanvas = document.createElement('canvas');
        overlayCanvas.id = 'TileIdOverlayCanvas';
        overlayCanvas.style.cssText = [
            'position:absolute', 'top:0', 'left:0',
            'z-index:5',  // above UpperCanvas(3) but below UI panels(99998)
            'pointer-events:none',  // let clicks through
            'image-rendering:pixelated'
        ].join(';');
        document.body.appendChild(overlayCanvas);
        overlayCtx = overlayCanvas.getContext('2d');
        resizeOverlayCanvas();
    }

    function resizeOverlayCanvas() {
        if (!overlayCanvas) return;
        var w = Graphics.width;
        var h = Graphics.height;
        overlayCanvas.width = w;
        overlayCanvas.height = h;
        // Match game canvas position
        Graphics._centerElement(overlayCanvas);
    }

    function removeOverlayCanvas() {
        if (overlayCanvas && overlayCanvas.parentNode) {
            overlayCanvas.parentNode.removeChild(overlayCanvas);
        }
        overlayCanvas = null;
        overlayCtx = null;
    }

    // ---- Screen-to-tile conversion ----
    function screenToTile(screenX, screenY) {
        if (!$gameMap) return null;

        var is3D = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d &&
                   typeof Mode3D !== 'undefined' && Mode3D._active && Mode3D._perspCamera;

        if (is3D) {
            var world = Mode3D.screenToWorld(screenX, screenY);
            if (!world) return null;
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            var originX = $gameMap._displayX * tw;
            var originY = $gameMap._displayY * th;
            return {
                x: Math.floor((originX + world.x) / tw),
                y: Math.floor((originY + world.y) / th)
            };
        } else {
            return {
                x: $gameMap.canvasToMapX(screenX),
                y: $gameMap.canvasToMapY(screenY)
            };
        }
    }

    // ---- Draw grid + hover label on 2D overlay canvas ----
    function drawOverlay() {
        if (!overlayCtx || !$gameMap || !$dataMap) return;

        var w = overlayCanvas.width;
        var h = overlayCanvas.height;
        overlayCtx.clearRect(0, 0, w, h);

        if (!enabled) return;

        var mapW = $gameMap.width();
        var mapH = $gameMap.height();
        var tw = $gameMap.tileWidth();
        var th = $gameMap.tileHeight();
        var dx = $gameMap.displayX();
        var dy = $gameMap.displayY();

        // Pixel offset for scrolling
        var offsetX = -dx * tw;
        var offsetY = -dy * th;

        // ---- Grid lines ----
        overlayCtx.strokeStyle = 'rgba(255,255,255,0.25)';
        overlayCtx.lineWidth = 1;
        overlayCtx.beginPath();

        // Vertical lines
        for (var tx = 0; tx <= mapW; tx++) {
            var sx = Math.round(tx * tw + offsetX);
            if (sx < -1 || sx > w + 1) continue;
            overlayCtx.moveTo(sx + 0.5, Math.max(0, offsetY));
            overlayCtx.lineTo(sx + 0.5, Math.min(h, mapH * th + offsetY));
        }
        // Horizontal lines
        for (var ty = 0; ty <= mapH; ty++) {
            var sy = Math.round(ty * th + offsetY);
            if (sy < -1 || sy > h + 1) continue;
            overlayCtx.moveTo(Math.max(0, offsetX), sy + 0.5);
            overlayCtx.lineTo(Math.min(w, mapW * tw + offsetX), sy + 0.5);
        }
        overlayCtx.stroke();

        // ---- Hover highlight + label ----
        if (hoverTileX < 0 || hoverTileY < 0) return;
        if (hoverTileX >= mapW || hoverTileY >= mapH) return;

        var hx = Math.round(hoverTileX * tw + offsetX);
        var hy = Math.round(hoverTileY * th + offsetY);

        // Highlight hovered tile
        overlayCtx.fillStyle = 'rgba(79,195,247,0.2)';
        overlayCtx.fillRect(hx, hy, tw, th);
        overlayCtx.strokeStyle = '#4fc3f7';
        overlayCtx.lineWidth = 2;
        overlayCtx.strokeRect(hx + 1, hy + 1, tw - 2, th - 2);

        // Gather tile info
        var data = $gameMap.data();
        if (!data || data.length === 0) return;

        var lines = [];
        // Coordinate
        lines.push({ text: '(' + hoverTileX + ', ' + hoverTileY + ')', color: '#fff' });

        for (var z = 0; z < 4; z++) {
            var idx = (z * mapH + hoverTileY) * mapW + hoverTileX;
            var tileId = data[idx];
            if (!tileId || tileId === 0) continue;
            var desc = describeTileId(tileId);
            if (desc) {
                lines.push({ text: 'L' + z + ': ' + desc, color: LAYER_CSS[z] });
            }
        }

        // Region
        var region = $gameMap.regionId(hoverTileX, hoverTileY);
        if (region > 0) {
            lines.push({ text: 'Region: ' + region, color: '#ff8a80' });
        }

        if (lines.length <= 1) {
            lines.push({ text: '(empty)', color: '#666' });
        }

        // ---- Draw tooltip box ----
        var fontSize = 14;
        var lineH = fontSize + 4;
        var padding = 8;
        overlayCtx.font = 'bold ' + fontSize + 'px monospace';

        // Measure max text width
        var maxTextW = 0;
        for (var i = 0; i < lines.length; i++) {
            var m = overlayCtx.measureText(lines[i].text);
            if (m.width > maxTextW) maxTextW = m.width;
        }

        var boxW = maxTextW + padding * 2;
        var boxH = lines.length * lineH + padding * 2;

        // Position: prefer right-bottom of the tile, but clamp to screen
        var bx = hx + tw + 4;
        var by = hy;
        if (bx + boxW > w) bx = hx - boxW - 4;
        if (by + boxH > h) by = h - boxH;
        if (bx < 0) bx = 0;
        if (by < 0) by = 0;

        // Background
        overlayCtx.fillStyle = 'rgba(0,0,0,0.8)';
        var r = 6;
        overlayCtx.beginPath();
        overlayCtx.moveTo(bx + r, by);
        overlayCtx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r);
        overlayCtx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r);
        overlayCtx.arcTo(bx, by + boxH, bx, by, r);
        overlayCtx.arcTo(bx, by, bx + boxW, by, r);
        overlayCtx.fill();

        // Border
        overlayCtx.strokeStyle = 'rgba(79,195,247,0.5)';
        overlayCtx.lineWidth = 1;
        overlayCtx.stroke();

        // Text
        overlayCtx.textAlign = 'left';
        overlayCtx.textBaseline = 'top';
        overlayCtx.shadowColor = '#000';
        overlayCtx.shadowBlur = 2;

        for (var i = 0; i < lines.length; i++) {
            overlayCtx.fillStyle = lines[i].color;
            overlayCtx.fillText(lines[i].text, bx + padding, by + padding + i * lineH);
        }
        overlayCtx.shadowBlur = 0;
    }

    // ---- Mouse tracking ----
    var mouseListenerAttached = false;
    function attachMouseListener() {
        if (mouseListenerAttached) return;

        // Listen on document to catch mouse over any layer
        document.addEventListener('mousemove', function(e) {
            if (!enabled) return;

            // Get game canvas bounding rect to translate coordinates
            var gc = document.querySelector('#GameCanvas');
            if (!gc) return;
            var rect = gc.getBoundingClientRect();
            var sx = e.clientX - rect.left;
            var sy = e.clientY - rect.top;

            // Out of bounds
            if (sx < 0 || sy < 0 || sx >= rect.width || sy >= rect.height) {
                mouseScreenX = -1;
                mouseScreenY = -1;
                hoverTileX = -1;
                hoverTileY = -1;
                return;
            }

            // Scale to game resolution (canvas might be CSS-scaled)
            var scaleX = Graphics.width / rect.width;
            var scaleY = Graphics.height / rect.height;
            mouseScreenX = sx * scaleX;
            mouseScreenY = sy * scaleY;

            var tile = screenToTile(mouseScreenX, mouseScreenY);
            if (tile) {
                hoverTileX = tile.x;
                hoverTileY = tile.y;
            } else {
                hoverTileX = -1;
                hoverTileY = -1;
            }
        });

        document.addEventListener('mouseleave', function() {
            mouseScreenX = -1;
            mouseScreenY = -1;
            hoverTileX = -1;
            hoverTileY = -1;
        });

        mouseListenerAttached = true;
    }

    // ---- Enable / Disable ----
    function onEnable() {
        ensureOverlayCanvas();
        attachMouseListener();
        lastMapId = $gameMap ? $gameMap.mapId() : null;
    }

    function onDisable() {
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
        hoverTileX = -1;
        hoverTileY = -1;
    }

    // ---- Dev Panel UI ----
    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'tile-id-dev-overlay';
        panel.style.cssText = [
            'position:fixed', 'top:10px', 'left:10px', 'z-index:99998',
            'background:rgba(0,0,0,0.85)', 'color:#4fc3f7',
            'font:11px/1.4 monospace', 'padding:6px 8px',
            'pointer-events:auto', 'user-select:none',
            'min-width:160px',
            'border:1px solid rgba(79,195,247,0.3)', 'border-radius:4px'
        ].join(';');

        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'font-weight:bold;font-size:12px;margin-bottom:4px;color:#4fc3f7;display:flex;align-items:center;';
        titleBar.textContent = 'Tile ID';
        panel.appendChild(titleBar);

        var bodyEl = document.createElement('div');

        // Enable checkbox
        var label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0;';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = enabled;
        cb.addEventListener('change', function() {
            enabled = cb.checked;
            if (enabled) {
                onEnable();
            } else {
                onDisable();
            }
            if (panelCtrl) {
                panelCtrl.setExtra({ enabled: enabled });
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode('격자 + 타일 ID (호버)'));
        bodyEl.appendChild(label);

        // Info text
        var info = document.createElement('div');
        info.style.cssText = 'color:#888;font-size:10px;margin-top:4px;';
        info.innerHTML = [
            '<span style="color:#4fc3f7">L0</span> ',
            '<span style="color:#81c784">L1</span> ',
            '<span style="color:#ffb74d">L2</span> ',
            '<span style="color:#f06292">L3</span> ',
            '= 레이어 | 마우스 올려서 확인'
        ].join('');
        bodyEl.appendChild(info);

        panel.appendChild(bodyEl);
        document.body.appendChild(panel);

        panelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
            defaultPosition: 'bottom-left',
            titleBar: titleBar,
            bodyEl: bodyEl,
            defaultCollapsed: false
        });

        // Restore state
        var extra = panelCtrl.getExtra();
        if (extra && extra.enabled) {
            enabled = true;
            cb.checked = true;
            onEnable();
        }
    }

    // ---- Scene_Map hooks ----
    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (!panel) createPanel();
        lastMapId = null;
        if (enabled) onEnable();
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (!enabled) return;

        // Resize canvas if needed
        if (overlayCanvas &&
            (overlayCanvas.width !== Graphics.width || overlayCanvas.height !== Graphics.height)) {
            resizeOverlayCanvas();
        }

        // Map changed
        if ($gameMap && $gameMap.mapId() !== lastMapId) {
            lastMapId = $gameMap.mapId();
        }

        // Redraw every frame (grid scrolls with map)
        drawOverlay();
    };
})();
