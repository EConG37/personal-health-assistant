# r3 变更日志：逐项对应复验 R1～R4 与报告更正

**基准**：`ingredient-research-acceptance-r2.md` + `acceptance-r2/automated-checks.json` + `content-checks.json`
**输入**：r2 JSON、r2 报告、原任务、v2 Schema、基线
**输出**：`health-ingredient-reference-r3.json`、`ingredient-research-summary-r3.md`、本日志
**未改动**：r1/r2 文件、软件运行数据、候选附录（继续隔离）

---

## A. R1：文字层未核实数值（74处）

| 动作 | 范围 | 说明 |
|---|---|---|
| 重写全部weight评估 | 89条（原74处energy_text全部覆盖） | 有USDA条目的8种食材使用指标实际值并绑定形态；其余食材不作数值判断，删除"低/中/高能量密度"标签（保留的类别判断均注明"推断"） |
| 清理评估文字 | 非USDA食材全部goal_assessments | 删除"能量约X""脂肪Xg/100g""碳水Xg/100g""钠Xmg/100g""胆固醇Xmg""GI约X"等；仅剩2处数字（egg 143kcal、new_egg_noodle脂肪2.07g），均与指标一致 |
| 奶/莲藕/生抽notes | milk_lowfat、lotus_root、new_soy_sauce | 删除未核实数字；食盐保留化学计量换算并标注"非成分表条目" |
| 豆干血糖绝对化 | tofu_dry.glucose | 改为"表1将豆制品列入较低GI举例；无单品血糖反应数据，不作绝对表述" |

**具体旧值清理对照**（复验表格）：低脂奶46→指标42；白米饭116→130；煮面110→（普通面已无成分值）；燕麦367→379；甜玉米112→86；马铃薯81→77；杂粮饭124→已无值；希腊酸奶59→null。文字与指标现已一致或同为空。

**未解决**：405项成分为空值；定性描述不再借用数字。

---

## B. R2：食品身份与来源条目（7项）

| 条目 | 原问题 | 处理 | 新ID/形态 |
|---|---|---|---|
| 鸡蛋 | 生形态含熟蛋嘌呤1 | 拆生/熟：生形态用USDA 171287成分、嘌呤空；熟形态嘌呤1、成分空 | `egg__whole_raw`、`egg__whole_cooked` |
| 面条 | 普通鲜面套用鸡蛋面169732 | 普通鲜面成分全部置空；新增鸡蛋面食材用169732，过敏原egg+wheat | `noodle__boiled`（空）、`new_egg_noodle` |
| 玉米淀粉 | 套用土豆淀粉5 | 撤值为空，note说明不同食材 | `new_starch__corn` |
| 全麦面包 | 套用面包（带皮）51 | 撤值为空，note说明原表未声明全麦 | `bread_whole__sliced` |
| 烧烤/卤味 | 套用羊肉串223 | 撤值为空，note说明单一样本；保留加工肉类别结论 | `bbq__mixed` |
| 香肠腊肉 | 套用火腿/午餐肉94～103 | 区间撤下，note说明不同产品样本 | `sausage__processed` |
| 干香菇 | 通用干香菇用金钱菇405 | 缩窄身份为"香菇（干，金钱菇样本）"，note说明花菇357另一样本 | `mushroom_dried__dried` |

**附带**：甘薯嘌呤保持红心19/紫心24两样本区间（不取代表值）；鸡蛋面血脂/血压/体重评估使用其USDA条目值并注明数据类型。

**未解决**：普通小麦鲜面、玉米淀粉、全麦面包、香肠腊肉、烧烤卤味的成分/嘌呤仍为空，等待中国数据库或产品标签。

---

## C. R3：原则与规则审计题录直引（9处）

| 位置 | 原引用 | 处理 |
|---|---|---|
| `principles[18]` RULE_LIVER_WEIGHT_SUGAR | AASLD"指南题录"+"摘要级"+旧5%/10% | 改为章节直引（Weight loss、Role of macronutrient composition）；statement改为3%～5%/>10%；population加超重/肥胖边界 |
| `principles[19]` RULE_LIVER_ALCOHOL | AASLD题录+"国内共识一致" | 改为Role of alcohol consumption直引；删除未补证的国内共识表述 |
| `rule_audits[15]` liver_goal_coverage | AASLD题录+"摘要级" | 重写，列出已读章节；明确单品为模式外推、减重限超重肥胖、国内指南仍缺 |
| `goal_summaries.uric.refs[2]` ACR | 指南题录 direct | 降为inferred，定位"Europe PMC题录（未读摘要/全文）" |
| `principles[1]` BMJ/JAMA | 全文题录 direct | 降为inferred，定位改写 |
| `principles[3]` ACR | 指南题录 direct | 降为inferred |
| `foods[52]` 樱桃系统综述 | 系统综述题录 direct | 降为inferred |
| `rule_audits[3]` BMJ | 题录 direct | 降为inferred |

