const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {trustedRenderer,externalUrlAllowed}=require('../core/security');
const entry=path.resolve(__dirname,'../desktop/ui/index.html');
const frame={url:pathToFileURL(entry).href},wc={mainFrame:frame,isDestroyed:()=>false};
assert(trustedRenderer({sender:wc,senderFrame:frame},wc,entry));
for(const event of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{url:frame.url}},{sender:wc,senderFrame:null}])assert.equal(trustedRenderer(event,wc,entry),false);
frame.url='https://evil.example';assert.equal(trustedRenderer({sender:wc,senderFrame:frame},wc,entry),false);
assert(externalUrlAllowed('https://company.feishu.cn/base/ABCDEFGHIJKLMNO',{kind:'base'}));
assert(externalUrlAllowed('https://accounts.feishu.cn/verify?code=example',{kind:'login'}));
for(const value of ['file:///C:/Windows/system32/calc.exe','javascript:alert(1)','https://company.feishu.cn.evil.example/base/ABCDEFGHIJKLMNO','https://user:password@company.feishu.cn/base/ABCDEFGHIJKLMNO','https://company.feishu.cn:9443/base/ABCDEFGHIJKLMNO']){
 assert.equal(externalUrlAllowed(value,{kind:'base'}),false);assert.equal(externalUrlAllowed(value,{kind:'login'}),false);
}
const defaults=require('../core/store').defaultState();
assert.equal(defaults.sync.enabled,false);assert.equal(defaults.sync.baseToken,'');assert.equal(defaults.profile.clinicianNote,'');assert.deepEqual(defaults.days,{});
const preload=fs.readFileSync(path.join(__dirname,'../desktop/preload.js'),'utf8');assert(!preload.includes('appSecret'));assert(!preload.includes('send:'));
const {loginItemOptions}=require('../core/launch');
assert.deepEqual(loginItemOptions({platform:'win32',isPackaged:true,portableExecutable:path.resolve('portable.exe')}),{path:path.resolve('portable.exe'),args:[]});
assert.deepEqual(loginItemOptions({platform:'win32',isPackaged:false,portableExecutable:path.resolve('portable.exe'),appPath:path.resolve('app with spaces')}),{path:process.execPath,args:['"'+path.resolve('app with spaces')+'"']});
assert.deepEqual(loginItemOptions({platform:'win32',isPackaged:true,portableExecutable:'relative.exe'}),{path:process.execPath,args:[]});
assert.deepEqual(loginItemOptions({platform:'win32',isPackaged:true,executable:path.resolve('HealthCompanion.exe')}),{path:path.resolve('HealthCompanion.exe'),args:[]});
assert.throws(()=>loginItemOptions({platform:'win32',isPackaged:false}),/应用目录/);
console.log('Security PASS: only local main-frame IPC, trusted external addresses, fresh data, sync off, credentials not exposed through preload.');

assert.deepEqual(loginItemOptions({platform:"darwin",isPackaged:true}),{});
assert.deepEqual(loginItemOptions({platform:"darwin",isPackaged:false}),{});
