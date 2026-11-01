// Conservative corrections to the submitted r4 research reference.
// Preserves r1-r4, all numeric metrics and runtime application data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Ajv=require('ajv');
const dir=path.join(__dirname,'../docs/research-handoff');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const inputName='health-ingredient-reference-r4.json',original=read(inputName),doc=structuredClone(original),changes=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const originalHash=hash(fs.readFileSync(path.join(dir,inputName)));
function set(pointer,value,reason){const parts=pointer.slice(1).split('/');let obj=doc;for(const k of parts.slice(0,-1))obj=obj[k];const k=parts.at(-1),before=structuredClone(obj[k]);if(JSON.stringify(before)===JSON.stringify(value))return;obj[k]=value;changes.push({pointer,reason,before,after:structuredClone(value)});}
const food=id=>doc.foods.find(f=>f.food_id===id),fp=id=>'/foods/'+doc.foods.findIndex(f=>f.food_id===id);
const setFood=(id,field,value,reason)=>set(fp(id)+'/'+field,value,reason);
const setAssessment=(id,goal,field,value,reason)=>setFood(id,`goal_assessments/${goal}/${field}`,value,reason);

set('/meta/title','个人健康助手：七目标食材研究参考（r5 本地修订版）','标识本轮直接修订，仍为研究参考');
setFood('milk_lowfat','assessment_notes',['液态奶成分按所列形态的每100g可食部报告；指南中的奶类毫升量是体积建议，本库没有密度换算依据，不将100ml等同100g。'],'删除旧100ml/3%换算，与质量基准统一');
setFood('yogurt_greek','forms/0/notes','本形态为脱脂无糖型；其他脂肪含量、配方或品牌不能共用本形态数值。未核实的全脂产品数字不作为参考值。','撤下未补证的全脂酸奶9～10g成分');
setFood('egg_white','forms/0/notes','蛋白与全蛋分别按实际可食部重量记录；本库不提供整蛋到蛋白的固定重量比例。','删除没有对应来源的58%重量换算');
setFood('oats','forms/0/notes','所列数值对应USDA原始燕麦条目，按每100g生/干可食部报告；实际份量称重，煮后重量与即食产品不能直接沿用原始形态数值。','撤下无来源的40g通用份量并明确生熟口径');
setAssessment('oats','lipids','conditions',['按实际份量纳入全谷物摄入；本轮未设定单品通用干重克数'],'植物甾醇食物举例不支持每日30～50g单品剂量');
setAssessment('oats','weight','preparation_notes',['按实际干重和对应形态安排主食份量，不加糖；本库不设定固定一份克数。'],'清除旧40g约147kcal，避免沿用旧367kcal口径');
setFood('seaweed_dried','forms/0/notes','干制品口径；实际食用量按具体产品称重，不把一张海苔换算成固定克数。','删除无具体产品的2～3g/张换算');
setFood('beer','forms/0/notes','本形态的体积基准为每100ml；能量值尚未核实，实际成分和酒精度需查对应产品标签，不提供每罐能量换算。','删除500ml约215kcal旧值');
setFood('honey','forms/0/notes','糖的具体组成及含量尚未核实，应查对应产品资料；本库不保留糖百分比作为计算依据。','同步删除备注中的80%糖');
setFood('new_starch','forms/0/notes','新增原因：供后续真实菜品记录勾芡原料；用量取自具体配方或实际称重，不提供所有菜通用的克数。','删除无配方依据的3～5g/菜');
for(const id of ['walnut','almond']){
 const a=food(id).goal_assessments.uric;
 setAssessment(id,'uric','conditions',a.conditions.map(c=>c.includes('10～15g')?'按个体化坚果份量安排，不设单品通用克数':c),'嘌呤表和食物多样原则不支持10～15g单品用量');
}
for(const [id,notes]of [
 ['cheese',['少量作配料；限制依据为食品类别推断，具体能量取决于产品。']],
 ['seaweed_dried',['按实际干重少量作配菜；不把未核实能量密度作为判断依据。']],
 ['sardine',['少油烹调，按实际可食部份量安排；具体成分和能量待补证。']],
 ['dried_fish',['按加工类别限量，核对加盐情况；具体成分和能量待补证。']]
])setAssessment(id,'weight','preparation_notes',notes,'清除备注中由旧数值遗留的确定能量密度标签');

