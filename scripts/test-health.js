const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Store,todayKey,defaultState}=require('../core/store');
const {buildDayPlan,planFoodIds}=require('../core/recommend');
const {FOODS}=require('../core/foods');
const {exclusionReason,validateProfile}=require('../core/profile');
const {waterStatus}=require('../core/rules');
const {FeishuSync,mergeDay,parseCliResult,cliFailure,REQUIRED_SERVICE_SCOPES,hash}=require('../core/sync');

async function run(){
  let cases=0;
  const check=(name,fn)=>{fn();cases++;console.log('ok '+name);};
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'health-v2-'));
  const file=path.join(dir,'data.json');
  check('连接工具从任一输出流返回的登录错误均可识别',()=>{
    const failure={ok:false,error:{message:'用户尚未登录'}};
    assert.deepEqual(parseCliResult(JSON.stringify(failure),''),failure);
    assert.deepEqual(parseCliResult('','提示\n'+JSON.stringify(failure)),failure);
    assert.equal(parseCliResult('not json',''),null);
    const denied=cliFailure({error:{subtype:'app_scope_not_applied',missing_scopes:['base:app:create'],console_url:'https://open.feishu.cn/page/scope-apply'}});
    assert(denied.message.includes('应用身份权限'));
    assert.equal(denied.consoleUrl,'https://open.feishu.cn/page/scope-apply');
  });
  const store=new Store(file);
  store.addWater(250);
  store.setProfile({goals:['uric','glucose'],favoriteFoods:['tofu'],dislikedFoods:['egg'],allergies:['milk'],onboardingVersion:2});
  check('目标、喜好与引导完成状态重启读回',()=>assert.deepEqual(new Store(file).profile,store.profile));
  check('多目标、过敏与不喜欢在所有换餐中均生效',()=>{
    for(let nonce=0;nonce<12;nonce++){
      const p=buildDayPlan({date:'2026-10-30',nonce,profile:store.profile});
      for(const id of planFoodIds(p))assert.equal(exclusionReason(FOODS.find(f=>f.id===id),store.profile),'');
      assert(!planFoodIds(p).includes('egg_white'));
      if(p.totalPurineMg>p.budget){assert.equal(p.ok,false);assert(p.warnings.some(w=>w.includes('嘌呤参考线')));}
      assert(!/purineMg|proteinG|grams/.test(JSON.stringify(p)));
    }
  });
  check('同日稳定、换餐改变、纯素不漏动物来源',()=>{
    const p={...store.profile,diet:'vegan',goals:['glucose','lipids']};
    const a=buildDayPlan({profile:p,nonce:0});
    assert.deepEqual(a,buildDayPlan({profile:p,nonce:0}));
    assert.notDeepEqual(a.meals,buildDayPlan({profile:p,nonce:1}).meals);
    for(const id of planFoodIds(a))assert.equal(exclusionReason(FOODS.find(f=>f.id===id),p),'');
    assert.equal('budget' in a,false);
  });
  check('过敏优先于喜欢，极端限制返回不足提示',()=>{
    const p={...store.profile,favoriteFoods:['egg'],allergies:['egg','milk','soy','nuts','fish','shellfish'],diet:'vegan'};
    const plan=buildDayPlan({profile:p});assert(plan.favoriteConflicts.length);assert(plan.warnings.length);assert.equal(plan.ok,false);
  });
  check('特殊人群暂停通用配餐，未确认水量不催促或误判达标',()=>{
    store.setProfile({conditions:['heart'],targetWaterMl:null});
    assert.equal(buildDayPlan({profile:store.profile}).paused,true);
    const s=waterStatus({profile:store.profile,day:store.today()});
    assert.equal(s.paused,true);assert.equal(s.due,false);assert.equal(s.goalMet,false);assert.equal(store.streak(),0);
    store.setProfile({targetWaterMl:1000});assert.equal(waterStatus({profile:store.profile,day:store.today()}).target,1000);
  });
  check('非法数字和时间不会进入存储',()=>{
    for(const patch of [{weightKg:NaN},{goals:[]},{wakeAt:'29:00'},{allergies:['unknown']},{targetWaterMl:-1}])assert.throws(()=>validateProfile(patch,store.profile));
    assert.throws(()=>store.addWater(-20));
  });
  check('夜班跨零点作息正确',()=>{
    const p={...defaultState().profile,wakeAt:'16:00',sleepAt:'08:00'};
    assert.equal(waterStatus({profile:p,day:{water:0},now:new Date(2026,9,30,1)}).inWindow,true);
    assert.equal(waterStatus({profile:p,day:{water:0},now:new Date(2026,9,30,12)}).inWindow,false);
  });
  check('旧数据保留并重新走新版引导',()=>{
    const oldFile=path.join(dir,'v1.json');fs.writeFileSync(oldFile,JSON.stringify({version:1,profile:{weightKg:80,onboarded:true},days:{'2026-10-29':{water:250,logs:[{ts:10,ml:250,type:'water'}],meals:[]}},weights:[]}));
    const s=new Store(oldFile);assert.equal(s.profile.onboardingVersion,0);assert.equal(s.data.days['2026-10-29'].water,250);
  });
  check('撤销墓碑阻止旧云端数据复活，合并操作幂等',()=>{
    const remote={logs:[{id:'a',ts:1,ml:250,type:'water'}],meals:[]};
    const local={logs:[],deletedLogIds:['a'],meals:[]};
    assert.equal(mergeDay(local,remote).water,0);assert.deepEqual(mergeDay(mergeDay(local,remote),remote),mergeDay(local,remote));
  });
  const guarded=new Store(path.join(dir,'guarded.json'));const guardedCalls=[];
  const guardedSync=new FeishuSync(guarded,{identity:'bot',run:async args=>{
    guardedCalls.push(args);
    return {ok:true,data:{scopes:REQUIRED_SERVICE_SCOPES.filter(s=>s!=='base:record:update').map(scope_name=>({scope_name,grant_status:1,scope_type:'tenant'}))}};
  }});
  await assert.rejects(guardedSync.create(),e=>e.missingScopes.includes('base:record:update'));
  check('服务写权限不足时在建表前停止，不产生部分资源',()=>assert(guardedCalls.every(a=>a[1]==='GET')));
  const resumeFile=path.join(dir,'resume.json');let createdBases=0,createdTables=0,tableExists=false;const resumeCalls=[];
  const resumeRun=async args=>{
    resumeCalls.push(args);
    if(args[0]==='api'&&args[1]==='GET')return {ok:true,data:{scopes:REQUIRED_SERVICE_SCOPES.map(scope_name=>({scope_name,grant_status:1,scope_type:'tenant'}))}};
    if(args[0]==='api'&&args[1]==='POST'&&args[2]==='/open-apis/base/v3/bases'){createdBases++;return {ok:true,data:{base_token:'base_resume'}};}
    if(args[1]==='+table-list')return {ok:true,data:{tables:tableExists?[{id:'tbl_resume',name:'每日健康记录'}]:[]}};
    if(args[0]==='api'&&args[1]==='POST'&&args[2].endsWith('/tables')){createdTables++;tableExists=true;throw new Error('表已创建但响应丢失');}
    if(args[0]==='auth')return {identities:{user:{openId:'ou_current_user'}}};
    if(args[0]==='drive')return {ok:true,data:{}};
    if(args[1]==='+record-list'){fs.writeFileSync(path.join(dir,args[args.indexOf('--output')+1]),'');return {ok:true,data:{has_more:false}};}
    if(args[1]==='+record-batch-create')return {ok:true,data:{}};
    throw new Error('Unexpected request: '+args.slice(0,3).join(' '));
  };
  await assert.rejects(new FeishuSync(new Store(resumeFile),{identity:'bot',run:resumeRun}).create());
  const resumed=new FeishuSync(new Store(resumeFile),{run:resumeRun});await resumed.create();
  check('建表中断后复用已保存的Base和数据表，保留服务身份且不请求删除',()=>{
    assert.equal(createdBases,1);assert.equal(createdTables,1);assert.equal(resumed.identity,'bot');assert.equal(resumed.state().error,'');
    assert(!resumeCalls.some(a=>a.includes('DELETE')));
    assert(resumeCalls.some(a=>a[0]==='drive'&&JSON.parse(a[a.indexOf('--data')+1]).member_id==='ou_current_user'));
  });
  const cloud=[];let offline=false,writeThenFail=false;let creates=0;
  const fake=async args=>{
    if(offline)throw new Error('模拟断网');
    if(args[0]==='api'&&args[1]==='POST'&&args[2]==='/open-apis/base/v3/bases'){creates++;return {ok:true,data:{base_token:'base_test'}};}
    if(args[1]==='+table-list')return {ok:true,data:{tables:[]}};
    if(args[0]==='api'&&args[1]==='POST'&&args[2].endsWith('/tables'))return {ok:true,data:{table_id:'tbl_test'}};
    const readFlag=k=>args[args.indexOf(k)+1];
    if(args[1]==='+record-list'){
      fs.writeFileSync(path.join(dir,readFlag('--output')),cloud.map(r=>JSON.stringify(r)).join('\n'));
      return {ok:true,data:{has_more:false}};
    }
    const body=JSON.parse(readFlag('--json'));
    if(args[1]==='+record-batch-create')for(const record of body.create_records)cloud.push({...record,record_id:'rec_'+cloud.length});
    else if(args[1]==='+record-batch-update')for(const [id,record] of Object.entries(body.update_records))Object.assign(cloud.find(r=>r.record_id===id),record);
    if(writeThenFail){writeThenFail=false;throw new Error('服务器已写入，响应丢失');}
    return {ok:true,data:{}};
  };
  store.setProfile({conditions:[],targetWaterMl:null});
  const sync=new FeishuSync(store,{run:fake});
  await sync.create();
  check('专用表一次创建，初始数据上传',()=>{assert.equal(creates,1);assert.equal(sync.state().error,'');assert.equal(cloud.length,2);});
  check('云端JSON的空白与字段排序不改变同步身份',()=>{
    assert.equal(hash({profile:{goals:['uric'],weight:70},weights:[]}),hash({weights:[],profile:{weight:70,goals:['uric']}}));
  });
  const today=cloud.find(r=>r['记录键']==='day:'+todayKey());
  today['手机补记ml']=300;await sync.sync();await sync.sync();
  check('手机补记多次同步不重复计入',()=>assert.equal(store.today().water,550));
  today['手机补记ml']=500;await sync.sync();
  check('手机补记修改为累计总量',()=>assert.equal(store.today().water,750));
  today['手机补记ml']=0;await sync.sync();
  check('手机清零可正确撤回补记',()=>assert.equal(store.today().water,250));
  offline=true;store.addWater(150);await sync.sync();
  check('断网保留本地记录与错误状态',()=>{assert.equal(store.today().water,400);assert(sync.state().error);});
  offline=false;await sync.sync();
  check('恢复网络后补传',()=>{assert.equal(sync.state().error,'');assert.equal(JSON.parse(today['数据JSON']).water,400);});
  const profileRow=cloud.find(r=>r['记录键']==='profile');
  const remoteProfile=JSON.parse(profileRow['数据JSON']);remoteProfile.profile.goals=['pressure'];profileRow['数据JSON']=JSON.stringify(remoteProfile);
  await sync.sync();
  check('另一端改变档案，本机未改时自动读入',()=>assert.deepEqual(store.profile.goals,['pressure']));
  store.setProfile({goals:['weight']});const conflict=JSON.parse(profileRow['数据JSON']);conflict.profile.goals=['lipids'];profileRow['数据JSON']=JSON.stringify(conflict);await sync.sync();
  check('两端同时改档案保留冲突版本',()=>{assert(sync.state().error.includes('冲突'));assert.deepEqual(store.profile.goals,['weight']);assert.deepEqual(JSON.parse(profileRow['数据JSON']).profile.goals,['lipids']);});
  await sync.sync({restoreProfile:true});
  check('用户选择云端档案后解决冲突',()=>{assert.equal(sync.state().error,'');assert.deepEqual(store.profile.goals,['lipids']);});
  store.day('2026-10-28').logs=[{id:'replay',type:'water',ml:100,ts:1}];store.day('2026-10-28').water=100;store.save();writeThenFail=true;await sync.sync();await sync.sync();
  check('服务端成功、响应丢失后重试不创建重复行',()=>assert.equal(cloud.filter(r=>r['记录键']==='day:2026-10-28').length,1));
  sync.disconnect();store.addWater(100);await sync.sync();
  check('停止同步后不再上传',()=>assert.notEqual(JSON.parse(today['数据JSON']).water,store.today().water));
  console.log(`Health v2 PASS: ${cases} groups.`);
}
run().catch(err=>{console.error(err);process.exitCode=1;});
