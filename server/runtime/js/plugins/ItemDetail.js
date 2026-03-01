//=============================================================================
// ItemDetail.js
// 아이템 선택 시 중앙 팝업으로 이미지와 상세 텍스트를 표시합니다.
//=============================================================================

/*:
 * @plugindesc v1.3 아이템 결정 키/터치 시 중앙 팝업으로 상세 이미지와 텍스트를 표시합니다.
 * @author Claude
 *
 * @param defaultImgHAlign
 * @text 기본 이미지 가로 정렬
 * @type select
 * @option 왼쪽
 * @value left
 * @option 가운데
 * @value center
 * @option 오른쪽
 * @value right
 * @default center
 *
 * @param defaultImgVAlign
 * @text 기본 이미지 세로 정렬
 * @type select
 * @option 위
 * @value top
 * @option 가운데
 * @value middle
 * @option 아래
 * @value bottom
 * @default middle
 *
 * @param defaultTextHAlign
 * @text 기본 텍스트 가로 정렬
 * @type select
 * @option 왼쪽
 * @value left
 * @option 가운데
 * @value center
 * @option 오른쪽
 * @value right
 * @default left
 *
 * @param defaultTextVAlign
 * @text 기본 텍스트 세로 정렬
 * @type select
 * @option 위
 * @value top
 * @option 가운데
 * @value middle
 * @option 아래
 * @value bottom
 * @default bottom
 *
 * @param textBackground
 * @text 텍스트 배경 표시
 * @desc 이미지 위 텍스트 가독성을 위한 반투명 배경
 * @type boolean
 * @default true
 *
 * @help
 * ============================================================
 * 아이템 노트 태그
 * ============================================================
 *
 * <detailImg: 파일명>
 *   img/pictures/ 폴더의 이미지를 표시합니다.
 *   예) <detailImg: Crystal>
 *
 * <detailText>
 * 텍스트 내용 (여러 줄, \c[색번호] 제어문자 사용 가능)
 * </detailText>
 *
 * ============================================================
 */

