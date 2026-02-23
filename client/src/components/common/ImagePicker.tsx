import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import useEscClose from '../../hooks/useEscClose';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { highlightMatch } from '../../utils/highlightMatch';
import './ImagePicker.css';

interface ImagePickerProps {
  type: 'faces' | 'characters' | 'sv_actors' | 'sv_enemies' | 'enemies' | 'battlebacks1' | 'battlebacks2' | 'parallaxes' | 'tilesets' | 'titles1' | 'titles2' | 'animations' | 'pictures' | 'system';
  value: string;
  onChange: (name: string, meta?: { fetchType: string }) => void;
  index?: number;
  onIndexChange?: (index: number) => void;
  direction?: number;
  onDirectionChange?: (direction: number) => void;
  pattern?: number;
  onPatternChange?: (pattern: number) => void;
  defaultOpen?: boolean;
  /** 외부에서 open 상태를 제어할 때 사용 (이 prop이 있으면 preview 트리거 숨김) */
  open?: boolean;
  onClose?: () => void;
}

interface FileInfo {
  name: string;
  size: number;
  mtime: number;
  isDir?: boolean;
}

type SortMode = 'name' | 'size' | 'mtime';

// RPG Maker MV direction: 2=아래, 4=왼쪽, 6=오른쪽, 8=위
// 스프라이트 시트 행 순서: 0=아래(2), 1=왼쪽(4), 2=오른쪽(6), 3=위(8)
const DIR_FROM_ROW: Record<number, number> = { 0: 2, 1: 4, 2: 6, 3: 8 };
const ROW_FROM_DIR: Record<number, number> = { 2: 0, 4: 1, 6: 2, 8: 3 };

function getCharacterSheetInfo(fileName: string) {
  const isSingle = fileName.startsWith('$');
  return {
    charCols: isSingle ? 1 : 4,
    charRows: isSingle ? 1 : 2,
    patterns: 3,
    dirs: 4,
    totalCols: isSingle ? 3 : 12,
    totalRows: isSingle ? 4 : 8,
  };
}

