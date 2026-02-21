import React, { useState, useRef, useEffect } from 'react';
import { EXTENDED_TAG_DEFS, getTagDef, type TagEntry, type TagParam } from './extendedTextDefs';
import IconPicker from '../common/IconPicker';
import ImagePicker from '../common/ImagePicker';

interface BlockPropsPanelProps {
  propTags: TagEntry[];
  propContent: string;
  setPropTags: React.Dispatch<React.SetStateAction<TagEntry[]>>;
  setPropContent: React.Dispatch<React.SetStateAction<string>>;
  onApply: () => void;
}

function renderParamInput(
  param: TagParam,
  value: string,
  onChangeFn: (val: string) => void,
  allParams?: Record<string, string>,
) {
  if (param.type === 'color') {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="color"
          value={value}
          onChange={e => onChangeFn(e.target.value)}
          style={{ width: 32, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
        />
        <input
          type="text"
          className="ete-props-input"
          value={value}
          onChange={e => onChangeFn(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
    );
  }
  if (param.type === 'select') {
    return (
      <select
        className="ete-props-input"
        value={value}
        onChange={e => onChangeFn(e.target.value)}
      >
        {param.options?.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }
  if (param.type === 'icon-picker') {
    return (
      <IconPicker
        value={parseInt(value, 10) || 0}
        onChange={v => onChangeFn(String(v))}
      />
    );
  }
  if (param.type === 'image-picker') {
    const imgtypeVal = allParams?.['imgtype'] || 'pictures';
    // 'img' imgtype은 ImagePicker에서 지원하지 않으므로 'pictures' 사용 (value에서 자동 감지)
    const pickerType = (imgtypeVal === 'img' ? 'pictures' : imgtypeVal) as Parameters<typeof ImagePicker>[0]['type'];
    return (
      <ImagePicker
        type={pickerType}
        value={value}
        onChange={onChangeFn}
      />
    );
  }
  return (
    <input
      type="number"
      className="ete-props-input"
      min={param.min}
      max={param.max}
      step={param.step}
      value={value}
      onChange={e => onChangeFn(e.target.value)}
    />
  );
}

export function BlockPropsPanel({ propTags, propContent, setPropTags, setPropContent, onApply }: BlockPropsPanelProps) {
  const [showAddTagMenu, setShowAddTagMenu] = useState(false);
  const addTagMenuRef = useRef<HTMLDivElement>(null);
  // void 요소 (icon, picture)이면 내용 텍스트/효과 추가 숨김
  const isAllVoid = propTags.length > 0 && propTags.every(e => getTagDef(e.tag)?.void);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addTagMenuRef.current && !addTagMenuRef.current.contains(e.target as Node)) {
        setShowAddTagMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      className="ete-props-panel"
      onMouseDown={e => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
        }
      }}
    >
      {propTags.map((entry, idx) => {
        const def = getTagDef(entry.tag);
        if (!def) return null;
        return (
          <div key={idx} className="ete-props-tag-section">
            <div className="ete-props-tag-header">
              <span className="ete-block-label" style={{ background: def.badgeColor, borderRadius: 3 }}>
                {def.label}
              </span>
              <button
                className="ete-props-tag-del"
                title="이 효과 제거"
                onClick={() => setPropTags(prev => prev.filter((_, i) => i !== idx))}
              >✕</button>
            </div>
            {def.params.map(param => (
              <div key={param.key} className="ete-props-row">
                <label className="ete-props-label">{param.label}</label>
                {renderParamInput(
                  param,
                  entry.params[param.key] ?? String(param.defaultValue),
                  val => setPropTags(prev => prev.map((e, i) =>
                    i === idx ? { ...e, params: { ...e.params, [param.key]: val } } : e
                  )),
                  entry.params,
                )}
              </div>
            ))}
          </div>
        );
      })}

      {!isAllVoid && (
        <div className="ete-props-content-row">
          <div className="ete-props-label">내용 텍스트</div>
          <textarea
            className="ete-props-content-input"
            rows={2}
            value={propContent}
            onChange={e => setPropContent(e.target.value)}
          />
        </div>
      )}

      {!isAllVoid && (
      <div className="ete-dropdown-wrap ete-props-add-wrap" ref={addTagMenuRef}>
        <button
          className="ete-props-add-btn"
          onMouseDown={e => { e.preventDefault(); setShowAddTagMenu(s => !s); }}
        >
          + 효과 추가
        </button>
        {showAddTagMenu && (
          <div className="ete-dropdown-menu" style={{ bottom: 'calc(100% + 2px)', top: 'auto', left: 0 }}>
            {(['visual', 'animation', 'timing'] as const).map(cat => {
              const defs = EXTENDED_TAG_DEFS.filter(d => d.category === cat);
              if (!defs.length) return null;
              const catLabel = { visual: '비주얼', animation: '애니메이션', timing: '타이밍' }[cat];
              return (
                <React.Fragment key={cat}>
                  <div className="ete-dropdown-group-label">{catLabel}</div>
                  {defs.map(def => (
                    <div
                      key={def.tag}
                      className="ete-dropdown-item"
                      onMouseDown={e => {
                        e.preventDefault();
                        const defaultParams: Record<string, string> = {};
                        for (const p of def.params) defaultParams[p.key] = String(p.defaultValue);
                        setPropTags(prev => [...prev, { tag: def.tag, params: defaultParams }]);
                        setShowAddTagMenu(false);
                      }}
                    >
                      <span className="ete-dropdown-badge" style={{ background: def.badgeColor }}>{def.label}</span>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
      )}

      <button className="ete-props-apply-btn" onClick={onApply}>적용</button>
    </div>
  );
}
