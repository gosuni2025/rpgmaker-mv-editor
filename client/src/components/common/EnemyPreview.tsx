import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import { IconSprite } from '../EventEditor/dataListPicker';
import type { Enemy, Item, Weapon, Armor, Effect } from '../../types/rpgMakerMV';

// ─── 적 미리보기 ────────────────────────────────────────────────────────────

const ENEMY_PARAM_LABELS = ['최대HP', '최대MP', '공격력', '방어력', '마법력', '마법방어', '민첩성', '행운'];

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
  }).catch(() => { _enemyLoading = false; _enemyCallbacks.length = 0; });
}

export function invalidateEnemyPreviewCache() {
  _enemyCache = null; _enemyLoading = false;
}

export function EnemyPreview({ id }: { id: number }) {
  const [enemies, setEnemies] = useState<(Enemy | null)[] | null>(_enemyCache);

  useEffect(() => {
    if (!_enemyCache) loadEnemies(setEnemies);
  }, []);

  const enemy = enemies?.[id] ?? null;

  if (!enemies) return <Loading />;
  if (!enemy) return <Empty />;

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <Row key={i} label={label} value={enemy.params?.[i] ?? 0} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Row label="EXP" value={enemy.exp} color="#f0c060" />
        <Row label="골드" value={enemy.gold} color="#f0c060" />
      </div>
      {enemy.note?.trim() && <Note text={enemy.note.trim()} />}
    </div>
  );
}

// ─── 아이템/무기/방어구 미리보기 ────────────────────────────────────────────

const ITEM_PARAM_LABELS = ['최대HP', '최대MP', '공격력', '방어력', '마법력', '마법방어', '민첩성', '행운'];
const SCOPE_LABELS: Record<number, string> = {
  0: '없음', 1: '적 1명', 2: '적 전체', 3: '적 랜덤 1명', 4: '적 랜덤 2명',
  5: '적 랜덤 3명', 6: '적 랜덤 4명', 7: '아군 1명(전불)', 8: '아군 전체(전불)',
  9: '아군 1명', 10: '아군 전체', 11: '사용자',
};
const OCCASION_LABELS: Record<number, string> = { 0: '항상', 1: '전투 중만', 2: '메뉴 중만', 3: '절대 불가' };
const HIT_TYPE_LABELS: Record<number, string> = { 0: '필중', 1: '물리 공격', 2: '마법 공격' };
const EFFECT_PARAM: Record<number, string> = { 0: 'MaxHP', 1: 'MaxMP', 2: 'ATK', 3: 'DEF', 4: 'MAT', 5: 'MDF', 6: 'AGI', 7: 'LUK' };

function effectSummary(e: Effect): string {
  const pct = (v: number) => v !== 0 ? `${Math.round(v * 100)}%` : '';
  switch (e.code) {
    case 11: return `HP 회복 ${pct(e.value1)}${e.value2 ? ` +${e.value2}` : ''}`.trim();
    case 12: return `MP 회복 ${pct(e.value1)}${e.value2 ? ` +${e.value2}` : ''}`.trim();
    case 13: return `TP +${e.value1}`;
    case 21: return `${EFFECT_PARAM[e.dataId] ?? '?'} 버프 (${e.value1}턴)`;
    case 22: return `${EFFECT_PARAM[e.dataId] ?? '?'} 디버프 (${e.value1}턴)`;
    case 23: return `${EFFECT_PARAM[e.dataId] ?? '?'} 버프 제거`;
    case 24: return `${EFFECT_PARAM[e.dataId] ?? '?'} 디버프 제거`;
    case 31: return `스테이트 #${e.dataId} 추가 (${Math.round(e.value1 * 100)}%)`;
    case 32: return `스테이트 #${e.dataId} 제거`;
    case 41: return `스킬 습득 #${e.dataId}`;
    case 42: return `커먼 이벤트 #${e.dataId}`;
    case 43: return `TP 충전`;
    case 44: return `${EFFECT_PARAM[e.dataId] ?? '?'} 성장`;
    default: return `효과 ${e.code}`;
  }
}

type AnyEquip = Item | Weapon | Armor;
const _itemCache: Record<string, (AnyEquip | null)[] | null> = { items: null, weapons: null, armors: null };
const _itemLoading: Record<string, boolean> = { items: false, weapons: false, armors: false };
const _itemCallbacks: Record<string, ((data: (AnyEquip | null)[]) => void)[]> = { items: [], weapons: [], armors: [] };

function loadItemData(endpoint: string, cb: (data: (AnyEquip | null)[]) => void) {
  if (_itemCache[endpoint]) { cb(_itemCache[endpoint]!); return; }
  _itemCallbacks[endpoint].push(cb);
  if (_itemLoading[endpoint]) return;
  _itemLoading[endpoint] = true;
  apiClient.get<(AnyEquip | null)[]>(`/database/${endpoint}`).then(data => {
    _itemCache[endpoint] = data;
    _itemCallbacks[endpoint].forEach(fn => fn(data));
    _itemCallbacks[endpoint] = [];
    _itemLoading[endpoint] = false;
  }).catch(() => { _itemLoading[endpoint] = false; _itemCallbacks[endpoint] = []; });
}

