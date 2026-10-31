# Disparador Zap — Supabase e Grok

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
