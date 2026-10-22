/**
 * openide - External Plugin: TODO & FIXME Tracker
 * Dynamically loaded from plugins/todo-tracker/main.js
 */
module.exports = {
  activate(api) {
    const statusItem = api.statusBar.createItem({
      id: 'todo-tracker-status',
      text: 'TODO: 0',
      icon: 'task_alt',
      tooltip: 'Click to view TODO/FIXME annotations in the current file',
      onClick: () => {
        api.commands.execute('plugin.todoTracker.showList');
      }
    });

    function scanCurrentContent(content) {
      if (!content) {
        statusItem.setText('TODO: 0');
        return [];
      }
      const lines = content.split(/\r?\n/);
      const matches = [];
      const regex = /\b(TODO|FIXME|HACK|NOTE|BUG)\b[:\s]*(.*)/i;
      lines.forEach((line, idx) => {
        const m = line.match(regex);
        if (m) {
          matches.push({
            line: idx + 1,
            tag: m[1].toUpperCase(),
            text: m[2].trim() || line.trim()
          });
        }
      });
      statusItem.setText(`TODO: ${matches.length}`);
      return matches;
    }

    api.events.on('editor:contentChanged', ({ content }) => {
      scanCurrentContent(content);
    });

    api.events.on('editor:tabChanged', ({ content }) => {
      scanCurrentContent(content);
    });

    api.commands.register({
      id: 'plugin.todoTracker.showList',
      title: 'TODO Tracker: Show TODO & FIXME List',
      category: 'Plugin',
      handler: () => {
        const content = api.editor.getValue();
        const items = scanCurrentContent(content);
        if (items.length === 0) {
          api.ui.showSnackbar('No TODO or FIXME annotations found in the active file.');
          return;
        }
        const summary = items
          .map(it => `[Line ${it.line}] ${it.tag}: ${it.text}`)
          .join('\n');
        api.ui.showModal({
          title: `TODO & FIXME Annotations (${items.length})`,
          content: summary,
          items: items.map(it => ({
            label: `${it.tag} (Line ${it.line})`,
            detail: it.text,
            onSelect: () => api.editor.revealLine(it.line)
          }))
        });
      }
    });

    scanCurrentContent(api.editor.getValue());
  },

  deactivate(api) {
    api.statusBar.removeItem('todo-tracker-status');
  }
};
