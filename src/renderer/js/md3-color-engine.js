/**
 * openide - Material Design 3 (Material You) Dynamic Color & Theme Engine
 * Generates full MD3 tonal palettes from any seed HEX color and applies preset JSON themes.
 */

(function () {
  function hexToHsl(hex) {
    let clean = (hex || '#7C4DFF').replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16) || 0x7C4DFF;
    let r = ((num >> 16) & 255) / 255;
    let g = ((num >> 8) & 255) / 255;
    let b = (num & 255) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  /**
   * Generates a complete Material Design 3 Tonal Palette + Syntax Theme from a single seed HEX color
   */
  function generateMaterialYouTheme(seedHex, mode = 'dark', customName = null) {
    const { h, s } = hexToHsl(seedHex);
    const sat = Math.max(45, s);
    const secHue = (h + 18) % 360;
    const terHue = (h + 65) % 360;

    if (mode === 'light') {
      const colors = {
        primary: hslToHex(h, sat, 40),
        onPrimary: '#FFFFFF',
        primaryContainer: hslToHex(h, Math.min(90, sat + 10), 90),
        onPrimaryContainer: hslToHex(h, sat, 14),
        secondary: hslToHex(secHue, Math.max(20, sat * 0.4), 40),
        onSecondary: '#FFFFFF',
        secondaryContainer: hslToHex(secHue, Math.max(28, sat * 0.5), 89),
        onSecondaryContainer: hslToHex(secHue, Math.max(25, sat * 0.5), 16),
        tertiary: hslToHex(terHue, Math.max(35, sat * 0.6), 38),
        onTertiary: '#FFFFFF',
        tertiaryContainer: hslToHex(terHue, Math.max(45, sat * 0.7), 90),
        onTertiaryContainer: hslToHex(terHue, Math.max(35, sat * 0.6), 15),
        surface: hslToHex(h, 22, 98),
        surfaceDim: hslToHex(h, 18, 90),
        surfaceBright: '#FFFFFF',
        surfaceContainerLowest: '#FFFFFF',
        surfaceContainerLow: hslToHex(h, 20, 95),
        surfaceContainer: hslToHex(h, 20, 92),
        surfaceContainerHigh: hslToHex(h, 18, 88),
        surfaceContainerHighest: hslToHex(h, 18, 84),
        onSurface: hslToHex(h, 24, 11),
        onSurfaceVariant: hslToHex(h, 14, 34),
        outline: hslToHex(h, 12, 48),
        outlineVariant: hslToHex(h, 16, 80),
        error: '#DC2626',
        success: '#059669',
        warning: '#D97706'
      };
      return {
        id: 'dynamic-seed-light',
        name: customName || `Material You (${seedHex.toUpperCase()} Light)`,
        mode: 'light',
        seedColor: seedHex,
        colors,
        syntax: {
          base: 'vs',
          background: '#FFFFFF',
          lineHighlight: colors.surfaceContainerLow,
          selection: colors.primaryContainer + 'AA',
          comment: colors.outline,
          keyword: colors.primary,
          string: '#047857',
          number: '#B45309',
          type: colors.tertiary,
          function: hslToHex((h + 340) % 360, sat, 36),
          variable: colors.onSurface,
          operator: colors.onSurfaceVariant
        }
      };
    }

    // Dark Mode Tonal Palette
    const colors = {
      primary: hslToHex(h, Math.min(92, sat + 12), 78),
      onPrimary: hslToHex(h, sat, 18),
      primaryContainer: hslToHex(h, sat, 28),
      onPrimaryContainer: hslToHex(h, Math.min(95, sat + 15), 90),
      secondary: hslToHex(secHue, Math.max(24, sat * 0.45), 76),
      onSecondary: hslToHex(secHue, Math.max(24, sat * 0.45), 18),
      secondaryContainer: hslToHex(secHue, Math.max(28, sat * 0.5), 27),
      onSecondaryContainer: hslToHex(secHue, Math.max(32, sat * 0.55), 88),
      tertiary: hslToHex(terHue, Math.max(40, sat * 0.65), 78),
      onTertiary: hslToHex(terHue, Math.max(40, sat * 0.65), 18),
      tertiaryContainer: hslToHex(terHue, Math.max(40, sat * 0.65), 29),
      onTertiaryContainer: hslToHex(terHue, Math.max(45, sat * 0.7), 90),
      surface: hslToHex(h, 24, 8),
      surfaceDim: hslToHex(h, 24, 6),
      surfaceBright: hslToHex(h, 18, 22),
      surfaceContainerLowest: hslToHex(h, 26, 5),
      surfaceContainerLow: hslToHex(h, 22, 11),
      surfaceContainer: hslToHex(h, 20, 14),
      surfaceContainerHigh: hslToHex(h, 18, 18),
      surfaceContainerHighest: hslToHex(h, 18, 23),
      onSurface: hslToHex(h, 20, 90),
      onSurfaceVariant: hslToHex(h, 14, 76),
      outline: hslToHex(h, 12, 56),
      outlineVariant: hslToHex(h, 16, 27),
      error: '#FFB4AB',
      success: '#6EE7B7',
      warning: '#FCD34D'
    };

    return {
      id: 'dynamic-seed-dark',
      name: customName || `Material You (${seedHex.toUpperCase()} Dark)`,
      mode: 'dark',
      seedColor: seedHex,
      colors,
      syntax: {
        base: 'vs-dark',
        background: colors.surface,
        lineHighlight: colors.surfaceContainerLow,
        selection: colors.primaryContainer + '88',
        comment: colors.outline,
        keyword: colors.primary,
        string: '#6EE7B7',
        number: '#FCD34D',
        type: colors.tertiary,
        function: hslToHex((h + 25) % 360, 85, 76),
        variable: colors.onSurface,
        operator: colors.onSurfaceVariant
      }
    };
  }

  function applyThemeObject(themeObj) {
    if (!themeObj || !themeObj.colors) return;
    const root = document.documentElement;
    const c = themeObj.colors;

    const map = {
      '--md-sys-color-primary': c.primary,
      '--md-sys-color-on-primary': c.onPrimary,
      '--md-sys-color-primary-container': c.primaryContainer,
      '--md-sys-color-on-primary-container': c.onPrimaryContainer,
      '--md-sys-color-secondary': c.secondary,
      '--md-sys-color-on-secondary': c.onSecondary,
      '--md-sys-color-secondary-container': c.secondaryContainer,
      '--md-sys-color-on-secondary-container': c.onSecondaryContainer,
      '--md-sys-color-tertiary': c.tertiary,
      '--md-sys-color-on-tertiary': c.onTertiary,
      '--md-sys-color-tertiary-container': c.tertiaryContainer,
      '--md-sys-color-on-tertiary-container': c.onTertiaryContainer,
      '--md-sys-color-surface': c.surface,
      '--md-sys-color-surface-dim': c.surfaceDim,
      '--md-sys-color-surface-bright': c.surfaceBright,
      '--md-sys-color-surface-container-lowest': c.surfaceContainerLowest,
      '--md-sys-color-surface-container-low': c.surfaceContainerLow,
      '--md-sys-color-surface-container': c.surfaceContainer,
      '--md-sys-color-surface-container-high': c.surfaceContainerHigh,
      '--md-sys-color-surface-container-highest': c.surfaceContainerHighest,
      '--md-sys-color-on-surface': c.onSurface,
      '--md-sys-color-on-surface-variant': c.onSurfaceVariant,
      '--md-sys-color-outline': c.outline,
      '--md-sys-color-outline-variant': c.outlineVariant,
      '--md-sys-color-error': c.error || '#FFB4AB',
      '--md-sys-color-success': c.success || '#6EE7B7',
      '--md-sys-color-warning': c.warning || '#FCD34D'
    };

    for (const [k, v] of Object.entries(map)) {
      if (v) root.style.setProperty(k, v);
    }

    document.body.setAttribute('data-theme-mode', themeObj.mode || 'dark');

    // Sync Monaco Editor theme if loaded
    if (window.EditorManager && typeof window.EditorManager.applyMonacoTheme === 'function') {
      window.EditorManager.applyMonacoTheme(themeObj);
    }
  }

  function applyAppearanceSettings(appearance = {}, userStyleCss = '') {
    const root = document.documentElement;
    const corner = typeof appearance.cornerRadius === 'number' ? appearance.cornerRadius : 16;
    root.style.setProperty('--md-corner-base', `${corner}px`);

    if (appearance.uiFontFamily) {
      root.style.setProperty('--md-font-ui', appearance.uiFontFamily);
    }

    document.body.setAttribute('data-density', appearance.uiDensity || 'comfortable');
    document.body.setAttribute('data-sidebar-pos', appearance.sidebarPosition || 'left');
    document.body.setAttribute('data-contrast', appearance.surfaceContrast || 'standard');
    document.body.setAttribute('data-animations', String(appearance.animations !== false));

    if (appearance.uiScale && appearance.uiScale !== 100) {
      document.body.style.zoom = `${appearance.uiScale}%`;
    } else {
      document.body.style.zoom = '100%';
    }

    // Inject or update external config/user-style.css
    let styleTag = document.getElementById('materia-user-custom-css');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'materia-user-custom-css';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = (appearance.customCssEnabled !== false) ? (userStyleCss || '') : '';
  }

  window.MD3ColorEngine = {
    hexToHsl,
    hslToHex,
    generateMaterialYouTheme,
    applyThemeObject,
    applyAppearanceSettings
  };
})();
