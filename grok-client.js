// Run in the Bot terminal: node grok-client.js /private/grok.local.json pedido.json
// The request file must contain a supported action. Never put tokens in prompts.
const fs = require('fs');
const { selectCredentials } = require('./accounts');
async function main() {
  const all = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const body = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const config = selectCredentials(all, body);
  delete body.account;
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('URL invalida');
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  console.log(JSON.stringify(await r.json(), null, 2));
  if (!r.ok) process.exitCode = 1;
}
main().catch(() => { console.error('Falha na chamada. Consulte status antes de repetir um pedido.'); process.exitCode = 1; });
