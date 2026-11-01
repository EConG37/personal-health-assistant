/**
 * 本地存储。P0 用单文件 JSON——数据量一年也就几千条，没必要引入原生依赖。
 * 路径由调用方注入，保证核心层可以脱离 Electron 单独跑。
 */

const fs = require('fs');
const path = require('path');
const { waterTarget } = require('./rules');
const { validateProfile, needsWaterAdvice } = require('./profile');
const crypto = require('crypto');
const {MEAL_SLOTS, mealRevision, manualMealText} = require('./meals');

const VERSION = 2;

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultState() {
  return {
    version: VERSION,
    profile: {
      weightKg: 70,
      heightCm: 175,
      uricAcid: null,
      targetWaterMl: null,
      cupMl: 250,
      motionMode: 'system',
      wakeAt: '07:30',
      sleepAt: '23:30',
      remindGapMin: 60,
      notifyMode: 'silent', // silent=只换托盘图标；notify=升级到系统通知
      onboarded: false,
      onboardingVersion: 0,
      goals: ['uric'], favoriteFoods: [], dislikedFoods: [], allergies: [], conditions: [],
      diet: 'omnivore', mealSource: 'mixed', cooking: 'mixed', clinicianNote: ''
    },
    days: {},
    weights: [],
    sync: { enabled:false, provider:'cli', baseToken:'', tableId:'', recordIds:{}, hashes:{}, lastSuccess:null },
    createdAt: new Date().toISOString()
  };
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = defaultState();
    this.load();
    this.committed = structuredClone(this.data);
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) return this.data;
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.data = { ...defaultState(), ...raw, profile: { ...defaultState().profile, ...(raw.profile || {}) } };
      this.data.version = VERSION;
      this.data.sync = { ...defaultState().sync, ...(raw.sync || {}) };
      if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) this.data.days = {};
      if (!Array.isArray(raw.weights)) this.data.weights = [];
    } catch (err) {
      // 文件损坏时保留原文件，避免直接覆盖用户数据
      try {
        fs.copyFileSync(this.filePath, this.filePath + '.corrupt-' + Date.now());
      } catch (_) {}
      this.data = defaultState();
    }
    return this.data;
  }

  save() {
    const dir = path.dirname(this.filePath);
    const tmp = this.filePath + '.tmp';
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
      this.committed = structuredClone(this.data);
    } catch(err) { this.data = structuredClone(this.committed); throw new Error('本地保存失败，请检查数据目录权限后重试'); }
  }

  get profile() {
    return this.data.profile;
  }

  /** 目标水量：用户没手动指定就按体重推算 */
  get effectiveWaterTarget() {
    const p = this.data.profile;
    if (needsWaterAdvice(p) && !p.targetWaterMl) return 0;
    return p.targetWaterMl || waterTarget({ weightKg: p.weightKg });
  }

  day(key = todayKey()) {
    if (!this.data.days[key]) {
      this.data.days[key] = { water: 0, logs: [], meals: [] };
    }
    return this.data.days[key];
  }

  today() {
    return this.day(todayKey());
  }

  addWater(ml, ts = Date.now()) {
    if (!Number.isFinite(ml) || ml <= 0 || ml > 2000) throw new Error('饮水记录应为 1–2000 ml');
    const d = this.today();
    d.water += ml;
    d.logs.push({ id:crypto.randomUUID(), ts, ml, type: 'water' });
    this.save();
    return d.water;
  }

  undoLastWater() {
    const d = this.today();
    const last = [...d.logs].reverse().find((l) => l.type === 'water');
    if (!last) return d.water;
    d.logs = d.logs.filter((l) => l !== last);
    d.deletedLogIds = [...(d.deletedLogIds || []), last.id || `legacy:${last.ts}:${last.ml}`];
    d.water = Math.max(0, d.water - last.ml);
    this.save();
    return d.water;
  }

  logMeal({ slot, items, source = 'plan', ts = Date.now() }) {
    const d = this.today();
    if (d.meals.some(m=>m.slot===slot)) throw new Error('这餐已经记录过了');
    d.meals.push({ ts, slot, items, source });
    this.save();
    return d;
  }

  logManualMeal(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('用餐记录格式无效');
    const {slot, text, date = todayKey(), expectedRevision} = input;
    if (!Object.hasOwn(MEAL_SLOTS, slot)) throw new Error('请选择早餐、午餐、晚餐或加餐');
    if (date !== todayKey()) throw new Error('日期已变更，请复制输入内容，再重新打开记餐窗口');
    const name = manualMealText(text);
    const previous = this.today().meals.find(meal => meal.slot === slot);
    if (!Number.isFinite(expectedRevision) || expectedRevision !== mealRevision(previous)) throw new Error('这餐的记录已更新，请关闭窗口后重新打开，再确认内容');
    const updatedAt = Math.max(Date.now(), mealRevision(previous) + 1);
    const meal = {slot, source:'manual', items:[{name}], ts:previous?.ts || updatedAt, updatedAt};
    const day = this.today();
    day.meals = [...day.meals.filter(value => value.slot !== slot), meal];
    this.save();
    return day;
  }

  setCardState(slot, patch) {
    if(!['breakfast','lunch','dinner'].includes(slot)) throw new Error('请选择早餐、午餐或晚餐');
    const d=this.today();d.cardState ||= {};
    d.cardState[slot]={nonce:0,revealed:[],...(d.cardState[slot]||{}),...patch,updatedAt:Date.now()};
    this.save();return d.cardState[slot];
  }

  chooseMeal(slot, choice) {
    if(!['breakfast','lunch','dinner'].includes(slot)) throw new Error('餐次无效');
    const d=this.today();d.mealChoices ||= {};
    d.mealChoices[slot]={...choice,updatedAt:Date.now()};this.save();return d.mealChoices[slot];
  }

  setProfile(patch) {
    const previous = structuredClone(this.data);
    this.data.profile = { ...this.data.profile, ...validateProfile(patch, this.data.profile) };
    if (this.data.profile.weightKg !== previous.profile.weightKg) {
      const date=todayKey();
      this.data.weights=this.data.weights.filter(w=>w.date!==date);
      this.data.weights.push({date,kg:this.data.profile.weightKg});
      this.data.weights.sort((a,b)=>a.date.localeCompare(b.date));
      this.day(date).weightKg=this.data.profile.weightKg;
    }
    try { this.save(); } catch (err) { this.data = previous; throw err; }
    return this.data.profile;
  }

  logWeight(kg, date = todayKey()) {
    if (!Number.isFinite(kg) || kg<30 || kg>250) throw new Error('体重应在 30–250 kg 内');
    this.data.weights = this.data.weights.filter((w) => w.date !== date);
    this.data.weights.push({ date, kg });
    this.data.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
    this.day(date).weightKg = kg;
    this.save();
    return this.data.weights;
  }

  /** 近 n 天，按日期升序 */
  recentDays(n = 7) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayKey(d);
      out.push({ date: key, ...(this.data.days[key] || { water: 0, logs: [], meals: [] }) });
    }
    return out;
  }

  /** 近两天吃过的 foodId，用于推荐去重 */
  recentFoodIds(days = 2) {
    const ids = new Set();
    for (const d of this.recentDays(days)) {
      for (const m of d.meals || []) {
        for (const it of m.items || []) for(const id of it.ingredientIds || [it.foodId]) if(id)ids.add(id);
      }
    }
    return [...ids];
  }

  /** 连续达标天数 */
  streak() {
    if (this.effectiveWaterTarget <= 0) return 0;
    let n = 0;
    for (let i = 1; i <= 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = this.data.days[todayKey(d)];
      const target = this.effectiveWaterTarget;
      if (day && day.water >= target) n++;
      else break;
    }
    const todayDone = this.today().water >= this.effectiveWaterTarget;
    return todayDone ? n + 1 : n;
  }

  snapshot() {
    return {
      profile: this.data.profile,
      today: this.today(),
      todayKey: todayKey(),
      days: this.recentDays(7),
      weights: this.data.weights.slice(-30),
      streak: this.streak(),
      effectiveWaterTarget: this.effectiveWaterTarget
    };
  }
}

module.exports = { Store, todayKey, defaultState };
