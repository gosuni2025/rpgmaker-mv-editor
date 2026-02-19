//=============================================================================
// rpg_sprites.js v1.6.2
//=============================================================================

//-----------------------------------------------------------------------------
// Sprite_Base
//
// The sprite class with a feature which displays animations.

function Sprite_Base() {
    this.initialize.apply(this, arguments);
}

Sprite_Base.prototype = Object.create(Sprite.prototype);
Sprite_Base.prototype.constructor = Sprite_Base;

Sprite_Base.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this._animationSprites = [];
    this._effectTarget = this;
    this._hiding = false;
};

Sprite_Base.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this.updateVisibility();
    this.updateAnimationSprites();
};

Sprite_Base.prototype.hide = function() {
    this._hiding = true;
    this.updateVisibility();
};

Sprite_Base.prototype.show = function() {
    this._hiding = false;
    this.updateVisibility();
};

Sprite_Base.prototype.updateVisibility = function() {
    this.visible = !this._hiding;
};

Sprite_Base.prototype.updateAnimationSprites = function() {
    if (this._animationSprites.length > 0) {
        var sprites = this._animationSprites.clone();
        this._animationSprites = [];
        for (var i = 0; i < sprites.length; i++) {
            var sprite = sprites[i];
            if (sprite.isPlaying()) {
                this._animationSprites.push(sprite);
            } else {
                sprite.remove();
            }
        }
    }
};

Sprite_Base.prototype.startAnimation = function(animation, mirror, delay) {
    var sprite = new Sprite_Animation();
    sprite.setup(this._effectTarget, animation, mirror, delay);
    this.parent.addChild(sprite);
    this._animationSprites.push(sprite);
};

Sprite_Base.prototype.isAnimationPlaying = function() {
    return this._animationSprites.length > 0;
};

//-----------------------------------------------------------------------------
// Sprite_Button
//
// The sprite for displaying a button.

function Sprite_Button() {
    this.initialize.apply(this, arguments);
}

Sprite_Button.prototype = Object.create(Sprite.prototype);
Sprite_Button.prototype.constructor = Sprite_Button;

Sprite_Button.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this._touching = false;
    this._coldFrame = null;
    this._hotFrame = null;
    this._clickHandler = null;
};

Sprite_Button.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this.updateFrame();
    this.processTouch();
};

Sprite_Button.prototype.updateFrame = function() {
    var frame;
    if (this._touching) {
        frame = this._hotFrame;
    } else {
        frame = this._coldFrame;
    }
    if (frame) {
        this.setFrame(frame.x, frame.y, frame.width, frame.height);
    }
};

Sprite_Button.prototype.setColdFrame = function(x, y, width, height) {
    this._coldFrame = new Rectangle(x, y, width, height);
};

Sprite_Button.prototype.setHotFrame = function(x, y, width, height) {
    this._hotFrame = new Rectangle(x, y, width, height);
};

Sprite_Button.prototype.setClickHandler = function(method) {
    this._clickHandler = method;
};

Sprite_Button.prototype.callClickHandler = function() {
    if (this._clickHandler) {
        this._clickHandler();
    }
};

Sprite_Button.prototype.processTouch = function() {
    if (this.isActive()) {
        if (TouchInput.isTriggered() && this.isButtonTouched()) {
            this._touching = true;
        }
        if (this._touching) {
            if (TouchInput.isReleased() || !this.isButtonTouched()) {
                this._touching = false;
                if (TouchInput.isReleased()) {
                    this.callClickHandler();
                }
            }
        }
    } else {
        this._touching = false;
    }
};

Sprite_Button.prototype.isActive = function() {
    var node = this;
    while (node) {
        if (!node.visible) {
            return false;
        }
        node = node.parent;
    }
    return true;
};

Sprite_Button.prototype.isButtonTouched = function() {
    var x = this.canvasToLocalX(TouchInput.x);
    var y = this.canvasToLocalY(TouchInput.y);
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
};

Sprite_Button.prototype.canvasToLocalX = function(x) {
    var node = this;
    while (node) {
        x -= node.x;
        node = node.parent;
    }
    return x;
};

Sprite_Button.prototype.canvasToLocalY = function(y) {
    var node = this;
    while (node) {
        y -= node.y;
        node = node.parent;
    }
    return y;
};

//-----------------------------------------------------------------------------
// Sprite_Character
//
// The sprite for displaying a character.

function Sprite_Character() {
    this.initialize.apply(this, arguments);
}

Sprite_Character.prototype = Object.create(Sprite_Base.prototype);
Sprite_Character.prototype.constructor = Sprite_Character;

Sprite_Character.prototype.initialize = function(character) {
    Sprite_Base.prototype.initialize.call(this);
    this.initMembers();
    this.setCharacter(character);
};

Sprite_Character.prototype.initMembers = function() {
    this.anchor.x = 0.5;
    this.anchor.y = 1;
    this._character = null;
    this._balloonDuration = 0;
    this._tilesetId = 0;
    this._upperBody = null;
    this._lowerBody = null;
};

Sprite_Character.prototype.setCharacter = function(character) {
    this._character = character;
};

Sprite_Character.prototype.update = function() {
    Sprite_Base.prototype.update.call(this);
    this.updateBitmap();
    this.updateFrame();
    this.updatePosition();
    this.updateAnimation();
    this.updateBalloon();
    this.updateOther();
};

Sprite_Character.prototype.updateVisibility = function() {
    Sprite_Base.prototype.updateVisibility.call(this);
    if (this._character.isTransparent()) {
        this.visible = false;
    }
};

Sprite_Character.prototype.isTile = function() {
    return this._character.tileId > 0;
};

Sprite_Character.prototype.tilesetBitmap = function(tileId) {
    var tileset = $gameMap.tileset();
    var setNumber = 5 + Math.floor(tileId / 256);
    return ImageManager.loadTileset(tileset.tilesetNames[setNumber]);
};

Sprite_Character.prototype.updateBitmap = function() {
    if (this.isImageChanged()) {
        this._tilesetId = $gameMap.tilesetId();
        this._tileId = this._character.tileId();
        this._characterName = this._character.characterName();
        this._characterIndex = this._character.characterIndex();
        if (this._tileId > 0) {
            this.setTileBitmap();
        } else {
            this.setCharacterBitmap();
        }
    }
};

Sprite_Character.prototype.isImageChanged = function() {
    return (this._tilesetId !== $gameMap.tilesetId() ||
            this._tileId !== this._character.tileId() ||
            this._characterName !== this._character.characterName() ||
            this._characterIndex !== this._character.characterIndex());
};

Sprite_Character.prototype.setTileBitmap = function() {
    this.bitmap = this.tilesetBitmap(this._tileId);
};

Sprite_Character.prototype.setCharacterBitmap = function() {
    this.bitmap = ImageManager.loadCharacter(this._characterName);
    this._isBigCharacter = ImageManager.isBigCharacter(this._characterName);
};

Sprite_Character.prototype.updateFrame = function() {
    if (this._tileId > 0) {
        this.updateTileFrame();
    } else {
        this.updateCharacterFrame();
    }
};

Sprite_Character.prototype.updateTileFrame = function() {
    var pw = this.patternWidth();
    var ph = this.patternHeight();
    var sx = (Math.floor(this._tileId / 128) % 2 * 8 + this._tileId % 8) * pw;
    var sy = Math.floor(this._tileId % 256 / 8) % 16 * ph;
    this.setFrame(sx, sy, pw, ph);
};

Sprite_Character.prototype.updateCharacterFrame = function() {
    var pw = this.patternWidth();
    var ph = this.patternHeight();
    var sx = (this.characterBlockX() + this.characterPatternX()) * pw;
    var sy = (this.characterBlockY() + this.characterPatternY()) * ph;
    this.updateHalfBodySprites();
    if (this._bushDepth > 0) {
        var d = this._bushDepth;
        this._upperBody.setFrame(sx, sy, pw, ph - d);
        this._lowerBody.setFrame(sx, sy + ph - d, pw, d);
        this.setFrame(sx, sy, 0, ph);
    } else {
        this.setFrame(sx, sy, pw, ph);
    }
};

Sprite_Character.prototype.characterBlockX = function() {
    if (this._isBigCharacter) {
        return 0;
    } else {
        var index = this._character.characterIndex();
        return index % 4 * 3;
    }
};

Sprite_Character.prototype.characterBlockY = function() {
    if (this._isBigCharacter) {
        return 0;
    } else {
        var index = this._character.characterIndex();
        return Math.floor(index / 4) * 4;
    }
};

Sprite_Character.prototype.characterPatternX = function() {
    return this._character.pattern();
};

Sprite_Character.prototype.characterPatternY = function() {
    return (this._character.direction() - 2) / 2;
};

Sprite_Character.prototype.patternWidth = function() {
    if (this._tileId > 0) {
        return $gameMap.tileWidth();
    } else if (this._isBigCharacter) {
        return this.bitmap.width / 3;
    } else {
        return this.bitmap.width / 12;
    }
};

Sprite_Character.prototype.patternHeight = function() {
    if (this._tileId > 0) {
        return $gameMap.tileHeight();
    } else if (this._isBigCharacter) {
        return this.bitmap.height / 4;
    } else {
        return this.bitmap.height / 8;
    }
};

Sprite_Character.prototype.updateHalfBodySprites = function() {
    if (this._bushDepth > 0) {
        this.createHalfBodySprites();
        this._upperBody.bitmap = this.bitmap;
        this._upperBody.visible = true;
        this._upperBody.y = - this._bushDepth;
        this._lowerBody.bitmap = this.bitmap;
        this._lowerBody.visible = true;
        this._upperBody.setBlendColor(this.getBlendColor());
        this._lowerBody.setBlendColor(this.getBlendColor());
        this._upperBody.setColorTone(this.getColorTone());
        this._lowerBody.setColorTone(this.getColorTone());
    } else if (this._upperBody) {
        this._upperBody.visible = false;
        this._lowerBody.visible = false;
    }
};

Sprite_Character.prototype.createHalfBodySprites = function() {
    if (!this._upperBody) {
        this._upperBody = new Sprite();
        this._upperBody.anchor.x = 0.5;
        this._upperBody.anchor.y = 1;
        this.addChild(this._upperBody);
    }
    if (!this._lowerBody) {
        this._lowerBody = new Sprite();
        this._lowerBody.anchor.x = 0.5;
        this._lowerBody.anchor.y = 1;
        this._lowerBody.opacity = 128;
        this.addChild(this._lowerBody);
    }
};

Sprite_Character.prototype.updatePosition = function() {
    this.x = this._character.screenX();
    this.y = this._character.screenY();
    this.z = this._character.screenZ();
};

Sprite_Character.prototype.updateAnimation = function() {
    this.setupAnimation();
    if (!this.isAnimationPlaying()) {
        this._character.endAnimation();
    }
    if (!this.isBalloonPlaying()) {
        this._character.endBalloon();
    }
};

Sprite_Character.prototype.updateOther = function() {
    this.opacity = this._character.opacity();
    this.blendMode = this._character.blendMode();
    this._bushDepth = this._character.bushDepth();
};

Sprite_Character.prototype.setupAnimation = function() {
    if (this._character.animationId() > 0) {
        var animation = $dataAnimations[this._character.animationId()];
        this.startAnimation(animation, false, 0);
        this._character.startAnimation();
    }
};

Sprite_Character.prototype.setupBalloon = function() {
    if (this._character.balloonId() > 0) {
        this.startBalloon();
        this._character.startBalloon();
    }
};

Sprite_Character.prototype.startBalloon = function() {
    if (!this._balloonSprite) {
        this._balloonSprite = new Sprite_Balloon();
    }
    this._balloonSprite.setup(this._character.balloonId());
    this.parent.addChild(this._balloonSprite);
};

Sprite_Character.prototype.updateBalloon = function() {
    this.setupBalloon();
    if (this._balloonSprite) {
        this._balloonSprite.x = this.x;
        this._balloonSprite.y = this.y - this.height;
        if (!this._balloonSprite.isPlaying()) {
            this.endBalloon();
        }
    }
};

Sprite_Character.prototype.endBalloon = function() {
    if (this._balloonSprite) {
        this.parent.removeChild(this._balloonSprite);
        this._balloonSprite = null;
    }
};

Sprite_Character.prototype.isBalloonPlaying = function() {
    return !!this._balloonSprite;
};

//-----------------------------------------------------------------------------
// Sprite_Battler
//
// The superclass of Sprite_Actor and Sprite_Enemy.

function Sprite_Battler() {
    this.initialize.apply(this, arguments);
}

Sprite_Battler.prototype = Object.create(Sprite_Base.prototype);
Sprite_Battler.prototype.constructor = Sprite_Battler;

Sprite_Battler.prototype.initialize = function(battler) {
    Sprite_Base.prototype.initialize.call(this);
    this.initMembers();
    this.setBattler(battler);
};

Sprite_Battler.prototype.initMembers = function() {
    this.anchor.x = 0.5;
    this.anchor.y = 1;
    this._battler = null;
    this._damages = [];
    this._homeX = 0;
    this._homeY = 0;
    this._offsetX = 0;
    this._offsetY = 0;
    this._targetOffsetX = NaN;
    this._targetOffsetY = NaN;
    this._movementDuration = 0;
    this._selectionEffectCount = 0;
};

Sprite_Battler.prototype.setBattler = function(battler) {
    this._battler = battler;
};

Sprite_Battler.prototype.setHome = function(x, y) {
    this._homeX = x;
    this._homeY = y;
    this.updatePosition();
};

Sprite_Battler.prototype.update = function() {
    Sprite_Base.prototype.update.call(this);
    if (this._battler) {
        this.updateMain();
        this.updateAnimation();
        this.updateDamagePopup();
        this.updateSelectionEffect();
    } else {
        this.bitmap = null;
    }
};

Sprite_Battler.prototype.updateVisibility = function() {
    Sprite_Base.prototype.updateVisibility.call(this);
    if (!this._battler || !this._battler.isSpriteVisible()) {
        this.visible = false;
    }
};

Sprite_Battler.prototype.updateMain = function() {
    if (this._battler.isSpriteVisible()) {
        this.updateBitmap();
        this.updateFrame();
    }
    this.updateMove();
    this.updatePosition();
};

Sprite_Battler.prototype.updateBitmap = function() {
};

Sprite_Battler.prototype.updateFrame = function() {
};

Sprite_Battler.prototype.updateMove = function() {
    if (this._movementDuration > 0) {
        var d = this._movementDuration;
        this._offsetX = (this._offsetX * (d - 1) + this._targetOffsetX) / d;
        this._offsetY = (this._offsetY * (d - 1) + this._targetOffsetY) / d;
        this._movementDuration--;
        if (this._movementDuration === 0) {
            this.onMoveEnd();
        }
    }
};

Sprite_Battler.prototype.updatePosition = function() {
    this.x = this._homeX + this._offsetX;
    this.y = this._homeY + this._offsetY;
};

Sprite_Battler.prototype.updateAnimation = function() {
    this.setupAnimation();
};

Sprite_Battler.prototype.updateDamagePopup = function() {
    this.setupDamagePopup();
    if (this._damages.length > 0) {
        for (var i = 0; i < this._damages.length; i++) {
            this._damages[i].update();
        }
        if (!this._damages[0].isPlaying()) {
            this.parent.removeChild(this._damages[0]);
            this._damages.shift();
        }
    }
};

Sprite_Battler.prototype.updateSelectionEffect = function() {
    var target = this._effectTarget;
    if (this._battler.isSelected()) {
        this._selectionEffectCount++;
        if (this._selectionEffectCount % 30 < 15) {
            target.setBlendColor([255, 255, 255, 64]);
        } else {
            target.setBlendColor([0, 0, 0, 0]);
        }
    } else if (this._selectionEffectCount > 0) {
        this._selectionEffectCount = 0;
        target.setBlendColor([0, 0, 0, 0]);
    }
};

Sprite_Battler.prototype.setupAnimation = function() {
    while (this._battler.isAnimationRequested()) {
        var data = this._battler.shiftAnimation();
        var animation = $dataAnimations[data.animationId];
        var mirror = data.mirror;
        var delay = animation.position === 3 ? 0 : data.delay;
        this.startAnimation(animation, mirror, delay);
        for (var i = 0; i < this._animationSprites.length; i++) {
            var sprite = this._animationSprites[i];
            sprite.visible = this._battler.isSpriteVisible();
        }
    }
};

Sprite_Battler.prototype.setupDamagePopup = function() {
    if (this._battler.isDamagePopupRequested()) {
        if (this._battler.isSpriteVisible()) {
            var sprite = new Sprite_Damage();
            sprite.x = this.x + this.damageOffsetX();
            sprite.y = this.y + this.damageOffsetY();
            sprite.setup(this._battler);
            this._damages.push(sprite);
            this.parent.addChild(sprite);
        }
        this._battler.clearDamagePopup();
        this._battler.clearResult();
    }
};

