const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {FOODS}=require('../core/foods'),art=require('../desktop/ui/food-art');
const selectable=FOODS.filter(f=>f.tier!=='avoid');
assert.deepEqual([...art.ids].sort(),selectable.map(f=>f.id).sort());
assert.equal(new Set(art.ids.map(id=>{const a=art.lookup(id);return a.file+':'+a.index;})).size,selectable.length,'Distinct ingredients must not silently share a picture');
for(const f of FOODS.filter(f=>f.tier==='avoid'))assert.equal(art.lookup(f.id),null);
const context={window:{},foodArt:art,cupVisual:{render:()=>''}};
vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/ui/icons.js'),'utf8'),context);
for(const f of selectable){
 const html=context.window.ui.food([{foodId:f.id,role:f.role}]);
 assert(html.includes(`data-art-food="${f.id}"`),f.name+' must use its own image');
 assert(!html.includes('food-generic'));
}
const pair=context.window.ui.mealArt([{foodId:'fish_cod',role:'protein'},{foodId:'congee_millet',role:'staple'}]);
assert(pair.includes('data-art-food="fish_cod"'));assert(pair.includes('data-art-food="congee_millet"'));
assert.equal((context.window.ui.mealArt([{foodId:'rice_white',role:'staple'}]).match(/data-art-food=/g)||[]).length,1);
for(const id of ['__proto__','constructor','<script>bad</script>']){assert.equal(art.lookup(id),null);const html=context.window.ui.ingredient({foodId:id});assert(html.includes('food-generic'));assert(!html.includes(id));}
assert(context.window.ui.food([]).includes('food-generic'));
console.log(`Food art PASS: ${selectable.length} distinct ingredients, truthful meal/staple mapping and neutral unknown fallback.`);
