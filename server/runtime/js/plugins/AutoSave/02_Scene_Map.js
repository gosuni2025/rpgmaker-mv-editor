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

