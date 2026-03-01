import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import TranslateButton from '../common/TranslateButton';
import EffectsEditor from '../common/EffectsEditor';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';
import { ShowPictureEditorDialog, type ItemDetailPicData } from '../EventEditor/ShowPictureEditorDialog';
import { ShowTextEditorDialog } from '../EventEditor/ShowTextEditorDialog';
import DatabaseList from './DatabaseList';
import { useDatabaseTab } from './useDatabaseTab';
import { makeScopeOptions, makeOccasionOptions, makeHitTypeOptions } from './dbConstants';
import { useDbRef } from './useDbRef';

interface DetailTxtData {
  text: string;
  textHAlign: 'left' | 'center' | 'right';
  textVAlign: 'top' | 'middle' | 'bottom';
}

function parsePicFromNote(note: string): ItemDetailPicData | null {
  const m = note.match(/<detailPic>([\s\S]*?)<\/detailPic>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function parseTxtFromNote(note: string): DetailTxtData | null {
  const m = note.match(/<detailTxt>([\s\S]*?)<\/detailTxt>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function stripDetailTags(note: string): string {
  return note
    .replace(/<detailPic>[\s\S]*?<\/detailPic>\n?/gi, '')
    .replace(/<detailTxt>[\s\S]*?<\/detailTxt>\n?/gi, '')
    // 구버전 태그 호환 제거
    .replace(/<detailImg:[^>]*>\n?/gi, '')
    .replace(/<detailImgAlign:[^>]*>\n?/gi, '')
    .replace(/<detailText>[\s\S]*?<\/detailText>\n?/gi, '')
    .replace(/<detailTextAlign:[^>]*>\n?/gi, '')
    .trimEnd();
}

function buildNoteWithDetail(note: string, pic: ItemDetailPicData | null, txt: DetailTxtData | null): string {
  const base = stripDetailTags(note);
  const parts: string[] = [];
  if (pic) parts.push(`<detailPic>${JSON.stringify(pic)}</detailPic>`);
  if (txt) parts.push(`<detailTxt>${JSON.stringify(txt)}</detailTxt>`);
  if (!parts.length) return base;
  return base ? base + '\n' + parts.join('\n') : parts.join('\n');
}

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
  const [showPicEditor, setShowPicEditor] = useState(false);
  const [showTxtEditor, setShowTxtEditor] = useState(false);

  const note = selectedItem?.note || '';
  const picData = selectedItem ? parsePicFromNote(note) : null;
  const txtData = selectedItem ? parseTxtFromNote(note) : null;

  function setPic(pic: ItemDetailPicData | null) {
    if (!selectedItem) return;
    handleFieldChange('note', buildNoteWithDetail(note, pic, txtData));
  }
  function setTxt(txt: DetailTxtData | null) {
    if (!selectedItem) return;
    handleFieldChange('note', buildNoteWithDetail(note, picData, txt));
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <button className="db-btn" onClick={() => setShowPicEditor(true)}>
                {picData ? '이미지 수정...' : '이미지 설정...'}
              </button>
              {picData && (
                <>
                  <span style={{ fontSize: 12, color: '#7cb3ff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {picData.image || '(이미지 없음)'}
                    {picData.shaderData && picData.shaderData.length > 0 && <span style={{ color: '#ffa' }}> + 셰이더</span>}
                  </span>
                  <button className="db-btn" style={{ fontSize: 11, color: '#f88', padding: '1px 6px' }} onClick={() => setPic(null)}>지우기</button>
                </>
              )}
            </div>

            {/* 텍스트 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="db-btn" onClick={() => setShowTxtEditor(true)}>
                {txtData ? '텍스트 수정...' : '텍스트 설정...'}
              </button>
              {txtData && (
                <>
                  <span style={{ fontSize: 12, color: '#7cb3ff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {txtData.text.split('\n')[0] || '(텍스트 없음)'}
                  </span>
                  <button className="db-btn" style={{ fontSize: 11, color: '#f88', padding: '1px 6px' }} onClick={() => setTxt(null)}>지우기</button>
                </>
              )}
            </div>
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

      {showPicEditor && selectedItem && (
        <ShowPictureEditorDialog
          p={[]}
          mode="itemDetail"
          initItemDetail={picData ?? undefined}
          onOk={() => {}}
          onOkItemDetail={(data) => { setPic(data); setShowPicEditor(false); }}
          onCancel={() => setShowPicEditor(false)}
        />
      )}

      {showTxtEditor && selectedItem && (
        <ShowTextEditorDialog
          p={[]}
          mode="textOnly"
          existingLines={txtData ? [txtData.text] : undefined}
          initTextAlign={txtData ? { h: txtData.textHAlign, v: txtData.textVAlign } : undefined}
          onOk={() => {}}
          onOkTextOnly={(text, h, v) => {
            setTxt(text ? { text, textHAlign: h as DetailTxtData['textHAlign'], textVAlign: v as DetailTxtData['textVAlign'] } : null);
            setShowTxtEditor(false);
          }}
          onCancel={() => setShowTxtEditor(false)}
        />
      )}
    </div>
  );
}
