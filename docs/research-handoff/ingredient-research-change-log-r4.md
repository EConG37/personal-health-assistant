# r4 变更日志：逐项对应复验 A/B/C 与报告口径

**基准**：`ingredient-research-acceptance-r3.md` + `acceptance-r3/automated-checks.json` + `content-checks.json`
**输入**：r3 JSON/报告/日志、原任务、v2 Schema、基线
**输出**：`health-ingredient-reference-r4.json`、`ingredient-research-summary-r4.md`、本日志
**未改动**：r1/r2/r3 原件、软件运行数据、候选附录（继续隔离）

---

## A. 5种非肉类尿酸模板（复验A）

| food_id | 修改前 | 修改后 | 原则ID |
|---|---|---|---|
| beer | "嘌呤值属第一类≥150mg/100g；不在不宜名单；汆煮弃汤" | 限制饮酒：酒精促尿酸生成+减少排泄；啤酒含嘌呤（黄酒较高其次啤酒）；急性期/慢性期/药控不佳不饮酒；无嘌呤分类断言、无肉类操作 | RULE_URIC_ALCOHOL |
| liquor | 同上 | 指南原文：白酒嘌呤低但酒精度高、乳酸堆积抑制排泄；急性期等不饮酒 | RULE_URIC_ALCOHOL |
| sugary_drink | 同上 | 限制果糖食品（含糖饮料）；明确"不属于嘌呤分类讨论对象" | RULE_URIC_FRUCTOSE |
| juice | 同上 | 限制鲜榨果汁、吃完整水果；同上 | RULE_URIC_FRUCTOSE |
| honey | 同上 | 限制果糖食品；同上 | RULE_URIC_FRUCTOSE |

同步：5条的 conditions 删除"汆煮后食用/不喝汤/计入嘌呤总量"；preparation_notes 清空。
校验：5条文本中"第一类"=0、"汆煮"=0、"RULE_URIC_PURINE_CLASS"=0。

---

## B. 15处文字残留（复验B）

| # | 路径 | 原值 | 处理 |
|---|---|---|---|
| 1 | egg_white.pressure | 钠166mg/100g | 删除；改"钠不高（数值待核）" |
| 2 | oyster.pressure | 钠约270mg/100g | 删除；改"品种/加工差异大（未获条目）" |
| 3 | celery.pressure | 钠约80mg/100g | 删除；改"相对偏高（数值待核）" |
| 4 | fish_cod.lipids | 脂肪仅0.5g/100g | 删除；改"生/烤形态不同、未保留数值" |
| 5 | noodle.pressure | 一碗面含盐2g以上 | 删除；改"干基钠看标签、弃汤" |
| 6 | olive_oil.lipids | SFA约14% | 删除；改"以单不饱和脂肪为主（比例未核实）" |
| 7 | honey.glucose | 约80%为糖 | 删除；改"以糖为主（组成待核）" |
| 8 | sugary_drink.general | 500ml超50g糖 | 删除；改"以标签为准" |
| 9 | watermelon.glucose | 单次≤200g时GL有限 | 删除；改"个体化份量、计入总能量、不做GL判断" |
| 10 | walnut.lipids | 每日10～15g | 删除；改"单品用量无指南依据" |
| 11 | almond.lipids | 每日10～15g | 同上 |
| 12 | beer.pressure | 500ml接近男性上限 | 删除；改"按标签酒精度折算" |
| 13 | liquor.pressure | 50度白酒约62ml | 删除；改"按标签折算，不提供毫升换算" |
| 14 | new_salt.glucose | 每日≤5g | 删除；改"按合并疾病管理" |
| 15 | new_salt.lipids | 每日≤5g | 同上 |

**额外同类清理**（复验未列但同一问题）：
- lotus_root.notes："碳水11.5g/100g"→删除
- new_soy_sauce.notes："5ml约330mg钠"→"按标签折算"
- sweet_potato.pressure："富钾337mg/100g"→"薯类通常含钾（数值待核）"
- tofu_dry.pressure："钠可达数百mg"→"卤制通常更高（看标签）"
- tea_green.uric："嘌呤1mg/100g"→该形态嘌呤已因体积口径置空，改"未获得该形态可核算值"
- lamb_lean.lipids："羊肉串223mg/100g"→"高嘌呤高脂类别"
- cabbage_round/onion/bok_choy三处畸形句（"未收录mg/100g"）→重写为规范表述

