import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function ExtBadge({ inline }: { inline?: boolean }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 230) });
    }
    setShow(!show);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleOutside);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [show]);

  return (
    <span ref={ref} className={`sky-ext-badge${inline ? ' sky-ext-badge-inline' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      EXT
      {show && pos && (
        <div className="ext-badge-popup" style={{ position: 'fixed', top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}>
          <strong>EXT</strong> (Extension) 표시가 있는 항목은 에디터 확장 기능입니다.<br /><br />
          이 데이터는 별도의 확장 파일(<code>_ext.json</code>)에 저장되므로 RPG Maker MV 원본 에디터와의 호환성에 영향을 주지 않습니다.
        </div>
      )}
    </span>
  );
}
