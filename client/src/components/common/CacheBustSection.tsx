import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface CacheBustOpts {
  scripts: boolean;
  images:  boolean;
  audio:   boolean;
  video:   boolean;
  data:    boolean;
}

export const DEFAULT_CACHE_BUST_OPTS: CacheBustOpts = {
  scripts: true,
  images:  true,
  audio:   true,
  video:   true,
  data:    true,
};

export const CB_KEYS = ['scripts', 'images', 'audio', 'video', 'data'] as const;

/** 캐시 버스팅 옵션을 query string 파라미터로 변환 */
export function cacheBustToQuery(opts: CacheBustOpts): string {
  const p = new URLSearchParams();
  for (const key of CB_KEYS) {
    p.set(`cb${key.charAt(0).toUpperCase()}${key.slice(1)}`, opts[key] ? '1' : '0');
  }
  return p.toString();
}

interface Props {
  opts: CacheBustOpts;
  onChange: (opts: CacheBustOpts) => void;
}

export default function CacheBustSection({ opts, onChange }: Props) {
  const { t } = useTranslation();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div style={{ background: '#2e2e2e', border: '1px solid #3e3e3e', borderRadius: 4, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: helpOpen ? 8 : 6 }}>
        <span style={{ color: '#bbb', fontSize: 12, fontWeight: 600 }}>{t('deploy.cacheBust.title')}</span>
        <button
          onClick={() => setHelpOpen((v) => !v)}
          title={t('deploy.cacheBust.helpTitle')}
          style={{
            background: helpOpen ? '#2675bf' : '#444',
            border: '1px solid #555',
            borderRadius: '50%',
            width: 16,
            height: 16,
            color: '#ddd',
            fontSize: 10,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >?</button>
      </div>

      {helpOpen && (
        <div style={{
          background: '#252525',
          border: '1px solid #3a3a3a',
          borderRadius: 3,
          padding: '8px 10px',
          marginBottom: 8,
          fontSize: 11,
          color: '#aaa',
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 2 }}>{t('deploy.cacheBust.helpTitle')}</div>
          <div>{t('deploy.cacheBust.helpDesc')}</div>
          <div style={{ marginTop: 4, color: '#e8a040' }}>⚠ {t('deploy.cacheBust.helpDisabled')}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 18px' }}>
        {CB_KEYS.map((key) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={opts[key]}
              onChange={(e) => onChange({ ...opts, [key]: e.target.checked })}
            />
            <span style={{ color: '#ccc', fontSize: 12 }}>{t(`deploy.cacheBust.${key}`)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
