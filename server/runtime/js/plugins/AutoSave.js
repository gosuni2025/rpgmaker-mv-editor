/*:
 * @plugindesc 오토 세이브 (자동 저장) 기능
 * @author gosuni2025
 *
 * @param --- 자동 저장 조건 ---
 * @default
 *
 * @param enableMapTransferSave
 * @parent --- 자동 저장 조건 ---
 * @text 맵 이동 시 저장
 * @desc 맵 이동(장소 이동) 완료 후 자동 저장합니다.
 * @type boolean
 * @default true
 *
 * @param enableAfterBattle
 * @parent --- 자동 저장 조건 ---
 * @text 전투 종료 후 저장
 * @desc 전투 승리·도주 후 맵으로 돌아올 때 자동 저장합니다. (게임오버는 저장 안 됨)
 * @type boolean
 * @default true
 *
 * @param enableOnVariableChange
 * @parent --- 자동 저장 조건 ---
 * @text 게임 변수 변경 시 저장
 * @desc 게임 변수가 변경된 후 일정 시간 기다렸다가 자동 저장합니다.
 * @type boolean
 * @default false
 *
 * @param variableChangeDelay
 * @parent --- 자동 저장 조건 ---
 * @text 변수 변경 후 저장 지연 (ms)
 * @desc 변수 변경 후 이 시간(밀리초)이 지나면 저장합니다. 연속 변경 시 마지막 변경 기준.
 * @type number
 * @min 100
 * @max 10000
 * @default 500
 *
 * @param enableAfterMenu
 * @parent --- 자동 저장 조건 ---
 * @text ESC 메뉴 닫기 후 저장
 * @desc 메뉴(아이템·스킬·장비 등)를 닫고 맵으로 돌아올 때 자동 저장합니다.
 * @type boolean
 * @default true
 *
 * @param --- 표시 설정 ---
 * @default
 *
 * @param slotLabel
 * @parent --- 표시 설정 ---
 * @text 오토 세이브 슬롯 레이블
 * @desc 저장/로드 화면에서 오토 세이브 슬롯에 표시할 이름
 * @type string
 * @default 오토 세이브
 *
 * @param showNotification
 * @parent --- 표시 설정 ---
 * @text 자동 저장 알림
 * @desc 자동 저장 시 화면 우상단에 알림을 표시합니다.
 * @type boolean
 * @default true
 *
 * @help
 * ================================================================
 * ■ AutoSave 플러그인
 * ================================================================
 *
 * 저장/로드 화면 최상단에 전용 오토 세이브 슬롯이 항상 표시됩니다.
 * 오토 세이브 슬롯은 자동으로만 기록되며, 저장 화면에서
 * 수동으로 덮어쓸 수 없습니다.
 *
 * ----------------------------------------------------------------
 * ■ 자동 저장 조건 (파라미터에서 개별 활성화/비활성화)
 * ----------------------------------------------------------------
 *   1. 맵 이동 시
 *      - 장소 이동 이벤트 커맨드로 맵이 전환될 때마다 저장
 *
 *   2. 전투 종료(승리·도주) 후
 *      - 전투 승리 또는 도주 성공 후 맵으로 복귀할 때 저장
 *      - 게임 오버(전멸)는 저장하지 않음
 *
 *   3. 게임 변수 변경 시
 *      - 이벤트 커맨드 등으로 변수가 바뀔 때 저장
 *      - 연속 변경은 마지막 변경 기준으로 1회만 저장 (디바운스)
 *      - 기본 비활성화 — 빈번한 저장이 우려되는 경우 주의
 *
 *   4. ESC 메뉴 닫기 후
 *      - 메인 메뉴·아이템·스킬·장비·상태 화면을 닫고
 *        맵으로 돌아올 때 저장
 *
 * ----------------------------------------------------------------
 * ■ 자동 저장 알림 (화면 우상단)
 * ----------------------------------------------------------------
 *   자동 저장이 실행되면 3단계 메시지가 순차 표시됩니다:
 *     "오토 세이브 저장 시작"  (파란색, 약 0.4초)
 *     "오토 세이브 저장 중..."  (노란색, 약 0.4초)
 *     "오토 세이브 저장 완료"  (초록색, 약 1.5초 후 페이드 아웃)
 *   저장에 실패하면 마지막 메시지가 "저장 실패" (빨간색)로 표시됩니다.
 *
 * ----------------------------------------------------------------
 * ■ 플러그인 커맨드
 * ----------------------------------------------------------------
 *   AutoSave           즉시 오토 세이브 실행
 *   AutoSaveEnable     맵 이동 시 자동 저장 활성화
 *   AutoSaveDisable    맵 이동 시 자동 저장 비활성화
 *
 * ================================================================
 */

