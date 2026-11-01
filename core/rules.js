/**
 * 饮水节奏、身体记录与用餐记录汇总。不计算餐食营养含量。
 */

// ---------------- 常量 ----------------

/** 单次饮水计量单位（ml），用于把总量拆成节奏 */
const CUP_ML = 250;

/** 提醒容差：落后预期超过这个量才算「该喝了」，避免刚坐下就被催 */
const TOLERANCE_ML = 250;

/** 两次提醒的最小间隔（分钟） */
const MIN_REMIND_GAP_MIN = 45;

// ---------------- 基础计算 ----------------

/**
 * 每日饮水目标。
 * 基础公式 35ml/kg。64 岁以下、肾功能正常、无限制水医嘱的成人适用。
 * 上限收到 3000ml：一次性大量饮水反而增加心脏和肾脏负担，分次比总量重要。
 */
function waterTarget({ weightKg = 70, exercise = false, hot = false } = {}) {
  let ml = weightKg * 35;
  if (exercise) ml += 400;
  if (hot) ml += 300;
  return Math.round(Math.min(Math.max(ml, 1800), 3000) / 50) * 50;
}

function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}

function bmiLabel(v) {
  if (v == null) return '';
  if (v < 18.5) return '偏瘦';
  if (v < 24) return '正常';
  if (v < 28) return '超重';
  return '肥胖';
}

function parseHM(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!m) return null;
  if (Number(m[1])>23 || Number(m[2])>59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ---------------- 饮水节奏 ----------------

/**
 * 把「今天要喝多少」拆成「现在该到哪个刻度」。
 * 关键设计：用线性进程曲线做参照，而不是固定间隔弹窗——这样开会两小时不会被连续打断，
 * 散会后一次性看到落后量，符合人的注意力节奏。
 */
function waterStatus({ profile, day, now = new Date() }) {
  const cupMl=profile.cupMl || CUP_ML;
  const restricted = (profile.conditions || []).some(x=>['kidney','heart','pregnant','minor'].includes(x));
  const paused = restricted && !profile.targetWaterMl;
  const target = paused ? 0 : profile.targetWaterMl || waterTarget({ weightKg: profile.weightKg });
  const drunk = day && day.water ? day.water : 0;
  const progress = target ? Math.min(1, drunk / target) : 0;

  const wake = parseHM(profile.wakeAt) ?? 450; // 07:30
  const sleep = parseHM(profile.sleepAt) ?? 1410; // 23:30
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const windowLen = Math.max(1, (sleep - wake + 1440) % 1440);
  const sinceWake = (nowMin - wake + 1440) % 1440;
  const inWindow = !paused && sinceWake < windowLen;
  const elapsed = inWindow ? sinceWake : (wake<sleep && nowMin<wake ? 0 : windowLen);
  const f = elapsed / windowLen;

  const expected = Math.round(target * f);
  const delta = drunk - expected;
  const remaining = Math.max(0, target - drunk);

  // 前 30 分钟只看进度不提醒，避免刚起床就被催
  const due = inWindow && elapsed > 30 && delta < -TOLERANCE_ML;
  const goalMet = !paused && drunk >= target;

  // 下一次「该喝」的时间：解 drunk + TOLERANCE = target * f'
  let nextCupAt = null;
  if (inWindow && !goalMet) {
    if (due) {
      nextCupAt = new Date(now);
    } else {
      const fNeed = (drunk + TOLERANCE_ML) / target;
      nextCupAt = new Date(now.getTime() + Math.max(0,fNeed*windowLen-elapsed)*60000);
    }
  }

  return {
    target,
    paused,
    drunk,
    progress,
    remaining,
    expected,
    delta,
    due,
    goalMet,
    inWindow,
    cupsLeft: Math.ceil(remaining / cupMl),
    cupMl,
    nextCupAt: nextCupAt ? nextCupAt.toISOString() : null,
    cupEveryMin: Math.round(windowLen / Math.max(1, target / cupMl))
  };
}

// ---------------- 提醒文案 ----------------

/**
 * 分级投递的文案。刻意不用祈使句、不制造压力。
 * 语言本身就是投递策略的一部分——「你必须」会被反感，「不着急」才会被采纳。
 */
function reminderCopy(status, level = 1) {
  const left = status.remaining;
  if (level <= 1) {
    return { title: '', body: `${left}ml 待补`, silent: true };
  }
  if (level === 2) {
    return {
      title: '还差一点水',
      body: `今天还差 ${left}ml，不着急，半小时后我再提醒。`,
      silent: false
    };
  }
  return {
    title: '今天的水还没喝够',
    body: `还差 ${left}ml。翻到「今日」点一下就记上了。`,
    silent: false
  };
}

function goalCopy() {
  return { title: '饮水目标已完成', body: '今天的量达标了，接下来按口渴程度与医嘱饮水。' };
}

// ---------------- 用餐记录 ----------------

/**
 * 只汇总已记录的餐次与菜名；旧记录的克数不再用于推算营养。
 */
function computeIntake(meals = [], foodsById = {}) {
  const dishes=meals.flatMap(m=>(m.items||[]).map(item=>item.dishName||item.name||foodsById[item.foodId]?.name).filter(Boolean));
  return {mealCount:meals.length,dishes};
}

/** 减重速度检查：掉秤太快会让酮体竞争尿酸排泄，直接诱发急性发作 */
function weightCheck(history, currentKg) {
  if (!history || history.length < 2 || !currentKg) return null;
  const last = history[history.length - 1];
  const first = history[0];
  const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  const perWeek = ((first.kg - currentKg) / days) * 7;
  return {
    perWeek: +perWeek.toFixed(2),
    tooFast: perWeek > 1.0,
    message:
      perWeek > 1.0
        ? `近 ${Math.round(days)} 天平均每周掉 ${perWeek.toFixed(1)}kg，偏快。掉太快会让酮体抢占尿酸排泄通道，反而诱发发作，建议放到 0.5–1kg/周。`
        : null
  };
}

/** 今日一句总评 —— 只给一条，不要堆砌 */
function dailyVerdict({ waterStatus: ws, weight }) {
  if (weight && weight.tooFast) return weight.message;
  if (ws && ws.due) return `水落后计划 ${Math.abs(ws.delta)}ml。`;
  if (ws && ws.paused) return '饮水目标等待医生确认，暂不催促补水。';
  if (ws && ws.goalMet) return '今天的饮水目标已完成。';
  return '节奏正常，继续。';
}

module.exports = {
  CUP_ML,
  TOLERANCE_ML,
  MIN_REMIND_GAP_MIN,
  waterTarget,
  bmi,
  bmiLabel,
  parseHM,
  waterStatus,
  reminderCopy,
  goalCopy,
  computeIntake,
  weightCheck,
  dailyVerdict
};
