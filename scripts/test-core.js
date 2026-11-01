/**
 * 核心层冒烟测试。不依赖 Electron，可以直接 node 跑。
 *   node scripts/test-core.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { waterTarget, waterStatus, computeIntake, weightCheck, bmi, dailyVerdict, reminderCopy } = require('../core/rules');
const { buildDayPlan, planFoodIds } = require('../core/recommend');
const { Store, todayKey } = require('../core/store');
const { makeRingPng } = require('../core/trayicon');
const { FOODS } = require('../core/foods');

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}${extra ? '  ' + extra : ''}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${extra ? '  ' + extra : ''}`);
  }
}

function at(hm) {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

console.log('\n=== 1. 饮水目标 ===');
const t70 = waterTarget({ weightKg: 70 });
check('70kg → 2450ml', t70 === 2450, `实际 ${t70}`);
check('60kg 有下限 1800', waterTarget({ weightKg: 40 }) === 1800, `实际 ${waterTarget({ weightKg: 40 })}`);
check('上限 3000', waterTarget({ weightKg: 120, exercise: true, hot: true }) === 3000);

console.log('\n=== 2. 饮水节奏 ===');
const profile = { weightKg: 70, wakeAt: '07:30', sleepAt: '23:30', targetWaterMl: 2450 };

const s0800 = waterStatus({ profile, day: { water: 0 }, now: at('08:00') });
check('07:30-08:00 是宽限期，不该提醒', s0800.due === false, `delta=${s0800.delta}`);

const s1100 = waterStatus({ profile, day: { water: 0 }, now: at('11:00') });
check('11:00 一口没喝 → 该提醒', s1100.due === true, `预期 ${s1100.expected}ml, 落后 ${s1100.delta}`);
check('11:00 显示剩余杯数', s1100.cupsLeft === 10, `实际 ${s1100.cupsLeft}`);

const s1100b = waterStatus({ profile, day: { water: 1500 }, now: at('11:00') });
check('11:00 已喝 1500ml → 不该提醒', s1100b.due === false, `delta=+${s1100b.delta}`);

const s2330 = waterStatus({ profile, day: { water: 2450 }, now: at('23:30') });
check('达标判定', s2330.goalMet === true);
check('睡眠时间不再提醒', s2330.inWindow === false);

const sNoon = waterStatus({ profile, day: { water: 300 }, now: at('12:00') });
check('12:00 只喝 300ml 落后→提醒', sNoon.due === true, `预期 ${sNoon.expected}, 实际 300, delta=${sNoon.delta}`);

const sNoonEdge = waterStatus({ profile, day: { water: 600 }, now: at('12:00') });
check('落在容差内不提醒（差 89ml < 250）', sNoonEdge.due === false, `delta=${sNoonEdge.delta}`);

console.log('\n=== 3. 提醒文案（分级）===');
console.log('   L1 静默 :', JSON.stringify(reminderCopy(sNoon, 1)));
console.log('   L2 通知 :', JSON.stringify(reminderCopy(sNoon, 2)));
check('L1 不弹通知', reminderCopy(sNoon, 1).silent === true);
check('L2 带安抚语气', reminderCopy(sNoon, 2).body.includes('不着急'));

console.log('\n=== 4. 指南菜品推荐 ===');
const {DISH_BY_ID}=require('../core/dishes');
const plan=buildDayPlan({date:'2026-10-30',recentIds:[]});
for(const m of Object.values(plan.meals))console.log('   '+m.label+': '+m.items.map(i=>i.name).join('、'));
check('三餐都有主食和主菜', ['breakfast','lunch','dinner'].every(k=>plan.meals[k].items.some(i=>i.role==='staple')&&plan.meals[k].items.some(i=>i.role==='protein')));
check('每道菜均来自本地指南库', Object.values(plan.meals).flatMap(m=>m.items).every(i=>DISH_BY_ID.has(i.recipeId)&&i.sourceRefs.length));
check('推荐没有估算数字', !/purineMg|proteinG|grams|totalPurine|proteinTarget/.test(JSON.stringify(plan)));
check('同一天结果稳定', JSON.stringify(plan)===JSON.stringify(buildDayPlan({date:'2026-10-30'})));
check('换天结果变化', JSON.stringify(plan.meals)!==JSON.stringify(buildDayPlan({date:'2026-10-31'}).meals));
check('不再生成清炒番茄', !JSON.stringify(plan).includes('清炒番茄'));

console.log('\n=== 5. 用餐记录汇总 ===');
const intake=computeIntake([
 {slot:'lunch',items:plan.meals.lunch.items},
 {slot:'dinner',items:[{foodId:'tofu',grams:9999}]}
], Object.fromEntries(FOODS.map(f=>[f.id,f])));
check('汇总已吃餐次和菜名', intake.mealCount===2&&intake.dishes.includes('豆腐'));
check('旧克数不参与计算', !/purine|protein|grams|budget|fructose/.test(JSON.stringify(intake)));

console.log('\n=== 6. 减重速度 ===');
const fast = weightCheck([{ date: '2026-10-01', kg: 80 }, { date: '2026-10-15', kg: 76 }], 76);
check('两周掉 4kg 判定为过快', fast.tooFast === true, `${fast.perWeek}kg/周`);
console.log(`   ${fast.message}`);
const ok = weightCheck([{ date: '2026-10-01', kg: 80 }, { date: '2026-10-29', kg: 77 }], 77);
check('一个月掉 3kg 判定正常', ok.tooFast === false, `${ok.perWeek}kg/周`);

console.log('\n=== 7. BMI ===');
check('70kg/175cm → 22.9 正常', Math.abs(bmi(70, 175) - 22.9) < 0.05, `${bmi(70, 175)}`);

console.log('\n=== 8. 存储 ===');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-test-'));
const file = path.join(tmp, 'health.json');
const store = new Store(file);
check('初始目标按体重推算', store.effectiveWaterTarget === 2450, `${store.effectiveWaterTarget}`);

store.addWater(200);
store.addWater(300);
check('累加饮水', store.today().water === 500, `${store.today().water}`);
store.undoLastWater();
check('撤销上一次', store.today().water === 200, `${store.today().water}`);

store.logMeal({ slot: 'breakfast', items: [{ foodId: 'milk_lowfat', grams: 250 }] });
store.logWeight(80, '2026-10-01');
store.logWeight(79.2, '2026-10-08');
check('体重记录 2 条', store.data.weights.length === 2);

const store2 = new Store(file);
check('持久化后重读一致', store2.today().water === 200, `${store2.today().water}`);
check('饮食记录持久化', store2.today().meals.length === 1);
check('近两天食物 id', store2.recentFoodIds(2).includes('milk_lowfat'));

const snap = store2.snapshot();
check('快照含 7 天', snap.days.length === 7);

console.log('\n=== 9. 今日总评 ===');
const verdict = dailyVerdict({ waterStatus: sNoon, intake, weight: null });
console.log(`   "${verdict}"`);

console.log('\n=== 10. 托盘图标 ===');
const iconDir = path.join(tmp, 'icons');
fs.mkdirSync(iconDir);
for (const p of [0, 0.25, 0.6, 1]) {
  const buf = makeRingPng(64, p, {});
  fs.writeFileSync(path.join(iconDir, `ring-${String(p).replace('.', '_')}.png`), buf);
  check(`progress=${p} 生成 PNG`, buf.length > 100, `${buf.length} bytes`);
}
const dimBuf = makeRingPng(32, 0.6, { dim: true });
check('dim 变体可生成', dimBuf.length > 100);

console.log(`\n   图标样例: ${iconDir}`);
console.log(`   测试数据: ${tmp}`);

console.log('\n=== 11. 食物库 ===');
check('食物条目 > 50', FOODS.length > 50, `${FOODS.length} 条`);
check('避免档有内容', FOODS.filter((f) => f.tier === 'avoid').length >= 15);
check('食物 id 唯一', new Set(FOODS.map((f) => f.id)).size === FOODS.length);

console.log(`\n${'='.repeat(44)}`);
console.log(`结果: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(44) + '\n');
process.exit(fail ? 1 : 0);
