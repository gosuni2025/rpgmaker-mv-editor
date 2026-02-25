import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { WindowInspector } from './UIEditorWindowInspector';
import { ElementInspector } from './UIEditorElementInspector';
import './UIEditor.css';

export default function UIEditorInspector() {
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorSelectedElementType = useEditorStore((s) => s.uiEditorSelectedElementType);

  const selectedWindow = uiEditorWindows.find((w) => w.id === uiEditorSelectedWindowId) ?? null;
  const override = selectedWindow ? (uiEditorOverrides[selectedWindow.className] ?? null) : null;
  const selectedElement = selectedWindow?.elements?.find((e) => e.type === uiEditorSelectedElementType) ?? null;

  if (!selectedWindow) {
    return (
      <div className="ui-editor-inspector">
        <div className="ui-editor-inspector-header">인스펙터</div>
        <div className="ui-editor-inspector-body">
          <div className="ui-editor-inspector-empty">창을 선택하세요</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-editor-inspector">
      {selectedElement ? (
        <ElementInspector selectedWindow={selectedWindow} elem={selectedElement} />
      ) : (
        <WindowInspector selectedWindow={selectedWindow} override={override} />
      )}
    </div>
  );
}
