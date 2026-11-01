const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function main(){
 const dir=path.join(__dirname,'../build/mac-runtime');fs.mkdirSync(dir,{recursive:true});
 const v=require('electron/package.json').version,checksums=require('electron/checksums.json');
 const tasks=['arm64','x64'].map(arch=>({file:'electron-v'+v+'-darwin-'+arch+'.zip',url:'https://npmmirror.com/mirrors/electron/'+v+'/electron-v'+v+'-darwin-'+arch+'.zip',sha:checksums['electron-v'+v+'-darwin-'+arch+'.zip']}));
 const base='https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign/0.29.0/',name='apple-codesign-0.29.0-x86_64-unknown-linux-musl.tar.gz';
 const response=await fetch(base+name+'.sha256',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Cannot read signing-tool checksum');
 const sum=await response.text();tasks.push({file:name,url:base+name,sha:sum.trim().split(/\s+/)[0]});
 await Promise.all(tasks.map(async t=>{
  const p=path.join(dir,t.file);if(fs.existsSync(p)&&crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')===t.sha)return;
  const r=await fetch(t.url,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error('HTTP '+r.status);
  const bytes=Buffer.from(await r.arrayBuffer());if(crypto.createHash('sha256').update(bytes).digest('hex')!==t.sha)throw Error('Checksum mismatch '+t.file);
  fs.writeFileSync(p,bytes);console.log(JSON.stringify({download:t.file,bytes:bytes.length,verified:true}));
 }));
 fs.writeFileSync(path.join(dir,'downloads.json'),JSON.stringify(tasks.map(({file,sha})=>({file,sha256:sha})),null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
