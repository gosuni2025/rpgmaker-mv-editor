import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import type { Enemy } from '../../types/rpgMakerMV';

const PARAM_LABELS = ['최대HP', '최대MP', '공격력', '방어력', '마법력', '마법방어', '민첩성', '행운'];

/** battlerName으로 적 이미지를 canvas에 그리는 컴포넌트 */
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
      // 최대 216x144 비율로 축소
      const maxW = 216;
      const maxH = 144;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);

      if (battlerHue !== 0) {
        // hue 적용: offscreen에 그린 후 pixel 조작
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
      canvas.width = 216;
      canvas.height = 40;
      ctx.fillStyle = '#555';
      ctx.fillRect(0, 0, 216, 40);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('이미지 없음', 108, 26);
    };
  }, [battlerName, battlerHue]);

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
    />
  );
}

/** 색상 회전 (간단한 HSL hue rotation) */
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

let _enemyCache: (Enemy | null)[] | null = null;
let _enemyLoading = false;
const _enemyCallbacks: ((data: (Enemy | null)[]) => void)[] = [];

function loadEnemies(cb: (data: (Enemy | null)[]) => void) {
  if (_enemyCache) { cb(_enemyCache); return; }
  _enemyCallbacks.push(cb);
  if (_enemyLoading) return;
  _enemyLoading = true;
  apiClient.get<(Enemy | null)[]>('/database/enemies').then(data => {
    _enemyCache = data;
    _enemyCallbacks.forEach(fn => fn(data));
    _enemyCallbacks.length = 0;
  }).catch(() => {
    _enemyLoading = false;
    _enemyCallbacks.length = 0;
  });
}

/** 캐시를 무효화 (데이터 변경 후 호출) */
export function invalidateEnemyPreviewCache() {
  _enemyCache = null;
  _enemyLoading = false;
}

/** DataListPicker의 renderPreview에 전달할 적 미리보기 컴포넌트 */
export function EnemyPreview({ id }: { id: number }) {
  const [enemies, setEnemies] = useState<(Enemy | null)[] | null>(_enemyCache);

  useEffect(() => {
    if (!_enemyCache) {
      loadEnemies(setEnemies);
    }
  }, []);

  const enemy = enemies?.[id] ?? null;

  if (!enemies) {
    return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>로딩 중...</div>;
  }

  if (!enemy) {
    return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>데이터 없음</div>;
  }

  const note = enemy.note?.trim();

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 이름 */}
      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', textAlign: 'center', borderBottom: '1px solid #444', paddingBottom: 6 }}>
        {enemy.name || '(이름 없음)'}
      </div>

      {/* 배틀러 이미지 */}
      <div style={{ textAlign: 'center', background: '#1a1a2e', borderRadius: 4, padding: '8px 4px', minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {enemy.battlerName ? (
          <EnemyBattlerImage battlerName={enemy.battlerName} battlerHue={enemy.battlerHue} />
        ) : (
          <span style={{ color: '#666', fontSize: 11 }}>이미지 없음</span>
        )}
      </div>

      {/* 스탯 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px' }}>
        {PARAM_LABELS.map((label, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc', padding: '2px 4px', background: '#333', borderRadius: 3 }}>
            <span style={{ color: '#aaa' }}>{label}</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>{enemy.params?.[i] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* 경험치 / 골드 */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc', padding: '2px 4px', background: '#333', borderRadius: 3 }}>
          <span style={{ color: '#f0c060' }}>EXP</span>
          <span style={{ color: '#fff' }}>{enemy.exp}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc', padding: '2px 4px', background: '#333', borderRadius: 3 }}>
          <span style={{ color: '#f0c060' }}>골드</span>
          <span style={{ color: '#fff' }}>{enemy.gold}</span>
        </div>
      </div>

      {/* 메모 */}
      {note && (
        <div style={{ fontSize: 11, color: '#aaa', background: '#333', borderRadius: 3, padding: '4px 6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 60, overflowY: 'auto' }}>
          {note}
        </div>
      )}
    </div>
  );
}
