import React, { useEffect, useRef, useState, useCallback } from 'react';
import apiClient from '../api/client';
import './MCPStatusDialog.css';

interface McpLog {
  id: string;
  timestamp: number;
  sessionId: string;
  type: 'connect' | 'disconnect' | 'call' | 'response' | 'error';
  tool?: string;
  args?: unknown;
  result?: unknown;
  durationMs?: number;
}

interface McpStatus {
  running: boolean;
  port: number;
  agentCount: number;
  startError: string | null;
  logs: McpLog[];
}

interface Props {
  onClose: () => void;
}

const POLL_INTERVAL = 2000;

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function fmtSessionId(id: string) { return id.slice(0, 8); }

export default function MCPStatusDialog({ onClose }: Props) {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [portInput, setPortInput] = useState('');
  const [restarting, setRestarting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // 드래그 상태
  const dragState = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  // 초기 위치
  const [pos, setPos] = useState({ x: window.innerWidth - 520, y: 60 });

  // ── 폴링 ───────────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiClient.get<McpStatus>('/mcp/status');
      setStatus(prev => {
        if (prev === null) setPortInput(String(data.port));
        return data;
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // ── 오토스크롤 ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoScroll) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [status?.logs, autoScroll]);

  // ── 드래그 ─────────────────────────────────────────────────────────────────

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    const tag = (e.target as Element).tagName;
    if (tag === 'BUTTON' || tag === 'INPUT') return;
    dragState.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragState.current;
      if (!d.active) return;
      setPos({ x: d.origX + e.clientX - d.startX, y: d.origY + e.clientY - d.startY });
    };
    const onUp = () => { dragState.current.active = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── 재시작 ─────────────────────────────────────────────────────────────────

  const handleRestart = useCallback(async () => {
    const port = parseInt(portInput);
    if (!port || port < 1024 || port > 65535) {
      alert('유효한 포트 번호를 입력하세요 (1024~65535)');
      return;
    }
    setRestarting(true);
    try {
      const data = await apiClient.post<McpStatus>('/mcp/restart', { port });
      setStatus(data);
    } catch (err) {
      alert('재시작 실패: ' + String(err));
    } finally {
      setRestarting(false);
    }
  }, [portInput]);

  const handleStop = useCallback(async () => {
    await apiClient.post('/mcp/stop', {});
    fetchStatus();
  }, [fetchStatus]);

  // ── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <div
      ref={windowRef}
      className="mcp-window"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* 헤더 */}
      <div className="mcp-header" onMouseDown={onHeaderMouseDown}>
        <span className="mcp-title">MCP 서버 상태</span>
        <button className="mcp-close" onClick={onClose}>×</button>
      </div>

      {/* 본문 */}
      <div className="mcp-body">

        {/* 상태 정보 */}
        <div className="mcp-info-row">
          <span className={`mcp-dot ${status?.running ? 'mcp-dot--on' : 'mcp-dot--off'}`} />
          <span className="mcp-status-text">
            {status === null ? '…' : status.running ? '실행 중' : '중지됨'}
          </span>
          {status?.startError && (
            <span className="mcp-error-badge" title={status.startError}>오류</span>
          )}
          <span className="mcp-agent-count">
            에이전트 {status?.agentCount ?? 0}개 연결
          </span>
        </div>

        {/* 포트 */}
        <div className="mcp-port-row">
          <label className="mcp-label">포트</label>
          <input
            className="mcp-port-input"
            type="number"
            min={1024}
            max={65535}
            value={portInput}
            onChange={e => setPortInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRestart()}
          />
          <button
            className="mcp-btn mcp-btn--primary"
            onClick={handleRestart}
            disabled={restarting}
          >
            {restarting ? '…' : status?.running ? '재시작' : '시작'}
          </button>
          {status?.running && (
            <button className="mcp-btn" onClick={handleStop}>중지</button>
          )}
        </div>

        {/* 접속 주소 */}
        {status?.running && (
          <div className="mcp-addr">
            <span className="mcp-label">접속 주소</span>
            <code>http://localhost:{status.port}/sse</code>
          </div>
        )}

        {/* 로그 헤더 */}
        <div className="mcp-log-header">
          <span className="mcp-label">로그</span>
          <label className="mcp-autoscroll">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            자동 스크롤
          </label>
        </div>

        {/* 로그 목록 */}
        <div className="mcp-logs">
          {(!status?.logs?.length) ? (
            <div className="mcp-log-empty">로그 없음</div>
          ) : (
            status.logs.map(log => (
              <LogEntry key={log.id} log={log} />
            ))
          )}
          <div ref={logsEndRef} />
        </div>

      </div>

      {/* 리사이즈 핸들 (우하단) */}
      <div className="mcp-resize-hint" />
    </div>
  );
}

function LogEntry({ log }: { log: McpLog }) {
  const [expanded, setExpanded] = useState(false);
  const typeClass = `mcp-log-type--${log.type}`;
  const typeLabel = {
    connect: '연결',
    disconnect: '해제',
    call: '호출',
    response: '응답',
    error: '오류',
  }[log.type];

  const hasDetail = log.args !== undefined || log.result !== undefined;

  return (
    <div className={`mcp-log-entry ${typeClass}`} onClick={() => hasDetail && setExpanded(v => !v)}>
      <span className="mcp-log-time">{fmtTime(log.timestamp)}</span>
      <span className="mcp-log-badge">{typeLabel}</span>
      <span className="mcp-log-session">[{fmtSessionId(log.sessionId)}]</span>
      {log.tool && <span className="mcp-log-tool">{log.tool}</span>}
      {log.durationMs !== undefined && (
        <span className="mcp-log-duration">{log.durationMs}ms</span>
      )}
      {hasDetail && <span className="mcp-log-expand">{expanded ? '▾' : '▸'}</span>}

      {expanded && (
        <div className="mcp-log-detail" onClick={e => e.stopPropagation()}>
          {log.args !== undefined && (
            <pre className="mcp-log-pre">
              <span className="mcp-pre-label">args: </span>
              {JSON.stringify(log.args, null, 2)}
            </pre>
          )}
          {log.result !== undefined && (
            <pre className="mcp-log-pre">
              <span className="mcp-pre-label">result: </span>
              {typeof log.result === 'string'
                ? log.result.slice(0, 500) + (log.result.length > 500 ? '…' : '')
                : JSON.stringify(log.result, null, 2).slice(0, 1000)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
