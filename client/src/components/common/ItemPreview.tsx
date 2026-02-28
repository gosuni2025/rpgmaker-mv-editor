import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { IconSprite } from '../EventEditor/dataListPicker';
import type { Item, Weapon, Armor, Effect } from '../../types/rpgMakerMV';

// ─── 상수 ──────────────────────────────────────────────────────────────────

const WEAPON_PARAM_LABELS = ['최대HP', '최대MP', '공격력', '방어력', '마법력', '마법방어', '민첩성', '행운'];
const SCOPE_LABELS: Record<number, string> = {
  0: '없음', 1: '적 1명', 2: '적 전체', 3: '적 랜덤 1명', 4: '적 랜덤 2명',
  5: '적 랜덤 3명', 6: '적 랜덤 4명', 7: '아군 1명(전불)', 8: '아군 전체(전불)',
  9: '아군 1명', 10: '아군 전체', 11: '사용자',
};
const OCCASION_LABELS: Record<number, string> = { 0: '항상', 1: '전투 중만', 2: '메뉴 중만', 3: '절대 불가' };
const HIT_TYPE_LABELS: Record<number, string> = { 0: '필중', 1: '물리 공격', 2: '마법 공격' };
const PARAM_LABELS: Record<number, string> = { 0: 'MaxHP', 1: 'MaxMP', 2: 'ATK', 3: 'DEF', 4: 'MAT', 5: 'MDF', 6: 'AGI', 7: 'LUK' };

// ─── API 캐시 ───────────────────────────────────────────────────────────────

type AnyItem = Item | Weapon | Armor;
const _cache: Record<string, (AnyItem | null)[] | null> = { items: null, weapons: null, armors: null };
const _loading: Record<string, boolean> = { items: false, weapons: false, armors: false };
const _callbacks: Record<string, ((data: (AnyItem | null)[]) => void)[]> = { items: [], weapons: [], armors: [] };

function loadData(endpoint: string, cb: (data: (AnyItem | null)[]) => void) {
  if (_cache[endpoint]) { cb(_cache[endpoint]!); return; }
  _callbacks[endpoint].push(cb);
  if (_loading[endpoint]) return;
  _loading[endpoint] = true;
  apiClient.get<(AnyItem | null)[]>(`/database/${endpoint}`).then(data => {
    _cache[endpoint] = data;
    _callbacks[endpoint].forEach(fn => fn(data));
    _callbacks[endpoint] = [];
    _loading[endpoint] = false;
  }).catch(() => { _loading[endpoint] = false; _callbacks[endpoint] = []; });
}

export function invalidateItemPreviewCache(endpoint?: string) {
  if (endpoint) { _cache[endpoint] = null; _loading[endpoint] = false; }
  else { Object.keys(_cache).forEach(k => { _cache[k] = null; _loading[k] = false; }); }
}

// ─── Effect 요약 ───────────────────────────────────────────────────────────

function effectSummary(e: Effect): string {
  const pct = (v: number) => v !== 0 ? `${Math.round(v * 100)}%` : '';
  switch (e.code) {
    case 11: return `HP 회복 ${pct(e.value1)}${e.value2 ? ` +${e.value2}` : ''}`.trim();
    case 12: return `MP 회복 ${pct(e.value1)}${e.value2 ? ` +${e.value2}` : ''}`.trim();
    case 13: return `TP +${e.value1}`;
    case 21: return `${PARAM_LABELS[e.dataId] ?? '?'} 버프 (${e.value1}턴)`;
    case 22: return `${PARAM_LABELS[e.dataId] ?? '?'} 디버프 (${e.value1}턴)`;
    case 23: return `${PARAM_LABELS[e.dataId] ?? '?'} 버프 제거`;
    case 24: return `${PARAM_LABELS[e.dataId] ?? '?'} 디버프 제거`;
    case 31: return `스테이트 #${e.dataId} 추가 (${Math.round(e.value1 * 100)}%)`;
    case 32: return `스테이트 #${e.dataId} 제거`;
    case 41: return `스킬 습득 #${e.dataId}`;
    case 42: return `커먼 이벤트 #${e.dataId}`;
    case 43: return `TP 충전`;
    case 44: return `${PARAM_LABELS[e.dataId] ?? '?'} 성장`;
    default: return `효과 ${e.code}`;
  }
}

// ─── 공통 헬퍼 UI ──────────────────────────────────────────────────────────

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 4px', background: '#333', borderRadius: 3 }}>
      <span style={{ color: '#aaa' }}>{label}</span>
      <span style={{ color: color ?? '#fff' }}>{value}</span>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>;
}

// ─── 아이콘 + 이름 헤더 ───────────────────────────────────────────────────

