import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import TranslateButton from '../common/TranslateButton';
import EffectsEditor from '../common/EffectsEditor';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';
import ImagePicker from '../common/ImagePicker';
import DatabaseList from './DatabaseList';
import { useDatabaseTab } from './useDatabaseTab';
import { makeScopeOptions, makeOccasionOptions, makeHitTypeOptions } from './dbConstants';
import { useDbRef } from './useDbRef';

type HAlign = 'left' | 'center' | 'right';
type VAlign = 'top' | 'middle' | 'bottom';

interface DetailInfo {
  image: string;
  imgHAlign: HAlign;
  imgVAlign: VAlign;
  text: string;
  textHAlign: HAlign;
  textVAlign: VAlign;
}

function parseDetailFromNote(note: string): DetailInfo {
  const imgM      = note.match(/<detailImg:\s*(.+?)>/i);
  const imgAlignM = note.match(/<detailImgAlign:\s*(\w+)\s*,\s*(\w+)>/i);
  const textM     = note.match(/<detailText>([\s\S]*?)<\/detailText>/i);
  const txtAlignM = note.match(/<detailTextAlign:\s*(\w+)\s*,\s*(\w+)>/i);
  return {
    image:      imgM      ? imgM[1].trim()            : '',
    imgHAlign:  (imgAlignM ? imgAlignM[1] : 'center') as HAlign,
    imgVAlign:  (imgAlignM ? imgAlignM[2] : 'middle') as VAlign,
    text:       textM     ? textM[1].trim()           : '',
    textHAlign: (txtAlignM ? txtAlignM[1] : 'left')   as HAlign,
    textVAlign: (txtAlignM ? txtAlignM[2] : 'bottom') as VAlign,
  };
}

function buildNoteWithDetail(note: string, d: DetailInfo): string {
  // 기존 detail 태그 제거
  let base = note
    .replace(/<detailImg:[^>]*>\n?/gi, '')
    .replace(/<detailImgAlign:[^>]*>\n?/gi, '')
    .replace(/<detailText>[\s\S]*?<\/detailText>\n?/gi, '')
    .replace(/<detailTextAlign:[^>]*>\n?/gi, '')
    .trimEnd();

  const parts: string[] = [];
  if (d.image) {
    parts.push(`<detailImg: ${d.image}>`);
    parts.push(`<detailImgAlign: ${d.imgHAlign}, ${d.imgVAlign}>`);
  }
  if (d.text) {
    parts.push(`<detailText>\n${d.text}\n</detailText>`);
    parts.push(`<detailTextAlign: ${d.textHAlign}, ${d.textVAlign}>`);
  }

  if (!parts.length) return base;
  return base ? base + '\n' + parts.join('\n') : parts.join('\n');
}

