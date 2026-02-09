import React from 'react';
import type { Gender, OutputType } from './types';
import { GENDER_LABELS, OUTPUT_LABELS, EXPORT_TYPE_LABELS } from './types';
import { useCharacterGenerator } from './useCharacterGenerator';

export default function CharacterGeneratorDialog() {
  const {
    gender, setGender,
    outputType, setOutputType,
    activePart, setActivePart,
    activeColorLayerIdx, setActiveColorLayerIdx,
    selections, swatches,
    genStatus, copying, statusMsg,
    customPath, setCustomPath, pathError,
    exportModal, setExportModal, exportName, setExportName,
    canvasRef, exportInputRef,
    currentPartPatterns, currentSelection, currentVariations,
    colorLayerIndices, previewSize, scale, availableParts,
    handleSelectPattern, handleSelectColor, handleRandomize,
    openExportModal, doExport, handleCopyToProject,
    handleClose, handleSetCustomPath,
  } = useCharacterGenerator();

  // Generator 리소스 미사용 가능 상태
  if (genStatus && !genStatus.available) {
    return (
      <div className="db-dialog-overlay" onClick={handleClose}>
        <div className="db-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 560, height: 'auto' }}>
          <div className="db-dialog-header">캐릭터 생성기</div>
          <div style={{ padding: 20 }}>
            <p style={{ marginBottom: 16, color: '#ccc', textAlign: 'center' }}>
              Generator 리소스를 찾을 수 없습니다.
            </p>
            {genStatus.steamAvailable && (
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                  Steam에서 Generator 리소스를 감지했습니다.
                </p>
                <button className="db-btn" onClick={handleCopyToProject} disabled={copying}>
                  {copying ? '복사 중...' : '프로젝트에 복사'}
                </button>
              </div>
            )}
            <div style={{ borderTop: '1px solid #555', paddingTop: 16 }}>
              <p style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                Generator 폴더 경로를 직접 지정:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetCustomPath(); }}
                  placeholder="/path/to/Generator"
                  style={{
                    flex: 1, background: '#2b2b2b', border: '1px solid #555', borderRadius: 3,
                    padding: '6px 10px', color: '#ddd', fontSize: 12, outline: 'none',
                  }}
                />
                <button className="db-btn" onClick={handleSetCustomPath}>설정</button>
              </div>
              {pathError && <p style={{ marginTop: 6, fontSize: 11, color: '#f77' }}>{pathError}</p>}
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#888', lineHeight: '24px' }}>기본 경로:</span>
                <button className="db-btn" style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setCustomPath('~/Library/Application Support/Steam/steamapps/common/RPG Maker MV/RPG Maker MV.app/Contents/MacOS/Generator')}>
                  macOS
                </button>
                <button className="db-btn" style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setCustomPath('C:\\Program Files (x86)\\Steam\\steamapps\\common\\RPG Maker MV\\Generator')}>
                  Windows
                </button>
                <button className="db-btn" style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setCustomPath('~/.steam/steam/steamapps/common/RPG Maker MV/Generator')}>
                  Linux
                </button>
              </div>
            </div>
            {statusMsg && <p style={{ marginTop: 12, fontSize: 12, color: '#7af', textAlign: 'center' }}>{statusMsg}</p>}
          </div>
          <div className="db-dialog-footer">
            <button className="db-btn" onClick={handleClose}>닫기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-dialog-overlay" onClick={handleClose}>
      <div className="db-dialog cg-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="db-dialog-header" style={{ display: 'flex', alignItems: 'center' }}>
          <span>캐릭터 생성기</span>
          <div className="cg-gender-tabs">
            {(['Male', 'Female', 'Kid'] as Gender[]).map((g) => (
              <button
                key={g}
                className={`cg-gender-tab${gender === g ? ' active' : ''}`}
                onClick={() => setGender(g)}
              >
                {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <div className="cg-body">
          {/* 부품 목록 */}
          <div className="cg-parts-list">
            {availableParts.map((pn) => (
              <div
                key={pn}
                className={`cg-part-item${activePart === pn ? ' selected' : ''}`}
                onClick={() => { setActivePart(pn); setActiveColorLayerIdx(1); }}
              >
                <span>{pn}</span>
                {selections[pn]?.patternId && <span className="cg-part-active" />}
              </div>
            ))}
          </div>

          {/* 패턴 선택 + 색상 팔레트 */}
          <div className="cg-pattern-area">
            <div className="cg-pattern-grid">
              <div
                className={`cg-pattern-cell none-cell${currentSelection.patternId === null ? ' selected' : ''}`}
                onClick={() => handleSelectPattern(null)}
              >
                없음
              </div>
              {currentPartPatterns.map((pattern) => {
                const pId = pattern.id;
                const icon = currentVariations.find((v) => v.pattern === pId);
                return (
                  <div
                    key={pId}
                    className={`cg-pattern-cell${currentSelection.patternId === pId ? ' selected' : ''}`}
                    onClick={() => handleSelectPattern(pId)}
                  >
                    {icon ? (
                      <img
                        src={`/api/generator/image/Variation/${gender}/${icon.file}`}
                        alt={pId}
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: '#888' }}>{pId}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {currentSelection.patternId && (
              <div className="cg-color-area">
                <div className="cg-color-label">색상</div>
                {outputType === 'Face' && colorLayerIndices.length > 1 && (
                  <div className="cg-color-layer-tabs">
                    {colorLayerIndices.map((idx) => (
                      <button
                        key={idx}
                        className={`cg-color-layer-tab${activeColorLayerIdx === idx ? ' active' : ''}`}
                        onClick={() => setActiveColorLayerIdx(idx)}
                      >
                        c{idx}
                      </button>
                    ))}
                  </div>
                )}
                <div className="cg-color-swatches">
                  {swatches.map((sw) => (
                    <div
                      key={sw.row}
                      className={`cg-color-swatch${(currentSelection.colorRows[activeColorLayerIdx] ?? -1) === sw.row ? ' selected' : ''}`}
                      style={{ backgroundColor: sw.color }}
                      onClick={() => handleSelectColor(sw.row)}
                      title={`팔레트 ${sw.row}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 미리보기 */}
          <div className="cg-preview-area">
            <div className="cg-preview-tabs">
              {(['Face', 'TV', 'SV'] as OutputType[]).map((ot) => (
                <button
                  key={ot}
                  className={`cg-preview-tab${outputType === ot ? ' active' : ''}`}
                  onClick={() => setOutputType(ot)}
                >
                  {OUTPUT_LABELS[ot]}
                </button>
              ))}
            </div>
            <div className="cg-preview-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={previewSize.w}
                height={previewSize.h}
                style={{
                  width: previewSize.w * scale,
                  height: previewSize.h * scale,
                }}
              />
            </div>
            {statusMsg && (
              <div style={{ fontSize: 11, color: '#7af', textAlign: 'center' }}>{statusMsg}</div>
            )}
          </div>
        </div>

        <div className="db-dialog-footer">
          {!genStatus?.inProject && genStatus?.steamAvailable && (
            <button className="db-btn" onClick={handleCopyToProject} disabled={copying} style={{ marginRight: 'auto' }}>
              {copying ? '복사 중...' : '리소스를 프로젝트에 복사'}
            </button>
          )}
          <button className="db-btn" onClick={handleRandomize}>랜덤</button>
          <button className="db-btn" onClick={() => openExportModal('faces')}>얼굴 내보내기</button>
          <button className="db-btn" onClick={() => openExportModal('characters')}>걷기 내보내기</button>
          <button className="db-btn" onClick={() => openExportModal('sv_actors')}>전투 내보내기</button>
          <button className="db-btn" onClick={handleClose}>닫기</button>
        </div>
      </div>

      {/* 내보내기 모달 */}
      {exportModal && (
        <div className="db-dialog-overlay" style={{ zIndex: 2100 }} onClick={() => setExportModal(null)}>
          <div className="cg-export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="db-dialog-header">내보내기 - {EXPORT_TYPE_LABELS[exportModal.type]}</div>
            <div style={{ padding: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#aaa' }}>
                파일 이름
                <input
                  ref={exportInputRef}
                  type="text"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doExport(); }}
                  placeholder="예: GeneratedFace"
                  style={{
                    background: '#2b2b2b', border: '1px solid #555', borderRadius: 3,
                    padding: '6px 10px', color: '#ddd', fontSize: 13, outline: 'none',
                  }}
                />
              </label>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                .png 확장자는 자동으로 추가됩니다
              </div>
            </div>
            <div className="db-dialog-footer">
              <button className="db-btn" onClick={doExport} disabled={!exportName.trim()}>저장</button>
              <button className="db-btn" onClick={() => setExportModal(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
