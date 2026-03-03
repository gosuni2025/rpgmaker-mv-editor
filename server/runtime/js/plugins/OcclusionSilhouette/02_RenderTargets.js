    //=========================================================================
    // RenderTarget 관리
    //=========================================================================
    OcclusionSilhouette._ensureRenderTargets = function(width, height) {
        if (this._charMaskRT && this._maskWidth === width && this._maskHeight === height) return;

        var params = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            depthTexture: null  // 아래에서 개별 생성
        };

        if (this._charMaskRT) {
            if (this._charMaskRT.depthTexture) this._charMaskRT.depthTexture.dispose();
            this._charMaskRT.dispose();
        }
        if (this._objMaskRT) {
            if (this._objMaskRT.depthTexture) this._objMaskRT.depthTexture.dispose();
            this._objMaskRT.dispose();
        }

        var charParams = Object.assign({}, params, {
            depthTexture: new THREE.DepthTexture(width, height)
        });
        var objParams = Object.assign({}, params, {
            depthTexture: new THREE.DepthTexture(width, height)
        });

        this._charMaskRT = new THREE.WebGLRenderTarget(width, height, charParams);
        this._objMaskRT  = new THREE.WebGLRenderTarget(width, height, objParams);
        this._maskWidth  = width;
        this._maskHeight = height;
    };

