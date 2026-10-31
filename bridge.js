'use strict';
const fs = require('fs');
const path = require('path');

function createBridge({ config, getSender, available, send, report, fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  let busy = false;
  let paused = true; // Each local start requires enabling remote sends in the panel.
  let stopped = false;
  let receipt = null;
  const api = async body => {
    const r = await fetchImpl(config.url, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    return r.json();
  };
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      if (receipt) { await api(receipt); receipt = null; }
      const sender = await getSender();
      const { job } = await api({ action: 'poll', sender, ready: !paused && available() });
      if (!job) return;
      let status = 'failed';
      let detail = 'Envio pausado ou remetente alterado';
      if (!paused && available() && await getSender() === job.sender) {
        try {
          await send(job.recipient, job.message, job.sender, job.contact_name, job.save_contact);
          status = 'sent'; detail = 'Confirmado pelo WA-JS';
        } catch {
          status = 'uncertain'; detail = 'Falha durante envio; conferir no WhatsApp antes de repetir';
        }
      }
      receipt = { action: 'complete', id: job.id, status, detail };
      await api(receipt); receipt = null;
      report(`Pedido ${job.id}: ${status}`);
      await wait(15000); // Keep a minimum gap, even when the previous job failed.
    } finally { busy = false; }
  }
  return {
    api,
    tick,
    pause: () => { paused = true; },
    enable: () => { paused = false; },
    get busy() { return busy; },
    get paused() { return paused; },
    stop: () => { stopped = true; paused = true; },
    async run() {
      while (!stopped) {
        try { await tick(); } catch (e) { paused = true; report(`${e.message}. Controle remoto pausado; confira os pedidos antes de reativar.`); }
        await wait(5000);
      }
    }
  };
}

function loadConfig(filename = 'conexao.local.json') {
  const file = path.join(__dirname, filename);
  if (!fs.existsSync(file)) return null;
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || !/^[a-f0-9]{64}$/.test(config.token)) throw new Error('Configuracao Supabase invalida');
  return config;
}
module.exports = { createBridge, loadConfig };
