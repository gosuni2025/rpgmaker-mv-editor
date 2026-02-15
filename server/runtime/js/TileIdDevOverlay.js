//=============================================================================
// TileIdDevOverlay.js - Tile ID debug overlay for playtest
//=============================================================================
// Activated when URL contains ?dev=true
// Shows tile ID (sheet + kind/shape) for each tile with grid lines
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
    var labelMeshes = [];
    var lastMapId = null;
    var panel = null;
    var panelCtrl = null;

    // Layer colors
    var LAYER_COLORS = [0x4fc3f7, 0x81c784, 0xffb74d, 0xf06292];
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

        // Vertical lines
        for (var x = 0; x <= mapW; x++) {
            vertices.push(x * TILE_SIZE, 0, 0);
            vertices.push(x * TILE_SIZE, totalH, 0);
        }
        // Horizontal lines
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

    function createLabels(mapW, mapH, data) {
        var THREE = window.THREE;
        if (!THREE) return [];

        var meshes = [];
        var sharedGeom = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

        for (var y = 0; y < mapH; y++) {
            for (var x = 0; x < mapW; x++) {
                var lines = [];
                for (var z = 0; z < 4; z++) {
                    var idx = (z * mapH + y) * mapW + x;
                    var tileId = data[idx];
                    if (!tileId || tileId === 0) continue;
                    var desc = describeTileId(tileId);
                    if (desc) {
                        lines.push({ text: 'L' + z + ':' + desc, color: LAYER_CSS[z] });
                    }
                }
                if (lines.length === 0) continue;

                var cvsW = 128, cvsH = 128;
                var cvs = document.createElement('canvas');
                cvs.width = cvsW;
                cvs.height = cvsH;
                var ctx = cvs.getContext('2d');
                ctx.clearRect(0, 0, cvsW, cvsH);

                // Background
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.beginPath();
                var r = 6, bx = 4, by = 4, bw = cvsW - 8, bh = cvsH - 8;
                ctx.moveTo(bx + r, by);
                ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
                ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
                ctx.arcTo(bx, by + bh, bx, by, r);
                ctx.arcTo(bx, by, bx + bw, by, r);
                ctx.fill();

                var fontSize = lines.length <= 2 ? 22 : lines.length <= 3 ? 18 : 15;
                ctx.font = 'bold ' + fontSize + 'px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 2;

                var totalH = lines.length * (fontSize + 4);
                var startY = (cvsH - totalH) / 2 + (fontSize + 4) / 2;

                for (var i = 0; i < lines.length; i++) {
                    ctx.fillStyle = lines[i].color;
                    ctx.fillText(lines[i].text, cvsW / 2, startY + i * (fontSize + 4), cvsW - 12);
                }

                var tex = new THREE.CanvasTexture(cvs);
                tex.minFilter = THREE.LinearFilter;
                var mat = new THREE.MeshBasicMaterial({
                    map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide
                });
                var mesh = new THREE.Mesh(sharedGeom, mat);
                mesh.position.set(
                    x * TILE_SIZE + TILE_SIZE / 2,
                    y * TILE_SIZE + TILE_SIZE / 2,
                    4.8
                );
                mesh.renderOrder = 9991;
                mesh.frustumCulled = false;
                mesh.userData._tileIdOverlay = true;
                meshes.push(mesh);
            }
        }
        return meshes;
    }

    function removeOverlay() {
        var scene = getScene();
        if (!scene) return;

        if (gridMesh) {
            scene.remove(gridMesh);
            if (gridMesh.geometry) gridMesh.geometry.dispose();
            if (gridMesh.material) gridMesh.material.dispose();
            gridMesh = null;
        }
        for (var i = 0; i < labelMeshes.length; i++) {
            var m = labelMeshes[i];
            scene.remove(m);
            if (m.material && m.material.map) m.material.map.dispose();
            if (m.material) m.material.dispose();
        }
        labelMeshes = [];
        // Shared geom disposed by GC since all refs removed
    }

    function buildOverlay() {
        removeOverlay();
        if (!enabled) return;
        if (!$gameMap || !$dataMap) return;

        var scene = getScene();
        if (!scene) return;

        var mapW = $gameMap.width();
        var mapH = $gameMap.height();
        var data = $gameMap.data();
        if (!data || data.length === 0) return;

        // Grid
        gridMesh = createGrid(mapW, mapH);
        if (gridMesh) scene.add(gridMesh);

        // Labels
        labelMeshes = createLabels(mapW, mapH, data);
        for (var i = 0; i < labelMeshes.length; i++) {
            scene.add(labelMeshes[i]);
        }

        lastMapId = $gameMap.mapId();
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
            // Save state
            if (panelCtrl) {
                panelCtrl.setExtra({ enabled: enabled });
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode('타일 ID + 격자 표시'));
        bodyEl.appendChild(label);

        // Info text
        var info = document.createElement('div');
        info.style.cssText = 'color:#888;font-size:10px;margin-top:4px;';
        info.innerHTML = [
            '<span style="color:#4fc3f7">L0</span> ',
            '<span style="color:#81c784">L1</span> ',
            '<span style="color:#ffb74d">L2</span> ',
            '<span style="color:#f06292">L3</span> ',
            '= 레이어'
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
        // Map changed → rebuild
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
    };
})();
