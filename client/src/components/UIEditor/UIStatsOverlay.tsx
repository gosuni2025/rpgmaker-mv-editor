import React from 'react';

function fmtNum(n: number | null) {
  if (n == null) return '-';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export default function UIStatsOverlay({ data }: { data: Record<string, number | string | null> }) {
  return (
    <div style={{
      position: 'absolute', top: 8, right: 8, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', color: '#0f0',
      fontFamily: 'monospace', fontSize: 11,
      padding: '6px 10px', borderRadius: 4, border: '1px solid #2a2a2a',
      pointerEvents: 'none', lineHeight: 1.7, minWidth: 110, userSelect: 'none',
    }}>
      <div><span style={{ color: '#ff4' }}>FPS</span>{'  '}<span style={{ color: '#fff' }}>{data.fps ?? '-'}</span></div>
      <div><span style={{ color: '#888' }}>Rndr</span> <span style={{ color: '#ccc' }}>{data.renderer ?? '-'}</span></div>
      <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>
        <span style={{ color: '#4cf' }}>DC</span>{'   '}<span style={{ color: '#fff' }}>{fmtNum(data.dc as number)}</span>
      </div>
      <div><span style={{ color: '#4cf' }}>Tri</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.tri as number)}</span></div>
      <div><span style={{ color: '#4cf' }}>Tex</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.tex as number)}</span></div>
      <div><span style={{ color: '#4cf' }}>Geo</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.geo as number)}</span></div>
      <div><span style={{ color: '#4cf' }}>Prg</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.prg as number)}</span></div>
      {data.mem != null && (
        <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>
          <span style={{ color: '#fa6' }}>Mem</span>{'  '}<span style={{ color: '#fff' }}>{data.mem}MB</span>
        </div>
      )}
    </div>
  );
}
