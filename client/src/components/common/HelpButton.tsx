import React, { useState } from 'react';

export default function HelpButton({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <button
        style={{
          width: 16, height: 16, borderRadius: '50%', border: '1px solid #666',
          background: '#383838', color: '#aaa', fontSize: 10, lineHeight: '14px',
          padding: 0, cursor: 'pointer', verticalAlign: 'middle',
        }}
        onClick={() => setShow(!show)}
        onBlur={() => setShow(false)}
        title={text}
      >?</button>
      {show && (
        <div style={{
          position: 'absolute', left: 20, top: -4, zIndex: 100,
          background: '#333', border: '1px solid #555', borderRadius: 4,
          padding: '6px 10px', fontSize: 11, color: '#ccc',
          minWidth: 180, maxWidth: 260, boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          {text.split(/\\n|\n/).map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      )}
    </span>
  );
}
