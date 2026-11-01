// Credentials stay in OS-protected storage, never in health data or the renderer.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { validateProfile } = require('./profile');
const { FeishuAppTransport }=require('./feishu-app');
const {MEAL_SLOTS, mealRevision} = require('./meals');
const FIELDS = [
  ['记录键','text'],['类型','text'],['日期','text'],['饮水ml','number'],['目标ml','number'],
  ['体重kg','number'],['健康目标','text'],['餐食','text'],['手机补记ml','number'],['数据JSON','text']
].map(([name,type])=>({name,type}));
const REQUIRED_SERVICE_SCOPES=['base:app:create','base:app:read','base:table:create','base:table:read','base:field:create','base:field:read','base:record:read','base:record:create','base:record:update','docs:permission.member:create'];
function responseData(r) {return r.data?.data || r.data || r;}
function canonical(v) {
  if(Array.isArray(v)) return v.map(canonical);
  if(v && typeof v==='object') return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])]));
  return v;
}
function hash(v) {return crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');}
function parseCliResult(stdout,stderr) {
  for(const text of [stdout,stderr]) {
    const start=(text || '').indexOf('{');
    if(start<0) continue;
    try {return JSON.parse(text.slice(start));} catch (_) {}
  }
  return null;
}
function cliFailure(result) {
  const details=result.error || {};
  const scopes=details.missing_scopes || [];
  const message=details.subtype==='app_scope_not_applied'
    ? `当前飞书服务尚未开通所需的应用身份权限：${scopes.join('、')}。请在该服务的开发者后台开通后重试。`
    : details.message || '飞书操作未完成，请重新连接后重试';
  return Object.assign(new Error(message),{missingScopes:scopes,consoleUrl:details.console_url || ''});
}
function mergeDay(local={},remote={}) {
  const deletedLogIds=[...new Set([...(local.deletedLogIds||[]),...(remote.deletedLogIds||[])])];
  const logs=new Map();
  for(const log of [...(remote.logs||[]),...(local.logs||[])]) {
    if(log.type!=='water' || !Number.isFinite(log.ml) || log.ml<0 || log.ml>20000 || !Number.isFinite(log.ts)) continue;
    const id=log.id || `legacy:${log.ts}:${log.ml}`;
    if(!deletedLogIds.includes(id) && (!logs.has(id) || log.ts>=logs.get(id).ts)) logs.set(id,{...log,id});
  }
  const meals=new Map();
  for(const meal of [...(remote.meals||[]),...(local.meals||[])]) if(['breakfast','lunch','dinner','snack'].includes(meal.slot) && Array.isArray(meal.items)) {
    if (!meals.has(meal.slot) || mealRevision(meal) >= mealRevision(meals.get(meal.slot))) meals.set(meal.slot,meal);
  }
  const out={...remote,...local,logs:[...logs.values()].sort((a,b)=>a.ts-b.ts),meals:[...meals.values()],deletedLogIds};
  out.water=out.logs.reduce((s,l)=>s+l.ml,0);
  for(const key of ['mealChoices','cardState']){
    out[key]={...(remote[key]||{})};
    for(const [slot,value] of Object.entries(local[key]||{}))if(!out[key][slot]||(value.updatedAt||0)>=(out[key][slot].updatedAt||0))out[key][slot]=value;
  }
  return out;
}
class FeishuSync {
  constructor(store,{run,identity,credentials,fetchImpl}={}) {
    this.store=store;this.busy=false;this.error='';this.auth=null;
    this.identity=identity || store.data.sync.identity || 'user';
    if(!['user','bot'].includes(this.identity)) throw new Error('飞书连接身份无效');
    const candidates=[process.env.LARK_CLI_PATH,path.join(process.env.APPDATA||'', 'npm/node_modules/@larksuite/cli/bin/lark-cli.exe'),path.join(os.homedir(),'.local/bin/lark-cli')].filter(Boolean);
    this.binary=candidates.find(p=>fs.existsSync(p));
    const native=store.data.sync.provider==='app'?new FeishuAppTransport(store,credentials,{fetchImpl}):null;
    this.credentialsAvailable=!!credentials;
    this.run=run || (native?native.run.bind(native):(args)=>new Promise((resolve,reject)=>{
      if(!this.binary) return reject(new Error('未找到飞书连接工具，请先安装 lark-cli'));
      execFile(this.binary,args,{cwd:path.dirname(store.filePath),windowsHide:true,timeout:60000,maxBuffer:4*1024*1024,env:{...process.env,LARKSUITE_CLI_NO_UPDATE_NOTIFIER:'1',LARKSUITE_CLI_NO_SKILLS_NOTIFIER:'1'}},(err,stdout,stderr)=>{
        const result=parseCliResult(stdout,stderr);
        if(!result) return reject(new Error(err?'飞书连接失败，请检查网络与登录状态':'飞书返回格式无法识别'));
        if(err || result.ok===false) return reject(cliFailure(result));
        resolve(result);
      });
    }));
  }
  state() {const s=this.store.data.sync;return {enabled:s.enabled,provider:s.provider||'cli',identity:this.identity,appId:s.appId||'',hasSavedSecret:this.credentialsAvailable,baseToken:s.baseToken,tableId:s.tableId,url:s.url || (s.baseToken?`https://feishu.cn/base/${s.baseToken}`:''),lastSuccess:s.lastSuccess,busy:this.busy,error:this.error,available:s.provider==='app'?this.credentialsAvailable:!!this.binary,authPending:!!this.auth};}
  async startLogin() {
    const r=await this.run(['auth','login','--domain','base','--no-wait','--json']);
    const d=r.data || r;
    const url=d.verification_url || d.verification_uri_complete;
    if(!url || !d.device_code) throw new Error('未取得飞书登录链接');
    this.auth={code:d.device_code,url};
    return {url};
  }
  async finishLogin() {
    if(!this.auth) throw new Error('请先打开飞书登录链接');
    await this.run(['auth','login','--device-code',this.auth.code,'--json']);
    this.auth=null;
    this.identity='user';this.store.data.sync.identity='user';this.store.save();
    return this.create();
  }
  async create() {
    if(this.identity==='bot') {
      const result=responseData(await this.run(['api','GET','/open-apis/application/v6/scopes','--as','bot']));
      const granted=new Set((result.scopes||[]).filter(s=>(s.scope_type==='tenant'||!s.scope_type)&&s.grant_status===1).map(s=>s.scope_name));
      const required=REQUIRED_SERVICE_SCOPES.filter(s=>!(this.store.data.sync.baseToken&&s==='base:app:create')&&!(this.store.data.sync.permissionGrant&&s==='docs:permission.member:create'));
      const missing=granted.has('bitable:app')?[]:required.filter(s=>!granted.has(s));
      if(missing.length) throw Object.assign(new Error(`飞书服务仍缺少应用身份权限：${missing.join('、')}。已在建表前停止，不会重复创建。`),{missingScopes:missing});
    }
    let token=this.store.data.sync.baseToken;
    if(!token) {
      // The aggregate shortcut replaces/deletes its default table. Use the
      // documented create endpoint so this app never needs delete permission.
      const r=await this.run(['api','POST','/open-apis/base/v3/bases','--data',JSON.stringify({name:'个人健康助手',time_zone:'Asia/Singapore'}),'--as',this.identity]);
      const d=responseData(r);
      const base=d.base || d.app || d;
      token=base.base_token || base.app_token || base.token;
      if(!token) throw new Error('飞书已返回建表结果，但未识别表格编号，请勿重复新建');
      Object.assign(this.store.data.sync,{baseToken:token,url:base.url || '',tableId:'',identity:this.identity,enabled:false});this.store.save();
    }
    if(!this.store.data.sync.tableId) {
      const list=await this.run(['base','+table-list','--base-token',token,'--as',this.identity]);
      const data=responseData(list);
      const tables=data.items || data.tables || [];
      const found=tables.find(t=>t.name==='每日健康记录');
      if(found) this.store.data.sync.tableId=found.table_id || found.id;
      else {
        const r=await this.run(['api','POST',`/open-apis/base/v3/bases/${token}/tables`,'--data',JSON.stringify({name:'每日健康记录',fields:FIELDS}),'--as',this.identity]);
        const d=responseData(r);const table=d.table || d;
        this.store.data.sync.tableId=table.table_id || table.id || '';
      }
      this.store.save();
    }
    if(!this.store.data.sync.tableId) throw new Error('专用表格已创建，请重新连接以确认数据表');
    if(this.identity==='bot' && !this.store.data.sync.permissionGrant) {
      const auth=await this.run(['auth','status','--json']);
      const userId=auth.identities?.user?.openId;
      if(!userId) throw new Error('表格已创建，但未找到你的账户信息，暂未开启同步');
      await this.run(['drive','permission.members','create','--token',token,'--type','bitable','--data',JSON.stringify({member_type:'openid',member_id:userId,perm:'full_access'}),'--as','bot','--yes']);
      this.store.data.sync.permissionGrant={memberId:userId,permission:'full_access',granted:true};this.store.save();
    }
    this.store.data.sync.enabled=true;this.store.save();return this.sync();
  }
  args(command) {const s=this.store.data.sync;if(!s.baseToken || !s.tableId) throw new Error('请先连接专用表格');return ['base',command,'--base-token',s.baseToken,'--table-id',s.tableId,'--as',this.identity];}
  async rows() {
    const all=[];let offset=0;
    while(true) {
      const rel=`feishu-read-${crypto.randomUUID()}.ndjson`;
      const file=path.join(path.dirname(this.store.filePath),rel);
      let r;
      try {
        r=await this.run([...this.args('+record-list'),'--field-id','记录键','--field-id','数据JSON','--field-id','手机补记ml','--format','ndjson','--output',rel,'--limit','2000','--offset',String(offset)]);
        all.push(...fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l)));
      }
      finally {for(const p of [file,file.replace(/\.ndjson$/,'.manifest.json')]) if(fs.existsSync(p)) fs.unlinkSync(p);}
      const d=r.data || r;
      if(!d.has_more) return all;
      if(!Number.isInteger(d.next_offset) || d.next_offset<=offset) throw new Error('飞书分页未完整读取，已停止同步');
      offset=d.next_offset;
    }
  }
  async sync({restoreProfile=false}={}) {
    if(this.busy) return this.state();
    if(!this.store.data.sync.enabled) return this.state();
    this.busy=true;this.error='';
    try {
      const rows=await this.rows();
      const remote=new Map();
      let profileConflict=false;
      for(const row of rows) {
        const key=row['记录键']; if(!key) continue;
        if(remote.has(key)) throw new Error('飞书存在重复记录键，请先在表格中处理重复行');
        remote.set(key,row);
        let payload;try {payload=JSON.parse(row['数据JSON'] || '{}');} catch {throw new Error('飞书中的备份内容已被修改，无法安全读取');}
        if(key.startsWith('day:') && /^day:\d{4}-\d{2}-\d{2}$/.test(key) && payload.logs) {
          const date=key.slice(4);
          const phone=row['手机补记ml'] || 0;
          if(!Number.isFinite(phone) || phone<0 || phone>20000) throw new Error('手机补记量需要在 0–20000 ml 内');
          const id=`phone:${row.record_id}`;
          const prev=[...(payload.logs||[]),...(this.store.data.days[date]?.logs||[])].filter(l=>l.id===id).sort((a,b)=>b.ts-a.ts)[0];
          const phoneLog={id,type:'water',ml:phone,ts:prev?.ml===phone?prev.ts:Math.max(Date.now(),(prev?.ts||0)+1)};
          payload.logs=(payload.logs||[]).filter(l=>l.id!==id);
          if(phone>0 || prev) payload.logs.push(phoneLog);
          this.store.data.days[date]=mergeDay(this.store.data.days[date],payload);
        }
        const baseHash=this.store.data.sync.profileHash;
        const localHash=hash({profile:this.store.profile,weights:this.store.data.weights});
        const remoteHash=key==='profile'?hash(payload):null;
        const shouldPull=key==='profile' && payload.profile && (restoreProfile || (baseHash && localHash===baseHash && remoteHash!==baseHash));
        if(key==='profile' && payload.profile && !shouldPull && localHash!==remoteHash && (!baseHash || remoteHash!==baseHash)) profileConflict=true;
        if(shouldPull) {
          this.store.data.profile={...this.store.profile,...validateProfile(payload.profile,this.store.profile)};
          const weights=new Map([...(payload.weights||[]),...this.store.data.weights].filter(w=>/^\d{4}-\d{2}-\d{2}$/.test(w.date)&&Number.isFinite(w.kg)&&w.kg>=30&&w.kg<=250).map(w=>[w.date,w]));
          this.store.data.weights=[...weights.values()].sort((a,b)=>a.date.localeCompare(b.date));
        }
      }
      this.store.save(); // Persist merged events before any network write.
      const records=[['profile',{profile:this.store.profile,weights:this.store.data.weights}],...Object.entries(this.store.data.days).filter(([,d])=>d.logs?.length || d.meals?.length || d.deletedLogIds?.length || Object.keys(d.mealChoices||{}).length || Object.keys(d.cardState||{}).length).map(([date,d])=>{const normalized=mergeDay(d);this.store.data.days[date]=normalized;return [`day:${date}`,normalized];})];
      for(const [key,payload] of records) {
        const row=remote.get(key);
        if(key==='profile' && profileConflict) continue;
        const text=JSON.stringify(payload);
        if(row && hash(JSON.parse(row['数据JSON'] || '{}'))===hash(payload)) continue;
        const fields={'记录键':key,'类型':key==='profile'?'健康档案':'每日记录','日期':key.startsWith('day:')?key.slice(4):'','健康目标':this.store.profile.goals.join('、'),'数据JSON':text};
        if(key!=='profile') Object.assign(fields,{'饮水ml':payload.water||0,'目标ml':this.store.effectiveWaterTarget,'体重kg':payload.weightKg||this.store.profile.weightKg,'餐食':(payload.meals||[]).map(m=>(MEAL_SLOTS[m.slot]||'用餐')+'：'+m.items.map(i=>i.name || i.foodId).join('、')).join(' / ')});
        if(row) await this.run([...this.args('+record-batch-update'),'--json',JSON.stringify({update_records:{[row.record_id]:fields}})]);
        else await this.run([...this.args('+record-batch-create'),'--json',JSON.stringify({create_records:[fields]})]);
      }
      if(profileConflict) this.error='饮水已合并；两端健康档案存在冲突，已保留两端版本。请使用「从飞书恢复档案」选择云端版本。';
      else this.store.data.sync.profileHash=hash({profile:this.store.profile,weights:this.store.data.weights});
      this.store.data.sync.lastSuccess=new Date().toISOString(); this.store.save();
    } catch(err) {this.error=err.message;}
    finally {this.busy=false;}
    return this.state();
  }
  disconnect() {this.store.data.sync.enabled=false;this.store.save();this.error='';return this.state();}
}
module.exports={FeishuSync,mergeDay,FIELDS,hash,parseCliResult,cliFailure,REQUIRED_SERVICE_SCOPES};
