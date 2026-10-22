const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

let mainWindow = null;
let activeRunnerProcess = null;
let fileWatchers = [];

/**
 * Determine base directories so external config/ and plugins/ work seamlessly
 * both in development and when packaged as a standalone .exe
 */
function getBaseDirs() {
  const appRoot = path.resolve(__dirname, '..', '..');
  const exeDir = path.dirname(process.execPath);

  // Check if project root config exists two levels above dist/MateriaStudio-win32-x64
  const parentWorkspaceConfig = path.resolve(exeDir, '..', '..', 'config');
  const parentWorkspacePlugins = path.resolve(exeDir, '..', '..', 'plugins');
  const parentWorkspaceExamples = path.resolve(exeDir, '..', '..', 'examples');

  const externalConfigNextToExe = path.join(exeDir, 'config');
  const externalPluginsNextToExe = path.join(exeDir, 'plugins');
  const externalExamplesNextToExe = path.join(exeDir, 'examples');

  let configDir = path.join(appRoot, 'config');
  let pluginsDir = path.join(appRoot, 'plugins');
  let examplesDir = path.join(appRoot, 'examples');

  if (app.isPackaged) {
    if (fs.existsSync(parentWorkspaceConfig)) {
      configDir = parentWorkspaceConfig;
    } else if (fs.existsSync(externalConfigNextToExe)) {
      configDir = externalConfigNextToExe;
    }

    if (fs.existsSync(parentWorkspacePlugins)) {
      pluginsDir = parentWorkspacePlugins;
    } else if (fs.existsSync(externalPluginsNextToExe)) {
      pluginsDir = externalPluginsNextToExe;
    }

    if (fs.existsSync(parentWorkspaceExamples)) {
      examplesDir = parentWorkspaceExamples;
    } else if (fs.existsSync(externalExamplesNextToExe)) {
      examplesDir = externalExamplesNextToExe;
    }
  }

  return {
    appRoot,
    exeDir,
    configDir,
    themesDir: path.join(configDir, 'themes'),
    pluginsDir,
    examplesDir
  };
}

