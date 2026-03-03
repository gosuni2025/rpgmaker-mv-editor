    //=========================================================================
    // ConfigManager 확장 - showHoverHighlight 저장/복원
    //=========================================================================

    if (showHoverHighlight) {
        ConfigManager.showHoverHighlight = true;

        var _ConfigManager_makeData = ConfigManager.makeData;
        ConfigManager.makeData = function() {
            var config = _ConfigManager_makeData.call(this);
            config.showHoverHighlight = this.showHoverHighlight;
            return config;
        };

        var _ConfigManager_applyData = ConfigManager.applyData;
        ConfigManager.applyData = function(config) {
            _ConfigManager_applyData.call(this, config);
            // 저장된 값이 없으면 기본값 true
            this.showHoverHighlight = (config.showHoverHighlight !== undefined)
                ? !!config.showHoverHighlight
                : true;
        };

        // Window_Options에 "마우스 커서 표시" 항목 추가
        var _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
        Window_Options.prototype.addGeneralOptions = function() {
            _Window_Options_addGeneralOptions.call(this);
            this.addCommand('마우스 커서 표시', 'showHoverHighlight');
        };
    }

    //=========================================================================
    // 마우스 좌표 추적 (showHoverHighlight 또는 showEventHoverLine 활성 시)
    //=========================================================================
    var _hoverMouseX = -1;
    var _hoverMouseY = -1;

    if (showHoverHighlight || showEventHoverLine) {
        document.addEventListener('mousemove', function(e) {
            _hoverMouseX = Graphics.pageToCanvasX(e.pageX);
            _hoverMouseY = Graphics.pageToCanvasY(e.pageY);
        });
        document.addEventListener('mouseleave', function() {
            _hoverMouseX = -1;
            _hoverMouseY = -1;
        });
    }

    var _lastDestX = -1;
    var _lastDestY = -1;

    // Hide Default: Sprite_Destination.update를 차단하여 visible=true 방지
    if (hideDefault) {
        Sprite_Destination.prototype.update = function() {
            this.visible = false;
        };
    }

