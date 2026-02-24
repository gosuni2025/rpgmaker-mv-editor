//=============================================================================
// DevPanelUtils.js - Shared utilities for dev debug panels
//=============================================================================
// Provides: draggable panels, collapse/expand with localStorage persistence,
// position reset
//=============================================================================

(function() {
    var STORAGE_KEY_PREFIX = 'devPanel_';

    /**
     * Load saved panel state from localStorage
     * @param {string} panelId - Unique panel identifier
     * @returns {{ x: number, y: number, collapsed: boolean } | null}
     */
    function loadPanelState(panelId) {
        try {
            var raw = localStorage.getItem(STORAGE_KEY_PREFIX + panelId);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    /**
     * Save panel state to localStorage
     * @param {string} panelId
     * @param {object} state - { x, y, collapsed, ... }
     */
    function savePanelState(panelId, state) {
        try {
            localStorage.setItem(STORAGE_KEY_PREFIX + panelId, JSON.stringify(state));
        } catch (e) {}
    }

    /**
     * Make a fixed-position panel draggable by its title bar.
     * Also adds collapse/expand toggle and position reset button.
     *
     * @param {HTMLElement} panel - The panel element (position:fixed)
     * @param {string} panelId - Unique ID for localStorage
     * @param {object} [opts] - Options
     * @param {string} [opts.defaultPosition] - 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
     * @param {HTMLElement} [opts.titleBar] - Element to use as drag handle (default: first child or auto-created)
     * @param {HTMLElement} [opts.bodyEl] - Element to show/hide for collapse (default: all children except titleBar)
     * @param {boolean} [opts.defaultCollapsed] - Start collapsed? (default: false)
     * @param {object} [opts.extraState] - Extra state to persist (e.g., tree collapsed map)
     * @returns {{ getState, setState, resetPosition, setCollapsed }}
     */
    function makeDraggablePanel(panel, panelId, opts) {
        opts = opts || {};
        var saved = loadPanelState(panelId);

        // Default position from opts or panel's current position
        var panelWidth = panel.offsetWidth || panel.getBoundingClientRect().width || 240;
        var defaultX = panel.offsetLeft || 0;
        var defaultY = panel.offsetTop || 0;
        if (opts.defaultPosition === 'top-right') {
            defaultX = window.innerWidth - panelWidth - 10;
            defaultY = 10;
        } else if (opts.defaultPosition === 'top-left') {
            defaultX = 0;
            defaultY = 0;
        }

        var posX = saved ? saved.x : defaultX;
        var posY = saved ? saved.y : defaultY;
        var isCollapsed = saved ? !!saved.collapsed : !!opts.defaultCollapsed;
        var extraState = (saved && saved.extra) ? saved.extra : (opts.extraState || {});

        // Apply position
        panel.style.left = posX + 'px';
        panel.style.top = posY + 'px';
        // Clear right/bottom if set, use left/top only
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        // --- Title bar setup ---
        var titleBar = opts.titleBar;
        if (!titleBar) {
            // Use first child as title bar if it looks like a header
            titleBar = panel.firstElementChild;
        }
        if (titleBar) {
            titleBar.style.cursor = 'move';
        }

        // --- Collapse toggle ---
        var collapseBtn = document.createElement('span');
        collapseBtn.textContent = isCollapsed ? '\u25B6' : '\u25BC';
        collapseBtn.style.cssText = 'cursor:pointer;font-size:10px;margin-right:4px;color:#aaa;user-select:none;';
        collapseBtn.title = 'Collapse/Expand';

        // Reset position button
        var resetBtn = document.createElement('span');
        resetBtn.textContent = '\u21BA';
        resetBtn.style.cssText = 'cursor:pointer;font-size:12px;margin-left:4px;color:#888;user-select:none;';
        resetBtn.title = 'Reset position';
        resetBtn.addEventListener('mouseenter', function() { resetBtn.style.color = '#fff'; });
        resetBtn.addEventListener('mouseleave', function() { resetBtn.style.color = '#888'; });

        // Insert collapse button before title bar content
        if (titleBar) {
            titleBar.insertBefore(collapseBtn, titleBar.firstChild);
            titleBar.appendChild(resetBtn);
        }

        // Body element(s) to collapse
        var bodyEls = [];
        if (opts.bodyEl) {
            bodyEls = [opts.bodyEl];
        } else {
            // All children except titleBar
            var children = panel.children;
            for (var i = 0; i < children.length; i++) {
                if (children[i] !== titleBar) {
                    bodyEls.push(children[i]);
                }
            }
        }

        function applyCollapsed() {
            for (var i = 0; i < bodyEls.length; i++) {
                bodyEls[i].style.display = isCollapsed ? 'none' : '';
            }
            collapseBtn.textContent = isCollapsed ? '\u25B6' : '\u25BC';
        }
        applyCollapsed();

        collapseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            applyCollapsed();
            persist();
        });

        resetBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            posX = defaultX;
            posY = defaultY;
            panel.style.left = posX + 'px';
            panel.style.top = posY + 'px';
            persist();
        });

        // --- Drag logic ---
        var isDragging = false;
        var dragStartX = 0, dragStartY = 0;
        var panelStartX = 0, panelStartY = 0;

        function isIgnoredTarget(target) {
            var tag = target.tagName;
            return tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'TEXTAREA' ||
                   target === collapseBtn || target === resetBtn;
        }

        function startDrag(clientX, clientY) {
            isDragging = true;
            dragStartX = clientX;
            dragStartY = clientY;
            panelStartX = posX;
            panelStartY = posY;
        }

        function moveDrag(clientX, clientY) {
            if (!isDragging) return;
            posX = Math.max(0, Math.min(panelStartX + clientX - dragStartX, window.innerWidth  - 40));
            posY = Math.max(0, Math.min(panelStartY + clientY - dragStartY, window.innerHeight - 20));
            panel.style.left = posX + 'px';
            panel.style.top  = posY + 'px';
        }

        function endDrag() {
            if (isDragging) { isDragging = false; persist(); }
        }

        // Mouse
        function onMouseDown(e) {
            if (isIgnoredTarget(e.target)) return;
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        }
        function onMouseMove(e) { moveDrag(e.clientX, e.clientY); }
        function onMouseUp()    { endDrag(); }

        // Touch (mobile)
        function onTouchStart(e) {
            if (e.touches.length !== 1) return;
            if (isIgnoredTarget(e.target)) return;
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
            e.preventDefault();
            e.stopPropagation(); // game TouchInput에 전파 방지
        }
        function onTouchMove(e) {
            if (!isDragging || e.touches.length !== 1) return;
            moveDrag(e.touches[0].clientX, e.touches[0].clientY);
            e.preventDefault();
            e.stopPropagation();
        }
        function onTouchEnd(e) {
            endDrag();
            e.stopPropagation();
        }

        if (titleBar) {
            titleBar.addEventListener('mousedown', onMouseDown);
            titleBar.addEventListener('touchstart', onTouchStart, { passive: false });
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend',  onTouchEnd);

        // 패널 전체 터치 → 게임 TouchInput에 전달되지 않도록 차단
        panel.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: false });

        function persist() {
            savePanelState(panelId, {
                x: posX, y: posY, collapsed: isCollapsed,
                extra: extraState
            });
        }

        // Save initial state
        persist();

        return {
            getState: function() { return { x: posX, y: posY, collapsed: isCollapsed, extra: extraState }; },
            setState: function(s) {
                if (s.x !== undefined) { posX = s.x; panel.style.left = posX + 'px'; }
                if (s.y !== undefined) { posY = s.y; panel.style.top = posY + 'px'; }
                if (s.collapsed !== undefined) { isCollapsed = s.collapsed; applyCollapsed(); }
                if (s.extra) extraState = s.extra;
                persist();
            },
            resetPosition: function() {
                posX = defaultX;
                posY = defaultY;
                panel.style.left = posX + 'px';
                panel.style.top = posY + 'px';
                persist();
            },
            setCollapsed: function(c) {
                isCollapsed = !!c;
                applyCollapsed();
                persist();
            },
            getExtra: function() { return extraState; },
            setExtra: function(e) { extraState = e; persist(); }
        };
    }

    /**
     * Load collapsed state for a tree (e.g., ThreeDevOverlay scene tree)
     * @param {string} panelId
     * @returns {object} collapsed map
     */
    function loadTreeCollapsed(panelId) {
        var saved = loadPanelState(panelId);
        return (saved && saved.extra && saved.extra.treeCollapsed) ? saved.extra.treeCollapsed : {};
    }

    // Export globally
    window.DevPanelUtils = {
        makeDraggablePanel: makeDraggablePanel,
        loadPanelState: loadPanelState,
        savePanelState: savePanelState,
        loadTreeCollapsed: loadTreeCollapsed
    };
})();
