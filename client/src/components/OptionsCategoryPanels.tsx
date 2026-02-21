import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import apiClient from '../api/client';

interface AutoSaveSettings {
  enabled: boolean;
  intervalMinutes: number;
  gitCommit: boolean;
  gitAddAll: boolean;
}

interface GitStatusResponse {
  gitAvailable: boolean;
  isGitRepo: boolean;
}

// --- General ---

export function GeneralPanel({ localLang, setLocalLang, localMaxUndo, setLocalMaxUndo }: {
  localLang: string; setLocalLang: (v: string) => void;
  localMaxUndo: number; setLocalMaxUndo: (v: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="options-content-title">{t('options.categories.general')}</div>
      <div className="db-form-section">{t('options.language')}</div>
      <div className="db-form" style={{ gap: 8 }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <select value={localLang} onChange={(e) => { setLocalLang(e.target.value); i18n.changeLanguage(e.target.value); }} style={{ width: 200 }}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
      </div>
      <div className="db-form-section">{t('options.undoHistory')}</div>
      <div className="db-form" style={{ gap: 8 }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span>{t('options.maxUndoCount')}</span>
          <input type="number" min={1} max={999} value={localMaxUndo}
            onChange={(e) => setLocalMaxUndo(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} style={{ width: 80 }} />
        </label>
      </div>
    </>
  );
}

// --- Appearance ---

function checkerPreview(color: { r: number; g: number; b: number }) {
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
    width: 80, height: 80, border: '1px solid #555', borderRadius: 3,
  };
}

export function AppearancePanel({ localColor, setLocalColor }: {
  localColor: { r: number; g: number; b: number };
  setLocalColor: (v: { r: number; g: number; b: number }) => void;
}) {
  const { t } = useTranslation();
  const channels: { key: 'r' | 'g' | 'b'; label: string }[] = [
    { key: 'r', label: t('options.red') },
    { key: 'g', label: t('options.green') },
    { key: 'b', label: t('options.blue') },
  ];
  return (
    <>
      <div className="options-content-title">{t('options.categories.appearance')}</div>
      <div className="db-form-section">{t('options.transparentColor')}</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div className="db-form" style={{ flex: 1, gap: 8 }}>
          {channels.map(({ key, label }) => (
            <label key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 48 }}>{label}</span>
              <input type="range" min={0} max={255} value={localColor[key]}
                onChange={(e) => setLocalColor({ ...localColor, [key]: Number(e.target.value) })} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={localColor[key]}
                onChange={(e) => setLocalColor({ ...localColor, [key]: Math.min(255, Math.max(0, Number(e.target.value))) })} style={{ width: 56 }} />
            </label>
          ))}
        </div>
        <div style={checkerPreview(localColor)} />
      </div>
    </>
  );
}

// --- Map Editor ---

export function MapEditorPanel({ localZoomStep, setLocalZoomStep, localImagePrefetch, setLocalImagePrefetch, hasProject }: {
  localZoomStep: number; setLocalZoomStep: (v: number) => void;
  localImagePrefetch: boolean; setLocalImagePrefetch: (v: boolean) => void;
  hasProject: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="options-content-title">{t('options.categories.mapEditor')}</div>
      <div className="db-form-section">{t('options.zoomStep')}</div>
      <div className="db-form" style={{ gap: 8 }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span>{t('options.zoomStepPercent')}</span>
          <input type="number" min={1} max={100} value={localZoomStep}
            onChange={(e) => setLocalZoomStep(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} style={{ width: 80 }} />
          <span>%</span>
        </label>
      </div>
      <div className="db-form-section" style={{ marginTop: 16 }}>이미지 선택기 (프로젝트 설정)</div>
      <div className="db-form" style={{ gap: 8 }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: hasProject ? 1 : 0.4 }}
          title={hasProject ? '' : '프로젝트를 열어야 설정할 수 있습니다'}>
          <input type="checkbox" checked={localImagePrefetch}
            disabled={!hasProject}
            onChange={e => setLocalImagePrefetch(e.target.checked)} />
          <span>하위폴더 미리 읽기</span>
        </label>
        <div style={{ fontSize: 11, color: '#888', paddingLeft: 20 }}>
          끄면 현재 폴더 내 파일만 로드합니다. 이미지가 많은 프로젝트에서 권장합니다.
        </div>
      </div>
    </>
  );
}

// --- Auto Save ---

export function AutoSavePanel({ localAutoSave, setLocalAutoSave, gitStatus }: {
  localAutoSave: AutoSaveSettings; setLocalAutoSave: (v: AutoSaveSettings) => void;
  gitStatus: GitStatusResponse;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="options-content-title">{t('options.categories.autoSave')}</div>
      <div className="db-form-section">{t('options.autoSaveSection')}</div>
      <div className="db-form" style={{ gap: 8 }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={localAutoSave.enabled}
            onChange={(e) => setLocalAutoSave({ ...localAutoSave, enabled: e.target.checked })} />
          <span>{t('options.autoSaveEnabled')}</span>
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 24 }}>
          <span>{t('options.autoSaveInterval')}</span>
          <input type="number" min={1} max={60} value={localAutoSave.intervalMinutes}
            onChange={(e) => setLocalAutoSave({ ...localAutoSave, intervalMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
            style={{ width: 60 }} disabled={!localAutoSave.enabled} />
          <span>{t('options.minutes')}</span>
        </label>
      </div>
      <div className="db-form-section" style={{ marginTop: 16 }}>Git</div>
      {!gitStatus.gitAvailable ? (
        <div style={{ padding: '8px 0' }}>
          <div style={{ color: '#ff4444', fontWeight: 'bold', marginBottom: 8 }}>{t('options.gitNotInstalled')}</div>
          <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer" style={{ color: '#4ea1f3' }}>
            {t('options.gitDownloadLink')}
          </a>
        </div>
      ) : (
        <div className="db-form" style={{ gap: 8 }}>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={localAutoSave.gitCommit}
              onChange={(e) => setLocalAutoSave({ ...localAutoSave, gitCommit: e.target.checked })}
              disabled={!localAutoSave.enabled} />
            <span>{t('options.gitAutoCommit')}</span>
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 24 }}>
            <input type="checkbox" checked={localAutoSave.gitAddAll}
              onChange={(e) => setLocalAutoSave({ ...localAutoSave, gitAddAll: e.target.checked })}
              disabled={!localAutoSave.enabled || !localAutoSave.gitCommit} />
            <span>{t('options.gitAddAll')}</span>
          </label>
          {!gitStatus.isGitRepo && localAutoSave.gitCommit && (
            <div style={{ color: '#f0ad4e', fontSize: 12, marginLeft: 24 }}>{t('options.gitWillInit')}</div>
          )}
        </div>
      )}
    </>
  );
}

// --- Paths ---

export function PathsPanel({ localSteamPath, setLocalSteamPath, detectedSteamPath }: {
  localSteamPath: string; setLocalSteamPath: (v: string) => void;
  detectedSteamPath: string | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="options-content-title">{t('options.categories.paths')}</div>
      <div className="db-form-section">{t('options.steamPath')}</div>
      <div className="db-form" style={{ gap: 8 }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="text" value={localSteamPath} onChange={(e) => setLocalSteamPath(e.target.value)}
            placeholder={detectedSteamPath || t('options.steamPathPlaceholder')} style={{ flex: 1 }} />
        </label>
        {detectedSteamPath && !localSteamPath && (
          <div style={{ color: '#8c8', fontSize: 12 }}>{t('options.steamPathDetected')}: {detectedSteamPath}</div>
        )}
        {localSteamPath && (
          <div style={{ fontSize: 12 }}>
            <button className="db-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setLocalSteamPath('')}>
              {t('options.steamPathClear')}
            </button>
          </div>
        )}
        <div style={{ color: '#999', fontSize: 11 }}>{t('options.steamPathHelp')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <button className="db-btn" style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => apiClient.post('/settings/open-folder', {}).catch(() => {})}>{t('options.steamOpenFolder')}</button>
          <button className="db-btn" style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setLocalSteamPath('C:\\Program Files (x86)\\Steam\\steamapps\\common\\RPG Maker MV')}>{t('options.steamFillWindows')}</button>
          <button className="db-btn" style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setLocalSteamPath('~/Library/Application Support/Steam/steamapps/common/RPG Maker MV')}>{t('options.steamFillMac')}</button>
          <button className="db-btn" style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setLocalSteamPath('~/.steam/steam/steamapps/common/RPG Maker MV')}>{t('options.steamFillLinux')}</button>
          <button className="db-btn" style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => window.open('/api/settings', '_blank')}>{t('options.steamOpenSettings')}</button>
        </div>
      </div>
    </>
  );
}