const HALIGN_OPTIONS: { value: HAlign; label: string }[] = [
  { value: 'left',   label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right',  label: '오른쪽' },
];
const VALIGN_OPTIONS: { value: VAlign; label: string }[] = [
  { value: 'top',    label: '위' },
  { value: 'middle', label: '가운데' },
  { value: 'bottom', label: '아래' },
];

const DEFAULT_DAMAGE: Damage = { critical: false, elementId: 0, formula: '', type: 0, variance: 20 };

function createNewItem(id: number): Item {
  return {
    id, name: '', iconIndex: 0, description: '', itypeId: 1,
    price: 0, consumable: true, scope: 0, occasion: 0, speed: 0,
    successRate: 100, repeats: 1, tpGain: 0, hitType: 0, animationId: 0,
    damage: { type: 0, elementId: 0, formula: '', variance: 20, critical: false },
    effects: [], note: '',
  };
}

function deepCopyItem(source: Item): Partial<Item> {
  return {
    damage: { ...source.damage },
    effects: source.effects.map((e: Effect) => ({ ...e })),
  };
}

interface ItemsTabProps {
  data: (Item | null)[] | undefined;
  onChange: (data: (Item | null)[]) => void;
}

const ITEM_TYPE_OPTIONS = [
  { value: 1, key: 'itemType.regularItem' },
  { value: 2, key: 'itemType.keyItem' },
  { value: 3, key: 'itemType.hiddenItemA' },
  { value: 4, key: 'itemType.hiddenItemB' },
];

export default function ItemsTab({ data, onChange }: ItemsTabProps) {
  const { t } = useTranslation();
  const { selectedId, setSelectedId, selectedItem, handleFieldChange, handleAdd, handleDelete, handleDuplicate, handleReorder } =
    useDatabaseTab(data, onChange, createNewItem, deepCopyItem);
  const animations = useDbRef('/database/animations');
  const [showAnimPicker, setShowAnimPicker] = useState(false);
  const [showImgPicker, setShowImgPicker] = useState(false);

  const detail = selectedItem ? parseDetailFromNote(selectedItem.note || '') : null;

  function updateDetail(patch: Partial<DetailInfo>) {
    if (!selectedItem || !detail) return;
    const next = { ...detail, ...patch };
    handleFieldChange('note', buildNoteWithDetail(selectedItem.note || '', next));
  }

  const SCOPE_OPTIONS = makeScopeOptions(t);
  const OCCASION_OPTIONS = makeOccasionOptions(t);
  const HIT_TYPE_OPTIONS = makeHitTypeOptions(t);

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
        title={t('database.tabs.items')}
      />

      {selectedItem && (
        <div className="db-form-columns">
          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('skills.generalSettings')}
            </div>

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
              <div className="db-form-field-label" style={{ flex: 0, minWidth: 'fit-content' }}>
                {t('common.icon')}
                <IconPicker value={selectedItem.iconIndex || 0} onChange={(v) => handleFieldChange('iconIndex', v)} />
              </div>
            </div>

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

            <div className="db-form-row">
              <label>
                {t('fields.itemType')}
                <select value={selectedItem.itypeId || 1} onChange={(e) => handleFieldChange('itypeId', Number(e.target.value))}>
                  {ITEM_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.key)}</option>)}
                </select>
              </label>
              <label>
                {t('common.price')}
                <input type="number" value={selectedItem.price || 0} onChange={(e) => handleFieldChange('price', Number(e.target.value))} min={0} />
              </label>
              <label className="db-checkbox-label" style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
                <input type="checkbox" checked={selectedItem.consumable ?? true} onChange={(e) => handleFieldChange('consumable', e.target.checked)} />
                {t('fields.consumable')}
              </label>
            </div>

            <div className="db-form-row">
              <label>
                {t('fields.scope')}
                <select value={selectedItem.scope || 0} onChange={(e) => handleFieldChange('scope', Number(e.target.value))}>
                  {SCOPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <label>
                {t('fields.occasion')}
                <select value={selectedItem.occasion || 0} onChange={(e) => handleFieldChange('occasion', Number(e.target.value))}>
                  {OCCASION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
            </div>

            <div className="db-form-section">{t('fields.invocation')}</div>

            <div className="db-form-row">
              <label>
                {t('fields.speed')}
                <input type="number" value={selectedItem.speed || 0} onChange={(e) => handleFieldChange('speed', Number(e.target.value))} />
              </label>
              <label>
                {t('fields.successRate')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={selectedItem.successRate ?? 100} onChange={(e) => handleFieldChange('successRate', Number(e.target.value))} min={0} max={100} style={{ flex: 1 }} />
                  <span style={{ color: '#aaa', fontSize: 12 }}>%</span>
                </div>
              </label>
              <label>
                {t('fields.repeats')}
                <input type="number" value={selectedItem.repeats || 1} onChange={(e) => handleFieldChange('repeats', Number(e.target.value))} min={1} />
              </label>
              <label>
                {t('fields.tpGain')}
                <input type="number" value={selectedItem.tpGain || 0} onChange={(e) => handleFieldChange('tpGain', Number(e.target.value))} min={0} />
              </label>
            </div>

            <div className="db-form-row">
              <label>
                {t('fields.hitType')}
                <select value={selectedItem.hitType || 0} onChange={(e) => handleFieldChange('hitType', Number(e.target.value))}>
                  {HIT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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

          <div className="db-form-col">
            <DamageEditor
              damage={selectedItem.damage || { ...DEFAULT_DAMAGE }}
              onChange={(damage) => handleFieldChange('damage', damage)}
            />

            <div className="db-form-section">{t('fields.effects')}</div>

            <EffectsEditor
              effects={selectedItem.effects || []}
              onChange={(effects) => handleFieldChange('effects', effects)}
            />

            <div className="db-form-section">{t('common.note')}</div>

            <textarea
              className="db-note-textarea"
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
              rows={5}
            />

            <div className="db-form-section">아이템 상세 표시</div>

            {/* 이미지 */}
            <div className="db-form-row" style={{ alignItems: 'flex-end', gap: 6 }}>
              <label style={{ flex: 1 }}>
                상세 이미지 (img/pictures/)
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={detail?.image || ''}
                    onChange={(e) => updateDetail({ image: e.target.value })}
                    placeholder="파일명 (확장자 생략)"
                    style={{ flex: 1 }}
                  />
                  <button className="db-picker-btn" onClick={() => setShowImgPicker(true)}>
                    {detail?.image ? '변경' : '선택'}
                  </button>
                </div>
              </label>
            </div>

            {detail?.image && (
              <div className="db-form-row" style={{ gap: 6 }}>
                <label style={{ flex: 1 }}>
                  이미지 가로 정렬
                  <select value={detail.imgHAlign} onChange={(e) => updateDetail({ imgHAlign: e.target.value as HAlign })}>
                    {HALIGN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  이미지 세로 정렬
                  <select value={detail.imgVAlign} onChange={(e) => updateDetail({ imgVAlign: e.target.value as VAlign })}>
                    {VALIGN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            )}

            {/* 텍스트 */}
            <label>
              상세 텍스트
              <textarea
                value={detail?.text || ''}
                onChange={(e) => updateDetail({ text: e.target.value })}
                placeholder={'여러 줄 가능. \\c[색] 등 제어문자 사용 가능.'}
                rows={5}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </label>

            {detail?.text && (
              <div className="db-form-row" style={{ gap: 6 }}>
                <label style={{ flex: 1 }}>
                  텍스트 가로 정렬
                  <select value={detail.textHAlign} onChange={(e) => updateDetail({ textHAlign: e.target.value as HAlign })}>
                    {HALIGN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  텍스트 세로 정렬
                  <select value={detail.textVAlign} onChange={(e) => updateDetail({ textVAlign: e.target.value as VAlign })}>
                    {VALIGN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            )}
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

      {showImgPicker && detail && (
        <ImagePicker
          type="pictures"
          value={detail.image}
          onChange={(v) => { updateDetail({ image: v }); setShowImgPicker(false); }}
          onClose={() => setShowImgPicker(false)}
          defaultOpen
        />
      )}
    </div>
  );
}
