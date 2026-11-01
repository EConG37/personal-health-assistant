const { FOODS } = require('./foods');
const { exclusionReason, needsClinicalPlan, GOALS } = require('./profile');
const { todayKey } = require('./store');
const { DISHES, GUIDE_SOURCES, GUIDE_VERSION, dishExclusionReason, recipeItem } = require('./dishes');

function mulberry32(a) { return function () { let t=a+=0x6d2b79f5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
function seedFrom(s) { let h=2166136261; for(const c of s) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
const GOAL_TIPS = {
  uric:'少喝浓肉汤，不搭配酒和含糖饮料。',
  glucose:'主食不过量，规律进餐，结合血糖反应和医嘱调整。',
  pressure:'少放盐和酱料，少吃腌制食品。',
  lipids:'少用动物油，少选油炸做法。',
  weight:'按饥饱感合理用餐，避免极端节食。',
  liver:'减少添加糖和酒精；超重者循序管理体重。'
};
function pick(rng, list, profile, recentIds) {
  if (!list.length) return null;
  const weights = list.map(d => {
    let w = 1;
    if (d.ingredientIds.some(id => (profile.favoriteFoods || []).includes(id))) w *= 9;
    if (d.relatedSources.some(id => (profile.goals || []).includes(GUIDE_SOURCES[id].goal))) w *= 3;
    if (profile.cooking !== 'mixed' && d.method === profile.cooking) w *= 2;
    if (d.ingredientIds.some(id => recentIds.includes(id))) w *= .4;
    return w;
  });
  let n = rng() * weights.reduce((a,b) => a+b,0);
  return list.find((d,i) => (n -= weights[i]) <= 0) || list.at(-1);
}
function buildDayPlan({ date=todayKey(), recentIds=[], profile={}, nonce=0 }={}) {
  const p={ goals:['uric'], favoriteFoods:[], dislikedFoods:[], allergies:[], conditions:[], ...profile };
  const paused=needsClinicalPlan(p), warnings=[], used=new Set();
  const available=paused?[]:DISHES.filter(d=>!dishExclusionReason(d,p));
  const seedProfile={goals:p.goals,favorites:p.favoriteFoods,disliked:p.dislikedFoods,allergies:p.allergies,diet:p.diet,cooking:p.cooking,mealSource:p.mealSource};
  const rng=mulberry32(seedFrom([GUIDE_VERSION,date,nonce,JSON.stringify(seedProfile)].join('|')));
  const labels={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐'};
  function take(kind,slot,items) {
    const all=available.filter(d=>d.kind===kind && d.slots.includes(slot) && !items.some(i=>i.recipeId===d.id));
    const fresh=all.filter(d=>!used.has(d.id));
    const dish=pick(rng,fresh.length?fresh:all,p,recentIds);
    if(dish){used.add(dish.id);items.push(recipeItem(dish,p));}
    return dish;
  }
  const meals={};
  if(paused) warnings.push('已暂停通用配餐，请按医生或营养师的个体方案用餐。');
  const tip=(p.mealSource==='takeaway'?'点单备注：少油少盐，酱汁另放。':'做饭时少油少盐，食材彻底做熟。')+(p.goals||[]).map(g=>GOAL_TIPS[g]||'').join('')+'有过敏时，请核对完整配料和交叉接触。';
  for(const [slot,label] of Object.entries(labels)) {
    const items=[];
    if(!paused) {
      if(slot==='snack') { if(!take('fruit',slot,items))take('dairy',slot,items); }
      else {
        take('staple',slot,items);
        if(slot==='breakfast') { take('dairy',slot,items); take('protein',slot,items); }
        else { take('protein',slot,items); take('veg',slot,items); }
        const hasMain=items.some(i=>['protein','dairy'].includes(i.role));
        if(!items.some(i=>i.role==='staple') || !hasMain || slot!=='breakfast'&&!items.some(i=>i.role==='veg')) warnings.push(label+'候选不足，请调整偏好后补充搭配。');
      }
    }
    meals[slot]={mode:GUIDE_VERSION,label,items,title:items.filter(i=>['protein','staple'].includes(i.role)).map(i=>i.name).join(' · ')||'暂无适合的搭配',tip,sourceNote:'菜品参考卫健委食养指南示例，整餐由应用重新组合。'};
  }
  const favoriteConflicts=p.favoriteFoods.map(id=>FOODS.find(f=>f.id===id)).filter(Boolean).map(f=>({name:f.name,reason:exclusionReason(f,p)||(!available.some(d=>d.ingredientIds.includes(f.id))?'当前指南菜品库暂无适合的相关菜品':'')})).filter(f=>f.reason);
  return {date,mode:GUIDE_VERSION,meals,ok:!paused&&!warnings.length,paused,warnings,favoriteConflicts,goalNotes:GOALS.filter(g=>p.goals.includes(g.id)),waterPairing:['按自己的目标分次饮水，口渴时及时补充。','如有心肾疾病或限水医嘱，请使用医生确认的饮水目标。']};
}
function planFoodIds(plan) { return [...new Set(Object.values(plan.meals||{}).flatMap(m=>m.items.flatMap(i=>i.ingredientIds)))]; }
module.exports={buildDayPlan,planFoodIds,__internals:{mulberry32,seedFrom}};

