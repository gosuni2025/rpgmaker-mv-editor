import React from 'react';
import { useTranslation } from 'react-i18next';
import HelpButton from './HelpButton';

export interface CacheBustOpts {
  scripts: boolean;
  images:  boolean;
  audio:   boolean;
  video:   boolean;
  data:    boolean;
  filterUnused: boolean;
  convertWebp: boolean;
}

export const DEFAULT_CACHE_BUST_OPTS: CacheBustOpts = {
  scripts: true,
  images:  true,
  audio:   true,
  video:   true,
  data:    true,
  filterUnused: false,
  convertWebp: true,
};

export const CB_KEYS = ['scripts', 'images', 'audio', 'video', 'data'] as const;

/** 캐시 버스팅 옵션을 query string 파라미터로 변환 */
export function cacheBustToQuery(opts: CacheBustOpts): string {
  const p = new URLSearchParams();
  for (const key of CB_KEYS) {
    p.set(`cb${key.charAt(0).toUpperCase()}${key.slice(1)}`, opts[key] ? '1' : '0');
  }
  p.set('cbFilterUnused', opts.filterUnused ? '1' : '0');
  p.set('cbConvertWebp', opts.convertWebp ? '1' : '0');
  return p.toString();
}

interface Props {
  opts: CacheBustOpts;
  onChange: (opts: CacheBustOpts) => void;
}

export default function CacheBustSection({ opts, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div style={{ background: '#2e2e2e', border: '1px solid #3e3e3e', borderRadius: 4, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color: '#bbb', fontSize: 12, fontWeight: 600 }}>{t('deploy.cacheBust.title')}</span>
        <HelpButton>
          <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 2 }}>{t('deploy.cacheBust.helpTitle')}</div>
          <div>{t('deploy.cacheBust.helpDesc')}</div>
          <div style={{ marginTop: 4, color: '#e8a040' }}>⚠ {t('deploy.cacheBust.helpDisabled')}</div>
        </HelpButton>
      </div>

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

      {/* ── WebP 변환 ── */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #3a3a3a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flex: 1 }}>
            <input
              type="checkbox"
              checked={opts.convertWebp}
              onChange={(e) => onChange({ ...opts, convertWebp: e.target.checked })}
            />
            <span style={{ color: '#ccc', fontSize: 12 }}>{t('deploy.cacheBust.convertWebp')}</span>
          </label>
          <HelpButton>
            <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 4 }}>{t('deploy.cacheBust.convertWebpHelp')}</div>
            <div>· {t('deploy.cacheBust.convertWebpDesc1')}</div>
            <div>· {t('deploy.cacheBust.convertWebpDesc2')}</div>
            <div style={{ marginTop: 4, color: '#5af' }}>ℹ {t('deploy.cacheBust.convertWebpNote')}</div>
          </HelpButton>
        </div>
      </div>

      {/* ── 미사용 에셋 필터 ── */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #3a3a3a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flex: 1 }}>
            <input
              type="checkbox"
              checked={opts.filterUnused}
              onChange={(e) => onChange({ ...opts, filterUnused: e.target.checked })}
            />
            <span style={{ color: '#ccc', fontSize: 12 }}>{t('deploy.cacheBust.filterUnused')}</span>
          </label>
          <HelpButton>
            <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 4 }}>{t('deploy.cacheBust.filterUnusedHelp')}</div>
            <div>· {t('deploy.cacheBust.filterUnusedDesc1')}</div>
            <div>· {t('deploy.cacheBust.filterUnusedDesc2')}</div>
            <div>· {t('deploy.cacheBust.filterUnusedDesc3')}</div>
            <div style={{ marginTop: 4, color: '#e8a040' }}>⚠ {t('deploy.cacheBust.filterUnusedWarn')}</div>
            <div style={{ marginTop: 4, color: '#5af' }}>ℹ {t('deploy.cacheBust.filterUnusedItchio')}</div>
          </HelpButton>
        </div>
      </div>
    </div>
  );
}
