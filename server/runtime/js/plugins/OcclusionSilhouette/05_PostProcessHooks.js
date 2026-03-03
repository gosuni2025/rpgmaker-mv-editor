    //=========================================================================
    // PostProcess Composer Hook - 3D 모드
    //=========================================================================
    var _PostProcess_createComposer = PostProcess._createComposer;
    PostProcess._createComposer = function(rendererObj, stage) {
        _PostProcess_createComposer.call(this, rendererObj, stage);

        if (!OcclusionSilhouette._active) return;

        // SilhouettePass 생성 - MapRenderPass(index 0) 다음, BloomPass 앞에 삽입
        var silPass = OcclusionSilhouette._createSilhouettePass();
        var passes = this._composer.passes;
        // index 1에 삽입 (MapRenderPass 바로 다음)
        passes.splice(1, 0, silPass);

        OcclusionSilhouette._silhouettePass = silPass;
    };

    //=========================================================================
    // PostProcess Composer Hook - 2D 모드
    //=========================================================================
    var _PostProcess_createComposer2D = PostProcess._createComposer2D;
    PostProcess._createComposer2D = function(rendererObj, stage) {
        _PostProcess_createComposer2D.call(this, rendererObj, stage);

        if (!OcclusionSilhouette._active) return;

        // SilhouettePass 생성 - Simple2DRenderPass(index 0) 다음에 삽입
        var silPass = OcclusionSilhouette._createSilhouettePass();
        var passes = this._composer.passes;
        passes.splice(1, 0, silPass);

        OcclusionSilhouette._silhouettePass = silPass;
    };

    //=========================================================================
    // SilhouettePass 생성 헬퍼
    //=========================================================================
    OcclusionSilhouette._createSilhouettePass = function() {
        var uniforms = THREE.UniformsUtils.clone(SilhouetteShader.uniforms);
        var material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: SilhouetteShader.vertexShader,
            fragmentShader: SilhouetteShader.fragmentShader
        });

        var pass = {
            enabled: true,
            needsSwap: true,
            renderToScreen: false,
            uniforms: uniforms,
            material: material,
            fsQuad: new FullScreenQuad(material),
            setSize: function() {},
            render: function(renderer, writeBuffer, readBuffer) {
                this.uniforms.tColor.value = readBuffer.texture;
                if (this.renderToScreen) {
                    renderer.setRenderTarget(null);
                } else {
                    renderer.setRenderTarget(writeBuffer);
                    renderer.clear();
                }
                this.fsQuad.render(renderer);
            },
            dispose: function() {
                this.material.dispose();
                this.fsQuad.dispose();
            }
        };

        return pass;
    };

    //=========================================================================
    // MapRenderPass Hook - 3D 마스크 렌더
    //=========================================================================
    var _MapRenderPass_render = MapRenderPass.prototype.render;
    MapRenderPass.prototype.render = function(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        _MapRenderPass_render.call(this, renderer, writeBuffer, readBuffer, deltaTime, maskActive);

        if (OcclusionSilhouette._active) {
            var hasMasks = OcclusionSilhouette._renderMasks(renderer, this.scene, this.perspCamera, this.spriteset);
            if (OcclusionSilhouette._silhouettePass) {
                OcclusionSilhouette._silhouettePass.enabled = hasMasks;
                // 3D 모드에서는 depth 비교 활성화
                if (hasMasks) OcclusionSilhouette._syncUniforms(true);
            }
        }
    };

    //=========================================================================
    // Simple2DRenderPass Hook - 2D 마스크 렌더
    //=========================================================================
    var _Simple2DRenderPass_render = Simple2DRenderPass.prototype.render;
    Simple2DRenderPass.prototype.render = function(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        _Simple2DRenderPass_render.call(this, renderer, writeBuffer, readBuffer, deltaTime, maskActive);

        if (OcclusionSilhouette._active) {
            var rendererObj = this._rendererObj;
            if (rendererObj) {
                var spriteset = Mode3D._spriteset;
                var hasMasks = OcclusionSilhouette._renderMasks(renderer, rendererObj.scene, rendererObj.camera, spriteset);
                if (OcclusionSilhouette._silhouettePass) {
                    OcclusionSilhouette._silhouettePass.enabled = hasMasks;
                    // 2D 모드: depth 비교 비활성화
                    if (hasMasks) OcclusionSilhouette._syncUniforms(false);
                }
            }
        }
    };

    //=========================================================================
    // 리소스 정리
    //=========================================================================
    OcclusionSilhouette.dispose = function() {
        if (this._charMaskRT) {
            if (this._charMaskRT.depthTexture) this._charMaskRT.depthTexture.dispose();
            this._charMaskRT.dispose();
            this._charMaskRT = null;
        }
        if (this._objMaskRT) {
            if (this._objMaskRT.depthTexture) this._objMaskRT.depthTexture.dispose();
            this._objMaskRT.dispose();
            this._objMaskRT = null;
        }
        this._maskWidth = 0;
        this._maskHeight = 0;
    };

