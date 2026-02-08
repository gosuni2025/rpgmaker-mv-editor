//=============================================================================
// ThreeSprite.js - PIXI.Sprite-compatible wrapper around THREE.Mesh
//=============================================================================

/**
 * A sprite object that wraps a THREE.Mesh (PlaneGeometry + MeshBasicMaterial)
 * to provide a PIXI.Sprite-like interface for RPG Maker MV.
 *
 * Handles texture mapping, UV coordinate manipulation for frame clipping,
 * anchor/pivot offsets, alpha blending, and tint.
 *
 * @class ThreeSprite
 * @constructor
 * @param {Object} [texture] - Optional texture object with baseTexture and frame
 */
function ThreeSprite(texture) {
    // Create the Three.js geometry and material
    this._geometry = new THREE.PlaneGeometry(1, 1);
    this._material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    this._threeObj = new THREE.Mesh(this._geometry, this._material);
    this._threeObj._wrapper = this;

    // Rendering order for the mesh (needed for proper 2D layering)
    this._threeObj.renderOrder = 0;

    // Position
    this._x = 0;
    this._y = 0;

    // Scale (PIXI-like {x, y} proxy)
    this._scaleX = 1;
    this._scaleY = 1;
    this.scale = this._createScaleProxy();

    // Rotation in radians
    this._rotation = 0;

    // Anchor (normalized, 0-1; like PIXI anchor, shifts the origin)
    this._anchorX = 0;
    this._anchorY = 0;
    this.anchor = this._createAnchorProxy();

    // Pivot (in pixel coords, for rotation center offset)
    this._pivotX = 0;
    this._pivotY = 0;
    this.pivot = this._createPivotProxy();

    // Alpha / visibility
    this._alpha = 1;
    this._visible = true;

    // Tint (PIXI compat: 0xFFFFFF = white/no tint)
    this._tint = 0xFFFFFF;

    // Blend mode (PIXI compat)
    this._blendMode = 0; // NORMAL

    // World alpha (computed during traversal)
    this.worldAlpha = 1;
    this.worldVisible = true;

    // Parent reference
    this.parent = null;

    // Children (sprites can have children in PIXI)
    this.children = [];

    // Filters (PIXI compat)
    this._filters = null;

    // Texture reference (PIXI-like: { baseTexture, frame, _updateID })
    this._texture = null;
    this._textureUpdateID = -1;

    // Cached frame dimensions for geometry
    this._frameWidth = 0;
    this._frameHeight = 0;

    // Z-index for draw order
    this._zIndex = 0;

    // Transform dirty flag
    this._transformDirty = true;

    // The Three.js texture (actual THREE.Texture on the material)
    this._threeTexture = null;

    // Apply initial texture if provided
    if (texture) {
        this.texture = texture;
    }
}

// ---------------------------------------------------------------------------
// Property definitions (PIXI.Sprite-compatible)
// ---------------------------------------------------------------------------

Object.defineProperties(ThreeSprite.prototype, {
    x: {
        get: function() { return this._x; },
        set: function(value) {
            if (this._x !== value) {
                this._x = value;
                this._transformDirty = true;
            }
        },
        configurable: true
    },
    y: {
        get: function() { return this._y; },
        set: function(value) {
            if (this._y !== value) {
                this._y = value;
                this._transformDirty = true;
            }
        },
        configurable: true
    },
    rotation: {
        get: function() { return this._rotation; },
        set: function(value) {
            if (this._rotation !== value) {
                this._rotation = value;
                this._transformDirty = true;
            }
        },
        configurable: true
    },
    alpha: {
        get: function() { return this._alpha; },
        set: function(value) {
            this._alpha = value;
        },
        configurable: true
    },
    visible: {
        get: function() { return this._visible; },
        set: function(value) {
            this._visible = value;
            this._threeObj.visible = value;
        },
        configurable: true
    },
    tint: {
        get: function() { return this._tint; },
        set: function(value) {
            this._tint = value;
            if (this._material) {
                this._material.color.setHex(value);
            }
        },
        configurable: true
    },
    blendMode: {
        get: function() { return this._blendMode; },
        set: function(value) {
            this._blendMode = value;
            this._updateBlendMode();
        },
        configurable: true
    },
    texture: {
        get: function() { return this._texture; },
        set: function(value) {
            if (this._texture !== value) {
                this._texture = value;
                this._textureUpdateID = -1; // Force update
                this._updateTexture();
            }
        },
        configurable: true
    },
    filters: {
        get: function() { return this._filters; },
        set: function(value) {
            this._filters = value;
        },
        configurable: true
    },
    width: {
        get: function() {
            return Math.abs(this._scaleX) * this._frameWidth;
        },
        set: function(value) {
            if (this._frameWidth > 0) {
                this._scaleX = value / this._frameWidth;
            } else {
                this._scaleX = 1;
            }
            this._transformDirty = true;
        },
        configurable: true
    },
    height: {
        get: function() {
            return Math.abs(this._scaleY) * this._frameHeight;
        },
        set: function(value) {
            if (this._frameHeight > 0) {
                this._scaleY = value / this._frameHeight;
            } else {
                this._scaleY = 1;
            }
            this._transformDirty = true;
        },
        configurable: true
    },
    zIndex: {
        get: function() { return this._zIndex; },
        set: function(value) {
            this._zIndex = value;
            this._transformDirty = true;
        },
        configurable: true
    }
});

