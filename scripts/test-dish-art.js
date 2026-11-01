const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {dishes}=require('../core/data/guide-dishes.json');
const dishArt=require('../desktop/ui/dish-art'),foodArt=require('../desktop/ui/food-art');
const context={window:{},foodArt,dishArt,cupVisual:{render:()=>''}};
vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/ui/icons.js'),'utf8'),context);
assert.equal(dishArt.ids.length,99);
for(const d of dishes){
 const art=dishArt.lookup(d.id);assert(art,d.name);assert.equal(art.recipeName,d.name);
 const html=context.window.ui.ingredient({recipeId:d.id,foodId:'noodle'});
 assert(html.includes('data-art-recipe="'+d.id+'"'),d.name);
 assert(html.includes('food-id-'+art.id),d.name);assert(!html.includes('food-generic'),d.name);
}
const artFor=name=>dishArt.lookup(dishes.find(d=>d.name===name).id);
for(const name of ['鸡蛋饼','蔬菜饼','馒头','双色花卷','窝头','玉米面馒头','紫薯饭','南瓜饭','山药鸡蛋面','番茄炒蛋','醋溜土豆丝']){
 const art=artFor(name);assert.equal(art.imageName,name);assert(!art.reusedFoodId,name+' must use a finished-dish picture');
}
assert.equal(artFor('鸡蛋饼').index,0);assert.equal(artFor('鸡蛋饼').file,'dish-breakfast-v1');
const unknown=context.window.ui.ingredient({recipeId:'missing-recipe',foodId:'noodle'});assert(unknown.includes('food-generic'));assert(!unknown.includes('food-id-noodle'));
for(const atlas of dishArt.atlases){
 const p=path.join(__dirname,'../desktop/ui/assets',atlas.file+'.png'),png=fs.readFileSync(p);
 assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),png.readUInt32BE(20));
 for(const suffix of ['.webp','@2x.webp'])assert(fs.statSync(p.replace(/\.png$/,suffix)).size>1000);
}
console.log('Dish art PASS: all 99 recipes have explicit mappings; pancake, bun, rice and mixed-dish regressions covered; unknown recipes stay neutral; 63 new images preserve alpha.');
