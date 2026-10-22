/**
 * openide - In-App & Out-of-App Customization Studio
 * Controls Themes, Material You Dynamic Color Generator, Shape/Density/Layout,
 * Editor Settings, Visual Keybinding Recorder, Language Runners, Snippets, and Live CSS.
 */

(function () {
  let recordingKeyForId = null;

  const SEED_PRESETS = [
    { name: 'Ocean Blue', hex: '#38BDF8' },
    { name: 'Royal Purple', hex: '#7C4DFF' },
    { name: 'Emerald Green', hex: '#10B981' },
    { name: 'Sunset Coral', hex: '#F97316' },
    { name: 'Cyber Neon Cyan', hex: '#00F5D4' },
    { name: 'Sakura Pink', hex: '#EC4899' },
    { name: 'Amber Gold', hex: '#F59E0B' },
    { name: 'Indigo Night', hex: '#6366F1' },
    { name: 'Crimson Rose', hex: '#F43F5E' },
    { name: 'Mint Teal', hex: '#14B8A6' }
  ];

  function renderStudio(state) {
    const container = document.getElementById('customization-studio-content');
    if (!container) return;

    const appCfg = state.settings.appearance || {};
    const edCfg = state.settings.editor || {};
    const themes = state.themes || [];
    const shortcuts = (state.keybindings && state.keybindings.shortcuts) || [];
    const runners = (state.runners && state.runners.runners) || {};

    container.innerHTML = `
      <!-- SECTION 1: THEMES & MATERIAL YOU DYNAMIC COLOR -->
      <div class="studio-section active" id="studio-sec-themes">
        <div class="md3-card">
          <div class="md3-card-header">
            <div>
              <div class="md3-card-title">Material You Dynamic Color Engine (Seed Color Generator)</div>
              <div class="md3-card-subtitle">Pick a single seed color to dynamically generate all surface tonal hierarchy layers, accents, and syntax highlighting colors.</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="color" id="studio-seed-color-input" value="${appCfg.seedColor || '#7C4DFF'}" style="width:42px; height:36px; border:none; border-radius:8px; cursor:pointer; background:transparent;">
              <button class="md3-tonal-btn primary" id="studio-apply-seed-btn">Apply Dynamic Seed</button>
              <button class="md3-tonal-btn outline" id="studio-save-seed-theme-btn">Save as JSON Theme</button>
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;">
            ${SEED_PRESETS.map(p => `
              <button class="md3-tonal-btn outline seed-preset-btn" data-hex="${p.hex}" style="padding-left:8px;">
                <span style="width:14px; height:14px; border-radius:50%; background:${p.hex}; display:inline-block;"></span>
                ${p.name} (${p.hex})
              </button>
            `).join('')}
          </div>
        </div>

        <div class="md3-card">
          <div class="md3-card-header">
            <div>
              <div class="md3-card-title">Installed Themes (config/themes/*.json)</div>
              <div class="md3-card-subtitle">Any .json theme file dropped into this external folder automatically appears here.</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="md3-tonal-btn outline" id="studio-open-themes-dir-btn">Open Themes Folder</button>
            </div>
          </div>

          <div class="theme-grid">
            ${themes.map(t => {
              const c = t.colors || {};
              const isCurrent = !appCfg.useDynamicSeed && appCfg.theme === t.id;
              return `
                <div class="theme-card ${isCurrent ? 'active' : ''}" data-theme-id="${t.id}">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:13px;">${t.name || t.id}</strong>
                    <span class="kbd-badge">${(t.mode || 'dark').toUpperCase()}</span>
                  </div>
                  <div class="theme-swatches">
                    <span class="theme-swatch" style="background:${c.surface || '#0E1419'}" title="Surface"></span>
                    <span class="theme-swatch" style="background:${c.primary || '#7DD3FC'}" title="Primary"></span>
                    <span class="theme-swatch" style="background:${c.primaryContainer || '#004D68'}" title="Primary Container"></span>
                    <span class="theme-swatch" style="background:${c.secondaryContainer || '#374955'}" title="Secondary"></span>
                    <span class="theme-swatch" style="background:${c.tertiary || '#CAC1E9'}" title="Tertiary"></span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                    <span style="font-size:11px; color:var(--md-sys-color-on-surface-variant);">${t._fileName || (t.id + '.json')}</span>
                    <button class="md3-tonal-btn outline edit-theme-json-btn" data-path="${t._filePath || ''}" style="height:24px; font-size:11px; padding:0 8px;">Edit JSON</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- SECTION 2: LAYOUT, SHAPE & DENSITY -->
      <div class="studio-section" id="studio-sec-layout">
        <div class="md3-card">
          <div class="md3-card-title">Material 3 Shape, Corner Radius & Layout</div>
          <div class="settings-grid">
            <div class="md3-field">
              <label>Corner Radius: <span id="lbl-corner-val">${appCfg.cornerRadius ?? 16}px</span></label>
              <input type="range" min="0" max="28" step="2" value="${appCfg.cornerRadius ?? 16}" class="md3-input" id="cfg-corner-radius">
            </div>

            <div class="md3-field">
              <label>UI Density</label>
              <select class="md3-select" id="cfg-ui-density">
                <option value="compact" ${appCfg.uiDensity === 'compact' ? 'selected' : ''}>Compact</option>
                <option value="comfortable" ${(!appCfg.uiDensity || appCfg.uiDensity === 'comfortable') ? 'selected' : ''}>Comfortable (Standard)</option>
                <option value="spacious" ${appCfg.uiDensity === 'spacious' ? 'selected' : ''}>Spacious</option>
              </select>
            </div>

            <div class="md3-field">
              <label>Sidebar Position</label>
              <select class="md3-select" id="cfg-sidebar-pos">
                <option value="left" ${appCfg.sidebarPosition !== 'right' ? 'selected' : ''}>Left</option>
                <option value="right" ${appCfg.sidebarPosition === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>

            <div class="md3-field">
              <label>Surface Contrast</label>
              <select class="md3-select" id="cfg-surface-contrast">
                <option value="standard" ${appCfg.surfaceContrast !== 'high' ? 'selected' : ''}>Standard Material 3</option>
                <option value="high" ${appCfg.surfaceContrast === 'high' ? 'selected' : ''}>High Contrast</option>
              </select>
            </div>

            <div class="md3-field">
              <label>UI Scale (Zoom %): <span id="lbl-zoom-val">${appCfg.uiScale || 100}%</span></label>
              <input type="range" min="85" max="125" step="5" value="${appCfg.uiScale || 100}" class="md3-input" id="cfg-ui-scale">
            </div>
          </div>

          <div class="settings-grid" style="margin-top:8px;">
            <div class="md3-switch-row">
              <span>Material 3 Smooth Transition Animations</span>
              <input type="checkbox" id="cfg-animations" ${appCfg.animations !== false ? 'checked' : ''}>
            </div>
            <div class="md3-switch-row">
              <span>Enable External Custom CSS (config/user-style.css)</span>
              <input type="checkbox" id="cfg-custom-css-enabled" ${appCfg.customCssEnabled !== false ? 'checked' : ''}>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: EDITOR SETTINGS -->
      <div class="studio-section" id="studio-sec-editor">
        <div class="md3-card">
          <div class="md3-card-title">Monaco Code Editor Preferences</div>
          <div class="settings-grid">
            <div class="md3-field">
              <label>Font Family</label>
              <input type="text" class="md3-input" id="cfg-ed-font-family" value="${edCfg.fontFamily || "'Cascadia Code', 'Consolas', monospace"}">
            </div>
            <div class="md3-field">
              <label>Font Size (px)</label>
              <input type="number" min="10" max="32" class="md3-input" id="cfg-ed-font-size" value="${edCfg.fontSize || 14}">
            </div>
            <div class="md3-field">
              <label>Line Height (px)</label>
              <input type="number" min="14" max="48" class="md3-input" id="cfg-ed-line-height" value="${edCfg.lineHeight || 22}">
            </div>
            <div class="md3-field">
              <label>Tab Size</label>
              <input type="number" min="1" max="8" class="md3-input" id="cfg-ed-tab-size" value="${edCfg.tabSize || 2}">
            </div>
            <div class="md3-field">
              <label>Word Wrap</label>
              <select class="md3-select" id="cfg-ed-word-wrap">
                <option value="off" ${edCfg.wordWrap !== 'on' ? 'selected' : ''}>Off</option>
                <option value="on" ${edCfg.wordWrap === 'on' ? 'selected' : ''}>On</option>
              </select>
            </div>
            <div class="md3-field">
              <label>Cursor Style</label>
              <select class="md3-select" id="cfg-ed-cursor-style">
                <option value="line" ${edCfg.cursorStyle === 'line' ? 'selected' : ''}>Line</option>
                <option value="block" ${edCfg.cursorStyle === 'block' ? 'selected' : ''}>Block</option>
                <option value="underline" ${edCfg.cursorStyle === 'underline' ? 'selected' : ''}>Underline</option>
              </select>
            </div>
          </div>

          <div class="settings-grid" style="margin-top:8px;">
            <div class="md3-switch-row">
              <span>Show Minimap</span>
              <input type="checkbox" id="cfg-ed-minimap" ${edCfg.minimapEnabled !== false ? 'checked' : ''}>
            </div>
            <div class="md3-switch-row">
              <span>Font Ligatures</span>
              <input type="checkbox" id="cfg-ed-ligatures" ${edCfg.fontLigatures !== false ? 'checked' : ''}>
            </div>
            <div class="md3-switch-row">
              <span>Bracket Pair Colorization</span>
              <input type="checkbox" id="cfg-ed-brackets" ${edCfg.bracketPairColorization !== false ? 'checked' : ''}>
            </div>
            <div class="md3-switch-row">
              <span>Sticky Scroll Header</span>
              <input type="checkbox" id="cfg-ed-sticky" ${edCfg.stickyScroll !== false ? 'checked' : ''}>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 4: VISUAL KEYBINDINGS STUDIO -->
      <div class="studio-section" id="studio-sec-keybindings">
        <div class="md3-card">
          <div class="md3-card-header">
            <div>
              <div class="md3-card-title">Keyboard Shortcuts (config/keybindings.json)</div>
              <div class="md3-card-subtitle">Click any shortcut button below and press a new key combination on your keyboard to reassign it.</div>
            </div>
            <button class="md3-tonal-btn outline" id="studio-edit-keybindings-json">Open keybindings.json in Editor</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:6px;">
            ${shortcuts.map(sc => `
              <div class="md3-switch-row" style="padding:8px 14px;">
                <div>
                  <strong style="font-size:12.5px;">${sc.command}</strong>
                  <span style="font-size:11px; color:var(--md-sys-color-on-surface-variant); margin-left:8px;">(${sc.id})</span>
                </div>
                <button class="md3-tonal-btn secondary record-key-btn" data-shortcut-id="${sc.id}">
                  ${sc.key}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- SECTION 5: LANGUAGE RUNNERS & SNIPPETS -->
      <div class="studio-section" id="studio-sec-runners">
        <div class="md3-card">
          <div class="md3-card-header">
            <div>
              <div class="md3-card-title">Language Runner Profiles (config/runners.json)</div>
              <div class="md3-card-subtitle">Configure the shell command executed for each file extension when pressing F5 / Run.</div>
            </div>
            <button class="md3-tonal-btn outline" id="studio-edit-runners-json">Open runners.json in Editor</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${Object.entries(runners).map(([ext, r]) => `
              <div class="md3-switch-row" style="gap:12px;">
                <div style="min-width:140px;">
                  <span class="kbd-badge">${ext}</span>
                  <strong style="margin-left:6px;">${r.name}</strong>
                </div>
                <input type="text" class="md3-input runner-cmd-input" data-ext="${ext}" value="${(r.command || '').replace(/"/g, '&quot;')}" style="flex:1; font-family:var(--md-font-mono);">
              </div>
            `).join('')}
          </div>
          <div style="display:flex; justify-content:flex-end;">
            <button class="md3-tonal-btn primary" id="studio-save-runners-btn">Save Runner Commands</button>
          </div>
        </div>
      </div>

      <!-- SECTION 6: OUT-OF-APP CUSTOMIZATION & LIVE CSS -->
      <div class="studio-section" id="studio-sec-external">
        <div class="md3-card">
          <div class="md3-card-header">
            <div>
              <div class="md3-card-title">Out-of-App Customization Center & Profile Sharing</div>
              <div class="md3-card-subtitle">All settings, themes, keybindings, and plugins live in plain JSON/CSS/JS files. Editing them outside the IDE triggers an instant Hot-Reload!</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="md3-tonal-btn primary" id="studio-export-profile-btn">Export Profile Bundle (.json)</button>
              <button class="md3-tonal-btn outline" id="studio-import-profile-btn">Import Profile Bundle (.json)</button>
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <button class="md3-tonal-btn secondary" id="ext-open-config-folder">📂 Open config/ in File Explorer</button>
            <button class="md3-tonal-btn secondary" id="ext-open-plugins-folder">🧩 Open plugins/ in File Explorer</button>
            <button class="md3-tonal-btn outline" data-open-cfg="settings.json">📝 Edit settings.json</button>
            <button class="md3-tonal-btn outline" data-open-cfg="keybindings.json">⌨️ Edit keybindings.json</button>
            <button class="md3-tonal-btn outline" data-open-cfg="runners.json">▶️ Edit runners.json</button>
            <button class="md3-tonal-btn outline" data-open-cfg="snippets.json">⚡ Edit snippets.json</button>
            <button class="md3-tonal-btn outline" data-open-cfg="user-style.css">🎨 Open user-style.css in Editor</button>
          </div>
        </div>

        <div class="md3-card">
          <div class="md3-card-header">
            <div>
              <div class="md3-card-title">Live Custom CSS Editor (config/user-style.css)</div>
              <div class="md3-card-subtitle">Any CSS rules saved here are immediately injected across the entire IDE interface.</div>
            </div>
            <button class="md3-tonal-btn primary" id="studio-save-custom-css-btn">Save & Apply CSS</button>
          </div>
          <textarea class="md3-textarea" id="studio-custom-css-textarea" spellcheck="false">${state.userStyleCss || ''}</textarea>
        </div>
      </div>
    `;

    bindStudioEvents(state);
  }

  function bindStudioEvents(state) {
    const seedInput = document.getElementById('studio-seed-color-input');
    const applySeedBtn = document.getElementById('studio-apply-seed-btn');
    if (applySeedBtn && seedInput) {
      applySeedBtn.addEventListener('click', () => {
        window.MateriaApp.applyDynamicSeedColor(seedInput.value, true);
      });
    }

    document.querySelectorAll('.seed-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-hex');
        if (seedInput) seedInput.value = hex;
        window.MateriaApp.applyDynamicSeedColor(hex, true);
      });
    });

    const saveSeedThemeBtn = document.getElementById('studio-save-seed-theme-btn');
    if (saveSeedThemeBtn && seedInput) {
      saveSeedThemeBtn.addEventListener('click', async () => {
        const hex = seedInput.value;
        const mode = state.settings.appearance?.mode || 'dark';
        const customId = `material-you-${hex.replace('#', '').toLowerCase()}-${mode}`;
        const themeObj = window.MD3ColorEngine.generateMaterialYouTheme(
          hex,
          mode,
          `Material You ${hex.toUpperCase()} (${mode})`
        );
        themeObj.id = customId;
        await window.MateriaNative.config.saveTheme(themeObj);
        window.MateriaApp.showSnackbar(`Saved new theme to config/themes/${customId}.json!`);
        await window.MateriaApp.reloadAllConfigs();
      });
    }

    const openThemesDirBtn = document.getElementById('studio-open-themes-dir-btn');
    if (openThemesDirBtn) {
      openThemesDirBtn.addEventListener('click', () => {
        window.MateriaNative.shell.openPath(state.dirs.themesDir);
      });
    }

    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-theme-json-btn')) return;
        const themeId = card.getAttribute('data-theme-id');
        window.MateriaApp.selectPresetTheme(themeId);
      });
    });

    document.querySelectorAll('.edit-theme-json-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const filePath = btn.getAttribute('data-path');
        if (filePath) {
          window.MateriaApp.closeCustomizationStudio();
          await window.MateriaApp.openFileInEditor(filePath);
        }
      });
    });

    const bindAppearanceChange = () => {
      const app = state.settings.appearance;
      const cornerEl = document.getElementById('cfg-corner-radius');
      const densityEl = document.getElementById('cfg-ui-density');
      const sideEl = document.getElementById('cfg-sidebar-pos');
      const contrastEl = document.getElementById('cfg-surface-contrast');
      const scaleEl = document.getElementById('cfg-ui-scale');
      const animEl = document.getElementById('cfg-animations');
      const cssEnEl = document.getElementById('cfg-custom-css-enabled');

      if (cornerEl) {
        app.cornerRadius = Number(cornerEl.value);
        const lbl = document.getElementById('lbl-corner-val');
        if (lbl) lbl.textContent = `${app.cornerRadius}px`;
      }
      if (densityEl) app.uiDensity = densityEl.value;
      if (sideEl) app.sidebarPosition = sideEl.value;
      if (contrastEl) app.surfaceContrast = contrastEl.value;
      if (scaleEl) {
        app.uiScale = Number(scaleEl.value);
        const lbl = document.getElementById('lbl-zoom-val');
        if (lbl) lbl.textContent = `${app.uiScale}%`;
      }
      if (animEl) app.animations = animEl.checked;
      if (cssEnEl) app.customCssEnabled = cssEnEl.checked;

      window.MD3ColorEngine.applyAppearanceSettings(app, state.userStyleCss);
      window.MateriaApp.saveSettingsDebounced();
    };

    ['cfg-corner-radius', 'cfg-ui-density', 'cfg-sidebar-pos', 'cfg-surface-contrast', 'cfg-ui-scale', 'cfg-animations', 'cfg-custom-css-enabled'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', bindAppearanceChange);
        el.addEventListener('change', bindAppearanceChange);
      }
    });

    const bindEditorChange = () => {
      const ed = state.settings.editor;
      const ff = document.getElementById('cfg-ed-font-family');
      const fs = document.getElementById('cfg-ed-font-size');
      const lh = document.getElementById('cfg-ed-line-height');
      const ts = document.getElementById('cfg-ed-tab-size');
      const ww = document.getElementById('cfg-ed-word-wrap');
      const cs = document.getElementById('cfg-ed-cursor-style');
      const mm = document.getElementById('cfg-ed-minimap');
      const lig = document.getElementById('cfg-ed-ligatures');
      const brk = document.getElementById('cfg-ed-brackets');
      const stk = document.getElementById('cfg-ed-sticky');

      if (ff) ed.fontFamily = ff.value;
      if (fs) ed.fontSize = Number(fs.value) || 14;
      if (lh) ed.lineHeight = Number(lh.value) || 22;
      if (ts) ed.tabSize = Number(ts.value) || 2;
      if (ww) ed.wordWrap = ww.value;
      if (cs) ed.cursorStyle = cs.value;
      if (mm) ed.minimapEnabled = mm.checked;
      if (lig) ed.fontLigatures = lig.checked;
      if (brk) ed.bracketPairColorization = brk.checked;
      if (stk) ed.stickyScroll = stk.checked;

      window.EditorManager.updateEditorSettings(ed);
      window.MateriaApp.saveSettingsDebounced();
    };

    ['cfg-ed-font-family', 'cfg-ed-font-size', 'cfg-ed-line-height', 'cfg-ed-tab-size', 'cfg-ed-word-wrap', 'cfg-ed-cursor-style', 'cfg-ed-minimap', 'cfg-ed-ligatures', 'cfg-ed-brackets', 'cfg-ed-sticky'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', bindEditorChange);
    });

    document.querySelectorAll('.record-key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scId = btn.getAttribute('data-shortcut-id');
        recordingKeyForId = scId;
        btn.textContent = 'Press keys... (ESC to cancel)';
        btn.classList.add('primary');

        const onKeyDown = async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.key === 'Escape') {
            window.removeEventListener('keydown', onKeyDown, true);
            recordingKeyForId = null;
            renderStudio(state);
            return;
          }
          if (['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) return;

          const parts = [];
          if (ev.ctrlKey) parts.push('Ctrl');
          if (ev.shiftKey) parts.push('Shift');
          if (ev.altKey) parts.push('Alt');
          const keyName = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
          parts.push(keyName);
          const combo = parts.join('+');

          window.removeEventListener('keydown', onKeyDown, true);
          recordingKeyForId = null;

          const target = state.keybindings.shortcuts.find(s => s.id === scId);
          if (target) {
            target.key = combo;
            await window.MateriaNative.config.saveFile('keybindings.json', state.keybindings);
            window.MateriaApp.showSnackbar(`Shortcut updated: ${target.command} -> ${combo}`);
            renderStudio(state);
          }
        };

        window.addEventListener('keydown', onKeyDown, true);
      });
    });

    const saveRunnersBtn = document.getElementById('studio-save-runners-btn');
    if (saveRunnersBtn) {
      saveRunnersBtn.addEventListener('click', async () => {
        document.querySelectorAll('.runner-cmd-input').forEach(inp => {
          const ext = inp.getAttribute('data-ext');
          if (state.runners.runners[ext]) {
            state.runners.runners[ext].command = inp.value;
          }
        });
        await window.MateriaNative.config.saveFile('runners.json', state.runners);
        window.MateriaApp.showSnackbar('Language runner profiles (config/runners.json) saved!');
      });
    }

    const openCfgFolder = document.getElementById('ext-open-config-folder');
    if (openCfgFolder) {
      openCfgFolder.addEventListener('click', () => window.MateriaNative.shell.openPath(state.dirs.configDir));
    }
    const openPlugFolder = document.getElementById('ext-open-plugins-folder');
    if (openPlugFolder) {
      openPlugFolder.addEventListener('click', () => window.MateriaNative.shell.openPath(state.dirs.pluginsDir));
    }

    document.querySelectorAll('[data-open-cfg]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const file = btn.getAttribute('data-open-cfg');
        const sep = state.dirs.configDir.includes('\\') ? '\\' : '/';
        const fullPath = `${state.dirs.configDir}${sep}${file}`;
        window.MateriaApp.closeCustomizationStudio();
        await window.MateriaApp.openFileInEditor(fullPath);
      });
    });

    const editKbBtn = document.getElementById('studio-edit-keybindings-json');
    if (editKbBtn) {
      editKbBtn.addEventListener('click', async () => {
        const sep = state.dirs.configDir.includes('\\') ? '\\' : '/';
        window.MateriaApp.closeCustomizationStudio();
        await window.MateriaApp.openFileInEditor(`${state.dirs.configDir}${sep}keybindings.json`);
      });
    }

    const editRunBtn = document.getElementById('studio-edit-runners-json');
    if (editRunBtn) {
      editRunBtn.addEventListener('click', async () => {
        const sep = state.dirs.configDir.includes('\\') ? '\\' : '/';
        window.MateriaApp.closeCustomizationStudio();
        await window.MateriaApp.openFileInEditor(`${state.dirs.configDir}${sep}runners.json`);
      });
    }

    const saveCssBtn = document.getElementById('studio-save-custom-css-btn');
    const cssArea = document.getElementById('studio-custom-css-textarea');
    if (saveCssBtn && cssArea) {
      saveCssBtn.addEventListener('click', async () => {
        state.userStyleCss = cssArea.value;
        await window.MateriaNative.config.saveFile('user-style.css', state.userStyleCss);
        window.MD3ColorEngine.applyAppearanceSettings(state.settings.appearance, state.userStyleCss);
        window.MateriaApp.showSnackbar('Custom CSS (config/user-style.css) saved and applied live!');
      });
    }

    const exportBtn = document.getElementById('studio-export-profile-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const res = await window.MateriaNative.config.exportBundle();
        if (res && res.ok) {
          window.MateriaApp.showSnackbar(`Profile exported to: ${res.filePath}`);
        }
      });
    }
    const importBtn = document.getElementById('studio-import-profile-btn');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const res = await window.MateriaNative.config.importBundle();
        if (res && res.ok) {
          await window.MateriaApp.reloadAllConfigs();
          window.MateriaApp.showSnackbar('Customization profile bundle imported and applied!');
        }
      });
    }
  }

  window.CustomizationUI = {
    renderStudio
  };
})();
