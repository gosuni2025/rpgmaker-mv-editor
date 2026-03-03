
    //=========================================================================
    // HD-2D 스타일 빌보드 방향 (카메라 yaw에 따라 스프라이트 방향 행 변경)
    //=========================================================================
    // 카메라가 회전하면 캐릭터의 실제 이동 방향과 무관하게,
    // 카메라 시점에서 보이는 방향에 맞는 스프라이트 행을 표시함.
    // 예: 캐릭터가 아래(+Y)를 향하고 있을 때 카메라가 90° 회전하면
    //     카메라 시점에서는 왼쪽을 향한 것으로 보이므로 "왼쪽" 행 사용.
    //
    // 방향 회전 순서 (CCW, yaw +90°마다 한 단계):
    //   2(Down) → 4(Left) → 8(Up) → 6(Right) → 2(Down)
    //=========================================================================

    // 방향 → 인덱스, 인덱스 → 방향 매핑
    var _dirToIdx = { 2: 0, 4: 1, 8: 2, 6: 3 };
    var _idxToDir = [2, 4, 8, 6];

    /**
     * 카메라 yaw를 고려한 시각적 방향을 반환
     * @param {number} actualDir - 캐릭터의 실제 방향 (2/4/6/8)
     * @returns {number} 카메라 시점에서의 시각적 방향 (2/4/6/8)
     */
    function getVisualDirection(actualDir) {
        if (!is3DActive()) return actualDir;

        var yawDeg = Mode3D._yawDeg || 0;
        // yaw를 90° 단위로 양자화 (반올림)
        var yawStep = Math.round(yawDeg / 90);
        // -180~180 범위의 yaw에서 step은 -2~2 범위
        var idx = _dirToIdx[actualDir];
        if (idx === undefined) return actualDir; // 비표준 방향은 그대로
        // 양의 모듈로 연산: (idx + yawStep) mod 4
        var visualIdx = ((idx + yawStep) % 4 + 4) % 4;
        return _idxToDir[visualIdx];
    }

    //=========================================================================
    // TPS 스타일 이동: WASD 입력을 카메라 방향 기준으로 변환
    //=========================================================================
    // 카메라 yaw 회전에 따라 입력 방향을 월드 좌표 기준으로 변환.
    // getVisualDirection(월드→시각) 의 역방향: 입력(화면 기준) → 월드 방향.
    //
    // 예: 카메라가 yaw=90° 일 때 "위" 키 → 맵에서 Left(4) 방향으로 이동
    //=========================================================================

    var _orig_getInputDirection = Game_Player.prototype.getInputDirection;
    Game_Player.prototype.getInputDirection = function() {
        var dir4 = _orig_getInputDirection.call(this);
        if (!is3DActive() || dir4 === 0) return dir4;

        var yawDeg = Mode3D._yawDeg || 0;
        var yawStep = Math.round(yawDeg / 90);
        var idx = _dirToIdx[dir4];
        if (idx === undefined) return dir4;
        // 역변환: 화면 기준 방향 → 월드 방향
        var worldIdx = ((idx - yawStep) % 4 + 4) % 4;
        return _idxToDir[worldIdx];
    };

    // Sprite_Character.prototype.characterPatternY 오버라이드
    var _orig_characterPatternY = Sprite_Character.prototype.characterPatternY;
    Sprite_Character.prototype.characterPatternY = function() {
        if (is3DActive() && this._character) {
            // !나 $ 접두어가 붙은 캐릭터(오브젝트/빅 캐릭터)는 방향 보정 안 함
            // 이들은 고정 방향 이미지이므로 카메라 각도와 무관하게 원래 방향 유지
            var charName = this._character.characterName ? this._character.characterName() : '';
            if (charName && /^[\!\$]/.test(charName)) {
                return _orig_characterPatternY.call(this);
            }
            var actualDir = this._character.direction();
            var visualDir = getVisualDirection(actualDir);
            return (visualDir - 2) / 2;
        }
        return _orig_characterPatternY.call(this);
    };
