// ─── 확장 텍스트 태그 정의 + 파서 + 직렬화 ───

export type TagParamType = 'color' | 'number' | 'select' | 'icon-picker' | 'image-picker';

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
  category: 'visual' | 'animation' | 'timing' | 'inline';
  badgeColor: string;
  params: TagParam[];
  /** 자식 내용이 없는 인라인 void 요소 (icon, picture 등) */
  void?: boolean;
}

// 블록 하나에 적용된 단일 태그 항목 (여러 개가 모이면 중첩 효과)
export interface TagEntry {
  tag: string;
  params: Record<string, string>;
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
  {
    tag: 'icon',
    label: '아이콘',
    category: 'inline',
    badgeColor: '#e67e22',
    void: true,
    params: [
      { key: 'index', label: '아이콘 번호', type: 'icon-picker', defaultValue: '0' },
    ],
  },
  {
    tag: 'picture',
    label: '이미지',
    category: 'inline',
    badgeColor: '#27ae60',
    void: true,
    params: [
      { key: 'src', label: '파일', type: 'image-picker', defaultValue: '' },
      {
        key: 'imgtype',
        label: '종류',
        type: 'select',
        defaultValue: 'pictures',
        options: [
          { value: 'pictures', label: '그림' },
          { value: 'system', label: '시스템' },
          { value: 'img', label: '직접 경로 (img/)' },
        ],
      },
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

      // 자기 닫힘 태그 확인 (void 요소): <tagname attrs/>
      const selfCloseMatch = raw.slice(pos).match(/^<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?\s*\/>/);
      if (selfCloseMatch) {
        flushText();
        const tag = selfCloseMatch[1];
        const paramsStr = selfCloseMatch[2] || '';
        pos += selfCloseMatch[0].length;
        const params: Record<string, string> = {};
        const paramRe = /(\w+)=(?:"([^"]*)"|(\S+))/g;
        let pm: RegExpExecArray | null;
        while ((pm = paramRe.exec(paramsStr)) !== null) {
          params[pm[1]] = pm[2] !== undefined ? pm[2] : pm[3];
        }
        children.push({ type: 'block', tag, params, children: [] });
        continue;
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
      const def = getTagDef(seg.tag);
      if (def?.void) {
        // void 요소: <tag key="val"/> 자기 닫힘 형식
        const paramsStr = Object.entries(seg.params)
          .filter(([, v]) => v !== '')
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ');
        return paramsStr ? `<${seg.tag} ${paramsStr}/>` : `<${seg.tag}/>`;
      }
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

// ─── 중첩 블록 → TagEntry 배열 + 최종 content 텍스트로 flatten ───
// <shake><color>텍스트</color></shake> → tags:[shake,color], content:'텍스트'
function collectTags(seg: TextBlockSeg): { tags: TagEntry[]; content: string } {
  const tags: TagEntry[] = [{ tag: seg.tag, params: seg.params }];
  // 자식이 단일 블록 세그먼트이면 재귀 flatten
  if (seg.children.length === 1 && seg.children[0].type === 'block') {
    const inner = collectTags(seg.children[0] as TextBlockSeg);
    return { tags: [...tags, ...inner.tags], content: inner.content };
  }
  return { tags, content: serializeExtendedText(seg.children) };
}

// ─── TagEntry 배열 → 중첩 태그 raw 문자열 ───
// tags[0]이 가장 바깥쪽
export function entriesToRaw(tags: TagEntry[], content: string): string {
  let result = content;
  for (let i = tags.length - 1; i >= 0; i--) {
    const { tag, params } = tags[i];
    const def = getTagDef(tag);
    if (def?.void) {
      // void 요소: 자기 닫힘 형식 (<icon index="5"/>)
      const ps = Object.entries(params)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      result = ps ? `<${tag} ${ps}/>` : `<${tag}/>`;
    } else {
      const ps = Object.entries(params)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      result = ps ? `<${tag} ${ps}>${result}</${tag}>` : `<${tag}>${result}</${tag}>`;
    }
  }
  return result;
}

// ─── 세그먼트 → HTML (contentEditable 렌더링용) ───

function _esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildBlockChipHTML(tags: TagEntry[], content: string): string {
  const primaryDef = getTagDef(tags[0]?.tag);
  const primaryColor = primaryDef?.badgeColor ?? '#888';
  const isVoid = primaryDef?.void ?? false;
  const tagsJSON = _esc(JSON.stringify(tags));
  const labels = tags.map(e => {
    const def = getTagDef(e.tag);
    return `<span class="ete-block-label" style="background:${def?.badgeColor ?? '#888'}">${_esc(def?.label ?? e.tag)}</span>`;
  }).join('');

  // void 요소 (icon, picture): 내용 대신 파라미터 값을 미리보기로 표시
  let preview: string;
  if (isVoid) {
    const t = tags[0];
    if (t.tag === 'icon') preview = `#${t.params.index ?? '?'}`;
    else if (t.tag === 'picture') preview = t.params.src || '(없음)';
    else preview = '';
  } else {
    preview = content || ' ';
  }

  return (
    `<span class="ete-block${isVoid ? ' ete-block-void' : ''}" ` +
    `draggable="true" ` +
    `data-ete-tags="${tagsJSON}" ` +
    `data-ete-content="${_esc(content)}" ` +
    `contenteditable="false" ` +
    `style="border-color:${primaryColor}">` +
    labels +
    `<span class="ete-block-preview">${_esc(preview)}</span>` +
    `<span class="ete-block-del" data-del="1">✕</span>` +
    `</span>`
  );
}

export function segsToHTML(segs: AnyTextSeg[]): string {
  return segs.map(seg => {
    if (seg.type === 'text') {
      return _esc(seg.text).replace(/\n/g, '<span class="ete-nl-mark" contenteditable="false">↵</span><br>');
    }
    if (seg.type === 'escape') {
      return `<span class="ete-escape" data-ete-escape="${_esc(seg.raw)}" contenteditable="false">${_esc(seg.raw)}</span>`;
    }
    if (seg.type === 'block') {
      const { tags, content } = collectTags(seg);
      return buildBlockChipHTML(tags, content);
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

    // 개행 시각 마커 (↵) 스킵 — raw 문자열에는 포함하지 않음
    if (el.classList.contains('ete-nl-mark')) return;

    const escapeAttr = el.dataset.eteEscape;
    const tagsAttr = el.dataset.eteTags;
    const tagAttr = el.dataset.eteTag; // 하위 호환

    if (escapeAttr) {
      result += escapeAttr;
      return;
    }
    if (tagsAttr || tagAttr) {
      let entries: TagEntry[];
      if (tagsAttr) {
        entries = JSON.parse(tagsAttr) as TagEntry[];
      } else {
        // 기존 단일 태그 속성 형식 하위 호환
        entries = [{ tag: tagAttr!, params: JSON.parse(el.dataset.eteParams ?? '{}') as Record<string, string> }];
      }
      const contentText = el.dataset.eteContent ?? '';
      result += entriesToRaw(entries, contentText);
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
