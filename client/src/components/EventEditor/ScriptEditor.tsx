import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import type { EventCommand } from '../../types/rpgMakerMV';
import useEscClose from '../../hooks/useEscClose';
import { SCRIPT_SAMPLES, SAMPLE_GROUPS } from './scriptSamples';
import './ScriptEditor.css';

// 파일 참조 마커 패턴
const FILE_REF_REGEX = /^\/\* @script-file: (.+?) \*\//;

function makeFileRefScript(filePath: string): string {
  return (
    `/* @script-file: ${filePath} */\n` +
    `eval(require('fs').readFileSync(require('path').resolve(nw.App.startPath, '${filePath}'), 'utf8'));`
  );
}

function extractFileRef(code: string): string | null {
  const m = code.match(FILE_REF_REGEX);
  return m ? m[1] : null;
}

// JS 구문 lint (new Function 기반)
function jsLinter(view: EditorView): Diagnostic[] {
  const code = view.state.doc.toString();
  if (!code.trim()) return [];
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
    return [];
  } catch (e) {
    if (!(e instanceof SyntaxError)) return [];
    const msg = (e as SyntaxError).message;
    // Chrome/V8의 SyntaxError는 위치 정보를 제공하지 않으므로
    // 전체 문서 첫 번째 문자에 마커 표시
    return [{ from: 0, to: Math.min(code.length, 100), severity: 'error', message: msg }];
  }
}

interface ScriptEditorProps {
  p: unknown[];
  followCommands?: EventCommand[];
  onOk: (params: unknown[], extra?: EventCommand[]) => void;
  onCancel: () => void;
}

