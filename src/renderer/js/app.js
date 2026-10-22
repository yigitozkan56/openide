/**
 * openide - Main Application Controller
 */

(function () {
  const state = {
    dirs: {},
    settings: { appearance: {}, editor: {}, terminal: {}, plugins: {} },
    keybindings: { shortcuts: [] },
    runners: { runners: {} },
    snippets: { snippets: [] },
    userStyleCss: '',
    themes: [],
    plugins: [],
    workspaceFolder: null,
    workspaceTree: [],
    activeDrawer: 'explorer',
    isSplitEditor: false,
    isLivePreview: false,
    isProcessRunning: false
  };

  let saveSettingsTimer = null;

  async function init() {
    injectStaticIcons();
    const initialData = await window.MateriaNative.config.loadAll();
    applyLoadedData(initialData, true);

    await window.EditorManager.initMonaco(state.settings.editor);
    applyActiveTheme();
    window.EditorManager.registerSnippets(state.snippets.snippets || []);
    window.PluginHost.reloadPlugins(state.plugins, state.settings.plugins?.enabledPlugins || []);

    bindTopAppBar();
    bindNavigationRail();
    bindBottomTerminal();
    bindKeyboardShortcuts();
    bindExternalConfigListener();

    // Load default examples workspace on startup
    if (state.dirs.examplesDir) {
      await loadWorkspaceFolder(state.dirs.examplesDir);
      const sep = state.dirs.examplesDir.includes('\\') ? '\\' : '/';
      await openFileInEditor(`${state.dirs.examplesDir}${sep}hello.py`);
      await openFileInEditor(`${state.dirs.examplesDir}${sep}app.js`);
    }

    renderRunnersAndSnippetsDrawer();
    renderPluginsDrawer();
    window.CustomizationUI.renderStudio(state);
  }

  function injectStaticIcons() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      const size = el.getAttribute('data-icon-size') || '';
      el.innerHTML = window.MateriaIcons.icon(name, size);
    });
  }

  function applyLoadedData(data, isFirstLoad = false) {
    if (!data) return;
    state.dirs = data.dirs || state.dirs;
    state.settings = data.settings || state.settings;
    state.keybindings = data.keybindings || state.keybindings;
    state.runners = data.runners || state.runners;
    state.snippets = data.snippets || state.snippets;
    state.userStyleCss = data.userStyleCss ?? state.userStyleCss;
    state.themes = data.themes || [];
    state.plugins = data.plugins || [];

    const app = state.settings.appearance || {};
    window.MD3ColorEngine.applyAppearanceSettings(app, state.userStyleCss);
    window.MateriaI18n.setLanguage('en');

    const topSeedPicker = document.getElementById('quick-seed-input');
    if (topSeedPicker && app.seedColor) {
      topSeedPicker.value = app.seedColor;
    }

    if (!isFirstLoad) {
      applyActiveTheme();
      window.EditorManager.updateEditorSettings(state.settings.editor || {});
      window.EditorManager.registerSnippets(state.snippets.snippets || []);
      window.PluginHost.reloadPlugins(state.plugins, state.settings.plugins?.enabledPlugins || []);
      renderRunnersAndSnippetsDrawer();
      renderPluginsDrawer();
      window.CustomizationUI.renderStudio(state);
    }
  }

  function applyActiveTheme() {
    const app = state.settings.appearance || {};
    let themeObj = null;

    if (app.useDynamicSeed && app.seedColor) {
      themeObj = window.MD3ColorEngine.generateMaterialYouTheme(app.seedColor, app.mode || 'dark');
    } else {
      themeObj = state.themes.find(t => t.id === app.theme) || state.themes[0];
      if (!themeObj) {
        themeObj = window.MD3ColorEngine.generateMaterialYouTheme(app.seedColor || '#38BDF8', app.mode || 'dark');
      }
    }

    window.MD3ColorEngine.applyThemeObject(themeObj);
    const statusThemeEl = document.getElementById('status-theme-name');
    if (statusThemeEl) {
      statusThemeEl.textContent = themeObj.name || themeObj.id;
    }
  }

  function applyDynamicSeedColor(hexColor, persist = true) {
    if (!state.settings.appearance) state.settings.appearance = {};
    state.settings.appearance.seedColor = hexColor;
    state.settings.appearance.useDynamicSeed = true;
    const topSeedPicker = document.getElementById('quick-seed-input');
    if (topSeedPicker) topSeedPicker.value = hexColor;

    applyActiveTheme();
    if (persist) {
      saveSettingsDebounced();
    }
  }

  function selectPresetTheme(themeId) {
    const found = state.themes.find(t => t.id === themeId);
    if (!found) return;
    state.settings.appearance.theme = themeId;
    state.settings.appearance.mode = found.mode || 'dark';
    state.settings.appearance.useDynamicSeed = false;
    applyActiveTheme();
    saveSettingsDebounced();
    window.CustomizationUI.renderStudio(state);
    showSnackbar(`Theme applied: ${found.name}`);
  }

  function toggleDarkLightMode() {
    const app = state.settings.appearance;
    const nextMode = app.mode === 'light' ? 'dark' : 'light';
    app.mode = nextMode;
    if (!app.useDynamicSeed) {
      const candidate = state.themes.find(t => t.mode === nextMode);
      if (candidate) {
        app.theme = candidate.id;
      } else {
        app.useDynamicSeed = true;
      }
    }
    applyActiveTheme();
    saveSettingsDebounced();
    window.CustomizationUI.renderStudio(state);
    showSnackbar(`Theme mode: ${nextMode === 'light' ? 'Light Mode' : 'Dark Mode'}`);
  }

  function saveSettingsDebounced() {
    if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(async () => {
      await window.MateriaNative.config.saveFile('settings.json', state.settings);
    }, 250);
  }

  async function reloadAllConfigs() {
    const fresh = await window.MateriaNative.config.loadAll();
    applyLoadedData(fresh, false);
  }

  function bindExternalConfigListener() {
    window.MateriaNative.config.onExternalChanged(({ changedFile, data }) => {
      if (state.settings.plugins?.hotReloadExternalFiles === false) return;
      applyLoadedData(data, false);
      showSnackbar(`Live Hot-Reload: ${changedFile} updated`);
    });
  }

  // ============================================================================
  // Workspace & File Explorer
  // ============================================================================
  async function loadWorkspaceFolder(folderPath) {
    if (!folderPath) return;
    state.workspaceFolder = folderPath;
    const nameEl = document.getElementById('workspace-folder-name');
    if (nameEl) {
      nameEl.textContent = folderPath.split(/[\\/]/).pop() || folderPath;
      nameEl.title = folderPath;
    }
    await refreshWorkspaceTree();
    await refreshGitStatus();
  }

  async function refreshWorkspaceTree() {
    if (!state.workspaceFolder) return;
    state.workspaceTree = await window.MateriaNative.fs.readTree(state.workspaceFolder);
    const treeRoot = document.getElementById('file-tree-root');
    if (!treeRoot) return;
    treeRoot.innerHTML = '';
    renderTreeNodes(state.workspaceTree, treeRoot);
  }

  function renderTreeNodes(nodes, parentEl) {
    const activeTab = window.EditorManager.getCurrentTab();
    for (const node of nodes) {
      if (node.type === 'directory') {
        const wrapper = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'tree-node';
        row.innerHTML = `
          ${window.MateriaIcons.icon('folder', 'sm')}
          <span class="tree-node-name">${node.name}</span>
          <div class="tree-node-actions">
            <button class="tab-close-btn" title="New file in this folder" data-action="new-file">+</button>
          </div>
        `;
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        renderTreeNodes(node.children || [], childrenContainer);

        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-action="new-file"]')) {
            e.stopPropagation();
            promptNewFile(node.path);
            return;
          }
          childrenContainer.classList.toggle('collapsed');
        });

        wrapper.appendChild(row);
        wrapper.appendChild(childrenContainer);
        parentEl.appendChild(wrapper);
      } else {
        const row = document.createElement('div');
        row.className = 'tree-node' + (activeTab && activeTab.filePath === node.path ? ' active' : '');
        row.innerHTML = `
          ${window.MateriaIcons.icon('file', 'sm')}
          <span class="tree-node-name" title="${node.path}">${node.name}</span>
          <div class="tree-node-actions">
            <button class="tab-close-btn" title="Delete file" data-action="delete">×</button>
          </div>
        `;
        row.addEventListener('click', async (e) => {
          if (e.target.closest('[data-action="delete"]')) {
            e.stopPropagation();
            await window.MateriaNative.fs.delete(node.path);
            showSnackbar(`Deleted: ${node.name}`);
            await refreshWorkspaceTree();
            return;
          }
          await openFileInEditor(node.path);
        });
        parentEl.appendChild(row);
      }
    }
  }

  async function openFileInEditor(filePath) {
    const res = await window.MateriaNative.fs.readFile(filePath);
    if (!res.ok) {
      showSnackbar(`Could not open file: ${res.error}`);
      return;
    }
    window.EditorManager.openOrFocusTab({
      filePath: res.filePath,
      name: res.name,
      content: res.content
    });
    renderTabs();
  }

  async function saveActiveFile() {
    const tab = window.EditorManager.getCurrentTab();
    if (!tab) return;
    const content = window.EditorManager.getValue();

    let targetPath = tab.filePath;
    if (!targetPath) {
      targetPath = await window.MateriaNative.dialog.saveFile(tab.name);
      if (!targetPath) return;
      tab.filePath = targetPath;
      tab.name = targetPath.split(/[\\/]/).pop();
    }

    const res = await window.MateriaNative.fs.writeFile(targetPath, content);
    if (res.ok) {
      tab.savedContent = content;
      tab.dirty = false;
      renderTabs();
      showSnackbar(`Saved: ${tab.name}`);
      await refreshWorkspaceTree();
      await refreshGitStatus();
    } else {
      showSnackbar(`Save error: ${res.error}`);
    }
  }

  async function promptNewFile(baseDir) {
    const dir = baseDir || state.workspaceFolder || state.dirs.examplesDir;
    showInputPrompt({
      title: 'Create New File',
      placeholder: 'e.g. script.py or index.html',
      onConfirm: async (fileName) => {
        if (!fileName) return;
        const sep = dir.includes('\\') ? '\\' : '/';
        const fullPath = `${dir}${sep}${fileName}`;
        const res = await window.MateriaNative.fs.createFile(fullPath);
        if (res.ok) {
          await refreshWorkspaceTree();
          await openFileInEditor(fullPath);
          showSnackbar(`Created: ${fileName}`);
        } else {
          showSnackbar(res.error);
        }
      }
    });
  }

  async function promptNewFolder() {
    const dir = state.workspaceFolder || state.dirs.examplesDir;
    showInputPrompt({
      title: 'Create New Folder',
      placeholder: 'Folder name...',
      onConfirm: async (folderName) => {
        if (!folderName) return;
        const sep = dir.includes('\\') ? '\\' : '/';
        const fullPath = `${dir}${sep}${folderName}`;
        const res = await window.MateriaNative.fs.createFolder(fullPath);
        if (res.ok) {
          await refreshWorkspaceTree();
          showSnackbar(`Folder created: ${folderName}`);
        }
      }
    });
  }

  // ============================================================================
  // Tabs & Live Preview
  // ============================================================================
  function renderTabs() {
    const container = document.getElementById('tabs-scroll-container');
    if (!container) return;
    const tabs = window.EditorManager.getTabs();
    const current = window.EditorManager.getCurrentTab();

    container.innerHTML = tabs.map(t => `
      <div class="md3-tab ${current && current.id === t.id ? 'active' : ''} ${t.dirty ? 'dirty' : ''}" data-tab-id="${t.id}" title="${t.filePath || t.name}">
        ${window.MateriaIcons.icon('code', 'sm')}
        <span>${t.name}</span>
        ${t.dirty ? '<span class="tab-dirty-dot"></span>' : ''}
        <button class="tab-close-btn" data-close-id="${t.id}">×</button>
      </div>
    `).join('');

    container.querySelectorAll('.md3-tab').forEach(el => {
      el.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close-id]');
        if (closeBtn) {
          e.stopPropagation();
          window.EditorManager.closeTab(closeBtn.getAttribute('data-close-id'));
          return;
        }
        window.EditorManager.setActiveTab(el.getAttribute('data-tab-id'));
      });
    });
  }

  function onEditorContentChanged(content, tab) {
    if (state.isLivePreview && tab) {
      updateLivePreview(content, tab);
    }
  }

  function toggleLivePreview(forceState) {
    state.isLivePreview = typeof forceState === 'boolean' ? forceState : !state.isLivePreview;
    const secPane = document.getElementById('secondary-pane');
    const previewWrap = document.getElementById('live-preview-wrapper');
    const monacoSec = document.getElementById('monaco-secondary');
    const titleEl = document.getElementById('secondary-pane-title');

    if (state.isLivePreview) {
      state.isSplitEditor = false;
      secPane.classList.add('visible');
      previewWrap.style.display = 'flex';
      monacoSec.style.display = 'none';
      if (titleEl) titleEl.textContent = 'Live Preview (HTML / Markdown)';
      const tab = window.EditorManager.getCurrentTab();
      updateLivePreview(window.EditorManager.getValue(), tab);
    } else if (!state.isSplitEditor) {
      secPane.classList.remove('visible');
    }
  }

  function updateLivePreview(content = '', tab = null) {
    const iframe = document.getElementById('html-preview-iframe');
    const mdBox = document.getElementById('markdown-preview-box');
    if (!iframe || !mdBox) return;

    const isMd = tab && (tab.name.endsWith('.md') || tab.language === 'markdown');
    if (isMd) {
      iframe.style.display = 'none';
      mdBox.style.display = 'block';
      mdBox.innerHTML = renderSimpleMarkdown(content);
    } else {
      mdBox.style.display = 'none';
      iframe.style.display = 'block';
      iframe.srcdoc = content;
    }
  }

  function renderSimpleMarkdown(md = '') {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
    html = html.replace(/\n\n/g, '<br><br>');
    return html;
  }

  function toggleSplitView() {
    state.isSplitEditor = !state.isSplitEditor;
    const secPane = document.getElementById('secondary-pane');
    const previewWrap = document.getElementById('live-preview-wrapper');
    const monacoSec = document.getElementById('monaco-secondary');
    const titleEl = document.getElementById('secondary-pane-title');

    if (state.isSplitEditor) {
      state.isLivePreview = false;
      secPane.classList.add('visible');
      previewWrap.style.display = 'none';
      monacoSec.style.display = 'block';
      if (titleEl) titleEl.textContent = 'Split Editor';
      window.EditorManager.toggleSplitEditor(true, state.settings.editor);
    } else {
      window.EditorManager.toggleSplitEditor(false);
      secPane.classList.remove('visible');
    }
  }

  // ============================================================================
  // Code Runner & Integrated Terminal
  // ============================================================================
  async function runActiveFile() {
    const tab = window.EditorManager.getCurrentTab();
    if (!tab) {
      showSnackbar('No active file to run.');
      return;
    }

    if (tab.dirty || !tab.filePath) {
      await saveActiveFile();
    }
    if (!tab.filePath) return;

    const ext = '.' + tab.name.split('.').pop().toLowerCase();
    const runnerMap = (state.runners && state.runners.runners) || {};
    const profile = runnerMap[ext];

    if (profile && profile.command === '__INTERNAL_PREVIEW__') {
      toggleLivePreview(true);
      showSnackbar(`Opened ${tab.name} in Live Preview.`);
      return;
    }

    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) bottomPanel.classList.remove('collapsed');

    const fileDir = tab.filePath.replace(/[\\/][^\\/]+$/, '');
    const fileName = tab.name;
    const fileBaseName = fileName.replace(/\.[^.]+$/, '');
    const wsFolder = state.workspaceFolder || fileDir;

    let cmd = profile ? profile.command : `node "${tab.filePath}"`;
    cmd = cmd
      .replace(/\$\{file\}/g, tab.filePath)
      .replace(/\$\{fileDir\}/g, fileDir)
      .replace(/\$\{fileName\}/g, fileName)
      .replace(/\$\{fileBaseName\}/g, fileBaseName)
      .replace(/\$\{workspaceFolder\}/g, wsFolder);

    let cwd = (profile && profile.workingDir) ? profile.workingDir : fileDir;
    cwd = cwd
      .replace(/\$\{fileDir\}/g, fileDir)
      .replace(/\$\{workspaceFolder\}/g, wsFolder);

    if (state.settings.terminal?.clearOnRun) {
      clearTerminalOutput();
    }

    appendTerminalLine(`\n▶ [${profile ? profile.name : ext}] Running: ${cmd}\n`, 'sys-msg');
    setRunningUIState(true);
    await window.MateriaNative.runner.execute(cmd, cwd);
  }

  async function stopRunningProcess() {
    await window.MateriaNative.runner.kill();
    setRunningUIState(false);
    appendTerminalLine('\n⏹ [Process terminated by user]\n', 'stderr');
  }

  function setRunningUIState(running) {
    state.isProcessRunning = running;
    const stopBtn = document.getElementById('top-stop-btn');
    if (stopBtn) stopBtn.style.display = running ? 'inline-flex' : 'none';
  }

  function appendTerminalLine(text, cls = '') {
    const out = document.getElementById('terminal-output');
    if (!out) return;
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    out.appendChild(span);
    out.scrollTop = out.scrollHeight;
  }

  function clearTerminalOutput() {
    const out = document.getElementById('terminal-output');
    if (out) out.innerHTML = '';
  }

  function bindBottomTerminal() {
    window.MateriaNative.runner.onOutput(({ type, text }) => {
      appendTerminalLine(text, type === 'stderr' ? 'stderr' : '');
    });

    window.MateriaNative.runner.onExit(({ code, elapsedMs }) => {
      setRunningUIState(false);
      const cls = code === 0 ? 'success-msg' : 'stderr';
      appendTerminalLine(`\n✓ [Process finished — Exit Code: ${code} | Elapsed: ${elapsedMs}ms]\n`, cls);
    });

    const cmdInput = document.getElementById('terminal-cmd-input');
    if (cmdInput) {
      cmdInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const val = cmdInput.value.trim();
          cmdInput.value = '';
          if (!val) return;
          if (val === 'cls' || val === 'clear') {
            clearTerminalOutput();
            return;
          }
          if (state.isProcessRunning) {
            appendTerminalLine(`${val}\n`, 'sys-msg');
            await window.MateriaNative.runner.sendStdin(val);
          } else {
            appendTerminalLine(`\nPS ${state.workspaceFolder || ''}> ${val}\n`, 'sys-msg');
            setRunningUIState(true);
            await window.MateriaNative.runner.execute(val, state.workspaceFolder);
          }
        }
      });
    }

    const clearBtn = document.getElementById('terminal-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearTerminalOutput);

    const closeTermBtn = document.getElementById('terminal-close-btn');
    if (closeTermBtn) {
      closeTermBtn.addEventListener('click', () => {
        document.getElementById('bottom-panel')?.classList.add('collapsed');
      });
    }
  }

  // ============================================================================
  // Git Integration Drawer
  // ============================================================================
  async function refreshGitStatus() {
    const container = document.getElementById('git-drawer-content');
    if (!container || !state.workspaceFolder) return;
    const status = await window.MateriaNative.git.status(state.workspaceFolder);

    const statusBranchEl = document.getElementById('status-git-branch');
    if (statusBranchEl) {
      statusBranchEl.textContent = status.isRepo ? status.branch : 'No Git';
    }

    if (!status.isRepo) {
      container.innerHTML = `
        <div class="md3-card" style="padding:14px;">
          <p style="font-size:12px; color:var(--md-sys-color-on-surface-variant);">This workspace folder is not a Git repository yet.</p>
          <button class="md3-tonal-btn primary" id="git-init-btn">Initialize Repository (git init)</button>
        </div>
      `;
      document.getElementById('git-init-btn')?.addEventListener('click', async () => {
        await window.MateriaNative.git.init(state.workspaceFolder);
        await refreshGitStatus();
        showSnackbar('Git repository initialized!');
      });
      return;
    }

    container.innerHTML = `
      <div class="workspace-banner">
        <span>Branch: <strong style="color:var(--md-sys-color-primary);">${status.branch}</strong></span>
        <span class="kbd-badge">${status.files.length} changes</span>
      </div>
      <div style="display:flex; gap:6px;">
        <input type="text" class="md3-input" id="git-commit-msg" placeholder="Commit message..." style="flex:1;">
        <button class="md3-tonal-btn primary" id="git-commit-btn">Commit</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        ${status.files.length === 0 ? '<div style="font-size:12px; color:var(--md-sys-color-on-surface-variant); padding:8px;">Working tree clean (no changes).</div>' : ''}
        ${status.files.map(f => `
          <div class="tree-node" data-git-file="${f.file}" data-full="${f.fullPath}">
            <span class="kbd-badge">${f.status}</span>
            <span class="tree-node-name">${f.file}</span>
            <button class="md3-tonal-btn outline git-diff-btn" style="height:22px; font-size:10.5px; padding:0 8px;">Diff</button>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px; font-weight:600; font-size:12px;">Recent Commits</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${status.commits.map(c => `
          <div style="padding:8px 10px; border-radius:8px; background:var(--md-sys-color-surface-container); font-size:11.5px;">
            <div style="display:flex; justify-content:space-between; color:var(--md-sys-color-primary);">
              <strong>#${c.hash}</strong>
              <span>${c.date}</span>
            </div>
            <div style="margin-top:2px;">${c.subject}</div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('git-commit-btn')?.addEventListener('click', async () => {
      const msg = document.getElementById('git-commit-msg')?.value.trim();
      if (!msg) {
        showSnackbar('Please enter a commit message.');
        return;
      }
      const res = await window.MateriaNative.git.commit(state.workspaceFolder, msg);
      if (res.ok) {
        showSnackbar('Changes committed successfully!');
        await refreshGitStatus();
      } else {
        showSnackbar(`Git error: ${res.stderr}`);
      }
    });

    container.querySelectorAll('.git-diff-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const row = btn.closest('[data-git-file]');
        const relFile = row.getAttribute('data-git-file');
        const fullPath = row.getAttribute('data-full');
        const origRes = await window.MateriaNative.git.getOriginalFile(state.workspaceFolder, relFile);
        const curRes = await window.MateriaNative.fs.readFile(fullPath);

        const secPane = document.getElementById('secondary-pane');
        const previewWrap = document.getElementById('live-preview-wrapper');
        const monacoSec = document.getElementById('monaco-secondary');
        const titleEl = document.getElementById('secondary-pane-title');

        secPane.classList.add('visible');
        previewWrap.style.display = 'none';
        monacoSec.style.display = 'block';
        if (titleEl) titleEl.textContent = `Git Diff: ${relFile}`;
        window.EditorManager.showGitDiff(origRes.stdout || '', curRes.content || '', relFile);
      });
    });
  }

  // ============================================================================
  // Runners & Snippets Quick Drawer + Plugins Drawer
  // ============================================================================
  function renderRunnersAndSnippetsDrawer() {
    const container = document.getElementById('runners-drawer-content');
    if (!container) return;
    const snippets = (state.snippets && state.snippets.snippets) || [];
    const runners = (state.runners && state.runners.runners) || {};

    container.innerHTML = `
      <div style="font-weight:700; font-size:12px; color:var(--md-sys-color-primary);">Code Snippets (Click to Insert)</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${snippets.map((s, idx) => `
          <div class="tree-node snippet-insert-item" data-idx="${idx}" style="background:var(--md-sys-color-surface-container); padding:8px 10px;">
            <span class="kbd-badge">${s.prefix}</span>
            <div style="flex:1; overflow:hidden;">
              <div style="font-weight:600; font-size:12px;">${s.description || s.name}</div>
              <div style="font-size:11px; opacity:0.75;">Language: ${s.language}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="font-weight:700; font-size:12px; color:var(--md-sys-color-primary); margin-top:10px;">Active Language Runners</div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        ${Object.entries(runners).map(([ext, r]) => `
          <div class="tree-node" style="cursor:default;">
            <span class="kbd-badge">${ext}</span>
            <span class="tree-node-name">${r.name}</span>
          </div>
        `).join('')}
      </div>
      <button class="md3-tonal-btn outline" id="drawer-open-runners-studio" style="margin-top:6px;">Configure Runners & Snippets</button>
    `;

    container.querySelectorAll('.snippet-insert-item').forEach(el => {
      el.addEventListener('click', () => {
        const s = snippets[Number(el.getAttribute('data-idx'))];
        if (!s) return;
        const body = Array.isArray(s.body) ? s.body.join('\n') : String(s.body);
        const cleanBody = body.replace(/\$\{\d+:?([^}]*)\}/g, '$1');
        const current = window.EditorManager.getValue();
        window.EditorManager.setValue(current ? `${current}\n\n${cleanBody}` : cleanBody);
        showSnackbar(`Inserted snippet: ${s.prefix}`);
      });
    });

    document.getElementById('drawer-open-runners-studio')?.addEventListener('click', () => {
      openCustomizationStudio('studio-sec-runners');
    });
  }

  function renderPluginsDrawer() {
    const container = document.getElementById('plugins-drawer-content');
    if (!container) return;
    const enabledSet = new Set(state.settings.plugins?.enabledPlugins || []);

    container.innerHTML = `
      <div class="md3-card" style="padding:12px; gap:8px;">
        <div style="font-weight:700; font-size:12.5px; color:var(--md-sys-color-primary);">Create New Plugin (Plugin Generator)</div>
        <input type="text" class="md3-input" id="new-plugin-name-inp" placeholder="Plugin name (e.g. Quick Notes)">
        <div style="display:flex; gap:6px;">
          <button class="md3-tonal-btn primary" id="create-plugin-btn" style="flex:1;">Create & Open</button>
          <button class="md3-tonal-btn outline" id="open-plugins-dir-btn" title="Open plugins/ Folder">📂</button>
        </div>
      </div>

      <div style="font-weight:700; font-size:12px; margin-top:4px;">Installed Plugins (plugins/*)</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${state.plugins.map(p => {
          const isOn = enabledSet.has(p.id);
          return `
            <div class="md3-card" style="padding:12px; gap:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:12.5px;">${p.name}</strong>
                <input type="checkbox" class="plugin-toggle-cb" data-plugin-id="${p.id}" ${isOn ? 'checked' : ''}>
              </div>
              <p style="font-size:11.5px; color:var(--md-sys-color-on-surface-variant);">${p.description || ''}</p>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span class="kbd-badge">v${p.version || '1.0.0'}</span>
                <button class="md3-tonal-btn outline edit-plugin-code-btn" data-path="${p.mainPath}" style="height:24px; font-size:11px; padding:0 8px;">Edit Source (main.js)</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.plugin-toggle-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const pid = cb.getAttribute('data-plugin-id');
        const list = new Set(state.settings.plugins?.enabledPlugins || []);
        if (cb.checked) list.add(pid);
        else list.delete(pid);
        if (!state.settings.plugins) state.settings.plugins = {};
        state.settings.plugins.enabledPlugins = Array.from(list);
        window.PluginHost.reloadPlugins(state.plugins, state.settings.plugins.enabledPlugins);
        saveSettingsDebounced();
        showSnackbar(`Plugin ${cb.checked ? 'enabled' : 'disabled'}: ${pid}`);
      });
    });

    container.querySelectorAll('.edit-plugin-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = btn.getAttribute('data-path');
        if (p) await openFileInEditor(p);
      });
    });

    document.getElementById('open-plugins-dir-btn')?.addEventListener('click', () => {
      window.MateriaNative.shell.openPath(state.dirs.pluginsDir);
    });

    document.getElementById('create-plugin-btn')?.addEventListener('click', async () => {
      const inp = document.getElementById('new-plugin-name-inp');
      const name = (inp && inp.value.trim()) || 'My Custom Plugin';
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const res = await window.MateriaNative.plugins.create({ id, name });
      if (res && res.ok) {
        if (!state.settings.plugins.enabledPlugins.includes(res.id)) {
          state.settings.plugins.enabledPlugins.push(res.id);
          await window.MateriaNative.config.saveFile('settings.json', state.settings);
        }
        await reloadAllConfigs();
        await openFileInEditor(res.mainPath);
        showSnackbar(`Created and enabled new plugin: plugins/${res.id}`);
      }
    });
  }

  // ============================================================================
  // Top App Bar, Navigation Rail, Command Palette & Customization Studio
  // ============================================================================
  function bindTopAppBar() {
    document.getElementById('win-min-btn')?.addEventListener('click', () => window.MateriaNative.window.minimize());
    document.getElementById('win-max-btn')?.addEventListener('click', () => window.MateriaNative.window.maximize());
    document.getElementById('win-close-btn')?.addEventListener('click', () => window.MateriaNative.window.close());

    document.getElementById('top-run-btn')?.addEventListener('click', runActiveFile);
    document.getElementById('fab-run-btn')?.addEventListener('click', runActiveFile);
    document.getElementById('top-stop-btn')?.addEventListener('click', stopRunningProcess);
    document.getElementById('top-preview-btn')?.addEventListener('click', () => toggleLivePreview());
    document.getElementById('top-split-btn')?.addEventListener('click', toggleSplitView);
    document.getElementById('top-theme-mode-btn')?.addEventListener('click', toggleDarkLightMode);
    document.getElementById('top-customize-btn')?.addEventListener('click', () => openCustomizationStudio());
    document.getElementById('top-search-pill')?.addEventListener('click', () => openCommandPalette('commands'));

    const quickSeed = document.getElementById('quick-seed-input');
    if (quickSeed) {
      quickSeed.addEventListener('input', (e) => {
        applyDynamicSeedColor(e.target.value, true);
      });
    }

    document.getElementById('close-secondary-pane-btn')?.addEventListener('click', () => {
      state.isLivePreview = false;
      state.isSplitEditor = false;
      window.EditorManager.toggleSplitEditor(false);
      document.getElementById('secondary-pane')?.classList.remove('visible');
    });

    document.getElementById('btn-open-folder')?.addEventListener('click', async () => {
      const folder = await window.MateriaNative.dialog.openFolder();
      if (folder) await loadWorkspaceFolder(folder);
    });
    document.getElementById('btn-new-file')?.addEventListener('click', () => promptNewFile());
    document.getElementById('btn-new-folder')?.addEventListener('click', () => promptNewFolder());
    document.getElementById('btn-refresh-tree')?.addEventListener('click', () => refreshWorkspaceTree());

    document.getElementById('btn-exec-search')?.addEventListener('click', executeWorkspaceSearch);
    document.getElementById('btn-exec-replace')?.addEventListener('click', executeWorkspaceReplace);
    document.getElementById('workspace-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeWorkspaceSearch();
    });

    setupTopMenus();
  }

  async function executeWorkspaceSearch() {
    const query = document.getElementById('workspace-search-input')?.value.trim();
    const resultsContainer = document.getElementById('workspace-search-results');
    if (!query || !resultsContainer || !state.workspaceFolder) return;

    const results = await window.MateriaNative.fs.searchInFiles({
      folderPath: state.workspaceFolder,
      query,
      caseSensitive: false,
      useRegex: false
    });

    resultsContainer.innerHTML = results.length === 0
      ? '<div style="font-size:12px; opacity:0.7; padding:8px;">No matches found.</div>'
      : results.map(r => `
          <div class="tree-node search-hit-item" data-file="${r.filePath}" data-line="${r.line}" style="flex-direction:column; align-items:flex-start; gap:2px; background:var(--md-sys-color-surface-container); padding:7px 10px;">
            <div style="font-weight:600; font-size:11.5px; color:var(--md-sys-color-primary);">${r.relativePath}:${r.line}</div>
            <div style="font-family:var(--md-font-mono); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${r.preview}</div>
          </div>
        `).join('');

    resultsContainer.querySelectorAll('.search-hit-item').forEach(item => {
      item.addEventListener('click', async () => {
        const f = item.getAttribute('data-file');
        const ln = Number(item.getAttribute('data-line')) || 1;
        await openFileInEditor(f);
        setTimeout(() => window.EditorManager.revealLine(ln), 80);
      });
    });
  }

  async function executeWorkspaceReplace() {
    const query = document.getElementById('workspace-search-input')?.value.trim();
    const replacement = document.getElementById('workspace-replace-input')?.value ?? '';
    if (!query || !state.workspaceFolder) return;
    const res = await window.MateriaNative.fs.replaceInFiles({
      folderPath: state.workspaceFolder,
      query,
      replacement,
      caseSensitive: false,
      useRegex: false
    });
    showSnackbar(`Replaced ${res.totalOccurrences} occurrences across ${res.replacedFiles} files.`);
    await executeWorkspaceSearch();
  }

  function bindNavigationRail() {
    document.querySelectorAll('.nav-rail-item[data-drawer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-drawer');
        if (target === 'customize-studio') {
          openCustomizationStudio();
          return;
        }
        closeCustomizationStudio();
        const drawer = document.getElementById('side-drawer');
        if (state.activeDrawer === target && !drawer.classList.contains('collapsed')) {
          drawer.classList.add('collapsed');
          btn.classList.remove('active');
          return;
        }
        drawer.classList.remove('collapsed');
        state.activeDrawer = target;

        document.querySelectorAll('.nav-rail-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.drawer-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`drawer-${target}`)?.classList.add('active');

        const titles = {
          explorer: 'EXPLORER',
          search: 'SEARCH & REPLACE',
          git: 'SOURCE CONTROL (GIT)',
          runners: 'RUNNERS & SNIPPETS',
          plugins: 'PLUGINS MANAGER'
        };
        const titleEl = document.getElementById('drawer-header-title');
        if (titleEl) titleEl.textContent = titles[target] || 'PANEL';

        if (target === 'git') refreshGitStatus();
      });
    });

    document.querySelectorAll('.studio-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.getAttribute('data-studio-sec');
        document.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.studio-section').forEach(s => s.classList.remove('active'));
        document.getElementById(secId)?.classList.add('active');
      });
    });

    document.getElementById('close-studio-btn')?.addEventListener('click', closeCustomizationStudio);
  }

  function openCustomizationStudio(sectionId = null) {
    window.CustomizationUI.renderStudio(state);
    const overlay = document.getElementById('customization-studio-overlay');
    if (overlay) overlay.classList.add('visible');

    if (sectionId) {
      document.querySelectorAll('.studio-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-studio-sec') === sectionId);
      });
      document.querySelectorAll('.studio-section').forEach(s => {
        s.classList.toggle('active', s.id === sectionId);
      });
    }
  }

  function closeCustomizationStudio() {
    document.getElementById('customization-studio-overlay')?.classList.remove('visible');
  }

  // ============================================================================
  // Command Palette (Ctrl+Shift+P) & Quick Open (Ctrl+P)
  // ============================================================================
  function getAllCommands() {
    const baseCommands = [
      { id: 'file.new', title: 'File: New File', handler: () => promptNewFile() },
      { id: 'file.open', title: 'File: Open File...', handler: async () => {
        const files = await window.MateriaNative.dialog.openFile();
        if (files && files.length) for (const f of files) await openFileInEditor(f);
      }},
      { id: 'file.openFolder', title: 'File: Open Workspace Folder...', handler: async () => {
        const folder = await window.MateriaNative.dialog.openFolder();
        if (folder) await loadWorkspaceFolder(folder);
      }},
      { id: 'file.save', title: 'File: Save Active File', handler: () => saveActiveFile() },
      { id: 'run.executeFile', title: 'Run: Execute Active File (F5)', handler: () => runActiveFile() },
      { id: 'run.stopProcess', title: 'Run: Stop Running Process', handler: () => stopRunningProcess() },
      { id: 'view.customizationStudio', title: 'Customize: Open Material You Customization Studio', handler: () => openCustomizationStudio() },
      { id: 'view.toggleDarkLight', title: 'Customize: Toggle Dark / Light Mode', handler: () => toggleDarkLightMode() },
      { id: 'view.openConfigFolder', title: 'Customize: Open External config/ Folder in File Explorer', handler: () => window.MateriaNative.shell.openPath(state.dirs.configDir) },
      { id: 'view.openPluginsFolder', title: 'Customize: Open External plugins/ Folder in File Explorer', handler: () => window.MateriaNative.shell.openPath(state.dirs.pluginsDir) },
      { id: 'view.editUserCss', title: 'Customize: Open config/user-style.css in Editor', handler: () => {
        const sep = state.dirs.configDir.includes('\\') ? '\\' : '/';
        openFileInEditor(`${state.dirs.configDir}${sep}user-style.css`);
      }},
      { id: 'view.editSettingsJson', title: 'Customize: Open config/settings.json in Editor', handler: () => {
        const sep = state.dirs.configDir.includes('\\') ? '\\' : '/';
        openFileInEditor(`${state.dirs.configDir}${sep}settings.json`);
      }},
      { id: 'view.toggleSidebar', title: 'View: Toggle Side Drawer', handler: () => {
        document.getElementById('side-drawer')?.classList.toggle('collapsed');
      }},
      { id: 'view.toggleTerminal', title: 'View: Toggle Terminal Panel', handler: () => {
        document.getElementById('bottom-panel')?.classList.toggle('collapsed');
      }},
      { id: 'view.togglePreview', title: 'View: Toggle Live Preview Pane', handler: () => toggleLivePreview() },
      { id: 'view.splitEditor', title: 'View: Split Editor Side-by-Side', handler: () => toggleSplitView() },
      { id: 'editor.format', title: 'Editor: Format Document', handler: () => window.EditorManager.triggerEditorAction('editor.action.formatDocument') }
    ];

    const pluginCmds = window.PluginHost ? window.PluginHost.getRegisteredCommands() : [];
    return [...baseCommands, ...pluginCmds];
  }

  function executeCommand(cmdId) {
    const all = getAllCommands();
    const found = all.find(c => c.id === cmdId);
    if (found && typeof found.handler === 'function') {
      found.handler();
    }
  }

  function openCommandPalette(mode = 'commands') {
    const backdrop = document.getElementById('palette-backdrop');
    const input = document.getElementById('palette-input');
    const listEl = document.getElementById('palette-list');
    if (!backdrop || !input || !listEl) return;

    backdrop.classList.add('visible');
    input.value = '';
    input.placeholder = mode === 'files'
      ? 'Type a file name to open (Quick Open)...'
      : 'Type a command to search or run (Command Palette)...';
    input.focus();

    const flattenFiles = (nodes, arr = []) => {
      for (const n of nodes) {
        if (n.type === 'file') arr.push(n);
        else if (n.children) flattenFiles(n.children, arr);
      }
      return arr;
    };

    const items = mode === 'files'
      ? flattenFiles(state.workspaceTree).map(f => ({
          title: f.name,
          subtitle: f.path,
          onPick: () => openFileInEditor(f.path)
        }))
      : getAllCommands().map(c => {
          const kb = (state.keybindings?.shortcuts || []).find(s => s.id === c.id);
          return {
            title: c.title,
            badge: kb ? kb.key : (c.category || 'Command'),
            onPick: () => c.handler()
          };
        });

    const renderFiltered = (q) => {
      const lower = q.toLowerCase();
      const filtered = items.filter(it => it.title.toLowerCase().includes(lower) || (it.subtitle && it.subtitle.toLowerCase().includes(lower)));
      listEl.innerHTML = filtered.map((it, idx) => `
        <div class="palette-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
          <div>
            <div style="font-weight:600; font-size:13px;">${it.title}</div>
            ${it.subtitle ? `<div style="font-size:11px; opacity:0.7;">${it.subtitle}</div>` : ''}
          </div>
          ${it.badge ? `<span class="kbd-badge">${it.badge}</span>` : ''}
        </div>
      `).join('');

      listEl.querySelectorAll('.palette-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          backdrop.classList.remove('visible');
          filtered[i].onPick();
        });
      });

      input.onkeydown = (ev) => {
        if (ev.key === 'Escape') {
          backdrop.classList.remove('visible');
        } else if (ev.key === 'Enter' && filtered.length > 0) {
          backdrop.classList.remove('visible');
          filtered[0].onPick();
        }
      };
    };

    input.oninput = () => renderFiltered(input.value);
    renderFiltered('');

    backdrop.onclick = (e) => {
      if (e.target === backdrop) backdrop.classList.remove('visible');
    };
  }

  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (ev) => {
      const parts = [];
      if (ev.ctrlKey) parts.push('Ctrl');
      if (ev.shiftKey) parts.push('Shift');
      if (ev.altKey) parts.push('Alt');
      const k = ev.key === '`' ? '`' : (ev.key.length === 1 ? ev.key.toUpperCase() : ev.key);
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) {
        parts.push(k);
      }
      const combo = parts.join('+');

      const shortcuts = (state.keybindings && state.keybindings.shortcuts) || [];
      const matched = shortcuts.find(s => s.key.toLowerCase() === combo.toLowerCase());
      if (matched) {
        ev.preventDefault();
        if (matched.id === 'view.commandPalette') openCommandPalette('commands');
        else if (matched.id === 'view.quickOpen') openCommandPalette('files');
        else if (matched.id === 'file.closeTab') {
          const cur = window.EditorManager.getCurrentTab();
          if (cur) window.EditorManager.closeTab(cur.id);
        } else {
          executeCommand(matched.id);
        }
      } else if (ev.key === 'F1') {
        ev.preventDefault();
        openCommandPalette('commands');
      }
    });
  }

  function setupTopMenus() {
    const menus = {
      file: [
        { label: 'New File', kbd: 'Ctrl+N', action: () => promptNewFile() },
        { label: 'Open File...', kbd: 'Ctrl+O', action: () => executeCommand('file.open') },
        { label: 'Open Folder...', kbd: 'Ctrl+K', action: () => executeCommand('file.openFolder') },
        { divider: true },
        { label: 'Save', kbd: 'Ctrl+S', action: () => saveActiveFile() },
        { divider: true },
        { label: 'Exit', action: () => window.MateriaNative.window.close() }
      ],
      view: [
        { label: 'Command Palette', kbd: 'Ctrl+Shift+P', action: () => openCommandPalette('commands') },
        { label: 'Quick Open File', kbd: 'Ctrl+P', action: () => openCommandPalette('files') },
        { divider: true },
        { label: 'Split Editor', kbd: 'Ctrl+\\', action: () => toggleSplitView() },
        { label: 'Live Preview', kbd: 'Ctrl+Shift+V', action: () => toggleLivePreview() },
        { label: 'Toggle Sidebar', kbd: 'Ctrl+B', action: () => executeCommand('view.toggleSidebar') },
        { label: 'Toggle Terminal', kbd: 'Ctrl+`', action: () => executeCommand('view.toggleTerminal') }
      ],
      run: [
        { label: 'Run Active File', kbd: 'F5', action: () => runActiveFile() },
        { label: 'Stop Running Process', kbd: 'Shift+F5', action: () => stopRunningProcess() },
        { divider: true },
        { label: 'Configure Language Runners (runners.json)', action: () => openCustomizationStudio('studio-sec-runners') }
      ],
      customize: [
        { label: '🎨 Material You Customization Studio (In-App)', kbd: 'Ctrl+,', action: () => openCustomizationStudio('studio-sec-themes') },
        { label: '📐 Corner Radius, Density & Layout', action: () => openCustomizationStudio('studio-sec-layout') },
        { label: '⌨️ Visual Keybinding Recorder', action: () => openCustomizationStudio('studio-sec-keybindings') },
        { divider: true },
        { label: '📂 Open External config/ Folder (Out-of-App)', action: () => window.MateriaNative.shell.openPath(state.dirs.configDir) },
        { label: '🧩 Open External plugins/ Folder (Out-of-App)', action: () => window.MateriaNative.shell.openPath(state.dirs.pluginsDir) },
        { label: '✨ Live Custom CSS Editor (config/user-style.css)', action: () => openCustomizationStudio('studio-sec-external') },
        { label: '📦 Export Customization Profile (.json)', action: () => window.MateriaNative.config.exportBundle() }
      ]
    };

    const dropdown = document.getElementById('top-dropdown-menu');
    document.querySelectorAll('.menu-btn[data-menu]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.getAttribute('data-menu');
        const list = menus[key] || [];
        const rect = btn.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.innerHTML = list.map((item, idx) => item.divider
          ? '<div class="dropdown-divider"></div>'
          : `<button class="dropdown-item" data-idx="${idx}"><span>${item.label}</span>${item.kbd ? `<span class="kbd-badge">${item.kbd}</span>` : ''}</button>`
        ).join('');
        dropdown.classList.add('visible');

        dropdown.querySelectorAll('.dropdown-item').forEach(el => {
          el.addEventListener('click', () => {
            dropdown.classList.remove('visible');
            const it = list[Number(el.getAttribute('data-idx'))];
            if (it && it.action) it.action();
          });
        });
      });
    });

    window.addEventListener('click', () => dropdown?.classList.remove('visible'));
  }

  // ============================================================================
  // Modals & Snackbar Notifications
  // ============================================================================
  function showSnackbar(message) {
    const container = document.getElementById('snackbar-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'md3-snackbar';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  function showInfoModal({ title, content, items }) {
    const backdrop = document.getElementById('palette-backdrop');
    const input = document.getElementById('palette-input');
    const listEl = document.getElementById('palette-list');
    if (!backdrop || !listEl) return;

    backdrop.classList.add('visible');
    input.value = title || 'Details';
    input.readOnly = true;

    let html = `<div style="padding:12px 14px; white-space:pre-wrap; font-family:var(--md-font-mono); font-size:12.5px; color:var(--md-sys-color-on-surface);">${content || ''}</div>`;
    if (Array.isArray(items) && items.length > 0) {
      html += items.map((it, idx) => `
        <div class="palette-item" data-idx="${idx}">
          <div style="display:flex; align-items:center; gap:8px;">
            ${it.colorPreview ? `<span style="width:18px; height:18px; border-radius:50%; background:${it.colorPreview}; display:inline-block;"></span>` : ''}
            <strong>${it.label}</strong>
          </div>
          <span style="font-size:11.5px; opacity:0.8;">${it.detail || ''}</span>
        </div>
      `).join('');
    }
    listEl.innerHTML = html;

    if (Array.isArray(items)) {
      listEl.querySelectorAll('.palette-item').forEach(el => {
        el.addEventListener('click', () => {
          const it = items[Number(el.getAttribute('data-idx'))];
          backdrop.classList.remove('visible');
          input.readOnly = false;
          if (it && it.onSelect) it.onSelect();
        });
      });
    }

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('visible');
        input.readOnly = false;
      }
    };
  }

  function showInputPrompt({ title, placeholder, onConfirm }) {
    const backdrop = document.getElementById('palette-backdrop');
    const input = document.getElementById('palette-input');
    const listEl = document.getElementById('palette-list');
    if (!backdrop || !input || !listEl) return;

    backdrop.classList.add('visible');
    input.readOnly = false;
    input.value = '';
    input.placeholder = placeholder || title;
    input.focus();
    listEl.innerHTML = `<div style="padding:10px 14px; font-size:12px; color:var(--md-sys-color-on-surface-variant);">${title} — Press <strong>Enter</strong> to confirm.</div>`;

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        backdrop.classList.remove('visible');
        if (onConfirm) onConfirm(val);
      } else if (e.key === 'Escape') {
        backdrop.classList.remove('visible');
      }
    };
  }

  window.MateriaApp = {
    init,
    renderTabs,
    onEditorContentChanged,
    applyDynamicSeedColor,
    selectPresetTheme,
    saveSettingsDebounced,
    reloadAllConfigs,
    openFileInEditor,
    openCustomizationStudio,
    closeCustomizationStudio,
    executeCommand,
    showSnackbar,
    showInfoModal
  };

  window.addEventListener('DOMContentLoaded', init);
})();
