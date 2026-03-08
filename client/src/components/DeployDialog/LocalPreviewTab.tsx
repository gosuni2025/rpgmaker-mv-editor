import React, { useState, useRef } from 'react';
import { CacheBustOpts, cacheBustToQuery } from '../common/CacheBustSection';
import { SSEEvent } from './types';
import useDeployProgress from './useDeployProgress';
import { DeployProgressModal } from './StatusWidgets';

interface Props {
  cbOpts: CacheBustOpts;
  syncRuntime: boolean;
}

export default function LocalPreviewTab({ cbOpts, syncRuntime }: Props) {
  const dp = useDeployProgress();
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const abortRef = useRef<(() => void) | null>(null);

  const handleBuild = async () => {
    dp.resetStatus();
    setPreviewUrl('');
    dp.setProgress(0);
    dp.setStatus('파일 수집 중...');
    dp.setBusy(true);
    setShowProgressModal(true);
    let completed = false;

    const params = new URLSearchParams(cacheBustToQuery(cbOpts));
    const evtSource = new EventSource(`/api/project/local-preview-progress?${params}`);

    abortRef.current = () => {
      evtSource.close();
      completed = true;
      abortRef.current = null;
      dp.setStatus('취소됨');
      dp.setProgress(null);
      dp.setBusy(false);
    };

    const totalRef = { current: 0 };

    evtSource.onmessage = (e) => {
      const ev = JSON.parse(e.data) as SSEEvent;
      if (ev.type === 'done') {
        completed = true;
        abortRef.current = null;
        dp.setProgress(1);
        dp.setStatus('빌드 완료! 브라우저에서 열기 버튼을 클릭하세요.');
        dp.setBusy(false);
        setPreviewUrl(ev.previewUrl || '/local-preview/');
        evtSource.close();
        return;
      }
      if (!dp.handleSSEEvent(ev, totalRef, { copy: 0.9, zip: 0 })) {
        completed = true;
        abortRef.current = null;
        evtSource.close();
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      abortRef.current = null;
      if (!completed) {
        dp.setError('서버 연결이 끊겼습니다. 서버가 실행 중인지 확인하세요.');
        dp.setStatus('');
        dp.setProgress(null);
        dp.setBusy(false);
      }
    };
  };

  const openPreview = () => {
    const port = 3001;
    window.open(`http://localhost:${port}${previewUrl}`, '_blank');
  };

  return (
    <>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
        배포 번들을 로컬 서버에 빌드하고 브라우저에서 테스트합니다.
        img/audio 파일은 원본 프로젝트에서 직접 서빙하여 빌드 속도를 높입니다.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          className="db-btn"
          onClick={handleBuild}
          disabled={dp.busy}
          style={{ background: '#2a6a2a', borderColor: '#2a6a2a' }}
        >
          {dp.busy ? '빌드 중...' : '빌드 & 미리보기'}
        </button>
        {previewUrl && (
          <button
            className="db-btn"
            onClick={openPreview}
            style={{ background: '#0078d4', borderColor: '#0078d4' }}
          >
            브라우저에서 열기 ↗
          </button>
        )}
      </div>

      {previewUrl && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6c6' }}>
          미리보기 URL: <span style={{ fontFamily: 'monospace' }}>http://localhost:3001{previewUrl}</span>
        </div>
      )}

      <DeployProgressModal
        show={showProgressModal}
        busy={dp.busy}
        logs={dp.logs}
        status={dp.status}
        error={dp.error}
        progress={dp.progress}
        color="#2a9a42"
        titleBusy="로컬 미리보기 빌드 중..."
        titleDone="빌드 완료"
        titleFailed="빌드 실패"
        resultUrl={previewUrl}
        resultLabel="브라우저에서 열기"
        resultButtonStyle={{ background: '#0078d4', borderColor: '#0078d4' }}
        onResultClick={openPreview}
        onCancel={abortRef.current ?? undefined}
        onClose={() => setShowProgressModal(false)}
      />
    </>
  );
}
