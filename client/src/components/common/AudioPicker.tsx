import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import type { AudioFile } from '../../types/rpgMakerMV';
import './AudioPicker.css';

interface AudioPickerProps {
  type: 'bgm' | 'bgs' | 'me' | 'se';
  value: AudioFile;
  onChange: (audio: AudioFile) => void;
}

export default function AudioPicker({ type, value, onChange }: AudioPickerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value.name);
  const [volume, setVolume] = useState(value.volume);
  const [pitch, setPitch] = useState(value.pitch);
  const [pan, setPan] = useState(value.pan);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    apiClient.get<string[]>(`/audio/${type}`).then(setFiles).catch(() => setFiles([]));
    setSelected(value.name);
    setVolume(value.volume);
    setPitch(value.pitch);
    setPan(value.pan);
  }, [open, type]);

  // Scroll selected item into view when list loads
  useEffect(() => {
    if (!open || !listRef.current || !selected) return;
    const timer = setTimeout(() => {
      const el = listRef.current?.querySelector('.audio-picker-item.selected');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }, 50);
    return () => clearTimeout(timer);
  }, [open, files, selected]);

  const fileNames = [...new Set(files.map(f => f.replace(/\.(ogg|m4a|wav|mp3)$/i, '')))];

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

  const label = type.toUpperCase();
  const displayName = value.name || '(없음)';

  return (
    <div className="audio-picker">
      <div className="audio-picker-preview" onClick={() => setOpen(true)}>
        <span>{displayName}</span>
        {value.name && <span className="audio-picker-info">Vol:{value.volume} Pitch:{value.pitch}</span>}
      </div>
      {open && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}>
          <div className="audio-picker-dialog">
            <div className="audio-picker-header">오디오 선택</div>
            <div className="audio-picker-body">
              <div className="audio-picker-list" ref={listRef}>
                <div
                  className={`audio-picker-item${selected === '' ? ' selected' : ''}`}
                  onClick={() => setSelected('')}
                >
                  (없음)
                </div>
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
