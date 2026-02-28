import React, { useState, useEffect } from 'react';
import type { Item, Weapon, Armor, Effect } from '../../types/rpgMakerMV';
import { IconSprite } from '../EventEditor/dataListPicker';
import { makeDbCache, PreviewRow, PreviewNote, PreviewLoading, PreviewEmpty, PreviewShell } from './EnemyPreview';

// ─── 캐시 ────────────────────────────────────────────────────────────────────

const itemDb   = makeDbCache<Item>('items');
const weaponDb = makeDbCache<Weapon>('weapons');
const armorDb  = makeDbCache<Armor>('armors');

export function invalidateItemPreviewCache(type?: ItemPreviewType) {
  if (!type || type === 'item')   itemDb.invalidate();
  if (!type || type === 'weapon') weaponDb.invalidate();
  if (!type || type === 'armor')  armorDb.invalidate();
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const PARAM_LABELS = ['최대HP', '최대MP', '공격력', '방어력', '마법력', '마법방어', '민첩성', '행운'];
const SCOPE_LABELS: Record<number, string> = {
  0: '없음', 1: '적 1명', 2: '적 전체', 3: '적 랜덤 1명', 4: '적 랜덤 2명',
  5: '적 랜덤 3명', 6: '적 랜덤 4명', 7: '아군 1명(전불)', 8: '아군 전체(전불)',
  9: '아군 1명', 10: '아군 전체', 11: '사용자',
};
const OCCASION_LABELS: Record<number, string> = { 0: '항상', 1: '전투 중만', 2: '메뉴 중만', 3: '절대 불가' };
const HIT_TYPE_LABELS: Record<number, string> = { 0: '필중', 1: '물리 공격', 2: '마법 공격' };
const EFFECT_PARAM: Record<number, string> = { 0: 'MaxHP', 1: 'MaxMP', 2: 'ATK', 3: 'DEF', 4: 'MAT', 5: 'MDF', 6: 'AGI', 7: 'LUK' };

// ─── 공통: 아이콘 + 이름 + 설명 헤더 ────────────────────────────────────────

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

// ─── Effect 요약 ─────────────────────────────────────────────────────────────

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

// ─── 타입별 내용 ─────────────────────────────────────────────────────────────

function ItemDetail({ item }: { item: Item }) {
  const effects = item.effects ?? [];
  return (
    <>
      <ItemHeader name={item.name} iconIndex={item.iconIndex} description={item.description} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <PreviewRow label="가격"      value={`${item.price} G`} color="#f0c060" />
        <PreviewRow label="소비"      value={item.consumable ? '소비' : '비소비'} />
        <PreviewRow label="대상"      value={SCOPE_LABELS[item.scope] ?? `${item.scope}`} />
        <PreviewRow label="사용 기회" value={OCCASION_LABELS[item.occasion] ?? `${item.occasion}`} />
        {item.speed !== 0 && <PreviewRow label="속도 보정" value={item.speed} />}
        <PreviewRow label="성공률"    value={`${item.successRate}%`} />
        {item.tpGain > 0 && <PreviewRow label="TP 획득" value={item.tpGain} />}
        {item.hitType > 0 && <PreviewRow label="명중 타입" value={HIT_TYPE_LABELS[item.hitType] ?? `${item.hitType}`} />}
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
      {item.note?.trim() && <PreviewNote text={item.note.trim()} />}
    </>
  );
}

function EquipDetail({ equip }: { equip: Weapon | Armor }) {
  const nonZero = (equip.params ?? []).map((v, i) => ({ label: PARAM_LABELS[i], value: v })).filter(p => p.value !== 0);
  return (
    <>
      <ItemHeader name={equip.name} iconIndex={equip.iconIndex} description={equip.description} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <PreviewRow label="가격" value={`${equip.price} G`} color="#f0c060" />
        {nonZero.length > 0
          ? nonZero.map(p => <PreviewRow key={p.label} label={p.label} value={p.value > 0 ? `+${p.value}` : `${p.value}`} color={p.value > 0 ? '#8cf08c' : '#f08c8c'} />)
          : <PreviewRow label="능력치" value="없음" />}
      </div>
      {equip.note?.trim() && <PreviewNote text={equip.note.trim()} />}
    </>
  );
}

// ─── 외부 노출 ───────────────────────────────────────────────────────────────

export type ItemPreviewType = 'item' | 'weapon' | 'armor';

type AnyEquip = Item | Weapon | Armor;

export function ItemPreview({ id, type }: { id: number; type: ItemPreviewType }) {
  const db = type === 'item' ? itemDb : type === 'weapon' ? weaponDb : armorDb;
  const [data, setData] = useState<(AnyEquip | null)[] | null>(db.getCache() as (AnyEquip | null)[] | null);

  useEffect(() => {
    if (!db.getCache()) (db.load as (cb: (data: (AnyEquip | null)[]) => void) => void)(setData);
  }, [db]);

  if (!data) return <PreviewLoading />;
  const entry = data[id] ?? null;
  if (!entry) return <PreviewEmpty />;

  return (
    <PreviewShell>
      {type === 'item'   && <ItemDetail  item={entry as Item}           />}
      {type === 'weapon' && <EquipDetail equip={entry as Weapon | Armor} />}
      {type === 'armor'  && <EquipDetail equip={entry as Weapon | Armor} />}
    </PreviewShell>
  );
}