(function() {
    'use strict';

    var PLUGIN_NAME = 'AutoSave';

    /**
     * 오토 세이브 전용 파일 ID.
     * 일반 세이브 슬롯(1~maxSavefiles) 및 globalInfo(ID=0)와 충돌하지 않도록
     * maxSavefiles()+1 을 사용한다. (기본 maxSavefiles=20 → ID=21)
     * @const {number}
     */
    var AUTOSAVE_FILE_ID = DataManager.maxSavefiles() + 1;

    var parameters = PluginManager.parameters(PLUGIN_NAME);

    /** @type {boolean} 맵 이동 시 자동 저장 */
    var param_onMapTransfer    = (parameters['enableMapTransferSave']  !== 'false');
    /** @type {boolean} 전투 종료 후 자동 저장 */
    var param_onBattle         = (parameters['enableAfterBattle']      !== 'false');
    /** @type {boolean} 게임 변수 변경 시 자동 저장 */
    var param_onVariable       = (parameters['enableOnVariableChange'] === 'true');
    /** @type {number} 변수 변경 후 저장 지연(ms) */
    var param_variableDelay    = Number(parameters['variableChangeDelay'] || 500);
    /** @type {boolean} 메뉴 닫기 후 자동 저장 */
    var param_onMenu           = (parameters['enableAfterMenu']        !== 'false');
    /** @type {string} 슬롯 레이블 */
    var param_slotLabel        = String(parameters['slotLabel'] || '오토 세이브');
    /** @type {boolean} 저장 알림 표시 */
    var param_showNotification = (parameters['showNotification']       !== 'false');

    //=========================================================================
    // DataManager - 오토 세이브
    //=========================================================================

    /**
     * 오토 세이브를 요청한다.
     * 알림이 활성화되어 있고 현재 씬이 Scene_Map이면 update 루프를
     * 통해 3단계(시작→저장 중→완료)를 각각 별도 프레임에 렌더링한다.
     * 그 외 경우(씬 없음·알림 비활성)에는 즉시 저장한다.
     * @returns {boolean} 즉시 저장 시 성공 여부, 큐 방식 시 true
     */
    DataManager.performAutosave = function() {
        if (!$gameSystem || !$dataSystem) return false;

        if (param_showNotification) {
            var scene = SceneManager._scene;
            if (scene instanceof Scene_Map && scene.queueAutosave) {
                scene.queueAutosave(); // 프레임 단위로 진행
                return true;
            }
        }
        // 알림 없이 즉시 저장
        return DataManager._doActualSave();
    };

    /**
     * 실제 파일 저장을 수행한다.
     * $gameSystem.onBeforeSave() → saveGame(0) → cleanBackup 순으로 실행.
     * @returns {boolean} 저장 성공 여부
     */
    DataManager._doActualSave = function() {
        var ok = false;
        try {
            $gameSystem.onBeforeSave();
            ok = this.saveGame(AUTOSAVE_FILE_ID);
            if (ok) StorageManager.cleanBackup(AUTOSAVE_FILE_ID);
        } catch (e) {
            console.warn('[AutoSave] 저장 실패:', e);
        }
        return ok;
    };

    /** 변수 변경 디바운스 타이머 ID @type {number|null} */
    DataManager._autosaveVariableTimer = null;

    /**
     * 변수 변경 후 저장을 디바운스로 예약한다.
     * param_variableDelay ms 이내에 재호출되면 타이머를 리셋한다.
     */
    DataManager.scheduleAutosaveForVariable = function() {
        if (DataManager._autosaveVariableTimer) {
            clearTimeout(DataManager._autosaveVariableTimer);
        }
        DataManager._autosaveVariableTimer = setTimeout(function() {
            DataManager._autosaveVariableTimer = null;
            var scene = SceneManager._scene;
            // 맵 씬에서 씬 전환이 없을 때만 저장
            if (scene instanceof Scene_Map && !SceneManager.isSceneChanging()) {
                DataManager.performAutosave();
            }
        }, param_variableDelay);
    };

    //=========================================================================
    // Scene_Map - 자동 저장 트리거 (맵 이동 / 전투 종료 / 메뉴 닫기)
    //=========================================================================

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);

        var prev = SceneManager._previousClass;
        if (!prev) return;

        if (param_onMapTransfer && prev === Scene_Map) {
            // ① 맵 → 맵 이동 완료
            DataManager.performAutosave();

        } else if (param_onBattle && prev === Scene_Battle) {
            // ② 전투 종료 후 맵으로 복귀 (승리·도주·canLose 패배)
            //    게임오버(canLose=false 패배)는 Scene_Gameover로 가므로 여기 도달하지 않음
            DataManager.performAutosave();

        } else if (param_onMenu &&
                   prev.prototype instanceof Scene_MenuBase) {
            // ③ 메뉴 계열(Scene_Menu, Scene_Item, Scene_Skill, Scene_Equip,
            //              Scene_Status, Scene_File 등)에서 맵으로 복귀
            DataManager.performAutosave();
        }
    };

    //=========================================================================
    // Scene_Map - 자동 저장 알림 (실제 저장 흐름에 동기화된 3단계)
    //
    // JS는 싱글스레드라 동기 저장 도중 렌더링이 불가능하다.
    // update 루프를 이용해 매 프레임 큐(_asQueue) 상태를 진행시켜
    // 각 단계가 반드시 1프레임 이상 화면에 렌더링되도록 보장한다.
    //
    // 큐 상태 흐름:
    //   'start'  → 프레임 N:   "저장 시작" 렌더링
    //   'saving' → 프레임 N+1: "저장 중..." 렌더링
    //   'dosave' → 프레임 N+2: saveGame() 실행 → "저장 완료/실패" 렌더링
    //   null     → 이후: 타이머 감소 → 페이드 아웃
    //=========================================================================

    /** 단계별 표시 텍스트·색상 테이블 */
    var NOTIFY_STYLE = {
        'start':    { suffix: ' 저장 시작', color: '#aaaaff' },
        'saving':   { suffix: ' 저장 중...', color: '#ffff88' },
        'complete': { suffix: ' 저장 완료',  color: '#aaffaa' },
        'fail':     { suffix: ' 저장 실패',  color: '#ff8888' },
    };

    /**
     * 알림 스프라이트가 없으면 생성하고 반환한다.
     * @returns {Sprite}
     */
    Scene_Map.prototype._ensureAutosaveSprite = function() {
        if (!this._autosaveNotify) {
            var bmp    = new Bitmap(240, 44);
            var sprite = new Sprite(bmp);
            sprite.x   = Graphics.width - bmp.width - 12;
            sprite.y   = 12;
            this._autosaveNotify = sprite;
            this.addChild(sprite);
        }
        return this._autosaveNotify;
    };

    /**
     * 알림 스프라이트에 지정 단계 텍스트를 그린다.
     * @param {'start'|'saving'|'complete'|'fail'} key - 단계 키
     */
    Scene_Map.prototype._drawAutosavePhase = function(key) {
        var sprite = this._ensureAutosaveSprite();
        var style  = NOTIFY_STYLE[key];
        var bmp    = sprite.bitmap;
        bmp.clear();
        bmp.fillRect(0, 0, bmp.width, bmp.height, 'rgba(0,0,0,0.65)');
        bmp.fontSize  = 18;
        bmp.textColor = style.color;
        bmp.drawText(param_slotLabel + style.suffix, 8, 6, bmp.width - 16, 32);
        sprite.opacity = 255;
    };

    /**
     * 저장 알림 큐를 시작한다.
     * performAutosave()에서 호출되며, 이후 처리는 update()가 담당한다.
     */
    Scene_Map.prototype.queueAutosave = function() {
        this._asQueue = 'start'; // update() 에서 프레임 단위로 진행
        this._asTimer = 0;
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        this._updateAutosaveQueue();
        this._updateAutosaveNotify();
    };

    /**
     * 저장 큐를 1단계씩 진행한다. 매 프레임 1회 호출.
     *
     * - 'start'  : "저장 시작" 렌더 → 다음 프레임 'saving' 으로 전환
     * - 'saving' : "저장 중..." 렌더 → 다음 프레임 'dosave' 으로 전환
     * - 'dosave' : saveGame() 실행 → 결과에 따라 "저장 완료/실패" 렌더
     *              → 타이머 설정 후 큐 종료(null)
     */
    Scene_Map.prototype._updateAutosaveQueue = function() {
        if (!this._asQueue) return;

        if (this._asQueue === 'start') {
            this._drawAutosavePhase('start');
            this._asQueue = 'saving';

        } else if (this._asQueue === 'saving') {
            this._drawAutosavePhase('saving');
            this._asQueue = 'dosave';

        } else if (this._asQueue === 'dosave') {
            var ok = DataManager._doActualSave();
            this._drawAutosavePhase(ok ? 'complete' : 'fail');
            this._asTimer = 120; // 2초 표시 후 페이드 아웃
            this._asQueue = null;
        }
    };

    /**
     * "저장 완료/실패" 단계 타이머를 감소시키고 마지막 0.5초에서 페이드 아웃한다.
     */
    Scene_Map.prototype._updateAutosaveNotify = function() {
        if (!this._autosaveNotify || this._asTimer <= 0) return;
        this._asTimer--;
        if (this._asTimer <= 30) {
            this._autosaveNotify.opacity = Math.floor(this._asTimer / 30 * 255);
        }
    };

    //=========================================================================
    // Game_Variables - 변수 변경 시 자동 저장 (디바운스)
    //=========================================================================

    if (param_onVariable) {
        var _Game_Variables_setValue = Game_Variables.prototype.setValue;
        /**
         * 게임 변수 값을 설정한다.
         * AutoSave 플러그인: 값 변경 시 param_variableDelay ms 후 오토 세이브 예약.
         * @param {number} variableId - 변수 ID
         * @param {*} value - 설정할 값 (숫자는 Math.floor 처리됨)
         */
        Game_Variables.prototype.setValue = function(variableId, value) {
            _Game_Variables_setValue.call(this, variableId, value);
            DataManager.scheduleAutosaveForVariable();
        };
    }

    //=========================================================================
    // Game_Interpreter - 플러그인 커맨드
    //=========================================================================

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        switch (command) {
            case 'AutoSave':
                // 즉시 오토 세이브 실행
                DataManager.performAutosave();
                break;
            case 'AutoSaveEnable':
                // 맵 이동 시 자동 저장 활성화
                param_onMapTransfer = true;
                break;
            case 'AutoSaveDisable':
                // 맵 이동 시 자동 저장 비활성화
                param_onMapTransfer = false;
                break;
        }
    };

    //=========================================================================
    // Window_SavefileList - 오토 세이브 슬롯을 인덱스 0으로 추가
    //
    // 인덱스 체계:
    //   index 0  → AUTOSAVE_FILE_ID (0)  — 오토 세이브 슬롯
    //   index 1  → fileId 1              — 일반 슬롯 1
    //   index N  → fileId N              — 일반 슬롯 N
    //=========================================================================

    // 슬롯 수 +1
    var _Window_SavefileList_maxItems = Window_SavefileList.prototype.maxItems;
    Window_SavefileList.prototype.maxItems = function() {
        return _Window_SavefileList_maxItems.call(this) + 1;
    };

    /**
     * 저장 모드에서 오토 세이브 슬롯(index 0) 선택 시 OK 차단.
     * 오토 세이브는 자동으로만 저장되며 수동 덮어쓰기 불가.
     */
    var _Window_SavefileList_processOk = Window_SavefileList.prototype.processOk;
    Window_SavefileList.prototype.processOk = function() {
        if (this._mode === 'save' && this.index() === 0) {
            SoundManager.playBuzzer();
            return;
        }
        _Window_SavefileList_processOk.call(this);
    };

    /**
     * 아이템 그리기.
     * index 0은 오토 세이브 슬롯으로 특별 표시, index 1+는 fileId 1, 2, 3...
     * @param {number} index - 리스트 인덱스
     */
    Window_SavefileList.prototype.drawItem = function(index) {
        var isAutosave = (index === 0);
        var id    = isAutosave ? AUTOSAVE_FILE_ID : index;
        var valid = DataManager.isThisGameFile(id);
        var info  = DataManager.loadSavefileInfo(id);
        var rect  = this.itemRectForText(index);

        this.resetTextColor();

        if (this._mode === 'load') {
            this.changePaintOpacity(valid);
        } else if (isAutosave) {
            // 저장 모드에서 오토 세이브 슬롯은 비활성(반투명)
            this.changePaintOpacity(false);
        }

        if (isAutosave) {
            this.changeTextColor(this.systemColor());
            this.drawText('[' + param_slotLabel + ']', rect.x, rect.y, 200);
            this.resetTextColor();
        } else {
            this.drawFileId(id, rect.x, rect.y);
        }

        if (info) {
            this.changePaintOpacity(valid);
            this.drawContents(info, rect, valid);
            this.changePaintOpacity(true);
        }
    };

    //=========================================================================
    // Scene_File - savefileId 및 firstSavefileIndex 조정
    //=========================================================================

    /**
     * 현재 선택된 저장 파일 ID를 반환한다.
     * 인덱스 체계 변경(index 0 = autosave, index N = fileId N)에 따라 오버라이드.
     * @returns {number} 저장 파일 ID
     */
    Scene_File.prototype.savefileId = function() {
        var index = this._listWindow.index();
        return (index === 0) ? AUTOSAVE_FILE_ID : index;
    };

    /**
     * 저장 씬 초기 커서 위치 (마지막 접근 파일).
     * 오토 세이브(ID=0)가 마지막 접근이었을 경우 파일 1로 대체.
     * @returns {number} 초기 선택 인덱스
     */
    Scene_Save.prototype.firstSavefileIndex = function() {
        var id = DataManager.lastAccessedSavefileId();
        if (id === AUTOSAVE_FILE_ID || id < 1) id = 1;
        // 새 인덱스 체계: index === fileId (오토 세이브 제외)
        return id;
    };

    /**
     * 로드 씬 초기 커서 위치 (가장 최신 파일).
     * @returns {number} 초기 선택 인덱스
     */
    Scene_Load.prototype.firstSavefileIndex = function() {
        var id = DataManager.latestSavefileId();
        return (id >= 1) ? id : 1;
    };

})();
