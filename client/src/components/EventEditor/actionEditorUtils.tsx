import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { IconSprite, CharacterSprite, type CharacterInfo } from './controlEditors';
import type { AudioFile } from '../../types/rpgMakerMV';

export type { CharacterInfo };

export interface NamedItem { id: number; name: string; iconIndex?: number; characterName?: string; characterIndex?: number }

export function useDbNames(endpoint: string): string[] {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    apiClient.get<(NamedItem | null)[]>(`/database/${endpoint}`).then(data => {
      const arr: string[] = [];
      for (const item of data) {
        if (item) arr[item.id] = item.name || '';
      }
      setItems(arr);
    }).catch(() => {});
  }, [endpoint]);
  return items;
}

/** 이름과 아이콘 인덱스를 함께 가져오는 훅 */
export function useDbNamesWithIcons(endpoint: string): { names: string[]; iconIndices: (number | undefined)[] } {
  const [names, setNames] = useState<string[]>([]);
  const [iconIndices, setIconIndices] = useState<(number | undefined)[]>([]);
  useEffect(() => {
    apiClient.get<(NamedItem | null)[]>(`/database/${endpoint}`).then(data => {
      const nameArr: string[] = [];
      const iconArr: (number | undefined)[] = [];
      for (const item of data) {
        if (item) {
          nameArr[item.id] = item.name || '';
          iconArr[item.id] = item.iconIndex;
        }
      }
      setNames(nameArr);
      setIconIndices(iconArr);
    }).catch(() => {});
  }, [endpoint]);
  return { names, iconIndices };
}

/** 액터 이름과 캐릭터 정보를 함께 가져오는 훅 */
export function useActorData(): { names: string[]; characterData: (CharacterInfo | undefined)[] } {
  const [names, setNames] = useState<string[]>([]);
  const [characterData, setCharacterData] = useState<(CharacterInfo | undefined)[]>([]);
  useEffect(() => {
    apiClient.get<(NamedItem | null)[]>('/database/actors').then(data => {
      const nameArr: string[] = [];
      const charArr: (CharacterInfo | undefined)[] = [];
      for (const item of data) {
        if (item) {
          nameArr[item.id] = item.name || '';
          if (item.characterName) {
            charArr[item.id] = { characterName: item.characterName, characterIndex: item.characterIndex ?? 0 };
          }
        }
      }
      setNames(nameArr);
      setCharacterData(charArr);
    }).catch(() => {});
  }, []);
  return { names, characterData };
}

export const DEFAULT_AUDIO: AudioFile = { name: '', pan: 0, pitch: 100, volume: 90 };

export function getLabel(id: number, list: string[]) {
  const name = list[id] || '';
  return `${String(id).padStart(4, '0')} ${name}`;
}

/** 인덱스 0부터 시작하는 DataListPicker (전체 파티 등 0번 항목 포함) */
export function DataListPickerWithZero({ items, value, onChange, onClose, title, iconIndices, characterData }: {
  items: string[]; value: number; onChange: (id: number) => void; onClose: () => void; title?: string;
  iconIndices?: (number | undefined)[];
  characterData?: (CharacterInfo | undefined)[];
}) {
  const GROUP_SIZE = 20;
  const totalCount = items.length;
  const groups = useMemo(() => {
    const result: { label: string; startId: number; endId: number }[] = [];
    for (let start = 0; start < totalCount; start += GROUP_SIZE) {
      const end = Math.min(start + GROUP_SIZE - 1, totalCount - 1);
      result.push({
        label: `[ ${String(start).padStart(4, '0')} - ${String(end).padStart(4, '0')} ]`,
        startId: start,
        endId: end,
      });
    }
    return result;
  }, [totalCount]);

  const initGroupIdx = Math.max(0, Math.floor(value / GROUP_SIZE));
  const [selectedGroup, setSelectedGroup] = useState(initGroupIdx);
  const [selected, setSelected] = useState(value);

  const currentGroup = groups[selectedGroup];
  const groupItems = useMemo(() => {
    if (!currentGroup) return [];
    const result: { id: number; label: string }[] = [];
    for (let i = currentGroup.startId; i <= currentGroup.endId; i++) {
      result.push({ id: i, label: `${String(i).padStart(4, '0')} ${items[i] || ''}` });
    }
    return result;
  }, [currentGroup, items]);

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 500, maxHeight: '70vh' }}>
        <div className="image-picker-header">{title || '대상 선택'}</div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 300 }}>
          <div style={{ width: 170, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {groups.map((g, idx) => (
              <div key={g.startId} style={{
                padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ccc',
                background: idx === selectedGroup ? '#2675bf' : 'transparent',
              }} onClick={() => setSelectedGroup(idx)}>{g.label}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {groupItems.map(item => {
              const iconIdx = iconIndices?.[item.id];
              const charInfo = characterData?.[item.id];
              return (
                <div key={item.id} style={{
                  padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#ddd',
                  background: item.id === selected ? '#2675bf' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 4,
                }} onClick={() => setSelected(item.id)} onDoubleClick={() => { onChange(item.id); onClose(); }}>
                  {iconIdx != null && iconIdx > 0 && <IconSprite iconIndex={iconIdx} />}
                  {charInfo?.characterName && <CharacterSprite {...charInfo} />}
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => { onChange(selected); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