const energyRoles={
 milk_lowfat:['无糖低脂奶属于乳制品，按乳制品份量管理。',['选择无糖低脂产品','计入每日总能量']],
 egg:['鸡蛋属于蛋类，按蛋类份量管理。',['计入每日总能量','生熟形态的数值分别采用']],
 rice_white:['白米饭属于主食，按实际份量管理，并与全谷物搭配。',['主食定量','计入每日总能量']],
 oats:['燕麦属于全谷物主食，按实际份量管理。',['作为主食定量','不额外加糖']],
 sweet_potato:['甘薯属于薯类主食，计入主食份量。',['按实际份量替换部分主食','计入每日总能量']],
 corn:['鲜甜玉米按主食来源管理，品种和加工方式需对应。',['按实际份量计入主食','计入每日总能量']],
 potato:['马铃薯属于薯类主食，计入主食份量。',['按实际份量替换部分主食','计入每日总能量']],
 new_egg_noodle:['鸡蛋面属于谷物面制主食，按主食份量管理；不把含鸡蛋的面条计作瘦肉或豆制品的替代份额。',['按主食定量','计入当日碳水及总能量','含鸡蛋和小麦过敏原']]
};
for(const [id,[role,conditions]]of Object.entries(energyRoles)){
 const f=food(id),form=f.forms.find(v=>v.metrics.some(m=>m.name==='energy_kcal'&&m.value!==null)),m=form.metrics.find(m=>m.name==='energy_kcal');
 if(!m.evidence_refs.some(r=>r.source_id==='SRC_FDC'))throw Error('Missing verified FDC energy '+id);
 setAssessment(id,'weight','rationale',`${role}已取得USDA对应条目报告值：${form.identity_details}（${form.form_id}）每${form.basis.amount}${form.basis.unit}可食部能量为${m.value}kcal。该数值仅对应此形态；其他生熟状态、品种或配方不可直接套用。`,'恢复已有能量数据的真实状态，并绑定形态；鸡蛋面按主食分类');
 setAssessment(id,'weight','conditions',conditions,'按独立食品类别管理，保留份量和形态条件');
 const a=f.goal_assessments.weight,refs=a.evidence_refs.filter(r=>r.source_id!=='SRC_FDC');
 refs.push(structuredClone(m.evidence_refs.find(r=>r.source_id==='SRC_FDC')));
 if(id==='new_egg_noodle'){
  refs.push({source_id:'SRC_GLUCOSE_PRIN_2024',locator:'表1 常见食物举例：加蛋面条（食品身份参考）',support:'inferred',summary:'加蛋面条作为面制主食管理；在体重目标下的份量管理是类别推断，不是单品减重结局证据。'});
  setAssessment(id,'weight','principle_ids',['RULE_WEIGHT_ENERGY'],'修正含蛋面条的主食归属');
 }
 setAssessment(id,'weight','evidence_refs',refs,'能量引用具体FDC条目；类别判断与数值出处分开');
}

