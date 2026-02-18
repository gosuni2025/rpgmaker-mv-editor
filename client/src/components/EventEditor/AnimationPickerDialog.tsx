import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '../../api/client';
import type { Animation } from '../../types/rpgMakerMV';
import AnimationPreview from '../Database/AnimationPreview';
import type { AnimationPreviewHandle } from '../Database/AnimationPreview';
import useEscClose from '../../hooks/useEscClose';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { highlightMatch } from '../../utils/highlightMatch';

const GROUP_SIZE = 20;

/**
 * 애니메이션 선택 다이얼로그 (프리뷰 포함)
 * DataListPicker 스타일의 목록 + AnimationPreview 결합
 */
export default function AnimationPickerDialog({ value, onChange, onClose }: {
  value: number;
  onChange: (id: number) => void;
  onClose: () => void;
}) {
  useEscClose(onClose);
  const previewRef = useRef<AnimationPreviewHandle>(null);
  const [animations, setAnimations] = useState<(Animation | null)[]>([]);
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    apiClient.get<(Animation | null)[]>('/database/animations').then(setAnimations).catch(() => {});
  }, []);

  const names = useMemo(() => {
    const arr: string[] = [];
    for (const anim of animations) {
      if (anim) arr[anim.id] = anim.name || '';
    }
    return arr;
  }, [animations]);

  const totalCount = names.length - 1;
  const groups = useMemo(() => {
    const result: { label: string; startId: number; endId: number }[] = [];
    for (let start = 1; start <= totalCount; start += GROUP_SIZE) {
      const end = Math.min(start + GROUP_SIZE - 1, totalCount);
      result.push({
        label: `[ ${String(start).padStart(4, '0')} - ${String(end).padStart(4, '0')} ]`,
        startId: start,
        endId: end,
      });
    }
    return result;
  }, [totalCount]);

  const initGroupIdx = Math.max(0, Math.floor((value - 1) / GROUP_SIZE));
  const [selectedGroup, setSelectedGroup] = useState(initGroupIdx);
  const [searchQuery, setSearchQuery] = useState('');

  const currentGroup = groups[selectedGroup];
  const groupItems = useMemo(() => {
    if (!currentGroup) return [];
    const result: { id: number; label: string }[] = [];
    for (let i = currentGroup.startId; i <= currentGroup.endId; i++) {
      result.push({ id: i, label: `${String(i).padStart(4, '0')} ${names[i] || ''}` });
    }
    return result;
  }, [currentGroup, names]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    const result: { id: number; label: string }[] = [];
    for (let i = 1; i < names.length; i++) {
      const label = `${String(i).padStart(4, '0')} ${names[i] || ''}`;
      if (fuzzyMatch(label, searchQuery)) {
        result.push({ id: i, label });
      }
    }
    return result;
  }, [names, searchQuery]);

  const displayItems = searchResults ?? groupItems;

  const selectedAnimation = useMemo(() => {
    return animations.find(a => a?.id === selected) ?? undefined;
  }, [animations, selected]);

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 900, maxHeight: '85vh' }}>
        <div className="image-picker-header">애니메이션</div>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid #444' }}>
          <input
            type="text"
            className="picker-search-input"
            placeholder="검색 (초성 지원: ㄱㄴㄷ)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
            style={{ width: '100%', padding: '4px 8px', background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, color: '#ddd', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 460 }}>
          {/* 좌측: 목록 */}
          <div style={{ width: 320, display: 'flex', borderRight: '1px solid #444' }}>
            {/* 그룹 패널 (검색 중에는 숨김) */}
            {!searchQuery && (
              <div style={{ width: 150, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {groups.map((g, idx) => (
                  <div key={g.startId} style={{
                    padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ccc',
                    background: idx === selectedGroup ? '#2675bf' : 'transparent',
                  }} onClick={() => setSelectedGroup(idx)}>{g.label}</div>
                ))}
              </div>
            )}
            {/* 아이템 패널 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {displayItems.map(item => (
                <div key={item.id} style={{
                  padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#ddd',
                  background: item.id === selected ? '#2675bf' : 'transparent',
                }} onClick={() => setSelected(item.id)}
                   onDoubleClick={() => { onChange(item.id); onClose(); }}>
                  <span>{highlightMatch(item.label, searchQuery)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 우측: 프리뷰 */}
          <div style={{ flex: 1, padding: 8, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <AnimationPreview ref={previewRef} animation={selectedAnimation} />
            <div style={{ marginTop: 8 }}>
              <button className="db-btn" onClick={() => previewRef.current?.play()}>재생</button>
            </div>
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => { onChange(selected); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
