const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DISHES,DISH_BY_ID,GUIDE_SOURCES,GUIDE_VERSION,dishExclusionReason,sourceUrlAllowed}=require('../core/dishes');
const {buildDayPlan}=require('../core/recommend');
const {buildMealDeck,activeChoices,takeawayBrief}=require('../core/meal-deck');
const {Store}=require('../core/store');
const {FOODS}=require('../core/foods');
const evidence=require('../docs/guide-dishes/catalog-evidence.json').evidence;
const candidates=require('../docs/guide-dishes/extracted-candidates.json');
const profile={goals:['uric'],allergies:[],favoriteFoods:[],dislikedFoods:[],diet:'omnivore',conditions:[],cooking:'mixed',mealSource:'mixed'};
let count=0;const check=(name,fn)=>{fn();count++;console.log('ok '+name);};
check('真实菜名与主要食材可回溯到本地指南页码',()=>{
 assert(DISHES.length>=90);assert.equal(new Set(DISHES.map(d=>d.id)).size,DISHES.length);
 assert(DISHES.some(d=>d.name==='番茄炒蛋'));assert(!DISHES.some(d=>d.name==='清炒番茄'));
 for(const d of DISHES){
  const e=evidence.find(e=>e.id===d.id);assert(e,d.name);
  assert(candidates.some(c=>JSON.stringify(c)===JSON.stringify(e.canonical)),d.name);
  assert(d.ingredients.length);assert(!/\d/.test(d.ingredients.join('')),d.name);
  for(const r of d.sourceRefs){assert(GUIDE_SOURCES[r.sourceId]);assert(Number.isInteger(r.page)&&r.page>0);assert(candidates.some(c=>c.name===d.sourceName&&c.pdf===r.sourceId&&c.page===r.page&&c.raw.replace(/\s/g,'')===e.canonical.raw.replace(/\s/g,'')),d.name);}
 }
});
check('副食材和隐藏在菜名后的配料同样参与排除',()=>{
 const tomatoEgg=DISHES.find(d=>d.name==='番茄炒蛋');
 assert(dishExclusionReason(tomatoEgg,{...profile,dislikedFoods:['tomato']}));
 assert(dishExclusionReason(tomatoEgg,{...profile,allergies:['egg']}));
 const peanuts=DISHES.find(d=>d.name==='凉拌芹菜');
 assert(peanuts.ingredients.some(i=>i.includes('花生')));assert(dishExclusionReason(peanuts,{...profile,allergies:['nuts']}));
 assert(dishExclusionReason(DISHES.find(d=>d.name==='玉米面馒头'),{...profile,allergies:['wheat']}));
 assert(dishExclusionReason(DISHES.find(d=>d.name==='糙米饭'),{...profile,allergies:['soy']}));
 const meat=DISHES.find(d=>d.name==='洋葱炒木耳');assert(meat.containsAnimalMeat);assert(dishExclusionReason(meat,{...profile,goals:['general'],diet:'vegan'}));
});
check('七目标与多目标九张牌稳定、不同且不会放回已排除菜品',()=>{
 for(const goals of [['uric'],['glucose'],['pressure'],['lipids'],['weight'],['liver'],['general'],['uric','glucose','pressure']])for(const slot of ['breakfast','lunch','dinner']){
  const p={...profile,goals,dislikedFoods:['tomato'],allergies:['milk']};
  const a=buildMealDeck({profile:p,slot,date:'2026-11-01'});
  assert.equal(a.cards.length,9,goals+' '+slot);assert.equal(new Set(a.cards.map(c=>c.items.map(i=>i.recipeId).sort().join('|'))).size,9);
  assert.deepEqual(a,buildMealDeck({profile:p,slot,date:'2026-11-01'}));
  for(const card of a.cards)for(const i of card.items){assert.equal(dishExclusionReason(DISH_BY_ID.get(i.recipeId),p),'');assert(i.ingredients.length);}
  assert(!/"(?:grams|proteinG|purineMg|budget|totalPurineMg)":/.test(JSON.stringify(a)));
 }
});
check('食材喜好提高相关菜品的出现机会',()=>{
 let normal=0,favorite=0;
 for(let nonce=0;nonce<60;nonce++)for(const [key,p]of [['normal',profile],['favorite',{...profile,favoriteFoods:['tomato']}]] ){
  const n=Object.values(buildDayPlan({profile:p,nonce}).meals).flatMap(m=>m.items).filter(i=>i.ingredientIds.includes('tomato')).length;
  if(key==='normal')normal+=n;else favorite+=n;
 }
 assert(favorite>normal*1.5,JSON.stringify({normal,favorite}));
});
check('喜欢的食材不会让整副牌只剩同一主菜换主食',()=>{
 const p={...profile,goals:['uric','glucose'],favoriteFoods:['tofu'],dislikedFoods:['egg'],allergies:['milk']};
 for(let nonce=0;nonce<4;nonce++){
  const cards=buildMealDeck({profile:p,nonce}).cards;
  assert(new Set(cards.map(c=>c.items.find(i=>i.role==='protein')?.recipeId)).size>=6);
 }
});
check('旧营养值与旧档位不再决定新推荐',()=>{
 const a=buildDayPlan({profile,date:'2026-11-01'}),before=FOODS.map(f=>({...f}));
 try{for(const f of FOODS){f.purine=NaN;f.protein=NaN;f.fructose=NaN;f.portion=999999;f.tier='avoid';}assert.deepEqual(a,buildDayPlan({profile,date:'2026-11-01'}));}
 finally{FOODS.forEach((f,i)=>Object.assign(f,before[i]));}
});
check('旧版选择须重选；偏好变化生效，历史记录保留',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'health-guide-')),file=path.join(dir,'data.json'),s=new Store(file);
 s.setProfile(profile);s.logMeal({slot:'breakfast',items:[{foodId:'egg',name:'鸡蛋',grams:100,purineMg:2}]});
 s.chooseMeal('lunch',{id:'old',items:[{foodId:'egg',grams:100}],purineMg:999});assert.equal(Object.keys(activeChoices(s.today(),s.profile)).length,0);
 const card=buildMealDeck({profile:s.profile}).cards[0];s.chooseMeal('lunch',card);assert(activeChoices(s.today(),s.profile).lunch);
 const bad={...s.today().mealChoices.lunch,items:card.items.map(i=>({...i,name:'伪造',ingredients:[],grams:999,purineMg:999}))};s.chooseMeal('lunch',bad);
 const clean=activeChoices(s.today(),s.profile).lunch;assert(!JSON.stringify(clean).includes('伪造'));assert(!JSON.stringify(clean).includes('purineMg'));
 s.setProfile({dislikedFoods:[card.items[0].ingredientIds[0]]});assert.equal(Object.keys(activeChoices(s.today(),s.profile)).length,0);
 assert.equal(new Store(file).today().meals[0].items[0].grams,100);
 assert.equal(card.mode,GUIDE_VERSION);
});
check('外卖只带菜品、忌口、定性做法，不带营养计算或预设克数',()=>{
 const p={...profile,allergies:['milk']},card=buildMealDeck({profile:p}).cards[0];
 const text=takeawayBrief({profile:p,day:{mealChoices:{lunch:card}},slots:['lunch'],budget:35});
 assert(card.items.every(i=>text.includes(i.name)));for(const t of ['少油少盐','酱汁另放','牛奶','确认订单与支付'])assert(text.includes(t));
 assert(!/\d+\s*(?:mg|g|ml|kcal|克|毫升)|嘌呤估算|蛋白估算|undefined|NaN/i.test(text));
});
check('空候选和急性痛风不会套用一般菜单',()=>{
 const p={...profile,dislikedFoods:FOODS.map(f=>f.id)};assert.equal(buildMealDeck({profile:p}).cards.length,0);
 for(const condition of ['acute_gout','kidney','heart','pregnant','minor'])assert.equal(buildMealDeck({profile:{...profile,conditions:[condition]}}).paused,true);
});
check('菜品原文只允许已登记的卫健委地址',()=>{
 for(const s of Object.values(GUIDE_SOURCES))assert(sourceUrlAllowed(s.url));
 for(const url of ['https://www.nhc.gov.cn.evil.test/','file:///C:/Windows','javascript:alert(1)','https://www.nhc.gov.cn/unknown','https://user@www.nhc.gov.cn/'])assert.equal(sourceUrlAllowed(url),false);
});
console.log('Guide dishes PASS: '+count+' groups.');
