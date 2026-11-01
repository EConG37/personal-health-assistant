# r2 变更日志：逐项对应验收问题

**基准**：`ingredient-research-acceptance.md`（2026-10-31）+ `acceptance/automated-checks.json`
**输入**：`health-ingredient-reference.json`（r1）、`ingredient-research-summary.md`（r1）、原任务、v2 Schema、`health-food-baseline.json`
**输出**：`health-ingredient-reference-r2.json`、`ingredient-research-summary-r2.md`、本日志、`ingredient-research-unverified-candidates-r2.json`

---

## A. P1：373项成分数值仅有不可访问来源

| 项 | 内容 |
|---|---|
| 验收问题 | 373项数值仅指向 `SRC_CFCT6`（access=unavailable），却标 `source_reported` + `support: direct`，定位为"第6版相应条目" |
| 处理动作 | **全部撤下**：373项逐一置 `value=null, range=null, origin=not_found, evidence_refs=[]`，note注明"候选值见候选附录"；原值转存候选附录（含food_id/form_id/metric/值/口径），状态 `unverified_candidate_not_for_computation` |
| 涉及范围 | 88食材全部形态；主要是 energy_kcal/protein_g/fat_g/carbohydrate_g/saturated_fat_g/cholesterol_mg/fiber_g/sodium_mg/potassium_mg/total_sugars_g |
| 新增可核算数据 | 仅8种食材的USDA FDC条目（80项）：`milk_lowfat`(170872)、`egg`(171287)、`rice_white__cooked`(2710788)、`noodle__boiled`(169732)、`oats__raw`(2708489)、`sweet_potato__raw`(168482)、`corn__fresh`(169998)、`potato__raw`(170026)。每项定位含FDC ID、条目名、数据类型；指标note声明"美国数据与中国表可能不同" |
| 新增来源 | `SRC_FDC`（USDA FoodData Central，access=full_text，reuse_notes列出8个FDC ID） |
| 计算值处理 | `new_salt`钠39300、`liquor`能量350→**均撤下为null**；公式写入note（NaCl 39.34%；50%vol×0.789×7），不再用calculated标签包装无条目数值 |
| 未解决缺口 | 390项仍为空值；中国特有食材（豆干、生抽、粥、米制品、内脏等）无USDA等价条目，必须等中国数据库补证 |
| 对应校验 | r2：`numeric=142`（GOOT 62 + FDC 80），`range_only=2`，`null=390`；`numeric without evidence=0`；`direct refs to unavailable=0` |

---

## B. P2：GI与脂肪肝题录当直接依据

### B1. GI（19项）

| 项 | 内容 |
|---|---|
| 验收问题 | 19项GI数值仅指向GI国际表2021题录，无条目/行号/测定条件；白米饭83、全麦面包69等不可核对 |
| 处理动作 | 19项GI **全部置空**并移入候选附录；文字中所有"GI约XX"数字删除 |
| 替代证据 | 改用已读全文的 `SRC_GLUCOSE_PRIN_2024` 表1定性分类：高GI举例（精米、富强粉、土豆泥、烤红薯、膨化饼干、南瓜、西瓜、白糖、蜂蜜）；较低GI举例（全谷物、杂豆、加蛋面条、意大利面、新鲜山药、蔬菜水果、肉蛋肉、奶制品、豆制品、坚果） |
| 涉及ID | `rice_white`、`noodle`、`oats`、`sweet_potato`、`potato`、`congee_rice`、`congee_millet`、`pumpkin`、`bread_whole`、`watermelon`、`banana`、`grape`、`lychee`、`cherry`、`apple`、`pear`、`orange`、`blueberry`、`yam`、`corn` 等的glucose评估；`rule_audits[glucose_staples]`重写 |
| 未解决缺口 | 无单品GI数据；类别级分类不能替代测定值；gi表补充材料与glycemicindex.com均无公开检索接口（已记录） |

### B2. AASLD