export function invalidateItemPreviewCache(endpoint?: string) {
  if (endpoint) { _itemCache[endpoint] = null; _itemLoading[endpoint] = false; }
  else { Object.keys(_itemCache).forEach(k => { _itemCache[k] = null; _itemLoading[k] = false; }); }
}

function ItemHeader({ name, iconIndex, description }: { name: string; iconIndex: number; description: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #444', paddingBottom: 6 }}>
        {iconIndex > 0 && <IconSprite iconIndex={iconIndex} />}
        <span style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name || '(이름 없음)'}
        </span>
      </div>
      {description && (
        <div style={{ fontSize: 11, color: '#bbb', background: '#333', borderRadius: 3, padding: '4px 6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {description}
        </div>
      )}
    </>
  );
}

export type ItemPreviewType = 'item' | 'weapon' | 'armor';
const ENDPOINT_MAP: Record<ItemPreviewType, string> = { item: 'items', weapon: 'weapons', armor: 'armors' };

export function ItemPreview({ id, type }: { id: number; type: ItemPreviewType }) {
  const endpoint = ENDPOINT_MAP[type];
  const [data, setData] = useState<(AnyEquip | null)[] | null>(_itemCache[endpoint]);

  useEffect(() => {
    if (!_itemCache[endpoint]) loadItemData(endpoint, setData);
  }, [endpoint]);

  if (!data) return <Loading />;
  const entry = data[id] ?? null;
  if (!entry) return <Empty />;

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {type === 'item'   && <ItemDetail   item={entry as Item}     />}
      {type === 'weapon' && <EquipDetail  equip={entry as Weapon}  />}
      {type === 'armor'  && <EquipDetail  equip={entry as Armor}   />}
    </div>
  );
}

function ItemDetail({ item }: { item: Item }) {
  const effects = item.effects ?? [];
  return (
    <>
      <ItemHeader name={item.name} iconIndex={item.iconIndex} description={item.description} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Row label="가격" value={`${item.price} G`} color="#f0c060" />
        <Row label="소비" value={item.consumable ? '소비' : '비소비'} />
        <Row label="대상" value={SCOPE_LABELS[item.scope] ?? `${item.scope}`} />
        <Row label="사용 기회" value={OCCASION_LABELS[item.occasion] ?? `${item.occasion}`} />
        {item.speed !== 0 && <Row label="속도 보정" value={item.speed} />}
        <Row label="성공률" value={`${item.successRate}%`} />
        {item.tpGain > 0 && <Row label="TP 획득" value={item.tpGain} />}
        {item.hitType > 0 && <Row label="명중 타입" value={HIT_TYPE_LABELS[item.hitType] ?? `${item.hitType}`} />}
      </div>
      {effects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 10, color: '#888' }}>효과</div>
          {effects.slice(0, 6).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#ccd', padding: '2px 4px', background: '#2d3545', borderRadius: 3 }}>
              {effectSummary(e)}
            </div>
          ))}
          {effects.length > 6 && <div style={{ fontSize: 10, color: '#666' }}>외 {effects.length - 6}개 효과</div>}
        </div>
      )}
      {item.note?.trim() && <Note text={item.note.trim()} />}
    </>
  );
}

function EquipDetail({ equip }: { equip: Weapon | Armor }) {
  const nonZero = (equip.params ?? []).map((v, i) => ({ label: ITEM_PARAM_LABELS[i], value: v })).filter(p => p.value !== 0);
  return (
    <>
      <ItemHeader name={equip.name} iconIndex={equip.iconIndex} description={equip.description} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Row label="가격" value={`${equip.price} G`} color="#f0c060" />
        {nonZero.length > 0
          ? nonZero.map(p => <Row key={p.label} label={p.label} value={p.value > 0 ? `+${p.value}` : `${p.value}`} color={p.value > 0 ? '#8cf08c' : '#f08c8c'} />)
          : <Row label="능력치" value="없음" />}
      </div>
      {equip.note?.trim() && <Note text={equip.note.trim()} />}
    </>
  );
}

// ─── 공통 헬퍼 ──────────────────────────────────────────────────────────────

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 4px', background: '#333', borderRadius: 3 }}>
      <span style={{ color: '#aaa' }}>{label}</span>
      <span style={{ color: color ?? '#fff' }}>{value}</span>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, color: '#888', background: '#333', borderRadius: 3, padding: '3px 5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 48, overflowY: 'auto' }}>
      {text}
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>로딩 중...</div>;
}

function Empty() {
  return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>데이터 없음</div>;
}
