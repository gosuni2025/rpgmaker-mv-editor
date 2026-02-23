//=============================================================================
// ItemBook.js — 아이템 도감
//=============================================================================

/*:
 * @plugindesc 아이템/무기/방어구 도감. 획득한 아이템을 기록하여 목록으로 열람.
 * @author custom
 *
 * @param Unknown Data
 * @desc 미확인 아이템에 표시할 텍스트
 * @default ??????
 *
 * @param Price Text
 * @default 가격
 *
 * @param Equip Text
 * @default 장비
 *
 * @param Type Text
 * @default 타입
 *
 * @param Show In Menu
 * @desc 메뉴에 아이템 도감 항목 표시 여부
 * @type boolean
 * @default true
 *
 * @param Menu Text
 * @desc 메뉴에 표시할 텍스트
 * @default 아이템 도감
 *
 * @help
 * 아이템 메모:
 *   <book:no>   # 도감에 표시하지 않음
 *
 * @command open
 * @text 도감 열기
 * @desc 아이템 도감 화면을 엽니다.
 *
 * @command complete
 * @text 전체 등록
 * @desc 모든 아이템/무기/방어구를 도감에 등록합니다.
 *
 * @command clear
 * @text 초기화
 * @desc 도감을 초기화합니다.
 *
 * @command addItem
 * @text 아이템 등록
 * @arg dataId
 * @text 아이템
 * @type item
 * @default 1
 *
 * @command addWeapon
 * @text 무기 등록
 * @arg dataId
 * @text 무기
 * @type weapon
 * @default 1
 *
 * @command addArmor
 * @text 방어구 등록
 * @arg dataId
 * @text 방어구
 * @type armor
 * @default 1
 *
 * @command removeItem
 * @text 아이템 제거
 * @arg dataId
 * @text 아이템
 * @type item
 * @default 1
 *
 * @command removeWeapon
 * @text 무기 제거
 * @arg dataId
 * @text 무기
 * @type weapon
 * @default 1
 *
 * @command removeArmor
 * @text 방어구 제거
 * @arg dataId
 * @text 방어구
 * @type armor
 * @default 1
 */

