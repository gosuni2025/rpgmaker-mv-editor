import React, { useState, useMemo } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { DataListPicker } from './dataListPicker';
import { useDbNames, useDbNamesWithIcons, useActorData, getLabel, DataListPickerWithZero, type CharacterInfo } from './actionEditorUtils';
import { radioStyle, fieldsetStyle, legendStyle, ActorDirectPicker, type EditorProps } from './actorEditorsCommon';

// re-export 분리된 에디터들
export { ChangeActorImagesEditor } from './ChangeActorImagesEditor';
export { ChangeVehicleImageEditor } from './ChangeVehicleImageEditor';
export { ChangeEquipmentEditor } from './ChangeEquipmentEditor';

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
