/**
 * 食材名称、偏好与图片的关联表。
 * 下列营养值、档位及份量是旧原型遗留字段，未逐条核实。
 * 当前菜品推荐、忌口筛选与用餐汇总均不读取这些字段。
 *
 * purine   : 嘌呤含量，mg/100g（常见食物嘌呤含量表参考值，非精确测量）
 * fructose : 果糖负荷等级 0=无 1=低 2=中 3=高（果糖在肝脏代谢直接消耗 ATP 生成尿酸）
 * protein  : 蛋白质 g/100g
 * tier     : good=可常吃 / ok=限量 / avoid=避免
 * role     : 组餐时使用的角色
 * slots    : 适合的餐次
 * portion  : 一份的克数（用于估算嘌呤与蛋白负荷）
 */

const FOODS = [
  // ---------- 乳制品：低脂乳制品是少数有循证支持的「促尿酸排泄」食物 ----------
  { id: 'milk_lowfat', name: '低脂牛奶', cat: '乳制品', purine: 1, fructose: 1, protein: 3.4, tier: 'good', role: 'dairy', slots: ['breakfast', 'snack'], portion: 250, note: '低脂乳制品有助尿酸排泄，可每天 300ml' },
  { id: 'yogurt_plain', name: '无糖酸奶', cat: '乳制品', purine: 1, fructose: 1, protein: 3.5, tier: 'good', role: 'dairy', slots: ['breakfast', 'snack'], portion: 150, note: '选无糖，含糖酸奶的果糖抵消好处' },
  { id: 'yogurt_greek', name: '希腊酸奶', cat: '乳制品', purine: 2, fructose: 1, protein: 9.0, tier: 'good', role: 'dairy', slots: ['breakfast', 'snack'], portion: 130, note: '蛋白高、糖低' },
  { id: 'cheese', name: '奶酪', cat: '乳制品', purine: 1, fructose: 0, protein: 25, tier: 'ok', role: 'dairy', slots: ['breakfast', 'snack'], portion: 30, note: '钠偏高，控制量' },

  // ---------- 蛋 ----------
  { id: 'egg', name: '鸡蛋', cat: '蛋类', purine: 2, fructose: 0, protein: 13, tier: 'good', role: 'protein', slots: ['breakfast', 'lunch', 'dinner'], portion: 110, note: '嘌呤极低，优质蛋白来源；一份按两个蛋算' },

  // ---------- 主食 ----------
  { id: 'rice_white', name: '白米饭', cat: '主食', purine: 18, fructose: 0, protein: 2.6, tier: 'good', role: 'staple', slots: ['lunch', 'dinner'], portion: 150, note: '' },
  { id: 'rice_mixed', name: '杂粮饭', cat: '主食', purine: 30, fructose: 0, protein: 3.2, tier: 'good', role: 'staple', slots: ['lunch', 'dinner'], portion: 150, note: '全谷物有助代谢，嘌呤略高但不影响' },
  { id: 'noodle', name: '面条', cat: '主食', purine: 19, fructose: 0, protein: 4.5, tier: 'good', role: 'staple', slots: ['lunch', 'dinner'], portion: 180, note: '汤面别喝汤' },
  { id: 'bread_whole', name: '全麦面包', cat: '主食', purine: 24, fructose: 1, protein: 9.0, tier: 'good', role: 'staple', slots: ['breakfast'], portion: 80, note: '' },
  { id: 'oats', name: '燕麦片', cat: '主食', purine: 94, fructose: 0, protein: 13, tier: 'ok', role: 'staple', slots: ['breakfast'], portion: 40, note: '嘌呤偏中，但降脂有益，隔天吃' },
  { id: 'sweet_potato', name: '红薯', cat: '主食', purine: 15, fructose: 1, protein: 1.1, tier: 'good', role: 'staple', slots: ['breakfast', 'lunch', 'dinner'], portion: 150, note: '' },
  { id: 'corn', name: '玉米', cat: '主食', purine: 9, fructose: 1, protein: 3.3, tier: 'good', role: 'staple', slots: ['lunch', 'dinner'], portion: 150, note: '' },
  { id: 'potato', name: '土豆', cat: '主食', purine: 6, fructose: 0, protein: 2.0, tier: 'good', role: 'staple', slots: ['lunch', 'dinner'], portion: 150, note: '' },
  { id: 'congee_rice', name: '白粥', cat: '主食', purine: 7, fructose: 0, protein: 1.1, tier: 'good', role: 'staple', slots: ['breakfast'], portion: 300, note: '' },
  { id: 'congee_millet', name: '小米粥', cat: '主食', purine: 8, fructose: 0, protein: 1.4, tier: 'good', role: 'staple', slots: ['breakfast'], portion: 300, note: '' },
  { id: 'yam', name: '山药', cat: '主食', purine: 8, fructose: 0, protein: 1.9, tier: 'good', role: 'staple', slots: ['breakfast', 'lunch', 'dinner'], portion: 120, note: '' },
  { id: 'lotus_root', name: '莲藕', cat: '蔬菜', purine: 15, fructose: 0, protein: 1.9, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 120, note: '' },

  // ---------- 蔬菜 ----------
  { id: 'broccoli', name: '西兰花', cat: '蔬菜', purine: 70, fructose: 0, protein: 4.1, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 150, note: '嘌呤中等但属植物嘌呤，可正常吃' },
  { id: 'cucumber', name: '黄瓜', cat: '蔬菜', purine: 3, fructose: 0, protein: 0.6, tier: 'good', role: 'veg', slots: ['lunch', 'dinner', 'snack'], portion: 150, note: '水分高，有助总水量' },
  { id: 'tomato', name: '番茄', cat: '蔬菜', purine: 4, fructose: 1, protein: 0.9, tier: 'good', role: 'veg', slots: ['breakfast', 'lunch', 'dinner'], portion: 150, note: '' },
  { id: 'cabbage', name: '大白菜', cat: '蔬菜', purine: 12, fructose: 0, protein: 1.5, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 150, note: '' },
  { id: 'carrot', name: '胡萝卜', cat: '蔬菜', purine: 8, fructose: 1, protein: 0.9, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 120, note: '' },
  { id: 'lettuce', name: '生菜', cat: '蔬菜', purine: 5, fructose: 0, protein: 1.3, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 120, note: '' },
  { id: 'pepper_green', name: '青椒', cat: '蔬菜', purine: 9, fructose: 1, protein: 1.0, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 100, note: '' },
  { id: 'spinach', name: '菠菜', cat: '蔬菜', purine: 57, fructose: 0, protein: 2.6, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 120, note: '植物嘌呤，研究显示不影响痛风风险' },
  { id: 'mushroom_fresh', name: '鲜蘑菇', cat: '蔬菜', purine: 28, fructose: 0, protein: 2.7, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 100, note: '干制后嘌呤浓缩数倍，别吃干香菇' },
  { id: 'winter_melon', name: '冬瓜', cat: '蔬菜', purine: 3, fructose: 0, protein: 0.4, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 200, note: '水分高、利尿' },
  { id: 'celtuce', name: '莴笋', cat: '蔬菜', purine: 8, fructose: 0, protein: 1.0, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 150, note: '' },
  { id: 'cabbage_round', name: '卷心菜', cat: '蔬菜', purine: 12, fructose: 0, protein: 1.5, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 150, note: '' },
  { id: 'onion', name: '洋葱', cat: '蔬菜', purine: 4, fructose: 0, protein: 1.1, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 100, note: '' },
  { id: 'eggplant', name: '茄子', cat: '蔬菜', purine: 14, fructose: 0, protein: 1.1, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 150, note: '少油做法' },
  { id: 'celery', name: '芹菜', cat: '蔬菜', purine: 8, fructose: 0, protein: 0.8, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 120, note: '' },
  { id: 'asparagus', name: '芦笋', cat: '蔬菜', purine: 150, fructose: 0, protein: 1.4, tier: 'ok', role: 'veg', slots: ['lunch', 'dinner'], portion: 80, note: '嘌呤偏高，偶尔少量' },
  { id: 'kelp', name: '海带', cat: '海藻', purine: 25, fructose: 0, protein: 1.2, tier: 'good', role: 'veg', slots: ['lunch', 'dinner'], portion: 80, note: '干海带嘌呤高，鲜海带可以' },

  // ---------- 蛋白（限量） ----------
  { id: 'tofu', name: '豆腐', cat: '豆制品', purine: 68, fructose: 0, protein: 8.1, tier: 'good', role: 'protein', slots: ['lunch', 'dinner'], portion: 150, note: '植物嘌呤，现代证据认为可适量吃' },
  { id: 'tofu_dry', name: '豆干', cat: '豆制品', purine: 66, fructose: 0, protein: 16.2, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 120, note: '' },
  { id: 'soy_milk', name: '无糖豆浆', cat: '豆制品', purine: 63, fructose: 1, protein: 3.0, tier: 'good', role: 'dairy', slots: ['breakfast'], portion: 250, note: '选无糖' },
  { id: 'chicken_breast', name: '鸡胸肉', cat: '禽肉', purine: 137, fructose: 0, protein: 20.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 100, note: '去皮' },
  { id: 'chicken_leg', name: '鸡腿肉', cat: '禽肉', purine: 140, fructose: 0, protein: 18.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 90, note: '去皮' },
  { id: 'pork_lean', name: '瘦猪肉', cat: '畜肉', purine: 122, fructose: 0, protein: 20.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 90, note: '全天红肉 ≤100g' },
  { id: 'beef_lean', name: '瘦牛肉', cat: '畜肉', purine: 83, fructose: 0, protein: 20.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 90, note: '' },
  { id: 'lamb_lean', name: '瘦羊肉', cat: '畜肉', purine: 111, fructose: 0, protein: 19.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 80, note: '' },
  { id: 'fish_cod', name: '鳕鱼', cat: '水产', purine: 109, fructose: 0, protein: 18.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 120, note: '清蒸做法' },
  { id: 'fish_bass', name: '鲈鱼', cat: '水产', purine: 110, fructose: 0, protein: 18.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 120, note: '清蒸' },
  { id: 'shrimp', name: '虾', cat: '水产', purine: 137, fructose: 0, protein: 18.0, tier: 'ok', role: 'protein', slots: ['lunch', 'dinner'], portion: 80, note: '每周不超过 2 次' },

  // ---------- 水果 ----------
  { id: 'cherry', name: '樱桃', cat: '水果', purine: 17, fructose: 2, protein: 1.0, tier: 'good', role: 'fruit', slots: ['breakfast', 'snack'], portion: 100, note: '有小型研究提示可能降尿酸，量仍要控制' },
  { id: 'apple', name: '苹果', cat: '水果', purine: 1, fructose: 2, protein: 0.3, tier: 'good', role: 'fruit', slots: ['breakfast', 'snack'], portion: 150, note: '' },
  { id: 'blueberry', name: '蓝莓', cat: '水果', purine: 3, fructose: 1, protein: 0.7, tier: 'good', role: 'fruit', slots: ['breakfast', 'snack'], portion: 80, note: '' },
  { id: 'pear', name: '梨', cat: '水果', purine: 1, fructose: 2, protein: 0.4, tier: 'good', role: 'fruit', slots: ['snack'], portion: 150, note: '' },
  { id: 'orange', name: '橙子', cat: '水果', purine: 2, fructose: 2, protein: 0.9, tier: 'good', role: 'fruit', slots: ['breakfast', 'snack'], portion: 120, note: '吃整个，不喝果汁' },
  { id: 'banana', name: '香蕉', cat: '水果', purine: 3, fructose: 2, protein: 1.1, tier: 'good', role: 'fruit', slots: ['breakfast', 'snack'], portion: 100, note: '' },
  { id: 'watermelon', name: '西瓜', cat: '水果', purine: 2, fructose: 2, protein: 0.6, tier: 'ok', role: 'fruit', slots: ['snack'], portion: 150, note: '果糖不低，控制在 200g 内' },
  { id: 'grape', name: '葡萄', cat: '水果', purine: 4, fructose: 3, protein: 0.5, tier: 'ok', role: 'fruit', slots: ['snack'], portion: 80, note: '果糖高，少量' },
  { id: 'lychee', name: '荔枝', cat: '水果', purine: 5, fructose: 3, protein: 0.8, tier: 'ok', role: 'fruit', slots: ['snack'], portion: 60, note: '果糖很高，一次不超过 5 颗' },

  // ---------- 饮品 / 其他 ----------
  { id: 'coffee', name: '黑咖啡', cat: '饮品', purine: 0, fructose: 0, protein: 0.1, tier: 'good', role: 'drink', slots: ['breakfast', 'snack'], portion: 200, note: '不加糖不加奶精；有轻微降尿酸关联' },
  { id: 'tea_green', name: '绿茶', cat: '饮品', purine: 0, fructose: 0, protein: 0, tier: 'good', role: 'drink', slots: ['breakfast', 'snack'], portion: 250, note: '算入总饮水量' },
  { id: 'water', name: '白水', cat: '饮品', purine: 0, fructose: 0, protein: 0, tier: 'good', role: 'drink', slots: ['breakfast', 'lunch', 'dinner', 'snack'], portion: 250, note: '' },
  { id: 'walnut', name: '核桃', cat: '坚果', purine: 40, fructose: 0, protein: 15.0, tier: 'ok', role: 'fat', slots: ['snack'], portion: 15, note: '每天一小把' },
  { id: 'almond', name: '杏仁', cat: '坚果', purine: 31, fructose: 0, protein: 21.0, tier: 'ok', role: 'fat', slots: ['snack'], portion: 15, note: '' },
  { id: 'olive_oil', name: '橄榄油', cat: '油脂', purine: 0, fructose: 0, protein: 0, tier: 'good', role: 'fat', slots: ['lunch', 'dinner'], portion: 10, note: '替代动物油' },

  // ---------- 避免清单 ----------
  { id: 'liver_pork', name: '猪肝', cat: '内脏', purine: 275, fructose: 0, protein: 19, tier: 'avoid', role: 'protein', slots: [], portion: 100, note: '内脏是嘌呤最高的类别之一' },
  { id: 'liver_duck', name: '鸭肝', cat: '内脏', purine: 301, fructose: 0, protein: 17, tier: 'avoid', role: 'protein', slots: [], portion: 100, note: '' },
  { id: 'kidney', name: '腰花', cat: '内脏', purine: 240, fructose: 0, protein: 16, tier: 'avoid', role: 'protein', slots: [], portion: 100, note: '' },
  { id: 'soup_rich', name: '浓肉汤 / 老火汤', cat: '汤类', purine: 300, fructose: 0, protein: 3, tier: 'avoid', role: 'drink', slots: [], portion: 300, note: '嘌呤易溶于水，汤比肉更危险' },
  { id: 'hotpot_soup', name: '火锅汤底', cat: '汤类', purine: 350, fructose: 0, protein: 2, tier: 'avoid', role: 'drink', slots: [], portion: 300, note: '煮过海鲜和肉之后嘌呤极高' },
  { id: 'sardine', name: '沙丁鱼', cat: '水产', purine: 295, fructose: 0, protein: 20, tier: 'avoid', role: 'protein', slots: [], portion: 100, note: '' },
  { id: 'anchovy', name: '凤尾鱼', cat: '水产', purine: 321, fructose: 0, protein: 20, tier: 'avoid', role: 'protein', slots: [], portion: 100, note: '' },
  { id: 'oyster', name: '牡蛎 / 生蚝', cat: '水产', purine: 239, fructose: 0, protein: 9, tier: 'avoid', role: 'protein', slots: [], portion: 100, note: '' },
  { id: 'scallop', name: '扇贝', cat: '水产', purine: 193, fructose: 0, protein: 15, tier: 'avoid', role: 'protein', slots: [], portion: 100, note: '' },
  { id: 'dried_fish', name: '小鱼干', cat: '水产', purine: 1538, fructose: 0, protein: 45, tier: 'avoid', role: 'protein', slots: [], portion: 30, note: '脱水后嘌呤极度浓缩' },
  { id: 'seaweed_dried', name: '干紫菜', cat: '海藻', purine: 274, fructose: 0, protein: 26, tier: 'avoid', role: 'veg', slots: [], portion: 10, note: '' },
  { id: 'mushroom_dried', name: '干香菇', cat: '蔬菜', purine: 214, fructose: 0, protein: 20, tier: 'avoid', role: 'veg', slots: [], portion: 10, note: '干制浓缩' },
  { id: 'beer', name: '啤酒', cat: '酒精', purine: 14, fructose: 1, protein: 0.5, tier: 'avoid', role: 'drink', slots: [], portion: 500, note: '酒精+嘌呤双重打击，且抑制排泄' },
  { id: 'liquor', name: '白酒', cat: '酒精', purine: 0, fructose: 0, protein: 0, tier: 'avoid', role: 'drink', slots: [], portion: 50, note: '酒精代谢产生乳酸，竞争尿酸排泄' },
  { id: 'sugary_drink', name: '含糖饮料', cat: '饮品', purine: 0, fructose: 3, protein: 0, tier: 'avoid', role: 'drink', slots: [], portion: 500, note: '果糖直接产尿酸，这类影响常被低估' },
  { id: 'juice', name: '果汁', cat: '饮品', purine: 0, fructose: 3, protein: 0.5, tier: 'avoid', role: 'drink', slots: [], portion: 300, note: '"纯果汁"同样高果糖，吃整个水果' },
  { id: 'honey', name: '蜂蜜', cat: '调味', purine: 0, fructose: 3, protein: 0.3, tier: 'avoid', role: 'fat', slots: [], portion: 20, note: '果糖约 40%' },
  { id: 'bbq', name: '烧烤 / 卤味', cat: '加工', purine: 150, fructose: 0, protein: 18, tier: 'avoid', role: 'protein', slots: [], portion: 150, note: '多为内脏、边角肉，且高盐' },
  { id: 'sausage', name: '香肠 / 腊肉', cat: '加工', purine: 120, fructose: 0, protein: 24, tier: 'avoid', role: 'protein', slots: [], portion: 80, note: '' }
];

