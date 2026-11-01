// Read back the connected real Base. Re-sync existing data only; add no fixtures.
const assert=require('node:assert/strict');
const path=require('node:path');
const {Store}=require('../core/store');
const {FeishuSync,FIELDS}=require('../core/sync');

async function main(){
 const store=new Store(path.join(process.env.APPDATA,'uric-acid-companion/data.json'));
 assert(store.data.sync.enabled,'飞书同步尚未启用');
 const sync=new FeishuSync(store);
 const before=await sync.rows();
 const profile=before.find(r=>r['记录键']==='profile');
 assert(profile,'云端缺少健康档案');
 assert.deepEqual(JSON.parse(profile['数据JSON']),{profile:store.profile,weights:store.data.weights});
 assert.equal(new Set(before.map(r=>r['记录键'])).size,before.length,'云端出现重复记录键');
 const schema=await sync.run([...sync.args('+field-list')]);
 const d=schema.data?.data || schema.data || schema;
 const fields=d.fields || d.items || [];
 const names=fields.map(f=>f.name || f.field_name);
 for(const f of FIELDS)assert(names.includes(f.name),`云端缺少字段：${f.name}`);
 let writes=0;const execute=sync.run;
 sync.run=async args=>{if(['+record-batch-create','+record-batch-update'].includes(args[1]))writes++;return execute(args);};
 const status=await sync.sync();assert.equal(status.error,'');assert.equal(writes,0,'相同数据同步不应重复写入');
 const after=await sync.rows();assert.equal(after.length,before.length);
 console.log(JSON.stringify({verified:true,url:sync.state().url,tableId:store.data.sync.tableId,records:after.length,fieldCount:names.length,profileReadback:true,duplicateRecords:false,unchangedSyncWrites:writes,userAccess:store.data.sync.permissionGrant,lastSuccess:sync.state().lastSuccess}));
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
