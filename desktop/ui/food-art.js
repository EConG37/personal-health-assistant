/* One explicit image cell per selectable ingredient. Never infer art from a category. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.foodArt=api;
})(typeof window==='object'?window:globalThis,function(){
 const atlases=[
  {name:'base',file:'food-atlas',columns:2,ids:['tofu','egg','rice_white','edamame']},
  {name:'staples',file:'staple-atlas',columns:3,ids:['yam','pumpkin','rice_mixed','potato','noodle','corn','sweet_potato','oats','bread_whole']},
  {name:'proteins',file:'food-proteins-v2',columns:3,ids:['chicken_breast','chicken_leg','pork_lean','beef_lean','lamb_lean','fish_cod','fish_bass','shrimp','tofu_dry']},
  {name:'breakfast',file:'food-breakfast-v2',columns:3,ids:['egg_white','tofu_soft','milk_lowfat','yogurt_plain','yogurt_greek','cheese','soy_milk','congee_rice','congee_millet']},
  {name:'vegetables-a',file:'food-vegetables-a-v2',columns:3,ids:['lotus_root','broccoli','cucumber','tomato','cabbage','carrot','lettuce','pepper_green','spinach']},
  {name:'vegetables-b',file:'food-vegetables-b-v2',columns:3,ids:['mushroom_fresh','winter_melon','celtuce','cabbage_round','onion','eggplant','celery','asparagus','kelp']},
  {name:'fruit',file:'food-fruit-v2',columns:3,ids:['cherry','apple','blueberry','pear','orange','banana','watermelon','grape','lychee']},
  {name:'extras',file:'food-extras-v2',columns:3,ids:['bok_choy','zucchini','coffee','tea_green','water','walnut','almond','olive_oil']}
 ];
 const cells=Object.create(null);
 for(const atlas of atlases){
  atlas.ids.forEach((id,index)=>{cells[id]=Object.freeze({id,atlas:atlas.name,file:atlas.file,index,columns:atlas.columns,
   position:`${index%atlas.columns/(atlas.columns-1)*100}% ${Math.floor(index/atlas.columns)/(atlas.columns-1)*100}%`});});
  Object.freeze(atlas.ids);Object.freeze(atlas);
 }
 return Object.freeze({atlases:Object.freeze(atlases),ids:Object.freeze(Object.keys(cells)),lookup:id=>Object.hasOwn(cells,id)?cells[id]:null});
});
