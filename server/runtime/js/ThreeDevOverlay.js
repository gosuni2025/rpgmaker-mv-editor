//=============================================================================
// ThreeDevOverlay.js - Dev mode overlay: Three.js scene hierarchy + FPS
//=============================================================================
// Activated when URL contains ?dev=true
// Shows scene tree and FPS counter at top-left corner
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    var overlay = null;
    var fpsEl = null;
    var treeEl = null;
    var skyboxEl = null;
    var skyboxLoaded = false;
    var frames = 0;
    var lastTime = performance.now();
    var fps = 0;
    var collapsed = {};  // track collapsed nodes by path

    function createOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'three-dev-overlay';
        overlay.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'z-index:99999',
            'background:rgba(0,0,0,0.8)', 'color:#0f0',
            'font:11px/1.3 monospace', 'padding:6px 8px',
            'max-height:100vh', 'overflow-y:auto', 'overflow-x:hidden',
            'pointer-events:auto', 'user-select:none',
            'min-width:200px', 'max-width:400px',
            'scrollbar-width:thin', 'scrollbar-color:#555 transparent'
        ].join(';');

        var topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';

        fpsEl = document.createElement('div');
        fpsEl.style.cssText = 'font-size:13px;font-weight:bold;color:#0f0;';
        topBar.appendChild(fpsEl);

        var copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.style.cssText = 'background:#444;color:#ccc;border:1px solid #666;padding:1px 6px;font:10px monospace;cursor:pointer;border-radius:2px;';
        copyBtn.addEventListener('mouseenter', function() { copyBtn.style.background = '#555'; });
        copyBtn.addEventListener('mouseleave', function() { copyBtn.style.background = '#444'; });
        copyBtn.addEventListener('click', function() {
            var scene = getScene();
            if (!scene) return;
            var json = buildTreeJSON(scene, 0);
            var text = JSON.stringify(json, null, 2);
            navigator.clipboard.writeText(text).then(function() {
                copyBtn.textContent = 'Copied!';
                setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1000);
            });
        });
        topBar.appendChild(copyBtn);
        overlay.appendChild(topBar);

        var separator = document.createElement('div');
        separator.style.cssText = 'border-top:1px solid #555;margin:2px 0 4px;';
        overlay.appendChild(separator);

        treeEl = document.createElement('div');
        treeEl.style.cssText = 'white-space:nowrap;';
        overlay.appendChild(treeEl);

        // Skybox image selector section
        var skySep = document.createElement('div');
        skySep.style.cssText = 'border-top:1px solid #555;margin:6px 0 4px;';
        overlay.appendChild(skySep);

        var skyHeader = document.createElement('div');
        skyHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;cursor:pointer;';
        skyHeader.innerHTML = '<span style="color:#ffb74d;font-weight:bold;font-size:11px">Skybox</span><span id="sky-toggle" style="color:#aaa;font-size:10px">\u25bc</span>';
        var skyCollapsed = false;
        skyHeader.addEventListener('click', function() {
            skyCollapsed = !skyCollapsed;
            skyboxEl.style.display = skyCollapsed ? 'none' : 'grid';
            document.getElementById('sky-toggle').textContent = skyCollapsed ? '\u25b6' : '\u25bc';
        });
        overlay.appendChild(skyHeader);

        skyboxEl = document.createElement('div');
        skyboxEl.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:3px;max-height:300px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#555 transparent;';
        overlay.appendChild(skyboxEl);

        document.body.appendChild(overlay);
    }

    function getNodeLabel(obj) {
        // Try wrapper name first
        if (obj._wrapper) {
            var w = obj._wrapper;
            var name = w.constructor && w.constructor.name ? w.constructor.name : '';
            if (name && name !== 'Object') return name;
        }
        // THREE object type
        if (obj.type) return obj.type;
        if (obj.isScene) return 'Scene';
        if (obj.isGroup) return 'Group';
        if (obj.isMesh) return 'Mesh';
        if (obj.isLight) return 'Light';
        return obj.constructor ? obj.constructor.name : '???';
    }

    function getNodeDetail(obj) {
        var parts = [];
        // Position
        var p = obj.position;
        if (p && (p.x !== 0 || p.y !== 0 || p.z !== 0)) {
            parts.push('pos(' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ',' + p.z.toFixed(0) + ')');
        }
        // Visibility
        if (!obj.visible) {
            parts.push('hidden');
        }
        // Mesh material info
        if (obj.isMesh && obj.material) {
            var mat = obj.material;
            var matType = mat.type || mat.constructor.name || '';
            if (matType) parts.push(matType);
        }
        // Light info
        if (obj.isLight) {
            parts.push('#' + obj.color.getHexString());
            if (obj.intensity !== undefined) parts.push('i=' + obj.intensity.toFixed(1));
        }
        return parts.length ? ' <span style="color:#888">' + parts.join(' ') + '</span>' : '';
    }

    function buildTreeJSON(obj, depth) {
        if (!obj || depth > 15) return null;
        var label = getNodeLabel(obj);
        var node = { type: label };
        var p = obj.position;
        if (p && (p.x !== 0 || p.y !== 0 || p.z !== 0)) {
            node.position = { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) };
        }
        if (!obj.visible) node.visible = false;
        if (obj.isMesh && obj.material) {
            var mat = obj.material;
            node.material = mat.type || mat.constructor.name || undefined;
        }
        if (obj.isLight) {
            node.color = '#' + obj.color.getHexString();
            node.intensity = +obj.intensity.toFixed(1);
        }
        if (obj.children && obj.children.length > 0) {
            node.children = [];
            for (var i = 0; i < obj.children.length; i++) {
                var child = buildTreeJSON(obj.children[i], depth + 1);
                if (child) node.children.push(child);
            }
        }
        return node;
    }

    function buildTree(obj, depth, path) {
        if (!obj) return '';
        if (depth > 15) return '';

        var label = getNodeLabel(obj);
        var detail = getNodeDetail(obj);
        var childCount = obj.children ? obj.children.length : 0;
        var indent = depth * 12;
        var key = path;

        var html = '<div style="padding-left:' + indent + 'px;line-height:1.4">';

        if (childCount > 0) {
            var isCollapsed = collapsed[key];
            var arrow = isCollapsed ? '\u25b6' : '\u25bc';
            html += '<span class="dev-tree-toggle" data-key="' + key + '" style="cursor:pointer;color:#aaa;margin-right:3px">' + arrow + '</span>';
        } else {
            html += '<span style="margin-right:3px;color:#555">\u00b7</span>';
        }

        html += '<span style="color:#4fc3f7">' + label + '</span>';
        if (childCount > 0) {
            html += ' <span style="color:#666">(' + childCount + ')</span>';
        }
        html += detail;
        html += '</div>';

        if (childCount > 0 && !collapsed[key]) {
            for (var i = 0; i < obj.children.length; i++) {
                html += buildTree(obj.children[i], depth + 1, path + '/' + i);
            }
        }

        return html;
    }

    function updateFPS() {
        frames++;
        var now = performance.now();
        if (now - lastTime >= 1000) {
            fps = Math.round(frames * 1000 / (now - lastTime));
            frames = 0;
            lastTime = now;
        }
    }

    function getScene() {
        // Graphics._renderer -> rendererObj.scene
        if (typeof Graphics !== 'undefined' && Graphics._renderer && Graphics._renderer.scene) {
            return Graphics._renderer.scene;
        }
        return null;
    }

    function loadSkyboxList() {
        if (skyboxLoaded) return;
        skyboxLoaded = true;
        // img/skybox 폴더에서 이미지 목록 가져오기
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/resources/img_skybox', true);
        xhr.onload = function() {
            if (xhr.status !== 200) return;
            var files = JSON.parse(xhr.responseText);
            var pngs = files.filter(function(f) { return /\.(png|jpe?g|webp)$/i.test(f); });
            pngs.sort();
            skyboxEl.innerHTML = '';
            pngs.forEach(function(filename) {
                var thumb = document.createElement('div');
                thumb.style.cssText = 'cursor:pointer;border:2px solid transparent;border-radius:3px;overflow:hidden;aspect-ratio:2/1;';
                var img = document.createElement('img');
                img.src = 'img/skybox/' + filename;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                img.title = filename;
                thumb.appendChild(img);
                thumb.addEventListener('mouseenter', function() { thumb.style.borderColor = '#ffb74d'; });
                thumb.addEventListener('mouseleave', function() {
                    if (!thumb._active) thumb.style.borderColor = 'transparent';
                });
                thumb.addEventListener('click', function() {
                    // Deselect all
                    var items = skyboxEl.querySelectorAll('div');
                    for (var i = 0; i < items.length; i++) {
                        items[i].style.borderColor = 'transparent';
                        items[i]._active = false;
                    }
                    thumb.style.borderColor = '#ffb74d';
                    thumb._active = true;
                    changeSkyboxTexture(filename);
                });
                skyboxEl.appendChild(thumb);
            });
        };
        xhr.send();
    }

    function changeSkyboxTexture(filename) {
        var scene = getScene();
        if (!scene) return;
        // _isParallaxSky 메시 찾기
        var skyMesh = null;
        scene.traverse(function(obj) {
            if (obj._isParallaxSky) skyMesh = obj;
        });
        if (!skyMesh) return;
        var loader = new THREE.TextureLoader();
        loader.load('img/skybox/' + filename, function(texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            if (skyMesh.material.map) skyMesh.material.map.dispose();
            skyMesh.material.map = texture;
            skyMesh.material.needsUpdate = true;
        });
    }

    function getRendererInfo() {
        if (typeof Graphics !== 'undefined' && Graphics._renderer && Graphics._renderer.renderer) {
            var r = Graphics._renderer.renderer;
            var info = r.info;
            if (info && info.render) {
                return {
                    calls: info.render.calls,
                    triangles: info.render.triangles,
                    textures: info.memory ? info.memory.textures : 0,
                    geometries: info.memory ? info.memory.geometries : 0
                };
            }
        }
        return null;
    }

    function update() {
        updateFPS();

        if (!overlay) createOverlay();

        // FPS + renderer stats
        var color = fps >= 50 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00';
        var fpsText = '<span style="color:' + color + '">FPS: ' + fps + '</span>';
        var rInfo = getRendererInfo();
        if (rInfo) {
            fpsText += '  <span style="color:#aaa">DC:' + rInfo.calls + ' Tri:' + rInfo.triangles + ' Tex:' + rInfo.textures + ' Geo:' + rInfo.geometries + '</span>';
        }
        fpsEl.innerHTML = fpsText;

        // Scene tree (update every 500ms to reduce overhead)
        if (!treeEl._lastUpdate || performance.now() - treeEl._lastUpdate > 500) {
            var scene = getScene();
            if (scene) {
                treeEl.innerHTML = buildTree(scene, 0, 'root');
                // Load skybox list once scene is ready
                if (!skyboxLoaded && skyboxEl) loadSkyboxList();
            } else {
                treeEl.innerHTML = '<span style="color:#888">Scene not ready...</span>';
            }
            treeEl._lastUpdate = performance.now();
        }

        requestAnimationFrame(update);
    }

    // Handle click on tree toggle
    document.addEventListener('click', function(e) {
        var target = e.target;
        if (target.classList && target.classList.contains('dev-tree-toggle')) {
            var key = target.getAttribute('data-key');
            if (key) {
                collapsed[key] = !collapsed[key];
                // Force immediate tree update
                if (treeEl) treeEl._lastUpdate = 0;
            }
        }
    });

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            requestAnimationFrame(update);
        });
    } else {
        requestAnimationFrame(update);
    }

})();
