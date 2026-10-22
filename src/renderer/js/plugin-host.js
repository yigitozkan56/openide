/**
 * openide - Dynamic Plugin Host (Supports In-App & External plugins/*)
 */

(function () {
  const loadedPlugins = new Map();
  const statusItems = new Map();
  const pluginCommands = new Map();
  const eventListeners = new Map();

  function emit(eventName, payload) {
    const list = eventListeners.get(eventName) || [];
    for (const cb of list) {
      try { cb(payload); } catch (e) { console.error('Plugin event error:', e); }
    }
  }

  function createPluginAPI(pluginId) {
    return {
      statusBar: {
        createItem({ id, text, icon, tooltip, onClick }) {
          const itemId = id || `${pluginId}-item`;
          const container = document.getElementById('plugin-statusbar-items');
          if (!container) return { setText() {} };

          let existing = document.getElementById(`sb-item-${itemId}`);
          if (existing) existing.remove();

          const chip = document.createElement('button');
          chip.className = 'status-chip';
          chip.id = `sb-item-${itemId}`;
          chip.title = tooltip || text || '';
          const iconHtml = icon && window.MateriaIcons ? window.MateriaIcons.icon(icon, 'sm') : '';
          chip.innerHTML = `${iconHtml}<span class="sb-text">${text || ''}</span>`;
          if (typeof onClick === 'function') {
            chip.addEventListener('click', onClick);
          }
          container.appendChild(chip);
          statusItems.set(itemId, { pluginId, el: chip });

          return {
            setText(newText) {
              const span = chip.querySelector('.sb-text');
              if (span) span.textContent = newText;
            }
          };
        },
        removeItem(id) {
          const entry = statusItems.get(id);
          if (entry && entry.el) entry.el.remove();
          statusItems.delete(id);
        }
      },
      commands: {
        register({ id, title, category, handler }) {
          pluginCommands.set(id, { id, title, category: category || 'Plugin', handler, pluginId });
        },
        execute(id) {
          const cmd = pluginCommands.get(id);
          if (cmd && typeof cmd.handler === 'function') {
            cmd.handler();
          } else if (window.MateriaApp) {
            window.MateriaApp.executeCommand(id);
          }
        }
      },
      events: {
        on(eventName, cb) {
          if (!eventListeners.has(eventName)) eventListeners.set(eventName, []);
          eventListeners.get(eventName).push(cb);
        }
      },
      editor: {
        getValue: () => (window.EditorManager ? window.EditorManager.getValue() : ''),
        setValue: (v) => (window.EditorManager ? window.EditorManager.setValue(v) : null),
        revealLine: (line) => (window.EditorManager ? window.EditorManager.revealLine(line) : null)
      },
      theme: {
        applyDynamicSeed: (hex) => {
          if (window.MateriaApp) window.MateriaApp.applyDynamicSeedColor(hex, true);
        }
      },
      ui: {
        showSnackbar: (msg) => {
          if (window.MateriaApp) window.MateriaApp.showSnackbar(msg);
        },
        showModal: (opts) => {
          if (window.MateriaApp) window.MateriaApp.showInfoModal(opts);
        }
      }
    };
  }

  function deactivateAll() {
    for (const [id, inst] of loadedPlugins.entries()) {
      try {
        if (inst.module && typeof inst.module.deactivate === 'function') {
          inst.module.deactivate(inst.api);
        }
      } catch (_) {}
    }
    loadedPlugins.clear();
    for (const [, entry] of statusItems.entries()) {
      if (entry.el) entry.el.remove();
    }
    statusItems.clear();
    pluginCommands.clear();
    eventListeners.clear();
  }

  function reloadPlugins(pluginsList = [], enabledIds = []) {
    deactivateAll();
    const enabledSet = new Set(enabledIds);

    for (const plugin of pluginsList) {
      if (!enabledSet.has(plugin.id)) continue;
      if (!plugin.code) continue;

      try {
        const mod = { exports: {} };
        const fn = new Function('module', 'exports', plugin.code);
        fn(mod, mod.exports);
        const api = createPluginAPI(plugin.id);
        if (mod.exports && typeof mod.exports.activate === 'function') {
          mod.exports.activate(api);
        }
        loadedPlugins.set(plugin.id, { manifest: plugin, module: mod.exports, api });
      } catch (err) {
        console.error(`Failed to activate plugin ${plugin.id}:`, err);
      }
    }
  }

  function getRegisteredCommands() {
    return Array.from(pluginCommands.values());
  }

  window.PluginHost = {
    reloadPlugins,
    deactivateAll,
    emit,
    getRegisteredCommands
  };
})();
