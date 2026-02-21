import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MoveRoute, MoveCommand } from '../../types/rpgMakerMV';
import useEscClose from '../../hooks/useEscClose';
import {
  ROUTE_END, COMMAND_CODES,
  needsParams, getDefaultParams, getCommandDisplay,
  ParamInputDialog,
} from './MoveRouteParamDialog';
import './MoveRouteDialog.css';

interface MoveRouteDialogProps {
  moveRoute: MoveRoute;
  onOk: (route: MoveRoute) => void;
  onCancel: () => void;
  /** 이벤트 커맨드 205용: 대상 캐릭터 ID (-1=플레이어, 0=이 이벤트, N=이벤트) */
  characterId?: number;
  onOkWithCharacter?: (characterId: number, route: MoveRoute) => void;
  /** 현재 맵의 이벤트 목록 (캐릭터 선택 드롭다운용) */
  mapEvents?: { id: number; name: string }[];
}

export default function MoveRouteDialog({ moveRoute, onOk, onCancel, characterId, onOkWithCharacter, mapEvents }: MoveRouteDialogProps) {
  const { t } = useTranslation();
  const [charId, setCharId] = useState(characterId ?? -1);
  const [commands, setCommands] = useState<MoveCommand[]>(() => {
    const cmds = [...moveRoute.list];
    // 마지막이 ROUTE_END(0)가 아니면 추가
    if (cmds.length === 0 || cmds[cmds.length - 1].code !== ROUTE_END) {
      cmds.push({ code: ROUTE_END });
    }
    return cmds;
  });
  const [repeat, setRepeat] = useState(moveRoute.repeat);
  const [skippable, setSkippable] = useState(moveRoute.skippable);
  const [wait, setWait] = useState(moveRoute.wait);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [paramEdit, setParamEdit] = useState<{ code: number; params: unknown[]; editIdx?: number } | null>(null);
  useEscClose(useCallback(() => {
    if (paramEdit) setParamEdit(null);
    else onCancel();
  }, [paramEdit, onCancel]));
  const showCharacterSelect = onOkWithCharacter !== undefined;

  const addCommand = useCallback((code: number) => {
    if (needsParams(code)) {
      const defaults: unknown[] = getDefaultParams(code);
      setParamEdit({ code, params: defaults });
    } else {
      insertCommand({ code });
    }
  }, [selectedIdx, commands]);

  const insertCommand = useCallback((cmd: MoveCommand) => {
    setCommands(prev => {
      const newCmds = [...prev];
      const insertAt = selectedIdx >= 0 && selectedIdx < newCmds.length - 1
        ? selectedIdx + 1
        : newCmds.length - 1;
      newCmds.splice(insertAt, 0, cmd);
      setSelectedIdx(insertAt);
      return newCmds;
    });
  }, [selectedIdx]);

  const deleteSelected = useCallback(() => {
    if (selectedIdx < 0 || selectedIdx >= commands.length - 1) return;
    setCommands(prev => {
      const newCmds = [...prev];
      newCmds.splice(selectedIdx, 1);
      return newCmds;
    });
    setSelectedIdx(prev => Math.min(prev, commands.length - 2));
  }, [selectedIdx, commands.length]);

  const handleParamOk = useCallback((params: unknown[]) => {
    if (!paramEdit) return;
    const cmd: MoveCommand = { code: paramEdit.code, parameters: params };
    if (paramEdit.editIdx !== undefined) {
      setCommands(prev => {
        const newCmds = [...prev];
        newCmds[paramEdit.editIdx!] = cmd;
        return newCmds;
      });
    } else {
      insertCommand(cmd);
    }
    setParamEdit(null);
  }, [paramEdit, insertCommand]);

  const handleDoubleClick = useCallback((idx: number) => {
    const cmd = commands[idx];
    if (cmd.code === ROUTE_END) return;
    if (needsParams(cmd.code)) {
      setParamEdit({ code: cmd.code, params: [...(cmd.parameters || getDefaultParams(cmd.code))], editIdx: idx });
    }
  }, [commands]);

  const handleOk = () => {
    const route: MoveRoute = { list: commands, repeat, skippable, wait };
    if (onOkWithCharacter) {
      onOkWithCharacter(charId, route);
    } else {
      onOk(route);
    }
  };

  return (
    <div className="move-route-overlay">
      <div className="move-route-dialog">
        <div className="move-route-titlebar">{t('moveRoute.title')}</div>
        <div className="move-route-body">
          {showCharacterSelect && (
            <div className="move-route-character-select">
              <label>{t('moveRoute.character')}
                <select
                  value={charId}
                  onChange={e => setCharId(Number(e.target.value))}
                  className="event-editor-select"
                  style={{ marginLeft: 8, flex: 1 }}
                >
                  <option value={-1}>{t('moveRoute.player')}</option>
                  <option value={0}>{t('moveRoute.thisEvent')}</option>
                  {mapEvents?.map(ev => (
                    <option key={ev.id} value={ev.id}>{`${String(ev.id).padStart(3, '0')}: ${ev.name}`}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="move-route-left">
            <div className="move-route-list">
              {commands.map((cmd, i) => (
                <div
                  key={i}
                  className={`move-route-list-item${i === selectedIdx ? ' selected' : ''}`}
                  onClick={() => setSelectedIdx(i)}
                  onDoubleClick={() => handleDoubleClick(i)}
                >
                  {cmd.code === ROUTE_END ? '◆' : `◆ ${getCommandDisplay(cmd, t)}`}
                </div>
              ))}
            </div>
          </div>
          <div className="move-route-right">
            <div className="move-route-commands-grid">
              {COMMAND_CODES.map(code => (
                <button
                  key={code}
                  className="move-route-cmd-btn"
                  onClick={() => addCommand(code)}
                  title={t(`moveRoute.commands.${code}`)}
                >
                  {t(`moveRoute.commands.${code}`)}
                </button>
              ))}
            </div>
            <fieldset className="move-route-options">
              <legend>{t('moveRoute.options')}</legend>
              <label className="event-editor-checkbox">
                <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
                {t('moveRoute.repeat')}
              </label>
              <label className="event-editor-checkbox">
                <input type="checkbox" checked={skippable} onChange={e => setSkippable(e.target.checked)} />
                {t('moveRoute.skippable')}
              </label>
              <label className="event-editor-checkbox">
                <input type="checkbox" checked={wait} onChange={e => setWait(e.target.checked)} />
                {t('moveRoute.wait')}
              </label>
            </fieldset>
          </div>
        </div>
        <div className="move-route-footer">
          <button className="db-btn" onClick={deleteSelected} disabled={selectedIdx < 0 || selectedIdx >= commands.length - 1}>
            {t('common.delete')}
          </button>
          <div style={{ flex: 1 }} />
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
      {paramEdit && (
        <ParamInputDialog
          code={paramEdit.code}
          initialParams={paramEdit.params}
          onOk={handleParamOk}
          onCancel={() => setParamEdit(null)}
          t={t}
        />
      )}
    </div>
  );
}
