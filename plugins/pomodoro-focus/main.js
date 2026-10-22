/**
 * openide - External Plugin: Pomodoro Focus Timer
 */
module.exports = {
  timer: null,
  secondsLeft: 25 * 60,
  running: false,

  activate(api) {
    const formatTime = (sec) => {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return `${m}:${s}`;
    };

    const statusItem = api.statusBar.createItem({
      id: 'pomodoro-status',
      text: '25:00',
      icon: 'timer',
      tooltip: 'Start / Pause Pomodoro Focus Timer (Click)',
      onClick: () => {
        this.toggleTimer(api, statusItem, formatTime);
      }
    });

    api.commands.register({
      id: 'plugin.pomodoro.toggle',
      title: 'Pomodoro: Start / Pause Focus Timer',
      category: 'Plugin',
      handler: () => this.toggleTimer(api, statusItem, formatTime)
    });

    api.commands.register({
      id: 'plugin.pomodoro.reset',
      title: 'Pomodoro: Reset Timer',
      category: 'Plugin',
      handler: () => {
        clearInterval(this.timer);
        this.running = false;
        this.secondsLeft = 25 * 60;
        statusItem.setText('25:00');
        api.ui.showSnackbar('Pomodoro timer reset to 25:00.');
      }
    });
  },

  toggleTimer(api, statusItem, formatTime) {
    if (this.running) {
      clearInterval(this.timer);
      this.running = false;
      statusItem.setText(`Paused (${formatTime(this.secondsLeft)})`);
      api.ui.showSnackbar('Pomodoro timer paused.');
    } else {
      this.running = true;
      api.ui.showSnackbar('Pomodoro focus session started! (25 min)');
      this.timer = setInterval(() => {
        if (this.secondsLeft > 0) {
          this.secondsLeft--;
          statusItem.setText(formatTime(this.secondsLeft));
        } else {
          clearInterval(this.timer);
          this.running = false;
          this.secondsLeft = 25 * 60;
          statusItem.setText('25:00');
          api.ui.showSnackbar('Pomodoro session complete! Time for a 5-minute break.');
        }
      }, 1000);
    }
  },

  deactivate(api) {
    clearInterval(this.timer);
    api.statusBar.removeItem('pomodoro-status');
  }
};
