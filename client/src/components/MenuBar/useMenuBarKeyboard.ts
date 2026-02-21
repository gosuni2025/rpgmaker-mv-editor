import { useEffect } from 'react';

/**
 * 메뉴바 글로벌 키보드 단축키 핸들러.
 * 다이얼로그/모달이 열려있으면 맵 편집 단축키를 차단하고,
 * 텍스트 입력 필드에서는 텍스트 편집 단축키를 브라우저 기본 동작에 위임.
 */
export function useMenuBarKeyboard(handleAction: (action: string) => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inDialog = target.closest('.db-dialog-overlay, .modal-overlay, .vs-selector-overlay, .move-route-overlay, .move-route-param-overlay, .l10n-popup-overlay')
        || document.querySelector('.db-dialog-overlay, .modal-overlay, .vs-selector-overlay, .move-route-overlay, .move-route-param-overlay, .l10n-popup-overlay');
      const ctrl = e.ctrlKey || e.metaKey;
      const ime = e.isComposing || e.key === 'Process';

      // 전역 단축키 (다이얼로그 안에서도 동작)
      if (ctrl && (e.key === 's' || e.code === 'KeyS')) { e.preventDefault(); handleAction('save'); }
      else if (e.key === 'F5' || e.code === 'F5') { e.preventDefault(); handleAction('modeMap'); }
      else if (e.key === 'F6' || e.code === 'F6') { e.preventDefault(); handleAction('modeEvent'); }
      else if (e.key === 'F7' || e.code === 'F7') { e.preventDefault(); handleAction('modeLight'); }
      else if (e.key === 'F8' || e.code === 'F8') { e.preventDefault(); handleAction('modeObject'); }
      else if (e.key === 'F9' || e.code === 'F9') { e.preventDefault(); handleAction('modeCameraZone'); }
      else if (e.key === 'F10' || e.code === 'F10') { e.preventDefault(); handleAction('database'); }
      else if (e.key === 'F11' || e.code === 'F11') { e.preventDefault(); handleAction('modePassage'); }
      else if (ctrl && e.shiftKey && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) { e.preventDefault(); handleAction('playtestTitle'); }
      else if (ctrl && (e.key === 'r' || e.code === 'KeyR')) { e.preventDefault(); handleAction('playtestCurrentMap'); }
      else if (inDialog) return;
      else if (ime) return;
      else if (ctrl && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
        const tag = (e.target as HTMLElement).tagName;
        const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
        if (isTextInput) return;
        if (e.key === 'z') { e.preventDefault(); handleAction('undo'); }
        else if (e.key === 'a') { e.preventDefault(); handleAction('selectAll'); }
        else if (e.key === 'x') { e.preventDefault(); handleAction('cut'); }
        else if (e.key === 'c') { e.preventDefault(); handleAction('copy'); }
        else if (e.key === 'v') { e.preventDefault(); handleAction('paste'); }
      }
      else if (ctrl && e.key === 'y') { e.preventDefault(); handleAction('redo'); }
      else if (ctrl && e.key === 'f') { e.preventDefault(); handleAction('find'); }
      else if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); handleAction('zoomIn'); }
      else if (ctrl && e.key === '-') { e.preventDefault(); handleAction('zoomOut'); }
      else if (ctrl && e.key === '0') { e.preventDefault(); handleAction('zoomActual'); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); handleAction('deselect'); }
      else if (e.key === 'Delete') { handleAction('delete'); }
      else if (e.key === 'Escape') { window.dispatchEvent(new CustomEvent('editor-escape')); }
      // 도구 단축키 — e.code 사용으로 IME 상태와 무관하게 동작
      else if (!ctrl && !e.shiftKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if ((e.target as HTMLElement).isContentEditable) return;
        switch (e.code) {
          case 'KeyE': e.preventDefault(); handleAction('toolEraser'); break;
          case 'KeyP': e.preventDefault(); handleAction('toolPen'); break;
          case 'KeyB': e.preventDefault(); handleAction('toolFill'); break;
          case 'KeyM': e.preventDefault(); handleAction('toolSelect'); break;
          case 'KeyS': e.preventDefault(); handleAction('toolShadow'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction]);
}