(function() {

    var parameters  = PluginManager.parameters('ItemBook');
    var unknownData = String(parameters['Unknown Data'] || '??????');
    var priceText   = String(parameters['Price Text']   || '가격');
    var equipText   = String(parameters['Equip Text']   || '장비');
    var typeText    = String(parameters['Type Text']    || '타입');
    var showInMenu  = String(parameters['Show In Menu'] || 'true') === 'true';
    var menuText    = String(parameters['Menu Text']    || '아이템 도감');

    //-------------------------------------------------------------------------
    // Plugin Command
    //-------------------------------------------------------------------------
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'ItemBook') return;
        switch (args[0]) {
        case 'open':        SceneManager.push(Scene_ItemBook); break;
        case 'add':         $gameSystem.addToItemBook(args[1], Number(args[2])); break;
        case 'remove':      $gameSystem.removeFromItemBook(args[1], Number(args[2])); break;
        case 'complete':    $gameSystem.completeItemBook(); break;
        case 'clear':       $gameSystem.clearItemBook(); break;
        case 'addItem':     $gameSystem.addToItemBook('item',   Number(args[1])); break;
        case 'addWeapon':   $gameSystem.addToItemBook('weapon', Number(args[1])); break;
        case 'addArmor':    $gameSystem.addToItemBook('armor',  Number(args[1])); break;
        case 'removeItem':  $gameSystem.removeFromItemBook('item',   Number(args[1])); break;
        case 'removeWeapon':$gameSystem.removeFromItemBook('weapon', Number(args[1])); break;
        case 'removeArmor': $gameSystem.removeFromItemBook('armor',  Number(args[1])); break;
        }
    };

    //-------------------------------------------------------------------------
    // Game_System — 도감 데이터 관리
    //-------------------------------------------------------------------------
    Game_System.prototype.clearItemBook = function() {
        this._itemBookFlags = [[], [], []]; // [0]=item [1]=weapon [2]=armor
    };

    Game_System.prototype._itemBookTypeIndex = function(type) {
        return type === 'item' ? 0 : type === 'weapon' ? 1 : type === 'armor' ? 2 : -1;
    };

    Game_System.prototype.addToItemBook = function(type, dataId) {
        if (!this._itemBookFlags) this.clearItemBook();
        var i = this._itemBookTypeIndex(type);
        if (i >= 0) this._itemBookFlags[i][dataId] = true;
    };

    Game_System.prototype.removeFromItemBook = function(type, dataId) {
        if (!this._itemBookFlags) return;
        var i = this._itemBookTypeIndex(type);
        if (i >= 0) this._itemBookFlags[i][dataId] = false;
    };

    Game_System.prototype.completeItemBook = function() {
        var i;
        this.clearItemBook();
        for (i = 1; i < $dataItems.length;   i++) this._itemBookFlags[0][i] = true;
        for (i = 1; i < $dataWeapons.length;  i++) this._itemBookFlags[1][i] = true;
        for (i = 1; i < $dataArmors.length;   i++) this._itemBookFlags[2][i] = true;
    };

    Game_System.prototype.isInItemBook = function(item) {
        if (!this._itemBookFlags || !item) return false;
        var i = DataManager.isItem(item) ? 0 : DataManager.isWeapon(item) ? 1 : DataManager.isArmor(item) ? 2 : -1;
        return i >= 0 ? !!this._itemBookFlags[i][item.id] : false;
    };

    // 아이템 획득 시 자동 등록
    var _gainItem = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
        _gainItem.call(this, item, amount, includeEquip);
        if (item && amount > 0) {
            var type = DataManager.isItem(item) ? 'item' : DataManager.isWeapon(item) ? 'weapon' : 'armor';
            $gameSystem.addToItemBook(type, item.id);
        }
    };

    //=========================================================================
    // Scene_ItemBook
    //
    //  ┌────────────┐ ┌─────────────────────────────┐
    //  │ 001 [i] 이름│ │  stats / description (토글) │
    //  │ 002 [i] 이름│ │                             │
    //  │  ...       │ │                             │
    //  │            │ │  ─────────────────────────  │
    //  └────────────┘ │  [ 결정 ] 설명 보기          │
    //                 └─────────────────────────────┘
    //=========================================================================
    function Scene_ItemBook() { this.initialize.apply(this, arguments); }
    Scene_ItemBook.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_ItemBook.prototype.constructor = Scene_ItemBook;

    Scene_ItemBook.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_ItemBook.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);

        var lw = 240;
        var rw = Graphics.boxWidth - lw;

        this._indexWindow  = new Window_ItemBookIndex(0, 0, lw, Graphics.boxHeight);
        this._statusWindow = new Window_ItemBookStatus(lw, 0, rw, Graphics.boxHeight);

        this._indexWindow.setHandler('cancel', this.popScene.bind(this));
        this._indexWindow.setHandler('ok', this.onIndexOk.bind(this));
        this._indexWindow.setStatusWindow(this._statusWindow);

        this.addWindow(this._indexWindow);
        this.addWindow(this._statusWindow);
    };

    Scene_ItemBook.prototype.onIndexOk = function() {
        this._statusWindow.toggleView();
        this._indexWindow.activate();
    };

    //=========================================================================
    // Window_ItemBookIndex — 왼쪽 목록
    //=========================================================================
    function Window_ItemBookIndex() { this.initialize.apply(this, arguments); }
    Window_ItemBookIndex.prototype = Object.create(Window_Selectable.prototype);
    Window_ItemBookIndex.prototype.constructor = Window_ItemBookIndex;
    Window_ItemBookIndex.lastTopRow = 0;
    Window_ItemBookIndex.lastIndex  = 0;

    Window_ItemBookIndex.prototype.initialize = function(x, y, width, height) {
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
        this.setTopRow(Window_ItemBookIndex.lastTopRow);
        this.select(Window_ItemBookIndex.lastIndex);
        this.activate();
    };

    Window_ItemBookIndex.prototype.maxCols  = function() { return 1; };
    Window_ItemBookIndex.prototype.maxItems = function() { return this._list ? this._list.length : 0; };

    Window_ItemBookIndex.prototype.setStatusWindow = function(w) { this._statusWindow = w; this._updateRight(); };

    Window_ItemBookIndex.prototype.update = function() {
        Window_Selectable.prototype.update.call(this);
        this._updateRight();
    };

    Window_ItemBookIndex.prototype._updateRight = function() {
        var item = this._list ? this._list[this.index()] : null;
        if (this._statusWindow) this._statusWindow.setItem(item);
    };

    Window_ItemBookIndex.prototype.refresh = function() {
        var i, item;
        this._list = [];
        for (i = 1; i < $dataItems.length;   i++) {
            item = $dataItems[i];
            if (item && item.name && item.itypeId === 1 && item.meta.book !== 'no') this._list.push(item);
        }
        for (i = 1; i < $dataWeapons.length;  i++) {
            item = $dataWeapons[i];
            if (item && item.name && item.meta.book !== 'no') this._list.push(item);
        }
        for (i = 1; i < $dataArmors.length;   i++) {
            item = $dataArmors[i];
            if (item && item.name && item.meta.book !== 'no') this._list.push(item);
        }
        this.createContents();
        this.drawAllItems();
    };

    Window_ItemBookIndex.prototype.drawItem = function(index) {
        var item  = this._list[index];
        var rect  = this.itemRectForText(index);
        var known = $gameSystem.isInItemBook(item);
        var iw    = Window_Base._iconWidth; // 32
        var x = rect.x, y = rect.y;

        // 번호
        this.changeTextColor(this.textColor(7));
        this.drawText(('000' + (index + 1)).slice(-3), x, y, 36);
        x += 40;

        if (known) {
            this.drawIcon(item.iconIndex, x, y + 2);
            this.resetTextColor();
            this.drawText(item.name, x + iw + 4, y, rect.width - 40 - iw - 4);
        } else {
            this.changeTextColor(this.textColor(7));
            this.drawText(unknownData, x + iw + 4, y, rect.width - 40 - iw - 4);
        }
    };

    Window_ItemBookIndex.prototype.processCancel = function() {
        Window_Selectable.prototype.processCancel.call(this);
        Window_ItemBookIndex.lastTopRow = this.topRow();
        Window_ItemBookIndex.lastIndex  = this.index();
    };

    //=========================================================================
    // Window_ItemBookStatus — 오른쪽 상단 스탯
    //=========================================================================
    function Window_ItemBookStatus() { this.initialize.apply(this, arguments); }
    Window_ItemBookStatus.prototype = Object.create(Window_Base.prototype);
    Window_ItemBookStatus.prototype.constructor = Window_ItemBookStatus;

    Window_ItemBookStatus.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._item     = null;
        this._showDesc = false;
        this.refresh();
    };

    Window_ItemBookStatus.prototype.setItem = function(item) {
        if (this._item !== item) {
            this._item = item;
            this.refresh();
        }
    };

    Window_ItemBookStatus.prototype.toggleView = function() {
        this._showDesc = !this._showDesc;
        this.refresh();
    };

    Window_ItemBookStatus.prototype.refresh = function() {
        var item = this._item;
        var lh   = this.lineHeight();
        var pad  = this.textPadding();
        var cw   = this.contents.width;
        var ch   = this.contents.height;
        this.contents.clear();

        // 하단 힌트 (아이템 유무와 상관없이 항상 표시)
        this._drawHint();

        if (!item || !$gameSystem.isInItemBook(item)) return;

        var x = pad, y = 0;
        var maxY = ch - lh * 2; // 힌트 영역 제외

        // 이름 + 아이콘
        this.drawItemName(item, x, y, cw - pad);
        y += lh;

        if (this._showDesc) {
            // ── 설명 모드 ──
            this.drawTextEx(item.description, x, y);
        } else {
            // ── 효과/스탯 모드 ──
            var col2 = Math.floor(cw / 2) + pad;

            // 가격
            this.changeTextColor(this.systemColor());
            this.drawText(priceText, x, y, 90);
            this.resetTextColor();
            this.drawText(item.price > 0 ? item.price : '-', x + 90, y, 60, 'right');

            if (DataManager.isWeapon(item) || DataManager.isArmor(item)) {
                // 장비 슬롯
                var etype = $dataSystem.equipTypes[item.etypeId];
                this.changeTextColor(this.systemColor());
                this.drawText(equipText, col2, y, 90);
                this.resetTextColor();
                this.drawText(etype || '-', col2 + 90, y, 110);
                y += lh;

                // 타입
                var typeName = DataManager.isWeapon(item)
                    ? $dataSystem.weaponTypes[item.wtypeId]
                    : $dataSystem.armorTypes[item.atypeId];
                this.changeTextColor(this.systemColor());
                this.drawText(typeText, x, y, 90);
                this.resetTextColor();
                this.drawText(typeName || '-', x + 90, y, 110);
                y += lh;

                // 파라미터 (ATK~LUK, 인덱스 2~7) — 2열
                for (var i = 2; i < 8; i++) {
                    var pi = i - 2;
                    var px = (pi % 2 === 0) ? x : col2;
                    var py = y + Math.floor(pi / 2) * lh;
                    this.changeTextColor(this.systemColor());
                    this.drawText(TextManager.param(i), px, py, 90);
                    this.resetTextColor();
                    this.drawText(item.params[i], px + 90, py, 50, 'right');
                }
            } else {
                // 일반 아이템 — 사용 효과 목록
                y += lh;
                var effects = item.effects || [];
                for (var ei = 0; ei < effects.length; ei++) {
                    if (y >= maxY) break;
                    var ef = this._parseEffect(effects[ei]);
                    if (ef) {
                        this.changeTextColor(this.systemColor());
                        this.drawText(ef.label, x, y, 110);
                        this.resetTextColor();
                        this.drawText(ef.value, x + 110, y, cw - x - 110 - pad);
                        y += lh;
                    }
                }
            }
        }
    };

    Window_ItemBookStatus.prototype._drawHint = function() {
        var lh  = this.lineHeight();
        var pad = this.textPadding();
        var cw  = this.contents.width;
        var ch  = this.contents.height;

        // 구분선
        var lineY = ch - lh * 2 + 4;
        this.contents.fillRect(pad, lineY, cw - pad * 2, 1, this.textColor(7));

        // 힌트 텍스트
        var hintText = this._showDesc ? '[ 결정 ]  효과 보기' : '[ 결정 ]  설명 보기';
        this.changeTextColor(this.textColor(7));
        this.drawText(hintText, pad, ch - lh, cw - pad * 2, 'right');
        this.resetTextColor();
    };

    // effect 코드 → {label, value} 변환
    Window_ItemBookStatus.prototype._parseEffect = function(effect) {
        var label, value, parts;
        switch (effect.code) {
        case 11: // HP 회복
            label = 'HP 회복';
            parts = [];
            if (effect.value1 !== 0) parts.push(Math.round(effect.value1 * 100) + '%');
            if (effect.value2 !== 0) parts.push((effect.value2 > 0 ? '+' : '') + effect.value2);
            value = parts.join(' + ') || '-';
            break;
        case 12: // MP 회복
            label = 'MP 회복';
            parts = [];
            if (effect.value1 !== 0) parts.push(Math.round(effect.value1 * 100) + '%');
            if (effect.value2 !== 0) parts.push((effect.value2 > 0 ? '+' : '') + effect.value2);
            value = parts.join(' + ') || '-';
            break;
        case 13: // TP 증가
            label = 'TP 증가';
            value = '+' + effect.value1;
            break;
        case 14: // 상태 부여
            label = '상태 부여';
            var st14 = $dataStates[effect.dataId];
            value = (st14 ? st14.name : '?') + ' ' + Math.round(effect.value1 * 100) + '%';
            break;
        case 15: // 상태 해제
            label = '상태 해제';
            var st15 = $dataStates[effect.dataId];
            value = st15 ? st15.name : '?';
            break;
        case 16: // 버프
            label = '버프';
            value = TextManager.param(effect.dataId);
            break;
        case 17: // 디버프
            label = '디버프';
            value = TextManager.param(effect.dataId);
            break;
        case 21: // 특수 (도주 등)
            label = '특수 효과';
            value = effect.dataId === 0 ? '도주' : String(effect.dataId);
            break;
        case 22: // 성장
            label = '성장';
            value = TextManager.param(effect.dataId) + ' +' + effect.value1;
            break;
        case 23: // 스킬 습득
            label = '스킬 습득';
            var sk = $dataSkills[effect.dataId];
            value = sk ? sk.name : '?';
            break;
        default:
            return null;
        }
        return { label: label, value: value };
    };

    //-------------------------------------------------------------------------
    // 메뉴 통합
    //-------------------------------------------------------------------------
    if (showInMenu) {
        var _makeCommandList = Window_MenuCommand.prototype.makeCommandList;
        Window_MenuCommand.prototype.makeCommandList = function() {
            _makeCommandList.call(this);
            this.addCommand(menuText, 'itemBook');
        };

        var _createCommandWindow = Scene_Menu.prototype.createCommandWindow;
        Scene_Menu.prototype.createCommandWindow = function() {
            _createCommandWindow.call(this);
            this._commandWindow.setHandler('itemBook', this.commandItemBook.bind(this));
        };

        Scene_Menu.prototype.commandItemBook = function() {
            SceneManager.push(Scene_ItemBook);
        };
    }

})();
