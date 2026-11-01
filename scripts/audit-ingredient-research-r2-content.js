// Read-only checks against submitted r2 and its saved USDA API responses.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.join(__dirname,'../docs/research-handoff'),out=path.join(dir,'acceptance-r2');
fs.mkdirSync(out,{recursive:true});
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const doc=read('health-ingredient-reference-r2.json');
const nutrientIds={energy_kcal:1008,protein_g:1003,fat_g:1004,carbohydrate_g:1005,fiber_g:1079,sodium_mg:1093,potassium_mg:1092,total_sugars_g:2000,cholesterol_mg:1253,saturated_fat_g:1258};
const checked=[],mismatches=[],energyText=[],portionsWithoutDirectRefs=[];
for(const [fi,f] of doc.foods.entries()){
 for(const [oi,form] of f.forms.entries())for(const [mi,m] of form.metrics.entries()){
  const ref=m.evidence_refs.find(r=>r.source_id==='SRC_FDC');if(!ref)continue;
  const pointer=`/foods/${fi}/forms/${oi}/metrics/${mi}`;
  const id=Number(ref.locator.match(/FDC ID\s+(\d+)/)?.[1]);
  const snapshot=read(`build/usda/${f.food_id}.json`),food=snapshot.foods.find(x=>x.fdcId===id);
  const n=food?.foodNutrients.find(x=>x.nutrientId===nutrientIds[m.name]);
  const record={pointer,food_id:f.food_id,form_id:form.form_id,fdc_id:id,description:food?.description,data_type:food?.dataType,metric:m.name,submitted:m.value,snapshot_value:n?.value,snapshot_unit:n?.unitName};
  checked.push(record);
  if(!n||m.value!==n.value||m.unit.toLowerCase()!==n.unitName.toLowerCase())mismatches.push(record);
 }
 for(const [goal,a]of Object.entries(f.goal_assessments)){
  const pointer=`/foods/${fi}/goal_assessments/${goal}`;
  const hit=a.rationale.match(/能量约?(\d+(?:\.\d+)?)\s*(?:kcal|千卡)/);
  if(hit){
   const value=Number(hit[1]),forms=f.forms.filter(x=>a.form_ids.includes(x.form_id));
   const recorded=forms.flatMap(form=>form.metrics.filter(m=>m.name==='energy_kcal'&&m.value!==null).map(m=>({form_id:form.form_id,value:m.value})));
   energyText.push({pointer:pointer+'/rationale',food_id:f.food_id,goal,text:a.rationale,prose_value:value,recorded_energy:recorded,status:recorded.length===0?'no_numeric_energy_metric':recorded.some(m=>m.value===value)?'has_matching_metric':'differs_from_numeric_metrics'});
  }
  if(a.portion_guidance&&!a.evidence_refs.some(r=>r.support==='direct'))portionsWithoutDirectRefs.push({pointer:pointer+'/portion_guidance',food_id:f.food_id,goal,portion:a.portion_guidance,refs:a.evidence_refs});
 }
}
const suspectedFormMismatches=[];
for(const [fi,f]of doc.foods.entries())for(const [oi,form]of f.forms.entries())for(const [mi,m]of form.metrics.entries()){
 if(m.value===null&&m.range===null)continue;
 if(form.state==='raw'&&m.evidence_refs.some(r=>/（熟）|\(熟\)/.test(r.summary)))suspectedFormMismatches.push({pointer:`/foods/${fi}/forms/${oi}/metrics/${mi}`,food_id:f.food_id,identity:form.identity_details,state:form.state,refs:m.evidence_refs});
}
const hashNames=['ingredient-research-summary-r2.md','health-ingredient-reference-r2.json','ingredient-research-change-log-r2.md','ingredient-research-unverified-candidates-r2.json'];
const manualFindings=[
 ['egg','egg__whole_raw','purine_mg','生全蛋形态含熟鸡蛋的嘌呤值；需拆分生/熟形态'],
 ['noodle','noodle__boiled',null,'普通鲜面条套用enriched egg noodles成分；当前仅wheat过敏原，不能继续沿用'],
 ['new_starch','new_starch__corn','purine_mg','玉米淀粉套用土豆淀粉5mg/100g'],
 ['bread_whole','bread_whole__sliced','purine_mg','全麦面包套用未声明全麦的面包（带皮）51mg/100g'],
 ['bbq','bbq__mixed','purine_mg','混合烧烤/卤味套用单一羊肉串（熟）223mg/100g'],
 ['sausage','sausage__processed','purine_mg','香肠/腊肉套用火腿和午餐肉罐头的94～103区间；不能当作该类别范围'],
 ['mushroom_dried','mushroom_dried__dried','purine_mg','通用干香菇仍使用金钱菇405单值；应缩窄身份或拆分品种']
].map(([id,formId,metric,issue])=>{
 const fi=doc.foods.findIndex(f=>f.food_id===id),f=doc.foods[fi],oi=f.forms.findIndex(x=>x.form_id===formId),form=f.forms[oi],mi=metric?form.metrics.findIndex(m=>m.name===metric):-1;
 return {pointer:`/foods/${fi}/forms/${oi}`+(mi>=0?`/metrics/${mi}`:''),food_id:id,form_id:formId,issue,submitted_identity:form.identity_details};
});
const report={scope:'read_only_r2_snapshot_and_text_consistency_audit',input_sha256:Object.fromEntries(hashNames.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex')])),counts:{fdc_metrics_compared:checked.length,fdc_snapshot_mismatches:mismatches.length,energy_numbers_in_rationales:energyText.length,energy_text_without_numeric_metric:energyText.filter(x=>x.status==='no_numeric_energy_metric').length,energy_text_differs_from_numeric_metrics:energyText.filter(x=>x.status==='differs_from_numeric_metrics').length,portions_without_direct_support_refs:portionsWithoutDirectRefs.length,suspected_raw_cooked_mismatches:suspectedFormMismatches.length,manual_food_identity_findings:manualFindings.length},fdc_snapshot_checks:checked,fdc_snapshot_mismatches:mismatches,energy_text:energyText,portions_without_direct_support_refs:portionsWithoutDirectRefs,suspected_raw_cooked_mismatches:suspectedFormMismatches,manual_review_findings:manualFindings};
fs.writeFileSync(path.join(out,'content-checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,energy_examples:energyText.filter(x=>x.status!=='has_matching_metric').slice(0,8),portions_without_direct_support_refs:portionsWithoutDirectRefs,suspected_raw_cooked_mismatches:suspectedFormMismatches},null,2));
