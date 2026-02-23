import { useCallback, useRef } from 'react';
import { entriesToRaw, TagEntry } from './extendedTextDefs';

interface UseEditorDragDropOptions {
  onDrop: () => void; // syncToParent
}

export function useEditorDragDrop({ onDrop }: UseEditorDragDropOptions) {
  const dragBlockRef = useRef<HTMLElement | null>(null);
  const justDroppedRef = useRef(false);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    const blockEl = (e.target as HTMLElement).closest('[data-ete-tags],[data-ete-tag]') as HTMLElement | null;
    if (!blockEl) { e.preventDefault(); return; }
    dragBlockRef.current = blockEl;
    blockEl.classList.add('ete-block-dragging');
    e.dataTransfer.effectAllowed = 'move';
    if (blockEl.dataset.eteTags) {
      const tags = JSON.parse(blockEl.dataset.eteTags) as TagEntry[];
      const content = blockEl.dataset.eteContent ?? '';
      e.dataTransfer.setData('text/plain', entriesToRaw(tags, content));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragBlockRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockEl = dragBlockRef.current;
    dragBlockRef.current = null;
    if (!blockEl) return;
    blockEl.classList.remove('ete-block-dragging');

    const doc = document as any;
    let range: Range | null = null;
    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
    }
    if (!range || blockEl.contains(range.commonAncestorContainer)) return;

    blockEl.remove();
    range.insertNode(blockEl);

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r2 = document.createRange();
      r2.setStartAfter(blockEl);
      r2.collapse(true);
      sel.addRange(r2);
    }

    justDroppedRef.current = true;
    setTimeout(() => { justDroppedRef.current = false; }, 100);
    onDrop();
  }, [onDrop]);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    if (dragBlockRef.current) {
      dragBlockRef.current.classList.remove('ete-block-dragging');
      dragBlockRef.current = null;
    }
  }, []);

  return { justDroppedRef, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}
