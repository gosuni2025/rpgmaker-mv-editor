export interface PluginParamMeta {
  name: string;
  text?: string;       // @text 표시명
  desc: string;
  type: string;       // string, number, boolean, select, file, combo, note, etc.
  default: string;
  options: { label: string; value: string }[];  // for select/combo @option entries
  dir: string;         // for file type @dir
  min?: string;
  max?: string;
  parent?: string;     // for nested @parent
}

export interface PluginArgMeta {
  name: string;
  text: string;
  type: string;
  default: string;
  options: { label: string; value: string }[];
  min?: string;
  max?: string;
  desc?: string;
}

export interface PluginCommandMeta {
  name: string;
  text: string;
  desc: string;
  args: PluginArgMeta[];
}

export interface PluginMetadata {
  pluginname: string;
  plugindesc: string;
  author: string;
  help: string;
  params: PluginParamMeta[];
  commands?: PluginCommandMeta[];
  plugincommand?: string;   // @plugincommand — 실제 커맨드 prefix (파일명과 다를 경우 명시)
  dependencies?: string[];  // e.g. ['EXT']
}

export function parsePluginMetadata(content: string, locale?: string): PluginMetadata {
  let block: string | null = null;

  // Try locale-specific block first (e.g. /*:ko ... */)
  if (locale) {
    const localeRegex = new RegExp(`\\/\\*:${locale}\\s*\\n([\\s\\S]*?)\\*\\/`);
    const localeMatch = content.match(localeRegex);
    if (localeMatch) block = localeMatch[1];
  }

  // Fall back to default /*: ... */ block
  if (!block) {
    const defaultMatch = content.match(/\/\*:\s*\n([\s\S]*?)\*\//);
    if (!defaultMatch) return { pluginname: '', plugindesc: '', author: '', help: '', params: [] };
    block = defaultMatch[1];
  }
  const lines = block.split('\n').map(l => l.replace(/^\s*\*\s?/, ''));

  let pluginname = '';
  let plugindesc = '';
  let author = '';
  let help = '';
  let plugincommand = '';
  const params: PluginParamMeta[] = [];
  const commands: PluginCommandMeta[] = [];
  let currentParam: PluginParamMeta | null = null;
  let currentCommand: PluginCommandMeta | null = null;
  let currentArg: PluginArgMeta | null = null;
  // pending option label: @option sets label, @value sets value
  let pendingOptionLabel: string | null = null;
  let inHelp = false;

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)\s*(.*)/);
    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      const value = tagMatch[2].trim();

      if (tag === 'pluginname') {
        pluginname = value;
        inHelp = false;
      } else if (tag === 'plugindesc') {
        plugindesc = value;
        inHelp = false;
      } else if (tag === 'author') {
        author = value;
        inHelp = false;
      } else if (tag === 'plugincommand') {
        plugincommand = value;
        inHelp = false;
      } else if (tag === 'help') {
        help = value;
        inHelp = true;
      } else if (tag === 'command') {
        inHelp = false;
        // flush pending state
        if (pendingOptionLabel !== null && currentArg) {
          currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = null;
        }
        if (currentArg && currentCommand) { currentCommand.args.push(currentArg); currentArg = null; }
        if (currentParam) { params.push(currentParam); currentParam = null; }
        if (currentCommand) commands.push(currentCommand);
        currentCommand = { name: value, text: '', desc: '', args: [] };
      } else if (tag === 'arg') {
        inHelp = false;
        if (pendingOptionLabel !== null && currentArg) {
          currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = null;
        }
        if (currentArg && currentCommand) currentCommand.args.push(currentArg);
        currentArg = { name: value, text: '', type: 'string', default: '', options: [] };
      } else if (currentArg) {
        inHelp = false;
        if (tag === 'text') { currentArg.text = value; }
        else if (tag === 'type') { currentArg.type = value; }
        else if (tag === 'default') { currentArg.default = value; }
        else if (tag === 'option') {
          if (pendingOptionLabel !== null) currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = value;
        } else if (tag === 'value') {
          if (pendingOptionLabel !== null) { currentArg.options.push({ label: pendingOptionLabel, value }); pendingOptionLabel = null; }
        } else if (tag === 'min') { currentArg.min = value; }
        else if (tag === 'max') { currentArg.max = value; }
        else if (tag === 'desc') { currentArg.desc = value; }
      } else if (currentCommand) {
        inHelp = false;
        if (tag === 'text') { currentCommand.text = value; }
        else if (tag === 'desc') { currentCommand.desc = value; }
      } else if (tag === 'param') {
        inHelp = false;
        if (pendingOptionLabel !== null && currentParam) {
          currentParam.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = null;
        }
        if (currentParam) params.push(currentParam);
        currentParam = {
          name: value,
          desc: '',
          type: 'string',
          default: '',
          options: [],
          dir: '',
        };
      } else if (currentParam) {
        inHelp = false;
        if (tag === 'text') {
          currentParam.text = value;
        } else if (tag === 'desc') {
          currentParam.desc = value;
        } else if (tag === 'type') {
          currentParam.type = value;
        } else if (tag === 'default') {
          currentParam.default = value;
        } else if (tag === 'option') {
          if (pendingOptionLabel !== null) currentParam.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
          pendingOptionLabel = value;
        } else if (tag === 'value') {
          if (pendingOptionLabel !== null) { currentParam.options.push({ label: pendingOptionLabel, value }); pendingOptionLabel = null; }
        } else if (tag === 'dir') {
          currentParam.dir = value;
        } else if (tag === 'min') {
          currentParam.min = value;
        } else if (tag === 'max') {
          currentParam.max = value;
        } else if (tag === 'parent') {
          currentParam.parent = value;
        }
      } else if (inHelp) {
        help += '\n' + line;
      }
    } else if (inHelp) {
      help += '\n' + line;
    } else if (currentParam && !line.startsWith('@')) {
      // Multi-line desc continuation
      if (currentParam.desc && line.trim()) {
        currentParam.desc += ' ' + line.trim();
      }
    }
  }
  // flush remaining state
  if (pendingOptionLabel !== null) {
    if (currentArg) currentArg.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
    else if (currentParam) currentParam.options.push({ label: pendingOptionLabel, value: pendingOptionLabel });
  }
  if (currentArg && currentCommand) currentCommand.args.push(currentArg);
  if (currentParam) params.push(currentParam);
  if (currentCommand) commands.push(currentCommand);

  // 코드 본체(주석 블록 이후)에서 의존성 감지
  const deps: string[] = [];
  const codeBody = content.replace(/\/\*[\s\S]*?\*\//g, ''); // 주석 블록 제거
  if (/\bTHREE\b/.test(codeBody) || /\bMode3D\b/.test(codeBody)) deps.push('EXT');

  return {
    pluginname, plugindesc, author, help: help.trim(), params,
    ...(commands.length > 0 ? { commands } : {}),
    ...(plugincommand ? { plugincommand } : {}),
    ...(deps.length > 0 ? { dependencies: deps } : {}),
  };
}