// ---------------------------------------------------------------------------
// Proxy creators (Scale, Anchor, Pivot)
// ---------------------------------------------------------------------------

ThreeSprite.prototype._createScaleProxy = function() {
    var self = this;
    return {
        get x() { return self._scaleX; },
        set x(v) { self._scaleX = v; self._transformDirty = true; },
        get y() { return self._scaleY; },
        set y(v) { self._scaleY = v; self._transformDirty = true; },
        set: function(x, y) {
            self._scaleX = x;
            self._scaleY = (y !== undefined) ? y : x;
            self._transformDirty = true;
        }
    };
};

ThreeSprite.prototype._createAnchorProxy = function() {
    var self = this;
    return {
        get x() { return self._anchorX; },
        set x(v) { self._anchorX = v; self._transformDirty = true; },
        get y() { return self._anchorY; },
        set y(v) { self._anchorY = v; self._transformDirty = true; },
        set: function(x, y) {
            self._anchorX = x;
            self._anchorY = (y !== undefined) ? y : x;
            self._transformDirty = true;
        }
    };
};

ThreeSprite.prototype._createPivotProxy = function() {
    var self = this;
    return {
        get x() { return self._pivotX; },
        set x(v) { self._pivotX = v; self._transformDirty = true; },
        get y() { return self._pivotY; },
        set y(v) { self._pivotY = v; self._transformDirty = true; },
        set: function(x, y) {
            self._pivotX = x;
            self._pivotY = (y !== undefined) ? y : x;
            self._transformDirty = true;
        }
    };
};

// ---------------------------------------------------------------------------
// Texture and UV management
// ---------------------------------------------------------------------------

/**
 * Updates the Three.js material texture and geometry from the PIXI-like
 * texture wrapper (which has baseTexture and frame).
 */
ThreeSprite.prototype._updateTexture = function() {
    var texture = this._texture;
    if (!texture) {
        this._material.map = null;
        this._material.visible = false;
        this._material.needsUpdate = true;
        return;
    }

    // Get the Three.js texture from baseTexture
    var baseTexture = texture.baseTexture;
    if (!baseTexture) return;

    var threeTexture = baseTexture._threeTexture || baseTexture;

    // Only update if texture changed or _updateID advanced
    if (this._threeTexture !== threeTexture || this._textureUpdateID !== texture._updateID) {
        this._threeTexture = threeTexture;
        this._textureUpdateID = texture._updateID;

        this._material.map = threeTexture;
        this._material.visible = true;
        this._material.needsUpdate = true;

        // Update frame/UV
        this._updateFrame();
    }
};

/**
 * Updates geometry size and UV coordinates based on the texture frame.
 * The frame defines a sub-rectangle of the base texture to display.
 */
