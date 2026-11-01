let state=null,tab='today',step=0,draft=null,editing=false,busy=false;
let inspector=null,showDelivery=false,takeawayText='',deckScroll=0,lastViewKey='';
const deliveryDraft={slots:['lunch'],location:'',budget:35,notes:''};
const $=s=>document.querySelector(s);
const view=$('#view');
const motionMedia=matchMedia('(prefers-reduced-motion:reduce)');
function motionAllowed(){return cupVisual.motionEnabled(state?.profile.motionMode||'system',motionMedia.matches);}
function applyMotionPreferences(){const full=motionAllowed();document.documentElement.dataset.motion=full?'full':'reduced';if(!full)for(const a of document.getAnimations())if(!a.id?.startsWith('essential-'))a.cancel();}
motionMedia.addEventListener('change',()=>{if(state)applyMotionPreferences();});
function waterPresentation(){
 const svg=$('.hero-bottle'),liquid=svg?.querySelector('.cup-liquid');if(!liquid)return null;
 const style=getComputedStyle(liquid),matrix=new DOMMatrixReadOnly(style.transform);
 return {ml:Number(svg.dataset.cupMl),y:matrix.m42,opacity:Number(style.opacity),bottle:getComputedStyle(svg).transform,ring:$('.ring-progress')?getComputedStyle($('.ring-progress')).strokeDashoffset:null};
}
function animateWaterChange(from,to,presented=null){
 if(!motionAllowed())return;
 for(const svg of view.querySelectorAll('.cup-visual:not(.cup-choice-art)')){
  const liquid=svg.querySelector('.cup-liquid'),ml=Number(svg.dataset.cupMl);
  const start=presented?.ml===ml?presented:{y:cupVisual.waterY(ml,from),opacity:from>0?1:0};
  if(liquid)liquid.animate([{transform:`translateY(${start.y}px)`,opacity:start.opacity},{transform:`translateY(${cupVisual.waterY(ml,to)}px)`,opacity:to>0?1:0}],{duration:620,easing:'cubic-bezier(.2,.65,.3,1)'});
 }
 $('.ring-progress')?.animate([{strokeDashoffset:presented?.ring??2*Math.PI*83*(1-from)},{strokeDashoffset:2*Math.PI*83*(1-to)}],{duration:600,easing:'ease-out'});
}
const esc=v=>String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={omnivore:'不限制',vegetarian:'蛋奶素',vegan:'纯素',home:'自己做',takeaway:'经常外卖',mixed:'两者都有'};
function feedback(text){$('#feedback').textContent=text;clearTimeout(feedback.timer);feedback.timer=setTimeout(()=>$('#feedback').textContent='',4000);}
function selected(p,k,v){return (p[k]||[]).includes(v)?'checked':'';}
function select(name,caption,options,value){return `<div class="field"><label for="${name}">${caption}</label><select id="${name}" name="${name}">${options.map(([v,n])=>`<option value="${v}" ${value===v?'selected':''}>${n}</option>`).join('')}</select></div>`;}
function input(name,caption,value,{min,max,step='1',type='number',hint='',required=false}={}){return `<div class="field"><label for="${name}">${caption}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${min!=null?`min="${min}"`:''} ${max!=null?`max="${max}"`:''} ${type==='number'?`step="${step}" inputmode="decimal"`:''} ${required?'required':''} ${hint?`aria-describedby="${name}-hint"`:''}>${hint?`<p class="hint" id="${name}-hint">${hint}</p>`:''}</div>`;}
function checks(name,options,p){return options.map(o=>`<label class="choice"><input type="checkbox" name="${name}" value="${o.id}" ${selected(p,name,o.id)}><span>${esc(o.name)}</span></label>`).join('');}
function isOnboarding(){return editing || state.profile.onboardingVersion!==2;}
function remember(){
  if(!draft) return;
  const form=$('#profile-form');if(!form) return;
  for(const key of ['goals','allergies','conditions']) if(form.querySelector(`[name=${key}]`)) draft[key]=[...form.querySelectorAll(`[name=${key}]:checked`)].map(i=>i.value);
  for(const el of form.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea')) {
    if(!el.name || el.name==='foodSearch') continue;
    if(['weightKg','heightCm','uricAcid','targetWaterMl','cupMl'].includes(el.name)) draft[el.name]=el.value===''?null:Number(el.value);
    else draft[el.name]=el.value;
  }
}
function viewOnboarding(s){
  if(!draft) draft=structuredClone(s.profile);
  const p=draft;
  let content='';
  if(step===0) content=`<div class="eyebrow">从你的目标开始 · 01 / 03</div><h1>这次，想照顾好什么？</h1><p class="intro">可以同时选择多个目标。之后的饮食建议会一起考虑这些需要，随时可以调整。</p><fieldset><legend class="small muted">选择健康目标（至少一项）</legend><div class="goal-grid">${s.catalog.goals.map(g=>`<label class="choice"><input type="checkbox" name="goals" value="${g.id}" ${selected(p,'goals',g.id)}><span><strong>${g.name}</strong><small>${g.condition}</small></span></label>`).join('')}</div></fieldset><fieldset><legend>还有需要特别照顾的情况吗？</legend><div class="check-list">${checks('conditions',s.catalog.conditions,p)}</div><p class="hint">特殊情况会暂停通用配餐；饮水目标以医生建议为准。</p></fieldset><details style="margin-top:14px"><summary>有其他指标或医嘱</summary><div class="field"><label for="clinicianNote">医嘱备注（选填）</label><textarea id="clinicianNote" name="clinicianNote" maxlength="500">${esc(p.clinicianNote)}</textarea><p class="hint">仅保存备注，不会自动推断疾病或生成用药建议。</p></div></details>`;
  if(step===1) content=`<div class="eyebrow">吃你愿意吃的 · 02 / 03</div><h1>好好吃饭，也合你的口味。</h1><p class="intro">先排除过敏和不喜欢的食物，再优先用你爱吃的搭配三餐。喜欢的食物不合适时，会告诉你原因。</p><fieldset><legend>你的饮食方式</legend><div class="inline-options">${['omnivore','vegetarian','vegan'].map(v=>`<label><input type="radio" name="diet" value="${v}" ${p.diet===v?'checked':''}>${labels[v]}</label>`).join('')}</div></fieldset><fieldset><legend>食物过敏（可多选）</legend><div class="inline-options">${s.catalog.allergies.map(a=>`<label><input type="checkbox" name="allergies" value="${a.id}" ${selected(p,'allergies',a.id)}>${a.name}</label>`).join('')}</div><p class="hint">覆盖下列常见过敏原。其他过敏与交叉接触需自行核对，不能仅依赖此工具。</p></fieldset><div class="field"><label for="foodSearch">平时爱吃什么？</label><input type="search" name="foodSearch" id="foodSearch" placeholder="搜索食材，如豆腐、鸡蛋、米饭" autocomplete="off"></div><div class="selection-summary" id="food-summary">喜欢 ${p.favoriteFoods.length} 种 · 不喜欢 ${p.dislikedFoods.length} 种</div><div class="food-picker">${s.catalog.foods.map(f=>`<div class="food-row" data-food-name="${esc(f.name)}"><span>${f.name}<small class="muted"> · ${f.cat}</small></span><button type="button" data-act="food" data-kind="favoriteFoods" data-food="${f.id}" aria-label="喜欢${f.name}" aria-pressed="${p.favoriteFoods.includes(f.id)}">喜欢</button><button type="button" data-act="food" data-kind="dislikedFoods" data-food="${f.id}" aria-label="不喜欢${f.name}" aria-pressed="${p.dislikedFoods.includes(f.id)}">不喜欢</button></div>`).join('')}</div><div class="field-pair">${select('mealSource','平时怎么吃',[['home','自己做'],['takeaway','经常外卖'],['mixed','两者都有']],p.mealSource)}${select('cooking','喜欢的做法',[['steam','清蒸 / 白灼'],['stirfry','少油煎炒'],['mixed','都可以']],p.cooking)}</div>`;
  if(step===2) content=`<div class="eyebrow">找到自己的节奏 · 03 / 03</div><h1>从每天的一杯水开始。</h1><p class="intro">默认只用托盘圆环提醒你。先完成设置，飞书同步可以稍后连接。</p><div class="field-pair">${input('weightKg','体重 · kg',p.weightKg,{min:30,max:250,step:'.1',required:true})}${input('heightCm','身高 · cm',p.heightCm,{min:100,max:230,required:true})}</div><div class="field-pair">${input('wakeAt','起床',p.wakeAt,{type:'time',required:true})}${input('sleepAt','睡觉',p.sleepAt,{type:'time',required:true})}</div>${input('targetWaterMl','每日饮水目标 · ml（选填）',p.targetWaterMl,{min:200,max:4000,step:'50',hint:(p.conditions||[]).some(x=>['heart','kidney','pregnant','minor'].includes(x))?'请填医生确认的量；留空则暂停饮水催促。':'留空按体重参考估算，可在设置中调整。'})}${input("cupMl","杯子容量 · ml",p.cupMl||250,{min:50,max:2000,required:true,hint:"记一杯会一直使用这个量，之后可修改。"})}<div class="card soft"><h3>已经记住你的偏好</h3><p class="hint">${p.goals.map(id=>s.catalog.goals.find(g=>g.id===id)?.name).join(' · ')}<br>喜欢 ${p.favoriteFoods.length} 种食物，排除 ${p.dislikedFoods.length} 种不喜欢的食物。</p></div><p class="note">这些设置用于日常生活方式支持，不能代替诊断、个体化营养处方与药物治疗。</p>`;
  return `<div class="progress-steps" aria-label="第 ${step+1} 步，共 3 步">${[0,1,2].map(i=>`<span class="${i<=step?'current':''}"></span>`).join('')}</div><form id="profile-form" method="post" action="#">${content}<div class="onboarding-actions"><p class="error" role="alert" id="form-error"></p><div class="form-footer">${step>0?'<button type="button" class="btn ghost" data-act="back">上一步</button>':editing?'<button type="button" class="btn ghost" data-act="cancel-edit">取消</button>':''}<button type="submit" class="btn primary">${step===2?'保存，开始我的日常':'下一步'}</button></div>${step===0&&!editing?'<button type="button" class="text-btn" data-act="general">暂不确定，先从均衡饮食开始</button>':''}</div></form>`;
}
function ring(st){
 const r=83,c=2*Math.PI*r,col='#d3fb5c';
 const alert=state.reminder?.active,preview=state.reminder?.preview;
 const ticks=Array.from({length:40},(_,i)=>{const a=i*Math.PI/20;return `<line x1="${110+100*Math.sin(a)}" y1="${110-100*Math.cos(a)}" x2="${110+(i%5===0?108:104)*Math.sin(a)}" y2="${110-(i%5===0?108:104)*Math.cos(a)}" stroke="${i/40<st.progress?col:'#687c75'}" stroke-width="${i%5===0?2.7:1.5}" stroke-linecap="round"/>`;}).join('');
 return `<div class="hydration-card ${alert?'is-alerting':'is-calm'}"><div class="hydration-copy"><p class="hydration-label">今日饮水</p><div class="ring-big">${st.drunk.toLocaleString()}<span> ml</span></div><p class="ring-unit">${st.paused?'饮水目标待医生确认':`目标 ${st.target.toLocaleString()} ml`}</p><span class="progress-badge">${alert?(preview?'提醒预览':'该喝水了'):st.paused?'目标待确认':st.goalMet?ui.icon('check','status-check')+' 已完成':Math.round(st.progress*100)+'%'}</span></div><div class="ring-wrap" role="img" aria-label="已喝 ${st.drunk} 毫升，${st.paused?'目标待确认':`目标 ${st.target} 毫升`}"><svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">${ticks}<circle cx="110" cy="110" r="${r}" fill="none" stroke="#3b5149" stroke-width="6"/><circle class="ring-progress" cx="110" cy="110" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" transform="rotate(-90 110 110)" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-st.progress)}"/></svg>${alert?'<span class="reminder-dot" aria-hidden="true"></span>':''}</div>${ui.bottle('hero-bottle',state.profile.cupMl||250,st.progress)}<button class="btn primary cup-primary" data-act="add-cup">${ui.icon('cup')}记一杯 <span>${state.profile.cupMl||250} ml</span></button></div>`;
}

