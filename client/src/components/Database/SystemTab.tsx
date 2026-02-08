import React from 'react';
import type { SystemData, AudioFile, Vehicle } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';
import ImagePicker from '../common/ImagePicker';

interface SystemTabProps {
  data: SystemData | undefined;
  onChange: (data: SystemData) => void;
}

const DEFAULT_AUDIO: AudioFile = { name: '', pan: 0, pitch: 100, volume: 90 };

const SOUND_NAMES = [
  'Cursor', 'OK', 'Cancel', 'Buzzer', 'Equip', 'Save', 'Load', 'Battle Start',
  'Escape', 'Enemy Attack', 'Enemy Damage', 'Enemy Collapse', 'Boss Collapse 1',
  'Boss Collapse 2', 'Actor Damage', 'Actor Collapse', 'Recovery', 'Miss',
  'Evasion', 'Magic Evasion', 'Magic Reflect', 'Shop', 'Use Item',
];

export default function SystemTab({ data, onChange }: SystemTabProps) {
  if (!data) return null;

  const handleChange = (field: keyof SystemData, value: unknown) => {
    onChange({ ...data, [field]: value });
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

  const tone = data.windowTone || [0, 0, 0, 0];
  const toneLabels = ['R', 'G', 'B', 'Gray'];

  return (
    <div className="db-form db-system-form" style={{ maxWidth: 600 }}>
      <label>
        Game Title
        <input type="text" value={data.gameTitle || ''} onChange={(e) => handleChange('gameTitle', e.target.value)} />
      </label>
      <label>
        Currency Unit
        <input type="text" value={data.currencyUnit || ''} onChange={(e) => handleChange('currencyUnit', e.target.value)} />
      </label>
      <label>
        Locale
        <input type="text" value={data.locale || ''} onChange={(e) => handleChange('locale', e.target.value)} />
      </label>

      <div className="db-form-section">Starting Position</div>
      <div className="db-form-row">
        <label>
          Map ID
          <input type="number" value={data.startMapId || 0} onChange={(e) => handleChange('startMapId', Number(e.target.value))} />
        </label>
        <label>
          X
          <input type="number" value={data.startX || 0} onChange={(e) => handleChange('startX', Number(e.target.value))} />
        </label>
        <label>
          Y
          <input type="number" value={data.startY || 0} onChange={(e) => handleChange('startY', Number(e.target.value))} />
        </label>
      </div>

      <div className="db-form-section">Options</div>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optDrawTitle ?? true} onChange={(e) => handleChange('optDrawTitle', e.target.checked)} />
        Draw Title
      </label>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optDisplayTp ?? true} onChange={(e) => handleChange('optDisplayTp', e.target.checked)} />
        Display TP
      </label>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optExtraExp ?? false} onChange={(e) => handleChange('optExtraExp', e.target.checked)} />
        EXP for Reserve Members
      </label>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optFloorDeath ?? false} onChange={(e) => handleChange('optFloorDeath', e.target.checked)} />
        Knockout by Floor Damage
      </label>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optFollowers ?? true} onChange={(e) => handleChange('optFollowers', e.target.checked)} />
        Show Player Followers
      </label>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optSideView ?? false} onChange={(e) => handleChange('optSideView', e.target.checked)} />
        Use Side-view Battle
      </label>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optSlipDeath ?? false} onChange={(e) => handleChange('optSlipDeath', e.target.checked)} />
        Knockout by Slip Damage
      </label>
      <label className="db-checkbox-label">
        <input type="checkbox" checked={data.optTransparent ?? false} onChange={(e) => handleChange('optTransparent', e.target.checked)} />
        Transparent on Map
      </label>

      <div className="db-form-section">Window Tone</div>
      {tone.map((val: number, i: number) => (
        <label key={i}>
          {toneLabels[i]}
          <div className="db-slider-row">
            <input type="range" min={i < 3 ? -255 : 0} max={255} value={val} onChange={(e) => handleToneChange(i, e.target.value)} />
            <span className="db-slider-value">{val}</span>
          </div>
        </label>
      ))}

      <div className="db-form-section">
        Party Members
        <button className="db-btn-small" onClick={addPartyMember}>+</button>
      </div>
      {(data.partyMembers || []).map((memberId: number, i: number) => (
        <label key={i}>
          Member {i + 1}
          <div className="db-party-row">
            <input type="number" value={memberId} onChange={(e) => handlePartyChange(i, e.target.value)} />
            <button className="db-btn-small" onClick={() => removePartyMember(i)}>-</button>
          </div>
        </label>
      ))}

      <div className="db-form-section">Music</div>
      <label>
        Title BGM
        <AudioPicker type="bgm" value={data.titleBgm || DEFAULT_AUDIO} onChange={(a) => handleChange('titleBgm', a)} />
      </label>
      <label>
        Battle BGM
        <AudioPicker type="bgm" value={data.battleBgm || DEFAULT_AUDIO} onChange={(a) => handleChange('battleBgm', a)} />
      </label>
      <label>
        Victory ME
        <AudioPicker type="me" value={data.victoryMe || DEFAULT_AUDIO} onChange={(a) => handleChange('victoryMe', a)} />
      </label>
      <label>
        Defeat ME
        <AudioPicker type="me" value={data.defeatMe || DEFAULT_AUDIO} onChange={(a) => handleChange('defeatMe', a)} />
      </label>
      <label>
        Game Over ME
        <AudioPicker type="me" value={data.gameoverMe || DEFAULT_AUDIO} onChange={(a) => handleChange('gameoverMe', a)} />
      </label>

      <div className="db-form-section">Sound Effects</div>
      {SOUND_NAMES.map((name, i) => (
        <label key={i}>
          {name}
          <AudioPicker type="se" value={(data.sounds || [])[i] || DEFAULT_AUDIO} onChange={(a) => handleSoundChange(i, a)} />
        </label>
      ))}

      <div className="db-form-section">Title Screen</div>
      <label>
        Title 1 Image
        <ImagePicker type="titles1" value={data.title1Name || ''} onChange={(name) => handleChange('title1Name', name)} />
      </label>
      <label>
        Title 2 Image
        <ImagePicker type="titles2" value={data.title2Name || ''} onChange={(name) => handleChange('title2Name', name)} />
      </label>

      <div className="db-form-section">Battle Background</div>
      <label>
        Battleback 1
        <ImagePicker type="battlebacks1" value={data.battleback1Name || ''} onChange={(name) => handleChange('battleback1Name', name)} />
      </label>
      <label>
        Battleback 2
        <ImagePicker type="battlebacks2" value={data.battleback2Name || ''} onChange={(name) => handleChange('battleback2Name', name)} />
      </label>

      {(['boat', 'ship', 'airship'] as const).map((vehicleKey) => {
        const vehicle: Vehicle = (data as unknown as Record<string, Vehicle>)[vehicleKey] || { bgm: { ...DEFAULT_AUDIO }, characterIndex: 0, characterName: '', startMapId: 0, startX: 0, startY: 0 };
        const updateVehicle = (field: keyof Vehicle, value: unknown) => {
          handleChange(vehicleKey as keyof SystemData, { ...vehicle, [field]: value });
        };
        return (
          <div key={vehicleKey}>
            <div className="db-form-section">{vehicleKey.charAt(0).toUpperCase() + vehicleKey.slice(1)}</div>
            <label>
              Character
              <ImagePicker
                type="characters"
                value={vehicle.characterName || ''}
                onChange={(name) => updateVehicle('characterName', name)}
                index={vehicle.characterIndex ?? 0}
                onIndexChange={(idx) => updateVehicle('characterIndex', idx)}
              />
            </label>
            <label>
              BGM
              <AudioPicker type="bgm" value={vehicle.bgm || DEFAULT_AUDIO} onChange={(a) => updateVehicle('bgm', a)} />
            </label>
            <div className="db-form-row">
              <label>Start Map <input type="number" value={vehicle.startMapId || 0} onChange={(e) => updateVehicle('startMapId', Number(e.target.value))} /></label>
              <label>X <input type="number" value={vehicle.startX || 0} onChange={(e) => updateVehicle('startX', Number(e.target.value))} /></label>
              <label>Y <input type="number" value={vehicle.startY || 0} onChange={(e) => updateVehicle('startY', Number(e.target.value))} /></label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
