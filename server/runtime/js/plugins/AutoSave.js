/*:
 * @plugindesc 오토 세이브 (자동 저장) 기능
 * @author gosuni2025
 *
 * @param enableMapTransferSave
 * @text 맵 이동 시 자동 저장
 * @desc 맵 이동할 때마다 자동으로 저장합니다.
 * @type boolean
 * @default true
 *
 * @param slotLabel
 * @text 오토 세이브 슬롯 레이블
 * @desc 저장/로드 화면에서 오토 세이브 슬롯에 표시할 이름
 * @type string
 * @default 오토 세이브
 *
 * @param showNotification
 * @text 자동 저장 알림
 * @desc 자동 저장 시 화면 우상단에 알림을 표시합니다.
 * @type boolean
 * @default true
 *
 * @help
 * ■ AutoSave 플러그인
 *
 * 저장/로드 화면 최상단에 오토 세이브 슬롯이 항상 표시됩니다.
 * 오토 세이브 슬롯은 자동으로만 저장되며, 저장 화면에서
 * 수동으로 덮어쓸 수 없습니다.
 *
 * ■ 자동 저장 조건
 * - 맵 이동 시 (파라미터 설정에 따라)
 * - 플러그인 커맨드 실행 시
 *
 * ■ 플러그인 커맨드
 *   AutoSave           - 즉시 오토 세이브 실행
 *   AutoSaveEnable     - 맵 이동 시 자동 저장 활성화
 *   AutoSaveDisable    - 맵 이동 시 자동 저장 비활성화
 */

