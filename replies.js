'use strict';
const fs = require('fs');
function createReplyMonitor({ api, getSender, read, file, report }) {
  let busy = false;
  let state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : {};
  const persist = () => { fs.writeFileSync(file + '.tmp', JSON.stringify(state)); fs.renameSync(file + '.tmp', file); };
  return { async tick() {
    if (busy) return;
    busy = true;
    try {
      const sender = await getSender();
      if (!sender) return { disconnected: true };
      const data = await api({ action: 'targets', sender });
      let complete = !data.truncated;
      let failures = 0, found = 0, checked = 0;
      for (const target of data.targets) {
        if (await getSender() !== sender) return;
        try {
        const key = sender + ':' + target.recipient;
        // Re-scan 5 minutes to tolerate delayed message arrival. Database IDs deduplicate.
        const since = state[key] ? new Date(Math.max(Date.parse(target.since), Date.parse(state[key]) - 300000)).toISOString() : target.since;
        const result = await read({ ...target, since }, sender);
        checked++;
        if (result.truncated) complete = false;
        for (const item of result.replies) {
          await api({ action: 'incoming', sender, recipient: target.recipient, ...item });
          found++;
        }
        // Cursor advances only after all responses were persisted.
        if (!result.truncated && result.replies.length) {
          state[key] = new Date(Math.max(...result.replies.map(r=>Date.parse(r.received_at)), Date.parse(state[key] || target.since))).toISOString();
          persist();
        }
        } catch {
          complete = false;
          failures++;
        }
      }
      await api({ action: 'monitor', sender, complete });
      const summary = `${checked}/${data.targets.length} conversas verificadas; ${found} respostas sincronizadas; ${failures} falhas`;
      report(summary + (complete ? '' : ' (parcial)'));
      return { complete, checked, found, failures };
    } finally { busy = false; }
  }};
}
function createMonitorScheduler({ monitor, connected, update, now = Date.now }) {
  let next = 0, busy = false;
  return async function check() {
    if (busy || now() < next || !await connected()) return;
    if (busy) return;
    busy = true;
    update({ running: true });
    try {
      const result = await monitor.tick();
      if (result?.disconnected) return;
      update({ last: new Date(now()).toISOString(), error: null });
    } catch (error) {
      update({ error: String(error.message).slice(0,160) });
    } finally {
      next = now() + 300000;
      busy = false;
      update({ running: false, next: new Date(next).toISOString() });
    }
  };
}
module.exports = { createReplyMonitor, createMonitorScheduler };
