import React, { useState, useEffect, useMemo, useRef } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { DataListPicker } from './dataListPicker';
import { useDbNames, useDbNamesWithIcons, useActorData, getLabel, DataListPickerWithZero } from './actionEditorUtils';
import apiClient from '../../api/client';

/**
 * 스테이트 변경 에디터 (코드 313)
 * params: [actorType, actorId, operation, stateId]
 */
export function ChangeStateEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [stateId, setStateId] = useState<number>((p[3] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();
  const { names: stateNames, iconIndices: stateIcons } = useDbNamesWithIcons('states');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="state-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="state-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="state-op" checked={operation === 0} onChange={() => setOperation(0)} />
            추가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="state-op" checked={operation === 1} onChange={() => setOperation(1)} />
            해제
          </label>
        </div>
      </fieldset>

      {/* 스탯 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>스탯:</span>
        <button className="db-btn" onClick={() => setShowStatePicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(stateId, stateNames)}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, stateId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
      {showStatePicker && (
        <DataListPicker items={stateNames} value={stateId} onChange={setStateId}
          onClose={() => setShowStatePicker(false)} title="대상 선택" iconIndices={stateIcons} />
      )}
    </>
  );
}

/**
 * 스킬 증감 에디터 (코드 318)
 * params: [actorType, actorId, operation, skillId]
 */
export function ChangeSkillEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [skillId, setSkillId] = useState<number>((p[3] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();
  const { names: skillNames, iconIndices: skillIcons } = useDbNamesWithIcons('skills');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="skill-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="skill-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="skill-op" checked={operation === 0} onChange={() => setOperation(0)} />
            배우다
          </label>
          <label style={radioStyle}>
            <input type="radio" name="skill-op" checked={operation === 1} onChange={() => setOperation(1)} />
            까먹다
          </label>
        </div>
      </fieldset>

      {/* 스킬 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>스킬:</span>
        <button className="db-btn" onClick={() => setShowSkillPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(skillId, skillNames)}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, skillId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
      {showSkillPicker && (
        <DataListPicker items={skillNames} value={skillId} onChange={setSkillId}
          onClose={() => setShowSkillPicker(false)} title="대상 선택" iconIndices={skillIcons} />
      )}
    </>
  );
}

/**
 * 모두 회복 에디터 (코드 314)
 * params: [actorType, actorId]
 * actorType: 0=고정, 1=변수
 * actorId: 고정 시 0=전체 파티, 1~N=특정 액터 / 변수 시 변수 ID
 */
export function RecoverAllEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 0);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  const actorLabel = actorId === 0
    ? '0000 전체 파티'
    : getLabel(actorId, actorNames);

  // "전체 파티"를 인덱스 0에 포함하는 목록 생성
  const actorListWithAll = useMemo(() => {
    const list = ['전체 파티', ...actorNames.slice(1)];
    return list;
  }, [actorNames]);

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="recover-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{actorLabel}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="recover-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPickerWithZero items={actorListWithAll} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
    </>
  );
}

/**
 * 직업 변경 에디터 (코드 321)
 * params: [actorId, classId, keepLevel]
 */
export function ChangeClassEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [classId, setClassId] = useState<number>((p[1] as number) || 1);
  const [keepLevel, setKeepLevel] = useState<boolean>((p[2] as boolean) || false);
  const { names: actors, characterData: actorChars } = useActorData();
  const classes = useDbNames('classes');
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowActorPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>직업:</span>
        <button className="db-btn" onClick={() => setShowClassPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(classId, classes)}</button>
      </div>
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={keepLevel} onChange={e => setKeepLevel(e.target.checked)} />
        레벨 저장
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, classId, keepLevel])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showActorPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
      {showClassPicker && (
        <DataListPicker items={classes} value={classId} onChange={setClassId}
          onClose={() => setShowClassPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

/**
 * 장비 변경 에디터 (코드 319)
 * params: [actorId, etypeId, itemId]
 * etypeId: 1=무기, 2=방패, 3=머리, 4=몸, 5=액세서리
 * itemId: 0=없음, etypeId===1이면 무기ID, 그 외 방어구ID
 */
export function ChangeEquipmentEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [etypeId, setEtypeId] = useState<number>((p[1] as number) || 1);
  const [itemId, setItemId] = useState<number>((p[2] as number) || 0);
  const [showActorPicker, setShowActorPicker] = useState(false);
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

  // 장비 아이템 목록 (0번 = 없음)
  const filteredItems = useMemo(() => {
    const list: string[] = ['없음'];
    if (isWeapon) {
      for (let i = 1; i < weapons.length; i++) {
        list[i] = weapons[i] || '';
      }
    } else {
      for (let i = 1; i < armors.length; i++) {
        list[i] = armors[i] || '';
      }
    }
    return list;
  }, [isWeapon, weapons, armors]);

  const filteredIcons = useMemo(() => {
    return isWeapon ? weaponIcons : armorIcons;
  }, [isWeapon, weaponIcons, armorIcons]);

  const itemLabel = itemId === 0
    ? '없음'
    : getLabel(itemId, isWeapon ? weapons : armors);

  const handleEtypeChange = (newEtype: number) => {
    setEtypeId(newEtype);
    setItemId(0);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowActorPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>

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
        <button className="db-btn" onClick={() => setShowItemPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{itemLabel}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, etypeId, itemId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
      {showItemPicker && (
        <DataListPickerWithZero items={filteredItems} value={itemId} onChange={setItemId}
          onClose={() => setShowItemPicker(false)} title="장비 아이템 선택" iconIndices={filteredIcons} />
      )}
    </>
  );
}

export function ChangeNameEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [name, setName] = useState<string>((p[1] as string) || '');
  const { names: actors, characterData: actorChars } = useActorData();
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ ...selectStyle, width: '100%' }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, name])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
    </>
  );
}

