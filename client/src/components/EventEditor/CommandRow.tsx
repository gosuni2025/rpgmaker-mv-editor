import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventCommand } from '../../types/rpgMakerMV';
import type { EventCommandContext } from './EventCommandEditor';
import TranslateButton from '../common/TranslateButton';
import { getCommandDisplay, type CommandDisplayContext } from './commandDisplayText';

interface CommandRowProps {
  cmd: EventCommand;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  isGroupHL: boolean;
  isGroupFirst: boolean;
  isGroupLast: boolean;
  inGroup: boolean;
  draggable: boolean;
  displayCtx: CommandDisplayContext;
  onRowClick: (index: number, e: React.MouseEvent) => void;
  onDoubleClick: (index: number) => void;
  onDragHandleMouseDown: (e: React.MouseEvent, index: number) => void;
  context?: EventCommandContext;
  commands: EventCommand[];
  isFoldable?: boolean;
  isFolded?: boolean;
  foldedCount?: number;
  onToggleFold?: (index: number) => void;
}

// 커맨드 코드별 텍스트 색상 (카테고리 기준)
function getCommandColor(code: number): string | undefined {
  // 댓글 — 초록
  if (code === 108 || code === 408) return '#4ec94e';
  // 메시지/선택지/텍스트 입력 — 파랑
  if ([101, 401, 102, 402, 403, 404, 103, 104, 105, 405].includes(code)) return '#5b9bd5';
  // 흐름 제어 (조건분기, 루프, 중단, 라벨, 공통이벤트) — 주황
  if ([111, 411, 412, 112, 413, 113, 115, 116, 117, 118, 119].includes(code)) return '#e8a020';
  // 변수/스위치/타이머 조작 — 노랑
  if ([121, 122, 123, 124].includes(code)) return '#d4c84a';
  // 파티/아이템/장비 증감 — 연보라
  if ([125, 126, 127, 128, 129].includes(code)) return '#a87ed4';
  // 시스템 설정 (BGM변경, 접근제한 등) — 회청
  if ([132, 133, 134, 135, 136, 137, 138, 139, 140].includes(code)) return '#7ea8c8';
  // 이동/캐릭터 제어 — 보라
  if ([201, 202, 203, 204, 205, 206, 211, 212, 213, 214, 216, 217].includes(code)) return '#9b7ed4';
  // 화면 효과/대기 — 청록
  if ([221, 222, 223, 224, 225, 226, 230].includes(code)) return '#4ec9b0';
  // 그림 표시/이동/소거 — 연주황
  if ([231, 232, 233, 234, 235, 236].includes(code)) return '#d4a87e';
  // 오디오 (BGM/BGS/ME/SE) — 시안
  if ([241, 242, 243, 244, 245, 246, 249, 250, 251].includes(code)) return '#4ec8c8';
  // 씬 제어/맵 설정/동영상 — 연녹
  if ([261, 281, 282, 283, 284, 285].includes(code)) return '#7ec87e';
  // 전투 처리/분기 — 빨강
  if ([301, 601, 602, 603, 604].includes(code)) return '#e87878';
  // 상점/이름입력 — 살구
  if ([302, 605, 303].includes(code)) return '#d4b07e';
  // 액터 조작 — 연보라(밝음)
  if ([311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326].includes(code)) return '#c87ed4';
  // 적 조작/전투 행동 — 연빨강
  if ([331, 332, 333, 334, 335, 336, 337, 339, 340, 342].includes(code)) return '#e8a0a0';
  // 씬 전환/메뉴/저장/게임오버 — 연회
  if ([351, 352, 353, 354].includes(code)) return '#a0a0c8';
  // 스크립트/플러그인 커맨드 — 핑크
  if ([355, 655, 356].includes(code)) return '#e87ec8';
  return undefined;
}

// indent 레인보우 색상 (VSCode indent-rainbow 스타일, 다크 테마에 맞게 낮은 opacity)
const INDENT_COLORS = [
  'rgba(255, 255, 64, 0.10)',   // 노랑
  'rgba(127, 255, 127, 0.10)',  // 초록
  'rgba(255, 127, 255, 0.10)',  // 마젠타
  'rgba(79, 236, 236, 0.10)',   // 시안
];

const INDENT_WIDTH = 20; // paddingLeft per indent level (px)

