/**
 * TroopPreview
 * 적 군단 배치 미리보기 컴포넌트.
 * TroopsTab과 TroopPickerDialog에서 공용으로 사용.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Troop, TroopMember } from '../../types/rpgMakerMV';
import './TroopPreview.css';

const PREVIEW_W = 816;
const PREVIEW_H = 624;

interface EnemyRef {
  id: number;
  battlerName?: string;
}

interface TroopPreviewProps {
  troop: Troop | null | undefined;
  enemies: EnemyRef[];
  battleback1?: string;
  battleback2?: string;
  /** 드래그 가능 여부 (TroopsTab에서만 true) */
  draggable?: boolean;
  onMembersChange?: (members: TroopMember[]) => void;
  /** 외부에서 선택된 멤버 인덱스 제어 (draggable 모드용) */
  selectedMemberIdx?: number;
  onSelectMember?: (idx: number) => void;
  className?: string;
}

export default function TroopPreview({
  troop,
  enemies,
  battleback1 = '',
  battleback2 = '',
  draggable = false,
  onMembersChange,
  selectedMemberIdx: externalSelectedIdx,
  onSelectMember,
  className,
}: TroopPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [enemyImages, setEnemyImages] = useState<Record<string, HTMLImageElement>>({});
  const [internalSelectedIdx, setInternalSelectedIdx] = useState(-1);
  const [dragging, setDragging] = useState<{ memberIdx: number; offsetX: number; offsetY: number } | null>(null);

  // 외부 제어가 있으면 외부값 사용, 없으면 내부값 사용
  const selectedMemberIdx = externalSelectedIdx !== undefined ? externalSelectedIdx : internalSelectedIdx;

  const handleSelectMember = (idx: number) => {
    setInternalSelectedIdx(idx);
    onSelectMember?.(idx);
  };

  const battlerNamesNeeded = useMemo(() => {
    if (!troop) return [];
    const names = new Set<string>();
    for (const m of troop.members || []) {
      const en = enemies.find(e => e.id === m.enemyId);
      if (en?.battlerName) names.add(en.battlerName);
    }
    return Array.from(names);
  }, [troop, enemies]);

  useEffect(() => {
    for (const name of battlerNamesNeeded) {
      if (enemyImages[name]) continue;
      const img = new Image();
      img.src = `/img/enemies/${name}.png`;
      img.onload = () => setEnemyImages(prev => ({ ...prev, [name]: img }));
    }
  }, [battlerNamesNeeded]);

  // 선택 해제 (troop 변경 시)
  useEffect(() => {
    setInternalSelectedIdx(-1);
    onSelectMember?.(-1);
  }, [troop?.id]);

  const enemyBattlerMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const e of enemies) if (e.battlerName) m[e.id] = e.battlerName;
    return m;
  }, [enemies]);

  const handleMouseDown = (e: React.MouseEvent, idx: number) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const member = troop?.members?.[idx];
    if (!member) return;
    const scaleX = rect.width / PREVIEW_W;
    const scaleY = rect.height / PREVIEW_H;
    setDragging({
      memberIdx: idx,
      offsetX: e.clientX - rect.left - member.x * scaleX,
      offsetY: e.clientY - rect.top - member.y * scaleY,
    });
  };

  useEffect(() => {
    if (!dragging || !draggable) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = previewRef.current?.getBoundingClientRect();
      if (!rect || !troop) return;
      const scaleX = rect.width / PREVIEW_W;
      const scaleY = rect.height / PREVIEW_H;
      let x = Math.round((e.clientX - rect.left - dragging.offsetX) / scaleX);
      let y = Math.round((e.clientY - rect.top - dragging.offsetY) / scaleY);
      x = Math.max(0, Math.min(PREVIEW_W, x));
      y = Math.max(0, Math.min(PREVIEW_H, y));
      const members = [...(troop.members || [])];
      members[dragging.memberIdx] = { ...members[dragging.memberIdx], x, y };
      onMembersChange?.(members);
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, draggable, troop, onMembersChange]);

  return (
    <div
      ref={previewRef}
      className={`troop-preview-area${className ? ' ' + className : ''}`}
    >
      {battleback1 && (
        <img className="troop-preview-bg" src={`/img/battlebacks1/${battleback1}.png`} alt="" />
      )}
      {battleback2 && (
        <img className="troop-preview-bg" src={`/img/battlebacks2/${battleback2}.png`} alt="" style={{ zIndex: 1 }} />
      )}
      {(troop?.members || []).map((member: TroopMember, i: number) => {
        const battlerName = enemyBattlerMap[member.enemyId];
        const img = battlerName ? enemyImages[battlerName] : null;
        if (!img) return null;
        const rect = previewRef.current?.getBoundingClientRect();
        const scaleX = rect ? rect.width / PREVIEW_W : 1;
        const scaleY = rect ? rect.height / PREVIEW_H : 1;
        const scale = Math.min(scaleX, scaleY);
        return (
          <img
            key={i}
            className={`troop-preview-enemy${member.hidden ? ' hidden-enemy' : ''}${draggable && i === selectedMemberIdx ? ' selected' : ''}`}
            src={img.src}
            style={{
              left: member.x * scaleX,
              top: member.y * scaleY,
              width: img.naturalWidth * scale,
              height: img.naturalHeight * scale,
              zIndex: 2 + i,
              cursor: draggable ? 'move' : 'default',
            }}
            onMouseDown={(e) => { if (draggable) { handleSelectMember(i); handleMouseDown(e, i); } }}
            draggable={false}
            alt=""
          />
        );
      })}
    </div>
  );
}
