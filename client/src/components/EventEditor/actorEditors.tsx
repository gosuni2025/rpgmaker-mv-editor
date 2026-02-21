<<<<<<< HEAD
import React, { useState, useEffect, useMemo } from 'react';
=======
import React, { useState, useMemo } from 'react';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { DataListPicker } from './dataListPicker';
import { useDbNames, useDbNamesWithIcons, useActorData, getLabel, DataListPickerWithZero, type CharacterInfo } from './actionEditorUtils';
<<<<<<< HEAD
import ImagePicker from '../common/ImagePicker';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';

type EditorProps = { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void };

const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
const fieldsetStyle: React.CSSProperties = { border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 };
const legendStyle: React.CSSProperties = { fontSize: 12, color: '#aaa', padding: '0 4px' };
=======
import { radioStyle, fieldsetStyle, legendStyle, ActorDirectPicker, type EditorProps } from './actorEditorsCommon';

// re-export 분리된 에디터들
export { ChangeActorImagesEditor } from './ChangeActorImagesEditor';
export { ChangeVehicleImageEditor } from './ChangeVehicleImageEditor';
export { ChangeEquipmentEditor } from './ChangeEquipmentEditor';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

/* ─── 공통 컴포넌트 ─── */

/** 고정/변수 액터 선택 fieldset */
function ActorFixedVarFieldset({
  radioName, actorType, onActorTypeChange, actorId, onActorIdChange,
  actorNames, actorChars, buttonLabel, pickerItems, useZeroPicker,
}: {
  radioName: string;
  actorType: number;
  onActorTypeChange: (v: number) => void;
  actorId: number;
  onActorIdChange: (v: number) => void;
  actorNames: string[];
  actorChars?: (CharacterInfo | undefined)[];
  buttonLabel?: string;
  pickerItems?: string[];
  useZeroPicker?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const label = buttonLabel ?? getLabel(actorId, actorNames);
  const items = pickerItems ?? actorNames;
  const Picker = useZeroPicker ? DataListPickerWithZero : DataListPicker;

  return (
    <>
      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={radioName} checked={actorType === 0} onChange={() => onActorTypeChange(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{label}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={radioName} checked={actorType === 1} onChange={() => onActorTypeChange(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => onActorIdChange(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>
      {showPicker && (
        <Picker items={items} value={actorId} onChange={onActorIdChange}
          onClose={() => setShowPicker(false)} title="액터 선택" characterData={actorChars} />
      )}
    </>
  );
}

<<<<<<< HEAD
/** 단순 액터 선택 (라벨 + 버튼 + 피커 다이얼로그) */
function ActorDirectPicker({ actorId, onChange, actorNames, actorChars, title }: {
  actorId: number;
  onChange: (id: number) => void;
  actorNames: string[];
  actorChars?: (CharacterInfo | undefined)[];
  title?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actorNames)}</button>
      </div>
      {showPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={onChange}
          onClose={() => setShowPicker(false)} title={title || '대상 선택'} characterData={actorChars} />
      )}
    </>
  );
}

=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
/* ─── 액터 + 조작 + 대상 패턴 (ChangeState, ChangeSkill) ─── */

function ActorOperationTargetEditor({
  p, onOk, onCancel, radioPrefix, operationLabels, targetDbType, targetLabel,
}: EditorProps & {
  radioPrefix: string;
  operationLabels: [string, string];
  targetDbType: string;
  targetLabel: string;
}) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [targetId, setTargetId] = useState<number>((p[3] as number) || 1);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const { names: actorNames, characterData: actorChars } = useActorData();
  const { names: targetNames, iconIndices: targetIcons } = useDbNamesWithIcons(targetDbType);

  return (
    <>
      <ActorFixedVarFieldset
        radioName={`${radioPrefix}-actor`}
        actorType={actorType} onActorTypeChange={setActorType}
        actorId={actorId} onActorIdChange={setActorId}
        actorNames={actorNames} actorChars={actorChars}
      />

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name={`${radioPrefix}-op`} checked={operation === 0} onChange={() => setOperation(0)} />
            {operationLabels[0]}
          </label>
          <label style={radioStyle}>
            <input type="radio" name={`${radioPrefix}-op`} checked={operation === 1} onChange={() => setOperation(1)} />
            {operationLabels[1]}
          </label>
        </div>
      </fieldset>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{targetLabel}:</span>
        <button className="db-btn" onClick={() => setShowTargetPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(targetId, targetNames)}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, targetId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showTargetPicker && (
        <DataListPicker items={targetNames} value={targetId} onChange={setTargetId}
          onClose={() => setShowTargetPicker(false)} title="대상 선택" iconIndices={targetIcons} />
      )}
    </>
  );
}

/* ─── 에디터 컴포넌트 ─── */

/**
 * 스테이트 변경 에디터 (코드 313)
 * params: [actorType, actorId, operation, stateId]
 */
export function ChangeStateEditor(props: EditorProps) {
  return <ActorOperationTargetEditor {...props}
    radioPrefix="state" operationLabels={['추가', '해제']} targetDbType="states" targetLabel="스탯" />;
}

/**
 * 스킬 증감 에디터 (코드 318)
 * params: [actorType, actorId, operation, skillId]
 */
export function ChangeSkillEditor(props: EditorProps) {
  return <ActorOperationTargetEditor {...props}
    radioPrefix="skill" operationLabels={['배우다', '까먹다']} targetDbType="skills" targetLabel="스킬" />;
}

/**
 * 모두 회복 에디터 (코드 314)
 * params: [actorType, actorId]
 */
export function RecoverAllEditor({ p, onOk, onCancel }: EditorProps) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 0);
  const { names: actorNames, characterData: actorChars } = useActorData();

  const actorLabel = actorId === 0 ? '0000 전체 파티' : getLabel(actorId, actorNames);
  const actorListWithAll = useMemo(() => ['전체 파티', ...actorNames.slice(1)], [actorNames]);

  return (
    <>
      <ActorFixedVarFieldset
        radioName="recover-actor"
        actorType={actorType} onActorTypeChange={setActorType}
        actorId={actorId} onActorIdChange={setActorId}
        actorNames={actorNames} actorChars={actorChars}
        buttonLabel={actorLabel} pickerItems={actorListWithAll} useZeroPicker
      />
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/**
 * 직업 변경 에디터 (코드 321)
 * params: [actorId, classId, keepLevel]
 */
export function ChangeClassEditor({ p, onOk, onCancel }: EditorProps) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [classId, setClassId] = useState<number>((p[1] as number) || 1);
  const [keepLevel, setKeepLevel] = useState<boolean>((p[2] as boolean) || false);
  const { names: actors, characterData: actorChars } = useActorData();
  const classes = useDbNames('classes');
  const [showClassPicker, setShowClassPicker] = useState(false);
  return (
    <>
      <ActorDirectPicker actorId={actorId} onChange={setActorId} actorNames={actors} actorChars={actorChars} />
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
      {showClassPicker && (
        <DataListPicker items={classes} value={classId} onChange={setClassId}
          onClose={() => setShowClassPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

<<<<<<< HEAD
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

  const itemLabel = itemId === 0
    ? '없음'
    : getLabel(itemId, isWeapon ? weapons : armors);

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
        <button className="db-btn" onClick={() => setShowItemPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{itemLabel}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, etypeId, itemId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showItemPicker && (
        <DataListPickerWithZero items={filteredItems} value={itemId} onChange={setItemId}
          onClose={() => setShowItemPicker(false)} title="장비 아이템 선택" iconIndices={filteredIcons} />
      )}
    </>
  );
}

=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
export function ChangeNameEditor({ p, onOk, onCancel, label }: EditorProps & { label: string }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [name, setName] = useState<string>((p[1] as string) || '');
  const { names: actors, characterData: actorChars } = useActorData();
  return (
    <>
      <ActorDirectPicker actorId={actorId} onChange={setActorId} actorNames={actors} actorChars={actorChars} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ ...selectStyle, width: '100%' }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, name])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/**
 * 이름 입력 처리 에디터 (코드 303)
 * params: [actorId, maxCharacters]
 */
export function NameInputEditor({ p, onOk, onCancel }: EditorProps) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [maxChars, setMaxChars] = useState<number>((p[1] as number) || 8);
  const { names: actors, characterData: actorChars } = useActorData();
  return (
    <>
      <ActorDirectPicker actorId={actorId} onChange={setActorId} actorNames={actors} actorChars={actorChars} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>최대 문자 수:</span>
        <input type="number" value={maxChars} onChange={e => setMaxChars(Math.max(1, Math.min(16, Number(e.target.value))))}
          min={1} max={16} style={{ ...selectStyle, width: 120 }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, maxChars])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function ChangeProfileEditor({ p, onOk, onCancel }: EditorProps) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [profile, setProfile] = useState<string>((p[1] as string) || '');
  const { names: actors, characterData: actorChars } = useActorData();
  return (
    <>
      <ActorDirectPicker actorId={actorId} onChange={setActorId} actorNames={actors} actorChars={actorChars} />
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
    </>
  );
}
<<<<<<< HEAD

/* ─── 이미지 에디터 ─── */

interface ActorImageInfo {
  faceName: string;
  faceIndex: number;
  characterName: string;
  characterIndex: number;
  battlerName: string;
}

function useActorFullData(): { names: string[]; characterData: (CharacterInfo | undefined)[]; imageData: (ActorImageInfo | undefined)[] } {
  const [names, setNames] = useState<string[]>([]);
  const [characterData, setCharacterData] = useState<(CharacterInfo | undefined)[]>([]);
  const [imageData, setImageData] = useState<(ActorImageInfo | undefined)[]>([]);
  useEffect(() => {
    apiClient.get<(any | null)[]>('/database/actors').then(data => {
      const nameArr: string[] = [];
      const charArr: (CharacterInfo | undefined)[] = [];
      const imgArr: (ActorImageInfo | undefined)[] = [];
      for (const item of data) {
        if (item) {
          nameArr[item.id] = item.name || '';
          if (item.characterName) {
            charArr[item.id] = { characterName: item.characterName, characterIndex: item.characterIndex ?? 0 };
          }
          imgArr[item.id] = {
            faceName: item.faceName || '',
            faceIndex: item.faceIndex ?? 0,
            characterName: item.characterName || '',
            characterIndex: item.characterIndex ?? 0,
            battlerName: item.battlerName || '',
          };
        }
      }
      setNames(nameArr);
      setCharacterData(charArr);
      setImageData(imgArr);
    }).catch(() => {});
  }, []);
  return { names, characterData, imageData };
}

/**
 * 액터 이미지 변경 에디터 (코드 322)
 * params: [actorId, characterName, characterIndex, faceName, faceIndex, battlerName]
 */
export function ChangeActorImagesEditor({ p, onOk, onCancel }: EditorProps) {
  const isNew = p.length === 0;
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [characterName, setCharacterName] = useState<string>((p[1] as string) || '');
  const [characterIndex, setCharacterIndex] = useState<number>((p[2] as number) || 0);
  const [faceName, setFaceName] = useState<string>((p[3] as string) || '');
  const [faceIndex, setFaceIndex] = useState<number>((p[4] as number) || 0);
  const [battlerName, setBattlerName] = useState<string>((p[5] as string) || '');
  const [initialized, setInitialized] = useState(!isNew);

  const { names: actors, characterData: actorChars, imageData } = useActorFullData();

  const applyActorImages = (id: number) => {
    const img = imageData[id];
    if (img) {
      setFaceName(img.faceName);
      setFaceIndex(img.faceIndex);
      setCharacterName(img.characterName);
      setCharacterIndex(img.characterIndex);
      setBattlerName(img.battlerName);
    }
  };

  useEffect(() => {
    if (!initialized && imageData.length > 0) {
      applyActorImages(actorId);
      setInitialized(true);
    }
  }, [imageData, initialized]);

  const handleActorChange = (newId: number) => {
    setActorId(newId);
    applyActorImages(newId);
  };

  return (
    <>
      <ActorDirectPicker actorId={actorId} onChange={handleActorChange} actorNames={actors} actorChars={actorChars} title="액터 선택" />

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>이미지</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <span style={{ fontSize: 12, color: '#aaa' }}>얼굴:</span>
            <ImagePicker type="faces" value={faceName} onChange={setFaceName}
              index={faceIndex} onIndexChange={setFaceIndex} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#aaa' }}>캐릭터:</span>
            <ImagePicker type="characters" value={characterName} onChange={setCharacterName}
              index={characterIndex} onIndexChange={setCharacterIndex} />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#aaa' }}>[SV] 전투 캐릭터:</span>
            <ImagePicker type="sv_actors" value={battlerName} onChange={setBattlerName} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, characterName, characterIndex, faceName, faceIndex, battlerName])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/**
 * 탈 것 이미지 변경 에디터 (코드 323)
 * params: [vehicleType, imageName, imageIndex]
 */
export function ChangeVehicleImageEditor({ p, onOk, onCancel }: EditorProps) {
  const systemData = useEditorStore(s => s.systemData);
  const VEHICLE_KEYS = ['boat', 'ship', 'airship'] as const;

  const getVehicleImage = (type: number) => {
    const key = VEHICLE_KEYS[type] || 'boat';
    const v = systemData?.[key];
    return { name: v?.characterName || '', index: v?.characterIndex ?? 0 };
  };

  const initType = (p[0] as number) || 0;
  const hasParams = !!(p[1] as string);
  const initImage = hasParams ? { name: p[1] as string, index: (p[2] as number) || 0 } : getVehicleImage(initType);

  const [vehicleType, setVehicleType] = useState<number>(initType);
  const [imageName, setImageName] = useState<string>(initImage.name);
  const [imageIndex, setImageIndex] = useState<number>(initImage.index);

  const VEHICLES = [
    { id: 0, label: '보트' },
    { id: 1, label: '선박' },
    { id: 2, label: '비행선' },
  ];

  const handleVehicleTypeChange = (type: number) => {
    setVehicleType(type);
    const img = getVehicleImage(type);
    setImageName(img.name);
    setImageIndex(img.index);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>탈 것:</span>
        <select value={vehicleType} onChange={e => handleVehicleTypeChange(Number(e.target.value))} style={selectStyle}>
          {VEHICLES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>이미지</legend>
        <ImagePicker type="characters" value={imageName} onChange={setImageName}
          index={imageIndex} onIndexChange={setImageIndex} />
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([vehicleType, imageName, imageIndex])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
