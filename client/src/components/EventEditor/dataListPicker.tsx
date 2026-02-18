import React, { useState, useMemo, useEffect, useRef } from 'react';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { highlightMatch } from '../../utils/highlightMatch';

const GROUP_SIZE = 20;
const ICON_SIZE = 32;
const ICON_DISPLAY_SIZE = 20;
const ICONS_PER_ROW = 16;

/** 아이콘 시트를 로드하고 캐시하는 모듈 레벨 변수 */
let _iconSheetCache: HTMLImageElement | null = null;
let _iconSheetLoading = false;
const _iconSheetCallbacks: ((img: HTMLImageElement) => void)[] = [];

function loadIconSheet(cb: (img: HTMLImageElement) => void) {
  if (_iconSheetCache) { cb(_iconSheetCache); return; }
  _iconSheetCallbacks.push(cb);
  if (_iconSheetLoading) return;
  _iconSheetLoading = true;
  const img = new Image();
  img.src = '/api/resources/img_system/IconSet.png';
  img.onload = () => {
    _iconSheetCache = img;
    _iconSheetCallbacks.forEach(fn => fn(img));
    _iconSheetCallbacks.length = 0;
  };
}

export interface CharacterInfo {
  characterName: string;
  characterIndex: number;
}

/** 캐릭터 이미지를 로드하고 캐시 */
const _charImageCache = new Map<string, HTMLImageElement>();
const _charImageLoading = new Map<string, ((img: HTMLImageElement) => void)[]>();

function loadCharImage(name: string, cb: (img: HTMLImageElement) => void) {
  if (!name) return;
  const cached = _charImageCache.get(name);
  if (cached) { cb(cached); return; }
  const existing = _charImageLoading.get(name);
  if (existing) { existing.push(cb); return; }
  _charImageLoading.set(name, [cb]);
  const img = new Image();
  img.src = `/api/resources/img_characters/${name}.png`;
  img.onload = () => {
    _charImageCache.set(name, img);
    _charImageLoading.get(name)?.forEach(fn => fn(img));
    _charImageLoading.delete(name);
  };
}

/** 캐릭터 스프라이트의 정면 1프레임을 표시하는 컴포넌트 */
export function CharacterSprite({ characterName, characterIndex }: CharacterInfo) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(() => _charImageCache.get(characterName) || null);
  const drawnRef = useRef(false);

  useEffect(() => {
    drawnRef.current = false;
    if (!characterName) return;
    const cached = _charImageCache.get(characterName);
    if (cached) { setImg(cached); return; }
    loadCharImage(characterName, (loadedImg) => {
      setImg(loadedImg);
    });
  }, [characterName]);

  useEffect(() => {
    if (!img || !canvasRef.current || !characterName || drawnRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // RPG Maker MV 캐릭터 시트: 4열 x 2행, 각 캐릭터 3패턴 x 4방향
    const isBig = characterName.startsWith('$');
    const pw = img.width / (isBig ? 3 : 12);
    const ph = img.height / (isBig ? 4 : 8);
    const col = isBig ? 0 : characterIndex % 4;
    const row = isBig ? 0 : Math.floor(characterIndex / 4);
    // 정면(아래 방향=0행) 가운데 패턴(1)
    const sx = (col * 3 + 1) * pw;
    const sy = row * 4 * ph;
    canvas.width = pw;
    canvas.height = ph;
    ctx.drawImage(img, sx, sy, pw, ph, 0, 0, pw, ph);
    drawnRef.current = true;
  }, [img, characterName, characterIndex]);

  if (!characterName) return null;

  return (
    <canvas ref={canvasRef} width={48} height={48}
      style={{ width: ICON_DISPLAY_SIZE, height: ICON_DISPLAY_SIZE, imageRendering: 'pixelated', flexShrink: 0 }} />
  );
}