Sprite_Battler.prototype.damageOffsetX = function() {
    return 0;
};

Sprite_Battler.prototype.damageOffsetY = function() {
    return 0;
};

Sprite_Battler.prototype.startMove = function(x, y, duration) {
    if (this._targetOffsetX !== x || this._targetOffsetY !== y) {
        this._targetOffsetX = x;
        this._targetOffsetY = y;
        this._movementDuration = duration;
        if (duration === 0) {
            this._offsetX = x;
            this._offsetY = y;
        }
    }
};

Sprite_Battler.prototype.onMoveEnd = function() {
};

Sprite_Battler.prototype.isEffecting = function() {
    return false;
};

Sprite_Battler.prototype.isMoving = function() {
    return this._movementDuration > 0;
};

Sprite_Battler.prototype.inHomePosition = function() {
    return this._offsetX === 0 && this._offsetY === 0;
};

//-----------------------------------------------------------------------------
// Sprite_Actor
//
// The sprite for displaying an actor.

function Sprite_Actor() {
    this.initialize.apply(this, arguments);
}

Sprite_Actor.prototype = Object.create(Sprite_Battler.prototype);
Sprite_Actor.prototype.constructor = Sprite_Actor;

Sprite_Actor.MOTIONS = {
    walk:     { index: 0,  loop: true  },
    wait:     { index: 1,  loop: true  },
    chant:    { index: 2,  loop: true  },
    guard:    { index: 3,  loop: true  },
    damage:   { index: 4,  loop: false },
    evade:    { index: 5,  loop: false },
    thrust:   { index: 6,  loop: false },
    swing:    { index: 7,  loop: false },
    missile:  { index: 8,  loop: false },
    skill:    { index: 9,  loop: false },
    spell:    { index: 10, loop: false },
    item:     { index: 11, loop: false },
    escape:   { index: 12, loop: true  },
    victory:  { index: 13, loop: true  },
    dying:    { index: 14, loop: true  },
    abnormal: { index: 15, loop: true  },
    sleep:    { index: 16, loop: true  },
    dead:     { index: 17, loop: true  }
};

Sprite_Actor.prototype.initialize = function(battler) {
    Sprite_Battler.prototype.initialize.call(this, battler);
    this.moveToStartPosition();
};

Sprite_Actor.prototype.initMembers = function() {
    Sprite_Battler.prototype.initMembers.call(this);
    this._battlerName = '';
    this._motion = null;
    this._motionCount = 0;
    this._pattern = 0;
    this.createShadowSprite();
    this.createWeaponSprite();
    this.createMainSprite();
    this.createStateSprite();
};

Sprite_Actor.prototype.createMainSprite = function() {
    this._mainSprite = new Sprite_Base();
    this._mainSprite.anchor.x = 0.5;
    this._mainSprite.anchor.y = 1;
    this.addChild(this._mainSprite);
    this._effectTarget = this._mainSprite;
};

Sprite_Actor.prototype.createShadowSprite = function() {
    this._shadowSprite = new Sprite();
    this._shadowSprite.bitmap = ImageManager.loadSystem('Shadow2');
    this._shadowSprite.anchor.x = 0.5;
    this._shadowSprite.anchor.y = 0.5;
    this._shadowSprite.y = -2;
    this.addChild(this._shadowSprite);
};

Sprite_Actor.prototype.createWeaponSprite = function() {
    this._weaponSprite = new Sprite_Weapon();
    this.addChild(this._weaponSprite);
};

Sprite_Actor.prototype.createStateSprite = function() {
    this._stateSprite = new Sprite_StateOverlay();
    this.addChild(this._stateSprite);
};

Sprite_Actor.prototype.setBattler = function(battler) {
    Sprite_Battler.prototype.setBattler.call(this, battler);
    var changed = (battler !== this._actor);
    if (changed) {
        this._actor = battler;
        if (battler) {
            this.setActorHome(battler.index());
        }
        this.startEntryMotion();
        this._stateSprite.setup(battler);
    }
};

Sprite_Actor.prototype.moveToStartPosition = function() {
    this.startMove(300, 0, 0);
};

Sprite_Actor.prototype.setActorHome = function(index) {
    this.setHome(600 + index * 32, 280 + index * 48);
};

Sprite_Actor.prototype.update = function() {
    Sprite_Battler.prototype.update.call(this);
    this.updateShadow();
    if (this._actor) {
        this.updateMotion();
    }
};

Sprite_Actor.prototype.updateShadow = function() {
    this._shadowSprite.visible = !!this._actor;
};

Sprite_Actor.prototype.updateMain = function() {
    Sprite_Battler.prototype.updateMain.call(this);
    if (this._actor.isSpriteVisible() && !this.isMoving()) {
        this.updateTargetPosition();
    }
};

Sprite_Actor.prototype.setupMotion = function() {
    if (this._actor.isMotionRequested()) {
        this.startMotion(this._actor.motionType());
        this._actor.clearMotion();
    }
};

Sprite_Actor.prototype.setupWeaponAnimation = function() {
    if (this._actor.isWeaponAnimationRequested()) {
        this._weaponSprite.setup(this._actor.weaponImageId());
        this._actor.clearWeaponAnimation();
    }
};

Sprite_Actor.prototype.startMotion = function(motionType) {
    var newMotion = Sprite_Actor.MOTIONS[motionType];
    if (this._motion !== newMotion) {
        this._motion = newMotion;
        this._motionCount = 0;
        this._pattern = 0;
    }
};

Sprite_Actor.prototype.updateTargetPosition = function() {
    if (this._actor.isInputting() || this._actor.isActing()) {
        this.stepForward();
    } else if (this._actor.canMove() && BattleManager.isEscaped()) {
        this.retreat();
    } else if (!this.inHomePosition()) {
        this.stepBack();
    }
};

Sprite_Actor.prototype.updateBitmap = function() {
    Sprite_Battler.prototype.updateBitmap.call(this);
    var name = this._actor.battlerName();
    if (this._battlerName !== name) {
        this._battlerName = name;
        this._mainSprite.bitmap = ImageManager.loadSvActor(name);
    }
};

Sprite_Actor.prototype.updateFrame = function() {
    Sprite_Battler.prototype.updateFrame.call(this);
    var bitmap = this._mainSprite.bitmap;
    if (bitmap) {
        var motionIndex = this._motion ? this._motion.index : 0;
        var pattern = this._pattern < 3 ? this._pattern : 1;
        var cw = bitmap.width / 9;
        var ch = bitmap.height / 6;
        var cx = Math.floor(motionIndex / 6) * 3 + pattern;
        var cy = motionIndex % 6;
        this._mainSprite.setFrame(cx * cw, cy * ch, cw, ch);
    }
};

Sprite_Actor.prototype.updateMove = function() {
    var bitmap = this._mainSprite.bitmap;
    if (!bitmap || bitmap.isReady()) {
        Sprite_Battler.prototype.updateMove.call(this);
    }
};

Sprite_Actor.prototype.updateMotion = function() {
    this.setupMotion();
    this.setupWeaponAnimation();
    if (this._actor.isMotionRefreshRequested()) {
        this.refreshMotion();
        this._actor.clearMotion();
    }
    this.updateMotionCount();
};

Sprite_Actor.prototype.updateMotionCount = function() {
    if (this._motion && ++this._motionCount >= this.motionSpeed()) {
        if (this._motion.loop) {
            this._pattern = (this._pattern + 1) % 4;
        } else if (this._pattern < 2) {
            this._pattern++;
        } else {
            this.refreshMotion();
        }
        this._motionCount = 0;
    }
};

Sprite_Actor.prototype.motionSpeed = function() {
    return 12;
};

Sprite_Actor.prototype.refreshMotion = function() {
    var actor = this._actor;
    var motionGuard = Sprite_Actor.MOTIONS['guard'];
    if (actor) {
        if (this._motion === motionGuard && !BattleManager.isInputting()) {
                return;
        }
        var stateMotion = actor.stateMotionIndex();
        if (actor.isInputting() || actor.isActing()) {
            this.startMotion('walk');
        } else if (stateMotion === 3) {
            this.startMotion('dead');
        } else if (stateMotion === 2) {
            this.startMotion('sleep');
        } else if (actor.isChanting()) {
            this.startMotion('chant');
        } else if (actor.isGuard() || actor.isGuardWaiting()) {
            this.startMotion('guard');
        } else if (stateMotion === 1) {
            this.startMotion('abnormal');
        } else if (actor.isDying()) {
            this.startMotion('dying');
        } else if (actor.isUndecided()) {
            this.startMotion('walk');
        } else {
            this.startMotion('wait');
        }
    }
};

Sprite_Actor.prototype.startEntryMotion = function() {
    if (this._actor && this._actor.canMove()) {
        this.startMotion('walk');
        this.startMove(0, 0, 30);
    } else if (!this.isMoving()) {
        this.refreshMotion();
        this.startMove(0, 0, 0);
    }
};

Sprite_Actor.prototype.stepForward = function() {
    this.startMove(-48, 0, 12);
};

Sprite_Actor.prototype.stepBack = function() {
    this.startMove(0, 0, 12);
};

Sprite_Actor.prototype.retreat = function() {
    this.startMove(300, 0, 30);
};

Sprite_Actor.prototype.onMoveEnd = function() {
    Sprite_Battler.prototype.onMoveEnd.call(this);
    if (!BattleManager.isBattleEnd()) {
        this.refreshMotion();
    }
};

Sprite_Actor.prototype.damageOffsetX = function() {
    return -32;
};

Sprite_Actor.prototype.damageOffsetY = function() {
    return 0;
};

//-----------------------------------------------------------------------------
// Sprite_Enemy
//
// The sprite for displaying an enemy.

function Sprite_Enemy() {
    this.initialize.apply(this, arguments);
}

Sprite_Enemy.prototype = Object.create(Sprite_Battler.prototype);
Sprite_Enemy.prototype.constructor = Sprite_Enemy;

Sprite_Enemy.prototype.initialize = function(battler) {
    Sprite_Battler.prototype.initialize.call(this, battler);
};

Sprite_Enemy.prototype.initMembers = function() {
    Sprite_Battler.prototype.initMembers.call(this);
    this._enemy = null;
    this._appeared = false;
    this._battlerName = '';
    this._battlerHue = 0;
    this._effectType = null;
    this._effectDuration = 0;
    this._shake = 0;
    this.createStateIconSprite();
};

Sprite_Enemy.prototype.createStateIconSprite = function() {
    this._stateIconSprite = new Sprite_StateIcon();
    this.addChild(this._stateIconSprite);
};

Sprite_Enemy.prototype.setBattler = function(battler) {
    Sprite_Battler.prototype.setBattler.call(this, battler);
    this._enemy = battler;
    this.setHome(battler.screenX(), battler.screenY());
    this._stateIconSprite.setup(battler);
};

Sprite_Enemy.prototype.update = function() {
    Sprite_Battler.prototype.update.call(this);
    if (this._enemy) {
        this.updateEffect();
        this.updateStateSprite();
    }
};

Sprite_Enemy.prototype.updateBitmap = function() {
    Sprite_Battler.prototype.updateBitmap.call(this);
    var name = this._enemy.battlerName();
    var hue = this._enemy.battlerHue();
    if (this._battlerName !== name || this._battlerHue !== hue) {
        this._battlerName = name;
        this._battlerHue = hue;
        this.loadBitmap(name, hue);
        this.initVisibility();
    }
};

Sprite_Enemy.prototype.loadBitmap = function(name, hue) {
    if ($gameSystem.isSideView()) {
        this.bitmap = ImageManager.loadSvEnemy(name, hue);
    } else {
        this.bitmap = ImageManager.loadEnemy(name, hue);
    }
};

Sprite_Enemy.prototype.updateFrame = function() {
    Sprite_Battler.prototype.updateFrame.call(this);
    var frameHeight = this.bitmap.height;
    if (this._effectType === 'bossCollapse') {
        frameHeight = this._effectDuration;
    }
    this.setFrame(0, 0, this.bitmap.width, frameHeight);
};

Sprite_Enemy.prototype.updatePosition = function() {
    Sprite_Battler.prototype.updatePosition.call(this);
    this.x += this._shake;
};

Sprite_Enemy.prototype.updateStateSprite = function() {
    this._stateIconSprite.y = -Math.round((this.bitmap.height + 40) * 0.9);
    if (this._stateIconSprite.y < 20 - this.y) {
        this._stateIconSprite.y = 20 - this.y;
    }
};

Sprite_Enemy.prototype.initVisibility = function() {
    this._appeared = this._enemy.isAlive();
    if (!this._appeared) {
        this.opacity = 0;
    }
};

Sprite_Enemy.prototype.setupEffect = function() {
    if (this._appeared && this._enemy.isEffectRequested()) {
        this.startEffect(this._enemy.effectType());
        this._enemy.clearEffect();
    }
    if (!this._appeared && this._enemy.isAlive()) {
        this.startEffect('appear');
    } else if (this._appeared && this._enemy.isHidden()) {
        this.startEffect('disappear');
    }
};

Sprite_Enemy.prototype.startEffect = function(effectType) {
    this._effectType = effectType;
    switch (this._effectType) {
    case 'appear':
        this.startAppear();
        break;
    case 'disappear':
        this.startDisappear();
        break;
    case 'whiten':
        this.startWhiten();
        break;
    case 'blink':
        this.startBlink();
        break;
    case 'collapse':
        this.startCollapse();
        break;
    case 'bossCollapse':
        this.startBossCollapse();
        break;
    case 'instantCollapse':
        this.startInstantCollapse();
        break;
    }
    this.revertToNormal();
};

Sprite_Enemy.prototype.startAppear = function() {
    this._effectDuration = 16;
    this._appeared = true;
};

Sprite_Enemy.prototype.startDisappear = function() {
    this._effectDuration = 32;
    this._appeared = false;
};

Sprite_Enemy.prototype.startWhiten = function() {
    this._effectDuration = 16;
};

Sprite_Enemy.prototype.startBlink = function() {
    this._effectDuration = 20;
};

Sprite_Enemy.prototype.startCollapse = function() {
    this._effectDuration = 32;
    this._appeared = false;
};

Sprite_Enemy.prototype.startBossCollapse = function() {
    this._effectDuration = this.bitmap.height;
    this._appeared = false;
};

Sprite_Enemy.prototype.startInstantCollapse = function() {
    this._effectDuration = 16;
    this._appeared = false;
};

Sprite_Enemy.prototype.updateEffect = function() {
    this.setupEffect();
    if (this._effectDuration > 0) {
        this._effectDuration--;
        switch (this._effectType) {
        case 'whiten':
            this.updateWhiten();
            break;
        case 'blink':
            this.updateBlink();
            break;
        case 'appear':
            this.updateAppear();
            break;
        case 'disappear':
            this.updateDisappear();
            break;
        case 'collapse':
            this.updateCollapse();
            break;
        case 'bossCollapse':
            this.updateBossCollapse();
            break;
        case 'instantCollapse':
            this.updateInstantCollapse();
            break;
        }
        if (this._effectDuration === 0) {
            this._effectType = null;
        }
    }
};

Sprite_Enemy.prototype.isEffecting = function() {
    return this._effectType !== null;
};

Sprite_Enemy.prototype.revertToNormal = function() {
    this._shake = 0;
    this.blendMode = 0;
    this.opacity = 255;
    this.setBlendColor([0, 0, 0, 0]);
};

Sprite_Enemy.prototype.updateWhiten = function() {
    var alpha = 128 - (16 - this._effectDuration) * 10;
    this.setBlendColor([255, 255, 255, alpha]);
};

Sprite_Enemy.prototype.updateBlink = function() {
    this.opacity = (this._effectDuration % 10 < 5) ? 255 : 0;
};

Sprite_Enemy.prototype.updateAppear = function() {
    this.opacity = (16 - this._effectDuration) * 16;
};

Sprite_Enemy.prototype.updateDisappear = function() {
    this.opacity = 256 - (32 - this._effectDuration) * 10;
};

Sprite_Enemy.prototype.updateCollapse = function() {
    this.blendMode = Graphics.BLEND_ADD;
    this.setBlendColor([255, 128, 128, 128]);
    this.opacity *= this._effectDuration / (this._effectDuration + 1);
};

Sprite_Enemy.prototype.updateBossCollapse = function() {
    this._shake = this._effectDuration % 2 * 4 - 2;
    this.blendMode = Graphics.BLEND_ADD;
    this.opacity *= this._effectDuration / (this._effectDuration + 1);
    this.setBlendColor([255, 255, 255, 255 - this.opacity]);
    if (this._effectDuration % 20 === 19) {
        SoundManager.playBossCollapse2();
    }
};

Sprite_Enemy.prototype.updateInstantCollapse = function() {
    this.opacity = 0;
};

