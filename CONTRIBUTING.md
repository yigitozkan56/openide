# Contributing to openide

Thank you for your interest in contributing to **openide**! This project is 100% free and open-source under the MIT License.

## Architecture Overview

- **`src/main/`**: Electron main process (`main.js`, `preload.js`) handling native file system operations, child process execution, Git integration, and real-time file watchers (`fs.watch`) for hot-reloading external configuration files.
- **`src/renderer/`**: Material Design 3 (Material You) UI, Monaco Editor integration, dynamic HCT/tonal color engine, plugin host, and in-app customization studio.
- **`config/`**: External, human-readable JSON and CSS files (`settings.json`, `keybindings.json`, `runners.json`, `snippets.json`, `user-style.css`, and `themes/*.json`) that can be edited outside the IDE with instant hot-reload.
- **`plugins/`**: Drop-in plugin folders containing `manifest.json` and `main.js`.

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development mode:
   ```bash
   npm start
   ```
3. Build standalone Windows executable (`.exe`):
   ```bash
   npm run build:exe
   ```

## Creating Themes & Plugins

- **Themes**: Add a new `.json` file to `config/themes/` and it will immediately appear in the IDE theme selector.
- **Plugins**: Create a folder in `plugins/<your-plugin-name>/` with a `manifest.json` and `main.js` using the `OpenIDEAPI` interface.
