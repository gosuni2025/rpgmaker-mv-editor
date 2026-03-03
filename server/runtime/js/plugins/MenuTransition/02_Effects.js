    // ── PostProcess 유틸 ──────────────────────────────────────────────────────

    function _hasPostProcess() {
        return typeof PostProcess !== 'undefined' && !!PostProcess.clearTransitionEffects;
    }

    function _clearEffect() {
        if (_hasPostProcess()) PostProcess.clearTransitionEffects();
    }

    // ── Bloom 비활성화 훅 (메뉴 씬 중) ───────────────────────────────────────

    function _setMenuBgHook(active) {
        if (typeof PostProcess === 'undefined') return;
        PostProcess.menuBgHook = active ? {
            preRender: function () {
                if (PostProcess._bloomPass) {
                    PostProcess._bloomPass._mt_was = PostProcess._bloomPass.enabled;
                    PostProcess._bloomPass.enabled = false;
                }
            },
            postRender: function () {
                if (PostProcess._bloomPass && '_mt_was' in PostProcess._bloomPass) {
                    PostProcess._bloomPass.enabled = PostProcess._bloomPass._mt_was;
                    delete PostProcess._bloomPass._mt_was;
                }
            }
        } : null;
    }

    // ── CSS filter 문자열 생성 (단일 파라미터 효과) ───────────────────────────

    function _canvasFilter(t) {
        if (t <= 0.001) return '';
        switch (Cfg.transitionEffect) {
            case 'blur':
                return 'blur(' + (t * (Cfg.blur_amount / 100) * 20).toFixed(1) + 'px)';
            case 'desaturation':
                return 'saturate(' + ((1 - t * (Cfg.desaturation_amount / 100)) * 100).toFixed(1) + '%)';
            case 'sepia':
                return 'sepia(' + (t * (Cfg.sepia_amount / 100) * 100).toFixed(1) + '%)';
            case 'brightness':
                return 'brightness(' + (100 + t * (Cfg.brightness_amount / 100) * 300).toFixed(1) + '%)';
            case 'darkness':
                return 'brightness(' + ((1 - t * (Cfg.darkness_amount / 100) * 0.9) * 100).toFixed(1) + '%)';
            case 'contrast':
                return 'contrast(' + (100 + t * (Cfg.contrast_amount / 100) * 400).toFixed(1) + '%)';
            case 'hue':
                return 'hue-rotate(' + (t * (Cfg.hue_amount / 100) * 360).toFixed(1) + 'deg)';
            case 'invert':
                return 'invert(' + (t * (Cfg.invert_amount / 100) * 100).toFixed(1) + '%)';
            default:
                return '';
        }
    }

    // ── 특수 효과: 픽셀화 ─────────────────────────────────────────────────────

    function _drawPixelation(ctx, w, h, t) {
        var maxBlock  = Math.max(2, Math.round((Cfg.pixelation_amount / 100) * 50));
        var blockSize = Math.max(1, Math.round(t * maxBlock));
        var sw = Math.max(1, Math.floor(w / blockSize));
        var sh = Math.max(1, Math.floor(h / blockSize));
        var small = document.createElement('canvas');
        small.width = sw; small.height = sh;
        var sctx = small.getContext('2d');
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(_srcCanvas, 0, 0, sw, sh);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
    }

    // ── 특수 효과: 줌 인 ─────────────────────────────────────────────────────

    function _drawZoom(ctx, w, h, t) {
        var scale = 1 + t * (Cfg.zoom_amount / 100) * 0.6;
        var dx = (w * (1 - scale)) / 2;
        var dy = (h * (1 - scale)) / 2;
        ctx.drawImage(_srcCanvas, dx, dy, w * scale, h * scale);
    }

    // ── 특수 효과: 줌 블러 ────────────────────────────────────────────────────

    function _drawZoomBlur(ctx, w, h, t) {
        var blurPx = t * (Cfg.zoomBlur_amount / 100) * 20;
        var scale  = 1 + t * (Cfg.zoomBlur_zoom  / 100) * 0.3;
        var dx = (w * (1 - scale)) / 2;
        var dy = (h * (1 - scale)) / 2;
        if (blurPx > 0.1) ctx.filter = 'blur(' + blurPx.toFixed(1) + 'px)';
        ctx.drawImage(_srcCanvas, dx, dy, w * scale, h * scale);
        if (blurPx > 0.1) ctx.filter = 'none';
    }

    // ── 특수 효과: 색수차 ─────────────────────────────────────────────────────

    function _drawChromatic(ctx, w, h, t) {
        var offset  = Math.round(t * (Cfg.chromatic_offset / 100) * 28);
        var chAlpha = t * (Cfg.chromatic_alpha / 100) * 0.6;

        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        if (offset < 1) return;

        var offR = document.createElement('canvas');
        offR.width = w; offR.height = h;
        var ctxR = offR.getContext('2d');
        ctxR.drawImage(_srcCanvas, 0, 0, w, h);
        ctxR.globalCompositeOperation = 'multiply';
        ctxR.fillStyle = '#ff0000';
        ctxR.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = chAlpha;
        ctx.drawImage(offR, -offset, 0, w, h);

        var offB = document.createElement('canvas');
        offB.width = w; offB.height = h;
        var ctxB = offB.getContext('2d');
        ctxB.drawImage(_srcCanvas, 0, 0, w, h);
        ctxB.globalCompositeOperation = 'multiply';
        ctxB.fillStyle = '#0000ff';
        ctxB.fillRect(0, 0, w, h);
        ctx.drawImage(offB, offset, 0, w, h);

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    // ── 특수 효과: 비네트 ─────────────────────────────────────────────────────

    function _drawVignette(ctx, w, h, t) {
        ctx.drawImage(_srcCanvas, 0, 0, w, h);

        var amt   = Cfg.vignette_amount / 100;
        var range = Cfg.vignette_range  / 100;  // 0=넓게, 1=좁게
        var cx    = w / 2, cy = h / 2;
        var maxR  = Math.sqrt(cx * cx + cy * cy);
        var inner = maxR * Math.max(0.01, 1 - t * amt * (0.5 + range * 0.5));
        var dark  = Math.min(0.99, t * amt * 1.2);
        var grad  = ctx.createRadialGradient(cx, cy, inner, cx, cy, maxR);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,' + dark.toFixed(2) + ')');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    // ── 특수 효과: 스캔라인 ───────────────────────────────────────────────────

    function _drawScanline(ctx, w, h, t) {
        var satDrop = t * (Cfg.scanline_desaturation / 100) * 0.8;
        if (satDrop > 0.001) ctx.filter = 'saturate(' + ((1 - satDrop) * 100).toFixed(1) + '%)';
        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        if (satDrop > 0.001) ctx.filter = 'none';

        ctx.globalAlpha = t * (Cfg.scanline_opacity / 100) * 0.7;
        ctx.fillStyle = '#000000';
        for (var y = 0; y < h; y += 2) {
            ctx.fillRect(0, y, w, 1);
        }
        ctx.globalAlpha = 1;
    }

    // ── 배경 비트맵 그리기 ────────────────────────────────────────────────────

    function _drawBgBitmap(bitmap, blurT) {
        if (!_srcCanvas || !bitmap) return;
        var w = bitmap.width, h = bitmap.height;
        if (w <= 0 || h <= 0) return;

        var ctx  = bitmap._context;
        var type = Cfg.transitionEffect || 'blur';
        ctx.clearRect(0, 0, w, h);

        switch (type) {
            case 'pixelation': _drawPixelation(ctx, w, h, blurT); break;
            case 'zoom':       _drawZoom(ctx, w, h, blurT);       break;
            case 'zoomBlur':   _drawZoomBlur(ctx, w, h, blurT);   break;
            case 'chromatic':  _drawChromatic(ctx, w, h, blurT);  break;
            case 'vignette':   _drawVignette(ctx, w, h, blurT);   break;
            case 'scanline':   _drawScanline(ctx, w, h, blurT);   break;
            default: {
                var filter = _canvasFilter(blurT);
                if (filter) ctx.filter = filter;
                ctx.drawImage(_srcCanvas, 0, 0, w, h);
                if (filter) ctx.filter = 'none';
            }
        }

        // 오버레이
        if (Cfg.overlayAlpha > 0) {
            var alpha = (Cfg.overlayAlpha / 255) * blurT;
            if (alpha > 0.001) {
                ctx.fillStyle = 'rgba(' + _overlayRGB[0] + ',' + _overlayRGB[1] + ',' +
                                _overlayRGB[2] + ',' + alpha.toFixed(3) + ')';
                ctx.fillRect(0, 0, w, h);
            }
        }

        bitmap._setDirty();
    }

