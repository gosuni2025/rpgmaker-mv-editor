import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Actor, Trait } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import DatabaseList from './DatabaseList';
import { useDatabaseTab } from './useDatabaseTab';
import { useDbRef } from './useDbRef';

interface ActorsTabProps {
  data: (Actor | null)[] | undefined;
  onChange: (data: (Actor | null)[]) => void;
}

const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' };

function createNewActor(id: number): Actor {
  return {
    id,
    name: '',
    nickname: '',
    classId: 1,
    initialLevel: 1,
    maxLevel: 99,
    profile: '',
    characterName: '',
    characterIndex: 0,
    faceName: '',
    faceIndex: 0,
    battlerName: '',
    equips: [0, 0, 0, 0, 0],
    traits: [],
    note: '',
  };
}

export default function ActorsTab({ data, onChange }: ActorsTabProps) {
  const { t } = useTranslation();
  const { selectedId, setSelectedId, selectedItem, handleFieldChange, handleAdd, handleDelete, handleDuplicate, handleReorder } =
    useDatabaseTab(data, onChange, createNewActor);
  const classes = useDbRef('/database/classes');
  const weapons = useDbRef('/database/weapons');
  const armors = useDbRef('/database/armors');

  const EQUIP_SLOT_NAMES = [t('fields.equipSlots.weapon'), t('fields.equipSlots.shield'), t('fields.equipSlots.head'), t('fields.equipSlots.body'), t('fields.equipSlots.accessory')];

  const handleEquipChange = (index: number, value: number) => {
    const equips = [...(selectedItem?.equips || [0, 0, 0, 0, 0])];
    equips[index] = value;
    handleFieldChange('equips', equips);
  };

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
      />
      <div className="db-form-columns">
        {selectedItem && (
          <>
            <div className="db-form-col">
              <label>
                {t('common.name')}
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <input
                    type="text"
                    value={selectedItem.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    style={{flex:1}}
                  />
                  <TranslateButton csvPath="database/actors.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                </div>
              </label>
              <label>
                {t('fields.nickname')}
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <input
                    type="text"
                    value={selectedItem.nickname || ''}
                    onChange={(e) => handleFieldChange('nickname', e.target.value)}
                    style={{flex:1}}
                  />
                  <TranslateButton csvPath="database/actors.csv" entryKey={`${selectedItem.id}.nickname`} sourceText={selectedItem.nickname || ''} />
                </div>
              </label>
              <label>
                {t('fields.class')}
                <select
                  value={selectedItem.classId || 0}
                  onChange={(e) => handleFieldChange('classId', Number(e.target.value))}
                  style={selectStyle}
                >
                  <option value={0}>{t('common.none')}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{String(c.id).padStart(4, '0')}: {c.name}</option>)}
                </select>
              </label>
              <div className="db-form-row">
                <label>
                  {t('fields.initialLevel')}
                  <input
                    type="number"
                    value={selectedItem.initialLevel || 1}
                    onChange={(e) => handleFieldChange('initialLevel', Number(e.target.value))}
                  />
                </label>
                <label>
                  {t('fields.maxLevel')}
                  <input
                    type="number"
                    value={selectedItem.maxLevel || 99}
                    onChange={(e) => handleFieldChange('maxLevel', Number(e.target.value))}
                  />
                </label>
              </div>
              <label>
                {t('fields.profile')}
                <div style={{display:'flex',gap:4,alignItems:'start'}}>
                  <textarea
                    value={selectedItem.profile || ''}
                    onChange={(e) => handleFieldChange('profile', e.target.value)}
                    rows={3}
                    style={{flex:1}}
                  />
                  <TranslateButton csvPath="database/actors.csv" entryKey={`${selectedItem.id}.profile`} sourceText={selectedItem.profile || ''} />
                </div>
              </label>

              <div className="db-form-section">{t('fields.images')}</div>
              <label>
                {t('fields.face')}
                <ImagePicker
                  type="faces"
                  value={selectedItem.faceName || ''}
                  onChange={(name) => handleFieldChange('faceName', name)}
                  index={selectedItem.faceIndex ?? 0}
                  onIndexChange={(index) => handleFieldChange('faceIndex', index)}
                />
              </label>
              <label>
                {t('fields.character')}
                <ImagePicker
                  type="characters"
                  value={selectedItem.characterName || ''}
                  onChange={(name) => handleFieldChange('characterName', name)}
                  index={selectedItem.characterIndex ?? 0}
                  onIndexChange={(index) => handleFieldChange('characterIndex', index)}
                />
              </label>
              <label>
                {t('fields.battlerSV')}
                <ImagePicker
                  type="sv_actors"
                  value={selectedItem.battlerName || ''}
                  onChange={(name) => handleFieldChange('battlerName', name)}
                />
              </label>
            </div>

            <div className="db-form-col">
              <div className="db-form-section" style={{borderTop:'none',marginTop:0,paddingTop:0}}>{t('fields.initialEquipment')}</div>
              <div className="db-equip-row">
                {EQUIP_SLOT_NAMES.map((name, i) => {
                  const list = i === 0 ? weapons : armors;
                  return (
                    <label key={i} className="db-equip-slot">
                      {name}
                      <select
                        value={selectedItem.equips?.[i] ?? 0}
                        onChange={(e) => handleEquipChange(i, Number(e.target.value))}
                        style={selectStyle}
                      >
                        <option value={0}>{t('common.none')}</option>
                        {list.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                  );
                })}
              </div>

              <TraitsEditor
                traits={selectedItem.traits || []}
                onChange={(traits: Trait[]) => handleFieldChange('traits', traits)}
              />

              <label>
                {t('common.note')}
                <textarea
                  value={selectedItem.note || ''}
                  onChange={(e) => handleFieldChange('note', e.target.value)}
                  rows={4}
                />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
