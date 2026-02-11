import React from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';

export default function NewProjectDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowNewProjectDialog);

  return (
    <div className="db-dialog-overlay" onClick={() => setShow(false)}>
      <div className="db-dialog" style={{ width: 460, height: 'auto', minHeight: 0 }} onClick={e => e.stopPropagation()}>
        <div className="db-dialog-header">{t('newProject.title')}</div>
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>&#x1F6C8;</div>
          <p style={{ color: '#ddd', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {t('newProject.useRpgMakerMV')}
          </p>
          <p style={{ color: '#999', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
            {t('newProject.compatibilityNote')}
          </p>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={() => setShow(false)}>{t('common.ok')}</button>
        </div>
      </div>
    </div>
  );
}