(function() {
    'use strict';

    var PLUGIN_NAME = 'AutoSave';
    var AUTOSAVE_FILE_ID = 0; // 파일 ID 0: 일반 세이브(1~20)와 별개로 보관

    var parameters = PluginManager.parameters(PLUGIN_NAME);
    var param_enableMapTransferSave = (parameters['enableMapTransferSave'] !== 'false');
    var param_slotLabel = String(parameters['slotLabel'] || '오토 세이브');
    var param_showNotification = (parameters['showNotification'] !== 'false');

    //=========================================================================
    // DataManager - 오토 세이브 실행
    //=========================================================================

    DataManager._autosaveEnabled = param_enableMapTransferSave;

    DataManager.performAutosave = function() {
        if (!$gameSystem || !$dataSystem) return false;
        try {
            $gameSystem.onBeforeSave();
            if (!this.saveGame(AUTOSAVE_FILE_ID)) return false;
            StorageManager.cleanBackup(AUTOSAVE_FILE_ID);
        } catch (e) {
            console.warn('[AutoSave] 저장 실패:', e);
            return false;
        }
        if (param_showNotification) {
            var scene = SceneManager._scene;
            if (scene && scene.showAutosaveNotification) {
                scene.showAutosaveNotification();
            }
        }
        return true;
    };

    //=========================================================================
    // Scene_Map - 맵 전환 시 자동 저장 + 알림
    //=========================================================================

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        // 이전 씬도 맵이었을 때(맵 이동)만 자동 저장
        if (DataManager._autosaveEnabled &&
                SceneManager._previousClass === Scene_Map) {
            DataManager.performAutosave();
        }
    };

    Scene_Map.prototype.showAutosaveNotification = function() {
        if (!this._autosaveNotify) {
            var bmp = new Bitmap(224, 44);
            var sprite = new Sprite(bmp);
            sprite._notifyTimer = 0;
            this._autosaveNotify = sprite;
            this.addChild(sprite);
        }
        var sprite = this._autosaveNotify;
        var bmp = sprite.bitmap;
        bmp.clear();
        bmp.fillRect(0, 0, bmp.width, bmp.height, 'rgba(0,0,0,0.65)');
        bmp.fontSize = 18;
        bmp.textColor = '#aaffaa';
        bmp.drawText(param_slotLabel + ' 저장됨', 8, 6, bmp.width - 16, 32);
        sprite.x = Graphics.width - bmp.width - 12;
        sprite.y = 12;
        sprite.opacity = 255;
        sprite._notifyTimer = 120; // 2초 (60fps 기준)
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (this._autosaveNotify && this._autosaveNotify._notifyTimer > 0) {
            var sprite = this._autosaveNotify;
            sprite._notifyTimer--;
            // 마지막 30프레임에서 페이드 아웃
            if (sprite._notifyTimer <= 30) {
                sprite.opacity = Math.floor(sprite._notifyTimer / 30 * 255);
            }
        }
    };

    //=========================================================================
    // Game_Interpreter - 플러그인 커맨드
    //=========================================================================

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        switch (command) {
            case 'AutoSave':
                DataManager.performAutosave();
                break;
            case 'AutoSaveEnable':
                DataManager._autosaveEnabled = true;
                break;
            case 'AutoSaveDisable':
                DataManager._autosaveEnabled = false;
                break;
        }
    };

    //=========================================================================
    // Window_SavefileList - 오토 세이브 슬롯을 인덱스 0으로 추가
    //
    // 인덱스 체계:
    //   index 0  → AUTOSAVE_FILE_ID (0)
    //   index 1  → fileId 1
    //   index N  → fileId N
    //=========================================================================

    // 슬롯 수 +1
    var _Window_SavefileList_maxItems = Window_SavefileList.prototype.maxItems;
    Window_SavefileList.prototype.maxItems = function() {
        return _Window_SavefileList_maxItems.call(this) + 1;
    };

    // 저장 모드에서 오토 세이브 슬롯 OK 차단
    var _Window_SavefileList_processOk = Window_SavefileList.prototype.processOk;
    Window_SavefileList.prototype.processOk = function() {
        if (this._mode === 'save' && this.index() === 0) {
            SoundManager.playBuzzer();
            return;
        }
        _Window_SavefileList_processOk.call(this);
    };

    // 아이템 그리기 (drawItem 전체 오버라이드)
    Window_SavefileList.prototype.drawItem = function(index) {
        var isAutosave = (index === 0);
        var id = isAutosave ? AUTOSAVE_FILE_ID : index;
        var valid = DataManager.isThisGameFile(id);
        var info = DataManager.loadSavefileInfo(id);
        var rect = this.itemRectForText(index);
        this.resetTextColor();

        // 불투명도 제어
        if (this._mode === 'load') {
            this.changePaintOpacity(valid);
        } else if (isAutosave) {
            // 저장 모드에서 오토 세이브 슬롯은 비활성(반투명)
            this.changePaintOpacity(false);
        }

        // 레이블
        if (isAutosave) {
            this.changeTextColor(this.systemColor());
            this.drawText('[' + param_slotLabel + ']', rect.x, rect.y, 200);
            this.resetTextColor();
        } else {
            this.drawFileId(id, rect.x, rect.y);
        }

        // 내용
        if (info) {
            this.changePaintOpacity(valid);
            this.drawContents(info, rect, valid);
            this.changePaintOpacity(true);
        }
    };

    //=========================================================================
    // Scene_File - savefileId 및 firstSavefileIndex 조정
    //=========================================================================

    // 인덱스 → 파일 ID 변환
    Scene_File.prototype.savefileId = function() {
        var index = this._listWindow.index();
        return (index === 0) ? AUTOSAVE_FILE_ID : index;
    };

    // 저장 씬: 마지막 접근 파일로 커서 이동 (오토 세이브 슬롯 제외)
    Scene_Save.prototype.firstSavefileIndex = function() {
        var id = DataManager.lastAccessedSavefileId();
        // 오토 세이브가 마지막 접근이었으면 파일 1로 대체
        if (id === AUTOSAVE_FILE_ID || id < 1) id = 1;
        // 새 체계에서는 fileId = index (index 0은 오토 세이브)
        return id;
    };

    // 로드 씬: 가장 최신 파일로 커서 이동
    Scene_Load.prototype.firstSavefileIndex = function() {
        var id = DataManager.latestSavefileId();
        return (id >= 1) ? id : 1;
    };

})();