Sprite_Enemy.prototype.damageOffsetX = function() {
    return 0;
};

Sprite_Enemy.prototype.damageOffsetY = function() {
    return -8;
};

//-----------------------------------------------------------------------------
// Sprite_Animation
//
// The sprite for displaying an animation.

function Sprite_Animation() {
    this.initialize.apply(this, arguments);
}

Sprite_Animation.prototype = Object.create(Sprite.prototype);
Sprite_Animation.prototype.constructor = Sprite_Animation;

Sprite_Animation._checker1 = {};
Sprite_Animation._checker2 = {};

Sprite_Animation.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this._reduceArtifacts = true;
    this.initMembers();
};

Sprite_Animation.prototype.initMembers = function() {
    this._target = null;
    this._animation = null;
    this._mirror = false;
    this._delay = 0;
    this._rate = 4;
    this._duration = 0;
    this._flashColor = [0, 0, 0, 0];
    this._flashDuration = 0;
    this._screenFlashDuration = 0;
    this._hidingDuration = 0;
    this._bitmap1 = null;
    this._bitmap2 = null;
    this._cellSprites = [];
    this._screenFlashSprite = null;
    this._duplicated = false;
    this.z = 8;
};

Sprite_Animation.prototype.setup = function(target, animation, mirror, delay) {
    this._target = target;
    this._animation = animation;
    this._mirror = mirror;
    this._delay = delay;
    if (this._animation) {
        this.remove();
        this.setupRate();
        this.setupDuration();
        this.loadBitmaps();
        this.createSprites();
    }
};

Sprite_Animation.prototype.remove = function() {
    if (this.parent && this.parent.removeChild(this)) {
        this._target.setBlendColor([0, 0, 0, 0]);
        this._target.show();
    }
};

Sprite_Animation.prototype.setupRate = function() {
    this._rate = 4;
};

Sprite_Animation.prototype.setupDuration = function() {
    this._duration = this._animation.frames.length * this._rate + 1;
};

Sprite_Animation.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this.updateMain();
    this.updateFlash();
    this.updateScreenFlash();
    this.updateHiding();
    Sprite_Animation._checker1 = {};
    Sprite_Animation._checker2 = {};
};

Sprite_Animation.prototype.updateFlash = function() {
    if (this._flashDuration > 0) {
        var d = this._flashDuration--;
        this._flashColor[3] *= (d - 1) / d;
        this._target.setBlendColor(this._flashColor);
    }
};

Sprite_Animation.prototype.updateScreenFlash = function() {
    if (this._screenFlashDuration > 0) {
        var d = this._screenFlashDuration--;
        if (this._screenFlashSprite) {
            this._screenFlashSprite.x = -this.absoluteX();
            this._screenFlashSprite.y = -this.absoluteY();
            this._screenFlashSprite.opacity *= (d - 1) / d;
            this._screenFlashSprite.visible = (this._screenFlashDuration > 0);
        }
    }
};

Sprite_Animation.prototype.absoluteX = function() {
    var x = 0;
    var object = this;
    while (object) {
        x += object.x;
        object = object.parent;
    }
    return x;
};

Sprite_Animation.prototype.absoluteY = function() {
    var y = 0;
    var object = this;
    while (object) {
        y += object.y;
        object = object.parent;
    }
    return y;
};

Sprite_Animation.prototype.updateHiding = function() {
    if (this._hidingDuration > 0) {
        this._hidingDuration--;
        if (this._hidingDuration === 0) {
            this._target.show();
        }
    }
};

Sprite_Animation.prototype.isPlaying = function() {
    return this._duration > 0;
};

Sprite_Animation.prototype.loadBitmaps = function() {
    var name1 = this._animation.animation1Name;
    var name2 = this._animation.animation2Name;
    var hue1 = this._animation.animation1Hue;
    var hue2 = this._animation.animation2Hue;
    this._bitmap1 = ImageManager.loadAnimation(name1, hue1);
    this._bitmap2 = ImageManager.loadAnimation(name2, hue2);
};

Sprite_Animation.prototype.isReady = function() {
    return this._bitmap1 && this._bitmap1.isReady() && this._bitmap2 && this._bitmap2.isReady();
};

Sprite_Animation.prototype.createSprites = function() {
    if (!Sprite_Animation._checker2[this._animation]) {
        this.createCellSprites();
        if (this._animation.position === 3) {
            Sprite_Animation._checker2[this._animation] = true;
        }
        this.createScreenFlashSprite();
    }
    if (Sprite_Animation._checker1[this._animation]) {
        this._duplicated = true;
    } else {
        this._duplicated = false;
        if (this._animation.position === 3) {
            Sprite_Animation._checker1[this._animation] = true;
        }
    }
};

Sprite_Animation.prototype.createCellSprites = function() {
    this._cellSprites = [];
    for (var i = 0; i < 16; i++) {
        var sprite = new Sprite();
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
        this._cellSprites.push(sprite);
        this.addChild(sprite);
    }
};

Sprite_Animation.prototype.createScreenFlashSprite = function() {
    this._screenFlashSprite = new ScreenSprite();
    this.addChild(this._screenFlashSprite);
};

Sprite_Animation.prototype.updateMain = function() {
    if (this.isPlaying() && this.isReady()) {
        if (this._delay > 0) {
            this._delay--;
        } else {
            this._duration--;
            this.updatePosition();
            if (this._duration % this._rate === 0) {
                this.updateFrame();
            }
        }
    }
};

Sprite_Animation.prototype.updatePosition = function() {
    if (this._animation.position === 3) {
        this.x = this.parent.width / 2;
        this.y = this.parent.height / 2;
    } else {
        var parent = this._target.parent;
        var grandparent = parent ? parent.parent : null;
        this.x = this._target.x;
        this.y = this._target.y;
        if (this.parent === grandparent) {
            this.x += parent.x;
            this.y += parent.y;
        }
        if (this._animation.position === 0) {
            this.y -= this._target.height;
        } else if (this._animation.position === 1) {
            this.y -= this._target.height / 2;
        }
    }
};

Sprite_Animation.prototype.updateFrame = function() {
    if (this._duration > 0) {
        var frameIndex = this.currentFrameIndex();
        this.updateAllCellSprites(this._animation.frames[frameIndex]);
        this._animation.timings.forEach(function(timing) {
            if (timing.frame === frameIndex) {
                this.processTimingData(timing);
            }
        }, this);
    }
};

Sprite_Animation.prototype.currentFrameIndex = function() {
    return (this._animation.frames.length -
            Math.floor((this._duration + this._rate - 1) / this._rate));
};

Sprite_Animation.prototype.updateAllCellSprites = function(frame) {
    for (var i = 0; i < this._cellSprites.length; i++) {
        var sprite = this._cellSprites[i];
        if (i < frame.length) {
            this.updateCellSprite(sprite, frame[i]);
        } else {
            sprite.visible = false;
        }
    }
};

Sprite_Animation.prototype.updateCellSprite = function(sprite, cell) {
    var pattern = cell[0];
    if (pattern >= 0) {
        var sx = pattern % 5 * 192;
        var sy = Math.floor(pattern % 100 / 5) * 192;
        var mirror = this._mirror;
        sprite.bitmap = pattern < 100 ? this._bitmap1 : this._bitmap2;
        sprite.setFrame(sx, sy, 192, 192);
        sprite.x = cell[1];
        sprite.y = cell[2];
        sprite.rotation = cell[4] * Math.PI / 180;
        sprite.scale.x = cell[3] / 100;

        if(cell[5]){
            sprite.scale.x *= -1;
        }
        if(mirror){
            sprite.x *= -1;
            sprite.rotation *= -1;
            sprite.scale.x *= -1;
        }

        sprite.scale.y = cell[3] / 100;
        sprite.opacity = cell[6];
        sprite.blendMode = cell[7];
        sprite.visible = true;
    } else {
        sprite.visible = false;
    }
};

Sprite_Animation.prototype.processTimingData = function(timing) {
    var duration = timing.flashDuration * this._rate;
    switch (timing.flashScope) {
    case 1:
        this.startFlash(timing.flashColor, duration);
        break;
    case 2:
        this.startScreenFlash(timing.flashColor, duration);
        break;
    case 3:
        this.startHiding(duration);
        break;
    }
    if (!this._duplicated && timing.se) {
        AudioManager.playSe(timing.se);
    }
};

Sprite_Animation.prototype.startFlash = function(color, duration) {
    this._flashColor = color.clone();
    this._flashDuration = duration;
};

Sprite_Animation.prototype.startScreenFlash = function(color, duration) {
    this._screenFlashDuration = duration;
    if (this._screenFlashSprite) {
        this._screenFlashSprite.setColor(color[0], color[1], color[2]);
        this._screenFlashSprite.opacity = color[3];
    }
};

Sprite_Animation.prototype.startHiding = function(duration) {
    this._hidingDuration = duration;
    this._target.hide();
};

//-----------------------------------------------------------------------------
// Sprite_Damage
//
// The sprite for displaying a popup damage.

function Sprite_Damage() {
    this.initialize.apply(this, arguments);
}

Sprite_Damage.prototype = Object.create(Sprite.prototype);
Sprite_Damage.prototype.constructor = Sprite_Damage;

Sprite_Damage.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this._duration = 90;
    this._flashColor = [0, 0, 0, 0];
    this._flashDuration = 0;
    this._damageBitmap = ImageManager.loadSystem('Damage');
};

Sprite_Damage.prototype.setup = function(target) {
    var result = target.result();
    if (result.missed || result.evaded) {
        this.createMiss();
    } else if (result.hpAffected) {
        this.createDigits(0, result.hpDamage);
    } else if (target.isAlive() && result.mpDamage !== 0) {
        this.createDigits(2, result.mpDamage);
    }
    if (result.critical) {
        this.setupCriticalEffect();
    }
};

Sprite_Damage.prototype.setupCriticalEffect = function() {
    this._flashColor = [255, 0, 0, 160];
    this._flashDuration = 60;
};

Sprite_Damage.prototype.digitWidth = function() {
    return this._damageBitmap ? this._damageBitmap.width / 10 : 0;
};

Sprite_Damage.prototype.digitHeight = function() {
    return this._damageBitmap ? this._damageBitmap.height / 5 : 0;
};

Sprite_Damage.prototype.createMiss = function() {
    var w = this.digitWidth();
    var h = this.digitHeight();
    var sprite = this.createChildSprite();
    sprite.setFrame(0, 4 * h, 4 * w, h);
    sprite.dy = 0;
};

Sprite_Damage.prototype.createDigits = function(baseRow, value) {
    var string = Math.abs(value).toString();
    var row = baseRow + (value < 0 ? 1 : 0);
    var w = this.digitWidth();
    var h = this.digitHeight();
    for (var i = 0; i < string.length; i++) {
        var sprite = this.createChildSprite();
        var n = Number(string[i]);
        sprite.setFrame(n * w, row * h, w, h);
        sprite.x = (i - (string.length - 1) / 2) * w;
        sprite.dy = -i;
    }
};

Sprite_Damage.prototype.createChildSprite = function() {
    var sprite = new Sprite();
    sprite.bitmap = this._damageBitmap;
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 1;
    sprite.y = -40;
    sprite.ry = sprite.y;
    this.addChild(sprite);
    return sprite;
};

Sprite_Damage.prototype.update = function() {
    Sprite.prototype.update.call(this);
    if (this._duration > 0) {
        this._duration--;
        for (var i = 0; i < this.children.length; i++) {
            this.updateChild(this.children[i]);
        }
    }
    this.updateFlash();
    this.updateOpacity();
};

Sprite_Damage.prototype.updateChild = function(sprite) {
    sprite.dy += 0.5;
    sprite.ry += sprite.dy;
    if (sprite.ry >= 0) {
        sprite.ry = 0;
        sprite.dy *= -0.6;
    }
    sprite.y = Math.round(sprite.ry);
    sprite.setBlendColor(this._flashColor);
};

Sprite_Damage.prototype.updateFlash = function() {
    if (this._flashDuration > 0) {
        var d = this._flashDuration--;
        this._flashColor[3] *= (d - 1) / d;
    }
};

Sprite_Damage.prototype.updateOpacity = function() {
    if (this._duration < 10) {
        this.opacity = 255 * this._duration / 10;
    }
};

Sprite_Damage.prototype.isPlaying = function() {
    return this._duration > 0;
};

//-----------------------------------------------------------------------------
// Sprite_StateIcon
//
// The sprite for displaying state icons.

function Sprite_StateIcon() {
    this.initialize.apply(this, arguments);
}

Sprite_StateIcon.prototype = Object.create(Sprite.prototype);
Sprite_StateIcon.prototype.constructor = Sprite_StateIcon;

Sprite_StateIcon.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this.initMembers();
    this.loadBitmap();
};

Sprite_StateIcon._iconWidth  = 32;
Sprite_StateIcon._iconHeight = 32;

Sprite_StateIcon.prototype.initMembers = function() {
    this._battler = null;
    this._iconIndex = 0;
    this._animationCount = 0;
    this._animationIndex = 0;
    this.anchor.x = 0.5;
    this.anchor.y = 0.5;
};

Sprite_StateIcon.prototype.loadBitmap = function() {
    this.bitmap = ImageManager.loadSystem('IconSet');
    this.setFrame(0, 0, 0, 0);
};

Sprite_StateIcon.prototype.setup = function(battler) {
    this._battler = battler;
};

Sprite_StateIcon.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this._animationCount++;
    if (this._animationCount >= this.animationWait()) {
        this.updateIcon();
        this.updateFrame();
        this._animationCount = 0;
    }
};

Sprite_StateIcon.prototype.animationWait = function() {
    return 40;
};

Sprite_StateIcon.prototype.updateIcon = function() {
    var icons = [];
    if (this._battler && this._battler.isAlive()) {
        icons = this._battler.allIcons();
    }
    if (icons.length > 0) {
        this._animationIndex++;
        if (this._animationIndex >= icons.length) {
            this._animationIndex = 0;
        }
        this._iconIndex = icons[this._animationIndex];
    } else {
        this._animationIndex = 0;
        this._iconIndex = 0;
    }
};

Sprite_StateIcon.prototype.updateFrame = function() {
    var pw = Sprite_StateIcon._iconWidth;
    var ph = Sprite_StateIcon._iconHeight;
    var sx = this._iconIndex % 16 * pw;
    var sy = Math.floor(this._iconIndex / 16) * ph;
    this.setFrame(sx, sy, pw, ph);
};

//-----------------------------------------------------------------------------
// Sprite_StateOverlay
//
// The sprite for displaying an overlay image for a state.

function Sprite_StateOverlay() {
    this.initialize.apply(this, arguments);
}

Sprite_StateOverlay.prototype = Object.create(Sprite_Base.prototype);
Sprite_StateOverlay.prototype.constructor = Sprite_StateOverlay;

Sprite_StateOverlay.prototype.initialize = function() {
    Sprite_Base.prototype.initialize.call(this);
    this.initMembers();
    this.loadBitmap();
};

Sprite_StateOverlay.prototype.initMembers = function() {
    this._battler = null;
    this._overlayIndex = 0;
    this._animationCount = 0;
    this._pattern = 0;
    this.anchor.x = 0.5;
    this.anchor.y = 1;
};

Sprite_StateOverlay.prototype.loadBitmap = function() {
    this.bitmap = ImageManager.loadSystem('States');
    this.setFrame(0, 0, 0, 0);
};

Sprite_StateOverlay.prototype.setup = function(battler) {
    this._battler = battler;
};

Sprite_StateOverlay.prototype.update = function() {
    Sprite_Base.prototype.update.call(this);
    this._animationCount++;
    if (this._animationCount >= this.animationWait()) {
        this.updatePattern();
        this.updateFrame();
        this._animationCount = 0;
    }
};

Sprite_StateOverlay.prototype.animationWait = function() {
    return 8;
};

Sprite_StateOverlay.prototype.updatePattern = function() {
    this._pattern++;
    this._pattern %= 8;
    if (this._battler) {
        this._overlayIndex = this._battler.stateOverlayIndex();
    }
};

Sprite_StateOverlay.prototype.updateFrame = function() {
    if (this._overlayIndex > 0) {
        var w = 96;
        var h = 96;
        var sx = this._pattern * w;
        var sy = (this._overlayIndex - 1) * h;
        this.setFrame(sx, sy, w, h);
    } else {
        this.setFrame(0, 0, 0, 0);
    }
};

//-----------------------------------------------------------------------------
// Sprite_Weapon
//
// The sprite for displaying a weapon image for attacking.

function Sprite_Weapon() {
    this.initialize.apply(this, arguments);
}

Sprite_Weapon.prototype = Object.create(Sprite_Base.prototype);
Sprite_Weapon.prototype.constructor = Sprite_Weapon;

