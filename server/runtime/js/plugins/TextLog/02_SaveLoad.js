    // =========================================================================
    // 세이브/로드 통합
    // =========================================================================
    var _makeSave = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        var c = _makeSave.call(this);
        c._textLog = TextLogManager.save();
        return c;
    };

    var _extractSave = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (c) {
        _extractSave.call(this, c);
        TextLogManager.load(c._textLog);
    };

    // 새 게임 시작 시 로그 초기화
    var _setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _setupNewGame.call(this);
        TextLogManager.clear();
    };

