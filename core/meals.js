const MEAL_SLOTS = Object.freeze({breakfast:'早餐', lunch:'午餐', dinner:'晚餐', snack:'加餐'});
const MAX_MEAL_TEXT = 300;
const mealRevision = meal => Number.isFinite(meal?.updatedAt) ? meal.updatedAt : Number.isFinite(meal?.ts) ? meal.ts : 0;
function manualMealText(value) {
  if (typeof value !== 'string') throw new Error('请填写吃了什么');
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text) throw new Error('请填写吃了什么');
  if (text.length > MAX_MEAL_TEXT) throw new Error('用餐内容请控制在 300 字以内');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error('用餐内容包含无效字符，请重新输入');
  return text;
}
module.exports = {MEAL_SLOTS, MAX_MEAL_TEXT, mealRevision, manualMealText};