export const CommandRow = React.memo(function CommandRow({
  cmd, index, isSelected, isDragging, isGroupHL, isGroupFirst, isGroupLast, inGroup,
  draggable, displayCtx, onRowClick, onDoubleClick, onDragHandleMouseDown, context, commands,
  isFoldable, isFolded, foldedCount, onToggleFold,
}: CommandRowProps) {
  const { t } = useTranslation();
  const display = getCommandDisplay(cmd, displayCtx);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragStarted = useRef(false);

  // 메인 커맨드 행(foldable) 드래그: 행 전체에서 mousedown으로 드래그 시작
  const handleRowMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFoldable || !draggable) return;
    // 폴드 토글 버튼이나 드래그 핸들 클릭은 무시
    const target = e.target as HTMLElement;
    if (target.closest('.fold-toggle') || target.closest('.drag-handle')) return;

    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    isDragStarted.current = false;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!mouseDownPos.current) return;
      const dx = ev.clientX - mouseDownPos.current.x;
      const dy = ev.clientY - mouseDownPos.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragStarted.current = true;
        mouseDownPos.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // 합성 이벤트로 드래그 핸들 mousedown 트리거
        onDragHandleMouseDown(e, index);
      }
    };

    const handleMouseUp = () => {
      mouseDownPos.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isFoldable, draggable, onDragHandleMouseDown, index]);

  // indent 가이드 렌더링
  const indentGuides = [];
  for (let level = 0; level < cmd.indent; level++) {
    indentGuides.push(
      <span
        key={level}
        className="indent-guide"
        style={{
          left: level * INDENT_WIDTH,
          width: INDENT_WIDTH,
          backgroundColor: INDENT_COLORS[level % INDENT_COLORS.length],
        }}
      />
    );
  }

  return (
    <div
      className={`event-command-row${isSelected ? ' selected' : ''}${isGroupHL ? ' group-highlight' : ''}${isDragging ? ' dragging' : ''}${isGroupFirst ? ' group-first' : ''}${isGroupLast ? ' group-last' : ''}${inGroup ? ' group-member' : ''}${isFolded ? ' folded' : ''}`}
      style={{ paddingLeft: draggable ? cmd.indent * INDENT_WIDTH : 8 + cmd.indent * INDENT_WIDTH }}
      data-cmd-index={index}
      onClick={e => onRowClick(index, e)}
      onDoubleClick={() => onDoubleClick(index)}
      onMouseDown={handleRowMouseDown}
    >
      {indentGuides}
      {isFoldable ? (
        <span
          className="fold-toggle"
          onClick={e => { e.stopPropagation(); onToggleFold?.(index); }}
        >
          {isFolded ? '▶' : '▼'}
        </span>
      ) : (
        draggable ? <span className="fold-toggle-placeholder" /> : null
      )}
      {draggable && (
        <span
          className="drag-handle"
          onMouseDown={e => onDragHandleMouseDown(e, index)}
          title={t('eventCommands.dragToMove')}
        >
          ⠿
        </span>
      )}
      {display ? (
        (() => { const c = getCommandColor(cmd.code); return c ? <span style={{ color: c }}>{display}</span> : display; })()
      ) : <span style={{ color: '#555' }}>&loz;</span>}
      {isFolded && foldedCount !== undefined && foldedCount > 0 && (
        <span className="fold-count-badge">+{foldedCount}줄</span>
      )}
      {context && [101, 102, 105, 320, 324, 325].includes(cmd.code) && (() => {
        const prefix = context.isCommonEvent
          ? `ce${context.commonEventId}`
          : `ev${context.eventId}.page${(context.pageIndex || 0) + 1}`;
        const csvPath = context.isCommonEvent ? 'common_events.csv' : `maps/map${String(context.mapId).padStart(3, '0')}.csv`;
        let sourceText = '';
        if (cmd.code === 101 || cmd.code === 105) {
          const lines: string[] = [];
          const followCode = cmd.code === 101 ? 401 : 405;
          for (let j = index + 1; j < commands.length && commands[j].code === followCode; j++) {
            lines.push(commands[j].parameters[0] as string);
          }
          sourceText = lines.join('\n');
        } else if (cmd.code === 102) {
          sourceText = ((cmd.parameters[0] as string[]) || []).join(', ');
        } else if (cmd.code === 320 || cmd.code === 324 || cmd.code === 325) {
          sourceText = (cmd.parameters[1] as string) || '';
        }
        return sourceText ? (
          <TranslateButton csvPath={csvPath} entryKey={`${prefix}.cmd${index}`} sourceText={sourceText} />
        ) : null;
      })()}
    </div>
  );
});
