import React, { useState, useMemo } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { selectStyle } from './messageEditors';
import './ShowChoicesEditor.css';

export function ShowChoicesEditor({ p, onOk, onCancel }: {
  p: unknown[];
  onOk: (params: unknown[], extra?: EventCommand[]) => void;
  onCancel: () => void;
}) {
  const initChoices = (p[0] as string[]) || [];
  const [choices, setChoices] = useState<string[]>(() => {
    const arr = [...initChoices];
    while (arr.length < 6) arr.push('');
    return arr.slice(0, 6);
  });
  const [cancelType, setCancelType] = useState<number>((p[1] as number) ?? -2);
  const [defaultType, setDefaultType] = useState<number>((p[2] as number) ?? 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) ?? 2);
  const [background, setBackground] = useState<number>((p[4] as number) ?? 0);

  const activeCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 6; i++) {
      if (choices[i].trim() !== '') count = i + 1;
    }
    return Math.max(count, 1);
  }, [choices]);

  const handleChoiceChange = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleOk = () => {
    const activeChoices = choices.slice(0, activeCount);
    const extraCommands: EventCommand[] = [];
    for (let i = 0; i < activeCount; i++) {
      extraCommands.push({ code: 402, indent: 0, parameters: [i, activeChoices[i]] });
      extraCommands.push({ code: 0, indent: 1, parameters: [] });
    }
    if (cancelType === -1) {
      extraCommands.push({ code: 403, indent: 0, parameters: [6] });
      extraCommands.push({ code: 0, indent: 1, parameters: [] });
    }
    extraCommands.push({ code: 404, indent: 0, parameters: [] });
    onOk([activeChoices, cancelType, defaultType, positionType, background], extraCommands);
  };

  const choiceOptions = useMemo(() => {
    const opts: { value: number; label: string }[] = [];
    for (let i = 0; i < activeCount; i++) opts.push({ value: i, label: `선택 #${i + 1}` });
    return opts;
  }, [activeCount]);

  return (
    <div className="show-choices-editor">
      <div className="show-choices-layout">
        <div className="show-choices-left">
          <div className="db-form-section">선택지</div>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="show-choices-row">
              <label className="show-choices-label">#{i + 1}:</label>
              <input type="text" value={choices[i]} onChange={e => handleChoiceChange(i, e.target.value)} style={{ ...selectStyle, flex: 1 }} />
            </div>
          ))}
        </div>
        <div className="show-choices-right">
          <label style={{ fontSize: 12, color: '#aaa' }}>배경:<select value={background} onChange={e => setBackground(Number(e.target.value))} style={selectStyle}><option value={0}>창</option><option value={1}>어둡게</option><option value={2}>투명</option></select></label>
          <label style={{ fontSize: 12, color: '#aaa' }}>창의 위치:<select value={positionType} onChange={e => setPositionType(Number(e.target.value))} style={selectStyle}><option value={0}>왼쪽</option><option value={1}>가운데</option><option value={2}>오른쪽</option></select></label>
          <label style={{ fontSize: 12, color: '#aaa' }}>초기값:<select value={defaultType} onChange={e => setDefaultType(Number(e.target.value))} style={selectStyle}>{choiceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}<option value={-1}>없음</option></select></label>
          <label style={{ fontSize: 12, color: '#aaa' }}>취소:<select value={cancelType} onChange={e => setCancelType(Number(e.target.value))} style={selectStyle}>{choiceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}<option value={-1}>분기</option><option value={-2}>허용 안 함</option></select></label>
        </div>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}
