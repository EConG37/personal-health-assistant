const path=require('node:path');
const {flipFuses,FuseVersion,FuseV1Options,getCurrentFuseWire}=require('@electron/fuses');
async function main(){
 for(const arch of ['arm64','x64']){
  const file=path.join(__dirname,'../build/mac-runtime/framework-'+arch+'.bin');
  await flipFuses(file,{version:FuseVersion.V1,[FuseV1Options.RunAsNode]:false,[FuseV1Options.EnableNodeOptionsEnvironmentVariable]:false,[FuseV1Options.EnableNodeCliInspectArguments]:false,[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:true,[FuseV1Options.OnlyLoadAppFromAsar]:true});
  const wire=await getCurrentFuseWire(file);if(wire[0]!==48||wire[4]!==49||wire[5]!==49)throw Error('Fuse verification failed');
  console.log('Mac fuses verified: '+arch);
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
