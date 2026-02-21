import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import useEscClose from '../../hooks/useEscClose';

function ObjectImagePickerDialog({ onSelect, onClose }: {
  onSelect: (imageName: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  useEscClose(useCallback(() => onClose(), [onClose]));

  useEffect(() => {
    apiClient.get<string[]>('/resources/pictures').then(setFiles).catch(() => setFiles([]));
  }, []);

  const handleOk = () => {
    if (!selected) return;
    const name = selected.replace(/\.png$/i, '');
    // 이미지 로드하여 크기 얻기
    const img = new Image();
    img.onload = () => {
      onSelect(name);
      onClose();
    };
    img.onerror = () => {
      onSelect(name);
      onClose();
    };
    img.src = `/api/resources/pictures/${selected}`;
  };

  return (
    <div className="modal-overlay">
      <div className="image-picker-dialog">
        <div className="image-picker-header">이미지로 오브젝트 생성</div>
        <div className="image-picker-body">
          <div className="image-picker-list">
            {files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f)).map(f => {
              const name = f.replace(/\.(png|jpg|jpeg|webp)$/i, '');
              return (
                <div
                  key={f}
                  className={`image-picker-item${selected === f ? ' selected' : ''}`}
                  onClick={() => setSelected(f)}
                >
                  {name}
                </div>
              );
            })}
          </div>
          <div className="image-picker-preview-area">
            {selected && (
              <img
                src={`/api/resources/pictures/${selected}`}
                alt={selected}
                style={{ maxWidth: '100%', maxHeight: 300, imageRendering: 'pixelated' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
        </div>
        <div style={{ color: '#888', fontSize: '0.85em', padding: '4px 12px' }}>img/pictures 폴더의 이미지 파일을 오브젝트로 생성합니다.</div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => {
            apiClient.post('/resources/pictures/open-folder', {}).catch(() => {});
          }} style={{ marginRight: 'auto' }}>폴더 열기</button>
          <button className="db-btn" onClick={handleOk} disabled={!selected}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

export default ObjectImagePickerDialog;