Sprite_Weapon.prototype.initialize = function() {
    Sprite_Base.prototype.initialize.call(this);
    this.initMembers();
};

Sprite_Weapon.prototype.initMembers = function() {
    this._weaponImageId = 0;
    this._animationCount = 0;
    this._pattern = 0;
    this.anchor.x = 0.5;
    this.anchor.y = 1;
    this.x = -16;
};

Sprite_Weapon.prototype.setup = function(weaponImageId) {
    this._weaponImageId = weaponImageId;
    this._animationCount = 0;
    this._pattern = 0;
    this.loadBitmap();
    this.updateFrame();
};

Sprite_Weapon.prototype.update = function() {
    Sprite_Base.prototype.update.call(this);
    this._animationCount++;
    if (this._animationCount >= this.animationWait()) {
        this.updatePattern();
        this.updateFrame();
        this._animationCount = 0;
    }
};

Sprite_Weapon.prototype.animationWait = function() {
    return 12;
};

Sprite_Weapon.prototype.updatePattern = function() {
    this._pattern++;
    if (this._pattern >= 3) {
        this._weaponImageId = 0;
    }
};

Sprite_Weapon.prototype.loadBitmap = function() {
    var pageId = Math.floor((this._weaponImageId - 1) / 12) + 1;
    if (pageId >= 1) {
        this.bitmap = ImageManager.loadSystem('Weapons' + pageId);
    } else {
        this.bitmap = ImageManager.loadSystem('');
    }
};

Sprite_Weapon.prototype.updateFrame = function() {
    if (this._weaponImageId > 0) {
        var index = (this._weaponImageId - 1) % 12;
        var w = 96;
        var h = 64;
        var sx = (Math.floor(index / 6) * 3 + this._pattern) * w;
        var sy = Math.floor(index % 6) * h;
        this.setFrame(sx, sy, w, h);
    } else {
        this.setFrame(0, 0, 0, 0);
    }
};

Sprite_Weapon.prototype.isPlaying = function() {
    return this._weaponImageId > 0;
};

//-----------------------------------------------------------------------------
// Sprite_Balloon
//
// The sprite for displaying a balloon icon.

function Sprite_Balloon() {
    this.initialize.apply(this, arguments);
}

Sprite_Balloon.prototype = Object.create(Sprite_Base.prototype);
Sprite_Balloon.prototype.constructor = Sprite_Balloon;

Sprite_Balloon.prototype.initialize = function() {
    Sprite_Base.prototype.initialize.call(this);
    this.initMembers();
    this.loadBitmap();
};

Sprite_Balloon.prototype.initMembers = function() {
    this._balloonId = 0;
    this._duration = 0;
    this.anchor.x = 0.5;
    this.anchor.y = 1;
    this.z = 7;
};

Sprite_Balloon.prototype.loadBitmap = function() {
    this.bitmap = ImageManager.loadSystem('Balloon');
    this.setFrame(0, 0, 0, 0);
};

Sprite_Balloon.prototype.setup = function(balloonId) {
    this._balloonId = balloonId;
    this._duration = 8 * this.speed() + this.waitTime();
};

Sprite_Balloon.prototype.update = function() {
    Sprite_Base.prototype.update.call(this);
    if (this._duration > 0) {
        this._duration--;
        if (this._duration > 0) {
            this.updateFrame();
        }
    }
};

Sprite_Balloon.prototype.updateFrame = function() {
    var w = 48;
    var h = 48;
    var sx = this.frameIndex() * w;
    var sy = (this._balloonId - 1) * h;
    this.setFrame(sx, sy, w, h);
};

Sprite_Balloon.prototype.speed = function() {
    return 8;
};

Sprite_Balloon.prototype.waitTime = function() {
    return 12;
};

Sprite_Balloon.prototype.frameIndex = function() {
    var index = (this._duration - this.waitTime()) / this.speed();
    return 7 - Math.max(Math.floor(index), 0);
};

Sprite_Balloon.prototype.isPlaying = function() {
    return this._duration > 0;
};

//-----------------------------------------------------------------------------
// Sprite_Picture
//
// The sprite for displaying a picture.

function Sprite_Picture() {
    this.initialize.apply(this, arguments);
}

Sprite_Picture.prototype = Object.create(Sprite.prototype);
Sprite_Picture.prototype.constructor = Sprite_Picture;

Sprite_Picture.prototype.initialize = function(pictureId) {
    Sprite.prototype.initialize.call(this);
    this._pictureId = pictureId;
    this._pictureName = '';
    this._isPicture = true;
    this.update();
};

Sprite_Picture.prototype.picture = function() {
    return $gameScreen.picture(this._pictureId);
};

Sprite_Picture.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this.updateBitmap();
    if (this.visible) {
        this.updateOrigin();
        this.updatePosition();
        this.updateScale();
        this.updateTone();
        this.updateOther();
    }
};

Sprite_Picture.prototype.updateBitmap = function() {
    var picture = this.picture();
    if (picture) {
        var pictureName = picture.name();
        if (this._pictureName !== pictureName) {
            this._pictureName = pictureName;
            this.loadBitmap();
        }
        this.visible = true;
    } else {
        this._pictureName = '';
        this.bitmap = null;
        this.visible = false;
    }
};

Sprite_Picture.prototype.updateOrigin = function() {
    var picture = this.picture();
    if (picture.origin() === 0) {
        this.anchor.x = 0;
        this.anchor.y = 0;
    } else {
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
    }
};

Sprite_Picture.prototype.updatePosition = function() {
    var picture = this.picture();
    this.x = Math.floor(picture.x());
    this.y = Math.floor(picture.y());
};

Sprite_Picture.prototype.updateScale = function() {
    var picture = this.picture();
    this.scale.x = picture.scaleX() / 100;
    this.scale.y = picture.scaleY() / 100;
};

Sprite_Picture.prototype.updateTone = function() {
    var picture = this.picture();
    if (picture.tone()) {
        this.setColorTone(picture.tone());
    } else {
        this.setColorTone([0, 0, 0, 0]);
    }
};

Sprite_Picture.prototype.updateOther = function() {
    var picture = this.picture();
    this.opacity = picture.opacity();
    this.blendMode = picture.blendMode();
    this.rotation = picture.angle() * Math.PI / 180;
};

Sprite_Picture.prototype.loadBitmap = function() {
    this.bitmap = ImageManager.loadPicture(this._pictureName);
};

//-----------------------------------------------------------------------------
// Sprite_Timer
//
// The sprite for displaying the timer.

function Sprite_Timer() {
    this.initialize.apply(this, arguments);
}

Sprite_Timer.prototype = Object.create(Sprite.prototype);
Sprite_Timer.prototype.constructor = Sprite_Timer;

Sprite_Timer.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this._seconds = 0;
    this.createBitmap();
    this.update();
};

Sprite_Timer.prototype.createBitmap = function() {
    this.bitmap = new Bitmap(96, 48);
    this.bitmap.fontSize = 32;
};

Sprite_Timer.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this.updateBitmap();
    this.updatePosition();
    this.updateVisibility();
};

Sprite_Timer.prototype.updateBitmap = function() {
    if (this._seconds !== $gameTimer.seconds()) {
        this._seconds = $gameTimer.seconds();
        this.redraw();
    }
};

Sprite_Timer.prototype.redraw = function() {
    var text = this.timerText();
    var width = this.bitmap.width;
    var height = this.bitmap.height;
    this.bitmap.clear();
    this.bitmap.drawText(text, 0, 0, width, height, 'center');
};

Sprite_Timer.prototype.timerText = function() {
    var min = Math.floor(this._seconds / 60) % 60;
    var sec = this._seconds % 60;
    return min.padZero(2) + ':' + sec.padZero(2);
};

Sprite_Timer.prototype.updatePosition = function() {
    this.x = Graphics.width - this.bitmap.width;
    this.y = 0;
};

Sprite_Timer.prototype.updateVisibility = function() {
    this.visible = $gameTimer.isWorking();
};

//-----------------------------------------------------------------------------
// Sprite_Destination
//
// The sprite for displaying the destination place of the touch input.

function Sprite_Destination() {
    this.initialize.apply(this, arguments);
}

Sprite_Destination.prototype = Object.create(Sprite.prototype);
Sprite_Destination.prototype.constructor = Sprite_Destination;

Sprite_Destination.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this.createBitmap();
    this._frameCount = 0;
};

Sprite_Destination.prototype.update = function() {
    Sprite.prototype.update.call(this);
    if ($gameTemp.isDestinationValid()){
        this.updatePosition();
        this.updateAnimation();
        this.visible = true;
    } else {
        this._frameCount = 0;
        this.visible = false;
    }
};

Sprite_Destination.prototype.createBitmap = function() {
    var tileWidth = $gameMap.tileWidth();
    var tileHeight = $gameMap.tileHeight();
    this.bitmap = new Bitmap(tileWidth, tileHeight);
    this.bitmap.fillAll('white');
    this.anchor.x = 0.5;
    this.anchor.y = 0.5;
    this.blendMode = Graphics.BLEND_ADD;
};

Sprite_Destination.prototype.updatePosition = function() {
    var tileWidth = $gameMap.tileWidth();
    var tileHeight = $gameMap.tileHeight();
    var x = $gameTemp.destinationX();
    var y = $gameTemp.destinationY();
    this.x = ($gameMap.adjustX(x) + 0.5) * tileWidth;
    this.y = ($gameMap.adjustY(y) + 0.5) * tileHeight;
};

Sprite_Destination.prototype.updateAnimation = function() {
    this._frameCount++;
    this._frameCount %= 20;
    this.opacity = (20 - this._frameCount) * 6;
    this.scale.x = 1 + this._frameCount / 20;
    this.scale.y = this.scale.x;
};

//-----------------------------------------------------------------------------
// Spriteset_Base
//
// The superclass of Spriteset_Map and Spriteset_Battle.

function Spriteset_Base() {
    this.initialize.apply(this, arguments);
}

Spriteset_Base.prototype = Object.create(Sprite.prototype);
Spriteset_Base.prototype.constructor = Spriteset_Base;

Spriteset_Base.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this.setFrame(0, 0, Graphics.width, Graphics.height);
    this._tone = [0, 0, 0, 0];
    this.opaque = true;
    this.createLowerLayer();
    this.createToneChanger();
    this.createUpperLayer();
    this.update();
};

Spriteset_Base.prototype.createLowerLayer = function() {
    this.createBaseSprite();
};

Spriteset_Base.prototype.createUpperLayer = function() {
    this.createPictures();
    this.createTimer();
    this.createScreenSprites();
};

Spriteset_Base.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this.updateScreenSprites();
    this.updateToneChanger();
    this.updatePosition();
};

Spriteset_Base.prototype.createBaseSprite = function() {
    this._baseSprite = new Sprite();
    this._baseSprite.setFrame(0, 0, this.width, this.height);
    this._blackScreen = new ScreenSprite();
    this._blackScreen.opacity = 255;
    this.addChild(this._baseSprite);
    this._baseSprite.addChild(this._blackScreen);
};

Spriteset_Base.prototype.createToneChanger = function() {
    if (Graphics.isWebGL()) {
        this.createWebGLToneChanger();
    } else {
        this.createCanvasToneChanger();
    }
};

Spriteset_Base.prototype.createWebGLToneChanger = function() {
    var margin = 48;
    var width = Graphics.width + margin * 2;
    var height = Graphics.height + margin * 2;
    this._toneFilter = new ToneFilter();
    this._baseSprite.filters = [this._toneFilter];
    this._baseSprite.filterArea = new Rectangle(-margin, -margin, width, height);
};

Spriteset_Base.prototype.createCanvasToneChanger = function() {
    this._toneSprite = new ToneSprite();
    this.addChild(this._toneSprite);
};

Spriteset_Base.prototype.createPictures = function() {
    var width = Graphics.boxWidth;
    var height = Graphics.boxHeight;
    var x = (Graphics.width - width) / 2;
    var y = (Graphics.height - height) / 2;
    this._pictureContainer = new Sprite();
    this._pictureContainer.setFrame(x, y, width, height);
    for (var i = 1; i <= $gameScreen.maxPictures(); i++) {
        this._pictureContainer.addChild(new Sprite_Picture(i));
    }
    this.addChild(this._pictureContainer);
};

Spriteset_Base.prototype.createTimer = function() {
    this._timerSprite = new Sprite_Timer();
    this.addChild(this._timerSprite);
};

Spriteset_Base.prototype.createScreenSprites = function() {
    this._flashSprite = new ScreenSprite();
    this._fadeSprite = new ScreenSprite();
    this.addChild(this._flashSprite);
    this.addChild(this._fadeSprite);
};

Spriteset_Base.prototype.updateScreenSprites = function() {
    var color = $gameScreen.flashColor();
    this._flashSprite.setColor(color[0], color[1], color[2]);
    this._flashSprite.opacity = color[3];
    this._fadeSprite.opacity = 255 - $gameScreen.brightness();
};

Spriteset_Base.prototype.updateToneChanger = function() {
    var tone = $gameScreen.tone();
    if (!this._tone.equals(tone)) {
        this._tone = tone.clone();
        if (Graphics.isWebGL()) {
            this.updateWebGLToneChanger();
        } else {
            this.updateCanvasToneChanger();
        }
    }
};

Spriteset_Base.prototype.updateWebGLToneChanger = function() {
    var tone = this._tone;
    this._toneFilter.reset();
    this._toneFilter.adjustTone(tone[0], tone[1], tone[2]);
    this._toneFilter.adjustSaturation(-tone[3]);
};

Spriteset_Base.prototype.updateCanvasToneChanger = function() {
    var tone = this._tone;
    this._toneSprite.setTone(tone[0], tone[1], tone[2], tone[3]);
};

Spriteset_Base.prototype.updatePosition = function() {
    var screen = $gameScreen;
    var scale = screen.zoomScale();
    this.scale.x = scale;
    this.scale.y = scale;
    this.x = Math.round(-screen.zoomX() * (scale - 1));
    this.y = Math.round(-screen.zoomY() * (scale - 1));
    this.x += Math.round(screen.shake());
};

//-----------------------------------------------------------------------------
// Spriteset_Map
//
// The set of sprites on the map screen.

function Spriteset_Map() {
    this.initialize.apply(this, arguments);
}

Spriteset_Map.prototype = Object.create(Spriteset_Base.prototype);
Spriteset_Map.prototype.constructor = Spriteset_Map;

Spriteset_Map.prototype.initialize = function() {
    Spriteset_Base.prototype.initialize.call(this);
};

Spriteset_Map.prototype.createLowerLayer = function() {
    Spriteset_Base.prototype.createLowerLayer.call(this);
    this.createParallax();
    this.createTilemap();
    this.createCharacters();
    this.createMapObjects();
    this.createShadow();
    this.createDestination();
    this.createWeather();
};

Spriteset_Map.prototype.update = function() {
    Spriteset_Base.prototype.update.call(this);
    this.updateTileset();
    this.updateParallax();
    this.updateTilemap();
    this.updateMapObjects();
    this.updateShadow();
    this.updateWeather();
};

Spriteset_Map.prototype.hideCharacters = function() {
    for (var i = 0; i < this._characterSprites.length; i++) {
        var sprite = this._characterSprites[i];
        if (!sprite.isTile()) {
            sprite.hide();
        }
    }
};

Spriteset_Map.prototype.createParallax = function() {
    this._parallax = new TilingSprite();
    this._parallax.move(0, 0, Graphics.width, Graphics.height);
    this._baseSprite.addChild(this._parallax);
};

Spriteset_Map.prototype.createTilemap = function() {
    this._tilemap = new ShaderTilemap();
    this._tilemap.tileWidth = $gameMap.tileWidth();
    this._tilemap.tileHeight = $gameMap.tileHeight();
    this._tilemap.setData($gameMap.width(), $gameMap.height(), $gameMap.data());
    this._tilemap.horizontalWrap = $gameMap.isLoopHorizontal();
    this._tilemap.verticalWrap = $gameMap.isLoopVertical();
    this.loadTileset();
    this._baseSprite.addChild(this._tilemap);
};

Spriteset_Map.prototype.loadTileset = function() {
    this._tileset = $gameMap.tileset();
    if (this._tileset) {
        var tilesetNames = this._tileset.tilesetNames;
        for (var i = 0; i < tilesetNames.length; i++) {
            this._tilemap.bitmaps[i] = ImageManager.loadTileset(tilesetNames[i]);
        }
        var newTilesetFlags = $gameMap.tilesetFlags();
        this._tilemap.refreshTileset();
        if (!this._tilemap.flags.equals(newTilesetFlags)) {
            this._tilemap.refresh();
        }
        this._tilemap.flags = newTilesetFlags;
    }
};

