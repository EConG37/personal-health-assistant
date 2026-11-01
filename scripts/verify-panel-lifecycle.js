const assert=require('node:assert/strict');
const {BrowserWindow}=require('electron');
const {execFile}=require('node:child_process');
module.exports=async({win,store,panel})=>{
 const waitFor=async predicate=>{const until=Date.now()+6000;while(Date.now()<until){if(predicate())return;await new Promise(r=>setTimeout(r,35));}throw Error('Panel visibility did not settle');};
 const water=store.today().water;
 const events=[];win.on('focus',()=>events.push('focus'));win.on('blur',()=>events.push('blur'));win.on('hide',()=>events.push('hide'));
 const other=new BrowserWindow({width:200,height:100,show:false,skipTaskbar:true,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 await other.loadURL('data:text/html,<title>Panel focus test</title>Outside window');
 panel.enable(true);
 try{
  for(let i=0;i<2;i++){
   panel.show();await waitFor(()=>win.isFocused()&&win.isVisible());
   if(process.platform==='win32')assert(panel.status().observerAlive,'Windows outside-click observer must be running');
   other.show();other.focus();await waitFor(()=>!win.isVisible());
   assert(!win.isDestroyed());assert(panel.trayAlive());
  }
  if(process.platform==='win32'){
   panel.show();await waitFor(()=>win.isVisible()&&win.isFocused());
   events.length=0;
   other.setAlwaysOnTop(true);other.showInactive();
   const handle=other.getNativeWindowHandle(),nativeHandle=handle.length===8?handle.readBigUInt64LE(0):BigInt(handle.readUInt32LE(0));
   const activateDesktop=`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Threading; public static class HealthDesktopTest { [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; } [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; } [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern IntPtr GetShellWindow(); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window); [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point); [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect); [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra); public static bool Click(IntPtr window) { SetProcessDPIAware(); Point old; Rect rect; GetCursorPos(out old); if(!GetWindowRect(window,out rect))return false; SetForegroundWindow(GetShellWindow()); SetCursorPos((rect.Left+rect.Right)/2,(rect.Top+rect.Bottom)/2); mouse_event(2,0,0,0,UIntPtr.Zero); Thread.Sleep(90); mouse_event(4,0,0,0,UIntPtr.Zero); Thread.Sleep(150); SetCursorPos(old.X,old.Y); return true; } }'; [HealthDesktopTest]::Click([IntPtr]::new(${nativeHandle.toString()}))`;
   const result=await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',activateDesktop],{windowsHide:true,timeout:9000},(error,stdout)=>error?reject(error):resolve(stdout.trim())));
   assert.equal(result,'True','The controlled external test window must receive a real native pointer click');
   await waitFor(()=>!win.isVisible());assert(panel.trayAlive());
   console.log('Native outside-click source '+panel.status().lastHideReason);
  }
  other.hide();panel.show();await waitFor(()=>win.isVisible()&&win.isFocused());
  win.webContents.sendInputEvent({type:'mouseDown',x:150,y:55,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',x:150,y:55,button:'left',clickCount:1});
  await new Promise(resolve=>setTimeout(resolve,250));
  assert(win.isVisible(),'An internal click must not close the panel');
  win.close();await waitFor(()=>!win.isVisible());assert(!win.isDestroyed());assert(panel.trayAlive());
  panel.show();await waitFor(()=>win.isVisible());assert.equal(store.today().water,water);
 }finally{panel.enable(false);other.destroy();}
 console.log('Panel PASS: immediate outside focus twice and a real native outside click hide the panel; internal click stays open; close hides, tray and records survive; reopen works.');
};
