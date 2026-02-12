import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';

interface L10nConfig {
  sourceLanguage: string;
  languages: string[];
}

interface TranslationPopupProps {
  csvPath: string;
  entryKey: string;
  sourceText: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

const LANGUAGE_NAMES: Record<string, string> = {
  ko: '한국어', en: 'English', ja: '日本語', zh: '中文', fr: 'Français',
  de: 'Deutsch', es: 'Español', pt: 'Português', ru: 'Русский', it: 'Italiano',
};

export default function TranslationPopup({ csvPath, entryKey, sourceText, anchorRef, onClose }: TranslationPopupProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<L10nConfig | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await apiClient.get<L10nConfig>('/localization/config');
        if (!cfg || !cfg.sourceLanguage) {
          setLoading(false);
          return;
        }
        setConfig(cfg);

        // Load CSV and find the entry
        const rows = await apiClient.get<any[]>(`/localization/csv/${csvPath}`);
        const row = rows.find((r: any) => r.key === entryKey);
        if (row) {
          const trans: Record<string, string> = {};
          for (const lang of cfg.languages) {
            if (lang !== cfg.sourceLanguage) {
              trans[lang] = row[lang] || '';
            }
          }
          setTranslations(trans);
        }
      } catch {
        // If not initialized, just show empty
      }
      setLoading(false);
    })();
  }, [csvPath, entryKey]);

  const handleSave = useCallback(async (lang: string, text: string) => {
    setTranslations(prev => ({ ...prev, [lang]: text }));
    await apiClient.put('/localization/entry', { csvPath, key: entryKey, lang, text });
  }, [csvPath, entryKey]);

  // Position popup near anchor
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      let top = rect.bottom + 4;
      let left = rect.left;
      // Keep within viewport
      if (top + 400 > window.innerHeight) top = rect.top - 404;
      if (left + 520 > window.innerWidth) left = window.innerWidth - 530;
      setPos({ top, left });
    }
  }, [anchorRef]);

  if (!config) {
    return (
      <div className="l10n-popup-overlay">
        <div className="l10n-popup" style={{ top: pos.top, left: pos.left }}>
          <div style={{ color: '#888', padding: 8 }}>
            {loading ? t('common.loading') : t('localization.notInitialized')}
          </div>
        </div>
      </div>
    );
  }

  const targetLangs = config.languages.filter(l => l !== config.sourceLanguage);

  return (
    <div className="l10n-popup-overlay">
      <div
        ref={popupRef}
        className="l10n-popup"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="l10n-popup-title">{entryKey}</div>
        <div className="l10n-popup-source">{sourceText}</div>
        {targetLangs.map(lang => (
          <div key={lang} className="l10n-popup-lang">
            <div className="l10n-popup-lang-label">{LANGUAGE_NAMES[lang] || lang}</div>
            <textarea
              value={translations[lang] || ''}
              onChange={e => setTranslations(prev => ({ ...prev, [lang]: e.target.value }))}
              onBlur={e => handleSave(lang, e.target.value)}
            />
          </div>
        ))}
        <div className="l10n-popup-actions">
          <button className="db-btn" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
