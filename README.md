# Disparador Zap

Projeto Windows com painel local de envio de textos pelo WhatsApp Web. Código original copiado sem alterações funcionais.

## Executar

Abra INICIAR.bat no Windows com Chrome ou Edge instalado. Ele prepara Node e dependências. Alternativamente, com Node instalado: execute `npm ci` e `node server.js` na raiz. O painel fica em http://localhost:3210. Autentique o WhatsApp no navegador aberto.

O arquivo disparador-zap.user.js é uma alternativa independente via gerenciador de userscripts.

## Skill para Grok Bot da xAI

Arquivo: `skills/disparador-zap/SKILL.md`.

No seu repositório existente, envie o conteúdo desta pasta preservando a estrutura. Não envie apenas o ZIP se quiser que o bot leia os arquivos diretamente. As pastas de sessão, navegador, runtime e dependências não fazem parte deste pacote.

Para localizar seu repositório, entre em https://github.com e abra seu perfil > Your repositories. Procure pelo nome usado ao publicar. Abra o repositório e copie a URL da barra do navegador. A pasta original não contém .git; por isso ela não informa o endereço remoto.

Depois de publicar, abra skills/disparador-zap/SKILL.md no GitHub e copie a URL completa. Ela incluirá o proprietário, o repositório e a branch reais. Cole esse link no texto de USAR-NO-GROK.txt.

O Grok Bot permite pedir para salvar um procedimento como skill. Um link GitHub fornece o conteúdo de referência, mas não comprova que a skill foi instalada ou que o bot tem acesso ao seu Windows. Se o bot não conseguir ler o link, anexe SKILL.md e os arquivos de código necessários. Repositórios privados exigem acesso autorizado.

Documentação consultada: https://docs.x.ai/grok-bot/skills-routines-and-automations
Ambiente do Bot: https://docs.x.ai/grok-bot/overview

## Validação e limites

Este pacote não conecta o Grok Bot ao computador local. O aplicativo usa caminhos de navegador Windows e uma sessão interativa; executar em outro ambiente exige adaptação. Não publique os diretórios sessao e perfil-painel, que podem conter autenticação e dados pessoais.

Nenhuma mensagem foi enviada na preparação do pacote. Não foi adicionada licença de redistribuição; o proprietário pode escolher uma antes de disponibilizar o código a terceiros.
