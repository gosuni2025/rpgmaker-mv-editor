    //=========================================================================
    // 유틸
    //=========================================================================
    function applyClipPath(ctx, size, shape) {
        var r, h;
        ctx.beginPath();
        switch (shape) {
            case 'circle':
                ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
                break;
            case 'square':
                ctx.rect(0, 0, size, size);
                break;
            case 'roundRect':
                r = Math.round(size * 0.18);
                ctx.moveTo(r, 0);
                ctx.lineTo(size - r, 0); ctx.quadraticCurveTo(size, 0,    size, r);
                ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size);
                ctx.lineTo(r, size);     ctx.quadraticCurveTo(0,    size, 0,    size - r);
                ctx.lineTo(0, r);        ctx.quadraticCurveTo(0,    0,    r,    0);
                ctx.closePath();
                break;
            case 'diamond':
                h = size / 2;
                ctx.moveTo(h, 0); ctx.lineTo(size, h);
                ctx.lineTo(h, size); ctx.lineTo(0, h);
                ctx.closePath();
                break;
            default:
                ctx.rect(0, 0, size, size);
        }
    }

    function withAlpha(color, alpha) {
        var a = alpha.toFixed(2);
        if (color[0] === '#') {
            var hex = color.slice(1);
            if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
            var r = parseInt(hex.substr(0, 2), 16);
            var g = parseInt(hex.substr(2, 2), 16);
            var b = parseInt(hex.substr(4, 2), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        }
        return color.replace(/[\d.]+\)$/, a + ')');
    }

