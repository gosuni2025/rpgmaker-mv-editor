import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import type { RefItem } from './dbConstants';

export function useDbRef(endpoint: string): RefItem[] {
  const [items, setItems] = useState<RefItem[]>([]);
  useEffect(() => {
    apiClient.get<(RefItem | null)[]>(endpoint)
      .then(d => setItems(d.filter(Boolean) as RefItem[]))
      .catch(() => {});
  }, [endpoint]);
  return items;
}
