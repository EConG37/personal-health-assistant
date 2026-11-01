(() => {
  const dialog=document.querySelector('#manual-meal-dialog'),form=dialog.querySelector('form'),text=form.elements.text,error=dialog.querySelector('#manual-meal-error'),count=dialog.querySelector('#manual-meal-count'),submit=form.querySelector('[type=submit]');
  const names={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐'},drafts=new Map();
  let context=null,pending=false;
  const key=()=>context.date+'|'+form.elements.slot.value;
  const revision=meal=>meal?.updatedAt||meal?.ts||0;
  function displaySlot(){
    const slot=form.elements.slot.value,meal=context.meals.find(m=>m.slot===slot);
    if(!drafts.has(key()))drafts.set(key(),{text:(meal?.items||[]).map(i=>i.dishName||i.name||i.foodId||'').join('、'),expectedRevision:revision(meal)});
    const changed=drafts.get(key()).expectedRevision!==revision(meal);drafts.get(key()).expectedRevision=revision(meal);
    text.value=drafts.get(key()).text;text.setCustomValidity('');error.textContent=changed?'这餐已在其他地方更新，请核对后保存。':'';count.textContent=text.value.length+' / 300';
    dialog.querySelector('h2').textContent=meal?'修改'+names[slot]+'记录':'记下吃过的一餐';submit.textContent=meal?'保存修改':'保存记录';
  }
  window.manualMeal={open(options){
    context=options;
    for(const id of drafts.keys())if(!id.startsWith(context.date+'|'))drafts.delete(id);
    form.elements.slot.value=Object.hasOwn(names,options.slot)?options.slot:'lunch';displaySlot();dialog.showModal();
  }};
  form.addEventListener('change',event=>{if(event.target.name==='slot')displaySlot();});
  text.addEventListener('input',()=>{drafts.get(key()).text=text.value;text.setCustomValidity('');error.textContent='';count.textContent=text.value.length+' / 300';});
  dialog.addEventListener('cancel',event=>{if(pending){event.preventDefault();error.textContent='正在保存，请稍候。';}});
  dialog.addEventListener('close',()=>{dialog.returnValue='';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;
    if(!text.value.trim()){text.setCustomValidity('请填写吃了什么');text.reportValidity();return;}
    const draft=drafts.get(key()),savedKey=key(),payload={slot:form.elements.slot.value,text:text.value,date:context.date,expectedRevision:draft.expectedRevision};
    pending=true;for(const control of form.elements)control.disabled=true;error.textContent='';form.setAttribute('aria-busy','true');
    try{
      const state=await window.hh.logManualMeal(payload);drafts.delete(savedKey);dialog.close('saved');context.onSaved(state);
    }catch(err){error.textContent=err.message.replace(/^Error invoking remote method '[^']+': Error: /,'');error.focus();}
    finally{pending=false;for(const control of form.elements)control.disabled=false;form.removeAttribute('aria-busy');}
  });
})();
