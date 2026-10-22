# openide — Customization & Plugin Development Guide

**openide** is designed to be effortlessly customized both **in-app (Material You Customization Studio)** and **out-of-app (`config/` and `plugins/` directories)** with instant live hot-reload.

---

## 1. In-App Customization

Click the **Customize (`Ctrl+,`)** button at the bottom of the Navigation Rail or the **Palette** icon in the Top App Bar to open the **Material You Customization Studio**:

- **Material You Dynamic Color Engine**: Pick any single seed color (`#HEX`) to dynamically generate all tonal surface layers (`surface-container-lowest` through `highest`), primary/secondary/tertiary accents, and Monaco Editor syntax highlighting colors in real time. Save any generated palette to `config/themes/` as a standalone `.json` file with one click.
- **Shape, Corner Radius & UI Density**: Adjust the corner radius from `0px` (Sharp) to `28px` (Expressive Material 3 Pill), choose UI density (`compact`, `comfortable`, `spacious`), and switch the sidebar position (`left` or `right`).
- **Visual Keybinding Recorder**: Click any command's shortcut button and press your desired key combination to reassign it immediately.
- **Live Custom CSS Editor**: Edit `config/user-style.css` directly inside the Studio to apply custom CSS rules across the entire IDE interface.
- **Profile Bundle Export / Import**: Export or import your complete setup (settings, themes, keybindings, runners, snippets, and custom CSS) as a single `.json` bundle.

---

## 2. Out-of-App Customization (Live Hot-Reload)

All files inside `config/` and `plugins/` (located in the project root and alongside `openide.exe`) are watched in real time via `fs.watch`. Saving changes in any external text editor immediately updates the running IDE without restarting:

| File / Folder | Description |
|---|---|
| `config/settings.json` | Theme, Material You seed color, corner radius, font, editor, and terminal settings |
| `config/themes/*.json` | External JSON themes. Dropping a new `.json` file into this folder automatically adds it to the theme selector |
| `config/keybindings.json` | Keyboard shortcut bindings |
| `config/runners.json` | Language execution commands (`F5`) for each file extension (`.py`, `.js`, `.ts`, `.rs`, `.cpp`, `.cs`, `.go`, etc.) |
| `config/snippets.json` | Custom autocomplete code snippets |
| `config/user-style.css` | Live custom stylesheet injected into the IDE window |
| `plugins/<plugin-id>/` | External JavaScript plugins (`manifest.json` + `main.js`) |

---

## 3. Creating a Custom Theme (`config/themes/my-theme.json`)

```json
{
  "id": "my-theme",
  "name": "My Custom Material 3 Theme",
  "mode": "dark",
  "seedColor": "#7C4DFF",
  "colors": {
    "primary": "#D0BCFF",
    "onPrimary": "#381E72",
    "primaryContainer": "#4F378B",
    "onPrimaryContainer": "#EADDFF",
    "secondary": "#CCC2DC",
    "onSecondary": "#332D41",
    "secondaryContainer": "#4A4458",
    "onSecondaryContainer": "#E8DEF8",
    "tertiary": "#EFB8C8",
    "onTertiary": "#492532",
    "tertiaryContainer": "#633B48",
    "onTertiaryContainer": "#FFD8E4",
    "surface": "#141218",
    "surfaceContainerLowest": "#0F0D13",
    "surfaceContainerLow": "#1D1B20",
    "surfaceContainer": "#211F26",
    "surfaceContainerHigh": "#2B2930",
    "surfaceContainerHighest": "#36343B",
    "onSurface": "#E6E0E9",
    "onSurfaceVariant": "#CAC4D0",
    "outline": "#938F99",
    "outlineVariant": "#49454F"
  }
}
```

---

## 4. Creating an External Plugin (`plugins/<id>/main.js`)

```javascript
module.exports = {
  activate(api) {
    const status = api.statusBar.createItem({
      id: 'sample-plugin',
      text: 'Ready',
      icon: 'bolt',
      tooltip: 'Click to run sample plugin',
      onClick: () => api.commands.execute('plugin.sample.hello')
    });

    api.commands.register({
      id: 'plugin.sample.hello',
      title: 'Sample Plugin: Say Hello',
      handler: () => {
        api.ui.showSnackbar('Sample plugin executed successfully!');
      }
    });
  },
  deactivate(api) {
    api.statusBar.removeItem('sample-plugin');
  }
};
```