(function () {
    'use strict';

    var p = PluginManager.parameters('ItemDetail');
    var DEF_IMG_HALIGN  = p['defaultImgHAlign']  || 'center';
    var DEF_IMG_VALIGN  = p['defaultImgVAlign']  || 'middle';
    var DEF_TXT_HALIGN  = p['defaultTextHAlign'] || 'left';
    var DEF_TXT_VALIGN  = p['defaultTextVAlign'] || 'bottom';
    var TEXT_BG         = p['textBackground'] !== 'false';

    //-------------------------------------------------------------------------
    // 노트 태그 파싱
    //-------------------------------------------------------------------------
    function parseDetail(item) {
        if (!item) return null;
        var note = item.note || '';

        var picM = note.match(/<detailPic>([\s\S]*?)<\/detailPic>/i);
        var txtM = note.match(/<detailTxt>([\s\S]*?)<\/detailTxt>/i);

        var legacyImgM      = !picM && note.match(/<detailImg:\s*(.+?)>/i);
        var legacyImgAlignM = !picM && note.match(/<detailImgAlign:\s*(\w+)\s*,\s*(\w+)>/i);
        var legacyTextM     = !txtM && note.match(/<detailText>([\s\S]*?)<\/detailText>/i);
        var legacyTxtAlignM = !txtM && note.match(/<detailTextAlign:\s*(\w+)\s*,\s*(\w+)>/i);

        var pic = null, txt = null;

        if (picM) {
            try { pic = JSON.parse(picM[1]); } catch(e) {}
        } else if (legacyImgM) {
            pic = {
                image: legacyImgM[1].trim(),
                opacity: 255, blendMode: 0,
                imgHAlign: legacyImgAlignM ? legacyImgAlignM[1].toLowerCase() : DEF_IMG_HALIGN,
                imgVAlign: legacyImgAlignM ? legacyImgAlignM[2].toLowerCase() : DEF_IMG_VALIGN
            };
        }

        if (txtM) {
            try { txt = JSON.parse(txtM[1]); } catch(e) {}
        } else if (legacyTextM) {
            txt = {
                text:       legacyTextM[1].trim(),
                textHAlign: legacyTxtAlignM ? legacyTxtAlignM[1].toLowerCase() : DEF_TXT_HALIGN,
                textVAlign: legacyTxtAlignM ? legacyTxtAlignM[2].toLowerCase() : DEF_TXT_VALIGN
            };
        }

        if (!pic && !txt) return null;

        return {
            image:      pic ? pic.image      : null,
            imgHAlign:  pic ? (pic.imgHAlign  || DEF_IMG_HALIGN) : DEF_IMG_HALIGN,
            imgVAlign:  pic ? (pic.imgVAlign  || DEF_IMG_VALIGN) : DEF_IMG_VALIGN,
            opacity:    pic ? (pic.opacity    != null ? pic.opacity : 255) : 255,
            blendMode:  pic ? (pic.blendMode  || 0) : 0,
            shaderData: pic ? (pic.shaderData || []) : [],
            text:       txt ? txt.text        : null,
            textHAlign: txt ? (txt.textHAlign || DEF_TXT_HALIGN) : DEF_TXT_HALIGN,
            textVAlign: txt ? (txt.textVAlign || DEF_TXT_VALIGN) : DEF_TXT_VALIGN
        };
    }

    //=========================================================================
    // Window_ItemDetail — 중앙 상세 팝업 창
    //=========================================================================
    function Window_ItemDetail() {
        this.initialize.apply(this, arguments);
    }

    Window_ItemDetail.prototype = Object.create(Window_Base.prototype);
    Window_ItemDetail.prototype.constructor = Window_ItemDetail;

    Window_ItemDetail.prototype.initialize = function (x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._item   = null;
        this._detail = null;
        this.hide();
    };

    // 아이템 설정 후 창 표시 (항상 fresh 렌더링)
    Window_ItemDetail.prototype.open = function (item) {
        this._item   = null;
        this._detail = null;
        this.setItem(item);
        this.show();
    };

    Window_ItemDetail.prototype.setItem = function (item) {
        if (this._item === item) return;
        this._item   = item;
        this._detail = item ? parseDetail(item) : null;
        this.refresh();
    };

    Window_ItemDetail.prototype.refresh = function () {
        this.contents.clear();
        var detail = this._detail;
        if (!detail) return;

        var cw = this.contentsWidth();
        var ch = this.contentsHeight();
        var hintH = this.lineHeight();
        var drawCh = ch - hintH - 4;  // 하단 도움말 영역 확보

        if (detail.image) {
            var bmp = ImageManager.loadPicture(detail.image);
            if (bmp.isReady()) {
                this._drawImage(bmp, detail, cw, drawCh);
                this._drawText(detail, cw, drawCh);
                this._drawHint(detail, cw, ch, hintH);
            } else {
                bmp.addLoadListener(function () {
                    this.contents.clear();
                    this._drawImage(bmp, detail, cw, drawCh);
                    this._drawText(detail, cw, drawCh);
                    this._drawHint(detail, cw, ch, hintH);
                }.bind(this));
            }
        } else {
            this._drawText(detail, cw, drawCh);
            this._drawHint(detail, cw, ch, hintH);
        }
    };

    // 하단 키 조작 도움말
    Window_ItemDetail.prototype._drawHint = function (detail, cw, ch, hintH) {
        var prevFs = this.contents.fontSize;
        this.contents.fontSize = 16;
        this.changeTextColor(this.textColor(8));
        var hint = detail.image ? '결정: 이미지 보기   취소: 닫기' : '취소: 닫기';
        this.drawText(hint, 0, ch - hintH, cw, 'center');
        this.resetTextColor();
        this.contents.fontSize = prevFs;
    };

    Window_ItemDetail.prototype._drawImage = function (bmp, detail, cw, ch) {
        var bw = bmp.width, bh = bmp.height;
        var scale = Math.min(cw / bw, ch / bh, 1);
        var dw = Math.floor(bw * scale), dh = Math.floor(bh * scale);

        var dx = 0;
        if (detail.imgHAlign === 'center') dx = Math.floor((cw - dw) / 2);
        else if (detail.imgHAlign === 'right') dx = cw - dw;

        var dy = 0;
        if (detail.imgVAlign === 'middle') dy = Math.floor((ch - dh) / 2);
        else if (detail.imgVAlign === 'bottom') dy = ch - dh;

        var prevOpacity = this.contents.paintOpacity;
        this.contents.paintOpacity = (detail.opacity != null) ? detail.opacity : 255;
        this.contents.blt(bmp, 0, 0, bw, bh, dx, dy, dw, dh);
        this.contents.paintOpacity = prevOpacity;
    };

    Window_ItemDetail.prototype._measureLine = function (text) {
        var plain = text.replace(/\\[A-Za-z]\[\d*\]/g, '').replace(/\\/g, '');
        return this.contents.measureTextWidth(plain);
    };

    Window_ItemDetail.prototype._drawText = function (detail, cw, ch) {
        if (!detail.text) return;

        var lines  = detail.text.split('\n');
        var lh     = this.lineHeight();
        var total  = lines.length * lh;
        var pad    = 6;

        var startY = pad;
        if (detail.textVAlign === 'middle') startY = Math.max(pad, Math.floor((ch - total) / 2));
        else if (detail.textVAlign === 'bottom') startY = Math.max(pad, ch - total - pad);

        if (TEXT_BG && detail.image) {
            this.contents.fillRect(0, startY - 2, cw, total + 4, 'rgba(0,0,0,0.55)');
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var y    = startY + i * lh;
            var tw   = this._measureLine(line);
            var x    = pad;
            if (detail.textHAlign === 'center') x = Math.floor((cw - tw) / 2);
            else if (detail.textHAlign === 'right') x = cw - tw - pad;
            this.drawTextEx(line, x, y);
        }
    };

    //=========================================================================
    // ItemDetailFullscreen — 전체화면 이미지 뷰어
    // Sprite 기반으로 RPG MV 렌더링 파이프라인 활용 (shaderData 지원 가능)
    // DOM 이벤트 리스너로 입력 신뢰성 확보
    //=========================================================================
    function ItemDetailFullscreen() {
        this.initialize.apply(this, arguments);
    }

    ItemDetailFullscreen.prototype = Object.create(Sprite.prototype);
    ItemDetailFullscreen.prototype.constructor = ItemDetailFullscreen;

    ItemDetailFullscreen.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this._isOpen = false;
        this._closeRequested = false;
        this._cancelListener = null;

        // 검은 배경 스프라이트
        var bgBmp = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
        bgBmp.fillAll('#000000');
        this._bgSprite = new Sprite(bgBmp);
        this.addChild(this._bgSprite);

        // 이미지 스프라이트
        this._imgSprite = new Sprite();
        this.addChild(this._imgSprite);

        this.visible = false;
    };

    ItemDetailFullscreen.prototype.isOpen = function () {
        return this._isOpen;
    };

    ItemDetailFullscreen.prototype.open = function (item, detail) {
        detail = detail || parseDetail(item);
        if (!detail || !detail.image) return;
        if (this._isOpen) return;

        this._isOpen = true;
        this._closeRequested = false;
        this.visible = true;

        var self = this;
        var bmp = ImageManager.loadPicture(detail.image);
        function applyBitmap() {
            self._imgSprite.bitmap = bmp;
            var scale = Math.min(Graphics.boxWidth / bmp.width, Graphics.boxHeight / bmp.height, 1);
            self._imgSprite.scale.x = scale;
            self._imgSprite.scale.y = scale;
            self._imgSprite.x = Math.floor((Graphics.boxWidth  - bmp.width  * scale) / 2);
            self._imgSprite.y = Math.floor((Graphics.boxHeight - bmp.height * scale) / 2);
        }
        if (bmp.isReady()) {
            applyBitmap();
        } else {
            bmp.addLoadListener(applyBitmap);
        }

        // 200ms 후 닫기 허용 (여는 입력이 즉시 닫히는 것 방지)
        clearTimeout(this._openTimer);
        this._openTimer = setTimeout(function () {
            if (!self._isOpen) return;
            function onAny() {
                self._closeRequested = true;
                document.removeEventListener('keydown',    onAny, true);
                document.removeEventListener('mousedown',  onAny, true);
                document.removeEventListener('touchstart', onAny, true);
            }
            document.addEventListener('keydown',    onAny, true);
            document.addEventListener('mousedown',  onAny, true);
            document.addEventListener('touchstart', onAny, true);
            self._cancelListener = onAny;
        }, 200);
    };

    ItemDetailFullscreen.prototype.close = function () {
        this._isOpen = false;
        this._closeRequested = false;
        this.visible = false;
        clearTimeout(this._openTimer);
        if (this._cancelListener) {
            document.removeEventListener('keydown',    this._cancelListener, true);
            document.removeEventListener('mousedown',  this._cancelListener, true);
            document.removeEventListener('touchstart', this._cancelListener, true);
            this._cancelListener = null;
        }
        if (this._imgSprite) {
            this._imgSprite.bitmap = null;
        }
    };

    //=========================================================================
    // Window_ItemAction — 사용 / 살펴보기 선택 팝업
    //=========================================================================
    function Window_ItemAction() {
        this.initialize.apply(this, arguments);
    }

    Window_ItemAction.prototype = Object.create(Window_Command.prototype);
    Window_ItemAction.prototype.constructor = Window_ItemAction;

    Window_ItemAction.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 0, 0);
        this.x = Math.floor((Graphics.boxWidth  - this.width)  / 2);
        this.y = Math.floor((Graphics.boxHeight - this.height) / 2);
        this.deactivate();
        this.hide();
    };

    Window_ItemAction.prototype.windowWidth  = function () { return 240; };
    Window_ItemAction.prototype.windowHeight = function () { return this.fittingHeight(2); };

    Window_ItemAction.prototype.makeCommandList = function () {
        this.addCommand('사용',    'use');
        this.addCommand('살펴보기', 'inspect');
    };

    //-------------------------------------------------------------------------
    // 액션 창 터치 히트 테스트 헬퍼
    //-------------------------------------------------------------------------
    function actionWindowTouchRow(aw) {
        if (!TouchInput.isTriggered()) return -1;
        var tx = TouchInput.x, ty = TouchInput.y;
        var pad = aw.standardPadding ? aw.standardPadding() : 18;
        var lh  = aw.lineHeight();
        var innerX = aw.x + pad;
        var innerY = aw.y + pad;
        if (tx >= innerX && tx < aw.x + aw.width - pad &&
            ty >= innerY && ty < innerY + lh * aw.maxItems()) {
            return Math.floor((ty - innerY) / lh);
        }
        return -1;
    }

    //=========================================================================
    // Scene_Item — 기본 MV 씬
    //=========================================================================

    // 아이템 목록창 전체 너비
    Scene_Item.prototype.createItemWindow = function () {
        var wy = this._categoryWindow.y + this._categoryWindow.height;
        var wh = Graphics.boxHeight - wy;
        this._itemWindow = new Window_ItemList(0, wy, Graphics.boxWidth, wh);
        this._itemWindow.setHelpWindow(this._helpWindow);
        this._itemWindow.setHandler('ok',     this.onItemOk.bind(this));
        this._itemWindow.setHandler('cancel', this.onItemCancel.bind(this));
        this._categoryWindow.setItemWindow(this._itemWindow);
        this.addWindow(this._itemWindow);
    };

    // 팝업 창들 생성 (모두 addChild로 window layer 위에)
    Scene_Item.prototype.createDetailWindow = function () {
        var pw = Math.floor(Graphics.boxWidth  * 0.70);
        var ph = Math.floor(Graphics.boxHeight * 0.68);
        var px = Math.floor((Graphics.boxWidth  - pw) / 2);
        var py = Math.floor((Graphics.boxHeight - ph) / 2);
        this._detailWindow = new Window_ItemDetail(px, py, pw, ph);
        this.addChild(this._detailWindow);

        this._itemActionWindow = new Window_ItemAction();
        this.addChild(this._itemActionWindow);

        this._itemDetailFullscreen = new ItemDetailFullscreen();
        this.addChild(this._itemDetailFullscreen);
    };

    var _Scene_Item_onItemOk_orig = Scene_Item.prototype.onItemOk;
    Scene_Item.prototype.onItemOk = function () {
        var item   = this._itemWindow.item();
        var detail = item ? parseDetail(item) : null;
        if (detail) {
            this._pendingItem = item;
            this._itemWindow.deactivate();
            if ($gameParty.canUse(item)) {
                this._itemActionWindow.show();
                this._itemActionWindow.activate();
                this._itemActionWindow.select(0);
            } else {
                this._detailWindow.open(item);
            }
            return;
        }
        _Scene_Item_onItemOk_orig.call(this);
    };

    var _Scene_Item_update = Scene_Item.prototype.update;
    Scene_Item.prototype.update = function () {
        var fs = this._itemDetailFullscreen;
        var dw = this._detailWindow;
        var aw = this._itemActionWindow;

        // 전체화면 (DOM 오버레이 닫기 요청 체크)
        if (fs && fs.isOpen()) {
            if (fs._closeRequested) { fs.close(); }
            Input.clear(); TouchInput.clear();
            _Scene_Item_update.call(this);
            return;
        }

        // 상세 팝업
        if (dw && dw.visible) {
            if (Input.isTriggered('ok') || TouchInput.isTriggered()) {
                var detail = dw._detail;
                if (detail && detail.image) {
                    fs.open(dw._item, detail);
                } else {
                    SoundManager.playBuzzer();
                }
            } else if (Input.isTriggered('cancel') || TouchInput.isCancelled()) {
                SoundManager.playCancel();
                dw.hide();
                this._itemWindow.activate();
            }
            Input.clear(); TouchInput.clear();
            _Scene_Item_update.call(this);
            return;
        }

        // 사용/살펴보기 팝업
        if (aw && aw.visible) {
            if (Input.isRepeated('down')) { SoundManager.playCursor(); aw.cursorDown(Input.isTriggered('down')); }
            else if (Input.isRepeated('up')) { SoundManager.playCursor(); aw.cursorUp(Input.isTriggered('up')); }

            var awOk = Input.isTriggered('ok');
            if (!awOk) {
                var tRow = actionWindowTouchRow(aw);
                if (tRow >= 0) { aw.select(tRow); awOk = true; }
            }

            if (awOk) {
                SoundManager.playOk();
                var symbol = aw.currentSymbol();
                aw.hide(); aw.deactivate();
                if (symbol === 'use') {
                    this._itemWindow.activate();
                    _Scene_Item_onItemOk_orig.call(this);
                } else {
                    this._detailWindow.open(this._pendingItem);
                }
            } else if (Input.isTriggered('cancel') || TouchInput.isCancelled()) {
                SoundManager.playCancel();
                aw.hide(); aw.deactivate();
                this._itemWindow.activate();
            }
            Input.clear(); TouchInput.clear();
            _Scene_Item_update.call(this);
            return;
        }

        _Scene_Item_update.call(this);
    };

    var _Scene_Item_create = Scene_Item.prototype.create;
    Scene_Item.prototype.create = function () {
        _Scene_Item_create.call(this);
        this.createDetailWindow();
    };

    //=========================================================================
    // Scene_CustomUI (CustomSceneEngine) — item 씬 연동
    //=========================================================================
    if (window.Scene_CustomUI) {
        var _exec = Scene_CustomUI.prototype._executeWidgetHandler;

        var _CustomUI_create = Scene_CustomUI.prototype.create;
        Scene_CustomUI.prototype.create = function () {
            _CustomUI_create.call(this);
            if (this._sceneId === 'item') {
                var pw = Math.floor(Graphics.boxWidth  * 0.70);
                var ph = Math.floor(Graphics.boxHeight * 0.68);
                var px = Math.floor((Graphics.boxWidth  - pw) / 2);
                var py = Math.floor((Graphics.boxHeight - ph) / 2);
                this._itemDetailWindow = new Window_ItemDetail(px, py, pw, ph);
                this.addChild(this._itemDetailWindow);

                this._itemActionWindow = new Window_ItemAction();
                this.addChild(this._itemActionWindow);

                this._itemDetailFullscreen = new ItemDetailFullscreen();
                this.addChild(this._itemDetailFullscreen);
            }
        };

        var _CustomUI_update = Scene_CustomUI.prototype.update;
        Scene_CustomUI.prototype.update = function () {
            if (this._sceneId !== 'item') {
                _CustomUI_update.call(this);
                return;
            }

            var fs = this._itemDetailFullscreen;
            var dw = this._itemDetailWindow;
            var aw = this._itemActionWindow;

            // 전체화면 상태
            if (fs && fs.isOpen()) {
                if (fs._closeRequested) { fs.close(); }
                Input.clear(); TouchInput.clear();
                Scene_Base.prototype.update.call(this);
                return;
            }

            // 상세 팝업 상태
            if (dw && dw.visible) {
                if (Input.isTriggered('ok') || TouchInput.isTriggered()) {
                    var detail = dw._detail;
                    if (detail && detail.image) {
                        fs.open(dw._item, detail);
                    } else {
                        SoundManager.playBuzzer();
                    }
                } else if (Input.isTriggered('cancel') || TouchInput.isCancelled()) {
                    SoundManager.playCancel();
                    dw.hide();
                    var ilId2 = (this._pendingHandler && this._pendingHandler.itemListWidget) || 'item_list';
                    var ilW2  = this._widgetMap && this._widgetMap[ilId2];
                    if (ilW2 && ilW2.activate) ilW2.activate();
                }
                Input.clear(); TouchInput.clear();
                Scene_Base.prototype.update.call(this);
                return;
            }

            // 사용/살펴보기 팝업 상태
            if (aw && aw.visible) {
                if (Input.isRepeated('down')) { SoundManager.playCursor(); aw.cursorDown(Input.isTriggered('down')); }
                else if (Input.isRepeated('up')) { SoundManager.playCursor(); aw.cursorUp(Input.isTriggered('up')); }

                var awOk = Input.isTriggered('ok');
                if (!awOk) {
                    var tRow = actionWindowTouchRow(aw);
                    if (tRow >= 0) { aw.select(tRow); awOk = true; }
                }

                var ilId = (this._pendingHandler && this._pendingHandler.itemListWidget) || 'item_list';
                var ilW  = this._widgetMap && this._widgetMap[ilId];

                if (awOk) {
                    SoundManager.playOk();
                    var symbol = aw.currentSymbol();
                    aw.hide(); aw.deactivate();
                    if (symbol === 'use') {
                        if (ilW && ilW.activate) ilW.activate();
                        if (_exec) _exec.call(this, this._pendingHandler, this._pendingWidget);
                    } else {
                        // 살펴보기: 위젯 창에서 직접 item 가져오기
                        var item = (ilW && ilW._window) ? ilW._window.item() : null;
                        if (!item) item = this._ctx && this._ctx.selectedItem;
                        dw.open(item);
                    }
                } else if (Input.isTriggered('cancel') || TouchInput.isCancelled()) {
                    SoundManager.playCancel();
                    aw.hide(); aw.deactivate();
                    if (ilW && ilW.activate) ilW.activate();
                }
                Input.clear(); TouchInput.clear();
                Scene_Base.prototype.update.call(this);
                return;
            }

            _CustomUI_update.call(this);
        };

        // useItem 인터셉트
        if (_exec) {
            Scene_CustomUI.prototype._executeWidgetHandler = function (handler, widget) {
                if (this._sceneId === 'item') {
                    // 팝업이 열려있으면 핸들러 차단
                    if ((this._itemDetailFullscreen && this._itemDetailFullscreen.isOpen()) ||
                        (this._itemDetailWindow    && this._itemDetailWindow.visible)     ||
                        (this._itemActionWindow    && this._itemActionWindow.visible)) {
                        return;
                    }

                    if (handler && handler.action === 'useItem') {
                        // _ctx.selectedItem 대신 위젯 창에서 직접 item 가져오기 (터치 시 selectedItem이 null일 수 있음)
                        var ilId = handler.itemListWidget || 'item_list';
                        var ilW  = this._widgetMap && this._widgetMap[ilId];
                        var item = (ilW && ilW._window) ? ilW._window.item() : null;
                        if (!item) item = this._ctx && this._ctx.selectedItem;
                        var detail = item ? parseDetail(item) : null;

                        if (detail) {
                            if ($gameParty.canUse(item)) {
                                // 사용 가능: 사용/살펴보기 선택
                                this._pendingHandler = handler;
                                this._pendingWidget  = widget;
                                this._itemActionWindow.show();
                                this._itemActionWindow.activate();
                                this._itemActionWindow.select(0);
                            } else {
                                // 사용 불가: 상세 팝업 바로 표시
                                this._itemDetailWindow.open(item);
                            }
                            return;
                        }
                    }
                }
                _exec.call(this, handler, widget);
            };
        }
    }

})();
