import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

interface ImagePickerProps {
  type: 'faces' | 'characters' | 'sv_actors' | 'sv_enemies' | 'enemies' | 'battlebacks1' | 'battlebacks2' | 'parallaxes' | 'tilesets' | 'titles1' | 'titles2' | 'animations' | 'pictures';
  value: string;
  onChange: (name: string) => void;
  index?: number;
  onIndexChange?: (index: number) => void;
}

export default function ImagePicker({ type, value, onChange, index, onIndexChange }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(index ?? 0);

  useEffect(() => {
    if (!open) return;
    setSelected(value);
    setSelectedIndex(index ?? 0);
    apiClient.get<string[]>(`/resources/${type}`).then(setFiles).catch(() => setFiles([]));
  }, [open]);

  const handleOk = () => {
    onChange(selected.replace(/\.png$/i, ''));
    if (onIndexChange) onIndexChange(selectedIndex);
    setOpen(false);
  };

  const getCellCount = () => {
    if (type === 'faces') return 8;
    if (type === 'characters') return 8;
    if (type === 'sv_actors') return 1;
    return 0;
  };

  const getCellLayout = () => {
    if (type === 'faces') return { cols: 4, rows: 2, cellW: 144, cellH: 144 };
    if (type === 'characters') return { cols: 4, rows: 2, cellW: 48, cellH: 48 };
    return { cols: 1, rows: 1, cellW: 48, cellH: 48 };
  };

  const getImgUrl = (name: string) => `/api/resources/${type}/${name}`;

  const cellCount = getCellCount();
  const layout = getCellLayout();

  return (
    <div className="image-picker">
      <div className="image-picker-preview" onClick={() => setOpen(true)}>
        {value ? (
          cellCount > 1 && index !== undefined ? (
            <div style={{
              width: type === 'faces' ? 48 : 32,
              height: type === 'faces' ? 48 : 32,
              overflow: 'hidden',
              position: 'relative',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}>
              <img
                src={getImgUrl(value.includes('.') ? value : value + '.png')}
                alt={value}
                style={{
                  position: 'absolute',
                  width: layout.cols * (type === 'faces' ? 48 : 32),
                  height: layout.rows * (type === 'faces' ? 48 : 32),
                  left: -(index % layout.cols) * (type === 'faces' ? 48 : 32),
                  top: -Math.floor(index / layout.cols) * (type === 'faces' ? 48 : 32),
                  imageRendering: 'pixelated',
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          ) : (
            <img
              src={getImgUrl(value.includes('.') ? value : value + '.png')}
              alt={value}
              style={{ maxHeight: 48, maxWidth: 96 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )
        ) : (
          <span className="image-picker-none">(None)</span>
        )}
        <span className="image-picker-name">{value || '(None)'}</span>
      </div>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="image-picker-dialog" onClick={e => e.stopPropagation()}>
            <div className="image-picker-header">Select {type}</div>
            <div className="image-picker-body">
              <div className="image-picker-list">
                <div
                  className={`image-picker-item${selected === '' ? ' selected' : ''}`}
                  onClick={() => setSelected('')}
                >
                  (None)
                </div>
                {files.map(f => {
                  const name = f.replace(/\.png$/i, '');
                  return (
                    <div
                      key={f}
                      className={`image-picker-item${selected === name ? ' selected' : ''}`}
                      onClick={() => setSelected(name)}
                    >
                      {name}
                    </div>
                  );
                })}
              </div>
              <div className="image-picker-preview-area">
                {selected && cellCount > 1 && onIndexChange ? (
                  <div className="image-picker-cell-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                    gap: 2,
                    maxWidth: type === 'faces' ? 400 : 300,
                  }}>
                    {Array.from({ length: cellCount }, (_, i) => {
                      const cellCol = i % layout.cols;
                      const cellRow = Math.floor(i / layout.cols);
                      return (
                        <div
                          key={i}
                          className={`image-picker-cell${i === selectedIndex ? ' selected' : ''}`}
                          onClick={() => setSelectedIndex(i)}
                          style={{
                            cursor: 'pointer',
                            border: i === selectedIndex ? '2px solid #2675bf' : '2px solid transparent',
                            borderRadius: 3,
                            overflow: 'hidden',
                            position: 'relative',
                            aspectRatio: `${layout.cellW}/${layout.cellH}`,
                            background: i === selectedIndex ? 'rgba(38,117,191,0.15)' : 'transparent',
                          }}
                        >
                          <div style={{
                            width: `${layout.cols * 100}%`,
                            position: 'relative',
                            left: `${-cellCol * 100}%`,
                            top: `${-cellRow * 100}%`,
                          }}>
                            <img
                              src={getImgUrl(selected + '.png')}
                              alt={`${selected} #${i}`}
                              style={{ width: '100%', display: 'block', imageRendering: 'pixelated' }}
                              draggable={false}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
              <button className="db-btn" onClick={handleOk}>OK</button>
              <button className="db-btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
