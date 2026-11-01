const crypto=require('node:crypto');
const {buildDayPlan}=require('./recommend');
const {todayKey}=require('./store');
const {needsClinicalPlan,GOALS,ALLERGIES}=require('./profile');
const {FOODS}=require('./foods');
const {DISH_BY_ID,GUIDE_VERSION,dishExclusionReason,recipeItem}=require('./dishes');
const SLOTS={breakfast:'早餐',lunch:'午餐',dinner:'晚餐'};
const MEITUAN_ENTRY='https://xmei.meituan.com/';
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0,16);
function foodProfileKey(p={}){return digest({version:GUIDE_VERSION,goals:p.goals,allergies:p.allergies,disliked:p.dislikedFoods,favorites:p.favoriteFoods,diet:p.diet,conditions:p.conditions,cooking:p.cooking,mealSource:p.mealSource});}
function validChoice(choice,profile){
 return choice?.mode===GUIDE_VERSION && choice.profileKey===foodProfileKey(profile) &&
  !!choice.items?.length && !needsClinicalPlan(profile) &&
  choice.items.every(i=>!dishExclusionReason(DISH_BY_ID.get(i.recipeId),profile));
}
function activeChoices(day,profile){
 return Object.fromEntries(Object.entries(day.mealChoices||{}).filter(([slot,c])=>SLOTS[slot]&&validChoice(c,profile)).map(([slot,c])=>[slot,{
  mode:GUIDE_VERSION,id:c.id,profileKey:c.profileKey,label:SLOTS[slot],
  items:c.items.map(i=>recipeItem(DISH_BY_ID.get(i.recipeId),profile)),
  title:c.items.filter(i=>['protein','staple'].includes(DISH_BY_ID.get(i.recipeId).kind)).map(i=>DISH_BY_ID.get(i.recipeId).name).join(' · '),
  tip:buildDayPlan({profile}).meals[slot].tip,sourceNote:'菜品参考卫健委食养指南示例，整餐由应用重新组合。',warnings:c.warnings||[]
 }]));
}
function buildMealDeck({profile={},date=todayKey(),slot='lunch',nonce=0,recentIds=[]}={}){
 if(!SLOTS[slot])throw new Error('餐次无效');
 if(needsClinicalPlan(profile))return {cards:[],paused:true,message:'特殊情况已暂停通用配餐，请按医生或营养师的个体方案用餐。'};
 const candidates=[],cards=[],seen=new Set();
 for(let attempt=0;attempt<48;attempt++){
   const plan=buildDayPlan({profile,date,nonce:nonce*101+attempt,recentIds});
   const meal=plan.meals[slot];if(!meal.items.length)continue;
   const key=meal.items.map(i=>i.recipeId).sort().join('|');if(seen.has(key))continue;seen.add(key);
   candidates.push({...meal,id:digest([date,slot,nonce,foodProfileKey(profile),key]),
    favoriteCount:meal.items.filter(i=>i.favorite).length,
    warnings:plan.warnings.filter(w=>w.includes(SLOTS[slot])),
    profileKey:foodProfileKey(profile)});
 }
 const groups=new Map();
 // Offer different main dishes before repeating one with another staple.
 for(const card of candidates){const key=(card.items.find(i=>i.role==='protein')||card.items.find(i=>i.role==='dairy')||card.items[0]).recipeId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(card);}
 while(cards.length<9&&[...groups.values()].some(g=>g.length))for(const group of groups.values()){if(group.length&&cards.length<9)cards.push({...group.shift(),number:cards.length+1});}
 return {cards,paused:false,message:cards.length<9?'当前偏好下的搭配较少，可以调整喜好或忌口后再试。':''};
}
function choiceSummary(day,profile){const choices=activeChoices(day,profile);return {choices,count:Object.keys(choices).length,invalid:Object.keys(day.mealChoices||{}).filter(k=>!choices[k])};}
function takeawayBrief({profile,day,slots,location='',budget=35,notes=''}){
 if(!Array.isArray(slots)||!slots.length||slots.some(s=>!SLOTS[s]))throw new Error('先选择要点外卖的餐次');
 if(typeof location!=='string'||location.length>160||typeof notes!=='string'||notes.length>300)throw new Error('位置或备注过长');
 if(!Number.isFinite(budget)||budget<5||budget>1000)throw new Error('每餐预算请填写 5–1000 元');
 const choices=activeChoices(day,profile);if(slots.some(s=>!choices[s]))throw new Error('先翻牌并确认这些餐次，再生成外卖需求');
 const all=slots.map(s=>SLOTS[s]+'：'+choices[s].items.map(i=>i.name).join('、')).join('\n');
 const allergies=(profile.allergies||[]).map(id=>ALLERGIES.find(a=>a.id===id)?.name).filter(Boolean);
 const dislikes=(profile.dislikedFoods||[]).map(id=>FOODS.find(f=>f.id===id)?.name).filter(Boolean);
 const needs=GOALS.filter(g=>(profile.goals||['uric']).includes(g.id)).map(g=>g.detail);
 return '请帮我找附近适合以下需求的外卖，先给我 2–3 家店铺和可替换菜品，不要直接付款。\n'+
 (location.trim()?'查找位置：'+location.trim()+'（请先确认配送范围和地址）。':'请使用我在美团确认的当前位置和配送地址。')+
 '\n每餐预算 '+budget+' 元，包含包装费和配送费；先核实总价、配送时间与优惠。\n\n我已选的搭配：\n'+all+
 '\n\n饮食要求：'+needs.join(' ')+'\n'+
 (profile.diet==='vegan'?'纯素，不含蛋奶和动物食材。':profile.diet==='vegetarian'?'蛋奶素，不含肉、鱼虾贝类。':'')+
 (allergies.length?'过敏原：'+allergies.join('、')+'。必须向商家核对完整配料与交叉接触；无法确认就排除。':'食物过敏情况尚需我确认，不要自行假定无过敏。')+
 '\n'+(dislikes.length?'不要加入：'+dislikes.join('、')+'。':'')+
 '优先少油少盐，酱汁另放，饮品选无糖；找不到原菜时，先提供相近食材的替代方案。'+
 (notes.trim()?'\n补充要求：'+notes.trim():'')+
 '\n这些是参考菜品，不要求按固定克数制作，也不估算营养或承诺降指标。请展示店名、菜名、价格、运费、预计送达时间和需要向商家确认的问题。下单前请让我核对店铺、菜品、忌口、地址和总价，再由我确认订单与支付。';
}
module.exports={SLOTS,MEITUAN_ENTRY,buildMealDeck,activeChoices,choiceSummary,validChoice,takeawayBrief,foodProfileKey};

