import React, { useState, useMemo } from 'react';
import { selectStyle } from './messageEditors';
import { DataListPickerWithZero } from './actionEditorUtils';
import { useDbNamesWithIcons } from './actionEditorUtils';
import { useActorData } from './actionEditorUtils';
import { ActorDirectPicker, type EditorProps } from './actorEditorsCommon';
import { ItemPreview } from '../common/ItemPreview';
import { ItemPickerButton } from '../common/DbPickerButton';

/**
 * 장비 변경 에디터 (코드 319)
 * params: [actorId, etypeId, itemId]
 */
export function ChangeEquipmentEditor({ p, onOk, onCancel }: EditorProps) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [etypeId, setEtypeId] = useState<number>((p[1] as number) || 1);
  const [itemId, setItemId] = useState<number>((p[2] as number) || 0);
  const [showItemPicker, setShowItemPicker] = useState(false);

  const { names: actors, characterData: actorChars } = useActorData();
  const { names: weapons, iconIndices: weaponIcons } = useDbNamesWithIcons('weapons');
  const { names: armors, iconIndices: armorIcons } = useDbNamesWithIcons('armors');

  const EQUIP_TYPES = [
    { id: 1, label: '무기' },
    { id: 2, label: '방패' },
    { id: 3, label: '머리' },
    { id: 4, label: '몸' },
    { id: 5, label: '액세서리' },
  ];

  const isWeapon = etypeId === 1;

  const filteredItems = useMemo(() => {
    const source = isWeapon ? weapons : armors;
    const list: string[] = ['없음'];
    for (let i = 1; i < source.length; i++) {
      list[i] = source[i] || '';
    }
    return list;
  }, [isWeapon, weapons, armors]);

  const filteredIcons = isWeapon ? weaponIcons : armorIcons;

  const handleEtypeChange = (newEtype: number) => {
    setEtypeId(newEtype);
    setItemId(0);
  };

  return (
    <>
      <ActorDirectPicker actorId={actorId} onChange={setActorId} actorNames={actors} actorChars={actorChars} title="액터 선택" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>장비 유형:</span>
        <select value={etypeId} onChange={e => handleEtypeChange(Number(e.target.value))} style={selectStyle}>
          {EQUIP_TYPES.map(et => (
            <option key={et.id} value={et.id}>{et.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>장비 아이템:</span>
        <ItemPickerButton id={itemId} type={isWeapon ? 'weapon' : 'armor'} onClick={() => setShowItemPicker(true)} />
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, etypeId, itemId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showItemPicker && (
        <DataListPickerWithZero items={filteredItems} value={itemId} onChange={setItemId}
          onClose={() => setShowItemPicker(false)} title="장비 아이템 선택" iconIndices={filteredIcons}
          renderPreview={(id) => <ItemPreview id={id} type={isWeapon ? 'weapon' : 'armor'} />} />
      )}
    </>
  );
}
