import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TemplateDef, TemplateElementDef } from '../../store/types';

const inputStyle: React.CSSProperties = { background: '#333', color: '#ddd', border: '1px solid #555', padding: '2px 4px', fontSize: 12 };
const selectStyle: React.CSSProperties = { ...inputStyle };
const labelStyle: React.CSSProperties = { color: '#aaa', fontSize: 11, display: 'block', marginBottom: 2 };

export default function UIEditorTemplatePanel() {
  const templates = useEditorStore((s) => s.templates);
  const selectedTemplateId = useEditorStore((s) => s.selectedTemplateId);
  const updateTemplate = useEditorStore((s) => s.updateTemplate);
  const saveTemplates = useEditorStore((s) => s.saveTemplates);

  const template = selectedTemplateId ? templates.templates[selectedTemplateId] : null;
  if (!template) return <div style={{ padding: 8, color: '#888' }}>템플릿을 선택하세요</div>;

  const update = (changes: Partial<TemplateDef>) => {
    updateTemplate(template.id, changes);
    saveTemplates();
  };

  return (
    <div style={{ padding: 8, overflowY: 'auto' }}>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>표시명</label>
        <input
          value={template.displayName}
          onChange={(e) => update({ displayName: e.target.value })}
          style={{ ...inputStyle, display: 'block', width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>ID</label>
        <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{template.id}</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>행 높이 (rowHeight)</label>
        <input
          type="number"
          value={template.rowHeight}
          onChange={(e) => update({ rowHeight: Number(e.target.value) })}
          style={{ ...inputStyle, display: 'block', width: 80 }}
        />
      </div>

      <div style={{ ...labelStyle, marginBottom: 4 }}>엘리먼트 (root.children)</div>
      <TemplateElementList
        elements={template.root.children || []}
        onChange={(children) => update({ root: { ...template.root, children } })}
      />
    </div>
  );
}

function TemplateElementList({
  elements,
  onChange,
}: {
  elements: TemplateElementDef[];
  onChange: (els: TemplateElementDef[]) => void;
}) {
  const addElement = (type: TemplateElementDef['type']) => {
    const el: TemplateElementDef = {
      id: 'el_' + Date.now(),
      type,
      x: 0, y: 0,
      ...(type === 'label' ? { text: '{$.name}', align: 'left' as const } : {}),
      ...(type === 'icon' ? { bind: 'iconIndex' } : {}),
    };
    onChange([...elements, el]);
  };

  const updateEl = (index: number, changes: Partial<TemplateElementDef>) => {
    const next = elements.map((el, i) => i === index ? { ...el, ...changes } : el);
    onChange(next);
  };

  const removeEl = (index: number) => {
    onChange(elements.filter((_, i) => i !== index));
  };

  return (
    <div>
      {elements.map((el, i) => (
        <div key={el.id} style={{ background: '#2a2a2a', border: '1px solid #444', padding: 6, marginBottom: 4, borderRadius: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: '#ddd', fontSize: 12, fontWeight: 'bold' }}>{el.type}</span>
            <button onClick={() => removeEl(i)} style={{ background: 'none', border: 'none', color: '#f66', cursor: 'pointer', fontSize: 12 }}>×</button>
          </div>
          {/* x, y, w */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {(['x', 'y'] as const).map((k) => (
              <label key={k} style={{ color: '#aaa', fontSize: 11 }}>
                {k}: <input type="number" value={el[k] ?? 0}
                  onChange={(e) => updateEl(i, { [k]: Number(e.target.value) })}
                  style={{ width: 50, background: '#333', color: '#ddd', border: '1px solid #555', padding: '1px 3px' }} />
              </label>
            ))}
            <label style={{ color: '#aaa', fontSize: 11 }}>
              w: <input type="number" value={el.width ?? ''} placeholder="fill"
                onChange={(e) => updateEl(i, { width: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ width: 50, background: '#333', color: '#ddd', border: '1px solid #555', padding: '1px 3px' }} />
            </label>
          </div>
          {/* type-specific */}
          {el.type === 'label' && (
            <>
              <label style={{ color: '#aaa', fontSize: 11, display: 'block', marginBottom: 2 }}>
                text: <input value={el.text || ''} onChange={(e) => updateEl(i, { text: e.target.value })}
                  style={{ width: '100%', background: '#333', color: '#ddd', border: '1px solid #555', padding: '1px 3px' }} />
              </label>
              <label style={{ color: '#aaa', fontSize: 11 }}>
                align: <select value={el.align || 'left'} onChange={(e) => updateEl(i, { align: e.target.value as 'left' | 'center' | 'right' })}
                  style={{ background: '#333', color: '#ddd', border: '1px solid #555' }}>
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </label>
            </>
          )}
          {el.type === 'icon' && (
            <label style={{ color: '#aaa', fontSize: 11, display: 'block' }}>
              bind: <input value={typeof el.bind === 'string' ? el.bind : ''} onChange={(e) => updateEl(i, { bind: e.target.value })}
                style={{ width: '80%', background: '#333', color: '#ddd', border: '1px solid #555', padding: '1px 3px' }} />
            </label>
          )}
          {el.type === 'gauge' && (
            <div style={{ color: '#aaa', fontSize: 11 }}>
              <label>current bind: <input value={typeof el.bind === 'object' ? (el.bind?.current || '') : ''}
                onChange={(e) => updateEl(i, { bind: { ...(typeof el.bind === 'object' ? el.bind : {}), current: e.target.value } })}
                style={{ width: 80, background: '#333', color: '#ddd', border: '1px solid #555', padding: '1px 3px' }} /></label>
              <label style={{ marginLeft: 8 }}>max bind: <input value={typeof el.bind === 'object' ? (el.bind?.max || '') : ''}
                onChange={(e) => updateEl(i, { bind: { ...(typeof el.bind === 'object' ? el.bind : {}), max: e.target.value } })}
                style={{ width: 80, background: '#333', color: '#ddd', border: '1px solid #555', padding: '1px 3px' }} /></label>
            </div>
          )}
          {el.type === 'image' && (
            <label style={{ color: '#aaa', fontSize: 11, display: 'block' }}>
              bind: <input value={typeof el.bind === 'string' ? el.bind : ''} onChange={(e) => updateEl(i, { bind: e.target.value })}
                style={{ width: '80%', background: '#333', color: '#ddd', border: '1px solid #555', padding: '1px 3px' }} />
            </label>
          )}
        </div>
      ))}
      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
        {(['icon', 'label', 'gauge', 'image'] as const).map((t) => (
          <button key={t} onClick={() => addElement(t)}
            style={{ background: '#3a3a3a', color: '#ccc', border: '1px solid #555', padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>
            + {t}
          </button>
        ))}
      </div>
    </div>
  );
}
