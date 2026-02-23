import React, { useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import './UIEditor.css';

export default function UIEditorFrameInspector() {
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSkinCornerSize = useEditorStore((s) => s.uiSkinCornerSize);
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);
  const projectPath = useEditorStore((s) => s.projectPath);
  const uploadRef = useRef<HTMLInputElement>(null);

  // cornerSize를 UIEditorSkins.json에 저장
  const saveSkinCornerSize = useCallback(async (size: number) => {
    if (!projectPath || !uiSelectedSkin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(uiSelectedSkin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cornerSize: size }),
    });
  }, [projectPath, uiSelectedSkin]);

  // 기본 스킨 설정 → UIEditorConfig + cornerSize 저장 + UITheme.js 생성
  const handleSetDefault = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      const config = useEditorStore.getState().uiEditorOverrides;
      await fetch('/api/ui-editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: config, defaultSkin: uiSelectedSkin }),
      });
      await saveSkinCornerSize(uiSkinCornerSize);
      await fetch('/api/ui-editor/generate-plugin', { method: 'POST' });
      setUiEditorDirty(false);
      useEditorStore.getState().showToast(`기본 스킨: ${uiSelectedSkin} 설정 완료`);
    } catch {
      useEditorStore.getState().showToast('저장 실패', true);
    }
  };

  // PNG 업로드 (서버에서 자동으로 스킨 목록에 등록됨)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nameRaw = file.name.replace(/\.png$/i, '');
    const name = nameRaw.replace(/[^a-zA-Z0-9_\-가-힣]/g, '_') || 'CustomSkin';
    try {
      const buf = await file.arrayBuffer();
      const res = await fetch(`/api/ui-editor/upload-skin?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: buf,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      useEditorStore.getState().showToast(`스킨 업로드: ${name}`);
      window.dispatchEvent(new Event('ui-skin-uploaded'));
    } catch (err) {
      useEditorStore.getState().showToast(`업로드 실패: ${(err as Error).message}`, true);
    }
    if (uploadRef.current) uploadRef.current.value = '';
  };

  return (
    <div className="ui-editor-inspector">
      <div className="ui-editor-inspector-header">프레임 인스펙터</div>
      <div className="ui-editor-inspector-body">

        {/* 현재 스킨 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">선택된 스킨</div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label" style={{ fontSize: 13, color: '#ddd' }}>
              {uiSelectedSkin || '—'}
            </div>
          </div>
          <div className="ui-inspector-row" style={{ paddingTop: 0 }}>
            <div className="ui-inspector-label" style={{ fontSize: 11, color: '#777' }}>
              img/system/{uiSelectedSkin}.png
            </div>
          </div>
        </div>

        {/* 9-slice 파라미터 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">9-Slice 파라미터</div>
          <div className="ui-inspector-row">
            <DragLabel
              label="코너 크기"
              value={uiSkinCornerSize}
              min={4}
              max={48}
              onChange={(v) => {
                setUiSkinCornerSize(Math.round(v));
                setUiEditorDirty(true);
              }}
              onDragEnd={() => saveSkinCornerSize(useEditorStore.getState().uiSkinCornerSize)}
            />
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777', lineHeight: 1.5 }}>
            RPG MV 기본값: 24px<br />
            코너/모서리 크기 = 24px, 변 = 48px
          </div>
        </div>

        {/* 스킨 적용 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">적용</div>
          <div className="ui-inspector-row">
            <button
              className="ui-inspector-save-btn"
              style={{ flex: 1 }}
              disabled={!projectPath || !uiSelectedSkin}
              onClick={handleSetDefault}
            >
              기본 스킨으로 설정 + 저장
            </button>
          </div>
        </div>

        {/* 스킨 업로드 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">새 스킨 추가</div>
          <div className="ui-inspector-row">
            <input
              ref={uploadRef}
              type="file"
              accept=".png,image/png"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button
              className="ui-canvas-toolbar-btn"
              style={{ width: '100%' }}
              disabled={!projectPath}
              onClick={() => uploadRef.current?.click()}
            >
              PNG 파일 업로드…
            </button>
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
            192×192px PNG, img/system/에 저장 + 목록 자동 등록
          </div>
        </div>

      </div>

      <div className="ui-inspector-footer">
        <button
          className="ui-inspector-save-btn"
          disabled={!uiEditorDirty}
          onClick={handleSetDefault}
        >
          {uiEditorDirty ? '저장' : '저장됨'}
        </button>
      </div>
    </div>
  );
}
