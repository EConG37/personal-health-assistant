/* Shared, original round-stroke utility icons and local decorative artwork. */
(() => {
 const paths={
  check:'<path d="m5 12 4 4L19 6"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  meal:'<path d="M5 3v7m3-7v7M2 3v7q0 4 6 4M5 14v7M18 3q-5 5-3 10h4M19 3v18"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M3 21v-2a9 9 0 0 1 18 0v2Z"/>',
  cup:'<path d="M5 5h14l-2 16H7Z"/><ellipse cx="12" cy="5" rx="8" ry="2"/>',
  undo:'<path d="m7 3-4 4 4 4M3 7h10a7 7 0 0 1 0 14h-3"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C0 10 6 16 12 20c6-4 12-10 8-15Z"/>',
  cloche:'<path d="M3 17a9 9 0 0 1 18 0ZM2 21h20M12 6V3m-2 0h4"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 8-8m-3-1h4v4"/>',
  leaf:'<path d="M4 20C1 5 12 3 21 3c0 9-3 19-17 17Zm0 0L16 8"/>',
  cloud:'<path d="M5 18a4 4 0 0 1-1-8 6 6 0 0 1 12-2 5 5 0 1 1 2 10H5Z"/><path d="m8 13 3 3 5-6"/>',
  scale:'<path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="M8 8a5 5 0 0 1 8 0l-4 4Z"/>',
  bell:'<path d="M5 10a7 7 0 0 1 14 0v6l2 2H3l2-2Zm5 11h4"/>',
  spark:'<path d="M12 2c1 7 3 9 10 10-7 1-9 3-10 10-1-7-3-9-10-10 7-1 9-3 10-10Z"/>'
 };
 const icon=(name,cls='')=>`<svg class="ui-icon ${cls}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.cloche}</svg>`;
 function ingredient(item,cls=''){
  const recipe=!!item?.recipeId;
  const art=recipe?(typeof dishArt==='object'?dishArt.lookup(item.recipeId):null):foodArt.lookup(item?.foodId);
  const identity=art?(recipe?`data-art-recipe="${item.recipeId}"`:`data-art-food="${art.id}"`):'';
  return `<span class="food-art ${art?`food-sprite food-atlas-${art.atlas} food-id-${art.id}`:'food-generic'} ${cls}" ${identity} aria-hidden="true">${art?'':icon('cloche')}</span>`;
 }
 function food(items=[],cls=''){
  return ingredient(items.find(i=>i.role==='protein')||items[0],cls);
 }
 function mealArt(items=[],cls=''){
  const main=items.find(i=>i.role==='protein')||items[0],staple=items.find(i=>i.role==='staple'&&(i.recipeId||i.foodId)!==(main?.recipeId||main?.foodId));
  return `<span class="meal-art ${cls}" aria-hidden="true">${food(items)}${staple?ingredient(staple,'staple-art'):''}</span>`;
 }
 window.ui={icon,food,ingredient,mealArt,bottle:(cls='',ml=250,progress=0)=>cupVisual.render(cls,ml,progress)};
})();
