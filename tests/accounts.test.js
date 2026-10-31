const {test}=require('node:test');
const assert=require('node:assert/strict');
const {accountSettings,selectCredentials}=require('../accounts');
test('three distinct sessions, panels, configs and ports; original session preserved',()=>{
  const all=['1','2','3'].map(accountSettings);
  for(const key of ['session','panel','config','port']) assert.equal(new Set(all.map(x=>x[key])).size,3);
  assert.equal(all[0].session,'sessao');assert.equal(all[0].port,3210);
  assert.throws(()=>accountSettings('../4'));assert.throws(()=>accountSettings('4'));
});
test('account routing never falls back to another credential',()=>{
  const config={accounts:{1:{token:'a'},2:{token:'b'},3:{token:'c'}}};
  assert.equal(selectCredentials(config,{account:2}).token,'b');
  assert.equal(selectCredentials(config,{account:3}).token,'c');
  assert.throws(()=>selectCredentials({token:'a'},{account:2}));
  assert.throws(()=>selectCredentials(config,{account:4}));
});
