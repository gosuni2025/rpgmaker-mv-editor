    //=========================================================================
    // Window_SavefileList - 오토 세이브 슬롯을 인덱스 0으로 추가
    //
    // 인덱스 체계:
    //   index 0  → AUTOSAVE_FILE_ID      — 오토 세이브 슬롯
    //   index 1  → fileId 1              — 일반 슬롯 1
    //   index N  → fileId N              — 일반 슬롯 N
    //=========================================================================

    // refresh 시 캐시 무효화 (새로운 화면에서 최신 파일 목록 반영)
    var _Window_SavefileList_refresh = Window_SavefileList.prototype.refresh;
    Window_SavefileList.prototype.refresh = function() {
        StorageManager._existsCache = null;
        DataManager._cachedGlobalInfo = null;
        _Window_SavefileList_refresh.call(this);
    };

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

