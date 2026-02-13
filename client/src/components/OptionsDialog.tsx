import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';

interface SettingsResponse {
  steamPath: string;
  detectedSteamPath: string | null;
}

export default function OptionsDialog() {
  const { t } = useTranslation();
  const transparentColor = useEditorStore((s) => s.transparentColor);
  const setTransparentColor = useEditorStore((s) => s.setTransparentColor);
  const maxUndo = useEditorStore((s) => s.maxUndo);
  const setMaxUndo = useEditorStore((s) => s.setMaxUndo);
  const setShowOptionsDialog = useEditorStore((s) => s.setShowOptionsDialog);

  const [localColor, setLocalColor] = useState(transparentColor);
  const [localLang, setLocalLang] = useState(i18n.language);
  const [localMaxUndo, setLocalMaxUndo] = useState(maxUndo);
  const [localSteamPath, setLocalSteamPath] = useState('');
  const [detectedSteamPath, setDetectedSteamPath] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<SettingsResponse>('/settings').then((data) => {
      setLocalSteamPath(data.steamPath || '');
      setDetectedSteamPath(data.detectedSteamPath);
    }).catch(() => {});
  }, []);

  const applySettings = async () => {
    setTransparentColor(localColor);
    setMaxUndo(localMaxUndo);
    if (localLang !== i18n.language) {
      i18n.changeLanguage(localLang);
      localStorage.setItem('editor-lang', localLang);
    }
    try {
      const result = await apiClient.put<SettingsResponse>('/settings', { steamPath: localSteamPath });
      setDetectedSteamPath(result.detectedSteamPath);
    } catch {}
  };

  const handleOK = async () => {
    await applySettings();
    setShowOptionsDialog(false);
  };

  const handleCancel = () => {
    setShowOptionsDialog(false);
  };

  const handleApply = () => {
    applySettings();
  };

  const checkerPreview = (color: { r: number; g: number; b: number }) => {
    const c1 = `rgb(${color.r}, ${color.g}, ${color.b})`;
    const c2 = `rgb(${Math.max(0, color.r - 48)}, ${Math.max(0, color.g - 48)}, ${Math.max(0, color.b - 48)})`;
    return {
      backgroundColor: c1,
      backgroundImage: `
        linear-gradient(45deg, ${c2} 25%, transparent 25%),
        linear-gradient(-45deg, ${c2} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${c2} 75%),
        linear-gradient(-45deg, transparent 75%, ${c2} 75%)
      `,
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      width: 80,
      height: 80,
      border: '1px solid #555',
      borderRadius: 3,
    };
  };

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 520, height: 'auto' }}>
        <div className="db-dialog-header">{t('options.title')}</div>
        <div className="db-dialog-body" style={{ flexDirection: 'column', overflowY: 'auto', padding: 16, gap: 16 }}>
          {/* RPG Maker MV Steam Path */}
          <div className="db-form-section">{t('options.steamPath')}</div>
          <div className="db-form" style={{ gap: 8 }}>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={localSteamPath}
                onChange={(e) => setLocalSteamPath(e.target.value)}
                placeholder={detectedSteamPath || t('options.steamPathPlaceholder')}
                style={{ flex: 1 }}
              />
            </label>
            {detectedSteamPath && !localSteamPath && (
              <div style={{ color: '#8c8', fontSize: 12 }}>
                {t('options.steamPathDetected')}: {detectedSteamPath}
              </div>
            )}
            {localSteamPath && (
              <div style={{ fontSize: 12 }}>
                <button
                  className="db-btn"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => setLocalSteamPath('')}
                >
                  {t('options.steamPathClear')}
                </button>
              </div>
            )}
            <div style={{ color: '#999', fontSize: 11 }}>
              {t('options.steamPathHelp')}
            </div>
          </div>

          {/* Transparent Color */}
          <div className="db-form-section">{t('options.transparentColor')}</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="db-form" style={{ flex: 1, gap: 8 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 48 }}>{t('options.red')}</span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={localColor.r}
                  onChange={(e) => setLocalColor({ ...localColor, r: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={localColor.r}
                  onChange={(e) => setLocalColor({ ...localColor, r: Math.min(255, Math.max(0, Number(e.target.value))) })}
                  style={{ width: 56 }}
                />
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 48 }}>{t('options.green')}</span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={localColor.g}
                  onChange={(e) => setLocalColor({ ...localColor, g: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={localColor.g}
                  onChange={(e) => setLocalColor({ ...localColor, g: Math.min(255, Math.max(0, Number(e.target.value))) })}
                  style={{ width: 56 }}
                />
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 48 }}>{t('options.blue')}</span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={localColor.b}
                  onChange={(e) => setLocalColor({ ...localColor, b: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={localColor.b}
                  onChange={(e) => setLocalColor({ ...localColor, b: Math.min(255, Math.max(0, Number(e.target.value))) })}
                  style={{ width: 56 }}
                />
              </label>
            </div>
            <div style={checkerPreview(localColor)} />
          </div>

          {/* Undo History */}
          <div className="db-form-section">{t('options.undoHistory')}</div>
          <div className="db-form" style={{ gap: 8 }}>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span>{t('options.maxUndoCount')}</span>
              <input
                type="number"
                min={1}
                max={999}
                value={localMaxUndo}
                onChange={(e) => setLocalMaxUndo(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                style={{ width: 80 }}
              />
            </label>
          </div>

          {/* Language */}
          <div className="db-form-section">{t('options.language')}</div>
          <div className="db-form" style={{ gap: 8 }}>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <select
                value={localLang}
                onChange={(e) => setLocalLang(e.target.value)}
                style={{ width: 200 }}
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOK}>{t('common.ok')}</button>
          <button className="db-btn" onClick={handleCancel}>{t('common.cancel')}</button>
          <button className="db-btn" onClick={handleApply}>{t('common.apply')}</button>
        </div>
      </div>
    </div>
  );
}
