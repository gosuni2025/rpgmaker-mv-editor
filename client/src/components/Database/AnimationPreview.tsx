import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Animation } from '../../types/rpgMakerMV';
import './AnimationPreview.css';

export interface AnimationPreviewHandle {
  play: () => void;
  stop: () => void;
}

// 애니메이션 프리뷰 캔버스 (대상 기본값: Dragon)
const AnimationPreview = React.forwardRef<
  AnimationPreviewHandle,
  { animation: Animation | undefined; initialFrame?: number; targetImageName?: string }
>(function AnimationPreviewInner({ animation, initialFrame, targetImageName }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const animFrameRef = useRef(0);
  const playingRef = useRef(false);
  const tickRef = useRef(0);
  const img1Ref = useRef<HTMLImageElement | null>(null);
  const img2Ref = useRef<HTMLImageElement | null>(null);
  const targetImgRef = useRef<HTMLImageElement | null>(null);
  const flashRef = useRef<{ color: number[]; duration: number; remaining: number } | null>(null);
  const targetHiddenRef = useRef(false);

  const CANVAS_W = 544;
  const CANVAS_H = 416;
  const CELL_SIZE = 192;
  const RATE = 4;

  const effectiveTarget = targetImageName ?? 'Dragon';

  // 대상 이미지 로드
  useEffect(() => {
    targetImgRef.current = null;
    if (!effectiveTarget) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `/api/resources/img_enemies/${effectiveTarget}.png`;
    img.onload = () => { targetImgRef.current = img; drawFrame(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTarget]);

  // 애니메이션 이미지 로드
  useEffect(() => {
    img1Ref.current = null;
    img2Ref.current = null;
    if (!animation) return;
    if (animation.animation1Name) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `/api/resources/img_animations/${animation.animation1Name}.png`;
      img.onload = () => { img1Ref.current = img; drawFrame(); };
    }
    if (animation.animation2Name) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `/api/resources/img_animations/${animation.animation2Name}.png`;
      img.onload = () => { img2Ref.current = img; drawFrame(); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation?.animation1Name, animation?.animation2Name]);

  const drawFrame = useCallback((frameIdx?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const idx = frameIdx ?? currentFrame;

    // 파란 배경 (RPG Maker MV 원본 스타일)
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 대상 배틀러 이미지
    const targetImg = targetImgRef.current;
    if (targetImg && !targetHiddenRef.current) {
      const tx = (CANVAS_W - targetImg.width) / 2;
      const ty = (CANVAS_H - targetImg.height) / 2;
      ctx.drawImage(targetImg, tx, ty);
    }

    // 게임 화면 경계선 (녹색)
    ctx.strokeStyle = 'rgba(0, 200, 100, 0.3)';
    ctx.lineWidth = 1;
    const gx = (CANVAS_W - 816 / 2) / 2;
    const gy = (CANVAS_H - 624 / 2) / 2;
    ctx.strokeRect(gx, gy, 816 / 2, 624 / 2);

    if (!animation || !animation.frames || idx >= animation.frames.length) return;
    const frame = animation.frames[idx];
    if (!frame) return;

    let anchorY = CANVAS_H / 2;
    if (targetImg) {
      const ty = (CANVAS_H - targetImg.height) / 2;
      if (animation.position === 0) anchorY = ty;
      else if (animation.position === 1) anchorY = ty + targetImg.height / 2;
      else if (animation.position === 2) anchorY = ty + targetImg.height;
      else anchorY = CANVAS_H / 2;
    }
    const anchorX = CANVAS_W / 2;

    for (const cell of frame) {
      if (!cell || cell.length < 8) continue;
      const [pattern, cx, cy, scale, rotation, mirror, opacity, blendMode] = cell;
      if (pattern < 0) continue;
      const img = pattern < 100 ? img1Ref.current : img2Ref.current;
      if (!img) continue;
      const p = pattern < 100 ? pattern : pattern - 100;
      const sx = (p % 5) * CELL_SIZE;
      const sy = Math.floor(p / 5) * CELL_SIZE;
      ctx.save();
      ctx.globalAlpha = opacity / 255;
      if (blendMode === 1) ctx.globalCompositeOperation = 'lighter';
      else if (blendMode === 2) ctx.globalCompositeOperation = 'multiply';
      else ctx.globalCompositeOperation = 'source-over';
      const dx = anchorX + cx;
      const dy = anchorY + cy;
      ctx.translate(dx, dy);
      if (rotation) ctx.rotate((rotation * Math.PI) / 180);
      const sc = scale / 100;
      ctx.scale(mirror ? -sc : sc, sc);
      ctx.drawImage(img, sx, sy, CELL_SIZE, CELL_SIZE, -CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
      ctx.restore();
    }

    // 플래시 효과
    if (flashRef.current && flashRef.current.remaining > 0) {
      const f = flashRef.current;
      const alpha = (f.color[3] / 255) * (f.remaining / f.duration);
      if (f.color[0] || f.color[1] || f.color[2]) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${f.color[0]},${f.color[1]},${f.color[2]})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.restore();
      }
    }
  }, [animation, currentFrame]);

  useEffect(() => {
    if (!playing) drawFrame();
  }, [drawFrame, playing, currentFrame]);

  const playAnimation = useCallback(() => {
    if (!animation || !animation.frames || animation.frames.length === 0) return;
    setPlaying(true);
    playingRef.current = true;
    tickRef.current = 0;
    flashRef.current = null;
    targetHiddenRef.current = false;
    setCurrentFrame(0);

    const tick = () => {
      if (!playingRef.current) return;
      const t = tickRef.current;
      const frameIdx = Math.floor(t / RATE);
      if (frameIdx >= animation.frames.length) {
        playingRef.current = false;
        setPlaying(false);
        targetHiddenRef.current = false;
        setCurrentFrame(0);
        drawFrame(0);
        return;
      }
      if (animation.timings) {
        for (const timing of animation.timings) {
          if (timing.frame === frameIdx && t % RATE === 0) {
            if (timing.flashScope === 1 || timing.flashScope === 2) {
              flashRef.current = { color: timing.flashColor || [255, 255, 255, 170], duration: timing.flashDuration || 5, remaining: timing.flashDuration || 5 };
            }
            if (timing.flashScope === 3) targetHiddenRef.current = true;
            if (timing.se && timing.se.name) {
              const audio = new Audio(`/api/resources/audio_se/${timing.se.name}.ogg`);
              audio.volume = (timing.se.volume || 90) / 100;
              audio.play().catch(() => {});
            }
          }
        }
      }
      if (flashRef.current && flashRef.current.remaining > 0) flashRef.current.remaining -= 1 / RATE;
      setCurrentFrame(frameIdx);
      drawFrame(frameIdx);
      tickRef.current++;
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [animation, drawFrame]);

  const stopAnimation = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    targetHiddenRef.current = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setCurrentFrame(0);
    drawFrame(0);
  }, [drawFrame]);

  React.useImperativeHandle(ref, () => ({ play: playAnimation, stop: stopAnimation }), [playAnimation, stopAnimation]);

  useEffect(() => {
    return () => {
      playingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation?.id]);

  useEffect(() => {
    if (initialFrame !== undefined && !playing) {
      setCurrentFrame(initialFrame);
      drawFrame(initialFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFrame]);

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
