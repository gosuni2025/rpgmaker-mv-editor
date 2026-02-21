import type { EventCommand } from '../../types/rpgMakerMV';

/**
 * Build extra EventCommands from text, with optional bulk input (split every 4 lines).
 * Used by ShowTextEditor (101+401) and ShowTextEditorDialog.
 */
export function buildTextExtra(
  text: string, bulkInput: boolean, followCode: number, showTextParams?: unknown[],
): EventCommand[] {
  if (bulkInput && showTextParams) {
    const allLines = text.split('\n');
    const groups: string[][] = [];
    for (let i = 0; i < allLines.length; i += 4) {
      groups.push(allLines.slice(i, i + 4));
    }
    if (groups.length === 0) groups.push([]);
    const extra: EventCommand[] = groups[0].map(line => ({ code: followCode, indent: 0, parameters: [line] }));
    for (let i = 1; i < groups.length; i++) {
      extra.push({ code: 101, indent: 0, parameters: [...showTextParams] });
      groups[i].forEach(line => extra.push({ code: followCode, indent: 0, parameters: [line] }));
    }
    return extra;
  }
  return text.split('\n').map(line => ({ code: followCode, indent: 0, parameters: [line] }));
}
