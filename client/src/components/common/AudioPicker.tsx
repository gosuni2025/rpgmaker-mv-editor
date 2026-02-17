import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import type { AudioFile } from '../../types/rpgMakerMV';
import useEscClose from '../../hooks/useEscClose';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import './AudioPicker.css';

interface AudioPickerProps {
  type: 'bgm' | 'bgs' | 'me' | 'se';
  value: AudioFile;
  onChange: (audio: AudioFile) => void;
  /** inline 모드: 모달 없이 바로 목록/컨트롤 표시 (이벤트 커맨드 에디터용) */
  inline?: boolean;
}

export default function AudioPicker({ type, value, onChange, inline }: AudioPickerProps) {
  const [open, setOpen] = useState(false);
  useEscClose(useCallback(() => { if (open && !inline) setOpen(false); }, [open, inline]));
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value.name);
  const [volume, setVolume] = useState(value.volume);
  const [pitch, setPitch] = useState(value.pitch);
  const [pan, setPan] = useState(value.pan);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const active = inline || open;

  useEffect(() => {
    if (!active) return;
    apiClient.get<string[]>(`/audio/${type}`).then(setFiles).catch(() => setFiles([]));
    if (!inline) {
      setSelected(value.name);
      setVolume(value.volume);
      setPitch(value.pitch);
      setPan(value.pan);
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [active, type]);

  // inline 모드: 값이 바뀔 때 부모에게 전파
  useEffect(() => {
    if (!inline) return;
    onChange({ name: selected, volume, pitch, pan });
  }, [selected, volume, pitch, pan]);

  // 컴포넌트 언마운트 시 재생 중지
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Scroll selected item into view when list loads
  useEffect(() => {
    if (!active || !listRef.current || !selected) return;
    const timer = setTimeout(() => {
      const el = listRef.current?.querySelector('.audio-picker-item.selected');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }, 50);
    return () => clearTimeout(timer);
  }, [active, files, selected]);

  const fileNames = useMemo(() => {
    const names = [...new Set(files.map(f => f.replace(/\.(ogg|m4a|wav|mp3)$/i, '')))];
    if (!searchQuery) return names;
    return names.filter(n => fuzzyMatch(n, searchQuery));
  }, [files, searchQuery]);

  const play = (name?: string) => {
    const n = name || selected;
    if (!n) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const ext = files.find(f => f.startsWith(n + '.'))?.split('.').pop() || 'ogg';
    const audio = new Audio(`/api/audio/${type}/${n}.${ext}`);
    audio.volume = volume / 100;
    audio.playbackRate = pitch / 100;
    audio.play().catch(() => {});
    audioRef.current = audio;
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleOk = () => {
    stop();
    onChange({ name: selected, volume, pitch, pan });
    setOpen(false);
  };

  const handleCancel = () => {
    stop();
    setOpen(false);
  };

  const displayName = value.name || '(없음)';

  const bodyContent = (
    <div className="audio-picker-body-wrapper">
      <div className="audio-picker-search-bar">
        <input
          ref={searchInputRef}
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
            onDoubleClick={() => { setSelected(name); play(name); }}
          >
            {name}
          </div>
        ))}
      </div>
      <div className="audio-picker-controls">
        <div className="audio-picker-play-btns">
          <button className="audio-picker-btn" onClick={() => play()}>재생</button>
          <button className="audio-picker-btn" onClick={stop}>정지</button>
          <button className="audio-picker-btn" style={{ marginLeft: 'auto' }} onClick={() => {
            apiClient.post(`/audio/${type}/open-folder`, {}).catch(() => {});
          }}>폴더 열기</button>
        </div>

        <div className="audio-picker-slider-group">
          <span className="audio-picker-slider-title">볼륨</span>
          <input type="range" min={0} max={100} value={volume}
            onChange={e => setVolume(Number(e.target.value))} />
          <div className="audio-picker-value-input">
            <input type="number" min={0} max={100} value={volume}
              onChange={e => setVolume(Math.max(0, Math.min(100, Number(e.target.value))))} />
            <span>%</span>
          </div>
        </div>

        <div className="audio-picker-slider-group">
          <span className="audio-picker-slider-title">빠르기</span>
          <input type="range" min={50} max={150} value={pitch}
            onChange={e => setPitch(Number(e.target.value))} />
          <div className="audio-picker-value-input">
            <input type="number" min={50} max={150} value={pitch}
              onChange={e => setPitch(Math.max(50, Math.min(150, Number(e.target.value))))} />
            <span>%</span>
          </div>
        </div>

        <div className="audio-picker-slider-group">
          <span className="audio-picker-slider-title">좌우</span>
          <input type="range" min={-100} max={100} value={pan}
            onChange={e => setPan(Number(e.target.value))} />
          <div className="audio-picker-value-input">
            <input type="number" min={-100} max={100} value={pan}
              onChange={e => setPan(Math.max(-100, Math.min(100, Number(e.target.value))))} />
          </div>
        </div>
      </div>
    </div>
    </div>
  );

  // inline 모드: 모달 없이 바로 표시
  if (inline) {
    return bodyContent;
  }

  return (
    <div className="audio-picker">
      <button className="audio-picker-preview-btn" onClick={() => setOpen(true)}>
        <span className="audio-picker-preview-name">{displayName}</span>
        <span className="audio-picker-preview-dots">...</span>
      </button>
      {open && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}>
          <div className="audio-picker-dialog">
            <div className="audio-picker-header">오디오 선택</div>
            {bodyContent}
            <div className="audio-picker-footer">
              <button className="db-btn" onClick={handleOk}>OK</button>
              <button className="db-btn" onClick={handleCancel}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
