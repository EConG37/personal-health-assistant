const assert=require('node:assert/strict'),fs=require('node:fs');
module.exports=async({win,store,js,wait,click,fill,shot})=>{
  const originalChoices=JSON.stringify(store.today().mealChoices),originalWater=store.today().water;
  await click('nav [data-tab=plan]');await click('.meal-record-entry [data-act=manual-meal]');
  assert(await js('document.querySelector("#manual-meal-dialog").matches(":modal")'));
  assert.equal(await js('document.activeElement.id'),'manual-meal-text');
  await fill('#manual-meal-text','今天吃了饺子、凉拌黄瓜');await shot('manual-meal-editor');
  await js('document.querySelector("nav button").focus()');assert(await js('document.querySelector("#manual-meal-dialog").contains(document.activeElement)'));
  await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait('!document.querySelector("#manual-meal-dialog").open');assert.equal(store.today().meals.length,1);
  await click('.meal-record-entry [data-act=manual-meal]');assert.equal(await js('document.querySelector("#manual-meal-text").value'),'今天吃了饺子、凉拌黄瓜');
  await fill('#manual-meal-text','   ');await click('#manual-meal-form [type=submit]');assert(await js('document.querySelector("#manual-meal-dialog").open'));assert.equal(store.today().meals.length,1);
  await fill('#manual-meal-text','饺子、凉拌黄瓜');
  const rename=fs.renameSync;fs.renameSync=()=>{throw Error('injected failure');};try{await click('#manual-meal-form [type=submit]');await wait('document.querySelector("#manual-meal-error").textContent.includes("保存失败")');assert.equal(await js('document.querySelector("#manual-meal-text").value'),'饺子、凉拌黄瓜');}finally{fs.renameSync=rename;}
  await click('#manual-meal-form [type=submit]');await wait('!document.querySelector("#manual-meal-dialog").open');assert.equal(store.today().meals.length,1);assert.equal(store.today().meals[0].source,'manual');assert.equal(store.today().meals[0].items[0].name,'饺子、凉拌黄瓜');assert.equal(JSON.stringify(store.today().mealChoices),originalChoices);
  await click('nav [data-tab=today]');assert(await js('document.querySelector(".meal-records").textContent.includes("饺子、凉拌黄瓜")'));await shot('manual-meal-saved');
  await click('.meal-record-entry [data-act=manual-meal]');await click('#manual-meal-form [value=snack]');await fill('#manual-meal-text','苹果、无糖酸奶');await click('#manual-meal-form [value=dinner]');await fill('#manual-meal-text','今晚准备的饭');await click('#manual-meal-form [value=snack]');assert.equal(await js('document.querySelector("#manual-meal-text").value'),'苹果、无糖酸奶');
  await fill('#manual-meal-text','<img src=x onerror=alert(1)>');await click('#manual-meal-form [type=submit]');await wait('!document.querySelector("#manual-meal-dialog").open');assert.equal(await js('document.querySelectorAll(".meal-records img").length'),0);assert(await js('document.querySelector(".meal-records").textContent.includes("<img src=x onerror=alert(1)>")'));
  await click('.meal-record-row [data-slot=snack]');await fill('#manual-meal-text','苹果、无糖酸奶');await click('#manual-meal-form [type=submit]');await wait('!document.querySelector("#manual-meal-dialog").open');
  await click('.meal-record-entry [data-act=manual-meal]');await click('#manual-meal-form [value=dinner]');win.setContentSize(360,680);await shot('manual-meal-360');win.webContents.setZoomFactor(2);await shot('manual-meal-zoom-200');assert(await js('(()=>{const d=document.querySelector("#manual-meal-dialog");return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().bottom<=innerHeight;})()'));
  await click('#manual-meal-form [command=close]');win.webContents.setZoomFactor(1);win.setContentSize(400,760);
  await win.webContents.reload();await wait('state?.today.meals.length===2');assert.equal(store.today().water,originalWater);assert.equal(JSON.stringify(store.today().mealChoices),originalChoices);
  console.log('Manual meals UI PASS: native dialog, focus/Esc, four slots and drafts, blank input, disk failure/retry, edit without duplicate, literal HTML, persisted records, font checks, 360px and 200% zoom.');
};
