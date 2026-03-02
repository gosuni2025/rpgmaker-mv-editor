//=============================================================================
// ItemDetail.js
// 아이템 선택 시 중앙 팝업으로 이미지와 상세 텍스트를 표시합니다.
//=============================================================================

/*:
 * @plugindesc v2.0 아이템 결정 키/터치 시 중앙 팝업으로 상세 이미지와 텍스트를 표시합니다.
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
    // Scene_CustomUI (CustomSceneEngine) — item 씬 연동
    // 팝업을 CSE Widget 트리로 구성하여 NavManager에 통합
    //=========================================================================
    if (window.Scene_CustomUI) {
        var _exec_orig = Scene_CustomUI.prototype._executeWidgetHandler;

        var _CustomUI_create_orig = Scene_CustomUI.prototype.create;
        Scene_CustomUI.prototype.create = function () {
            _CustomUI_create_orig.call(this);
            if (this._sceneId !== 'item') return;

            var self = this;
            var bw = Graphics.boxWidth, bh = Graphics.boxHeight;
            var pad = 18;

            // 팝업 크기/위치
            // id_popup (이미지/텍스트) + id_popup_ctrl (자세히 보기/닫기) 를 합산해 화면 중앙 배치
            var pw     = Math.floor(bw * 0.92);
            var ctrlH  = 36 + pad * 2;                             // fittingHeight(1) — 1행 2열
            var maxTH  = Math.floor(bh * 0.92);
            var ph     = maxTH - ctrlH;
            var totalH = ph + ctrlH;
            var px     = Math.floor((bw - pw) / 2);
            var py     = Math.floor((bh - totalH) / 2);
            var innerW = pw - pad * 2;
            var imgH   = ph - pad * 2;
            var imgW   = Math.floor(innerW / 2);

            // 액션 위젯 (사용/살펴보기)
            var aW = 240, aH = 36 * 2 + pad * 2;
            var actionDef = {
                type: 'textList', id: 'id_action', visible: false,
                x: Math.floor((bw - aW) / 2), y: Math.floor((bh - aH) / 2),
                width: aW, height: aH,
                items: [
                    { text: '사용',     symbol: 'use'     },
                    { text: '살펴보기',  symbol: 'inspect' }
                ],
                handlers: {
                    ok: {
                        action: 'script',
                        code: [
                            'var aw=this._widgetMap["id_action"];',
                            'var sym=aw&&aw._window?aw._window.currentSymbol():null;',
                            'aw.displayObject().visible=false;',
                            'if(sym==="use"){',
                            '  this._execPendingUse();',
                            '}else{',
                            '  this._showDetailPopup();',
                            '  if(this._navManager)this._navManager.focusWidget("id_popup_ctrl");',
                            '}'
                        ].join('')
                    },
                    cancel: {
                        action: 'script',
                        code: 'this._widgetMap["id_action"].displayObject().visible=false;',
                        thenAction: { action: 'focusWidget', target: 'item_list' }
                    }
                }
            };

            // 상세 팝업 패널 (이미지 + 텍스트)
            var popupDef = {
                type: 'panel', id: 'id_popup', visible: false,
                x: px, y: py, width: pw, height: ph,
                windowed: true,
                children: [
                    // 이미지 (왼쪽 절반)
                    {
                        type: 'image', id: 'id_popup_img',
                        x: pad, y: pad,
                        width: imgW, height: imgH,
                        bitmapExpr: '$ctx._detailD&&$ctx._detailD.image?ImageManager.loadPicture($ctx._detailD.image):null',
                        fitMode: 'contain'
                    },
                    // 텍스트 (오른쪽 절반)
                    {
                        type: 'textArea', id: 'id_popup_text',
                        x: pad + imgW + 4, y: pad,
                        width: innerW - imgW - 4, height: imgH,
                        text: '{$ctx._detailD&&$ctx._detailD.text||""}'
                    }
                ]
            };

            // 팝업 버튼 (자세히 보기 / 닫기) — 팝업 패널 바로 아래
            var popupCtrlDef = {
                type: 'textList', id: 'id_popup_ctrl', visible: false,
                x: px, y: py + ph,
                width: pw, height: ctrlH,
                maxCols: 2,
                items: [
                    { text: '자세히 보기', symbol: 'view'  },
                    { text: '닫기',        symbol: 'close' }
                ],
                handlers: {
                    ok: {
                        action: 'script',
                        code: [
                            'var w=this._widgetMap["id_popup_ctrl"];',
                            'var sym=w&&w._window?w._window.currentSymbol():null;',
                            'if(sym==="view"){',
                            '  var d=this._ctx._detailD;',
                            '  if(d&&d.image){SoundManager.playOk();this._showFullscreen();if(this._navManager)this._navManager.focusWidget("id_full_ctrl");}',
                            '  else SoundManager.playBuzzer();',
                            '}else{',
                            '  this._hideDetailPopup();',
                            '  if(this._navManager)this._navManager.focusWidget("item_list");',
                            '}'
                        ].join('')
                    },
                    cancel: {
                        action: 'script',
                        code: 'this._hideDetailPopup();',
                        thenAction: { action: 'focusWidget', target: 'item_list' }
                    }
                }
            };

            // 전체화면 패널 (검정 배경 + 이미지)
            var fullscreenDef = {
                type: 'panel', id: 'id_fullscreen', visible: false,
                x: 0, y: 0, width: bw, height: bh,
                windowed: false,
                bgAlpha: 0.9,
                children: [
                    {
                        type: 'image', id: 'id_full_img',
                        x: 0, y: 0, width: bw, height: bh,
                        bitmapExpr: '$ctx._detailD&&$ctx._detailD.image?ImageManager.loadPicture($ctx._detailD.image):null',
                        fitMode: 'contain'
                    }
                ]
            };

            // 전체화면 컨트롤 위젯 (cancel 수신용 — 화면 밖 투명 창)
            var fullCtrlDef = {
                type: 'textList', id: 'id_full_ctrl', visible: false,
                x: 0, y: -100, width: bw, height: 1,
                items: [],
                bgAlpha: 0,
                handlers: {
                    cancel: {
                        action: 'script',
                        code: 'SoundManager.playCancel();this._hideFullscreen();',
                        thenAction: { action: 'focusWidget', target: 'id_popup_ctrl' }
                    }
                }
            };

            // ── 위젯 빌드 및 씬 등록 ──
            [actionDef, popupDef, popupCtrlDef, fullscreenDef, fullCtrlDef].forEach(function(def) {
                var widget = self._buildWidget(def, null);
                if (!widget) return;

                // _widgetMap 등록
                function regTree(w) {
                    if (w._id) self._widgetMap[w._id] = w;
                    w._children.forEach(function(c) { regTree(c); });
                }
                regTree(widget);

                // 루트 위젯 씬에 추가
                var rootObj = widget.displayObject();
                if (rootObj) {
                    if (rootObj instanceof Window_Base) self.addWindow(rootObj);
                    else self.addChild(rootObj);
                }
                // Window_Base 자식들 addWindow
                function addWin(w) {
                    w._children.forEach(function(child) {
                        var obj = child.displayObject();
                        if (obj && obj instanceof Window_Base) self.addWindow(obj);
                        addWin(child);
                    });
                }
                addWin(widget);

                // 핸들러 등록
                self._setupWidgetHandlers(widget);

                // NavManager focusable 추가
                if (self._navManager) {
                    var focs = [];
                    widget.collectFocusable(focs);
                    focs.forEach(function(fw) {
                        if (self._navManager._focusables.indexOf(fw) === -1) {
                            self._navManager._focusables.push(fw);
                        }
                    });
                }
            });

            // ── 씬 헬퍼 메서드 ──
            this._showDetailPopup = function() {
                var pp = self._widgetMap['id_popup'];
                var pc = self._widgetMap['id_popup_ctrl'];
                if (pp) pp.displayObject().visible = true;
                if (pc) pc.displayObject().visible = true;
                // 이미지/텍스트 최신화
                var img = self._widgetMap['id_popup_img'];
                if (img && img.refresh) img.refresh();
            };
            this._hideDetailPopup = function() {
                var pp = self._widgetMap['id_popup'];
                var pc = self._widgetMap['id_popup_ctrl'];
                if (pp) pp.displayObject().visible = false;
                if (pc) pc.displayObject().visible = false;
            };
            this._showFullscreen = function() {
                var fp = self._widgetMap['id_fullscreen'];
                var fc = self._widgetMap['id_full_ctrl'];
                if (fp) fp.displayObject().visible = true;
                if (fc) fc.displayObject().visible = true;
                var img = self._widgetMap['id_full_img'];
                if (img && img.refresh) img.refresh();
            };
            this._hideFullscreen = function() {
                var fp = self._widgetMap['id_fullscreen'];
                var fc = self._widgetMap['id_full_ctrl'];
                if (fp) fp.displayObject().visible = false;
                if (fc) fc.displayObject().visible = false;
            };
            this._execPendingUse = function() {
                var h = self._pendingUseHandler;
                var w = self._pendingUseWidget;
                self._pendingUseHandler = null;
                self._pendingUseWidget  = null;
                if (h) _exec_orig.call(self, h, w);
            };
        };

        // ── useItem 인터셉트 ──
        if (_exec_orig) {
            Scene_CustomUI.prototype._executeWidgetHandler = function (handler, widget) {
                if (this._sceneId === 'item' && handler && handler.action === 'useItem') {
                    var ilId = handler.itemListWidget || 'item_list';
                    var ilW  = this._widgetMap && this._widgetMap[ilId];
                    var item = (ilW && ilW._window) ? ilW._window.item() : null;
                    if (!item) item = this._ctx && this._ctx.selectedItem;
                    var detail = item ? parseDetail(item) : null;

                    if (detail) {
                        this._ctx._detailD = detail;
                        if ($gameParty.canUse(item)) {
                            this._pendingUseHandler = handler;
                            this._pendingUseWidget  = widget;
                            var aw = this._widgetMap['id_action'];
                            if (aw) {
                                aw.displayObject().visible = true;
                                if (this._navManager) this._navManager.focusWidget('id_action');
                            }
                        } else {
                            if (this._showDetailPopup) this._showDetailPopup();
                            if (this._navManager) this._navManager.focusWidget('id_popup_ctrl');
                        }
                        return;
                    }
                }
                _exec_orig.call(this, handler, widget);
            };
        }
    }

})();
