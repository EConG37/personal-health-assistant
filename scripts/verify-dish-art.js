const assert=require('node:assert/strict'),fs=require('node:fs');
const {DISHES,recipeItem}=require('../core/dishes');
const art=require('../desktop/ui/dish-art');
module.exports=async function({win,js,shot}){
 const previous=await js('view.innerHTML'),bounds=win.getBounds(),resizable=win.isResizable();
 try{
  const gallery='<div id="dish-audit-gallery" style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px">'+DISHES.map(d=>'<div style="display:flex;flex-direction:column;align-items:center;min-height:108px;font-size:12px;text-align:center"><span data-test-recipe="'+d.id+'"></span><span>'+d.name+'</span></div>').join('')+'</div>';
  await js('view.innerHTML='+JSON.stringify(gallery)+';for(const el of document.querySelectorAll("[data-test-recipe]"))el.innerHTML=ui.ingredient({recipeId:el.dataset.testRecipe,foodId:"noodle"});');
  await js('document.querySelectorAll("#dish-audit-gallery .food-art").forEach(n=>{n.style.width=n.style.height="68px";})');
  const cells=await js('(async()=>{const nodes=[...document.querySelectorAll("[data-art-recipe]")];const urls=new Set();for(const n of nodes)for(const m of getComputedStyle(n).backgroundImage.matchAll(/url\\("?([^"\\)]+)"?\\)/g))urls.add(m[1]);await Promise.all([...urls].map(async src=>{const i=new Image();i.src=src;await i.decode();}));return nodes.map(n=>({id:n.dataset.artRecipe,position:getComputedStyle(n).backgroundPosition,size:getComputedStyle(n).backgroundSize,generic:n.classList.contains("food-generic")}));})()');
  assert.equal(cells.length,99);
  for(const c of cells){const expected=art.lookup(c.id);assert.equal(c.position,expected.position);assert.equal(c.size,expected.columns*100+'% '+expected.columns*100+'%');assert.equal(c.generic,false);}
  win.setResizable(true);win.setSize(820,1180);
  for(const [index,top]of [0,900,1800].entries()){await js('view.scrollTop='+top);await shot('dish-audit-'+(index+1));}
  win.setBounds(bounds);win.setResizable(resizable);
  const pancake=DISHES.find(d=>d.name==='鸡蛋饼'),chicken=DISHES.find(d=>d.name==='芹菜炒鸡丝'),veg=DISHES.find(d=>d.name==='蒜蓉西兰花');
  const fixture={id:'art-check',title:'鸡蛋饼 · 芹菜炒鸡丝',items:[pancake,chicken,veg].map(d=>recipeItem(d,{})),warnings:[],tip:'做饭时少油少盐。',sourceNote:'菜品参考卫健委食养指南示例，整餐由应用重新组合。'};
  await js('view.innerHTML=healthViews.plan({...state,deck:{...state.deck,slot:"lunch"}},{inspector:'+JSON.stringify(fixture)+'});view.scrollTop=0;');
  assert(await js('!!document.querySelector('+JSON.stringify('.dish-picture.food-id-dish_breakfast_0[data-art-recipe="'+pancake.id+'"]')+')'));
  await shot('pancake-corrected');
 }finally{win.setBounds(bounds);win.setResizable(resizable);await js('view.innerHTML='+JSON.stringify(previous)+';view.scrollTop=0;');}
 console.log('Dish art UI PASS: 99 recipe cells decoded at their exact atlas positions, plus the corrected pancake detail.');
};
