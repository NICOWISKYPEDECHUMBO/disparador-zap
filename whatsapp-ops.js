'use strict';
// These functions run inside the WhatsApp page via Puppeteer.evaluate.
async function sendText(num, msg, expected, name, saveContact) {
  const current = () => { const id = WPP.conn.getMyUserId(); return (id?._serialized || id?.toString() || '').split('@')[0]; };
  const check = () => { if (!expected || current() !== expected) throw new Error('Remetente alterado'); };
  check();
  const exists = await WPP.contact.queryExists(num + '@c.us');
  if (!exists) throw new Error('Numero sem WhatsApp');
  const wid = exists.wid._serialized || exists.wid.toString();
  if (saveContact) {
    check();
    const existing = await WPP.contact.get(wid);
    if (!existing?.isMyContact) {
      if (typeof WPP.contact.save !== 'function') throw new Error('Salvar somente no WhatsApp indisponivel');
      // Both spellings are explicit for supported WA-JS versions. Never default to true.
      const saved = await WPP.contact.save(wid, String(name || num).slice(0,100), { syncAddressBook: false, syncAdressBook: false });
      if (!saved) throw new Error('Contato nao foi confirmado; envio interrompido');
    }
  }
  check();
  await WPP.chat.sendTextMessage(wid, msg, { createChat: true });
}

async function readReplies(target, expected) {
  const current = () => { const id = WPP.conn.getMyUserId(); return (id?._serialized || id?.toString() || '').split('@')[0]; };
  if (current() !== expected) throw new Error('Remetente alterado');
  const since = Date.parse(target.since) / 1000;
  const replies = [];
  let before;
  let truncated = false;
  for (let page = 0; page < 10; page++) {
    const rows = await WPP.chat.getMessages(target.recipient + '@c.us', { count: 100, ...(before ? { id: before, direction: 'before' } : {}) });
    if (current() !== expected) throw new Error('Remetente alterado');
    if (!rows.length) break;
    let oldest = Infinity, oldestId;
    for (const m of rows) {
      const id = typeof m.id === 'string' ? m.id : m.id?._serialized;
      const t = Number(m.t);
      if (Number.isFinite(t) && t < oldest) { oldest = t; oldestId = id; }
      const outgoing = m.fromMe === true || m.id?.fromMe === true || id?.startsWith('true_');
      if (!id || outgoing || !Number.isFinite(t) || t < since || m.isNotification || !['chat','image','video','audio','ptt','document','sticker'].includes(m.type)) continue;
      replies.push({ message_id: id, received_at: new Date(t * 1000).toISOString(), type: m.type,
        text: m.type === 'chat' ? String(m.body || '').slice(0,10000) : String(m.caption || '').slice(0,10000) });
    }
    if (oldest <= since || rows.length < 100) break;
    if (!oldestId || oldestId === before) { truncated = true; break; }
    before = oldestId;
    if (page === 9) truncated = true;
  }
  return { replies, truncated };
}
module.exports = { sendText, readReplies };
