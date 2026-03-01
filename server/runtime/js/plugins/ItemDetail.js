//=============================================================================
// ItemDetail.js
// 아이템 선택 시 우측 패널에 이미지와 상세 텍스트를 표시합니다.
//=============================================================================

/*:
 * @plugindesc v1.1 아이템 선택 시 우측 패널에 이미지와 상세 텍스트를 표시합니다.
 * @author Claude
 *
 * @param itemWindowWidthRate
 * @text 아이템창 너비 비율
 * @desc 아이템 목록창의 너비 비율 (0.30 ~ 0.90)
 * @type number
 * @decimals 2
 * @min 0.30
 * @max 0.90
 * @default 0.50
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
 *   img/pictures/ 폴더의 이미지를 표시합니다. 확장자 생략 가능.
 *   예) <detailImg: Crystal>
 *
 * <detailImgAlign: 가로, 세로>
 *   이미지 정렬 (left/center/right, top/middle/bottom)
 *   예) <detailImgAlign: center, middle>
 *
 * <detailText>
 * 텍스트 내용
 * 여러 줄 가능. \c[색번호] 등 제어문자 사용 가능.
 * </detailText>
 *
 * <detailTextAlign: 가로, 세로>
 *   텍스트 정렬 (left/center/right, top/middle/bottom)
 *   예) <detailTextAlign: left, bottom>
 *
 * ============================================================
 */

