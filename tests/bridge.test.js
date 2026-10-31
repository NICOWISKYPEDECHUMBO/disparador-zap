const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBridge}=require('../bridge');
function fixture(options={}) {
  const requests=[]; let sent=0, failComplete=false;
  const job={id:'job-1',sender:'5511000000000',recipient:'5521000000000',message:'mock'};
  const bridge=createBridge({config:{url:'https://example.supabase.co',token:'test'},
    getSender:async()=>options.sender || job.sender, available:()=>true,
    send:async()=>{sent++;if(options.sendFails)throw Error('ambiguous');},
    report:()=>{},wait:async()=>{},
    fetchImpl:async(url,init)=>{
      const b=JSON.parse(init.body);requests.push(b);
      if(b.action==='complete' && options.failReceipt && !failComplete){failComplete=true;throw Error('network');}
      return {ok:true,json:async()=> b.action==='poll'?{job: options.forceJob || b.ready && !requests.some(x=>x.action==='complete')?job:null}:{ok:true}};
    }});
  return {bridge,requests,sent:()=>sent};
}
test('starts paused, advertises state without claiming work',async()=>{
  const f=fixture();await f.bridge.tick();assert.equal(f.sent(),0);assert.equal(f.requests[0].ready,false);
});
test('enabled sends and reports completion',async()=>{
  const f=fixture();f.bridge.enable();await f.bridge.tick();assert.equal(f.sent(),1);assert.equal(f.requests[1].status,'sent');
});
test('different sender cannot send even if server returns an old job',async()=>{
  const f=fixture({sender:'5531000000000',forceJob:true});f.bridge.enable();await f.bridge.tick();assert.equal(f.sent(),0);assert.equal(f.requests[1].status,'failed');
});
test('ambiguous send is reported uncertain without automatic resend',async()=>{
  const f=fixture({sendFails:true});f.bridge.enable();await f.bridge.tick();await f.bridge.tick();assert.equal(f.sent(),1);assert.equal(f.requests[1].status,'uncertain');
});
test('receipt network failure retries receipt, not the WhatsApp send',async()=>{
  const f=fixture({failReceipt:true});f.bridge.enable();await assert.rejects(f.bridge.tick());await f.bridge.tick();assert.equal(f.sent(),1);assert.equal(f.requests.filter(x=>x.action==='complete').length,2);
});