Spriteset_Map.prototype.createCharacters = function() {
    this._characterSprites = [];
    $gameMap.events().forEach(function(event) {
        this._characterSprites.push(new Sprite_Character(event));
    }, this);
    $gameMap.vehicles().forEach(function(vehicle) {
        this._characterSprites.push(new Sprite_Character(vehicle));
    }, this);
    $gamePlayer.followers().reverseEach(function(follower) {
        this._characterSprites.push(new Sprite_Character(follower));
    }, this);
    this._characterSprites.push(new Sprite_Character($gamePlayer));
    for (var i = 0; i < this._characterSprites.length; i++) {
        this._tilemap.addChild(this._characterSprites[i]);
    }
};

/**
 * 오토타일 정보 계산 (kind, shape, bx, by, setNumber, animX, animY, autotileTable)
 * ShaderTilemap._drawAutotile과 동일한 로직.
 */
Spriteset_Map._calcAutotileInfo = function(tileId) {
    var autotileTable = Tilemap.FLOOR_AUTOTILE_TABLE;
    var kind = Tilemap.getAutotileKind(tileId);
    var shape = Tilemap.getAutotileShape(tileId);
    var tx = kind % 8;
    var ty = Math.floor(kind / 8);
    var bx = 0, by = 0, setNumber = 0;
    var animX = 0, animY = 0;

    if (Tilemap.isTileA1(tileId)) {
        setNumber = 0;
        if (kind === 0) {
            animX = 2; by = 0;
        } else if (kind === 1) {
            animX = 2; by = 3;
        } else if (kind === 2) {
            bx = 6; by = 0;
        } else if (kind === 3) {
            bx = 6; by = 3;
        } else {
            bx = Math.floor(tx / 4) * 8;
            by = ty * 6 + Math.floor(tx / 2) % 2 * 3;
            if (kind % 2 === 0) {
                animX = 2;
            } else {
                bx += 6;
                autotileTable = Tilemap.WATERFALL_AUTOTILE_TABLE;
                animY = 1;
            }
        }
    } else if (Tilemap.isTileA2(tileId)) {
        setNumber = 1; bx = tx * 2; by = (ty - 2) * 3;
    } else if (Tilemap.isTileA3(tileId)) {
        setNumber = 2; bx = tx * 2; by = (ty - 6) * 2;
        autotileTable = Tilemap.WALL_AUTOTILE_TABLE;
    } else if (Tilemap.isTileA4(tileId)) {
        setNumber = 3; bx = tx * 2;
        by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
        if (ty % 2 === 1) autotileTable = Tilemap.WALL_AUTOTILE_TABLE;
    }

    return {
        kind: kind, shape: shape, bx: bx, by: by,
        setNumber: setNumber, animX: animX, animY: animY,
        autotileTable: autotileTable
    };
};

/**
 * 오브젝트의 물/폭포 타일을 Three.js Mesh + ThreeWaterShader로 생성
 */
Spriteset_Map.prototype._createObjectWaterMesh = function(
    container, tilesetName, info, table, col, row, obj, tw, th
) {
    if (typeof THREE === 'undefined') return;

    var w1 = tw / 2, h1 = th / 2;
    var isWaterfall = ThreeWaterShader.isWaterfallRect(info.animX, info.animY);
    var kindSettings = ThreeWaterShader.getUniformsForKind(info.kind);

    // quarter-tile 4개 → 삼각형 8개 (24 vertices)
    var vertCount = 4 * 6; // 4 quads * 6 verts each (2 triangles)
    var posArray = new Float32Array(vertCount * 3);
    var normalArray = new Float32Array(vertCount * 3);
    var uvArray = new Float32Array(vertCount * 2);
    var uvBoundsArray = new Float32Array(vertCount * 4);

    // 타일셋 텍스처 로드 → 크기 참조
    var bitmap = ImageManager.loadTileset(tilesetName);
    // 기본 UV 데이터 생성 (frame 0 기준, animX/animY 오프셋 없음)
    var baseX = col * tw - obj.width * tw / 2;
    var baseY = (row - obj.height) * th + obj.height * th / 2;

    for (var qi = 0; qi < 4; qi++) {
        var qsx = table[qi][0];
        var qsy = table[qi][1];
        var srcU = (info.bx * 2 + qsx) * w1;
        var srcV = (info.by * 2 + qsy) * h1;

        var dx = baseX + (qi % 2) * w1;
        var dy = baseY + Math.floor(qi / 2) * h1;

        // 쿼드를 2개 삼각형으로 구성 (6 vertices)
        var off = qi * 6;
        var positions = [
            dx,      dy,      0,  // top-left
            dx + w1, dy,      0,  // top-right
            dx,      dy + h1, 0,  // bottom-left
            dx + w1, dy,      0,  // top-right (dup)
            dx + w1, dy + h1, 0,  // bottom-right
            dx,      dy + h1, 0,  // bottom-left (dup)
        ];
        for (var vi = 0; vi < 18; vi++) {
            posArray[off * 3 + vi] = positions[vi];
        }
        for (var vi = 0; vi < 6; vi++) {
            normalArray[off * 3 + vi * 3]     = 0;
            normalArray[off * 3 + vi * 3 + 1] = 0;
            normalArray[off * 3 + vi * 3 + 2] = -1;
        }

        // UV는 나중에 texW/texH를 알아야 정규화 가능 → 픽셀 단위로 저장
        uvArray[off * 2 + 0]  = srcU;       uvArray[off * 2 + 1]  = srcV;
        uvArray[off * 2 + 2]  = srcU + w1;  uvArray[off * 2 + 3]  = srcV;
        uvArray[off * 2 + 4]  = srcU;       uvArray[off * 2 + 5]  = srcV + h1;
        uvArray[off * 2 + 6]  = srcU + w1;  uvArray[off * 2 + 7]  = srcV;
        uvArray[off * 2 + 8]  = srcU + w1;  uvArray[off * 2 + 9]  = srcV + h1;
        uvArray[off * 2 + 10] = srcU;       uvArray[off * 2 + 11] = srcV + h1;
    }

    // Placeholder Sprite로 container에 추가 (위치 계산에 사용)
    var placeholder = new Sprite();
    placeholder._isWaterPlaceholder = true;
    placeholder.x = baseX;
    placeholder.y = baseY;
    container.addChild(placeholder);

    // 물 메시 데이터를 container에 저장 (텍스처 로드 후 실제 메시 생성)
    if (!container._waterMeshData) container._waterMeshData = [];
    container._waterMeshData.push({
        tilesetName: tilesetName,
        info: info,
        isWaterfall: isWaterfall,
        kindSettings: kindSettings,
        posArray: posArray,
        normalArray: normalArray,
        uvArray: uvArray,       // 픽셀 단위, 나중에 정규화
        uvBoundsArray: uvBoundsArray,
        vertCount: vertCount,
    });
};

/**
 * 오브젝트의 물 메시들을 실제 Three.js Mesh로 빌드 (텍스처 로드 완료 후 호출)
 */
Spriteset_Map.prototype._buildObjectWaterMeshes = function(container) {
    if (!container._waterMeshData || typeof THREE === 'undefined') return;

    var data = container._waterMeshData;
    // tilesetName별로 그룹핑 (같은 텍스처 → 하나의 메시로 병합)
    var groups = {};
    for (var di = 0; di < data.length; di++) {
        var d = data[di];
        var key = d.tilesetName + (d.isWaterfall ? '_wf' : '_w') + '_k' + d.info.kind;
        if (!groups[key]) {
            groups[key] = {
                tilesetName: d.tilesetName,
                isWaterfall: d.isWaterfall,
                kindSettings: d.kindSettings,
                kind: d.info.kind,
                items: [],
            };
        }
        groups[key].items.push(d);
    }

    if (!container._waterMeshes) container._waterMeshes = [];

    for (var gk in groups) {
        var g = groups[gk];
        var bitmap = ImageManager.loadTileset(g.tilesetName);
        if (!bitmap._threeTexture && bitmap._baseTexture && bitmap._baseTexture._threeTexture) {
            bitmap._threeTexture = bitmap._baseTexture._threeTexture;
        }
        var texture = bitmap._threeTexture || (bitmap._baseTexture && bitmap._baseTexture._threeTexture);
        if (!texture) continue;

        var texW = texture.image ? texture.image.width : 1;
        var texH = texture.image ? texture.image.height : 1;

        // 모든 아이템의 vertex 데이터 병합
        var totalVerts = 0;
        for (var ii = 0; ii < g.items.length; ii++) totalVerts += g.items[ii].vertCount;

        var mergedPos = new Float32Array(totalVerts * 3);
        var mergedNorm = new Float32Array(totalVerts * 3);
        var mergedUV = new Float32Array(totalVerts * 2);
        var mergedBounds = new Float32Array(totalVerts * 4);
        var vOff = 0;

        for (var ii = 0; ii < g.items.length; ii++) {
            var item = g.items[ii];
            mergedPos.set(item.posArray, vOff * 3);
            mergedNorm.set(item.normalArray, vOff * 3);

            // 4 quads per item, 6 verts per quad
            for (var qi = 0; qi < 4; qi++) {
                var srcBase = qi * 6;
                var dstBase = (vOff + qi * 6);
                // UV 정규화 + Y-flip + animX/animY 오프셋
                // 기본 프레임(frame 0)에서는 오프셋 없음
                var uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
                for (var vi = 0; vi < 6; vi++) {
                    var pu = item.uvArray[(srcBase + vi) * 2];
                    var pv = item.uvArray[(srcBase + vi) * 2 + 1];
                    var u = pu / texW;
                    var v = 1.0 - pv / texH;
                    mergedUV[(dstBase + vi) * 2] = u;
                    mergedUV[(dstBase + vi) * 2 + 1] = v;
                    if (u < uMin) uMin = u;
                    if (u > uMax) uMax = u;
                    if (v < vMin) vMin = v;
                    if (v > vMax) vMax = v;
                }
                // 텍셀 절반 수축
                var halfTexelU = 0.5 / texW;
                var halfTexelV = 0.5 / texH;
                uMin += halfTexelU; uMax -= halfTexelU;
                vMin += halfTexelV; vMax -= halfTexelV;
                for (var vi = 0; vi < 6; vi++) {
                    var bi = (dstBase + vi) * 4;
                    mergedBounds[bi]     = uMin;
                    mergedBounds[bi + 1] = vMin;
                    mergedBounds[bi + 2] = uMax;
                    mergedBounds[bi + 3] = vMax;
                }
            }
            vOff += item.vertCount;
        }

        // Three.js 메시 생성
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(mergedUV, 2));
        geometry.setAttribute('aUvBounds', new THREE.BufferAttribute(mergedBounds, 4));

        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = 1;

        var needsPhong = (window.ShadowLight && window.ShadowLight._active);
        var material;
        if (needsPhong) {
            material = new THREE.MeshPhongMaterial({
                map: texture, transparent: true, depthTest: true, depthWrite: false,
                side: THREE.DoubleSide,
                emissive: new THREE.Color(0x000000),
                specular: new THREE.Color(0x000000), shininess: 0,
            });
            ThreeWaterShader.applyToPhongMaterial(material, g.isWaterfall, g.kindSettings);
        } else {
            material = ThreeWaterShader.createStandaloneMaterial(texture, g.isWaterfall, g.kindSettings);
        }

        var mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 0;
        mesh.userData.isWaterMesh = true;
        mesh.userData.isWaterfall = g.isWaterfall;
        mesh.userData.a1Kinds = g.kind >= 0 ? [g.kind] : [];
        mesh.userData.isObjectWater = true;
        // UV 애니메이션용 원본 데이터 저장
        mesh.userData._origUVs = new Float32Array(mergedUV);
        mesh.userData._animItems = g.items;
        mesh.userData._texW = texW;
        mesh.userData._texH = texH;

        // container._threeObj에 직접 추가 (Sprite 트리 대신 Three.js 씬)
        container._waterMeshes.push(mesh);
    }

    delete container._waterMeshData;
};

