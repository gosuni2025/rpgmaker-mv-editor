import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import Dialog from './common/Dialog';

export default function NewProjectDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowNewProjectDialog);
  const handleClose = useCallback(() => setShow(false), [setShow]);

  return (
    <Dialog
      title={t('newProject.title')}
      onClose={handleClose}
      width={460}
      style={{ height: 'auto', minHeight: 0 }}
      noBody
      footer={
        <button className="db-btn" onClick={handleClose}>{t('common.ok')}</button>
      }
    >
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>&#x1F6C8;</div>
        <p style={{ color: '#ddd', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {t('newProject.useRpgMakerMV')}
        </p>
        <p style={{ color: '#999', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
          {t('newProject.compatibilityNote')}
        </p>
      </div>
    </Dialog>
  );
}
