import React, { useState, useRef, useEffect } from 'react';

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

interface DeployProgressModalProps {
  show: boolean;
  busy: boolean;
  logs: string[];
  status: string;
  error: string;
  progress: number | null;
  color?: string;
  titleBusy: string;
  titleDone: string;
  titleFailed: string;
  resultUrl?: string;
  resultLabel?: string;
  resultButtonStyle?: React.CSSProperties;
  onResultClick?: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

export function DeployProgressModal({
  show, busy, logs, status, error, progress,
  color = '#2a9a42',
  titleBusy, titleDone, titleFailed,
  resultUrl, resultLabel, resultButtonStyle, onResultClick,
  onCancel,
  onClose,
}: DeployProgressModalProps) {
  const [logCopied, setLogCopied] = useState(false);
  const logPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [logs]);

  if (!show) return null;

  const failed = !busy && !!error;
  const done = !busy && logs.length > 0;

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setLogCopied(true);
    setTimeout(() => setLogCopied(false), 1500);
  };

  return (
    <div className="deploy-progress-overlay">
      <div className="deploy-progress-modal">
        <div className="deploy-progress-header">
          {busy ? titleBusy : failed ? titleFailed : titleDone}
          {busy && <span className="deploy-spinner" />}
        </div>

        {status && <div className="deploy-progress-status">{status}</div>}

        <ProgressBar progress={progress} color={failed ? '#e55' : color} />

        <div style={{ position: 'relative' }}>
          {logs.length > 0 && (
            <button onClick={copyLogs} style={{
              position: 'absolute', top: 4, right: 4, zIndex: 1,
              padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              background: logCopied ? '#1a6e2e' : '#3a3a3a',
              border: '1px solid #555', borderRadius: 3, color: '#ccc',
            }}>
              {logCopied ? '✓ 복사됨' : '복사'}
            </button>
          )}
          <div className="deploy-log-panel" ref={logPanelRef}>
            {logs.map((log, i) => (
              <div key={i} className={
                log.startsWith('$') ? 'deploy-log-cmd' :
                log.startsWith('──') ? 'deploy-log-step' :
                log.startsWith('✓') || log.startsWith('→') ? 'deploy-log-ok' :
                log.startsWith('✗') ? 'deploy-log-err' :
                'deploy-log-info'
              }>{log}</div>
            ))}
          </div>
        </div>

        <ErrorMessage error={error} />

        {busy && onCancel && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="db-btn" onClick={onCancel}
              style={{ color: '#e77', borderColor: '#533' }}>
              취소
            </button>
          </div>
        )}

        {!busy && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            {done && !failed && resultUrl && onResultClick && (
              <button className="db-btn" onClick={onResultClick}
                style={{ marginRight: 8, ...resultButtonStyle }}>
                {resultLabel} ↗
              </button>
            )}
            <button className="db-btn" onClick={onClose}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}
