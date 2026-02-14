import React, { useState, useMemo } from 'react';
import type { AudioFile } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';
import MoviePicker from '../common/MoviePicker';
import { selectStyle } from './messageEditors';
import { DataListPicker } from './dataListPicker';
import useEditorStore from '../../store/useEditorStore';
import { useDbNames, DEFAULT_AUDIO } from './actionEditorUtils';

export function AudioEditor({ p, onOk, onCancel, type }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; type: 'bgm' | 'bgs' | 'me' | 'se' }) {
  const audioParam = (p[0] as AudioFile) || { ...DEFAULT_AUDIO };
  const [audio, setAudio] = useState<AudioFile>(audioParam);
  return (
    <>
      <AudioPicker type={type} value={audio} onChange={setAudio} inline />
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([audio])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function MovieEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [name, setName] = useState<string>((p[0] as string) || '');
  return (
    <>
      <MoviePicker value={name} onChange={setName} inline />
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([name])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function FadeoutEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [duration, setDuration] = useState<number>((p[0] as number) || 10);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>지속 시간</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={duration} min={1} max={999}
            onChange={e => setDuration(Number(e.target.value))}
            style={{ ...selectStyle, width: 80 }} />
          <span style={{ fontSize: 13, color: '#ddd' }}>초</span>
        </div>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([duration])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function ToggleEditor({ p, onOk, onCancel, legend }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; legend: string }) {
  const [value, setValue] = useState<number>((p[0] as number) ?? 0);
  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>{legend}</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="toggle" checked={value === 0} onChange={() => setValue(0)} />
            ON
          </label>
          <label style={radioStyle}>
            <input type="radio" name="toggle" checked={value === 1} onChange={() => setValue(1)} />
            OFF
          </label>
        </div>
      </fieldset>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function ChangeTransparencyEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="투명 상태" />;
}

export function ChangeSaveAccessEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="저장" />;
}

export function ChangeMenuAccessEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="메뉴" />;
}

export function ChangeEncounterEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="조우" />;
}

export function ChangeFormationAccessEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="대열로 보행" />;
}

export function ChangePlayerFollowersEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ToggleEditor p={p} onOk={onOk} onCancel={onCancel} legend="대열로 보행" />;
}

export function ShowAnimationEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [characterId, setCharacterId] = useState<number>((p[0] as number) ?? -1);
  const [animationId, setAnimationId] = useState<number>((p[1] as number) || 1);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[2] as boolean) || false);
  const [showAnimPicker, setShowAnimPicker] = useState(false);

  const animNames = useDbNames('animations');
  const currentMap = useEditorStore(s => s.currentMap);

  const eventList = useMemo(() => {
    const list: { id: number; name: string }[] = [
      { id: -1, name: '플레이어' },
      { id: 0, name: '해당 이벤트' },
    ];
    if (currentMap?.events) {
      for (const ev of currentMap.events) {
        if (ev && ev.id > 0) {
          list.push({ id: ev.id, name: `EV${String(ev.id).padStart(3, '0')}` });
        }
      }
    }
    return list;
  }, [currentMap]);

  const animLabel = animationId > 0 && animNames[animationId]
    ? `${String(animationId).padStart(4, '0')} ${animNames[animationId]}`
    : `${String(animationId).padStart(4, '0')}`;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>캐릭터:</span>
        <select value={characterId} onChange={e => setCharacterId(Number(e.target.value))} style={selectStyle}>
          {eventList.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>애니메이션:</span>
        <button className="db-btn" onClick={() => setShowAnimPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{animLabel}</button>
      </div>
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
        완료까지 대기
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([characterId, animationId, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showAnimPicker && (
        <DataListPicker items={animNames} value={animationId} onChange={setAnimationId}
          onClose={() => setShowAnimPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

const BALLOON_ICONS = [
  { value: 1, label: '느낌표' },
  { value: 2, label: '물음표' },
  { value: 3, label: '음표' },
  { value: 4, label: '하트' },
  { value: 5, label: '분노' },
  { value: 6, label: '땀' },
  { value: 7, label: '뒤죽박죽' },
  { value: 8, label: '침묵' },
  { value: 9, label: '전구' },
  { value: 10, label: 'Zzz' },
  { value: 11, label: '사용자 정의 1' },
  { value: 12, label: '사용자 정의 2' },
  { value: 13, label: '사용자 정의 3' },
  { value: 14, label: '사용자 정의 4' },
  { value: 15, label: '사용자 정의 5' },
];

/**
 * 말풍선 아이콘 표시 에디터 (코드 213)
 * params: [characterId, balloonId, waitForCompletion]
 * characterId: -1=플레이어, 0=해당 이벤트, >0=이벤트 ID
 * balloonId: 1~15
 * waitForCompletion: boolean
 */
export function ShowBalloonIconEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [characterId, setCharacterId] = useState<number>((p[0] as number) ?? -1);
  const [balloonId, setBalloonId] = useState<number>((p[1] as number) || 1);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[2] as boolean) ?? false);

  const currentMap = useEditorStore(s => s.currentMap);

  const eventList = useMemo(() => {
    const list: { id: number; name: string }[] = [
      { id: -1, name: '플레이어' },
      { id: 0, name: '해당 이벤트' },
    ];
    if (currentMap?.events) {
      for (const ev of currentMap.events) {
        if (ev && ev.id > 0) {
          list.push({ id: ev.id, name: `EV${String(ev.id).padStart(3, '0')}` });
        }
      }
    }
    return list;
  }, [currentMap]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>캐릭터:</span>
        <select value={characterId} onChange={e => setCharacterId(Number(e.target.value))} style={selectStyle}>
          {eventList.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>말풍선 아이콘:</span>
        <select value={balloonId} onChange={e => setBalloonId(Number(e.target.value))} style={selectStyle}>
          {BALLOON_ICONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
        완료까지 대기
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([characterId, balloonId, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
