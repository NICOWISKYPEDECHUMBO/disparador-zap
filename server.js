const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const PORTA = 3210;
const WAJS = require.resolve('@wppconnect/wa-js');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

let page = null;
const estado = {
  whatsapp: 'iniciando', // iniciando | qrcode | pronto
  rodando: false,
  total: 0,
  atual: 0,
  ok: 0,
  falha: 0,
  espera: 0,
  log: [],
};

function log(texto, tipo = 'info') {
  const hora = new Date().toLocaleTimeString('pt-BR');
  estado.log.push({ hora, texto, tipo });
  if (estado.log.length > 500) estado.log.shift();
  console.log(`[${hora}] ${texto}`);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Remove tudo que não é dígito; números BR sem DDI (10 ou 11 dígitos) ganham o 55
function normalizar(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d.length >= 12 ? d : '';
}

async function abrirWhatsApp() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    defaultViewport: null,
    userDataDir: path.join(__dirname, 'sessao'), // guarda o login, não precisa ler QR toda vez
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  browser.on('disconnected', () => {
    console.log('Navegador fechado. Encerrando.');
    process.exit(0);
  });

  page = (await browser.pages())[0] || (await browser.newPage());
  await page.setBypassCSP(true);
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
  log('WhatsApp Web aberto. Se pedir, leia o QR code com o celular.');

  // Fica de olho: injeta o WA-JS sempre que precisar e atualiza o status
  for (;;) {
    try {
      const s = await page.evaluate(() => ({
        temWPP: typeof window.WPP !== 'undefined',
        pronto: !!(window.WPP && window.WPP.isReady),
        logado: !!(window.WPP && window.WPP.isReady && window.WPP.conn.isAuthenticated()),
      }));
      if (!s.temWPP) await page.addScriptTag({ path: WAJS });
      const novo = s.logado ? 'pronto' : s.pronto ? 'qrcode' : 'iniciando';
      if (novo !== estado.whatsapp) {
        estado.whatsapp = novo;
        if (novo === 'pronto') log('WhatsApp conectado. Pronto para disparar ✅', 'ok');
        if (novo === 'qrcode') log('Aguardando leitura do QR code...');
      }
    } catch {
      // página recarregando, tenta de novo
    }
    await dormir(2000);
  }
}

async function enviar(numero, mensagem) {
  return page.evaluate(
    async (num, msg) => {
      const existe = await WPP.contact.queryExists(num + '@c.us');
      if (!existe) throw new Error('número não tem WhatsApp');
      await WPP.chat.sendTextMessage(existe.wid._serialized, msg, { createChat: true });
    },
    numero,
    mensagem
  );
}

async function disparar({ lista, mensagem, min, max }) {
  const contatos = lista
    .map((c) => ({ num: normalizar(c.num), nome: (c.nome || '').trim() }))
    .filter((c) => c.num);
  min = Math.max(1, Number(min) || 15);
  max = Math.max(min, Number(max) || min);

  Object.assign(estado, { rodando: true, total: contatos.length, atual: 0, ok: 0, falha: 0, espera: 0 });
  log(`Iniciando disparo para ${contatos.length} contato(s).`);

  for (let i = 0; i < contatos.length && estado.rodando; i++) {
    const { num, nome } = contatos[i];
    estado.atual = i + 1;
    try {
      await enviar(num, mensagem.replace(/\{nome\}/gi, nome));
      estado.ok++;
      log(`✅ ${num}${nome ? ' (' + nome + ')' : ''} enviado`, 'ok');
    } catch (e) {
      estado.falha++;
      log(`❌ ${num}: ${String(e.message || e).split('\n')[0]}`, 'erro');
    }

    if (i < contatos.length - 1 && estado.rodando) {
      const fim = Date.now() + (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
      while (estado.rodando && Date.now() < fim) {
        estado.espera = Math.ceil((fim - Date.now()) / 1000);
        await dormir(250);
      }
      estado.espera = 0;
    }
  }

  log(estado.rodando ? 'Disparo finalizado.' : 'Disparo interrompido.');
  estado.rodando = false;
}

function lerCorpo(req) {
  return new Promise((res) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => {
      try { res(JSON.parse(d || '{}')); } catch { res({}); }
    });
  });
}

const servidor = http.createServer(async (req, res) => {
  const json = (obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'painel.html')));
  }
  if (req.method === 'GET' && req.url === '/estado') return json(estado);

  if (req.method === 'POST' && req.url === '/disparar') {
    if (estado.whatsapp !== 'pronto') return json({ erro: 'WhatsApp ainda não está conectado.' }, 400);
    if (estado.rodando) return json({ erro: 'Já existe um disparo rodando.' }, 400);
    const corpo = await lerCorpo(req);
    if (!Array.isArray(corpo.lista) || !corpo.lista.length) return json({ erro: 'Nenhum número.' }, 400);
    if (!String(corpo.mensagem || '').trim()) return json({ erro: 'Escreva a mensagem.' }, 400);
    disparar(corpo);
    return json({ ok: true });
  }
  if (req.method === 'POST' && req.url === '/parar') {
    if (estado.rodando) {
      estado.rodando = false;
      log('Parando...', 'erro');
    }
    return json({ ok: true });
  }

  res.writeHead(404);
  res.end();
});

if (!CHROME) {
  console.log('Não achei o Google Chrome nem o Edge instalado.');
  process.exit(1);
}

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`Painel em http://localhost:${PORTA}`);
  // Abre o painel numa janelinha própria, separada do WhatsApp
  spawn(CHROME, [
    `--app=http://localhost:${PORTA}`,
    `--user-data-dir=${path.join(__dirname, 'perfil-painel')}`,
    '--window-size=520,860',
  ], { detached: true, stdio: 'ignore' }).unref();
  abrirWhatsApp().catch((e) => {
    console.error('Erro ao abrir o WhatsApp:', e.message);
    process.exit(1);
  });
});
