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
     * 로드 씬 초기 커서 위치.
     * 일반 슬롯(1~maxSavefiles) 중 가장 최신 파일로 이동.
     * 일반 저장 없으면 오토세이브 슬롯(index=0)으로 이동.
     * @returns {number} 초기 선택 인덱스
     */
    Scene_Load.prototype.firstSavefileIndex = function() {
        var globalInfo = DataManager.loadGlobalInfo();
        var latestId = 0; // 기본: 오토세이브 슬롯 (index 0)
        var timestamp = -1;
        if (globalInfo) {
            for (var i = 1; i <= DataManager.maxSavefiles(); i++) {
                if (DataManager.isThisGameFile(i) && globalInfo[i] && globalInfo[i].timestamp > timestamp) {
                    timestamp = globalInfo[i].timestamp;
                    latestId = i;
                }
            }
        }
        return latestId;
    };

