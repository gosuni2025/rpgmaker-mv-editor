import React from 'react';

export function ProgressBar({ progress, color }: { progress: number | null; color: string }) {
  if (progress === null) return null;
  return (
    <div style={{ background: '#3a3a3a', borderRadius: 3, height: 5, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: color, transition: 'width 0.15s ease-out' }} />
    </div>
  );
}

export function StatusMessage({ status }: { status: string }) {
  if (!status) return null;
  return <div style={{ color: '#6c6', fontSize: 12 }}>{status}</div>;
}

export function ErrorMessage({ error }: { error: string }) {
  if (!error) return null;
  return <div style={{ color: '#e55', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</div>;
}
