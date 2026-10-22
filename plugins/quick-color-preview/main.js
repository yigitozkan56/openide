/**
 * openide - External Plugin: Material 3 Color & HEX Inspector
 */
module.exports = {
  activate(api) {
    api.commands.register({
      id: 'plugin.colorPreview.extractHex',
      title: 'Color Inspector: Try File HEX Colors as Material You Seed',
      category: 'Plugin',
      handler: () => {
        const code = api.editor.getValue() || '';
        const matches = Array.from(new Set(code.match(/#[0-9A-Fa-f]{6}\b/g) || []));
        if (matches.length === 0) {
          api.ui.showSnackbar('No 6-digit #HEX color codes found in the active file.');
          return;
        }
        api.ui.showModal({
          title: `Detected HEX Colors (${matches.length}) — Click to Apply as Theme Seed`,
          content: 'Select any color found in your code to immediately generate a Material You dynamic theme:',
          items: matches.map(hex => ({
            label: hex.toUpperCase(),
            detail: 'Apply as Material You Dynamic Seed Color',
            colorPreview: hex,
            onSelect: () => {
              api.theme.applyDynamicSeed(hex);
              api.ui.showSnackbar(`Applied ${hex} as Material You dynamic seed color!`);
            }
          }))
        });
      }
    });
  },
  deactivate() {}
};