(function () {
    'use strict';

    var p = PluginManager.parameters('ItemDetail');
    var ITEM_WIDTH_RATE = parseFloat(p['itemWindowWidthRate'] || '0.5');
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

        // 신형: <detailPic>JSON</detailPic> + <detailTxt>JSON</detailTxt>
        var picM = note.match(/<detailPic>([\s\S]*?)<\/detailPic>/i);
        var txtM = note.match(/<detailTxt>([\s\S]*?)<\/detailTxt>/i);

        // 구형 호환: <detailImg: ...> + <detailText>...</detailText>
        var legacyImgM      = !picM && note.match(/<detailImg:\s*(.+?)>/i);
        var legacyImgAlignM = !picM && note.match(/<detailImgAlign:\s*(\w+)\s*,\s*(\w+)>/i);
        var legacyTextM     = !txtM && note.match(/<detailText>([\s\S]*?)<\/detailText>/i);
        var legacyTxtAlignM = !txtM && note.match(/<detailTextAlign:\s*(\w+)\s*,\s*(\w+)>/i);

        var pic = null, txt = null;

        if (picM) {
            try { pic = JSON.parse(picM[1]); } catch(e) {}
        } else if (legacyImgM) {
            pic = {
                image:     legacyImgM[1].trim(),
                origin:    0,
                scaleWidth: 100, scaleHeight: 100,
                opacity:   255, blendMode: 0,
                shaderData: null, transitionData: null,
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
            opacity:    pic ? (pic.opacity    != null ? pic.opacity    : 255) : 255,
            blendMode:  pic ? (pic.blendMode  || 0) : 0,
            text:       txt ? txt.text        : null,
            textHAlign: txt ? (txt.textHAlign || DEF_TXT_HALIGN) : DEF_TXT_HALIGN,
            textVAlign: txt ? (txt.textVAlign || DEF_TXT_VALIGN) : DEF_TXT_VALIGN
        };
    }

    //=========================================================================
    // Window_ItemDetail
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
        this.hide(); // 초기에는 숨김
    };

    Window_ItemDetail.prototype.setItem = function (item) {
        if (this._item === item) return;
        this._item   = item;
        this._detail = item ? parseDetail(item) : null;
        this.refresh();
        if (this._detail) {
            this.show();
        } else {
            this.hide();
        }
    };

    Window_ItemDetail.prototype.refresh = function () {
        this.contents.clear();
        var detail = this._detail;
        if (!detail) return;

        var cw = this.contentsWidth();
        var ch = this.contentsHeight();

        if (detail.image) {
            var bmp = ImageManager.loadPicture(detail.image);
            if (bmp.isReady()) {
                this._drawImage(bmp, detail, cw, ch);
                this._drawText(detail, cw, ch);
            } else {
                bmp.addLoadListener(function () {
                    this.contents.clear();
                    this._drawImage(bmp, detail, cw, ch);
                    this._drawText(detail, cw, ch);
                }.bind(this));
            }
        } else {
            this._drawText(detail, cw, ch);
        }
    };

    Window_ItemDetail.prototype._drawImage = function (bmp, detail, cw, ch) {
        var bw = bmp.width;
        var bh = bmp.height;
        // 창을 벗어나지 않는 최대 스케일 (확대는 하지 않음)
        var scale = Math.min(cw / bw, ch / bh, 1);
        var dw = Math.floor(bw * scale);
        var dh = Math.floor(bh * scale);

        var dx = 0;
        if (detail.imgHAlign === 'center') dx = Math.floor((cw - dw) / 2);
        else if (detail.imgHAlign === 'right') dx = cw - dw;

        var dy = 0;
        if (detail.imgVAlign === 'middle') dy = Math.floor((ch - dh) / 2);
        else if (detail.imgVAlign === 'bottom') dy = ch - dh;

        // opacity 적용 (0-255 → 0.0-1.0)
        var prevOpacity = this.contents.paintOpacity;
        this.contents.paintOpacity = (detail.opacity != null) ? detail.opacity : 255;
        this.contents.blt(bmp, 0, 0, bw, bh, dx, dy, dw, dh);
        this.contents.paintOpacity = prevOpacity;
    };

    // 제어문자를 제거한 순수 텍스트 너비 측정
    Window_ItemDetail.prototype._measureLine = function (text) {
        var plain = text.replace(/\\[A-Za-z]\[\d*\]/g, '').replace(/\\/g, '');
        return this.contents.measureTextWidth(plain);
    };

    Window_ItemDetail.prototype._drawText = function (detail, cw, ch) {
        if (!detail.text) return;

        var lines = detail.text.split('\n');
        var lh    = this.lineHeight();
        var total = lines.length * lh;
        var pad   = 6;

        var startY = pad;
        if (detail.textVAlign === 'middle') startY = Math.max(pad, Math.floor((ch - total) / 2));
        else if (detail.textVAlign === 'bottom') startY = Math.max(pad, ch - total - pad);

        // 이미지가 있을 때 텍스트 영역 반투명 배경
        if (TEXT_BG && detail.image) {
            this.contents.fillRect(0, startY - 2, cw, total + 4, 'rgba(0,0,0,0.55)');
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var y    = startY + i * lh;
            var tw   = this._measureLine(line);

            var x = pad;
            if (detail.textHAlign === 'center') x = Math.floor((cw - tw) / 2);
            else if (detail.textHAlign === 'right') x = cw - tw - pad;

            this.drawTextEx(line, x, y);
        }
    };

    //=========================================================================
    // ItemDetailFullscreen — 전체화면 이미지 뷰어
    //=========================================================================
    function ItemDetailFullscreen() {
        this.initialize.apply(this, arguments);
    }

    ItemDetailFullscreen.prototype = Object.create(Sprite.prototype);
    ItemDetailFullscreen.prototype.constructor = ItemDetailFullscreen;

    ItemDetailFullscreen.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this._isOpen = false;

        // 검은 반투명 배경
        var bgBmp = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
        bgBmp.fillAll('#000000');
        this._bgSprite = new Sprite(bgBmp);
        this._bgSprite.opacity = 218; // ~85%
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
        this._isOpen = true;
        this.visible = true;

        var self = this;
        var bmp = ImageManager.loadPicture(detail.image);

        function applyBmp() {
            if (!self._isOpen) return;
            self._imgSprite.bitmap = bmp;
            var sw = Graphics.boxWidth;
            var sh = Graphics.boxHeight;
            var scale = Math.min(sw / bmp.width, sh / bmp.height, 1);
            var dw = Math.floor(bmp.width  * scale);
            var dh = Math.floor(bmp.height * scale);
            self._imgSprite.x = Math.floor((sw - dw) / 2);
            self._imgSprite.y = Math.floor((sh - dh) / 2);
            self._imgSprite.scale.x = scale;
            self._imgSprite.scale.y = scale;
        }

        if (bmp.isReady()) {
            applyBmp();
        } else {
            bmp.addLoadListener(applyBmp);
        }
    };

    ItemDetailFullscreen.prototype.close = function () {
        this._isOpen = false;
        this.visible = false;
        this._imgSprite.bitmap = null;
    };

    //=========================================================================
    // Window_ItemList — 상세창 연동 (Scene_Item 기본 씬용)
    //=========================================================================
    Window_ItemList.prototype.setDetailWindow = function (win) {
        this._detailWindow = win;
        this.callUpdateHelp();
    };

    var _ItemList_callUpdateHelp = Window_ItemList.prototype.callUpdateHelp;
    Window_ItemList.prototype.callUpdateHelp = function () {
        _ItemList_callUpdateHelp.call(this);
        if (this._detailWindow) {
            this._detailWindow.setItem(this.item());
        }
    };

    //=========================================================================
    // Scene_Item — 레이아웃 재구성 (기본 MV 씬용)
    //=========================================================================

    Scene_Item.prototype.createItemWindow = function () {
        var wy = this._categoryWindow.y + this._categoryWindow.height;
        var wh = Graphics.boxHeight - wy;
        var ww = Math.floor(Graphics.boxWidth * ITEM_WIDTH_RATE);
        this._itemWindow = new Window_ItemList(0, wy, ww, wh);
        this._itemWindow.setHelpWindow(this._helpWindow);
        this._itemWindow.setHandler('ok',     this.onItemOk.bind(this));
        this._itemWindow.setHandler('cancel', this.onItemCancel.bind(this));
        this._categoryWindow.setItemWindow(this._itemWindow);
        this.addWindow(this._itemWindow);
    };

    Scene_Item.prototype.createDetailWindow = function () {
        var wy = this._categoryWindow.y + this._categoryWindow.height;
        var wx = Math.floor(Graphics.boxWidth * ITEM_WIDTH_RATE);
        var ww = Graphics.boxWidth - wx;
        var wh = Graphics.boxHeight - wy;
        this._detailWindow = new Window_ItemDetail(wx, wy, ww, wh);
        this._itemWindow.setDetailWindow(this._detailWindow);
        this.addWindow(this._detailWindow);
        // 전체화면 뷰어 (맨 위에 추가)
        this._itemDetailFullscreen = new ItemDetailFullscreen();
        this.addChild(this._itemDetailFullscreen);
    };

    // 카테고리로 돌아갈 때 상세창 숨기기
    var _Scene_Item_onItemCancel = Scene_Item.prototype.onItemCancel;
    Scene_Item.prototype.onItemCancel = function () {
        _Scene_Item_onItemCancel.call(this);
        if (this._detailWindow) this._detailWindow.hide();
    };

    // ok 시 사용 불가 아이템 + 이미지 있으면 전체화면 표시
    var _Scene_Item_onItemOk = Scene_Item.prototype.onItemOk;
    Scene_Item.prototype.onItemOk = function () {
        var item   = this._itemWindow.item();
        var detail = item ? parseDetail(item) : null;
        if (detail && detail.image && !$gameParty.canUse(item) && this._itemDetailFullscreen) {
            this._itemDetailFullscreen.open(item, detail);
            this._itemWindow.deactivate();
            return;
        }
        _Scene_Item_onItemOk.call(this);
    };

    // 전체화면 열림 시 입력 차단 + 닫기 처리
    var _Scene_Item_update = Scene_Item.prototype.update;
    Scene_Item.prototype.update = function () {
        if (this._itemDetailFullscreen && this._itemDetailFullscreen.isOpen()) {
            if ((Input._latestButton && Input._pressedTime === 1) || TouchInput.isTriggered()) {
                this._itemDetailFullscreen.close();
                this._itemWindow.activate();
            }
            Input.clear();
            TouchInput.clear();
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
        var _CustomUI_create = Scene_CustomUI.prototype.create;
        Scene_CustomUI.prototype.create = function () {
            _CustomUI_create.call(this);
            if (this._sceneId === 'item') {
                var wy = 144; // category(72) + help(72) = 144
                var wx = Math.floor(Graphics.boxWidth * ITEM_WIDTH_RATE);
                var ww = Graphics.boxWidth - wx;
                var wh = Graphics.boxHeight - wy;
                this._itemDetailWindow = new Window_ItemDetail(wx, wy, ww, wh);
                this.addWindow(this._itemDetailWindow);
                // 전체화면 뷰어 (맨 위에 추가)
                this._itemDetailFullscreen = new ItemDetailFullscreen();
                this.addChild(this._itemDetailFullscreen);
            }
        };

        var _CustomUI_update = Scene_CustomUI.prototype.update;
        Scene_CustomUI.prototype.update = function () {
            // 전체화면 열림 시 입력 차단 + 닫기 처리
            if (this._sceneId === 'item' && this._itemDetailFullscreen && this._itemDetailFullscreen.isOpen()) {
                if ((Input._latestButton && Input._pressedTime === 1) || TouchInput.isTriggered()) {
                    this._itemDetailFullscreen.close();
                }
                Input.clear();
                TouchInput.clear();
                _CustomUI_update.call(this);
                return;
            }

            _CustomUI_update.call(this);

            // 상세창 표시/숨김 — 포커스 상태 기반
            if (this._sceneId === 'item' && this._itemDetailWindow && this._ctx) {
                var nav = this._navManager;
                var activeWidget = nav && nav._activeIndex >= 0 ? nav._focusables[nav._activeIndex] : null;
                var isItemListFocused = activeWidget && activeWidget._id === 'item_list';

                if (!isItemListFocused) {
                    // 카테고리나 다른 위젯 포커스 시 숨김
                    this._itemDetailWindow.hide();
                    this._itemDetailWindow._item = null; // 재포커스 시 재평가 강제
                } else {
                    this._itemDetailWindow.setItem(this._ctx.selectedItem || null);
                }
            }
        };

        // useItem 인터셉트 — 사용 불가 아이템 + 이미지 있으면 전체화면 표시
        if (Scene_CustomUI.prototype._executeWidgetHandler) {
            var _exec = Scene_CustomUI.prototype._executeWidgetHandler;
            Scene_CustomUI.prototype._executeWidgetHandler = function (handler, widget) {
                if (this._sceneId === 'item' && this._itemDetailFullscreen) {
                    // 전체화면이 열려있으면 핸들러 차단
                    if (this._itemDetailFullscreen.isOpen()) return;

                    // useItem 인터셉트
                    if (handler && handler.action === 'useItem') {
                        var item = this._ctx && this._ctx.selectedItem;
                        if (item && !$gameParty.canUse(item)) {
                            var detail = parseDetail(item);
                            if (detail && detail.image) {
                                this._itemDetailFullscreen.open(item, detail);
                                return;
                            }
                        }
                    }
                }
                _exec.call(this, handler, widget);
            };
        }
    }

})();
