import { create } from 'zustand';
import type { EditorState } from './types';
import { projectSlice } from './projectSlice';
import { editingSlice } from './editingSlice';
import { lightSlice } from './lightSlice';
import { uiSlice } from './uiSlice';

// Re-export types for backward compatibility
export type { TileChange, TileHistoryEntry, ResizeHistoryEntry, ObjectHistoryEntry, LightHistoryEntry, HistoryEntry, ClipboardData, EditorState } from './types';

const useEditorStore = create<EditorState>((...a) => ({
  ...projectSlice(...a),
  ...editingSlice(...a),
  ...lightSlice(...a),
  ...uiSlice(...a),
}));

// Debug: expose store globally
(window as unknown as Record<string, unknown>).__editorStore = useEditorStore;

export default useEditorStore;
