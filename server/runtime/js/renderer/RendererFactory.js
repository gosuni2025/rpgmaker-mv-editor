//=============================================================================
// RendererFactory.js - Abstract Factory for rendering primitives
//=============================================================================

function RendererFactory() {
    throw new Error('This is a static class');
}

RendererFactory._backend = null;
RendererFactory._backends = {};

RendererFactory.register = function(name, factory) {
    this._backends[name] = factory;
};

RendererFactory.setBackend = function(name) {
    if (!this._backends[name]) {
        throw new Error('Unknown renderer backend: ' + name);
    }
    this._backend = this._backends[name];
};

RendererFactory.getBackend = function() {
    return this._backend;
};

RendererFactory.getBackendName = function() {
    for (var name in this._backends) {
        if (this._backends[name] === this._backend) {
            return name;
        }
    }
    return null;
};

// Container node creation
RendererFactory.createContainer = function() {
    return this._backend.createContainer();
};

// Sprite node creation
RendererFactory.createSprite = function(texture) {
    return this._backend.createSprite(texture);
};

// BaseTexture creation from canvas/image source
RendererFactory.createBaseTexture = function(source) {
    return this._backend.createBaseTexture(source);
};

// Texture creation from baseTexture
RendererFactory.createTexture = function(baseTexture) {
    return this._backend.createTexture(baseTexture);
};

// RenderTexture for snapshots
RendererFactory.createRenderTexture = function(width, height) {
    return this._backend.createRenderTexture(width, height);
};

// Graphics node (for shapes like ScreenSprite)
RendererFactory.createGraphicsNode = function() {
    return this._backend.createGraphicsNode();
};

// TilingSprite node
RendererFactory.createTilingSprite = function(texture) {
    return this._backend.createTilingSprite(texture);
};

// Filter creation
RendererFactory.createVoidFilter = function() {
    return this._backend.createVoidFilter();
};

RendererFactory.createColorMatrixFilter = function() {
    return this._backend.createColorMatrixFilter();
};

// Tilemap layer creation (for ShaderTilemap)
RendererFactory.createTilemapLayer = function(zIndex, bitmaps, useSquareShader) {
    return this._backend.createTilemapLayer(zIndex, bitmaps, useSquareShader);
};

// Scale modes
RendererFactory.SCALE_MODE_LINEAR = 'linear';
RendererFactory.SCALE_MODE_NEAREST = 'nearest';

// Set scale mode on a base texture
RendererFactory.setScaleMode = function(baseTexture, mode) {
    this._backend.setScaleMode(baseTexture, mode);
};

// Check if a backend supports shader tilemap
RendererFactory.supportsShaderTilemap = function() {
    return this._backend.supportsShaderTilemap ? this._backend.supportsShaderTilemap() : false;
};