Spriteset_Map.prototype.createMapObjects = function() {
    this._objectSprites = [];
    var objects = $dataMap.objects;
    if (!objects || !Array.isArray(objects)) return;
    var tw = $gameMap.tileWidth();
    var th = $gameMap.tileHeight();
    var tileset = $gameMap.tileset();
    if (!tileset) return;

    for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (!obj) continue;
        // Create a container sprite for the entire object
        var container = new Sprite();
        // Store map tile coordinates for scroll-based position update
        container._mapObjX = obj.x;
        container._mapObjY = obj.y;
        container._mapObjW = obj.width;
        container._mapObjH = obj.height;
        container._mapObjId = obj.id;
        container._mapObjName = obj.name || '';
        container._mapObjVisible = obj.visible !== false;
        container.visible = obj.visible !== false;
        container.z = 5; // above upper tiles (z=4), same as upper characters
        container._heightOffset = (obj.zHeight || 0) * th;

        if (obj.animationId && $dataAnimations && $dataAnimations[obj.animationId]) {
            // 애니메이션 기반 오브젝트
            var anim = $dataAnimations[obj.animationId];
            var playInEditor = obj.animationPlayInEditor !== false;
            if (playInEditor) {
                var targetSprite = new Sprite();
                targetSprite.x = 0;
                targetSprite.y = 0;
                targetSprite.setBlendColor = targetSprite.setBlendColor || function() {};
                targetSprite.show = targetSprite.show || function() { this.visible = true; };
                targetSprite.hide = targetSprite.hide || function() { this.visible = false; };
                container.addChild(targetSprite);

                var animSprite = new Sprite_Animation();
                animSprite.setup(targetSprite, anim, false, 0);
                // 컨테이너(z=5) 자식이므로 z=0 (누적 방지: animSprite.z=8 기본값이 world.z를 더 내려가게 함)
                animSprite.z = 0;
                // 오브젝트 크기에 맞게 스케일 조절 (기본 4x4 타일 = 192px)
                var animScaleX = (obj.width * tw) / 192;
                var animScaleY = (obj.height * th) / 192;
                animSprite.scale.x = animScaleX;
                animSprite.scale.y = animScaleY;
                if (!obj.animationSe) {
                    animSprite.processTimingData = function(timing) {
                        // SE 재생 차단: flashScope만 처리
                        var duration = timing.flashDuration * this._rate;
                        switch (timing.flashScope) {
                        case 1: this._target.setBlendColor(timing.flashColor); this._flashDuration = duration; break;
                        case 2: this._screenFlashDuration = duration; if (this._screenFlashSprite) { this._screenFlashSprite.setColor(timing.flashColor[0], timing.flashColor[1], timing.flashColor[2]); this._screenFlashSprite.opacity = timing.flashColor[3]; } break;
                        case 3: this.startHiding(duration); break;
                        }
                    };
                }
                container.addChild(animSprite);

                container._mapObjAnimId = obj.animationId;
                container._mapObjAnimLoop = obj.animationLoop || 'forward';
                container._mapObjAnimSe = !!obj.animationSe;
                container._mapObjAnimSprite = animSprite;
                container._mapObjAnimTarget = targetSprite;
                container._mapObjAnimReverse = false;
                container._mapObjAnimScaleX = animScaleX;
                container._mapObjAnimScaleY = animScaleY;
            }
        } else if (obj.imageName) {
            // 이미지 기반 오브젝트: pictures 폴더에서 이미지 로드
            var imgSprite = new Sprite();
            imgSprite.bitmap = ImageManager.loadPicture(obj.imageName);
            var objAnchorY = obj.anchorY != null ? obj.anchorY : 1.0;
            imgSprite.anchor.set(0.5, objAnchorY);
            imgSprite.x = 0;
            imgSprite.y = obj.height * th / 2;
            // anchorY < 1.0이면 ShadowLight material 변환 후 shader clipping 적용
            if (objAnchorY < 1.0) {
                imgSprite._needsAnchorClip = true;
            }
            // imageScale 적용
            var imgScale = obj.imageScale != null ? obj.imageScale : 1.0;
            if (imgScale !== 1.0) {
                imgSprite.scale.set(imgScale, imgScale);
            }
            container.addChild(imgSprite);
            // 이미지 로드 완료 시 repaint
            var tilemap = this._tilemap;
            imgSprite.bitmap.addLoadListener(function(bmp) {
                // 텍스처 변경 강제 감지를 위해 _textureUpdateID 리셋
                imgSprite._textureUpdateID = -1;
                var count = 0;
                function forceRepaint() {
                    if (tilemap) tilemap._needsRepaint = true;
                    if (++count < 10) requestAnimationFrame(forceRepaint);
                }
                forceRepaint();
            });
        } else {
            for (var row = 0; row < obj.height; row++) {
                for (var col = 0; col < obj.width; col++) {
                    var tileRow = obj.tileIds[row];
                    if (!tileRow) continue;
                    var cell = tileRow[col];
                    // cell: number[] (layered) or number (legacy)
                    var layers = Array.isArray(cell) ? cell : [cell];
                    for (var li = 0; li < layers.length; li++) {
                        var tileId = layers[li];
                        if (!tileId || tileId === 0) continue;

                        if (Tilemap.isAutotile(tileId)) {
                            var info = Spriteset_Map._calcAutotileInfo(tileId);
                            var tilesetName = tileset.tilesetNames[info.setNumber];
                            if (!tilesetName) continue;
                            var table = info.autotileTable[info.shape];
                            var w1 = tw / 2, h1 = th / 2;

                            // 물/폭포 타일 → Three.js Mesh + WaterShader
                            var isWater = typeof ThreeWaterShader !== 'undefined' &&
                                ThreeWaterShader.isWaterRect(info.animX, info.animY) &&
                                (info.kind < 0 || ThreeWaterShader.isKindEnabled(info.kind));

                            if (isWater) {
                                this._createObjectWaterMesh(
                                    container, tilesetName, info,
                                    table, col, row, obj, tw, th
                                );
                            } else {
                                // 비물 오토타일 → Sprite + 애니메이션 정보 저장
                                for (var qi = 0; qi < 4; qi++) {
                                    var qsx = table[qi][0];
                                    var qsy = table[qi][1];
                                    var sx1 = (info.bx * 2 + qsx) * w1;
                                    var sy1 = (info.by * 2 + qsy) * h1;

                                    var qSprite = new Sprite();
                                    qSprite.bitmap = ImageManager.loadTileset(tilesetName);
                                    qSprite.setFrame(sx1, sy1, w1, h1);
                                    qSprite.x = col * tw + (qi % 2) * w1 - obj.width * tw / 2;
                                    qSprite.y = (row - obj.height) * th + Math.floor(qi / 2) * h1 + obj.height * th / 2;
                                    // 타일 이동 애니메이션 정보
                                    if (info.animX > 0 || info.animY > 0) {
                                        qSprite._tileAnimX = info.animX;
                                        qSprite._tileAnimY = info.animY;
                                        qSprite._baseFrameX = sx1;
                                        qSprite._baseFrameY = sy1;
                                    }
                                    container.addChild(qSprite);
                                }
                            }
                        } else {
                            // 일반 타일 (B~E, A5)
                            var setNumber;
                            if (Tilemap.isTileA5(tileId)) {
                                setNumber = 4;
                            } else {
                                setNumber = 5 + Math.floor(tileId / 256);
                            }
                            var tilesetName = tileset.tilesetNames[setNumber];
                            if (!tilesetName) continue;

                            var tileSprite = new Sprite();
                            tileSprite.bitmap = ImageManager.loadTileset(tilesetName);
                            var sx = (Math.floor(tileId / 128) % 2 * 8 + tileId % 8) * tw;
                            var sy = Math.floor(tileId % 256 / 8) % 16 * th;
                            tileSprite.setFrame(sx, sy, tw, th);
                            tileSprite.x = col * tw - obj.width * tw / 2;
                            tileSprite.y = (row - obj.height) * th + obj.height * th / 2;
                            container.addChild(tileSprite);
                        }
                    }
                }
            }
        }

        this._tilemap.addChild(container);
        this._objectSprites.push(container);

        // Register as billboard for 3D mode
        // 이미지 오브젝트: imgSprite를 빌보드로 등록 (anchor 기준 회전)
        // 타일/애니메이션 오브젝트: container를 빌보드로 등록
        if (typeof Mode3D !== 'undefined') {
            if (obj.imageName && container.children && container.children[0]) {
                // 이미지 오브젝트: imgSprite의 anchor 기준으로 회전하도록
                Mode3D.registerBillboard(container.children[0]);
            } else {
                Mode3D.registerBillboard(container);
            }
        }

        // ShadowLight 활성 상태이면 material을 MeshPhongMaterial로 변환
        // (물 placeholder와 물 메시는 자체 셰이더 사용하므로 제외)
        if (typeof ShadowLight !== 'undefined' && ShadowLight._active) {
            ShadowLight._convertMaterial(container);
            if (container.children) {
                for (var ci = 0; ci < container.children.length; ci++) {
                    if (!container.children[ci]._isWaterPlaceholder) {
                        ShadowLight._convertMaterial(container.children[ci]);
                    }
                }
            }
        }

        // anchorY shader clipping: material 변환 후 최종 material에 적용
        if (container.children) {
            for (var ci = 0; ci < container.children.length; ci++) {
                var child = container.children[ci];
                if (child._needsAnchorClip && child._material) {
                    child._material.onBeforeCompile = function(shader) {
                        shader.vertexShader = shader.vertexShader.replace(
                            'void main() {',
                            'varying float vLocalY;\nvoid main() {\n  vLocalY = position.y;'
                        );
                        shader.fragmentShader = shader.fragmentShader.replace(
                            'void main() {',
                            'varying float vLocalY;\nvoid main() {\n  if (vLocalY > 0.0) discard;'
                        );
                    };
                    child._material.customProgramCacheKey = function() {
                        return 'mapobj-clip-anchor';
                    };
                    child._material.needsUpdate = true;
                }
            }
        }

        // 이미지 오브젝트 셰이더 적용 (PictureShader 멀티패스)
        if (obj.imageName && obj.shaderData && Array.isArray(obj.shaderData) && obj.shaderData.length > 0
            && typeof PictureShader !== 'undefined') {
            var imgChild = container.children[0];
            if (imgChild) {
                imgChild._objShaderData = obj.shaderData;
                imgChild._objShaderPasses = [];
                imgChild._objShaderRTs = [];
                imgChild._objShaderKey = '';
                imgChild._objOutputMaterial = null;
                imgChild._objShakeOffsetX = 0;
                imgChild._objShakeOffsetY = 0;
            }
        }
    }
};

Spriteset_Map.prototype.findObjectSprite = function(id) {
    if (!this._objectSprites) return null;
    for (var i = 0; i < this._objectSprites.length; i++) {
        if (this._objectSprites[i]._mapObjId === id) return this._objectSprites[i];
    }
    return null;
};

Spriteset_Map.prototype.updateMapObjects = function() {
    if (!this._objectSprites) return;
    var tw = $gameMap.tileWidth();
    var th = $gameMap.tileHeight();

    // 타일 애니메이션 프레임 계산 (맵 타일과 동기화)
    var tilemap = this._tilemap;
    var animFrame = tilemap ? tilemap.animationFrame || 0 : 0;
    var af = animFrame % 4;
    if (af === 3) af = 1;
    var tileAnimX = af * tw;
    var tileAnimY = (animFrame % 3) * th;

    for (var i = 0; i < this._objectSprites.length; i++) {
        var container = this._objectSprites[i];
        // Update position based on map scroll (same as character screenX/Y)
        container.x = Math.round($gameMap.adjustX(container._mapObjX) * tw + container._mapObjW * tw / 2);
        container.y = Math.round($gameMap.adjustY(container._mapObjY) * th + th - container._mapObjH * th / 2);

        // zHeight 동적 반영 (타일 단위 → 픽셀 단위 변환)
        // 우선순위: 플러그인 커맨드(_mapObjZHeight) > $dataMap.objects의 zHeight
        if (container._mapObjZHeight != null) {
            var zPx = container._mapObjZHeight * th;
            if (container._heightOffset !== zPx) {
                container._heightOffset = zPx;
            }
        } else {
            // Inspector에서 obj.zHeight를 직접 수정한 경우 반영
            var obj = $dataMap.objects[i];
            if (obj) {
                var dataZPx = (obj.zHeight || 0) * th;
                if (container._heightOffset !== dataZPx) {
                    container._heightOffset = dataZPx;
                }
            }
        }

        // 애니메이션 오브젝트 루프 처리
        if (container._mapObjAnimSprite) {
            var animSpr = container._mapObjAnimSprite;
            if (!animSpr.isPlaying()) {
                var loop = container._mapObjAnimLoop;
                var animData = null;
                if (loop === 'forward') {
                    animData = $dataAnimations[container._mapObjAnimId];
                } else if (loop === 'pingpong') {
                    var origAnim = $dataAnimations[container._mapObjAnimId];
                    if (origAnim) {
                        container._mapObjAnimReverse = !container._mapObjAnimReverse;
                        if (container._mapObjAnimReverse) {
                            animData = Object.create(origAnim);
                            animData.frames = origAnim.frames.slice().reverse();
                            var maxFrame = origAnim.frames.length - 1;
                            animData.timings = origAnim.timings.map(function(t) {
                                return Object.assign({}, t, { frame: maxFrame - t.frame });
                            });
                        } else {
                            animData = origAnim;
                        }
                    }
                }
                // 이전 스프라이트의 Three.js 리소스 해제
                if (animSpr.destroy) {
                    animSpr.destroy();
                } else if (animSpr.parent) {
                    animSpr.parent.removeChild(animSpr);
                }
                if (animData) {
                    // 새 애니메이션 스프라이트 생성
                    var newAnimSpr = new Sprite_Animation();
                    newAnimSpr.setup(container._mapObjAnimTarget, animData, false, 0);
                    if (!container._mapObjAnimSe) {
                        newAnimSpr.processTimingData = function(timing) {
                            var duration = timing.flashDuration * this._rate;
                            switch (timing.flashScope) {
                            case 1: this._target.setBlendColor(timing.flashColor); this._flashDuration = duration; break;
                            case 2: this._screenFlashDuration = duration; if (this._screenFlashSprite) { this._screenFlashSprite.setColor(timing.flashColor[0], timing.flashColor[1], timing.flashColor[2]); this._screenFlashSprite.opacity = timing.flashColor[3]; } break;
                            case 3: this.startHiding(duration); break;
                            }
                        };
                    }
                    if (container._mapObjAnimScaleX) newAnimSpr.scale.x = container._mapObjAnimScaleX;
                    if (container._mapObjAnimScaleY) newAnimSpr.scale.y = container._mapObjAnimScaleY;
                    newAnimSpr.z = 0;  // 컨테이너 자식이므로 z=0
                    container.addChild(newAnimSpr);
                    container._mapObjAnimSprite = newAnimSpr;
                } else {
                    // 'once' 모드: 재생 완료 후 참조 정리
                    container._mapObjAnimSprite = null;
                }
            }
        }

        // 물 메시 lazy 빌드 (텍스처 로드 완료 후)
        if (container._waterMeshData) {
            this._tryBuildObjectWaterMeshes(container);
        }

        // 물 메시 uTime + UV 애니메이션 업데이트
        if (container._waterMeshes) {
            for (var wi = 0; wi < container._waterMeshes.length; wi++) {
                var wMesh = container._waterMeshes[wi];
                // uTime 업데이트
                if (typeof ThreeWaterShader !== 'undefined') {
                    ThreeWaterShader.updateTime(wMesh, ThreeWaterShader._time);
                    ThreeWaterShader._hasWaterMesh = true;
                }
                // UV 애니메이션 (타일 이동)
                this._updateObjectWaterUV(wMesh, tileAnimX, tileAnimY);
            }
        }

        if (container.children) {
            for (var ci = 0; ci < container.children.length; ci++) {
                var child = container.children[ci];
                // 이미지 오브젝트 셰이더 업데이트
                if (child._objShaderData) {
                    this._updateObjectShader(child);
                }
                // 비물 오토타일 setFrame 애니메이션
                if (child._tileAnimX || child._tileAnimY) {
                    var newX = child._baseFrameX + (child._tileAnimX || 0) * tileAnimX;
                    var newY = child._baseFrameY + (child._tileAnimY || 0) * tileAnimY;
                    child.setFrame(newX, newY, child._frame.width, child._frame.height);
                }
            }
        }
    }
};

/**
 * 물 메시 텍스처 준비 여부 확인 후 빌드 시도
 */
Spriteset_Map.prototype._tryBuildObjectWaterMeshes = function(container) {
    if (!container._waterMeshData || typeof THREE === 'undefined') return;

    // 모든 물 타일의 텍스처가 준비되었는지 확인
    var allReady = true;
    for (var di = 0; di < container._waterMeshData.length; di++) {
        var d = container._waterMeshData[di];
        var bitmap = ImageManager.loadTileset(d.tilesetName);
        var texture = bitmap._threeTexture || (bitmap._baseTexture && bitmap._baseTexture._threeTexture);
        if (!texture || !texture.image || !texture.image.width) {
            allReady = false;
            break;
        }
    }
    if (!allReady) return;

    this._buildObjectWaterMeshes(container);

    // Three.js 씬에 추가
    if (container._waterMeshes && container._threeObj) {
        for (var wi = 0; wi < container._waterMeshes.length; wi++) {
            container._threeObj.add(container._waterMeshes[wi]);
        }
        if (this._tilemap) this._tilemap._needsRepaint = true;
    }
};

/**
 * 물 메시의 UV를 타일 애니메이션 프레임에 맞게 갱신
 */
Spriteset_Map.prototype._updateObjectWaterUV = function(mesh, tileAnimX, tileAnimY) {
    if (!mesh || !mesh.geometry) return;
    var uvAttr = mesh.geometry.attributes.uv;
    var boundsAttr = mesh.geometry.attributes.aUvBounds;
    if (!uvAttr) return;

    var origUVs = mesh.userData._origUVs;
    var items = mesh.userData._animItems;
    var texW = mesh.userData._texW || 1;
    var texH = mesh.userData._texH || 1;
    if (!origUVs || !items) return;

    var uvArray = uvAttr.array;
    var boundsArray = boundsAttr ? boundsAttr.array : null;
    var vOff = 0;

    for (var ii = 0; ii < items.length; ii++) {
        var item = items[ii];
        var ax = (item.info.animX || 0) * tileAnimX / texW;
        var ay = -((item.info.animY || 0) * tileAnimY) / texH; // Y-flip

        for (var qi = 0; qi < 4; qi++) {
            var dstBase = (vOff + qi * 6);
            var uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
            for (var vi = 0; vi < 6; vi++) {
                var idx = (dstBase + vi) * 2;
                var u = origUVs[idx] + ax;
                var v = origUVs[idx + 1] + ay;
                uvArray[idx] = u;
                uvArray[idx + 1] = v;
                if (u < uMin) uMin = u;
                if (u > uMax) uMax = u;
                if (v < vMin) vMin = v;
                if (v > vMax) vMax = v;
            }
            // UV 바운드 갱신
            if (boundsArray) {
                var halfTexelU = 0.5 / texW;
                var halfTexelV = 0.5 / texH;
                uMin += halfTexelU; uMax -= halfTexelU;
                vMin += halfTexelV; vMax -= halfTexelV;
                for (var vi = 0; vi < 6; vi++) {
                    var bi = (dstBase + vi) * 4;
                    boundsArray[bi]     = uMin;
                    boundsArray[bi + 1] = vMin;
                    boundsArray[bi + 2] = uMax;
                    boundsArray[bi + 3] = vMax;
                }
            }
        }
        vOff += item.vertCount;
    }

    uvAttr.needsUpdate = true;
    if (boundsAttr) boundsAttr.needsUpdate = true;
};

/**
 * 이미지 오브젝트의 셰이더를 PictureShader 멀티패스로 업데이트한다.
 */
Spriteset_Map.prototype._updateObjectShader = function(sprite) {
    if (typeof PictureShader === 'undefined' || typeof THREE === 'undefined') return;

    var shaderData = sprite._objShaderData;
    if (!shaderData || !Array.isArray(shaderData) || shaderData.length === 0) return;

    // 셰이더 키 계산 (변경 감지 - ShadowLight 상태도 포함)
    var passes = shaderData.filter(function(s) { return s.enabled; });
    var is3D = typeof ShadowLight !== 'undefined' && ShadowLight._active;
    var key = (is3D ? '3d:' : '2d:') + passes.map(function(s) { return s.type; }).join(',');

    if (sprite._objShaderKey !== key) {
        this._applyObjectShaderPasses(sprite, passes);
        sprite._objShaderKey = key;
    }

    // 매 프레임 멀티패스 렌더링
    this._executeObjectMultipass(sprite, passes);

    // Shake offset
    sprite._objShakeOffsetX = 0;
    sprite._objShakeOffsetY = 0;
    var hasShake = passes.some(function(s) { return s.type === 'shake'; });
    if (hasShake) {
        var shakeEntry = passes.find(function(s) { return s.type === 'shake'; });
        if (shakeEntry) {
            var p = shakeEntry.params;
            var power = p.power != null ? p.power : 5;
            var speed = p.speed != null ? p.speed : 10;
            var dir = p.direction != null ? p.direction : 2;
            var t = PictureShader._time * speed;
            if (dir === 0 || dir === 2) sprite._objShakeOffsetX = (Math.sin(t * 7.13) + Math.sin(t * 5.71) * 0.5) * power;
            if (dir === 1 || dir === 2) sprite._objShakeOffsetY = (Math.sin(t * 6.47) + Math.sin(t * 4.93) * 0.5) * power;
        }
    }
};

/**
 * 이미지 오브젝트에 셰이더 패스를 적용한다.
 */
