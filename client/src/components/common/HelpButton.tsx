import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './HelpButton.css';

interface HelpButtonProps {
  text?: string;
  children?: React.ReactNode;
}

export default function HelpButton({ text, children }: HelpButtonProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show]);

  const content = children ?? (text
    ? text.split(/\\n|\n/).map((line, i, arr) => (
        <React.Fragment key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ))
    : null);

  if (!content) return null;

  return (
    <>
      <span className="help-btn-wrap">
        <button
          className={`help-btn-icon${show ? ' active' : ''}`}
          onClick={() => setShow(v => !v)}
          title={text}
        >?</button>
      </span>
      {show && ReactDOM.createPortal(
        <div className="help-btn-overlay" onClick={() => setShow(false)}>
          <div className="help-btn-modal" onClick={e => e.stopPropagation()}>
            <button className="help-btn-modal-close" onClick={() => setShow(false)}>×</button>
            <div className="help-btn-modal-content">{content}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
