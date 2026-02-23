import { useCallback } from 'react';
import { parseExtendedText, htmlDivToRaw, segsToHTML, entriesToRaw, TagEntry } from './extendedTextDefs';

interface BlockInfo {
  el: HTMLElement;
  tags: TagEntry[];
  content: string;
}

interface UseEditorClipboardOptions {
  selectedBlock: BlockInfo | null;
  onSync: () => void; // syncToParent
  onBlockRemoved: () => void; // setSelectedBlock(null) 후처리
}

function selectionToRaw(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const frag = sel.getRangeAt(0).cloneContents();
  const tmp = document.createElement('div');
  tmp.appendChild(frag);
  return htmlDivToRaw(tmp);
}

export function useEditorClipboard({ selectedBlock, onSync, onBlockRemoved }: UseEditorClipboardOptions) {
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    const raw = selectionToRaw();
    if (raw !== null) {
      e.clipboardData.setData('text/plain', raw);
      e.preventDefault();
      return;
    }
    if (selectedBlock) {
      e.clipboardData.setData('text/plain', entriesToRaw(selectedBlock.tags, selectedBlock.content));
      e.preventDefault();
    }
  }, [selectedBlock]);

  const handleCut = useCallback((e: React.ClipboardEvent) => {
    const raw = selectionToRaw();
    if (raw !== null) {
      e.clipboardData.setData('text/plain', raw);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('delete', false);
      onSync();
      e.preventDefault();
      return;
    }
    if (selectedBlock) {
      e.clipboardData.setData('text/plain', entriesToRaw(selectedBlock.tags, selectedBlock.content));
      selectedBlock.el.remove();
      onBlockRemoved();
      onSync();
      e.preventDefault();
    }
  }, [selectedBlock, onSync, onBlockRemoved]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const segs = parseExtendedText(text);
    if (segs.some(s => s.type === 'block')) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('insertHTML', false, segsToHTML(segs));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('insertText', false, text);
    }
    onSync();
  }, [onSync]);

  return { handleCopy, handleCut, handlePaste };
}
