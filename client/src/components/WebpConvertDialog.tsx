import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import Dialog from './common/Dialog';

type Phase = 'confirm' | 'running' | 'done' | 'error';

export default function WebpConvertDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowWebpConvertDialog);
  const setUseWebp = useEditorStore((s) => s.setUseWebp);

  const [phase, setPhase] = useState<Phase>('confirm');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [converted, setConverted] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 20);
  };

  const start = useCallback(() => {
    setPhase('running');
    setLogs([]);
    setProgress(null);

    const es = new EventSource('/api/project/convert-webp-progress');
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'log') addLog(data.message);
        else if (data.type === 'progress') setProgress({ current: data.current, total: data.total });
        else if (data.type === 'counted') setProgress({ current: 0, total: data.total });
        else if (data.type === 'done') {
          setConverted(data.converted ?? 0);
          setPhase('done');
          setUseWebp(true);
          es.close();
        } else if (data.type === 'error') {
          setErrorMsg(data.message);
          setPhase('error');
          es.close();
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      setErrorMsg('서버 연결이 끊어졌습니다.');
      setPhase('error');
      es.close();
    };
  }, [setUseWebp]);

  const close = () => {
    esRef.current?.close();
    setShow(false);
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog title={t('webpConvert.title')} onClose={close} width={520}>
      {phase === 'confirm' && (
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#ddd', marginBottom: 12, lineHeight: 1.7 }}>
            {t('webpConvert.confirmDesc')}
          </p>
          <ul style={{ color: '#aaa', fontSize: 12, lineHeight: 2, marginBottom: 12, paddingLeft: 20 }}>
            <li>{t('webpConvert.point1')}</li>
            <li>{t('webpConvert.point2')}</li>
            <li>{t('webpConvert.point3')}</li>
          </ul>
          <div style={{
            background: '#3a2a1a', border: '1px solid #7a5c30', borderRadius: 4,
            padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#e8a040',
          }}>
            ⚠ {t('webpConvert.irreversible')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={close} style={btnStyle('#444', '#555')}>
              {t('common.cancel')}
            </button>
            <button onClick={start} style={btnStyle('#2675bf', '#3385cf')}>
              {t('webpConvert.startButton')}
            </button>
          </div>
        </div>
      )}

      {(phase === 'running' || phase === 'done' || phase === 'error') && (
        <div style={{ padding: '8px 0' }}>
          {progress && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999', marginBottom: 4 }}>
                <span>{progress.current} / {progress.total}</span>
                <span>{pct}%</span>
              </div>
              <div style={{ background: '#1a1a1a', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                <div style={{ background: '#2675bf', height: '100%', width: `${pct}%`, transition: 'width 0.1s' }} />
              </div>
            </div>
          )}

          <div style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
            height: 220, overflowY: 'auto', padding: '6px 8px', fontFamily: 'monospace', fontSize: 11,
          }}>
            {logs.map((l, i) => (
              <div key={i} style={{ color: '#bbb', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l}</div>
            ))}
            <div ref={logEndRef} />
          </div>

          {phase === 'done' && (
            <div style={{
              marginTop: 10, padding: '8px 12px', background: '#1a3a1a',
              border: '1px solid #3a6a3a', borderRadius: 4, color: '#6dca6d', fontSize: 13,
            }}>
              ✓ {t('webpConvert.done', { count: converted })}
            </div>
          )}
          {phase === 'error' && (
            <div style={{
              marginTop: 10, padding: '8px 12px', background: '#3a1a1a',
              border: '1px solid #7a3030', borderRadius: 4, color: '#e06060', fontSize: 13,
            }}>
              ✗ {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={close}
              disabled={phase === 'running'}
              style={btnStyle(phase === 'running' ? '#333' : '#444', '#555')}
            >
              {phase === 'done' ? t('common.close') : phase === 'error' ? t('common.close') : t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function btnStyle(bg: string, hover: string): React.CSSProperties {
  return {
    background: bg,
    border: '1px solid #555',
    color: '#ddd',
    padding: '5px 14px',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 12,
  };
}
