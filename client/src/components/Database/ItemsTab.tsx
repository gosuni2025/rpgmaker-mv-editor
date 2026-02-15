import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import TranslateButton from '../common/TranslateButton';
import EffectsEditor from '../common/EffectsEditor';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';
import apiClient from '../../api/client';

interface ItemsTabProps {
  data: (Item | null)[] | undefined;
  onChange: (data: (Item | null)[]) => void;
}

interface RefItem { id: number; name: string }

const DEFAULT_DAMAGE: Damage = { critical: false, elementId: 0, formula: '', type: 0, variance: 20 };

export default function ItemsTab({ data, onChange }: ItemsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [animations, setAnimations] = useState<RefItem[]>([]);
  const [showAnimPicker, setShowAnimPicker] = useState(false);

  const SCOPE_OPTIONS = [
    { value: 0, label: t('scope.none') },
    { value: 1, label: t('scope.oneEnemy') },
    { value: 2, label: t('scope.allEnemies') },
    { value: 3, label: t('scope.randomEnemy1') },
    { value: 4, label: t('scope.randomEnemy2') },
    { value: 5, label: t('scope.randomEnemy3') },
    { value: 6, label: t('scope.randomEnemy4') },
    { value: 7, label: t('scope.oneAlly') },
    { value: 8, label: t('scope.allAllies') },
    { value: 9, label: t('scope.oneAllyDead') },
    { value: 10, label: t('scope.allAlliesDead') },
    { value: 11, label: t('scope.theUser') },
  ];

  const OCCASION_OPTIONS = [
    { value: 0, label: t('occasion.always') },
    { value: 1, label: t('occasion.onlyInBattle') },
    { value: 2, label: t('occasion.onlyFromMenu') },
    { value: 3, label: t('occasion.never') },
  ];

  const HIT_TYPE_OPTIONS = [
    { value: 0, label: t('hitType.certainHit') },
    { value: 1, label: t('hitType.physicalAttack') },
    { value: 2, label: t('hitType.magicalAttack') },
  ];

  const ITEM_TYPE_OPTIONS = [
    { value: 1, label: t('itemType.regularItem') },
    { value: 2, label: t('itemType.keyItem') },
    { value: 3, label: t('itemType.hiddenItemA') },
    { value: 4, label: t('itemType.hiddenItemB') },
  ];

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
      {/* 좌측: 아이템 목록 */}
      <div className="db-list">
        <div className="db-list-header">
          <span>{t('database.tabs.items')}</span>
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

      {/* 중앙 + 우측: 2컬럼 폼 */}
      {selectedItem && (
        <div className="db-form-columns">
          {/* 중앙 컬럼: 일반 설정 + 발동 + 대미지 */}
          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('skills.generalSettings')}
            </div>

            {/* 이름 + 아이콘 (한 줄) */}
            <div className="db-form-row">
              <label style={{ flex: 2 }}>
                {t('common.name')}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={selectedItem.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TranslateButton csvPath="database/items.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                </div>
              </label>
              <label style={{ flex: 0, minWidth: 'fit-content' }}>
                {t('common.icon')}
                <IconPicker
                  value={selectedItem.iconIndex || 0}
                  onChange={(v) => handleFieldChange('iconIndex', v)}
                />
              </label>
            </div>

            {/* 설명 */}
            <label>
              {t('common.description')}
              <div style={{ display: 'flex', gap: 4, alignItems: 'start' }}>
                <textarea
                  value={selectedItem.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={2}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/items.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>

            {/* 아이템 유형 / 가격 / 소모 (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.itemType')}
                <select value={selectedItem.itypeId || 1} onChange={(e) => handleFieldChange('itypeId', Number(e.target.value))}>
                  {ITEM_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <label>
                {t('common.price')}
                <input
                  type="number"
                  value={selectedItem.price || 0}
                  onChange={(e) => handleFieldChange('price', Number(e.target.value))}
                  min={0}
                />
              </label>
              <label className="db-checkbox-label" style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={selectedItem.consumable ?? true}
                  onChange={(e) => handleFieldChange('consumable', e.target.checked)}
                />
                {t('fields.consumable')}
              </label>
            </div>

            {/* 범위 / 사용 가능시 (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.scope')}
                <select
                  value={selectedItem.scope || 0}
                  onChange={(e) => handleFieldChange('scope', Number(e.target.value))}
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('fields.occasion')}
                <select
                  value={selectedItem.occasion || 0}
                  onChange={(e) => handleFieldChange('occasion', Number(e.target.value))}
                >
                  {OCCASION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* 발동 섹션 */}
            <div className="db-form-section">{t('fields.invocation')}</div>

            {/* 속도 / 성공률 / 연속 횟수 / TP 획득 (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.speed')}
                <input
                  type="number"
                  value={selectedItem.speed || 0}
                  onChange={(e) => handleFieldChange('speed', Number(e.target.value))}
                />
              </label>
              <label>
                {t('fields.successRate')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={selectedItem.successRate ?? 100}
                    onChange={(e) => handleFieldChange('successRate', Number(e.target.value))}
                    min={0}
                    max={100}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: '#aaa', fontSize: 12 }}>%</span>
                </div>
              </label>
              <label>
                {t('fields.repeats')}
                <input
                  type="number"
                  value={selectedItem.repeats || 1}
                  onChange={(e) => handleFieldChange('repeats', Number(e.target.value))}
                  min={1}
                />
              </label>
              <label>
                {t('fields.tpGain')}
                <input
                  type="number"
                  value={selectedItem.tpGain || 0}
                  onChange={(e) => handleFieldChange('tpGain', Number(e.target.value))}
                  min={0}
                />
              </label>
            </div>

            {/* 히트 유형 / 애니메이션 (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.hitType')}
                <select
                  value={selectedItem.hitType || 0}
                  onChange={(e) => handleFieldChange('hitType', Number(e.target.value))}
                >
                  {HIT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('common.animation')}
                <button className="db-picker-btn" onClick={() => setShowAnimPicker(true)}>
                  {selectedItem.animationId === -1 ? t('common.normalAttack') :
                   selectedItem.animationId === 0 || selectedItem.animationId == null ? t('common.none') :
                   `${String(selectedItem.animationId).padStart(4, '0')}: ${animations.find(a => a.id === selectedItem.animationId)?.name || ''}`}
                </button>
              </label>
            </div>

          </div>

          {/* 우측 컬럼: 손상 + 사용 효과 + 메모 */}
          <div className="db-form-col">
            <DamageEditor
              damage={selectedItem.damage || { ...DEFAULT_DAMAGE }}
              onChange={(damage) => handleFieldChange('damage', damage)}
            />

            <div className="db-form-section">
              {t('fields.effects')}
            </div>

            <EffectsEditor
              effects={selectedItem.effects || []}
              onChange={(effects) => handleFieldChange('effects', effects)}
            />

            <div className="db-form-section">{t('common.note')}</div>

            <textarea
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
              rows={5}
              style={{
                background: '#2b2b2b',
                border: '1px solid #555',
                borderRadius: 3,
                padding: '4px 8px',
                color: '#ddd',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                flex: 1,
                minHeight: 60,
              }}
            />
          </div>
        </div>
      )}

      {showAnimPicker && selectedItem && (
        <AnimationPickerDialog
          value={selectedItem.animationId ?? 0}
          onChange={(id) => handleFieldChange('animationId', id)}
          onClose={() => setShowAnimPicker(false)}
        />
      )}
    </div>
  );
}