FOODS.push(
  { id:'egg_white', name:'鸡蛋蛋白', cat:'蛋类', purine:2, fructose:0, protein:11, tier:'good', role:'protein', slots:['breakfast','lunch','dinner'], portion:100, note:'蛋过敏者同样需要排除' },
  { id:'tofu_soft', name:'嫩豆腐', cat:'豆制品', purine:40, fructose:0, protein:6.2, tier:'good', role:'protein', slots:['breakfast','lunch','dinner'], portion:180, note:'清蒸或炖煮，少放调味汁' },
  { id:'edamame', name:'鲜毛豆', cat:'豆制品', purine:48, fructose:0, protein:13.1, tier:'good', role:'protein', slots:['breakfast','lunch','dinner'], portion:100, note:'原味水煮，不用盐水卤制' },
  { id:'pumpkin', name:'南瓜', cat:'主食', purine:3, fructose:1, protein:1, tier:'good', role:'staple', slots:['breakfast','lunch','dinner'], portion:150, note:'作为主食替换，不额外叠加' },
  { id:'bok_choy', name:'小白菜', cat:'蔬菜', purine:12, fructose:0, protein:1.5, tier:'good', role:'veg', slots:['breakfast','lunch','dinner'], portion:150, note:'' },
  { id:'zucchini', name:'西葫芦', cat:'蔬菜', purine:8, fructose:0, protein:1.2, tier:'good', role:'veg', slots:['lunch','dinner'], portion:150, note:'' }
);
const BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

function byId(id) {
  return BY_ID[id] || null;
}

function byRole(role, slots) {
  return FOODS.filter((f) => f.role === role && f.tier !== 'avoid' && (!slots || f.slots.includes(slots)));
}

module.exports = { FOODS, byId, byRole };
