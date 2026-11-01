const {execFile}=require('node:child_process');
// Windows taskbar color can differ from the app color. Read only that preference.
function taskbarTheme(fallback='light'){
 if(process.platform!=='win32')return Promise.resolve(fallback);
 return new Promise(resolve=>execFile('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize','/v','SystemUsesLightTheme'],{windowsHide:true,timeout:2000},(error,stdout)=>{
  const match=!error&&/SystemUsesLightTheme\s+REG_DWORD\s+0x([01])\b/i.exec(stdout);
  resolve(match?(match[1]==='0'?'dark':'light'):fallback);
 }));
}
module.exports={taskbarTheme};
