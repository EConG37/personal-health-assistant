// Scan only release payloads. Findings contain categories and relative paths,
// never the private values used as comparison fingerprints.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const sourceOnly=process.argv.includes('--source');
const arg=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:null;
const platform=arg('--platform')||'win32',version=require('../package.json').version;
const allowed=name=>name==='package.json'||/^core\/[^/]+\.js$/.test(name)||name==='core/data/guide-dishes.json'||/^desktop\/(main|preload|panel-lifecycle|tray-theme|release-check)\.js$/.test(name)||name==='desktop/native/PanelFocusObserver.exe'||/^desktop\/ui\/[^/]+\.(js|css|html)$/.test(name)||/^desktop\/ui\/assets\/[^/]+\.(png|webp)$/.test(name)||/^desktop\/ui\/fonts\/[^/]+\.ttf$/.test(name)||name==='desktop/ui/fonts/README.md';
const fingerprints=[];
function addPrivate(value,kind){if(typeof value==='string'&&value.length>=5)for(const encoding of ['utf8','utf16le'])fingerprints.push({kind,bytes:Buffer.from(value,encoding)});}
addPrivate(os.homedir(),'machine_home');addPrivate(process.env.USERNAME,'machine_username');addPrivate(root,'workspace_path');addPrivate(root.replace(/\\/g,'/'),'workspace_path');
const userDir=path.join(process.env.APPDATA||os.homedir(),'uric-acid-companion');
for(const name of ['data.json','feishu-credentials.enc']){
 const file=path.join(userDir,name);if(!fs.existsSync(file))continue;
 const bytes=fs.readFileSync(file);if(bytes.length>32)fingerprints.push({kind:name==='data.json'?'health_record_file':'encrypted_credential_file',bytes});
 if(name==='data.json'){
  const data=JSON.parse(bytes.toString('utf8'));
  const collect=(value,key='')=>{if(['provider','identity','permission'].includes(key))return;if(typeof value==='string'&&value.length>=8)addPrivate(value,'saved_connection_value');else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>collect(v,k));};
  collect(data.sync);addPrivate(data.profile?.clinicianNote,'clinician_note');
 }
}
const patterns=[
 ['private_key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['embedded_app_id',/cli_[A-Za-z0-9]{8,}/],
 ['embedded_user_id',/(?:ou_|on_)[a-z0-9]{20,}/],
 ['literal_secret',/(?:app_?secret|access_?token|refresh_?token|api_?key|password)\s*[=:]\s*["'][^"']{8,}["']/i],
 ['embedded_machine_path',/[A-Z]:[\\/](?:Users|code building)[\\/][^\s<>"']+/i]
];
const findings=[],manifest=[],artifacts=[];
function scan(name,bytes){
 if(!allowed(name))findings.push({file:name,kind:'unexpected_package_file'});
 for(const f of fingerprints)if(bytes.includes(f.bytes))findings.push({file:name,kind:f.kind});
 if(/\.(js|json|html|css|md|txt|svg)$/i.test(name))for(const [kind,regex]of patterns)if(regex.test(bytes.toString('utf8')))findings.push({file:name,kind});
 manifest.push({file:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
if(sourceOnly){
 const walk=(dir,relative='')=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const name=relative?relative+'/'+e.name:e.name;if(e.isDirectory())walk(path.join(dir,e.name),name);else if(allowed(name))scan(name,fs.readFileSync(path.join(dir,e.name)));}};
 for(const dir of ['core','desktop'])walk(path.join(root,dir),dir);
 scan('package.json',fs.readFileSync(path.join(root,'package.json')));
}else{
 const asar=require('@electron/asar'),archive=arg('--archive')?path.resolve(root,arg('--archive')):path.join(root,'dist/win-unpacked/resources/app.asar');
 if(!fs.existsSync(archive))throw Error('Build the Windows package before auditing it');
 for(const entry of asar.listPackage(archive)){
  const name=entry.replace(/^[/\\]+/,'').replace(/\\/g,'/'),nativeName=path.normalize(name),stat=asar.statFile(archive,nativeName);
  if(stat.files)continue;scan(name,asar.extractFile(archive,nativeName));
 }
 if(platform==='win32')for(const name of ['desktop/native/PanelFocusObserver.exe'])if(!fs.existsSync(path.join(archive+'.unpacked',name)))findings.push({file:name,kind:'native_helper_not_unpacked'});
 const pkg=JSON.parse(asar.extractFile(archive,'package.json'));
 if(Object.keys(pkg.dependencies||{}).length)throw Error('Runtime dependency review required');
 if(pkg.devDependencies)findings.push({file:'package.json',kind:'development_metadata_in_package'});
 for(const file of platform==='win32'?fs.readdirSync(path.join(root,'dist')).filter(n=>n.endsWith('.exe')&&n.includes('-'+version+'-')):[]){
  const bytes=fs.readFileSync(path.join(root,'dist',file));
  for(const f of fingerprints)if(bytes.includes(f.bytes))findings.push({file,kind:f.kind});
  artifacts.push({file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
}
const report={scope:sourceOnly?'selected_release_sources':'built_application_archive',ok:!findings.length,files:manifest.length,personalMatches:findings.length,findings,manifest,artifacts};
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist',sourceOnly?'privacy-source.json':platform==='darwin'?'privacy-mac.json':'privacy-package.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scope:report.scope,ok:report.ok,files:report.files,findings:report.findings}));
if(!report.ok)process.exitCode=1;
