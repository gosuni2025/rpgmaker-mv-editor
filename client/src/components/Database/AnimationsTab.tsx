import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Animation, AnimationTiming, AudioFile } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import AudioPicker from '../common/AudioPicker';
import apiClient from '../../api/client';

interface AnimationsTabProps {
  data: (Animation | null)[] | undefined;
  onChange: (data: (Animation | null)[]) => void;
}

const POSITION_OPTIONS = ['머리 위', '중심', '발 밑', '화면'];

// 애니메이션 프리뷰 캔버스
function AnimationPreview({ animation }: { animation: Animation | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [targetImage, setTargetImage] = useState<string>('');
  const [enemyList, setEnemyList] = useState<string[]>([]);
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

    const totalTicks = animation.frames.length * RATE;

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
        <label className="anim-preview-target-label">
          대상
          <select
            value={targetImage}
            onChange={(e) => setTargetImage(e.target.value)}
            className="anim-preview-target-select"
          >
            <option value="">(없음)</option>
            {enemyList.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <div className="anim-preview-controls">
          {!playing ? (
            <button className="db-btn-small anim-play-btn" onClick={playAnimation} disabled={totalFrames === 0}>
              ▶ 재생
            </button>
          ) : (
            <button className="db-btn-small anim-stop-btn" onClick={stopAnimation}>
              ■ 정지
            </button>
          )}
          <span className="anim-frame-info">
            {playing ? currentFrame + 1 : 0} / {totalFrames} 프레임
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

export default function AnimationsTab({ data, onChange }: AnimationsTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const handleFieldChange = (field: keyof Animation, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleAddNew = () => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newAnim: Animation = {
      id: maxId + 1, name: '', animation1Name: '', animation1Hue: 0,
      animation2Name: '', animation2Hue: 0, position: 1, frames: [[]], timings: [],
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newAnim;
    onChange(newData);
    setSelectedId(maxId + 1);
  };

  const handleTimingChange = (index: number, field: keyof AnimationTiming, value: unknown) => {
    const timings = [...(selectedItem?.timings || [])];
    timings[index] = { ...timings[index], [field]: value };
    handleFieldChange('timings', timings);
  };

  const addTiming = () => {
    const timings = [...(selectedItem?.timings || []), { flashColor: [255, 255, 255, 170], flashDuration: 5, flashScope: 1, frame: 0, se: { name: '', pan: 0, pitch: 100, volume: 90 } }];
    handleFieldChange('timings', timings);
  };

  const removeTiming = (index: number) => {
    handleFieldChange('timings', (selectedItem?.timings || []).filter((_: unknown, i: number) => i !== index));
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={handleAddNew}>+</button>
        </div>
        {data?.filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className={`db-list-item${item!.id === selectedId ? ' selected' : ''}`}
            onClick={() => setSelectedId(item!.id)}
          >
            {String(item!.id).padStart(4, '0')}: {item!.name}
          </div>
        ))}
      </div>
      <div className="db-form anim-form-layout">
        {selectedItem && (
          <>
            <div className="anim-top-section">
              <div className="anim-settings-panel">
                <label>
                  이름
                  <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
                </label>

                <div className="db-form-section">이미지 1</div>
                <ImagePicker
                  type="animations"
                  value={selectedItem.animation1Name || ''}
                  onChange={(n) => handleFieldChange('animation1Name', n)}
                />
                <label>
                  색조
                  <div className="db-slider-row">
                    <input type="range" min={0} max={360} value={selectedItem.animation1Hue || 0} onChange={(e) => handleFieldChange('animation1Hue', Number(e.target.value))} />
                    <span className="db-slider-value">{selectedItem.animation1Hue || 0}</span>
                  </div>
                </label>

                <div className="db-form-section">이미지 2</div>
                <ImagePicker
                  type="animations"
                  value={selectedItem.animation2Name || ''}
                  onChange={(n) => handleFieldChange('animation2Name', n)}
                />
                <label>
                  색조
                  <div className="db-slider-row">
                    <input type="range" min={0} max={360} value={selectedItem.animation2Hue || 0} onChange={(e) => handleFieldChange('animation2Hue', Number(e.target.value))} />
                    <span className="db-slider-value">{selectedItem.animation2Hue || 0}</span>
                  </div>
                </label>

                <label>
                  위치
                  <select value={selectedItem.position || 0} onChange={(e) => handleFieldChange('position', Number(e.target.value))}>
                    {POSITION_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                  </select>
                </label>

                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                  {(selectedItem.frames || []).length} 프레임
                </div>
              </div>

              <AnimationPreview animation={selectedItem} />
            </div>

            <div className="db-form-section">
              타이밍
              <button className="db-btn-small" onClick={addTiming}>+</button>
            </div>
            {(selectedItem.timings || []).map((timing: AnimationTiming, i: number) => (
              <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #444' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <label>프레임 <input type="number" value={timing.frame} onChange={(e) => handleTimingChange(i, 'frame', Number(e.target.value))} style={{ width: 50 }} /></label>
                  <label>
                    플래시 범위
                    <select value={timing.flashScope} onChange={(e) => handleTimingChange(i, 'flashScope', Number(e.target.value))} style={{ width: 90 }}>
                      <option value={0}>없음</option>
                      <option value={1}>대상</option>
                      <option value={2}>화면</option>
                      <option value={3}>대상 제거</option>
                    </select>
                  </label>
                  <label>지속시간 <input type="number" value={timing.flashDuration || 0} onChange={(e) => handleTimingChange(i, 'flashDuration', Number(e.target.value))} style={{ width: 40 }} /></label>
                  <button className="db-btn-small" onClick={() => removeTiming(i)}>-</button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ flex: 1 }}>
                    SE
                    <AudioPicker type="se" value={timing.se || { name: '', pan: 0, pitch: 100, volume: 90 }} onChange={(a: AudioFile) => handleTimingChange(i, 'se', a)} />
                  </label>
                  <label>플래시 색상 (RGBA)
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[0, 1, 2, 3].map((ci) => (
                        <input key={ci} type="number" value={(timing.flashColor || [255, 255, 255, 170])[ci]}
                          onChange={(e) => { const c = [...(timing.flashColor || [255, 255, 255, 170])]; c[ci] = Number(e.target.value); handleTimingChange(i, 'flashColor', c); }}
                          style={{ width: 40 }} min={0} max={255} />
                      ))}
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
