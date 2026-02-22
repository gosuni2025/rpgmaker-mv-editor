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
  const [gitBackup, setGitBackup] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [currentFile, setCurrentFile] = useState('');
  const [converted, setConverted] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 20);
  }, []);

  const start = useCallback(() => {
    setPhase('running');
    setLogs([]);
    setProgress(null);
    setCurrentFile('');

    const url = `/api/project/convert-webp-progress?gitBackup=${gitBackup ? '1' : '0'}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'log') {
          addLog(data.message);
        } else if (data.type === 'converting') {
          setCurrentFile(data.file);
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'progress') {
          setProgress({ current: data.current, total: data.total });
        } else if (data.type === 'counted') {
          setProgress({ current: 0, total: data.total });
        } else if (data.type === 'done') {
          setConverted(data.converted ?? 0);
          setCurrentFile('');
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
  }, [gitBackup, addLog, setUseWebp]);

  const close = () => {
    esRef.current?.close();
    setShow(false);
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog title={t('webpConvert.title')} onClose={close} width={540}>

      {/* ── 확인 화면 ── */}
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

          {/* git 백업 체크박스 */}
          <div style={{
            background: '#252525', border: '1px solid #3a3a3a', borderRadius: 4,
            padding: '10px 12px', marginBottom: 12,
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={gitBackup}
                onChange={(e) => setGitBackup(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ color: '#ddd', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                  {t('webpConvert.gitBackup')}
                </div>
                <div style={{ color: '#999', fontSize: 11, lineHeight: 1.6 }}>
                  {t('webpConvert.gitBackupDesc')}
                </div>
              </div>
            </label>
          </div>

          <div style={{
            background: '#3a2a1a', border: '1px solid #7a5c30', borderRadius: 4,
            padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#e8a040',
          }}>
            ⚠ {t('webpConvert.irreversible')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={close} style={btnStyle('#444')}>
              {t('common.cancel')}
            </button>
            <button onClick={start} style={btnStyle('#2675bf')}>
              {t('webpConvert.startButton')}
            </button>
          </div>
        </div>
      )}

      {/* ── 진행 / 완료 / 오류 화면 ── */}
      {(phase === 'running' || phase === 'done' || phase === 'error') && (
        <div style={{ padding: '8px 0' }}>

          {/* 현재 변환 중 파일 표시 */}
          {currentFile && (
            <div style={{
              background: '#1e2a38', border: '1px solid #2a4a6a', borderRadius: 4,
              padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#6ab0f0',
              fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              변환 중: {currentFile}
            </div>
          )}

          {/* 프로그레스 바 */}
          {progress !== null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: '#bbb', fontWeight: 600 }}>
                  {progress.current} / {progress.total}개 진행중
                </span>
                <span style={{ fontSize: 12, color: '#888' }}>{pct}%</span>
              </div>
              <div style={{ background: '#1a1a1a', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                <div style={{
                  background: phase === 'done' ? '#3a9a3a' : '#2675bf',
                  height: '100%', width: `${phase === 'done' ? 100 : pct}%`,
                  transition: 'width 0.15s',
                }} />
              </div>
            </div>
          )}

          {/* 로그 */}
          <div style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
            height: 200, overflowY: 'auto', padding: '6px 8px', fontFamily: 'monospace', fontSize: 11,
          }}>
            {logs.map((l, i) => {
              const isHeader = l.startsWith('──');
              const isOk = l.startsWith('✓');
              const isWarn = l.startsWith('⚠');
              const color = isHeader ? '#888' : isOk ? '#6dca6d' : isWarn ? '#e8a040' : '#bbb';
              return (
                <div key={i} style={{ color, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l}</div>
              );
            })}
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
              style={btnStyle(phase === 'running' ? '#333' : '#444')}
            >
              {phase === 'running' ? t('common.cancel') : t('common.close')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function btnStyle(bg: string): React.CSSProperties {
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