export function ScriptEditor({ p, followCommands, onOk, onCancel }: ScriptEditorProps) {
  useEscClose(onCancel);

  // 기존 스크립트 복원
  const initialCode = (() => {
    const followLines = followCommands?.filter(c => c.code === 655).map(c => c.parameters[0] as string) ?? [];
    const firstLine = (p[0] as string) || '';
    const lines = firstLine ? [firstLine, ...followLines] : followLines;
    return lines.join('\n');
  })();

  const initialFileRef = extractFileRef(initialCode);
  const [activeTab, setActiveTab] = useState<'inline' | 'file'>(initialFileRef ? 'file' : 'inline');

  // 인라인 에디터
  const inlineContainerRef = useRef<HTMLDivElement>(null);
  const inlineViewRef = useRef<EditorView | null>(null);
  const [lintErrors, setLintErrors] = useState<string[]>([]);

  // 파일 참조
  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>(initialFileRef || '');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string>('');

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewViewRef = useRef<EditorView | null>(null);

  // 인라인 초기 코드 (파일 참조 코드 제외)
  const inlineInitCode = initialFileRef ? '' : initialCode;

  // ─── 인라인 CodeMirror 초기화 ───
  useEffect(() => {
    if (activeTab !== 'inline') return;
    const container = inlineContainerRef.current;
    if (!container) return;

    // 이미 있으면 destroy
    if (inlineViewRef.current) {
      inlineViewRef.current.destroy();
      inlineViewRef.current = null;
    }

    const updateLint = EditorView.updateListener.of(update => {
      if (!update.docChanged) return;
      const code = update.state.doc.toString();
      if (!code.trim()) { setLintErrors([]); return; }
      try {
        // eslint-disable-next-line no-new-func
        new Function(code);
        setLintErrors([]);
      } catch (e) {
        setLintErrors([(e as Error).message]);
      }
    });

    const view = new EditorView({
      doc: inlineInitCode,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        linter(jsLinter),
        lintGutter(),
        updateLint,
      ],
      parent: container,
    });

    inlineViewRef.current = view;
    // 초기 lint 체크
    if (inlineInitCode.trim()) {
      try {
        // eslint-disable-next-line no-new-func
        new Function(inlineInitCode);
      } catch (e) {
        setLintErrors([(e as Error).message]);
      }
    }

    return () => {
      view.destroy();
      inlineViewRef.current = null;
    };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 파일 목록 로드 ───
  useEffect(() => {
    if (activeTab !== 'file') return;
    fetch('/api/project/js-files?dir=js')
      .then(r => r.json())
      .then((files: string[]) => setFileList(files.filter(f => f.endsWith('.js'))))
      .catch(() => setFileList([]));
  }, [activeTab]);

  // ─── 파일 내용 로드 ───
  useEffect(() => {
    if (!selectedFile) { setFileContent(''); return; }
    setFileLoading(true);
    setFileError('');
    fetch(`/api/project/js-file-content?path=${encodeURIComponent(selectedFile)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(content => {
        setFileContent(content);
        setFileLoading(false);
      })
      .catch(e => {
        setFileError((e as Error).message);
        setFileLoading(false);
      });
  }, [selectedFile]);

  // ─── 미리보기 CodeMirror ───
  useEffect(() => {
    if (activeTab !== 'file') return;
    const container = previewContainerRef.current;
    if (!container) return;

    if (previewViewRef.current) {
      previewViewRef.current.destroy();
      previewViewRef.current = null;
    }

    if (!fileContent || fileLoading) return;

    const view = new EditorView({
      doc: fileContent,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.editable.of(false),
      ],
      parent: container,
    });
    previewViewRef.current = view;

    return () => {
      view.destroy();
      previewViewRef.current = null;
    };
  }, [activeTab, fileContent, fileLoading]);

  // ─── 샘플 삽입 ───
  const handleInsertSample = useCallback((code: string) => {
    const view = inlineViewRef.current;
    if (!view) return;
    const docLen = view.state.doc.length;
    const isEmpty = !view.state.doc.toString().trim();
    if (isEmpty) {
      view.dispatch({ changes: { from: 0, to: docLen, insert: code } });
    } else {
      view.dispatch({ changes: { from: docLen, insert: '\n\n' + code } });
    }
    view.focus();
  }, []);

  // ─── 폴더 열기 ───
  const handleOpenFolder = useCallback(() => {
    const folderPath = selectedFile
      ? selectedFile.includes('/') ? selectedFile.substring(0, selectedFile.lastIndexOf('/')) : 'js'
      : 'js';
    fetch('/api/project/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath }),
    }).catch(() => {/* ignore */});
  }, [selectedFile]);

  // ─── OK ───
  const handleOk = useCallback(() => {
    let code: string;
    if (activeTab === 'inline') {
      code = inlineViewRef.current?.state.doc.toString() ?? '';
    } else {
      code = selectedFile ? makeFileRefScript(selectedFile) : '';
    }

    const lines = code.split('\n');
    const firstLine = lines[0] ?? '';
    const extra: EventCommand[] = lines.slice(1).map(line => ({
      code: 655,
      indent: 0,
      parameters: [line],
    }));
    onOk([firstLine], extra);
  }, [activeTab, selectedFile, onOk]);

  return (
    <div className="modal-overlay">
      <div className="script-editor-dialog">
        {/* 헤더 */}
        <div className="script-editor-header">
          <span>Script</span>
          <div className="script-editor-tabs">
            <button
              className={`script-editor-tab${activeTab === 'inline' ? ' active' : ''}`}
              onClick={() => setActiveTab('inline')}
            >
              직접 입력
            </button>
            <button
              className={`script-editor-tab${activeTab === 'file' ? ' active' : ''}`}
              onClick={() => setActiveTab('file')}
            >
              파일 참조<span className="script-ext-badge">EXT</span>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="script-editor-body">
          {/* 인라인 탭 */}
          {activeTab === 'inline' && (
            <div className="script-editor-inline">
              {/* 샘플 삽입 툴바 */}
              <div className="script-sample-toolbar">
                <span className="script-sample-label">샘플 삽입:</span>
                <select
                  className="script-sample-select"
                  value=""
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) return;
                    const sample = SCRIPT_SAMPLES.find(s => s.group + '\0' + s.label === val);
                    if (sample) handleInsertSample(sample.code);
                    e.target.value = '';
                  }}
                >
                  <option value="">-- 샘플 코드 선택 --</option>
                  {SAMPLE_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                      {SCRIPT_SAMPLES.filter(s => s.group === group).map(s => (
                        <option key={s.label} value={group + '\0' + s.label}>{s.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div ref={inlineContainerRef} className="script-cm-container" />
              {lintErrors.length > 0 && (
                <div className="script-lint-panel">
                  {lintErrors.map((err, i) => (
                    <div key={i} className="script-lint-error">⚠ {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 파일 참조 탭 */}
          {activeTab === 'file' && (
            <div className="script-editor-file">
              <div className="script-file-toolbar">
                <select
                  className="script-file-select"
                  value={selectedFile}
                  onChange={e => setSelectedFile(e.target.value)}
                >
                  <option value="">-- 파일 선택 --</option>
                  {fileList.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <button
                  className="db-btn"
                  onClick={handleOpenFolder}
                  title={selectedFile ? `${selectedFile}의 폴더 열기` : 'js 폴더 열기'}
                >
                  폴더 열기
                </button>
              </div>

              {fileLoading && (
                <div className="script-file-loading">로딩 중...</div>
              )}
              {fileError && (
                <div className="script-lint-panel">
                  <div className="script-lint-error">⚠ {fileError}</div>
                </div>
              )}
              {selectedFile && !fileLoading && !fileError && (
                <div ref={previewContainerRef} className="script-cm-container" />
              )}
              {selectedFile && !fileLoading && !fileError && (
                <div className="script-file-hint">
                  이 파일의 내용이 게임 실행 시 동적으로 로드되어 실행됩니다.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="script-editor-footer">
          {lintErrors.length > 0 && activeTab === 'inline' && (
            <span className="script-lint-badge">⚠ {lintErrors.length}개 구문 오류</span>
          )}
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}

export default ScriptEditor;
