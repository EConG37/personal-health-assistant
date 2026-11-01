const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {FOODS}=require('../core/foods');
const art=require('../desktop/ui/food-art');
module.exports=async function({win,js,shot}){
 const available=FOODS.filter(f=>f.tier!=='avoid');
 assert.equal(new Set(art.ids).size,available.length);
 assert.deepEqual([...art.ids].sort(),available.map(f=>f.id).sort(),'Every selectable ingredient must have its own artwork');
 assert.equal(await js('foodArt.ids.length'),available.length);
 for(const atlas of art.atlases){
  const png=fs.readFileSync(path.join(__dirname,'../desktop/ui/assets',atlas.file+'.png'));
  assert.equal(png[25],6,'Source PNG must preserve RGBA transparency');
 }
 // Use the production renderer and styles, including each sprite position and both densities.
 const previous=await js('view.innerHTML'),bounds=win.getBounds(),resizable=win.isResizable();
 try{
  const gallery=available.map(f=>`<div class="art-check-cell">${f.name}<span data-test-id="${f.id}"></span></div>`).join('');
  await js(`view.innerHTML=${JSON.stringify('<div id="art-check-gallery" style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px">'+gallery+'</div>')};for(const node of document.querySelectorAll('[data-test-id]'))node.innerHTML=ui.ingredient({foodId:node.dataset.testId});`);
  const state=await js(`(async()=>{
   const nodes=[...document.querySelectorAll('[data-art-food]')],urls=new Set(),cells=[];
   for(const node of nodes){const css=getComputedStyle(node);for(const value of css.backgroundImage.split('url("').slice(1))urls.add(value.split('")')[0]);cells.push({id:node.dataset.artFood,position:css.backgroundPosition,size:css.backgroundSize,generic:node.classList.contains('food-generic'),hidden:node.getAttribute('aria-hidden')});}
   const decoded=await Promise.all([...urls].map(async url=>{const image=new Image();image.src=url;try{await image.decode();}catch(err){throw Error('Cannot decode '+url+': '+err.name+' '+err.message);}if(!image.naturalWidth)throw Error('Empty image: '+url);return {url,width:image.naturalWidth};}));return {cells,decoded};
  })()`);
  assert.equal(state.cells.length,available.length);assert(state.decoded.length>=art.atlases.length*3);
  for(const cell of state.cells){const expected=art.lookup(cell.id);assert(expected);assert.equal(cell.position,expected.position);assert.equal(cell.size,`${expected.columns*100}% ${expected.columns*100}%`);assert(!cell.generic);assert.equal(cell.hidden,'true');}
  // Capture a readable catalogue, then restore the actual app view.
  win.setResizable(true);win.setSize(820,1180);await new Promise(r=>setTimeout(r,100));
  await js(`document.querySelectorAll('.art-check-cell').forEach(node=>{node.style.cssText='display:flex;flex-direction:column;align-items:center;font-size:12px;min-height:80px';});document.querySelectorAll('.art-check-cell .food-art').forEach(node=>{node.style.width=node.style.height='62px';});view.scrollTop=0;`);
  await shot('food-catalogue');
 }finally{win.setBounds(bounds);await new Promise(r=>setTimeout(r,100));assert.equal(win.getBounds().width,bounds.width);win.setResizable(resizable);await js(`view.innerHTML=${JSON.stringify(previous)};`);}
 // Unknown and empty items have a neutral fallback; they must not show unrelated food.
 assert(await js(`ui.food([]).includes('food-generic')&&ui.ingredient({foodId:'__proto__'}).includes('food-generic')&&ui.ingredient({foodId:'<img onerror=bad>'}).includes('food-generic')`));
 console.log(`Food art PASS: ${available.length} distinct ingredients; all atlas densities and PNG fallbacks decoded.`);
};
