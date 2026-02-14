import React from 'react';
import { selectStyle } from './messageEditors';
import { DataListPicker, type CharacterInfo } from './dataListPicker';
import { radioStyle, rowStyle, disabledOpacity, getLabel, useActorData, useDbNames, useDbNamesWithIcons } from './condBranchHelpers';

interface Props {
  condType: number;
  onCondTypeChange: (t: number) => void;
  actorId: number; setActorId: (v: number) => void;
  actorSubType: number; setActorSubType: (v: number) => void;
  actorParam: string | number; setActorParam: (v: string | number) => void;
}

const ACTOR_SUB_TYPES: [number, string][] = [
  [0, '파티에 있다'], [1, '이름'], [2, '직업'],
  [3, '스킬'], [4, '무기'], [5, '방어구'], [6, '스테이트'],
];

export function CondBranchTab2({
  condType, onCondTypeChange,
  actorId, setActorId, actorSubType, setActorSubType, actorParam, setActorParam,
}: Props) {
  const { names: actors, characterData: actorChars } = useActorData();
  const classes = useDbNames('classes');
  const { names: skills, iconIndices: skillIcons } = useDbNamesWithIcons('skills');
  const { names: weapons, iconIndices: weaponIcons } = useDbNamesWithIcons('weapons');
  const { names: armors, iconIndices: armorIcons } = useDbNamesWithIcons('armors');
  const { names: states, iconIndices: stateIcons } = useDbNamesWithIcons('states');

  const [showPicker, setShowPicker] = React.useState<string | null>(null);

  const isActive = condType === 4;

  const getParamList = (): string[] => {
    switch (actorSubType) {
      case 2: return classes;
      case 3: return skills;
      case 4: return weapons;
      case 5: return armors;
      case 6: return states;
      default: return [];
    }
  };
  const getParamIcons = (): (number | undefined)[] | undefined => {
    switch (actorSubType) {
      case 3: return skillIcons;
      case 4: return weaponIcons;
      case 5: return armorIcons;
      case 6: return stateIcons;
      default: return undefined;
    }
  };
  const getParamTitle = (): string => {
    switch (actorSubType) {
      case 2: return '직업 선택';
      case 3: return '스킬 선택';
      case 4: return '무기 선택';
      case 5: return '방어구 선택';
      case 6: return '스테이트 선택';
      default: return '선택';
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={rowStyle}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type2" checked={isActive} onChange={() => onCondTypeChange(4)} />
            액터
          </label>
          <input type="text" readOnly value={getLabel(actorId, actors)}
            style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(isActive) }}
            onClick={() => isActive && setShowPicker('actor')} />
          <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(isActive) }}
            disabled={!isActive} onClick={() => setShowPicker('actor')}>...</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 20 }}>
          {ACTOR_SUB_TYPES.map(([val, label]) => (
            <div key={val} style={rowStyle}>
              <label style={{ ...radioStyle, ...disabledOpacity(isActive) }}>
                <input type="radio" name="cb-actor-sub" checked={actorSubType === val}
                  onChange={() => { setActorSubType(val); if (val === 0) setActorParam(0); }}
                  disabled={!isActive} />
                {label}
              </label>
              {val === 1 && actorSubType === 1 && (
                <input type="text" value={actorParam as string}
                  onChange={e => setActorParam(e.target.value)}
                  disabled={!isActive}
                  style={{ ...selectStyle, flex: 1, ...disabledOpacity(isActive) }} />
              )}
              {val >= 2 && actorSubType === val && (
                <>
                  <input type="text" readOnly value={getLabel(actorParam as number, getParamList())}
                    style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(isActive) }}
                    onClick={() => isActive && setShowPicker('actor-param')} />
                  <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(isActive) }}
                    disabled={!isActive} onClick={() => setShowPicker('actor-param')}>...</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {showPicker === 'actor' && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(null)} title="액터 선택" characterData={actorChars} />
      )}
      {showPicker === 'actor-param' && (
        <DataListPicker items={getParamList()} value={actorParam as number}
          onChange={v => setActorParam(v)}
          onClose={() => setShowPicker(null)} title={getParamTitle()} iconIndices={getParamIcons()} />
      )}
    </>
  );
}