| 项 | 内容 |
|---|---|
| 验收问题 | PubMed记录无摘要，25处引用以"指南题录"支持具体细节 |
| 处理动作 | 通过出版社页面**读取正文相关章节**，来源access改为`full_text`，reuse_notes写明章节；88条liver评估全部重写 |
| 实际读到的原文 | *Weight loss*：3%–5%改善脂肪变，>10%才通常改善NASH/纤维化；*Role of macronutrient composition*：过量果糖独立增加NAFLD/NASH/纤维化风险，过量饱和脂肪/精制碳水/含糖饮料与肥胖和NAFLD相关；*Role of alcohol consumption*：大量饮酒加速肝损伤，NAFLD避免、≥F2完全戒酒；*指导声明20*：热量缺口+限碳水与饱和脂肪+高纤维不饱和脂肪（地中海饮食）；*咖啡*：无禁忌可每日3杯以上 |
| 评估结果 | liver：59 compatible（模式推断）、13 limit、2 avoid（啤酒/白酒）、14 not_specifically_addressed（指南未讨论的单品） |
| 引用标注 | 模式外推一律 `inferred`；14条"未讨论"用 `AASLD_NA`（inferred，summary说明是指南未规定） |
| 未解决缺口 | 国内脂肪肝指南仍缺；AASLD为美国指南；除≥F2戒酒外无分期饮食差异 |

---

## C. P3：13处每100g/每100ml混用

| 原问题（验收列表） | 处理 | 涉及ID |
|---|---|---|
| 低脂奶 ml基准 + mg/100g嘌呤定义 | 形态改 **g基准**（`milk_lowfat__fluid_mass`），USDA按100g回填；ml换算需密度，不做 | milk_lowfat |
| 豆浆浓浆 ml + 63mg/100g | 形态改 **g基准**（`soy_milk__thick_mass`），保留63（表列"生豆浆20%无糖"每100g）；市售稀浆保持ml、嘌呤置空 | soy_milk |
| 茶/可乐/橙汁 ml + 1mg/100g | 嘌呤置空 | tea_green/sugary_drink/juice |
| 白水 ml + 0 | **移除嘌呤指标** | water |
| 浓肉汤 ml + 70与4–70混合 | **拆为3个独立形态**：`soup_rich__beef_soup`(70)、`soup_rich__bone_broth_pre`(4)、`soup_rich__bone_broth_post`(53)，均100g口径；删除"老火汤代表值"说法 | soup_rich |
| 火锅汤底/啤酒/白酒/生抽 ml+mg/100g | 嘌呤置空 | hotpot_soup/beer/liquor/new_soy_sauce |
| 其余空值指标的单位声明 | 统一由脚本按形态单位重写 `measurement_definition` | 全部 |

**结果**：校验 `unit_issues=0`；嘌呤指标定义与basis单位全部一致。

---

## D. P4：模板化判断、标签冲突、无依据限量

| 验收点名 | 处理 | 证据 |
|---|---|---|
| `tofu_dry` 血脂"选瘦肉、去皮"错配 | 重写lipid评估：植物蛋白、无胆固醇、非油炸品种；删除肉类文字 | `SRC_LIPIDS_PRIN_2024`（三）（四） |
| `tofu_dry` 血糖用"肉蛋类"出处 | glucose评估改为豆制品/低GI类别表述，引用表1"豆制品"举例 | 指导原则表1 |
| `chicken_breast` avoid vs ≤50g条件冲突 | uric改为 `limit`：附录2"瘦肉、去皮禽肉等适量食用"+附录3示例30～50g/餐（注明示例非上限）+急性期/慢性期避免；条件、份量、标签一致 | `SRC_GOUT_2024` 附录2、附录3、附录1 |
| `uric_by_purine()` 高含量→各期绝对禁忌 | 默认逻辑改为：仅附录2"不宜"名单（内脏/加工肉/牡蛎）用avoid；其余第一类食材用limit（急性期/慢性期避免） | 附录2表2.1 |
| 生抽≤10ml、豆干≤50g等无依据上限 | 70条份量建议删除（101→31条），仅保留指南明文总量（奶300/蔬500/果200–350/盐5/油25–30/水2000–3000） | 指南正文 |
| 72条评估无直接引用 | 全部616条评估均有引用；602条含直接引用；14条liver"指南未讨论该单品"仅inferred并说明 | 见评估evidence_refs |
| 豆干被过度限制 | uric由limit改为`compatible_under_conditions`（附录2优选豆腐、豆腐干） | 附录2 |
| 浓肉汤/火锅汤标签 | 均改limit（指南"控制火锅、肉汤"+"尽量不喝汤"），不再用avoid | 指南三（四） |
| 酒精/含糖饮料标签 | uric由avoid改limit（指南动词"限制"+特定病期不饮酒）；weight限酒改limit；glucose蜂蜜改limit | 指南正文/肥胖指南 |
| 血压/血脂高钠高脂加工食品 | 由avoid统一改limit（指南"限制加工食品/减少饱和脂肪"），因数值未核实，判断降为类别级 | 高血压/血脂原则 |

