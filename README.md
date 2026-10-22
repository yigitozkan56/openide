# openide

<p align="center">
  <b>openide</b> — An Open-Source Material Design 3 (Material You) IDE with Live In-App & Out-of-App Customization
</p>

---

## 🌟 Overview

**openide** is a modern, lightweight, and highly customizable integrated development environment (IDE) built on **Electron**, **Monaco Editor** (the editor engine powering VS Code), and Google's **Material Design 3 (Material You)** design system.

It brings dynamic color extraction, expressive UI components, live hot-reloadable configurations, multi-language code execution, embedded terminal support, Git integration, and an extensible plugin system into a seamless developer workspace.

---

## ✨ Features

- **🎨 Material You Dynamic Color Engine**
  - Pick any seed color (`#HEX`) to dynamically generate HCT tonal palettes (surface layers, primary/secondary/tertiary accents, container colors).
  - Automatically generates matching Monaco Editor code syntax highlighting themes.
  - Save custom dynamic themes as standalone `.json` files into `config/themes/`.

- **⚡ Real-Time Live Hot-Reloading**
  - All configuration files in `config/` (`settings.json`, `keybindings.json`, `runners.json`, `snippets.json`, `user-style.css`, and custom themes) and external plugins in `plugins/` are monitored via live file watchers (`fs.watch`).
  - Edits made outside the IDE (in any external editor or terminal) take effect instantly without restarting the app.

- **💻 Monaco Editor Integration**
  - Full-featured code editor with syntax highlighting, code completion (snippets), line numbers, multi-cursor editing, minimap support, and customizable keybindings.

- **🚀 Multi-Language Code Execution (Runners)**
  - Execute code files directly inside the IDE with a single keypress (`F5`).
  - Configurable execution commands for Python, JavaScript, TypeScript, Rust, C++, C#, Go, and more via `config/runners.json`.

- **🛠️ Material You Customization Studio (`Ctrl+,`)**
  - Visual theme builder with custom color pickers and instant previews.
  - Corner radius control (`0px` Sharp to `28px` Expressive Pill).
  - UI density options (`compact`, `comfortable`, `spacious`).
  - Visual Keybinding Recorder to reassign hotkeys effortlessly.
  - Embedded Live Custom CSS Editor (`user-style.css`).
  - Profile Bundle Export/Import to back up or share your setup.

- **🧩 Extensible Plugin System**
  - Modular JavaScript plugin architecture utilizing the `OpenIDEAPI`.
  - Add custom status bar items, register commands, and interact with the UI.

- **📁 Workspace & Developer Utilities**
  - Native file explorer with tree view and file management.
  - Integrated terminal with shell support.
  - Git integration for tracking changes, committing, and managing repositories.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/openide.git
   cd openide
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application in development mode:**
   ```bash
   npm start
   ```

---

## 📦 Building Standalone Executables

To package **openide** into a standalone Windows `.exe` executable:

```bash
npm run build:exe
```

The compiled executable will be placed in the `dist/` directory along with the default `config/` and `plugins/` folders.

---

## 📁 Project Architecture

```
openide/
├── config/              # Live hot-reloaded configuration files
│   ├── settings.json    # Core settings (theme, seed color, layout, density)
│   ├── keybindings.json # Keyboard shortcut mappings
│   ├── runners.json     # Code execution commands by extension
│   ├── snippets.json    # Autocomplete code snippets
│   ├── user-style.css   # Live custom CSS rules
│   └── themes/          # External JSON color themes
├── plugins/             # External drop-in plugins
├── scripts/             # Build scripts
├── src/
│   ├── main/            # Electron main process (file system, runner, watcher, Git)
│   └── renderer/        # Frontend UI, Monaco Editor, Material You engine, Studio
├── CONTRIBUTING.md      # Contribution guidelines
├── CUSTOMIZATION.md     # In-depth customization & plugin guide
├── LICENSE              # MIT License
└── package.json
```

---

## 📖 Guides & Documentation

- **[Customization & Plugin Development Guide](CUSTOMIZATION.md)**: Detailed instructions on creating custom themes, writing plugins, configuring language runners, and editing keybindings.
- **[Contributing Guide](CONTRIBUTING.md)**: Guidelines for contributing code, architecture overview, and setup.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
