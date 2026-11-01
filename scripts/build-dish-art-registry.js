const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const {specs}=require('../docs/dish-art/specs.json');
const {dishes}=require('../core/data/guide-dishes.json');
const foodArt=require('../desktop/ui/food-art');
const aliases={'胡萝卜炒西兰花':'西兰花炒胡萝卜','香菇炒菜心':'香菇炒油菜','凉拌蒜蓉茄子':'蒜泥茄子'};
// Reuse only pictures whose visible food actually matches the named dish.
const reuse={
 '水煮鸡胸肉':'chicken_breast','煮鸡蛋':'egg','清炒西兰花':'broccoli','蒜蓉西兰花':'broccoli',
 '清炒油菜':'bok_choy','素炒小白菜':'bok_choy','醋熘白菜':'cabbage','素炒西葫芦':'zucchini','凉拌芹菜丝':'celery','炝拌白菜':'cabbage',
 '米饭':'rice_white','蒸南瓜':'pumpkin','蒸红薯':'sweet_potato','蒸山药':'yam','煮玉米':'corn','全麦面包':'bread_whole','全麦面包片':'bread_whole',
 '脱脂牛奶':'milk_lowfat','低脂牛奶':'milk_lowfat','牛奶':'milk_lowfat','无糖酸奶':'yogurt_plain','无糖豆浆':'soy_milk','豆浆':'soy_milk',
 '苹果':'apple','梨':'pear','鸭梨':'pear','香蕉':'banana','樱桃':'cherry','蓝莓':'blueberry','橙子':'orange','橘子':'orange','葡萄':'grape','西瓜':'watermelon'
};
const atlases=specs.map(s=>({name:'dish-'+s.name,file:s.file,columns:3,ids:s.entries.map(e=>'dish_'+s.name.replace(/-/g,'_')+'_'+e.index)}));
const pictures=new Map();
for(let i=0;i<specs.length;i++)for(const e of specs[i].entries){const a=atlases[i];pictures.set(e.dish,{id:a.ids[e.index],atlas:a.name,file:a.file,index:e.index,columns:3,position:(e.index%3*50)+'% '+(Math.floor(e.index/3)*50)+'%',imageName:e.dish});}
const registry=Object.create(null),rows=[];
for(const dish of dishes){
 const name=aliases[dish.name]||dish.name;
 const art=pictures.get(name)||(reuse[dish.name]?{...foodArt.lookup(reuse[dish.name]),imageName:dish.name,reusedFoodId:reuse[dish.name]}:null);
 if(!art)throw Error('No reviewed picture for '+dish.name);
 registry[dish.id]={...art,recipeName:dish.name};rows.push({recipeId:dish.id,name:dish.name,imageName:art.imageName,file:art.file,index:art.index,reusedFoodId:art.reusedFoodId||null});
}
const source='/* Generated explicit recipe-to-picture registry. No ingredient/category inference. */\n(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.dishArt=api;})(typeof window==="object"?window:globalThis,function(){const atlases='+JSON.stringify(atlases)+';const cells='+JSON.stringify(registry)+';for(const cell of Object.values(cells))Object.freeze(cell);return Object.freeze({atlases:Object.freeze(atlases),ids:Object.freeze(Object.keys(cells)),lookup:id=>Object.hasOwn(cells,id)?cells[id]:null});});\n';
fs.writeFileSync(path.join(root,'desktop/ui/dish-art.js'),source);
fs.writeFileSync(path.join(root,'docs/dish-art/mapping-audit.json'),JSON.stringify({recipes:rows.length,newPictures:pictures.size,rows},null,2)+'\n');
console.log(JSON.stringify({recipes:rows.length,newPictures:pictures.size,reused:rows.filter(r=>r.reusedFoodId).length}));