/** 스프라이트 시트 전체 표시, 개별 프레임 클릭 선택 */
function SheetSelector({ imgSrc, fileName, type, selectedIndex, selectedDirection, selectedPattern, onSelect }: {
  imgSrc: string;
  fileName: string;
  type: string;
  selectedIndex: number;
  selectedDirection: number;
  selectedPattern: number;
  onSelect: (index: number, direction: number, pattern: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(false); }, [imgSrc]);

  if (type === 'characters') {
    const info = getCharacterSheetInfo(fileName);
    const selCharCol = selectedIndex % info.charCols;
    const selCharRow = Math.floor(selectedIndex / info.charCols);
    const selDirRow = ROW_FROM_DIR[selectedDirection] ?? 0;
    const selAbsCol = selCharCol * info.patterns + selectedPattern;
    const selAbsRow = selCharRow * info.dirs + selDirRow;

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={imgSrc}
          style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
          draggable={false}
          onLoad={() => setLoaded(true)}
        />
        {loaded && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'grid',
            gridTemplateColumns: `repeat(${info.totalCols}, 1fr)`,
            gridTemplateRows: `repeat(${info.totalRows}, 1fr)`,
          }}>
            {Array.from({ length: info.totalRows * info.totalCols }, (_, i) => {
              const col = i % info.totalCols;
              const row = Math.floor(i / info.totalCols);
              const charCol = Math.floor(col / info.patterns);
              const charRow = Math.floor(row / info.dirs);
              const charIdx = charRow * info.charCols + charCol;
              const pat = col % info.patterns;
              const dir = DIR_FROM_ROW[row % info.dirs];
              const isSelected = col === selAbsCol && row === selAbsRow;
              return (
                <div
                  key={i}
                  onClick={() => onSelect(charIdx, dir, pat)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #2675bf' : '1px solid rgba(255,255,255,0.05)',
                    background: isSelected ? 'rgba(38,117,191,0.3)' : 'transparent',
                    boxSizing: 'border-box',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // faces: 셀 단위 선택
  const layout = type === 'faces' ? { cols: 4, rows: 2 } : { cols: 1, rows: 1 };
  const cellCount = type === 'faces' ? 8 : 1;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img
        src={imgSrc}
        style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
        draggable={false}
        onLoad={() => setLoaded(true)}
      />
      {loaded && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        }}>
          {Array.from({ length: cellCount }, (_, i) => (
            <div
              key={i}
              onClick={() => onSelect(i, 2, 0)}
              style={{
                cursor: 'pointer',
                border: i === selectedIndex ? '2px solid #2675bf' : '1px solid rgba(255,255,255,0.05)',
                background: i === selectedIndex ? 'rgba(38,117,191,0.2)' : 'transparent',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 프리뷰 썸네일 */
function CellPreview({ imgSrc, fileName, type, cellIndex, direction, pattern, size }: {
  imgSrc: string;
  fileName: string;
  type: string;
  cellIndex: number;
  direction?: number;
  pattern?: number;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (type === 'characters') {
        const info = getCharacterSheetInfo(fileName);
        const fw = img.naturalWidth / info.totalCols;
        const fh = img.naturalHeight / info.totalRows;
        const charCol = cellIndex % info.charCols;
        const charRow = Math.floor(cellIndex / info.charCols);
        const dirRow = ROW_FROM_DIR[direction ?? 2] ?? 0;
        const pat = pattern ?? 1;
        const sx = (charCol * info.patterns + pat) * fw;
        const sy = (charRow * info.dirs + dirRow) * fh;
        canvas.width = fw;
        canvas.height = fh;
        canvas.getContext('2d')!.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      } else if (type === 'sv_actors') {
        // SV 배틀러: 9열×6행, walk 모션 중앙 프레임 (cx=1, cy=0)
        const fw = img.naturalWidth / 9;
        const fh = img.naturalHeight / 6;
        canvas.width = fw;
        canvas.height = fh;
        canvas.getContext('2d')!.drawImage(img, fw, 0, fw, fh, 0, 0, fw, fh);
      } else if (type === 'faces') {
        const cols = 4, rows = 2;
        const cw = img.naturalWidth / cols;
        const ch = img.naturalHeight / rows;
        const col = cellIndex % cols;
        const row = Math.floor(cellIndex / cols);
        canvas.width = cw;
        canvas.height = ch;
        canvas.getContext('2d')!.drawImage(img, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
      }
    };
    img.src = imgSrc;
  }, [imgSrc, fileName, type, cellIndex, direction, pattern]);

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: size, maxHeight: size, imageRendering: 'pixelated' }}
    />
  );
}

function getCellCount(type: string) {
  if (type === 'faces') return 8;
  if (type === 'characters') return 8;
  if (type === 'sv_actors') return 1;
  return 0;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

export default function ImagePicker({ type, value, onChange, index, onIndexChange, direction, onDirectionChange, pattern, onPatternChange, defaultOpen, open: openProp, onClose }: ImagePickerProps) {
  const controlled = openProp !== undefined;
  const [open, setOpen] = useState(defaultOpen ?? false);
  const isOpen = controlled ? openProp! : open;
  const closeModal = () => { if (!controlled) setOpen(false); onClose?.(); };
  useEscClose(useCallback(() => { if (isOpen) closeModal(); }, [isOpen])); // eslint-disable-line react-hooks/exhaustive-deps
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(index ?? 0);
  const [selectedDirection, setSelectedDirection] = useState(direction ?? 2);
  const [selectedPattern, setSelectedPattern] = useState(pattern ?? 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [currentSubDir, setCurrentSubDir] = useState('');
  // img/ 전체 탐색 모드: type 루트에서 상위로 이동 시 활성화
  const [fetchType, setFetchType] = useState<string>(type);
  // 하위폴더 미리 읽기 (false = 현재 폴더만, true = 전체 재귀)
  const [prefetchSubdirs, setPrefetchSubdirs] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // non-recursive 모드에서 폴더 이동 시 서버에 재요청
  const fetchShallow = useCallback((ft: string, subdir: string) => {
    const subdirParam = subdir ? `&subdir=${encodeURIComponent(subdir)}` : '';
    apiClient.get<FileInfo[]>(`/resources/${ft}?recursive=0${subdirParam}`)
      .then(setFiles).catch(() => setFiles([]));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(value);
    setSelectedIndex(index ?? 0);
    setSelectedDirection(direction ?? 2);
    setSelectedPattern(pattern ?? 1);
    setSearchQuery('');
    // value의 최상위 폴더가 prop type과 다르면 img 전체 탐색 모드로 시작
    const topFolder = value.includes('/') ? value.split('/')[0] : '';
    const isImgMode = topFolder !== '' && topFolder !== type;
    const ft = isImgMode ? 'img' : type;
    setFetchType(ft);
    const lastSlash = value.lastIndexOf('/');
    const subdir = lastSlash !== -1 ? value.substring(0, lastSlash) : '';
    setCurrentSubDir(subdir);
    // project-settings에서 imagePrefetchSubdirs 로드
    apiClient.get<{ imagePrefetchSubdirs?: boolean }>('/project-settings').then(ps => {
      const pref = ps.imagePrefetchSubdirs !== false;
      setPrefetchSubdirs(pref);
      if (pref) {
        apiClient.get<FileInfo[]>(`/resources/${ft}?detail=1`).then(setFiles).catch(() => setFiles([]));
      } else {
        fetchShallow(ft, subdir);
      }
    }).catch(() => {
      // 프로젝트가 없으면 recursive 모드로 폴백
      apiClient.get<FileInfo[]>(`/resources/${ft}?detail=1`).then(setFiles).catch(() => setFiles([]));
    });
    // 검색 입력창에 포커스
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAndSorted = useMemo(() => {
    let result = files;
    if (searchQuery) {
      result = result.filter(f => fuzzyMatch(f.name, searchQuery));
    }
    result = [...result].sort((a, b) => {
      switch (sortMode) {
        case 'size': return b.size - a.size;
        case 'mtime': return b.mtime - a.mtime;
        case 'name': default: return a.name.localeCompare(b.name);
      }
    });
    return result;
  }, [files, searchQuery, sortMode]);

  // 현재 폴더 기준 파일/하위폴더 분리 (검색 중에는 전체 표시)
  const { currentFiles, currentFolders } = useMemo(() => {
    if (searchQuery) {
      return { currentFiles: filteredAndSorted.filter(f => !f.isDir), currentFolders: [] };
    }
    // non-recursive 모드: 서버가 이미 현재 폴더 기준 항목을 반환
    if (!prefetchSubdirs) {
      return {
        currentFiles: filteredAndSorted.filter(f => !f.isDir),
        currentFolders: filteredAndSorted.filter(f => f.isDir).map(f => f.name).sort(),
      };
    }
    // recursive 모드: prefix 필터링
    const prefix = currentSubDir ? currentSubDir + '/' : '';
    const filesInDir: FileInfo[] = [];
    const foldersInDir = new Set<string>();
    for (const f of filteredAndSorted) {
      if (!f.name.startsWith(prefix)) continue;
      const rest = f.name.slice(prefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        filesInDir.push(f);
      } else {
        foldersInDir.add(rest.slice(0, slashIdx));
      }
    }
    return {
      currentFiles: filesInDir,
      currentFolders: Array.from(foldersInDir).sort(),
    };
  }, [filteredAndSorted, currentSubDir, searchQuery, prefetchSubdirs]);

  const navigateToFolder = (folderName: string) => {
    const next = currentSubDir ? `${currentSubDir}/${folderName}` : folderName;
    setCurrentSubDir(next);
    setSearchQuery('');
    if (!prefetchSubdirs) fetchShallow(fetchType, next);
  };

  const navigateUp = () => {
    const slash = currentSubDir.lastIndexOf('/');
    const next = slash !== -1 ? currentSubDir.substring(0, slash) : '';
    setCurrentSubDir(next);
    if (!prefetchSubdirs) fetchShallow(fetchType, next);
  };

  // type 루트에서 img/ 전체 탐색 모드로 전환
  const navigateToImgRoot = () => {
    setFetchType('img');
    const next = type; // img/ 기준에서 기존 type 폴더에서 시작
    setCurrentSubDir(next);
    setSearchQuery('');
    if (prefetchSubdirs) {
      apiClient.get<FileInfo[]>(`/resources/img?detail=1`).then(setFiles).catch(() => setFiles([]));
    } else {
      fetchShallow('img', next);
    }
  };

  // 체크박스 변경: project-settings 저장 + 파일 목록 재fetch
  const handlePrefetchChange = (checked: boolean) => {
    setPrefetchSubdirs(checked);
    apiClient.put('/project-settings', { imagePrefetchSubdirs: checked }).catch(() => {});
    if (checked) {
      apiClient.get<FileInfo[]>(`/resources/${fetchType}?detail=1`).then(setFiles).catch(() => setFiles([]));
    } else {
      fetchShallow(fetchType, currentSubDir);
    }
  };

  const handleOk = () => {
    onChange(selected.replace(/\.png$/i, ''), { fetchType });
    if (onIndexChange) onIndexChange(selectedIndex);
    if (onDirectionChange) onDirectionChange(selectedDirection);
    if (onPatternChange) onPatternChange(selectedPattern);
    closeModal();
  };

  const cellCount = getCellCount(type);
  const hasIndex = cellCount > 1;
  // 다이얼로그 내부용 (fetchType 기반)
  const getImgUrl = (name: string) => `/api/resources/${fetchType}/${name}`;
  // 다이얼로그 외부 프리뷰용 (value 기반 — fetchType이 아직 초기화 전일 수 있음)
  const getPreviewUrl = (name: string) => {
    const topFolder = name.includes('/') ? name.split('/')[0] : '';
    const ft = topFolder && topFolder !== type ? 'img' : type;
    return `/api/resources/${ft}/${name.includes('.') ? name : name + '.png'}`;
  };

  return (
    <div className="image-picker">
      {!controlled && <div className="image-picker-preview" onClick={() => setOpen(true)}>
        {value ? (
          (hasIndex && index !== undefined) || type === 'sv_actors' ? (
            <CellPreview
              imgSrc={getPreviewUrl(value)}
              fileName={value}
              type={type}
              cellIndex={index ?? 0}
              direction={direction}
              pattern={pattern}
              size={48}
            />
          ) : (
            <img
              src={getPreviewUrl(value)}
              alt={value}
              style={{ maxHeight: 48, maxWidth: 96 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )
        ) : (
          <span className="image-picker-none">(None)</span>
        )}
        <span className="image-picker-name">{value || '(None)'}</span>
      </div>}
      {isOpen && (
        <div className="modal-overlay">
          <div className="image-picker-dialog">
            <div className="image-picker-header">Select {type}</div>
            <div className="image-picker-toolbar">
              <input
                ref={searchInputRef}
                type="text"
                className="image-picker-search"
                placeholder="검색 (초성 지원: ㄱㄴㄷ)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select
                className="image-picker-sort"
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
              >
                <option value="name">이름순</option>
                <option value="size">용량순</option>
                <option value="mtime">최신순</option>
              </select>
              <label className="image-picker-prefetch-label" title="끄면 현재 폴더 내 파일만 로드 (대형 프로젝트 권장)">
                <input
                  type="checkbox"
                  checked={prefetchSubdirs}
                  onChange={e => handlePrefetchChange(e.target.checked)}
                />
                하위폴더 미리 읽기
              </label>
            </div>
            <div className="image-picker-body">
              <div className="image-picker-list">
                {/* breadcrumb */}
                {!searchQuery && (
                  <div className="image-picker-breadcrumb">
                    <span className="image-picker-breadcrumb-root" onClick={() => setCurrentSubDir('')} title="루트로 이동">
                      {fetchType === 'img' ? 'img' : type}
                    </span>
                    {currentSubDir && currentSubDir.split('/').map((seg, i, arr) => {
                      const path = arr.slice(0, i + 1).join('/');
                      return (
                        <React.Fragment key={path}>
                          <span className="image-picker-breadcrumb-sep">/</span>
                          <span className="image-picker-breadcrumb-seg" onClick={() => setCurrentSubDir(path)} title={path}>{seg}</span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
                {/* 상위 폴더로 이동 */}
                {!searchQuery && currentSubDir && (
                  <div className="image-picker-item image-picker-folder-up" onClick={navigateUp}>
                    <span className="image-picker-folder-icon">⬆</span>
                    <span className="image-picker-item-name">..</span>
                  </div>
                )}
                {/* type 루트에서 img/ 전체 탐색 모드로 올라가기 */}
                {!searchQuery && !currentSubDir && fetchType === type && (
                  <div className="image-picker-item image-picker-folder-up" onClick={navigateToImgRoot}>
                    <span className="image-picker-folder-icon">⬆</span>
                    <span className="image-picker-item-name">img/</span>
                  </div>
                )}
                {/* (None) */}
                {!searchQuery && !currentSubDir && (
                  <div
                    className={`image-picker-item${selected === '' ? ' selected' : ''}`}
                    onClick={() => setSelected('')}
                  >
                    (None)
                  </div>
                )}
                {/* 하위 폴더 목록 */}
                {currentFolders.map(folder => (
                  <div
                    key={folder}
                    className="image-picker-item image-picker-folder"
                    onClick={() => navigateToFolder(folder)}
                    title={folder}
                  >
                    <span className="image-picker-folder-icon">📁</span>
                    <span className="image-picker-item-name">{folder}</span>
                  </div>
                ))}
                {/* 파일 목록 */}
                {currentFiles.map(f => {
                  const name = f.name.replace(/\.png$/i, '');
                  const prefix = currentSubDir && !searchQuery ? currentSubDir + '/' : '';
                  const displayName = name.startsWith(prefix) ? name.slice(prefix.length) : name;
                  // non-recursive 모드에서 f.name은 파일명만 포함하므로 currentSubDir를 붙여야 함
                  const fullPath = !prefetchSubdirs && currentSubDir && !searchQuery
                    ? `${currentSubDir}/${name}`
                    : name;
                  const sizeStr = formatFileSize(f.size);
                  return (
                    <div
                      key={f.name}
                      className={`image-picker-item${selected === fullPath ? ' selected' : ''}`}
                      onClick={() => setSelected(fullPath)}
                      title={`${fullPath}\n${sizeStr}`}
                    >
                      <span className="image-picker-item-name">{highlightMatch(displayName, searchQuery)}</span>
                      <span className="image-picker-item-size">{sizeStr}</span>
                    </div>
                  );
                })}
              </div>
              <div className="image-picker-preview-area">
                {selected && hasIndex && onIndexChange ? (
                  <SheetSelector
                    imgSrc={getImgUrl(selected + '.png')}
                    fileName={selected}
                    type={type}
                    selectedIndex={selectedIndex}
                    selectedDirection={selectedDirection}
                    selectedPattern={selectedPattern}
                    onSelect={(idx, dir, pat) => {
                      setSelectedIndex(idx);
                      setSelectedDirection(dir);
                      setSelectedPattern(pat);
                    }}
                  />
                ) : selected ? (
                  <img
                    src={getImgUrl(selected + '.png')}
                    alt={selected}
                    style={{ maxWidth: '100%', maxHeight: 300, imageRendering: 'pixelated' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
              </div>
            </div>
            <div className="image-picker-footer">
              <button className="db-btn" onClick={() => {
                apiClient.post(`/resources/${type}/open-folder`, {}).catch(() => {});
              }} title="폴더 열기" style={{ marginRight: 'auto' }}>폴더 열기</button>
              <span style={{ color: '#8bc34a', fontSize: '0.8em', marginRight: 'auto' }}>PNG 파일(.png)만 인식 · 하위 폴더도 자동으로 탐색됩니다</span>
              <button className="db-btn" onClick={handleOk}>OK</button>
              <button className="db-btn" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
