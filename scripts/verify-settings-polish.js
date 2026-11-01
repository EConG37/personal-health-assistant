const assert=require('node:assert/strict');
module.exports=async({win,store,js,wait,click,fill,shot})=>{
 const wc=win.webContents,records=JSON.stringify(store.data);
 await fill('#feishu-app-id','draft_before_guide');await fill('#feishu-app-secret','unsaved-draft-secret');
 await click('.sync-guide-entry [data-act=sync-guide]');
 assert.equal(await js('document.querySelector("#sync-guide").matches(":modal")'),true);
 assert.equal(await js('document.querySelector("#sync-guide").contains(document.activeElement)'),true);
 assert(await js(`document.querySelector('nav button').focus();document.querySelector('#sync-guide').contains(document.activeElement)`),'Native modal must keep focus inside');
 await click('[data-guide-mode=app]');await shot('guide-1-table');
 for(let i=1;i<4;i++){await click('[data-guide-next]');assert.equal(await js('document.querySelector(".guide-progress").textContent'),`${i+1} / 4`);await shot('guide-'+(i+1));}
 assert(await js('document.querySelector(".guide-body").innerText.includes("改成 500")'));
 assert.equal(JSON.stringify(store.data),records,'Reading a guide must not connect or write health data');
 await click('[data-guide-close]');assert.equal(await js('document.querySelector("#sync-guide").open'),false);
 assert.equal(await js('document.querySelector("#feishu-app-id").value'),'draft_before_guide');
 assert.equal(await js('document.querySelector("#feishu-app-secret").value'),'unsaved-draft-secret');
 await click('.sync-guide-entry [data-act=sync-guide]');
 await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await wait('!document.querySelector("#sync-guide").open');
 await click('.sync-guide-entry [data-act=sync-guide]');await click('[data-guide-mode=app]');await click('[data-guide-step="2"]');await click('[data-guide-connect]');
 assert.equal(await js('document.querySelector("#sync-guide").open'),false);assert.equal(await js('document.querySelector(".connection-editor").open'),true);
 assert.equal(await js('document.activeElement.id'),'feishu-app-id');assert.equal(await js('document.querySelector("#sync-form [name=syncProvider]:checked").value'),'app');
 // Check the other branch without requiring real CLI credentials or opening a browser.
 await click('.sync-guide-entry [data-act=sync-guide]');await click('[data-guide-mode=cli]');await click('[data-guide-step="2"]');await click('[data-guide-connect]');
 assert.equal(await js('document.activeElement.id'),'existing-base-url');assert.equal(await js('document.querySelector("#own-sync-fields").disabled'),true);
 await click('[name=syncProvider][value=app]');
 await js('document.querySelector("#cupMl").scrollIntoView({block:"center"});document.querySelector("#cupMl").focus();');
 const focused=await js(`(()=>{const css=getComputedStyle(document.querySelector('#cupMl'));return {outline:css.outlineStyle,border:css.borderColor,shadow:css.boxShadow};})()`);
 assert.equal(focused.outline,'none');assert.equal(focused.border,'rgb(118, 130, 123)');assert(focused.shadow.includes('inset'));
 await shot('cup-field-focus');
 await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
 assert.notEqual(await js('getComputedStyle(document.querySelector("#cupMl")).outlineStyle'),'none','High contrast must keep a visible focus indicator');
 await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 // Verify the guide remains usable at 200% without changing the native window bounds.
 wc.setZoomFactor(2);await click('.sync-guide-entry [data-act=sync-guide]');await click('[data-guide-mode=app]');await click('[data-guide-step="1"]');
 assert(await js(`(()=>{const d=document.querySelector('#sync-guide'),b=d.querySelector('.guide-body'),r=d.getBoundingClientRect(),f=d.querySelector('.guide-footer').getBoundingClientRect();b.scrollTop=b.scrollHeight;return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&f.bottom<=r.bottom&&b.scrollWidth<=b.clientWidth+1;})()`));
 await shot('guide-zoom-200');await click('[data-guide-close]');wc.setZoomFactor(1);
 assert.equal(JSON.stringify(store.data),records);
 console.log('Settings polish PASS: native four-step guide, app/CLI paths, draft preservation, no cloud writes, Esc/focus containment, quiet field focus and 200% layout.');
};
