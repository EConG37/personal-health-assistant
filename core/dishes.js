const catalog = require('./data/guide-dishes.json');
const { FOODS } = require('./foods');
const { exclusionReason, needsClinicalPlan, ALLERGIES } = require('./profile');
const DISHES = catalog.dishes;
const GUIDE_SOURCES = catalog.sources;
const GUIDE_VERSION = catalog.version;
const DISH_BY_ID = new Map(DISHES.map(d => [d.id, d]));
const FOOD_BY_ID = new Map(FOODS.map(f => [f.id, f]));

function dishExclusionReason(dish, profile = {}) {
  if (!dish) return '菜品已更新';
  if (needsClinicalPlan(profile)) return '请按个体用餐方案选择';
  const allergy = (profile.allergies || []).find(a => dish.allergens.includes(a));
  if (allergy) return `已排除：${ALLERGIES.find(a => a.id === allergy)?.name}过敏`;
  if (profile.diet === 'vegan' && (dish.containsAnimalMeat || dish.allergens.some(a => ['egg', 'milk', 'fish', 'shellfish'].includes(a)))) return '已排除：纯素偏好';
  if (profile.diet === 'vegetarian' && dish.containsAnimalMeat) return '已排除：蛋奶素偏好';
  for (const id of dish.ingredientIds) {
    const food = FOOD_BY_ID.get(id);
    if (food) { const reason = exclusionReason(food, profile); if (reason) return reason; }
  }
  // Animal dishes for the uric goal must also appear in the gout guide.
  if ((profile.goals || []).includes('uric') && dish.containsAnimalMeat && !dish.relatedSources.some(id => GUIDE_SOURCES[id].goal === 'uric')) return '当前尿酸目标下暂无对应指南菜品';
  return '';
}

function recipeItem(dish, profile = {}) {
  return {
    recipeId: dish.id, foodId: dish.coverFoodId, name: dish.name, dishName: dish.name,
    cat: FOOD_BY_ID.get(dish.coverFoodId)?.cat || '', role: dish.kind,
    ingredientIds: [...dish.ingredientIds], ingredients: [...dish.ingredients],
    allergens: [...dish.allergens],
    favorite: dish.ingredientIds.some(id => (profile.favoriteFoods || []).includes(id)),
    sourceRefs: dish.sourceRefs.map(ref => ({ ...ref, ...GUIDE_SOURCES[ref.sourceId] }))
  };
}

function sourceUrlAllowed(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search &&
      (!url.hash || /^#page=\d+$/.test(url.hash)) && Object.values(GUIDE_SOURCES).some(s => {
        const source = new URL(s.url);
        return url.origin === source.origin && url.pathname === source.pathname;
      });
  } catch { return false; }
}
module.exports = { DISHES, DISH_BY_ID, GUIDE_SOURCES, GUIDE_VERSION, dishExclusionReason, recipeItem, sourceUrlAllowed };
