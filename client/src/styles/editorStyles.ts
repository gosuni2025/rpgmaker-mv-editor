import type React from 'react';

/** 기본 input/select 스타일 — 다크 테마 */
export const selectStyle = {
  background: '#2b2b2b',
  border: '1px solid #555',
  borderRadius: 3,
  padding: '4px 8px',
  color: '#ddd',
  fontSize: 13,
} as const;

/** select 스타일에 width 100% 추가 */
export const selectStyleFull: React.CSSProperties = { ...selectStyle, width: '100%' };

/** 80px 고정 너비 input 스타일 */
export const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

/** 보조 라벨 스타일 */
export const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };

/** 라디오/체크박스 행 스타일 */
export const radioStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#ddd',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
};
