# Disparador Zap — Supabase e Grok

## Contatos e respostas — atualização

Novas campanhas pelo Grok usam save_contact:true e contact_name. O worker salva contatos novos exclusivamente no WhatsApp, sem sincronizar com a agenda do telefone; contatos existentes são preservados. O painel local também aplica essa regra. O userscript independente não foi alterado e não oferece esse acompanhamento.

Respostas de texto e legendas dos destinatários de campanhas pelo Grok são sincronizadas no Supabase; mídia não é baixada. O Grok consulta action replies com account e cursor after. Veja skills/disparador-zap/references/respostas.md para limites, retenção e instruções. Envios feitos apenas pelo painel local não geram registros zap_jobs, portanto não entram automaticamente no monitor de campanhas.

Para rodar sem janela: após conectar normalmente, encerre a conta pelo painel e abra SEGUNDO-PLANO-1.bat (ou 2/3). O PC deve ficar ligado, com internet e sem suspensão. O painel fica disponível em localhost:3210/3211/3212, mas não abre sozinho. Abra-o manualmente para liberar os envios; a captura de respostas independe dessa liberação. Para encerrar o worker, use Encerrar esta conta. Fechar somente a aba do painel não encerra o processo headless.

O Supabase e a skill fornecem consultas; o usuário ainda precisa atualizar a skill no Grok e solicitar uma rotina se quiser consultas automáticas. Nenhum atendimento automático a clientes foi ativado. A migração adicional está documentada em supabase/replies-schema.sql e já foi aplicada neste projeto; não rode outra vez.

## Três contas

Abra CONTA-1.bat, CONTA-2.bat e CONTA-3.bat para iniciar as contas desejadas. Cada conta abre seu próprio WhatsApp e painel: portas 3210, 3211 e 3212. A conta 1 mantém a sessão existente. Leia o QR Code das outras contas com os respectivos celulares. Libere o Grok separadamente em cada painel. Não use o mesmo número em mais de uma conta.

Para o Grok, use agora grok-3-contas.local.json, entregue em privado fora deste pacote. Inclua account: 1, 2 ou 3 no JSON passado ao grok-client.js atualizado (ele depende de accounts.js). A configuração antiga continua válida apenas para conta 1. Consulte as três contas separadamente. O uso simultâneo exige capacidade do computador; os testes automatizados não substituem a validação dos três navegadores reais.

Nunca publique arquivos *.local.json. O ZIP público não contém credenciais nem sessões. As contas 2 e 3 já estão cadastradas no Supabase, mas só ficam conectadas após iniciar os programas e autenticar no WhatsApp.

## Estado desta entrega

A API zap-bridge e as tabelas zap_devices e zap_jobs foram instaladas no projeto Supabase xdfxgldjhuzvvxyxoasv. A API exige tokens distintos para o Grok e para o worker. Os tokens ficam fora deste repositório e do ZIP público. RLS está habilitado; anon e authenticated não têm acesso às tabelas. Não há políticas para essas funções de banco porque todo acesso passa pela Edge Function, que confere o token e o dispositivo.

## No Windows

1. Use esta versão de server.js, painel.html e bridge.js.
2. Coloque o arquivo privado conexao.local.json na mesma pasta de server.js.
3. Feche a versão antiga do programa e abra INICIAR.bat.
4. Conecte o WhatsApp e clique em Liberar Grok. Reiniciar o programa sempre pausa o controle remoto.
5. Para trocar a conta, pause e clique em Trocar número. Aguarde o envio atual se necessário; leia o QR Code com a nova conta. Depois libere o Grok novamente.

A sessão do WhatsApp continua guardada somente no computador. Não publique sessao/, perfil-painel/ nem arquivos *.local.json.

## No Grok Bot

Atualize o repositório com os arquivos deste pacote. Envie grok.local.json somente como arquivo privado ao Bot e peça que leia skills/disparador-zap/SKILL.md e sua referência supabase.md. O Bot pode usar grok-client.js com Node ou fazer POST autenticado à API. Primeiro peça apenas uma consulta de status. Nenhuma mensagem é necessária para testar acesso.

O Grok só deve cadastrar envios com autorização para destinatários, remetente e texto. Cada pedido usa um UUID permanente para evitar duplicação por repetição da chamada.

## O que já funciona e os limites

- Fila remota, autenticação separada, estado do dispositivo, cancelamento de pedidos ainda pendentes.
- Pedidos vinculados ao número remetente. Trocar de conta cancela os pedidos pendentes de outro remetente na próxima consulta do worker.
- O worker consulta a cada 5 segundos e aguarda 15 segundos após uma tentativa concluída.
- Falhas incertas não são reenviadas automaticamente. Se o processo cair durante um pedido running, confira o WhatsApp e resolva o registro no banco antes de continuar. Esse bloqueio evita duplicação.
- A fila expira pedidos em uma hora; pedidos expirados não são executados, mesmo que ainda apareçam queued no histórico.
- O PC precisa ficar ligado. Supabase hospeda a fila/API, não o navegador WhatsApp. Um worker em hospedagem separada ainda não foi implantado.
- O Bot precisa de acesso a terminal/HTTP e armazenamento privado. Ler a skill não comprova essas capacidades.

## Validação

Execute `node --test tests/bridge.test.js`. Foram testados bloqueio por remetente, pausa inicial, resposta incerta e falha ao registrar confirmação sem reenviar. A API publicada foi testada por status e rejeição de chamadas sem credencial ou com função incorreta. Nenhum envio real foi realizado; a troca de conta por QR depende da verificação no navegador do usuário.

## Banco e manutenção

supabase/schema.sql registra o esquema inicial, já aplicado neste projeto. Não rode novamente no mesmo banco. A função está em supabase/functions/zap-bridge/index.ts. Para revogar acesso, desative enabled no registro do dispositivo. Para trocar tokens, gere segredos aleatórios novos, atualize seus hashes SHA-256 no banco e entregue os arquivos privados correspondentes. Nunca publique service_role.

O Security Advisor retornou apenas o aviso informativo RLS Enabled No Policy nas duas tabelas. É intencional: elas negam acesso direto e são usadas pelo backend autenticado.
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Referências: https://supabase.com/docs/guides/functions/auth-headers e https://wppconnect.io/wa-js/functions/conn.getMyUserId.html
