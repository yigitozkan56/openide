/**
 * openide - Monaco Editor Manager
 * Supports multi-tab models, split editor, Git diff view, dynamic MD3 syntax themes, and custom snippets.
 */

(function () {
  let primaryEditor = null;
  let secondaryEditor = null;
  let diffEditor = null;
  let monacoLoaded = false;
  let pendingThemeObj = null;
  let activeTabs = [];
  let currentTabId = null;
  let snippetDisposables = [];

  const EXT_TO_LANG = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.json': 'json',
    '.md': 'markdown',
    '.rs': 'rust',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.java': 'java',
    '.xml': 'xml',
    '.svg': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sh': 'shell',
    '.ps1': 'powershell',
    '.bat': 'bat',
    '.cmd': 'bat',
    '.sql': 'sql',
    '.php': 'php',
    '.rb': 'ruby',
    '.lua': 'lua'
  };

  function detectLanguage(filePath = '') {
    const lower = filePath.toLowerCase();
    const dotIdx = lower.lastIndexOf('.');
    if (dotIdx === -1) return 'plaintext';
    const ext = lower.slice(dotIdx);
    return EXT_TO_LANG[ext] || 'plaintext';
  }

  function initMonaco(editorConfig = {}) {
    return new Promise((resolve) => {
      const vsPath = new URL('../../node_modules/monaco-editor/min/vs', window.location.href).href;

      if (typeof window.require === 'function' && window.require.config) {
        window.require.config({ paths: { vs: vsPath } });
        window.MonacoEnvironment = {
          getWorkerUrl: function () {
            const blobCode = `
              self.MonacoEnvironment = { baseUrl: '${vsPath.replace(/\/vs$/, '')}/' };
              importScripts('${vsPath}/base/worker/workerMain.js');
            `;
            return URL.createObjectURL(new Blob([blobCode], { type: 'text/javascript' }));
          }
        };

        window.require(['vs/editor/editor.main'], function () {
          monacoLoaded = true;
          const container = document.getElementById('monaco-primary');
          const options = buildMonacoOptions(editorConfig);

          primaryEditor = monaco.editor.create(container, {
            value: '',
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            ...options
          });

          if (pendingThemeObj) {
            applyMonacoTheme(pendingThemeObj);
          }

          primaryEditor.onDidChangeModelContent(() => {
            const tab = getCurrentTab();
            if (tab) {
              const val = primaryEditor.getValue();
              if (val !== tab.savedContent && !tab.dirty) {
                tab.dirty = true;
                if (window.MateriaApp) window.MateriaApp.renderTabs();
              } else if (val === tab.savedContent && tab.dirty) {
                tab.dirty = false;
                if (window.MateriaApp) window.MateriaApp.renderTabs();
              }
              if (window.PluginHost) {
                window.PluginHost.emit('editor:contentChanged', { content: val, tab });
              }
              if (window.MateriaApp) {
                window.MateriaApp.onEditorContentChanged(val, tab);
              }
            }
          });

          primaryEditor.onDidChangeCursorPosition((e) => {
            const posEl = document.getElementById('status-cursor-pos');
            if (posEl) {
              posEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
            }
          });

          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  }

  function buildMonacoOptions(cfg = {}) {
    return {
      fontFamily: cfg.fontFamily || "'Cascadia Code', 'Consolas', monospace",
      fontSize: Number(cfg.fontSize) || 14,
      lineHeight: Number(cfg.lineHeight) || 22,
      fontLigatures: cfg.fontLigatures !== false,
      tabSize: Number(cfg.tabSize) || 2,
      insertSpaces: cfg.insertSpaces !== false,
      wordWrap: cfg.wordWrap || 'off',
      minimap: {
        enabled: cfg.minimapEnabled !== false,
        side: cfg.minimapSide || 'right'
      },
      lineNumbers: cfg.lineNumbers || 'on',
      cursorStyle: cfg.cursorStyle || 'line',
      cursorBlinking: cfg.cursorBlinking || 'smooth',
      cursorSmoothCaretAnimation: cfg.cursorSmoothCaretAnimation || 'on',
      smoothScrolling: cfg.smoothScrolling !== false,
      bracketPairColorization: { enabled: cfg.bracketPairColorization !== false },
      renderWhitespace: cfg.renderWhitespace || 'selection',
      guides: { indentation: cfg.guidesIndentation !== false },
      stickyScroll: { enabled: cfg.stickyScroll !== false },
      scrollBeyondLastLine: false,
      padding: { top: 12, bottom: 12 }
    };
  }

  function updateEditorSettings(cfg = {}) {
    if (!monacoLoaded || !primaryEditor) return;
    const opts = buildMonacoOptions(cfg);
    primaryEditor.updateOptions(opts);
    if (secondaryEditor) secondaryEditor.updateOptions(opts);
  }

  function applyMonacoTheme(themeObj) {
    pendingThemeObj = themeObj;
    if (!monacoLoaded || typeof monaco === 'undefined') return;
    const syn = themeObj.syntax || {};
    const c = themeObj.colors || {};
    const cleanHex = (h, def) => ((h || def).replace('#', ''));

    monaco.editor.defineTheme('materia-dynamic-theme', {
      base: syn.base || (themeObj.mode === 'light' ? 'vs' : 'vs-dark'),
      inherit: true,
      rules: [
        { token: 'comment', foreground: cleanHex(syn.comment, '64748B'), fontStyle: 'italic' },
        { token: 'keyword', foreground: cleanHex(syn.keyword, '7DD3FC'), fontStyle: 'bold' },
        { token: 'string', foreground: cleanHex(syn.string, '6EE7B7') },
        { token: 'number', foreground: cleanHex(syn.number, 'FCD34D') },
        { token: 'type', foreground: cleanHex(syn.type, 'CAC1E9') },
        { token: 'function', foreground: cleanHex(syn.function, '38BDF8') },
        { token: 'variable', foreground: cleanHex(syn.variable, 'DEE3E9') },
        { token: 'operator', foreground: cleanHex(syn.operator, '94A3B8') }
      ],
      colors: {
        'editor.background': syn.background || c.surface || '#0E1419',
        'editor.foreground': c.onSurface || '#DEE3E9',
        'editor.lineHighlightBackground': syn.lineHighlight || c.surfaceContainerLow || '#151C22',
        'editor.selectionBackground': syn.selection || '#004D6888',
        'editorCursor.foreground': c.primary || '#7DD3FC',
        'editorLineNumber.foreground': c.outline || '#89929B',
        'editorLineNumber.activeForeground': c.primary || '#7DD3FC',
        'editorIndentGuide.background': c.outlineVariant || '#3F4850',
        'editorWidget.background': c.surfaceContainerHigh || '#232B31',
        'editorWidget.border': c.outlineVariant || '#3F4850'
      }
    });

    monaco.editor.setTheme('materia-dynamic-theme');
  }

  function registerSnippets(snippetsArray = []) {
    if (!monacoLoaded || typeof monaco === 'undefined') return;
    snippetDisposables.forEach(d => d.dispose());
    snippetDisposables = [];

    const byLang = {};
    for (const s of snippetsArray) {
      const lang = s.language || 'javascript';
      if (!byLang[lang]) byLang[lang] = [];
      byLang[lang].push(s);
    }

    for (const [lang, list] of Object.entries(byLang)) {
      const disp = monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          return {
            suggestions: list.map(item => ({
              label: item.prefix,
              kind: monaco.languages.CompletionItemKind.Snippet,
              documentation: item.description || item.name,
              insertText: Array.isArray(item.body) ? item.body.join('\n') : String(item.body),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range
            }))
          };
        }
      });
      snippetDisposables.push(disp);
    }
  }

  function openOrFocusTab({ filePath, name, content }) {
    let existing = activeTabs.find(t => t.filePath === filePath);
    if (existing) {
      setActiveTab(existing.id);
      return existing;
    }

    const id = 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const lang = detectLanguage(filePath || name);
    let model = null;
    if (monacoLoaded && typeof monaco !== 'undefined') {
      const uri = monaco.Uri.parse(`file:///${(filePath || id).replace(/\\/g, '/')}-${id}`);
      model = monaco.editor.createModel(content || '', lang, uri);
    }

    const tab = {
      id,
      filePath,
      name: name || (filePath ? filePath.split(/[\\/]/).pop() : 'untitled.js'),
      language: lang,
      savedContent: content || '',
      dirty: false,
      model
    };

    activeTabs.push(tab);
    setActiveTab(id);
    return tab;
  }

  function setActiveTab(tabId) {
    const tab = activeTabs.find(t => t.id === tabId);
    if (!tab) return;
    currentTabId = tabId;

    if (primaryEditor && tab.model) {
      primaryEditor.setModel(tab.model);
      primaryEditor.focus();
    }

    const langEl = document.getElementById('status-language');
    if (langEl) langEl.textContent = tab.language.toUpperCase();

    const breadEl = document.getElementById('breadcrumbs-path');
    if (breadEl) {
      breadEl.textContent = tab.filePath || tab.name;
    }

    if (window.PluginHost) {
      window.PluginHost.emit('editor:tabChanged', { content: getValue(), tab });
    }
    if (window.MateriaApp) {
      window.MateriaApp.renderTabs();
      window.MateriaApp.onEditorContentChanged(getValue(), tab);
    }
  }

  function closeTab(tabId) {
    const idx = activeTabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    const [removed] = activeTabs.splice(idx, 1);
    if (removed.model) removed.model.dispose();

    if (currentTabId === tabId) {
      if (activeTabs.length > 0) {
        const nextTab = activeTabs[Math.max(0, idx - 1)];
        setActiveTab(nextTab.id);
      } else {
        currentTabId = null;
        if (primaryEditor) primaryEditor.setModel(null);
      }
    }
    if (window.MateriaApp) window.MateriaApp.renderTabs();
  }

  function getCurrentTab() {
    return activeTabs.find(t => t.id === currentTabId) || null;
  }

  function getValue() {
    if (primaryEditor && primaryEditor.getModel()) {
      return primaryEditor.getValue();
    }
    return '';
  }

  function setValue(text) {
    if (primaryEditor && primaryEditor.getModel()) {
      primaryEditor.setValue(text);
    }
  }

  function revealLine(lineNumber, column = 1) {
    if (!primaryEditor) return;
    primaryEditor.revealLineInCenter(lineNumber);
    primaryEditor.setPosition({ lineNumber, column });
    primaryEditor.focus();
  }

  function triggerEditorAction(actionId) {
    if (!primaryEditor) return;
    primaryEditor.trigger('keyboard', actionId, null);
  }

  function toggleSplitEditor(show, cfg = {}) {
    const container = document.getElementById('monaco-secondary');
    if (!container || !monacoLoaded) return;
    if (show) {
      if (!secondaryEditor) {
        secondaryEditor = monaco.editor.create(container, {
          model: primaryEditor ? primaryEditor.getModel() : null,
          theme: 'materia-dynamic-theme',
          automaticLayout: true,
          ...buildMonacoOptions(cfg)
        });
      } else if (primaryEditor) {
        secondaryEditor.setModel(primaryEditor.getModel());
      }
    } else if (secondaryEditor) {
      secondaryEditor.dispose();
      secondaryEditor = null;
    }
  }

  function showGitDiff(originalText, modifiedText, fileName) {
    const container = document.getElementById('monaco-secondary');
    if (!container || !monacoLoaded) return;
    if (secondaryEditor) {
      secondaryEditor.dispose();
      secondaryEditor = null;
    }
    if (diffEditor) {
      diffEditor.dispose();
      diffEditor = null;
    }
    const lang = detectLanguage(fileName);
    diffEditor = monaco.editor.createDiffEditor(container, {
      theme: 'materia-dynamic-theme',
      automaticLayout: true,
      readOnly: true
    });
    diffEditor.setModel({
      original: monaco.editor.createModel(originalText || '', lang),
      modified: monaco.editor.createModel(modifiedText || '', lang)
    });
  }

  window.EditorManager = {
    initMonaco,
    updateEditorSettings,
    applyMonacoTheme,
    registerSnippets,
    openOrFocusTab,
    setActiveTab,
    closeTab,
    getCurrentTab,
    getTabs: () => activeTabs,
    getValue,
    setValue,
    revealLine,
    triggerEditorAction,
    toggleSplitEditor,
    showGitDiff,
    detectLanguage
  };
})();
