import React from 'react';

/**
 * 검색어와 일치하는 연속 substring을 <mark className="search-highlight">로 감싸 반환.
 * 대소문자 무시. 매칭 없으면 원본 문자열 그대로 반환.
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {highlightMatch(text.slice(idx + query.length), query)}
    </>
  );
}