---

## C. 9个weight标签（复验C）

| food_id | r3 | r4 | 独立依据 |
|---|---|---|---|
| bread_whole | compatible | compatible | 全谷物主食，肥胖指南全谷物占谷物一半；主食定量 |
| oats | compatible | compatible | 全谷物；主食定量、不加糖 |
| seaweed_dried | compatible | compatible | 干制海藻作配菜少量；蔬菜充足方向 |
| sardine | compatible | compatible | 鱼类，优先低脂动物性食物 |
| anchovy | compatible | **limit** | 加工水产罐头高盐高油；少选加工食品 |
| dried_fish | compatible | **limit** | 干制加工水产高盐 |
| mushroom_dried | compatible | compatible | 菌藻类蔬菜，泡发后作蔬菜 |
| new_salt | compatible | **limit** | 肥胖指南食盐≤5g；份量恢复"每日≤5g" |
| new_starch | compatible | **limit** | 纯碳水化合物（定义性），计入主食碳水 |

**额外标签调整**：
- new_soy_sauce.weight：compatible→limit（高钠调味品，按标签折算）
- liver_pork/liver_duck/kidney.weight：compatible→not_specifically_addressed（肥胖指南未涉及内脏）
- oyster/scallop.weight：compatible→not_specifically_addressed（指南未单列贝类）
- fish_cod.weight：默认模板→compatible（鱼类优先蛋白，独立依据）

**默认模板改造**：删除"未获得能量值→compatible"的统一逻辑。现按类别：
- VEG（20种）：蔬菜≥500g框架
- FRUIT（9种）：水果总量+计入总能量
- PROT（18种）：优先低脂动物性食物/豆制品
- STAPLE（10种）：主食定量、全谷物一半
- DRINK（3种）：替代含糖饮料
每类引用肥胖指南对应条款；不再出现"未获得该食材可核算能量值，不作数值判断"作为标签理由（校验=0）。

---

## D. 报告口径更正（复验"报告统计需同步更正"）

| 原表述 | 更正 |
|---|---|
| "评估文字中仅剩2处数字" | 不成立。体重理由中能量数值8处（全部与指标一致）；另有已核嘌呤、指南总量、明确跨食品参考；15处未核实值已删除 |
| "份量仅16条" | 仅`portion_guidance`字段计数（r4=17，新增食盐weight 5g）；文本中另有指南总量，不能等同 |
| "无不同食品套值" | 仅适用于r3修好的7项；其他跨食品引用是明确标注的参考（如"表列挂面21""竹笋13参考"） |
| "文字不再借用任何未核实数字" | 撤回。准确表述见summary-r4 B节四类构成 |

---

## E. 校验与统计（r4）

- Schema v2：0错误；89食材/102形态/623评估/545指标/19来源/17审计/11缺口。
- 指标：139单值（USDA 80+嘌呤59）、1仅区间、405空值。
- `portion_guidance`非空17；含直接引用评估604（-5：5条器官/贝类weight改NA）。
- 专项检查：A模板残留0；B 15处关键字残留0；全库成分断言扫描0；C 9个标签符合预期、默认"缺能量"表述0。
- 通用检查：`direct→unavailable`=0、`direct+题录`=0、`value+range`=0、`not_found+range`=0、`numeric无引用`=0、单位冲突=0、悬空引用=0。

---

## F. 仍未解决（与r3一致，未改善的部分不掩盖）

1. 405项成分空值；中国食物成分表官方库不可访问。
2. 无单品GI数值；GI检索页可用但未完成逐食物匹配。
3. USDA仅8条（配额429），SR Legacy/FNDDS报告值，非实测。
4. 国内脂肪肝指南、膳食指南2022、糖尿病/高脂血症2023食养指南仍缺。
5. 肝目标59条compatible为模式推断；14条NA。
6. 普通小麦鲜面、玉米淀粉、全麦面包、香肠腊肉、烧烤卤味的成分/嘌呤为空。
7. 特殊人群、多目标冲突、过敏原交叉接触仍需专业与产品共同设计。

**能力边界**：当前库不能做营养累计计算或自动推荐；真实菜品名称与配方资料收集可独立开展。