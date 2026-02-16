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
    var last3DMode = false;
    var panel = null;
    var panelCtrl = null;

    // Temp bitmap for drawing tiles
    var tmpBitmap = null;

    // Hover state
    var hoverTileX = -1;
    var hoverTileY = -1;
    var mouseScreenX = -1;
    var mouseScreenY = -1;
    var lastCopyInfo = '';

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

    // Return tileset sheet name for a tileId
    function getTilesetName(tileId) {
        if (tileId === 0) return '';
        var tileset = $dataTilesets[$gameMap.tilesetId()];
        if (!tileset) return '';
        var setNumber = -1;
        if (Tilemap.isTileA1(tileId)) setNumber = 0;
        else if (Tilemap.isTileA2(tileId)) setNumber = 1;
        else if (Tilemap.isTileA3(tileId)) setNumber = 2;
        else if (Tilemap.isTileA4(tileId)) setNumber = 3;
        else if (Tilemap.isTileA5(tileId)) setNumber = 4;
        else setNumber = 5 + Math.floor(tileId / 256);
        return tileset.tilesetNames[setNumber] || '';
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

    // ---- Draw tile image onto a 2D canvas context ----
    function getTilemap() {
        if (!SceneManager._scene || !SceneManager._scene._spriteset) return null;
        return SceneManager._scene._spriteset._tilemap;
    }

    // Proxy object with Tilemap.prototype methods (not ShaderTilemap)
    // to use bltImage-based drawing instead of addRect
    var tileDrawProxy = null;
    function ensureTileDrawProxy() {
        if (tileDrawProxy) return;
        tileDrawProxy = Object.create(Tilemap.prototype);
        tileDrawProxy._tileWidth = TILE_SIZE;
        tileDrawProxy._tileHeight = TILE_SIZE;
        tileDrawProxy.flags = [];
        tileDrawProxy.animationFrame = 0;
    }

    function drawTileOnCanvas(ctx, tileId, dx, dy, tileW, tileH) {
        if (!tileId || tileId === 0) return;
        var tilemap = getTilemap();
        if (!tilemap) return;

        ensureTileDrawProxy();
        // Copy bitmaps and flags from the real tilemap
        tileDrawProxy.bitmaps = tilemap.bitmaps;
        tileDrawProxy.flags = tilemap.flags;
        tileDrawProxy.animationFrame = tilemap.animationFrame || 0;

        if (!tmpBitmap) {
            tmpBitmap = new Bitmap(TILE_SIZE, TILE_SIZE);
        }
        tmpBitmap.clear();
        // Use Tilemap.prototype._drawTile (bltImage-based, not ShaderTilemap's addRect)
        Tilemap.prototype._drawTile.call(tileDrawProxy, tmpBitmap, tileId, 0, 0);
        if (tmpBitmap.canvas && tmpBitmap.canvas.width > 0) {
            ctx.drawImage(tmpBitmap.canvas, 0, 0, TILE_SIZE, TILE_SIZE, dx, dy, tileW, tileH);
        }
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
        lines.userData.editorGrid = true;
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
        hoverMesh.userData.editorGrid = true;
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

        // 3D 모드일 때 월드 좌표 표시
        if (is3DActive() && mouseScreenX >= 0 && mouseScreenY >= 0) {
            var w3d = Mode3D.screenToWorld(mouseScreenX, mouseScreenY);
            if (w3d) {
                var _tw = $gameMap.tileWidth();
                var _th = $gameMap.tileHeight();
                var wx = $gameMap._displayX * _tw + w3d.x;
                var wy = $gameMap._displayY * _th + w3d.y;
                lines.push({ text: 'xyz: ' + wx.toFixed(0) + ', ' + wy.toFixed(0) + ', 0', color: '#ce93d8' });
            }
        }

        var tileIds = [];
        for (var z = 0; z < 4; z++) {
            var idx = (z * mapH + tileY) * mapW + tileX;
            var tileId = data[idx];
            tileIds.push(tileId);
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

        // Build copy info string
        var mapName = $dataMapInfos[$gameMap.mapId()] ? $dataMapInfos[$gameMap.mapId()].name : '';
        var copyLines = [];
        copyLines.push('Map: #' + $gameMap.mapId() + ' ' + mapName);
        copyLines.push('Tile: (' + tileX + ', ' + tileY + ')');

        // 3D 월드 좌표 추가
        if (is3DActive() && mouseScreenX >= 0 && mouseScreenY >= 0) {
            var world3D = Mode3D.screenToWorld(mouseScreenX, mouseScreenY);
            if (world3D) {
                var tw = $gameMap.tileWidth();
                var th = $gameMap.tileHeight();
                var worldX = $gameMap._displayX * tw + world3D.x;
                var worldY = $gameMap._displayY * th + world3D.y;
                var worldZ = 0; // Z=0 plane intersection
                copyLines.push('3D World: (' + worldX.toFixed(1) + ', ' + worldY.toFixed(1) + ', ' + worldZ.toFixed(1) + ')');
            }
        }

        for (var z = 0; z < 4; z++) {
            if (tileIds[z] && tileIds[z] !== 0) {
                var sheetName = getTilesetName(tileIds[z]);
                copyLines.push('L' + z + ': ' + describeTileId(tileIds[z]) + ' (id=' + tileIds[z] + ')' + (sheetName ? ' [' + sheetName + ']' : ''));
            }
        }
        if (region > 0) copyLines.push('Region: ' + region);
        lastCopyInfo = copyLines.join('\n');

        // Draw on canvas
        var cvs = hoverCanvas;
        var ctx = hoverCtx;
        var cvsW = cvs.width;
        var cvsH = cvs.height;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cvsW, cvsH);

        // Y-flip: THREE.js 렌더러의 OrthographicCamera가 top=0,bottom=height로
        // Y-down 좌표계를 사용하고, 3D 모드에서도 m[5]=-m[5]로 Y 반전하므로
        // CanvasTexture는 항상 뒤집어 그려야 함
        ctx.translate(0, cvsH);
        ctx.scale(1, -1);

        // ---- Background: tile images ----
        // Draw tile images as background (centered, scaled up)
        var tileBgSize = 80; // tile preview size
        var tileBgY = 10;
        var tileBgX = (cvsW - tileBgSize) / 2;

        // Dark background first
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        var r = 12, bgx = 4, bgy = 4, bgw = cvsW - 8, bgh = cvsH - 8;
        ctx.beginPath();
        ctx.moveTo(bgx + r, bgy);
        ctx.arcTo(bgx + bgw, bgy, bgx + bgw, bgy + bgh, r);
        ctx.arcTo(bgx + bgw, bgy + bgh, bgx, bgy + bgh, r);
        ctx.arcTo(bgx, bgy + bgh, bgx, bgy, r);
        ctx.arcTo(bgx, bgy, bgx + bgw, bgy, r);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(79,195,247,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw tile images (all layers stacked)
        // Checkerboard background for transparency
        var cbSize = 8;
        ctx.save();
        ctx.beginPath();
        ctx.rect(tileBgX, tileBgY, tileBgSize, tileBgSize);
        ctx.clip();
        for (var cy = 0; cy < tileBgSize; cy += cbSize) {
            for (var cx = 0; cx < tileBgSize; cx += cbSize) {
                ctx.fillStyle = ((cx / cbSize + cy / cbSize) % 2 === 0) ? '#444' : '#333';
                ctx.fillRect(tileBgX + cx, tileBgY + cy, cbSize, cbSize);
            }
        }
        ctx.restore();

        // Draw each layer's tile
        for (var z = 0; z < 4; z++) {
            if (tileIds[z] && tileIds[z] !== 0) {
                drawTileOnCanvas(ctx, tileIds[z], tileBgX, tileBgY, tileBgSize, tileBgSize);
            }
        }

        // Tile preview border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tileBgX, tileBgY, tileBgSize, tileBgSize);

        // ---- Text info below tile preview ----
        var textStartY = tileBgY + tileBgSize + 10;
        var fontSize = lines.length <= 3 ? 22 : lines.length <= 5 ? 18 : 15;
        ctx.font = 'bold ' + fontSize + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;

        var lineHeight = fontSize + 4;

        for (var i = 0; i < lines.length; i++) {
            ctx.fillStyle = lines[i].color;
            ctx.fillText(lines[i].text, cvsW / 2, textStartY + i * lineHeight, cvsW - 16);
        }

        // Copy hint at bottom
        ctx.font = 'bold 30px monospace';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowBlur = 0;
        var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        ctx.fillText((isMac ? '⌘' : 'Ctrl') + '+C: 복사', cvsW / 2, cvsH - 8);

        ctx.restore();
        hoverTexture.needsUpdate = true;

        // Position in world space (tile center)
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
            hoverMesh.position.x = hoverTileX * TILE_SIZE + TILE_SIZE / 2 + ox;
            hoverMesh.position.y = hoverTileY * TILE_SIZE + TILE_SIZE / 2 + oy;
        }
    }

    // ---- Screen-to-tile conversion ----
    function screenToTile(screenX, screenY) {
        if (!$gameMap) return null;

        if (is3DActive()) {
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

            var scaleX = Graphics.width / rect.width;
            var scaleY = Graphics.height / rect.height;
            mouseScreenX = sx * scaleX;
            mouseScreenY = sy * scaleY;
        });

        document.addEventListener('mouseleave', function() {
            mouseScreenX = -1;
            mouseScreenY = -1;
        });

        // Ctrl+C / Cmd+C to copy tile info
        document.addEventListener('keydown', function(e) {
            if (!enabled) return;
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && lastCopyInfo && hoverTileX >= 0) {
                e.preventDefault();
                e.stopPropagation();
                copyTileInfo();
            }
        }, true); // capture phase to intercept before game input

        mouseListenerAttached = true;
    }

    // ---- Copy tile info & show feedback on hover label ----
    var copyFeedbackTimer = null;

    function copyTileInfo() {
        if (!lastCopyInfo) return;
        navigator.clipboard.writeText(lastCopyInfo).then(function() {
            showCopyFeedbackOnLabel();
        }).catch(function() {
            // fallback: execCommand
            var ta = document.createElement('textarea');
            ta.value = lastCopyInfo;
            ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showCopyFeedbackOnLabel();
        });
    }

    function showCopyFeedbackOnLabel() {
        if (!hoverCtx || !hoverCanvas || !hoverTexture || !hoverMesh) return;

        var cvs = hoverCanvas;
        var ctx = hoverCtx;
        var cvsW = cvs.width;
        var cvsH = cvs.height;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cvsW, cvsH);

        // Y-flip
        ctx.translate(0, cvsH);
        ctx.scale(1, -1);

        // Green background
        var r = 12, bgx = 4, bgy = 4, bgw = cvsW - 8, bgh = cvsH - 8;
        ctx.fillStyle = 'rgba(0,100,0,0.9)';
        ctx.beginPath();
        ctx.moveTo(bgx + r, bgy);
        ctx.arcTo(bgx + bgw, bgy, bgx + bgw, bgy + bgh, r);
        ctx.arcTo(bgx + bgw, bgy + bgh, bgx, bgy + bgh, r);
        ctx.arcTo(bgx, bgy + bgh, bgx, bgy, r);
        ctx.arcTo(bgx, bgy, bgx + bgw, bgy, r);
        ctx.fill();

        ctx.strokeStyle = 'rgba(129,199,132,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // "복사됨!" text centered
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#81c784';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText('복사됨!', cvsW / 2, cvsH / 2);

        ctx.restore();
        hoverTexture.needsUpdate = true;

        // Restore normal label after delay
        if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
        copyFeedbackTimer = setTimeout(function() {
            copyFeedbackTimer = null;
            if (hoverTileX >= 0 && hoverTileY >= 0) {
                updateHoverLabel(hoverTileX, hoverTileY);
            }
        }, 800);
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
        last3DMode = is3DActive();
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
            '= 레이어 | 호버로 확인 | Ctrl+C 복사'
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

    function is3DActive() {
        return typeof ConfigManager !== 'undefined' && ConfigManager.mode3d &&
               typeof Mode3D !== 'undefined' && Mode3D._active && Mode3D._perspCamera;
    }

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (!enabled) return;

        var cur3D = is3DActive();
        if ($gameMap && ($gameMap.mapId() !== lastMapId || cur3D !== last3DMode)) {
            last3DMode = cur3D;
            buildOverlay();
        }

        updateScrollPosition();
        updateHover();
    };
})();
