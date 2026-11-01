// Explicit self-test always uses a fresh temporary user-data directory.
// No cloud login, real records, clipboard, orders, or external pages are used.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {execFile}=require('node:child_process');
module.exports=async function({win,store,buildState,vault,tray}){
 const wc=win.webContents,js=code=>wc.executeJavaScript(code,true);
 const wait=async expression=>{const until=Date.now()+10000;while(Date.now()<until){if(await js(expression))return;await new Promise(r=>setTimeout(r,60));}throw Error('self-test timeout');};
 await wait('!!document.querySelector("#profile-form")');
 assert.equal(store.profile.onboardingVersion,0);assert.equal(store.data.sync.enabled,false);
 assert.equal(store.data.sync.baseToken,'');assert.equal(vault.exists(),false);
 assert.equal(Object.values(store.data.days).reduce((n,d)=>n+(d.logs?.length||0)+(d.meals?.length||0),0),0);
 assert.equal(wc.getLastWebPreferences().sandbox,true);assert.equal(wc.getLastWebPreferences().nodeIntegration,false);
 await js('window.hh.setProfile({onboardingVersion:2}).then(s=>{state=s;render();})');
 await wait('!!document.querySelector(".ring-wrap")');
 await js('window.hh.addWater(250)');assert.equal(store.today().water,250);
 await js('window.hh.undoWater()');assert.equal(store.today().water,0);
 const state=buildState();assert.equal(state.deck.cards.length,9);
 const id=state.deck.cards[0].id;
 await js('window.hh.mealAction("reveal","lunch",'+JSON.stringify(id)+').then(s=>{state=s;})');
 await js('window.hh.mealAction("choose","lunch",'+JSON.stringify(id)+').then(s=>{state=s;})');
 assert.equal(buildState().mealSelection.count,1);
 await js('document.querySelector("nav [data-tab=plan]").click()');
 await js('document.querySelector("[data-act=view-choice]").click()');
 assert(await js('document.querySelectorAll(".guide-dish").length>0&&!document.querySelector(".qty,.stat-line")'));
 assert(await js('!!document.querySelector(".recipe-sources > summary")'));
 assert.equal(await js('typeof require'), 'undefined');
 assert.equal(tray.isDestroyed(),false);
 if(process.platform==='win32'){
  const helper=path.join(__dirname,'native','PanelFocusObserver.exe').replace(/([\\/])app\.asar([\\/])/,'$1app.asar.unpacked$2');
  assert(fs.existsSync(helper));
  await new Promise((resolve,reject)=>execFile(helper,['invalid'],{windowsHide:true,timeout:5000},error=>error?reject(error):resolve()));
 }
 // Decode shipped font/image files through the production renderer.
 const assets=await js('(async()=>{await document.fonts.ready;const urls=[...new Set([...document.querySelectorAll("[data-art-food],[data-art-recipe]")].flatMap(e=>[...getComputedStyle(e).backgroundImage.matchAll(/url\\("?([^"\\)]+)"?\\)/g)].map(m=>m[1])))];await Promise.all(urls.map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=src;})));return {images:urls.length,font:document.fonts.check("14px PuHui")};})()');
 assert(assets.images>0&&assets.font);
 return {ok:true,freshProfile:true,syncDisabled:true,noSavedCredentials:true,hydration:true,nineCards:true,recipeSources:true,sandbox:true,nativeHelper:process.platform==='win32'?true:null,assets:true,platform:process.platform,electron:process.versions.electron};
};
