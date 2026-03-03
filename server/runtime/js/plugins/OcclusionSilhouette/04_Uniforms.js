    //=========================================================================
    // 플레이어/파티원 스프라이트 추출
    //=========================================================================
    OcclusionSilhouette._getPlayerSprites = function(spriteset) {
        var result = [];
        var chars = spriteset._characterSprites;
        if (!chars) return result;

        // 파티원 목록 캐시 (constructor.name 대신 인스턴스 비교)
        var followers = null;
        if (this.config.includeFollowers && $gamePlayer && $gamePlayer.followers()) {
            followers = $gamePlayer.followers()._data;
        }

        for (var i = 0; i < chars.length; i++) {
            var spr = chars[i];
            if (!spr._character) continue;

            // Game_Player
            if (spr._character === $gamePlayer) {
                result.push(spr);
                continue;
            }

            // Game_Follower (파티원) - 인스턴스 비교
            if (followers) {
                for (var fi = 0; fi < followers.length; fi++) {
                    if (spr._character === followers[fi]) {
                        result.push(spr);
                        break;
                    }
                }
            }
        }

        return result;
    };

    //=========================================================================
    // Uniforms 동기화
    //=========================================================================
    OcclusionSilhouette._syncUniforms = function(useDepthTest) {
        var pass = this._silhouettePass;
        if (!pass) return;

        var cfg = this.config;
        pass.uniforms.uFillColor.value.set(cfg.fillColor[0], cfg.fillColor[1], cfg.fillColor[2]);
        pass.uniforms.uFillOpacity.value = cfg.fillOpacity;
        pass.uniforms.uOutlineColor.value.set(cfg.outlineColor[0], cfg.outlineColor[1], cfg.outlineColor[2]);
        pass.uniforms.uOutlineOpacity.value = cfg.outlineOpacity;
        pass.uniforms.uOutlineWidth.value = cfg.outlineWidth;
        pass.uniforms.uPattern.value = PATTERN_MAP[cfg.pattern] || 0;
        pass.uniforms.uPatternScale.value = cfg.patternScale;

        if (this._charMaskRT) {
            pass.uniforms.tCharMask.value = this._charMaskRT.texture;
            pass.uniforms.tObjMask.value  = this._objMaskRT.texture;
            // depth texture: 3D 모드에서는 depthTexture가 있으므로 depth 비교 활성화
            var hasDepth = !!(this._charMaskRT.depthTexture && this._objMaskRT.depthTexture && useDepthTest);
            pass.uniforms.tCharDepth.value    = hasDepth ? this._charMaskRT.depthTexture : null;
            pass.uniforms.tObjDepth.value     = hasDepth ? this._objMaskRT.depthTexture  : null;
            pass.uniforms.uUseDepthTest.value = hasDepth ? 1 : 0;
            pass.uniforms.uResolution.value.set(this._maskWidth, this._maskHeight);
        }
    };

