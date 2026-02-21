import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import Dialog from './common/Dialog';
import apiClient from '../api/client';

type SearchType = 'name' | 'switch' | 'variable';

interface SearchResult {
  mapId: number;
  mapName: string;
  eventId: number;
  eventName: string;
  page?: number;
}

export default function FindDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowFindDialog);
  const handleClose = useCallback(() => setShow(false), [setShow]);
  const selectMap = useEditorStore((s) => s.selectMap);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('name');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
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
      setSelectedIndex(res.length > 0 ? 0 : -1);
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

  const searchNext = () => {
    if (results.length === 0) return;
    const next = (selectedIndex + 1) % results.length;
    setSelectedIndex(next);
    navigateToResult(results[next]);
  };

  const searchPrev = () => {
    if (results.length === 0) return;
    const prev = (selectedIndex - 1 + results.length) % results.length;
    setSelectedIndex(prev);
    navigateToResult(results[prev]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <Dialog
      title={t('find.title')}
      onClose={handleClose}
      width={560}
      style={{ height: 420, minHeight: 0 }}
      noBody
      footer={
        <button className="db-btn" onClick={handleClose}>{t('common.close')}</button>
      }
    >
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown} placeholder={t('find.placeholder')}
            style={{ flex: 1, background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 13 }}
            autoFocus />
          <select value={searchType} onChange={e => setSearchType(e.target.value as SearchType)}
            style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 12 }}>
            <option value="name">{t('find.typeName')}</option>
            <option value="switch">{t('find.typeSwitch')}</option>
            <option value="variable">{t('find.typeVariable')}</option>
          </select>
          <button className="db-btn" onClick={handleSearch} disabled={searching}>
            {searching ? t('find.searching') : t('find.search')}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #555', borderRadius: 3, background: '#2b2b2b' }}>
          {results.length === 0 && !error && (
            <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 12 }}>
              {searching ? t('find.searching') : t('find.resultsPlaceholder')}
            </div>
          )}
          {error && <div style={{ padding: 8, color: '#e55', fontSize: 12 }}>{error}</div>}
          {results.map((r, i) => (
            <div key={`${r.mapId}-${r.eventId}-${r.page ?? 0}`}
              style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: 12,
                display: 'flex', gap: 12,
                background: i === selectedIndex ? '#2675bf' : 'transparent',
              }}
              onClick={() => { setSelectedIndex(i); navigateToResult(r); }}>
              <span style={{ color: '#aaa', minWidth: 80 }}>{r.mapName}</span>
              <span style={{ color: '#888', minWidth: 40 }}>#{r.eventId}</span>
              <span style={{ flex: 1 }}>{r.eventName}</span>
              {r.page !== undefined && <span style={{ color: '#888' }}>P{r.page}</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888' }}>
            {results.length > 0 ? t('find.resultsCount', { count: results.length, current: selectedIndex + 1, total: results.length }) : ''}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="db-btn" onClick={searchPrev} disabled={results.length === 0}>{t('find.prev')}</button>
            <button className="db-btn" onClick={searchNext} disabled={results.length === 0}>{t('find.next')}</button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
