import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';

const RESOURCE_FOLDERS = [
  'img/characters',
  'img/faces',
  'img/tilesets',
  'img/parallaxes',
  'img/battlebacks1',
  'img/battlebacks2',
  'img/animations',
  'img/enemies',
  'img/sv_actors',
  'img/sv_enemies',
  'img/system',
  'img/titles1',
  'img/titles2',
  'audio/bgm',
  'audio/bgs',
  'audio/me',
  'audio/se',
];

interface ResourceFile {
  name: string;
  size?: number;
}

export default function ResourceManagerDialog() {
  const { t } = useTranslation();
  const setShowResourceManagerDialog = useEditorStore((s) => s.setShowResourceManagerDialog);
  const [selectedFolder, setSelectedFolder] = useState(RESOURCE_FOLDERS[0]);
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImageFolder = selectedFolder.startsWith('img/');

  useEffect(() => {
    loadFiles(selectedFolder);
  }, [selectedFolder]);

  const loadFiles = async (folder: string) => {
    setLoading(true);
    setSelectedFile(null);
    try {
      const type = folder.replace('/', '_');
      const data = await apiClient.get<(string | ResourceFile)[]>(`/resources/${type}`);
      if (!Array.isArray(data)) { setFiles([]); return; }
      // API may return string[] or ResourceFile[] - normalize
      setFiles(data.map((item) => typeof item === 'string' ? { name: item } : item));
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const type = selectedFolder.replace('/', '_');
      await fetch(`/api/resources/${type}/upload`, { method: 'POST', body: formData });
      loadFiles(selectedFolder);
    } catch (err) {
      console.error('Import failed:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    if (!selectedFile) return;
    const type = selectedFolder.replace('/', '_');
    window.open(`/api/resources/${type}/${encodeURIComponent(selectedFile)}`);
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    if (!confirm(t('resourceManager.confirmDelete', { name: selectedFile }))) return;
    try {
      const type = selectedFolder.replace('/', '_');
      await fetch(`/api/resources/${type}/${encodeURIComponent(selectedFile)}`, { method: 'DELETE' });
      loadFiles(selectedFolder);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleClose = () => setShowResourceManagerDialog(false);

  const previewUrl = selectedFile && isImageFolder
    ? `/api/resources/${selectedFolder.replace('/', '_')}/${encodeURIComponent(selectedFile)}`
    : null;

  return (
    <div className="db-dialog-overlay" onClick={handleClose}>
      <div className="db-dialog" onClick={(e) => e.stopPropagation()} style={{ width: '70vw', height: '70vh' }}>
        <div className="db-dialog-header">{t('resourceManager.title')}</div>
        <div className="db-dialog-body">
          {/* Folder list */}
          <div className="db-list" style={{ width: 180, minWidth: 180 }}>
            {RESOURCE_FOLDERS.map((folder) => (
              <div
                key={folder}
                className={`db-list-item${folder === selectedFolder ? ' selected' : ''}`}
                onClick={() => setSelectedFolder(folder)}
              >
                {folder}
              </div>
            ))}
          </div>

          {/* File list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #555' }}>
            <div style={{ flex: 1, overflowY: 'auto', background: '#353535' }}>
              {loading && <div className="db-loading">{t('resourceManager.loading')}</div>}
              {!loading && files.length === 0 && (
                <div className="db-placeholder">{t('resourceManager.noFiles')}</div>
              )}
              {!loading && files.map((file) => (
                <div
                  key={file.name}
                  className={`db-list-item${file.name === selectedFile ? ' selected' : ''}`}
                  onClick={() => setSelectedFile(file.name)}
                >
                  {file.name}
                </div>
              ))}
            </div>
            <div style={{ padding: '8px', borderTop: '1px solid #555', display: 'flex', gap: 8 }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                style={{ display: 'none' }}
              />
              <button className="db-btn" onClick={() => fileInputRef.current?.click()}>{t('resourceManager.import')}</button>
              <button className="db-btn" onClick={handleExport} disabled={!selectedFile}>{t('resourceManager.export')}</button>
              <button className="db-btn" onClick={handleDelete} disabled={!selectedFile}>{t('common.delete')}</button>
            </div>
          </div>

          {/* Preview */}
          <div style={{ width: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2b2b2b', padding: 16 }}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={selectedFile || ''}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
              />
            ) : (
              <span style={{ color: '#666', fontSize: 12 }}>
                {selectedFile ? t('resourceManager.noPreview') : t('resourceManager.selectFile')}
              </span>
            )}
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
