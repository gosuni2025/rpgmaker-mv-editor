import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventCommand } from '../../types/rpgMakerMV';
import type { EventCommandContext } from './EventCommandEditor';
import TranslateButton from '../common/TranslateButton';
import ExtBadge from '../common/ExtBadge';
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

  return (
    <div
      className={`event-command-row${isSelected ? ' selected' : ''}${isGroupHL ? ' group-highlight' : ''}${isDragging ? ' dragging' : ''}${isGroupFirst ? ' group-first' : ''}${isGroupLast ? ' group-last' : ''}${inGroup ? ' group-member' : ''}${isFolded ? ' folded' : ''}`}
      style={{ paddingLeft: draggable ? cmd.indent * 20 : 8 + cmd.indent * 20 }}
      onClick={e => onRowClick(index, e)}
      onDoubleClick={() => onDoubleClick(index)}
      onMouseDown={handleRowMouseDown}
    >
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
        (cmd.code === 108 || cmd.code === 408) ? <span style={{ color: '#4ec94e' }}>{display}</span> : display
      ) : <span style={{ color: '#555' }}>&loz;</span>}
      {cmd.code === 231 && cmd.parameters && !!(cmd.parameters[10] || cmd.parameters[11] || cmd.parameters[12]) && (
        <ExtBadge inline />
      )}
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
