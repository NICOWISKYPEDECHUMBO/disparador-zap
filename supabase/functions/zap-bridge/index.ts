// Capability tokens are stored only as SHA-256 hashes. No browser CORS access.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function db(path: string, method = 'GET', body?: unknown, prefer = 'return=representation') {
  const r = await fetch(`${base}/rest/v1/${path}`, { method, headers: {
    apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Prefer: prefer
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error('database');
  return r.status === 204 ? [] : r.json();
}
const json = (data: unknown, status = 200) => Response.json(data, { status });
const phone = (s: unknown) => typeof s === 'string' && /^\d{12,15}$/.test(s);
const uuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Unauthorized' }, 401);
  try {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(v => v.toString(16).padStart(2, '0')).join('');
    const devices = await db(`zap_devices?enabled=eq.true&or=(worker_hash.eq.${hash},controller_hash.eq.${hash})&limit=1`);
    const device = devices[0];
    if (!device) return json({ error: 'Unauthorized' }, 401);
    const worker = device.worker_hash === hash;
    const text = await req.text();
    if (text.length > 16000) return json({ error: 'Request too large' }, 413);
    let b;
    try { b = JSON.parse(text); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!b || typeof b !== 'object') return json({ error: 'Invalid body' }, 400);
    const scope = `device_id=eq.${device.id}`;
    if (b.action === 'status' && !worker) {
      return json({ device: { name: device.name, sender: device.sender, last_seen: device.last_seen, monitor_seen: device.monitor_seen, monitor_complete: device.monitor_complete }, jobs: await db(`zap_jobs?${scope}&order=created_at.desc&limit=50`) });
    }
    if (b.action === 'replies' && !worker) {
      const after = String(b.after || '0');
      if (!/^\d{1,18}$/.test(after)) return json({error:'Invalid cursor'},400);
      const replies = await db(`zap_replies?${scope}&id=gt.${after}&order=id.asc&limit=100`);
      return json({replies, next_after: replies.length ? String(replies[replies.length-1].id) : after, has_more: replies.length === 100});
    }
    if (b.action === 'targets' && worker && phone(b.sender)) {
      const cutoff = encodeURIComponent(new Date(Date.now()-30*86400000).toISOString());
      const jobs = await db(`zap_jobs?${scope}&sender=eq.${b.sender}&status=in.(sent,uncertain)&created_at=gte.${cutoff}&select=recipient,created_at&order=created_at.asc&limit=1000`);
      const targets = new Map<string,unknown>();
      for (const j of jobs) if (!targets.has(j.recipient)) targets.set(j.recipient,{recipient:j.recipient,since:j.created_at});
      return json({targets:[...targets.values()],truncated:jobs.length===1000});
    }
    if (b.action === 'incoming' && worker) {
      if (!phone(b.sender) || !phone(b.recipient) || typeof b.message_id !== 'string' || !b.message_id.length || b.message_id.length>250 || typeof b.text !== 'string' || b.text.length>10000 || !['chat','image','video','audio','ptt','document','sticker'].includes(b.type) || typeof b.received_at !== 'string' || !Number.isFinite(Date.parse(b.received_at)) || Date.parse(b.received_at)>Date.now()+300000) return json({error:'Invalid reply'},400);
      const received = encodeURIComponent(new Date(b.received_at).toISOString());
      const match = await db(`zap_jobs?${scope}&sender=eq.${b.sender}&recipient=eq.${b.recipient}&status=in.(sent,uncertain)&created_at=lte.${received}&select=id&limit=1`);
      if (!match.length) return json({error:'Recipient outside campaigns'},403);
      await db('zap_replies?on_conflict=device_id,sender,message_id','POST', {device_id:device.id,sender:b.sender,recipient:b.recipient,message_id:b.message_id,received_at:b.received_at,type:b.type,text:b.text},'resolution=ignore-duplicates,return=representation');
      return json({ok:true});
    }
    if (b.action === 'monitor' && worker && phone(b.sender) && typeof b.complete === 'boolean') {
      await db(`zap_devices?id=eq.${device.id}&sender=eq.${b.sender}`,'PATCH',{monitor_seen:new Date().toISOString(),monitor_complete:b.complete});
      return json({ok:true});
    }
    if (b.action === 'enqueue' && !worker) {
      if (!uuid(b.id) || !phone(b.sender) || !phone(b.recipient) || typeof b.message !== 'string' || !b.message.trim() || b.message.length > 10000 || b.authorized !== true)
        return json({ error: 'Require UUID id, sender/recipient with country code, message and authorized:true' }, 400);
      const existing = await db(`zap_jobs?${scope}&id=eq.${b.id}`);
      if (b.contact_name !== undefined && (typeof b.contact_name !== 'string' || b.contact_name.length>100) || b.save_contact !== undefined && typeof b.save_contact !== 'boolean') return json({error:'Invalid contact options'},400);
      if (existing.length) {
        const j = existing[0];
        if (j.sender !== b.sender || j.recipient !== b.recipient || j.message !== b.message || j.contact_name !== (b.contact_name || '') || j.save_contact !== (b.save_contact === true)) return json({ error: 'ID already used for different content' }, 409);
        return json(j);
      }
      if (device.sender !== b.sender || !device.last_seen || Date.now() - Date.parse(device.last_seen) > 60000) return json({ error: 'Worker offline or sender differs' }, 409);
      return json((await db('zap_jobs', 'POST', { id: b.id, device_id: device.id, sender: b.sender, recipient: b.recipient, message: b.message, contact_name:b.contact_name || '',save_contact:b.save_contact === true }))[0], 201);
    }
    if (b.action === 'cancel' && !worker && uuid(b.id)) {
      return json(await db(`zap_jobs?${scope}&id=eq.${b.id}&status=eq.queued`, 'PATCH', { status: 'cancelled', finished_at: new Date().toISOString() }));
    }
    if (b.action === 'poll' && worker) {
      const sender = phone(b.sender) ? b.sender : null;
      await db(`zap_devices?id=eq.${device.id}`, 'PATCH', { sender, last_seen: new Date().toISOString() });
      // A changed account invalidates queued messages for the old account.
      if (sender) await db(`zap_jobs?${scope}&status=eq.queued&sender=neq.${sender}`, 'PATCH', { status: 'cancelled', detail: 'Sender changed', finished_at: new Date().toISOString() });
      if (!sender || b.ready !== true) return json({ job: null });
      const next = await db(`zap_jobs?${scope}&sender=eq.${sender}&status=eq.queued&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc&limit=1`);
      if (!next.length) return json({ job: null });
      const rows = await db(`zap_jobs?${scope}&id=eq.${next[0].id}&status=eq.queued`, 'PATCH', { status: 'running' });
      return json({ job: rows[0] || null });
    }
    if (b.action === 'complete' && worker && uuid(b.id) && ['sent','failed','uncertain'].includes(b.status)) {
      return json(await db(`zap_jobs?${scope}&id=eq.${b.id}&status=eq.running`, 'PATCH', { status: b.status, detail: String(b.detail || '').slice(0,300), finished_at: new Date().toISOString() }));
    }
    return json({ error: 'Action not allowed' }, 403);
  } catch {
    // Ambiguous claims/results are never automatically requeued.
    return json({ error: 'Operation failed; check status before retrying' }, 409);
  }
});
