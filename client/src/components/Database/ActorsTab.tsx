import React, { useState } from 'react';
import type { Actor, Trait } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import TraitsEditor from '../common/TraitsEditor';

interface ActorsTabProps {
  data: (Actor | null)[] | undefined;
  onChange: (data: (Actor | null)[]) => void;
}

const EQUIP_SLOT_NAMES = ['Weapon', 'Shield', 'Head', 'Body', 'Accessory'];

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
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const handleFieldChange = (field: keyof Actor, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleEquipChange = (index: number, value: number) => {
    const equips = [...(selectedItem?.equips || [0, 0, 0, 0, 0])];
    equips[index] = value;
    handleFieldChange('equips', equips);
  };

  const handleAddActor = () => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newData = [...data, createNewActor(newId)];
    onChange(newData);
    setSelectedId(newId);
  };

  const handleDeleteActor = () => {
    if (!data || !selectedItem) return;
    const items = data.filter(Boolean) as Actor[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== selectedId);
    onChange(newData);
    const remaining = newData.filter(Boolean) as Actor[];
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id);
    }
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={handleAddActor} title="Add Actor">+</button>
          <button className="db-btn-small" onClick={handleDeleteActor} title="Delete Actor">-</button>
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
              Name
              <input
                type="text"
                value={selectedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </label>
            <label>
              Nickname
              <input
                type="text"
                value={selectedItem.nickname || ''}
                onChange={(e) => handleFieldChange('nickname', e.target.value)}
              />
            </label>
            <label>
              Class ID
              <input
                type="number"
                value={selectedItem.classId || 0}
                onChange={(e) => handleFieldChange('classId', Number(e.target.value))}
              />
            </label>
            <label>
              Initial Level
              <input
                type="number"
                value={selectedItem.initialLevel || 1}
                onChange={(e) => handleFieldChange('initialLevel', Number(e.target.value))}
              />
            </label>
            <label>
              Max Level
              <input
                type="number"
                value={selectedItem.maxLevel || 99}
                onChange={(e) => handleFieldChange('maxLevel', Number(e.target.value))}
              />
            </label>
            <label>
              Profile
              <textarea
                value={selectedItem.profile || ''}
                onChange={(e) => handleFieldChange('profile', e.target.value)}
                rows={3}
              />
            </label>

            <div className="db-form-section">Images</div>
            <label>
              Face
              <ImagePicker
                type="faces"
                value={selectedItem.faceName || ''}
                onChange={(name) => handleFieldChange('faceName', name)}
                index={selectedItem.faceIndex ?? 0}
                onIndexChange={(index) => handleFieldChange('faceIndex', index)}
              />
            </label>
            <label>
              Character
              <ImagePicker
                type="characters"
                value={selectedItem.characterName || ''}
                onChange={(name) => handleFieldChange('characterName', name)}
                index={selectedItem.characterIndex ?? 0}
                onIndexChange={(index) => handleFieldChange('characterIndex', index)}
              />
            </label>
            <label>
              Battler (SV)
              <ImagePicker
                type="sv_actors"
                value={selectedItem.battlerName || ''}
                onChange={(name) => handleFieldChange('battlerName', name)}
              />
            </label>

            <div className="db-form-section">Initial Equipment</div>
            <div className="db-equip-row">
              {EQUIP_SLOT_NAMES.map((name, i) => (
                <label key={i} className="db-equip-slot">
                  {name}
                  <input
                    type="number"
                    value={selectedItem.equips?.[i] ?? 0}
                    onChange={(e) => handleEquipChange(i, Number(e.target.value))}
                    min={0}
                  />
                </label>
              ))}
            </div>

            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits: Trait[]) => handleFieldChange('traits', traits)}
            />

            <label>
              Note
              <textarea
                value={selectedItem.note || ''}
                onChange={(e) => handleFieldChange('note', e.target.value)}
                rows={4}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
