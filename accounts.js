'use strict';
function accountSettings(value = '1') {
  const account = String(value);
  if (!['1','2','3'].includes(account)) throw new Error('Conta deve ser 1, 2 ou 3');
  const suffix = account === '1' ? '' : `-${account}`;
  return { account, port: 3209 + Number(account), session: `sessao${suffix}`, panel: `perfil-painel${suffix}`, config: `conexao${suffix}.local.json` };
}
function selectCredentials(config, body) {
  const account = String(body.account || '1');
  accountSettings(account);
  const credentials = config.accounts ? config.accounts[account] : account === '1' ? config : null;
  if (!credentials) throw new Error('Credencial desta conta ausente');
  return credentials;
}
module.exports = { accountSettings, selectCredentials };