**说明**：`chicken_breast` 的嘌呤值仍为208（第一类），未改动；改动的是"由数值直接推出临床禁止"的逻辑。`tofu_dry` 嘌呤94也未改动，改动的是与指南附录2冲突时的取舍。

---

## E. P5：值+区间、来源状态、杂粮饭

| 验收问题 | 处理 | 涉及ID |
|---|---|---|
| 9处单值+区间 | 多条目→只留区间（`sweet_potato` 19–24；`sausage` 94–103）；单条目→只留单值（`mushroom_dried` 405，花菇357写note）；GI类全部清空 | rice_white/oats/potato/congee_rice/soup_rich/mushroom_dried/sausage/new_soy_sauce/sweet_potato |
| 3处not_found却有区间 | 区间撤下（无条目依据）：cheese钠、bbq钠、sausage钠 | cheese/bbq/sausage |
| 杂粮饭无配方却给精确值 | 全部成分值置空，coverage=partial，注明菜品阶段按实际配方累计 | rice_mixed |
| 米/面单位与形态 | 挂面（干）保留；煮面（鲜）单独形态；挂面钠估计值撤下 | noodle |
| 代表值说明 | 干香菇取"金钱菇405"单条目，note写明花菇357；甘薯区间注明红心19/紫心24 | mushroom_dried/sweet_potato |

---

## F. 验收第3节：报告表述更正

| 原表述 | 更正 |
|---|---|
| "41项null" | 精确为：534项指标 = 142单值 + 2仅区间 + 390完全空值 |
| 血糖/血压分布漏列NA | r2完整分布：glucose 61/14/4/9；pressure 63/20/0/5 |
| "旧egg_white注释暗示蛋白低致敏" | **撤回**：旧基线原文"蛋过敏者同样需要排除"是正确的，本报告误归因；保留"蛋白必须回避"的说明。鳕鱼漏标fish仍为真实发现 |
| "关键数值已用核实来源替换""可直接支撑菜品营养累计计算" | **撤回**：仅嘌呤表与8种食材USDA值可核算；当前不具备菜品营养核算条件 |
| 下一步"用当前数值库求和" | 改为：先补证成分数据与GI表，再做菜品配方收集；数值核算暂缓启用 |

---

## G. 结构性变更清单（供复核定位）

- 新增来源：`SRC_FDC`。
- 来源状态变更：`SRC_AASLD_2023` abstract_only→**full_text**；`SRC_CFCT6`、`SRC_G_2022` 保持unavailable且主库零引用；`SRC_GI_2021` 保持abstract_only且主库零数值引用。
- 形态变更：
  - `milk_lowfat__fluid` → `milk_lowfat__fluid_mass`（g）
  - `egg__whole_cooked` → `egg__whole_raw`（USDA为生蛋）
  - `soy_milk__thick` → `soy_milk__thick_mass`（g）
  - `soup_rich__meat_soup` → 三个新形态（牛肉汤/牛骨汤火锅前/后）
  - `water__plain` 移除嘌呤指标
- 原则变更：`RULE_URIC_PURINE_CLASS`（分类表不单独构成禁止结论）、`RULE_GENERAL_VARIETY`（不继承疾病标签）。
- 规则审计变更：`acute_gout_animals`、`glucose_staples`、`allergy_mapping` 的结论依据与建议文本重写。
- 缺口：从12项调整为11项（新增GI不可核对、成分覆盖不足、单品推断、无日限值；删除已解决的AASLD题录问题）。

---

## H. 仍未解决（诚实清单）

1. 《中国食物成分表》官方库仍不可访问 → 390项空值。
2. GI国际表逐条数据不可得 → 无单品GI。
3. USDA仅8条（API配额429）；中国特有食材无USDA等价物。
4. 糖尿病/高脂血症2023食养指南PDF、国内脂肪肝指南、膳食指南2022官网仍不可得。
5. `liver` 59条compatible是模式推断；14条NA；不能当作单品证据。
6. `general` 盐/油/糖限量仍缺普通人群一手来源（当前为疾病指南推断）。
7. 过敏原交叉接触、多目标冲突处理仍需产品与专业共同设计。

---

**校验记录**：r2 JSON 通过 v2 Schema（0错误）；85个基线ID齐全、88条无重复；616条评估七目标齐全；17条规则审计齐全；无悬空来源/原则/形态引用；`direct refs to unavailable=0`；`value+range=0`；`not_found+range=0`；`numeric without evidence=0`；`unit_issues=0`。