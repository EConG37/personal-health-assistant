const path=require('node:path');
// The portable wrapper extracts the app to a temporary folder. Autostart must
// refer to the original user-owned EXE, which survives closing the wrapper.
function loginItemOptions({platform=process.platform,isPackaged,portableExecutable,executable=process.execPath,appPath}={}){
 if(platform==='darwin')return {};
 const portable=isPackaged&&typeof portableExecutable==='string'&&path.isAbsolute(portableExecutable)&&/\.exe$/i.test(portableExecutable);
 if(isPackaged)return {path:portable?portableExecutable:executable,args:[]};
 // Electron alone shows its welcome screen. Windows also needs the absolute
 // application directory, quoted because the workspace can contain spaces.
 if(typeof appPath!=='string'||!path.isAbsolute(appPath))throw new Error('开发版自启需要有效的应用目录');
 return {path:executable,args:['"'+appPath+'"']};
}
module.exports={loginItemOptions};
