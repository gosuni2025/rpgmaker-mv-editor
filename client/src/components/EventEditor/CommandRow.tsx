import React from 'react';
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
}

export const CommandRow = React.memo(function CommandRow({
  cmd, index, isSelected, isDragging, isGroupHL, isGroupFirst, isGroupLast, inGroup,
  draggable, displayCtx, onRowClick, onDoubleClick, onDragHandleMouseDown, context, commands,
}: CommandRowProps) {
  const { t } = useTranslation();
  const display = getCommandDisplay(cmd, displayCtx);

  return (
    <div
      className={`event-command-row${isSelected ? ' selected' : ''}${isGroupHL ? ' group-highlight' : ''}${isDragging ? ' dragging' : ''}${isGroupFirst ? ' group-first' : ''}${isGroupLast ? ' group-last' : ''}${inGroup ? ' group-member' : ''}`}
      style={{ paddingLeft: draggable ? cmd.indent * 20 : 8 + cmd.indent * 20 }}
      onClick={e => onRowClick(index, e)}
      onDoubleClick={() => onDoubleClick(index)}
    >
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
