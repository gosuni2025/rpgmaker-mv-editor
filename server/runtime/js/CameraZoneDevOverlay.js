//=============================================================================
// CameraZoneDevOverlay.js - Dev mode overlay: Camera Zone debug info
//=============================================================================
// Activated when URL contains ?dev=true
// Shows active camera zone, zone bounds, camera position
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    var PANEL_ID = 'cameraZoneDevOverlay';
    var overlay = null;
    var titleBar = null;
    var bodyEl = null;
    var panelCtrl = null;

    function createOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'camera-zone-dev-overlay';
        overlay.style.cssText = [
            'position:fixed', 'top:0', 'right:0', 'z-index:99998',
            'background:rgba(0,0,0,0.8)', 'color:#ddd',
            'font:11px/1.4 monospace', 'padding:6px 8px',
            'pointer-events:auto', 'user-select:none',
            'min-width:220px', 'max-width:360px'
        ].join(';');

        // Title bar
        titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';

        var titleText = document.createElement('span');
        titleText.textContent = 'Camera Zone';
        titleText.style.cssText = 'font-size:12px;font-weight:bold;color:#4fc3f7;flex:1;';
        titleBar.appendChild(titleText);

        var copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.style.cssText = 'background:#444;color:#ccc;border:1px solid #666;padding:1px 6px;font:10px monospace;cursor:pointer;border-radius:2px;';
        copyBtn.addEventListener('mouseenter', function() { copyBtn.style.background = '#555'; });
        copyBtn.addEventListener('mouseleave', function() { copyBtn.style.background = '#444'; });
        copyBtn.addEventListener('click', function() {
            var info = gatherInfo();
            var text = JSON.stringify(info, null, 2);
            navigator.clipboard.writeText(text).then(function() {
                copyBtn.textContent = 'Copied!';
                setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1000);
            });
        });
        titleBar.appendChild(copyBtn);
        overlay.appendChild(titleBar);

        var separator = document.createElement('div');
        separator.style.cssText = 'border-top:1px solid #555;margin:2px 0 4px;';
        overlay.appendChild(separator);

        bodyEl = document.createElement('div');
        overlay.appendChild(bodyEl);

        document.body.appendChild(overlay);

        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(overlay, PANEL_ID, {
                titleBar: titleBar,
                defaultPosition: 'top-right'
            });
        }
    }

    function gatherInfo() {
        var info = {
            player: null,
            camera: null,
            activeZone: null,
            allZones: null
        };

        if (typeof $gameMap === 'undefined' || !$gameMap) return info;
        if (typeof $gamePlayer === 'undefined' || !$gamePlayer) return info;

        var px = $gamePlayer._x;
        var py = $gamePlayer._y;
        info.player = { x: px, y: py };

        var halfSX = $gameMap.screenTileX() / 2;
        var halfSY = $gameMap.screenTileY() / 2;
        var camCenterX = $gameMap._displayX + halfSX;
        var camCenterY = $gameMap._displayY + halfSY;

        info.camera = {
            displayX: round2($gameMap._displayX),
            displayY: round2($gameMap._displayY),
            centerX: round2(camCenterX),
            centerY: round2(camCenterY)
        };

        if ($gameMap._cameraZoneTargetX !== undefined) {
            info.camera.lerpTargetX = round2($gameMap._cameraZoneTargetX);
            info.camera.lerpTargetY = round2($gameMap._cameraZoneTargetY);
        }

        var zoneId = $gameMap._activeCameraZoneId;
        if (zoneId != null) {
            var zone = $gameMap.getCameraZoneById(zoneId);
            if (zone) {
                info.activeZone = {
                    id: zone.id,
                    name: zone.name || '',
                    x: zone.x,
                    y: zone.y,
                    width: zone.width,
                    height: zone.height,
                    priority: zone.priority,
                    transitionSpeed: zone.transitionSpeed || 1.0
                };
            }
        }

        var zones = $dataMap && $dataMap.cameraZones;
        if (zones && zones.length > 0) {
            info.allZones = zones.map(function(z) {
                return {
                    id: z.id,
                    name: z.name || '',
                    enabled: z.enabled,
                    x: z.x, y: z.y,
                    width: z.width, height: z.height,
                    priority: z.priority
                };
            });
        }

        return info;
    }

    function round2(v) {
        return Math.round(v * 100) / 100;
    }

    function row(label, value, color) {
        color = color || '#ddd';
        return '<div><span style="color:#888">' + label + ':</span> <span style="color:' + color + '">' + value + '</span></div>';
    }

    function update() {
        if (!overlay) createOverlay();

        if (typeof $gameMap === 'undefined' || !$gameMap) {
            bodyEl.innerHTML = '<span style="color:#888">Waiting...</span>';
            requestAnimationFrame(update);
            return;
        }

        var html = '';

        // Player position
        if (typeof $gamePlayer !== 'undefined' && $gamePlayer) {
            html += row('Player', $gamePlayer._x + ', ' + $gamePlayer._y, '#8f8');
        }

        // Camera info
        var halfSX = $gameMap.screenTileX() / 2;
        var halfSY = $gameMap.screenTileY() / 2;
        var camX = round2($gameMap._displayX + halfSX);
        var camY = round2($gameMap._displayY + halfSY);
        html += row('Display', round2($gameMap._displayX) + ', ' + round2($gameMap._displayY));
        html += row('Cam Center', camX + ', ' + camY, '#ff8');

        if ($gameMap._cameraZoneTargetX !== undefined) {
            html += row('Lerp Target', round2($gameMap._cameraZoneTargetX) + ', ' + round2($gameMap._cameraZoneTargetY), '#f8f');
        }

        // Active zone
        var zoneId = $gameMap._activeCameraZoneId;
        var zones = $dataMap && $dataMap.cameraZones;

        html += '<div style="border-top:1px solid #444;margin:4px 0 2px;"></div>';

        if (zoneId != null) {
            var zone = $gameMap.getCameraZoneById(zoneId);
            if (zone) {
                var zoneName = zone.name ? ' "' + zone.name + '"' : '';
                html += row('Active Zone', '#' + zone.id + zoneName, '#4fc3f7');
                html += row('  Bounds', zone.x + ',' + zone.y + ' → ' + (zone.x + zone.width) + ',' + (zone.y + zone.height), '#aaa');
                html += row('  Size', zone.width + ' x ' + zone.height, '#aaa');
                html += row('  Priority', zone.priority, '#aaa');
                html += row('  Speed', (zone.transitionSpeed || 1.0), '#aaa');
            }
        } else {
            html += row('Active Zone', 'none', '#666');
        }

        // All zones summary
        if (zones && zones.length > 0) {
            html += '<div style="border-top:1px solid #444;margin:4px 0 2px;"></div>';
            html += '<div style="color:#888;font-size:10px">All Zones (' + zones.length + '):</div>';
            for (var i = 0; i < zones.length; i++) {
                var z = zones[i];
                var active = (zoneId != null && z.id === zoneId);
                var zColor = active ? '#4fc3f7' : (z.enabled ? '#999' : '#555');
                var prefix = active ? '\u25b6 ' : '  ';
                var nameStr = z.name ? ' "' + z.name + '"' : '';
                html += '<div style="color:' + zColor + ';font-size:10px;padding-left:4px">';
                html += prefix + '#' + z.id + nameStr;
                html += ' [' + z.x + ',' + z.y + ' ' + z.width + 'x' + z.height + ']';
                if (!z.enabled) html += ' <span style="color:#f44">OFF</span>';
                html += '</div>';
            }
        } else {
            html += '<div style="border-top:1px solid #444;margin:4px 0 2px;"></div>';
            html += '<div style="color:#666;font-size:10px">No camera zones</div>';
        }

        bodyEl.innerHTML = html;
        requestAnimationFrame(update);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            requestAnimationFrame(update);
        });
    } else {
        requestAnimationFrame(update);
    }

})();
