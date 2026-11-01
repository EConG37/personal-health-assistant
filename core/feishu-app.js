const fs=require('node:fs');
const path=require('node:path');

function parseBaseUrl(value){
 let url;try{url=new URL(value);}catch{throw new Error('请粘贴飞书多维表格的完整链接');}
 if(url.protocol!=='https:'||!/(^|\.)feishu\.cn$/.test(url.hostname))throw new Error('请使用 https://…feishu.cn/base/… 格式的表格链接');
 const token=/^\/base\/([A-Za-z0-9]{10,100})(?:\/|$)/.exec(url.pathname)?.[1];
 if(!token)throw new Error('请使用多维表格本身的 /base/ 链接；知识库链接请先打开原表格再复制');
 return {baseToken:token,url:`${url.origin}/base/${token}`,tableId:url.searchParams.get('table')||''};
}
class CredentialVault{
 constructor(file,codec){this.file=file;this.codec=codec;}
 read(){if(!fs.existsSync(this.file))return null;try{return JSON.parse(this.codec.decryptString(fs.readFileSync(this.file)));}catch{throw new Error('无法读取已保存的飞书凭据，请重新填写连接信息');}}
 save(value){if(!this.codec.isEncryptionAvailable())throw new Error('系统安全存储暂不可用，无法保存应用密钥');fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,this.codec.encryptString(JSON.stringify(value)));fs.renameSync(tmp,this.file);}
 exists(){return fs.existsSync(this.file);}
}
class FeishuAppTransport{
 constructor(store,credentials,{fetchImpl=globalThis.fetch}={}){this.store=store;this.credentials=credentials;this.fetch=fetchImpl;this.token=null;}
 async request(method,endpoint,body,params={},authenticated=true){
  if(!this.credentials?.appId||!this.credentials?.appSecret)throw new Error('请先填写你自己的飞书 App ID 和 App Secret');
  if(authenticated&&(!this.token||this.token.until<Date.now())){
   const d=await this.request('POST','/auth/v3/tenant_access_token/internal',{app_id:this.credentials.appId,app_secret:this.credentials.appSecret},{},false);
   if(!d.tenant_access_token)throw new Error('飞书未返回有效登录凭据，请核对 App ID 和密钥');
   this.token={value:d.tenant_access_token,until:Date.now()+Math.max(0,(d.expire||3600)-60)*1000};
  }
  const url=new URL('https://open.feishu.cn/open-apis'+endpoint);for(const [k,v] of Object.entries(params))if(v!=null&&v!=='')url.searchParams.set(k,String(v));
  let response;try{response=await this.fetch(url,{method,headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+this.token.value}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});}catch{throw new Error('无法连接飞书，请检查网络后重试；本机记录仍会保留');}
  let d;try{d=await response.json();}catch{throw new Error('飞书返回了无法识别的响应');}
  if(!response.ok||d.code!==0)throw new Error(`飞书连接失败：${d.msg||'请检查应用权限和表格协作者设置'}`);
  return authenticated?(d.data||{}):d;
 }
 async run(args){
  const flag=name=>args[args.indexOf(name)+1];const token=this.store.data.sync.baseToken;const table=this.store.data.sync.tableId;
  const root=`/bitable/v1/apps/${token}`;const tableRoot=`${root}/tables/${table}`;
  if(args[0]==='api'&&args[1]==='GET'&&args[2]==='/open-apis/application/v6/scopes')return {ok:true,data:await this.request('GET','/application/v6/scopes')};
  if(args[1]==='+table-list'){
   const tables=[];let pageToken='';
   do{const d=await this.request('GET',`${root}/tables`,null,{page_size:100,page_token:pageToken});tables.push(...(d.items||[]));if(d.has_more&&(!d.page_token||d.page_token===pageToken))throw new Error('飞书分页未完整返回，已停止同步');pageToken=d.has_more?d.page_token:'';}while(pageToken);
   return {ok:true,data:{tables}};
  }
  if(args[0]==='api'&&args[1]==='POST'&&args[2].endsWith('/tables')){
   const body=JSON.parse(flag('--data'));const fields=body.fields.map(f=>({field_name:f.name,type:f.type==='number'?2:1}));
   const d=await this.request('POST',`${root}/tables`,{table:{name:body.name,fields}});return {ok:true,data:{table_id:d.table_id}};
  }
  if(args[1]==='+record-list'){
   const rows=[];let pageToken='';
   do{const d=await this.request('GET',`${tableRoot}/records`,null,{page_size:500,page_token:pageToken});for(const row of d.items||[]){const fields=Object.fromEntries(Object.entries(row.fields||{}).map(([k,v])=>[k,Array.isArray(v)?v.map(t=>t.text||'').join(''):v]));rows.push({record_id:row.record_id,...fields});}if(d.has_more&&(!d.page_token||d.page_token===pageToken))throw new Error('飞书分页未完整返回，已停止同步');pageToken=d.has_more?d.page_token:'';}while(pageToken);
   fs.writeFileSync(path.join(path.dirname(this.store.filePath),flag('--output')),rows.map(r=>JSON.stringify(r)).join('\n'),'utf8');return {ok:true,data:{has_more:false}};
  }
  if(args[1]==='+record-batch-create'){const body=JSON.parse(flag('--json'));return {ok:true,data:await this.request('POST',`${tableRoot}/records/batch_create`,{records:body.create_records.map(fields=>({fields}))})};}
  if(args[1]==='+record-batch-update'){const body=JSON.parse(flag('--json'));return {ok:true,data:await this.request('POST',`${tableRoot}/records/batch_update`,{records:Object.entries(body.update_records).map(([record_id,fields])=>({record_id,fields}))})};}
  throw new Error('当前自有应用连接不支持该操作，请使用已有表格链接连接');
 }
}
module.exports={parseBaseUrl,CredentialVault,FeishuAppTransport};
