//=============================================================================
// CameraZoneDevOverlay.js - Camera Zone debug overlay for playtest
//=============================================================================
// Activated when URL contains ?dev=true
// Shows camera zone info: player position, active zone, all zones
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    var PANEL_ID = 'cameraZoneOverlay';
    var overlay = null;
    var titleBar = null;
    var bodyEl = null;
    var panelCtrl = null;

    function createOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'camera-zone-dev-overlay';
        overlay.style.cssText = [
            'position:fixed', 'top:10px', 'right:10px', 'z-index:99998',
            'background:rgba(0,0,0,0.85)', 'color:#0ff',
            'font:11px/1.4 monospace', 'padding:6px 8px',
            'max-height:80vh', 'overflow-y:auto', 'overflow-x:hidden',
            'pointer-events:auto', 'user-select:none',
            'min-width:220px', 'max-width:320px',
            'border:1px solid rgba(0,255,255,0.3)', 'border-radius:4px'
        ].join(';');

        titleBar = document.createElement('div');
        titleBar.style.cssText = 'font-weight:bold;font-size:12px;margin-bottom:4px;color:#0ff;display:flex;align-items:center;';
        titleBar.textContent = 'Camera Zone';
        overlay.appendChild(titleBar);

        bodyEl = document.createElement('div');
        overlay.appendChild(bodyEl);

        document.body.appendChild(overlay);

        panelCtrl = DevPanelUtils.makeDraggablePanel(overlay, PANEL_ID, {
            defaultPosition: 'top-right',
            titleBar: titleBar,
            bodyEl: bodyEl,
            defaultCollapsed: false
        });
    }

    function fmt(v) { return v != null ? v.toFixed(2) : '-'; }

    function update() {
        if (!overlay) return;
        if (!$gameMap || !$gamePlayer) { bodyEl.innerHTML = '<div style="color:#666">No map</div>'; return; }

        var zones = $dataMap && $dataMap.cameraZones;
        if (!zones || zones.length === 0) {
            bodyEl.innerHTML = '<div style="color:#666">No camera zones</div>';
            return;
        }

        var lines = [];
        var halfSX = $gameMap.screenTileX() / 2;
        var halfSY = $gameMap.screenTileY() / 2;

        // Player position
        lines.push('<div style="color:#aaa;margin-bottom:2px">');
        lines.push('Player: ' + fmt($gamePlayer._realX) + ', ' + fmt($gamePlayer._realY));
        lines.push('</div>');

        // Camera info
        var cx = $gameMap._displayX + halfSX;
        var cy = $gameMap._displayY + halfSY;
        lines.push('<div style="color:#aaa;margin-bottom:2px">');
        lines.push('Camera: ' + fmt(cx) + ', ' + fmt(cy));
        lines.push(' | Display: ' + fmt($gameMap._displayX) + ', ' + fmt($gameMap._displayY));
        lines.push('</div>');

        // Lerp target
        if ($gameMap._cameraZoneTargetX !== undefined) {
            lines.push('<div style="color:#aaa;margin-bottom:4px">');
            lines.push('Lerp: ' + fmt($gameMap._cameraZoneTargetX) + ', ' + fmt($gameMap._cameraZoneTargetY));
            lines.push($gameMap._cameraZoneLerping ? ' <span style="color:#ff0">LERPING</span>' : '');
            lines.push('</div>');
        }

        // Active zones (union)
        var activeIds = $gameMap._activeCameraZoneIds || [];
        lines.push('<div style="border-top:1px solid rgba(0,255,255,0.2);padding-top:3px;margin-top:2px">');
        lines.push('<b>Active Zones:</b> ' + (activeIds.length > 0 ? activeIds.map(function(id) { return '#' + id; }).join(', ') : '<span style="color:#666">none</span>'));
        for (var ai = 0; ai < activeIds.length; ai++) {
            var az = $gameMap.getCameraZoneById(activeIds[ai]);
            if (az) {
                lines.push('<div style="padding-left:8px;color:#8ff">');
                lines.push(az.name + ' (' + az.x + ',' + az.y + ' ' + az.width + 'x' + az.height + ')');
                lines.push('</div>');
            }
        }
        lines.push('</div>');

        // All zones
        var activeIdSet = {};
        for (var ai = 0; ai < activeIds.length; ai++) activeIdSet[activeIds[ai]] = true;
        lines.push('<div style="border-top:1px solid rgba(0,255,255,0.2);padding-top:3px;margin-top:4px">');
        lines.push('<b>All Zones (' + zones.length + '):</b>');
        for (var i = 0; i < zones.length; i++) {
            var z = zones[i];
            var isActive = !!activeIdSet[z.id];
            var color = isActive ? '#0ff' : (z.enabled ? '#8aa' : '#555');
            lines.push('<div style="color:' + color + ';padding-left:8px;' + (isActive ? 'font-weight:bold;' : '') + '">');
            lines.push('#' + z.id + ' ' + z.name);
            lines.push(' (' + z.x + ',' + z.y + ' ' + z.width + 'x' + z.height + ')');
            if (!z.enabled) lines.push(' [OFF]');
            lines.push('</div>');
        }
        lines.push('</div>');

        bodyEl.innerHTML = lines.join('');
    }

    // Init after scene is ready
    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (!overlay) createOverlay();
    };

    // Update every frame
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        update();
    };
})();
