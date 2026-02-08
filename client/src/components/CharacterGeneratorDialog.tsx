import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';

interface PartOption {
  name: string;
  file: string;
}

const PART_CATEGORIES = ['Hair', 'Face', 'Body', 'Accessories'] as const;
type PartCategory = typeof PART_CATEGORIES[number];

const DEFAULT_COLORS: Record<PartCategory, string> = {
  Hair: '#8B4513',
  Face: '#FFE0BD',
  Body: '#4169E1',
  Accessories: '#FFD700',
};

interface ResourceFile {
  name: string;
}

export default function CharacterGeneratorDialog() {
  const setShowCharacterGeneratorDialog = useEditorStore((s) => s.setShowCharacterGeneratorDialog);
  const [activeCategory, setActiveCategory] = useState<PartCategory>('Hair');
  const [selectedParts, setSelectedParts] = useState<Record<PartCategory, string>>({
    Hair: '', Face: '', Body: '', Accessories: '',
  });
  const [colors, setColors] = useState<Record<PartCategory, string>>(DEFAULT_COLORS);
  const [faceImages, setFaceImages] = useState<PartOption[]>([]);
  const [characterImages, setCharacterImages] = useState<PartOption[]>([]);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const faces = await apiClient.get<ResourceFile[]>('/resources/img_faces');
      if (Array.isArray(faces)) {
        setFaceImages(faces.map((f) => ({ name: f.name, file: f.name })));
      }
    } catch { /* ignore */ }
    try {
      const chars = await apiClient.get<ResourceFile[]>('/resources/img_characters');
      if (Array.isArray(chars)) {
        setCharacterImages(chars.map((f) => ({ name: f.name, file: f.name })));
      }
    } catch { /* ignore */ }
  };

  const getOptionsForCategory = (category: PartCategory): PartOption[] => {
    switch (category) {
      case 'Hair':
      case 'Face':
        return faceImages;
      case 'Body':
      case 'Accessories':
        return characterImages;
      default:
        return [];
    }
  };

  const handleSelectPart = (category: PartCategory, file: string) => {
    setSelectedParts((prev) => ({ ...prev, [category]: file }));
  };

  const handleColorChange = (category: PartCategory, color: string) => {
    setColors((prev) => ({ ...prev, [category]: color }));
  };

  const handleRandomize = useCallback(() => {
    const randomPick = (arr: PartOption[]) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)].file : '';
    setSelectedParts({
      Hair: randomPick(faceImages),
      Face: randomPick(faceImages),
      Body: randomPick(characterImages),
      Accessories: randomPick(characterImages),
    });
    setColors({
      Hair: `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`,
      Face: `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`,
      Body: `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`,
      Accessories: `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`,
    });
  }, [faceImages, characterImages]);

  const handleExportFace = useCallback(() => {
    if (!selectedParts.Face) {
      alert('No face selected');
      return;
    }
    const url = `/api/resources/img_faces/${encodeURIComponent(selectedParts.Face)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedParts.Face;
    a.click();
  }, [selectedParts.Face]);

  const handleExportCharacter = useCallback(() => {
    if (!selectedParts.Body) {
      alert('No body/character selected');
      return;
    }
    const url = `/api/resources/img_characters/${encodeURIComponent(selectedParts.Body)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedParts.Body;
    a.click();
  }, [selectedParts.Body]);

  const handleClose = () => setShowCharacterGeneratorDialog(false);

  const options = getOptionsForCategory(activeCategory);
  const selectedFacePreview = selectedParts.Face
    ? `/api/resources/img_faces/${encodeURIComponent(selectedParts.Face)}`
    : null;

  return (
    <div className="db-dialog-overlay" onClick={handleClose}>
      <div className="db-dialog" onClick={(e) => e.stopPropagation()} style={{ width: '70vw', height: '70vh' }}>
        <div className="db-dialog-header">Character Generator</div>
        <div className="db-dialog-body">
          {/* Part categories */}
          <div className="db-list" style={{ width: 140, minWidth: 140 }}>
            {PART_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className={`db-list-item${activeCategory === cat ? ' selected' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
                {selectedParts[cat] && (
                  <span style={{ color: '#999', fontSize: 10, marginLeft: 4 }}>*</span>
                )}
              </div>
            ))}
            <div style={{ borderTop: '1px solid #555', padding: '8px' }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Color</div>
              <input
                type="color"
                value={colors[activeCategory]}
                onChange={(e) => handleColorChange(activeCategory, e.target.value)}
                style={{ width: '100%', height: 30, border: 'none', cursor: 'pointer', background: 'transparent' }}
              />
            </div>
          </div>

          {/* Part selection */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#353535', borderRight: '1px solid #555' }}>
            {options.length === 0 && (
              <div className="db-placeholder">No images available</div>
            )}
            {options.map((opt) => (
              <div
                key={opt.file}
                className={`db-list-item${selectedParts[activeCategory] === opt.file ? ' selected' : ''}`}
                onClick={() => handleSelectPart(activeCategory, opt.file)}
              >
                {opt.name}
              </div>
            ))}
          </div>

          {/* Preview */}
          <div style={{ width: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#2b2b2b', padding: 16, gap: 16 }}>
            <div style={{ fontSize: 12, color: '#aaa' }}>Preview</div>
            <div style={{ width: 144, height: 144, border: '1px solid #555', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedFacePreview ? (
                <img
                  src={selectedFacePreview}
                  alt="Face preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                />
              ) : (
                <span style={{ color: '#666', fontSize: 11 }}>No face selected</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
              {Object.entries(selectedParts).filter(([, v]) => v).map(([k]) => k).join(', ') || 'No parts selected'}
            </div>
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleRandomize}>Randomize</button>
          <button className="db-btn" onClick={handleExportFace} disabled={!selectedParts.Face}>Export Face</button>
          <button className="db-btn" onClick={handleExportCharacter} disabled={!selectedParts.Body}>Export Character</button>
          <button className="db-btn" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
