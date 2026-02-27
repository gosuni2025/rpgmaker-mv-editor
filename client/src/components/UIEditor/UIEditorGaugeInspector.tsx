import React, { useCallback, useState } from 'react';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import ImagePicker from '../common/ImagePicker';
import './UIEditor.css';

export default function UIEditorGaugeInspector() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSelectedSkinFile = useEditorStore((s) => s.uiSelectedSkinFile);
  const triggerSkinsReload = useEditorStore((s) => s.triggerSkinsReload);
  const uiSkinGaugeFile = useEditorStore((s) => s.uiSkinGaugeFile);
  const setUiSkinGaugeFile = useEditorStore((s) => s.setUiSkinGaugeFile);
  const uiSkinGaugeBgX = useEditorStore((s) => s.uiSkinGaugeBgX);
  const [gaugePickerOpen, setGaugePickerOpen] = useState(false);
  const uiSkinGaugeBgY = useEditorStore((s) => s.uiSkinGaugeBgY);
  const uiSkinGaugeBgW = useEditorStore((s) => s.uiSkinGaugeBgW);
  const uiSkinGaugeBgH = useEditorStore((s) => s.uiSkinGaugeBgH);
  const uiSkinGaugeFillX = useEditorStore((s) => s.uiSkinGaugeFillX);
  const uiSkinGaugeFillY = useEditorStore((s) => s.uiSkinGaugeFillY);
  const uiSkinGaugeFillW = useEditorStore((s) => s.uiSkinGaugeFillW);
  const uiSkinGaugeFillH = useEditorStore((s) => s.uiSkinGaugeFillH);
  const uiSkinGaugeFillDir = useEditorStore((s) => s.uiSkinGaugeFillDir);
  const setUiSkinGaugeBg = useEditorStore((s) => s.setUiSkinGaugeBg);
  const setUiSkinGaugeFill = useEditorStore((s) => s.setUiSkinGaugeFill);
  const setUiSkinGaugeFillDir = useEditorStore((s) => s.setUiSkinGaugeFillDir);

  const saveSkin = useCallback(async (fields: Record<string, number | string | undefined>) => {
    if (!projectPath || !uiSelectedSkin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(uiSelectedSkin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, [projectPath, uiSelectedSkin]);

  const handleGaugeFilePick = useCallback(async (pickedFile: string) => {
    setGaugePickerOpen(false);
    setUiSkinGaugeFile(pickedFile);
    await saveSkin({ gaugeFile: pickedFile || undefined });
  }, [saveSkin, setUiSkinGaugeFile]);

  const handleSetDefault = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      await apiClient.put('/ui-editor/skins/default', { defaultGaugeSkin: uiSelectedSkin });
      triggerSkinsReload();
      useEditorStore.getState().showToast(`게이지 기본 스킨: ${uiSelectedSkin} 설정됨`);
    } catch {
      useEditorStore.getState().showToast('설정 실패', true);
    }
  };

  const displayGaugeFile = uiSkinGaugeFile || uiSelectedSkinFile;

  return (
    <div className="ui-editor-inspector">
      <div className="ui-editor-inspector-header">게이지 인스펙터</div>
      <div className="ui-editor-inspector-body">

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">게이지 이미지 파일</div>
          <div style={{ padding: '2px 12px 4px', fontSize: 11, color: '#777' }}>
            비워두면 스킨 파일({uiSelectedSkinFile}) 사용
          </div>
          <div className="ui-inspector-row" style={{ gap: 4 }}>
            <span style={{ flex: 1, fontSize: 12, color: uiSkinGaugeFile ? '#ddd' : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {uiSkinGaugeFile || '(스킨 파일 사용)'}
            </span>
            <button className="ui-canvas-toolbar-btn" style={{ padding: '2px 6px', fontSize: 11 }}
              disabled={!projectPath || !uiSelectedSkin}
              onClick={() => setGaugePickerOpen(true)}>
              선택
            </button>
            {uiSkinGaugeFile && (
              <button className="ui-canvas-toolbar-btn" style={{ padding: '2px 6px', fontSize: 11 }}
                onClick={() => handleGaugeFilePick('')}>
                ×
              </button>
            )}
          </div>
          {uiSkinGaugeFile && (
            <div style={{ padding: '4px 12px' }}>
              <img
                src={/\.(png|webp)$/i.test(displayGaugeFile) ? `/img/system/${displayGaugeFile}` : `/img/system/${displayGaugeFile}.png`}
                alt={displayGaugeFile}
                style={{ maxWidth: '100%', maxHeight: 64, imageRendering: 'pixelated', border: '1px solid #444' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <ImagePicker type="system" value={uiSkinGaugeFile} open={gaugePickerOpen}
            onClose={() => setGaugePickerOpen(false)} onChange={handleGaugeFilePick} />
        </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">게이지 배경 영역 (Gauge BG)</div>
          <div style={{ padding: '2px 12px 4px', fontSize: 11, color: '#777' }}>
            캔버스에서 파란 영역 드래그로 이동/리사이즈 가능
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={uiSkinGaugeBgX} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeBg(r, uiSkinGaugeBgY, uiSkinGaugeBgW, uiSkinGaugeBgH); saveSkin({ gaugeBgX: r, gaugeBgY: uiSkinGaugeBgY, gaugeBgW: uiSkinGaugeBgW, gaugeBgH: uiSkinGaugeBgH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={uiSkinGaugeBgY} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeBg(uiSkinGaugeBgX, r, uiSkinGaugeBgW, uiSkinGaugeBgH); saveSkin({ gaugeBgX: uiSkinGaugeBgX, gaugeBgY: r, gaugeBgW: uiSkinGaugeBgW, gaugeBgH: uiSkinGaugeBgH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={uiSkinGaugeBgW} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeBg(uiSkinGaugeBgX, uiSkinGaugeBgY, r, uiSkinGaugeBgH); saveSkin({ gaugeBgX: uiSkinGaugeBgX, gaugeBgY: uiSkinGaugeBgY, gaugeBgW: r, gaugeBgH: uiSkinGaugeBgH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={uiSkinGaugeBgH} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeBg(uiSkinGaugeBgX, uiSkinGaugeBgY, uiSkinGaugeBgW, r); saveSkin({ gaugeBgX: uiSkinGaugeBgX, gaugeBgY: uiSkinGaugeBgY, gaugeBgW: uiSkinGaugeBgW, gaugeBgH: r }); }} />
          </div>
        </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">게이지 채움 영역 (Gauge Fill)</div>
          <div style={{ padding: '2px 12px 4px', fontSize: 11, color: '#777' }}>
            캔버스에서 주황 영역 드래그로 이동/리사이즈 가능
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={uiSkinGaugeFillX} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeFill(r, uiSkinGaugeFillY, uiSkinGaugeFillW, uiSkinGaugeFillH); saveSkin({ gaugeFillX: r, gaugeFillY: uiSkinGaugeFillY, gaugeFillW: uiSkinGaugeFillW, gaugeFillH: uiSkinGaugeFillH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={uiSkinGaugeFillY} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeFill(uiSkinGaugeFillX, r, uiSkinGaugeFillW, uiSkinGaugeFillH); saveSkin({ gaugeFillX: uiSkinGaugeFillX, gaugeFillY: r, gaugeFillW: uiSkinGaugeFillW, gaugeFillH: uiSkinGaugeFillH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={uiSkinGaugeFillW} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeFill(uiSkinGaugeFillX, uiSkinGaugeFillY, r, uiSkinGaugeFillH); saveSkin({ gaugeFillX: uiSkinGaugeFillX, gaugeFillY: uiSkinGaugeFillY, gaugeFillW: r, gaugeFillH: uiSkinGaugeFillH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={uiSkinGaugeFillH} min={0}
              onChange={(v) => { const r = Math.round(v); setUiSkinGaugeFill(uiSkinGaugeFillX, uiSkinGaugeFillY, uiSkinGaugeFillW, r); saveSkin({ gaugeFillX: uiSkinGaugeFillX, gaugeFillY: uiSkinGaugeFillY, gaugeFillW: uiSkinGaugeFillW, gaugeFillH: r }); }} />
          </div>
        </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">채우기 방향</div>
          <div className="ui-inspector-row" style={{ gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#bbb', cursor: 'pointer' }}>
              <input
                type="radio"
                name="gaugeFillDir"
                value="horizontal"
                checked={uiSkinGaugeFillDir === 'horizontal'}
                onChange={() => { setUiSkinGaugeFillDir('horizontal'); saveSkin({ gaugeFillDir: 'horizontal' }); }}
                style={{ accentColor: '#4af' }}
              />
              가로 (Horizontal)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#bbb', cursor: 'pointer' }}>
              <input
                type="radio"
                name="gaugeFillDir"
                value="vertical"
                checked={uiSkinGaugeFillDir === 'vertical'}
                onChange={() => { setUiSkinGaugeFillDir('vertical'); saveSkin({ gaugeFillDir: 'vertical' }); }}
                style={{ accentColor: '#4af' }}
              />
              세로 (Vertical)
            </label>
          </div>
        </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">기본값</div>
          <div className="ui-inspector-row">
            <button
              className="ui-canvas-toolbar-btn"
              style={{ flex: 1 }}
              disabled={!projectPath || !uiSelectedSkin}
              onClick={handleSetDefault}
            >
              기본 게이지 스킨으로 설정
            </button>
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
            UIEditorSkins.json에 defaultGaugeSkin 저장
          </div>
        </div>

      </div>
    </div>
  );
}