/** 아이콘을 캔버스에 그리는 작은 컴포넌트 */
export function IconSprite({ iconIndex }: { iconIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sheet, setSheet] = useState<HTMLImageElement | null>(_iconSheetCache);

  useEffect(() => {
    if (!sheet) loadIconSheet(setSheet);
  }, []);

  useEffect(() => {
    if (!sheet || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    const sx = (iconIndex % ICONS_PER_ROW) * ICON_SIZE;
    const sy = Math.floor(iconIndex / ICONS_PER_ROW) * ICON_SIZE;
    ctx.drawImage(sheet, sx, sy, ICON_SIZE, ICON_SIZE, 0, 0, ICON_SIZE, ICON_SIZE);
  }, [sheet, iconIndex]);

  return (
    <canvas ref={canvasRef} width={ICON_SIZE} height={ICON_SIZE}
      style={{ width: ICON_DISPLAY_SIZE, height: ICON_DISPLAY_SIZE, imageRendering: 'pixelated', flexShrink: 0 }} />
  );
}

/** 스위치/변수/아이템 등 목록에서 선택하는 2패널 팝업 */
export function DataListPicker({ items, value, onChange, onClose, title, iconIndices, characterData }: {
  items: string[]; value: number; onChange: (id: number) => void; onClose: () => void; title?: string;
  iconIndices?: (number | undefined)[];
  characterData?: (CharacterInfo | undefined)[];
}) {
  const totalCount = items.length - 1; // items[0]은 null
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

  // 현재 선택된 값이 속한 그룹을 초기 그룹으로
  const initGroupIdx = Math.max(0, Math.floor((value - 1) / GROUP_SIZE));
  const [selectedGroup, setSelectedGroup] = useState(initGroupIdx);
  const [selected, setSelected] = useState(value);
  const [searchQuery, setSearchQuery] = useState('');

  const currentGroup = groups[selectedGroup];
  const groupItems = useMemo(() => {
    if (!currentGroup) return [];
    const result: { id: number; label: string }[] = [];
    for (let i = currentGroup.startId; i <= currentGroup.endId; i++) {
      result.push({ id: i, label: `${String(i).padStart(4, '0')} ${items[i] || ''}` });
    }
    return result;
  }, [currentGroup, items]);

  // 검색 시 전체 목록에서 필터링 (그룹 무시)
  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    const result: { id: number; label: string }[] = [];
    for (let i = 1; i < items.length; i++) {
      const label = `${String(i).padStart(4, '0')} ${items[i] || ''}`;
      if (fuzzyMatch(label, searchQuery)) {
        result.push({ id: i, label });
      }
    }
    return result;
  }, [items, searchQuery]);

  const displayItems = searchResults ?? groupItems;

  const categoryName = title?.replace(' 선택', '') || title || '';

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 500, maxHeight: '70vh' }}>
        <div className="image-picker-header">{title || '대상 선택'}</div>
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
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 300 }}>
          {/* 왼쪽 패널: 카테고리 + 범위 그룹 (검색 중에는 숨김) */}
          {!searchQuery && (
            <div style={{ width: 170, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              {/* 카테고리명 */}
              <div style={{ padding: '6px 8px', fontSize: 14, fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #444' }}>
                {categoryName}
              </div>
              {/* 범위 그룹 */}
              {groups.map((g, idx) => (
                <div
                  key={g.startId}
                  style={{
                    padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ccc',
                    background: idx === selectedGroup ? '#2675bf' : 'transparent',
                  }}
                  onClick={() => setSelectedGroup(idx)}
                >{g.label}</div>
              ))}
            </div>
          )}
          {/* 오른쪽 패널: 아이템 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {displayItems.map(item => {
              const iconIdx = iconIndices?.[item.id];
              const charInfo = characterData?.[item.id];
              return (
                <div
                  key={item.id}
                  style={{
                    padding: '3px 8px', cursor: 'pointer', fontSize: 13, color: '#ddd',
                    background: item.id === selected ? '#2675bf' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  onClick={() => setSelected(item.id)}
                  onDoubleClick={() => { onChange(item.id); onClose(); }}
                >
                  {iconIdx != null && iconIdx > 0 && <IconSprite iconIndex={iconIdx} />}
                  {charInfo?.characterName && <CharacterSprite {...charInfo} />}
                  <span>{highlightMatch(item.label, searchQuery)}</span>
                </div>
              );
            })}
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
