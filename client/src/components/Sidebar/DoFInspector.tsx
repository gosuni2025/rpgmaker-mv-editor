import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';

export default function DoFInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const updateEditorDoF = useEditorStore((s) => s.updateEditorDoF);
  const initEditorDoF = useEditorStore((s) => s.initEditorDoF);

  React.useEffect(() => {
    initEditorDoF();
  }, [initEditorDoF]);

  const dof = currentMap?.editorDoF;
  if (!dof) return <div className="light-inspector"><div style={{ color: '#666', fontSize: 12, padding: 8 }}>DoF 데이터 없음</div></div>;

  return (
    <div className="light-inspector">
      <div className="light-inspector-section">
        <div className="light-inspector-title">피사계 심도 (DoF)</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">활성화</span>
          <input
            type="checkbox"
            checked={dof.enabled}
            onChange={(e) => updateEditorDoF({ enabled: e.target.checked })}
          />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="초점 거리" value={dof.focus} step={10} min={1} max={2000}
            onChange={(v) => updateEditorDoF({ focus: v })} />
          <input type="number" className="light-inspector-input" min={1} max={2000} step={10}
            value={dof.focus}
            onChange={(e) => updateEditorDoF({ focus: parseFloat(e.target.value) || 500 })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="조리개" value={dof.aperture} step={0.001} min={0} max={0.1}
            onChange={(v) => updateEditorDoF({ aperture: v })} />
          <input type="number" className="light-inspector-input" min={0} max={0.1} step={0.001}
            value={dof.aperture}
            onChange={(e) => updateEditorDoF({ aperture: parseFloat(e.target.value) || 0.005 })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="최대 블러" value={dof.maxblur} step={0.001} min={0} max={0.1}
            onChange={(v) => updateEditorDoF({ maxblur: v })} />
          <input type="number" className="light-inspector-input" min={0} max={0.1} step={0.001}
            value={dof.maxblur}
            onChange={(e) => updateEditorDoF({ maxblur: parseFloat(e.target.value) || 0.01 })} />
        </div>
      </div>
    </div>
  );
}