Spriteset_Map.prototype._applyObjectShaderPasses = function(sprite, passes) {
    var is3D = typeof ShadowLight !== 'undefined' && ShadowLight._active;

    // 기존 패스 정리
    this._disposeObjectShaderPasses(sprite);

    // 공유 렌더 씬/카메라 (lazy init - 모든 오브젝트가 공유)
    if (!this._objRTScene) {
        this._objRTScene = new THREE.Scene();
        this._objRTCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);
        var geo = new THREE.PlaneGeometry(1, 1);
        this._objRTQuad = new THREE.Mesh(geo, null);
        this._objRTQuad.frustumCulled = false;
        this._objRTScene.add(this._objRTQuad);
    }

    // RT 크기: 현재 텍스처 크기 사용 (이미지 로드 전이면 기본값 256)
    var tex = sprite._threeTexture || (sprite._material && sprite._material.map);
    var rtW = 256, rtH = 256;
    if (tex && tex.image) {
        rtW = tex.image.width || 256;
        rtH = tex.image.height || 256;
    }

    // 각 패스별 Material + RT 생성
    for (var i = 0; i < passes.length; i++) {
        var s = passes[i];
        if (s.type === 'shake') {
            sprite._objShaderPasses.push({ material: null, type: s.type, params: s.params });
            sprite._objShaderRTs.push(null);
            continue;
        }
        var mat = PictureShader.createMaterial(s.type, s.params || {}, null);
        sprite._objShaderPasses.push({ material: mat, type: s.type, params: s.params });
        var rt = new THREE.WebGLRenderTarget(rtW, rtH, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
        });
        sprite._objShaderRTs.push(rt);
    }

    // 최종 출력용 Material: ShadowLight 활성이면 MeshPhongMaterial, 아니면 MeshBasicMaterial
    var outputMat;
    var is3D = typeof ShadowLight !== 'undefined' && ShadowLight._active;
    if (is3D) {
        outputMat = new THREE.MeshPhongMaterial({
            transparent: false,
            alphaTest: 0.5,
            depthTest: true,
            depthWrite: true,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(0x000000),
            specular: new THREE.Color(0x000000),
            shininess: 0,
        });
        // ShadowLight의 재변환 방지: _convertedMaterials에 등록
        if (ShadowLight._convertedMaterials) {
            ShadowLight._convertedMaterials.set(outputMat, true);
        }
        // 그림자 캐스팅용 customDepthMaterial 생성
        if (sprite._threeObj) {
            sprite._threeObj.castShadow = true;
            sprite._threeObj.customDepthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking,
                alphaTest: 0.5,
                side: THREE.DoubleSide,
            });
        }
    } else {
        outputMat = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        // ShadowLight._convertMaterial이 이 outputMat을 변환하지 않도록 등록
        if (typeof ShadowLight !== 'undefined' && ShadowLight._convertedMaterials) {
            ShadowLight._convertedMaterials.set(outputMat, true);
        }
    }
    // anchorY shader clipping: output material에 적용 (MeshPhong/MeshBasic 모두)
    if (sprite._needsAnchorClip) {
        outputMat.onBeforeCompile = function(shader) {
            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                'varying float vLocalY;\nvoid main() {\n  vLocalY = position.y;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                'varying float vLocalY;\nvoid main() {\n  if (vLocalY > 0.0) discard;'
            );
        };
        var _matType = outputMat.isMeshPhongMaterial ? 'phong' : 'basic';
        outputMat.customProgramCacheKey = function() {
            return 'mapobj-shader-clip-anchor-' + _matType;
        };
        outputMat.needsUpdate = true;
    }
    sprite._objOutputMaterial = outputMat;
    sprite._material = outputMat;
    if (sprite._threeObj) {
        sprite._threeObj.material = outputMat;
    }
};

/**
 * 이미지 오브젝트의 멀티패스 렌더링을 실행한다.
 */
Spriteset_Map.prototype._executeObjectMultipass = function(sprite, passes) {
    if (sprite._objShaderPasses.length === 0) return;

    var renderer = PictureShader._renderer;
    if (!renderer) return;

    // 매 프레임 현재 texture를 사용 (이미지 로드 후 _threeTexture가 갱신될 수 있음)
    var sourceTexture = sprite._threeTexture || (sprite._material && sprite._material.map);
    if (!sourceTexture) return;
    // 텍스처가 변경되면 RT 크기를 실제 이미지 크기에 맞게 리사이즈
    if (sourceTexture.image && sourceTexture !== sprite._objLastTexture) {
        var newW = sourceTexture.image.width || 256;
        var newH = sourceTexture.image.height || 256;
        if (newW > 1 && newH > 1) {
            for (var ri = 0; ri < sprite._objShaderRTs.length; ri++) {
                var existRT = sprite._objShaderRTs[ri];
                if (existRT && (existRT.width !== newW || existRT.height !== newH)) {
                    existRT.setSize(newW, newH);
                }
            }
            sprite._objLastTexture = sourceTexture;
        }
    }

    var currentInput = sourceTexture;
    var lastRT = null;

    for (var i = 0; i < sprite._objShaderPasses.length; i++) {
        var pass = sprite._objShaderPasses[i];
        var rt = sprite._objShaderRTs[i];

        if (pass.type === 'shake' || !pass.material) continue;

        var mat = pass.material;
        var u = mat.uniforms;

        if (u.uTime) u.uTime.value = PictureShader._time;
        if (u.map) u.map.value = currentInput;
        if (u.opacity) u.opacity.value = 1.0;

        // params → uniform 동기화 (PluginTween 보간 반영)
        var passData = sprite._objShaderPasses[i];
        if (passData && passData.params) {
            var mapping = PictureShader._UNIFORM_MAP[passData.type];
            if (typeof mapping === 'string') mapping = PictureShader._UNIFORM_MAP[mapping];
            if (mapping) {
                for (var mi = 0; mi < mapping.length; mi++) {
                    var mm = mapping[mi];
                    if (Array.isArray(mm) && u[mm[1]] && passData.params[mm[0]] !== undefined) {
                        u[mm[1]].value = passData.params[mm[0]];
                    }
                }
            }
        }

        this._objRTQuad.material = mat;
        var prevRT = renderer.getRenderTarget();
        renderer.setRenderTarget(rt);
        renderer.render(this._objRTScene, this._objRTCamera);
        renderer.setRenderTarget(prevRT);

        currentInput = rt.texture;
        lastRT = rt;
    }

    if (sprite._objOutputMaterial) {
        var finalTex = lastRT ? lastRT.texture : sourceTexture;
        sprite._objOutputMaterial.map = finalTex;
        sprite._objOutputMaterial.opacity = sprite.worldAlpha != null ? sprite.worldAlpha : 1.0;
        sprite._objOutputMaterial.needsUpdate = true;
        // 3D 모드: customDepthMaterial.map도 동기화 (그림자 실루엣)
        if (sprite._threeObj && sprite._threeObj.customDepthMaterial) {
            sprite._threeObj.customDepthMaterial.map = finalTex;
            sprite._threeObj.customDepthMaterial.needsUpdate = true;
        }
    }
};

/**
 * 이미지 오브젝트의 셰이더 패스를 정리한다.
 */
Spriteset_Map.prototype._disposeObjectShaderPasses = function(sprite) {
    if (sprite._objShaderPasses) {
        for (var i = 0; i < sprite._objShaderPasses.length; i++) {
            if (sprite._objShaderPasses[i].material) {
                sprite._objShaderPasses[i].material.dispose();
            }
        }
    }
    if (sprite._objShaderRTs) {
        for (var j = 0; j < sprite._objShaderRTs.length; j++) {
            if (sprite._objShaderRTs[j]) {
                sprite._objShaderRTs[j].dispose();
            }
        }
    }
    sprite._objShaderPasses = [];
    sprite._objShaderRTs = [];
    sprite._objShaderKey = '';
    if (sprite._objOutputMaterial) {
        sprite._objOutputMaterial.dispose();
        sprite._objOutputMaterial = null;
    }
};

Spriteset_Map.prototype.createShadow = function() {
    this._shadowSprite = new Sprite();
    this._shadowSprite.bitmap = ImageManager.loadSystem('Shadow1');
    this._shadowSprite.anchor.x = 0.5;
    this._shadowSprite.anchor.y = 1;
    this._shadowSprite.z = 6;
    this._tilemap.addChild(this._shadowSprite);
};

Spriteset_Map.prototype.createDestination = function() {
    this._destinationSprite = new Sprite_Destination();
    this._destinationSprite.z = 9;
    this._tilemap.addChild(this._destinationSprite);
};

Spriteset_Map.prototype.createWeather = function() {
    this._weather = new Weather();
    this.addChild(this._weather);
};

Spriteset_Map.prototype.updateTileset = function() {
    if (this._tileset !== $gameMap.tileset()) {
        this.loadTileset();
    }
};

/*
 * Simple fix for canvas parallax issue, destroy old parallax and readd to  the tree.
 */
Spriteset_Map.prototype._canvasReAddParallax = function() {
    var index = this._baseSprite.children.indexOf(this._parallax);
    this._baseSprite.removeChild(this._parallax);
    this._parallax = new TilingSprite();
    this._parallax.move(0, 0, Graphics.width, Graphics.height);
    this._parallax.bitmap = ImageManager.loadParallax(this._parallaxName);
    this._baseSprite.addChildAt(this._parallax,index);
};

Spriteset_Map.prototype.updateParallax = function() {
    if (this._parallaxName !== $gameMap.parallaxName()) {
        this._parallaxName = $gameMap.parallaxName();

        if (this._parallax.bitmap && Graphics.isWebGL() != true) {
            this._canvasReAddParallax();
        } else {
            this._parallax.bitmap = ImageManager.loadParallax(this._parallaxName);
        }

        // Update Three.js parallax sky plane
        this._updateParallaxSkyPlane();
    }
    // Retry: parallax sky plane이 아직 생성되지 않았고, 대기중도 아니면 재시도
    if (this._parallaxName && !this._parallaxSkyMesh && !this._parallaxSkyPending) {
        this._updateParallaxSkyPlane();
    }
    // ConfigManager.mode3d를 기준으로 3D 모드 판단 (카메라 존재 여부만으로는 전환 시 불일치 발생)
    var mode3dEnabled = window.ConfigManager && ConfigManager.mode3d;
    var is3D = mode3dEnabled && this._parallaxSkyMesh && window.Mode3D && Mode3D._perspCamera;
    if (is3D) {
        var cam = Mode3D._perspCamera;
        // 3D 전환 시 sky mesh 크기가 현재 카메라에 맞는지 확인하고, 부족하면 재생성
        var expectedFar = cam.far * 0.8;
        if (!this._parallaxSkyFov || this._parallaxSkyFov !== cam.fov ||
            !this._parallaxSkyFar || Math.abs(this._parallaxSkyFar - expectedFar) > 1) {
            this._updateParallaxSkyPlane();
        }
        // sky mesh를 카메라 look-at 방향에 수직으로 배치
        var mesh = this._parallaxSkyMesh;
        if (mesh) {
            // 카메라 look direction (로컬 -Z → 월드)
            var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
            // far plane의 80% 거리에 배치
            var farDist = cam.far * 0.8;
            mesh.position.copy(cam.position).addScaledVector(dir, farDist);
            // 카메라와 정확히 같은 방향을 향하도록 quaternion 복사
            mesh.quaternion.copy(cam.quaternion);
            // 패럴랙스 스크롤 오프셋을 sky mesh 텍스처에 적용
            if (mesh.material && mesh.material.map) {
                var tex = mesh.material.map;
                var texW = tex.image ? tex.image.width : 1;
                var texH = tex.image ? tex.image.height : 1;
                if (texW > 0 && texH > 0) {
                    tex.offset.set(
                        -($gameMap.parallaxOx() / texW) || 0,
                        ($gameMap.parallaxOy() / texH) || 0
                    );
                }
            }
        }
    }
    // 2D parallax TilingSprite visibility 제어
    // - 에디터 모드: HTML DIV로 패러럴 표시하므로 TilingSprite는 항상 숨김
    // - 게임 3D 모드: sky mesh가 대신 렌더되므로 TilingSprite 숨김
    // - 게임 2D 모드: TilingSprite 표시
    // NOTE: _threeObj.visible 직접 설정 불가 — _updateFrame()이 this._visible로 매번 복원함.
    //       반드시 PIXI 호환 visible 속성(= this._visible + _threeObj.visible 동시 설정)을 사용해야 함.
    this._parallax.visible = !is3D && !window.__editorMode;
    if (this._parallax.bitmap) {
        this._parallax.origin.x = $gameMap.parallaxOx();
        this._parallax.origin.y = $gameMap.parallaxOy();
    }
};

/**
 * Creates/updates a large Three.js plane behind the tilemap as a sky background.
 * This makes the parallax visible in 3D mode beyond the map edges,
 * and also visible through transparent tile areas.
 * The mesh is added to _baseSprite's Three.js object so it participates
 * in the normal renderOrder hierarchy (drawn before tilemap).
 */
Spriteset_Map.prototype._updateParallaxSkyPlane = function() {
    var rendererObj = Graphics._renderer;
    if (!rendererObj || !rendererObj.scene) return;

    // Remove existing sky plane (현재 인스턴스 + scene에 남은 이전 인스턴스의 것)
    if (this._parallaxSkyMesh) {
        rendererObj.scene.remove(this._parallaxSkyMesh);
        this._parallaxSkyMesh.geometry.dispose();
        this._parallaxSkyMesh.material.dispose();
        this._parallaxSkyMesh = null;
    }
    // Scene 전환 시 이전 Spriteset의 sky mesh가 scene에 남아있을 수 있으므로 모두 제거
    var staleSkies = [];
    rendererObj.scene.children.forEach(function(child) {
        if (child._isParallaxSky) staleSkies.push(child);
    });
    for (var i = 0; i < staleSkies.length; i++) {
        rendererObj.scene.remove(staleSkies[i]);
        if (staleSkies[i].geometry) staleSkies[i].geometry.dispose();
        if (staleSkies[i].material) staleSkies[i].material.dispose();
    }
    this._parallaxSkyPending = false;
    this._parallaxSkyFov = null;
    this._parallaxSkyFar = null;

    if (!this._parallaxName) return;

    var bitmap = ImageManager.loadParallax(this._parallaxName);
    var self = this;

    var createMesh = function() {
        self._parallaxSkyPending = false;
        if (!bitmap.isReady()) return;

        var THREE = window.THREE;
        if (!THREE) return;

        // 이미 다른 경로로 mesh가 생성된 경우 중복 방지
        if (self._parallaxSkyMesh) return;

        // 충분히 큰 plane (카메라 far 거리에서 시야를 덮을 크기)
        // far * 0.8 거리에서 FOV 기준 필요 크기 계산
        var farDist = 5000; // 기본값
        var fov = 60; // 기본 FOV
        if (window.Mode3D && Mode3D._perspCamera) {
            farDist = Mode3D._perspCamera.far * 0.8;
            fov = Mode3D._perspCamera.fov;
        }
        var fovRad = fov * Math.PI / 180;
        // 카메라 pitch에 의한 시야 확장을 커버하기 위해 2배 여유
        var planeH = 2 * farDist * Math.tan(fovRad / 2) * 2.0;
        var aspect = Graphics.width / Graphics.height;
        var planeW = planeH * aspect * 2.0;

        var geometry = new THREE.PlaneGeometry(planeW, planeH);

        // Create texture from bitmap
        var canvas = bitmap._canvas || bitmap._image;
        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;

        // Set repeat based on plane size vs texture size
        var texW = bitmap.width || 1;
        var texH = bitmap.height || 1;
        texture.repeat.set(planeW / texW, planeH / texH);

        var material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
        });

        var rendObj = Graphics._renderer;
        if (!rendObj || !rendObj.scene) return;

        var mesh = new THREE.Mesh(geometry, material);
        mesh._isParallaxSky = true;  // Tag for Mode3D render pass
        mesh.frustumCulled = false;
        mesh.visible = false;  // Hidden by default; Mode3D render controls visibility
        rendObj.scene.add(mesh);
        self._parallaxSkyMesh = mesh;
        self._parallaxSkyFov = fov;  // FOV 기록 (전환 시 재생성 판단용)
        self._parallaxSkyFar = farDist;  // far 거리 기록
    };

    if (bitmap.isReady()) {
        createMesh();
    } else {
        this._parallaxSkyPending = true;
        bitmap.addLoadListener(createMesh);
    }
};

Spriteset_Map.prototype.updateTilemap = function() {
    this._tilemap.origin.x = $gameMap.displayX() * $gameMap.tileWidth();
    this._tilemap.origin.y = $gameMap.displayY() * $gameMap.tileHeight();
};

Spriteset_Map.prototype.updateShadow = function() {
    var airship = $gameMap.airship();
    this._shadowSprite.x = airship.shadowX();
    this._shadowSprite.y = airship.shadowY();
    this._shadowSprite.opacity = airship.shadowOpacity();
};

