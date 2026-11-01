// Read-only acceptance checks; originals and application rules are never modified.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Ajv=require('ajv');
const revisionArg=process.argv.slice(2).find(arg=>/^--r[2-9]\d*$/.test(arg)),suffix=revisionArg?'-'+revisionArg.slice(2):'';
const dir=path.join(__dirname,'../docs/research-handoff'),out=path.join(dir,'acceptance'+suffix);fs.mkdirSync(out,{recursive:true});
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const doc=read('health-ingredient-reference'+suffix+'.json'),baseline=read('health-food-baseline.json'),schema=read('health-ingredient-reference.schema.json');
const ajv=new Ajv({strict:false,allErrors:true});ajv.addFormat('uri',{type:'string',validate:s=>{try{return /^https?:$/.test(new URL(s).protocol);}catch{return false;}}});
const validate=ajv.compile(schema),schemaValid=validate(doc);
const goals=baseline.goals.map(g=>g.id),sources=new Map(doc.sources.map(s=>[s.source_id,s])),principles=new Map(doc.principles.map(p=>[p.principle_id,p]));
const problems={duplicates:[],missing_baseline_foods:[],invalid_new_ids:[],missing_rule_audits:[],dangling_sources:[],dangling_principles:[],dangling_forms:[],direct_refs_to_unavailable:[],direct_refs_to_catalogue:[],metrics_without_numeric_evidence:[],numeric_metrics_only_unavailable_sources:[],numeric_metrics_only_abstract_sources:[],generic_numeric_locators:[],basis_definition_conflicts:[],value_and_range:[],range_errors:[],origin_value_errors:[],assessments_without_direct_refs:[],portions_without_direct_refs:[]};
function unique(ids,kind){const seen=new Set();for(const id of ids){if(seen.has(id))problems.duplicates.push({kind,id});seen.add(id);}}
unique(doc.foods.map(f=>f.food_id),'food');unique(doc.sources.map(s=>s.source_id),'source');unique(doc.principles.map(p=>p.principle_id),'principle');unique(doc.rule_audits.map(r=>r.rule_id),'audit');unique(doc.foods.flatMap(f=>f.forms.map(x=>x.form_id)),'form');
const foodIds=new Set(doc.foods.map(f=>f.food_id)),baseIds=new Set(baseline.foods.map(f=>f.id)),auditIds=new Set(doc.rule_audits.map(r=>r.rule_id));
problems.missing_baseline_foods=[...baseIds].filter(id=>!foodIds.has(id));problems.invalid_new_ids=[...foodIds].filter(id=>!baseIds.has(id)&&!id.startsWith('new_'));
problems.missing_rule_audits=baseline.rules_to_audit.filter(r=>!auditIds.has(r.rule_id)).map(r=>r.rule_id);
const refCounts={};
function walk(value,pointer=''){
 if(!value||typeof value!=='object')return;
 if(value.source_id&&'locator'in value&&'support'in value){
  const source=sources.get(value.source_id);refCounts[value.source_id]=(refCounts[value.source_id]||0)+1;
  if(!source)problems.dangling_sources.push({pointer,source_id:value.source_id});
  if(source?.access==='unavailable'&&value.support==='direct')problems.direct_refs_to_unavailable.push({pointer,source_id:value.source_id,locator:value.locator});
  if(value.support==='direct'&&/题录/.test(value.locator))problems.direct_refs_to_catalogue.push({pointer,source_id:value.source_id,locator:value.locator});
 }
 for(const [key,child]of Object.entries(value))walk(child,pointer+'/'+key);
}
walk(doc);
const metrics=[],assessmentCounts=Object.fromEntries(goals.map(g=>[g,{}])),foodCoverage={};
for(const [fi,food]of doc.foods.entries()){
 foodCoverage[food.coverage]=(foodCoverage[food.coverage]||0)+1;const forms=new Set(food.forms.map(x=>x.form_id));
 for(const goal of goals){const a=food.goal_assessments[goal],pointer=`/foods/${fi}/goal_assessments/${goal}`;
  if(!a)continue;assessmentCounts[goal][a.assessment]=(assessmentCounts[goal][a.assessment]||0)+1;
  for(const id of a.form_ids)if(!forms.has(id))problems.dangling_forms.push({pointer,id});
  for(const id of a.principle_ids)if(!principles.has(id))problems.dangling_principles.push({pointer,id});
  if(['compatible_under_conditions','limit','avoid'].includes(a.assessment)&&!a.evidence_refs.length)problems.assessments_without_direct_refs.push({pointer,food_id:food.food_id,goal,assessment:a.assessment});
  if(a.portion_guidance&&!a.evidence_refs.length)problems.portions_without_direct_refs.push({pointer,food_id:food.food_id,goal,portion:a.portion_guidance});
 }
 for(const [oi,form]of food.forms.entries())for(const [mi,m]of form.metrics.entries()){
  const pointer=`/foods/${fi}/forms/${oi}/metrics/${mi}`,record={pointer,food_id:food.food_id,form_id:form.form_id,name:m.name,value:m.value,range:m.range,unit:m.unit,basis:form.basis,definition:m.measurement_definition,source_ids:m.evidence_refs.map(r=>r.source_id)};
  metrics.push(record);const numeric=m.value!==null||m.range!==null;
  if(numeric&&!m.evidence_refs.length)problems.metrics_without_numeric_evidence.push(record);
  if(numeric&&m.evidence_refs.length&&m.evidence_refs.every(r=>sources.get(r.source_id)?.access==='unavailable'))problems.numeric_metrics_only_unavailable_sources.push(record);
  if(numeric&&m.evidence_refs.length&&m.evidence_refs.every(r=>sources.get(r.source_id)?.access==='abstract_only'))problems.numeric_metrics_only_abstract_sources.push(record);
  if(numeric&&m.evidence_refs.some(r=>/相应食物条目|International tables of glycemic index and glycemic load values: 2021$/.test(r.locator)))problems.generic_numeric_locators.push(record);
  if(form.basis.unit==='ml'&&/100\s*g/i.test(m.measurement_definition)&&!/100\s*ml/i.test(m.measurement_definition))problems.basis_definition_conflicts.push(record);
  if(form.basis.unit==='g'&&/100\s*ml/i.test(m.measurement_definition)&&!/100\s*g/i.test(m.measurement_definition))problems.basis_definition_conflicts.push(record);
  if(m.value!==null&&m.range!==null)problems.value_and_range.push(record);
  if(m.range&&(m.range[0]>m.range[1]||(m.value!==null&&(m.value<m.range[0]||m.value>m.range[1]))))problems.range_errors.push(record);
  if(m.origin==='not_found'&&numeric)problems.origin_value_errors.push(record);
 }
}
const sourceMetrics={};for(const m of metrics)for(const id of m.source_ids){sourceMetrics[id]||={all:0,numeric:0};sourceMetrics[id].all++;if(m.value!==null||m.range!==null)sourceMetrics[id].numeric++;}
const totals={schema_valid:schemaValid,schema_errors:validate.errors||[],foods:doc.foods.length,baseline_foods:baseIds.size,new_foods:[...foodIds].filter(id=>!baseIds.has(id)),goals:goals.length,assessments:doc.foods.reduce((n,f)=>n+Object.keys(f.goal_assessments).length,0),forms:doc.foods.reduce((n,f)=>n+f.forms.length,0),metrics:metrics.length,numeric_metrics:metrics.filter(m=>m.value!==null||m.range!==null).length,null_metrics:metrics.filter(m=>m.value===null&&m.range===null).length,sources:doc.sources.length,principles:doc.principles.length,rule_audits:doc.rule_audits.length,food_coverage:foodCoverage,assessment_counts:assessmentCounts,refs_by_source:refCounts,metrics_by_source:sourceMetrics};
const report={review_date:'2026-10-31',scope:'structural_and_provenance_checks_not_clinical_validation',input_sha256:Object.fromEntries(['ingredient-research-summary'+suffix+'.md','health-ingredient-reference'+suffix+'.json','health-ingredient-reference.schema.json','health-food-baseline.json'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')])),totals,problem_counts:Object.fromEntries(Object.entries(problems).map(([k,v])=>[k,v.length])),problems};
fs.writeFileSync(path.join(out,'automated-checks.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'metric-inventory.json'),JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify({totals,problem_counts:report.problem_counts},null,2));
