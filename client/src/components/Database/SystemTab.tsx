import React, { useState, useEffect } from 'react';
import type { SystemData, AudioFile, Vehicle, AttackMotion } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';
import ImagePicker from '../common/ImagePicker';
import apiClient from '../../api/client';

interface SystemTabProps {
  data: SystemData | undefined;
  onChange: (data: SystemData) => void;
}

interface RefItem { id: number; name: string }

const DEFAULT_AUDIO: AudioFile = { name: '', pan: 0, pitch: 100, volume: 90 };

const SOUND_NAMES = [
  '커서', '확인', '취소', '부저', '장착', '저장', '불러오기', '전투 시작',
  '도망', '적 공격', '적 피해', '적 기절', '보스 기절 1',
  '보스 기절 2', '아군 피해', '아군 기절', '회복', '빗맞음',
  '회피', '마법 회피', '마법 반사', '상점', '아이템 사용', '스킬 사용',
];

const MENU_COMMAND_NAMES = ['아이템', '스킬', '장비', '상태', '대열', '세이브'];

const MOTION_TYPES = ['찌르기', '휘두르기', '날리기'];

const VEHICLE_LABELS: Record<string, string> = { boat: '보트', ship: '배', airship: '비행선' };

export default function SystemTab({ data, onChange }: SystemTabProps) {
  const [actorsList, setActorsList] = useState<RefItem[]>([]);

  useEffect(() => {
    apiClient.get<(RefItem | null)[]>('/database/actors').then(d => setActorsList(d.filter(Boolean) as RefItem[])).catch(() => {});
  }, []);

  if (!data) return null;

  const handleChange = (field: keyof SystemData, value: unknown) => {
    onChange({ ...data, [field]: value });
  };

  const getVehicle = (key: 'boat' | 'ship' | 'airship'): Vehicle =>
    (data as unknown as Record<string, Vehicle>)[key] || { bgm: { ...DEFAULT_AUDIO }, characterIndex: 0, characterName: '', startMapId: 0, startX: 0, startY: 0 };

  const updateVehicle = (key: 'boat' | 'ship' | 'airship', field: keyof Vehicle, value: unknown) => {
    handleChange(key as keyof SystemData, { ...getVehicle(key), [field]: value });
  };

  const handleToneChange = (index: number, value: string) => {
    const tone = [...(data.windowTone || [0, 0, 0, 0])] as [number, number, number, number];
    tone[index] = Number(value);
    handleChange('windowTone', tone);
  };

  const handlePartyChange = (index: number, value: string) => {
    const members = [...(data.partyMembers || [])];
    members[index] = Number(value);
    handleChange('partyMembers', members);
  };

  const addPartyMember = () => {
    handleChange('partyMembers', [...(data.partyMembers || []), 1]);
  };

  const removePartyMember = (index: number) => {
    handleChange('partyMembers', (data.partyMembers || []).filter((_: number, i: number) => i !== index));
  };

  const handleSoundChange = (index: number, audio: AudioFile) => {
    const sounds = [...(data.sounds || [])];
    while (sounds.length <= index) sounds.push({ ...DEFAULT_AUDIO });
    sounds[index] = audio;
    handleChange('sounds', sounds);
  };

  const handleMenuCommandChange = (index: number, checked: boolean) => {
    const cmds = [...(data.menuCommands || [true, true, true, true, true, true])];
    cmds[index] = checked;
    handleChange('menuCommands', cmds);
  };

  const handleAttackMotionChange = (index: number, field: keyof AttackMotion, value: number) => {
    const motions = [...(data.attackMotions || [])];
    while (motions.length <= index) motions.push({ type: 0, weaponImageId: 0 });
    motions[index] = { ...motions[index], [field]: value };
    handleChange('attackMotions', motions);
  };

  const handleMagicSkillToggle = (skillTypeId: number, checked: boolean) => {
    const skills = [...(data.magicSkills || [])];
    if (checked && !skills.includes(skillTypeId)) {
      skills.push(skillTypeId);
      skills.sort((a, b) => a - b);
    } else if (!checked) {
      const idx = skills.indexOf(skillTypeId);
      if (idx >= 0) skills.splice(idx, 1);
    }
    handleChange('magicSkills', skills);
  };

  const tone = data.windowTone || [0, 0, 0, 0];
  const toneLabels = ['R', 'G', 'B', 'Gray'];

  return (
    <div className="db-system-grid">
      {/* ===== 좌측 컬럼 ===== */}
      <div className="db-system-column">
        {/* 초기 파티 */}
        <div className="db-system-section">
          초기 파티
          <button className="db-btn-small" onClick={addPartyMember}>+</button>
        </div>
        {(data.partyMembers || []).map((memberId: number, i: number) => (
          <div key={i} className="db-party-row">
            <select value={memberId} onChange={(e) => handlePartyChange(i, e.target.value)}>
              <option value={0}>(없음)</option>
              {actorsList.map(a => <option key={a.id} value={a.id}>{String(a.id).padStart(4, '0')}: {a.name}</option>)}
            </select>
            <button className="db-btn-small" onClick={() => removePartyMember(i)}>-</button>
          </div>
        ))}

        {/* 게임 타이틀 */}
        <div className="db-system-section">게임 타이틀</div>
        <label>
          <input type="text" value={data.gameTitle || ''} onChange={(e) => handleChange('gameTitle', e.target.value)} />
        </label>

        {/* 화폐 단위 */}
        <div className="db-system-section">화폐 단위</div>
        <label>
          <input type="text" value={data.currencyUnit || ''} onChange={(e) => handleChange('currencyUnit', e.target.value)} />
        </label>

        {/* 로케일 */}
        <div className="db-system-section">로케일</div>
        <label>
          <input type="text" value={data.locale || ''} onChange={(e) => handleChange('locale', e.target.value)} />
        </label>

        {/* 탈것 이미지 */}
        <div className="db-system-section">탈것 이미지</div>
        {(['boat', 'ship', 'airship'] as const).map((key) => {
          const v = getVehicle(key);
          return (
            <div key={key} className="db-system-vehicle-row">
              <span>{VEHICLE_LABELS[key]}</span>
              <div>
                <ImagePicker
                  type="characters"
                  value={v.characterName || ''}
                  onChange={(name) => updateVehicle(key, 'characterName', name)}
                  index={v.characterIndex ?? 0}
                  onIndexChange={(idx) => updateVehicle(key, 'characterIndex', idx)}
                />
              </div>
            </div>
          );
        })}

        {/* 시작 위치 */}
        <div className="db-system-section">시작 위치</div>
        <label style={{ color: '#bbb', fontSize: 11 }}>플레이어</label>
        <div className="db-system-row">
          <label>맵 <input type="number" value={data.startMapId || 0} onChange={(e) => handleChange('startMapId', Number(e.target.value))} /></label>
          <label>X <input type="number" value={data.startX || 0} onChange={(e) => handleChange('startX', Number(e.target.value))} /></label>
          <label>Y <input type="number" value={data.startY || 0} onChange={(e) => handleChange('startY', Number(e.target.value))} /></label>
        </div>
        {(['boat', 'ship', 'airship'] as const).map((key) => {
          const v = getVehicle(key);
          return (
            <React.Fragment key={key}>
              <label style={{ color: '#bbb', fontSize: 11 }}>{VEHICLE_LABELS[key]}</label>
              <div className="db-system-row">
                <label>맵 <input type="number" value={v.startMapId || 0} onChange={(e) => updateVehicle(key, 'startMapId', Number(e.target.value))} /></label>
                <label>X <input type="number" value={v.startX || 0} onChange={(e) => updateVehicle(key, 'startX', Number(e.target.value))} /></label>
                <label>Y <input type="number" value={v.startY || 0} onChange={(e) => updateVehicle(key, 'startY', Number(e.target.value))} /></label>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ===== 중앙 컬럼 ===== */}
      <div className="db-system-column">
        {/* 타이틀 화면 */}
        <div className="db-system-section">타이틀 화면</div>
        <div className="db-system-field-label">
          <span>타이틀 1</span>
          <ImagePicker type="titles1" value={data.title1Name || ''} onChange={(name) => handleChange('title1Name', name)} />
        </div>
        <div className="db-system-field-label">
          <span>타이틀 2</span>
          <ImagePicker type="titles2" value={data.title2Name || ''} onChange={(name) => handleChange('title2Name', name)} />
        </div>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optDrawTitle ?? true} onChange={(e) => handleChange('optDrawTitle', e.target.checked)} />
          게임 타이틀 표시
        </label>

        {/* 음악 */}
        <div className="db-system-section">음악</div>
        <div className="db-system-audio-row">
          <span>타이틀</span>
          <div><AudioPicker type="bgm" value={data.titleBgm || DEFAULT_AUDIO} onChange={(a) => handleChange('titleBgm', a)} /></div>
        </div>
        <div className="db-system-audio-row">
          <span>전투</span>
          <div><AudioPicker type="bgm" value={data.battleBgm || DEFAULT_AUDIO} onChange={(a) => handleChange('battleBgm', a)} /></div>
        </div>
        <div className="db-system-audio-row">
          <span>승리</span>
          <div><AudioPicker type="me" value={data.victoryMe || DEFAULT_AUDIO} onChange={(a) => handleChange('victoryMe', a)} /></div>
        </div>
        <div className="db-system-audio-row">
          <span>패배</span>
          <div><AudioPicker type="me" value={data.defeatMe || DEFAULT_AUDIO} onChange={(a) => handleChange('defeatMe', a)} /></div>
        </div>
        <div className="db-system-audio-row">
          <span>게임오버</span>
          <div><AudioPicker type="me" value={data.gameoverMe || DEFAULT_AUDIO} onChange={(a) => handleChange('gameoverMe', a)} /></div>
        </div>
        {(['boat', 'ship', 'airship'] as const).map((key) => (
          <div key={key} className="db-system-audio-row">
            <span>{VEHICLE_LABELS[key]}</span>
            <div><AudioPicker type="bgm" value={getVehicle(key).bgm || DEFAULT_AUDIO} onChange={(a) => updateVehicle(key, 'bgm', a)} /></div>
          </div>
        ))}

        {/* 메뉴 명령 */}
        <div className="db-system-section">메뉴 명령</div>
        {MENU_COMMAND_NAMES.map((name, i) => (
          <label key={i} className="db-system-checkbox">
            <input type="checkbox" checked={data.menuCommands?.[i] ?? true} onChange={(e) => handleMenuCommandChange(i, e.target.checked)} />
            {name}
          </label>
        ))}

        {/* [SV] 공격 모션 */}
        <div className="db-system-section">[SV] 공격 모션</div>
        <div className="db-system-motions-list">
          {(data.weaponTypes || []).map((wName, i) => {
            if (i === 0) return null;
            const motion = (data.attackMotions || [])[i] || { type: 0, weaponImageId: 0 };
            return (
              <div key={i} className="db-system-motion-row">
                <span>{String(i).padStart(2, '0')}: {wName}</span>
                <select value={motion.type} onChange={(e) => handleAttackMotionChange(i, 'type', Number(e.target.value))}>
                  {MOTION_TYPES.map((m, mi) => <option key={mi} value={mi}>{m}</option>)}
                </select>
                <input type="number" min={0} value={motion.weaponImageId} onChange={(e) => handleAttackMotionChange(i, 'weaponImageId', Number(e.target.value))} />
              </div>
            );
          })}
        </div>

        {/* [SV] 마법 스킬 */}
        <div className="db-system-section">[SV] 마법 스킬</div>
        {(data.skillTypes || []).map((sName, i) => {
          if (i === 0 || !sName) return null;
          return (
            <label key={i} className="db-system-checkbox">
              <input type="checkbox" checked={(data.magicSkills || []).includes(i)} onChange={(e) => handleMagicSkillToggle(i, e.target.checked)} />
              {String(i).padStart(2, '0')}: {sName}
            </label>
          );
        })}
      </div>

      {/* ===== 우측 컬럼 ===== */}
      <div className="db-system-column">
        {/* 옵션 */}
        <div className="db-system-section">옵션</div>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optSideView ?? false} onChange={(e) => handleChange('optSideView', e.target.checked)} />
          사이드뷰 전투 사용
        </label>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optTransparent ?? false} onChange={(e) => handleChange('optTransparent', e.target.checked)} />
          투명 상태로 시작
        </label>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optFollowers ?? true} onChange={(e) => handleChange('optFollowers', e.target.checked)} />
          파티원 따라다니기
        </label>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optSlipDeath ?? false} onChange={(e) => handleChange('optSlipDeath', e.target.checked)} />
          슬립 데미지로 기절
        </label>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optFloorDeath ?? false} onChange={(e) => handleChange('optFloorDeath', e.target.checked)} />
          바닥 데미지로 기절
        </label>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optDisplayTp ?? true} onChange={(e) => handleChange('optDisplayTp', e.target.checked)} />
          전투 중 TP 표시
        </label>
        <label className="db-system-checkbox">
          <input type="checkbox" checked={data.optExtraExp ?? false} onChange={(e) => handleChange('optExtraExp', e.target.checked)} />
          예비 멤버 경험치
        </label>

        {/* 효과음 */}
        <div className="db-system-section">효과음</div>
        {SOUND_NAMES.map((name, i) => (
          <div key={i} className="db-system-audio-row">
            <span>{name}</span>
            <div><AudioPicker type="se" value={(data.sounds || [])[i] || DEFAULT_AUDIO} onChange={(a) => handleSoundChange(i, a)} /></div>
          </div>
        ))}

        {/* 윈도우 색상 */}
        <div className="db-system-section">윈도우 색상</div>
        {tone.map((val: number, i: number) => (
          <label key={i}>
            {toneLabels[i]}
            <div className="db-slider-row">
              <input type="range" min={i < 3 ? -255 : 0} max={255} value={val} onChange={(e) => handleToneChange(i, e.target.value)} />
              <span className="db-slider-value">{val}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
