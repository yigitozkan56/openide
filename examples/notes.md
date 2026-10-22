# openide - Customization Notes

Open this Markdown file alongside **Live Preview (`Ctrl+Shift+V`)** to see real-time rendering.

## In-App Customization
- **Material You Dynamic Color Engine**: Pick any HEX seed color to dynamically generate all IDE surface tones and syntax colors.
- **Corner Radius & UI Density**: Choose between Sharp (`0px`), Standard MD3 (`16px`), or Expressive Pill (`24px+`).
- **Visual Keybinding Recorder**: Click any command shortcut button and press your preferred key combination.

## Out-of-App Customization
- `config/settings.json`: All IDE, appearance, editor, and terminal settings
- `config/themes/*.json`: Drop-in JSON theme files
- `config/user-style.css`: Live-injected custom CSS rules (Hot-Reload)
- `plugins/*`: Modular JavaScript extensions
