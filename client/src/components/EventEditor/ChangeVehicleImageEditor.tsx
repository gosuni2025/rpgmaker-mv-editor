import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import ImagePicker from '../common/ImagePicker';
import useEditorStore from '../../store/useEditorStore';
import { fieldsetStyle, legendStyle, type EditorProps } from './actorEditorsCommon';

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
