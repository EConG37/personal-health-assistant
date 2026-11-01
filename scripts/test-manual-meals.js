const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store,todayKey}=require('../core/store');
const {mealRevision}=require('../core/meals');
const {mergeDay,FeishuSync}=require('../core/sync');
const {computeIntake}=require('../core/rules');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'health-manual-meals-'));
const file=path.join(dir,'local.json'),store=new Store(file);
const save=(slot,text)=>store.logManualMeal({slot,text,expectedRevision:mealRevision(store.today().meals.find(m=>m.slot===slot))});
async function main(){
  for(const slot of ['breakfast','lunch','dinner','snack'])save(slot,slot==='lunch'?' 番茄炒蛋、米饭\r\n紫菜汤 ':'自己准备的一餐');
  assert.equal(store.today().meals.length,4);assert.equal(store.today().meals.find(m=>m.slot==='lunch').items[0].name,'番茄炒蛋、米饭\n紫菜汤');
  assert.deepEqual(new Store(file).today().meals,store.today().meals);
  assert.equal(store.today().meals[0].source,'manual');assert.equal(computeIntake(store.today().meals).mealCount,4);
  const lunch=structuredClone(store.today().meals.find(m=>m.slot==='lunch'));
  save('lunch','饺子、凉拌黄瓜');assert.equal(store.today().meals.length,4);assert.equal(store.today().meals.find(m=>m.slot==='lunch').ts,lunch.ts);assert(mealRevision(store.today().meals.find(m=>m.slot==='lunch'))>mealRevision(lunch));
  assert.throws(()=>store.logManualMeal({slot:'lunch',text:'旧窗口',expectedRevision:mealRevision(lunch)}),/记录已更新/);
  for(const value of ['', ' \n ', '饭'.repeat(301),null,{},'饭\0菜'])assert.throws(()=>save('lunch',value));
  for(const slot of ['all','__proto__','toString',null])assert.throws(()=>save(slot,'米饭'));
  assert.throws(()=>store.logManualMeal(null));assert.throws(()=>store.logManualMeal({slot:'lunch',text:'饭',date:'2000-01-01',expectedRevision:0}),/日期已变更/);
  const before=fs.readFileSync(file,'utf8'),previous=structuredClone(store.data),rename=fs.renameSync;
  fs.renameSync=()=>{throw Error('simulated disk failure');};try{assert.throws(()=>save('lunch','不能丢掉的输入'),/保存失败/);}finally{fs.renameSync=rename;}
  assert.deepEqual(store.data,previous);assert.equal(fs.readFileSync(file,'utf8'),before);
  save('snack','<img src=x onerror=alert(1)>');assert.equal(new Store(file).today().meals.find(m=>m.slot==='snack').items[0].name,'<img src=x onerror=alert(1)>');
  const old={slot:'lunch',source:'cards',ts:10,items:[{name:'旧搭配'}]},fresh={...old,source:'manual',updatedAt:20,items:[{name:'最新实际用餐'}]};
  assert.deepEqual(mergeDay({meals:[old]},{meals:[fresh]}).meals,[fresh]);assert.deepEqual(mergeDay({meals:[fresh]},{meals:[old]}).meals,[fresh]);
  assert.deepEqual(mergeDay(mergeDay({meals:[old]},{meals:[fresh]}),{meals:[old]}).meals,[fresh]);
  const rows=[];let writes=0,offline=false;
  const run=async args=>{
    if(offline)throw Error('模拟断网');
    const value=key=>args[args.indexOf(key)+1];
    if(args[1]==='+record-list'){fs.writeFileSync(path.join(dir,value('--output')),rows.map(r=>JSON.stringify(r)).join('\n'));return {ok:true,data:{has_more:false}};}
    const body=JSON.parse(value('--json'));
    if(args[1]==='+record-batch-create')for(const fields of body.create_records){rows.push({...fields,record_id:'rec_'+rows.length});writes++;}
    else if(args[1]==='+record-batch-update')for(const[id,fields]of Object.entries(body.update_records)){Object.assign(rows.find(r=>r.record_id===id),fields);writes++;}
    else throw Error('Unexpected mock call');return {ok:true,data:{}};
  };
  for(const s of [store]){Object.assign(s.data.sync,{enabled:true,baseToken:'base_test',tableId:'tbl_test'});s.save();}
  const cloudA=new FeishuSync(store,{run});await cloudA.sync();assert.equal(cloudA.error,'');assert(rows.find(r=>r['记录键']==='day:'+todayKey())['餐食'].includes('午餐：饺子、凉拌黄瓜'));const written=writes;await cloudA.sync();assert.equal(writes,written);
  const second=new Store(path.join(dir,'second.json'));Object.assign(second.data.sync,{enabled:true,baseToken:'base_test',tableId:'tbl_test'});second.save();const cloudB=new FeishuSync(second,{run});await cloudB.sync();
  assert.deepEqual(second.today().meals,store.today().meals);
  second.logManualMeal({slot:'lunch',text:'另一个设备修改的午餐',expectedRevision:mealRevision(second.today().meals.find(m=>m.slot==='lunch'))});await cloudB.sync();await cloudA.sync();assert.equal(store.today().meals.find(m=>m.slot==='lunch').items[0].name,'另一个设备修改的午餐');
  offline=true;save('lunch','断网时记录的午餐');await cloudA.sync();assert(cloudA.error);assert.equal(new Store(file).today().meals.find(m=>m.slot==='lunch').items[0].name,'断网时记录的午餐');
  offline=false;await cloudA.sync();await cloudB.sync();assert.equal(second.today().meals.find(m=>m.slot==='lunch').items[0].name,'断网时记录的午餐');
  console.log('Manual meals PASS: four slots, persistence, replacement, invalid/stale input, atomic failure recovery, literal text, latest-edit merge, mocked cloud round-trip, deduplication and offline retry.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
