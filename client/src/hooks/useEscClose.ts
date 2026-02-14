import { useEffect } from 'react';

/**
 * ESC 키로 다이얼로그를 닫는 훅 (스택 기반).
 * 여러 다이얼로그가 중첩된 경우 가장 마지막에 마운트된(최상단) 다이얼로그만 닫힘.
 */

const escCloseStack: Array<() => void> = [];

function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (escCloseStack.length === 0) return;
  e.preventDefault();
  e.stopPropagation();
  const topHandler = escCloseStack[escCloseStack.length - 1];
  topHandler();
}

let listenerAttached = false;

export default function useEscClose(onClose: () => void) {
  useEffect(() => {
    if (!listenerAttached) {
      // capture phase로 등록하여 다른 키 핸들러보다 먼저 처리
      document.addEventListener('keydown', handleKeyDown, true);
      listenerAttached = true;
    }

    escCloseStack.push(onClose);

    return () => {
      const idx = escCloseStack.indexOf(onClose);
      if (idx !== -1) escCloseStack.splice(idx, 1);

      if (escCloseStack.length === 0 && listenerAttached) {
        document.removeEventListener('keydown', handleKeyDown, true);
        listenerAttached = false;
      }
    };
  }, [onClose]);
}
