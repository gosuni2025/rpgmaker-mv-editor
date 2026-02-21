import React from 'react';
import ExtBadge from '../common/ExtBadge';

interface FogOfWarSectionProps {
  currentMap: any;
  updateMapField: (field: string, value: unknown) => void;
}

export function FogOfWarSection({ currentMap, updateMapField }: FogOfWarSectionProps) {
  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">
        Fog of War <ExtBadge inline />
      </div>
      <label className="map-inspector-checkbox">
        <input type="checkbox" checked={!!(currentMap as any).fogOfWar?.enabled2D}
          onChange={(e) => {
            const prev = (currentMap as any).fogOfWar || { enabled2D: false, enabled3D: false, radius: 5, fogColor: '#000000', unexploredAlpha: 1.0, exploredAlpha: 0.6, fogHeight: 300, lineOfSight: true, absorption: 0.012, visibilityBrightness: 0.0, edgeAnimation: true, edgeAnimationSpeed: 1.0 };
            updateMapField('fogOfWar', { ...prev, enabled2D: e.target.checked });
          }} />
        <span>2D 활성화</span>
      </label>
      <label className="map-inspector-checkbox">
        <input type="checkbox" checked={!!(currentMap as any).fogOfWar?.enabled3D}
          onChange={(e) => {
            const prev = (currentMap as any).fogOfWar || { enabled2D: false, enabled3D: false, radius: 5, fogColor: '#000000', unexploredAlpha: 1.0, exploredAlpha: 0.6, fogHeight: 300, lineOfSight: true, absorption: 0.012, visibilityBrightness: 0.0, edgeAnimation: true, edgeAnimationSpeed: 1.0 };
            updateMapField('fogOfWar', { ...prev, enabled3D: e.target.checked });
          }} />
        <span>3D 활성화</span>
      </label>
      {((currentMap as any).fogOfWar?.enabled2D || (currentMap as any).fogOfWar?.enabled3D) && (() => {
        const fow = (currentMap as any).fogOfWar;
        return (
          <>
            {/* ── 공통 ── */}
            <div style={{ color: '#aaa', fontSize: 10, marginTop: 6, borderBottom: '1px solid #444', paddingBottom: 2 }}>공통</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>시야 반경</span>
              <input type="range" min={1} max={20} step={1}
                value={fow.radius ?? 5}
                onChange={(e) => updateMapField('fogOfWar', { ...fow, radius: Number(e.target.value) })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#aaa', minWidth: 24, textAlign: 'right' }}>
                {fow.radius ?? 5}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>안개 색상</span>
              <input type="color" value={fow.fogColor ?? '#000000'}
                onChange={(e) => updateMapField('fogOfWar', { ...fow, fogColor: e.target.value })}
                style={{ width: 28, height: 20, padding: 0, border: '1px solid #555', background: 'none', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: '#888' }}>{fow.fogColor ?? '#000000'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>미탐험</span>
              <input type="range" min={0} max={100} step={1}
                value={Math.round((fow.unexploredAlpha ?? 1.0) * 100)}
                onChange={(e) => updateMapField('fogOfWar', { ...fow, unexploredAlpha: Number(e.target.value) / 100 })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                {Math.round((fow.unexploredAlpha ?? 1.0) * 100)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>탐험완료</span>
              <input type="range" min={0} max={100} step={1}
                value={Math.round((fow.exploredAlpha ?? 0.6) * 100)}
                onChange={(e) => updateMapField('fogOfWar', { ...fow, exploredAlpha: Number(e.target.value) / 100 })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                {Math.round((fow.exploredAlpha ?? 0.6) * 100)}%
              </span>
            </div>
            <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={fow.lineOfSight !== false}
                onChange={(e) => updateMapField('fogOfWar', { ...fow, lineOfSight: e.target.checked })} />
              <span>시야 차단 (Line of Sight)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>전환 속도</span>
              <input type="range" min={1} max={20} step={0.5}
                value={fow.fogTransitionSpeed ?? 5.0}
                onChange={(e) => updateMapField('fogOfWar', { ...fow, fogTransitionSpeed: Number(e.target.value) })}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                {fow.fogTransitionSpeed ?? 5.0}
              </span>
            </div>

            {/* ── 2D 셰이더 ── */}
            <div className="fow-group fow-group-2d">
              <div className="fow-group-title">2D 셰이더</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>촉수 길이</span>
                <input type="range" min={0} max={40} step={1}
                  value={Math.round((fow.dissolveStrength ?? 2.0) * 10)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, dissolveStrength: Number(e.target.value) / 10 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {(fow.dissolveStrength ?? 2.0).toFixed(1)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>페이드 범위</span>
                <input type="range" min={5} max={100} step={5}
                  value={Math.round((fow.fadeSmoothness ?? 0.3) * 100)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, fadeSmoothness: Number(e.target.value) / 100 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {(fow.fadeSmoothness ?? 0.3).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>날카로움</span>
                <input type="range" min={10} max={60} step={1}
                  value={Math.round((fow.tentacleSharpness ?? 3.0) * 10)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, tentacleSharpness: Number(e.target.value) / 10 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {(fow.tentacleSharpness ?? 3.0).toFixed(1)}
                </span>
              </div>
              <label className="map-inspector-checkbox" style={{ marginTop: 2 }}>
                <input type="checkbox" checked={fow.edgeAnimation !== false}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, edgeAnimation: e.target.checked })} />
                <span>경계 애니메이션</span>
              </label>
              {fow.edgeAnimation !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>애니 속도</span>
                  <input type="range" min={10} max={300} step={10}
                    value={Math.round((fow.edgeAnimationSpeed ?? 1.0) * 100)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, edgeAnimationSpeed: Number(e.target.value) / 100 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {((fow.edgeAnimationSpeed ?? 1.0) * 100).toFixed(0)}%
                  </span>
                </div>
              )}

              {/* 촉수 타이밍 */}
              <div style={{ color: '#af6', fontSize: 10, marginTop: 8, borderTop: '1px solid #3a5a8a', paddingTop: 4 }}>촉수 타이밍</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>삭제 시간</span>
                <input type="range" min={1} max={50} step={1}
                  value={Math.round((fow.tentacleFadeDuration ?? 1.0) * 10)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, tentacleFadeDuration: Number(e.target.value) / 10 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {(fow.tentacleFadeDuration ?? 1.0).toFixed(1)}s
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>생성 시간</span>
                <input type="range" min={1} max={50} step={1}
                  value={Math.round((fow.tentacleGrowDuration ?? 0.5) * 10)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, tentacleGrowDuration: Number(e.target.value) / 10 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {(fow.tentacleGrowDuration ?? 0.5).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* ── 3D Volume ── */}
            <div className="fow-group fow-group-3d">
              <div className="fow-group-title">3D Volume</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>안개 높이</span>
                <input type="range" min={48} max={480} step={24}
                  value={fow.fogHeight ?? 200}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, fogHeight: Number(e.target.value) })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {fow.fogHeight ?? 200}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>흡수율</span>
                <input type="range" min={1} max={50} step={1}
                  value={Math.round((fow.absorption ?? 0.018) * 1000)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, absorption: Number(e.target.value) / 1000 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 36, textAlign: 'right' }}>
                  {(fow.absorption ?? 0.018).toFixed(3)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>가시 밝기</span>
                <input type="range" min={0} max={100} step={5}
                  value={Math.round((fow.visibilityBrightness ?? 0.0) * 100)}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, visibilityBrightness: Number(e.target.value) / 100 })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {(fow.visibilityBrightness ?? 0.0).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>해상도 (1/N)</span>
                <input type="range" min={1} max={8} step={1}
                  value={fow.volumeResolution ?? 4}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, volumeResolution: Number(e.target.value) })}
                  style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                  {fow.volumeResolution ?? 4}
                </span>
              </div>
              <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={fow.heightGradient !== false}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, heightGradient: e.target.checked })} />
                <span>높이 색상 그라데이션</span>
              </label>
              {fow.heightGradient !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>상단 색상</span>
                  <input type="color" value={fow.fogColorTop ?? '#1a1a26'}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, fogColorTop: e.target.value })}
                    style={{ width: 28, height: 20, padding: 0, border: '1px solid #555', background: 'none', cursor: 'pointer' }} />
                  <span style={{ fontSize: 11, color: '#888' }}>{fow.fogColorTop ?? '#1a1a26'}</span>
                </div>
              )}
              <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={fow.lineOfSight3D ?? false}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, lineOfSight3D: e.target.checked })} />
                <span>3D 시야 차단</span>
              </label>
              {fow.lineOfSight3D && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>눈 높이</span>
                  <input type="range" min={5} max={50} step={1}
                    value={Math.round((fow.eyeHeight ?? 1.5) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, eyeHeight: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.eyeHeight ?? 1.5).toFixed(1)}
                  </span>
                </div>
              )}
              <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={fow.godRay !== false}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, godRay: e.target.checked })} />
                <span>God Ray</span>
              </label>
              {fow.godRay !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>광선 강도</span>
                  <input type="range" min={0} max={20} step={1}
                    value={Math.round((fow.godRayIntensity ?? 0.4) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, godRayIntensity: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.godRayIntensity ?? 0.4).toFixed(1)}
                  </span>
                </div>
              )}
              <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={fow.vortex !== false}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, vortex: e.target.checked })} />
                <span>소용돌이</span>
              </label>
              {fow.vortex !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>소용돌이 속도</span>
                  <input type="range" min={0} max={50} step={1}
                    value={Math.round((fow.vortexSpeed ?? 1.0) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, vortexSpeed: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.vortexSpeed ?? 1.0).toFixed(1)}
                  </span>
                </div>
              )}
              <label className="map-inspector-checkbox" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={fow.lightScattering !== false}
                  onChange={(e) => updateMapField('fogOfWar', { ...fow, lightScattering: e.target.checked })} />
                <span>광산란</span>
              </label>
              {fow.lightScattering !== false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 80 }}>산란 강도</span>
                  <input type="range" min={0} max={30} step={1}
                    value={Math.round((fow.lightScatterIntensity ?? 1.0) * 10)}
                    onChange={(e) => updateMapField('fogOfWar', { ...fow, lightScatterIntensity: Number(e.target.value) / 10 })}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', minWidth: 30, textAlign: 'right' }}>
                    {(fow.lightScatterIntensity ?? 1.0).toFixed(1)}
                  </span>
                </div>
              )}
            </div>

          </>
        );
      })()}
    </div>
  );
}
