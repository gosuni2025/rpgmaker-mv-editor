import type React from 'react';

export const inputStyle: React.CSSProperties = {
  width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd',
  padding: '4px 6px', borderRadius: 2, boxSizing: 'border-box', fontSize: 12,
};

export const selectStyle: React.CSSProperties = { ...inputStyle };

export const smallBtnStyle: React.CSSProperties = {
  padding: '2px 8px', background: '#555', border: 'none', color: '#ddd',
  borderRadius: 2, cursor: 'pointer', fontSize: 11,
};

export const deleteBtnStyle: React.CSSProperties = {
  ...smallBtnStyle, background: '#733', color: '#faa', padding: '2px 6px',
};

export const sectionStyle: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px solid #444',
};

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#aaa', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.5px',
};

export const rowStyle: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6,
};