ThreeSprite.prototype._updateFrame = function() {
    var texture = this._texture;
    if (!texture || !texture.baseTexture) return;

    var frame = texture.frame || { x: 0, y: 0, width: 0, height: 0 };
    var fw = frame.width;
    var fh = frame.height;

    if (fw <= 0 || fh <= 0) {
        // Don't hide the entire Three.js object if it has children
        // (sprite used as container, e.g., Tilemap layers)
        if (!this.children || this.children.length === 0) {
            this._threeObj.visible = false;
        }
        this._frameWidth = 0;
        this._frameHeight = 0;
        return;
    }

    this._threeObj.visible = this._visible;
    this._frameWidth = fw;
    this._frameHeight = fh;

    // Update UV coordinates to show only the frame region
    var baseTexture = texture.baseTexture;
    var tw = baseTexture.width || fw;
    var th = baseTexture.height || fh;



    if (tw > 0 && th > 0) {
        var uvX = frame.x / tw;
        var uvY = frame.y / th;
        var uvW = fw / tw;
        var uvH = fh / th;

        // With flipY=true, UV V is inverted: V=0 maps to canvas bottom,
        // V=1 maps to canvas top. Convert frame Y coords to flipped V:
        //   canvas top of frame (frame.y)        -> V = 1 - uvY
        //   canvas bottom of frame (frame.y+fh)  -> V = 1 - uvY - uvH
        // After geometry Y-flip, vertex 0,1 are at screen top (show frame top)
        // and vertex 2,3 are at screen bottom (show frame bottom).
        var uvTop = 1 - uvY;        // V for canvas top of frame
        var uvBottom = 1 - uvY - uvH; // V for canvas bottom of frame
        var uvAttr = this._geometry.attributes.uv;
        if (uvAttr) {
            // Vertex 0: screen top-left -> frame top
            uvAttr.setXY(0, uvX, uvTop);
            // Vertex 1: screen top-right -> frame top
            uvAttr.setXY(1, uvX + uvW, uvTop);
            // Vertex 2: screen bottom-left -> frame bottom
            uvAttr.setXY(2, uvX, uvBottom);
            // Vertex 3: screen bottom-right -> frame bottom
            uvAttr.setXY(3, uvX + uvW, uvBottom);
            uvAttr.needsUpdate = true;
        }
    }

    this._transformDirty = true;
};

// ---------------------------------------------------------------------------
// Blend mode mapping
// ---------------------------------------------------------------------------

ThreeSprite.prototype._updateBlendMode = function() {
    // PIXI blend modes: 0=NORMAL, 1=ADD, 2=MULTIPLY, 3=SCREEN
    switch (this._blendMode) {
        case 1: // ADD
            this._material.blending = THREE.AdditiveBlending;
            break;
        case 2: // MULTIPLY
            this._material.blending = THREE.MultiplyBlending;
            break;
        case 3: // SCREEN
            // Three.js doesn't have screen blending natively; use additive as approximation
            this._material.blending = THREE.AdditiveBlending;
            break;
        default: // NORMAL
            this._material.blending = THREE.NormalBlending;
            break;
    }
    this._material.needsUpdate = true;
};

// ---------------------------------------------------------------------------
// Transform synchronization
// ---------------------------------------------------------------------------

/**
 * Syncs wrapper properties to the underlying THREE.Mesh.
 *
 * Key design: In PIXI, a Sprite's visual size (frame dimensions) does NOT
 * propagate to children via the transform hierarchy. But in Three.js,
 * obj.scale affects all children. So we encode frame dimensions directly
 * into geometry vertices and only apply logical scaleX/scaleY to obj.scale.
 */
ThreeSprite.prototype.syncTransform = function() {
    var obj = this._threeObj;
    var fw = this._frameWidth;
    var fh = this._frameHeight;

    // Position: apply pivot offsets
    obj.position.x = this._x - this._pivotX;
    obj.position.y = this._y - this._pivotY;
    obj.position.z = this._zIndex;

    // Scale: only logical scale (scaleX/scaleY), NOT frame dimensions.
    // Frame dimensions are baked into geometry vertices below.
    // This prevents scale from propagating frame size to children.
    obj.scale.x = this._scaleX;
    obj.scale.y = this._scaleY;

    // Rotation (around Z for 2D). Negate for CW vs CCW convention.
    obj.rotation.z = -this._rotation;

    // Encode frame dimensions and anchor into geometry vertices directly.
    // PlaneGeometry(1,1) has vertices at -0.5..0.5. We replace them with
    // pixel-space coordinates relative to the anchor point.
    //
    // In Y-down camera (top=0, bottom=height), positive Y goes down on screen.
    // anchor (0,0) = top-left: sprite extends right and down → X:[0,fw], Y:[0,fh]
    // anchor (0.5,1.0) = bottom-center: sprite extends up → X:[-fw/2,fw/2], Y:[-fh,0]
    var posAttr = this._geometry.attributes.position;
    if (posAttr) {
        var left   = -this._anchorX * fw;
        var right  = (1 - this._anchorX) * fw;
        var top    = -this._anchorY * fh;        // screen top edge (negative = up)
        var bottom = (1 - this._anchorY) * fh;   // screen bottom edge (positive = down)

        posAttr.setXY(0, left,  top);     // screen top-left
        posAttr.setXY(1, right, top);     // screen top-right
        posAttr.setXY(2, left,  bottom);  // screen bottom-left
        posAttr.setXY(3, right, bottom);  // screen bottom-right
        posAttr.needsUpdate = true;
    }

    // Alpha: update material opacity
    this._material.opacity = this.worldAlpha;
    this._material.transparent = true;

    // Visibility: hide the mesh if no frame, but keep the Three.js object
    // visible when there are children (sprite used as container, e.g. Tilemap layers)
    if (this.children && this.children.length > 0) {
        obj.visible = this._visible;
        // Hide just the mesh (no texture to show) but children remain visible
        this._material.visible = (fw > 0) && (fh > 0);
    } else {
        obj.visible = this._visible && (fw > 0) && (fh > 0);
    }
};

