// Run after the user has completed the Feishu device authorization.
const fs=require('node:fs');
const path=require('node:path');
const {Store}=require('../core/store');
const {FeishuSync}=require('../core/sync');

async function main(){
  if(!process.env.APPDATA)throw new Error('当前脚本面向 Windows 桌面数据目录');
  const dir=path.join(process.env.APPDATA,'uric-acid-companion');
  fs.mkdirSync(dir,{recursive:true});
  const store=new Store(path.join(dir,'data.json'));
  const identity=process.argv.includes('--existing-service')?'bot':undefined;
  const sync=new FeishuSync(store,{identity});
  const state=await sync.create();
  if(state.error)throw new Error(state.error);
  console.log(JSON.stringify({url:state.url,tableId:state.tableId,lastSuccess:state.lastSuccess,dataFile:store.filePath,identity:sync.identity,permissionGrant:store.data.sync.permissionGrant}));
}
main().catch(err=>{console.error(JSON.stringify({message:err.message,missingScopes:err.missingScopes || [],consoleUrl:err.consoleUrl || ''}));process.exitCode=1;});
