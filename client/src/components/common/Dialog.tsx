import React, { useRef, useLayoutEffect, useCallback } from 'react';
import useEscClose from '../../hooks/useEscClose';
import './Dialog.css';

interface DialogProps {
  title: React.ReactNode;
  onClose: () => void;
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  noBody?: boolean;
  bodyStyle?: React.CSSProperties;
  showCloseButton?: boolean;
  overlayStyle?: React.CSSProperties;
}

export default function Dialog({
  title,
  onClose,
  className,
  style,
  width,
  height,
  children,
  footer,
  noBody,
  bodyStyle,
  showCloseButton,
  overlayStyle,
}: DialogProps) {
  // ref 패턴으로 항상 최신 onClose를 호출하되 useEscClose에는 stable 함수를 전달
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; });
  const stableClose = useCallback(() => onCloseRef.current(), []);
  useEscClose(stableClose);

  const dialogStyle: React.CSSProperties = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...style,
  };

  return (
    <div className="db-dialog-overlay" style={overlayStyle}>
      <div
        className={`db-dialog${className ? ` ${className}` : ''}`}
        style={Object.keys(dialogStyle).length > 0 ? dialogStyle : undefined}
      >
        <div className="db-dialog-header">
          <h2>{title}</h2>
          {showCloseButton && (
            <button className="db-dialog-close" onClick={onClose}>×</button>
          )}
        </div>
        {noBody ? children : (
          <div className="db-dialog-body" style={bodyStyle}>
            {children}
          </div>
        )}
        {footer !== undefined && (
          <div className="db-dialog-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
