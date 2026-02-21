import { useEffect, useRef } from 'react';

/**
 * ESC 키로 다이얼로그를 닫는 훅 (스택 기반).
 * 여러 다이얼로그가 중첩된 경우 가장 마지막에 마운트된(최상단) 다이얼로그만 닫힘.
 *
 * onClose가 매 렌더마다 새 함수여도 스택 위치는 마운트 시점에 고정됨.
 * (ref 패턴으로 항상 최신 onClose를 호출)
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
  const onCloseRef = useRef(onClose);
  // render phase에서 항상 최신 함수로 업데이트
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!listenerAttached) {
      // capture phase로 등록하여 다른 키 핸들러보다 먼저 처리
      document.addEventListener('keydown', handleKeyDown, true);
      listenerAttached = true;
    }

    // stableHandler는 마운트 시 한 번만 생성 → 스택 위치 고정
    const stableHandler = () => onCloseRef.current();
    escCloseStack.push(stableHandler);

    return () => {
      const idx = escCloseStack.indexOf(stableHandler);
      if (idx !== -1) escCloseStack.splice(idx, 1);

      if (escCloseStack.length === 0 && listenerAttached) {
        document.removeEventListener('keydown', handleKeyDown, true);
        listenerAttached = false;
      }
    };
  }, []); // 빈 deps: 마운트/언마운트 시에만 실행, onClose가 변해도 스택 위치 유지
}
