import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { WindowList } from './UIEditorSidebarWindowList';
import { SkinList } from './UIEditorSidebarSkinList';
import { FontList } from './UIEditorSidebarFontList';
import './UIEditor.css';

export default function UIEditorSidebar() {
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
  return (
    <div className="ui-editor-sidebar">
      {uiEditSubMode === 'window' ? <WindowList /> : uiEditSubMode === 'font' ? <FontList /> : <SkinList />}
    </div>
  );
}
