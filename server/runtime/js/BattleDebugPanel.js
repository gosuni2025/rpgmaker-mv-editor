//=============================================================================
// BattleDebugPanel.js - 전투 디버그 패널 (런타임 dev 패널)
//=============================================================================
// URL에 ?dev=true 시 활성화
// 전투 씬에서만 표시: 몬스터/아군 전체 피해 버튼
// 의존: DevPanelUtils.js
//=============================================================================

(function() {
    if (!(new URLSearchParams(window.location.search)).has('dev')) return;

    var PANEL_ID = 'battleDebugPanel';
    var panel = null;
    var panelCtrl = null;
    var lastBattle = false;

    function applyDamageAll(targets, amount) {
        if (!targets) return;
        targets.forEach(function(member) {
            member.gainHp(-amount);
            member.refresh();
        });
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'battle-debug-panel';
        panel.style.cssText = [
            'position:fixed', 'top:10px', 'right:10px', 'z-index:99999',
            'background:rgba(0,0,0,0.85)', 'color:#ccc',
            'font:11px/1.3 monospace', 'padding:0',
            'border:1px solid #555', 'border-radius:4px',
            'min-width:180px',
            'pointer-events:auto', 'user-select:none',
            'display:none'
        ].join(';');

        // Title bar
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;padding:4px 8px;background:rgba(40,40,40,0.9);border-radius:4px 4px 0 0;cursor:move;';

        var titleText = document.createElement('span');
        titleText.textContent = '전투 디버그';
        titleText.style.cssText = 'color:#e05050;font-weight:bold;flex:1;';
        titleBar.appendChild(titleText);
        panel.appendChild(titleBar);

        // Body
        var body = document.createElement('div');
        body.style.cssText = 'padding:6px 8px 8px;display:flex;flex-direction:column;gap:5px;';

        // 몬스터 전체 피해 100
        var btnEnemies = document.createElement('button');
        btnEnemies.textContent = '몬스터 전체 피해 100';
        btnEnemies.style.cssText = [
            'padding:4px 8px', 'font:11px monospace', 'cursor:pointer',
            'border:none', 'border-radius:3px', 'color:#fff',
            'background:#7a2020', 'width:100%', 'text-align:left'
        ].join(';');
        btnEnemies.addEventListener('mouseenter', function() { btnEnemies.style.background = '#a03030'; });
        btnEnemies.addEventListener('mouseleave', function() { btnEnemies.style.background = '#7a2020'; });
        btnEnemies.addEventListener('click', function(e) {
            e.stopPropagation();
            if (window.$gameTroop) applyDamageAll($gameTroop.aliveMembers(), 100);
        });
        body.appendChild(btnEnemies);

        // 아군 전체 피해 100
        var btnActors = document.createElement('button');
        btnActors.textContent = '아군 전체 피해 100';
        btnActors.style.cssText = [
            'padding:4px 8px', 'font:11px monospace', 'cursor:pointer',
            'border:none', 'border-radius:3px', 'color:#fff',
            'background:#1a4a7a', 'width:100%', 'text-align:left'
        ].join(';');
        btnActors.addEventListener('mouseenter', function() { btnActors.style.background = '#2060a0'; });
        btnActors.addEventListener('mouseleave', function() { btnActors.style.background = '#1a4a7a'; });
        btnActors.addEventListener('click', function(e) {
            e.stopPropagation();
            if (window.$gameParty) applyDamageAll($gameParty.aliveMembers(), 100);
        });
        body.appendChild(btnActors);

        panel.appendChild(body);
        document.body.appendChild(panel);

        if (window.DevPanelUtils) {
            panelCtrl = DevPanelUtils.makeDraggablePanel(panel, PANEL_ID, {
                titleBar: titleBar,
                defaultPosition: 'top-right'
            });
        }
    }

    function isBattleScene() {
        return !!(window.SceneManager && window.SceneManager._scene &&
                  window.Scene_Battle && window.SceneManager._scene instanceof Scene_Battle);
    }

    function tick() {
        if (!panel) createPanel();

        var inBattle = isBattleScene();
        if (inBattle !== lastBattle) {
            panel.style.display = inBattle ? '' : 'none';
            lastBattle = inBattle;
        }

        requestAnimationFrame(tick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { requestAnimationFrame(tick); });
    } else {
        requestAnimationFrame(tick);
    }

})();