/**
 * 이름 입력 처리 에디터 (코드 303)
 * params: [actorId, maxCharacters]
 */
export function NameInputEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [maxChars, setMaxChars] = useState<number>((p[1] as number) || 8);
  const { names: actors, characterData: actorChars } = useActorData();
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>최대 문자 수:</span>
        <input type="number" value={maxChars} onChange={e => setMaxChars(Math.max(1, Math.min(16, Number(e.target.value))))}
          min={1} max={16} style={{ ...selectStyle, width: 120 }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, maxChars])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
    </>
  );
}

export function ChangeProfileEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [profile, setProfile] = useState<string>((p[1] as string) || '');
  const { names: actors, characterData: actorChars } = useActorData();
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>프로필:</span>
        <textarea value={profile} onChange={e => setProfile(e.target.value)}
          rows={4}
          style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4' }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, profile])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" characterData={actorChars} />
      )}
    </>
  );
}

/* ─── 이미지 선택 서브 다이얼로그 ─── */

function ImageSelectDialog({ type, value, index, onOk, onCancel }: {
  type: 'faces' | 'characters' | 'sv_actors';
  value: string;
  index: number;
  onOk: (name: string, index: number) => void;
  onCancel: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(index);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<string[]>(`/resources/${type}`).then(setFiles).catch(() => setFiles([]));
  }, [type]);

  useEffect(() => {
    if (files.length > 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.image-picker-item');
      const idx = selected ? files.findIndex(f => f.replace(/\.png$/i, '') === selected) : -1;
      const targetIdx = idx + 1;
      if (items[targetIdx]) {
        items[targetIdx].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [files]);

  const getImgUrl = (name: string) => `/api/resources/${type}/${name}.png`;
  const typeLabel = type === 'faces' ? '얼굴' : type === 'characters' ? '캐릭터' : '[SV] 전투 캐릭터';

  const getCellLayout = () => {
    if (type === 'faces') return { cols: 4, rows: 2, total: 8 };
    if (type === 'characters') return { cols: 4, rows: 2, total: 8 };
    return { cols: 1, rows: 1, total: 1 };
  };
  const layout = getCellLayout();

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 520, maxHeight: '80vh' }}>
        <div className="image-picker-header">이미지 선택 - {typeLabel}</div>
        <div className="image-picker-body">
          <div className="image-picker-list" ref={listRef}>
            <div className={`image-picker-item${selected === '' ? ' selected' : ''}`}
              onClick={() => { setSelected(''); setSelectedIndex(0); }}>(없음)</div>
            {files.map(f => {
              const name = f.replace(/\.png$/i, '');
              return (
                <div key={f}
                  className={`image-picker-item${selected === name ? ' selected' : ''}`}
                  onClick={() => { setSelected(name); setSelectedIndex(0); }}
                >{name}</div>
              );
            })}
          </div>
          <div className="image-picker-preview-area">
            {selected && layout.total > 1 ? (
              <ImageCellSelector
                imgSrc={getImgUrl(selected)}
                fileName={selected}
                cellCount={layout.total}
                cols={layout.cols}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            ) : selected ? (
              <img src={getImgUrl(selected)} alt={selected}
                style={{ maxWidth: '100%', maxHeight: 300, imageRendering: 'pixelated' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : null}
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => onOk(selected, selectedIndex)}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}

function ImageCellSelector({ imgSrc, fileName, cellCount, cols, selectedIndex, onSelect }: {
  imgSrc: string;
  fileName: string;
  cellCount: number;
  cols: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [imgSrc]);

  const isSingle = fileName.startsWith('$');
  // characters: 한 캐릭터 = 3패턴x4방향, 시트에 4x2 캐릭터
  // $ 접두사면 단일 캐릭터 (3x4 시트)
  const charCols = isSingle ? 1 : 4;
  const charRows = isSingle ? 1 : 2;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img src={imgSrc} style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
        draggable={false} onLoad={() => setLoaded(true)} />
      {loaded && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${charCols}, 1fr)`,
          gridTemplateRows: `repeat(${charRows}, 1fr)`,
        }}>
          {Array.from({ length: cellCount }, (_, i) => (
            <div key={i} onClick={() => onSelect(i)}
              style={{
                cursor: 'pointer',
                border: i === selectedIndex ? '2px solid #2675bf' : '1px solid rgba(255,255,255,0.05)',
                background: i === selectedIndex ? 'rgba(38,117,191,0.25)' : 'transparent',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImagePreviewThumb({ type, name, index, size }: {
  type: 'faces' | 'characters' | 'sv_actors';
  name: string;
  index: number;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!name) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      if (type === 'faces') {
        const cw = img.naturalWidth / 4;
        const ch = img.naturalHeight / 2;
        const col = index % 4;
        const row = Math.floor(index / 4);
        canvas.width = cw;
        canvas.height = ch;
        ctx.drawImage(img, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
      } else if (type === 'characters') {
        const isSingle = name.startsWith('$');
        const charCols = isSingle ? 1 : 4;
        const patterns = 3;
        const dirs = 4;
        const totalCols = isSingle ? 3 : 12;
        const totalRows = isSingle ? 4 : 8;
        const fw = img.naturalWidth / totalCols;
        const fh = img.naturalHeight / totalRows;
        const charCol = index % charCols;
        const charRow = Math.floor(index / charCols);
        const sx = (charCol * patterns + 1) * fw;
        const sy = (charRow * dirs + 0) * fh;
        canvas.width = fw;
        canvas.height = fh;
        ctx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      } else {
        const fw = img.naturalWidth / 9;
        const fh = img.naturalHeight / 6;
        canvas.width = fw;
        canvas.height = fh;
        ctx.drawImage(img, 0, 0, fw, fh, 0, 0, fw, fh);
      }
    };
    img.src = `/api/resources/${type}/${name}.png`;
  }, [type, name, index]);

  if (!name) {
    return <div style={{ width: size, height: size, background: '#333', border: '1px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#888', fontSize: 11 }}>(없음)</span>
    </div>;
  }
  return <canvas ref={canvasRef} style={{ maxWidth: size, maxHeight: size, imageRendering: 'pixelated', background: 'repeating-conic-gradient(#444 0% 25%, #555 0% 50%) 50% / 16px 16px' }} />;
}

/**
 * 액터 이미지 변경 에디터 (코드 322)
 * params: [actorId, characterName, characterIndex, faceName, faceIndex, battlerName]
 */
export function ChangeActorImagesEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [characterName, setCharacterName] = useState<string>((p[1] as string) || '');
  const [characterIndex, setCharacterIndex] = useState<number>((p[2] as number) || 0);
  const [faceName, setFaceName] = useState<string>((p[3] as string) || '');
  const [faceIndex, setFaceIndex] = useState<number>((p[4] as number) || 0);
  const [battlerName, setBattlerName] = useState<string>((p[5] as string) || '');
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [imageDialog, setImageDialog] = useState<'faces' | 'characters' | 'sv_actors' | null>(null);

  const { names: actors, characterData: actorChars } = useActorData();

  const thumbSize = 80;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowActorPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>이미지</legend>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>얼굴:</span>
            <div onClick={() => setImageDialog('faces')}
              style={{ cursor: 'pointer', border: '1px solid #555', padding: 2, background: '#1a1a1a' }}>
              <ImagePreviewThumb type="faces" name={faceName} index={faceIndex} size={thumbSize} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>캐릭터:</span>
            <div onClick={() => setImageDialog('characters')}
              style={{ cursor: 'pointer', border: '1px solid #555', padding: 2, background: '#1a1a1a' }}>
              <ImagePreviewThumb type="characters" name={characterName} index={characterIndex} size={thumbSize} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>[SV] 전투 캐릭터:</span>
            <div onClick={() => setImageDialog('sv_actors')}
              style={{ cursor: 'pointer', border: '1px solid #555', padding: 2, background: '#1a1a1a' }}>
              <ImagePreviewThumb type="sv_actors" name={battlerName} index={0} size={thumbSize} />
            </div>
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, characterName, characterIndex, faceName, faceIndex, battlerName])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
      {imageDialog === 'faces' && (
        <ImageSelectDialog type="faces" value={faceName} index={faceIndex}
          onOk={(name, idx) => { setFaceName(name); setFaceIndex(idx); setImageDialog(null); }}
          onCancel={() => setImageDialog(null)} />
      )}
      {imageDialog === 'characters' && (
        <ImageSelectDialog type="characters" value={characterName} index={characterIndex}
          onOk={(name, idx) => { setCharacterName(name); setCharacterIndex(idx); setImageDialog(null); }}
          onCancel={() => setImageDialog(null)} />
      )}
      {imageDialog === 'sv_actors' && (
        <ImageSelectDialog type="sv_actors" value={battlerName} index={0}
          onOk={(name) => { setBattlerName(name); setImageDialog(null); }}
          onCancel={() => setImageDialog(null)} />
      )}
    </>
  );
}

/**
 * 탈 것 이미지 변경 에디터 (코드 323)
 * params: [vehicleType, imageName, imageIndex]
 */
export function ChangeVehicleImageEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [vehicleType, setVehicleType] = useState<number>((p[0] as number) || 0);
  const [imageName, setImageName] = useState<string>((p[1] as string) || '');
  const [imageIndex, setImageIndex] = useState<number>((p[2] as number) || 0);
  const [showImageDialog, setShowImageDialog] = useState(false);

  const VEHICLES = [
    { id: 0, label: '보트' },
    { id: 1, label: '선박' },
    { id: 2, label: '비행선' },
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>탈 것:</span>
        <select value={vehicleType} onChange={e => setVehicleType(Number(e.target.value))} style={selectStyle}>
          {VEHICLES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>이미지</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={() => setShowImageDialog(true)}
            style={{ cursor: 'pointer', border: '1px solid #555', padding: 2, background: '#1a1a1a' }}>
            <ImagePreviewThumb type="characters" name={imageName} index={imageIndex} size={80} />
          </div>
          <span style={{ fontSize: 12, color: '#aaa' }}>{imageName || '(없음)'}{imageName ? ` [${imageIndex}]` : ''}</span>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([vehicleType, imageName, imageIndex])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showImageDialog && (
        <ImageSelectDialog type="characters" value={imageName} index={imageIndex}
          onOk={(name, idx) => { setImageName(name); setImageIndex(idx); setShowImageDialog(false); }}
          onCancel={() => setShowImageDialog(false)} />
      )}
    </>
  );
}
