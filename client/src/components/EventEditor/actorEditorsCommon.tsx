import React, { useState, useEffect } from 'react';
import { DataListPicker } from './dataListPicker';
import { getLabel, type CharacterInfo } from './actionEditorUtils';
import apiClient from '../../api/client';

export const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
export const fieldsetStyle: React.CSSProperties = { border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 };
export const legendStyle: React.CSSProperties = { fontSize: 12, color: '#aaa', padding: '0 4px' };

export type EditorProps = { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void };

export interface ActorImageInfo {
  faceName: string;
  faceIndex: number;
  characterName: string;
  characterIndex: number;
  battlerName: string;
}

export function useActorFullData(): { names: string[]; characterData: (CharacterInfo | undefined)[]; imageData: (ActorImageInfo | undefined)[] } {
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

/** 단순 액터 선택 (라벨 + 버튼 + 피커 다이얼로그) */
export function ActorDirectPicker({ actorId, onChange, actorNames, actorChars, title }: {
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
