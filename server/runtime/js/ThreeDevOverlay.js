//=============================================================================
// ThreeDevOverlay.js - Dev mode overlay: Three.js scene hierarchy + FPS
//=============================================================================
// Activated when URL contains ?dev=true
// Shows scene tree and FPS counter at top-left corner
// Supports: drag to move, collapse/expand, localStorage persistence
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    //=========================================================================
    // GPU 리소스 누수 추적 훅
    //
    // renderer.info.memory setter 후킹 + 구간 추적 방식:
    //   window._startTrack()  - 추적 시작 (창 열기 전 호출)
    //   window._endTrack()    - 추적 종료 및 결과 출력 (창 닫은 후 호출)
    //
    // Three.js는 매 프레임 memory 카운터를 0→N으로 재카운트하므로,
    // 개별 increment를 모두 로그하면 5만 줄이 나옴.
    // 대신 추적 구간의 per-frame 최고값 변화만 추적하여 누수만 출력.
    //=========================================================================
    (function installLeakTracker() {
        function tryInstall() {
            var renderer = null;
            if (typeof Graphics !== 'undefined') {
                if (Graphics._renderer && Graphics._renderer.renderer) {
                    renderer = Graphics._renderer.renderer;
                }
            }
            if (!renderer || !renderer.info || !renderer.info.memory) {
                setTimeout(tryInstall, 1000);
                return;
            }

            var memory = renderer.info.memory;

            // 현재 카운터 값
            var _texVal = memory.textures;
            var _geoVal = memory.geometries;

            // 프레임 내 최고값 (Three.js가 0→N 재카운트하므로 max로 실제 사용량 파악)
            var _texFrameMax = _texVal;
            var _geoFrameMax = _geoVal;

            // 추적 상태
            var _tracking = false;
            var _trackLabel = '';
            var _trackStartTexMax = 0;
            var _trackStartGeoMax = 0;

            // 추적 중 수집한 증가 이벤트 버퍼 (최대 5000개)
            var _traceBuffer = [];

            // textures setter 후킹
            Object.defineProperty(memory, 'textures', {
                get: function() { return _texVal; },
                set: function(v) {
                    if (v > _texFrameMax) _texFrameMax = v;
                    if (_tracking && v > _texVal) {
                        _traceBuffer.push({
                            type: 'tex',
                            from: _texVal, to: v,
                            stack: new Error().stack.split('\n').slice(2, 7).join('\n')
                        });
                        if (_traceBuffer.length > 5000) _traceBuffer.shift();
                    }
                    _texVal = v;
                },
                configurable: true
            });

            // geometries setter 후킹
            Object.defineProperty(memory, 'geometries', {
                get: function() { return _geoVal; },
                set: function(v) {
                    if (v > _geoFrameMax) _geoFrameMax = v;
                    if (_tracking && v > _geoVal) {
                        _traceBuffer.push({
                            type: 'geo',
                            from: _geoVal, to: v,
                            stack: new Error().stack.split('\n').slice(2, 7).join('\n')
                        });
                        if (_traceBuffer.length > 5000) _traceBuffer.shift();
                    }
                    _geoVal = v;
                },
                configurable: true
            });

            // THREE.PlaneGeometry 생성자 래핑 (게임 코드에서 new THREE.PlaneGeometry(...) 호출 캡처)
            // Three.js 내부 클래스 체계는 원본 참조를 사용하므로 영향 없음
            // rpg_sprites.js, ShadowAndLight.js 등 게임 코드만 캡처됨
            if (THREE.PlaneGeometry) {
                var _OrigPlaneGeo = THREE.PlaneGeometry;
                var _planeGeoLog = [];
                THREE.PlaneGeometry = function() {
                    _OrigPlaneGeo.apply(this, arguments);
                    if (_tracking) {
                        _planeGeoLog.push(new Error().stack.split('\n').slice(2, 7).join('\n'));
                    }
                };
                THREE.PlaneGeometry.prototype = _OrigPlaneGeo.prototype;
                Object.keys(_OrigPlaneGeo).forEach(function(k) {
                    try { THREE.PlaneGeometry[k] = _OrigPlaneGeo[k]; } catch(e) {}
                });
                // _startTrack 시 로그 초기화
                var _origStartTrack = window._startTrack;
                window._startTrack = function(label) {
                    _planeGeoLog = [];
                    _origStartTrack(label);
                };
                // _endTrack 시 PlaneGeometry 생성 목록 추가 출력
                var _origEndTrack = window._endTrack;
                window._endTrack = function() {
                    _origEndTrack();
                    if (_planeGeoLog.length > 0) {
                        console.group('PlaneGeometry 생성 x' + _planeGeoLog.length + ' (게임 코드)');
                        _planeGeoLog.forEach(function(s) { console.log(s); });
                        console.groupEnd();
                    }
                    _planeGeoLog = [];
                };
            }

            // 추적 시작 (창 열기 전에 호출)
            window._startTrack = function(label) {
                _trackLabel = label || '';
                _trackStartTexMax = _texFrameMax;
                _trackStartGeoMax = _geoFrameMax;
                _traceBuffer = [];
                _tracking = true;
                console.log('[Track] 시작' + (_trackLabel ? ' [' + _trackLabel + ']' : '') +
                    ' tex=' + _trackStartTexMax + ', geo=' + _trackStartGeoMax);
            };

            // 추적 종료 및 결과 출력 (창 닫은 후 호출)
            window._endTrack = function() {
                _tracking = false;
                var texDelta = _texFrameMax - _trackStartTexMax;
                var geoDelta = _geoFrameMax - _trackStartGeoMax;
                var sign = function(n) { return (n >= 0 ? '+' : '') + n; };

                console.group('[Track] 결과' + (_trackLabel ? ' [' + _trackLabel + ']' : '') +
                    '  tex' + sign(texDelta) + '  geo' + sign(geoDelta));

                if (geoDelta > 0) {
                    // threshold를 초과한 증가만 표시 (누수된 geometry의 스택)
                    var leaked = _traceBuffer.filter(function(t) {
                        return t.type === 'geo' && t.to > _trackStartGeoMax;
                    });
                    // 중복 제거 (동일 스택 합산)
                    var dedupe = {};
                    leaked.forEach(function(t) {
                        var key = t.stack;
                        if (!dedupe[key]) dedupe[key] = { count: 0, from: t.from, to: t.to, stack: t.stack };
                        dedupe[key].count++;
                        dedupe[key].to = t.to;
                    });
                    console.group('Geometry 누수 +' + geoDelta + ' (before=' + _trackStartGeoMax + ', after=' + _geoFrameMax + ')');
                    Object.values(dedupe).forEach(function(e) {
                        console.log((e.count > 1 ? 'x' + e.count + ' ' : '') + e.from + '→' + e.to + '\n' + e.stack);
                    });
                    console.groupEnd();
                }

                if (texDelta > 0) {
                    var leaked2 = _traceBuffer.filter(function(t) {
                        return t.type === 'tex' && t.to > _trackStartTexMax;
                    });
                    var dedupe2 = {};
                    leaked2.forEach(function(t) {
                        var key = t.stack;
                        if (!dedupe2[key]) dedupe2[key] = { count: 0, from: t.from, to: t.to, stack: t.stack };
                        dedupe2[key].count++;
                        dedupe2[key].to = t.to;
                    });
                    console.group('Texture 누수 +' + texDelta + ' (before=' + _trackStartTexMax + ', after=' + _texFrameMax + ')');
                    Object.values(dedupe2).forEach(function(e) {
                        console.log((e.count > 1 ? 'x' + e.count + ' ' : '') + e.from + '→' + e.to + '\n' + e.stack);
                    });
                    console.groupEnd();
                }

                if (texDelta <= 0 && geoDelta <= 0) {
                    console.log('누수 없음');
                }
                console.groupEnd();
            };

            // 편의: 현재 프레임 max 확인
            window._memInfo = function() {
                console.log('[MemInfo] tex=' + _texFrameMax + ', geo=' + _geoFrameMax +
                    ' (raw: tex=' + _texVal + ', geo=' + _geoVal + ')');
            };

            console.log('[LeakTracker] 준비 완료 (tex=' + _texFrameMax + ', geo=' + _geoFrameMax + ')\n' +
                '  _startTrack()  → 창 열기 전 호출\n' +
                '  _endTrack()    → 창 닫은 후 호출, 누수 스택 출력');
        }

        setTimeout(tryInstall, 2000);
    })();

    var PANEL_ID = 'threeDevOverlay';
    var TREE_STORAGE_KEY = 'devPanel_threeDevOverlay_tree';

    var overlay = null;
    var fpsEl = null;
    var treeEl = null;
    var titleBar = null;
    var frames = 0;
    var lastTime = performance.now();
    var fps = 0;
    var collapsed = {};  // track collapsed nodes by path
    var panelCtrl = null; // DevPanelUtils controller

    // Load tree collapsed state from localStorage
    function loadTreeCollapsed() {
        try {
            var raw = localStorage.getItem(TREE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function saveTreeCollapsed() {
        try {
            localStorage.setItem(TREE_STORAGE_KEY, JSON.stringify(collapsed));
        } catch (e) {}
    }

    // Load saved tree state
    collapsed = loadTreeCollapsed();

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

        // Title bar (drag handle)
        titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';

        fpsEl = document.createElement('div');
        fpsEl.style.cssText = 'font-size:13px;font-weight:bold;color:#0f0;flex:1;';
        titleBar.appendChild(fpsEl);

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
        titleBar.appendChild(copyBtn);
        overlay.appendChild(titleBar);

        var separator = document.createElement('div');
        separator.style.cssText = 'border-top:1px solid #555;margin:2px 0 4px;';
        overlay.appendChild(separator);

        treeEl = document.createElement('div');
        treeEl.style.cssText = 'white-space:nowrap;';
        overlay.appendChild(treeEl);

        document.body.appendChild(overlay);

        // Apply DevPanelUtils (draggable + collapse + localStorage)
        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(overlay, PANEL_ID, {
                titleBar: titleBar,
                defaultPosition: 'top-left'
            });
        }
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

    function getRendererInfo() {
        if (typeof Graphics !== 'undefined' && Graphics._renderer && Graphics._renderer.renderer) {
            var r = Graphics._renderer.renderer;
            var info = r.info;
            if (info && info.render) {
                // Detect renderer type
                var type = 'Unknown';
                if (r.constructor === THREE.WebGLRenderer) {
                    var ctx = r.getContext();
                    type = ctx instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1';
                } else if (typeof THREE.WebGPURenderer !== 'undefined' && r instanceof THREE.WebGPURenderer) {
                    type = 'WebGPU';
                }
                return {
                    type: type,
                    calls: info.render.calls,
                    triangles: info.render.triangles,
                    textures: info.memory ? info.memory.textures : 0,
                    geometries: info.memory ? info.memory.geometries : 0
                };
            }
        }
        return null;
    }

    var _prevTex = 0, _prevGeo = 0;
    function update() {
        updateFPS();

        if (!overlay) createOverlay();

        // FPS + renderer stats
        var color = fps >= 50 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00';
        var fpsText = '<span style="color:' + color + '">FPS: ' + fps + '</span>';
        var rInfo = getRendererInfo();
        if (rInfo) {
            fpsText += '  <span style="color:#7cc">' + rInfo.type + '</span>';
            var texColor = rInfo.textures > _prevTex ? '#f88' : '#aaa';
            var geoColor = rInfo.geometries > _prevGeo ? '#f88' : '#aaa';
            fpsText += '  DC:' + rInfo.calls + ' Tri:' + rInfo.triangles;
            fpsText += '  <span style="color:' + texColor + '">Tex:' + rInfo.textures + '</span>';
            fpsText += '  <span style="color:' + geoColor + '">Geo:' + rInfo.geometries + '</span>';
            // 증가 감지 시 FPS 바에 빨간색으로 강조 (콘솔 trace는 setter 훅에서 자동 출력)
            _prevTex = rInfo.textures;
            _prevGeo = rInfo.geometries;
        }
        fpsEl.innerHTML = fpsText;

        // Scene tree (update every 500ms to reduce overhead)
        if (!treeEl._lastUpdate || performance.now() - treeEl._lastUpdate > 500) {
            var scene = getScene();
            if (scene) {
                treeEl.innerHTML = buildTree(scene, 0, 'root');
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
                // Save tree collapsed state to localStorage
                saveTreeCollapsed();
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
