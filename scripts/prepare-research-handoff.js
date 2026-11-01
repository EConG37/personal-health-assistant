// Export app reference data only. Never reads personal records or credentials.
const fs=require('node:fs'),path=require('node:path');
const {FOODS}=require('../core/foods');
const {GOALS,ALLERGIES,CONDITIONS,foodTags}=require('../core/profile');
const dir=path.join(__dirname,'../docs/research-handoff');fs.mkdirSync(dir,{recursive:true});
const legacyRules=[
 ['purine_daily_300','统一使用每日300mg嘌呤参考线。'],
 ['water_35ml_kg','参考饮水量按体重×35ml计算，默认限制1800–3000ml，运动或炎热时额外加量。'],
 ['protein_08_10','每日蛋白参考量为0.8–1.0g/kg，正餐组餐追求每餐至少15g蛋白。'],
 ['purine_fructose_score','以purine×0.6+fructose等级×14+食材档位惩罚给食物打分；分值影响随机选择。果糖等级为0–3。'],
 ['plant_purines','部分植物食物虽有较高嘌呤参考值，仍设为可选；需区分含量、临床结局和份量。'],
 ['acute_gout_animals','勾选痛风发作时排除全部畜肉、禽肉、水产候选。'],
 ['glucose_staples','勾选稳血糖时排除白粥、小米粥，增加部分全谷物选择权重，并将正餐主食量统一取120g。'],
 ['pressure_exclusions','勾选控血压时排除奶酪、豆干，但缺少完整钠数据库。'],
 ['lipids_exclusions','勾选调血脂时排除奶酪，但缺少完整饱和脂肪数据库。'],
 ['cooking_titles','部分菜名仅由清蒸/少油煎炒/清炒等前缀加食材名组成；未为每道菜建立真实配方。'],
 ['purine_calculation','嘌呤及蛋白值按每100g数值×食用克数/100求和；旧表未统一标明生熟、品种或烹调损失。'],
 ['global_tiers','good/ok/avoid为开发期人工标记；avoid在各健康目标中统一排除，尚未逐项证据核查。'],
 ['allergy_mapping','目前按类别和少量ID映射7种常见过敏原；请检查遗漏，尤其鱼类、蛋白/整蛋、嫩豆腐/大豆以及调味料。'],
 ['clinical_plan_pause','肾功能异常/透析、心衰/限水、孕哺期和未成年暂停通用配餐，应明确通用食养参考的适用边界。'],
 ['weight_goal_coverage','管理体重目前增加部分全谷物选择权重，但没有完整能量数据库、能量需求或能量缺口计算。'],
 ['liver_goal_coverage','脂肪肝目标目前沿用部分全谷物权重和一般提示，没有独立、可追溯的食材适用性与病情分层依据。'],
 ['general_goal_coverage','均衡饮食仍共用good/ok/avoid等排除标签，需核查是否错误地把某疾病的限制推广到普通人群。']
].map(([rule_id,legacy_text])=>({rule_id,legacy_text,status:'unverified_prototype_rule'}));
const baseline={
 schema_version:'2.0.0',exported_on:'2026-10-31',status:'legacy_unverified_not_medical_evidence',
 purpose:'供外部研究者审计食材、数值、过敏原与组餐规则；不得将本文件作为证据来源。',
 priority:'第一阶段审计食材与全部7个健康目标的关系；第二阶段再建立真实菜品和整餐搭配，不按单一疾病优先代替其他目标。',
 food_count:FOODS.length,selectable_food_count:FOODS.filter(f=>f.tier!=='avoid').length,
 goals:GOALS,allergy_options:ALLERGIES,special_condition_options:CONDITIONS,
 legacy_fields:{purine:'声称mg/100g但未统一生熟口径；未逐项核实',protein:'声称g/100g但未统一口径；未逐项核实',fructose:'开发期0–3等级，不能当作实测果糖克数',tier:'开发期good/ok/avoid标签，不能当作专业适宜性判断',portion:'默认份量，不是个体营养处方'},
 foods:FOODS.map(f=>({...f,legacy_allergy_tags:foodTags(f),provenance_status:'not_individually_verified'})),
 rules_to_audit:legacyRules,
 source_code_files:['core/foods.js','core/profile.js','core/recommend.js','core/rules.js','core/meal-deck.js'],
 contains_personal_records:false
};
fs.writeFileSync(path.join(dir,'health-food-baseline.json'),JSON.stringify(baseline,null,2)+'\n');
const str={type:'string'},nonempty={type:'string',minLength:1},nullable={type:['string','null']},number={type:['number','null'],minimum:0};
const arr=items=>({type:'array',items});
const en=values=>({type:'string',enum:values});
const obj=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const ref=name=>({$ref:'#/definitions/'+name});
const date={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
const metricNames=['purine_mg','protein_g','energy_kcal','carbohydrate_g','available_carbohydrate_g','fat_g','saturated_fat_g','cholesterol_mg','fiber_g','sodium_mg','potassium_mg','total_sugars_g','added_sugars_g','fructose_g','glycemic_index'];
const goalIds=GOALS.map(g=>g.id);
const allGoalIds={type:'array',items:en(goalIds),minItems:goalIds.length,maxItems:goalIds.length,uniqueItems:true};
const byGoal=definition=>obj(Object.fromEntries(goalIds.map(id=>[id,ref(definition)])));
const definitions={
 evidence_ref:obj({source_id:nonempty,locator:nonempty,support:en(['direct','inferred','conflicting']),summary:nonempty}),
 metric:obj({name:en(metricNames),value:number,range:{anyOf:[{type:'array',items:{type:'number',minimum:0},minItems:2,maxItems:2},{type:'null'}]},unit:en(['mg','g','kcal','unitless']),measurement_definition:str,origin:en(['source_reported','calculated','not_found']),evidence_refs:arr(ref('evidence_ref')),note:str}),
 source:obj({source_id:{type:'string',pattern:'^SRC_[A-Za-z0-9_-]+$'},title:nonempty,issuer_or_authors:nonempty,publication_year:{type:['integer','null'],minimum:1900,maximum:2100},publication_date:nullable,version:nullable,url:{type:'string',format:'uri'},accessed_on:date,type:en(['government_guideline','clinical_guideline','standard','food_composition_database','systematic_review','primary_study','other']),access:en(['full_text','abstract_only','unavailable']),currency:en(['current','superseded','unclear']),reuse_notes:str}),
 goal_summary:obj({coverage:en(['found','partial','not_found']),population:nonempty,key_questions:arr(str),findings:nonempty,limitations:arr(str),evidence_refs:arr(ref('evidence_ref'))}),
 principle:obj({principle_id:{type:'string',pattern:'^RULE_[A-Za-z0-9_-]+$'},goal_ids:arr(en(goalIds)),population:nonempty,gout_phase:en(['asymptomatic_hyperuricemia','acute','intercritical','chronic','not_phase_specific','not_applicable','unclear']),statement:nonempty,limitations:arr(str),strength_as_reported:nullable,evidence_refs:arr(ref('evidence_ref')),review_status:{const:'not_clinically_reviewed'}}),
 food_form:obj({form_id:nonempty,identity_details:nonempty,state:en(['raw','cooked','dried','processed','unspecified']),basis:obj({amount:{const:100},unit:en(['g','ml']),edible_portion:{type:'boolean'}}),metrics:arr(ref('metric')),notes:str}),
 goal_assessment:obj({assessment:en(['compatible_under_conditions','limit','avoid','not_specifically_addressed','insufficient_evidence']),form_ids:arr(str),population:nonempty,rationale:nonempty,conditions:arr(str),portion_guidance:nullable,preparation_notes:arr(str),principle_ids:arr(str),evidence_refs:arr(ref('evidence_ref'))}),
 food:obj({food_id:{type:'string',pattern:'^[a-z0-9_]+$'},name_zh:nonempty,coverage:en(['found','partial','not_found']),forms:arr(ref('food_form')),goal_assessments:byGoal('goal_assessment'),allergens:arr(str),allergen_notes:nonempty,assessment_notes:arr(str),evidence_refs:arr(ref('evidence_ref'))}),
 audit:obj({rule_id:nonempty,legacy_statement:nonempty,verdict:en(['supported','partly_supported','unsupported','conflicting','not_found']),rationale:nonempty,action:en(['retain','revise','remove','individualize','defer']),proposed_text:nullable,evidence_refs:arr(ref('evidence_ref'))}),
 gap:obj({target_id:nonempty,issue:nonempty,reason:nonempty,next_step:nonempty})
};
const schema={
 $schema:'http://json-schema.org/draft-07/schema#',title:'个人健康助手：全部目标食材研究 v2',
 ...obj({schema_version:{const:'2.0.0'},meta:obj({title:nonempty,research_stage:{const:'ingredients'},research_date:date,goal_scope:allGoalIds,coverage:en(['complete','partial']),status:{const:'research_reference_only'},review_status:{const:'not_clinically_reviewed'}}),sources:arr(ref('source')),goal_summaries:byGoal('goal_summary'),principles:arr(ref('principle')),foods:arr(ref('food')),rule_audits:arr(ref('audit')),gaps:arr(ref('gap'))}),
 definitions
};
fs.writeFileSync(path.join(dir,'health-ingredient-reference.schema.json'),JSON.stringify(schema,null,2)+'\n');
// Keep the earlier handoff link valid; it now points to the same v2 ingredients contract.
fs.writeFileSync(path.join(dir,'health-diet-reference.schema.json'),JSON.stringify(schema,null,2)+'\n');
console.log(JSON.stringify({directory:dir,foods:baseline.food_count,selectable:baseline.selectable_food_count,audit_rules:legacyRules.length,personal_records:false}));
