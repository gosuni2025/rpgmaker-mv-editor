//=============================================================================
// EnemyBook.js — 적 도감
//=============================================================================

/*:
 * @plugindesc 적 도감. 전투에서 만난 적을 기록하여 목록으로 열람.
 * @author custom
 *
 * @param Unknown Data
 * @desc 미확인 적에 표시할 텍스트
 * @default ??????
 *
 * @param Show In Menu
 * @desc 메뉴에 몬스터 도감 항목 표시 여부
 * @type boolean
 * @default true
 *
 * @param Menu Text
 * @desc 메뉴에 표시할 텍스트
 * @default 몬스터 도감
 *
 * @help
 * 적 메모:
 *   <book:no>              # 도감에 표시하지 않음
 *   <desc1:설명 첫째 줄>
 *   <desc2:설명 둘째 줄>
 *
 * @command open
 * @text 도감 열기
 * @desc 적 도감 화면을 엽니다.
 *
 * @command complete
 * @text 전체 등록
 * @desc 모든 적을 도감에 등록합니다.
 *
 * @command clear
 * @text 초기화
 * @desc 도감을 초기화합니다.
 *
 * @command add
 * @text 적 등록
 * @desc 특정 적을 도감에 등록합니다.
 * @arg enemyId
 * @text 적
 * @type enemy
 * @default 1
 *
 * @command remove
 * @text 적 제거
 * @desc 특정 적을 도감에서 제거합니다.
 * @arg enemyId
 * @text 적
 * @type enemy
 * @default 1
 */

