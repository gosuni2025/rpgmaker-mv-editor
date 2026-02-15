//=============================================================================
// TileIdDevOverlay.js - Tile ID debug overlay for playtest
//=============================================================================
// Activated when URL contains ?dev=true
// Shows grid lines in THREE.js scene + tile info tooltip on mouse hover
// Toggle via dev panel checkbox
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
    var gridMesh = null;
    var hoverMesh = null;
    var hoverCanvas = null;
    var hoverCtx = null;
    var hoverTexture = null;
    var lastMapId = null;
    var panel = null;
    var panelCtrl = null;

    // Hover state
    var hoverTileX = -1;
    var hoverTileY = -1;
    var mouseScreenX = -1;
    var mouseScreenY = -1;

    // Layer colors
    var LAYER_CSS = ['#4fc3f7', '#81c784', '#ffb74d', '#f06292'];

    // Hover label covers 3x3 tiles for readability
    var LABEL_TILE_SPAN = 3;
    var LABEL_SIZE = TILE_SIZE * LABEL_TILE_SPAN;

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

    function getScene() {
        if (typeof PostProcess !== 'undefined' && PostProcess._renderPass) {
            return PostProcess._renderPass.scene;
        }
        if (typeof PostProcess !== 'undefined' && PostProcess._2dRenderPass && PostProcess._2dRenderPass._rendererObj) {
            return PostProcess._2dRenderPass._rendererObj.scene;
        }
        return null;
    }

    // ---- Grid mesh (world-space, position updated each frame for scroll) ----
    function createGrid(mapW, mapH) {
        var THREE = window.THREE;
        if (!THREE) return null;

        var totalW = mapW * TILE_SIZE;
        var totalH = mapH * TILE_SIZE;
        var vertices = [];

        for (var x = 0; x <= mapW; x++) {
            vertices.push(x * TILE_SIZE, 0, 0);
            vertices.push(x * TILE_SIZE, totalH, 0);
        }
        for (var y = 0; y <= mapH; y++) {
            vertices.push(0, y * TILE_SIZE, 0);
            vertices.push(totalW, y * TILE_SIZE, 0);
        }

        var geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        var mat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            depthTest: false
        });
        var lines = new THREE.LineSegments(geom, mat);
        lines.renderOrder = 9990;
        lines.position.z = 5;
        lines.frustumCulled = false;
        lines.userData._tileIdOverlay = true;
        return lines;
    }

    // ---- Hover label mesh (single, reused) ----
    function ensureHoverMesh() {
        var THREE = window.THREE;
        if (!THREE || hoverMesh) return;

        var cvsSize = 256;
        hoverCanvas = document.createElement('canvas');
        hoverCanvas.width = cvsSize;
        hoverCanvas.height = cvsSize;
        hoverCtx = hoverCanvas.getContext('2d');

        hoverTexture = new THREE.CanvasTexture(hoverCanvas);
        hoverTexture.minFilter = THREE.LinearFilter;

        var geom = new THREE.PlaneGeometry(LABEL_SIZE, LABEL_SIZE);
        var mat = new THREE.MeshBasicMaterial({
            map: hoverTexture,
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide
        });
        hoverMesh = new THREE.Mesh(geom, mat);
        hoverMesh.renderOrder = 9992;
        hoverMesh.frustumCulled = false;
        hoverMesh.userData._tileIdOverlay = true;
        hoverMesh.visible = false;
    }

    function updateHoverLabel(tileX, tileY) {
        if (!$gameMap || !$dataMap) return;
        var mapW = $gameMap.width();
        var mapH = $gameMap.height();
        var data = $gameMap.data();
        if (!data || data.length === 0) return;

        if (tileX < 0 || tileX >= mapW || tileY < 0 || tileY >= mapH) {
            if (hoverMesh) hoverMesh.visible = false;
            return;
        }

        ensureHoverMesh();
        if (!hoverMesh) return;

        // Gather tile info
        var lines = [];
        lines.push({ text: '(' + tileX + ', ' + tileY + ')', color: '#fff' });

        for (var z = 0; z < 4; z++) {
            var idx = (z * mapH + tileY) * mapW + tileX;
            var tileId = data[idx];
            if (!tileId || tileId === 0) continue;
            var desc = describeTileId(tileId);
            if (desc) {
                lines.push({ text: 'L' + z + ': ' + desc, color: LAYER_CSS[z] });
            }
        }

        var region = $gameMap.regionId(tileX, tileY);
        if (region > 0) {
            lines.push({ text: 'Region: ' + region, color: '#ff8a80' });
        }

        if (lines.length <= 1) {
            lines.push({ text: '(empty)', color: '#666' });
        }

        // Draw on canvas (with Y-flip for Mode3D)
        var cvs = hoverCanvas;
        var ctx = hoverCtx;
        var cvsW = cvs.width;
        var cvsH = cvs.height;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cvsW, cvsH);

        var is3D = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d &&
                   typeof Mode3D !== 'undefined' && Mode3D._active;
        if (is3D) {
            ctx.translate(0, cvsH);
            ctx.scale(1, -1);
        }

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        var r = 12, bx = 6, by = 6, bw = cvsW - 12, bh = cvsH - 12;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(79,195,247,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        var fontSize = lines.length <= 3 ? 30 : lines.length <= 5 ? 24 : 20;
        ctx.font = 'bold ' + fontSize + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;

        var lineHeight = fontSize + 6;
        var totalTextH = lines.length * lineHeight;
        var startY = (cvsH - totalTextH) / 2 + lineHeight / 2;

        for (var i = 0; i < lines.length; i++) {
            ctx.fillStyle = lines[i].color;
            ctx.fillText(lines[i].text, cvsW / 2, startY + i * lineHeight, cvsW - 20);
        }

        ctx.restore();
        hoverTexture.needsUpdate = true;

        // Position in world space (tile center)
        // Note: scroll offset is NOT applied here — it's applied via updateScrollPosition()
        hoverMesh.position.set(
            tileX * TILE_SIZE + TILE_SIZE / 2,
            tileY * TILE_SIZE + TILE_SIZE / 2,
            6
        );
        hoverMesh.visible = true;
    }

    // ---- Scroll: offset grid & hover mesh to match camera scroll ----
    function updateScrollPosition() {
        if (!$gameMap) return;
        var ox = -$gameMap.displayX() * TILE_SIZE;
        var oy = -$gameMap.displayY() * TILE_SIZE;

        if (gridMesh) {
            gridMesh.position.x = ox;
            gridMesh.position.y = oy;
        }
        if (hoverMesh && hoverMesh.visible) {
            // hoverMesh position is set in world coords (tileX*48+24, tileY*48+24)
            // Apply same scroll offset
            hoverMesh.position.x = hoverTileX * TILE_SIZE + TILE_SIZE / 2 + ox;
            hoverMesh.position.y = hoverTileY * TILE_SIZE + TILE_SIZE / 2 + oy;
        }
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

    // ---- Mouse tracking (document level to bypass UpperCanvas) ----
    var mouseListenerAttached = false;
    function attachMouseListener() {
        if (mouseListenerAttached) return;

        document.addEventListener('mousemove', function(e) {
            if (!enabled) return;
            var gc = document.querySelector('#GameCanvas');
            if (!gc) return;
            var rect = gc.getBoundingClientRect();
            var sx = e.clientX - rect.left;
            var sy = e.clientY - rect.top;

            if (sx < 0 || sy < 0 || sx >= rect.width || sy >= rect.height) {
                mouseScreenX = -1;
                mouseScreenY = -1;
                return;
            }

            // Scale to game resolution (CSS-scaled canvas)
            var scaleX = Graphics.width / rect.width;
            var scaleY = Graphics.height / rect.height;
            mouseScreenX = sx * scaleX;
            mouseScreenY = sy * scaleY;
        });

        document.addEventListener('mouseleave', function() {
            mouseScreenX = -1;
            mouseScreenY = -1;
        });

        mouseListenerAttached = true;
    }

    // ---- Overlay management ----
    function removeOverlay() {
        var scene = getScene();
        if (!scene) return;

        if (gridMesh) {
            scene.remove(gridMesh);
            if (gridMesh.geometry) gridMesh.geometry.dispose();
            if (gridMesh.material) gridMesh.material.dispose();
            gridMesh = null;
        }
        if (hoverMesh) {
            scene.remove(hoverMesh);
            if (hoverMesh.geometry) hoverMesh.geometry.dispose();
            if (hoverMesh.material) hoverMesh.material.dispose();
            if (hoverTexture) hoverTexture.dispose();
            hoverMesh = null;
            hoverCanvas = null;
            hoverCtx = null;
            hoverTexture = null;
        }
    }

    function buildOverlay() {
        removeOverlay();
        if (!enabled) return;
        if (!$gameMap || !$dataMap) return;

        var scene = getScene();
        if (!scene) return;

        var mapW = $gameMap.width();
        var mapH = $gameMap.height();

        gridMesh = createGrid(mapW, mapH);
        if (gridMesh) scene.add(gridMesh);

        ensureHoverMesh();
        if (hoverMesh) scene.add(hoverMesh);

        lastMapId = $gameMap.mapId();
        hoverTileX = -1;
        hoverTileY = -1;

        attachMouseListener();
    }

    function updateHover() {
        if (!enabled) return;

        if (mouseScreenX < 0 || mouseScreenY < 0) {
            if (hoverMesh) hoverMesh.visible = false;
            hoverTileX = -1;
            hoverTileY = -1;
            return;
        }

        var tile = screenToTile(mouseScreenX, mouseScreenY);
        if (!tile) {
            if (hoverMesh) hoverMesh.visible = false;
            hoverTileX = -1;
            hoverTileY = -1;
            return;
        }

        if (tile.x !== hoverTileX || tile.y !== hoverTileY) {
            hoverTileX = tile.x;
            hoverTileY = tile.y;
            updateHoverLabel(tile.x, tile.y);
        }
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

        var label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0;';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = enabled;
        cb.addEventListener('change', function() {
            enabled = cb.checked;
            if (enabled) {
                buildOverlay();
            } else {
                removeOverlay();
            }
            if (panelCtrl) {
                panelCtrl.setExtra({ enabled: enabled });
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode('격자 + 타일 ID (호버)'));
        bodyEl.appendChild(label);

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

        var extra = panelCtrl.getExtra();
        if (extra && extra.enabled) {
            enabled = true;
            cb.checked = true;
        }
    }

    // ---- Scene_Map hooks ----
    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (!panel) createPanel();
        lastMapId = null;
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (!enabled) return;

        if ($gameMap && $gameMap.mapId() !== lastMapId) {
            buildOverlay();
        }

        // Update scroll offset for grid & hover mesh
        updateScrollPosition();

        // Update hover from mouse position
        updateHover();
    };
})();
