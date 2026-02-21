import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';

interface RefItem { id: number; name: string; iconIndex?: number }

export function useEnemyRefData() {
  const [skills, setSkills] = useState<RefItem[]>([]);
  const [items, setItems] = useState<RefItem[]>([]);
  const [weapons, setWeapons] = useState<RefItem[]>([]);
  const [armors, setArmors] = useState<RefItem[]>([]);

  useEffect(() => {
    apiClient.get<({ id: number; name: string; iconIndex?: number } | null)[]>('/database/skills').then(d => {
      setSkills(d.filter(Boolean).map(s => ({ id: s!.id, name: s!.name, iconIndex: s!.iconIndex })) as RefItem[]);
    }).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/items').then(d => setItems(d.filter(Boolean) as RefItem[])).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/weapons').then(d => setWeapons(d.filter(Boolean) as RefItem[])).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/armors').then(d => setArmors(d.filter(Boolean) as RefItem[])).catch(() => {});
  }, []);

  const skillNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of skills) arr[s.id] = s.name;
    return arr;
  }, [skills]);

  const skillIcons = useMemo(() => {
    const arr: (number | undefined)[] = [];
    for (const s of skills) arr[s.id] = s.iconIndex;
    return arr;
  }, [skills]);

  const itemNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of items) arr[s.id] = s.name;
    return arr;
  }, [items]);

  const weaponNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of weapons) arr[s.id] = s.name;
    return arr;
  }, [weapons]);

  const armorNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of armors) arr[s.id] = s.name;
    return arr;
  }, [armors]);

  return { skills, items, weapons, armors, skillNames, skillIcons, itemNames, weaponNames, armorNames };
}
