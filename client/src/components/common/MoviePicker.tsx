import React, { useState, useEffect, useRef, useMemo } from 'react';
import apiClient from '../../api/client';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { highlightMatch } from '../../utils/highlightMatch';
import './AudioPicker.css';

interface MoviePickerProps {
  value: string;
  onChange: (name: string) => void;
  inline?: boolean;
}

const MOVIE_EXTENSIONS = /\.(mp4|webm)$/i;

export default function MoviePicker({ value, onChange, inline }: MoviePickerProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiClient.get<string[]>('/resources/movies').then(list => {
      setFiles(list.filter(f => MOVIE_EXTENSIONS.test(f)));
    }).catch(() => setFiles([]));
  }, []);

  useEffect(() => {
    if (inline) {
      onChange(selected);
    }
  }, [selected]);

  useEffect(() => {
    if (!listRef.current || !selected) return;
    const timer = setTimeout(() => {
      const el = listRef.current?.querySelector('.audio-picker-item.selected');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }, 50);
    return () => clearTimeout(timer);
  }, [files, selected]);

  const fileNames = useMemo(() => {
    const names = [...new Set(files.map(f => f.replace(MOVIE_EXTENSIONS, '')))];
    if (!searchQuery) return names;
    return names.filter(n => fuzzyMatch(n, searchQuery));
  }, [files, searchQuery]);

  const openFolder = () => {
    apiClient.post('/resources/movies/open-folder', {}).catch(() => {});
  };

  return (
    <div className="audio-picker-body-wrapper">
      <div className="audio-picker-search-bar">
        <input
          type="text"
          className="picker-search-input"
          placeholder="검색 (초성 지원: ㄱㄴㄷ)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="audio-picker-body">
      <div className="audio-picker-list" ref={listRef}>
        {!searchQuery && (
          <div
            className={`audio-picker-item${selected === '' ? ' selected' : ''}`}
            onClick={() => setSelected('')}
          >
            (없음)
          </div>
        )}
        {fileNames.map(name => (
          <div
            key={name}
            className={`audio-picker-item${selected === name ? ' selected' : ''}`}
            onClick={() => setSelected(name)}
          >
            {highlightMatch(name, searchQuery)}
          </div>
        ))}
      </div>
      <div className="audio-picker-controls">
        <div className="audio-picker-play-btns">
          <button className="audio-picker-btn" onClick={openFolder}>폴더 열기</button>
        </div>
        <div style={{ fontSize: 11, color: '#6a9f3a' }}>
          지원 형식: mp4, webm
        </div>
      </div>
    </div>
    </div>
  );
}
