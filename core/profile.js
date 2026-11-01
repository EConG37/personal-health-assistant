const { FOODS } = require('./foods');

const GOALS = [
  { id: 'uric', name: '降尿酸', condition: '高尿酸 · 痛风', mark: 'UA', detail: '限制动物高嘌呤、酒精和含糖饮料，合理饮水。' },
  { id: 'glucose', name: '稳血糖', condition: '糖尿病 · 糖尿病前期', mark: 'GLU', detail: '优先全谷物，主食定量、规律进餐，不以断食代替控糖。' },
  { id: 'pressure', name: '控血压', condition: '高血压', mark: 'BP', detail: '少盐少酱汁，少吃腌制和加工食品。' },
  { id: 'lipids', name: '调血脂', condition: '血脂异常', mark: 'LDL', detail: '减少饱和脂肪，优先全谷物、蔬菜和适量坚果。' },
  { id: 'weight', name: '管理体重', condition: '超重 · 肥胖', mark: 'KG', detail: '均衡饮食、循序减重，避免极端节食。' },
  { id: 'liver', name: '改善脂肪肝', condition: '代谢相关脂肪性肝病', mark: 'LIV', detail: '减少添加糖和酒精；超重者循序管理体重，按医嘱复查。' },
  { id: 'general', name: '均衡饮食', condition: '日常健康管理', mark: 'DAY', detail: '食物多样、规律三餐，建立适合自己的日常节奏。' }
];
const ALLERGIES = [
  { id: 'egg', name: '蛋类' }, { id: 'milk', name: '牛奶' }, { id: 'soy', name: '大豆' },
  { id: 'wheat', name: '小麦' }, { id: 'nuts', name: '坚果' }, { id: 'fish', name: '鱼类' }, { id: 'shellfish', name: '虾贝类' }
];
const CONDITIONS = [
  { id: 'kidney', name: '肾功能异常 / 透析' }, { id: 'heart', name: '心衰 / 医嘱限水' },
  { id: 'pregnant', name: '孕期 / 哺乳期' }, { id: 'minor', name: '未满 18 岁' },
  { id: 'acute_gout', name: '痛风正在发作' }
];
function needsClinicalPlan(p) { return (p.conditions || []).some(x => ['kidney', 'heart', 'pregnant', 'minor', 'acute_gout'].includes(x)); }
function needsWaterAdvice(p) { return (p.conditions || []).some(x => ['kidney', 'heart', 'pregnant', 'minor'].includes(x)); }

function foodTags(f) {
  const a = [];
  if (f.cat === '蛋类') a.push('egg');
  if (f.cat === '乳制品') a.push('milk');
  if (f.cat === '豆制品') a.push('soy');
  if (['noodle', 'bread_whole'].includes(f.id)) a.push('wheat');
  if (f.cat === '坚果') a.push('nuts');
  if (['fish_bass', 'fish_cod', 'sardine', 'anchovy', 'dried_fish'].includes(f.id)) a.push('fish');
  if (['shrimp', 'oyster', 'scallop'].includes(f.id)) a.push('shellfish');
  return a;
}
function exclusionReason(f, p = {}) {
  const tags = foodTags(f);
  const allergy = (p.allergies || []).find(x => tags.includes(x));
  if (allergy) return `已排除：${ALLERGIES.find(a => a.id === allergy)?.name}过敏`;
  if ((p.dislikedFoods || []).includes(f.id) || (f.id === 'egg_white' && (p.dislikedFoods || []).includes('egg'))) return '已排除：不喜欢';
  if (p.diet === 'vegetarian' && ['畜肉', '禽肉', '水产', '内脏', '加工'].includes(f.cat)) return '已排除：蛋奶素偏好';
  if (p.diet === 'vegan' && (['畜肉', '禽肉', '水产', '内脏', '加工'].includes(f.cat) || tags.includes('egg') || tags.includes('milk'))) return '已排除：纯素偏好';
  return '';
}

function validateProfile(patch, previous = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('设置格式无效');
  const out = {};
  const ranges = { weightKg:[30,250], heightCm:[100,230], uricAcid:[60,1500], targetWaterMl:[200,4000], cupMl:[50,2000], glucose:[1,40], systolic:[60,260], diastolic:[30,160], ldl:[0.1,15], triglycerides:[0.1,30] };
  for (const [k, [min,max]] of Object.entries(ranges)) if (k in patch) {
    const v = patch[k];
    if (v === null && !['weightKg','heightCm'].includes(k)) out[k] = null;
    else if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`${k} 请填写 ${min}–${max} 范围内的数值`);
    else out[k] = v;
  }
  if('cupMl' in patch && !Number.isInteger(patch.cupMl)) throw new Error('杯子容量请填写 50–2000 ml 的整数');
  const arrays = { goals: GOALS.map(g=>g.id), allergies: ALLERGIES.map(g=>g.id), conditions: CONDITIONS.map(g=>g.id), favoriteFoods: FOODS.map(f=>f.id), dislikedFoods: FOODS.map(f=>f.id) };
  for (const [k, allowed] of Object.entries(arrays)) if (k in patch) {
    if (!Array.isArray(patch[k]) || patch[k].some(v=>!allowed.includes(v))) throw new Error('请使用列表中的选项');
    out[k] = [...new Set(patch[k])];
  }
  if ('goals' in out && !out.goals.length) throw new Error('请至少选择一个目标');
  for (const k of ['wakeAt','sleepAt']) if (k in patch) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(patch[k])) throw new Error('请填写有效的作息时间');
    out[k] = patch[k];
  }
  const enums = { diet:['omnivore','vegetarian','vegan'], mealSource:['home','takeaway','mixed'], cooking:['steam','stirfry','mixed'], notifyMode:['silent','notify'], motionMode:['system','full','reduced'] };
  for (const [k, values] of Object.entries(enums)) if (k in patch) {
    if (!values.includes(patch[k])) throw new Error('设置选项无效');
    out[k] = patch[k];
  }
  if ('remindGapMin' in patch) { if (![45,60,90,120].includes(patch.remindGapMin)) throw new Error('提醒间隔无效'); out.remindGapMin=patch.remindGapMin; }
  if ('clinicianNote' in patch) { if(typeof patch.clinicianNote!=='string' || patch.clinicianNote.length>500) throw new Error('医嘱备注最多 500 字'); out.clinicianNote=patch.clinicianNote; }
  if ('onboardingVersion' in patch) { if (patch.onboardingVersion !== 2) throw new Error('引导版本无效'); out.onboardingVersion=2; out.onboarded=true; }
  const merged = {...previous,...out};
  if (merged.wakeAt === merged.sleepAt) throw new Error('起床和睡觉时间不能相同');
  return out;
}

module.exports = { GOALS, ALLERGIES, CONDITIONS, needsClinicalPlan, needsWaterAdvice, foodTags, exclusionReason, validateProfile };
