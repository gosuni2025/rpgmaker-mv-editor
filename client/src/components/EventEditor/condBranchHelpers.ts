import { useState, useEffect } from 'react';
import type React from 'react';
import apiClient from '../../api/client';
import type { CharacterInfo } from './dataListPicker';

interface NamedItem { id: number; name: string; iconIndex?: number; characterName?: string; characterIndex?: number }

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

export const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
export const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd' };
export const disabledOpacity = (active: boolean) => ({ opacity: active ? 1 : 0.5 });

export const COMPARISON_OPS: [number, string][] = [[0, '='], [1, '≥'], [2, '≤'], [3, '>'], [4, '<'], [5, '≠']];

export function getTabForType(t: number): number {
  if (t <= 3) return 0;
  if (t === 4) return 1;
  if (t === 5 || t === 6 || t === 13) return 2;
  return 3;
}

export function getLabel(id: number, list: string[]) {
  const name = list[id] || '';
  return `${String(id).padStart(4, '0')}${name ? ': ' + name : ''}`;
}
