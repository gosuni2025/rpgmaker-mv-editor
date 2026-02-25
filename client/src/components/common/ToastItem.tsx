import React, { useState, useEffect } from 'react';

function formatRelativeTime(createdAt: number, now: number): string {
  const sec = Math.floor((now - createdAt) / 1000);
  if (sec < 1) return '방금 전';
  if (sec < 60) return `${sec}초 전`;
  return `${Math.floor(sec / 60)}분 전`;
}

interface ToastItemProps {
  toast: { id: number; message: string; persistent: boolean; createdAt: number; count: number };
  index: number;
  onDismiss: (id: number) => void;
}

export function ToastItem({ toast, index, onDismiss }: ToastItemProps) {
  const [now, setNow] = useState(Date.now());
  const [pinned, setPinned] = useState(false);
  const isPersistent = toast.persistent || pinned;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`toast ${isPersistent ? 'toast-persistent' : ''} ${pinned ? 'toast-pinned' : ''}`}
      style={{ bottom: `${40 + index * 44}px`, cursor: isPersistent ? 'default' : 'pointer' }}
      onClick={!isPersistent ? () => setPinned(true) : undefined}
      onAnimationEnd={(e) => {
        if (e.animationName === 'toast-fade') onDismiss(toast.id);
      }}
    >
      {toast.count > 1 && (
        <span className="toast-count">{toast.count}</span>
      )}
      {toast.message}
      <span className="toast-age">{formatRelativeTime(toast.createdAt, now)}</span>
      {isPersistent && (
        <button className="toast-close" onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}>&times;</button>
      )}
      {!isPersistent && <div className="toast-progress" />}
    </div>
  );
}
