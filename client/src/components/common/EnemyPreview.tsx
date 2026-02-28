import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import type { Enemy } from '../../types/rpgMakerMV';

// ─── 공통: DB 캐시 팩토리 ────────────────────────────────────────────────────

export function makeDbCache<T>(endpoint: string) {
  let cache: (T | null)[] | null = null;
  let loading = false;
  const callbacks: ((data: (T | null)[]) => void)[] = [];

  function load(cb: (data: (T | null)[]) => void) {
    if (cache) { cb(cache); return; }
    callbacks.push(cb);
    if (loading) return;
    loading = true;
    apiClient.get<(T | null)[]>(`/database/${endpoint}`).then(data => {
      cache = data;
      callbacks.forEach(fn => fn(data));
      callbacks.length = 0;
      loading = false;
    }).catch(() => { loading = false; callbacks.length = 0; });
  }

  function invalidate() { cache = null; loading = false; }
  function getCache() { return cache; }

  return { load, invalidate, getCache };
}

// ─── 공통: UI 헬퍼 컴포넌트 ─────────────────────────────────────────────────

export function PreviewRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 4px', background: '#333', borderRadius: 3 }}>
      <span style={{ color: '#aaa' }}>{label}</span>
      <span style={{ color: color ?? '#fff' }}>{value}</span>
    </div>
  );
}

export function PreviewNote({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 11, color: '#aaa', background: '#333', borderRadius: 3, padding: '4px 6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 60, overflowY: 'auto' }}>
      {text}
    </div>
  );
}

export function PreviewLoading() {
  return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>로딩 중...</div>;
}

export function PreviewEmpty() {
  return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>데이터 없음</div>;
}

export function PreviewShell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>;
}

// ─── 적 미리보기 ─────────────────────────────────────────────────────────────

const ENEMY_PARAM_LABELS = ['최대HP', '최대MP', '공격력', '방어력', '마법력', '마법방어', '민첩성', '행운'];

const enemyDb = makeDbCache<Enemy>('enemies');

export function invalidateEnemyPreviewCache() { enemyDb.invalidate(); }

function rotateHue(data: Uint8ClampedArray, hue: number) {
  const cos = Math.cos((hue * Math.PI) / 180);
  const sin = Math.sin((hue * Math.PI) / 180);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i]     = Math.min(255, Math.max(0, r * (cos + (1 - cos) / 3) + g * ((1 - cos) / 3 - sin * 0.5774) + b * ((1 - cos) / 3 + sin * 0.5774)));
    data[i + 1] = Math.min(255, Math.max(0, r * ((1 - cos) / 3 + sin * 0.5774) + g * (cos + (1 - cos) / 3) + b * ((1 - cos) / 3 - sin * 0.5774)));
    data[i + 2] = Math.min(255, Math.max(0, r * ((1 - cos) / 3 - sin * 0.5774) + g * ((1 - cos) / 3 + sin * 0.5774) + b * (cos + (1 - cos) / 3)));
  }
}

function EnemyBattlerImage({ battlerName, battlerHue }: { battlerName: string; battlerHue: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!battlerName || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.src = `/api/resources/img_enemies/${encodeURIComponent(battlerName)}.png`;
    img.onload = () => {
      const maxW = 216, maxH = 144;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.floor(img.width * scale), h = Math.floor(img.height * scale);
      canvas.width = w; canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      if (battlerHue !== 0) {
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const octx = off.getContext('2d')!;
        octx.drawImage(img, 0, 0, w, h);
        const imageData = octx.getImageData(0, 0, w, h);
        rotateHue(imageData.data, battlerHue);
        ctx.putImageData(imageData, 0, 0);
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }
    };
    img.onerror = () => {
      canvas.width = 216; canvas.height = 40;
      ctx.fillStyle = '#555'; ctx.fillRect(0, 0, 216, 40);
      ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('이미지 없음', 108, 26);
    };
  }, [battlerName, battlerHue]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block', margin: '0 auto' }} />;
}

export function EnemyPreview({ id }: { id: number }) {
  const [enemies, setEnemies] = useState<(Enemy | null)[] | null>(enemyDb.getCache());

  useEffect(() => {
    if (!enemyDb.getCache()) enemyDb.load(setEnemies);
  }, []);

  if (!enemies) return <PreviewLoading />;
  const enemy = enemies[id] ?? null;
  if (!enemy) return <PreviewEmpty />;

  return (
    <PreviewShell>
      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', textAlign: 'center', borderBottom: '1px solid #444', paddingBottom: 6 }}>
        {enemy.name || '(이름 없음)'}
      </div>
      <div style={{ textAlign: 'center', background: '#1a1a2e', borderRadius: 4, padding: '8px 4px', minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {enemy.battlerName
          ? <EnemyBattlerImage battlerName={enemy.battlerName} battlerHue={enemy.battlerHue} />
          : <span style={{ color: '#666', fontSize: 11 }}>이미지 없음</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px' }}>
        {ENEMY_PARAM_LABELS.map((label, i) => (
          <PreviewRow key={i} label={label} value={enemy.params?.[i] ?? 0} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <PreviewRow label="EXP" value={enemy.exp} color="#f0c060" />
        <PreviewRow label="골드" value={enemy.gold} color="#f0c060" />
      </div>
      {enemy.note?.trim() && <PreviewNote text={enemy.note.trim()} />}
    </PreviewShell>
  );
}