function goalTags(s){const goals=s.catalog.goals.filter(g=>s.profile.goals.includes(g.id));return `<div class="goal-tags">${goals.slice(0,2).map(g=>`<button class="tag" data-act="edit-profile">${g.name}</button>`).join('')}${goals.length>2?`<button class="tag" data-act="edit-profile">+${goals.length-2}</button>`:''}</div>`;}

function render({focus=false}={}){
  if(!state)return;
  applyMotionPreferences();
  const date=new Date();$('#today-label').textContent=(date.getMonth()+1)+'月'+date.getDate()+'日 · 周'+'日一二三四五六'[date.getDay()];
  const onboarding=isOnboarding();
  document.querySelector('nav').hidden=onboarding;
  $('#app').classList.toggle('onboarding',onboarding);
  view.classList.toggle('showing-detail',!!inspector&&!showDelivery&&tab==='plan');
  view.innerHTML=onboarding?viewOnboarding(state):tab==='today'?healthViews.today(state):tab==='plan'?healthViews.plan(state,{inspector,showDelivery,deliveryDraft,takeawayText}):healthViews.settings(state);
  for(const b of document.querySelectorAll('nav button')){b.classList.toggle('active',b.dataset.tab===tab);if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  document.querySelector('nav').style.setProperty('--active-tab',Math.max(0,['today','plan','settings'].indexOf(tab)));
  $('#page-label').textContent=onboarding?'欢迎使用':'';
  const key=onboarding?'onboarding-'+step:tab+(inspector?'-detail':showDelivery?'-delivery':'');
  if(key!==lastViewKey&&motionAllowed())view.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:170,easing:'cubic-bezier(.2,.65,.3,1)'});
  lastViewKey=key;
  if(focus){view.focus({preventScroll:true});view.scrollTop=0;}
}
function cleanError(err){return err.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
function formError(id,err){const el=$(id);if(el){el.textContent=cleanError(err);el.tabIndex=-1;el.focus();}else feedback(cleanError(err));}
async function perform(button,fn,message){
  if(busy)return;busy=true;if(button)button.disabled=true;
  try{
    const previous=state.status,action=button?.dataset.act,presented=motionAllowed()?waterPresentation():null;state=await fn();render();
    if(['add-cup','half-cup','undo'].includes(action)&&motionAllowed()){
      $('.hero-bottle')?.animate([{transform:presented?.bottle&&presented.bottle!=='none'?presented.bottle:'translateY(0)'},{transform:'translateY(-7px) rotate(-3deg)',offset:.36},{transform:'translateY(2px) rotate(1deg)',offset:.75},{transform:'translateY(0)'}],{duration:520,easing:'cubic-bezier(.2,.65,.3,1)'});
      animateWaterChange(previous.progress,state.status.progress,presented);
    }
    if(message)feedback(message);
  }catch(err){feedback(cleanError(err));}
  finally{busy=false;if(button?.isConnected)button.disabled=false;}
}
function updateFlips(){
  for(const card of view.querySelectorAll('.meal-card[data-card-id]')){
    const revealed=state.deck.revealed.includes(card.dataset.cardId),button=card.querySelector('button');
    card.classList.toggle('revealed',revealed);button.setAttribute('aria-expanded',revealed);
    const data=state.deck.cards.find(c=>c.id===card.dataset.cardId);
    button.setAttribute('aria-label',revealed?data.title+'，查看详情':'第'+data.number+'张，翻开看看');
    card.querySelector('.card-back').setAttribute('aria-hidden',revealed);
    card.querySelector('.card-front').setAttribute('aria-hidden',!revealed);
  }
  if($('#reveal-count'))$('#reveal-count').textContent='已翻 '+state.deck.cards.filter(c=>state.deck.revealed.includes(c.id)).length+' / '+state.deck.cards.length;
}
function readDelivery(){
 const f=$('#delivery-form');if(!f)return;
 deliveryDraft.slots=[...f.querySelectorAll('[name=slots]:checked')].map(e=>e.value);
 deliveryDraft.budget=Number(f.elements['delivery-budget'].value);
 deliveryDraft.location=f.elements['delivery-location'].value;
 deliveryDraft.notes=f.elements.notes.value;
}
view.addEventListener('click',async e=>{
 const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;
 if(act==='food'){
  const key=b.dataset.kind,other=key==='favoriteFoods'?'dislikedFoods':'favoriteFoods',id=b.dataset.food,ids=new Set(draft[key]);
  if(ids.has(id))ids.delete(id);else ids.add(id);draft[key]=[...ids];draft[other]=draft[other].filter(v=>v!==id);
  for(const btn of b.parentNode.querySelectorAll('button'))btn.setAttribute('aria-pressed',draft[btn.dataset.kind].includes(id));
  $('#food-summary').textContent='喜欢 '+draft.favoriteFoods.length+' 种 · 不喜欢 '+draft.dislikedFoods.length+' 种';return;
 }
 if(act==='back'){remember();step--;render({focus:true});return;}
 if(act==='general'){remember();draft.goals=['general'];step=1;render({focus:true});return;}
 if(act==='cancel-edit'){editing=false;draft=null;render({focus:true});return;}
 if(act==='edit-profile'){editing=true;draft=structuredClone(state.profile);step=0;render({focus:true});return;}
 if(act==='add-cup')return perform(b,()=>window.hh.addWater(state.profile.cupMl||250),'已记一杯 · '+(state.profile.cupMl||250)+' ml');
 if(act==='half-cup')return perform(b,()=>window.hh.addWater(Math.round((state.profile.cupMl||250)/2)),'已记半杯');
 if(act==='undo')return perform(b,()=>window.hh.undoWater(),'已撤销上一杯');
 if(act==='cup-preset'){const input=b.closest('form')?.querySelector('[name=cupMl]');if(!input)return;input.value=b.dataset.ml;for(const preset of b.parentNode.querySelectorAll('[data-act=cup-preset]'))preset.setAttribute('aria-pressed',preset===b);input.focus();return;}
 if(act==='go-meal'||act==='meal-slot'){
  if(busy)return;busy=true;
  try{state=await window.hh.mealAction('slot',b.dataset.slot);tab='plan';inspector=null;showDelivery=false;render({focus:true});}catch(err){feedback(cleanError(err));}finally{busy=false;}return;
 }
 if(act==='flip-card'){
  if(busy)return;
  if(state.deck.revealed.includes(b.dataset.card)){deckScroll=view.scrollTop;inspector=state.deck.cards.find(c=>c.id===b.dataset.card);render({focus:true});return;}
  busy=true;
  try{state=await window.hh.mealAction('reveal',state.deck.slot,b.dataset.card);updateFlips();}catch(err){feedback(cleanError(err));}finally{busy=false;}return;
 }
 if(act==='reveal-all'){
  if(busy)return;busy=true;
  try{state=await window.hh.mealAction('reveal-all',state.deck.slot);updateFlips();}catch(err){feedback(cleanError(err));}finally{busy=false;}return;
 }
 if(act==='shuffle-deck')return perform(b,()=>window.hh.mealAction('shuffle',state.deck.slot),'已换一副，确认过的搭配仍然保留');
 if(act==='choose-card'){
  if(busy)return;busy=true;b.disabled=true;
  try{
   state=await window.hh.mealAction('choose',state.deck.slot,b.dataset.card);inspector=null;render();view.scrollTop=deckScroll;
   const choice=view.querySelector('.selected-meal');
   if(choice){const r=choice.getBoundingClientRect(),main=view.getBoundingClientRect(),limit=Math.min(main.bottom,document.querySelector('nav').getBoundingClientRect().top)-12;if(r.height>limit-main.top)view.scrollTop+=r.top-main.top;else if(r.bottom>limit)view.scrollTop+=r.bottom-limit;}
   feedback('这餐已选好，吃过后再记餐。');
  }catch(err){feedback(cleanError(err));b.disabled=false;}finally{busy=false;}return;
 }
 if(act==='back-deck'){inspector=null;showDelivery=false;render();view.scrollTop=deckScroll;return;}
 if(act==='view-choice'){deckScroll=view.scrollTop;inspector=state.mealSelection.choices[b.dataset.slot];render({focus:true});return;}
 if(act==='show-takeaway'){
  deckScroll=view.scrollTop;inspector=null;showDelivery=true;
  if(!deliveryDraft.slots.some(s=>state.mealSelection.choices[s]))deliveryDraft.slots=[state.deck.slot].filter(s=>state.mealSelection.choices[s]);
  render({focus:true});return;
 }
 if(act==='takeaway-copy'||act==='takeaway-open'){
  if(busy)return;busy=true;b.disabled=true;
  try{readDelivery();const result=await window.hh.takeaway(act==='takeaway-open'?'open':'copy',deliveryDraft);if(result.copied)feedback(result.opened?'已复制需求，请在小美 App 中粘贴发送。':'外卖需求已复制');}catch(err){formError('#delivery-error',err);}finally{busy=false;b.disabled=false;}return;
 }
 if(act==='logmeal')return perform(b,()=>window.hh.logMeal(b.dataset.slot),'已记下实际吃过的这一餐');
 if(act==='quiet'){const minutes=Number(b.dataset.min);return perform(b,()=>window.hh.quiet(minutes),minutes?'已安静 '+(minutes%60===0?minutes/60+' 小时':minutes+' 分钟'):'已恢复提醒');}
 if(act==='preview-reminder'){
  if(busy)return;busy=true;
  try{state=await window.hh.previewReminder();tab='today';inspector=null;showDelivery=false;render({focus:true});feedback('提醒样式预览 · 5 秒，不记录饮水');}catch(err){feedback(cleanError(err));}finally{busy=false;}return;
 }
 if(act==='datadir'){await window.hh.openDataDir();return;}
 if(act==='sync-guide'){window.syncGuide.open(state);return;}
 if(act.startsWith('sync-')){
  const action=act.slice(5);
  if(action==='restore'&&!window.confirm('将合并云端记录，并用飞书档案替换本机目标和偏好。继续恢复吗？'))return;
  return perform(b,()=>window.hh.sync(action),action==='disconnect'?'已停止同步，本机记录保留':action==='help'?'已打开飞书应用后台':'操作已完成，请查看同步状态');
 }
});
view.addEventListener('input',e=>{
 if(e.target.id==='foodSearch'){const q=e.target.value.trim();for(const row of view.querySelectorAll('.food-row'))row.hidden=!row.dataset.foodName.includes(q);}
 if(e.target.closest('#delivery-form')){readDelivery();takeawayText='';if($('#takeaway-preview'))$('#takeaway-preview').hidden=true;}
 for(const error of view.querySelectorAll('.error'))error.textContent='';
});
view.addEventListener('change',async e=>{
 if(e.target.name==='diet')draft.diet=e.target.value;
 if(e.target.name==='syncProvider'){
  const app=e.target.value==='app';$('#own-sync-fields').hidden=!app;$('#own-sync-fields').disabled=!app;$('#existing-sync-fields').hidden=app;$('#existing-sync-fields').disabled=app;
 }
 if(e.target.closest('#delivery-form')){readDelivery();takeawayText='';if($('#takeaway-preview'))$('#takeaway-preview').hidden=true;}
 if(e.target.id==='autostart')try{await window.hh.loginItem(e.target.checked);state=await window.hh.getState();feedback('自启设置已保存');}catch(err){e.target.checked=!e.target.checked;feedback(cleanError(err));}
});
view.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const form=e.target,button=form.querySelector('[type=submit]');
 if(form.id==='profile-form'){
  remember();if(step===0&&!draft.goals.length)return formError('#form-error',new Error('请至少选择一个目标，也可以先选择均衡饮食。'));
  if(step<2){step++;render({focus:true});return;}
 }
 busy=true;if(button)button.disabled=true;
 try{
  if(form.id==='profile-form'){state=await window.hh.setProfile({...draft,onboardingVersion:2});editing=false;draft=null;inspector=null;showDelivery=false;tab='today';render({focus:true});feedback('目标、口味和杯量已保存。');}
  else if(form.id==='settings-form'){
   const patch={};for(const el of form.querySelectorAll('input[name],select[name]'))patch[el.name]=['wakeAt','sleepAt','notifyMode','motionMode'].includes(el.name)?el.value:el.value===''?null:Number(el.value);
   state=await window.hh.setProfile(patch);render();feedback('设置已保存');
  }
  else if(form.id==='sync-form'){
   const provider=form.querySelector('[name=syncProvider]:checked').value;
   const config=provider==='app'?{provider,appId:form.elements['feishu-app-id'].value.trim(),appSecret:form.elements.appSecret.value.trim(),url:form.elements['feishu-base-url'].value.trim()}:{provider,url:form.elements['existing-base-url'].value.trim()};
   state=await window.hh.configureSync(config);render({focus:true});feedback('飞书表格已连接，首次同步完成');
  }
  else if(form.id==='delivery-form'){readDelivery();const result=await window.hh.takeaway('preview',deliveryDraft);takeawayText=result.text;render();const preview=$('#takeaway-preview');view.scrollTo({top:view.scrollTop+preview.getBoundingClientRect().top-view.getBoundingClientRect().top,behavior:motionAllowed()?'smooth':'instant'});}
 }catch(err){formError(form.id==='profile-form'?'#form-error':form.id==='settings-form'?'#settings-error':form.id==='sync-form'?'#sync-error':'#delivery-error',err);if(button?.isConnected)button.disabled=false;}
 finally{busy=false;if(button?.isConnected)button.disabled=false;}
});
for(const b of document.querySelectorAll('nav button'))b.addEventListener('click',()=>{tab=b.dataset.tab;render({focus:true});});
$('#btn-close').addEventListener('click',()=>window.hh.hide());
window.hh.onStatus(s=>{
 if(!state)return;const before=state,presented=motionAllowed()?waterPresentation():null;state=s;applyMotionPreferences();
 if(busy||isOnboarding()||tab==='settings'||inspector||showDelivery||document.activeElement?.matches('input,select,textarea'))return;
 if(tab==='plan'&&JSON.stringify([before.deck,before.mealSelection,before.today.meals])===JSON.stringify([s.deck,s.mealSelection,s.today.meals]))return;
 if(tab==='today'&&JSON.stringify([before.today.water,before.target,before.reminder,before.profile,before.mealSelection,before.week])===JSON.stringify([s.today.water,s.target,s.reminder,s.profile,s.mealSelection,s.week]))return;
 render();
 if(tab==='today'&&before.status.progress!==s.status.progress)animateWaterChange(before.status.progress,s.status.progress,presented);
});
const d=new Date();$('#today-label').textContent=(d.getMonth()+1)+'月'+d.getDate()+'日 · 周'+'日一二三四五六'[d.getDay()];
window.hh.getState().then(s=>{state=s;render();}).catch(err=>{view.textContent='读取数据失败，请重新打开面板。';feedback(cleanError(err));});
