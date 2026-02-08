import React, { useState } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';

type SearchType = 'name' | 'switch' | 'variable';

interface SearchResult {
  mapId: number;
  mapName: string;
  eventId: number;
  eventName: string;
  page: number;
}

export default function EventSearchDialog() {
  const setShow = useEditorStore((s) => s.setShowEventSearchDialog);
  const selectMap = useEditorStore((s) => s.selectMap);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('name');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const res = await apiClient.post<SearchResult[]>('/events/search', {
        query: query.trim(),
        type: searchType,
      });
      setResults(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const navigateToResult = async (result: SearchResult) => {
    await selectMap(result.mapId);
    setSelectedEventId(result.eventId);
    setEditMode('event');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="db-dialog-overlay" onClick={() => setShow(false)}>
      <div className="db-dialog" style={{ width: 620, height: 460, minHeight: 0 }} onClick={e => e.stopPropagation()}>
        <div className="db-dialog-header">이벤트 검색</div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="검색어 입력..."
              style={{ flex: 1, background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 13 }}
              autoFocus />
            <select value={searchType} onChange={e => setSearchType(e.target.value as SearchType)}
              style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 12 }}>
              <option value="name">이름</option>
              <option value="switch">스위치</option>
              <option value="variable">변수</option>
            </select>
            <button className="db-btn" onClick={handleSearch} disabled={searching}>
              {searching ? '검색 중...' : '검색'}
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #555', borderRadius: 3, background: '#2b2b2b' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#333', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#aaa', fontWeight: 'normal', borderBottom: '1px solid #555' }}>맵</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#aaa', fontWeight: 'normal', borderBottom: '1px solid #555', width: 60 }}>ID</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#aaa', fontWeight: 'normal', borderBottom: '1px solid #555' }}>이벤트 이름</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#aaa', fontWeight: 'normal', borderBottom: '1px solid #555', width: 50 }}>페이지</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.mapId}-${r.eventId}-${r.page}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigateToResult(r)}
                    onDoubleClick={() => { navigateToResult(r); setShow(false); }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2675bf')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #3a3a3a' }}>{r.mapName}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #3a3a3a', color: '#888' }}>{r.eventId}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #3a3a3a' }}>{r.eventName}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #3a3a3a', color: '#888' }}>{r.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && !error && !searching && (
              <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 12 }}>
                검색 결과가 여기에 표시됩니다
              </div>
            )}
            {searching && (
              <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 12 }}>검색 중...</div>
            )}
            {error && <div style={{ padding: 8, color: '#e55', fontSize: 12 }}>{error}</div>}
          </div>

          <div style={{ fontSize: 11, color: '#888' }}>
            {results.length > 0 ? `${results.length}건 검색됨 — 더블 클릭으로 이동` : ''}
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={() => setShow(false)}>닫기</button>
        </div>
      </div>
    </div>
  );
}
