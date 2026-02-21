/**
 * JS Error Overlay
 * Catches JS errors and warnings, displays them in a DOM overlay.
 * Call install() to activate.
<<<<<<< HEAD
 *
 * Source: https://github.com/painh/js-error-overlay
=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
 */

type EntryLevel = 'error' | 'warn';

interface ErrorEntry {
  timestamp: Date;
  level: EntryLevel;
  message: string;
  stack?: string;
  source?: string;
}

let container: HTMLDivElement | null = null;
let errorList: HTMLDivElement | null = null;
let badge: HTMLDivElement | null = null;
let titleEl: HTMLDivElement | null = null;
let copyAllBtn: HTMLButtonElement | null = null;
let entries: ErrorEntry[] = [];
let isOpen = false;

export function install(): void {
  createStyles();
  createContainer();
  createBadge();
  hookErrors();
}

// --- Styles ---

function createStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .jeo-badge {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 99999;
      background: #dc2626;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 14px;
      font-weight: 700;
      font-family: monospace;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transition: transform 0.15s;
    }
    .jeo-badge:hover { transform: scale(1.1); }

    .jeo-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: none;
      flex-direction: column;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      padding: 24px;
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      color: #e4e4e7;
    }
    .jeo-overlay.open { display: flex; }

    .jeo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      flex-shrink: 0;
    }
    .jeo-title {
      font-size: 16px;
      font-weight: 700;
      color: #fca5a5;
    }
    .jeo-actions {
      display: flex;
      gap: 8px;
    }
    .jeo-btn {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
    }
    .jeo-btn:hover { background: #3f3f46; }

    .jeo-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .jeo-list::-webkit-scrollbar { width: 6px; }
    .jeo-list::-webkit-scrollbar-track { background: transparent; }
    .jeo-list::-webkit-scrollbar-thumb { background: #52525b; border-radius: 3px; }

    .jeo-item {
      background: #1c1917;
      border: 1px solid #44403c;
      border-left: 3px solid #dc2626;
      border-radius: 6px;
      padding: 12px;
    }
    .jeo-item.warn {
      border-left-color: #d97706;
    }
    .jeo-item.warn .jeo-msg {
      color: #fcd34d;
    }
    .jeo-item-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .jeo-time {
      color: #71717a;
      font-size: 11px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .jeo-msg {
      color: #fca5a5;
      font-weight: 600;
      word-break: break-word;
    }
    .jeo-stack {
      margin-top: 8px;
      padding: 8px;
      background: #0c0a09;
      border-radius: 4px;
      color: #a8a29e;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      max-height: 200px;
      overflow-y: auto;
    }
    .jeo-copy {
      margin-top: 6px;
      font-size: 11px;
      color: #71717a;
      cursor: pointer;
      text-decoration: underline;
    }
    .jeo-copy:hover { color: #a1a1aa; }

    .jeo-empty {
      color: #71717a;
      text-align: center;
      padding: 40px;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

// --- Badge ---

function createBadge(): void {
  badge = document.createElement('div');
  badge.className = 'jeo-badge';
  badge.title = 'Errors & Warnings (click to open)';
  badge.addEventListener('click', toggle);
  document.body.appendChild(badge);
}

// --- Container ---

function createContainer(): void {
  container = document.createElement('div');
  container.className = 'jeo-overlay';

  const header = document.createElement('div');
  header.className = 'jeo-header';

  titleEl = document.createElement('div');
  titleEl.className = 'jeo-title';
  titleEl.textContent = 'Errors & Warnings';
  header.appendChild(titleEl);

  const actions = document.createElement('div');
  actions.className = 'jeo-actions';

  copyAllBtn = document.createElement('button');
  copyAllBtn.className = 'jeo-btn';
  copyAllBtn.textContent = 'Copy All';
  copyAllBtn.addEventListener('click', copyAll);
  actions.appendChild(copyAllBtn);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'jeo-btn';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', clear);
  actions.appendChild(clearBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'jeo-btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', close);
  actions.appendChild(closeBtn);

  header.appendChild(actions);
  container.appendChild(header);

  errorList = document.createElement('div');
  errorList.className = 'jeo-list';
  container.appendChild(errorList);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });

  document.body.appendChild(container);
}

// --- Helpers ---

function stringify(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return val;
  if (val instanceof Error) return val.message;
  if (val instanceof Event) {
    const target = val.target;
    let desc = val.type;
    if (target instanceof HTMLImageElement) desc += ` src=${target.src}`;
    else if (target instanceof HTMLScriptElement) desc += ` src=${(target as HTMLScriptElement).src}`;
    else if (target instanceof HTMLLinkElement) desc += ` href=${(target as HTMLLinkElement).href}`;
    else if (target instanceof Element) desc += ` <${target.tagName.toLowerCase()}>`;
    return desc;
  }
  const s = String(val);
  if (s === '[object Object]') {
    try { return JSON.stringify(val); } catch { return s; }
  }
  return s;
}

// --- Error hooks ---

function hookErrors(): void {
  window.addEventListener('error', (event) => {
    addEntry({
      timestamp: new Date(),
      level: 'error',
      message: event.message || String(event.error),
      stack: event.error?.stack,
      source: event.filename
        ? `${event.filename}:${event.lineno}:${event.colno}`
        : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    addEntry({
      timestamp: new Date(),
      level: 'error',
      message: `[Unhandled Promise] ${message}`,
      stack,
    });
  });

  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    addEntry({
      timestamp: new Date(),
      level: 'warn',
      message: args.map(stringify).join(' '),
    });
  };
}

// --- Entry management ---

function addEntry(entry: ErrorEntry): void {
  entries.push(entry);
  updateBadge();
  renderEntry(entry);
}

function updateBadge(): void {
  if (!badge) return;
  const count = entries.length;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = count > 0 ? 'flex' : 'none';
  const hasErrors = entries.some((e) => e.level === 'error');
  badge.style.background = hasErrors ? '#dc2626' : '#d97706';

  if (titleEl) {
    const errorCount = entries.filter((e) => e.level === 'error').length;
    const warnCount = entries.filter((e) => e.level === 'warn').length;
    const parts: string[] = [];
    if (errorCount > 0) parts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
    if (warnCount > 0) parts.push(`${warnCount} warning${warnCount > 1 ? 's' : ''}`);
    titleEl.textContent = parts.length > 0 ? parts.join(', ') : 'Errors & Warnings';
  }
}

function renderEntry(entry: ErrorEntry): void {
  if (!errorList) return;

  const empty = errorList.querySelector('.jeo-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = `jeo-item ${entry.level}`;

  const header = document.createElement('div');
  header.className = 'jeo-item-header';

  const msg = document.createElement('div');
  msg.className = 'jeo-msg';
  msg.textContent = entry.message;
  header.appendChild(msg);

  const time = document.createElement('div');
  time.className = 'jeo-time';
  time.textContent = entry.timestamp.toLocaleTimeString();
  header.appendChild(time);

  item.appendChild(header);

  if (entry.source) {
    const src = document.createElement('div');
    src.style.cssText = 'color:#71717a;font-size:11px;margin-top:2px;';
    src.textContent = entry.source;
    item.appendChild(src);
  }

  if (entry.stack) {
    const stack = document.createElement('div');
    stack.className = 'jeo-stack';
    stack.textContent = entry.stack;
    item.appendChild(stack);
  }

  const copyLink = document.createElement('div');
  copyLink.className = 'jeo-copy';
  copyLink.textContent = 'Copy';
  copyLink.addEventListener('click', () => {
    navigator.clipboard.writeText(formatEntry(entry));
    copyLink.textContent = 'Copied!';
    setTimeout(() => (copyLink.textContent = 'Copy'), 1500);
  });
  item.appendChild(copyLink);

  errorList.appendChild(item);
}

// --- Formatting & clipboard ---

function formatEntry(entry: ErrorEntry): string {
  let text = `[${entry.level.toUpperCase()}] [${entry.timestamp.toLocaleTimeString()}] ${entry.message}`;
  if (entry.source) text += `\n  at ${entry.source}`;
  if (entry.stack) text += `\n${entry.stack}`;
  return text;
}

function copyAll(): void {
  const text = entries.map(formatEntry).join('\n\n---\n\n');
  navigator.clipboard.writeText(text);
  if (copyAllBtn) {
    copyAllBtn.textContent = 'Copied!';
    setTimeout(() => { if (copyAllBtn) copyAllBtn.textContent = 'Copy All'; }, 1500);
  }
}

function clear(): void {
  entries = [];
  updateBadge();
  if (errorList) {
    errorList.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'jeo-empty';
    empty.textContent = 'No errors';
    errorList.appendChild(empty);
  }
}

// --- Open / Close ---

function toggle(): void {
  if (isOpen) close();
  else open();
}

function open(): void {
  isOpen = true;
  container?.classList.add('open');
}

function close(): void {
  isOpen = false;
  container?.classList.remove('open');
}
