(function LifecycleSchedulerModule() {
  'use strict';

  const groups = new Map();
  const activeByReason = new Set(['visibility', 'page', 'view']);
  let currentView = 'home';

  function ensureGroup(name) {
    if (!groups.has(name)) groups.set(name, new Set());
    return groups.get(name);
  }

  function createInterval(group, label, fn, delay) {
    const task = { group, label, fn, delay, id: null };
    ensureGroup(group).add(task);
    if (isGroupActive()) startTask(task);
    return task;
  }

  function startTask(task) {
    if (task.id) return;
    task.id = window.setInterval(task.fn, task.delay);
  }

  function stopTask(task) {
    if (!task.id) return;
    window.clearInterval(task.id);
    task.id = null;
  }

  function clearTask(task) {
    stopTask(task);
    ensureGroup(task.group).delete(task);
  }

  function pauseGroup(group) { (groups.get(group) || []).forEach(stopTask); }
  function resumeGroup(group) { if (!isGroupActive()) return; (groups.get(group) || []).forEach(startTask); }

  function pauseAll(reason) { activeByReason.delete(reason); groups.forEach(set => set.forEach(stopTask)); }
  function resumeAll(reason) { activeByReason.add(reason); if (!isGroupActive()) return; groups.forEach(set => set.forEach(startTask)); }
  function isGroupActive() { return activeByReason.size === 3; }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeAll('visibility');
    else pauseAll('visibility');
  });

  window.addEventListener('pagehide', () => pauseAll('page'));
  window.addEventListener('pageshow', () => resumeAll('page'));

  if (document.visibilityState !== 'visible') pauseAll('visibility');

  window.AppScheduler = {
    registerInterval: createInterval,
    clearIntervalTask: clearTask,
    pauseGroup,
    resumeGroup,
    pauseAll,
    resumeAll,
    setActiveView(viewId) {
      currentView = viewId || 'home';
      if (currentView === 'home') resumeAll('view');
      else pauseAll('view');
    },
    getActiveView() { return currentView; }
  };
})();
