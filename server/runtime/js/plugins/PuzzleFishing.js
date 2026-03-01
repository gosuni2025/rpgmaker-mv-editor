/*:
 * @plugindesc 낚시 미니게임
 * @author Claude
 * @help
 * 플러그인 커맨드:
 *   PUZZLE_FISHING_START switchId  — 낚시 시작 (switchId: 성공 시 ON할 스위치)
 */

(function() {
    'use strict';

    // ==========================================
    // Scene_Fishing
    // ==========================================
    function Scene_Fishing() { this.initialize.apply(this, arguments); }
    Scene_Fishing.prototype = Object.create(Scene_Base.prototype);
    Scene_Fishing.prototype.constructor = Scene_Fishing;

    Scene_Fishing.prototype.initialize = function() {
        Scene_Base.prototype.initialize.call(this);
        this._switchId = 0;
    };

    Scene_Fishing.prototype.prepare = function(switchId) {
        this._switchId = switchId;
    };

    Scene_Fishing.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this._createBitmap();
        this._initGame();
    };

    Scene_Fishing.prototype._createBitmap = function() {
        this._bitmap = new Bitmap(Graphics.width, Graphics.height);
        var sprite = new Sprite(this._bitmap);
        this.addChild(sprite);
        this._sprite = sprite;
    };

    Scene_Fishing.prototype._initGame = function() {
        var barH = 400;
        this._barH = barH;
        this._barX = (Graphics.width - 80) / 2;
        this._barY = (Graphics.height - barH) / 2 + 20;
        // 목표 구간 (초록 박스)
        this._targetH = 100;
        this._targetY = Math.floor(Math.random() * (barH - this._targetH));
        // 인디케이터 (흰 박스)
        this._indH = 40;
        this._indY = 0;
        this._indSpeed = 2.0;
        this._indDir = 1;
        // 상태
        this._state = 'playing'; // 'playing', 'caught', 'miss'
        this._resultTimer = 0;
        this._attempts = 0;
    };

    Scene_Fishing.prototype.update = function() {
        Scene_Base.prototype.update.call(this);

        if (this._state === 'playing') {
            this._updateIndicator();
            this._checkInput();
        } else if (this._state === 'miss') {
            this._resultTimer--;
            if (this._resultTimer <= 0) {
                this._state = 'playing';
                // 목표 구간 재배치
                this._targetY = Math.floor(Math.random() * (this._barH - this._targetH));
            }
        } else if (this._state === 'caught') {
            this._resultTimer--;
            if (this._resultTimer <= 0) {
                $gameSwitches.setValue(this._switchId, true);
                this.popScene();
                return;
            }
        }

        this._redraw();
    };

    Scene_Fishing.prototype._updateIndicator = function() {
        this._indY += this._indSpeed * this._indDir;
        // 경계에서 방향 전환 + 약간의 랜덤 속도 변화
        if (this._indY <= 0) {
            this._indY = 0;
            this._indDir = 1;
            this._indSpeed = 1.5 + Math.random() * 2.0;
        } else if (this._indY + this._indH >= this._barH) {
            this._indY = this._barH - this._indH;
            this._indDir = -1;
            this._indSpeed = 1.5 + Math.random() * 2.0;
        }
    };

    Scene_Fishing.prototype._checkInput = function() {
        if (Input.isTriggered('ok') || Input.isTriggered('cancel')) {
            this._attempts++;
            // 성공 판정: 인디케이터가 목표 구간 안에 있는가?
            var indBottom = this._indY + this._indH;
            var targetBottom = this._targetY + this._targetH;
            var overlap = Math.min(indBottom, targetBottom) - Math.max(this._indY, this._targetY);
            if (overlap >= this._indH * 0.5) {
                // 성공!
                this._state = 'caught';
                this._resultTimer = 120; // 2초
                AudioManager.playSe({name: 'Coin', volume: 90, pitch: 100, pan: 0});
            } else {
                // 실패
                this._state = 'miss';
                this._resultTimer = 80; // ~1.3초
                AudioManager.playSe({name: 'Buzzer1', volume: 70, pitch: 100, pan: 0});
            }
        }
    };

    Scene_Fishing.prototype._redraw = function() {
        var bmp = this._bitmap;
        bmp.clear();

        // 배경
        bmp.fillRect(0, 0, Graphics.width, Graphics.height, 'rgba(0,0,30,0.88)');

        // 제목
        bmp.fontSize = 28;
        bmp.textColor = '#ffffaa';
        bmp.drawText('낚시 미니게임', 0, 40, Graphics.width, 40, 'center');

        // 시도 횟수
        bmp.fontSize = 18;
        bmp.textColor = '#aaaaff';
        bmp.drawText('시도: ' + this._attempts + '회', Graphics.width - 140, 40, 120, 30, 'right');

        // 게이지 바 배경
        var bx = this._barX, by = this._barY, bw = 80, bh = this._barH;
        bmp.fillRect(bx, by, bw, bh, '#0a1a3a');
        // 외곽선
        bmp.fillRect(bx, by, bw, 3, '#334466');
        bmp.fillRect(bx, by + bh - 3, bw, 3, '#334466');
        bmp.fillRect(bx, by, 3, bh, '#334466');
        bmp.fillRect(bx + bw - 3, by, 3, bh, '#334466');

        // 목표 구간 (초록)
        bmp.fillRect(bx, by + this._targetY, bw, this._targetH, 'rgba(0,200,100,0.4)');
        bmp.fillRect(bx, by + this._targetY, bw, 3, '#00cc66');
        bmp.fillRect(bx, by + this._targetY + this._targetH - 3, bw, 3, '#00cc66');

        // 인디케이터 색상
        var indColor = '#ffffff';
        if (this._state === 'caught') indColor = '#ffdd00';
        else if (this._state === 'miss') indColor = '#ff4444';
        bmp.fillRect(bx + 5, by + this._indY, bw - 10, this._indH, indColor);

        // 안내 텍스트
        bmp.fontSize = 20;
        bmp.textColor = '#ffffff';
        if (this._state === 'playing') {
            bmp.drawText('Z 또는 Enter: 낚아올리기!', 0, by + bh + 30, Graphics.width, 30, 'center');
        } else if (this._state === 'caught') {
            bmp.fontSize = 26;
            bmp.textColor = '#ffdd00';
            bmp.drawText('물고기를 낚았다!', 0, by + bh + 30, Graphics.width, 40, 'center');
        } else if (this._state === 'miss') {
            bmp.textColor = '#ff8888';
            bmp.drawText('아쉽네요! 다시 시도해보세요.', 0, by + bh + 30, Graphics.width, 30, 'center');
        }

        // 왼쪽 레이블
        bmp.fontSize = 16;
        bmp.textColor = '#aaaaff';
        bmp.drawText('위', bx - 40, by - 5, 35, 20, 'right');
        bmp.drawText('아래', bx - 40, by + bh - 15, 35, 20, 'right');

        // 목표 레이블
        bmp.textColor = '#00ff88';
        var labelY = by + this._targetY + this._targetH / 2 - 10;
        bmp.drawText('목표', bx + bw + 10, labelY, 60, 20, 'left');
    };

    // ==========================================
    // 플러그인 커맨드
    // ==========================================
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _pluginCommand.call(this, command, args);
        if (command === 'PUZZLE_FISHING_START') {
            var switchId = parseInt(args[0]) || 0;
            var scene = new Scene_Fishing();
            scene.prepare(switchId);
            SceneManager.push(scene);
        }
    };

})();