// General-adult gram limits are not borrowed from disease-specific sources.
const generalText={
 egg:'鸡蛋可作为多样化饮食中的蛋类来源；按实际份量安排，本轮不设一般成人每日固定个数。',
 walnut:'原味坚果可作为多样化饮食的一部分；按实际份量和总能量安排，本轮不提供一般成人的单品固定克数。',
 almond:'原味坚果可作为多样化饮食的一部分；按实际份量和总能量安排，本轮不提供一般成人的单品固定克数。',
 olive_oil:'植物油按实际用量安排，注意烹调总量；普通人群定量目标的原文尚待核实，本轮不从疾病指南迁移每日克数。',
 beer:'饮酒宜限制，最好不饮；本轮没有核实一般成人的定量饮酒依据，不从高血压目标迁移男女酒精克数。',
 sugary_drink:'不把含糖饮料作为日常饮品；糖含量以对应产品标签为准。本轮不从肥胖指南迁移一般成人的添加糖克数。',
 honey:'蜂蜜按甜味来源限量使用；糖的具体组成待核实，本轮不提供一般成人的每日添加糖克数。',
 new_salt:'日常饮食注意少盐，含调味品与加工食品中的钠；本轮不从疾病指南迁移一般成人的食盐克数。',
 new_soy_sauce:'酱油用量按对应产品钠标签和适用人群的限盐要求安排；本轮不设一般成人的每日毫升或盐克数。'
};
for(const id of ['cherry','apple','blueberry','pear','orange','banana','watermelon','grape','lychee'])generalText[id]=`${food(id).name_zh}可作为日常水果的一部分；按个体化份量安排，本轮不从疾病指南迁移一般成人的每日水果克数。`;
for(const [id,text]of Object.entries(generalText)){
 setAssessment(id,'general','rationale',text,'删除未核实普通人群来源的定量迁移，保留明确的类别推断');
 setAssessment(id,'general','portion_guidance',null,'不把疾病人群总量用作一般成人处方');
 const a=food(id).goal_assessments.general;
 setAssessment(id,'general','evidence_refs',[...a.evidence_refs.filter(r=>r.source_id!=='SRC_DG_2022'),{source_id:'SRC_GOUT_2024',locator:'三（一）食物多样（向一般成人推广属研究者推断）',support:'inferred',summary:'仅作为一般成人食物类别与多样化的参考，未取得一般成人单品定量原文，不据此给固定克数。'}],'保留原原则出处，明确一般成人适用性属于推断');
}
// Narrow unsupported classification claims rather than removing all numbers.
for(const id of ['sugary_drink','juice','honey']){
 const a=food(id).goal_assessments.uric;
 setAssessment(id,'uric','rationale',a.rationale.replace('本条目不属于嘌呤分类讨论对象，不套用肉类嘌呤与烹调规则。','本条目没有匹配的可核算嘌呤值；限制理由依据酒糖相关条款中的果糖方向，不由嘌呤分类阈值推导。'),'避免把无匹配值扩大为整个食物类别不适用嘌呤分类');
}
const principleIndex=id=>doc.principles.findIndex(p=>p.principle_id===id);
set(`/principles/${principleIndex('RULE_LIVER_WEIGHT_SUGAR')}/strength_as_reported`,'AASLD实践指导（2023，已读相关正文；单品应用属于模式推断）','清除剩余摘要级旧状态');
set(`/principles/${principleIndex('RULE_GENERAL_VARIETY')}/strength_as_reported`,'卫健委已读食养指南中的食物多样条款；推广至一般成人为研究者推断，普通人群正式文本待核对','不把未读取的膳食指南宣称为已验证一致');
set('/goal_summaries/pressure/limitations',doc.goal_summaries.pressure.limitations.map(s=>s.includes('以区间标注')?'奶酪等食品的钠因品种和配方差异大；本库无匹配来源时保留空值，不保留估计区间。':s),'实际数据已撤下奶酪估计范围');
set('/goal_summaries/weight/limitations',doc.goal_summaries.weight.limitations.map(s=>s.includes('中国食物成分表通行值')?'本阶段的能量和宏量营养成分仅有8个USDA对应条目，其他食品保持未知；候选中国食物成分数据不用于核算。':s),'同步真实的8条FDC能量底座');
set('/goal_summaries/general/coverage','partial','普通人群正式文本未完成核对，不宣称覆盖完整');
set('/goal_summaries/general/findings','一般成人仅保留食物类别和多样化的研究参考；已读疾病食养指南的原则向普通人群推广时明确为推断。本轮未取得《中国居民膳食指南（2022）》正式原文，不将疾病人群的水果、油、盐、糖或酒精克数用作一般成人定量要求。','清除普通人群数值迁移的旧摘要');
set('/goal_summaries/general/limitations',['普通人群正式膳食指南原文仍未核对，适用性证据不完整。','一般成人的单品固定克数未在本轮确立；类别兼容不等于可以不限量食用。','引用了已读指南的多样化原则不代表相应单品具有直接临床结局证据。'],'明确一般目标的证据边界');

const fdcIndex=doc.sources.findIndex(s=>s.source_id==='SRC_FDC');
set(`/sources/${fdcIndex}/publication_year`,2019,'FDC数据库2019年发布；2026是检索年份，不是所有条目原始发布年');
set(`/sources/${fdcIndex}/version`,'动态数据库；本批次使用SR Legacy和Survey (FNDDS)记录，原始记录publishedDate另存基准清单','区分数据库发布、记录上架日期与研究访问日期');
set(`/sources/${fdcIndex}/reuse_notes`,doc.sources[fdcIndex].reuse_notes+' 数据库发布年份2019，检索日期2026-10-31；保存响应的SR Legacy记录publishedDate为2019-04-01，FNDDS记录为2024-10-31。publishedDate是记录在FDC上架日期，不等于采样或测量年份。SR Legacy最终数据版为2018；FNDDS为调查汇编，不能宣称本批数值全部实测。','补全版本和日期含义，避免以访问年假装新测量');
for(const[i,source]of doc.sources.entries()){
 set(`/sources/${i}/currency`,'unclear','本轮核对已保存的指定版本，未完成截至检索日的全量版本替代性审查');
 set(`/sources/${i}/reuse_notes`,source.reuse_notes+' 本轮核对的是已列版本；未宣称已完成所有新版或替代文件的检索。','版本是否最新与能否读取原文分别记录');
}