function safeReadJson(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Error reading JSON ${filePath}:`, err.message);
  }
  return fallback;
}

function loadAllConfigurations() {
  const dirs = getBaseDirs();
  const settings = safeReadJson(path.join(dirs.configDir, 'settings.json'), {});
  const keybindings = safeReadJson(path.join(dirs.configDir, 'keybindings.json'), { shortcuts: [] });
  const runners = safeReadJson(path.join(dirs.configDir, 'runners.json'), { runners: {} });
  const snippets = safeReadJson(path.join(dirs.configDir, 'snippets.json'), { snippets: [] });

  let userStyleCss = '';
  const cssPath = path.join(dirs.configDir, 'user-style.css');
  if (fs.existsSync(cssPath)) {
    try {
      userStyleCss = fs.readFileSync(cssPath, 'utf-8');
    } catch (e) {
      userStyleCss = '';
    }
  }

  // Load all themes from config/themes/*.json
  const themes = [];
  if (fs.existsSync(dirs.themesDir)) {
    try {
      const files = fs.readdirSync(dirs.themesDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const fullPath = path.join(dirs.themesDir, file);
        const themeObj = safeReadJson(fullPath, null);
        if (themeObj && themeObj.id) {
          themeObj._filePath = fullPath;
          themeObj._fileName = file;
          themes.push(themeObj);
        }
      }
    } catch (e) {
      console.error('Error loading themes:', e);
    }
  }

  // Load all external plugins from plugins/*/manifest.json
  const plugins = [];
  if (fs.existsSync(dirs.pluginsDir)) {
    try {
      const entries = fs.readdirSync(dirs.pluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginFolder = path.join(dirs.pluginsDir, entry.name);
          const manifestPath = path.join(pluginFolder, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            const manifest = safeReadJson(manifestPath, null);
            if (manifest && manifest.id) {
              const mainFile = path.join(pluginFolder, manifest.main || 'main.js');
              let code = '';
              if (fs.existsSync(mainFile)) {
                code = fs.readFileSync(mainFile, 'utf-8');
              }
              plugins.push({
                ...manifest,
                folderPath: pluginFolder,
                manifestPath,
                mainPath: mainFile,
                code
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error loading plugins:', e);
    }
  }

  return {
    dirs,
    settings,
    keybindings,
    runners,
    snippets,
    userStyleCss,
    themes,
    plugins
  };
}

/**
 * Watch external config/, config/themes/, and plugins/ directories for out-of-app changes
 */
function setupExternalWatchers() {
  for (const w of fileWatchers) {
    try { w.close(); } catch (_) {}
  }
  fileWatchers = [];

  const dirs = getBaseDirs();
  let debounceTimer = null;

  const notifyChange = (sourceFile) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const freshData = loadAllConfigurations();
        mainWindow.webContents.send('external:config-changed', {
          changedFile: sourceFile,
          data: freshData
        });
      }
    }, 220);
  };

  const watchTargets = [dirs.configDir, dirs.themesDir, dirs.pluginsDir];
  for (const target of watchTargets) {
    if (fs.existsSync(target)) {
      try {
        const watcher = fs.watch(target, { recursive: true }, (eventType, filename) => {
          if (filename) {
            notifyChange(filename);
          }
        });
        fileWatchers.push(watcher);
      } catch (err) {
        console.warn('Watcher warning on', target, err.message);
      }
    }
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0E1419',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (process.argv.includes('--smoke-test')) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const check = await mainWindow.webContents.executeJavaScript(`({
            title: document.title,
            tabsCount: window.EditorManager ? window.EditorManager.getTabs().length : 0,
            pluginCommandsCount: window.PluginHost ? window.PluginHost.getRegisteredCommands().length : 0,
            primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim()
          })`);
          console.log('SMOKE_TEST_RESULT:', JSON.stringify(check));
          app.exit(0);
        } catch (err) {
          console.error('SMOKE_TEST_ERROR:', err);
          app.exit(1);
        }
      }, 2200);
    });
  }

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-changed', false);
  });

  setupExternalWatchers();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (activeRunnerProcess) {
    killProcessTree(activeRunnerProcess.pid);
  }
  if (process.platform !== 'darwin') app.quit();
});

function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    exec(`taskkill /pid ${pid} /T /F`, () => {});
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch (_) {}
  }
}

// ============================================================================
// IPC Handlers: Window Controls
// ============================================================================
ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});
ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
ipcMain.handle('window:isMaximized', () => mainWindow ? mainWindow.isMaximized() : false);
ipcMain.handle('window:openDevTools', () => mainWindow && mainWindow.webContents.openDevTools({ mode: 'detach' }));
ipcMain.handle('window:reload', () => mainWindow && mainWindow.reload());

// ============================================================================
// IPC Handlers: Configuration, Themes & Plugins (In-App & Out-of-App Sync)
// ============================================================================
ipcMain.handle('config:getPaths', () => getBaseDirs());
ipcMain.handle('config:loadAll', () => loadAllConfigurations());

ipcMain.handle('config:saveFile', async (_event, { fileName, content }) => {
  const dirs = getBaseDirs();
  const allowed = ['settings.json', 'keybindings.json', 'runners.json', 'snippets.json', 'user-style.css'];
  if (!allowed.includes(fileName)) {
    throw new Error(`Invalid config file name: ${fileName}`);
  }
  const targetPath = path.join(dirs.configDir, fileName);
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  fs.writeFileSync(targetPath, text, 'utf-8');
  return { ok: true, path: targetPath };
});

ipcMain.handle('config:saveTheme', async (_event, themeObj) => {
  const dirs = getBaseDirs();
  if (!fs.existsSync(dirs.themesDir)) {
    fs.mkdirSync(dirs.themesDir, { recursive: true });
  }
  const safeId = (themeObj.id || 'custom-theme').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  themeObj.id = safeId;
  const targetPath = path.join(dirs.themesDir, `${safeId}.json`);
  const cleanCopy = { ...themeObj };
  delete cleanCopy._filePath;
  delete cleanCopy._fileName;
  fs.writeFileSync(targetPath, JSON.stringify(cleanCopy, null, 2), 'utf-8');
  return { ok: true, path: targetPath, theme: cleanCopy };
});

ipcMain.handle('config:deleteTheme', async (_event, themeId) => {
  const dirs = getBaseDirs();
  const targetPath = path.join(dirs.themesDir, `${themeId}.json`);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return { ok: true };
  }
  return { ok: false, error: 'Theme file not found' };
});

ipcMain.handle('config:exportBundle', async () => {
  const data = loadAllConfigurations();
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export openide Customization Profile',
    defaultPath: 'openide-custom-profile.json',
    filters: [{ name: 'openide Profile JSON', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const bundle = {
    exportedAt: new Date().toISOString(),
    app: 'openide',
    settings: data.settings,
    keybindings: data.keybindings,
    runners: data.runners,
    snippets: data.snippets,
    userStyleCss: data.userStyleCss,
    customThemes: data.themes
  };
  fs.writeFileSync(res.filePath, JSON.stringify(bundle, null, 2), 'utf-8');
  return { ok: true, filePath: res.filePath };
});

ipcMain.handle('config:importBundle', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Import openide Customization Profile',
    filters: [{ name: 'openide Profile JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  const bundle = safeReadJson(res.filePaths[0], null);
  if (!bundle || !bundle.settings) {
    return { ok: false, error: 'Invalid profile file' };
  }
  const dirs = getBaseDirs();
  if (bundle.settings) fs.writeFileSync(path.join(dirs.configDir, 'settings.json'), JSON.stringify(bundle.settings, null, 2));
  if (bundle.keybindings) fs.writeFileSync(path.join(dirs.configDir, 'keybindings.json'), JSON.stringify(bundle.keybindings, null, 2));
  if (bundle.runners) fs.writeFileSync(path.join(dirs.configDir, 'runners.json'), JSON.stringify(bundle.runners, null, 2));
  if (bundle.snippets) fs.writeFileSync(path.join(dirs.configDir, 'snippets.json'), JSON.stringify(bundle.snippets, null, 2));
  if (typeof bundle.userStyleCss === 'string') fs.writeFileSync(path.join(dirs.configDir, 'user-style.css'), bundle.userStyleCss);
  if (Array.isArray(bundle.customThemes)) {
    for (const t of bundle.customThemes) {
      if (t && t.id) {
        const copy = { ...t };
        delete copy._filePath;
        delete copy._fileName;
        fs.writeFileSync(path.join(dirs.themesDir, `${t.id}.json`), JSON.stringify(copy, null, 2));
      }
    }
  }
  return { ok: true, data: loadAllConfigurations() };
});

ipcMain.handle('plugins:create', async (_event, { id, name, description, author }) => {
  const dirs = getBaseDirs();
  const safeId = (id || 'my-custom-plugin').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  const pluginDir = path.join(dirs.pluginsDir, safeId);
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }
  const manifest = {
    id: safeId,
    name: name || safeId,
    version: '1.0.0',
    author: author || 'User',
    description: description || 'User-created openide plugin.',
    main: 'main.js',
    icon: 'extension'
  };
  const mainJs = `/**
 * ${manifest.name} (${manifest.id})
 * openide Plugin
 * Saving this file automatically hot-reloads the plugin!
 */
module.exports = {
  activate(api) {
    // Add a custom status bar item
    const item = api.statusBar.createItem({
      id: '${safeId}-status',
      text: '${manifest.name}',
      icon: 'extension',
      tooltip: '${manifest.description}',
      onClick: () => {
        api.commands.execute('plugin.${safeId}.hello');
      }
    });

    // Register a command in the Command Palette (Ctrl+Shift+P)
    api.commands.register({
      id: 'plugin.${safeId}.hello',
      title: '${manifest.name}: Run Action',
      category: 'Plugin',
      handler: () => {
        api.ui.showSnackbar('Hello! ${manifest.name} plugin is active and running!');
      }
    });
  },

  deactivate(api) {
    api.statusBar.removeItem('${safeId}-status');
  }
};
`;
  const manifestPath = path.join(pluginDir, 'manifest.json');
  const mainPath = path.join(pluginDir, 'main.js');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync(mainPath, mainJs, 'utf-8');
  return { ok: true, pluginDir, manifestPath, mainPath, id: safeId };
});

ipcMain.handle('shell:openPath', async (_event, targetPath) => {
  if (fs.existsSync(targetPath)) {
    await shell.openPath(targetPath);
    return { ok: true };
  }
  return { ok: false, error: 'Path does not exist' };
});

ipcMain.handle('shell:showItemInFolder', async (_event, targetPath) => {
  if (fs.existsSync(targetPath)) {
    shell.showItemInFolder(targetPath);
    return { ok: true };
  }
  return { ok: false };
});

// ============================================================================
// IPC Handlers: File System & Workspace Operations
// ============================================================================
ipcMain.handle('dialog:openFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Workspace Folder',
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:openFile', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Open File',
    properties: ['openFile', 'multiSelections']
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths;
});

ipcMain.handle('dialog:saveFile', async (_event, defaultPath) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File As',
    defaultPath: defaultPath || 'untitled.txt'
  });
  if (res.canceled || !res.filePath) return null;
  return res.filePath;
});

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', '.next', 'target', '__pycache__', '.venv', 'bin', 'obj']);

function readTreeRecursive(dirPath, depth = 0, maxDepth = 4) {
  if (depth > maxDepth || !fs.existsSync(dirPath)) return [];
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (e) {
    return [];
  }

  const nodes = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.gitignore' && entry.name !== '.env') {
      if (entry.isDirectory()) continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const isIgnoredHeavy = IGNORED_DIRS.has(entry.name);
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        isHeavy: isIgnoredHeavy,
        children: isIgnoredHeavy ? [] : readTreeRecursive(fullPath, depth + 1, maxDepth)
      });
    } else {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
        ext: path.extname(entry.name).toLowerCase()
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return nodes;
}

ipcMain.handle('fs:readTree', async (_event, folderPath) => {
  return readTreeRecursive(folderPath, 0, 4);
});

ipcMain.handle('fs:readFile', async (_event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 5 * 1024 * 1024) {
      return { ok: false, error: 'File too large (>5MB)' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, content, filePath, name: path.basename(filePath), mtime: stat.mtimeMs };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:writeFile', async (_event, { filePath, content }) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:createFile', async (_event, filePath) => {
  try {
    if (fs.existsSync(filePath)) return { ok: false, error: 'File already exists' };
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, '', 'utf-8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:createFolder', async (_event, folderPath) => {
  try {
    fs.mkdirSync(folderPath, { recursive: true });
    return { ok: true, folderPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:rename', async (_event, { oldPath, newPath }) => {
  try {
    fs.renameSync(oldPath, newPath);
    return { ok: true, newPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:delete', async (_event, targetPath) => {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Search & Replace across workspace files
function collectWorkspaceFiles(dirPath, fileList = [], maxFiles = 600) {
  if (fileList.length >= maxFiles || !fs.existsSync(dirPath)) return fileList;
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_) {
    return fileList;
  }
  for (const entry of entries) {
    if (fileList.length >= maxFiles) break;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        collectWorkspaceFiles(full, fileList, maxFiles);
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      const binaryExts = new Set(['.exe', '.dll', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.woff', '.woff2', '.ttf']);
      if (!binaryExts.has(ext)) {
        fileList.push(full);
      }
    }
  }
  return fileList;
}

ipcMain.handle('fs:searchInFiles', async (_event, { folderPath, query, caseSensitive, useRegex }) => {
  if (!folderPath || !query) return [];
  const files = collectWorkspaceFiles(folderPath);
  const results = [];
  let regex;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(pattern, flags);
  } catch (err) {
    return [];
  }

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.size > 1024 * 1024) continue;
      const text = fs.readFileSync(file, 'utf-8');
      const lines = text.split(/\r?\n/);
      lines.forEach((lineText, idx) => {
        regex.lastIndex = 0;
        const m = regex.exec(lineText);
        if (m) {
          results.push({
            filePath: file,
            relativePath: path.relative(folderPath, file),
            line: idx + 1,
            column: m.index + 1,
            preview: lineText.trim().slice(0, 140)
          });
        }
      });
      if (results.length >= 300) break;
    } catch (_) {}
  }
  return results;
});

ipcMain.handle('fs:replaceInFiles', async (_event, { folderPath, query, replacement, caseSensitive, useRegex }) => {
  if (!folderPath || !query) return { replacedFiles: 0, totalOccurrences: 0 };
  const files = collectWorkspaceFiles(folderPath);
  let replacedFiles = 0;
  let totalOccurrences = 0;
  let regex;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(pattern, flags);
  } catch (err) {
    return { replacedFiles: 0, totalOccurrences: 0, error: err.message };
  }

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.size > 1024 * 1024) continue;
      const text = fs.readFileSync(file, 'utf-8');
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        const updated = text.replace(regex, replacement);
        fs.writeFileSync(file, updated, 'utf-8');
        replacedFiles++;
        totalOccurrences += matches.length;
      }
    } catch (_) {}
  }
  return { replacedFiles, totalOccurrences };
});

// ============================================================================
// IPC Handlers: Code Runner & Integrated Terminal
// ============================================================================
ipcMain.handle('runner:execute', async (_event, { command, workingDir }) => {
  if (activeRunnerProcess) {
    killProcessTree(activeRunnerProcess.pid);
    activeRunnerProcess = null;
  }

  const cwd = (workingDir && fs.existsSync(workingDir)) ? workingDir : process.cwd();
  const startTime = Date.now();

  try {
    const child = spawn(command, [], {
      cwd,
      shell: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', FORCE_COLOR: '1' }
    });
    activeRunnerProcess = child;

    child.stdout.on('data', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runner:output', { type: 'stdout', text: data.toString('utf-8') });
      }
    });

    child.stderr.on('data', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runner:output', { type: 'stderr', text: data.toString('utf-8') });
      }
    });

    child.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runner:output', { type: 'stderr', text: `\n[Process Error]: ${err.message}\n` });
      }
    });

    child.on('close', (code) => {
      const elapsedMs = Date.now() - startTime;
      if (activeRunnerProcess === child) activeRunnerProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runner:exit', { code, elapsedMs });
      }
    });

    return { ok: true, pid: child.pid, cwd };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('runner:stdin', async (_event, inputText) => {
  if (activeRunnerProcess && activeRunnerProcess.stdin.writable) {
    activeRunnerProcess.stdin.write(inputText + '\n');
    return { ok: true };
  }
  return { ok: false, error: 'No active process running' };
});

ipcMain.handle('runner:kill', async () => {
  if (activeRunnerProcess) {
    killProcessTree(activeRunnerProcess.pid);
    activeRunnerProcess = null;
    return { ok: true };
  }
  return { ok: false };
});

// ============================================================================
// IPC Handlers: Git Source Control Integration
// ============================================================================
function execGit(args, cwd) {
  return new Promise((resolve) => {
    if (!cwd || !fs.existsSync(cwd)) {
      return resolve({ ok: false, stdout: '', stderr: 'No valid workspace directory' });
    }
    exec(`git ${args}`, { cwd, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout ? stdout.toString('utf-8') : '',
        stderr: stderr ? stderr.toString('utf-8') : (error ? error.message : '')
      });
    });
  });
}

ipcMain.handle('git:status', async (_event, cwd) => {
  const statusRes = await execGit('status --porcelain -b', cwd);
  if (!statusRes.ok) {
    return { isRepo: false, error: statusRes.stderr };
  }
  const lines = statusRes.stdout.split(/\r?\n/).filter(Boolean);
  let branch = 'main';
  const files = [];
  lines.forEach((line, i) => {
    if (i === 0 && line.startsWith('##')) {
      branch = line.replace('## ', '').split('...')[0].trim();
    } else if (line.length > 3) {
      const xy = line.slice(0, 2);
      const file = line.slice(3).trim();
      files.push({
        status: xy.trim() || 'M',
        staged: xy[0] !== ' ' && xy[0] !== '?',
        file,
        fullPath: path.join(cwd, file)
      });
    }
  });
  const logRes = await execGit('log -n 15 --pretty=format:"%h|%an|%ar|%s"', cwd);
  const commits = logRes.ok && logRes.stdout
    ? logRes.stdout.split(/\r?\n/).filter(Boolean).map(l => {
        const [hash, author, date, ...subject] = l.split('|');
        return { hash, author, date, subject: subject.join('|') };
      })
    : [];

  return { isRepo: true, branch, files, commits };
});

ipcMain.handle('git:init', async (_event, cwd) => execGit('init', cwd));
ipcMain.handle('git:stage', async (_event, { cwd, file }) => execGit(`add "${file}"`, cwd));
ipcMain.handle('git:unstage', async (_event, { cwd, file }) => execGit(`restore --staged "${file}"`, cwd));
ipcMain.handle('git:commit', async (_event, { cwd, message }) => {
  const safeMsg = (message || 'Update').replace(/"/g, '\\"');
  await execGit('add -A', cwd);
  return execGit(`commit -m "${safeMsg}"`, cwd);
});
ipcMain.handle('git:getOriginalFile', async (_event, { cwd, file }) => {
  const res = await execGit(`show HEAD:"${file.replace(/\\/g, '/')}"`, cwd);
  return res;
});
