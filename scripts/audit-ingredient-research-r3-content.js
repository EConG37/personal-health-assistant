// Independent read-only content audit (r3 by default; --r4 selects r4).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const revisionArg=process.argv.slice(2).find(arg=>/^--r[3-9]\d*$/.test(arg)),revision=revisionArg?Number(revisionArg.slice(3)):3;
const dir=path.join(__dirname,'../docs/research-handoff'),out=path.join(dir,`acceptance-r${revision}`);fs.mkdirSync(out,{recursive:true});
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const doc=read(`health-ingredient-reference-r${revision}.json`),prev=read(`health-ingredient-reference-r${revision-1}.json`);
const nutrientIds={energy_kcal:1008,protein_g:1003,fat_g:1004,carbohydrate_g:1005,fiber_g:1079,sodium_mg:1093,potassium_mg:1092,total_sugars_g:2000,cholesterol_mg:1253,saturated_fat_g:1258};
const snapshots=new Map();
for(const name of fs.readdirSync(path.join(dir,'build/usda')).filter(n=>n.endsWith('.json'))){const file=read('build/usda/'+name);for(const f of file.foods||[])snapshots.set(f.fdcId,f);}
const fdcChecks=[],fdcErrors=[],energyChecks=[],energyErrors=[],unsupportedPurineClass=[],labelChanges=[],unknownEnergyCompatible=[];
for(const [fi,f]of doc.foods.entries()){
 for(const [oi,form]of f.forms.entries())for(const [mi,m]of form.metrics.entries()){
  const ref=m.evidence_refs.find(r=>r.source_id==='SRC_FDC');if(!ref)continue;
  const id=Number(ref.locator.match(/FDC ID\s+(\d+)/)?.[1]),food=snapshots.get(id),n=food?.foodNutrients.find(x=>x.nutrientId===nutrientIds[m.name]);
  const row={pointer:`/foods/${fi}/forms/${oi}/metrics/${mi}`,food_id:f.food_id,form_id:form.form_id,fdc_id:id,description:food?.description,metric:m.name,submitted:m.value,snapshot_value:n?.value,snapshot_unit:n?.unitName};
  fdcChecks.push(row);if(!n||m.value!==n.value||m.unit.toLowerCase()!==n.unitName.toLowerCase())fdcErrors.push(row);
 }
 const old=prev.foods.find(x=>x.food_id===f.food_id);
 for(const[goal,a]of Object.entries(f.goal_assessments)){
  const pointer=`/foods/${fi}/goal_assessments/${goal}`,forms=f.forms.filter(v=>a.form_ids.includes(v.form_id));
  const nums=forms.flatMap(v=>v.metrics.filter(m=>m.name==='energy_kcal'&&m.value!==null).map(m=>({form_id:v.form_id,value:m.value})));
  const matches=[...a.rationale.matchAll(/(?:能量(?:约|为)?\s*(\d+(?:\.\d+)?)\s*kcal\s*\/\s*100g|每100g(?:可食部)?能量(?:约|为)?\s*(\d+(?:\.\d+)?)\s*kcal)/g)];
  for(const hit of matches){const row={pointer:pointer+'/rationale',food_id:f.food_id,goal,value:Number(hit[1]??hit[2]),metrics:nums,text:a.rationale};energyChecks.push(row);if(!nums.some(x=>x.value===row.value))energyErrors.push(row);}
  if(a.rationale.includes('该食材嘌呤值属第一类')&&!forms.some(v=>v.metrics.some(m=>m.name==='purine_mg'&&(m.value!==null||m.range!==null))))unsupportedPurineClass.push({pointer:pointer+'/rationale',food_id:f.food_id,goal,text:a.rationale,conditions:a.conditions,preparation:a.preparation_notes});
  if(old&&a.assessment!==old.goal_assessments[goal].assessment)labelChanges.push({pointer:pointer+'/assessment',food_id:f.food_id,goal,before:old.goal_assessments[goal].assessment,after:a.assessment,rationale:a.rationale});
  if(goal==='weight'&&a.assessment==='compatible_under_conditions'&&!nums.length)unknownEnergyCompatible.push({pointer,food_id:f.food_id,rationale:a.rationale});
 }
}
const manualCandidates=[
 ['egg_white','pressure','166mg/100g','蛋白钠166mg/100g仍在理由中；该成分指标为空且无对应单品来源'],
 ['oyster','pressure','270mg/100g','牡蛎钠270mg/100g仍在理由中；该成分指标为空且无对应单品来源'],
 ['celery','pressure','80mg/100g','芹菜钠80mg/100g仍在理由中；该成分指标为空且无对应单品来源'],
 ['fish_cod','lipids','0.5g/100g','鳕鱼脂肪0.5g/100g仍在理由中；该成分指标为空且无对应单品来源'],
 ['noodle','pressure','2g以上','一碗面可含盐2g以上；缺一碗的重量、产品与钠来源'],
 ['olive_oil','lipids','14%','橄榄油SFA约14%；单品成分未补证'],
 ['honey','glucose','80%','蜂蜜约80%为糖；单品成分未补证'],
 ['sugary_drink','general','超50g','500ml可乐糖超50g；缺产品及原始标签/成分来源'],
 ['watermelon','glucose','200g','单次≤200g时GL有限；无对应GI/可利用碳水/计算依据'],
 ['walnut','lipids','10～15g','核桃每日10～15g；所引提高不饱和脂肪比例的原则未支持单品用量'],
 ['almond','lipids','10～15g','杏仁每日10～15g；所引提高不饱和脂肪比例的原则未支持单品用量'],
 ['beer','pressure','500ml','500ml啤酒接近男性酒精上限；缺对应产品酒精度与可复核换算'],
 ['liquor','pressure','62ml','50度白酒62ml的酒精换算缺公式和密度出处，须补计算口径或删除'],
 ['new_salt','glucose','≤5g','份量虽清空，rationale仍有5g跨目标限量'],
 ['new_salt','lipids','≤5g','份量虽清空，rationale仍有5g跨目标限量']
];
const manualFindings=manualCandidates.map(([id,goal,needle,issue])=>{const fi=doc.foods.findIndex(f=>f.food_id===id),f=doc.foods[fi],a=f.goal_assessments[goal];return {pointer:`/foods/${fi}/goal_assessments/${goal}/rationale`,food_id:id,goal,issue,still_present:a.rationale.includes(needle),text:a.rationale,metric_status:f.forms.map(v=>({form_id:v.form_id,metrics:v.metrics.filter(m=>['sodium_mg','total_sugars_g','saturated_fat_g','glycemic_index'].includes(m.name)).map(m=>({name:m.name,value:m.value,range:m.range}))})),evidence_refs:a.evidence_refs};});
const food=id=>doc.foods.find(f=>f.food_id===id),purine=id=>food(id).forms.flatMap(v=>v.metrics.filter(m=>m.name==='purine_mg'&&(m.value!==null||m.range!==null)));
const identityChecks={egg_separate_raw_cooked:food('egg').forms.some(v=>v.state==='raw')&&food('egg').forms.some(v=>v.state==='cooked'),raw_egg_no_cooked_purine:food('egg').forms.filter(v=>v.state==='raw').every(v=>v.metrics.filter(m=>m.name==='purine_mg').every(m=>m.value===null&&m.range===null)),plain_noodle_no_fdc_metrics:food('noodle').forms.every(v=>v.metrics.every(m=>!m.evidence_refs.some(r=>r.source_id==='SRC_FDC'))),egg_noodle_allergens:food('new_egg_noodle').allergens.includes('egg')&&food('new_egg_noodle').allergens.includes('wheat'),corn_starch_purine_removed:!purine('new_starch').length,whole_bread_purine_removed:!purine('bread_whole').length,mixed_bbq_purine_removed:!purine('bbq').length,sausage_purine_removed:!purine('sausage').length,dried_mushroom_identity_narrowed:food('mushroom_dried').forms.every(v=>v.identity_details.includes('金钱菇'))};
const hashNames=[`ingredient-research-summary-r${revision}.md`,`health-ingredient-reference-r${revision}.json`,`ingredient-research-change-log-r${revision}.md`];
const result={scope:`r${revision}_read_only_snapshot_text_and_regression_review`,input_sha256:Object.fromEntries(hashNames.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex')])),counts:{fdc_metrics_compared:fdcChecks.length,fdc_snapshot_errors:fdcErrors.length,energy_text_values:energyChecks.length,energy_text_mismatches:energyErrors.length,unsupported_first_class_purine_assertions:unsupportedPurineClass.length,manual_text_findings_still_present:manualFindings.filter(x=>x.still_present).length,label_changes:labelChanges.length,compatible_weight_assessments_without_energy_metrics:unknownEnergyCompatible.length},identity_checks:identityChecks,fdc_checks:fdcChecks,fdc_errors:fdcErrors,energy_checks:energyChecks,energy_errors:energyErrors,unsupported_purine_class:unsupportedPurineClass,manual_text_findings:manualFindings,label_changes:labelChanges,compatible_weight_without_energy:unknownEnergyCompatible};
fs.writeFileSync(path.join(out,'content-checks.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({counts:result.counts,identity_checks:identityChecks,unsupported_purine_class_ids:unsupportedPurineClass.map(x=>x.food_id),label_changes:labelChanges.map(x=>({id:x.food_id,goal:x.goal,before:x.before,after:x.after}))},null,2));
