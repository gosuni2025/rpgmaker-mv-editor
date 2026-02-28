import React, { useState, useEffect } from 'react';
import type { Item, Weapon, Armor, Enemy } from '../../types/rpgMakerMV';
import { makeDbCache } from './EnemyPreview';
import { IconSprite } from '../EventEditor/dataListPicker';

// ─── 캐시 ────────────────────────────────────────────────────────────────────

const itemDb   = makeDbCache<Item>('items');
const weaponDb = makeDbCache<Weapon>('weapons');
const armorDb  = makeDbCache<Armor>('armors');
const enemyDb  = makeDbCache<Enemy>('enemies');

type AnyEquip = Item | Weapon | Armor;

// ─── 아이템/무기/방어구 선택 버튼 ───────────────────────────────────────────

export type DbPickerType = 'item' | 'weapon' | 'armor';

export function ItemPickerButton({ id, type, onClick, disabled, style }: {
  id: number;
  type: DbPickerType;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const db = type === 'item' ? itemDb : type === 'weapon' ? weaponDb : armorDb;
  const [entry, setEntry] = useState<AnyEquip | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const apply = (data: (AnyEquip | null)[]) => {
      if (!cancelled) setEntry(data[id] ?? null);
    };
    const cache = db.getCache() as (AnyEquip | null)[] | null;
    if (cache) { apply(cache); return; }
    (db.load as (cb: (data: (AnyEquip | null)[]) => void) => void)(apply);
    return () => { cancelled = true; };
  }, [db, id]);

  const name = entry?.name ?? '';
  const iconIndex = (entry as { iconIndex?: number })?.iconIndex ?? 0;

  return (
    <button
      className="db-picker-btn"
      onClick={onClick}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1, fontSize: 12, ...style }}
    >
      {iconIndex > 0
        ? <IconSprite iconIndex={iconIndex} />
        : <span style={{ display: 'inline-block', width: 20, height: 20, flexShrink: 0 }} />
      }
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry === undefined ? '...' : name || '(없음)'}
      </span>
      <span style={{ fontSize: 10, color: '#777', flexShrink: 0 }}>
        #{String(id).padStart(4, '0')}
      </span>
    </button>
  );
}

// ─── 몬스터(적) 선택 버튼 ───────────────────────────────────────────────────

export function EnemyPickerButton({ id, onClick }: {
  id: number;
  onClick: () => void;
}) {
  const [enemy, setEnemy] = useState<Enemy | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const apply = (data: (Enemy | null)[]) => {
      if (!cancelled) setEnemy(data[id] as Enemy ?? null);
    };
    const cache = enemyDb.getCache() as (Enemy | null)[] | null;
    if (cache) { apply(cache); return; }
    enemyDb.load(apply);
    return () => { cancelled = true; };
  }, [id]);

  const name = enemy?.name ?? '';
  const battlerName = enemy?.battlerName ?? '';

  return (
    <button className="db-picker-btn" onClick={onClick} style={{ fontSize: 12 }}>
      <span style={{
        width: 32, height: 24, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {battlerName
          ? <img
              src={`/api/resources/img_enemies/${encodeURIComponent(battlerName)}.png`}
              style={{ maxWidth: 32, maxHeight: 24, objectFit: 'contain', imageRendering: 'pixelated' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          : <span style={{ fontSize: 10, color: '#666' }}>?</span>
        }
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {enemy === undefined ? '...' : name || '(없음)'}
      </span>
      <span style={{ fontSize: 10, color: '#777', flexShrink: 0 }}>
        #{String(id).padStart(4, '0')}
      </span>
    </button>
  );
}
