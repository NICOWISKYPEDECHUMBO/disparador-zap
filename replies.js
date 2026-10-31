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
      if (!sender) return;
      const data = await api({ action: 'targets', sender });
      let complete = !data.truncated;
      for (const target of data.targets) {
        if (await getSender() !== sender) return;
        const key = sender + ':' + target.recipient;
        // Re-scan 5 minutes to tolerate delayed message arrival. Database IDs deduplicate.
        const since = state[key] ? new Date(Math.max(Date.parse(target.since), Date.parse(state[key]) - 300000)).toISOString() : target.since;
        const result = await read({ ...target, since }, sender);
        if (result.truncated) complete = false;
        for (const item of result.replies) {
          await api({ action: 'incoming', sender, recipient: target.recipient, ...item });
        }
        // Cursor advances only after all responses were persisted.
        if (!result.truncated && result.replies.length) {
          state[key] = new Date(Math.max(...result.replies.map(r=>Date.parse(r.received_at)), Date.parse(state[key] || target.since))).toISOString();
          persist();
        }
      }
      await api({ action: 'monitor', sender, complete });
      report(complete ? 'Respostas sincronizadas' : 'Historico parcial: limite de consulta atingido');
    } finally { busy = false; }
  }};
}
module.exports = { createReplyMonitor };
