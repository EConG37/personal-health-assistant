// A tray panel yields to other windows; it stays alive for reminders and sync.
const {spawn}=require('node:child_process');
const path=require('node:path');
function attachPanelLifecycle(win,{enabled=()=>true,delay=120}={}){
 let timer=null,nativeInactive=false,observer=null,lastHideReason='';
 const clear=()=>{if(timer)clearTimeout(timer);timer=null;};
 const shouldHide=()=>enabled()&&!win.isDestroyed()&&win.isVisible()&&(nativeInactive||!win.isFocused())&&!win.webContents.isDevToolsOpened()&&!win.getChildWindows().some(child=>!child.isDestroyed()&&child.isVisible()&&child.isFocused());
 const schedule=()=>{clear();if(enabled())timer=setTimeout(()=>{timer=null;if(shouldHide()){lastHideReason='focus';win.hide();}},delay);};
 const focus=()=>{nativeInactive=false;clear();};
 const stopObserver=()=>{if(observer){observer.kill();observer=null;}};
 const watch=()=>{
  stopObserver();if(process.platform!=='win32'||!enabled()||win.isDestroyed()||!win.isVisible())return;
  const handle=win.getNativeWindowHandle(),number=handle.length===8?handle.readBigUInt64LE(0):BigInt(handle.readUInt32LE(0));
  const executable=path.join(__dirname,'native','PanelFocusObserver.exe').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
  const current=spawn(executable,[number.toString()],{windowsHide:true,stdio:['ignore','pipe','ignore']});observer=current;
  current.on('error',()=>{if(observer===current)observer=null;});
  let pending='';current.stdout.on('data',chunk=>{pending+=chunk.toString();const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(line.trim()==='outside'&&observer===current&&enabled()&&!win.isDestroyed()&&win.isVisible()&&!win.webContents.isDevToolsOpened()){clear();lastHideReason='windows-outside';win.hide();}});
 };
 const show=()=>{nativeInactive=false;lastHideReason='';schedule();};
 win.on('blur',schedule);win.on('focus',focus);win.on('show',show);win.on('hide',()=>{focus();stopObserver();});
 // Windows desktop activation is also handled when Chromium misses a blur event.
 if(process.platform==='win32'){
  win.hookWindowMessage(0x001C,wParam=>{nativeInactive=wParam.readUInt32LE(0)===0;if(nativeInactive)schedule();else clear();});
 }
 win.once('closed',()=>{clear();stopObserver();});
 return {cancel:focus,watch,status:()=>({observerAlive:!!observer&&observer.exitCode===null,lastHideReason})};
}
module.exports={attachPanelLifecycle};
