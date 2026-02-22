import { useState, useCallback, useMemo } from 'react';

export function useDatabaseTab<T extends { id: number }>(
  data: (T | null)[] | undefined,
  onChange: (data: (T | null)[]) => void,
  createNew: (id: number) => T,
  deepCopy?: (source: T) => Partial<T>,
) {
  const [selectedId, setSelectedId] = useState(1);

  const selectedItem = useMemo(
    () => data?.find((item) => item && item.id === selectedId) ?? null,
    [data, selectedId],
  );

  const getMaxId = useCallback(
    () => data?.reduce((max, item) => (item && item.id > max ? item.id : max), 0) ?? 0,
    [data],
  );

  const handleFieldChange = useCallback(
    (field: keyof T, value: unknown) => {
      if (!data) return;
      onChange(data.map((item) => (item && item.id === selectedId ? { ...item, [field]: value } : item)));
    },
    [data, selectedId, onChange],
  );

  const handleAdd = useCallback(() => {
    if (!data) return;
    const newId = getMaxId() + 1;
    onChange([...data, createNew(newId)]);
    setSelectedId(newId);
  }, [data, onChange, getMaxId, createNew]);

  const handleDelete = useCallback(
    (id: number) => {
      if (!data) return;
      if ((data.filter(Boolean) as T[]).length <= 1) return;
      const newData = data.filter((item) => !item || item.id !== id);
      onChange(newData);
      if (id === selectedId) {
        const remaining = newData.filter(Boolean) as T[];
        if (remaining.length > 0) setSelectedId(remaining[0].id);
      }
    },
    [data, onChange, selectedId],
  );

  const handleDuplicate = useCallback(
    (id: number) => {
      if (!data) return;
      const source = data.find((item) => item && item.id === id);
      if (!source) return;
      const newId = getMaxId() + 1;
      const extra = deepCopy ? deepCopy(source) : {};
      onChange([...data, { ...source, ...extra, id: newId }]);
      setSelectedId(newId);
    },
    [data, onChange, getMaxId, deepCopy],
  );

  const handleReorder = useCallback(
    (fromId: number, toId: number) => {
      if (!data) return;
      const items = data.filter(Boolean) as T[];
      const fromIdx = items.findIndex((item) => item.id === fromId);
      if (fromIdx < 0) return;
      const [moved] = items.splice(fromIdx, 1);
      if (toId === -1) {
        items.push(moved);
      } else {
        const toIdx = items.findIndex((item) => item.id === toId);
        if (toIdx < 0) items.push(moved);
        else items.splice(toIdx, 0, moved);
      }
      onChange([null, ...items]);
    },
    [data, onChange],
  );

  return {
    selectedId,
    setSelectedId,
    selectedItem,
    handleFieldChange,
    handleAdd,
    handleDelete,
    handleDuplicate,
    handleReorder,
  };
}
