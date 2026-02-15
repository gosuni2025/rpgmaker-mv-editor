import React, { useEffect, useRef } from 'react';
import type { Animation } from '../../types/rpgMakerMV';
import './AnimationPreview.css';

// Runtime globals (loaded via index.html script tags)
declare const THREE: any;
declare const Sprite: any;
declare const Sprite_Animation: any;
declare const Sprite_Base: any;
declare const ThreeContainer: any;
declare const RendererStrategy: any;
declare const ImageManager: any;

export interface AnimationPreviewHandle {
  play: () => void;
  stop: () => void;
}

const CANVAS_W = 544;
const CANVAS_H = 416;

interface RuntimeState {
  rendererObj: any;
  stage: any;
  targetSprite: any;
  animSprite: any;
  animFrameId: number;
  playing: boolean;
}

/**
 * 런타임의 Sprite_Animation을 직접 사용하는 애니메이션 프리뷰.
 * Three.js WebGLRenderer로 실제 게임과 동일한 렌더링을 수행합니다.
 */
const AnimationPreview = React.forwardRef<
  AnimationPreviewHandle,
  { animation: Animation | undefined; initialFrame?: number; targetImageName?: string }
>(function AnimationPreviewInner({ animation, initialFrame, targetImageName }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rtRef = useRef<RuntimeState | null>(null);
  // props를 ref로 저장하여 콜백에서 최신값 참조
  const animRef = useRef(animation);
  animRef.current = animation;
  const initialFrameRef = useRef(initialFrame);
  initialFrameRef.current = initialFrame;
  const targetNameRef = useRef(targetImageName ?? 'Dragon');
  targetNameRef.current = targetImageName ?? 'Dragon';

  // --- 유틸리티 함수들 (ref 기반, 의존성 없음) ---

  function renderOnce() {
    const rt = rtRef.current;
    if (!rt) return;
    const strategy = RendererStrategy.getStrategy();
    strategy.render(rt.rendererObj, rt.stage);
  }

  function removeAnimSprite() {
    const rt = rtRef.current;
    if (!rt || !rt.animSprite) return;
    if (rt.animSprite.parent) rt.animSprite.parent.removeChild(rt.animSprite);
    rt.animSprite = null;
  }

  function loadTarget(name: string) {
    const rt = rtRef.current;
    if (!rt) return;
    if (name) {
      const bitmap = ImageManager.loadEnemy(name, 0);
      rt.targetSprite.bitmap = bitmap;
      bitmap.addLoadListener(() => {
        if (rtRef.current === rt) renderOnce();
      });
    } else {
      rt.targetSprite.bitmap = null;
    }
    renderOnce();
  }

  function showStaticFrame(frameIdx: number) {
    const rt = rtRef.current;
    const anim = animRef.current;
    if (!rt || !anim || !anim.frames) return;

    removeAnimSprite();

    const frame = anim.frames[frameIdx];
    if (!frame) { renderOnce(); return; }

    // Sprite_Animation.updatePosition과 동일한 위치 계산
    // target: anchor.y=1 (발밑 기준), y=CANVAS_H*3/4
    const targetY = rt.targetSprite.y;
    const targetH = rt.targetSprite.height || 0;
    let anchorX = rt.targetSprite.x;
    let anchorY = targetY;
    if (anim.position === 0) anchorY = targetY - targetH;
    else if (anim.position === 1) anchorY = targetY - targetH / 2;
    else if (anim.position === 2) anchorY = targetY;
    else { anchorX = CANVAS_W / 2; anchorY = CANVAS_H / 2; }

    // 임시 컨테이너에 셀 스프라이트 생성
    const container = new ThreeContainer();
    container.x = anchorX;
    container.y = anchorY;

    const bitmap1 = anim.animation1Name
      ? ImageManager.loadAnimation(anim.animation1Name, anim.animation1Hue || 0)
      : null;
    const bitmap2 = anim.animation2Name
      ? ImageManager.loadAnimation(anim.animation2Name, anim.animation2Hue || 0)
      : null;

    for (const cell of frame) {
      if (!cell || cell.length < 8) continue;
      const [pattern, cx, cy, scale, rotation, mirror, opacity, blendMode] = cell;
      if (pattern < 0) continue;

      const cellSprite = new Sprite();
      cellSprite.anchor.x = 0.5;
      cellSprite.anchor.y = 0.5;
      cellSprite.bitmap = pattern < 100 ? bitmap1 : bitmap2;
      const p = pattern < 100 ? pattern : pattern - 100;
      const sx = (p % 5) * 192;
      const sy = Math.floor(p / 5) * 192;
      cellSprite.setFrame(sx, sy, 192, 192);
      cellSprite.x = cx;
      cellSprite.y = cy;
      cellSprite.rotation = rotation * Math.PI / 180;
      cellSprite.scale.x = (mirror ? -1 : 1) * scale / 100;
      cellSprite.scale.y = scale / 100;
      cellSprite.opacity = opacity;
      cellSprite.blendMode = blendMode;
      container.addChild(cellSprite);
    }

    rt.stage.addChild(container);
    rt.animSprite = container;

    // 비트맵 로드 대기 후 렌더링
    const tryRender = () => {
      if (rtRef.current !== rt) return;
      const ready1 = !bitmap1 || bitmap1.isReady();
      const ready2 = !bitmap2 || bitmap2.isReady();
      if (ready1 && ready2) {
        renderOnce();
      } else {
        requestAnimationFrame(tryRender);
      }
    };
    tryRender();
  }

  function playAnimation() {
    const rt = rtRef.current;
    const anim = animRef.current;
    if (!rt || !anim || !anim.frames || anim.frames.length === 0) return;

    stopAnimation();

    // Sprite_Animation 생성
    const animSprite = new Sprite_Animation();
    animSprite.setup(rt.targetSprite, anim, false, 0);
    rt.stage.addChild(animSprite);
    rt.animSprite = animSprite;
    rt.playing = true;

    const FRAME_DURATION = 1000 / 60; // 60fps 고정
    let lastTime = 0;

    const tick = (timestamp: number) => {
      if (!rt.playing || rtRef.current !== rt) return;

      // 60fps 프레임 제한: 원본 RPG Maker MV와 동일한 속도로 재생
      const elapsed = timestamp - lastTime;
      if (elapsed < FRAME_DURATION) {
        rt.animFrameId = requestAnimationFrame(tick);
        return;
      }
      lastTime = timestamp - (elapsed % FRAME_DURATION);

      try {
        animSprite.update();
        rt.targetSprite.update();
      } catch (_e) { /* ignore */ }

      renderOnce();

      if (animSprite.isPlaying()) {
        rt.animFrameId = requestAnimationFrame(tick);
      } else {
        rt.playing = false;
        if (animSprite.parent) animSprite.parent.removeChild(animSprite);
        rt.animSprite = null;
        rt.targetSprite.show();
        rt.targetSprite.setBlendColor([0, 0, 0, 0]);
        renderOnce();
      }
    };
    rt.animFrameId = requestAnimationFrame(tick);
  }

  function stopAnimation() {
    const rt = rtRef.current;
    if (!rt) return;
    rt.playing = false;
    if (rt.animFrameId) cancelAnimationFrame(rt.animFrameId);
    removeAnimSprite();
    rt.targetSprite.show();
    if (rt.targetSprite.setBlendColor) rt.targetSprite.setBlendColor([0, 0, 0, 0]);
    renderOnce();
  }

  // expose play/stop
  React.useImperativeHandle(ref, () => ({
    play: playAnimation,
    stop: stopAnimation,
  }));

  // === 런타임 초기화 (마운트 시 1회) ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof THREE === 'undefined') return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(CANVAS_W, CANVAS_H, false);
    renderer.setClearColor(0x1a2a4a, 1);
    renderer.sortObjects = true;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, CANVAS_W, 0, CANVAS_H, -10000, 10000);
    camera.position.z = 100;

    const rendererObj = {
      renderer, scene, camera,
      _width: CANVAS_W, _height: CANVAS_H,
      view: renderer.domElement,
      gl: renderer.getContext(),
      textureGC: { maxIdle: 3600, run: () => {} },
      plugins: {},
      _drawOrderCounter: 0,
    };

    const stage = new ThreeContainer();

    // 배경 (파란색)
    const bgBitmap = new (window as any).Bitmap(CANVAS_W, CANVAS_H);
    bgBitmap.fillRect(0, 0, CANVAS_W, CANVAS_H, '#1a2a4a');
    stage.addChild(new Sprite(bgBitmap));

    // 대상 배틀러 (Sprite_Base: setBlendColor/show/hide 지원)
    // anchor.y=1 (발밑 기준) — 원본 Sprite_Battler와 동일
    // Sprite_Animation.updatePosition이 target.height를 빼서 위치 계산하므로 필수
    const targetSprite = new Sprite_Base();
    targetSprite.anchor.x = 0.5;
    targetSprite.anchor.y = 1;
    targetSprite.x = CANVAS_W / 2;
    targetSprite.y = CANVAS_H / 2;
    stage.addChild(targetSprite);

    rtRef.current = {
      rendererObj, stage, targetSprite,
      animSprite: null, animFrameId: 0, playing: false,
    };

    // 대상 이미지 로드 & 초기 프레임 표시
    loadTarget(targetNameRef.current);
    const anim = animRef.current;
    if (anim && anim.frames && anim.frames.length > 0) {
      showStaticFrame(initialFrameRef.current ?? 0);
    }

    return () => {
      const rt = rtRef.current;
      if (rt) {
        rt.playing = false;
        if (rt.animFrameId) cancelAnimationFrame(rt.animFrameId);
        rt.rendererObj.renderer.dispose();
        rtRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 대상 이미지 변경
  useEffect(() => {
    if (!rtRef.current) return;
    loadTarget(targetNameRef.current);
    // 정적 프레임 다시 표시 (대상 위치 계산이 바뀔 수 있으므로)
    const anim = animRef.current;
    if (anim && anim.frames && anim.frames.length > 0 && !rtRef.current.playing) {
      // 대상 이미지 로드 후 프레임 다시 그리기
      const bitmap = rtRef.current.targetSprite.bitmap;
      if (bitmap) {
        bitmap.addLoadListener(() => {
          if (rtRef.current && !rtRef.current.playing) {
            showStaticFrame(initialFrameRef.current ?? 0);
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetImageName]);

  // 애니메이션 변경 시
  useEffect(() => {
    if (!rtRef.current) return;
    stopAnimation();
    const anim = animRef.current;
    if (anim && anim.frames && anim.frames.length > 0) {
      showStaticFrame(initialFrameRef.current ?? 0);
    } else {
      renderOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation?.id]);

  // initialFrame 변경 시
  useEffect(() => {
    if (!rtRef.current || rtRef.current.playing || initialFrame === undefined) return;
    showStaticFrame(initialFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFrame]);

  // 애니메이션 이미지/색조 변경 시
  useEffect(() => {
    if (!rtRef.current || rtRef.current.playing) return;
    const anim = animRef.current;
    if (anim && anim.frames && anim.frames.length > 0) {
      showStaticFrame(initialFrameRef.current ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation?.animation1Name, animation?.animation1Hue, animation?.animation2Name, animation?.animation2Hue]);

  return (
    <div className="anim-preview-container">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="anim-preview-canvas"
      />
    </div>
  );
});

export default AnimationPreview;
