const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process');
const root=path.join(__dirname,'..'),dir=path.join(root,'dist'),version=require('../package.json').version;
const hashFile=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const ownDir=path.join(process.env.APPDATA||os.homedir(),'uric-acid-companion');
const ownFiles=['data.json','feishu-credentials.enc'].map(n=>path.join(ownDir,n));
const before=ownFiles.map(hashFile);
const run=(file,args,timeout=60000)=>new Promise((resolve,reject)=>execFile(file,args,{cwd:root,windowsHide:true,timeout,maxBuffer:4*1024*1024},(error,stdout,stderr)=>error?reject(Object.assign(error,{stdout,stderr})):resolve({stdout,stderr})));
async function check(file){
 const previous=new Set(fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('health-release-check-')));
 const r=await run(file,['--self-test','--disable-gpu']);
 const line=r.stdout.split(/\r?\n/).find(s=>s.startsWith('[release-check] '));
 const reportFile=fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('health-release-check-')&&!previous.has(n)).map(n=>path.join(os.tmpdir(),n,'self-test-result.json')).find(p=>fs.existsSync(p));
 assert(reportFile,'Packaged self-test did not report its result');
 const result=JSON.parse(fs.readFileSync(reportFile,'utf8'));assert.equal(result.ok,true);
 if(line)assert.deepEqual(JSON.parse(line.slice('[release-check] '.length)),result);
 return result;
}
async function main(){
 const unpacked=await check(path.join(dir,'win-unpacked/HealthCompanion.exe'));
 const portable=fs.readdirSync(dir).find(n=>n.includes('免安装版')&&n.includes('-'+version+'-')&&n.endsWith('.exe'));assert(portable);
 const portableResult=await check(path.join(dir,portable));
 const installer=fs.readdirSync(dir).find(n=>n.includes('安装版')&&!n.includes('免安装版')&&n.includes('-'+version+'-')&&n.endsWith('.exe'));assert(installer);
 const cache=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/7zip@1.0.0');
 const archiver=path.join(cache,fs.readdirSync(cache,{recursive:true}).find(n=>n.endsWith('7za.exe')));
 const expected=hashFile(path.join(dir,'win-unpacked/resources/app.asar'));
 for(const artifact of [installer,portable]){
  const bytes=await new Promise((resolve,reject)=>execFile(archiver,['e','-so',path.join(dir,artifact),'resources\\app.asar'],{windowsHide:true,timeout:30000,maxBuffer:128*1024*1024,encoding:'buffer'},(error,stdout)=>error?reject(error):resolve(stdout)));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected,'EXE must contain the audited application archive');
 }
 assert.deepEqual(ownFiles.map(hashFile),before,'Self-tests must not change existing health records or credentials');
 const report={ok:true,unpacked,portable:portableResult,installerPayloadMatches:true,portablePayloadMatches:true,existingUserFilesUnchanged:true};
 fs.writeFileSync(path.join(dir,'release-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error.stdout||error.stderr||error.message);process.exitCode=1;});
