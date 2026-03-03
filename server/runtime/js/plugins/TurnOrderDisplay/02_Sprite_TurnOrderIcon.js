    //=========================================================================
    // Sprite_TurnOrderIcon
    //=========================================================================
    function Sprite_TurnOrderIcon() {
        this.initialize.apply(this, arguments);
    }
    Sprite_TurnOrderIcon.prototype = Object.create(Sprite.prototype);
    Sprite_TurnOrderIcon.prototype.constructor = Sprite_TurnOrderIcon;

    Sprite_TurnOrderIcon.prototype.initialize = function (battler) {
        Sprite.prototype.initialize.call(this);
        this._battler   = battler;
        this._status    = 'pending';
        this._imgReady  = false;
        this._shapeKey  = '';
        this._targetX   = null;
        this._targetY   = null;
        this._isNew     = true;
        this._exiting   = false;
        this._exitDone  = false;
        this.anchor.x   = 0.5;
        this.anchor.y   = 0.5;

        var size = Config.iconSize;
        this.bitmap = new Bitmap(size, size);

        if (battler.isActor()) {
            this._srcBitmap = ImageManager.loadFace(battler.faceName());
        } else {
            this._srcBitmap = ImageManager.loadEnemy(
                battler.enemy().battlerName,
                battler.enemy().battlerHue
            );
        }
    };

    Sprite_TurnOrderIcon.prototype.update = function () {
        Sprite.prototype.update.call(this);

        if (!this._imgReady && this._srcBitmap.isReady()) {
            this._imgReady = true;
            this._redraw();
        }
        if (this._imgReady && this._shapeKey !== Config.clipShape) {
            this._shapeKey = Config.clipShape;
            this._redraw();
        }

        // 위치 lerp
        if (this._targetX !== null) {
            var dx = this._targetX - this.x;
            var dy = this._targetY - this.y;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                this.x += dx * 0.22;
                this.y += dy * 0.22;
            } else {
                this.x = this._targetX;
                this.y = this._targetY;
            }
        }

        // opacity
        if (this._exiting) {
            this.opacity -= 16;
            if (this.opacity <= 0) { this.opacity = 0; this._exitDone = true; }
        } else {
            var targetOp = this._status === 'done' ? 160 : 255;
            var diff = targetOp - this.opacity;
            if (Math.abs(diff) > 3) {
                this.opacity += Math.sign(diff) * Math.max(6, Math.abs(diff) * 0.18);
            } else {
                this.opacity = targetOp;
            }
        }
    };

    Sprite_TurnOrderIcon.prototype.setStatus = function (status) {
        if (this._status === status) return;
        this._status = status;
        if (this._imgReady) this._redraw();
    };

    Sprite_TurnOrderIcon.prototype.startExit = function (isH) {
        if (this._exiting) return;
        this._exiting = true;
        var dist = Config.iconSize * 1.5;
        if (this._targetX !== null) {
            this._targetX = isH ? this._targetX - dist : this._targetX;
            this._targetY = isH ? this._targetY : this._targetY - dist;
        }
    };

    Sprite_TurnOrderIcon.prototype._redraw = function () {
        var size  = Config.iconSize;
        var shape = Config.clipShape;
        var bmp   = this.bitmap;
        var ctx   = bmp._context;
        var src   = this._srcBitmap;

        if (bmp.width !== size || bmp.height !== size) {
            this.bitmap = new Bitmap(size, size);
            bmp = this.bitmap;
            ctx = bmp._context;
        }

        ctx.clearRect(0, 0, size, size);

        var isActor = this._battler.isActor();
        ctx.save();
        applyClipPath(ctx, size, shape);
        ctx.clip();

        var bg1  = isActor ? '#1a2a4a' : '#3a1a1a';
        var bg2  = isActor ? '#0d1828' : '#280d0d';
        var grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, bg1); grad.addColorStop(1, bg2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        if (isActor) {
            var fi   = this._battler.faceIndex();
            var fx   = (fi % 4) * 96;
            var fy   = Math.floor(fi / 4) * 96;
            var zoom = Config.faceZoom;
            var dw   = size * zoom, dh = size * zoom;
            ctx.drawImage(src._canvas, fx, fy, 96, 96, (size-dw)/2, (size-dh)/2, dw, dh);
        } else {
            var sw  = src.width, sh  = src.height;
            var fit = Math.min((size * 0.9) / sw, (size * 0.9) / sh);
            var dw2 = sw * fit, dh2 = sh * fit;
            ctx.drawImage(src._canvas, 0, 0, sw, sh,
                (size-dw2)/2, (size-dh2)/2, dw2, dh2);
        }
        ctx.restore();

        // done 상태: 어두운 반투명 오버레이
        if (this._status === 'done') {
            ctx.save();
            applyClipPath(ctx, size, shape);
            ctx.clip();
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, 0, size, size);
            ctx.restore();
        }

        var bc, bw;
        switch (this._status) {
            case 'active': bc = '#ffdd44';                bw = 3;   break;
            case 'done':   bc = 'rgba(150,150,150,0.5)';  bw = 1.5; break;
            case 'next':   bc = 'rgba(120,180,255,0.5)';  bw = 1.5; break;
            default:       bc = 'rgba(255,255,255,0.65)'; bw = 2;
        }
        ctx.save();
        applyClipPath(ctx, size, shape);
        ctx.strokeStyle = bc; ctx.lineWidth = bw; ctx.stroke();
        if (this._status === 'active') {
            ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,220,50,0.28)'; ctx.stroke();
        }
        ctx.restore();
        bmp._setDirty();
    };

