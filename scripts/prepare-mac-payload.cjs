const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const asar=require('@electron/asar');
async function main(){
 const root=path.join(__dirname,'..'),source=JSON.parse(fs.readFileSync(path.join(root,'dist/privacy-source.json'),'utf8'));
 if(!source.ok)throw Error('Privacy source audit must pass first');
 const stage=path.join(root,'build/mac-payload');fs.mkdirSync(stage,{recursive:true});
 for(const entry of source.manifest){
  if(entry.file==='desktop/native/PanelFocusObserver.exe')continue;
  const target=path.join(stage,entry.file);fs.mkdirSync(path.dirname(target),{recursive:true});
  if(entry.file==='package.json'){
   const {name,version,description,author,main,private:privatePackage}=require('../package.json');
   fs.writeFileSync(target,JSON.stringify({name,version,description,author,main,private:privatePackage,scripts:{}},null,2));
  }else fs.copyFileSync(path.join(root,entry.file),target);
 }
 const archive=path.join(root,'build/mac-app.asar');await asar.createPackage(stage,archive);
 const {headerString}=asar.getRawHeader(archive);
 fs.writeFileSync(path.join(root,'build/mac-asar-integrity.json'),JSON.stringify({algorithm:'SHA256',hash:crypto.createHash('sha256').update(headerString).digest('hex')}));
 console.log(JSON.stringify({macArchive:true,windowsHelperIncluded:false,files:asar.listPackage(archive).filter(n=>/\.[^\\/]+$/.test(n)).length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