/**
 * Recursively updates world alpha and syncs transforms.
 * @param {Number} parentAlpha
 */
ThreeSprite.prototype.updateTransform = function(parentAlpha) {
    if (parentAlpha === undefined) parentAlpha = 1;

    this.worldAlpha = this._alpha * parentAlpha;
    this.worldVisible = this._visible;

    // Check for texture updates (e.g., canvas redraws)
    if (this._texture && this._texture._updateID !== this._textureUpdateID) {
        this._updateTexture();
    }

    this.syncTransform();

    // Update children (sprites can have child sprites in PIXI)
    for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        if (child.updateTransform) {
            child.updateTransform(this.worldAlpha);
        }
    }
};

// ---------------------------------------------------------------------------
// Child management (same as ThreeContainer - sprites can have children)
// ---------------------------------------------------------------------------

ThreeSprite.prototype.addChild = function(child) {
    if (child.parent) {
        child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    if (child._threeObj) {
        this._threeObj.add(child._threeObj);
    }
    return child;
};

ThreeSprite.prototype.addChildAt = function(child, index) {
    if (child.parent) {
        child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.splice(index, 0, child);
    if (child._threeObj) {
        this._threeObj.add(child._threeObj);
    }
    return child;
};

ThreeSprite.prototype.removeChild = function(child) {
    var index = this.children.indexOf(child);
    if (index >= 0) {
        this.children.splice(index, 1);
        child.parent = null;
        if (child._threeObj) {
            this._threeObj.remove(child._threeObj);
        }
    }
    return child;
};

ThreeSprite.prototype.removeChildAt = function(index) {
    if (index >= 0 && index < this.children.length) {
        var child = this.children[index];
        this.children.splice(index, 1);
        child.parent = null;
        if (child._threeObj) {
            this._threeObj.remove(child._threeObj);
        }
        return child;
    }
    return null;
};

ThreeSprite.prototype.removeChildren = function() {
    var removed = this.children.slice();
    for (var i = 0; i < removed.length; i++) {
        removed[i].parent = null;
        if (removed[i]._threeObj) {
            this._threeObj.remove(removed[i]._threeObj);
        }
    }
    this.children.length = 0;
    return removed;
};

ThreeSprite.prototype.getChildIndex = function(child) {
    return this.children.indexOf(child);
};

ThreeSprite.prototype.setChildIndex = function(child, index) {
    var currentIndex = this.children.indexOf(child);
    if (currentIndex >= 0) {
        this.children.splice(currentIndex, 1);
        this.children.splice(index, 0, child);
    }
};

// ---------------------------------------------------------------------------
// PIXI compatibility stubs
// ---------------------------------------------------------------------------

ThreeSprite.prototype.getBounds = function() {
    return {
        x: this._x - this._anchorX * this._frameWidth,
        y: this._y - this._anchorY * this._frameHeight,
        width: this._frameWidth * Math.abs(this._scaleX),
        height: this._frameHeight * Math.abs(this._scaleY)
    };
};

ThreeSprite.prototype.getLocalBounds = function() {
    return {
        x: -this._anchorX * this._frameWidth,
        y: -this._anchorY * this._frameHeight,
        width: this._frameWidth,
        height: this._frameHeight
    };
};

ThreeSprite.prototype.renderWebGL = function(renderer) {
    // No-op: Three.js handles rendering
};

ThreeSprite.prototype.renderCanvas = function(renderer) {
    // No-op
};

ThreeSprite.prototype.containsPoint = function(point) {
    var bounds = this.getBounds();
    return point.x >= bounds.x && point.x < bounds.x + bounds.width &&
           point.y >= bounds.y && point.y < bounds.y + bounds.height;
};

ThreeSprite.prototype.destroy = function(options) {
    if (this.parent) {
        this.parent.removeChild(this);
    }
    this.removeChildren();
    if (this._geometry) {
        this._geometry.dispose();
        this._geometry = null;
    }
    if (this._material) {
        this._material.dispose();
        this._material = null;
    }
    this._threeObj = null;
    this._texture = null;
    this._threeTexture = null;
};