Spriteset_Map.prototype.updateWeather = function() {
    this._weather.type = $gameScreen.weatherType();
    this._weather.power = $gameScreen.weatherPower();
    this._weather.origin.x = $gameMap.displayX() * $gameMap.tileWidth();
    this._weather.origin.y = $gameMap.displayY() * $gameMap.tileHeight();
};

//-----------------------------------------------------------------------------
// Spriteset_Battle
//
// The set of sprites on the battle screen.

function Spriteset_Battle() {
    this.initialize.apply(this, arguments);
}

Spriteset_Battle.prototype = Object.create(Spriteset_Base.prototype);
Spriteset_Battle.prototype.constructor = Spriteset_Battle;

Spriteset_Battle.prototype.initialize = function() {
    Spriteset_Base.prototype.initialize.call(this);
    this._battlebackLocated = false;
};

Spriteset_Battle.prototype.createLowerLayer = function() {
    Spriteset_Base.prototype.createLowerLayer.call(this);
    this.createBackground();
    this.createBattleField();
    this.createBattleback();
    this.createEnemies();
    this.createActors();
};

Spriteset_Battle.prototype.createBackground = function() {
    this._backgroundSprite = new Sprite();
    this._backgroundSprite.bitmap = SceneManager.backgroundBitmap();
    this._baseSprite.addChild(this._backgroundSprite);
};

Spriteset_Battle.prototype.update = function() {
    Spriteset_Base.prototype.update.call(this);
    this.updateActors();
    this.updateBattleback();
};

Spriteset_Battle.prototype.createBattleField = function() {
    var width = Graphics.boxWidth;
    var height = Graphics.boxHeight;
    var x = (Graphics.width - width) / 2;
    var y = (Graphics.height - height) / 2;
    this._battleField = new Sprite();
    this._battleField.setFrame(x, y, width, height);
    this._battleField.x = x;
    this._battleField.y = y;
    this._baseSprite.addChild(this._battleField);
};

Spriteset_Battle.prototype.createBattleback = function() {
    var margin = 32;
    var x = -this._battleField.x - margin;
    var y = -this._battleField.y - margin;
    var width = Graphics.width + margin * 2;
    var height = Graphics.height + margin * 2;
    this._back1Sprite = new TilingSprite();
    this._back2Sprite = new TilingSprite();
    this._back1Sprite.bitmap = this.battleback1Bitmap();
    this._back2Sprite.bitmap = this.battleback2Bitmap();
    this._back1Sprite.move(x, y, width, height);
    this._back2Sprite.move(x, y, width, height);
    this._battleField.addChild(this._back1Sprite);
    this._battleField.addChild(this._back2Sprite);
};

Spriteset_Battle.prototype.updateBattleback = function() {
    if (!this._battlebackLocated) {
        this.locateBattleback();
        this._battlebackLocated = true;
    }
};

Spriteset_Battle.prototype.locateBattleback = function() {
    var width = this._battleField.width;
    var height = this._battleField.height;
    var sprite1 = this._back1Sprite;
    var sprite2 = this._back2Sprite;
    sprite1.origin.x = sprite1.x + (sprite1.bitmap.width - width) / 2;
    sprite2.origin.x = sprite1.y + (sprite2.bitmap.width - width) / 2;
    if ($gameSystem.isSideView()) {
        sprite1.origin.y = sprite1.x + sprite1.bitmap.height - height;
        sprite2.origin.y = sprite1.y + sprite2.bitmap.height - height;
    }
};

Spriteset_Battle.prototype.battleback1Bitmap = function() {
    return ImageManager.loadBattleback1(this.battleback1Name());
};

Spriteset_Battle.prototype.battleback2Bitmap = function() {
    return ImageManager.loadBattleback2(this.battleback2Name());
};

Spriteset_Battle.prototype.battleback1Name = function() {
    if (BattleManager.isBattleTest()) {
        return $dataSystem.battleback1Name;
    } else if ($gameMap.battleback1Name()) {
        return $gameMap.battleback1Name();
    } else if ($gameMap.isOverworld()) {
        return this.overworldBattleback1Name();
    } else {
        return '';
    }
};

Spriteset_Battle.prototype.battleback2Name = function() {
    if (BattleManager.isBattleTest()) {
        return $dataSystem.battleback2Name;
    } else if ($gameMap.battleback2Name()) {
        return $gameMap.battleback2Name();
    } else if ($gameMap.isOverworld()) {
        return this.overworldBattleback2Name();
    } else {
        return '';
    }
};

Spriteset_Battle.prototype.overworldBattleback1Name = function() {
    if ($gameMap.battleback1Name() === '') return '';
    if ($gamePlayer.isInVehicle()) {
        return this.shipBattleback1Name();
    } else {
        return this.normalBattleback1Name();
    }
};

Spriteset_Battle.prototype.overworldBattleback2Name = function() {
    if ($gameMap.battleback2Name() === '') return '';
    if ($gamePlayer.isInVehicle()) {
        return this.shipBattleback2Name();
    } else {
        return this.normalBattleback2Name();
    }
};

Spriteset_Battle.prototype.normalBattleback1Name = function() {
    return (this.terrainBattleback1Name(this.autotileType(1)) ||
            this.terrainBattleback1Name(this.autotileType(0)) ||
            this.defaultBattleback1Name());
};

Spriteset_Battle.prototype.normalBattleback2Name = function() {
    return (this.terrainBattleback2Name(this.autotileType(1)) ||
            this.terrainBattleback2Name(this.autotileType(0)) ||
            this.defaultBattleback2Name());
};

Spriteset_Battle.prototype.terrainBattleback1Name = function(type) {
    switch (type) {
    case 24: case 25:
        return 'Wasteland';
    case 26: case 27:
        return 'DirtField';
    case 32: case 33:
        return 'Desert';
    case 34:
        return 'Lava1';
    case 35:
        return 'Lava2';
    case 40: case 41:
        return 'Snowfield';
    case 42:
        return 'Clouds';
    case 4: case 5:
        return 'PoisonSwamp';
    default:
        return null;
    }
};

Spriteset_Battle.prototype.terrainBattleback2Name = function(type) {
    switch (type) {
    case 20: case 21:
        return 'Forest';
    case 22: case 30: case 38:
        return 'Cliff';
    case 24: case 25: case 26: case 27:
        return 'Wasteland';
    case 32: case 33:
        return 'Desert';
    case 34: case 35:
        return 'Lava';
    case 40: case 41:
        return 'Snowfield';
    case 42:
        return 'Clouds';
    case 4: case 5:
        return 'PoisonSwamp';
    }
};

Spriteset_Battle.prototype.defaultBattleback1Name = function() {
    return 'Grassland';
};

Spriteset_Battle.prototype.defaultBattleback2Name = function() {
    return 'Grassland';
};

Spriteset_Battle.prototype.shipBattleback1Name = function() {
    return 'Ship';
};

Spriteset_Battle.prototype.shipBattleback2Name = function() {
    return 'Ship';
};

Spriteset_Battle.prototype.autotileType = function(z) {
    return $gameMap.autotileType($gamePlayer.x, $gamePlayer.y, z);
};

Spriteset_Battle.prototype.createEnemies = function() {
    var enemies = $gameTroop.members();
    var sprites = [];
    for (var i = 0; i < enemies.length; i++) {
        sprites[i] = new Sprite_Enemy(enemies[i]);
    }
    sprites.sort(this.compareEnemySprite.bind(this));
    for (var j = 0; j < sprites.length; j++) {
        this._battleField.addChild(sprites[j]);
    }
    this._enemySprites = sprites;
};

Spriteset_Battle.prototype.compareEnemySprite = function(a, b) {
    if (a.y !== b.y) {
        return a.y - b.y;
    } else {
        return b.spriteId - a.spriteId;
    }
};

Spriteset_Battle.prototype.createActors = function() {
    this._actorSprites = [];
    for (var i = 0; i < $gameParty.maxBattleMembers(); i++) {
        this._actorSprites[i] = new Sprite_Actor();
        this._battleField.addChild(this._actorSprites[i]);
    }
};

Spriteset_Battle.prototype.updateActors = function() {
    var members = $gameParty.battleMembers();
    for (var i = 0; i < this._actorSprites.length; i++) {
        this._actorSprites[i].setBattler(members[i]);
    }
};

Spriteset_Battle.prototype.battlerSprites = function() {
    return this._enemySprites.concat(this._actorSprites);
};

Spriteset_Battle.prototype.isAnimationPlaying = function() {
    return this.battlerSprites().some(function(sprite) {
        return sprite.isAnimationPlaying();
    });
};

Spriteset_Battle.prototype.isEffecting = function() {
    return this.battlerSprites().some(function(sprite) {
        return sprite.isEffecting();
    });
};

Spriteset_Battle.prototype.isAnyoneMoving = function() {
    return this.battlerSprites().some(function(sprite) {
        return sprite.isMoving();
    });
};

Spriteset_Battle.prototype.isBusy = function() {
    return this.isAnimationPlaying() || this.isAnyoneMoving();
};

//=============================================================================
// MapObject Plugin Command Handler
//=============================================================================

(function() {
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);

        if (command !== 'MapObject') return;

        var subCmd = args[0];
        var objectId = parseInt(args[1]);
        if (isNaN(objectId)) return;

        // spriteset 접근
        var scene = SceneManager._scene;
        var spriteset = scene && scene._spriteset;
        if (!spriteset || !spriteset.findObjectSprite) return;

        var container = spriteset.findObjectSprite(objectId);
        if (!container) return;

        var imgChild = container.children && container.children[0];

        // $dataMap.objects의 visible 동기화 (isPassable 등에서 참조)
        var syncDataVisible = function(vis) {
            var objs = $dataMap.objects;
            if (!objs) return;
            for (var j = 0; j < objs.length; j++) {
                if (objs[j] && objs[j].id === objectId) {
                    objs[j].visible = vis;
                    break;
                }
            }
        };

        switch (subCmd) {
            case 'show':
                container.visible = true;
                container._mapObjVisible = true;
                syncDataVisible(true);
                break;

            case 'hide':
                container.visible = false;
                container._mapObjVisible = false;
                syncDataVisible(false);
                break;

            case 'showWithShader': {
                var shaderType = args[2] || 'dissolve';
                var dur = parseFloat(args[3]) || 1.0;
                container.visible = true;
                container._mapObjVisible = true;
                syncDataVisible(true);
                if (imgChild && typeof PictureShader !== 'undefined' && window.PluginTween) {
                    // fade: threshold 0→1 (투명→불투명), 나머지: threshold 1→0
                    var isFade = shaderType === 'fade';
                    var startVal = isFade ? 0.0 : 1.0;
                    var endVal = isFade ? 1.0 : 0.0;
                    var tempShader = { type: shaderType, enabled: true, params: { threshold: startVal, animSpeed: 0 } };
                    if (!imgChild._objShaderData) imgChild._objShaderData = [];
                    imgChild._objShaderData.push(tempShader);
                    imgChild._objShaderKey = '';
                    PluginTween.add({
                        target: tempShader.params, key: 'threshold', to: endVal, duration: dur,
                        onComplete: function() {
                            var idx = imgChild._objShaderData.indexOf(tempShader);
                            if (idx >= 0) imgChild._objShaderData.splice(idx, 1);
                            imgChild._objShaderKey = '';
                        }
                    });
                }
                break;
            }

            case 'hideWithShader': {
                var shaderType2 = args[2] || 'dissolve';
                var dur2 = parseFloat(args[3]) || 1.0;
                if (imgChild && typeof PictureShader !== 'undefined' && window.PluginTween) {
                    // fade: threshold 1→0 (불투명→투명), 나머지: threshold 0→1
                    var isFade2 = shaderType2 === 'fade';
                    var startVal2 = isFade2 ? 1.0 : 0.0;
                    var endVal2 = isFade2 ? 0.0 : 1.0;
                    var tempShader2 = { type: shaderType2, enabled: true, params: { threshold: startVal2, animSpeed: 0 } };
                    if (!imgChild._objShaderData) imgChild._objShaderData = [];
                    imgChild._objShaderData.push(tempShader2);
                    imgChild._objShaderKey = '';
                    PluginTween.add({
                        target: tempShader2.params, key: 'threshold', to: endVal2, duration: dur2,
                        onComplete: function() {
                            container.visible = false;
                            container._mapObjVisible = false;
                            syncDataVisible(false);
                            var idx = imgChild._objShaderData.indexOf(tempShader2);
                            if (idx >= 0) imgChild._objShaderData.splice(idx, 1);
                            imgChild._objShaderKey = '';
                        }
                    });
                } else {
                    container.visible = false;
                    container._mapObjVisible = false;
                    syncDataVisible(false);
                }
                break;
            }

            case 'move': {
                var mx = parseFloat(args[2]) || 0;
                var my = parseFloat(args[3]) || 0;
                var mDur = parseFloat(args[4]) || 0;
                if (mDur > 0 && window.PluginTween) {
                    PluginTween.add({ target: container, key: '_mapObjX', to: mx, duration: mDur });
                    PluginTween.add({ target: container, key: '_mapObjY', to: my, duration: mDur });
                } else {
                    container._mapObjX = mx;
                    container._mapObjY = my;
                }
                break;
            }

            case 'scale': {
                var sv = parseFloat(args[2]) || 1;
                var sDur = parseFloat(args[3]) || 0;
                if (imgChild) {
                    if (sDur > 0 && window.PluginTween) {
                        PluginTween.add({ target: imgChild.scale, key: 'x', to: sv, duration: sDur });
                        PluginTween.add({ target: imgChild.scale, key: 'y', to: sv, duration: sDur });
                    } else {
                        imgChild.scale.set(sv, sv);
                    }
                }
                break;
            }

            case 'zHeight': {
                var zh = parseFloat(args[2]) || 0;
                var zDur = parseFloat(args[3]) || 0;
                if (container._mapObjZHeight == null) container._mapObjZHeight = 0;
                if (zDur > 0 && window.PluginTween) {
                    PluginTween.add({ target: container, key: '_mapObjZHeight', to: zh, duration: zDur });
                } else {
                    container._mapObjZHeight = zh;
                }
                break;
            }

            case 'anchorY': {
                var ay = parseFloat(args[2]) || 1;
                var aDur = parseFloat(args[3]) || 0;
                if (imgChild && imgChild.anchor) {
                    if (aDur > 0 && window.PluginTween) {
                        PluginTween.add({ target: imgChild.anchor, key: 'y', to: ay, duration: aDur });
                    } else {
                        imgChild.anchor.y = ay;
                    }
                }
                break;
            }

            case 'passability': {
                var passVal = args[2] === '1' || args[2] === 'true';
                if ($dataMap && $dataMap.objects) {
                    for (var pi = 0; pi < $dataMap.objects.length; pi++) {
                        var pobj = $dataMap.objects[pi];
                        if (pobj && pobj.id === objectId && pobj.passability) {
                            for (var pk in pobj.passability) {
                                pobj.passability[pk] = passVal;
                            }
                        }
                    }
                }
                break;
            }

            case 'shader_add': {
                var saType = args[2];
                if (imgChild && saType) {
                    if (!imgChild._objShaderData) imgChild._objShaderData = [];
                    imgChild._objShaderData.push({ type: saType, enabled: true, params: {} });
                    imgChild._objShaderKey = '';
                }
                break;
            }

            case 'shader_remove': {
                var srType = args[2];
                if (imgChild && imgChild._objShaderData) {
                    if (srType === 'all') {
                        imgChild._objShaderData = [];
                    } else {
                        imgChild._objShaderData = imgChild._objShaderData.filter(function(s) {
                            return s.type !== srType;
                        });
                    }
                    imgChild._objShaderKey = '';
                }
                break;
            }

            case 'shader_param': {
                var spType = args[2];
                var spKey = args[3];
                var spVal = parseFloat(args[4]);
                var spDur = parseFloat(args[5]) || 0;
                if (imgChild && imgChild._objShaderData && spType && spKey && !isNaN(spVal)) {
                    var shaderEntry = null;
                    for (var si = 0; si < imgChild._objShaderData.length; si++) {
                        if (imgChild._objShaderData[si].type === spType) {
                            shaderEntry = imgChild._objShaderData[si];
                            break;
                        }
                    }
                    if (shaderEntry) {
                        if (!shaderEntry.params) shaderEntry.params = {};
                        if (spDur > 0 && window.PluginTween) {
                            if (shaderEntry.params[spKey] == null) shaderEntry.params[spKey] = 0;
                            PluginTween.add({ target: shaderEntry.params, key: spKey, to: spVal, duration: spDur });
                        } else {
                            shaderEntry.params[spKey] = spVal;
                        }
                    }
                }
                break;
            }
        }
    };
})();
