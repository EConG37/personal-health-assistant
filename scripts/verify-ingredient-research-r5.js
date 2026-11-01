// Acceptance checks on delivered files, retained metric provenance, and notes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.join(__dirname,'../docs/research-handoff'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const doc=read('health-ingredient-reference-r5.json'),prev=read('health-ingredient-reference-r4.json'),manifest=read('acceptance-r5/revision-manifest.json'),base=read('acceptance-r5/automated-checks.json'),content=read('acceptance-r5/content-checks.json');
const errors=[],check=(condition,message)=>{if(!condition)errors.push(message);};
const digest=n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex');
check(base.totals.schema_valid,'Schema invalid');
for(const[k,n]of Object.entries(base.problem_counts))check(n===0,'Structural/source problem '+k+': '+n);
check(content.counts.fdc_metrics_compared===80&&content.counts.fdc_snapshot_errors===0,'USDA snapshot mismatch');
check(content.counts.energy_text_values===8&&content.counts.energy_text_mismatches===0,'Energy prose not matched to 8 verified records');
check(content.counts.unsupported_first_class_purine_assertions===0,'Unsupported purine classification remains');
check(content.counts.manual_text_findings_still_present===0,'Previous 15 rationale findings remain');
for(const[k,v]of Object.entries(content.identity_checks))check(v,'Food identity regression '+k);
check(digest(manifest.input.file)===manifest.input.sha256,'Original r4 changed');
check(digest(manifest.output.file)===manifest.output.sha256,'Delivered JSON differs from manifest');
const metrics=d=>d.foods.flatMap(f=>f.forms.map(v=>({food:f.food_id,form:v.form_id,identity:v.identity_details,state:v.state,basis:v.basis,metrics:v.metrics})));
check(JSON.stringify(metrics(doc))===JSON.stringify(metrics(prev)),'Metric values, identities, states, units or provenance changed');
check(content.counts.label_changes===0,'Disease labels changed outside authorized corrections');
const food=id=>doc.foods.find(f=>f.food_id===id),strings=[];
function walk(v,p){if(typeof v==='string')strings.push({pointer:p,text:v});else if(Array.isArray(v))v.forEach((x,i)=>walk(x,p+'/'+i));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))walk(x,p+'/'+k);}
walk(doc,'');
const oldNotes=read('acceptance-r4/notes-checks.json').note_findings;
const staleNotes=[];
for(const old of oldNotes){const current=strings.find(s=>s.pointer===old.pointer);if(current?.text===old.text)staleNotes.push(current);}
check(staleNotes.length===0,'One or more reviewed notes remain unchanged');
const forbidden=[/40g干片约147kcal/,/500ml一罐约215kcal/,/蜂蜜约80%/,/差异约3%/,/脂肪约9～10g/,/蛋白约占全蛋可食部58%/,/每日适量（30～50g干）/,/勾芡用量通常3～5g/];
const staleText=strings.filter(s=>s.pointer.startsWith('/foods/')&&forbidden.some(p=>p.test(s.text)));
check(staleText.length===0,'Stale quantity found outside rationale');
const energyConflicts=[];
for(const[fi,f]of doc.foods.entries()){
 const a=f.goal_assessments.weight,numericForms=f.forms.filter(v=>v.metrics.some(m=>m.name==='energy_kcal'&&m.value!==null));
 if(numericForms.length&&/未核实.{0,8}能量值/.test(a.rationale))energyConflicts.push({pointer:`/foods/${fi}/goal_assessments/weight/rationale`,text:a.rationale});
}
check(energyConflicts.length===0,'Verified energy still called unknown');
const noodle=food('new_egg_noodle'),snap=read('build/usda/noodle.json').foods.find(f=>f.fdcId===169732);
check(snap.foodCategory==='Cereal Grains and Pasta','Unexpected source food category');
check(noodle.goal_assessments.weight.rationale.includes('谷物面制主食')&&!noodle.goal_assessments.weight.rationale.startsWith('蛋白质来源'),'Egg noodle classified as primary protein');
check(noodle.allergens.includes('egg')&&noodle.allergens.includes('wheat'),'Egg-noodle allergen regression');
const nonempty=doc.foods.flatMap(f=>f.forms.flatMap(form=>form.metrics.filter(m=>m.value!==null||m.range!==null).map(m=>({form:form.form_id,basis:form.basis,metric:m.name}))));
check(nonempty.length===140&&nonempty.every(x=>x.basis.amount===100&&x.basis.unit==='g'),'Numeric data basis changed');
const gDose=strings.filter(s=>/^\/foods\/\d+\/goal_assessments\/general\/(rationale|conditions|portion_guidance)/.test(s.pointer)&&/\d+\s*(?:g|mg|ml|mL|kcal|个)/.test(s.text));
check(gDose.length===0,'Unverified general-adult quantitative advice remains');
const current=read('current-reference.json');check(current.reference_file===manifest.output.file&&current.sha256===manifest.output.sha256,'Current-reference pointer stale');
check(doc.meta.status==='research_reference_only'&&doc.meta.review_status==='not_clinically_reviewed'&&current.runtime_integrated===false,'Reference boundaries changed');
for(const s of manifest.fdc_snapshots)check(digest(s.snapshot)===s.snapshot_sha256,'Snapshot changed '+s.fdc_id);
const result={revision:'r5',date:'2026-10-31',pass:errors.length===0,scope:'structural_provenance_and_identified_content_corrections_not_clinical_validation',errors,summary:{foods:doc.foods.length,metrics:base.totals.metrics,known_numeric_or_ranges:nonempty.length,fully_unknown:base.totals.null_metrics,fdc_values_checked:content.counts.fdc_metrics_compared,energy_text_values_checked:content.counts.energy_text_values,old_note_findings:oldNotes.length,unchanged_old_notes:staleNotes.length,stale_quantities:staleText.length,energy_status_conflicts:energyConflicts.length,general_quantitative_doses:gDose.length,numeric_basis:'100g edible portion, form-specific',original_r4_unchanged:digest(manifest.input.file)===manifest.input.sha256,numeric_metrics_and_provenance_preserved:JSON.stringify(metrics(doc))===JSON.stringify(metrics(prev)),runtime_integrated:false},findings:{stale_notes:staleNotes,stale_text:staleText,energy_conflicts:energyConflicts,general_quantitative_doses:gDose}};
fs.writeFileSync(path.join(dir,'acceptance-r5/final-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exitCode=1;
