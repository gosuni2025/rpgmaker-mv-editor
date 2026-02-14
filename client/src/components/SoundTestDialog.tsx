import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';

type AudioType = 'bgm' | 'bgs' | 'me' | 'se';

interface AudioFile {
  name: string;
}

export default function SoundTestDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowSoundTestDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));
  const [tab, setTab] = useState<AudioType>('bgm');
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(80);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get<(string | AudioFile)[]>(`/audio/${tab}`);
        if (!cancelled) {
          // Server returns string[] — normalize to AudioFile[]
          const normalized = Array.isArray(res)
            ? res.map(item => typeof item === 'string' ? { name: item } : item)
            : [];
          // Deduplicate: show base names without extension, prefer .ogg
          const nameMap = new Map<string, AudioFile>();
          for (const f of normalized) {
            const base = f.name.replace(/\.(ogg|m4a|mp3|wav)$/i, '');
            if (!nameMap.has(base)) nameMap.set(base, { name: base });
          }
          setFiles(Array.from(nameMap.values()));
          setSelectedIndex(nameMap.size > 0 ? 0 : -1);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const handlePlay = (file: AudioFile) => {
    handleStop();
    // Try .ogg first, fall back to .m4a
    const tryPlay = (ext: string) => {
      const audio = new Audio(`/api/audio/${tab}/${encodeURIComponent(file.name)}.${ext}`);
      audio.volume = volume / 100;
      audio.onended = () => setPlaying(null);
      audio.onerror = () => {
        if (ext === 'ogg') {
          tryPlay('m4a');
        } else {
          setError(t('soundTest.playFailed'));
          setPlaying(null);
        }
      };
      audio.play().catch(() => {
        if (ext === 'ogg') tryPlay('m4a');
        else { setError(t('soundTest.playFailed')); setPlaying(null); }
      });
      audioRef.current = audio;
    };
    setPlaying(file.name);
    tryPlay('ogg');
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlaying(null);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const tabs: { key: AudioType; label: string }[] = [
    { key: 'bgm', label: 'BGM' },
    { key: 'bgs', label: 'BGS' },
    { key: 'me', label: 'ME' },
    { key: 'se', label: 'SE' },
  ];

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 500, height: 420 }}>
        <div className="db-dialog-header">{t('soundTest.title')}</div>
        <div className="db-dialog-body" style={{ flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #555', background: '#333' }}>
            {tabs.map(tb => (
              <button key={tb.key}
                className={`opd-tab${tab === tb.key ? ' active' : ''}`}
                onClick={() => { handleStop(); setTab(tb.key); }}>
                {tb.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div className="db-loading">{t('soundTest.loading')}</div>}
            {error && <div style={{ padding: 8, color: '#e55', fontSize: 12 }}>{error}</div>}
            {!loading && files.map((f, i) => (
              <div key={f.name}
                className={`db-list-item${i === selectedIndex ? ' selected' : ''}`}
                onClick={() => setSelectedIndex(i)}
                onDoubleClick={() => handlePlay(f)}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {playing === f.name && <span style={{ color: '#6c6', fontSize: 10 }}>▶</span>}
                <span>{f.name}</span>
              </div>
            ))}
            {!loading && files.length === 0 && !error && (
              <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 12 }}>{t('soundTest.noFiles')}</div>
            )}
          </div>

          <div style={{ padding: '8px 12px', borderTop: '1px solid #555', background: '#333', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="db-btn-small" onClick={() => {
              if (selectedIndex >= 0 && files[selectedIndex]) handlePlay(files[selectedIndex]);
            }} disabled={selectedIndex < 0}>{t('soundTest.play')}</button>
            <button className="db-btn-small" onClick={handleStop} disabled={!playing}>{t('soundTest.stop')}</button>
            <div className="db-slider-row" style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: '#aaa', minWidth: 30 }}>{t('soundTest.volume')}</span>
              <input type="range" min={0} max={100} value={volume}
                onChange={e => setVolume(Number(e.target.value))} />
              <span className="db-slider-value">{volume}%</span>
            </div>
          </div>

          {playing && (
            <div style={{ padding: '4px 12px', fontSize: 11, color: '#6c6', background: '#1a3a1a', borderTop: '1px solid #2a4a2a' }}>
              {t('soundTest.playing', { name: playing })}
            </div>
          )}
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={() => { handleStop(); setShow(false); }}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