function Header({ name, iconIndex, description }: { name: string; iconIndex: number; description: string }) {
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

// ─── Item 미리보기 ─────────────────────────────────────────────────────────

function ItemDetail({ item }: { item: Item }) {
  const nonZeroParams = (item.effects ?? []).slice(0, 6);
  return (
    <>
      <Header name={item.name} iconIndex={item.iconIndex} description={item.description} />
      <Section>
        <Row label="가격" value={`${item.price} G`} color="#f0c060" />
        <Row label="소비" value={item.consumable ? '소비' : '비소비'} />
        <Row label="대상" value={SCOPE_LABELS[item.scope] ?? `${item.scope}`} />
        <Row label="사용 기회" value={OCCASION_LABELS[item.occasion] ?? `${item.occasion}`} />
        {item.speed !== 0 && <Row label="속도 보정" value={item.speed} />}
        <Row label="성공률" value={`${item.successRate}%`} />
        {item.tpGain > 0 && <Row label="TP 획득" value={item.tpGain} />}
        {item.hitType > 0 && <Row label="명중 타입" value={HIT_TYPE_LABELS[item.hitType] ?? `${item.hitType}`} />}
      </Section>
      {nonZeroParams.length > 0 && (
        <Section>
          <div style={{ fontSize: 10, color: '#888', padding: '2px 0' }}>효과</div>
          {nonZeroParams.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#ccd', padding: '2px 4px', background: '#2d3545', borderRadius: 3 }}>
              {effectSummary(e)}
            </div>
          ))}
          {item.effects.length > 6 && (
            <div style={{ fontSize: 10, color: '#666' }}>외 {item.effects.length - 6}개 효과</div>
          )}
        </Section>
      )}
      {item.note?.trim() && (
        <div style={{ fontSize: 10, color: '#888', background: '#333', borderRadius: 3, padding: '3px 5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 48, overflowY: 'auto' }}>
          {item.note.trim()}
        </div>
      )}
    </>
  );
}

// ─── Weapon 미리보기 ───────────────────────────────────────────────────────

function WeaponDetail({ weapon }: { weapon: Weapon }) {
  const nonZeroParams = (weapon.params ?? []).map((v, i) => ({ label: WEAPON_PARAM_LABELS[i], value: v })).filter(p => p.value !== 0);
  return (
    <>
      <Header name={weapon.name} iconIndex={weapon.iconIndex} description={weapon.description} />
      <Section>
        <Row label="가격" value={`${weapon.price} G`} color="#f0c060" />
        {nonZeroParams.length > 0
          ? nonZeroParams.map(p => <Row key={p.label} label={p.label} value={p.value > 0 ? `+${p.value}` : `${p.value}`} color={p.value > 0 ? '#8cf08c' : '#f08c8c'} />)
          : <Row label="능력치" value="없음" />
        }
      </Section>
      {weapon.note?.trim() && (
        <div style={{ fontSize: 10, color: '#888', background: '#333', borderRadius: 3, padding: '3px 5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 48, overflowY: 'auto' }}>
          {weapon.note.trim()}
        </div>
      )}
    </>
  );
}

// ─── Armor 미리보기 ────────────────────────────────────────────────────────

function ArmorDetail({ armor }: { armor: Armor }) {
  const nonZeroParams = (armor.params ?? []).map((v, i) => ({ label: WEAPON_PARAM_LABELS[i], value: v })).filter(p => p.value !== 0);
  return (
    <>
      <Header name={armor.name} iconIndex={armor.iconIndex} description={armor.description} />
      <Section>
        <Row label="가격" value={`${armor.price} G`} color="#f0c060" />
        {nonZeroParams.length > 0
          ? nonZeroParams.map(p => <Row key={p.label} label={p.label} value={p.value > 0 ? `+${p.value}` : `${p.value}`} color={p.value > 0 ? '#8cf08c' : '#f08c8c'} />)
          : <Row label="능력치" value="없음" />
        }
      </Section>
      {armor.note?.trim() && (
        <div style={{ fontSize: 10, color: '#888', background: '#333', borderRadius: 3, padding: '3px 5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 48, overflowY: 'auto' }}>
          {armor.note.trim()}
        </div>
      )}
    </>
  );
}

// ─── 외부 노출 컴포넌트 ────────────────────────────────────────────────────

export type ItemPreviewType = 'item' | 'weapon' | 'armor';

const ENDPOINT_MAP: Record<ItemPreviewType, string> = { item: 'items', weapon: 'weapons', armor: 'armors' };

export function ItemPreview({ id, type }: { id: number; type: ItemPreviewType }) {
  const endpoint = ENDPOINT_MAP[type];
  const [data, setData] = useState<(AnyItem | null)[] | null>(_cache[endpoint]);

  useEffect(() => {
    if (!_cache[endpoint]) {
      loadData(endpoint, setData);
    }
  }, [endpoint]);

  if (!data) {
    return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>로딩 중...</div>;
  }

  const item = data[id] ?? null;
  if (!item) {
    return <div style={{ padding: 12, color: '#888', fontSize: 12, textAlign: 'center', marginTop: 40 }}>데이터 없음</div>;
  }

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {type === 'item'   && <ItemDetail   item={item as Item}     />}
      {type === 'weapon' && <WeaponDetail weapon={item as Weapon} />}
      {type === 'armor'  && <ArmorDetail  armor={item as Armor}   />}
    </div>
  );
}
