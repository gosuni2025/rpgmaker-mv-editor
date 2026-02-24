import { useCallback, useEffect, type RefObject } from 'react';

/**
 * 리스트 팝업에서 ArrowUp/ArrowDown 키로 항목 이동을 지원하는 hook.
 * - 키 입력 시 선택 항목 변경 + .selected 요소로 자동 스크롤
 * - selectedKey 변경 시에도 스크롤 (키보드 이동 후 뷰 추적)
 */
export function useListKeyNav<T, K extends string | number>({
  items,
  selectedKey,
  getKey,
  onSelect,
  listRef,
}: {
  items: T[];
  selectedKey: K | null;
  getKey: (item: T) => K;
  onSelect: (key: K) => void;
  listRef: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    const el = listRef.current?.querySelector('.selected');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((e: { key: string; preventDefault(): void }) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const idx = items.findIndex(item => getKey(item) === selectedKey);
    const base = idx < 0 ? (e.key === 'ArrowDown' ? -1 : 0) : idx;
    const next = e.key === 'ArrowUp'
      ? Math.max(0, base - 1)
      : Math.min(items.length - 1, base + 1);
    if (next >= 0 && next < items.length) onSelect(getKey(items[next]));
  }, [items, selectedKey, getKey, onSelect]); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleKeyDown };
}
