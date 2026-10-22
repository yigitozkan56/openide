/**
 * openide - External Plugin: Code Metrics & Complexity Analyzer
 */
module.exports = {
  activate(api) {
    const statusItem = api.statusBar.createItem({
      id: 'code-metrics-status',
      text: '0 words',
      icon: 'analytics',
      tooltip: 'Click to open detailed Code Metrics report',
      onClick: () => api.commands.execute('plugin.codeMetrics.analyze')
    });

    const updateMetrics = (content) => {
      const text = content || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      statusItem.setText(`${words} words`);
    };

    api.events.on('editor:contentChanged', ({ content }) => updateMetrics(content));
    api.events.on('editor:tabChanged', ({ content }) => updateMetrics(content));

    api.commands.register({
      id: 'plugin.codeMetrics.analyze',
      title: 'Code Metrics: Show Complexity & Statistics Report',
      category: 'Plugin',
      handler: () => {
        const code = api.editor.getValue() || '';
        const lines = code.split(/\r?\n/);
        const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;
        const commentLines = lines.filter(l => /^\s*(\/\/|#|\/\*|\*|--)/.test(l)).length;
        const functions = (code.match(/\b(function|def|fn|func|class|interface)\b/g) || []).length;
        const branches = (code.match(/\b(if|else|switch|case|for|while|catch)\b/g) || []).length;
        const chars = code.length;

        api.ui.showModal({
          title: 'Code Metrics Analysis',
          content: [
            `Total Lines: ${lines.length}`,
            `Source Lines of Code (SLOC): ${nonEmptyLines}`,
            `Comment Lines: ${commentLines}`,
            `Total Characters: ${chars}`,
            `Detected Functions / Classes: ${functions}`,
            `Estimated Cyclomatic Complexity: ${branches + 1}`
          ].join('\n')
        });
      }
    });

    updateMetrics(api.editor.getValue());
  },

  deactivate(api) {
    api.statusBar.removeItem('code-metrics-status');
  }
};
