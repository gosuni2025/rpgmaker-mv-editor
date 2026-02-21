import React, { useState, useEffect } from 'react';
import ImagePicker from '../common/ImagePicker';
import { useActorFullData, ActorDirectPicker, fieldsetStyle, legendStyle, type EditorProps } from './actorEditorsCommon';

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
