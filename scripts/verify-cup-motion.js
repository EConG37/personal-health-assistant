const assert=require('node:assert/strict');
module.exports=async function({win,store,js,wait,click,fill,shot,presentation}){
 const wc=win.webContents;
 const pointerClick=async selector=>{const point=await js(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:!!document.elementFromPoint(x,y)?.closest(${JSON.stringify(selector)})};})()`);assert(point.hit,'Visible pointer target must not be covered: '+selector);await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});};
 const waitNative=async fn=>{const until=Date.now()+9000;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,60));}throw Error('Native reminder state did not settle');};
 console.log('System reduced motion: '+presentation.systemReducedMotion());
 await click('nav [data-tab=settings]');await fill('#motionMode','full');await fill('#cupMl','300');await fill('#targetWaterMl','2500');await click('#settings-form [type=submit]');await wait('state.profile.motionMode==="full"&&state.profile.cupMl===300&&!busy');
 await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'no-preference'}]});
 assert.equal(await js('document.documentElement.dataset.motion'),'full','Full motion must override the reduced OS preference');
 await click('nav [data-tab=plan]');const nonce=await js('state.deck.nonce');await click('[data-act=shuffle-deck]');await wait(`state.deck.nonce===${nonce+1}&&!busy`);
 assert.notEqual(await js('getComputedStyle(document.querySelector(".flip-inner")).transitionDuration'),'0s');
 const card=await js('state.deck.cards[0].id');await click(`[data-card="${card}"]`);await wait(`state.deck.revealed.includes('${card}')&&!busy`);
 assert(await js(`document.querySelector('[data-card="${card}"] .flip-inner').getAnimations().some(a=>a.effect.getTiming().duration>=300)`),'A real flip transition must run when full motion is selected');
 await click('nav [data-tab=today]');assert.equal(await js('document.querySelector(".cup-editor,#cup-form")'),null);const before=await js('state.today.water');await pointerClick('[data-act=add-cup]');await wait(`state.today.water===${before+300}&&!busy`);
 assert(await js('document.querySelector(".hero-bottle").getAnimations().length>0'),'A real cup rebound must run');
 assert(await js('document.querySelector(".cup-liquid").getAnimations().length>0'),'A real water-level transition must run');
 await js('for(const element of [document.querySelector(".hero-bottle"),document.querySelector(".cup-liquid")])for(const a of element.getAnimations()){a.pause();a.currentTime=100;} window._cupBefore=waterPresentation();');
 const rapidBefore=store.today().water;await click('[data-act=add-cup]');await wait(`state.today.water===${rapidBefore+300}&&!busy`);
 assert(await js('Math.abs(parseFloat(document.querySelector(".cup-liquid").getAnimations()[0].effect.getKeyframes()[0].transform.match(/translateY\\(([-\\d.]+)/)[1])-window._cupBefore.y)<.1'),'Repeated clicks must continue from the visible water level');
 const desired=1250,remaining=desired-store.today().water;
 if(remaining>0){await js(`window.hh.addWater(${remaining}).then(s=>{state=s;render();})`);}
 assert.equal(store.today().water,1250);
 for(const [ml,shape] of [[250,'tumbler'],[300,'mug'],[500,'bottle']]){
  await click('nav [data-tab=settings]');await click(`[data-act=cup-preset][data-ml="${ml}"]`);await click('#settings-form [type=submit]');await wait(`state.profile.cupMl===${ml}&&!busy`);await click('nav [data-tab=today]');
  assert.equal(await js('document.querySelector(".hero-bottle").dataset.cupShape'),shape);assert.equal(await js('Number(document.querySelector(".hero-bottle").dataset.fillProgress)'),.5);await shot('cup-'+ml);
  assert.equal(await js('document.querySelector(".hero-bottle").dataset.artwork'),'b-frosted-tilted');
  assert.equal(await js('document.querySelector(".hero-bottle").dataset.tilt'),'10');
  assert.equal(await js('document.querySelector(".hero-bottle .cup-water-surface").getAttribute("cy")'),'0','The water surface stays horizontal while its container tilts');
 }
 while(store.today().water>0){const before=store.today().water;await click('[data-act=undo]');await wait(`state.today.water<${before}&&!busy`);}
 assert.equal(await js('document.querySelector(".hero-bottle").dataset.fillProgress'),'0');assert.equal(await js('document.querySelector(".hero-bottle .cup-liquid").style.opacity'),'0');await shot('cup-empty');
 for(let i=0;i<5;i++){const before=store.today().water;await click('[data-act=add-cup]');await wait(`state.today.water===${before+500}&&!busy`);}
 assert.equal(await js('document.querySelector(".hero-bottle").dataset.fillProgress'),'1');const fullY=await js('document.querySelector(".hero-bottle").dataset.waterY');await shot('cup-full');
 await click('[data-act=add-cup]');await wait('state.today.water===3000&&!busy');assert.equal(await js('document.querySelector(".hero-bottle").dataset.waterY'),fullY);
 await wc.reload();await wait('state?.profile.motionMode==="full"&&state.profile.cupMl===500');assert.equal(await js('document.documentElement.dataset.motion'),'full');
 await click('nav [data-tab=settings]');await click('[data-act=preview-reminder]');await wait('state.reminder?.preview&&!busy');
 assert(presentation.indicator().active&&presentation.indicator().animated);const firstLit=presentation.indicator().lit;await waitNative(()=>presentation.indicator().lit!==firstLit);assert.equal(await js('document.querySelectorAll(".reminder-dot").length'),1);await shot('reminder-full');
 await click('[data-act=quiet][data-min="15"]');await wait('!state.reminder.active&&!busy');assert.equal(presentation.indicator().active,false);assert.equal(await js('document.querySelector(".reminder-dot")'),null);
 await click('nav [data-tab=settings]');await click('[data-act=preview-reminder]');await wait('state.reminder?.preview&&!busy');await waitNative(()=>!presentation.indicator().active);await wait('!state.reminder.active');
 await click('nav [data-tab=settings]');await fill('#motionMode','reduced');await click('#settings-form [type=submit]');await wait('state.profile.motionMode==="reduced"&&!busy');
 await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await click('nav [data-tab=plan]');assert.equal(await js('getComputedStyle(document.querySelector(".flip-inner")).transitionDuration'),'0s');
 await click('nav [data-tab=settings]');await click('[data-act=preview-reminder]');await wait('state.reminder?.preview&&!busy');assert.equal(presentation.indicator().animated,false);assert.equal(await js('document.querySelector(".reminder-dot").getAnimations().length'),0);await click('[data-act=quiet][data-min="15"]');await wait('!busy');
 await click('nav [data-tab=settings]');await fill('#motionMode','system');await click('#settings-form [type=submit]');await wait('state.profile.motionMode==="system"&&!busy');assert.equal(await js('document.documentElement.dataset.motion'),'full');
 console.log('Cup/motion UI PASS: full override under reduced OS, rebound and flip animations, three saved cup shapes, empty/half/full/capped water, undo, red tray pulse, preview timeout, quiet stop, reduced and system modes.');
};
