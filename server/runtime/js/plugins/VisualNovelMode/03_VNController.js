    // =========================================================================
    // VNController
    // =========================================================================
    function VNController(scene) {
        this._scene     = scene;
        this._state     = 'closed';
        this._alpha     = 0;
        this._autoTimer = -1;

        // 오버레이: Three.js 렌더러 내부에 그려야 텍스트 창 아래에 위치함
        // setFrame() 필수 — 없으면 _frameWidth=0 → Three.js mesh.visible=false
        var ow = Graphics.width;
        var oh = Graphics.height;
        this._overlay = new Sprite(new Bitmap(ow, oh));
        this._overlay.bitmap.fillAll('#000000');  // 텍스처는 불투명 검정, 투명도는 sprite.opacity로 제어
        this._overlay.setFrame(0, 0, ow, oh);
        this._overlay.opacity = 0;
        scene.addChild(this._overlay);

        // ThreeSprite는 3D 모드에서 alphaTest:0.5, transparent:false로 생성됨.
        // 오버레이는 반드시 투명 블렌딩이 필요하므로 material을 직접 패치.
        var ovMat = this._overlay._threeObj && this._overlay._threeObj.material;
        if (ovMat) {
            ovMat.transparent  = true;
            ovMat.alphaTest    = 0;
            ovMat.depthTest    = false;
            ovMat.depthWrite   = false;
            ovMat.needsUpdate  = true;
        }

        // renderOrder는 children 배열 순서로 할당됨.
        // overlay가 windowLayer보다 앞에 오도록 배열과 Three.js 그룹을 직접 재정렬.
        var sc = scene.children;
        var wlIdx = sc.indexOf(scene._windowLayer);
        var ovIdx = sc.indexOf(this._overlay);
        if (wlIdx >= 0 && ovIdx > wlIdx) {
            sc.splice(ovIdx, 1);
            sc.splice(wlIdx, 0, this._overlay);
            if (scene._threeObj && this._overlay._threeObj && scene._windowLayer._threeObj) {
                var tc = scene._threeObj.children;
                var wlT = scene._windowLayer._threeObj;
                var ovT = this._overlay._threeObj;
                var wlTi = tc.indexOf(wlT);
                var ovTi = tc.indexOf(ovT);
                if (wlTi >= 0 && ovTi > wlTi) {
                    tc.splice(ovTi, 1);
                    tc.splice(wlTi, 0, ovT);
                }
            }
        }

        this._textWin = new Window_VNText();
        this._textWin.contentsOpacity = 0;
        this._textWin.visible = false;  // VN 비활성 시 WindowLayer 클리어 방지
        scene.addWindow(this._textWin);
    }

    VNController.prototype.open = function () {
        this._overlay.visible = true;
        this._textWin.visible = true;
        this._state = 'opening';
        this._autoTimer = -1;
        // 새 VN 세션 시작 시 이전 텍스트 초기화
        var tw = this._textWin;
        tw._entries          = [];
        tw._layouts          = [];
        tw._totalH           = 0;
        tw._scrollY          = 0;
        tw._vel              = 0;
        tw._isTyping         = false;
        tw._typeEntryIdx     = -1;
        tw._choiceActive     = false;
        tw._choiceResult     = -1;
        tw._pendingChoiceIdx = -1;
        tw._pendingAutoExit  = false;
        tw.pause             = false;
        tw._forceOk          = false;
        if (tw.contents) tw.contents.clear();
    };

    VNController.prototype.close = function () {
        this._state = 'closing';
        this._autoTimer = -1;
        this._textWin._etClearAllOverlays();
    };

    VNController.prototype.getTextWindow = function () { return this._textWin; };

    VNController.prototype.startTyping = function (spk, txt) {
        this._textWin.startTyping(spk, txt);
        this._autoTimer = -1;
    };

    VNController.prototype.scheduleAutoExit = function () {
        if (AUTO_EXIT_DELAY <= 0) { VNManager.exit(); this.close(); }
        else { this._autoTimer = AUTO_EXIT_DELAY; }
    };

    VNController.prototype.cancelAutoExit = function () { this._autoTimer = -1; };

    VNController.prototype.update = function () {
        var step = OVERLAY_OPACITY / TRANS_FRAMES;
        if (this._state === 'opening') {
            this._alpha = Math.min(OVERLAY_OPACITY, this._alpha + step);
            this._overlay.opacity         = Math.round(this._alpha);
            this._textWin.contentsOpacity = Math.round(this._alpha / OVERLAY_OPACITY * 255);
            if (this._alpha >= OVERLAY_OPACITY) { this._alpha = OVERLAY_OPACITY; this._state = 'open'; }
        } else if (this._state === 'closing') {
            this._alpha = Math.max(0, this._alpha - step);
            this._overlay.opacity         = Math.round(this._alpha);
            this._textWin.contentsOpacity = Math.round(this._alpha / OVERLAY_OPACITY * 255);
            if (this._alpha <= 0) {
                this._alpha = 0; this._state = 'closed';
                this._overlay.visible = false;
                this._textWin.visible = false;  // VN 종료 후 WindowLayer 클리어 방지
            }
        }

        if (this._autoTimer > 0) {
            this._autoTimer--;
            if (this._autoTimer === 0) {
                this._autoTimer = -1;
                VNManager.exit();
                this.close();
            }
        }
    };

