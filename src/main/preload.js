const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('MateriaNative', {
  // Window Controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    openDevTools: () => ipcRenderer.invoke('window:openDevTools'),
    reload: () => ipcRenderer.invoke('window:reload'),
    onMaximizedChanged: (cb) => ipcRenderer.on('window:maximized-changed', (_e, val) => cb(val))
  },

  // Configuration, Themes & Plugins (In-App & Out-of-App)
  config: {
    getPaths: () => ipcRenderer.invoke('config:getPaths'),
    loadAll: () => ipcRenderer.invoke('config:loadAll'),
    saveFile: (fileName, content) => ipcRenderer.invoke('config:saveFile', { fileName, content }),
    saveTheme: (themeObj) => ipcRenderer.invoke('config:saveTheme', themeObj),
    deleteTheme: (themeId) => ipcRenderer.invoke('config:deleteTheme', themeId),
    exportBundle: () => ipcRenderer.invoke('config:exportBundle'),
    importBundle: () => ipcRenderer.invoke('config:importBundle'),
    onExternalChanged: (cb) => ipcRenderer.on('external:config-changed', (_e, payload) => cb(payload))
  },

  plugins: {
    create: (meta) => ipcRenderer.invoke('plugins:create', meta)
  },

  shell: {
    openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
    showItemInFolder: (targetPath) => ipcRenderer.invoke('shell:showItemInFolder', targetPath)
  },

  // Dialogs & File System
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: (defaultPath) => ipcRenderer.invoke('dialog:saveFile', defaultPath)
  },

  fs: {
    readTree: (folderPath) => ipcRenderer.invoke('fs:readTree', folderPath),
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', { filePath, content }),
    createFile: (filePath) => ipcRenderer.invoke('fs:createFile', filePath),
    createFolder: (folderPath) => ipcRenderer.invoke('fs:createFolder', folderPath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', { oldPath, newPath }),
    delete: (targetPath) => ipcRenderer.invoke('fs:delete', targetPath),
    searchInFiles: (params) => ipcRenderer.invoke('fs:searchInFiles', params),
    replaceInFiles: (params) => ipcRenderer.invoke('fs:replaceInFiles', params)
  },

  // Code Runner & Terminal
  runner: {
    execute: (command, workingDir) => ipcRenderer.invoke('runner:execute', { command, workingDir }),
    sendStdin: (inputText) => ipcRenderer.invoke('runner:stdin', inputText),
    kill: () => ipcRenderer.invoke('runner:kill'),
    onOutput: (cb) => ipcRenderer.on('runner:output', (_e, data) => cb(data)),
    onExit: (cb) => ipcRenderer.on('runner:exit', (_e, data) => cb(data))
  },

  // Git Integration
  git: {
    status: (cwd) => ipcRenderer.invoke('git:status', cwd),
    init: (cwd) => ipcRenderer.invoke('git:init', cwd),
    stage: (cwd, file) => ipcRenderer.invoke('git:stage', { cwd, file }),
    unstage: (cwd, file) => ipcRenderer.invoke('git:unstage', { cwd, file }),
    commit: (cwd, message) => ipcRenderer.invoke('git:commit', { cwd, message }),
    getOriginalFile: (cwd, file) => ipcRenderer.invoke('git:getOriginalFile', { cwd, file })
  }
});
