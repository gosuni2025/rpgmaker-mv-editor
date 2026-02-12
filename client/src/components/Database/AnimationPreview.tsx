import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Animation } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import './AnimationPreview.css';

// 대상 이미지 선택 팝업
function TargetPickerPopup({ enemyList, value, onSelect, onClose }: {
  enemyList: string[];
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!filter) return enemyList;
    const lower = filter.toLowerCase();
    return enemyList.filter(n => n.toLowerCase().includes(lower));
  }, [enemyList, filter]);

  return (
    <div className="target-picker-popup" ref={popupRef}>
      <div className="target-picker-header">
        <span>{t('animations.targetSelect')}</span>
        <button className="db-btn-small" onClick={onClose}>X</button>
      </div>
      <input
        type="text"
        placeholder={t('animations.search')}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="target-picker-search"
        autoFocus
      />
      <div className="target-picker-grid">
        <div
          className={`target-picker-item${value === '' ? ' selected' : ''}`}
          onClick={() => { onSelect(''); onClose(); }}
        >
          <div className="target-picker-thumb empty">{t('common.none')}</div>
        </div>
        {filtered.map((name) => (
          <div
            key={name}
            className={`target-picker-item${name === value ? ' selected' : ''}`}
            onClick={() => { onSelect(name); onClose(); }}
          >
            <img
              src={`/api/resources/img_enemies/${name}.png`}
              alt={name}
              className="target-picker-thumb"
              loading="lazy"
            />
            <div className="target-picker-name">{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 애니메이션 프리뷰 캔버스
export default function AnimationPreview({ animation }: { animation: Animation | undefined }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [targetImage, setTargetImage] = useState<string>('');
  const [enemyList, setEnemyList] = useState<string[]>([]);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
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
  const RATE = 4; // frames per animation frame

  // 적 이미지 목록 로드
  useEffect(() => {
    apiClient.get<string[]>('/resources/img_enemies').then((files) => {
      setEnemyList(files.filter(f => f.endsWith('.png')).map(f => f.replace('.png', '')));
    }).catch(() => {});
  }, []);

  // 대상 이미지 로드
  useEffect(() => {
    if (targetImgRef.current) targetImgRef.current = null;
    if (!targetImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `/api/resources/img_enemies/${targetImage}.png`;
    img.onload = () => { targetImgRef.current = img; drawFrame(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetImage]);

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

    // 체크 패턴 배경
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const checkSize = 16;
    for (let y = 0; y < CANVAS_H; y += checkSize) {
      for (let x = 0; x < CANVAS_W; x += checkSize) {
        ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#555' : '#444';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // 대상 배틀러 이미지
    const targetImg = targetImgRef.current;
    if (targetImg && !targetHiddenRef.current) {
      const tx = (CANVAS_W - targetImg.width) / 2;
      const ty = (CANVAS_H - targetImg.height) / 2;
      ctx.drawImage(targetImg, tx, ty);
    }

    // 애니메이션 프레임 그리기
    if (!animation || !animation.frames || idx >= animation.frames.length) return;
    const frame = animation.frames[idx];
    if (!frame) return;

    // 대상 기준 위치 계산
    let anchorY = CANVAS_H / 2;
    if (targetImg) {
      const ty = (CANVAS_H - targetImg.height) / 2;
      if (animation.position === 0) anchorY = ty; // 머리 위
      else if (animation.position === 1) anchorY = ty + targetImg.height / 2; // 중심
      else if (animation.position === 2) anchorY = ty + targetImg.height; // 발 밑
      else anchorY = CANVAS_H / 2; // 화면
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

      ctx.drawImage(
        img,
        sx, sy, CELL_SIZE, CELL_SIZE,
        -CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE
      );
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

  // 정적 상태에서 다시 그리기
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

      // 타이밍 이벤트 처리
      if (animation.timings) {
        for (const timing of animation.timings) {
          if (timing.frame === frameIdx && t % RATE === 0) {
            // 플래시 효과
            if (timing.flashScope === 1 || timing.flashScope === 2) {
              flashRef.current = {
                color: timing.flashColor || [255, 255, 255, 170],
                duration: timing.flashDuration || 5,
                remaining: timing.flashDuration || 5,
              };
            }
            // 대상 제거
            if (timing.flashScope === 3) {
              targetHiddenRef.current = true;
            }
            // SE 재생
            if (timing.se && timing.se.name) {
              const audio = new Audio(`/api/resources/audio_se/${timing.se.name}.ogg`);
              audio.volume = (timing.se.volume || 90) / 100;
              audio.play().catch(() => {});
            }
          }
        }
      }

      // 플래시 감쇠
      if (flashRef.current && flashRef.current.remaining > 0) {
        flashRef.current.remaining -= 1 / RATE;
      }

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

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      playingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // 애니메이션 변경 시 중지
  useEffect(() => {
    stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation?.id]);

  const totalFrames = animation?.frames?.length || 0;

  return (
    <div className="anim-preview-container">
      <div className="anim-preview-toolbar">
        <div className="anim-preview-target-label">
          {t('animations.target')}
          <button
            className="target-picker-btn"
            onClick={() => setShowTargetPicker(true)}
          >
            {targetImage ? (
              <>
                <img src={`/api/resources/img_enemies/${targetImage}.png`} className="target-picker-btn-thumb" alt="" />
                <span>{targetImage}</span>
              </>
            ) : (
              <span>{t('common.none')}</span>
            )}
          </button>
        </div>
        {showTargetPicker && (
          <TargetPickerPopup
            enemyList={enemyList}
            value={targetImage}
            onSelect={setTargetImage}
            onClose={() => setShowTargetPicker(false)}
          />
        )}
        <div className="anim-preview-controls">
          {!playing ? (
            <button className="db-btn-small anim-play-btn" onClick={playAnimation} disabled={totalFrames === 0}>
              {t('animations.play')}
            </button>
          ) : (
            <button className="db-btn-small anim-stop-btn" onClick={stopAnimation}>
              {t('animations.stop')}
            </button>
          )}
          <span className="anim-frame-info">
            {playing ? currentFrame + 1 : 0} / {totalFrames} {t('animations.frame')}
          </span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="anim-preview-canvas"
      />
    </div>
  );
}
