const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store,todayKey}=require('../core/store');
const {waterStatus}=require('../core/rules');
const {FOODS}=require('../core/foods');
const {exclusionReason}=require('../core/profile');
const {buildMealDeck,activeChoices,takeawayBrief,foodProfileKey}=require('../core/meal-deck');
const {FeishuSync,mergeDay}=require('../core/sync');
const {CredentialVault,FeishuAppTransport,parseBaseUrl}=require('../core/feishu-app');
async function run(){
 let count=0;const check=async(name,fn)=>{await fn();count++;console.log('ok '+name);};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'health-cards-')),file=path.join(dir,'data.json'),store=new Store(file);
 await check('杯量校验、长期保存与剩余杯数',()=>{
  store.setProfile({cupMl:500,targetWaterMl:2500});assert.equal(new Store(file).profile.cupMl,500);assert.equal(waterStatus({profile:store.profile,day:store.today()}).cupsLeft,5);
  for(const cupMl of [0,49,2001,300.5,NaN])assert.throws(()=>store.setProfile({cupMl}));
  const key=foodProfileKey(store.profile);store.setProfile({cupMl:300});assert.equal(foodProfileKey(store.profile),key);
 });
 store.setProfile({goals:['uric','glucose'],allergies:['milk'],dislikedFoods:['egg'],favoriteFoods:['tofu']});let chosen;
 await check('三餐各九份不同搭配，同日稳定、换牌变化且遵守禁忌',()=>{
  for(const slot of ['breakfast','lunch','dinner']){
   const a=buildMealDeck({profile:store.profile,slot,date:'2026-10-30'});assert.equal(a.cards.length,9);assert.equal(new Set(a.cards.map(c=>c.id)).size,9);assert.deepEqual(a,buildMealDeck({profile:store.profile,slot,date:'2026-10-30'}));assert.notDeepEqual(a.cards,buildMealDeck({profile:store.profile,slot,date:'2026-10-30',nonce:1}).cards);
   for(const c of a.cards)for(const i of c.items)assert.equal(exclusionReason(FOODS.find(f=>f.id===i.foodId),store.profile),'');if(slot==='lunch')chosen=a.cards[0];
  }
 });
 await check('翻牌、确认分别持久化，换牌保留选择，保存失败回退',()=>{
  store.setCardState('lunch',{revealed:[chosen.id]});assert.equal(store.today().mealChoices,undefined);store.chooseMeal('lunch',chosen);
  const restored=new Store(file);assert.equal(restored.today().mealChoices.lunch.id,chosen.id);assert.deepEqual(restored.today().cardState.lunch.revealed,[chosen.id]);assert.equal(restored.today().meals.length,0);
  const before=JSON.stringify(store.data),rename=fs.renameSync;fs.renameSync=()=>{throw Error('disk');};try{assert.throws(()=>store.setCardState('lunch',{nonce:7}));assert.equal(JSON.stringify(store.data),before);}finally{fs.renameSync=rename;}
  store.setCardState('lunch',{nonce:1,revealed:[]});assert.equal(store.today().mealChoices.lunch.id,chosen.id);
 });
 await check('按餐次合并最新选择与翻牌状态，重复合并幂等',()=>{
  const a={mealChoices:{lunch:{id:'a',updatedAt:100}},cardState:{lunch:{nonce:1,updatedAt:300}}},b={mealChoices:{lunch:{id:'b',updatedAt:200},dinner:{id:'d',updatedAt:150}},cardState:{lunch:{nonce:2,updatedAt:200}}};
  const merged=mergeDay(a,b);assert.equal(merged.mealChoices.lunch.id,'b');assert.equal(merged.mealChoices.dinner.id,'d');assert.equal(merged.cardState.lunch.nonce,1);assert.deepEqual(mergeDay(merged,b),merged);
 });
 await check('外卖需求来自确认搭配，带预算与忌口；特殊情况及失效选择受限',()=>{
  const text=takeawayBrief({profile:store.profile,day:store.today(),slots:['lunch'],budget:42,location:'测试区域',notes:'不要香菜'});for(const i of chosen.items)assert(text.includes(i.dishName||i.name));for(const t of ['42 元','测试区域','不要香菜','过敏原','不要加入','由我确认订单与支付'])assert(text.includes(t));
  assert.throws(()=>takeawayBrief({profile:store.profile,day:store.today(),slots:['dinner']}));assert.throws(()=>takeawayBrief({profile:store.profile,day:store.today(),slots:['lunch'],budget:0}));assert(!text.includes('uricAcid'));
  assert.equal(buildMealDeck({profile:{...store.profile,conditions:['heart']}}).paused,true);assert.equal(Object.keys(activeChoices(store.today(),{...store.profile,dislikedFoods:chosen.items.map(i=>i.foodId)})).length,0);
 });
 await check('表格链接拒绝外部网址，凭据单独加密且禁止明文降级',()=>{
  assert.equal(parseBaseUrl('https://test.feishu.cn/base/ABCDEFGHIJKLMNO?table=tbl123').baseToken,'ABCDEFGHIJKLMNO');for(const value of ['https://feishu.cn.evil.example/base/ABCDEFGHIJKLMNO','http://test.feishu.cn/base/ABCDEFGHIJKLMNO','https://test.feishu.cn/wiki/ABCDEFGHIJKLMNO'])assert.throws(()=>parseBaseUrl(value));
  const codec={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).map(v=>v^37),decryptString:b=>Buffer.from(b).map(v=>v^37).toString()},secret={appId:'cli_test',appSecret:'test-secret-987'},v=new CredentialVault(path.join(dir,'credential.enc'),codec);
  v.save(secret);assert.deepEqual(v.read(),secret);assert(!fs.readFileSync(v.file).includes(secret.appSecret));assert.throws(()=>new CredentialVault(path.join(dir,'denied.enc'),{isEncryptionAvailable:()=>false}).save(secret));assert(!fs.readFileSync(file,'utf8').includes(secret.appSecret));
 });
 await check('自有应用无需CLI完成建表、令牌缓存、富文本读回与幂等同步',async()=>{
  const nativeStore=new Store(path.join(dir,'native.json'));nativeStore.setProfile({cupMl:350});nativeStore.setCardState('lunch',{revealed:[chosen.id]});nativeStore.chooseMeal('lunch',chosen);nativeStore.data.sync={provider:'app',identity:'bot',baseToken:'ABCDEFGHIJKLMNO',tableId:'',enabled:false,permissionGrant:{existingUserBase:true}};
  let tokenCalls=0,tableCreated=0,writes=0;const rows=[];
  const fetchImpl=async(url,options)=>{
   assert.equal(url.origin,'https://open.feishu.cn');let data={};const body=options.body?JSON.parse(options.body):{};
   if(url.pathname.endsWith('/auth/v3/tenant_access_token/internal')){tokenCalls++;assert.equal(body.app_secret,'test-secret');return {ok:true,json:async()=>({code:0,tenant_access_token:'token',expire:7200})};}
   assert.equal(options.headers.Authorization,'Bearer token');assert(!url.href.includes('test-secret'));
   if(url.pathname.endsWith('/application/v6/scopes'))data={scopes:[{scope_name:'bitable:app',grant_status:1}]};
   else if(url.pathname.endsWith('/tables')&&options.method==='GET')data={items:tableCreated?[{table_id:'tblTest',name:'每日健康记录'}]:[],has_more:false};
   else if(url.pathname.endsWith('/tables')&&options.method==='POST'){tableCreated++;assert.equal(body.table.fields.length,10);assert.equal(body.table.fields[0].type,1);data={table_id:'tblTest'};}
   else if(url.pathname.endsWith('/records'))data={items:rows.map(r=>({record_id:r.record_id,fields:Object.fromEntries(Object.entries(r.fields).map(([k,v])=>[k,typeof v==='string'?[{type:'text',text:v}]:v]))})),has_more:false};
   else if(url.pathname.endsWith('/batch_create')){writes+=body.records.length;for(const row of body.records)rows.push({record_id:'rec'+rows.length,fields:row.fields});data={records:rows};}
   else if(url.pathname.endsWith('/batch_update')){writes+=body.records.length;for(const r of body.records)rows.find(v=>v.record_id===r.record_id).fields=r.fields;data={records:body.records};}
   else throw Error('Unexpected request '+url.pathname);return {ok:true,json:async()=>({code:0,data})};
  };
  const sync=new FeishuSync(nativeStore,{credentials:{appId:'cli_test',appSecret:'test-secret'},fetchImpl});await sync.create();assert.equal(sync.error,'');assert.equal(rows.length,2);assert.equal(tokenCalls,1);assert.equal(tableCreated,1);const firstWrites=writes;await sync.sync();assert.equal(sync.error,'');assert.equal(writes,firstWrites);assert(rows.some(r=>r.fields['记录键']==='day:'+todayKey()));assert(!JSON.stringify(sync.state()).includes('test-secret'));assert(!fs.readFileSync(nativeStore.filePath,'utf8').includes('test-secret'));
 });
 await check('自有连接完整分页和断网提示，不丢本地数据',async()=>{
  const base={filePath:file,data:{sync:{baseToken:'ABCDEFGHIJKLMNO',tableId:'tblTest'}}};let page=0;
  const transport=new FeishuAppTransport(base,{appId:'cli_test',appSecret:'test-secret'},{fetchImpl:async(url)=>({ok:true,json:async()=>url.pathname.includes('/auth/')?{code:0,tenant_access_token:'token'}:{code:0,data:++page===1?{items:[{record_id:'one',fields:{'记录键':[{text:'day:'},{text:'2026-10-30'}]}}],has_more:true,page_token:'page2'}:{items:[{record_id:'two',fields:{}}],has_more:false}}})});
  await transport.run(['base','+record-list','--output','pages.ndjson']);const lines=fs.readFileSync(path.join(dir,'pages.ndjson'),'utf8').trim().split('\n');assert.equal(lines.length,2);assert.equal(JSON.parse(lines[0])['记录键'],'day:2026-10-30');transport.fetch=async()=>{throw Error('network');};await assert.rejects(()=>transport.request('GET','/bitable/v1/apps/test'),/本机记录仍会保留/);
 });
 console.log(`Interactions PASS: ${count} groups. Isolated data and mocked cloud only.`);
}
run().catch(e=>{console.error(e);process.exitCode=1;});
