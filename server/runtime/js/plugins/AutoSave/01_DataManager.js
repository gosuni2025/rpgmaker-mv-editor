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

        // 쿨다운: 마지막 저장 완료로부터 param_cooldownMs가 지나지 않으면 무시
        if (param_cooldownMs > 0 && Date.now() - DataManager._lastAutosaveTime < param_cooldownMs) {
            return false;
        }

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
            if (ok) {
                StorageManager.cleanBackup(AUTOSAVE_FILE_ID);
                DataManager._lastAutosaveTime = Date.now(); // 쿨다운 갱신
            }
        } catch (e) {
            console.warn('[AutoSave] 저장 실패:', e);
        }
        return ok;
    };

    /** 마지막 오토 세이브 완료 시각 (밀리초) @type {number} */
    DataManager._lastAutosaveTime = 0;

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