(function() {

    var parameters  = PluginManager.parameters('EnemyBook');
    var unknownData = String(parameters['Unknown Data'] || '??????');
    var showInMenu  = String(parameters['Show In Menu'] || 'true') === 'true';
    var menuText    = String(parameters['Menu Text']    || '몬스터 도감');

    //-------------------------------------------------------------------------
    // Plugin Command
    //-------------------------------------------------------------------------
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'EnemyBook') return;
        switch (args[0]) {
        case 'open':     SceneManager.push(Scene_EnemyBook); break;
        case 'add':      $gameSystem.addToEnemyBook(Number(args[1])); break;
        case 'remove':   $gameSystem.removeFromEnemyBook(Number(args[1])); break;
        case 'complete': $gameSystem.completeEnemyBook(); break;
        case 'clear':    $gameSystem.clearEnemyBook(); break;
        }
    };

    //-------------------------------------------------------------------------
    // Game_System — 도감 데이터 관리
    //-------------------------------------------------------------------------
    Game_System.prototype.clearEnemyBook = function() {
        this._enemyBookFlags = [];
    };

    Game_System.prototype.addToEnemyBook = function(enemyId) {
        if (!this._enemyBookFlags) this.clearEnemyBook();
        this._enemyBookFlags[enemyId] = true;
    };

    Game_System.prototype.removeFromEnemyBook = function(enemyId) {
        if (this._enemyBookFlags) this._enemyBookFlags[enemyId] = false;
    };

    Game_System.prototype.completeEnemyBook = function() {
        this.clearEnemyBook();
        for (var i = 1; i < $dataEnemies.length; i++) this._enemyBookFlags[i] = true;
    };

    Game_System.prototype.isInEnemyBook = function(enemy) {
        if (!this._enemyBookFlags || !enemy) return false;
        return !!this._enemyBookFlags[enemy.id];
    };

    // 전투 시 자동 등록
    var _troopSetup = Game_Troop.prototype.setup;
    Game_Troop.prototype.setup = function(troopId) {
        _troopSetup.call(this, troopId);
        this.members().forEach(function(enemy) {
            if (enemy.isAppeared()) $gameSystem.addToEnemyBook(enemy.enemyId());
        });
    };

    var _enemyAppear = Game_Enemy.prototype.appear;
    Game_Enemy.prototype.appear = function() {
        _enemyAppear.call(this);
        $gameSystem.addToEnemyBook(this._enemyId);
    };

    var _enemyTransform = Game_Enemy.prototype.transform;
    Game_Enemy.prototype.transform = function(enemyId) {
        _enemyTransform.call(this, enemyId);
        $gameSystem.addToEnemyBook(enemyId);
    };

    //=========================================================================
    // Scene_EnemyBook
    //
    //  ┌────────────┐ ┌─────────────────────────────┐
    //  │ 001  이름   │ │  stats / description (토글) │
    //  │ 002  이름   │ │                             │
    //  │  ...       │ │  ─────────────────────────  │
    //  │            │ │  [ 결정 ] 설명 보기          │
    //  └────────────┘ └─────────────────────────────┘
    //=========================================================================
    function Scene_EnemyBook() { this.initialize.apply(this, arguments); }
    Scene_EnemyBook.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_EnemyBook.prototype.constructor = Scene_EnemyBook;

    Scene_EnemyBook.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_EnemyBook.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);

        var lw = 240;
        var rw = Graphics.boxWidth - lw;

        this._indexWindow  = new Window_EnemyBookIndex(0, 0, lw, Graphics.boxHeight);
        this._statusWindow = new Window_EnemyBookStatus(lw, 0, rw, Graphics.boxHeight);

        this._indexWindow.setHandler('cancel', this.popScene.bind(this));
        this._indexWindow.setHandler('ok', this.onIndexOk.bind(this));
        this._indexWindow.setStatusWindow(this._statusWindow);

        this.addWindow(this._indexWindow);
        this.addWindow(this._statusWindow);
    };

    Scene_EnemyBook.prototype.onIndexOk = function() {
        this._statusWindow.toggleView();
        this._indexWindow.activate();
    };

    //=========================================================================
    // Window_EnemyBookIndex — 왼쪽 목록
    //=========================================================================
    function Window_EnemyBookIndex() { this.initialize.apply(this, arguments); }
    Window_EnemyBookIndex.prototype = Object.create(Window_Selectable.prototype);
    Window_EnemyBookIndex.prototype.constructor = Window_EnemyBookIndex;
    Window_EnemyBookIndex.lastTopRow = 0;
    Window_EnemyBookIndex.lastIndex  = 0;

    Window_EnemyBookIndex.prototype.initialize = function(x, y, width, height) {
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
        this.setTopRow(Window_EnemyBookIndex.lastTopRow);
        this.select(Window_EnemyBookIndex.lastIndex);
        this.activate();
    };

    Window_EnemyBookIndex.prototype.maxCols  = function() { return 1; };
    Window_EnemyBookIndex.prototype.maxItems = function() { return this._list ? this._list.length : 0; };

    Window_EnemyBookIndex.prototype.setStatusWindow = function(w) { this._statusWindow = w; this._updateRight(); };

    Window_EnemyBookIndex.prototype.update = function() {
        Window_Selectable.prototype.update.call(this);
        this._updateRight();
    };

    Window_EnemyBookIndex.prototype._updateRight = function() {
        var enemy = this._list ? this._list[this.index()] : null;
        if (this._statusWindow) this._statusWindow.setEnemy(enemy);
    };

    Window_EnemyBookIndex.prototype.refresh = function() {
        this._list = [];
        for (var i = 1; i < $dataEnemies.length; i++) {
            var e = $dataEnemies[i];
            if (e && e.name && e.meta.book !== 'no') this._list.push(e);
        }
        this.createContents();
        this.drawAllItems();
    };

    Window_EnemyBookIndex.prototype.drawItem = function(index) {
        var enemy = this._list[index];
        var rect  = this.itemRectForText(index);
        var known = $gameSystem.isInEnemyBook(enemy);
        var x = rect.x, y = rect.y;

        // 번호
        this.changeTextColor(this.textColor(7));
        this.drawText(('000' + (index + 1)).slice(-3), x, y, 36);
        x += 40;

        if (known) {
            this.resetTextColor();
            this.drawText(enemy.name, x, y, rect.width - 40);
        } else {
            this.changeTextColor(this.textColor(7));
            this.drawText(unknownData, x, y, rect.width - 40);
        }
    };

    Window_EnemyBookIndex.prototype.processCancel = function() {
        Window_Selectable.prototype.processCancel.call(this);
        Window_EnemyBookIndex.lastTopRow = this.topRow();
        Window_EnemyBookIndex.lastIndex  = this.index();
    };

    //=========================================================================
    // Window_EnemyBookStatus — 오른쪽 상단 (스탯 + 배틀러 이미지)
    //=========================================================================
    function Window_EnemyBookStatus() { this.initialize.apply(this, arguments); }
    Window_EnemyBookStatus.prototype = Object.create(Window_Base.prototype);
    Window_EnemyBookStatus.prototype.constructor = Window_EnemyBookStatus;

    Window_EnemyBookStatus.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._enemy    = null;
        this._showDesc = false;
        // 배틀러 스프라이트
        this._enemySprite = new Sprite();
        this._enemySprite.anchor.x = 0.5;
        this._enemySprite.anchor.y = 0.5;
        this._enemySprite.x = Math.floor(width * 3 / 4);
        this._enemySprite.y = Math.floor(height / 2);
        this.addChildToBack(this._enemySprite);
        this.refresh();
    };

    Window_EnemyBookStatus.prototype.setEnemy = function(enemy) {
        if (this._enemy !== enemy) {
            this._enemy = enemy;
            this.refresh();
        }
    };

    Window_EnemyBookStatus.prototype.toggleView = function() {
        this._showDesc = !this._showDesc;
        this.refresh();
    };

    Window_EnemyBookStatus.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        // 스프라이트 크기 조정 (창 높이를 넘지 않도록)
        if (this._enemySprite.bitmap) {
            var bh = this._enemySprite.bitmap.height;
            var bw = this._enemySprite.bitmap.width;
            var maxH = this.contents.height - 8;
            var maxW = Math.floor(this.contents.width / 2) - 8;
            var scale = Math.min(1, maxH / (bh || 1), maxW / (bw || 1));
            this._enemySprite.scale.x = scale;
            this._enemySprite.scale.y = scale;
        }
    };

    Window_EnemyBookStatus.prototype.refresh = function() {
        var enemy = this._enemy;
        var lh    = this.lineHeight();
        var pad   = this.textPadding();
        var cw    = this.contents.width;
        var ch    = this.contents.height;
        this.contents.clear();
        this._enemySprite.bitmap = null;
        this._enemySprite.visible = false;

        // 하단 힌트
        this._drawHint();

        if (!enemy || !$gameSystem.isInEnemyBook(enemy)) return;

        var x = pad, y = 0;

        if (this._showDesc) {
            // ── 설명 모드 ──
            this.resetTextColor();
            this.drawText(enemy.name, x, y, cw - pad);
            y += lh;
            if (enemy.meta.desc1) this.drawTextEx(String(enemy.meta.desc1), x, y);
            y += lh;
            if (enemy.meta.desc2) this.drawTextEx(String(enemy.meta.desc2), x, y);
        } else {
            // ── 스탯 모드 (배틀러 이미지 표시) ──
            this._enemySprite.visible = true;
            this._enemySprite.bitmap = $gameSystem.isSideView()
                ? ImageManager.loadSvEnemy(enemy.battlerName, enemy.battlerHue)
                : ImageManager.loadEnemy(enemy.battlerName, enemy.battlerHue);

            // 텍스트는 왼쪽 절반에
            var textW = Math.floor(cw / 2) - pad;

            // 이름
            this.resetTextColor();
            this.drawText(enemy.name, x, y, textW);
            y += lh;

            // 8개 파라미터
            for (var i = 0; i < 8; i++) {
                this.changeTextColor(this.systemColor());
                this.drawText(TextManager.param(i), x, y, 90);
                this.resetTextColor();
                this.drawText(enemy.params[i], x + 90, y, 50, 'right');
                y += lh;
            }

            // EXP / Gold
            y += 4;
            this.changeTextColor(this.systemColor());
            this.drawText(TextManager.expA,          x,      y, 70);
            this.drawText(TextManager.currencyUnit,  x + 80, y, 50);
            this.resetTextColor();
            this.drawText(enemy.exp,  x + 70,      y, 40, 'right');
            this.drawText(enemy.gold, x + 80 + 50, y, 50, 'right');
            y += lh;

            // 드롭 아이템
            for (var j = 0; j < enemy.dropItems.length; j++) {
                var di = enemy.dropItems[j];
                if (di.kind > 0) {
                    var dropItem = Game_Enemy.prototype.itemObject(di.kind, di.dataId);
                    if (dropItem) {
                        this.drawItemName(dropItem, x, y, textW);
                        y += lh;
                    }
                }
            }
        }
    };

    Window_EnemyBookStatus.prototype._drawHint = function() {
        var lh  = this.lineHeight();
        var pad = this.textPadding();
        var cw  = this.contents.width;
        var ch  = this.contents.height;

        var lineY = ch - lh * 2 + 4;
        this.contents.fillRect(pad, lineY, cw - pad * 2, 1, this.textColor(7));

        var hintText = this._showDesc ? '[ 결정 ]  스탯 보기' : '[ 결정 ]  설명 보기';
        this.changeTextColor(this.textColor(7));
        this.drawText(hintText, pad, ch - lh, cw - pad * 2, 'right');
        this.resetTextColor();
    };

    //-------------------------------------------------------------------------
    // 메뉴 통합
    //-------------------------------------------------------------------------
    if (showInMenu) {
        var _makeCommandList = Window_MenuCommand.prototype.makeCommandList;
        Window_MenuCommand.prototype.makeCommandList = function() {
            _makeCommandList.call(this);
            this.addCommand(menuText, 'enemyBook');
        };

        var _createCommandWindow = Scene_Menu.prototype.createCommandWindow;
        Scene_Menu.prototype.createCommandWindow = function() {
            _createCommandWindow.call(this);
            this._commandWindow.setHandler('enemyBook', this.commandEnemyBook.bind(this));
        };

        Scene_Menu.prototype.commandEnemyBook = function() {
            SceneManager.push(Scene_EnemyBook);
        };
    }

})();
