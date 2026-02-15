//=============================================================================
// TileIdDevOverlay.js - Tile ID debug overlay for playtest
//=============================================================================
// Activated when URL contains ?dev=true
// Shows grid lines in 3D scene + tile info tooltip on mouse hover
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
    var lastMapId = null;
    var panel = null;
    var panelCtrl = null;

    // Hover state
    var hoverTileX = -1;
    var hoverTileY = -1;
    var hoverMesh = null;
    var hoverCanvas = null;
    var hoverCtx = null;
    var hoverTexture = null;
    var mouseScreenX = -1;
    var mouseScreenY = -1;

    // Layer colors
    var LAYER_CSS = ['#4fc3f7', '#81c784', '#ffb74d', '#f06292'];

    // Hover label size (covers 3x3 tiles for readability)
    var LABEL_SIZE = TILE_SIZE * 3;

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

    // ---- Hover label (single mesh, follows mouse tile) ----
    function ensureHoverMesh() {
        var THREE = window.THREE;
        if (!THREE) return;
        if (hoverMesh) return;

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

        // Gather tile info for all layers
        var lines = [];
        for (var z = 0; z < 4; z++) {
            var idx = (z * mapH + tileY) * mapW + tileX;
            var tileId = data[idx];
            if (!tileId || tileId === 0) continue;
            var desc = describeTileId(tileId);
            if (desc) {
                lines.push({ text: 'L' + z + ': ' + desc, color: LAYER_CSS[z] });
            }
        }

        // Also show region (layer 3 raw value if it's a region)
        var regionIdx = (3 * mapH + tileY) * mapW + tileX;
        var regionId = data[regionIdx];
        // Region IDs are stored in flags layer (z=5), but in RPG Maker MV
        // they're accessed via $gameMap.regionId()
        var region = $gameMap.regionId(tileX, tileY);
        if (region > 0) {
            lines.push({ text: 'Region: ' + region, color: '#ff8a80' });
        }

        if (lines.length === 0) {
            lines.push({ text: '(empty)', color: '#666' });
        }

        // Add coordinate header
        lines.unshift({ text: '(' + tileX + ', ' + tileY + ')', color: '#fff' });

        // Draw on canvas
        var cvs = hoverCanvas;
        var ctx = hoverCtx;
        var cvsW = cvs.width;
        var cvsH = cvs.height;

        // Y-flip for Mode3D: draw upside-down so it renders correctly
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
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        var r = 12, bx = 8, by = 8, bw = cvsW - 16, bh = cvsH - 16;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.fill();

        var fontSize = lines.length <= 3 ? 32 : lines.length <= 5 ? 26 : 22;
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
            ctx.fillText(lines[i].text, cvsW / 2, startY + i * lineHeight, cvsW - 24);
        }

        ctx.restore();
        hoverTexture.needsUpdate = true;

        // Position mesh at hovered tile center
        hoverMesh.position.set(
            tileX * TILE_SIZE + TILE_SIZE / 2,
            tileY * TILE_SIZE + TILE_SIZE / 2,
            6
        );
        hoverMesh.visible = true;
    }

    function screenToTile(screenX, screenY) {
        if (!$gameMap) return null;
        var is3D = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d &&
                   typeof Mode3D !== 'undefined' && Mode3D._active && Mode3D._perspCamera;

        if (is3D) {
            var world = Mode3D.screenToWorld(screenX, screenY);
            if (!world) return null;
            var tileWidth = $gameMap.tileWidth();
            var tileHeight = $gameMap.tileHeight();
            var originX = $gameMap._displayX * tileWidth;
            var originY = $gameMap._displayY * tileHeight;
            return {
                x: Math.floor((originX + world.x) / tileWidth),
                y: Math.floor((originY + world.y) / tileHeight)
            };
        } else {
            // 2D mode
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            return {
                x: $gameMap.canvasToMapX(screenX),
                y: $gameMap.canvasToMapY(screenY)
            };
        }
    }

    // ---- Mouse tracking ----
    function onMouseMove(e) {
        if (!enabled) return;
        var canvas = e.target;
        var rect = canvas.getBoundingClientRect();
        mouseScreenX = e.clientX - rect.left;
        mouseScreenY = e.clientY - rect.top;
    }

    var mouseListenerAttached = false;
    function attachMouseListener() {
        if (mouseListenerAttached) return;
        // Find the game canvas (WebGL or 2D)
        var canvas = document.querySelector('#GameCanvas') || document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseleave', function() {
                mouseScreenX = -1;
                mouseScreenY = -1;
                if (hoverMesh) hoverMesh.visible = false;
                hoverTileX = -1;
                hoverTileY = -1;
            });
            mouseListenerAttached = true;
        }
    }

    // ---- Grid / overlay management ----
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
            hoverMesh.visible = false;
        }
    }

    function removeHoverMesh() {
        var scene = getScene();
        if (hoverMesh && scene) {
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
        removeHoverMesh();
        if (!enabled) return;
        if (!$gameMap || !$dataMap) return;

        var scene = getScene();
        if (!scene) return;

        var mapW = $gameMap.width();
        var mapH = $gameMap.height();

        // Grid
        gridMesh = createGrid(mapW, mapH);
        if (gridMesh) scene.add(gridMesh);

        // Prepare hover mesh (add to scene but invisible)
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
            return;
        }

        var tile = screenToTile(mouseScreenX, mouseScreenY);
        if (!tile) {
            if (hoverMesh) hoverMesh.visible = false;
            return;
        }

        // Only redraw if tile changed
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

        // Enable checkbox
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
        // Rebuild if map changed
        if ($gameMap && $gameMap.mapId() !== lastMapId) {
            buildOverlay();
        }
        // Update hover label
        updateHover();
    };
})();
