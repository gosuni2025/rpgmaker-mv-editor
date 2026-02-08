//=============================================================================
// RendererStrategy.js - Renderer management strategy interface
//=============================================================================

function RendererStrategy() {
    throw new Error('This is a static class');
}

RendererStrategy._strategy = null;
RendererStrategy._strategies = {};

RendererStrategy.register = function(name, strategy) {
    this._strategies[name] = strategy;
};

RendererStrategy.setStrategy = function(name) {
    if (!this._strategies[name]) {
        throw new Error('Unknown renderer strategy: ' + name);
    }
    this._strategy = this._strategies[name];
};

RendererStrategy.getStrategy = function() {
    return this._strategy;
};

// Create the underlying renderer (WebGL/Canvas/Three.js)
RendererStrategy.createRenderer = function(width, height, options) {
    return this._strategy.createRenderer(width, height, options);
};

// Render a stage/scene
RendererStrategy.render = function(renderer, stage) {
    this._strategy.render(renderer, stage);
};

// Resize the renderer
RendererStrategy.resize = function(renderer, width, height) {
    this._strategy.resize(renderer, width, height);
};

// Check if the renderer is WebGL
RendererStrategy.isWebGL = function(renderer) {
    return this._strategy.isWebGL(renderer);
};

// Run garbage collection
RendererStrategy.callGC = function(renderer) {
    this._strategy.callGC(renderer);
};

// Get the GL context (if available)
RendererStrategy.getGL = function(renderer) {
    return this._strategy.getGL ? this._strategy.getGL(renderer) : null;
};

// Snapshot: render stage to a canvas for Bitmap.snap
RendererStrategy.renderToCanvas = function(renderer, stage, width, height) {
    return this._strategy.renderToCanvas(renderer, stage, width, height);
};

// Get mode text for display
RendererStrategy.getModeText = function(renderer) {
    return this._strategy.getModeText ? this._strategy.getModeText(renderer) : 'Unknown mode';
};
