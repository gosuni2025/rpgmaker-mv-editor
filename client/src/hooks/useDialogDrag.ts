import { useEffect } from 'react';

/**
 * .db-dialog-header를 드래그해서 .db-dialog를 이동할 수 있게 하는 전역 훅.
 * App에서 한 번 호출하면 모든 다이얼로그에 자동 적용됨.
 * translate() transform으로 위치를 조정하므로 기존 레이아웃(flex center)을 유지.
 */
export default function useDialogDrag() {
  useEffect(() => {
    let active = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let target: HTMLElement | null = null;

    function getTranslate(el: HTMLElement): { x: number; y: number } {
      const style = getComputedStyle(el).transform;
      if (!style || style === 'none') return { x: 0, y: 0 };
      const m = new DOMMatrix(style);
      return { x: m.m41, y: m.m42 };
    }

    function onMouseDown(e: MouseEvent) {
      const header = (e.target as Element).closest('.db-dialog-header');
      if (!header) return;
      // 버튼, input, select 위에서는 드래그 시작 안 함
      const tag = (e.target as Element).tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const dialog = header.closest('.db-dialog') as HTMLElement | null;
      if (!dialog) return;

      const t = getTranslate(dialog);
      target = dialog;
      originX = t.x;
      originY = t.y;
      startX = e.clientX;
      startY = e.clientY;
      active = true;

      dialog.style.transition = 'none';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    }

    function onMouseMove(e: MouseEvent) {
      if (!active || !target) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      target.style.transform = `translate(${originX + dx}px, ${originY + dy}px)`;
    }

    function onMouseUp() {
      if (!active) return;
      active = false;
      document.body.style.userSelect = '';
      target = null;
    }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);
}
