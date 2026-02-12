import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import './VariableSwitchSelector.css';

const GROUP_SIZE = 20;

interface VariableSwitchSelectorProps {
  /** 'variable' | 'switch' */
  type: 'variable' | 'switch';
  value: number;
  onChange: (id: number) => void;
  onClose: () => void;
  title?: string;
}

export function VariableSwitchSelector({ type, value, onChange, onClose, title }: VariableSwitchSelectorProps) {
  const systemData = useEditorStore(s => s.systemData);
  const items = type === 'variable' ? (systemData?.variables || []) : (systemData?.switches || []);

  // 로컬 이름 편집용 - items 복사
  const [localNames, setLocalNames] = useState<string[]>(() => [...items]);
  const [selected, setSelected] = useState(value || 1);
  const [dirty, setDirty] = useState(false);

  // items가 변경되면 localNames도 업데이트 (단, dirty일 때는 유지)
  useEffect(() => {
    if (!dirty) {
      setLocalNames([...items]);
    }
  }, [items, dirty]);

  const totalCount = localNames.length - 1; // index 0 제외
  const groupCount = Math.ceil(totalCount / GROUP_SIZE);

  // 선택된 그룹 (selected 값 기준)
  const [activeGroup, setActiveGroup] = useState(() => Math.floor((value - 1) / GROUP_SIZE));

  const groups = useMemo(() => {
    const result: { start: number; end: number; label: string }[] = [];
    for (let i = 0; i < groupCount; i++) {
      const start = i * GROUP_SIZE + 1;
      const end = Math.min((i + 1) * GROUP_SIZE, totalCount);
      result.push({
        start,
        end,
        label: `[ ${String(start).padStart(4, '0')} - ${String(end).padStart(4, '0')} ]`,
      });
    }
    return result;
  }, [groupCount, totalCount]);

  // 현재 그룹의 아이템 목록
  const currentItems = useMemo(() => {
    if (activeGroup < 0 || activeGroup >= groups.length) return [];
    const { start, end } = groups[activeGroup];
    const result: { id: number; label: string }[] = [];
    for (let i = start; i <= end; i++) {
      const name = localNames[i] || '';
      result.push({
        id: i,
        label: `${String(i).padStart(4, '0')}${name ? '  ' + name : ''}`,
      });
    }
    return result;
  }, [activeGroup, groups, localNames]);

  const selectedName = localNames[selected] || '';

  const handleNameChange = useCallback((newName: string) => {
    setLocalNames(prev => {
      const next = [...prev];
      next[selected] = newName;
      return next;
    });
    setDirty(true);
  }, [selected]);

  const itemListRef = useRef<HTMLDivElement>(null);

  // 그룹 변경 시 리스트 스크롤 맨 위로
  useEffect(() => {
    if (itemListRef.current) {
      itemListRef.current.scrollTop = 0;
    }
  }, [activeGroup]);

  // 선택 변경 시 해당 그룹으로 이동
  const handleSelectItem = useCallback((id: number) => {
    setSelected(id);
    const newGroup = Math.floor((id - 1) / GROUP_SIZE);
    if (newGroup !== activeGroup) {
      setActiveGroup(newGroup);
    }
  }, [activeGroup]);

  // 저장 (System.json 업데이트)
  const saveNames = useCallback(async () => {
    if (!systemData || !dirty) return;
    const key = type === 'variable' ? 'variables' : 'switches';
    const updated = { ...systemData, [key]: localNames };
    try {
      await apiClient.put('/database/system', updated);
      useEditorStore.setState({ systemData: updated });
      setDirty(false);
    } catch (err) {
      console.error('Failed to save system data:', err);
    }
  }, [systemData, localNames, type, dirty]);

  // 최대치 변경
  const handleChangeMax = useCallback(() => {
    const currentMax = localNames.length - 1;
    const input = window.prompt(`최대치 변경 (현재: ${currentMax})`, String(currentMax));
    if (input === null) return;
    const newMax = Math.max(1, Math.min(5000, parseInt(input, 10)));
    if (isNaN(newMax)) return;

    setLocalNames(prev => {
      const next = [...prev];
      if (newMax + 1 > next.length) {
        // 확장
        for (let i = next.length; i <= newMax; i++) {
          next.push('');
        }
      } else {
        // 축소
        next.length = newMax + 1;
      }
      return next;
    });
    setDirty(true);

    // 선택이 범위 밖이면 조정
    if (selected > newMax) {
      setSelected(newMax);
      setActiveGroup(Math.floor((newMax - 1) / GROUP_SIZE));
    }
  }, [localNames, selected]);

  const handleOk = async () => {
    if (dirty) await saveNames();
    onChange(selected);
    onClose();
  };

  const handleApply = async () => {
    if (dirty) await saveNames();
  };

  const defaultTitle = type === 'variable' ? '변수 셀렉터' : '스위치 셀렉터';

  // 초기 마운트 시 선택된 아이템이 보이도록 스크롤
  useEffect(() => {
    if (itemListRef.current) {
      const group = groups[activeGroup];
      if (group) {
        const indexInGroup = selected - group.start;
        if (indexInGroup >= 0) {
          const itemEl = itemListRef.current.children[indexInGroup] as HTMLElement;
          if (itemEl) {
            itemEl.scrollIntoView({ block: 'nearest' });
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="vs-selector-overlay">
      <div className="vs-selector-dialog">
        <div className="vs-selector-header">{title || defaultTitle}</div>
        <div className="vs-selector-body">
          {/* 좌측: 그룹 리스트 */}
          <div className="vs-selector-left">
            <div className="vs-selector-left-header">
              {type === 'variable' ? '변수' : '스위치'}
            </div>
            <div className="vs-selector-group-list">
              {groups.map((g, idx) => (
                <div
                  key={idx}
                  className={`vs-selector-group-item${idx === activeGroup ? ' selected' : ''}`}
                  onClick={() => setActiveGroup(idx)}
                >
                  {g.label}
                </div>
              ))}
            </div>
          </div>

          {/* 우측: 아이템 리스트 */}
          <div className="vs-selector-right">
            <div className="vs-selector-item-list" ref={itemListRef}>
              {currentItems.map(item => (
                <div
                  key={item.id}
                  className={`vs-selector-item${item.id === selected ? ' selected' : ''}`}
                  onClick={() => handleSelectItem(item.id)}
                  onDoubleClick={() => {
                    setSelected(item.id);
                    handleOk();
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>

            {/* 명칭 편집 */}
            <div className="vs-selector-name-row">
              <span className="vs-selector-name-label">명칭:</span>
              <input
                className="vs-selector-name-input"
                type="text"
                value={selectedName}
                onChange={e => handleNameChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="vs-selector-footer">
          <div className="vs-selector-footer-left">
            <button className="db-btn" onClick={handleChangeMax}>최대치 변경...</button>
          </div>
          <div className="vs-selector-footer-right">
            <button className="db-btn" onClick={handleOk}>OK</button>
            <button className="db-btn" onClick={onClose}>취소</button>
            <button className="db-btn" onClick={handleApply} disabled={!dirty}>적용</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ID → '0001: 이름' 형식으로 변환하는 유틸 */
export function getVarSwitchLabel(id: number, items: string[]): string {
  const name = items[id] || '';
  return `${String(id).padStart(4, '0')}${name ? ': ' + name : ''}`;
}

/**
 * 인라인 변수/스위치 선택 버튼
 * 하나의 버튼으로 라벨을 표시하고, 클릭하면 VariableSwitchSelector 팝업이 열림.
 */
export function VariableSwitchPicker({ type, value, onChange, disabled, style }: {
  type: 'variable' | 'switch';
  value: number;
  onChange: (id: number) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [showSelector, setShowSelector] = useState(false);
  const systemData = useEditorStore(s => s.systemData);
  const items = type === 'variable' ? (systemData?.variables || []) : (systemData?.switches || []);
  const label = getVarSwitchLabel(value, items);

  return (
    <>
      <button
        className="db-btn vs-picker-btn"
        style={{ opacity: disabled ? 0.5 : 1, ...style }}
        disabled={disabled}
        onClick={() => setShowSelector(true)}
      >{label}</button>
      {showSelector && (
        <VariableSwitchSelector
          type={type}
          value={value}
          onChange={onChange}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  );
}
