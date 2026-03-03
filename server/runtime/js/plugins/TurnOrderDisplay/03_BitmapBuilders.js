    //=========================================================================
    // 유틸: 구분선 / 인디케이터 비트맵
    //=========================================================================
    function buildDividerBitmap(isH, iconSize, lineW, color) {
        var bmp, ctx;
        if (isH) {
            bmp = new Bitmap(lineW + 8, iconSize); ctx = bmp._context;
            ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo((lineW+8)/2, 4); ctx.lineTo((lineW+8)/2, iconSize-4); ctx.stroke();
        } else {
            bmp = new Bitmap(iconSize, lineW + 8); ctx = bmp._context;
            ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(4, (lineW+8)/2); ctx.lineTo(iconSize-4, (lineW+8)/2); ctx.stroke();
        }
        bmp._setDirty();
        return bmp;
    }

    function buildIndicatorBitmap(style, color, iconSize, isH) {
        var sz  = Math.round(iconSize * 0.3);
        var bmp = new Bitmap(sz, sz);
        var ctx = bmp._context;
        ctx.fillStyle = color;
        ctx.beginPath();
        switch (style) {
            case 'triangle':
                if (isH) { ctx.moveTo(0,0); ctx.lineTo(sz,0); ctx.lineTo(sz/2,sz); }
                else     { ctx.moveTo(0,0); ctx.lineTo(sz,sz/2); ctx.lineTo(0,sz); }
                ctx.closePath(); ctx.fill(); break;
            case 'dot':
                ctx.arc(sz/2, sz/2, sz/2, 0, Math.PI*2); ctx.fill(); break;
            case 'bar':
                if (isH) ctx.fillRect(0, Math.round(sz*0.55), sz, Math.round(sz*0.4));
                else     ctx.fillRect(Math.round(sz*0.55), 0, Math.round(sz*0.4), sz);
                break;
        }
        bmp._setDirty();
        return bmp;
    }