**校验**：`direct + 题录 = 0`。**说明**：9处中部分降级后证据强度下降（ACR限酒、果糖饮料、樱桃），不再声称其直接支持具体结论；肝原则因拿到正文而升级为章节直引。

---

## D. R4：份量迁移与人群边界

| 问题 | 处理 |
|---|---|
| 9种水果glucose写200～350g（源自痛风指南） | 份量删除；rationale改为"按个体化水果份量安排"；该数值仅保留在uric/pressure（各自指南原文） |
| new_salt liver not_specifically_addressed 却有"每日≤5g" | 清空；5g盐仅保留uric/pressure/weight |
| 奶类300mL迁移到glucose/lipids/liver | 仅保留uric |
| 肝目标把热量缺口写成全部成人要求 | 全部liver评估population加"减重仅适用于超重/肥胖，瘦型个体化"；59条模式推断加条件；原则18同步 |
| protein_08_10 把肥胖人群规则迁移为一般成人 | proposed_text改为"肥胖人群按肥胖指南执行（不迁移给一般成人）；肾病个体化" |
| 份量总数 | 101→**16条**，逐条对应同目标指南原文 |

**保留的16条份量**：奶300mL（uric）；蔬菜≥500g的一部分（uric/glucose）；水果200～350g（uric/pressure）；盐<5g（uric/pressure/weight）；油25～30g（uric/general）、20～25g（weight/lipids）；饮水2000～3000mL（uric）。

---

## E. 报告更正

| 复验指出 | r3处理 |
|---|---|
| "GI网站没有公开检索入口"不成立 | 撤回。确认 `https://glycemicindex.com/gi-search/` 有公开表（Food Name/GI/国家/份量/参考文献/受试者/年份）；改为"前轮未完成逐食物匹配检索"；URL写入SRC_GI_2021 reuse_notes与gaps |
| "8种USDA实测值"过强 | 全部改为"USDA对应条目报告值"；注明SR Legacy含计算/文献来源、FNDDS为调查汇编库，非本实验室实测；保留dataType与FDC ID |
| AASLD url指向无摘要题录、publication_date需修正 | url改为PMC10735173；date改为2023-05；version为Hepatology 77(5):1797-1835；注明本地未保存全文（此前响应为错误页） |
| "全部撤下/仅留明文份量/题录问题清零"过度声明 | 撤回笼统说法，改为精确计数：373成分+19GI撤下；份量16条；9处题录直引降级/改正文定位；并说明direct≠单品证据 |

---

## F. 最终文件状态（自校验）

- Schema v2：0错误。
- 85个基线ID齐全；89条食材（新增4：salt、soy_sauce、starch、egg_noodle），无重复。
- 623条评估（89×7），七目标齐全；17条规则审计齐全；11项缺口。
- 545项指标：139单值（FDC 80 + 官方嘌呤59）、1仅区间、405空值。
- 无悬空来源/原则/形态引用；`direct→unavailable=0`；`direct+题录=0`；`value+range=0`；`not_found+range=0`；`numeric without evidence=0`；单位定义冲突=0。
- 609/623条评估含直接引用；14条为liver"指南未讨论该单品"的inferred标注。
- 份量16条，均通过目标适用性检查（无跨目标迁移）。
- 89条liver评估population均含超重/肥胖边界。

---

## G. 仍未解决（不得掩盖）

1. 405项成分空值；中国食物成分表官方库仍不可访问。
2. GI检索页可用但本轮未完成逐食物匹配；无单品GI数值。
3. USDA仅8条（配额429）；中国特有食材无USDA等价条目。
4. 国内脂肪肝指南、膳食指南2022、糖尿病/高脂血症2023食养指南仍缺。
5. 肝目标59条compatible为模式推断；14条NA；不可当单品证据。
6. 普通小麦鲜面、玉米淀粉、全麦面包、香肠腊肉、烧烤卤味嘌呤/成分为空。
7. 特殊人群与多目标冲突仍需专业与产品共同设计。

**本轮未做也做不到的**：补齐全部缺失数据、临床审核、以现有库进行营养累计计算。