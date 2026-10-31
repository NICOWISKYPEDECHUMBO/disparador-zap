# Grok → Supabase → WhatsApp no PC

## Três contas simultâneas

A versão atual suporta contas 1, 2 e 3 em processos independentes. A conta 1 mantém a sessão antiga e corresponde a PC principal no Supabase. Contas 2 e 3 usam credenciais, sessões e filas próprias. O arquivo privado `grok-3-contas.local.json` contém o mapa accounts. Use o grok-client.js atualizado junto de accounts.js.

Em TODOS os pedidos, informe account como 1, 2 ou 3. Exemplos de consulta: `{"action":"status","account":1}` e `{"action":"status","account":2}`. Para consultar todas, faça três chamadas. O cliente escolhe a credencial correta e retira account antes de chamar a API. Quem chamar HTTP diretamente deve escolher accounts[conta], nunca enviar o arquivo inteiro.

Antes de cadastrar um envio, confirme com o usuário qual conta usar e consulte seu remetente atual. Não transfira pedidos de uma conta indisponível para outra. Uma autorização para conta 1 não autoriza conta 2. Pode coordenar filas simultâneas após a autorização para cada campanha. Pausar ou trocar um número no painel afeta somente aquela conta; não há botão global de pausa nesta versão.

No Windows, abra CONTA-1.bat, CONTA-2.bat e CONTA-3.bat conforme necessário. Painéis: localhost:3210, localhost:3211 e localhost:3212. Conecte números diferentes via QR Code. As credenciais locais são conexao.local.json, conexao-2.local.json e conexao-3.local.json. Nunca publique nenhum deles nem as pastas sessao-* e perfil-painel-*.

## Pré-requisitos

Leia bridge.js, grok-client.js e supabase/functions/zap-bridge/index.ts. O servidor deve estar atualizado e rodando no Windows com conexao.local.json privado. A conta é autenticada por QR Code. No painel, o usuário clica em Liberar Grok; toda reinicialização começa pausada.

Receba grok.local.json como arquivo privado e guarde fora do checkout. Ele autoriza criar e consultar pedidos deste dispositivo; não é uma chave administrativa Supabase. Não imprima seu conteúdo ou coloque em URLs. Não use conexao.local.json no Bot: ele pertence ao worker.

## Chamar

Com Node 22 disponível no ambiente do Bot, crie um arquivo temporário com o JSON do pedido e execute:

`node grok-client.js /caminho/privado/grok.local.json /caminho/privado/pedido.json`

Alternativamente, POST na URL contida no arquivo privado, com Content-Type application/json e Authorization Bearer seguido do token. Use ferramentas que mantenham credenciais fora do histórico de comandos. Se o Bot não tiver terminal ou HTTP autenticado, informe a limitação; salvar a skill não prova acesso operacional.

## Ações

Além das ações abaixo, a versão de acompanhamento aceita replies e os campos save_contact/contact_name em enqueue. Leia [respostas.md](respostas.md) antes de preparar novas campanhas e consultas de respostas.

- Consultar: `{"action":"status"}`. Confira device.sender e last_seen, além do status dos pedidos. Um heartbeat recente significa que o worker alcança a API, não necessariamente que o controle esteja liberado.
- Enviar: action enqueue; id UUID novo; sender número remetente com DDI; recipient destinatário com DDI; message texto final; authorized true. Exija autorização do usuário para os destinatários, texto e remetente. A flag representa essa autorização, não a substitui. Para personalizar, resolva {nome} antes de criar cada pedido.
- Cancelar um pedido ainda na fila: action cancel e id UUID. Uma lista vazia significa que nada foi cancelado. Um envio running não pode ser desfeito por essa ação.

Crie um pedido por destinatário e mantenha um registro local dos IDs. Para repetir uma chamada que teve resposta incerta, reutilize o MESMO id e conteúdo. Nunca gere outro id para uma tentativa que possa já ter enviado. O servidor devolve o pedido anterior ou acusa conflito. Não crie campanhas recorrentes sem solicitação.

Pedidos expiram após uma hora. O worker usa intervalo mínimo de 15 segundos entre envios remotos, além do tempo de consulta. O programa não garante ausência de bloqueios do WhatsApp.

## Troca de número

O usuário clica em Pausar Grok e depois Trocar número no painel. Aguarde o envio atual terminar; em seguida ele lê o QR Code com a nova conta e clica em Liberar Grok. Consulte status novamente e peça autorização para pedidos com o novo remetente. Pedidos pendentes de um remetente diferente são cancelados quando o worker informa a nova conta. A API não troca a conta por um simples número digitado: é preciso autenticar a conta.

## Resultados e falhas

queued: aguardando. running: reservado pelo worker, possivelmente em envio. sent: WA-JS confirmou a chamada (não é confirmação de leitura). uncertain: falha durante a tentativa; confira a conversa antes de repetir. failed: bloqueado antes da tentativa. cancelled: cancelado antes de reservar.

Se o worker cair depois de reservar, running permanece e bloqueia novos envios nesse dispositivo. Não há retomada automática para evitar duplicatas. Confira a conversa e peça ao responsável que resolva o registro no Supabase; nunca transforme running ou uncertain em queued automaticamente. Relate contagens com base no status real, não no sucesso do cadastro do pedido.

## Hospedagem

O Supabase armazena fila e estado. Esta versão continua executando o WhatsApp no Windows; para desligar o PC, é preciso hospedar um worker separado compatível ou integrar uma API de mensagens. Não afirme que Edge Functions hospedam o navegador persistente.