const stats={foods:doc.foods.length,forms:doc.foods.reduce((n,f)=>n+f.forms.length,0),assessments:doc.foods.reduce((n,f)=>n+Object.keys(f.goal_assessments).length,0),metrics:0,single:0,range_only:0,unknown:0,portion_fields:0,energy_foods:0,goal_labels:{}};
for(const f of doc.foods){if(f.forms.some(v=>v.metrics.some(m=>m.name==='energy_kcal'&&m.value!==null)))stats.energy_foods++;for(const a of Object.values(f.goal_assessments))if(a.portion_guidance!==null)stats.portion_fields++;for(const[g,a]of Object.entries(f.goal_assessments)){stats.goal_labels[g]||={};stats.goal_labels[g][a.assessment]=(stats.goal_labels[g][a.assessment]||0)+1;}for(const form of f.forms)for(const m of form.metrics){stats.metrics++;if(m.value!==null)stats.single++;else if(m.range!==null)stats.range_only++;else stats.unknown++;}}
for(const[i,g]of doc.gaps.entries()){
 if(g.target_id==='foods:cfct6_values')set(`/gaps/${i}/issue`,'原373项未核实中国成分值保留在隔离候选附件。当前主库数值为官方嘌呤表59个单值及1个范围、USDA8个对应食品共80项报告值；没有新增计算值。','缺口说明与实际数据重算一致');
 if(g.target_id==='foods:composition_coverage')set(`/gaps/${i}/issue`,'89种食品中仅8种对应特定形态拥有USDA能量、蛋白、脂肪、碳水等成分报告值；其余这些成分未知，但部分另有指南嘌呤表值。SR Legacy/FNDDS并非全部为实测。','区分一般营养成分缺失和嘌呤已有值');
 if(g.target_id==='liver:food_level_inference')set(`/gaps/${i}/issue`,'肝目标59项有条件兼容、14项限制、2项避免、14项未专门讨论；大部分食材级应用是膳食模式外推，不能把原则的直接引用当作单品证据。','修正旧13项limit统计');
 if(g.target_id==='general:dg2022')set(`/gaps/${i}/issue`,'普通人群正式膳食指南原文仍待核对。r5已撤下食材评估中由疾病指南迁移的普通人群水果、油、盐、糖和酒精克数，仅保留明确标注的定性类别参考。','缺口与本轮保守处理同步');
}
const metricsOf=x=>x.foods.flatMap(f=>f.forms.map(v=>({food_id:f.food_id,form_id:v.form_id,basis:v.basis,metrics:v.metrics})));
if(JSON.stringify(metricsOf(original))!==JSON.stringify(metricsOf(doc)))throw Error('Numeric metrics or their provenance changed unexpectedly');
const schema=read('health-ingredient-reference.schema.json'),ajv=new Ajv({strict:false,allErrors:true});ajv.addFormat('uri',{type:'string',validate:s=>{try{return /^https?:$/.test(new URL(s).protocol);}catch{return false;}}});
const validate=ajv.compile(schema);if(!validate(doc))throw Error(JSON.stringify(validate.errors));
if(hash(fs.readFileSync(path.join(dir,inputName)))!==originalHash)throw Error('r4 changed during revision');
const outputName='health-ingredient-reference-r5.json';fs.writeFileSync(path.join(dir,outputName),JSON.stringify(doc,null,1)+'\n');
const out=path.join(dir,'acceptance-r5');fs.mkdirSync(out,{recursive:true});
const snapshots=[];for(const name of fs.readdirSync(path.join(dir,'build/usda')).filter(n=>n.endsWith('.json'))){const d=read('build/usda/'+name);for(const f of d.foods||[])if([170872,171287,2710788,169732,2708489,168482,169998,170026].includes(f.fdcId)&&!snapshots.some(x=>x.fdc_id===f.fdcId))snapshots.push({fdc_id:f.fdcId,description:f.description,data_type:f.dataType,fdc_published_date:f.publishedDate,food_category:f.foodCategory,snapshot:'build/usda/'+name,snapshot_sha256:hash(fs.readFileSync(path.join(dir,'build/usda/'+name)))});}
const manifest={revision:'r5',date:'2026-10-31',input:{file:inputName,sha256:originalHash},output:{file:outputName,sha256:hash(fs.readFileSync(path.join(dir,outputName)))},status:'research_reference_only',clinical_review:'not_clinically_reviewed',runtime_integrated:false,numeric_metrics_preserved:true,stats,changes,fdc_snapshots:snapshots};
fs.writeFileSync(path.join(out,'revision-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output:outputName,changes:changes.length,stats,numeric_metrics_preserved:true,r4_unchanged:true},null,2));
