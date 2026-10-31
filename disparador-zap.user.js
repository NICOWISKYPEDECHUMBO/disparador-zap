// ==UserScript==
// @name         Disparador Zap (WA-JS)
// @namespace    disparador-zap
// @version      1.0
// @description  Painel no WhatsApp Web para enviar mensagens 1 por 1 automaticamente
// @match        https://web.whatsapp.com/*
// @require      https://github.com/wppconnect-team/wa-js/releases/download/nightly/wppconnect-wa.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  let rodando = false;

  // Cria elementos sem innerHTML (o WhatsApp Web bloqueia innerHTML via Trusted Types)
  function el(tag, props = {}, filhos = []) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e[k] = v;
    });
    filhos.forEach((f) => e.append(f));
    return e;
  }

  const css = {
    campo: { width: '100%', boxSizing: 'border-box', padding: '6px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', marginBottom: '8px', fontFamily: 'inherit' },
    botao: { flex: '1', padding: '8px', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
  };

  function criarPainel() {
    const numeros = el('textarea', {
      rows: 6,
      placeholder: 'Um por linha. Opcional: numero;nome\n11999998888;João\n5521988887777;Maria',
      style: css.campo,
    });
    const mensagem = el('textarea', {
      rows: 5,
      placeholder: 'Mensagem. Use {nome} para o nome do contato.',
      style: css.campo,
    });
    const delayMin = el('input', { type: 'number', value: 15, min: 1, style: { ...css.campo, width: '48%' } });
    const delayMax = el('input', { type: 'number', value: 40, min: 1, style: { ...css.campo, width: '48%' } });
    const status = el('div', { textContent: 'Aguardando WhatsApp carregar...', style: { fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' } });
    const log = el('div', { style: { height: '140px', overflowY: 'auto', background: '#f4f4f4', borderRadius: '6px', padding: '6px', fontSize: '12px', fontFamily: 'monospace' } });

    const btnDisparar = el('button', { textContent: '▶ Disparar', style: { ...css.botao, background: '#25d366' } });
    const btnParar = el('button', { textContent: '■ Parar', style: { ...css.botao, background: '#e53935' } });

    const corpo = el('div', { style: { padding: '10px' } }, [
      el('div', { textContent: 'Números' , style: { fontSize: '12px' } }), numeros,
      el('div', { textContent: 'Mensagem', style: { fontSize: '12px' } }), mensagem,
      el('div', { textContent: 'Intervalo entre envios (segundos): mín / máx', style: { fontSize: '12px' } }),
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [delayMin, delayMax]),
      el('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } }, [btnDisparar, btnParar]),
      status, log,
    ]);

    const btnMin = el('span', { textContent: '—', style: { cursor: 'pointer', padding: '0 6px' } });
    const topo = el('div', {
      style: { background: '#075e54', color: '#fff', padding: '8px 10px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', cursor: 'move', borderRadius: '10px 10px 0 0' },
    }, ['📲 Disparador Zap', btnMin]);
    btnMin.addEventListener('click', () => {
      corpo.style.display = corpo.style.display === 'none' ? 'block' : 'none';
    });

    const painel = el('div', {
      style: { position: 'fixed', top: '20px', right: '20px', width: '320px', background: '#fff', color: '#111', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,.3)', zIndex: 99999, fontFamily: 'Segoe UI, sans-serif' },
    }, [topo, corpo]);
    document.body.append(painel);

    // Arrastar o painel pelo topo
    topo.addEventListener('mousedown', (ev) => {
      const dx = ev.clientX - painel.offsetLeft, dy = ev.clientY - painel.offsetTop;
      const mover = (e) => { painel.style.left = e.clientX - dx + 'px'; painel.style.top = e.clientY - dy + 'px'; painel.style.right = 'auto'; };
      const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); };
      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });

    const escrever = (txt, cor = '#111') => {
      log.append(el('div', { textContent: `[${new Date().toLocaleTimeString()}] ${txt}`, style: { color: cor } }));
      log.scrollTop = log.scrollHeight;
    };

    btnParar.addEventListener('click', () => {
      if (rodando) { rodando = false; escrever('Parando após o envio atual...', '#e53935'); }
    });

    btnDisparar.addEventListener('click', async () => {
      if (rodando) return;
      if (!window.WPP || !WPP.isReady) { escrever('WhatsApp ainda não está pronto. Aguarde.', '#e53935'); return; }

      const lista = numeros.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [num, nome = ''] = l.split(';');
        return { num: normalizar(num), nome: nome.trim() };
      }).filter((c) => c.num);
      const texto = mensagem.value.trim();
      const min = Math.max(1, Number(delayMin.value) || 15);
      const max = Math.max(min, Number(delayMax.value) || min);

      if (!lista.length) return escrever('Nenhum número válido.', '#e53935');
      if (!texto) return escrever('Escreva a mensagem.', '#e53935');

      rodando = true;
      btnDisparar.disabled = true;
      btnDisparar.style.opacity = '.5';
      let ok = 0, falha = 0;

      for (let i = 0; i < lista.length && rodando; i++) {
        const { num, nome } = lista[i];
        status.textContent = `Enviando ${i + 1}/${lista.length} — ✅ ${ok}  ❌ ${falha}`;
        try {
          const existe = await WPP.contact.queryExists(`${num}@c.us`);
          if (!existe) throw new Error('número não tem WhatsApp');
          const msg = texto.replace(/\{nome\}/gi, nome || '');
          await WPP.chat.sendTextMessage(existe.wid._serialized || existe.wid.toString(), msg, { createChat: true });
          ok++;
          escrever(`✅ ${num} enviado`, '#2e7d32');
        } catch (e) {
          falha++;
          escrever(`❌ ${num}: ${e.message || e}`, '#e53935');
        }

        if (i < lista.length - 1 && rodando) {
          const espera = Math.floor(Math.random() * (max - min + 1)) + min;
          status.textContent = `Aguardando ${espera}s... (${i + 1}/${lista.length}) — ✅ ${ok}  ❌ ${falha}`;
          await dormir(espera * 1000);
        }
      }

      status.textContent = `Finalizado — ✅ ${ok}  ❌ ${falha}`;
      escrever('Disparo finalizado.');
      rodando = false;
      btnDisparar.disabled = false;
      btnDisparar.style.opacity = '1';
    });

    return { status, escrever };
  }

  // Remove tudo que não é dígito; números BR sem DDI (10 ou 11 dígitos) ganham o 55
  function normalizar(n) {
    const d = (n || '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) return '55' + d;
    return d.length >= 12 ? d : '';
  }

  // Pausa que continua contando mesmo se clicar em Parar (sai cedo nesse caso)
  function dormir(ms) {
    return new Promise((res) => {
      const fim = Date.now() + ms;
      const t = setInterval(() => {
        if (!rodando || Date.now() >= fim) { clearInterval(t); res(); }
      }, 250);
    });
  }

  function iniciar() {
    const { status, escrever } = criarPainel();
    const pronto = () => { status.textContent = 'Pronto para disparar ✅'; escrever('WA-JS carregado.'); };
    if (window.WPP && WPP.isReady) pronto();
    else if (window.WPP) WPP.webpack.onReady(pronto);
    else status.textContent = 'WA-JS não carregou. Recarregue a página.';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
