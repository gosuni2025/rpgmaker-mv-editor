import React, { useState } from 'react';
import './HelpButton.css';

interface HelpButtonProps {
  text?: string;
  children?: React.ReactNode;
  placement?: 'right' | 'bottom' | 'left';
  mode?: 'click' | 'hover';
}

export default function HelpButton({ text, children, placement = 'right', mode = 'click' }: HelpButtonProps) {
  const [show, setShow] = useState(false);

  const content = children ?? (text
    ? text.split(/\\n|\n/).map((line, i, arr) => (
        <React.Fragment key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ))
    : null);

  if (!content) return null;

  if (mode === 'hover') {
    return (
      <span
        className={`help-btn-wrap help-btn-${placement} help-btn-hover`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <span className="help-btn-icon">?</span>
        {show && <div className="help-btn-popup">{content}</div>}
      </span>
    );
  }

  return (
    <span className={`help-btn-wrap help-btn-${placement}`}>
      <button
        className={`help-btn-icon${show ? ' active' : ''}`}
        onClick={() => setShow(v => !v)}
        onBlur={() => setShow(false)}
        title={text}
      >?</button>
      {show && <div className="help-btn-popup">{content}</div>}
    </span>
  );
}
