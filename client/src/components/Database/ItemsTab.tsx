import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import TranslateButton from '../common/TranslateButton';
import EffectsEditor from '../common/EffectsEditor';
import apiClient from '../../api/client';

interface ItemsTabProps {
  data: (Item | null)[] | undefined;
  onChange: (data: (Item | null)[]) => void;
}

interface RefItem { id: number; name: string }

const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' };

export default function ItemsTab({ data, onChange }: ItemsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [animations, setAnimations] = useState<RefItem[]>([]);

  const SCOPE_OPTIONS = [
    t('scope.none'), t('scope.oneEnemy'), t('scope.allEnemies'), t('scope.randomEnemy1'), t('scope.randomEnemy2'), t('scope.randomEnemy3'), t('scope.randomEnemy4'),
    t('scope.oneAlly'), t('scope.allAllies'), t('scope.oneAllyDead'), t('scope.allAlliesDead'), t('scope.theUser'),
  ];
  const OCCASION_OPTIONS = [t('occasion.always'), t('occasion.onlyInBattle'), t('occasion.onlyFromMenu'), t('occasion.never')];
  const HIT_TYPE_OPTIONS = [t('hitType.certainHit'), t('hitType.physicalAttack'), t('hitType.magicalAttack')];
  const ITEM_TYPE_OPTIONS = [t('itemType.regularItem'), t('itemType.keyItem'), t('itemType.hiddenItemA'), t('itemType.hiddenItemB')];

  useEffect(() => {
    apiClient.get<(RefItem | null)[]>('/database/animations').then(d => {
      setAnimations(d.filter(Boolean) as RefItem[]);
    }).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof Item, value: unknown) => {
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
    const newItem: Item = {
      id: maxId + 1, name: '', iconIndex: 0, description: '', itypeId: 1,
      price: 0, consumable: true, scope: 0, occasion: 0, speed: 0,
      successRate: 100, repeats: 1, tpGain: 0, hitType: 0, animationId: 0,
      damage: { type: 0, elementId: 0, formula: '', variance: 20, critical: false },
      effects: [], note: '',
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newItem;
    onChange(newData);
    setSelectedId(maxId + 1);
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
      <div className="db-form">
        {selectedItem && (
          <>
            <label>
              {t('common.name')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} style={{flex:1}} />
                <TranslateButton csvPath="database/items.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
              </div>
            </label>
            <div className="db-form-row">
              <label>
                {t('common.icon')}
                <IconPicker value={selectedItem.iconIndex || 0} onChange={(v) => handleFieldChange('iconIndex', v)} />
              </label>
            </div>
            <label>
              {t('common.description')}
              <div style={{display:'flex',gap:4,alignItems:'start'}}>
                <textarea value={selectedItem.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} rows={2} style={{flex:1}} />
                <TranslateButton csvPath="database/items.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>
            <label>
              {t('fields.itemType')}
              <select value={selectedItem.itypeId || 1} onChange={(e) => handleFieldChange('itypeId', Number(e.target.value))}>
                {ITEM_TYPE_OPTIONS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
              </select>
            </label>
            <label>
              {t('common.price')}
              <input type="number" value={selectedItem.price || 0} onChange={(e) => handleFieldChange('price', Number(e.target.value))} min={0} />
            </label>
            <label className="db-checkbox-label">
              <input type="checkbox" checked={selectedItem.consumable ?? true} onChange={(e) => handleFieldChange('consumable', e.target.checked)} />
              {t('fields.consumable')}
            </label>
            <label>
              {t('fields.scope')}
              <select value={selectedItem.scope || 0} onChange={(e) => handleFieldChange('scope', Number(e.target.value))}>
                {SCOPE_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label>
              {t('fields.occasion')}
              <select value={selectedItem.occasion || 0} onChange={(e) => handleFieldChange('occasion', Number(e.target.value))}>
                {OCCASION_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>

            <div className="db-form-section">{t('fields.invocation')}</div>
            <label>
              {t('fields.speed')}
              <input type="number" value={selectedItem.speed || 0} onChange={(e) => handleFieldChange('speed', Number(e.target.value))} />
            </label>
            <label>
              {t('fields.successRate')}
              <input type="number" value={selectedItem.successRate ?? 100} onChange={(e) => handleFieldChange('successRate', Number(e.target.value))} min={0} max={100} />
            </label>
            <label>
              {t('fields.repeats')}
              <input type="number" value={selectedItem.repeats || 1} onChange={(e) => handleFieldChange('repeats', Number(e.target.value))} min={1} />
            </label>
            <label>
              {t('fields.tpGain')}
              <input type="number" value={selectedItem.tpGain || 0} onChange={(e) => handleFieldChange('tpGain', Number(e.target.value))} />
            </label>
            <label>
              {t('fields.hitType')}
              <select value={selectedItem.hitType || 0} onChange={(e) => handleFieldChange('hitType', Number(e.target.value))}>
                {HIT_TYPE_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label>
              {t('common.animation')}
              <select value={selectedItem.animationId || 0} onChange={(e) => handleFieldChange('animationId', Number(e.target.value))} style={selectStyle}>
                <option value={0}>{t('common.none')}</option>
                {animations.map(a => <option key={a.id} value={a.id}>{String(a.id).padStart(4, '0')}: {a.name}</option>)}
              </select>
            </label>

            <DamageEditor
              damage={selectedItem.damage || { type: 0, elementId: 0, formula: '', variance: 20, critical: false }}
              onChange={(d) => handleFieldChange('damage', d)}
            />

            <EffectsEditor
              effects={selectedItem.effects || []}
              onChange={(e) => handleFieldChange('effects', e)}
            />

            <label>
              {t('common.note')}
              <textarea value={selectedItem.note || ''} onChange={(e) => handleFieldChange('note', e.target.value)} rows={3} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
