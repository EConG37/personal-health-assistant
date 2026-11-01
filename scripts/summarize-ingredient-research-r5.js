// Summaries and provenance note are derived from the actual revised file.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../docs/research-handoff'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const d=read('health-ingredient-reference-r5.json'),m=read('acceptance-r5/revision-manifest.json'),s=m.stats;
const metricRows=d.foods.flatMap(f=>f.forms.flatMap(form=>form.metrics.map(metric=>({food:f,form,metric}))));
const numeric=metricRows.filter(x=>x.metric.value!==null||x.metric.range!==null);
const measures=d.foods.flatMap(f=>f.forms).reduce((a,x)=>(a[x.basis.amount+x.basis.unit]=(a[x.basis.amount+x.basis.unit]||0)+1,a),{});
const sourceCounts={};for(const{metric}of numeric)for(const ref of metric.evidence_refs)sourceCounts[ref.source_id]=(sourceCounts[ref.source_id]||0)+1;
const names={170872:'低脂液态奶（约1%脂肪）',171287:'生全蛋',2710788:'白米饭（熟，配料样本）',169732:'鸡蛋面（强化型，煮）',2708489:'原始燕麦',168482:'甘薯（生）',169998:'黄色甜玉米（生）',170026:'马铃薯肉与皮（生）'};
const fdcTable=m.fdc_snapshots.sort((a,b)=>a.fdc_id-b.fdc_id).map(x=>`| ${names[x.fdc_id]} | ${x.fdc_id} | ${x.data_type} | ${x.fdc_published_date} |`).join('\n');
const rows=Object.entries(s.goal_labels).map(([g,v])=>`| ${g} | ${v.compatible_under_conditions||0} | ${v.limit||0} | ${v.avoid||0} | ${v.not_specifically_addressed||0} | ${v.insufficient_evidence||0} |`).join('\n');
const summary=`# 食材研究 r5 本地修订说明

日期：2026-10-31。输入r4保留，输出为\`health-ingredient-reference-r5.json\`。Schema仍为2.0.0。

本轮直接修复r4复验点名的备注、状态矛盾和鸡蛋面分类；同时清理一般成人定量迁移及根层旧统计。没有修改任何营养指标、指标引用、计量基准或运行中的软件规则。

## 实际改动

- 清理低脂奶体积/质量矛盾、蜂蜜80%、啤酒每罐215kcal、燕麦40g约147kcal等备注；撤下没有对应来源的固定重量比例和单品克数。
- 8条有USDA能量的食品按具体form_id说明已有报告值，其他形态仍保持未知；类别说明不再覆盖补证状态。
- 鸡蛋面在体重目标中按主食管理，保留egg+wheat过敏原；没有更改疾病适用性标签。
- 普通成人的水果、坚果、油、盐、糖和酒精克数不再从疾病人群直接迁移；general为partial，保留定性类别推断。
- 修正CFCT6/USDA、肝目标分布、奶酪估计区间等旧摘要。FDC数据库2019发布、记录上架日与2026检索日分开记录；来源版本更新状态为unclear，不伪称已排查所有新版。

共${m.changes.length}个字段变更；完整before/after与理由见\`acceptance-r5/revision-manifest.json\`。r4 SHA-256：\`${m.input.sha256}\`。

## 从最终JSON重算

${s.foods}食材、${s.forms}形态、${s.assessments}评估、${s.metrics}指标、${d.sources.length}来源、${d.principles.length}原则、${d.rule_audits.length}规则审计、${d.gaps.length}缺口。

- 单值${s.single}项，只有区间${s.range_only}项，完全未知${s.unknown}项；数值或区间非空共${numeric.length}项。
- 数值指标来源：痛风指南${sourceCounts.SRC_GOUT_2024}项（59单值+1范围）；USDA ${sourceCounts.SRC_FDC}项（8个对应食品，每个10项）。
- ${measures['100g']}个形态按100g、${measures['100ml']}个形态按100ml；本次${numeric.length}个非空数值指标均为100g口径。
- \`portion_guidance\`非空${s.portion_fields}条，仅为字段计数；不等于全文所有份量数字。
- 8处weight理由的能量均绑定具体形态；没有给其他食品填补估计值。

| 目标 | 条件兼容 | 限制 | 避免 | 未专门讨论 | 证据不足 |
| --- | --- | --- | --- | --- | --- |
${rows}

## 使用边界

保留\`research_reference_only\`、\`not_clinically_reviewed\`、\`partial\`。通过本轮来源和一致性修订不等于623条判断完成临床审核。405项未知、单品GI和多目标冲突仍未解决，不能作为完整配方营养累计或自动疾病配餐的数据底座。

用于第二阶段的真实菜名、配方和来源收集可以继续；旧候选附件不得读入计算。软件目前仍读取\`core/foods.js\`等旧规则，尚未导入本库。数据口径详见\`食材数据基准说明.md\`。
`;
const basis=`# 食材数据基准说明

当前修订参考文件：\`health-ingredient-reference-r5.json\`，研究核对日2026-10-31。适用范围是第一阶段食材研究，覆盖高尿酸/痛风、血糖、血压、血脂、体重、脂肪肝和一般饮食七个目标。

## 1. 数值基准与适用性基准是两层

| 层次 | 实际依据 | 当前范围 |
| --- | --- | --- |
| 嘌呤数值 | 已保存的卫健委《成人高尿酸血症与痛风食养指南（2024年版）》附录1表1-2；原样品/品种/生熟名称须匹配 | 59个单值、1个由不同甘薯样本组成的范围，单位mg/100g可食部；范围不是置信区间或通用代表值 |
| 能量和常见成分 | USDA FoodData Central中8个实际保存的对应条目 | 能量、蛋白、脂肪、碳水、纤维、钠、钾、总糖、饱和脂肪、胆固醇共80项；不是89个食品全部有这些数据 |
| 食材适用性 | 已读的2023高血压食养指南，2024痛风/肥胖食养指南，2024高血糖/高血压/高脂血症营养和运动指导原则；脂肪肝主要参考AASLD 2023正文 | 多为人群或食物类别原则。单品推广须标为inferred；不能把“原则有直接来源”理解为“该单品经临床试验证明适合” |
| 一般成人 | 普通人群正式膳食指南原文仍未完成核对 | 仅定性类别参考，general为partial；不直接套用疾病人群每日克数 |

不同数据库、不同版本的食品差异没有做平均，也没有拼成一个“标准中国食物”。美国食品样本不自动等同于中国市场上的所有品牌、品种或餐饮做法。

## 2. 计量基准

- 每个\`form_id\`绑定身份、处理状态、\`basis.amount\`、\`basis.unit\`和可食部标记。当前${measures['100g']}个形态是100g、${measures['100ml']}个形态是100ml；实际有数值的${numeric.length}个指标全部按100g。
- “每100g”是该具体形态的重量：生米不是熟米饭，干燕麦不是煮熟燕麦，生蛋不是熟蛋，原始食品不是外卖成品。
- 100ml不等于100g；没有匹配密度就不换算。奶类毫升建议与奶的100g成分记录是不同层次。
- “一个蛋、一张海苔、一杯、一碗、一份”不使用未核实固定重量；采用实际称重或具体产品资料。
- 指南“每日盐、奶、水果、饮水量”等是特定人群的全天总量或建议，不是每道菜的用量，也不是单一食品可以独占的份额。
- 总碳水不自动等于可利用碳水，总糖不自动等于添加糖，钠不等于盐，嘌呤不等于尿酸。USDA碳水字段保持其原有定义，不能擅自据此计算GI/GL。
- 未知值保持null。当前${s.metrics}项中${s.unknown}项完全未知，不能当作0，也不能从候选附件补入或以类别平均值填满。

## 3. USDA实际条目与日期

| 对应食品 | FDC ID | 数据类型 | 记录在FDC上架日期 |
| --- | --- | --- | --- |
${fdcTable}

查询日2026-10-31不代表2026年测量。上架日期也不代表采样日期。SR Legacy最终数据版为2018，FNDDS是调查用汇编；有些数值来自计算或文献，统一称“条目报告值”。官方说明：[数据类型](https://fdc.nal.usda.gov/data-documentation/)、[日期字段含义](https://fdc.nal.usda.gov/help/)、[FDC版本记录](https://fdc.nal.usda.gov/log/)。

保存的原始响应位于\`build/usda/\`，使用了哪些记录及文件SHA-256见\`acceptance-r5/revision-manifest.json\`。嘌呤表原PDF位于\`downloads/gout-guide-2024.pdf\`。本轮没有重新逐页审读所有嘌呤表项，保留了此前来源并检查本次未改指标；已完成的结构和摘录检查不代替完整临床审核。

## 4. 版本与证据边界

- 本库用的是实际列出的版本；来源\`currency=unclear\`表示未完成所有新版/替代文件检索，不声称截至研究日全部最新。全文可读与版本是否最新是两件事。
- \`support=direct\`只说明引用直接支持其summary；具体单品、其他病种或一般成人的推广，可能仍是推断。条件兼容不等于不限量，未专门讨论不等于安全证明。
- 无单品GI数值，不能据含糖量推算GI，也不据当前数据推算一餐血糖反应。
- 普通人群指南、中国食物成分表逐条核对、特殊人群和多目标冲突仍有缺口，状态继续为研究参考、未临床审核。

## 5. 与当前软件、历史基线的关系

\`health-food-baseline.json\`是旧程序85条食材和旧规则的核对清单，其数值不是医学依据。本轮89条参考食品保留全部旧ID，另有4个new_食品。

当前软件仍读取\`core/foods.js\`、\`core/profile.js\`、\`core/recommend.js\`等旧逻辑。r5是本地研究参考文件，本轮没有替换运行时数据。后续接入需处理形态、null、证据等级和多目标条件，不能直接把旧表按数字覆盖。本库目前不具备完整菜品营养累计或自动疾病配餐条件。
`;
const changeGroups={};for(const c of m.changes){const key=c.pointer.startsWith('/foods/')?d.foods[Number(c.pointer.split('/')[2])].food_id:c.pointer.split('/')[1];changeGroups[key]=(changeGroups[key]||0)+1;}
const log=`# r5 直接修订记录

输入：\`${m.input.file}\`。输出：\`${m.output.file}\`。日期2026-10-31。

原r1–r4保留；指标值、区间、单位、基准、形态身份、指标来源全部与r4一致。没有填补${s.unknown}项空值，没有更改七目标的assessment标签，没有修改运行时程序。

本轮${m.changes.length}个字段变更，分组如下。完整逐字段before/after、原因与输入输出SHA-256保存在\`acceptance-r5/revision-manifest.json\`，不依赖手抄的完成声明。

| 食材或根层 | 字段变更数 |
| --- | --- |
${Object.entries(changeGroups).map(([k,v])=>`| ${k} | ${v} |`).join('\n')}

主要动作：撤下备注旧值及未经补证的份量换算；恢复8个USDA能量条目的准确文字与引用；鸡蛋面按主食管理；移除普通成人定量迁移；修正根层旧统计、摘要访问状态及版本日期含义。来源版本更新状态改为unclear，避免把读取了旧文献等同于已核验其截至研究日仍为最新版本。

自动检查结果另存\`acceptance-r5/\`；研究参考与未临床审核状态保留。详细计量和证据基准见\`食材数据基准说明.md\`。
`;
for(const[name,text]of [['ingredient-research-summary-r5.md',summary],['ingredient-research-change-log-r5.md',log],['食材数据基准说明.md',basis]])fs.writeFileSync(path.join(dir,name),text);
fs.writeFileSync(path.join(dir,'current-reference.json'),JSON.stringify({revision:'r5',schema_version:d.schema_version,reference_file:m.output.file,sha256:m.output.sha256,basis_note:'食材数据基准说明.md',summary:'ingredient-research-summary-r5.md',change_log:'ingredient-research-change-log-r5.md',status:d.meta.status,review_status:d.meta.review_status,runtime_integrated:false,excluded_candidate_files:['ingredient-research-unverified-candidates-r2.json']},null,2)+'\n');
console.log(JSON.stringify({summary:'ingredient-research-summary-r5.md',basis:'食材数据基准说明.md',changes:m.changes.length,stats:s,metric_sources:sourceCounts},null,2));
