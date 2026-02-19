import React, { useState } from 'react';
import { EXTENDED_TAG_DEFS } from './extendedTextDefs';

const ESCAPE_CHARS = [
  { code: '\\V[n]', desc: '변수 n의 값' },
  { code: '\\N[n]', desc: '액터 n의 이름' },
  { code: '\\P[n]', desc: '파티원 n의 이름' },
  { code: '\\G', desc: '화폐 단위' },
  { code: '\\C[n]', desc: '텍스트 색상 n' },
  { code: '\\I[n]', desc: '아이콘 n 표시' },
  { code: '\\{', desc: '폰트 크기 +' },
  { code: '\\}', desc: '폰트 크기 -' },
  { code: '\\$', desc: '골드 창 열기' },
  { code: '\\.', desc: '1/4초 대기' },
  { code: '\\|', desc: '1초 대기' },
  { code: '\\!', desc: '클릭 대기' },
  { code: '\\>', desc: '순간 표시 시작' },
  { code: '\\<', desc: '순간 표시 종료' },
  { code: '\\^', desc: '입력 대기 없이 종료' },
];

export function ExtTextHelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="ete-help-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲ 도움말 닫기' : '▼ 도움말 (제어 문자 + 확장 태그)'}
      </button>
      {open && (
        <div className="ete-help-panel">
          <div className="ete-help-section">
            <div className="ete-help-title">기본 제어 문자</div>
            <div className="ete-help-grid">
              {ESCAPE_CHARS.map(ec => (
                <React.Fragment key={ec.code}>
                  <span className="ete-help-code">{ec.code}</span>
                  <span className="ete-help-desc">{ec.desc}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="ete-help-section">
            <div className="ete-help-title">확장 태그 (&lt;태그 파라미터&gt;텍스트&lt;/태그&gt;)</div>
            <div className="ete-help-tag-list">
              {EXTENDED_TAG_DEFS.map(def => (
                <span
                  key={def.tag}
                  className="ete-help-tag-chip"
                  style={{ background: def.badgeColor }}
                  title={`<${def.tag}>`}
                >
                  {def.label}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 6, color: '#666' }}>
              예시: <span style={{ color: '#9cdcfe', fontFamily: 'monospace', fontSize: 10 }}>
                {'<color value=#ff0000>빨간 글자</color>'}
              </span>
            </div>
            <div style={{ color: '#666', marginTop: 2 }}>
              예시: <span style={{ color: '#9cdcfe', fontFamily: 'monospace', fontSize: 10 }}>
                {'<gradient color1=#ffff00 color2=#ff0000>그라데이션</gradient>'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
