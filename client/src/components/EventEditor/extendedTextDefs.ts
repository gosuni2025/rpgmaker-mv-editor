// ─── 확장 텍스트 태그 정의 + 파서 + 직렬화 ───

export type TagParamType = 'color' | 'number' | 'select';

export interface TagParam {
  key: string;
  label: string;
  type: TagParamType;
  defaultValue: string | number;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export interface TagDef {
  tag: string;
  label: string;
  category: 'visual' | 'animation' | 'timing';
  badgeColor: string;
  params: TagParam[];
}

export const EXTENDED_TAG_DEFS: TagDef[] = [
  {
    tag: 'color',
    label: '색상',
    category: 'visual',
    badgeColor: '#c0392b',
    params: [
      { key: 'value', label: '색상', type: 'color', defaultValue: '#ffffff' },
    ],
  },
  {
    tag: 'outline',
    label: '외곽선',
    category: 'visual',
    badgeColor: '#8e44ad',
    params: [
      { key: 'color', label: '색상', type: 'color', defaultValue: '#000000' },
      { key: 'thickness', label: '두께', type: 'number', defaultValue: 3, min: 1, max: 10, step: 1 },
    ],
  },
  {
    tag: 'gradient',
    label: '그라데이션',
    category: 'visual',
    badgeColor: '#d35400',
    params: [
      { key: 'color1', label: '시작색', type: 'color', defaultValue: '#ffff00' },
      { key: 'color2', label: '끝색', type: 'color', defaultValue: '#ff0000' },
      {
        key: 'direction', label: '방향', type: 'select', defaultValue: 'h',
        options: [{ value: 'h', label: '수평' }, { value: 'v', label: '수직' }],
      },
    ],
  },
  {
    tag: 'gradient-wave',
    label: '무지개 글자',
    category: 'animation',
    badgeColor: '#f39c12',
    params: [
      { key: 'speed', label: '속도', type: 'number', defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    ],
  },
  {
    tag: 'dissolve',
    label: '디졸브',
    category: 'animation',
    badgeColor: '#16a085',
    params: [
      { key: 'speed', label: '속도', type: 'number', defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    ],
  },
  {
    tag: 'typewriter',
    label: '타이프라이터',
    category: 'timing',
    badgeColor: '#2980b9',
    params: [
      { key: 'speed', label: '속도', type: 'number', defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    ],
  },
  {
    tag: 'fade',
    label: '페이드',
    category: 'animation',
    badgeColor: '#7f8c8d',
    params: [
      { key: 'duration', label: '지속(프레임)', type: 'number', defaultValue: 60, min: 1, max: 600, step: 1 },
    ],
  },
  {
    tag: 'shake',
    label: '흔들림',
    category: 'animation',
    badgeColor: '#c0392b',
    params: [
      { key: 'amplitude', label: '진폭', type: 'number', defaultValue: 3, min: 1, max: 20, step: 1 },
      { key: 'speed', label: '속도', type: 'number', defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    ],
  },
  {
    tag: 'blur-fade',
    label: '흐릿하게 사라지기',
    category: 'animation',
    badgeColor: '#546e7a',
    params: [
      { key: 'duration', label: '지속(프레임)', type: 'number', defaultValue: 60, min: 1, max: 600, step: 1 },
    ],
  },
  {
    tag: 'hologram',
    label: '홀로그램',
    category: 'animation',
    badgeColor: '#00acc1',
    params: [
      { key: 'scanline', label: '스캔라인 수', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
      { key: 'flicker', label: '깜빡임', type: 'number', defaultValue: 0.3, min: 0, max: 1, step: 0.1 },
    ],
  },
];

export function getTagDef(tag: string): TagDef | undefined {
  return EXTENDED_TAG_DEFS.find(d => d.tag === tag);
}

// ─── 세그먼트 타입 ───

export interface TextTextSeg {
  type: 'text';
  text: string;
}
export interface TextEscapeSeg {
  type: 'escape';
  raw: string; // e.g. "\C[1]", "\I[5]", "\."
}
export interface TextBlockSeg {
  type: 'block';
  tag: string;
  params: Record<string, string>;
  children: AnyTextSeg[];
}
export type AnyTextSeg = TextTextSeg | TextEscapeSeg | TextBlockSeg;

// ─── RPG Maker MV 이스케이프 문자 분리 ───
// \C[n], \I[n], \V[n], \N[n], \P[n], \G, \{, \}, \$, \., \|, \!, \>, \<, \^
const ESCAPE_RE = /\\(?:[CIVNP]\[\d+\]|[G{}\$\.\|!><\^])/g;

function splitEscapes(text: string): AnyTextSeg[] {
  if (!text) return [];
  const result: AnyTextSeg[] = [];
  let lastIndex = 0;
  const re = new RegExp(ESCAPE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      result.push({ type: 'text', text: text.slice(lastIndex, m.index) });
    }
    result.push({ type: 'escape', raw: m[0] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex) });
  }
  return result;
}

// ─── 파서 ───
export function parseExtendedText(raw: string): AnyTextSeg[] {
  if (!raw) return [];
  let pos = 0;

  function parseChildren(endTag?: string): AnyTextSeg[] {
    const children: AnyTextSeg[] = [];
    let textBuf = '';

    const flushText = () => {
      if (textBuf) {
        children.push(...splitEscapes(textBuf));
        textBuf = '';
      }
    };

    while (pos < raw.length) {
      // 종료 태그 확인
      if (endTag) {
        const closeTag = `</${endTag}>`;
        if (raw.startsWith(closeTag, pos)) {
          pos += closeTag.length;
          flushText();
          return children;
        }
      }

      // 시작 태그 확인: <tagname attrs>
      const openMatch = raw.slice(pos).match(/^<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?\s*>/);
      if (openMatch) {
        flushText();
        const tag = openMatch[1];
        const paramsStr = openMatch[2] || '';
        pos += openMatch[0].length;

        // 파라미터 파싱: key=value or key="value"
        const params: Record<string, string> = {};
        const paramRe = /(\w+)=(?:"([^"]*)"|(\S+))/g;
        let pm: RegExpExecArray | null;
        while ((pm = paramRe.exec(paramsStr)) !== null) {
          params[pm[1]] = pm[2] !== undefined ? pm[2] : pm[3];
        }

        const blockChildren = parseChildren(tag);
        children.push({ type: 'block', tag, params, children: blockChildren });
        continue;
      }

      textBuf += raw[pos];
      pos++;
    }

    flushText();
    return children;
  }

  pos = 0;
  return parseChildren();
}

// ─── 직렬화 ───
export function serializeExtendedText(segments: AnyTextSeg[]): string {
  return segments.map(seg => {
    if (seg.type === 'text') return seg.text;
    if (seg.type === 'escape') return seg.raw;
    if (seg.type === 'block') {
      const paramsStr = Object.entries(seg.params)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      const open = paramsStr ? `<${seg.tag} ${paramsStr}>` : `<${seg.tag}>`;
      return `${open}${serializeExtendedText(seg.children)}</${seg.tag}>`;
    }
    return '';
  }).join('');
}

// ─── 세그먼트 → HTML (contentEditable 렌더링용) ───
// 블록은 contenteditable="false" 칩으로 렌더링
// 내용(children) 텍스트는 data-ete-content에 별도 저장

function _esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function segsToHTML(segs: AnyTextSeg[]): string {
  return segs.map(seg => {
    if (seg.type === 'text') {
      return _esc(seg.text).replace(/\n/g, '<br>');
    }
    if (seg.type === 'escape') {
      return `<span class="ete-escape" data-ete-escape="${_esc(seg.raw)}" contenteditable="false">${_esc(seg.raw)}</span>`;
    }
    if (seg.type === 'block') {
      const def = getTagDef(seg.tag);
      const label = def?.label ?? seg.tag;
      const color = def?.badgeColor ?? '#888';
      const paramsJSON = _esc(JSON.stringify(seg.params));
      const contentText = serializeExtendedText(seg.children);
      return (
        `<span class="ete-block" ` +
        `data-ete-tag="${_esc(seg.tag)}" ` +
        `data-ete-params="${paramsJSON}" ` +
        `data-ete-content="${_esc(contentText)}" ` +
        `contenteditable="false" ` +
        `style="border-color:${color}">` +
        `<span class="ete-block-label" style="background:${color}">${_esc(label)}</span>` +
        `<span class="ete-block-preview">${_esc(contentText || ' ')}</span>` +
        `<span class="ete-block-del" data-del="1">✕</span>` +
        `</span>`
      );
    }
    return '';
  }).join('');
}

// ─── HTML div → raw 문자열 ───
export function htmlDivToRaw(div: HTMLElement): string {
  let result = '';

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;

    const escapeAttr = el.dataset.eteEscape;
    const tagAttr = el.dataset.eteTag;

    if (escapeAttr) {
      result += escapeAttr;
      return;
    }
    if (tagAttr) {
      const params = JSON.parse(el.dataset.eteParams ?? '{}') as Record<string, string>;
      const contentText = el.dataset.eteContent ?? '';
      const paramsStr = Object.entries(params)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      result += paramsStr ? `<${tagAttr} ${paramsStr}>` : `<${tagAttr}>`;
      result += contentText;
      result += `</${tagAttr}>`;
      return;
    }
    if (el.tagName === 'BR') {
      result += '\n';
      return;
    }
    if (el.tagName === 'DIV' && el !== div) {
      result += '\n';
    }
    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  }

  for (const child of Array.from(div.childNodes)) {
    walk(child);
  }
  return result;
}
