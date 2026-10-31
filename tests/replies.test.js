const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sendText,readReplies}=require('../whatsapp-ops');
const {createReplyMonitor}=require('../replies');
const sender='5511000000000';
function browser(WPP,fn,...args) {const ctx=vm.createContext({WPP,args});return vm.runInContext(`(${fn.toString()})(...args)`,ctx);}
test('saves only in WhatsApp before sending; preserves existing contacts',async()=>{
  const calls=[];let existing=false;
  const WPP={conn:{getMyUserId:()=>({_serialized:sender+'@c.us'})},contact:{queryExists:async()=>({wid:{_serialized:'5521000000000@c.us'}}),get:async()=>({isMyContact:existing}),save:async(id,name,opts)=>{assert.equal(opts.syncAddressBook,false);assert.equal(opts.syncAdressBook,false);calls.push('save');return {};}},chat:{sendTextMessage:async()=>calls.push('send')}};
  await browser(WPP,sendText,'5521000000000','test',sender,'Ana',true);
  assert.deepEqual(calls,['save','send']);existing=true;
  await browser(WPP,sendText,'5521000000000','test',sender,'Ana',true);
  assert.deepEqual(calls,['save','send','send']);
});
test('save failure prevents message and mismatched sender prevents contact mutation',async()=>{
  let sent=0,saved=0;
  const WPP={conn:{getMyUserId:()=>({_serialized:sender+'@c.us'})},contact:{queryExists:async()=>({wid:{_serialized:'5521000000000@c.us'}}),get:async()=>({}),save:async()=>{saved++;throw Error('unavailable');}},chat:{sendTextMessage:async()=>sent++}};
  await assert.rejects(browser(WPP,sendText,'5521000000000','test',sender,'Ana',true));assert.equal(sent,0);
  await assert.rejects(browser(WPP,sendText,'5521000000000','test','wrong','Ana',true));assert.equal(saved,1);
});
test('reads only incoming messages after campaign; media body is not copied',async()=>{
  const WPP={conn:{getMyUserId:()=>({_serialized:sender+'@c.us'})},chat:{getMessages:async()=>[
    {id:'false_a',t:100,type:'chat',body:'old'},
    {id:'true_b',t:300,type:'chat',body:'outgoing'},
    {id:{_serialized:'false_c',fromMe:false},t:300,type:'chat',body:'reply'},
    {id:'false_d',t:300,type:'image',body:'binary',caption:'caption'}
  ]}};
  const result=await browser(WPP,readReplies,{recipient:'5521000000000',since:new Date(200000).toISOString()},sender);
  assert.equal(result.replies.length,2);assert.equal(result.replies[1].text,'caption');
});
test('failed reply upload does not advance disk cursor; retry persists it',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zap-monitor-'));const file=path.join(dir,'cursor.json');
  let fail=true;const calls=[];
  const monitor=createReplyMonitor({file,getSender:async()=>sender,report:()=>{},read:async()=>({truncated:false,replies:[{message_id:'x',received_at:'2026-10-31T00:01:00Z',text:'a',type:'chat'}]}),api:async b=>{calls.push(b);if(b.action==='targets')return {targets:[{recipient:'5521000000000',since:'2026-10-31T00:00:00Z'}],truncated:false};if(b.action==='incoming'&&fail)throw Error('offline');return {};}});
  await assert.rejects(monitor.tick());assert.equal(fs.existsSync(file),false);fail=false;await monitor.tick();assert.equal(fs.existsSync(file),true);assert.equal(calls.at(-1).action,'monitor');
  fs.unlinkSync(file);fs.rmdirSync(dir);
});
